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
