/**
 * QQ空间视频模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出视频数据
 */
API.Videos.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Videos_Row_Infos');
    indicator.print();

    try {

        // 获取所有的视频列表
        let videos = await API.Videos.getAllList();

        // 获取所有视频的详情，TODO，待确认，
        // 理论上不需要获取，如若涉及权限、点赞是否需要获取？

        // 获取所有视频的评论列表
        videos = await API.Videos.getAllComments(videos);

        // 获取视频赞记录
        await API.Videos.getAllLikeList(videos);

        // 添加评论的表情下载任务
        API.Videos.addDownloadEmoticonTasks(videos);

        // 添加视频下载任务
        API.Videos.addDownloadTasks('Videos', videos, 'Videos/images');

        // 根据导出类型导出数据
        await API.Videos.exportAllToFiles(videos);

    } catch (error) {
        console.error('视频导出异常', error);
    }

    // 完成
    indicator.complete();
}


/**
 * 获取一页的视频列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Videos.getPageList = async(pageIndex, indicator) => {

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(QZone_Config.Videos.pageSize);

    return await API.Videos.getVideos(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取一页的视频列表异常：', data);
        }
        data = data.data || {};

        // 更新总数
        QZone.Videos.total = data.total || QZone.Videos.total || 0;
        indicator.setTotal(QZone.Videos.total);

        let dataList = data.Videos || [];

        for (const item of dataList) {
            item.uniKey = item.shuoshuoid ? API.Messages.getUniKey(item.shuoshuoid) : item.vid;
        }

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有视频列表
 */
API.Videos.getAllList = async() => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos');
    indicator.setIndex(1);
    indicator.print();

    // 视频配置项
    const CONFIG = QZone_Config.Videos;

    const nextPage = async function(pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Videos.getPageList(pageIndex, indicator).then(async(dataList) => {
            // 合并数据
            QZone.Videos.Data = API.Utils.unionItems(QZone.Videos.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Videos.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async(e) => {
            console.error("获取视频列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Videos.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Videos.OLD_Data, QZone.Videos.Data);

    // 发表时间倒序
    QZone.Videos.Data = API.Utils.sort(QZone.Videos.Data, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Videos.Data;
}

/**
 * 获取视频的所有评论
 * @param {Array} videos 视频列表
 */
API.Videos.getAllComments = async(videos) => {
    // 视频评论配置
    const CONFIG = QZone_Config.Videos.Comments;

    // 是否获取视频评论
    if (!CONFIG.isGet || API.Videos.isFile()) {
        return videos;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Videos_Comments');
    indicator.setTotal(videos.length);

    for (let index = 0; index < videos.length; index++) {

        const video = videos[index];

        // 当前位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 获取评论
        video.cmtTotal = 0;
        video.comments = [];

        if (!video.shuoshuoid) {
            // 说说ID为空时跳过不获取 TODO 待定
            indicator.addSkip(video);
            continue;
        }

        const nextPage = async function(video, pageIndex) {
            // 下一页索引
            const nextPageIndex = pageIndex + 1;

            // TODO，待确认是否存在shuoshuoid为空的情况，相册或视频直接上传？
            return await API.Videos.getComments(video.shuoshuoid, pageIndex).then(async(data) => {

                // 去掉函数，保留json
                data = API.Utils.toJson(data, /^_Callback\(/);
                if (data.code && data.code != 0) {
                    // 获取异常
                    console.warn('获取视频评论异常：', data);
                }
                data = data.data || {};
                data.comments = data.comments || [];

                // 添加评论数到视频
                video.cmtTotal = data.total || video.cmtTotal || 0;

                // 合并数据
                video.comments = API.Utils.unionItems(video.comments, data.comments);

                if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, data.comments, CONFIG)) {
                    // 不再继续获取下一页
                    return video.comments;
                }

                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);

            }).catch(async(e) => {
                console.error("获取视频评论列表异常：", pageIndex + 1, video, e);
                // 当前页失败后，跳过继续请求下一页
                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);
            });
        }

        // 获取第一页评论
        await nextPage(video, 0);

        indicator.addSuccess(video);
    }

    // 完成
    indicator.complete();
    return videos;
}


/**
 * 添加视频下载任务
 * @param {string} module 模块
 * @param {Array} videos 视频列表
 * @param {string} module_dir 模块相对目录
 * @param {object} source 来源
 */
API.Videos.addDownloadTasks = (module, videos, module_dir, source) => {
    // 是否为视频
    const isVideo = 'Videos' === module;

    if (!videos || API.Common.isQzoneUrl() || (isVideo && QZone_Config.Videos.exportType == 'Link')) {
        // QQ空间外链、视频备份类型为下载链接、则不添加下载任务
        return;
    }

    // 遍历
    for (let idx = 0; idx < videos.length; idx++) {
        // 视频
        const video = videos[idx];

        // 序号，便于排序
        const orderNumber = API.Utils.prefixNumber(idx + 1, videos.length.toString().length);

        if (isVideo && !API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            console.warn("已备份数据跳过不处理", video);
            continue;
        }

        // 添加视频预览图下载任务
        video.custom_pre_url = video.pre || video.url1 || video.preview_img;
        // 预览图直接写死后缀
        video.custom_pre_filename = API.Utils.newSimpleUid(8, 16) + '.jpeg';
        video.custom_pre_filepath = 'images/' + video.custom_pre_filename;
        API.Utils.newDownloadTask(module, video.custom_pre_url, module_dir, video.custom_pre_filename, video);

        // 如果是外部视频，跳过不下载
        if (video.play_url) {
            console.warn("外部视频，跳过", video);
            continue;
        }

        // 添加视频下载任务(视频/相片/收藏/说说)
        video.custom_url = video.url || video.video_url || video.url3;
        if (!video.custom_url || API.Videos.isExternalVideo(video)) {
            // 外部视频跳过不下载
            console.warn("外部视频，跳过", video);
            continue;
        }
        video.custom_filename = API.Videos.getFileName(video.custom_url);
        video.custom_filename = isVideo ? API.Videos.getVideoFileName(video, orderNumber) : video.custom_filename;

        // 添加下载任务
        const categoryPath = API.Videos.getFileStructureFolderPath(video);
        const downloadFolder = categoryPath ? 'Videos/' + categoryPath : 'Videos';

        // 文件路径
        video.custom_filepath = 'images/' + video.custom_filename;
        if (isVideo) {
            video.custom_filepath = categoryPath ? categoryPath + '/' + video.custom_filename : video.custom_filename;
        }

        API.Utils.newDownloadTask(module, video.custom_url, isVideo ? downloadFolder : module_dir, video.custom_filename, source || video);
    }
    return videos;
}

/**
 * 导出视频
 * @param {Array} videos 视频列表
 */
API.Videos.exportAllToFiles = async(videos) => {
    // 获取用户配置
    let exportType = QZone_Config.Videos.exportType;
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
API.Videos.exportToHtml = async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Videos');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('videos', videos, moduleFolder + '/json/videos.js');

        // 生成视频汇总列表HTML
        await API.Common.writeHtmlofTpl('videos', { videos: videos, targetYear: 'ALL' }, moduleFolder + "/index.html");

        // 根据年份分组
        const year_maps = API.Utils.groupedByTime(videos, 'uploadTime', 'year');
        for (const [year, year_items] of year_maps) {
            // 生成视频年份列表HTML
            await API.Common.writeHtmlofTpl('videos', { videos: year_items, targetYear: year }, moduleFolder + "/" + year + ".html");
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
API.Videos.exportToMarkdown = async(videos) => {

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
            const yearFilePath = API.Common.getModuleRoot('Videos') + "/" + year + '.md';
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份视频列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份视频列表失败，当前年份=', year, error);
            });

        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Videos') + '/Videos.md');

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
        contents.push('> ' + API.Common.formatContent(video.desc, 'MD', false, false, false, false, true));
        contents.push('\r\n');

        // 视频
        contents.push('<video height="400" src="{0}" controls="controls" ></video>'.format(video.custom_filepath || video.custom_url || video.url));
        contents.push('\r\n');

        // 视频评论 TODO 私密评论处理
        video.comments = video.comments || [];
        contents.push('> 评论({0})'.format(video.cmtTotal || video.comments.length));
        contents.push('\r\n');

        for (const comment of video.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD', false, false, false, false, true);
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");

            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : '../' + image.custom_filepath;
                    // 添加评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {

                // 回复人
                let repName = API.Common.formatContent(repItem.poster.name, 'MD', false, false, false, false, true);
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");

                // 回复内容
                let content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : '../' + repImg.custom_filepath;
                    // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }

        // 分割线
        contents.push('---');
    }
    return contents.join('\r\n');
}

/**
 * 导出视频下载链接到下载链接
 * @param {Array} items 视频列表
 */
API.Videos.exportToLink = async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('下载链接');

    let videoUrls = [];
    for (const video of videos) {
        videoUrls.push(API.Utils.makeDownloadUrl(video.url, true));
    }
    let filepath = API.Common.getModuleRoot('Videos') + '/videos.downlist';
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
API.Videos.exportToJson = async(videos) => {
    // 状态更新器
    const indicator = new StatusIndicator('Videos_Export');
    indicator.setIndex('JSON');

    let json = JSON.stringify(videos);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Videos') + '/videos.json').then((file) => {
        console.info('导出视频到JSON成功', file);
    }).catch((e) => {
        console.error('导出视频到JSON异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
}

/**
 * 获取腾讯视频的播放地址
 * @param {string} vid 视频ID
 */
API.Videos.getTencentVideoUrl = (vid) => {
    let params = {
        "origin": "https://user.qzone.qq.com",
        "vid": vid,
        "autoplay": true,
        "volume": 100,
        "disableplugin": "IframeBottomOpenClientBar",
        "additionplugin": "IframeUiSearch",
        "platId": "qzone_feed",
        "show1080p": true,
        "isDebugIframe": false
    }
    return API.Utils.toUrl('https://v.qq.com/txp/iframe/player.html', params);
}

/**
 * 获取视频连接
 * @param {object} 视频信息
 */
API.Videos.getVideoUrl = (video) => {
    // URL3个人相册视频？
    let url = video.url3 || video.url;
    if (video.source_type == "share") {
        // 分享视频连接？
        url = video.rt_url;
    }
    if (API.Videos.isTencentVideo(video)) {
        // 腾讯视频
        if (!video.video_id) {
            return video.url2;
        }
        url = API.Videos.getTencentVideoUrl(video.video_id);
    }
    // 其他第三方视频
    return url;
}

/**
 * 是否腾讯视频（判断不严谨，先临时判断）
 * @param {object} 视频信息
 */
API.Videos.isTencentVideo = (video) => {
    let url2 = video.url2 || '';
    let url3 = video.url3 || '';
    if (!url2 || url3.indexOf('.mp4') > -1) {
        // 如果URL都没有值，或者地址含有.mp4，肯定是空间视频？
        return false;
    }
    if (url3.indexOf('tencentvideo') > -1) {
        // 该判断不严谨，但是不知道怎么判断的好
        return true;
    }
    return false;
}

/**
 * 是否外部视频（判断不严谨，先临时判断）
 * @param {object} 视频信息
 */
API.Videos.isExternalVideo = (video) => {
    let url3 = video.url3 || '';
    const isTencentTV = API.Videos.isTencentVideo(video);
    if (isTencentTV) {
        return true;
    }
    if (url3.indexOf('.swf') > -1) {
        // Flash地址肯定是外部视频？
        return true;
    }
    return false;
}

/**
 * 导出类型是否文件
 */
API.Videos.isFile = () => {
    return QZone_Config.Videos.exportType == 'File' || QZone_Config.Videos.exportType == 'Link'
}

/**
 * 获取视频赞记录
 * @param {Array} items 日志列表
 */
API.Videos.getAllLikeList = async(items) => {
    if (!API.Common.isGetLike(QZone_Config.Videos)) {
        // 不获取赞
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

    // 获取点赞列表
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {

            const item = list[j];
            item.likes = item.likes || [];

            if (!item.shuoshuoid) {
                // 说说ID为空时跳过不获取 TODO 待定
                indicator.addSkip(item);
                continue;
            }

            item.uniKey = API.Messages.getUniKey(item.shuoshuoid);

            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }


            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Videos).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取视频点赞异常：", item, e);
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
 * 获取视频名称
 * @param {Object} video 视频
 * @param {String} prefix 前缀
 * @returns 
 */
API.Videos.getVideoFileName = (video, prefix) => {
    // 上传时间
    const dateTime = API.Utils.parseDate(video.uploadtime || video.uploadTime).getTime();
    if (QZone_Config.Videos.RenameType === 'Default') {
        // 文件名称，排序号+空间名称
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.custom_filename);
    } else if (QZone_Config.Videos.RenameType === 'Name') {
        // 文件名称，排序号+视频标题
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + (video.title || API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss')));
    } else if (QZone_Config.Videos.RenameType === 'Time') {
        // 文件名称，排序号+视频标题+拍摄/上传时间
        if (video.title) {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.title + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        } else {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        }
    }
    // 追加后缀
    video.custom_filename = video.custom_filename.endsWith('.mp4') ? video.custom_filename : video.custom_filename + '.mp4';
    video.custom_filename = API.Utils.filenameValidate(video.custom_filename);
    return video.custom_filename;
}

/**
 * 添加下载表情任务
 * @param {Videos} item 
 */
API.Videos.addDownloadEmoticonTasks = (items) => {
    if (API.Common.isQzoneUrl()) {
        return;
    }

    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // QQ空间外链或已备份项，跳过
            continue;
        }

        // 视频描述
        item.name && API.Common.formatContent(item.name, 'HTML', false, false, false, true, false);

        // 添加评论的表情下载任务
        API.Common.addCommentEmoticonDownloadTasks(item);
    }

}