// 浏览器下载信息，用于更改文件名
let BrowseDownloads = new Map();
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
              urlMatches: 'http://user.qzone.qq.com/\d*'
            }
          }),
          // 打开QQ空间显示pageAction
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              urlMatches: 'https://user.qzone.qq.com/\d*'
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
    console.debug('Background sendMessage', res)
    callback(res);
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
          downloadByBrowser(request.options, function (id) {
            sendResponse(id);
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
});


/**
 * 下载管理器重命名监听器
 */
chrome.downloads.onDeterminingFilename.addListener(function (item, suggest) {
  console.debug("添加到下载管理器前：", item);
  let filename = item.filename;
  let downloadInfo = BrowseDownloads.get(item.id);
  if (downloadInfo) {
    filename = downloadInfo['filename'];
  }
  if (filename.startsWith('QQ空间备份') && filename.endsWith('.zip')) {
    // 备份文件
    QZoneDownloadId = item.id;
  }
  suggest({
    filename: filename
  });
  console.debug("添加到下载管理器后：", item);
});

/**
 * 浏览器下载(发送消息给背景页下载)
 * @param {object} options
 */
const downloadByBrowser = function (options, callback) {
  chrome.downloads.download(options, function (downloadId) {
    BrowseDownloads.set(downloadId, options)
    console.debug('添加到管理器完成，下载ID', downloadId);
    callback(downloadId)
  });
}