(function () {

    // 获取当前选项卡ID
    function getCurrentTabId(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (callback) callback(tabs.length ? tabs[0].id : null);
        });
    }

    // 向content-script主动发送消息
    function sendMessage(message, callback) {
        getCurrentTabId((tabId) => {
            var port = chrome.tabs.connect(tabId, {
                name: 'popup'
            });
            port.postMessage(message);
            port.onMessage.addListener(function (response) {
                if (callback) callback(response);
            });
        });
    }

    // 私密日志是否加密，加密提示用户先人工输入密码
    // 请求私密日志列表
    const checkDiaries = () => {
        sendMessage({
            from: 'popup',
            subject: 'initDiaries'
        }, (data) => {
            console.info('私密日志独立密码检测结果：', data);

            const $tips = $("#tips");
            const $daries = $("#Diaries");
            if ($daries.prop('checked')) {
                if (data.code === -50000 || data.message === '请先验证独立密码' || data.tips === 'A28F-0') {
                    $tips.show();
                    $tips.text('私密日记已开启独立密码认证，请先关闭！');
                } else {
                    $tips.hide();
                }
            } else {
                $tips.hide();
            }
        });
    }

    const initOwnerOp = (data) => {
        // 是否为当前用户
        let isOwner = data.Owner.uin == data.Target.uin;

        // 显示信息
        $("#loginUin").text(data.Owner.uin);
        $("#targetUin").text(data.Target.uin);
        $("#userType").text(isOwner ? '个人模式' : '他人模式');

        $("#Diaries").attr("checked", isOwner);
        $("#Diaries").attr("disabled", !isOwner);
        $("#Friends").attr("checked", isOwner);
        $("#Friends").attr("disabled", !isOwner);
        $("#Favorites").attr("checked", isOwner);
        $("#Favorites").attr("disabled", !isOwner);
    }

    // 获取上次勾选的导出模块
    const initModules = () => {
        sendMessage({
            from: 'popup',
            subject: 'initModules'
        }, (data) => {
            for (const value in data) {
                if (!data.hasOwnProperty(value)) {
                    continue;
                }
                const checked = data[value] || true;
                let $exportType = $("input[value='" + value + "']");
                let hasDom = $exportType && $exportType[0];
                if (hasDom && $exportType[0].disabled === false) {
                    $exportType[0].checked = checked
                }
            }
        });
    }

    // 获取当前登录QQ或备份QQ
    sendMessage({
        from: 'popup',
        subject: 'initUin'
    }, (data) => {
        // 显示备份用户
        initOwnerOp(data);
        // 获取上次勾选的导出模块
        initModules();
        // 检测私密日记密码
        checkDiaries();
    });

    // 私密日志独立密码提示
    $("#Diaries").change(() => {
        checkDiaries();
    });

    // 绑定备份按钮事件
    $('#backup').click(() => {
        let exportType = {};
        // let $exportType = $("input[name='exportType']:checked");
        let $exportType = $("input[name='exportType']");
        $exportType.each(function () {
            exportType[$(this).val()] = $(this).prop("checked");
        });
        let message = {
            from: 'popup',
            subject: 'startBackup',
            exportType: exportType
        };
        sendMessage(message, (res) => {
            console.info("开始备份！", res);
        });
    });

})();