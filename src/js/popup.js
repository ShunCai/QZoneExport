// 获取当前选项卡ID
function getCurrentTabId(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (callback) callback(tabs.length ? tabs[0].id : null);
    });
}
// 向content-script主动发送消息
function sendMessageToContentScript(message, callback) {
    getCurrentTabId((tabId) => {
        chrome.tabs.sendMessage(tabId, message, function (response) {
            if (callback) callback(response);
        });
    });
}

// 获取当前登录QQ或备份QQ
sendMessageToContentScript({
    from: 'popup',
    subject: 'initUin'
}, (data) => {
    $("#loginUin").text(data.loginUin);
    $("#targetUin").text(data.targetUin);
    $("#Diaries").attr("checked", data.loginUin == data.targetUin);
    $("#Diaries").attr("disabled", data.loginUin != data.targetUin);
    $("#Friends").attr("checked", data.loginUin == data.targetUin);
    $("#Friends").attr("disabled", data.loginUin != data.targetUin);
});

// 绑定备份按钮事件
$('#backup').click(() => {
    let exportType = {};
    var exportTypeDom = $("input[name='exportType']:checked");
    exportTypeDom.each(function () {
        exportType[$(this).val()] = true;
    });
    let message = {
        from: 'popup',
        subject: 'startBackup',
        exportType: exportType
    };
    sendMessageToContentScript(message, () => {
        console.info("点击开始备份按钮");
    });
});