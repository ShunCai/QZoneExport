/**
 * QQ空间私密日记模块的导出API
 * @author https://lvshuncai.com
 */

/**
* 导出私密日记数据
*/
API.Diaries.export = async () => {

    // 获取所有的私密日记数据
    let items = await API.Diaries.getAllList();
    console.debug('私密日记列表获取完成', items);

    // 获取私密日记内容
    items = await API.Diaries.getAllContents(items);
    console.debug('私密日记内容获取完成', items);

    // 根据导出类型导出数据    
    await API.Diaries.exportAllListToFiles(items);
}

/**
 * 获取所有私密日记的内容
 * @param {Array} items 私密日记列表
 */
API.Diaries.getAllContents = async (items) => {
    let indicator = new StatusIndicator('Diaries_Content');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        let item = items[index];
        indicator.index = index + 1;
        await API.Diaries.getInfo(item.blogid).then((data) => {
            // 添加成功提示
            indicator.addSuccess(data);
            let blogPage = jQuery(data);
            let blogData = null;
            // 获得网页中的私密日记JSON数据
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
            // 获得网页中的私密日记正文
            item.html = blogPage.find("#blogDetailDiv:first").html();
            item.html = API.Utils.utf8ToBase64(item.html);
            items[index] = item;
        }).catch((e) => {
            console.error("获取私密日记内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })
        // 等待一下再请求
        let min = Qzone_Config.Diaries.Info.randomSeconds.min;
        let max = Qzone_Config.Diaries.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }
    indicator.complete();
    return items;
}


/**
 * 获取单页的私密日记列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Diaries.getList = async (pageIndex, indicator) => {
    console.debug("开始获取私密日记列表，当前页：", pageIndex + 1);
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Diaries.getDiaries(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);

        console.debug("成功获取私密日记列表，当前页：", pageIndex + 1, data);

        // 更新状态-下载中的数量
        indicator.addDownload(Qzone_Config.Diaries.pageSize);

        // 更新状态-总数
        QZone.Diaries.total = data.data.total_num || 0;
        indicator.setTotal(QZone.Diaries.total);

        let dataList = data.data.titlelist || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有私密日记列表
 */
API.Diaries.getAllList = async () => {

    // 重置数据
    QZone.Diaries.Data = [];
    QZone.Diaries.Images = [];

    // 私密日记状态更新器
    let indicator = new StatusIndicator('Diaries');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Diaries;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Diaries.getList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Diaries.Data = QZone.Diaries.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Diaries.total, QZone.Diaries.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Diaries.Data;
        }).catch(async (e) => {
            console.error("获取私密日记列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Diaries.total, QZone.Diaries.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Diaries.Data;
        });
    }

    await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return QZone.Diaries.Data
}


/**
 * 所有私密日记转换成导出文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportAllListToFiles = async (items) => {
    // 获取用户配置
    let exportType = Qzone_Config.Diaries.exportType;
    switch (exportType) {
        case 'MarkDown':
            await API.Diaries.exportMdToFiles(items);
            break;
        case 'JSON':
            await API.Diaries.exportJsonToFile(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出私密日记到MarkDown文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportMdToFiles = async (items) => {
    let indicator = new StatusIndicator('Diaries_Export');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取私密日记MD内容
        let content = await API.Diaries.getItemMdContent(item);
        let title = item.title;
        let date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        let orderNum = API.Utils.prefixNumber(index + 1, QZone.Diaries.total.toString().length);
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + title + "】");
        // 文件夹路径
        let categoryFolder = QZone.Diaries.ROOT + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 私密日记文件路径
        let filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeFile(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入私密日记文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
}

/**
 * 获取单篇私密日记的MD内容
 * @param {object} item 私密日记信息
 */
API.Diaries.getItemMdContent = async (item) => {
    // 拼接标题，日期，内容
    let result = "# " + item.title + "\r\n\r\n";
    let postTime = API.Utils.formatDate(item.pubtime);
    result = result + "> " + postTime + "\r\n\r\n";
    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.html));
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "> 评论(" + item.replynum + "):\r\n\r\n";

    // 文件备份类型
    let downloadType = Qzone_Config.Common.downloadType;
    // 是否为QQ空间外链
    let isQzoneUrl = downloadType === 'QZone';
    if (isQzoneUrl) {
        return result;
    }
    // 下载相对目录
    let moudel_dir = '私密日记/图片/';
    let download_dir = QZone.Common.Config.ZIP_NAME + '/';
    // 转为本地图片
    let imageLinkM = /!\[.*?\]\((.+?)\)/g;
    let match;
    let tmpResult = result;
    while (match = imageLinkM.exec(tmpResult)) {
        let orgUrl = match[1];
        let url = API.Utils.replaceUrl(orgUrl);
        let uid = QZone.Diaries.FILE_URLS.get(url);
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
            QZone.Diaries.FILE_URLS.set(url, uid);
        }
        result = result.split(orgUrl).join("../图片/" + uid);
    }
    return result;
}

/**
 * 导出私密日记到JSON文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportJsonToFile = async (items) => {
    let indicator = new StatusIndicator('Diaries_Export');
    indicator.setTotal(items.length);
    let json = JSON.stringify(items);
    await API.Utils.writeFile(json, QZone.Diaries.ROOT + '/私密日记.json');
    indicator.addSuccess(items);
    indicator.complete();
}