/**
 * QQ空间收藏夹模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出收藏板
 */
API.Favorites.export = async() => {
    try {
        // 获取所有的收藏列表
        let dataList = await API.Favorites.getAllList();

        // 添加多媒体下载任务
        dataList = await API.Favorites.addMediaToTasks(dataList);

        // 根据导出类型导出数据
        await API.Favorites.exportAllToFiles(dataList);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Favorites);

    } catch (error) {
        console.error('收藏导出异常', error);
    }
}


/**
 * 获取一页的收藏列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Favorites.getPageList = async(pageIndex, indicator) => {

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(QZone_Config.Favorites.pageSize);

    return await API.Favorites.getFavorites(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;

        // 更新总数
        QZone.Favorites.total = data.total_num || QZone.Favorites.total || 0;
        indicator.setTotal(QZone.Favorites.total);

        // 转换数据
        let dataList = API.Favorites.convert(data.fav_list || []);

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}

/**
 * 获取所有收藏列表
 */
API.Favorites.getAllList = async() => {

    // 进度更新器
    const indicator = new StatusIndicator('Favorites');

    // 开始
    indicator.print();

    const CONFIG = QZone_Config.Favorites;

    const nextPage = async function(pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Favorites.getPageList(pageIndex, indicator).then(async(dataList) => {

            // 合并数据
            QZone.Favorites.Data = API.Utils.unionItems(QZone.Favorites.Data, dataList);
            if (API.Common.isPreBackupPos(dataList, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Favorites.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Favorites.total, QZone.Favorites.Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async(e) => {
            console.error("获取收藏列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Favorites.total, QZone.Favorites.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Favorites.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Favorites.OLD_Data, QZone.Favorites.Data);

    // 发表时间倒序
    QZone.Favorites.Data = API.Utils.sort(QZone.Favorites.Data, CONFIG.PreBackup.field, true);

    // 完成
    indicator.complete();

    return QZone.Favorites.Data;
}

/**
 * 导出收藏
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportAllToFiles = async(favorites) => {
    // 获取用户配置
    let exportType = QZone_Config.Favorites.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Favorites.exportToHtml(favorites);
            break;
        case 'MarkDown':
            await API.Favorites.exportToMarkdown(favorites);
            break;
        case 'JSON':
            await API.Favorites.exportToJson(favorites);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出收藏夹到HTML文件
 * @param {Array} favorites 数据
 */
API.Favorites.exportToHtml = async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    indicator.setIndex('HTML');

    try {

        // 基于JSON生成JS
        console.info('生成收藏夹JSON开始', favorites);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('favorites', favorites, QZone.Common.ROOT + '/json/favorites.js');
        console.info('生成分享JSON结束', jsonFile, favorites);

        // 数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(favorites, "create_time", 'year');
        // 基于模板生成年份说说HTML
        for (const [year, yearItems] of yearMaps) {
            console.info('生成收藏夹年份HTML文件开始', year, yearItems);
            // 基于模板生成所有说说HTML
            let _dataMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "create_time", 'month');
            _dataMaps.set(year, monthMaps);
            let params = {
                dataMaps: _dataMaps,
                total: yearItems.length
            }
            let yearFile = await API.Common.writeHtmlofTpl('favorites', params, QZone.Favorites.ROOT + "/" + year + ".html");
            console.info('生成收藏夹年份HTML文件结束', year, yearItems, yearFile);
        }

        console.info('生成汇总HTML文件开始', favorites);
        // 基于模板生成汇总说说HTML
        let params = {
            dataMaps: API.Utils.groupedByTime(favorites, "create_time", 'all'),
            total: favorites.length
        }
        let allFile = await API.Common.writeHtmlofTpl('favorites', params, QZone.Favorites.ROOT + "/index.html");
        console.info('生成收藏夹汇总HTML文件结束', allFile, favorites);
    } catch (error) {
        console.error('导出收藏夹到HTML异常', error, favorites);
    }
    indicator.complete();
    return favorites;
}

/**
 * 导出收藏到MD文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToMarkdown = async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 根据年份分组，每一年生成一个MD文件
        const yearMap = API.Utils.groupedByTime(favorites, "create_time");
        for (const [year, month_maps] of yearMap) {
            const yearContents = [];
            yearContents.push("# " + year + "年");

            for (const [month, month_items] of month_maps) {
                yearContents.push("## " + month + "月 ");
                for (const favorite of month_items) {
                    yearContents.push(API.Favorites.getMarkdown(favorite));
                    yearContents.push('---');
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            const yearFilePath = QZone.Favorites.ROOT + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份收藏列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份收藏列表失败，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Favorites.ROOT + '/Favorites.md');
    } catch (error) {
        console.error('导出收藏夹到Markdown文件异常', error, videos);
    }

    // 完成
    indicator.complete();
    return favorites;
}

/**
 * 获取单篇收藏的Markdown内容
 * @param {object} favorite 收藏
 */
API.Favorites.getMarkdown = (favorite) => {
    let contents = [];
    // 获取收藏的类型
    let displayType = API.Favorites.getType(favorite.type);
    const owner = API.Favorites.getFavoriteOwner(favorite);
    switch (displayType) {
        case '日志':
            // 日志模板
            let blog_info = favorite.blog_info;
            let blog_owner_name = API.Common.formatContent(owner.name, "MD");
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 日志 [{2}]({https://user.qzone.qq.com/{3}/blog/{4}}) 【{5}】'.format(blog_owner_name, blog_info.owner_uin, favorite.title, blog_info.owner_uin, blog_info.id, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD")));
            break;
        case '说说':
            // 说说模板
            let shuoshuo_info = favorite.shuoshuo_info;
            // 转发标识
            let isRt = shuoshuo_info.forward_flag === 1;
            // 长说说内容
            let content = shuoshuo_info.detail_shuoshuo_info.content || favorite.custom_abstract;
            let shuoshuo_owner_name = API.Common.formatContent(owner.name, "MD");
            contents.push('[{0}](https://user.qzone.qq.com/{1}) 说说 【{2}】'.format(shuoshuo_owner_name, shuoshuo_info.owner_uin, favorite.custom_create_time));
            if (isRt) {
                //转发说说添加转发理由
                contents.push('> {0}'.format(API.Common.formatContent(shuoshuo_info.reason, "MD")));
                contents.push('\r\n');
            }
            contents.push('> {0}'.format(API.Common.formatContent(content, "MD", isRt, false)));
            break;
        case '分享':
            // 分享模板（通用），暂时不区分分享的类型
            let share_info = favorite.share_info;
            let share_owner_name = API.Common.formatContent(owner.name, "MD");
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 分享 【{2}】'.format(share_owner_name, share_info.owner_uin, favorite.custom_create_time));
            // 分享类型
            let share_type = share_info.share_type;
            // 分享原因
            let share_reason = share_info.reason;
            if (share_reason) {
                contents.push('\r\n');
                contents.push('{0}'.format(API.Common.formatContent(share_reason, "MD")));
            }
            let target_url = share_info.share_url;
            let share_title_content = API.Common.formatContent(favorite.title, "MD");
            let share_title = API.Utils.getLink(target_url, share_title_content, "MD");
            switch (share_type) {
                case 1:
                    // 日志
                    let blog_info = share_info.blog_info;
                    let blog_owner_uin = blog_info.owner_uin;
                    let _blog_owner_name = API.Common.formatContent(owner.name, "MD");

                    // 日志发布人链接
                    let blog_owner_url = API.Common.getUserLink(blog_owner_uin, _blog_owner_name, "MD");
                    // 日志链接
                    target_url = 'https://user.qzone.qq.com/{0}/blog/{1}'.format(blog_owner_uin, blog_info.id);

                    let blog_url = API.Utils.getLink(target_url, share_title_content, "MD");
                    share_title = '{0}的 日志 {1}'.format(blog_owner_url, blog_url);

                    break;
                case 2:
                    // 相册
                    let album_info = share_info.album_info;
                    let album_owner_uin = album_info.owner_uin;
                    let album_owner_name = API.Common.formatContent(owner.name, "MD");

                    // 相册创建人链接
                    let album_owner_url = API.Common.getUserLink(album_owner_uin, album_owner_name, "MD");

                    // 相册链接
                    target_url = 'https://user.qzone.qq.com/{0}/photo/{1}'.format(album_info.owner_uin, album_info.id);

                    let album_url = API.Utils.getLink(target_url, share_title_content, "MD");

                    share_title = '{0}的 相册 {1}'.format(album_owner_url, album_url);
                    break;
                case 4:
                    // 网页
                    target_url = share_info.share_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 5:
                    // 视频，目前只有一条数据
                    target_url = favorite.custom_videos[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 18:
                    // 歌曲，目前只有一条数据
                    target_url = favorite.custom_audios[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 24:
                    // 设置背景音乐？类似歌曲，目前只有一条数据
                    target_url = favorite.custom_audios[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                default:
                    // 其他类型或未知类型不处理超链接跳转
                    target_url = '#';
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    console.warn('其他分享类型，暂不处理超链接跳转', favorite);
                    break;
            }
            contents.push('> {0}'.format(share_title));
            if (favorite.custom_abstract && favorite.custom_abstract.trim()) {
                contents.push('\r\n');
                contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD")));
            }
            break;
        case '本地图片':
            // 多张本地图片模板
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            break;
        case '照片':
            // 照片模板
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(API.Common.formatContent(owner.name, "MD"), owner.uin, favorite.custom_create_time));
            break;
        case '文字':
            // 文字模板，仅适用一般长度的文字，暂不支持获取文字的全文，没有找到全文的查看地址，暂时不处理
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 文字 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD")));
            break;
        case '网页':
            // 网页模板
            let url_info = favorite.url_info;
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 网页 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            contents.push('\r\n');
            contents.push('{0} {1}'.format(favorite.title, url_info.url));
            contents.push('\r\n');
            contents.push('> {0}'.format(favorite.custom_abstract));
            break;
        default:
            // 未知类型不处理
            console.warn('其他未知收藏类型，暂不处理', favorite);
            break;
    }
    // 添加多媒体内容
    let mediat_content = API.Messages.formatMediaMarkdown(favorite);
    contents.push(mediat_content);
    return contents.join('\r\n');
}

/**
 * 导出收藏到JSON文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToJson = async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    indicator.setIndex(year);
    // 收藏根据年份分组
    let yearDataMap = API.Utils.groupedByTime(favorites, "create_time");
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];

        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];
            yearItems = yearItems.concat(items);
        }

        const yearFilePath = QZone.Favorites.ROOT + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then(fileEntry => {
            console.info('备份收藏列表完成，当前年份=', year, yearItems, fileEntry);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, yearItems, error);
        });
    }

    let json = JSON.stringify(favorites);
    await API.Utils.writeText(json, QZone.Favorites.ROOT + '/favorites.json').then(fileEntry => {
        console.info('备份收藏列表完成', favorites, fileEntry);
    }).catch(error => {
        console.error('备份收藏列表失败', favorites, error);
    });
    // 完成
    indicator.complete();
    return favorites;
}

/**
 * 添加多媒体下载任务
 * @param {Array} dataList
 */
API.Favorites.addMediaToTasks = async(dataList) => {
    // 下载相对目录
    let module_dir = 'Favorites/Images';

    for (const item of dataList) {

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载说说配图
        for (const image of item.custom_images) {
            let url = image.url;
            await API.Utils.addDownloadTasks('Favorites', image, url, module_dir, item, QZone.Favorites.FILE_URLS);
        }

        // 下载视频预览图及视频
        API.Videos.addDownloadTasks('Favorites', item.custom_videos, module_dir, item, QZone.Favorites.FILE_URLS);

        // 下载音乐预览图
        for (const audio of item.custom_audios) {
            let url = audio.preview_img;
            await API.Utils.addDownloadTasks('Favorites', audio, url, module_dir, item, QZone.Favorites.FILE_URLS);
        }
    }
    return dataList;
}