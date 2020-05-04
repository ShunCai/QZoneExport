/**
 * QQ空间日志模块的导出API
 * @author https://lvshuncai.com
 */

/**
* 导出日志数据
*/
API.Blogs.export = async () => {
    try {
        // 获取所有的日志数据
        let items = await API.Blogs.getAllList();
        console.debug('日志列表获取完成', items);

        // 获取日志内容
        items = await API.Blogs.getAllContents(items);
        console.debug('日志内容获取完成', items);

        // 获取所有的日志评论
        items = await API.Blogs.getItemsAllCommentList(items);

        // 根据导出类型导出数据    
        await API.Blogs.exportAllListToFiles(items);
    } catch (error) {
        console.error('日志导出异常', error);
    }
}

/**
 * 获取所有日志的内容
 * @param {Array} items 日志列表
 */
API.Blogs.getAllContents = async (items) => {
    let indicator = new StatusIndicator('Blogs_Content');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        let item = items[index];
        indicator.index = index + 1;
        await API.Blogs.getInfo(item.blogId).then(async (data) => {
            // 添加成功提示
            indicator.addSuccess(data);
            let blogPage = jQuery(data);
            let blogData = null;
            // 获得网页中的日志JSON数据
            blogPage.find('script').each(function () {
                let t = $(this).text();
                if (t.indexOf('g_oBlogData') !== -1) {
                    let dataM = /var g_oBlogData\s+=\s+({[\s\S]+});\s/;
                    blogData = dataM.exec(t);
                    if (blogData != null) {
                        return false;
                    }
                }
            })
            if (blogData != null) {
                item = JSON.parse(blogData[1]).data;
            }
            // 获得网页中的日志正文
            const $detailBlog = blogPage.find("#blogDetailDiv:first");

            // 添加原始HTML
            item.html = API.Utils.utf8ToBase64($detailBlog.html());

            // 处理图片信息
            await API.Blogs.handerImages(item, $detailBlog.find("img"));

            // 处理视频信息
            await API.Blogs.handerMedias(item, $detailBlog.find("embed"));

            // 更改自定义标题
            item.custom_title = '《{0}》'.format(item.title);
            // 添加自定义HTML
            item.custom_html = API.Utils.utf8ToBase64($detailBlog.html());

            items[index] = item;
        }).catch((e) => {
            console.error("获取日志内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })
        // 等待一下再请求
        let min = Qzone_Config.Blogs.Info.randomSeconds.min;
        let max = Qzone_Config.Blogs.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }
    indicator.complete();
    return items;
}


/**
 * 获取单页的日志列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Blogs.getList = async (pageIndex, indicator) => {
    console.debug("开始获取日志列表，当前页：", pageIndex + 1);
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Blogs.getBlogs(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);

        console.debug("成功获取日志列表，当前页：", pageIndex + 1, data);

        // 更新状态-下载中的数量
        indicator.addDownload(Qzone_Config.Blogs.pageSize);

        // 更新状态-总数
        QZone.Blogs.total = data.data.totalNum || QZone.Blogs.total || 0;
        indicator.setTotal(QZone.Blogs.total);

        let dataList = data.data.list || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
}


/**
 * 获取所有日志列表
 */
API.Blogs.getAllList = async () => {

    // 重置数据
    QZone.Blogs.Data = [];
    QZone.Blogs.Images = [];

    // 日志状态更新器
    let indicator = new StatusIndicator('Blogs');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Blogs;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Blogs.getList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Blogs.Data = QZone.Blogs.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Blogs.Data;
        }).catch(async (e) => {
            console.error("获取日志列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Blogs.Data;
        });
    }

    await nextPage(0, indicator);

    // 完成
    indicator.complete();

    return QZone.Blogs.Data
}


/**
 * 获取所有日志的评论列表
 * @param {string} item 日志
 */
API.Blogs.getItemsAllCommentList = async (items) => {
    if (!Qzone_Config.Blogs.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 预防日志无评论
        item.comments = item.comments || [];

        // 单条日志状态更新器
        let indicator = new StatusIndicator('Blogs_Comments');

        // 更新当前位置
        indicator.index = i + 1;
        indicator.print();

        // 获取日志的全部评论
        await API.Blogs.getItemAllCommentList(item, indicator);

        // 已完成
        indicator.complete();
    }
    return items;
}

/**
 * 获取单条日志的单页评论列表
 * @param {object} item 日志
 * @param {integer} pageIndex 页数索引
 */
API.Blogs.getItemCommentList = async (item, pageIndex) => {
    return await API.Blogs.getComments(item.blogid, pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;
        return data.comments || [];
    });
}

/**
 * 获取单条日志的全部评论列表
 * @param {object} item 日志
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Blogs.getItemAllCommentList = async (item, indicator) => {
    if (!(item.replynum > item.comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.comments;
    }
    // 清空原有的评论列表
    item.comments = [];

    // 日志评论配置
    let CONFIG = Qzone_Config.Blogs.Comments;

    // 更新总数
    let total = item.replynum || 0;
    indicator.setTotal(total);

    let nextPage = async function (item, pageIndex) {
        return await API.Blogs.getItemCommentList(item, pageIndex).then(async (dataList) => {

            // 合并评论列表
            item.comments = item.comments.concat(dataList || []);

            // 更新成功条目数
            indicator.addSuccess(item.comments);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, total, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        }).catch(async (e) => {
            console.error("获取日志评论列表异常，当前页：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Blogs.total, QZone.Blogs.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        });
    }

    await nextPage(item, 0);

    // 完成
    indicator.complete();

    return item.comments;
}


/**
 * 所有日志转换成导出文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportAllListToFiles = async (items) => {
    // 获取用户配置
    let exportType = Qzone_Config.Blogs.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Blogs.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Blogs.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Blogs.exportToJson(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出日志到HTML文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToHtml = async (items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Export_Other');
    indicator.setIndex('HTML');

    // 基于JSON生成JS
    console.info('生成日志JSON开始', items);
    await API.Utils.createFolder(QZone.Common.ROOT + '/json');
    const jsonFile = await API.Common.writeJsonToJs('dataList', items, QZone.Common.ROOT + '/json/blogs.js');
    console.info('生成日志JSON结束', jsonFile, items);

    // 基于模板生成HTML
    console.info('生成日志列表HTML开始', items);
    const listFile = await API.Common.writeHtmlofTpl('blogs', undefined, QZone.Blogs.ROOT + "/index.html");
    console.info('生成日志列表HTML结束', listFile, items);

    // 生成日志详情HTML
    console.info('生成日志详情HTML开始', items);
    const infoFile = await API.Common.writeHtmlofTpl('bloginfo', undefined, QZone.Blogs.ROOT + "/info.html");
    console.info('生成日志详情HTML结束', infoFile, items);

    // 每篇日志生成单独的HTML
    for (let i = 0; i < items.length; i++) {
        const blog = items[i];
        console.info('生成单篇日志详情HTML开始', blog);
        const blogFile = await API.Common.writeHtmlofTpl('bloginfo_static', { blog: blog }, QZone.Blogs.ROOT + "/{0}_{1}.html".format(i + 1, API.Utils.filenameValidate(blog.custom_title)));
        console.info('生成单篇日志详情HTML结束', blogFile, blog);

    }
    indicator.addSuccess(items);
    // 更新完成信息
    indicator.complete();
    return items;
}


/**
 * 导出日志到MarkDown文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToMarkdown = async (items) => {
    let indicator = new StatusIndicator('Blogs_Export');
    indicator.setTotal(items.length);
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取日志MD内容
        let content = await API.Blogs.getItemMdContent(item);
        // 写入内容到文件
        let label = API.Blogs.getBlogLabel(item);
        let title = item.title;
        let date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        let orderNum = API.Utils.prefixNumber(index + 1, QZone.Blogs.total.toString().length);
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + title + "】");
        if (label) {
            filename = API.Utils.filenameValidate(orderNum + "_" + date + "_" + label + "【" + title + "】");
        }
        // 文件夹路径
        let categoryFolder = QZone.Blogs.ROOT + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 日志文件路径
        let filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeText(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入日志文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
    return items;
}

/**
 * 获取单篇日志的MD内容
 * @param {object} item 日志信息
 */
API.Blogs.getItemMdContent = async (item) => {
    // 拼接标题，日期，内容
    let result = "# " + item.title + "\r\n\r\n";
    let postTime = API.Utils.formatDate(item.pubtime);
    result = result + "> " + postTime + "\r\n\r\n";
    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.html));
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "> 评论(" + item.replynum + "):\r\n\r\n";
    let comments = item.comments;
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        let poster = API.Common.formatContent(comment.poster.name, 'MD');
        let content = API.Common.formatContent(comment.content, 'MD');
        // 替换回复内容的换行符
        content = content.replaceAll('\n', '');
        content = '* [{0}](https://user.qzone.qq.com/{1})：{2}'.format(poster, comment.poster.id, content) + "\r\n";
        let replies = comment.replies || [];
        // 处理评论的回复
        for (let j = 0; j < replies.length; j++) {
            const rep = replies[j];
            let repPoster = API.Common.formatContent(rep.poster.name, 'MD');
            let repContent = API.Common.formatContent(rep.content, 'MD');
            // 替换回复内容的换行符
            repContent = repContent.replaceAll('\n', '');
            let c = '\t* [{0}](https://user.qzone.qq.com/{1})：{2}'.format(repPoster, rep.poster.id, repContent) + "\r\n";
            content = content + c;
        }
        result = result + content;
    }
    return result;
}

/**
 * 处理日志的图片
 * @param {object} item 日志
 * @param {Array} images 图片元素列表
 */
API.Blogs.handerImages = async (item, images) => {
    let exportType = Qzone_Config.Blogs.exportType;
    if (!images) {
        // 无图片不处理
        return item;
    }
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        // 处理相对协议
        let url = $img.attr('orgsrc') || $img.attr('src');
        url = API.Utils.toHttp(url);
        $img.attr('src', url);

        // 添加下载任务
        if (API.Common.isQzoneUrl()) {
            // QQ空间外链不处理
            continue;
        }
        let uid = API.Utils.newSimpleUid(8, 16);
        let suffix = await API.Utils.autoFileSuffix(url);
        const custom_filename = uid + suffix;
        // 添加下载任务
        API.Utils.newDownloadTask(url, 'Blogs/Images', custom_filename, item);

        switch (exportType) {
            case 'MarkDown':
                $img.attr('src', '../images/' + custom_filename);
                break;
            default:
                $img.attr('src', 'images/' + custom_filename);
                break;
        }
    }
    return item;
}

/**
 * 处理视频信息
 * @param {object} item 日志
 * @param {Array} embeds 图片元素列表
 */
API.Blogs.handerMedias = async (item, embeds) => {
    if (!embeds) {
        // 无图片不处理
        return item;
    }
    for (let i = 0; i < embeds.length; i++) {
        const $embed = $(embeds[i]);
        const data_type = $embed.attr('data-type');
        let vid = $embed.attr('data-vid');
        let iframe_url;
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
                $embed.replaceWith('<iframe src="{0}" height="{1}" width="{2}" allowfullscreen="true"></iframe>'.format(iframe_url, $embed.attr('height'), $embed.attr('width')));
                break;
            case '51':
                // 外部视频
                if (!vid) {
                    // 历史数据或特殊数据跳过不处理
                    console.warn('历史数据或特殊数据跳过不处理', $embed);
                    return;
                }
                iframe_url = 'https://v.qq.com/txp/iframe/player.html?autoplay=true&vid=' + vid;
                $embed.replaceWith('<iframe src="{0}" height="{1}" width="{2}" allowfullscreen="true"></iframe>'.format(iframe_url, $embed.attr('height'), $embed.attr('width')));
                break;
            default:
                // 其他的
                // 默认取src值
                const src_url = $embed.attr('src');
                vid = API.Utils.toParams(src_url)['vid'];
                if (vid) {
                    // 取到VID，默认当外部视频处理
                    iframe_url = 'https://v.qq.com/txp/iframe/player.html?autoplay=true&vid=' + vid;
                    $embed.replaceWith('<iframe src="{0}" height="{1}" width="{2}" allowfullscreen="true"></iframe>'.format(iframe_url, $embed.attr('height'), $embed.attr('width')));
                }
                break;
        }
    }
    return item;
}

/**
 * 导出日志到JSON文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToJson = async (items) => {
    let indicator = new StatusIndicator('Blogs_Export_Other');
    indicator.setIndex('JSON');
    let json = JSON.stringify(items);
    await API.Utils.writeText(json, QZone.Blogs.ROOT + '/blogs.json');
    indicator.complete();
    return items;
}