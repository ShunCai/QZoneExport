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

        // 过滤指定屏蔽词说说
        items = API.Messages.filterKeyWords(items);

        // 获取所有说说的全文
        items = await API.Messages.getAllFullContent(items);

        // 获取所有图片（超9张需单独获取）
        items = await API.Messages.getAllImages(items);

        // 获取所有的语音说说信息
        items = await API.Messages.getAllVoices(items);

        // 获取所有的说说评论
        items = await API.Messages.getItemsAllCommentList(items);

        // 获取说说赞记录
        items = await API.Messages.getAllLikeList(items);

        // 获取最近访问
        items = await API.Messages.getAllVisitorList(items);

        // 添加说说多媒体下载任务
        items = await API.Messages.addMediaToTasks(items);

        // 根据导出类型导出数据    
        await API.Messages.exportAllListToFiles(items);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Messages);

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
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Messages.getMessages(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_preloadCallback\(/);

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Messages.pageSize);

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

    // 说说状态更新器
    const indicator = new StatusIndicator('Messages');

    // 说说配置项
    const CONFIG = QZone_Config.Messages;

    const nextPage = async function (pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getList(pageIndex, indicator).then(async (dataList) => {
            // 合并数据
            QZone.Messages.Data = API.Utils.unionItems(QZone.Messages.Data, dataList);
            if (API.Common.isPreBackupPos(dataList, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Messages.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async (e) => {
            console.error("获取说说列表异常，当前页：", nextPageIndex, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    // 获取第一页
    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Messages.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Messages.OLD_Data, QZone.Messages.Data);

    // 发表时间倒序
    QZone.Messages.Data = API.Utils.sort(QZone.Messages.Data, CONFIG.PreBackup.field, true);

    // 完成
    indicator.complete();

    return QZone.Messages.Data;
}

/**
 * 获取所有说说的全文内容
 * @param {Array} items 说说列表
 */
API.Messages.getAllFullContent = async (items) => {
    if (!QZone_Config.Messages.isFull) {
        // 不获取全文内容时，跳过不处理
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Full_Content');

    // 更新总数
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 更新状态-当前位置
        indicator.setIndex(i + 1);

        // 是否有全文
        const hasMoreContent = item.has_more_con === 1 || item.rt_has_more_con === 1;

        if (!hasMoreContent || !API.Common.isNewItem(item)) {
            // 不需要获取全文或者已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

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
    return await API.Messages.getComments(item.tid, pageIndex).then(async (data) => {
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
 */
API.Messages.getItemAllCommentList = async (item) => {
    if (!(item.commenttotal > item.custom_comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.custom_comments;
    }
    // 情况原有的评论列表
    item.custom_comments = [];

    // 说说评论配置
    const CONFIG = QZone_Config.Messages.Comments;

    // 更新总数
    const total = API.Utils.getCommentCount(item);

    const nextPage = async function (item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getItemCommentList(item, pageIndex).then(async (dataList) => {
            // 合并评论列表
            item.custom_comments = item.custom_comments.concat(dataList || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
        }).catch(async (e) => {
            console.error("获取说说评论列表异常，当前页：", pageIndex + 1, item, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_comments
}

/**
 * 获取所有说说的评论列表
 * @param {string} item 说说
 */
API.Messages.getItemsAllCommentList = async (items) => {
    if (!QZone_Config.Messages.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Comments');
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 更新当前位置
        indicator.setIndex(i + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        // 获取说说的全部评论
        await API.Messages.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 完成
    indicator.complete();
    return items;
}

/**
 * 所有说说转换成导出文件
 */
API.Messages.exportAllListToFiles = async (items) => {
    // 获取用户配置
    let exportType = QZone_Config.Messages.exportType;
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

        // 基于JSON生成JS
        console.info('生成说说JSON开始', messages);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('dataList', messages, QZone.Common.ROOT + '/json/messages.js');
        console.info('生成说说JSON结束', jsonFile, messages);

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
    // 完成
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
                console.info('备份说说列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份说说列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Messages.ROOT + '/Messages.md').then((fileEntry) => {
            console.info('生成汇总说说Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总说说Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出说说到Markdown文件异常', error, items);
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
    // 进度功能性期
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('JSON');

    // 生成年份JSON
    // 说说数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "custom_create_time", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份说说JSON文件', year);
        const yearFilePath = QZone.Messages.ROOT + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份说说JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份说说JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, QZone.Messages.ROOT + '/messages.json').then((fileEntry) => {
        console.info('生成汇总说说JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总说说JSON文件异常", items, e)
    });

    // 完成
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
            const repImgs = repItem.pic || [];
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

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载说说配图
        for (const image of item.custom_images) {
            // 说说同时包含图片与视频，需要单独处理视频
            if (image.is_video && image.video_info) {
                // 视频
                const video = image.video_info;
                if (API.Videos.isExternalVideo(video)) {
                    // 外部视频（腾讯视频、第三方视频）不做处理
                    continue;
                }
                // 添加视频下载任务
                API.Videos.addDownloadTasks([video], module_dir, item, QZone.Messages.FILE_URLS);
            } else {
                // 普通图片
                let url = image.url2 || image.url1;
                await API.Utils.addDownloadTasks(image, url, module_dir, item, QZone.Messages.FILE_URLS);
            }
            indicator.addSuccess(image);
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

    // 状态更新器
    const indicator = new StatusIndicator('Messages_More_Images');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];

        // 当前处理位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        const images = item.custom_images;
        // 如果图片总数大于图片实际数，则获取更多图片
        if (item.imagetotal <= images.length) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
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
            // 已处理
            indicator.addSuccess(item);
        }).catch((error) => {
            // 已失败
            indicator.addFailed(item);
            console.error('获取说说更多图片异常', item, error);
        });
    }

    // 完成
    indicator.complete();
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

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Voices');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];

        // 当前处理位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        const voices = item.custom_voices;
        if (voices.length === 0) {
            // 没有语音信息跳过
            indicator.addSkip(item);
            continue;
        }
        for (const voice of voices) {
            await API.Messages.getVoiceInfo(voice).then((voiceInfo) => {
                voiceInfo = API.Utils.toJson(voiceInfo, /^_Callback\(/);
                voice.custom_url = voiceInfo.data.url;
            }).catch((error) => {
                console.error('获取说说语音失败', item, error);
            });
        }

        // 已处理
        indicator.addSuccess(item);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 处理数据
 * @param items 需要转换的数据
 */
API.Messages.convert = (items) => {
    items = items || [];
    for (const item of items) {
        // 内容
        item.custom_content = item.content;
        item.conlist = item.conlist || [];

        // 评论
        item.commenttotal = API.Utils.getCommentCount(item);
        item.custom_comments = item.commentlist || [];

        // 配图
        item.imagetotal = item.pictotal || 0;
        item.custom_images = item.pic || [];

        // 语音
        item.voicetotal = item.voicetotal || 0;
        item.custom_voices = item.voice || [];

        // 音乐
        item.audiototal = item.audiototal || 0;
        item.custom_audios = item.audio || [];

        // 特殊动漫表情
        item.magictotal = item.magictotal || 0;
        item.custom_magics = item.magic || [];
        // 处理表情
        for (const magic of item.custom_magics) {
            if (magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)) {
                magic.custom_url = 'http://qzonestyle.gtimg.cn/qzone/em/120/mb{0}.jpg'.format(magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)[1]);
            }
        }

        // 视频
        item.videototal = item.videototal || 0;
        item.custom_videos = item.video || [];
        for (const video of item.custom_videos) {
            // 处理异常数据的视频URL
            video.video_id = video.video_id || '';
            video.video_id = video.video_id.replace("http://v.qq.com/", "");
        }

        // 投票

        // 位置
        item.lbs = item.lbs || {};

        // 创建时间
        item.custom_create_time = API.Utils.formatDate(item.created_time);

        // 添加点赞Key
        item.uniKey = API.Messages.getUniKey(item.tid);
    }
    return items;
}

/**
 * 说说内容是否包含指定屏蔽词
 * @param {string} content 说说内容
 */
API.Messages.isMatchFilterKey = (content) => {
    let isMatch = false;
    for (const keyWord of QZone_Config.Messages.FilterKeyWords) {
        const keyWords = keyWord.split('&&');
        let matchCount = 0;
        for (const key of keyWords) {
            const regex = new RegExp(key, 'ig');
            if (content.match(regex)) {
                matchCount++;
            }
        }
        if (matchCount === keyWords.length) {
            isMatch = true;
            break;
        }
    }
    return isMatch;
}

/**
 * 过滤含屏蔽词的说说
 * @param {Array} items 说说列表
 */
API.Messages.filterKeyWords = (items) => {
    if (!QZone_Config.Messages.isFilterKeyword || QZone_Config.Messages.FilterKeyWords.length === 0) {
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Filter');
    indicator.setTotal(items.length);

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        const isMatch = API.Messages.isMatchFilterKey(item.custom_content);
        if (isMatch) {
            // 包含屏蔽词，移除
            items.splice(i, 1);
            indicator.addSuccess(item);
            continue;
        }
        indicator.addSkip(item);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 获取说说赞记录
 * @param {Array} items 说说列表
 */
API.Messages.getAllLikeList = async (items) => {
    if (!API.Common.isGetLike(QZone_Config.Messages)) {
        // 不获取赞
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, QZone_Config.Common.downloadThread);

    // 获取点赞列表
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {

            const item = list[j];
            item.likes = item.likes || [];

            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }
            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Messages).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取说说点赞异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
}

/**
 * 获取单条说说的全部最近访问
 * @param {object} item 说说
 */
API.Messages.getItemAllVisitorsList = async (item) => {
    // 清空原有的最近访问信息
    item.custom_visitor = {
        viewCount: 0,
        totalNum: 0,
        list: []
    };

    // 说说最近访问配置
    const CONFIG = QZone_Config.Messages.Visitor;

    const nextPage = async function (item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getVisitors(item.tid, pageIndex).then(async (data) => {
            data = API.Utils.toJson(data, /^_Callback\(/).data || {};

            // 合并
            item.custom_visitor.viewCount = data.viewCount || 0;
            item.custom_visitor.totalNum = data.totalNum || 0;
            item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        }).catch(async (e) => {
            console.error("获取说说最近访问列表异常，当前页：", pageIndex + 1, item, e);

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_visitor;
}

/**
 * 获取说说最近访问
 * @param {Array} items 说说列表
 */
API.Messages.getAllVisitorList = async (items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Messages)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Visitor');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 5);

    // 获取最近访问
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {
            const item = list[j];
            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }
            indicator.setIndex(++count);
            tasks.push(API.Messages.getItemAllVisitorsList(item).then((visitor) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取说说最近访问异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
}