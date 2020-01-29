/**
 * QQ空间视频模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出视频数据
 */
API.Videos.export = async () => {
    try {
        // 获取所有的视频列表
        let dataList = await API.Videos.getAllList();

        // 根据导出类型导出数据
        await API.Videos.exportAllToFiles(dataList);
    } catch (error) {
        console.error('视频导出异常', error);
    }
}


/**
 * 获取一页的视频列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Videos.getPageList = async (pageIndex, indicator) => {
    console.debug("开始获取视频列表，当前页：", pageIndex + 1);

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(Qzone_Config.Videos.pageSize);

    return await API.Videos.getVideos(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data;

        console.debug("成功获取视频列表，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Videos.total = data.total || 0;
        indicator.setTotal(data.total);

        let dataList = data.Videos || [];

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有视频列表
 */
API.Videos.getAllList = async () => {
    // 重置数据
    QZone.Videos.Data = [];

    // 进度更新器
    let indicator = new StatusIndicator('Videos');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Videos;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Videos.getPageList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Videos.Data = QZone.Videos.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Videos.total, QZone.Videos.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Videos.Data;
        }).catch(async (e) => {
            console.error("获取视频列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Videos.total, QZone.Videos.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Videos.Data;
        });
    }

    await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return QZone.Videos.Data;
}


/**
 * 添加视频下载任务
 * @param {Array} videos 视频列表
 */
API.Videos.addDownloadTasks = (videos) => {
    // 下载相对目录
    let moudel_dir = '视频/';
    let download_dir = QZone.Common.Config.ZIP_NAME + '/';
    for (const video of videos) {
        // 添加下载任务
        API.Utils.newDownloadTask(video.url, download_dir, moudel_dir, API.Videos.getFileName(video.url));
    }
}

/**
 * 导出视频
 * @param {Array} videos 视频列表
 */
API.Videos.exportAllToFiles = async (videos) => {
    // 获取用户配置
    let exportType = Qzone_Config.Videos.exportType;
    switch (exportType) {
        case 'File':
            API.Videos.addDownloadTasks(videos);
            break;
        case 'JSON':
            await API.Videos.exportToJson(videos);
            break;
        case 'Link':
            await API.Videos.exportToLink(videos);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出视频下载链接到JSON文件
 * @param {Array} items 视频列表
 */
API.Videos.exportToLink = async (videos) => {
    let indicator = new StatusIndicator('Videos_Export');
    indicator.setTotal(videos.length);

    let videoUrls = [];
    for (const video of videos) {
        videoUrls.push(API.Utils.makeDownloadUrl(video.url, true));
    }
    let filepath = QZone.Videos.ROOT + '/视频链接.downlist';
    await API.Utils.writeText(videoUrls.join('\r\n'), filepath).then(() => {
        // 更新成功信息
        indicator.addSuccess(videos);
    }).catch((e) => {
        indicator.addFailed(videos);
        console.error('写入视频下载链接异常', e);
    })
    indicator.complete();
    return videos;
}

/**
 * 导出视频到JSON文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToJson = async (videos) => {
    let indicator = new StatusIndicator('Videos_Export');
    indicator.setTotal(videos.length);
    let json = JSON.stringify(videos);
    await API.Utils.writeText(json, QZone.Videos.ROOT + '/视频.json');
    indicator.addSuccess(videos);
    indicator.complete();
    return videos;
}