/**
 * QQ空间日志模块的导出API
 * @author https://lvshuncai.com
 */

/**
* 导出日志数据
*/
API.Blogs.export = async () => {

    // 获取所有的日志数据
    let items = await API.Blogs.getAllList();
    console.debug('日志列表获取完成', items);

    // 获取日志内容
    items = await API.Blogs.getAllContents(items);
    console.debug('日志内容获取完成', items);

    // 获取所有的日志评论
    items = await API.Blogs.getItemsAllCommentList(items);

    // 根据导出类型导出数据    
    await API.Blogs.exportAllListToFiles(items);
}

/**
 * 获取所有日志的内容
 * @param {Array} items 日志列表
 */
API.Blogs.getAllContents = async (items) => {
    let indicator = new StatusIndicator('Blogs_Content');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        let item = items[index];
        indicator.index = index + 1;
        await API.Blogs.getInfo(item.blogId).then((data) => {
            // 添加成功提示
            indicator.addSuccess(data);
            let blogPage = jQuery(data);
            let blogData = null;
            // 获得网页中的日志JSON数据
            blogPage.find('script').each(function () {
                let t = $(this).text();
                if (t.indexOf('g_oBlogData') !== -1) {
                    let dataM = /var g_oBlogData\s+=\s+({[\s\S]+});\s/;
                    blogData = dataM.exec(t);
                    if (blogData != null) {
                        return false;
                    }
                }
            })
            if (blogData != null) {
                item = JSON.parse(blogData[1]).data;
            }
            // 获得网页中的日志正文
            item.html = blogPage.find("#blogDetailDiv:first").html();
            item.html = API.Utils.utf8ToBase64(item.html);
            items[index] = item;
        }).catch((e) => {
            console.error("获取日志内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })
        // 等待一下再请求
        let min = Qzone_Config.Blogs.Info.randomSeconds.min;
        let max = Qzone_Config.Blogs.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }
    indicator.complete();
    return items;
}


/**
 * 获取单页的日志列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Blogs.getList = async (pageIndex, indicator) => {
    console.debug("开始获取日志列表，当前页：", pageIndex + 1);
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Blogs.getBlogs(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);

        console.debug("成功获取日志列表，当前页：", pageIndex + 1, data);

        // 更新状态-下载中的数量
        indicator.addDownload(Qzone_Config.Blogs.pageSize);

        // 更新状态-总数
        QZone.Blogs.total = data.data.totalNum || 0;
        indicator.setTotal(QZone.Blogs.total);

        let dataList = data.data.list || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有日志列表
 */
API.Blogs.getAllList = async () => {

    // 重置数据
    QZone.Blogs.Data = [];
    QZone.Blogs.Images = [];

    // 日志状态更新器
    let indicator = new StatusIndicator('Blogs');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Blogs;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Blogs.getList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Blogs.Data = QZone.Blogs.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Blogs.Data;
        }).catch(async (e) => {
            console.error("获取日志列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Blogs.Data;
        });
    }

    await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return QZone.Blogs.Data
}


/**
 * 获取所有日志的评论列表
 * @param {string} item 日志
 */
API.Blogs.getItemsAllCommentList = async (items) => {
    if (!Qzone_Config.Blogs.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // 单条日志状态更新器
        let indicator = new StatusIndicator('Blogs_Comments');

        // 更新当前位置
        indicator.index = i + 1;
        indicator.print();

        // 获取日志的全部评论
        await API.Blogs.getItemAllCommentList(item, indicator);
    }
    return items;
}

/**
 * 获取单条日志的单页评论列表
 * @param {object} item 日志
 * @param {integer} pageIndex 页数索引
 */
API.Blogs.getItemCommentList = async (item, pageIndex) => {
    return await API.Blogs.getComments(item.blogid, pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;
        return data.comments || [];
    });
}

/**
 * 获取单条日志的全部评论列表
 * @param {object} item 日志
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Blogs.getItemAllCommentList = async (item, indicator) => {
    if (!(item.replynum > item.comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.comments;
    }
    // 情况原有的评论列表
    item.comments = [];

    // 日志评论配置
    let CONFIG = Qzone_Config.Blogs.Comments;

    // 更新总数
    let total = item.replynum || 0;
    indicator.setTotal(total);

    let nextPage = async function (item, pageIndex) {
        return await API.Blogs.getItemCommentList(item, pageIndex).then(async (dataList) => {

            // 合并评论列表
            item.comments = item.comments.concat(dataList || []);

            // 更新成功条目数
            indicator.addSuccess(item.comments);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, total, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        }).catch(async (e) => {
            console.error("获取日志评论列表异常，当前页：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        });
    }

    await nextPage(item, 0);

    // 完成
    indicator.complete();

    return item.comments;
}


/**
 * 所有日志转换成导出文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportAllListToFiles = async (items) => {
    // 获取用户配置
    let exportType = Qzone_Config.Blogs.exportType;
    switch (exportType) {
        case 'MarkDown':
            await API.Blogs.exportMdToFiles(items);
            break;
        case 'JSON':
            await API.Blogs.exportJsonToFile(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出日志到MarkDown文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportMdToFiles = async (items) => {
    let indicator = new StatusIndicator('Blogs_Export');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取日志MD内容
        let content = await API.Blogs.getItemMdContent(item);
        // 写入内容到文件
        let label = API.Blogs.getBlogLabel(item);
        let title = item.title;
        let date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        let orderNum = API.Utils.prefixNumber(index + 1, QZone.Blogs.total.toString().length);
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + title + "】");
        if (label) {
            filename = API.Utils.filenameValidate(orderNum + "_" + date + "_" + label + "【" + title + "】");
        }
        // 文件夹路径
        let categoryFolder = QZone.Blogs.ROOT + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 日志文件路径
        let filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeFile(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入日志文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
}

/**
 * 获取单篇日志的MD内容
 * @param {object} item 日志信息
 */
API.Blogs.getItemMdContent = async (item) => {
    // 拼接标题，日期，内容
    let result = "# " + item.title + "\r\n\r\n";
    let postTime = API.Utils.formatDate(item.pubtime);
    result = result + "> " + postTime + "\r\n\r\n";
    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.html));
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "> 评论(" + item.replynum + "):\r\n\r\n";
    let comments = item.comments;
    for (const comment of comments) {
        let poster = API.Utils.formatContent(comment.poster.name, 'MD');
        let content = API.Utils.formatContent(comment.content, 'MD');
        // 替换回复内容的换行符
        content = content.replaceAll('\n', '');
        content = '* [{0}](https://user.qzone.qq.com/{1})：{2}'.format(poster, comment.poster.id, content) + "\r\n";
        let replies = comment.replies || [];
        // 处理评论的回复
        for (const rep of replies) {
            let repPoster = API.Utils.formatContent(rep.poster.name, 'MD');
            let repContent = API.Utils.formatContent(rep.content, 'MD');
            // 替换回复内容的换行符
            repContent = repContent.replaceAll('\n', '');
            let c = '\t* [{0}](https://user.qzone.qq.com/{1})：{2}'.format(repPoster, rep.poster.id, repContent) + "\r\n";
            content = content + c;
        }
        result = result + content;
    }
    // 文件备份类型
    let downloadType = Qzone_Config.Common.downloadType;
    // 是否为QQ空间外链
    let isQzoneUrl = downloadType === 'QZone';
    if (isQzoneUrl) {
        return result;
    }
    // 下载相对目录
    let moudel_dir = '日志/图片/';
    let download_dir = QZone.Common.Config.ZIP_NAME + '/';
    // 转为本地图片
    let imageLinkM = /!\[.*?\]\((.+?)\)/g;
    let match;
    let tmpResult = result;
    while (match = imageLinkM.exec(tmpResult)) {
        let orgUrl = match[1];
        let url = API.Utils.replaceUrl(orgUrl);
        let uid = QZone.Blogs.FILE_URLS.get(url);
        if (!uid) {
            uid = API.Utils.newUid();
            // 是否获取文件类型
            if (Qzone_Config.Common.isAutoFileSuffix) {
                // 获取图片类型
                await API.Utils.getMimeType(url).then((data) => {
                    let mimeType = data.mimeType
                    if (mimeType) {
                        let suffix = mimeType.split('/')[1]
                        uid = uid + '.' + suffix;
                    }
                }).catch((e) => {
                    console.error('获取文件类型异常', url, e);
                });
            }
            // 添加浏览器下载任务
            browserTasks.push(new BrowserTask(url, download_dir + moudel_dir + uid));
            // 添加迅雷下载任务
            thunderInfo.addTask(new ThunderTask(uid, moudel_dir, uid, url));
            QZone.Blogs.FILE_URLS.set(url, uid);
        }
        result = result.split(orgUrl).join("../图片/" + uid);
    }
    return result;
}

/**
 * 导出日志到JSON文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportJsonToFile = async (items) => {
    let indicator = new StatusIndicator('Blogs_Export');
    indicator.setTotal(items.length);
    let json = JSON.stringify(items);
    await API.Utils.writeFile(json, QZone.Blogs.ROOT + '/日志.json');
    indicator.addSuccess(items);
    indicator.complete();
}