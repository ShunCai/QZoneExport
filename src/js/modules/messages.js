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

        // 获取所有的说说评论
        items = await API.Messages.getItemsAllCommentList(items);

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
    console.debug("开始获取说说列表，当前页：", pageIndex + 1);
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Messages.getMessages(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_preloadCallback\(/);

        console.debug("成功获取说说列表，当前页：", pageIndex + 1, data);

        // 更新状态-下载中的数量
        indicator.addDownload(Qzone_Config.Messages.pageSize);

        // 返回的总数包括无权限的说说的条目数，这里返回为空时表示无权限获取其他的数据
        if (data.msglist == null || data.msglist.length == 0) {
            return [];
        }

        // 更新状态-总数
        QZone.Messages.total = data.total;
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

        if (item.has_more_con === 1) {
            // 获取自身说说的全文
            await API.Messages.getFullContent(item.tid).then((data) => {
                // 更新状态-下载成功数
                indicator.addSuccess(item)
                data = API.Utils.toJson(data, /^_Callback\(/);
                item.content = data.content;
                item.conlist = data.conlist || [];
            }).catch((e) => {
                console.error("获取说说自身全文异常", item, e);
                indicator.addFailed(item);
            });
        }

        if (item.rt_uin && item.rt_has_more_con === 1) {
            // 获取转发说说的全文
            await API.Messages.getFullContent(item.tid).then((data) => {
                // 更新状态-下载成功数
                indicator.addSuccess(item)

                data = API.Utils.toJson(data, /^_Callback\(/);
                item.rt_con = data.rt_con;

            }).catch((e) => {
                console.error("获取说说转发全文异常", item, e);
                indicator.addFailed(item);
            });
        }
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
        let moudel_dir = '说说/图片';

        // 处理说说评论的配图
        let comments = data.commentlist || [];
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            let images = comment.pic || [];
            for (let j = 0; j < images.length; j++) {
                // 处理说说评论的配图
                const image = images[j];
                await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, moudel_dir, item, QZone.Messages.FILE_URLS);
            }

            // 获取评论回复
            let replies = comment.list_3 || [];
            for (let k = 0; k < replies.length; k++) {
                const repItem = replies[k];
                let images = repItem.pic || [];
                for (let r = 0; r < images.length; r++) {
                    const image = images[r];
                    await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, moudel_dir, item, QZone.Messages.FILE_URLS);
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
    if (!(item.custom_comment_total > item.custom_comments.length)) {
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
 * 导出说说到Markdown文件
 * @param {Array} items 数据
 */
API.Messages.exportToMarkdown = async (items) => {
    // 说说数据根据年份分组
    let yearDataMap = API.Utils.groupedByTime(items, "custom_create_time");
    let indicator = new StatusIndicator('Messages_Export');
    indicator.setTotal(items.length);
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];
        console.debug('正在生成年份MD文件', year);
        let contents = [];
        contents.push("# " + year + "年");
        for (let monthEntry of monthDataMap) {
            let month = monthEntry[0];
            let items = monthEntry[1];
            contents.push("## " + month + "月");

            items = await API.Messages.addMediaToTasks(items);

            for (const item of items) {
                contents.push('---');
                contents.push(API.Messages.getItemMdContent(item));
            }

            // 添加成功数量
            indicator.addSuccess(items);
        }
        let content = contents.join('\r\n\r\n');
        const yearFilePath = QZone.Messages.ROOT + "/" + year + "年.md";
        let fileEntry = await API.Utils.writeText(content, yearFilePath);
        console.debug('生成年份MD文件完成', year, fileEntry);
    }
    indicator.complete();
}

/**
 * 导出说说到JSON文件
 * @param {Array} items 数据
 */
API.Messages.exportToJson = async (items) => {
    // 说说数据根据年份分组
    let yearDataMap = API.Utils.groupedByTime(items, "custom_create_time");
    let indicator = new StatusIndicator('Messages_Export');
    indicator.setTotal(items.length);
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];
        console.debug('正在生成年份JSON文件', year);
        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];

            // 添加说说附件下任务
            items = await API.Messages.addMediaToTasks(items);

            // 添加成功数量
            indicator.addSuccess(items);
            yearItems = yearItems.concat(items);
        }
        const yearFilePath = QZone.Messages.ROOT + "/" + year + "年.json";
        let fileEntry = await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath);
        console.debug('生成年份JSON文件完成', year, fileEntry);
    }

    let json = JSON.stringify(items);
    await API.Utils.writeText(json, QZone.Messages.ROOT + '/说说.json');
    indicator.complete();
    return items;
}


/**
 * 获取说说的MD内容
 */
API.Messages.getItemMdContent = (item) => {
    let downloadType = Qzone_Config.Common.downloadType;
    let isQzoneUrl = downloadType === 'QZone';

    // 地理位置
    let location = item.custom_location['name'];
    var result = "> " + item.custom_create_time;
    if (location && location !== "") {
        result += "【" + location + "】";
    }

    // 转发标示
    let isRt = item.rt_uin;
    if (isRt) {
        result += "【转发】";
    }

    // 转换主内容
    let content = API.Utils.formatContent(item, "MD", false);

    result += "\r\n\r\n" + content + '\r\n\r\n';

    if (!isRt) {
        // 说说为转发说说时，对应的图片，视频，歌曲信息属于源说说的
        result += API.Messages.formatMedia(item);
    }

    // 添加转发内容
    if (isRt) {
        result += "> 原文:\r\n";
        let rt_uinname = API.Utils.formatContent(item.rt_uinname, 'MD');
        let rt_content = API.Utils.formatContent(item, 'MD', true);
        // 转换内容
        rtContent = '[{0}](https://user.qzone.qq.com/{1})：{2}'.format(rt_uinname, item.rt_uin, rt_content)
        result += "\r\n" + rtContent + "\r\n";

        // 说说为转发说说时，对应的图片，视频，歌曲信息属于源说说的
        result += API.Messages.formatMedia(item);
    }

    // 评论内容
    let comments = item.custom_comments || [];
    result += "> 评论(" + item.custom_comment_total + ")：" + '\r\n\r\n';
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        let contentName = API.Utils.formatContent(comment.name, 'MD');
        let content = API.Utils.formatContent(comment.content, 'MD');
        result += "*  [{0}](https://user.qzone.qq.com/{1})：{2}".format(contentName, comment.uin, content) + "\r\n";

        // 评论包含图片
        let comment_images = comment.pic || [];
        for (const image of comment_images) {
            // 替换URL
            result += "![](" + (isQzoneUrl ? image.custom_url : image.custom_filepath) + ")" + '\r\n';
        }

        // 评论的回复
        let replies = comment.list_3 || [];
        for (const repItem of replies) {
            let repName = API.Utils.formatContent(repItem.name, 'MD');
            let content = API.Utils.formatContent(repItem.content, 'MD');
            let repContent = "\t* [{0}](https://user.qzone.qq.com/{1})：{2}".format(repName, repItem.uin, content) + "\r\n";
            var repImgs = repItem.pic || [];
            for (const repImg of repImgs) {
                // 回复包含图片，理论上回复现在不能回复图片，兼容一下
                // 替换URL
                result += "![](" + (isQzoneUrl ? repImg.custom_url : repImg.custom_filepath) + ")" + '\r\n';
            }

            result += repContent;
        }
    }
    result = result + "\r\n"
    return result;
}

/**
 * 添加说说的多媒体下载任务
 * @param {Array} dataList
 */
API.Messages.addMediaToTasks = async (dataList) => {
    // 下载相对目录
    let moudel_dir = '说说/图片';

    for (const item of dataList) {
        // 下载说说配图
        for (const image of item.custom_images) {
            let url = image.url2 || image.url1;
            await API.Utils.addDownloadTasks(image, url, moudel_dir, item, QZone.Messages.FILE_URLS);
        }

        // 下载视频预览图
        for (const video of item.custom_video) {
            await API.Utils.addDownloadTasks(video, video.url1, moudel_dir, item, QZone.Messages.FILE_URLS);
        }

        // 下载音乐预览图
        for (const audio of item.custom_audio) {
            await API.Utils.addDownloadTasks(audio, audio.image, moudel_dir, item, QZone.Messages.FILE_URLS);
        }

        // 获取评论的配图
        // 评论内容
        let comments = item.custom_comments || [];
        for (const comment of comments) {
            // 评论包含图片
            let images = comment.pic || [];
            for (const image of images) {
                await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, moudel_dir, item, QZone.Messages.FILE_URLS);
            }

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            let replies = comment.list_3 || [];
            for (const repItem of replies) {
                let images = repItem.pic || [];
                for (const image of images) {
                    await API.Utils.addDownloadTasks(image, image.hd_url || image.b_url, moudel_dir, item, QZone.Messages.FILE_URLS);
                }
            }
        }
    }
    return dataList;
}