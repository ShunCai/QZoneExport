/**
 * QQ空间访客模块的导出API
 * @author https://lvshuncai.com
 */

API.Visitors.export = async () => {
    try {
        // 获取所有的访客列表
        const visitorInfo = await API.Visitors.getAllList();
        console.info('访客列表获取完成', visitorInfo);

        // 添加多媒体下载任务
        await API.Visitors.addMediaToTasks(visitorInfo);

        // 根据导出类型导出数据    
        await API.Visitors.exportAllListToFiles(visitorInfo);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Visitors);
    } catch (error) {
        console.error('访客导出异常：', error);
    }
}

/**
 * 获取所有访客列表
 */
API.Visitors.getAllList = async () => {
    // 初始化数据
    QZone.Visitors.Data = {
        items: [],
        total: 0,
        totalPage: 0
    }

    // 访客状态更新器
    const indicator = new StatusIndicator('Visitors');

    // 开始
    indicator.print();

    const CONFIG = QZone_Config.Visitors;

    const nextPage = async function (pageIndex) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;
        indicator.setIndex(nextPageIndex);

        return await API.Visitors.getList(nextPageIndex).then(async (data) => {

            // 页面转数据
            data = API.Utils.toJson(data, /^_Callback\(/) || {};
            if (data.code === -99996) {
                // 无权限查看访客
                console.warn('无权限查看访客！');
            }
            data = data.data || {};
            const items = data.items || [];
            if (data.Ishost === 0) {
                // 访客身份
                QZone.Visitors.Data.total = QZone.Visitors.Data.total || data.modvisitcount[0]['totalcount'] || 0;
                QZone.Visitors.Data.totalPage = QZone.Visitors.Data.totalPage || 1;
            } else {
                QZone.Visitors.Data.total = QZone.Visitors.Data.total || data.totalcount || 0;
                QZone.Visitors.Data.totalPage = QZone.Visitors.Data.totalPage || data.totalpage || 0;
            }

            // 更新总数
            indicator.setTotal(QZone.Visitors.Data.total);
            indicator.setTotalPage(QZone.Visitors.Data.totalPage);

            // 合并数据
            QZone.Visitors.Data.items = API.Utils.unionItems(QZone.Visitors.Data.items, items);
            if (API.Common.isPreBackupPos(items, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Visitors.Data;
            }

            if (nextPageIndex >= QZone.Visitors.Data.totalPage) {
                // 最后一页停止获取
                return QZone.Visitors.Data;
            }

            // 请求一页成功后等待一秒再请求下一页
            const min = CONFIG.randomSeconds.min;
            const max = CONFIG.randomSeconds.max;
            const seconds = API.Utils.randomSeconds(min, max);
            await API.Utils.sleep(seconds * 1000);
            return await arguments.callee.apply(undefined, [nextPageIndex]);
        }).catch(async (e) => {
            console.error("获取访客列表异常，当前页：", nextPageIndex, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            // 请求一页成功后等待一秒再请求下一页
            const min = CONFIG.randomSeconds.min;
            const max = CONFIG.randomSeconds.max;
            const seconds = API.Utils.randomSeconds(min, max);
            await API.Utils.sleep(seconds * 1000);
            return await arguments.callee.apply(undefined, [nextPageIndex]);
        });
    }

    await nextPage(0);

    // 合并、过滤数据
    QZone.Visitors.Data.items = API.Common.unionBackedUpItems(CONFIG, QZone.Visitors.OLD_Data.items, QZone.Visitors.Data.items);

    // 完成
    indicator.complete();

    return QZone.Visitors.Data;
}

/**
 * 添加多媒体下载任务
 * @param {Array} item
 */
API.Visitors.addMediaToTasks = async (visitorInfo) => {
    // 下载相对目录
    const module_dir = 'Visitors/Images';

    const items = visitorInfo.items || [];

    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 说说配图
        item.shuoshuoes = item.shuoshuoes || []
        for (const message of item.shuoshuoes) {
            if (!message.imgsrc) {
                continue;
            }
            await API.Utils.addDownloadTasks(message, message.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
        }

        // 日志配图 暂无
        item.blogs = item.blogs || [];

        // 相册配图
        item.photoes = item.photoes || [];
        for (const photo of item.photoes) {
            if (!photo.imgsrc) {
                continue;
            }
            await API.Utils.addDownloadTasks(photo, photo.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
        }

        // 分享配图
        item.shares = item.shares || [];
        for (const share of item.shares) {
            if (!share.imgsrc) {
                continue;
            }
            await API.Utils.addDownloadTasks(share, share.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
        }
    }
    return visitorInfo;
}

/**
 * 所有访客转换成导出文件
 * @param {Array} visitorInfo 访客列表
 */
API.Visitors.exportAllListToFiles = async (visitorInfo) => {
    // 获取用户配置
    const exportType = QZone_Config.Visitors.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Visitors.exportToHtml(visitorInfo);
            break;
        case 'MarkDown':
            await API.Visitors.exportToMarkdown(visitorInfo);
            break;
        case 'JSON':
            await API.Visitors.exportToJson(visitorInfo);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出访客到HTML文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToHtml = async (visitorInfo) => {
    const indicator = new StatusIndicator('Visitors_Export_Other');
    indicator.setIndex('HTML');
    try {
        // 基于JSON生成JS
        console.info('生成访客JSON开始', visitorInfo);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('visitorInfo', visitorInfo, QZone.Common.ROOT + '/json/visitors.js');
        console.info('生成访客JSON结束', jsonFile, visitorInfo);

        // 访客数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(visitorInfo.items, "time", 'year');
        // 基于模板生成年份访客HTML
        for (const [year, yearItems] of yearMaps) {
            console.info('生成访客年份HTML文件开始', year, yearItems);
            let params = {
                visitors: yearItems,
                total: yearItems.length
            }
            let yearFile = await API.Common.writeHtmlofTpl('visitors', params, QZone.Visitors.ROOT + "/" + year + ".html");
            console.info('生成访客年份HTML文件结束', year, yearItems, yearFile);
        }

        console.info('生成访客汇总HTML文件开始', visitorInfo);
        // 基于模板生成汇总访客HTML
        let params = {
            visitors: visitorInfo.items,
            total: visitorInfo.total
        }
        let allFile = await API.Common.writeHtmlofTpl('visitors', params, QZone.Visitors.ROOT + "/index.html");
        console.info('生成访客汇总HTML文件结束', allFile, visitorInfo);

    } catch (error) {
        console.error('导出访客到HTML异常', error, visitorInfo);
    }
    // 完成
    indicator.complete();
    return visitorInfo;
}

/**
 * 获取单篇访客的Markdown内容
 * @param {ShareInfo} item 访客
 */
API.Visitors.getMarkdown = (item) => {
    const contents = [];
    // 访问时间
    contents.push('###### {0}  \n'.format(API.Utils.formatDate(item.time)));

    // 访客
    let user_name = API.Common.formatContent(item.name, 'MD');
    user_name = API.Common.getUserLink(item.uin, user_name, 'MD', true);

    // 访问内容
    if (API.Visitors.isHome(item)) {
        // 主页
        contents.push('{0} 访问了主页  \n'.format(user_name));
        contents.push('---');
        return contents.join('\n');
    }
    // 说说
    if (item.shuoshuoes.length > 0) {
        contents.push('{0} 查看了说说  '.format(user_name));
        for (const message of item.shuoshuoes) {
            contents.push('- {0}   '.format(API.Common.formatContent(message.name, 'MD')));
            if (message.imgsrc) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(message.custom_url, message.custom_filepath, "Visitors_MD")) + '  ');
            }
        }
        contents.push('\n  ');
    }
    // 日志
    if (item.blogs.length > 0) {
        contents.push('{0} 查看了日志  '.format(user_name));
        for (const blog of item.blogs) {
            contents.push('- 《{0}》  '.format(API.Common.formatContent(blog.name, 'MD')));
        }
        contents.push('\n  ');
    }
    // 相册
    if (item.photoes.length > 0) {
        contents.push('{0} 查看了相册  '.format(user_name));
        for (const photo of item.photoes) {
            contents.push('> {0}  '.format(API.Common.formatContent(photo.name, 'MD')));
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(photo.custom_url, photo.custom_filepath, "Visitors_MD")) + '  ');
            contents.push('\n  ');
        }
        contents.push('\n  ');
    }
    // 分享
    if (item.shares.length > 0) {
        contents.push('{0} 查看了分享  '.format(user_name));
        for (const share of item.shares) {
            contents.push('- {0}   '.format(API.Common.formatContent(share.name, 'MD')));
            if (share.imgsrc) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(share.custom_url, share.custom_filepath, "Visitors_MD")) + '  ');
            }
        }
        contents.push('\n  ');
    }
    // 其它访客
    if (item.uins && item.uins.length > 0) {
        contents.push('以下这些访客当天也访问了这些内容： ');
        for (const uinItem of item.uins) {
            contents.push('- {0} *{1}*   '.format(API.Common.formatContent(uinItem.name, 'MD'), API.Utils.formatDate(uinItem.time)));
        }
    }
    contents.push('---');
    return contents.join('\n');
}

/**
 * 导出访客到Markdown文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToMarkdown = async (visitorInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Visitors_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 访客数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(visitorInfo.items, "time");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Visitors.getMarkdown(item));
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = QZone.Visitors.ROOT + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份访客列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份访客列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Visitors.ROOT + '/Visitors.md').then((fileEntry) => {
            console.info('生成汇总访客Markdown文件完成', visitorInfo, fileEntry);
        }).catch((e) => {
            console.error("生成汇总访客Markdown文件异常", visitorInfo, e)
        });

    } catch (error) {
        console.error('导出访客到Markdown文件异常', error, visitorInfo);
    }
    // 完成
    indicator.complete();
    return visitorInfo;
}

/**
 * 导出访客到JSON文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToJson = async (visitorInfo) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Visitors_Export_Other');
    indicator.setIndex('JSON');

    // 生成年份JSON
    // 访客数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(visitorInfo, "time", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份访客JSON文件', year);
        const yearFilePath = QZone.Visitors.ROOT + "/" + year + ".json";
        const yearInfo = {
            total: yearItems.length,
            items: yearItems
        }
        await API.Utils.writeText(JSON.stringify(yearInfo), yearFilePath).then((fileEntry) => {
            console.info('生成年份访客JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份访客JSON文件异常", yearInfo, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(visitorInfo);
    await API.Utils.writeText(json, QZone.Visitors.ROOT + '/visitors.json').then((fileEntry) => {
        console.info('生成汇总访客JSON文件完成', visitorInfo, fileEntry);
    }).catch((e) => {
        console.error("生成汇总访客JSON文件异常", visitorInfo, e)
    });

    // 完成
    indicator.complete();
    return visitorInfo;
}