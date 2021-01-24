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

        // 添加目标头像下载任务
        API.Common.downloadUserAvatars([QZone.Common.Target, QZone.Common.Owner, userInfo]);

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
        userInfo.boards = QZone.Boards.Data.total;
        userInfo.favorites = QZone.Favorites.Data.length;
        userInfo.shares = QZone.Shares.Data.length;
        userInfo.friends = QZone.Friends.Data.length;
        userInfo.visitors = QZone.Visitors.Data.total;

        // 根据导出类型导出数据
        await API.Common.exportUserToJson(userInfo);

        // 生成MarkDown
        await API.Common.exportUserToMd(userInfo);

        // 生成HTML
        await API.Common.exportUserToHtml(userInfo);

        // 保存配置项，主要是上次备份时间
        chrome.storage.sync.set(QZone_Config);
    } catch (error) {
        console.error('导出用户个人档信息失败', error);
    }
}

/**
 * 导出个人信息到JSON文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToJson = async (userInfo) => {
    const json = JSON.stringify(userInfo);
    const path = QZone.Common.ROOT + '/json';

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
    let hasMd = QZone_Config.Messages.exportType === 'MarkDown';
    // 日志
    hasMd = hasMd || QZone_Config.Blogs.exportType === 'MarkDown';
    // 日记
    hasMd = hasMd || QZone_Config.Diaries.exportType === 'MarkDown';
    // 留言板
    hasMd = hasMd || QZone_Config.Boards.exportType === 'MarkDown';
    // QQ好友
    hasMd = hasMd || QZone_Config.Friends.exportType === 'MarkDown';
    // 收藏夹
    hasMd = hasMd || QZone_Config.Favorites.exportType === 'MarkDown';
    // 分享
    hasMd = hasMd || QZone_Config.Shares.exportType === 'MarkDown';
    // 访客
    hasMd = hasMd || QZone_Config.Visitors.exportType === 'MarkDown';
    // 相册
    hasMd = hasMd || QZone_Config.Photos.exportType === 'MarkDown';
    // 视频
    hasMd = hasMd || QZone_Config.Videos.exportType === 'MarkDown';

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
    contents.push('说说|日志|日记|相册|视频|留言|收藏|分享|访客|好友');
    contents.push('---|---|---|---|---|---|---|---');
    contents.push('{messages}|{blogs}|{diaries}|{photos}|{videos}|{boards}|{favorites}|{shares}|{visitors}|{friends}'.format(QZone.Common.Target));

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
    let hasHtml = QZone_Config.Messages.exportType === 'HTML';
    // 日志
    hasHtml = hasHtml || QZone_Config.Blogs.exportType === 'HTML';
    // 日记
    hasHtml = hasHtml || QZone_Config.Diaries.exportType === 'HTML';
    // 留言板
    hasHtml = hasHtml || QZone_Config.Boards.exportType === 'HTML';
    // QQ好友
    hasHtml = hasHtml || QZone_Config.Friends.exportType === 'HTML';
    // 收藏夹
    hasHtml = hasHtml || QZone_Config.Favorites.exportType === 'HTML';
    // 分享
    hasHtml = hasHtml || QZone_Config.Shares.exportType === 'HTML';
    // 访客
    hasHtml = hasHtml || QZone_Config.Visitors.exportType === 'HTML';
    // 相册
    hasHtml = hasHtml || QZone_Config.Photos.exportType === 'HTML';
    // 视频
    hasHtml = hasHtml || QZone_Config.Videos.exportType === 'HTML';

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
    if (!filepath) {
        return url;
    }
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

/**
 * 通过Ajax请求下载文件
 * @param {Array} tasks
 */
API.Common.downloadsByAjax = async (tasks) => {

    // 任务分组
    const _tasks = _.chunk(tasks, QZone_Config.Common.downloadThread);

    const indicator = new StatusIndicator('Common_File');
    indicator.setTotal(tasks.length);

    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        let down_tasks = [];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];

            // 创建文件夹
            const folderName = FOLDER_ROOT + '/' + task.dir;
            await API.Utils.createFolder(folderName);

            const filepath = folderName + '/' + task.name;
            down_tasks.push(API.Utils.downloadToFile(task.url, filepath).then(() => {
                task.setState('complete');
                indicator.addSuccess(task);
            }).catch((error) => {
                indicator.addFailed(task);
                task.setState('interrupted');
                console.error('下载文件异常', task, error);
            }));
        }
        await Promise.all(down_tasks);
    }
    indicator.complete();
    return true;
}

/**
 * 通过浏览器下载文件
 * @param {BrowserTask} tasks 浏览器下载任务
 */
API.Common.downloadsByBrowser = async (tasks) => {
    // 进度器
    let indicator = new StatusIndicator('Common_Browser');
    indicator.setTotal(tasks.length);

    // 超时秒数
    const timeout = QZone_Config.Common.autoFileSuffixTimeOut * 1000;

    // 开始下载
    const _tasks = _.chunk(tasks, QZone_Config.Common.downloadThread);
    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];
            // 添加任务到下载器的时候，可能存在一直无返回的情况，问题暂未定位，先临时添加超时秒数逻辑
            await API.Utils.timeoutPromise(API.Utils.downloadByBrowser(task), timeout || 15).then((downloadTask) => {
                if (downloadTask.id > 0) {
                    task.setState('complete');
                    indicator.addSuccess(task);
                } else {
                    console.error('添加到浏览器下载异常', task);
                    task.setState('interrupted');
                    indicator.addFailed(task);
                }
            }).catch((error) => {
                console.error('添加到浏览器下载异常', error, task);
                task.setState('interrupted');
                indicator.addFailed(task);
            })
        }
        // 等待1秒再继续添加
        await API.Utils.sleep(1000);
    }
    indicator.complete();
    return true;
}

/**
 * 通过Aria2下载文件
 * @param {Array} tasks
 */
API.Common.downloadByAria2 = async (tasks) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Aria2');
    indicator.setTotal(tasks.length);

    // 添加任务
    for (const task of tasks) {
        await API.Utils.downloadByAria2(task).then((result) => {
            if (result.error) {
                console.error('添加到Aria2异常', result, task);
                task.setState('interrupted');
                indicator.addFailed(task);
            } else {
                task.setState('complete');
                // 添加成功
                indicator.addSuccess(task);
            }
        }).catch((error) => {
            console.error('添加到Aria2异常', error, task);
            task.setState('interrupted');
            indicator.addFailed(task);
        })
    }

    // 完成
    indicator.complete();

    return true;
}

/**
 * 通过迅雷下载
 * @param {ThunderInfo} thunderInfo 迅雷下载信息
 */
API.Common.invokeThunder = async (thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder');
    indicator.setTotal(thunderInfo.tasks.length);

    // 处理迅雷下载信息
    const _thunderInfo = API.Common.handerThunderInfo(thunderInfo);

    // 通过迅雷任务数将任务分组，任务太大时无法唤起迅雷
    const tasks = _thunderInfo.tasks || [];
    const _tasks = _.chunk(tasks, QZone_Config.Common.thunderTaskNum);
    for (let i = 0; i < _tasks.length; i++) {
        const index = i + 1;
        indicator.setIndex(index);

        const list = _tasks[i];
        let taskGroupName = _thunderInfo.taskGroupName;
        if (_tasks.length > 1) {
            taskGroupName = taskGroupName + "_" + index;
        }

        // 唤起迅雷下载
        const groupTask = new ThunderInfo(taskGroupName, QZone_Config.Common.downloadThread, list)
        API.Utils.downloadByThunder(groupTask);

        // 添加唤起数
        indicator.addSuccess(list);

        // 继续唤起
        if (index < _tasks.length) {
            let sleep = QZone_Config.Common.thunderTaskSleep * 1;
            let interId = setInterval(function () {
                indicator.setNextTip(--sleep);
            }, 1000)
            // 等待指定秒再继续唤起，并给用户提示
            await API.Utils.sleep(sleep * 1000);
            clearInterval(interId);
        }
    }
    indicator.complete();
}

/**
 * 写入迅雷任务到文件
 * @param {ThunderInfo} thunderInfo 迅雷下载信息
 */
API.Common.writeThunderTaskToFile = async (thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder_Link');
    indicator.print();

    // 处理迅雷下载信息
    const _thunderInfo = API.Common.handerThunderInfo(thunderInfo);

    // 分批
    const tasks = _thunderInfo.tasks || [];
    const _tasks = _.chunk(tasks, QZone_Config.Common.thunderTaskNum);
    for (let i = 0; i < _tasks.length; i++) {
        const index = i + 1;
        indicator.setIndex(index);

        const list = _tasks[i];
        let taskGroupName = _thunderInfo.taskGroupName;
        if (_tasks.length > 1) {
            taskGroupName = taskGroupName + "_" + index;
        }

        // 唤起迅雷下载
        const groupTask = new ThunderInfo(taskGroupName, QZone_Config.Common.downloadThread, list)

        // 写入文件
        const json = 'thunderx://' + JSON.stringify(groupTask);
        await API.Utils.writeText(json, FOLDER_ROOT + taskGroupName + '_迅雷下载链接.txt').then((fileEntry) => {
            console.info("导出迅雷下载链接完成", fileEntry);
        }).catch((error) => {
            console.error("导出迅雷下载链接异常", error);
        })

    }

    // 完成
    indicator.complete();
}

/**
 * 处理迅雷下载信息
 * @param {ThunderInfo} thunderInfo 迅雷下载信息
 */
API.Common.handerThunderInfo = (thunderInfo) => {
    // 简单克隆
    const _thunderInfo = JSON.parse(JSON.stringify(thunderInfo));

    // 移除多余属性
    const _tasks = _thunderInfo.tasks;
    for (const _temp of _tasks) {
        delete _temp.downloadState;
        delete _temp.source;
    }

    return _thunderInfo;
}

/**
 * 设置模块备份信息
 * @param {object} moduleConfig 模块配置
 */
API.Common.setBackupInfo = (moduleConfig) => {
    if (!moduleConfig || !moduleConfig.PreBackup) {
        return;
    }
    moduleConfig.PreBackup.uin = QZone.Common.Target.uin;
    moduleConfig.PreBackup.downloadType = QZone_Config.Common.downloadType;
    moduleConfig.PreBackup.time = new Date().format('yyyy-MM-dd hh:mm:ss');
    // 同步更新配置项
    if (moduleConfig.IncrementType === 'LastTime') {
        // 增量类型为上次备份的才同步更新
        moduleConfig.IncrementTime = moduleConfig.PreBackup.time;
    }
}

/**
 * 是否全量备份
 * @param {Object} moduleConfig 模块配置
 */
API.Common.isFullBackup = (moduleConfig) => {
    const pre_backup = moduleConfig.PreBackup;
    if (!pre_backup || moduleConfig.IncrementType === 'Full') {
        // 不需要增量备份
        return true;
    }
    if (QZone.Common.Target.uin !== pre_backup.uin && moduleConfig.IncrementType !== 'Custom') {
        // 当前备份QQ与上次备份QQ不一致，且增量类型不为自定义
        return true;
    }
    // if (API.Common.isQzoneUrl()) {
    //     // QQ空间外链
    //     return true;
    // }
    // if (QZone_Config.Common.exportType !== pre_backup.exportType) {
    //     // 当前模块数据备份类型与上次备份类型不一致
    //     return true;
    // }
    if (QZone_Config.Common.downloadType !== pre_backup.downloadType) {
        // 当前备份文件下载方式与上次备份文件下载方式不一致
        return true;
    }
    return false;
}

/**
 * 数据是否包含上次备份的位置
 * @param {Array} new_items 新数据
 * @param {Object} moduleConfig 模块配置
 */
API.Common.isPreBackupPos = (new_items, moduleConfig) => {
    if (API.Common.isFullBackup(moduleConfig)) {
        return false;
    }
    const preBackup = moduleConfig.PreBackup;
    // 增量备份时间
    const incrementTime = new Date(moduleConfig.IncrementTime).getTime();
    if (new_items.length == 0) {
        return false;
    }
    // 新获取到的第一条数据
    let firstItem = new_items[0];
    let firstTime = firstItem[preBackup.field];
    firstTime = typeof firstTime === 'string' ? new Date(firstTime).getTime() : firstTime * 1000;
    // 新获取到的最后一条数据
    let lastItem = new_items[new_items.length - 1];
    let lastTime = lastItem[preBackup.field];
    lastTime = typeof lastTime === 'string' ? new Date(lastTime).getTime() : lastTime * 1000;
    // 情况一、第一条是符合增量时间的
    // 情况二、最后一条是符合增量时间的
    // 情况三、不是第一也不是最后
    return firstTime <= incrementTime || incrementTime >= lastTime || (firstTime <= incrementTime && incrementTime >= lastTime);
}

/**
 * 是否是新备份数据
 * @param {object} item 对象
 */
API.Common.isNewItem = (item) => {
    if (item.isNewItem === undefined) {
        return true;
    }
    return item.isNewItem;
}

/**
 * 移除已备份数据中不符合条件的数据
 * @param {Array} old_items 列表
 * @param {Object} moduleConfig 模块配置
 */
API.Common.removeOldItems = (old_items, moduleConfig) => {
    if (API.Common.isFullBackup(moduleConfig) || old_items === undefined) {
        // 选择全量备份时，直接返回空数组，当初没有历史数据处理
        return [];
    }
    const preBackup = moduleConfig.PreBackup;
    // 增量备份时间
    const incrementTime = new Date(moduleConfig.IncrementTime).getTime();
    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = old_items.length - 1; i >= 0; i--) {
        const item = old_items[i];
        let time = item[preBackup.field] * 1000;
        if (time > incrementTime) {
            // 如果集合中的元素存在大于增量备份时间的，则移除
            old_items.splice(i, 1);
            continue;
        }
        // 旧数据标识
        item.isNewItem = false;
    }
    return old_items;
}

/**
 * 移除新数据中不符合条件的数据
 * @param {Array} new_items 列表
 * @param {Object} moduleConfig 模块配置
 */
API.Common.removeNewItems = (new_items, moduleConfig) => {
    if (API.Common.isFullBackup(moduleConfig)) {
        return new_items;
    }
    const preBackup = moduleConfig.PreBackup;
    // 增量备份时间
    const incrementTime = new Date(moduleConfig.IncrementTime).getTime();
    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = new_items.length - 1; i >= 0; i--) {
        const item = new_items[i];
        let time = item[preBackup.field] * 1000;
        if (time < incrementTime) {
            // 如果集合中的元素存在小于增量备份时间的，则移除
            new_items.splice(i, 1);
            continue;
        }
        // 新数据标识
        item.isNewItem = true;
    }
    return new_items;
}

/**
 * 合并已备份数据
 * @param {object} moduleConfig 模块配置
 * @param {Array} old_items 已备份数据
 * @param {Array} new_items 新数据
 */
API.Common.unionBackedUpItems = (moduleConfig, old_items, new_items) => {
    // 移除已备份数据中不符合条件的数据
    old_items = API.Common.removeOldItems(old_items, moduleConfig);

    // 移除新数据中不符合条件的数据
    new_items = API.Common.removeNewItems(new_items, moduleConfig);

    // 合并新老数据
    return API.Utils.unionItems(new_items, old_items);
}

/**
 * 保存当前备份数据
 */
API.Common.saveBackupItems = () => {
    return new Promise(function (resolve, reject) {
        const key = QZone.Common.Target.uin + "_" + QZone_Config.Common.downloadType;
        const backups = {};
        // 只存储需要的数据
        backups[key] = {
            Messages: {
                Data: API.Common.isExport('Messages') ? QZone.Messages.Data : QZone.Messages.OLD_Data
            },
            Blogs: {
                Data: API.Common.isExport('Blogs') ? QZone.Blogs.Data : QZone.Blogs.OLD_Data
            },
            Diaries: {
                Data: API.Common.isExport('Diaries') ? QZone.Diaries.Data : QZone.Diaries.OLD_Data
            },
            Photos: {
                Album: {
                    Data: API.Common.isExport('Photos') ? QZone.Photos.Album.Data : QZone.Photos.Album.OLD_Data
                }
            },
            Videos: {
                Data: API.Common.isExport('Videos') ? QZone.Videos.Data : QZone.Videos.OLD_Data
            },
            Boards: {
                Data: API.Common.isExport('Boards') ? QZone.Boards.Data : QZone.Boards.OLD_Data
            },
            Friends: {
                Data: API.Common.isExport('Friends') ? QZone.Friends.Data : QZone.Friends.OLD_Data
            },
            Favorites: {
                Data: API.Common.isExport('Favorites') ? QZone.Favorites.Data : QZone.Favorites.OLD_Data
            },
            Shares: {
                Data: API.Common.isExport('Shares') ? QZone.Shares.Data : QZone.Shares.OLD_Data
            },
            Visitors: {
                Data: API.Common.isExport('Visitors') ? QZone.Visitors.Data : QZone.Visitors.OLD_Data
            }
        };

        // 保存数据Storage TODO 保存大小是否受限？
        chrome.storage.local.set(backups, function () {
            console.info("保存当前备份数据到Storage完成", backups);
            resolve(backups);
        });

    })
}

/**
 * 获取上次备份数据
 */
API.Common.getBackupItems = () => {
    return new Promise(function (resolve, reject) {
        const key = QZone.Common.Target.uin + "_" + QZone_Config.Common.downloadType;

        // 保存数据Storage TODO 保存大小是否受限？
        chrome.storage.local.get([key], function (data) {
            console.info("基于Storage获取上次备份数据完成", data[key]);
            resolve(data[key]);
        });

    })
}

/**
 * 重置QQ空间备份数据
 */
API.Common.resetQzoneItems = () => {
    // 重置说说模块数据
    QZone.Messages.total = 0;
    QZone.Messages.Data = [];
    QZone.Messages.OLD_Data = [];

    // 重置日志模块数据
    QZone.Blogs.total = 0;
    QZone.Blogs.Data = [];
    QZone.Blogs.OLD_Data = [];

    // 重置日记模块数据
    QZone.Diaries.total = 0;
    QZone.Diaries.Data = [];
    QZone.Diaries.OLD_Data = [];

    // 重置相册模块数据
    QZone.Photos.Album.total = 0;
    QZone.Photos.Album.Data = [];
    QZone.Photos.Album.OLD_Data = [];

    // 重置视频模块数据
    QZone.Videos.total = 0;
    QZone.Videos.Data = [];
    QZone.Videos.OLD_Data = [];

    // 重置留言模块数据
    QZone.Boards.Data = {
        items: [],
        authorInfo: {
            message: '',
            sign: ''
        },
        total: 0
    };
    QZone.Boards.OLD_Data = {
        items: [],
        authorInfo: {
            message: '',
            sign: ''
        },
        total: 0
    };

    // 重置好友模块数据
    QZone.Friends.total = 0;
    QZone.Friends.Data = [];
    QZone.Friends.OLD_Data = [];

    // 重置收藏模块数据
    QZone.Favorites.total = 0;
    QZone.Favorites.Data = [];
    QZone.Favorites.OLD_Data = [];

    // 重置访客模块数据
    QZone.Visitors.Data = {
        items: [],
        total: 0,
        totalPage: 0
    }
    QZone.Visitors.OLD_Data = {
        items: [],
        total: 0,
        totalPage: 0
    }
}

/**
 * 初始化已备份数据到全局变量
 */
API.Common.initBackedUpItems = async () => {
    // 获取已备份数据
    const Old_QZone = await API.Common.getBackupItems();
    if (!Old_QZone || Object.keys(Old_QZone).length == 0) {
        // 没有上次备份数据
        return;
    }
    // 覆盖更新说说模块全局变量
    QZone.Messages.OLD_Data = Old_QZone.Messages ? Old_QZone.Messages.Data : [];
    // 覆盖更新日志模块全局变量
    QZone.Blogs.OLD_Data = Old_QZone.Blogs ? Old_QZone.Blogs.Data : [];
    // 覆盖更新私密日记模块全局变量
    QZone.Diaries.OLD_Data = Old_QZone.Diaries ? Old_QZone.Diaries.Data : [];
    // 覆盖更新相册模块全局变量
    QZone.Photos.Album.OLD_Data = Old_QZone.Photos && Old_QZone.Photos.Album ? Old_QZone.Photos.Album.Data : [];
    // 覆盖更新视频模块全局变量
    QZone.Videos.OLD_Data = Old_QZone.Videos ? Old_QZone.Videos.Data : [];
    // 覆盖更新留言板模块全局变量
    QZone.Boards.OLD_Data = Old_QZone.Boards ? Old_QZone.Boards.Data : {
        items: [],
        authorInfo: {
            message: '',
            sign: ''
        },
        total: 0
    };
    // 覆盖更新好友模块全局变量
    QZone.Friends.OLD_Data = Old_QZone.Friends ? Old_QZone.Friends.Data : [];
    // 覆盖更新收藏夹模块全局变量
    QZone.Favorites.OLD_Data = Old_QZone.Favorites ? Old_QZone.Favorites.Data : [];
    // 覆盖更新分享模块全局变量
    QZone.Shares.OLD_Data = Old_QZone.Shares ? Old_QZone.Shares.Data : [];
    // 覆盖更新分享模块全局变量
    QZone.Visitors.OLD_Data = Old_QZone.Visitors ? Old_QZone.Visitors.Data : {
        items: [],
        total: 0,
        totalPage: 0
    };
}

/**
 * 是否存在下一页
 * @param {integer} pageIndex 当前页索引
 * @param {integer} pageSize 每页条目数
 * @param {integer} total 总数
 * @param {Array} items 已获取数据数组
 */
API.Common.hasNextPage = (pageIndex, pageSize, total, items) => {
    return items.length < total && pageIndex * pageSize < total;
}

/**
 * 获取下一页数据
 * @param {integer} pageIndex 当前页索引
 * @param {object} moduleConfig 模块配置
 * @param {integer} total 总数
 * @param {Array} items 已获取数据
 * @param {Function} call 下一页函数
 * @param {Array} args 下一页函数参数
 */
API.Common.callNextPage = async (pageIndex, moduleConfig, total, items, call, ...args) => {
    // 是否存在下一页
    const hasNextPage = API.Common.hasNextPage(pageIndex, moduleConfig.pageSize, total, items);
    if (hasNextPage) {
        // 请求一页成功后等待一秒再请求下一页
        const min = moduleConfig.randomSeconds.min;
        const max = moduleConfig.randomSeconds.max;
        const seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
        return await call.apply(undefined, args);
    }
    return items;
}

/**
 * 指定模块是否勾选导出
 * @param {string} moduleType 导出模块类型值
 */
API.Common.isExport = (moduleType) => {
    return QZone.Common.ExportType[moduleType];
}

/**
 * 设置比较差异的字段值
 * @param {Array} items 列表
 * @param {string} sourceFiled 源字段
 * @param {string} targetFiled 目标字段
 */
API.Common.setCompareFiledInfo = (items, sourceFiled, targetFiled) => {
    // 处理发布时间，兼容增量备份
    for (const item of items) {
        item[targetFiled] = Math.floor(new Date(item[sourceFiled]).getTime() / 1000);
    }
    return items;
}

/**
 * 是否需要获取赞
 * @param {Object} CONFIG 模块配置项
 */
API.Common.isGetLike = (CONFIG) => {
    return CONFIG.Like.isGet && (CONFIG.exportType === 'HTML' || CONFIG.exportType == 'JSON')
}

/**
 * 是否需要获取最近访问
 * @param {Object} CONFIG 模块配置项
 */
API.Common.isGetVisitor = (CONFIG) => {
    return CONFIG.Visitor.isGet && (CONFIG.exportType === 'HTML' || CONFIG.exportType == 'JSON')
}

/**
 * 获取模块点赞记录
 * @param {Object} item 对象
 */
API.Common.getModulesLikeList = async (item, moduleConfig) => {
    let nextUin = 0;
    item.likes = item.likes || [];
    if (!moduleConfig.Like.isGet) {
        return item.likes;
    }
    let hasNext = true;
    while (hasNext) {
        await API.Common.getLikeList(item.uniKey, nextUin).then(async (data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            data = data.data || {};
            data.like_uin_info = data.like_uin_info || [];
            if (_.isEmpty(data.like_uin_info)) {
                hasNext = false;
            } else {
                item.likes = _.concat(item.likes, data.like_uin_info);
                nextUin = _.last(item.likes)['fuin'];

                // 请求一页成功后等待一秒再请求下一页
                const min = moduleConfig.Like.randomSeconds.min;
                const max = moduleConfig.Like.randomSeconds.max;
                const seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
            }
        }).catch((e) => {
            hasNext = false;
            console.error("获取点赞数据异常", item, e);
        });
    }
    item.likeTotal = item.likes.length;
    return item.likes;
}

/**
 * 添加QQ空间用户的头像下载
 * @param {Object} user 用户
 */
API.Common.downloadUserAvatar = (user) => {
    if (API.Common.isQzoneUrl() || !user || !user.uin) {
        // 如果为QQ空间外链，则不下载
        return;
    }
    const avatarUrl = API.Common.getUserLogoUrl(user.uin);
    if (QZone.Common.FILE_URLS.has(avatarUrl)) {
        // 添加过下载任务则跳过
        user.avatar = API.Common.getUserLogoUrl(user.uin);
        user.custom_avatar = API.Common.getUserLogoLocalUrl(user.uin);
        return;
    }

    API.Utils.newDownloadTask(avatarUrl, 'Common/images', user.uin + '', user);
    user.avatar = API.Common.getUserLogoUrl(user.uin);
    user.custom_avatar = API.Common.getUserLogoLocalUrl(user.uin);

    // 添加映射
    QZone.Common.FILE_URLS.set(avatarUrl, user.custom_avatar);
}

/**
 * 添加QQ空间用户的头像下载
 * @param {Array} users 用户列表
 */
API.Common.downloadUserAvatars = (users) => {
    if (API.Common.isQzoneUrl() || !users) {
        // 如果为QQ空间外链，则不下载
        return;
    }
    for (const user of users) {
        API.Common.downloadUserAvatar(user);
    }
}