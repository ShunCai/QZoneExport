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