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
        let boardInfo = await API.Boards.getAllList();

        // 处理数据
        boardInfo = await API.Boards.handerData(boardInfo);

        // 根据导出类型导出数据
        await API.Boards.exportAllToFiles(boardInfo);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Boards);

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

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(QZone_Config.Boards.pageSize);

    return await API.Boards.getBoards(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data || {};

        // 更新总数
        QZone.Boards.Data.total = data.total || QZone.Boards.Data.total || 0;
        if (data.authorInfo) {
            QZone.Boards.Data.authorInfo = {
                message: data.authorInfo.htmlMsg || '',
                sign: data.authorInfo.sign || ''
            }
        }
        indicator.setTotal(QZone.Boards.Data.total);

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

    // 进度更新器
    const indicator = new StatusIndicator('Boards');

    // 开始
    indicator.print();

    // 配置项
    const CONFIG = QZone_Config.Boards;

    const nextPage = async function (pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Boards.getPageList(pageIndex, indicator).then(async (dataList) => {

            // 设置比较信息
            dataList = API.Common.setCompareFiledInfo(dataList, 'pubtime', 'pubtime');

            // 合并数据
            QZone.Boards.Data.items = API.Utils.unionItems(QZone.Boards.Data.items, dataList);
            if (API.Common.isPreBackupPos(dataList, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Boards.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Boards.Data.total, QZone.Boards.Data.items, arguments.callee, nextPageIndex, indicator);
        }).catch(async (e) => {
            console.error("获取留言列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Boards.Data.total, QZone.Boards.Data.items, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Boards.Data.items = API.Common.unionBackedUpItems(CONFIG, QZone.Boards.OLD_Data.items, QZone.Boards.Data.items);

    // 发表时间倒序
    QZone.Boards.Data.items = API.Utils.sort(QZone.Boards.Data.items, CONFIG.PreBackup.field, true);

    // 完成
    indicator.complete();

    return QZone.Boards.Data;
}

/**
 * 处理数据
 * @param {Array} boardInfo 留言信息
 */
API.Boards.handerData = async (boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Images_Mime');

    // 处理留言数据
    for (const board of boardInfo.items) {
        if (!API.Common.isNewItem(board)) {
            // 已备份数据跳过不处理
            continue;
        }

        board.uin = board.uin || 0;
        board.nickname = board.nickname || '神秘者';
        board.htmlContent = board.htmlContent || '';
        // 他人模式兼容私密留言
        if (board.secret == 1 && !board.htmlContent) {
            // 私密留言提示
            board.htmlContent = '主人收到一条私密留言，仅彼此可见';
            continue;
        }

        // 处理留言内容
        const $boardDom = jQuery('<div>{0}</div>'.format(board.htmlContent));
        // 处理图片信息
        const images = $boardDom.find("img") || [];
        for (let j = 0; j < images.length; j++) {
            const $img = $(images[j]);

            // 处理相对协议
            let url = $img.attr('orgsrc') || $img.attr('src');
            // 处理表情表情相对协议
            url = url.replace(/^\/qzone\/em/g, 'http://qzonestyle.gtimg.cn/qzone/em');
            url = API.Utils.toHttp(url);
            $img.attr('src', url);

            // 添加下载任务
            if (API.Common.isQzoneUrl()) {
                // QQ空间外链不处理
                continue;
            }

            let custom_filename = QZone.Boards.FILE_URLS.get(url);
            if (!custom_filename) {
                custom_filename = API.Utils.newSimpleUid(8, 16);
                let autoSuffix = await API.Utils.autoFileSuffix(url);
                custom_filename = custom_filename + autoSuffix;
                // 添加下载任务
                API.Utils.newDownloadTask(url, 'Boards/Images', custom_filename, board);
                QZone.Boards.FILE_URLS.set(url, custom_filename);
            }
            $img.attr('src', 'images/' + custom_filename);

            indicator.addSuccess(1);
        }

        // 替换无协议图片地址
        board.htmlContent = $boardDom.html();
    }

    // 完成
    indicator.complete();
    return boardInfo;
}


/**
 * 导出留言
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportAllToFiles = async (boardInfo) => {
    // 获取用户配置
    let exportType = QZone_Config.Boards.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Boards.exportToHtml(boardInfo);
            break;
        case 'MarkDown':
            await API.Boards.exportToMarkdown(boardInfo);
            break;
        case 'JSON':
            await API.Boards.exportToJson(boardInfo);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}


/**
 * 导出留言到HTML文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToHtml = async (boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    indicator.setIndex("HTML");
    try {
        // 基于JSON生成JS
        console.info('生成留言JSON开始', boardInfo);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('boardInfo', boardInfo, QZone.Common.ROOT + '/json/boards.js');
        console.info('生成留言JSON结束', jsonFile, boardInfo);

        // 留言数据根据年份分组
        const yearMaps = API.Utils.groupedByTime(boardInfo.items, "pubtime", 'year');
        // 基于模板生成年份留言HTML
        for (const [year, yearItems] of yearMaps) {
            console.info('生成年份HTML文件开始', year, yearItems);
            // 基于模板生成所有留言HTML
            const _boardMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "pubtime", 'month');
            _boardMaps.set(year, monthMaps);
            const params = {
                boardMaps: _boardMaps,
                total: yearItems.length,
                authorInfo: boardInfo.authorInfo
            }
            const yearFile = await API.Common.writeHtmlofTpl('boards', params, QZone.Boards.ROOT + "/" + year + ".html");
            console.info('生成年份HTML文件结束', year, yearItems, yearFile);
        }

        console.info('生成汇总HTML文件开始', boardInfo);
        // 基于模板生成汇总说说HTML
        const params = {
            boardMaps: API.Utils.groupedByTime(boardInfo.items, "pubtime", 'all'),
            total: boardInfo.total,
            authorInfo: boardInfo.authorInfo
        }
        const allFile = await API.Common.writeHtmlofTpl('boards', params, QZone.Boards.ROOT + "/index.html");
        console.info('生成汇总HTML文件结束', allFile, boardInfo);
    } catch (error) {
        console.error('导出留言到HTML异常', error, boardInfo);
    }
    indicator.complete();
    return boardInfo;
}

/**
 * 导出留言到MD文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToMarkdown = async (boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 总数，用于计算楼层
        let total = boardInfo.total;

        // 根据年份分组，每一年生成一个MD文件
        const yearMap = API.Utils.groupedByTime(boardInfo.items, "pubtime");

        // 个人寄语
        const message = QZone.Common.MD.turndown(boardInfo.authorInfo.message);
        const _messsages = [];
        _messsages.push('> 主人寄语  ');
        _messsages.push('\n');
        _messsages.push(message);
        _messsages.push('\n');
        _messsages.push('---  ');

        // 汇总内容
        let allYearContents = [];

        for (const [year, monthMaps] of yearMap) {
            // 年份内容
            let year_contents = [];
            year_contents.push("# " + year + "年");

            // 年条目数
            let year_total = 0;
            for (const [month, month_items] of monthMaps) {
                year_contents.push("## " + month + "月 ");
                // 年份内容
                for (const borad of month_items) {
                    // 留言楼层
                    year_contents.push('#### 第' + (total--) + '楼');
                    const board_content = API.Boards.getMarkdown(borad);
                    year_contents.push(board_content);
                    // 楼层分割线
                    year_contents.push('---');
                    year_total++;
                }
            }

            // 汇总年份内容
            allYearContents.push(year_contents.join('\r\n'));

            const yearFilePath = QZone.Boards.ROOT + "/" + year + ".md";

            // 合并个人寄语
            _messsages[5] = '> 留言(' + year_total + ')  ';
            year_contents = _messsages.concat(year_contents);

            await API.Utils.writeText(year_contents.join('\r\n'), yearFilePath).then(fileEntry => {
                console.info('备份留言列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份留言列表失败，当前年份=', year, error);
            });
        }

        // 合并个人寄语
        _messsages[5] = '> 留言(' + boardInfo.total + ')  ';
        allYearContents = _messsages.concat(allYearContents);

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), QZone.Boards.ROOT + '/Boards.md');
    } catch (error) {
        console.error('导出留言到Markdown文件异常', error, boardInfo);
    }

    indicator.complete();
    return boardInfo;
}

/**
 * 生成单个留言的Markdown内容
 * @param {Object} boards 留言列表
 */
API.Boards.getMarkdown = (borad) => {
    const year_contents = [];

    let nickname = API.Common.formatContent(API.Boards.getOwner(borad), "MD");
    nickname = API.Common.getUserLink(borad.uin, nickname, 'MD', true);

    year_contents.push('> {0} *{1}*'.format(nickname, API.Utils.formatDate(borad.pubtime)));
    year_contents.push("\r\n");
    year_contents.push('> 正文：');
    year_contents.push("\r\n");

    // 留言内容
    const html_content = borad.htmlContent.replace(/\n/g, "\r\n");
    let markdown_content = QZone.Common.MD.turndown(html_content);
    markdown_content = API.Common.formatContent(markdown_content, "MD");

    // 添加留言内容
    year_contents.push('- {0}：{1}'.format(nickname, markdown_content));
    year_contents.push("\r\n");

    // 处理留言回复
    year_contents.push('> 回复：');
    year_contents.push("\r\n");
    let replyList = borad.replyList || [];
    for (const reply of replyList) {
        // 回复人
        let replyName = API.Common.formatContent(API.Boards.getOwner(reply), "MD");
        replyName = API.Common.getUserLink(reply.uin, replyName, 'MD', true);

        // 回复内容
        const replyContent = API.Common.formatContent(reply.content, "MD");
        const replyTime = API.Utils.formatDate(reply.time);

        const replyMd = '- {0}：{1} *{2}*'.format(replyName, replyContent, replyTime);
        year_contents.push(replyMd);
    }
    return year_contents.join('\r\n');
}

/**
 * 导出留言到JSON文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToJson = async (boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    indicator.setIndex('JSON');

    // 根据年份分组
    const yearDataMap = API.Utils.groupedByTime(boardInfo.items, "pubtime", 'year');
    for (const [year, yearItems] of yearDataMap) {
        // 每年信息
        const yearInfo = {
            items: yearItems,
            authorInfo: boardInfo.authorInfo,
            total: yearItems.length
        }
        const yearFilePath = QZone.Boards.ROOT + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearInfo), yearFilePath).then(fileEntry => {
            console.info('备份留言列表完成，当前年份=', year, yearInfo, fileEntry);
        }).catch(error => {
            console.error('备份留言列表失败，当前年份=', year, yearInfo, error);
        });
    }

    await API.Utils.writeText(JSON.stringify(boardInfo), QZone.Boards.ROOT + '/boards.json').then(fileEntry => {
        console.info('备份留言列表完成', boardInfo, fileEntry);
    }).catch(error => {
        console.error('备份留言列表失败', boardInfo, error);
    });

    // 完成
    indicator.complete();
    return boardInfo;
}