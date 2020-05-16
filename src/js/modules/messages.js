/**
 * QQ空间说说模块的导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出说说数据
 */
API.Messages.export = async () => {

    try {

        // 获取所有的说说数据
        let items = await API.Messages.getAllList();

        // 获取所有说说的全文
        items = await API.Messages.getAllFullContent(items);

        // 获取所有图片（超9张需单独获取）
        items = await API.Messages.getAllImages(items);

        // 获取所有的语音说说信息
        items = await API.Messages.getAllVoices(items);

        // 获取所有的说说评论
        items = await API.Messages.getItemsAllCommentList(items);

        // 添加说说多媒体下载任务
        items = await API.Messages.addMediaToTasks(items);

        // 根据导出类型导出数据    
        await API.Messages.exportAllListToFiles(items);
    } catch (error) {
        console.error('说说导出异常', error);
    }
}

/**
 * 获取单页的说说列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Messages.getList = async (pageIndex, indicator) => {
    console.debug("获取说说列表开始，当前页：", pageIndex + 1);
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Messages.getMessages(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_preloadCallback\(/);

        console.debug("获取说说列表结束，当前页：", pageIndex + 1, data);

        // 更新状态-下载中的数量
        indicator.addDownload(Qzone_Config.Messages.pageSize);

        // 返回的总数包括无权限的说说的条目数，这里返回为空时表示无权限获取其他的数据
        if (data.msglist == null || data.msglist.length == 0) {
            return [];
        }

        // 更新状态-总数
        QZone.Messages.total = data.total || QZone.Messages.total || 0;
        indicator.setTotal(QZone.Messages.total);

        let items = data.msglist || [];

        // 转换数据
        items = API.Messages.convert(items);

        // 更新状态-下载成功数
        indicator.addSuccess(items);

        return items;
    })
}

/**
 * 获取所有说说列表
 */
API.Messages.getAllList = async () => {

    // 重置数据
    QZone.Messages.Data = [];
    QZone.Messages.Images = [];

    // 说说状态更新器
    let indicator = new StatusIndicator('Messages');

    let nextPage = async function (pageIndex, indicator) {
        return await API.Messages.getList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Messages.Data = QZone.Messages.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, Qzone_Config.Messages.pageSize, QZone.Messages.total, QZone.Messages.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = Qzone_Config.Messages.randomSeconds.min;
                let max = Qzone_Config.Messages.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Messages.Data;
        }).catch(async (e) => {
            console.error("获取说说列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: Qzone_Config.Messages.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, Qzone_Config.Messages.pageSize, QZone.Messages.total, QZone.Messages.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = Qzone_Config.Messages.randomSeconds.min;
                let max = Qzone_Config.Messages.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Messages.Data;
        });
    }

    await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return QZone.Messages.Data
}

/**
 * 获取所有说说的全文内容
 * @param {Array} items 说说列表
 */
API.Messages.getAllFullContent = async (items) => {
    if (!Qzone_Config.Messages.isFull) {
        // 不获取全文内容时，跳过不处理
        return items;
    }

    // 状态更新器
    let indicator = new StatusIndicator('Messages_Full_Content');

    let more_items = API.Messages.getMoreItems(items)

    // 更新总数
    indicator.setTotal(more_items.length);

    for (let i = 0; i < more_items.length; i++) {
        const item = more_items[i];

        // 更新状态-当前位置
        indicator.index = i + 1

        // 更新状态-下载中的数量
        indicator.addDownload(1);

        // 获取自身说说的全文
        await API.Messages.getFullContent(item.tid).then((data) => {
            // 更新状态-下载成功数
            indicator.addSuccess(item);
            data = API.Utils.toJson(data, /^_Callback\(/);
            // 自身全文
            item.content = data.content;
            item.conlist = data.conlist || [];
            // 转发全文
            if (item.rt_tid) {
                item.rt_con = data.rt_con;
            }
        }).catch((e) => {
            console.error("获取说说自身全文异常", item, e);
            indicator.addFailed(item);
        });
    }

    // 完成
    indicator.complete();

    return items;

}

/**
 * 获取单条说说的单页评论列表
 * @param {object} item 说说
 * @param {integer} pageIndex 页数索引
 */
API.Messages.getItemCommentList = async (item, pageIndex) => {
    console.debug("开始获取说说评论列表，当前页：", pageIndex + 1, item);
    return await API.Messages.getComments(item.tid, pageIndex).then(async (data) => {
        console.debug("获取说说评论列表完成，当前页：", pageIndex + 1, item);
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_preloadCallback\(/);

        // 下载相对目录
        let module_dir = 'Messages/Images';

        // 处理说说评论的配图
        let comments = data.commentlist || [];
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            let images = comment.pic || [];
            for (let j = 0; j < images.length; j++) {
                // 处理说说评论的配图
                const image = images[j];
                await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
            }

            // 获取评论回复
            let replies = comment.list_3 || [];
            for (let k = 0; k < replies.length; k++) {
                const repItem = replies[k];
                let images = repItem.pic || [];
                for (let r = 0; r < images.length; r++) {
                    const image = images[r];
                    await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
                }
            }
        }
        return comments;
    });
}


/**
 * 获取单条说说的全部评论列表
 * @param {object} item 说说
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Messages.getItemAllCommentList = async (item, indicator) => {
    if (!(item.commenttotal > item.custom_comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        // console.debug('当前说说不需要获取全部评论列表', item);
        return item.custom_comments;
    }
    // 情况原有的评论列表
    item.custom_comments = [];

    // 说说评论配置
    let CONFIG = Qzone_Config.Messages.Comments;

    // 更新总数
    let total = API.Utils.getCommentCount(item);
    indicator.setTotal(total);

    let nextPage = async function (item, pageIndex) {
        return await API.Messages.getItemCommentList(item, pageIndex).then(async (dataList) => {

            // 更新成功条目数
            indicator.addSuccess(dataList.length);

            // 合并评论列表
            item.custom_comments = item.custom_comments.concat(dataList || []);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, total, item.custom_comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.custom_comments;
        }).catch(async (e) => {
            console.error("获取说说评论列表异常，当前页：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Messages.total, QZone.Messages.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.custom_comments;
        });
    }

    await nextPage(item, 0);

    // 完成
    indicator.complete();

    return item.custom_comments
}

/**
 * 获取所有说说的评论列表
 * @param {string} item 说说
 */
API.Messages.getItemsAllCommentList = async (items) => {
    if (!Qzone_Config.Messages.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // 单条说说状态更新器
        let indicator = new StatusIndicator('Messages_Comments');

        // 更新当前位置
        indicator.index = i + 1;

        // 获取说说的全部评论
        await API.Messages.getItemAllCommentList(item, indicator);
    }
    return items;
}

/**
 * 所有说说转换成导出文件
 */
API.Messages.exportAllListToFiles = async (items) => {
    // 获取用户配置
    let exportType = Qzone_Config.Messages.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Messages.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Messages.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Messages.exportToJson(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出说说到HTML文件
 * @param {Array} messages 数据
 */
API.Messages.exportToHtml = async (messages) => {
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('HTML');
    try {
        // 说说数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        // 基于模板生成年份说说HTML
        for (const [year, yearItems] of yearMaps) {
            console.info('生成说说年份HTML文件开始', year, yearItems);
            // 基于模板生成所有说说HTML
            let _messageMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "custom_create_time", 'month');
            _messageMaps.set(year, monthMaps);
            let params = {
                messageMaps: _messageMaps,
                total: yearItems.length
            }
            let yearFile = await API.Common.writeHtmlofTpl('messages', params, QZone.Messages.ROOT + "/" + year + ".html");
            console.info('生成说说年份HTML文件结束', year, yearItems, yearFile);
        }

        console.info('生成说说汇总HTML文件开始', messages);
        // 基于模板生成汇总说说HTML
        let params = {
            messageMaps: API.Utils.groupedByTime(messages, "custom_create_time", 'all'),
            total: messages.length
        }
        let allFile = await API.Common.writeHtmlofTpl('messages', params, QZone.Messages.ROOT + "/index.html");
        console.info('生成说说汇总HTML文件结束', allFile, messages);
    } catch (error) {
        console.error('导出说说到HTML异常', error, messages);
    }
    indicator.complete();
    return messages;
}

/**
 * 导出说说到Markdown文件
 * @param {Array} items 数据
 */
API.Messages.exportToMarkdown = async (items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 说说数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "custom_create_time");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Messages.getMarkdown(item));
                    yearContents.push('---');
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = QZone.Messages.ROOT + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.debug('备份说说列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份说说列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Messages.ROOT + '/Messages.md');
    } catch (error) {
        console.error('导出视频到Markdown文件异常', error, videos);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出说说到JSON文件
 * @param {Array} items 数据
 */
API.Messages.exportToJson = async (items) => {
    // 说说数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "custom_create_time");
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('JSON');
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];
        console.debug('正在生成年份JSON文件', year);
        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];
            yearItems = yearItems.concat(items);
        }
        const yearFilePath = QZone.Messages.ROOT + "/" + year + ".json";
        let fileEntry = await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath);
        console.debug('生成年份JSON文件完成', year, fileEntry);
    }

    let json = JSON.stringify(items);
    await API.Utils.writeText(json, QZone.Messages.ROOT + '/messages.json');
    indicator.complete();
    return items;
}


/**
 * 获取说说的MD内容
 */
API.Messages.getMarkdown = (item) => {
    let contents = [];

    // 发布信息
    let message_info = "> " + item.custom_create_time;
    // 发布地址
    if (item.lbs && item.lbs.idname && item.lbs.idname !== '') {
        const ibs_url = API.Messages.getMapUrl(item.lbs);
        message_info += "【" + API.Utils.getLink(ibs_url, item.lbs.idname, 'MD') + "】";
    }
    // 转发标识
    let isRt = item.rt_tid;
    if (isRt) {
        message_info += "【转发】";
    }
    contents.push(message_info);
    contents.push("\r\n");

    // 语音说说 语音说说暂不支持转发，直接将语音说说放置到原创说说前面
    if (item.voicetotal > 0) {
        contents.push(API.Messages.getVoiceHTML(item));
    }

    // 说说内容
    contents.push(API.Common.formatContent(item, "MD", false));

    // 转发内容
    if (isRt) {

        // 原文标识
        contents.push("> 原文:");
        contents.push("\r\n");

        // 原作者
        let rt_name = API.Common.formatContent(item.rt_uinname, 'MD');
        rt_name = API.Common.getUserLink(item.rt_uin, rt_name, 'MD', true);

        // 原内容
        contents.push('{0}：{1}'.format(rt_name, API.Common.formatContent(item, 'MD', true)));
    }

    // 说说为转发说说时，对应的图片，视频，歌曲信息属于源说说的
    contents.push(API.Messages.formatMediaMarkdown(item));

    // 评论内容
    const comments = item.custom_comments || [];
    contents.push("> 评论({0})".format(item.commenttotal));
    contents.push('\r\n');
    for (const comment of comments) {

        // 评论人
        let comment_name = API.Common.formatContent(comment.name, 'MD');
        comment_name = API.Common.getUserLink(comment.uin, comment_name, 'MD', true);

        contents.push("*  {0}：{1}".format(comment_name, API.Common.formatContent(comment.content, 'MD')));

        // 评论包含图片
        const comment_images = comment.pic || [];
        for (const image of comment_images) {
            // 替换URL
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(image.custom_url, image.custom_filepath, "Messages_MD")));
        }

        // 评论的回复
        const replies = comment.list_3 || [];
        for (const repItem of replies) {
            // 回复人
            let repName = API.Common.formatContent(repItem.name, 'MD');
            repName = API.Common.getUserLink(repItem.uin, repName, 'MD', true);

            // 回复内容
            let content = API.Common.formatContent(repItem.content, 'MD');

            // 回复内容
            contents.push("\t* {0}：{1}".format(repName, content));

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            var repImgs = repItem.pic || [];
            for (const repImg of repImgs) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(repImg.custom_url, repImg.custom_filepath, "Messages_MD")));
            }
        }
    }
    contents.push('\r\n');
    return contents.join('\r\n');
}

/**
 * 添加说说的多媒体下载任务
 * @param {Array} dataList
 */
API.Messages.addMediaToTasks = async (dataList) => {
    if (!dataList) {
        return dataList;
    }
    // 进度更新器
    let indicator = new StatusIndicator('Messages_Images_Mime');

    // 下载相对目录
    let module_dir = 'Messages/Images';

    for (const item of dataList) {
        // 下载说说配图
        for (const image of item.custom_images) {
            let url = image.url2 || image.url1;
            await API.Utils.addDownloadTasks(image, url, module_dir, item, QZone.Messages.FILE_URLS);
            indicator.addSuccess(1);
        }

        // 下载视频预览图及视频
        API.Videos.addDownloadTasks(item.custom_videos, module_dir, item, QZone.Messages.FILE_URLS);
        indicator.addSuccess(item.custom_videos);

        // 下载音乐预览图
        for (const audio of item.custom_audios) {
            // 音乐预览图不识别后缀，直接使用JEPG
            await API.Utils.addDownloadTasks(audio, audio.image, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }

        // 下载语音
        for (const voice of item.custom_voices) {
            await API.Utils.addDownloadTasks(voice, voice.custom_url, module_dir, item, QZone.Messages.FILE_URLS, '.mp3');
            indicator.addSuccess(1);
        }

        // 下载特殊表情
        for (const magic of item.custom_magics) {
            await API.Utils.addDownloadTasks(magic, magic.custom_url, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }


        // 获取评论的配图
        // 评论内容
        let comments = item.custom_comments || [];
        for (const comment of comments) {
            // 评论包含图片
            let images = comment.pic || [];
            for (const image of images) {
                await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
                indicator.addSuccess(1);
            }

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            let replies = comment.list_3 || [];
            for (const repItem of replies) {
                let images = repItem.pic || [];
                for (const image of images) {
                    await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
                    indicator.addSuccess(1);
                }
            }
        }
    }
    // 完成
    indicator.complete();
    return dataList;
}

/**
 * 获取所有图片（超9张需单独获取）
 * @param {Array} items 说说列表
 */
API.Messages.getAllImages = async (items) => {
    if (!items) {
        return items;
    }
    for (const item of items) {
        const images = item.custom_images;
        // 如果图片总数大于图片实际数，则获取更多图片
        if (item.imagetotal <= images.length) {
            continue;
        }
        await API.Messages.getImageInfos(item.tid).then((data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            const imageUrls = data.imageUrls || [];
            for (let index = 0; index < imageUrls.length; index++) {
                // 返回的图片URL
                const url = imageUrls[index];
                // 说说原来的图片对象
                const oldImage = images[index];
                if (oldImage) {
                    // 匹配上，则替换(可不替换？)
                    oldImage.url1 = url;
                    oldImage.url2 = url;
                    oldImage.url3 = url;
                } else {
                    images.push({
                        url1: url,
                        url2: url,
                        url3: url
                    });
                }
            }
        }).catch((error) => {
            console.error('获取说说更多图片异常', item, error);
        });
    }
    return items;
}

/**
 * 获取语音说说的实际地址
 * @param {Array} items 说说列表
 */
API.Messages.getAllVoices = async (items) => {
    if (!items) {
        return items;
    }
    for (const item of items) {
        const voices = item.custom_voices;
        for (const voice of voices) {
            await API.Messages.getVoiceInfo(voice).then((voiceInfo) => {
                voiceInfo = API.Utils.toJson(voiceInfo, /^_Callback\(/);
                voice.custom_url = voiceInfo.data.url;
            }).catch((error) => {
                console.error('获取说说语音失败', item, error);
            });
        }
    }
    return items;
}