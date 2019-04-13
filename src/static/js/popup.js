// 绑定备份按钮事件
$('#backup').click(() => {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        let exportType = {};
        var exportTypeDom = $("input[name='exportType']:checked");
        exportTypeDom.each(function () {
            exportType[$(this).val()] = true;
        });
        chrome.tabs.sendMessage(tabs[0].id, { from: 'popup', subject: 'startBackup', exportType: exportType });
    });
});

// 绑定卸载事件
$("#delSelf").click(() => {
    // 卸载自身
    chrome.management.uninstallSelf();
});