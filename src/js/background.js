// 浏览器下载信息，用于更改文件名
const BrowseDownloads = new Map();
let QZoneDownloadId = 0;

/**
 * PageAction监听
 */
chrome.runtime.onInstalled.addListener(function () {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        chrome.declarativeContent.onPageChanged.addRules([
            {
                conditions: [
                    // 打开QQ空间显示pageAction
                    new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: {
                            urlMatches: 'https://user.qzone.qq.com/\d*',
                            schemes: ['https']
                        }
                    })
                ],
                actions: [new chrome.declarativeContent.ShowPageAction()]
            }
        ]);
    });
});


let sendMessage = (data, callback) => {
    chrome.runtime.sendMessage(data, function (res) {
        callback(res);
    });
}


/**
 * 浏览器下载(发送消息给背景页下载)
 * @param {object} options
 */
const downloadByBrowser = function (options) {
    return new Promise(function (resolve, reject) {
        chrome.downloads.download(options, function (downloadId) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message, options);
                // 返回失败标识
                resolve(0);
                return;
            }
            if (!downloadId) {
                // 返回失败标识
                resolve(0);
            }
            BrowseDownloads.set(downloadId, options)
            resolve(downloadId);
        });
    });
}

/**
 * 查询下载项
 * @param {string} state
 */
const getDownloadList = function (options) {
    return new Promise(function (resolve, reject) {
        chrome.downloads.search(options, function (data) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message, options);
                // 返回失败标识
                resolve([]);
                return;
            }
            resolve(data);
        })
    });
}

/**
 * 恢复下载
 * @param {string} downloadId
 */
const resumeDownload = function (downloadId) {
    return new Promise(function (resolve, reject) {
        chrome.downloads.resume(downloadId, function () {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message, downloadId);
                // 返回失败标识
                resolve(0);
                return;
            }
            resolve(downloadId);
        })
    });
}

/**
 * 消息监听器，监听来自其他页面的消息
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.info("Background 接收到消息！", request, sender);
    switch (request.from) {
        case 'content':
            // 消息来源，内容脚本
            switch (request.type) {
                case 'reset':
                    // 重置数据
                    BrowseDownloads.clear();
                    break;
                case 'download_browser':
                    // 浏览器下载
                    downloadByBrowser(request.options).then((downloadId) => {
                        sendResponse(downloadId);
                    });
                    break;
                case 'download_list':
                    // 获取下载列表
                    getDownloadList(request.options).then((data) => {
                        sendResponse(data);
                    });
                    break;
                case 'download_info':
                    // 获取下载信息
                    getDownloadList(request.options).then((data) => {
                        sendResponse(data && data.length > 0 ? data[0] : undefined);
                    });
                    break;
                case 'download_resume':
                    // 恢复下载
                    resumeDownload(request.downloadId).then((data) => {
                        sendResponse(data);
                    });
                    break;
                case 'show_export_zip':
                    // 打开下载的ZIP文件
                    chrome.downloads.show(QZoneDownloadId);
                    break;
                default:
                    console.warn('Background 接收到消息，但未识别类型！', request);
                    break;
            }
            break;
        default:
            console.warn('Background 接收到消息，但未识别来源！', request);
            break;
    }
    return true;
});


/**
 * 下载管理器重命名监听器
 */
chrome.downloads.onDeterminingFilename.addListener(function (item, __suggest) {
    function suggest(filename) {
        __suggest({
            filename: filename
        });
    }
    let filename = item.filename;
    let downloadInfo = BrowseDownloads.get(item.id);
    if (downloadInfo) {
        filename = downloadInfo['filename'];
    }
    if (filename.startsWith('QQ空间备份') && filename.endsWith('.zip')) {
        // 备份文件
        QZoneDownloadId = item.id;
    }
    suggest(filename);
});

// 扩展安装时
chrome.runtime.onInstalled.addListener((details) => {
    console.info('QQ空间导出助手安装中...', details);
    let reason = details.reason;
    let previousVersion = details.previousVersion;
    switch (reason) {
        case 'update':
            switch (previousVersion) {
                case '1.0.0':
                    // 上一个版本为1.0.0时，重置配置项
                    chrome.storage.sync.clear(function () {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.0.1':
                    // 上一个版本为1.0.1时，重置配置项
                    chrome.storage.sync.clear(function () {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.0.2':
                    // 上一个版本为1.0.2时，重置配置项
                    chrome.storage.sync.clear(function () {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.0.5':
                    // 上一个版本为1.0.5时，重置配置项
                    chrome.storage.sync.clear(function () {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.1.1':
                    // 上一个版本为1.1.1时，重置备份数据
                    chrome.storage.local.clear(function () {
                        console.info('重置备份数据完成');
                    });
                    break;
                default:
                    break;
            }
            break;

        default:
            break;
    }
})