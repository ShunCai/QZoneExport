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

    // 私密日志密码
    $('#diaries_close').click(() => {
        chrome.tabs.create({ url: "https://user.qzone.qq.com/" + $("#loginUin").text() + "/blog?catalog=private" })
    })

    // 打开文件下载工具
    $('.download_tool').click(() => {
        chrome.tabs.create({ url: "html/options.html#nav-common-tab" })
    })

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

    // 初始化助手配置
    const initConfig = () => {
        sendMessage({
            from: 'popup',
            subject: 'initConfig'
        }, (config) => {
            console.info('助手配置：', config);

            // 下载工具映射
            const downloadTypeMapping = {
                'File': '助手内部',
                'Browser': '浏览器',
                'Aria2': 'Aria2',
                'Thunder': '迅雷（自动唤起）',
                'Thunder_Link': '迅雷（下载链接）',
                'QZone': 'QQ空间外链',
            }

            // 下载工具
            const $download_tool_tip = $("#download_tool_tip");
            $download_tool_tip.text(downloadTypeMapping[config.Common.downloadType]);

            // 理由
            const $download_help_reson = $("#download_help_reson");
            // 建议
            const $download_help_suggestion = $("#download_help_suggestion");
            switch (config.Common.downloadType) {
                case 'File':
                    $download_help_reson.text('内部下载，限制较多已淘汰');
                    $download_help_suggestion.text('点击更换下载工具');
                    break;
                case 'Browser':
                    $download_help_reson.text('调用浏览器自带工具下载文件');
                    $download_help_suggestion.text('请先关闭浏览器设置【下载前询问每个文件的保存位置】');
                    break;
                case 'Aria2':
                    $download_help_reson.text('将调用Aria2服务下载文件');
                    $download_help_suggestion.text('点击检查Aria2配置');
                    break;
                case 'Thunder':
                    $download_help_reson.text('将调用本地迅雷下载文件');
                    $download_help_suggestion.text('建议迅雷处于启动状态');
                    break;
                case 'Thunder_Link':
                    $download_help_reson.text('将调用本地迅雷下载文件');
                    $download_help_suggestion.text('建议迅雷处于启动状态');
                    break;
                case 'QZone':
                    $download_help_reson.text('不下载文件，直接使用QQ空间在线文件地址');
                    $download_help_suggestion.text('可能存在有效期，点击更换下载工具');
                    break;
                default:
                    break;
            }
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

            const $diaries_tip = $("#diaries_tip");
            const $daries = $("#Diaries");
            if ($daries.prop('checked')) {
                if (data.code === -50000) {
                    $diaries_tip.show();
                } else {
                    $diaries_tip.hide();
                }
            } else {
                $diaries_tip.hide();
            }
        });
    }

    // 获取相册列表
    const getAlbumList = () => {
        sendMessage({
            from: 'popup',
            subject: 'getAlbumList'
        }, (albums) => {
            console.info('获取相册列表完成：', albums);
            // 赋值所有的相册给全局变量
            window.albums = albums;
            let albumMap = new Map();
            for (const album of albums) {
                let items = albumMap.get(album.className) || [];
                items.push(album);
                albumMap.set(album.className, items);
            }
            let contents = [];
            for (const [className, albums] of albumMap) {
                contents.push('<optgroup label="' + className + '">');
                for (const album of albums) {
                    contents.push('<option value="{0}" >{1}</option>'.format(album.id, album.name));
                }
                contents.push('</optgroup>');
            }
            let content = contents.join('\n');
            let $export_albums = $('#export_albums');
            $export_albums.empty();
            $export_albums.append(content);
            $export_albums.selectpicker('refresh');
            // 默认选择全部相册
            $export_albums.selectpicker('selectAll');
        });
    }

    // 获取当前登录QQ或备份QQ
    sendMessage({
        from: 'popup',
        subject: 'initUin'
    }, (data) => {
        // 读取助手配置
        initConfig();
        // 显示备份用户
        initOwnerOp(data);
        // 检测私密日记密码
        checkDiaries();
        // 获取相册列表
        getAlbumList();
    });

    // 私密日志独立密码提示
    $("#Diaries").change(() => {
        checkDiaries();
    });

    // 相册选择事件
    $("#Photos").change(function () {
        let isCheck = $(this).prop('checked');
        let $export_albums_div = $('#export_albums_div');
        if (isCheck) {
            $export_albums_div.show();
        } else {
            $export_albums_div.hide();
        }
    });
    $("#Photos").change();

    // 绑定备份按钮事件
    $('#backup').click(() => {
        let exportType = {};
        let $exportType = $("input[name='exportType']");
        $exportType.each(function () {
            exportType[$(this).val()] = $(this).prop("checked");
        });

        // 获取选中的相册
        let _albums = [];
        let albumValues = $("#export_albums").val();
        for (const albumId of albumValues) {
            let index = window.albums.findIndex((obj) => {
                if (obj.id === albumId) {
                    return obj;
                }
            })
            _albums.push(window.albums[index])
        }

        let message = {
            from: 'popup',
            subject: 'startBackup',
            exportType: exportType,
            albums: _albums
        };
        sendMessage(message, (res) => {
            console.info("开始备份！", res);
        });
    });

    // 打开选项页
    $("#openOptions").click(() => {
        chrome.runtime.openOptionsPage();
    });
})();