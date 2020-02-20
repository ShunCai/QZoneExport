/**
 * QQ空间收藏夹模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出收藏板
 */
API.Favorites.export = async () => {
    try {
        // 获取所有的收藏列表
        let dataList = await API.Favorites.getAllList();

        // 根据导出类型导出数据
        await API.Favorites.exportAllToFiles(dataList);

    } catch (error) {
        console.error('收藏导出异常', error);
    }
}


/**
 * 获取一页的收藏列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Favorites.getPageList = async (pageIndex, indicator) => {
    console.debug("开始获取收藏列表，当前页：", pageIndex + 1);

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(Qzone_Config.Favorites.pageSize);

    return await API.Favorites.getFavorites(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;

        console.debug("成功获取收藏列表，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Favorites.total = data.total_num || 0;
        indicator.setTotal(QZone.Favorites.total);

        // 转换数据
        let dataList = API.Favorites.convert(data.fav_list);

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}

/**
 * 获取所有收藏列表
 */
API.Favorites.getAllList = async () => {
    // 重置数据
    QZone.Favorites.Data = [];

    // 进度更新器
    let indicator = new StatusIndicator('Favorites');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Favorites;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Favorites.getPageList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Favorites.Data = QZone.Favorites.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Favorites.total, QZone.Favorites.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Favorites.Data;
        }).catch(async (e) => {
            console.error("获取收藏列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Favorites.total, QZone.Favorites.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Favorites.Data;
        });
    }

    let dataList = await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return dataList;
}

/**
 * 导出收藏
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportAllToFiles = async (favorites) => {
    // 获取用户配置
    let exportType = Qzone_Config.Favorites.exportType;
    switch (exportType) {
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
 * 导出收藏到MD文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToMarkdown = async (favorites) => {
    let newline = '\r\n\r\n';

    // 根据年份分组，每一年生成一个MD文件
    const yearMap = API.Utils.groupedByTime(favorites, "create_time");
    for (let year_entry of yearMap) {
        // 年份
        let year = year_entry[0];
        // 月份Map
        let monthMap = year_entry[1];

        let indicator = new StatusIndicator('Favorites_Export');
        indicator.setIndex(year);

        let contents = [];
        contents.push("# " + year + "年");

        let items = [];
        for (let month_entry of monthMap) {
            // 月份
            let month = month_entry[0];
            // 月份收藏列表
            let month_items = month_entry[1];

            contents.push("## " + month + "月 ");

            contents.push("---");

            await API.Favorites.addMediaToTasks(month_items);

            for (const favorite of month_items) {
                let content = API.Favorites.getMarkDownContent(favorite);
                contents.push(content);
                contents.push('---');
            }

            items = items.concat(month_items);
        }

        // 更新年份的收藏总数
        indicator.setTotal(items.length);

        const yearFilePath = QZone.Favorites.ROOT + "/" + year + "年.md";
        await API.Utils.writeText(contents.join(newline), yearFilePath).then(fileEntry => {
            console.debug('备份收藏列表完成，当前年份=', year, items, fileEntry);
            indicator.addSuccess(items);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, items, error);
            indicator.addFailed(items);
        });
        indicator.complete();
    }
}

/**
 * 获取单篇收藏的Markdown内容
 * @param {object} favorite 收藏
 */
API.Favorites.getMarkDownContent = (favorite) => {
    let contents = [];
    // 获取收藏的类型
    let displayType = API.Favorites.getType(favorite.type);
    switch (displayType) {
        case '日志':
            // 日志模板
            let blog_info = favorite.blog_info;
            let blog_owner_name = API.Utils.formatContent(blog_info.owner_name, "MD");
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 日志 [{2}]({https://user.qzone.qq.com/{3}/blog/{4}}) 【{5}】'.format(blog_owner_name, blog_info.owner_uin, favorite.title, blog_info.owner_uin, blog_info.id, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Utils.formatContent(favorite.custom_abstract, "MD")));
            break;
        case '说说':
            // 说说模板
            let shuoshuo_info = favorite.shuoshuo_info;
            // 转发标识
            let isRt = shuoshuo_info.forward_flag === 1;
            // 长说说内容
            let content = shuoshuo_info.detail_shuoshuo_info.content || favorite.custom_abstract;
            let shuoshuo_owner_name = API.Utils.formatContent(shuoshuo_info.owner_name, "MD");
            contents.push('[{0}](https://user.qzone.qq.com/{1}) 说说 【{2}】'.format(shuoshuo_owner_name, shuoshuo_info.owner_uin, favorite.custom_create_time));
            if (isRt) {
                //转发说说添加转发理由
                contents.push('> {0}'.format(API.Utils.formatContent(shuoshuo_info.reason, "MD")));
                contents.push('\r\n');
            }
            contents.push('> {0}'.format(API.Utils.formatContent(content, "MD")));
            break;
        case '分享':
            // 分享模板（通用），暂时不区分分享的类型
            let share_info = favorite.share_info;
            let share_owner_name = API.Utils.formatContent(share_info.owner_name, "MD");
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 分享 【{2}】'.format(share_owner_name, share_info.owner_uin, favorite.custom_create_time));
            // 分享类型
            let share_type = share_info.share_type;
            // 分享原因
            let share_reason = share_info.reason;
            if (share_reason) {
                contents.push('\r\n');
                contents.push('{0}'.format(API.Utils.formatContent(share_reason, "MD")));
            }
            let target_url = share_info.share_url;
            let share_title_content = API.Utils.formatContent(favorite.title, "MD");
            let share_title = API.Utils.getLink(target_url, share_title_content, "MD");
            switch (share_type) {
                case 1:
                    // 日志
                    let blog_info = share_info.blog_info;
                    let blog_owner_uin = blog_info.owner_uin;
                    let _blog_owner_name = API.Utils.formatContent(blog_info.owner_name, "MD");

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
                    let album_owner_name = API.Utils.formatContent(album_info.owner_name, "MD");

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
                    target_url = favorite.custom_video[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 18:
                    // 歌曲，目前只有一条数据
                    target_url = favorite.custom_audio[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 24:
                    // 设置背景音乐？类似歌曲，目前只有一条数据
                    target_url = favorite.custom_audio[0].play_url;
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
                contents.push('> {0}'.format(API.Utils.formatContent(favorite.custom_abstract, "MD")));
            }
            break;
        case '本地图片':
            // 多张本地图片模板
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            break;
        case '照片':
            // 照片模板
            let first_photo = favorite.album_info.owner_uin ? favorite.album_info : favorite.photo_list[0];
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(API.Utils.formatContent(first_photo.owner_name, "MD"), first_photo.owner_uin, favorite.custom_create_time));
            break;
        case '文字':
            // 文字模板，仅适用一般长度的文字，暂不支持获取文字的全文，没有找到全文的查看地址，暂时不处理
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 文字 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Utils.formatContent(favorite.custom_abstract, "MD")));
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
    let mediat_content = API.Messages.formatMedia(favorite);
    contents.push(mediat_content);
    return contents.join('\r\n');
}

/**
 * 导出收藏到JSON文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToJson = async (favorites) => {
    // 收藏根据年份分组
    let yearDataMap = API.Utils.groupedByTime(favorites, "create_time");
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];

        let indicator = new StatusIndicator('Favorites_Export');
        indicator.setIndex(year);

        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];
            yearItems = yearItems.concat(items);
        }

        // 更新年份的收藏总数
        indicator.setTotal(yearItems.length);

        // 更新下载中数据
        indicator.addDownload(yearItems);

        const yearFilePath = QZone.Favorites.ROOT + "/" + year + "年.json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then(fileEntry => {
            console.debug('备份收藏列表完成，当前年份=', year, yearItems, fileEntry);
            indicator.addSuccess(yearItems);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, yearItems, error);
            indicator.addFailed(yearItems);
        });
    }

    let json = JSON.stringify(favorites);
    await API.Utils.writeText(json, QZone.Favorites.ROOT + '/收藏.json').then(fileEntry => {
        console.debug('备份收藏列表完成', favorites, fileEntry);
    }).catch(error => {
        console.error('备份收藏列表失败', favorites, error);
    });
    indicator.complete();
    return favorites;
}



/**
 * 添加说说的附件下载任务
 * @param {Array} dataList
 */
API.Favorites.addMediaToTasks = async (dataList) => {
    // 下载相对目录
    let moudel_dir = '收藏夹/图片';

    for (const item of dataList) {
        // 下载说说配图
        for (const image of item.custom_images) {
            let url = image.url;
            await API.Utils.addDownloadTasks(image, url, moudel_dir, QZone.Messages.FILE_URLS);
        }

        // 下载视频预览图
        for (const video of item.custom_video) {
            let url = video.preview_img;
            await API.Utils.addDownloadTasks(video, url, moudel_dir, QZone.Messages.FILE_URLS);
        }

        // 下载音乐预览图
        for (const audio of item.custom_audio) {
            let url = audio.preview_img;
            await API.Utils.addDownloadTasks(audio, url, moudel_dir, QZone.Messages.FILE_URLS);
        }
    }
    return dataList;
}