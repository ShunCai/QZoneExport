// 浏览器下载信息，用于更改文件名
let BrowseDownloads = new Map();
let QZoneDownloadId = 0;

// 默认配置
const Default_Config = {
  // 公共配置
  Common: {
    // 重试次数
    listRetryCount: 2,
    // 重试间隔
    listRetrySleep: 1,
    // 文件下载类型
    downloadType: 'File',
    // 自动识别文件后缀
    isAutoFileSuffix: true,
    // 后缀识别超时秒数
    autoFileSuffixTimeOut: 30,
    // 迅雷任务数        
    thunderTaskNum: 5000,
    // 唤起迅雷间隔        
    thunderTaskSleep: 10,
    // 文件下载并发数        
    downloadThread: 5,
    // 是否启用下载状态栏提醒
    enabledShelf: true
  },
  // 说说模块
  Messages: {
    exportType: "MarkDown",// 内容备份类型
    pageSize: 40,
    randomSeconds: {
      min: 2,
      max: 5
    },
    isFull: false, //是否获取全文
    Comments: {
      isFull: false, //是否全部评论
      pageSize: 20,
      randomSeconds: {
        min: 2,
        max: 5
      }
    }
  },
  // 日志模块
  Blogs: {
    exportType: "MarkDown",// 内容备份类型
    pageSize: 50,
    randomSeconds: {
      min: 2,
      max: 5
    },
    Info: {
      randomSeconds: {
        min: 1,
        max: 2
      }
    },
    Comments: {
      isFull: false, //是否全部评论
      pageSize: 50,
      randomSeconds: {
        min: 2,
        max: 5
      }
    }
  },
  // 私密日记模块
  Diaries: {
    exportType: "MarkDown",// 内容备份类型
    pageSize: 50,
    randomSeconds: {
      min: 2,
      max: 5
    },
    Info: {
      randomSeconds: {
        min: 1,
        max: 2
      }
    }
  },
  // 相册模块
  Photos: {
    exportType: "Folder",
    pageSize: 90,
    randomSeconds: {
      min: 2,
      max: 5
    },
    Images: {
      exportType: "File",
      pageSize: 90,
      exifType: "raw",
      randomSeconds: {
        min: 2,
        max: 5
      },
      Comments: {
        isGet: false, // 是否获取评论，默认不获取
        pageSize: 100,
        randomSeconds: {
          min: 2,
          max: 5
        }
      }
    }
  },
  // 视频模块
  Videos: {
    exportType: "Link",
    randomSeconds: {
      min: 2,
      max: 5
    },
    pageSize: 20
  },
  // 留言板模块
  Boards: {
    exportType: "MarkDown",
    randomSeconds: {
      min: 2,
      max: 5
    },
    pageSize: 20
  },
  // QQ好友模块
  Friends: {
    exportType: "Excel",
    hasAddTime: false
  },
  // 收藏夹模块
  Favorites: {
    exportType: "MarkDown",
    randomSeconds: {
      min: 2,
      max: 5
    },
    pageSize: 30
  },
};

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

// 扩展安装时
chrome.runtime.onInstalled.addListener((details) => {
  console.info('QQ空间导出助手安装中...', details);
  let reason = details.reason;
  let previousVersion = details.previousVersion;
  switch (reason) {
    case 'update':
      switch (previousVersion) {
        case '1.0.2':
          // 上一个版本为1.0.2时，清楚上一个版本的配置项
          chrome.storage.sync.set(Default_Config, function () {
            console.info("重置默认配置成功", Default_Config);
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