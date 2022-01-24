// 浏览器下载信息，用于更改文件名
const BrowseDownloads = new Map();
let QZoneDownloadId = 0;

/**
 * PageAction监听
 */
chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
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
        }]);
    });
});


let sendMessage = (data, callback) => {
    chrome.runtime.sendMessage(data, function(res) {
        callback(res);
    });
}


/**
 * 浏览器下载(发送消息给背景页下载)
 * @param {object} options
 */
const downloadByBrowser = function(options) {
    return new Promise(function(resolve, reject) {
        chrome.downloads.download(options, function(downloadId) {
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
const getDownloadList = function(options) {
    return new Promise(function(resolve, reject) {
        chrome.downloads.search(options, function(data) {
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
const resumeDownload = function(downloadId) {
    return new Promise(function(resolve, reject) {
        chrome.downloads.resume(downloadId, function() {
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
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
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
                case 'skipLink':
                    chrome.tabs.create({
                        url: request.url
                    });
                    break;
                case 'getMimeType':
                    getMimeType(request.url, request.timeout).then((data) => {
                        sendResponse(data);
                    }).catch((e) => {
                        console.error('文件识别异常，将默认不使用文件后缀！', e);
                        sendResponse('');
                    });
                    break;
                case 'getMapJson':
                    getMapJson(request.url).then((data) => {
                        sendResponse(data);
                    }).catch((e) => {
                        sendResponse(e);
                    });
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
chrome.downloads.onDeterminingFilename.addListener(function(item, __suggest) {
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

    // 打开更新日志
    chrome.tabs.create({
        url: 'https://github.com/ShunCai/QZoneExport/releases/latest'
    });

    switch (reason) {
        // 安装
        case chrome.runtime.OnInstalledReason.INSTALL:
            // 打开官网说明文档
            chrome.tabs.create({
                url: 'https://lvshuncai.com/qzone-export.html'
            });
            break;
            // 更新
        case chrome.runtime.OnInstalledReason.UPDATE:
            switch (previousVersion) {
                case '1.0.0':
                case '1.0.1':
                case '1.0.2':
                case '1.0.5':
                    // 重置配置项
                    chrome.storage.sync.clear(function() {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.1.1':
                    // 重置备份数据
                    chrome.storage.local.clear(function() {
                        console.info('重置备份数据完成');
                    });
                    break;
                case '1.1.4':
                    // 打开官网说明文档
                    chrome.tabs.create({
                        url: 'https://lvshuncai.com/qzone-export.html'
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

/**
 * 获取文件类型
 * @param {string} url 文件地址
 * @param {number} timeout 超时秒数
 * @returns 
 */
const getMimeType = function(url, timeout) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        // 超时设置
        xhr.timeout = timeout * 1000;
        xhr.onreadystatechange = function() {
            if (2 == xhr.readyState) {
                const contentType = xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type') || '';
                let suffix = '';
                if (contentType.indexOf('/') > -1) {
                    suffix = contentType.split('/')[1];
                }
                this.abort();
                resolve(suffix);
            }
        }
        xhr.onerror = function(e) {
            reject(e);
        }
        xhr.ontimeout = function(e) {
            this.abort();
            reject(e);
        }
        xhr.send();
    });
}

/**
 * 获取GeoJson
 * @param {string} url 文件地址
 * @returns 
 */
const getMapJson = function(url) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function() {
            var data = {};
            try {
                data = JSON.parse(this.responseText);
            } catch (error) {

            }
            resolve(data);
        }
        xhr.onerror = function(e) {
            reject(e);
        }
        xhr.ontimeout = function(e) {
            this.abort();
            reject(e);
        }
        xhr.send();
    });
}