(function() {

    // 上次备份类型
    let PreExportTypes = localStorage.getItem('PreExportTypes') || '[]';
    PreExportTypes = JSON.parse(PreExportTypes);

    // 获取当前选项卡ID
    function getCurrentTabId(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
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
            port.onMessage.addListener(function(response) {
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
        const isOwner = data.Owner.uin == data.Target.uin;

        // 显示信息
        $("#loginUin").text(data.Owner.uin);
        $("#loginUin").attr('title', '当前登录账户：' + data.Owner.nickname || data.Owner.name);

        $("#targetUin").text(data.Target.uin);
        $("#targetUin").attr('title', '当前备份账户：' + data.Target.nickname || data.Target.name);

        $("#userType").text(isOwner ? '个人模式' : '他人模式');
        $("#userType").attr('title', isOwner ? '个人模式：将备份自己的空间数据，访问他人空间自动切换他人模式' : '他人模式，将备份他人的空间数据，将会留下访客记录，当然，你有黄钻就当我没说，为什么？真羡慕你看不懂...');

        // 私有模块
        const privateTypeList = ['Diaries', 'Friends', 'Favorites'];
        if (isOwner) {
            // 个人模式，取消禁用
            for (const privateType of privateTypeList) {
                $("#" + privateType).attr("disabled", false);
            }
        } else {
            // 他人模式，禁用模块
            for (const privateType of privateTypeList) {
                $("#" + privateType).prop("checked", false);
                $("#" + privateType).attr("disabled", true);
            }
        }
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
                'Thunder': '迅雷（助手唤醒）',
                'Thunder_Clipboard': '迅雷（剪切板唤醒）',
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
                    $download_help_suggestion.text('点击这里更换下载工具');
                    break;
                case 'Browser':
                    $download_help_reson.text('调用浏览器自带工具下载文件');
                    $download_help_suggestion.text('请先关闭浏览器设置【下载前询问每个文件的保存位置】');
                    break;
                case 'Aria2':
                    $download_help_reson.text('将调用Aria2服务下载文件');
                    $download_help_suggestion.text('点击这里检查Aria2配置');
                    break;
                case 'Thunder':
                    $download_help_reson.text('将调用本地迅雷下载文件');
                    $download_help_suggestion.text('建议迅雷处于启动状态');
                    break;
                case 'Thunder_Clipboard':
                    $download_help_reson.text('将自动复制下载链接');
                    $download_help_suggestion.text('迅雷需要打开接管剪切板的开关');
                    break;
                case 'Thunder_Link':
                    $download_help_reson.text('仅生成下载链接到备份压缩包中');
                    $download_help_suggestion.text('需自行添加下载任务');
                    break;
                case 'QZone':
                    $download_help_reson.text('不下载文件，直接使用QQ空间在线文件地址');
                    $download_help_suggestion.text('可能存在有效期，点击这里更换下载工具');
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
                contents.push(`<optgroup data-subtext="${albums.length}" label="${className}">`);
                for (const album of albums) {
                    contents.push(`<option data-subtext="${album.total}" value="${album.id}" >${album.name}</option>`);
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
        // 检测日记密码
        checkDiaries();
        // 获取相册列表
        getAlbumList();
    });

    // 私密日志独立密码提示
    $("#Diaries").change(() => {
        checkDiaries();
    });

    // 相册选择事件
    $("#Photos").change(function() {
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
        const ExportTypes = [];
        $("input[name='exportType']:checked").each(function() {
            ExportTypes.push(this.value);
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
            exportType: ExportTypes,
            albums: _albums
        };
        sendMessage(message, (res) => {
            console.info("开始备份！", res);
        });

        // 保存当前备份类型
        localStorage.setItem('PreExportTypes', JSON.stringify(ExportTypes));
    });

    // 打开选项页
    $("#openOptions").click(() => {
        chrome.runtime.openOptionsPage();
    });

    // 如果存在上次选中，则默认选中上次选择的类型
    if (PreExportTypes.length > 0) {
        // 取消全部选中
        $("input[name='exportType']").prop('checked', false).change();
        for (const preType of PreExportTypes) {
            // 选中上次选中
            $("#" + preType).prop("checked", true).change();
        }
    }
})();