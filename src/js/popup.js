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

    // 获取相册列表
    const initAlbumInfo = () => {
        sendMessage({
            from: 'popup',
            subject: 'initAlbumInfo'
        }, (data) => {
            if (data.code < 0) {
                $('#backup').attr('disabled', true);
                return;
            }
            console.info('获取相册信息完成：', data);
            const $album_tips = $("#album_tips");
            const $photos = $("#Photos");
            if ($photos.prop('checked')) {
                $album_tips.show();
                $album_tips.html('目标相册已用容量：{0}'.format(data.data.user.capacity));
                if (data.data.user.diskused > 1000) {
                    $album_tips.append('<br>备份相册，请使用第三方<a id="downloadType_album" href="#">【文件下载工具】</a>');

                    // 打开公共配置
                    $('#downloadType_album').click(() => {
                        chrome.tabs.create({ url: "html/options.html#nav-common-tab" })
                    })
                }
            } else {
                $album_tips.hide();
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
            for (const albumEntry of albumMap) {
                let className = albumEntry[0];
                let albums = albumEntry[1];
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

    // 获取当前登录QQ或备份QQ
    sendMessage({
        from: 'popup',
        subject: 'initUin'
    }, (data) => {
        // 显示备份用户
        initOwnerOp(data);
        // 检测私密日记密码
        checkDiaries();
        // 获取相册列表
        getAlbumList();
        // 获取相册信息
        initAlbumInfo();
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
        initAlbumInfo();
    });
    $("#Photos").change();

    // 视频选择事件
    $("#Videos").change(function () {
        const isCheck = $(this).prop('checked');
        const $video_tips = $("#video_tips");
        if (isCheck) {
            $video_tips.show();
            $video_tips.html('备份视频，请使用第三方<a id="downloadType_video" href="#">【文件下载工具】</a>');

            // 打开公共配置
            $('#downloadType_video').click(() => {
                chrome.tabs.create({ url: "html/options.html#nav-common-tab" })
            })

        } else {
            $video_tips.hide();
        }
    });
    $("#Videos").change();

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