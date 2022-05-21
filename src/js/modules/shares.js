/**
 * QQ空间分享模块的导出API
 * @author https://lvshuncai.com
 */

API.Shares.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Shares_Row_Infos');
    indicator.print();

    try {
        // 获取所有的分享列表
        let items = await API.Shares.getAllList();
        console.log('分享列表获取完成，共有分享%i条', items.length);

        // 获取所有的分享评论
        items = await API.Shares.getItemsAllCommentList(items);
        console.log('分享列表评论获取完成');

        // 添加多媒体下载任务
        items = await API.Shares.addMediaToTasks(items);

        // 获取分享点赞列表
        await API.Shares.getAllLikeList(items);

        // 获取分享最近浏览
        await API.Shares.getAllVisitorList(items);

        // 根据导出类型导出数据    
        await API.Shares.exportAllListToFiles(items);

    } catch (error) {
        console.error('分享导出异常：', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有分享列表
 */
API.Shares.getAllList = async() => {

    // 分享状态更新器
    const indicator = new StatusIndicator('Shares');

    // 开始
    indicator.print();

    const CONFIG = QZone_Config.Shares;

    const nextPage = async function(pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;
        indicator.index = nextPageIndex;

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Shares.pageSize);

        return await API.Shares.getList(nextPageIndex, indicator).then(async(html) => {
            // 页面转数据
            const shareInfo = API.Shares.convert(html);
            const dataList = shareInfo.list || [];
            QZone.Shares.total = QZone.Shares.total || shareInfo.total || 0;

            // 更新总数
            indicator.setTotal(QZone.Shares.total);

            // 更新状态-下载成功数
            indicator.addSuccess(dataList);

            // 合并数据
            QZone.Shares.Data = API.Utils.unionItems(QZone.Shares.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Shares.OLD_Data, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Shares.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Shares.total, QZone.Shares.Data, arguments.callee, nextPageIndex, indicator);

        }).catch(async(e) => {
            console.error("获取分享列表异常，当前页：", nextPageIndex, e);
            indicator.addFailed(new PageInfo(nextPageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Shares.total, QZone.Shares.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Shares.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Shares.OLD_Data, QZone.Shares.Data);

    // 完成
    indicator.complete();

    return QZone.Shares.Data;
}

/**
 * 获取单条分享的全部评论列表
 * @param {object} item 分享
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Shares.getItemAllCommentList = async(item) => {

    // 清空原有的评论列表
    item.comments = [];

    // 分享评论配置
    const CONFIG = QZone_Config.Shares.Comments;

    // 更新总数
    const total = item.commentTotal || 0;

    const nextPage = async function(item, pageIndex) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Shares.getComments(item.id, pageIndex).then(async(data) => {

            // JSON转换
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code < 0) {
                // 获取异常
                console.warn('获取单条分享的全部评论列表异常：', data);
            }
            data = data.data || {};

            item.commentTotal = item.commentTotal || data.total || 0;

            data.comments = data.comments || [];
            // 处理发表时间
            for (const comment of data.comments) {
                comment.postTime = API.Utils.toDate(comment.postTime) / 1000;
                comment.replies = comment.replies || [];
                for (const repItem of comment.replies) {
                    repItem.postTime = API.Utils.toDate(repItem.postTime) / 1000;
                }
            }

            // 合并评论列表
            item.comments = item.comments.concat(data.comments);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取分享评论列表异常，当前页：", pageIndex + 1, item, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.comments;
}

/**
 * 获取所有分享的评论列表
 * @param {Array} items 分享
 */
API.Shares.getItemsAllCommentList = async(items) => {
    if (!QZone_Config.Shares.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 单条分享状态更新器
    const indicator = new StatusIndicator('Shares_Comments');
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

        // 预防分享无评论
        item.comments = item.comments || [];

        // 获取分享的全部评论
        await API.Shares.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 已完成
    indicator.complete();
    return items;
}

/**
 * 获取分享赞记录
 * @param {Array} items 分享列表
 */
API.Shares.getAllLikeList = async(items) => {

    if (!API.Common.isGetLike(QZone_Config.Shares)) {
        // 不获取赞
        return items;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Shares_Like');
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

            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }
            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Shares).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取分享点赞异常：", item, e);
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
 * 获取单条分享的全部最近访问
 * @param {object} item 分享
 */
API.Shares.getItemAllVisitorsList = async(item) => {
    // 清空原有的最近访问信息
    item.custom_visitor = {
        viewCount: 0,
        totalNum: 0,
        list: []
    };

    // 最近访问配置
    const CONFIG = QZone_Config.Shares.Visitor;

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Shares.getVisitors(item.id, pageIndex).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code < 0) {
                // 获取异常
                console.warn('获取单条分享的全部最近访问异常：', data);
            }
            data = data.data || {};

            // 合并
            item.custom_visitor.viewCount = data.viewCount || 0;
            item.custom_visitor.totalNum = data.totalNum || 0;
            item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取分享最近访问列表异常，当前页：", pageIndex + 1, item, e);

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_visitor;
}

/**
 * 获取分享最近访问
 * @param {Array} items 分享列表
 */
API.Shares.getAllVisitorList = async(items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Shares)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Visitor');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

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
            tasks.push(API.Shares.getItemAllVisitorsList(item).then((visitor) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取分享最近访问异常：", item, e);
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
 * 添加多媒体下载任务
 * @param {Array} dataList
 */
API.Shares.addMediaToTasks = async(dataList) => {
    // 下载相对目录
    const module_dir = 'Shares/images';

    for (const item of dataList) {
        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 来源配图（网页、音乐等）
        const images = item.source && item.source.images || [];
        for (const image of images) {
            await API.Utils.addDownloadTasks('Shares', image, image.url, module_dir, item, QZone.Shares.FILE_URLS);
        }

        // 评论配图
        const comments = item.comments;
        for (const comment of comments) {
            comment.pic = comment.pic || [];
            for (let pic of comment.pic) {
                pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                await API.Utils.addDownloadTasks('Shares', pic, pic.custom_url, module_dir, item, QZone.Shares.FILE_URLS);
            }
            // 回复的图片
            comment.replies = comment.replies || [];
            for (const repItem of comment.replies) {
                repItem.pic = repItem.pic || [];
                for (let pic of repItem.pic) {
                    pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                    await API.Utils.addDownloadTasks('Shares', pic, pic.custom_url, module_dir, item, QZone.Shares.FILE_URLS);
                }
            }
        }

        // 下载视频 TODO 分享是否存在视频，分享存在视频，但是无法分享视频
    }
    return dataList;
}

/**
 * 所有分享转换成导出文件
 * @param {Array} items 分享列表
 */
API.Shares.exportAllListToFiles = async(items) => {
    // 获取用户配置
    const exportType = QZone_Config.Shares.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Shares.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Shares.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Shares.exportToJson(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出分享到HTML文件
 * @param {Array} shares 数据
 */
API.Shares.exportToHtml = async(shares) => {
    const indicator = new StatusIndicator('Shares_Export_Other');
    indicator.setIndex('HTML');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Shares');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('shares', shares, moduleFolder + '/json/shares.js');

        // 分享数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(shares, "shareTime", 'year');
        // 基于模板生成年份分享HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有分享HTML
            let _sharesMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "shareTime", 'month');
            _sharesMaps.set(year, monthMaps);
            let params = {
                sharesMaps: _sharesMaps,
                total: yearItems.length
            }
            await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总分享HTML
        let params = {
            sharesMaps: API.Utils.groupedByTime(shares, "shareTime", 'all'),
            total: shares.length
        }
        await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出分享到HTML异常', error, shares);
    }

    // 完成
    indicator.complete();
    return shares;
}

/**
 * 获取单篇分享的Markdown内容
 * @param {ShareInfo} share 分享
 */
API.Shares.getMarkdown = (share) => {
    const contents = [];
    // 分享人
    let share_user_name = API.Common.formatContent(share.nickname, 'MD');
    share_user_name = API.Common.getUserLink(share.uin, share_user_name, 'MD', true);
    // 分享描述
    contents.push('{0}  分享：{1}  '.format(share_user_name, API.Common.formatContent(share.desc || '', 'MD')));

    // 分享源
    const shareSource = share.source || {};
    // 分享源标题
    contents.push('> [{0}]({1})  '.format(shareSource.title, shareSource.url));
    // 分享源描述
    if (shareSource.desc) {
        contents.push('{0}  '.format(shareSource.desc));
    }
    // 分享源配图
    shareSource.images = shareSource.images || [];
    for (const images of shareSource.images) {
        contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(images.custom_url, images.custom_filepath, "Shares_MD")) + '  ');
    }
    // 分享源来源
    contents.push('来自： [{0}]({1}) 共分享 {2} 次'.format(shareSource.from.name, shareSource.from.url, shareSource.count));

    // 分享时间
    contents.push('\n> {0}  '.format(API.Utils.formatDate(share.shareTime)));

    // 评论内容
    const comments = share.comments || [];
    contents.push("\n> 评论({0})".format(share.commentTotal));
    for (const comment of comments) {

        // 评论人
        let comment_name = API.Common.formatContent(comment.poster.name, 'MD');
        comment_name = API.Common.getUserLink(comment.poster.id, comment_name, 'MD', true);

        contents.push("- {0}：{1}".format(comment_name, API.Common.formatContent(comment.content, 'MD')));

        // 评论包含图片
        const comment_images = comment.pic || [];
        for (const image of comment_images) {
            // 替换URL
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(image.custom_url, image.custom_filepath, "Shares_MD")));
        }

        // 评论的回复
        const replies = comment.replies || [];
        for (const repItem of replies) {
            // 回复人
            let repName = API.Common.formatContent(repItem.poster.name, 'MD');
            repName = API.Common.getUserLink(repItem.poster.id, repName, 'MD', true);

            // 回复内容
            let content = API.Common.formatContent(repItem.content, 'MD');

            // 回复内容
            contents.push("\t- {0}：{1}".format(repName, content));

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            var repImgs = repItem.pic || [];
            for (const repImg of repImgs) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(repImg.custom_url, repImg.custom_filepath, "Shares_MD")));
            }
        }
    }
    contents.push('---');
    return contents.join('\n');
}

/**
 * 导出分享到Markdown文件
 * @param {Array} items 数据
 */
API.Shares.exportToMarkdown = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 分享数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "shareTime");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Shares.getMarkdown(item));
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份分享列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份分享列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Shares') + '/Shares.md').then((fileEntry) => {
            console.info('生成汇总分享Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总分享Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出分享到Markdown文件异常', error, items);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出分享到JSON文件
 * @param {Array} items 数据
 */
API.Shares.exportToJson = async(items) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Shares_Export_Other');
    indicator.setIndex('JSON');

    // 生成年份JSON
    // 分享数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "shareTime", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份分享JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份分享JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份分享JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Shares') + '/shares.json').then((fileEntry) => {
        console.info('生成汇总分享JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总分享JSON文件异常", items, e)
    });

    // 完成
    indicator.complete();
    return items;
}