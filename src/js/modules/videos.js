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
        let videos = await API.Videos.getAllList();

        // 获取所有视频的评论列表 TODO

        // 添加视频下载任务
        API.Videos.addDownloadTasks(videos);

        // 根据导出类型导出数据
        await API.Videos.exportAllToFiles(videos);

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
    console.debug("获取视频列表开始，当前页：", pageIndex + 1);

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(Qzone_Config.Videos.pageSize);

    return await API.Videos.getVideos(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data || {};

        console.debug("获取视频列表结束，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Videos.total = data.total || QZone.Videos.total || 0;
        indicator.setTotal(QZone.Videos.total);

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
 * @param {string} module_dir 模块相对目录
 * @param {object} source 来源
 * @param {Map} FILE_URLS 模块已下载映射
 */
API.Videos.addDownloadTasks = (videos, module_dir, source, FILE_URLS) => {
    if (!videos || API.Common.isQzoneUrl()) {
        // QQ空间外链不添加下载任务
        return;
    }

    // 下载相对目录
    const isOther = module_dir ? true : false;
    FILE_URLS = FILE_URLS || QZone.Videos.FILE_URLS;
    for (const video of videos) {
        // 添加视频预览图下载任务
        video.custom_pre_url = video.pre || video.url1 || video.preview_img;
        // 预览图直接写死后缀
        video.custom_pre_filename = API.Utils.newSimpleUid(8, 16) + '.jpeg';
        video.custom_pre_filepath = 'Images/' + video.custom_pre_filename;
        API.Utils.newDownloadTask(video.custom_pre_url, isOther ? module_dir : 'Videos/Images', video.custom_pre_filename, video);

        // 如果是外部视频，跳过不下载
        if (video.play_url) {
            continue;
        }

        // 添加视频下载任务(视频/相片/收藏/说说)
        video.custom_url = video.url || video.video_url || (video.video_id ? video.url3 : undefined);
        if (!video.custom_url || video.custom_url.indexOf('.swf') > -1) {
            // Flash链接跳过不处理
            continue;
        }
        let filename = FILE_URLS.get(video.custom_url);
        if (!filename) {
            filename = API.Videos.getFileName(video.custom_url);
        }
        video.custom_filename = filename;
        video.custom_filepath = isOther ? 'Images/' + video.custom_filename : video.custom_filename;
        if (!FILE_URLS.has(video.custom_url)) {
            // 添加下载任务
            API.Utils.newDownloadTask(video.custom_url, isOther ? module_dir : 'Videos', video.custom_filename, source || video);
            FILE_URLS.set(video.custom_url, video.custom_filename);
        }
    }
    return videos;
}

/**
 * 导出视频
 * @param {Array} videos 视频列表
 */
API.Videos.exportAllToFiles = async (videos) => {
    // 获取用户配置
    let exportType = Qzone_Config.Videos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Videos.exportToHtml(videos);
            break;
        case 'JSON':
            await API.Videos.exportToJson(videos);
            break;
        case 'MarkDown':
            await API.Videos.exportToMarkdown(videos);
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
 * 导出视频到HTML文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToHtml = async (videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('HTML');

    try {
        // 基于JSON生成JS
        console.info('生成视频JSON开始', videos);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('dataList', videos, QZone.Common.ROOT + '/json/videos.js');
        console.info('生成视频JSON结束', jsonFile, videos);

        // 生成视频汇总列表HTML
        console.info('生成视频列表HTML开始', videos);
        const infoFile = await API.Common.writeHtmlofTpl('videos', null, QZone.Videos.ROOT + "/index.html");
        console.info('生成视频列表HTML结束', infoFile, videos);

        // 根据年份分组
        const year_maps = API.Utils.groupedByTime(videos, 'uploadTime', 'year');
        for (const [year, year_items] of year_maps) {
            // 生成视频年份列表HTML
            console.info('生成视频年份列表HTML开始', year, year_items);
            const yearFile = await API.Common.writeHtmlofTpl('videos_static', { videos: year_items }, QZone.Videos.ROOT + "/" + year + ".html");
            console.info('生成视频年份列表HTML结束', year, yearFile, year_items);
        }

    } catch (error) {
        console.error('导出视频到HTML异常', error, videos);
    }

    // 更新完成信息
    indicator.complete();
    return videos;
}

/**
 * 导出视频到MD文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToMarkdown = async (videos) => {

    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        const year_month_maps = API.Utils.groupedByTime(videos, 'uploadTime', 'all');
        for (const [year, month_maps] of year_month_maps) {
            // 年份内容
            const yearContents = [];
            yearContents.push('# {0}年'.format(year));
            for (const [month, month_videos] of month_maps) {
                // 标题
                const month_title = '## {0}月'.format(month);
                // 月份内容
                const month_content = API.Videos.getMarkdowns(month_videos);

                // 年份内容
                yearContents.push(month_title);
                yearContents.push(month_content);
                // 月份分割线
                yearContents.push('---');
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = QZone.Videos.ROOT + "/" + year + '.md';
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.debug('备份视频列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份视频列表失败，当前年份=', year, error);
            });

        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Videos.ROOT + '/Videos.md');

    } catch (error) {
        console.error('导出视频到Markdown文件异常', error, videos);
    }

    // 完成
    indicator.complete();
    return videos;
}

/**
 * 获取视频的Markdown内容
 */
API.Videos.getMarkdowns = (videos) => {
    const contents = [];
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        video.desc = video.desc || video.name || API.Utils.formatDate(video.uploadTime);

        // 视频描述
        contents.push('> ' + API.Common.formatContent(video.desc));
        contents.push('\r\n');

        // 视频
        contents.push('<video src="{0}" controls="controls" ></video>'.format(video.custom_filename || video.custom_url));
        contents.push('\r\n');

        // 视频评论（TODO待定）

        // 分割线
        contents.push('---');
    }
    return contents.join('\r\n');
}

/**
 * 导出视频下载链接到下载链接
 * @param {Array} items 视频列表
 */
API.Videos.exportToLink = async (videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('下载链接');

    let videoUrls = [];
    for (const video of videos) {
        videoUrls.push(API.Utils.makeDownloadUrl(video.url, true));
    }
    let filepath = QZone.Videos.ROOT + '/videos.downlist';
    await API.Utils.writeText(videoUrls.join('\r\n'), filepath).then((file) => {
        console.info('导出视频下载链接成功', file);
    }).catch((e) => {
        console.error('导出视频下载链接异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
}

/**
 * 导出视频到JSON文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToJson = async (videos) => {
    // 状态更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('JSON');

    let json = JSON.stringify(videos);
    await API.Utils.writeText(json, QZone.Videos.ROOT + '/videos.json').then((file) => {
        console.info('导出视频到JSON成功', file);
    }).catch((e) => {
        console.error('导出视频到JSON异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
}