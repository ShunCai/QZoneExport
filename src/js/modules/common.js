/**
 * 用户个人档模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 初始化用户信息
 */
API.Common.initUserInfo = async () => {
    try {

        // 获取所有的QQ好友
        let userInfo = await API.Common.getUserInfos();
        userInfo = API.Utils.toJson(userInfo, /^_Callback\(/);
        userInfo = userInfo.data;

        // 用户信息
        userInfo = Object.assign(QZone.Common.Target, userInfo);

        // 更换用户图片
        userInfo.avatar = API.Common.getUserLogoUrl(userInfo.uin);

    } catch (error) {
        console.error('初始化用户信息异常', error);
    }
}

/**
 * 导出用户个人档信息
 */
API.Common.exportUser = async () => {
    try {
        let userInfo = QZone.Common.Target

        // 添加统计信息到用户信息
        userInfo.messages = QZone.Messages.Data.length;
        userInfo.blogs = QZone.Blogs.Data.length;
        userInfo.diaries = QZone.Diaries.Data.length;
        let photos = [];
        for (const album of QZone.Photos.Album.Data) {
            photos = photos.concat(album.photoList || []);
        }
        userInfo.photos = photos.length;
        userInfo.videos = QZone.Videos.Data.length;
        userInfo.boards = QZone.Boards.Data.length;
        userInfo.favorites = QZone.Favorites.Data.length;
        userInfo.friends = QZone.Friends.Data.length;

        // 根据导出类型导出数据
        await API.Common.exportUserToJson(userInfo);

        // 生成MarkDown
        await API.Common.exportUserToMd(userInfo);

        // 生成HTML
        await API.Common.exportUserToHtml(userInfo);

    } catch (error) {
        console.error('导出用户个人档信息失败', error);
    }
}

/**
 * 导出个人信息到JSON文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToJson = async (userInfo) => {
    let json = JSON.stringify(userInfo);
    let path = QZone.Common.ROOT + '/json';

    // 创建JSON文件夹
    await API.Utils.createFolder(path);

    // 写入JOSN
    await API.Utils.writeText(json, path + '/User.json').then((fileEntry) => {
        console.info("导出用户个人档信息完成", fileEntry);
    }).catch((error) => {
        console.error("导出用户个人档信息异常", error);
    });
}

/**
 * 导出个人信息到MarkDown文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToMd = async (userInfo) => {
    // 导出类型存在MarkDown的时候才生成首页MarkDown
    // 说说
    let hasMd = Qzone_Config.Messages.exportType === 'MarkDown';
    // 日志
    hasMd = hasMd || Qzone_Config.Blogs.exportType === 'MarkDown';
    // 日记
    hasMd = hasMd || Qzone_Config.Diaries.exportType === 'MarkDown';
    // 留言板
    hasMd = hasMd || Qzone_Config.Boards.exportType === 'MarkDown';
    // QQ好友
    hasMd = hasMd || Qzone_Config.Friends.exportType === 'MarkDown';
    // 收藏夹
    hasMd = hasMd || Qzone_Config.Favorites.exportType === 'MarkDown';
    // 相册
    hasMd = hasMd || Qzone_Config.Photos.exportType === 'MarkDown';
    // 视频
    hasMd = hasMd || Qzone_Config.Videos.exportType === 'MarkDown';

    if (!hasMd) {
        return;
    }

    console.info('导出空间预览到Markdown文件开始', userInfo);

    const contents = [];
    contents.push('### 个人信息');
    contents.push('{nickname}({uin})'.format(QZone.Common.Target));

    contents.push('### 空间名称');
    contents.push('{spacename}'.format(QZone.Common.Target));

    contents.push('### 空间说明');
    contents.push('{desc}'.format(QZone.Common.Target));

    contents.push('### 空间概览');
    contents.push('说说|日志|日记|相册|视频|留言|收藏|好友');
    contents.push('---|---|---|---|---|---|---|---');
    contents.push('{messages}|{blogs}|{diaries}|{photos}|{videos}|{boards}|{favorites}|{friends}'.format(QZone.Common.Target));

    await API.Utils.writeText(contents.join('\r\n'), FOLDER_ROOT + "index.md").then((fileEntry) => {
        console.info("导出空间预览到Markdown文件完成", fileEntry, userInfo);
    }).catch((error) => {
        console.error("导出空间预览到Markdown文件异常", error, userInfo);
    });
}

/**
 * 导出个人信息到HTML文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToHtml = async (userInfo) => {
    // 导出类型存在HTML的时候才生成首页HTML
    // 说说
    let hasHtml = Qzone_Config.Messages.exportType === 'HTML';
    // 日志
    hasHtml = hasHtml || Qzone_Config.Blogs.exportType === 'HTML';
    // 日记
    hasHtml = hasHtml || Qzone_Config.Diaries.exportType === 'HTML';
    // 留言板
    hasHtml = hasHtml || Qzone_Config.Boards.exportType === 'HTML';
    // QQ好友
    hasHtml = hasHtml || Qzone_Config.Friends.exportType === 'HTML';
    // 收藏夹
    hasHtml = hasHtml || Qzone_Config.Favorites.exportType === 'HTML';
    // 相册
    hasHtml = hasHtml || Qzone_Config.Photos.exportType === 'HTML';
    // 视频
    hasHtml = hasHtml || Qzone_Config.Videos.exportType === 'HTML';

    if (!hasHtml) {
        return;
    }

    // 导出HTML依赖的JS、CSS
    for (let index = 0; index < QZone.Common.ExportFiles.length; index++) {
        const pathInfo = QZone.Common.ExportFiles[index];
        let paths = pathInfo.target.split('/');
        let filename = paths.pop();
        await API.Utils.createFolder(paths.join('/'));
        await API.Utils.downloadToFile(chrome.extension.getURL(pathInfo.original), paths.join('/') + '/' + filename);
    }

    console.info('生成首页HTML文件开始', userInfo);
    // 基于模板生成HTML
    let fileEntry = await API.Common.writeHtmlofTpl('index', { user: userInfo }, FOLDER_ROOT + "/index.html");
    console.info('生成首页HTML文件结束', fileEntry, userInfo);
}

/**
 * 基于模板生成HTML文件
 * @param {string} name 模板文件名
 * @param {object} params 参数
 * @param {object} params 参数
 */
API.Common.writeHtmlofTpl = async (name, params, indexHtmlePath) => {
    let html = await API.Common.getHtmlTemplate(name, params);
    let fileEntry = await API.Utils.writeText(html, indexHtmlePath);
    return fileEntry;
}

/**
 * 渲染HTML模板
 * @param {string} name 模板文件名
 * @param {object} params 参数
 */
API.Common.getHtmlTemplate = async (name, params) => {
    let html = await API.Utils.get(chrome.extension.getURL('templates/' + name + '.html'));
    if (!params) {
        return html;
    }
    return template(html, params);
}

/**
 * 基于JSON生成JS文件
 * @param {string} key js变量名
 * @param {object} object 对象
 * @param {string} path js文件路径
 */
API.Common.writeJsonToJs = async (key, object, path) => {
    let json = JSON.stringify(object);
    let js = 'const ' + key + ' = ' + json;
    let fileEntry = await API.Utils.writeText(js, path);
    return fileEntry;
}

/**
 * 转换内容
 * @param {string} contet 内容
 * @param {string} type 转换类型，默认TEXT,可选HTML,MD
 * @param {boolean} isRt 是否是处理转发内容
 * @param {boolean} isSupportedHtml 内容本身是否支持HTML
 */
API.Common.formatContent = (item, type, isRt, isSupportedHtml) => {
    let content = API.Utils.formatContent(item, type, isRt, isSupportedHtml);
    try {
        // 暂时不识别内容图片，这里识别文件名后缀涉及到async，渲染模板暂不支持await，也不能通过URL直接判断，因为文件名可能为GIF，实际类型却为PNG
        // content = API.Common.handerContentImages(content, type);
    } catch (error) {
        console.error('处理内容图片信息异常', error, item, type, isRt, isSupportedHtml);
    }
    // 默认调用原先的内容转换
    return content;
}

/**
 * 处理内容中的图片
 * @param {string} content 内容
 * @param {string} type 类型
 */
API.Common.handerContentImages = (content, type) => {
    if (API.Common.isQzoneUrl() || !content) {
        // QQ空间外链不处理
        return content;
    }
    // 获取内容中的图片信息（如果说说本身的内容也是HTML/MD代码，也同样处理）
    if ("MD" === type) {
        content.replace(/!\[.*?\]\((.+?)\)/g, function (linkmd, url) {
            let custom_filename = API.Common.addDownloadTask(url, content);
            return linkmd.replace(url, API.Common.getMediaPath(url, 'Common/images/' + custom_filename, "Messages_HTML"));
        })
        return content;
    }
    // 其他的，目前，只有HTML
    const _html = jQuery("<div>" + content + "</div>");
    const images = _html.find("img") || [];
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        let url = $img.attr('orgsrc') || $img.attr('src') || '';
        let custom_filename = API.Common.addDownloadTask(url, content);
        $img.attr('src', API.Common.getMediaPath(url, 'Common/images/' + custom_filename, "Messages_HTML"));
    }
    return _html.html();
}

/**
 * 添加内容中的图片下载任务
 * @param {string} url 链接
 * @param {string} content 内容
 */
API.Common.addDownloadTask = (url, content) => {
    let custom_filename = QZone.Common.FILE_URLS.get(url);
    if (!custom_filename) {
        // 添加下载任务
        let uid = API.Utils.newSimpleUid(8, 16);
        // 暂时不识别内容图片，这里识别文件名后缀涉及到async，渲染模板暂不支持await，也不能通过URL直接判断，因为文件名可能为GIF，实际类型却为PNG
        let suffix = API.Utils.getFileSuffix(url);
        custom_filename = uid + suffix;
        // 添加下载任务
        API.Utils.newDownloadTask(url, 'Common/images', custom_filename, content);
        QZone.Common.FILE_URLS.set(url, custom_filename);
    }
    return custom_filename;
}

/**
 * 获取多媒体路径
 * @param {string} url 远程URL
 * @param {string} filepath 本地文件路径
 * @param {string} sourceType 来源类型
 */
API.Common.getMediaPath = (url, filepath, sourceType) => {
    let res = filepath || url;
    switch (sourceType) {
        case 'Messages_HTML':
            res = '../' + res;
            break;
        case 'Photos_HTML':
            res = '../' + res;
            break;
        case 'Videos_HTML':
            res = '../' + res;
            break;
        default:
            break;
    }
    return res;
}