chrome.runtime.onInstalled.addListener(function () {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          // 打开QQ空间显示pageAction
          new chrome.declarativeContent.PageStateMatcher({ pageUrl: { urlContains: 'qzone.qq.com' } }),
          // 打开QQ群空间显示pageAction
          new chrome.declarativeContent.PageStateMatcher({ pageUrl: { urlContains: 'qun.qq.com' } })
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()]
      }
    ]);
  });
});
