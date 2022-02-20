/**
 * 用户个人档模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 初始化用户信息
 */
API.Common.initUserInfo = async() => {

    if (API.Common.isOnlyFileExport()) {
        // 仅文件导出，无需初始化
        console.log('仅文件导出，无需初始化用户信息');
        return;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Init_User_Info_Export');
    indicator.print();

    try {

        // 获取所有的QQ好友
        await API.Common.getUserInfos().then((userInfo) => {
            userInfo = API.Utils.toJson(userInfo, /^_Callback\(/);
            console.info("获取用户信息完成", userInfo);

            if (userInfo.code < 0) {
                // 获取异常
                console.warn('初始化用户信息异常：', userInfo);
            }
            userInfo = userInfo.data || {};

            // 用户信息
            userInfo = userInfo && Object.assign(QZone.Common.Target, userInfo);

            // 添加目标头像下载任务
            API.Common.downloadUserAvatars([QZone.Common.Target, QZone.Common.Owner, userInfo]);

            // 更换用户图片
            userInfo.avatar = API.Common.getUserLogoUrl(userInfo.uin);

        }).catch((error) => {
            console.error("获取用户信息异常", error);
        });
    } catch (error) {
        console.error('初始化用户信息异常', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 其它的导出
 */
API.Common.exportOthers = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Common_Row_Infos');
    indicator.print();

    try {

        // 初始化用户信息
        await API.Common.initUserInfo();

        // 导出用户信息
        await API.Common.exportUser();

        // 下载助手配置信息
        await API.Common.exportConfigToJson();

        // 保存备份数据
        const backupInfos = await API.Common.saveBackupItems();

        // 导出备份数据到JSON
        await API.Common.exportBackupItemsToJson(backupInfos);

        // 下载文件
        await API.Utils.downloadAllFiles();

    } catch (error) {
        console.error('导出其它信息失败', error);
    }

    // 完成
    indicator.complete();

}

/**
 * 导出用户个人档信息
 */
API.Common.exportUser = async() => {

    if (API.Common.isOnlyFileExport()) {
        // 仅文件导出，无需生成首页文件
        console.log('仅文件导出，无需生成首页文件');
        return;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Init_User_Info_Export_Other');
    indicator.print();

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

    // 完成
    indicator.complete();
}

/**
 * 导出个人信息到JSON文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToJson = async(jsonObj) => {
    const path = API.Common.getModuleRoot('Common') + '/json';

    // 创建JSON文件夹
    await API.Utils.createFolder(path);

    // 写入JOSN
    await API.Utils.writeText(JSON.stringify(jsonObj), path + '/User.json').then((fileEntry) => {
        console.info("导出用户个人档信息完成", fileEntry);
    }).catch((error) => {
        console.error("导出用户个人档信息异常", error);
    });
}

/**
 * 导出个人信息到MarkDown文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToMd = async(userInfo) => {
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

    await API.Utils.writeText(contents.join('\r\n'), API.Common.getRootFolder() + "/index.md").then((fileEntry) => {
        console.info("导出空间预览到Markdown文件完成", fileEntry, userInfo);
    }).catch((error) => {
        console.error("导出空间预览到Markdown文件异常", error, userInfo);
    });
}

/**
 * 导出个人信息到HTML文件
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToHtml = async(userInfo) => {
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
        let paths = (API.Common.getRootFolder() + '/' + pathInfo.target).split('/');
        let filename = paths.pop();
        await API.Utils.createFolder(paths.join('/'));
        await API.Utils.downloadToFile(chrome.extension.getURL(pathInfo.original), paths.join('/') + '/' + filename);
    }

    console.info('生成首页HTML文件开始', userInfo);
    // 基于模板生成HTML
    let fileEntry = await API.Common.writeHtmlofTpl('index', { user: userInfo }, API.Common.getRootFolder() + "/index.html");
    console.info('生成首页HTML文件结束', fileEntry, userInfo);
}

/**
 * 基于模板生成HTML文件
 * @param {string} name 模板文件名
 * @param {object} params 参数
 * @param {object} params 参数
 */
API.Common.writeHtmlofTpl = async(name, params, indexHtmlePath) => {
    let html = await API.Common.getHtmlTemplate(name, params);
    let fileEntry = await API.Utils.writeText(html, indexHtmlePath);
    return fileEntry;
}

/**
 * 渲染HTML模板
 * @param {string} name 模板文件名
 * @param {object} params 参数
 */
API.Common.getHtmlTemplate = async(name, params) => {
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
API.Common.writeJsonToJs = async(key, object, path) => {
    const json = JSON.stringify(object);
    const js = 'window.' + key + ' = ' + json;
    return await API.Utils.writeText(js, path);
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
        // content = API.Common.handerContentImages("Others",content, type);
    } catch (error) {
        console.error('处理内容图片信息异常', error, item, type, isRt, isSupportedHtml);
    }
    // 默认调用原先的内容转换
    return content;
}

/**
 * 处理内容中的图片
 * @param {string} module 模块
 * @param {string} content 内容
 * @param {string} type 类型
 */
API.Common.handerContentImages = (module, content, type) => {
    if (API.Common.isQzoneUrl() || !content) {
        // QQ空间外链不处理
        return content;
    }
    // 获取内容中的图片信息（如果说说本身的内容也是HTML/MD代码，也同样处理）
    if ("MD" === type) {
        content.replace(/!\[.*?\]\((.+?)\)/g, function(linkmd, url) {
            let custom_filename = API.Common.addDownloadTask(module, url, content);
            return linkmd.replace(url, API.Common.getMediaPath(url, 'Common/Images/' + custom_filename, "Messages_HTML"));
        })
        return content;
    }
    // 其他的，目前，只有HTML
    const _html = jQuery("<div>" + content + "</div>");
    const images = _html.find("img") || [];
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        let url = $img.attr('orgsrc') || $img.attr('src') || '';
        let custom_filename = API.Common.addDownloadTask(module, url, content);
        $img.attr('src', API.Common.getMediaPath(url, 'Common/Images/' + custom_filename, "Messages_HTML"));
    }
    return _html.html();
}

/**
 * 添加内容中的图片下载任务
 * @param {string} module 模块
 * @param {string} url 链接
 * @param {string} content 内容
 */
API.Common.addDownloadTask = (module, url, content) => {
    let custom_filename = QZone.Common.FILE_URLS.get(url);
    if (!custom_filename) {
        custom_filename = API.Utils.newSimpleUid(8, 16);
        // 添加下载任务
        API.Utils.newDownloadTask(module, url, 'Common/Images', custom_filename, content);
        QZone.Common.FILE_URLS.set(url, custom_filename);
    }
    return custom_filename;
}

/**
 * 通过Ajax请求下载文件
 * @param {Array} tasks
 */
API.Common.downloadsByAjax = async(tasks) => {

    // 任务分组
    const _tasks = _.chunk(tasks, 10);

    const indicator = new StatusIndicator('Common_File');
    indicator.setTotal(tasks.length);

    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        let down_tasks = [];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];

            // 创建文件夹
            const folderName = API.Common.getRootFolder() + '/' + task.dir;
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
API.Common.downloadsByBrowser = async(tasks) => {
    // 进度器
    let indicator = new StatusIndicator('Common_Browser');
    indicator.setTotal(tasks.length);

    // 开始下载
    const _tasks = _.chunk(tasks, 100);
    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];
            // 添加任务到下载器的时候，可能存在一直无返回的情况，问题暂未定位，先临时添加超时秒数逻辑
            await API.Utils.timeoutPromise(API.Utils.downloadByBrowser(task), 15 * 1000).then((downloadTask) => {
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
        await API.Utils.sleep(500);
    }
    indicator.complete();
    return true;
}

/**
 * 通过Aria2下载文件
 * @param {Array} tasks
 */
API.Common.downloadByAria2 = async(tasks) => {
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
API.Common.invokeThunder = async(thunderInfo) => {
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
            let interId = setInterval(function() {
                indicator.setNextTip(--sleep);
            }, 1000);

            // 等待指定秒再继续唤起，并给用户提示
            await API.Utils.sleep(sleep * 1000);
            clearInterval(interId);
        }
    }

    // 完成
    indicator.complete();
}

/**
 * 复制迅雷下载链接到剪切板
 * @param {ThunderInfo} thunderInfo 迅雷下载信息
 */
API.Common.copyThunderTasksToClipboard = async(thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder_Clipboard');
    indicator.setTotal(thunderInfo.tasks.length);
    indicator.print();

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

        // 下载任务信息
        const copyTaskLinks = 'thunderx://' + JSON.stringify(groupTask);

        // 复制下载链接到剪切板
        navigator.clipboard.writeText(copyTaskLinks).catch((error) => {

            console.error('异步复制失败', error);

            // 创建text area
            let textArea = document.createElement("textarea");
            textArea.value = copyTaskLinks;
            // 使text area不在viewport，同时设置不可见
            textArea.style.position = "absolute";
            textArea.style.opacity = 0;
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return new Promise((res, rej) => {
                // 执行复制命令并移除文本框
                document.execCommand('copy') ? res() : rej();
                textArea.remove();
            });
        });

        // 添加唤起数
        indicator.addSuccess(list);

        // 继续唤起
        if (index < _tasks.length) {
            let sleep = QZone_Config.Common.thunderTaskSleep * 1;
            let interId = setInterval(function() {
                indicator.setNextTip(--sleep);
            }, 1000);

            // 等待指定秒再继续唤起，并给用户提示
            await API.Utils.sleep(sleep * 1000);
            clearInterval(interId);
        }
    }

    // 完成
    indicator.complete();
}

/**
 * 写入迅雷任务到文件
 * @param {ThunderInfo} thunderInfo 迅雷下载信息
 */
API.Common.writeThunderTaskToFile = async(thunderInfo) => {
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
        await API.Utils.writeText(json, API.Common.getRootFolder() + '/' + taskGroupName + '_迅雷下载链接.txt').then((fileEntry) => {
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
        delete _temp.module;
    }

    return _thunderInfo;
}

/**
 * 是否全量备份
 * @param {Object} moduleConfig 模块配置
 */
API.Common.isFullBackup = (moduleConfig) => {
    return moduleConfig.IncrementType === 'Full';
}

/**
 * 数据是否包含上次备份的位置
 * @param {Array} new_items 新数据
 * @param {Object} moduleConfig 模块配置
 */
API.Common.isPreBackupPos = (new_items, moduleConfig) => {
    if (new_items.length == 0) {
        return false;
    }
    if (API.Common.isFullBackup(moduleConfig)) {
        return false;
    }

    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // 新获取到的第一条数据
    const firstTime = API.Utils.parseDate(_.first(new_items)[field]);
    // 新获取到的最后一条数据
    const lastTime = API.Utils.parseDate(_.last(new_items)[field]);

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
        // 选择全量备份时，直接返回空数组，当作没有历史数据处理
        return [];
    }

    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = old_items.length - 1; i >= 0; i--) {
        const item = old_items[i];
        const time = API.Utils.parseDate(item[field]).getTime();
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
    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = new_items.length - 1; i >= 0; i--) {
        const item = new_items[i];
        const time = API.Utils.parseDate(item[field]).getTime();
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
    if (_.isEmpty(old_items)) {
        // 如果已备份数据为空，直接返回新数据
        return new_items;
    }
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

    // 状态更新器
    const indicator = new StatusIndicator('Backup_Save');
    indicator.print();

    return new Promise(function(resolve, reject) {

        // 需要保存的备份数据
        const backupInfos = {
            Backedup: window.Backedup || {}
        };

        // 历史数据
        const rows = backupInfos.Backedup[QZone.Common.Target.uin] || [];
        const oldRowMaps = _.keyBy(rows, 'module');

        // 清空数据
        rows.length = 0;

        for (const moduleName of MODULE_NAME_LIST) {

            // 配置的备份时间，直接刷新为当前时间
            QZone_Config[moduleName].IncrementTime = API.Utils.formatDate(Date.now() / 1000);

            // 历史备份数据是否为空
            const oldItems = API.Common.getOldModuleData(moduleName);

            if (!API.Common.isExport(moduleName) && _.isEmpty(oldItems)) {
                // 如果不导出，且旧数据为空，则不保存该模块
                continue;
            }

            // 是否有新数据导出
            const isNewExport = API.Common.isNewExport(moduleName);

            // 需要保存的模块数据
            const moduleInfo = oldRowMaps[moduleName] || {};
            moduleInfo.module = moduleName;
            moduleInfo.data = API.Common.getSaveModuleData(moduleName);
            moduleInfo.time = isNewExport ? Date.now() : moduleInfo.time || Date.now();
            rows.push(moduleInfo);
        }

        backupInfos.Backedup[QZone.Common.Target.uin] = rows;

        // 保存配置项，主要是上次备份时间
        chrome.storage.sync.set(QZone_Config);

        // 保存数据到Storage
        chrome.storage.local.set(backupInfos, function() {
            console.info("保存当前备份数据到Storage完成");
            indicator.complete();
            resolve(backupInfos);
        });

    })
}

/**
 * 获取模块旧数据
 * @param {String} moduleName 模块名称
 */
API.Common.getOldModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 旧数据
    let oldData = module.OLD_Data || [];

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.OLD_Data || [];
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言板、访客
        oldData = module.OLD_Data.items || [];
    }
    return oldData;
}

/**
 * 获取模块新数据
 * @param {String} moduleName 模块名称
 */
API.Common.getNewModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 旧数据
    let oldData = module.Data || [];

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.Data || [];
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言板、访客
        oldData = module.Data.items || [];
    }
    return oldData;
}

/**
 * 获取模块保存的数据
 * @param {String} moduleName 模块名称
 */
API.Common.getSaveModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 数据
    let data = API.Common.isExport(moduleName) ? module.Data : module.OLD_Data

    if (moduleName === 'Photos') {
        // 相册
        data = API.Common.isExport(moduleName) ? module.Album.Data : module.Album.OLD_Data;
    }
    return data;
}


/**
 * 是否新数据导出
 * @param {String} moduleName 模块名称
 */
API.Common.isNewExport = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];
    const isExportModule = API.Common.isExport(moduleName);

    // 旧数据
    let oldData = module.OLD_Data || [];

    // 保存的列表数据
    let moduleItems = isExportModule ? module.Data : oldData;

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.OLD_Data || [];
        moduleItems = isExportModule ? module.Album.Data : oldData;
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言板、访客
        oldData = module.OLD_Data.items || [];
        moduleItems = isExportModule ? module.Data.items : oldData;
    }
    return _.isEmpty(oldData) || _.some(moduleItems, item => item.isNewItem || _.some(item.photoList || [], item => item.isNewItem));
}

/**
 * 导入备份数据到JSON文件
 * @param {Object} backupInfos 已备份数据
 */
API.Common.exportBackupItemsToJson = async(backupInfos) => {

    // 状态更新器
    const indicator = new StatusIndicator('Backup_Export');
    indicator.print();

    const path = API.Common.getModuleRoot('Common') + '/json';

    // 创建JSON文件夹
    await API.Utils.createFolder(path);

    // 导出的数据
    const exportData = {
        Backedup: {}
    };
    // 仅导出备份QQ
    exportData.Backedup[QZone.Common.Target.uin] = backupInfos.Backedup[QZone.Common.Target.uin];

    // 写入JOSN
    await API.Utils.writeText(JSON.stringify(exportData), path + '/助手备份数据_' + QZone.Common.Target.uin + '.json').then((fileEntry) => {
        console.info("导出助手备份数据完成", fileEntry);
    }).catch((error) => {
        console.error("导出助手备份数据异常", error);
    });

    // 完成
    indicator.complete();
}

/**
 * 是否存在增量备份需求的模块
 */
API.Common.hasIncrementBackup = () => {
    let hasIncrementBackup = false;
    for (const exportType of QZone.Common.ExportTypes) {
        if (!QZone_Config.hasOwnProperty(exportType)) {
            continue;
        }
        const moduleCfg = QZone_Config[exportType];
        const incrCfg = moduleCfg['IncrementType'] || moduleCfg['isIncrement'];
        if (!incrCfg) {
            continue;
        }
        if (incrCfg === true || ['LastTime', 'Custom'].includes(incrCfg)) {
            hasIncrementBackup = true;
            break;
        }
    }
    return hasIncrementBackup;
}

/**
 * 获取上次备份数据
 */
API.Common.getBackupItems = () => {
    return new Promise(function(resolve, reject) {
        chrome.storage.local.get('Backedup', function(data) {
            window.Backedup = data || {};
            resolve(window.Backedup);
        });
    })
}

/**
 * 重置QQ空间备份数据
 */
API.Common.resetQZoneBackupItems = () => {
    // 遍历模块清单
    for (const moduleName of MODULE_NAME_LIST) {
        // 模块数据
        const module = QZone[moduleName] || {};
        switch (moduleName) {
            case 'Photos':
                // 相册
                module.Album.total = 0;
                module.Album.Data = [];
                module.Album.OLD_Data = [];
                break;
            case 'Boards':
                // 留言
                module.Data = {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                module.OLD_Data = {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                break;
            case 'Visitors':
                // 访客
                module.Data = {
                    items: [],
                    total: 0,
                    totalPage: 0
                }
                module.OLD_Data = {
                    items: [],
                    total: 0,
                    totalPage: 0
                }
                break;
            default:
                module.total = 0;
                module.Data = [];
                module.OLD_Data = [];
                break;
        }
    }
}

/**
 * 初始化已备份数据到全局变量
 */
API.Common.initBackedUpItems = async() => {
    if (!API.Common.hasIncrementBackup()) {
        // 本次备份，不存在需要增量备份的模块，无需获取上次备份数据
        return;
    }
    // 进度提示
    const indicator = new StatusIndicator('InitIncrement');
    indicator.print();

    // 获取所有备份QQ的数据
    window.Backedup = await API.Common.getBackupItems() || {};
    window.Backedup = window.Backedup.Backedup || {}
    if (!window.Backedup || Object.keys(window.Backedup).length == 0) {
        // 没有上次备份数据
        indicator.complete();
        return;
    }

    // 指定QQ号数据
    const oldDatas = window.Backedup[QZone.Common.Target.uin] || [];
    if (!oldDatas || oldDatas.length == 0) {
        // 没有上次备份数据
        indicator.complete();
        return;
    }

    for (const moduleName of MODULE_NAME_LIST) {
        // 模块数据
        const module = QZone[moduleName] || {};

        const oldModule = _.find(oldDatas, ['module', moduleName]) || {};

        // 更新模块备份时间
        if (QZone_Config[moduleName].IncrementType === 'LastTime') {
            QZone_Config[moduleName].IncrementTime = oldModule.time ? API.Utils.formatDate(oldModule.time / 1000) : Default_IncrementTime;
        }

        switch (moduleName) {
            case 'Photos':
                // 相册
                module.Album.OLD_Data = oldModule.data || [];
                // 是否新数据标识
                module.Album.OLD_Data.forEach(album => {
                    // 相册标识
                    album.isNewItem = false;

                    // 相片标识
                    album.photoList = album.photoList || [];
                    album.photoList.forEach(photo => {
                        photo.isNewItem = false;
                    });
                });
                break;
            case 'Boards':
                // 留言
                module.OLD_Data = oldModule.data || {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                // 是否新数据标识
                module.OLD_Data.items.forEach(item => {
                    item.isNewItem = false;
                });
                break;
            case 'Visitors':
                // 访客
                module.OLD_Data = oldModule.data || {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                // 是否新数据标识
                module.OLD_Data.items.forEach(item => {
                    item.isNewItem = false;
                });
                break;
            default:
                module.OLD_Data = oldModule.data || [];
                // 是否新数据标识
                module.OLD_Data.forEach(item => {
                    item.isNewItem = false;
                });
                break;
        }
    }
    indicator.complete();
}

/**
 * 是否存在下一页
 * @param {integer} pageIndex 下一页索引
 * @param {integer} pageSize 每页条目数
 * @param {integer} total 总数
 * @param {Array} items 已获取数据数组
 */
API.Common.hasNextPage = (pageIndex, pageSize, total, items) => {
    return items.length < total && pageIndex * pageSize < total;
}

/**
 * 获取下一页数据
 * @param {integer} pageIndex 下一页索引
 * @param {object} moduleConfig 模块配置
 * @param {integer} total 总数
 * @param {Array} items 已获取数据
 * @param {Function} call 下一页函数
 * @param {Array} args 下一页函数参数
 */
API.Common.callNextPage = async(pageIndex, moduleConfig, total, items, call, ...args) => {
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
    return QZone.Common.ExportTypes.indexOf(moduleType) > -1;
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
        if (!item.hasOwnProperty(sourceFiled) || item.hasOwnProperty(targetFiled)) {
            continue;
        }
        item[targetFiled] = Math.floor(API.Utils.parseDate(item[sourceFiled]).getTime() / 1000);
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
API.Common.getModulesLikeList = async(item, moduleConfig) => {
    let nextUin = 0;
    item.likes = item.likes || [];
    if (!moduleConfig.Like.isGet) {
        return item.likes;
    }
    let hasNext = true;
    while (hasNext) {
        await API.Common.getLikeList(item.uniKey, nextUin).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code < 0) {
                // 获取异常
                console.warn('获取模块点赞记录异常：', data);
            }
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

    API.Utils.newDownloadTask('Friends', avatarUrl, 'Common/Images', user.uin + '', user);
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

/**
 * 导出助手到JSON文件
 * @param {Array} friends 好友列表
 */
API.Common.exportConfigToJson = async() => {

    if (API.Common.isOnlyFileExport()) {
        // 仅文件导出，无需导出配置文件
        console.log('仅文件导出，无需导出配置文件');
        return;
    }

    // 状态更新器
    const indicator = new StatusIndicator('User_Config_Infos');
    indicator.print();

    const path = API.Common.getModuleRoot('Common') + '/json';

    console.info('生成助手配置JSON开始', QZone_Config);
    // 创建JSON文件夹
    await API.Utils.createFolder(path);
    // 写入JOSN
    const jsonFile = await API.Common.writeJsonToJs('QZone_Config', QZone_Config, API.Common.getModuleRoot('Common') + '/json/config.js');
    console.info('生成助手配置JSON结束', jsonFile, QZone_Config);

    // 完成
    indicator.complete();
}

/**
 * 是否仅导出文件
 */
API.Common.isOnlyFileExport = () => {
    // 相册导出类型为文件、视频导出类型为文件
    const isFile = QZone_Config.Photos.exportType === 'File' && QZone_Config.Videos.exportType === 'File';
    // 且下载工具不为下载链接
    return isFile && QZone_Config.Common.downloadType !== 'Thunder_Link';
}