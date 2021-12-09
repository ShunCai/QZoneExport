/**
 * QQ空间私密日记模块的导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出私密日记数据
 */
API.Diaries.export = async() => {
    try {

        // 获取所有的私密日记数据
        let items = await API.Diaries.getAllList();
        console.info('私密日记列表获取完成', items);

        // 获取私密日记内容
        items = await API.Diaries.getAllContents(items);
        console.info('私密日记内容获取完成', items);

        // 获取所有的私密日记评论，由普通日志转私密日记的，会保留评论
        items = await API.Diaries.getItemsAllCommentList(items);

        // 获取日志点赞列表
        await API.Diaries.getAllLikeList(items);

        // 获取日志最近浏览
        await API.Diaries.getAllVisitorList(items);

        // 根据导出类型导出数据    
        await API.Diaries.exportAllListToFiles(items);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Diaries);
    } catch (error) {
        console.error('私密日记导出异常', error);
    }
}

/**
 * 获取所有私密日记的内容
 * @param {Array} items 私密日记列表
 */
API.Diaries.getAllContents = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Content');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        let item = items[index];

        // 更新状态-当前位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        await API.Diaries.getInfo(item.blogid).then(async(data) => {
            // 添加成功提示
            indicator.addSuccess(data);

            // 加载日志页面
            const blogPage = jQuery(data);

            // 基于DOM获取详细信息
            item = API.Blogs.readDetailInfo(blogPage) || item;

            // 获得网页中的日志正文
            const $detailBlog = blogPage.find("#blogDetailDiv:first");

            // 添加原始HTML
            item.html = API.Utils.utf8ToBase64($detailBlog.html());

            // 处理图片信息
            await API.Diaries.handerImages(item, $detailBlog.find("img"));

            // 处理视频信息
            await API.Diaries.handerMedias(item, $detailBlog.find("embed"));

            // 更改自定义标题
            item.custom_title = '《{0}》'.format(item.title);
            // 添加自定义HTML
            item.custom_html = API.Utils.utf8ToBase64($detailBlog.html());
            // 添加点赞Key
            item.uniKey = API.Blogs.getUniKey(item.blogid || item.blogId);

            items[index] = item;
        }).catch((e) => {
            console.error("获取私密日记内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })

        // 等待一下再请求
        let min = QZone_Config.Diaries.Info.randomSeconds.min;
        let max = QZone_Config.Diaries.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }

    // 完成
    indicator.complete();
    return items;
}


/**
 * 获取单页的私密日记列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Diaries.getList = async(pageIndex, indicator) => {
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Diaries.getDiaries(pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code < 0) {
            // 获取异常
            console.warn('获取单页的私密日记列表异常：', data);
        }
        data = data.data || {};

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Diaries.pageSize);

        // 更新状态-总数
        QZone.Diaries.total = data.total_num || QZone.Diaries.total || 0;
        indicator.setTotal(QZone.Diaries.total);

        let dataList = data.titlelist || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有私密日记列表
 */
API.Diaries.getAllList = async() => {

    // 私密日记状态更新器
    const indicator = new StatusIndicator('Diaries');

    // 开始
    indicator.print();

    // 配置项
    const CONFIG = QZone_Config.Diaries;

    const nextPage = async function(pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getList(pageIndex, indicator).then(async(dataList) => {

            // 合并数据
            QZone.Diaries.Data = API.Utils.unionItems(QZone.Diaries.Data, dataList);
            if (API.Common.isPreBackupPos(dataList, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Diaries.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Diaries.total, QZone.Diaries.Data, arguments.callee, nextPageIndex, indicator);

        }).catch(async(e) => {
            console.error("获取私密日记列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Diaries.total, QZone.Diaries.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Diaries.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Diaries.OLD_Data, QZone.Diaries.Data);

    // 发表时间倒序
    QZone.Diaries.Data = API.Utils.sort(QZone.Diaries.Data, CONFIG.PreBackup.field, true);

    // 完成
    indicator.complete();

    return QZone.Diaries.Data;
}

/**
 * 获取所有日志的评论列表
 * @param {string} item 日志
 */
API.Diaries.getItemsAllCommentList = async(items) => {
    if (!QZone_Config.Diaries.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 单条日志状态更新器
    const indicator = new StatusIndicator('Diaries_Comments');
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

        // 预防日志无评论
        item.comments = item.comments || [];

        // 获取日志的全部评论
        await API.Diaries.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 已完成
    indicator.complete();
    return items;
}

/**
 * 获取单条日志的单页评论列表
 * @param {object} item 日志
 * @param {integer} pageIndex 页数索引
 */
API.Diaries.getItemCommentList = async(item, pageIndex) => {
    return await API.Diaries.getComments(item.blogid, pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code < 0) {
            // 获取异常
            console.warn('获取单条日志的单页评论列表异常：', data);
        }
        data = data.data || {};
        return data.comments || [];
    });
}

/**
 * 获取单条日志的全部评论列表
 * @param {object} item 日志
 */
API.Diaries.getItemAllCommentList = async(item) => {
    if (!(item.replynum > item.comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.comments;
    }
    // 清空原有的评论列表
    item.comments = [];

    // 日志评论配置
    const CONFIG = QZone_Config.Diaries.Comments;

    // 更新总数
    const total = item.replynum || 0;

    const nextPage = async function(item, pageIndex) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getItemCommentList(item, pageIndex).then(async(dataList) => {

            // 合并评论列表
            item.comments = item.comments.concat(dataList || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取日志评论列表异常，当前页：", pageIndex + 1, item, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.comments;
}


/**
 * 获取日志赞记录
 * @param {Array} items 日志列表
 */
API.Diaries.getAllLikeList = async(items) => {

    if (!API.Common.isGetLike(QZone_Config.Diaries)) {
        // 不获取赞
        return items;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Like');
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
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Diaries).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取私密日记点赞异常：", item, e);
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
 * 获取单条私密日记的全部最近访问
 * @param {object} item 说说
 */
API.Diaries.getItemAllVisitorsList = async(item) => {
    // 清空原有的最近访问信息
    item.custom_visitor = {
        viewCount: 0,
        totalNum: 0,
        list: []
    };

    // 说说最近访问配置
    const CONFIG = QZone_Config.Diaries.Visitor;

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getVisitors(item.blogid, pageIndex).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code < 0) {
                // 获取异常
                console.warn('获取单条私密日记的全部最近访问异常：', data);
            }
            data = data.data || {};

            // 合并
            item.custom_visitor.viewCount = data.viewCount || 0;
            item.custom_visitor.totalNum = data.totalNum || 0;
            item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取日志最近访问列表异常，当前页：", pageIndex + 1, item, e);

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_visitor;
}

/**
 * 获取日志最近访问
 * @param {Array} items 日志列表
 */
API.Diaries.getAllVisitorList = async(items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Diaries)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Visitor');
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
            tasks.push(API.Diaries.getItemAllVisitorsList(item).then((visitor) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取日志最近访问异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 获取日志阅读数
    await API.Diaries.getAllReadCount(items);

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
}

/**
 * 获取私密日记阅读数
 * @param {Array} items 日志列表
 */
API.Diaries.getAllReadCount = async(items) => {
    try {
        // 同时请求数
        const _items = _.chunk(items, 10);

        // 获取最近访问
        end: for (let i = 0; i < _items.length; i++) {
            const list = _items[i];

            // 日志ID数组
            const blogIds = [];
            for (let j = 0; j < list.length; j++) {
                const item = list[j];
                if (!API.Common.isNewItem(item)) {
                    // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                    break end;
                }
                blogIds.push(item.blogid);
            }
            // 单独获取日志的阅读数
            let data = await API.Diaries.getReadCount(blogIds);
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code < 0) {
                // 获取异常
                console.warn('获取私密日记阅读数异常：', data);
            }
            data = data.data || {};

            const readList = data.itemList || [];
            const idMaps = API.Utils.groupedByField(readList, "id");
            for (const item of list) {
                if (idMaps.has(item.blogid)) {
                    item.custom_visitor.viewCount = idMaps.get(item.blogid)[0].read || item.custom_visitor.viewCount;
                }
            }
        }
    } catch (error) {
        console.error("获取日志阅读数异常：", error);
    }
    return items;
}

/**
 * 所有私密日记转换成导出文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportAllListToFiles = async(items) => {
    // 获取用户配置
    let exportType = QZone_Config.Diaries.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Diaries.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Diaries.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Diaries.exportToJson(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出私密日记到HTML文件
 * @param {Array} items 日志列表
 */
API.Diaries.exportToHtml = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Export_Other');
    indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Diaries');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('diaries', items, moduleFolder + '/json/diaries.js');


        // 基于模板生成HTML
        await API.Common.writeHtmlofTpl('diaries', undefined, moduleFolder + "/index.html");

        // 生成私密日记详情HTML
        await API.Common.writeHtmlofTpl('diaryinfo', undefined, moduleFolder + "/info.html");

        // 每篇日记生成单独的HTML
        for (let i = 0; i < items.length; i++) {
            const blog = items[i];
            let orderNum = API.Utils.prefixNumber(i + 1, items.length.toString().length);
            await API.Common.writeHtmlofTpl('diaryinfo_static', { blog: blog }, moduleFolder + "/{0}_{1}.html".format(orderNum, API.Utils.filenameValidate(blog.title)));
        }

    } catch (error) {
        console.error('导出私密日记到HTML异常', error, boardInfo);
    }

    // 更新完成信息
    indicator.complete();
    return items;
}


/**
 * 导出私密日记到MarkDown文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportToMarkdown = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Export');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取私密日记MD内容
        let content = await API.Diaries.getMarkdown(item);
        let title = item.title;
        let date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        let orderNum = API.Utils.prefixNumber(index + 1, QZone.Diaries.total.toString().length);
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + title + "】");
        // 文件夹路径
        let categoryFolder = API.Common.getModuleRoot('Diaries') + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 私密日记文件路径
        let filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeText(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入私密日记文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
    return items;
}

/**
 * 获取单篇私密日记的MD内容
 * @param {object} item 私密日记信息
 */
API.Diaries.getMarkdown = async(item) => {
    const contents = [];
    // 拼接标题，日期，内容
    contents.push("# " + item.title);
    contents.push("> " + API.Utils.formatDate(item.pubtime));
    contents.push("\r\n");

    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.custom_html));
    markdown = markdown.replace(/\n/g, "\r\n");
    contents.push(markdown);
    contents.push("\r\n");

    // 拼接评论
    contents.push("> 评论({0})".format(item.replynum));

    let comments = item.comments || [];
    for (const comment of comments) {
        // 评论人
        let poster = comment.poster.name || QZone.Common.Target.nickname || '';
        poster = API.Common.formatContent(poster, 'MD');
        poster = API.Common.getUserLink(comment.poster.id, poster, 'MD', true);

        // 评论内容
        let content = API.Common.formatContent(comment.content, 'MD');
        // 替换换行符
        content = content.replace(/\n/g, "");

        // 添加评论内容
        contents.push('* {0}：{1}'.format(poster, content));

        // 评论的回复
        const replies = comment.replies || [];
        for (const rep of replies) {
            // 回复人
            let repPoster = rep.poster.name || QZone.Common.Target.nickname || '';
            repPoster = API.Common.formatContent(repPoster, 'MD');
            repPoster = API.Common.getUserLink(rep.poster.id, repPoster, 'MD', true);

            // 回复内容
            let repContent = API.Common.formatContent(rep.content, 'MD');
            // 替换换行符
            repContent = repContent.replace(/\n/g, "");

            // 添加评论内容
            contents.push('\t* {0}：{1}'.format(repPoster, repContent));
        }
    }
    return contents.join('\r\n');
}

/**
 * 处理日志的图片
 * @param {object} item 日志
 * @param {Array} images 图片元素列表
 */
API.Diaries.handerImages = async(item, images) => {
    if (!images) {
        return item;
    }

    // 导出类型
    const exportType = QZone_Config.Diaries.exportType;
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        // 处理相对协议
        let url = $img.attr('orgsrc') || $img.attr('src');
        url = API.Utils.toHttp(url);

        // 添加下载任务
        if (!API.Common.isQzoneUrl()) {
            // 非QQ空间外链
            let uid = API.Utils.newSimpleUid(8, 16);
            let suffix = await API.Utils.autoFileSuffix(url);
            const custom_filename = uid + suffix;
            // 添加下载任务
            API.Utils.newDownloadTask('Diaries', url, 'Diaries/Images', custom_filename, item);

            // 新的图片离线地址
            url = 'MarkDown' === exportType ? '../Images/' + custom_filename : 'Images/' + custom_filename;
        }

        // 修改日志中的图片链接
        $img.attr('src', url);
        // 更改图片索引
        $img.attr('data-idx', i);

        // 图片上层的超链接
        const $imageLink = $img.parent('a');

        // 修改图片点击事件
        if ($imageLink && $imageLink.length > 0) {
            // 更改图片地址
            $imageLink.attr('href', url);
            // 画廊查看大图
            $imageLink.addClass('lightgallery');
        } else {
            // 没有超链接的，需要添加超链接，用于生成画廊
            $img.wrap('<a class="lightgallery" href="' + url + '"></a>');
        }
    }
    return item;
}

/**
 * 处理视频信息
 * @param {object} item 日志
 * @param {Array} embeds 图片元素列表
 */
API.Diaries.handerMedias = async(item, embeds) => {
    if (!embeds) {
        // 无图片不处理
        return item;
    }
    for (let i = 0; i < embeds.length; i++) {
        const $embed = $(embeds[i]);
        const data_type = $embed.attr('data-type');
        let vid = $embed.attr('data-vid');
        const height = $embed.attr('height') || '480px';
        const width = $embed.attr('height') || '600px';
        let iframe_url = $embed.attr('src');
        switch (data_type) {
            case '1':
                // 相册视频
                // MP4地址 
                const mp4_url = $embed.attr('data-mp4');
                if (!mp4_url || !vid) {
                    // 历史数据或特殊数据跳过不处理
                    console.warn('历史数据或特殊数据跳过不处理', $embed);
                    return;
                }
                // iframe 播放地址
                iframe_url = 'https://h5.qzone.qq.com/video/index?vid=' + vid;
                break;
            case '51':
                // 外部视频
                if (!vid) {
                    // 历史数据或特殊数据跳过不处理
                    console.warn('历史数据或特殊数据跳过不处理', $embed);
                    return;
                }
                iframe_url = API.Videos.getTencentVideoUrl(vid);
                break;
            default:
                // 其他的
                // 默认取src值
                vid = API.Utils.toParams(iframe_url)['vid'];
                if (vid) {
                    // 取到VID，默认当外部视频处理
                    iframe_url = API.Videos.getTencentVideoUrl(vid);
                }
                break;
        }
        $embed.replaceWith('<iframe src="{0}" height="{1}" width="{2}" allowfullscreen="true"></iframe>'.format(iframe_url, height, width));
    }
    return item;
}

/**
 * 导出私密日记到JSON文件
 * @param {Array} items 私密日记列表
 */
API.Diaries.exportToJson = async(items) => {
    const indicator = new StatusIndicator('Diaries_Export_Other');
    indicator.setIndex('JSON');
    let json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Diaries') + '/diaries.json');
    indicator.complete();
    return items;
}