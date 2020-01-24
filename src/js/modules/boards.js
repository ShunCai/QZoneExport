/**
 * QQ空间留言板模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出留言板
 */
API.Boards.export = async () => {
    try {
        // 获取所有的留言
        let dataList = await API.Boards.getAllList();

        // 根据导出类型导出数据
        await API.Boards.exportAllToFiles(dataList);

    } catch (error) {
        console.error('留言导出异常', error);
    }
}


/**
 * 获取一页的留言列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Boards.getPageList = async (pageIndex, indicator) => {
    console.debug("开始获取留言列表，当前页：", pageIndex + 1);

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(Qzone_Config.Boards.pageSize);

    return await API.Boards.getBoards(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;

        console.debug("成功获取留言列表，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Boards.total = data.total || 0;
        indicator.setTotal(data.total);

        let dataList = data.commentList || [];

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}

/**
 * 获取所有留言列表
 */
API.Boards.getAllList = async () => {
    // 重置数据
    QZone.Boards.Data = [];

    // 进度更新器
    let indicator = new StatusIndicator('Boards');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Boards;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Boards.getPageList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Boards.Data = QZone.Boards.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Boards.total, QZone.Boards.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Boards.Data;
        }).catch(async (e) => {
            console.error("获取留言列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex, CONFIG.pageSize, QZone.Boards.total, QZone.Boards.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Boards.Data;
        });
    }

    let dataList = await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return dataList;
}

/**
 * 导出留言
 * @param {Array} boards 留言列表
 */
API.Boards.exportAllToFiles = async (boards) => {
    // 获取用户配置
    let exportType = Qzone_Config.Boards.exportType;
    switch (exportType) {
        case 'MarkDown':
            await API.Boards.exportToMarkdown(boards);
            break;
        case 'JSON':
            await API.Boards.exportToJson(boards);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出留言到MD文件
 * @param {Array} boards 留言列表
 */
API.Boards.exportToMarkdown = async (boards) => {
    let newline = '\r\n\r\n';

    let total = boards.length;
    // 根据年份分组，每一年生成一个MD文件
    const yearMap = API.Utils.groupedByTime(boards, "pubtime");

    let indicator = new StatusIndicator('Boards_Export');

    // 更新年份的留言总数
    indicator.setTotal(boards.length);

    for (let year_entry of yearMap) {
        // 年份
        let year = year_entry[0];
        // 月份Map
        let monthMap = year_entry[1];

        indicator.setIndex(year);

        let contents = [];
        contents.push("# " + year + "年");

        let items = [];
        for (let month_entry of monthMap) {
            // 月份
            let month = month_entry[0];
            // 月份留言列表
            let month_items = month_entry[1];

            contents.push("## " + month + "月 ");

            contents.push("---");

            for (const borad of month_items) {
                // 留言楼层
                contents.push('#### 第' + (total--) + '楼');

                let nickname = API.Boards.getOwner(borad);
                nickname = API.Utils.formatContent(nickname, "MD");

                contents.push('> {0} 【{1}】'.format(borad.pubtime, nickname));
                contents.push('> 正文：');

                // 他人模式兼容私密留言
                if (borad.secret == 1 && !borad.htmlContent) {
                    // 私密留言提示
                    contents.push('主人收到一条私密留言，仅彼此可见');
                    continue;
                }

                // 留言内容
                let html_content = borad.htmlContent.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');
                html_content = html_content.replace(/\n/g, "\r\n");
                let markdown_content = QZone.Common.MD.turndown(html_content);
                markdown_content = API.Utils.formatContent(markdown_content, "MD");

                // 添加留言内容
                contents.push('- [{0}](https://user.qzone.qq.com/{1})：{2}'.format(nickname, borad.uin, markdown_content));

                // 处理留言回复
                contents.push('> 回复：');
                let replyList = borad.replyList || [];
                for (const reply of replyList) {
                    let replyName = API.Boards.getOwner(reply);
                    replyName = API.Utils.formatContent(replyName, "MD");
                    let replyContent = API.Utils.formatContent(reply.content, "MD");
                    let replyTime = API.Utils.formatDate(reply.time);
                    let replyMd = '- [{0}](https://user.qzone.qq.com/{1})：{2} 【*{3}*】'.format(replyName, reply.uin, replyContent, replyTime);
                    contents.push(replyMd);
                }
                contents.push('---');
            }

            items = items.concat(month_items);
        }

        const yearFilePath = QZone.Boards.ROOT + "/" + year + "年.md";
        await API.Utils.writeText(contents.join(newline), yearFilePath).then(fileEntry => {
            console.debug('备份留言列表完成，当前年份=', year, items, fileEntry);
            indicator.addSuccess(items);
        }).catch(error => {
            console.error('备份留言列表失败，当前年份=', year, items, error);
            indicator.addFailed(items);
        });
    }
    indicator.complete();
}


/**
 * 导出留言到JSON文件
 * @param {Array} boards 留言列表
 */
API.Boards.exportToJson = async (boards) => {
    let indicator = new StatusIndicator('Boards_Export');

    // 更新年份的留言总数
    indicator.setTotal(boards.length);

    // 根据年份分组
    let yearDataMap = API.Utils.groupedByTime(boards, "pubtime");
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];

        indicator.setIndex(year);

        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];
            yearItems = yearItems.concat(items);
        }
        const yearFilePath = QZone.Boards.ROOT + "/" + year + "年.json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then(fileEntry => {
            console.debug('备份留言列表完成，当前年份=', year, yearItems, fileEntry);
            indicator.addSuccess(yearItems);
        }).catch(error => {
            console.error('备份留言列表失败，当前年份=', year, yearItems, error);
            indicator.addFailed(yearItems);
        });
    }

    let json = JSON.stringify(boards);
    await API.Utils.writeText(json, QZone.Boards.ROOT + '/留言.json').then(fileEntry => {
        console.debug('备份留言列表完成', boards, fileEntry);
    }).catch(error => {
        console.error('备份留言列表失败', boards, error);
    });
    indicator.complete();
    return boards;
}