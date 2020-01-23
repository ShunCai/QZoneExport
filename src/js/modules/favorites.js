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
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Favorites.total, QZone.Favorites.Data);
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
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Favorites.total, QZone.Favorites.Data);
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
            // await API.Favorites.exportToMarkdown(favorites);
            break;
        case 'JSON':
            // await API.Favorites.exportToJson(favorites);
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

    let total = favorites.length;
    // 根据年份分组，每一年生成一个MD文件
    const yearMap = API.Utils.groupedByTime(favorites, "pubtime");
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

            // 更新年份的收藏总数
            indicator.setTotal(month_items.length);

            contents.push("## " + month + "月 ");
            for (const favorite of month_items) {

                contents.push("---");
                // 收藏楼层
                contents.push('#### 第' + (total--) + '楼');

                let nickname = API.Favorites.getOwner(favorite);
                nickname = API.Utils.formatContent(nickname, "MD");

                contents.push('> {0} 【{1}】'.format(favorite.pubtime, nickname));
                contents.push('> 正文：');

                // 他人模式兼容私密收藏
                if (favorite.secret == 1 && !favorite.htmlContent) {
                    // 私密收藏提示
                    contents.push('主人收到一条私密收藏，仅彼此可见');
                    continue;
                }

                // 收藏内容
                let html_content = favorite.htmlContent.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');
                html_content = html_content.replace(/\n/g, "\r\n");
                let markdown_content = turndownService.turndown(html_content);
                markdown_content = API.Utils.formatContent(markdown_content, "MD");

                // 添加收藏内容
                contents.push('- [{0}](https://user.qzone.qq.com/{1})：{2}'.format(nickname, favorite.uin, mdContent));

                // 处理收藏回复
                contents.push('> 回复：');
                let replyList = favorite.replyList || [];
                for (const reply of replyList) {
                    let replyName = API.Favorites.getOwner(reply);
                    replyName = API.Utils.formatContent(replyName, "MD");
                    let replyContent = API.Utils.formatContent(reply.content, "MD");
                    let replyTime = API.Utils.formatDate(reply.time);
                    let replyMd = '- [{0}](https://user.qzone.qq.com/{1})：{2} 【*{3}*】'.format(replyName, reply.uin, replyContent, replyTime);
                    contents.push(replyMd);
                }
                contents.push('---');
            }

            items = items.concat(month_items);
            indicator.addDownload(month_items.length);
        }
        const yearFilePath = QZone.Favorites.ROOT + "/" + year + "年.md";
        await API.Utils.writeText(contents.join(newline), yearFilePath).then(fileEntry => {
            console.debug('备份收藏列表完成，当前年份=', year, items, fileEntry);
            indicator.addSuccess(items);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, items, error);
            indicator.addFailed(items);
        });
    }
}


/**
 * 导出收藏到JSON文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToJson = async (favorites) => {
    // 说说数据根据年份分组
    let yearDataMap = API.Utils.groupedByTime(favorites, "pubtime");
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
        // 更新下载中数据
        indicator.addDownload(yearItems);
        const yearFilePath = QZone.Favorites.ROOT + "/" + year + "年.json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then(fileEntry => {
            console.debug('备份收藏列表完成，当前年份=', year, items, fileEntry);
            indicator.addSuccess(items);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, items, error);
            indicator.addFailed(items);
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