(function() {

    'use strict';

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip({
        placement: 'auto'
    });

    // 本地相册表格
    $("#localAlbums").bootstrapTable('destroy').bootstrapTable({
        undefinedText: '',
        toggle: 'localAlbums',
        locale: 'zh-CN',
        height: "700",
        search: true,
        searchAlign: 'right',
        showButtonText: true,
        pagination: true,
        pageList: "[10, 20, 50, 100, 200, 500, All]",
        paginationHAlign: 'left',
        clickToSelect: true,
        paginationDetailHAlign: 'right',
        theadClasses: 'thead-light',
        showSearchButton: true,
        toolbar: "#toolbar",
        toolbarAlign: "left",
        columns: [{
            field: 'className',
            title: '相册分类',
            align: 'left',
            width: "60",
            sortable: true
        }, {
            field: 'name',
            title: '相册名称',
            align: 'left',
            width: "60",
            sortable: true
        }, {
            field: 'desc',
            title: '相册路径',
            align: 'left',
            width: "150",
            sortable: true,
            formatter: (value, row, index, field) => {
                return rootFolder.name + '/Albums/' + row.className + '/' + value;
            }
        }, {
            field: 'photoList',
            title: '相片数量',
            align: 'center',
            width: "50",
            sortable: true,
            formatter: (value, row, index, field) => {
                return value.length;
            }
        }],
        data: []
    });

    // 获取文件夹
    const getFolder = async(dirHandle, name) => {
        return await dirHandle.getDirectoryHandle(name).catch(() => {
            return;
        });
    }

    // 获取所有的相片
    const getAllPhotos = async function(albumHandle, parentPath) {
        let photos = [];

        parentPath = parentPath + '/' + albumHandle.name;

        for await (const handle of albumHandle.values()) {
            switch (handle.kind) {
                case 'file':
                    photos.push({
                        name: handle.name,
                        path: parentPath + '/' + handle.name
                    });
                    break;
                case 'directory':
                    photos.push(...await getAllPhotos(handle, parentPath))
                    break;
                default:
                    break;
            }
        }
        return photos;
    }

    // 读取相册分类文件夹
    const readAlbumClassFolders = async folder => {
        const albumsClassFolder = [];
        for await (const handle of folder.values()) {
            if ('file' === handle.kind) {
                // 排除文件
                continue;
            }
            // 排除指定文件夹，剩余的都算分类文件夹
            if (['images', 'json', 'js'].indexOf(handle.name.toLowerCase()) > -1) {
                continue;
            }
            albumsClassFolder.push(handle);
        }
        return albumsClassFolder;
    }

    // 文件是否为视频文件
    const isVideoFile = (name) => {
        // 常见的视频格式
        const fileTypes = ['wmv', 'avi', 'mpeg',
            'rm', 'rmvb', 'flv', 'mp4', '3gp', , 'mkv',
            'f4v', 'm4v'
        ]
        if (name.indexOf('.') === -1) {
            return false;
        }
        return fileTypes.indexOf(name.substring(name.indexOf('.') + 1).toLowerCase()) > -1;
    }

    // 转换相册信息
    const toAlbum = (classFolder, albumFolder, photoFiles) => {
        // 相册信息
        const album = {
            isLocal: true,
            id: API.Utils.newUid(),
            name: albumFolder.name,
            desc: albumFolder.name,
            classid: API.Utils.newUid(),
            className: classFolder.name,
            photoList: photoFiles || []
        }
        album.total = album.photoList.length

        // 相片清单
        for (const photo of album.photoList) {

            photo.isLocal = album.isLocal;

            photo.albumId = album.id;
            photo.albumClassId = album.classid;
            photo.albumClassName = album.className;
            photo.topicId = album.classid;
            photo.topicName = album.className;

            photo.desc = photo.path;
            photo.name = photo.name;

            photo.pre = photo.path;
            photo.custom_pre_filepath = photo.path;

            photo.raw = photo.path;
            photo.custom_filepath = photo.path;

            photo.url = photo.path;
            photo.custom_url = photo.path;

            photo.is_video = isVideoFile(photo.name);
            photo.picKey = API.Utils.newUid();
            photo.uniKey = photo.picKey
            if (photo.is_video) {
                photo.video_info = {
                    vid: photo.picKey,
                    video_url: photo.custom_filepath
                }
            }

            delete photo.path;
        }

        // 随机取一个相片文件当相册预览图
        const _allPhotosFile = album.photoList.filter(function(item, index, arr) {
            return item.is_video === undefined || item.is_video === false;
        });
        if (!_allPhotosFile || _allPhotosFile.length === 0) {
            // 如果全是视频，就不搞预览图了
            return album;
        }
        album.custom_filepath = '../' + _allPhotosFile[0].custom_filepath;
        return album;
    }

    // 读取当个分类的相册清单
    const readClassAlbums = async classFolder => {
        const albums = [];
        for await (const albumHandle of classFolder.values()) {
            if ('file' === albumHandle.kind) {
                // 分类文件夹下不是相册文件夹的，跳过
                continue;
            }
            const photoFiles = await getAllPhotos(albumHandle, 'Albums/' + classFolder.name);
            // 相册
            albums.push(toAlbum(classFolder, albumHandle, photoFiles));
        }
        return albums;
    }

    // 读取相册
    const readAllClassAlbums = async classFolders => {
        const albums = [];
        // 相册名称
        for (const folder of classFolders) {
            albums.push(...await readClassAlbums(folder));
        }
        return albums;
    }

    // 读取本地相册
    const readAlbums = async(rootFolder) => {
        // 本地相册汇总
        window.localAlbumList = [];

        $('#localAlbums-tips').text('正在读取本地相册...');

        // 读取相册文件夹
        const albumsFolder = await getFolder(rootFolder, 'Albums');
        if (!albumsFolder) {
            $('#localAlbums-tips').text('选择的文件夹，没有发现Albums文件夹，请选择QQ空间备份文件夹');
            return;
        }

        // 读取相册首页index.html文件
        window.albumIndexFile = await albumsFolder.getFileHandle('index.html').catch(e => {
            return;
        });
        if (!albumIndexFile) {
            $('#localAlbums-tips').text('Albums文件夹下没有发现index.html文件，请先进行备份文件夹合并');
            return;
        }

        // 读取排除指定文件夹与非文件夹，得到分类文件夹
        const classFolders = await readAlbumClassFolders(albumsFolder);
        if (!classFolders || classFolders.length === 0) {
            // 取消按钮禁用
            $('#generateAlbums').removeAttr("disabled");
            $('#localAlbums-tips').text('没有读取到本地相册，点击生成按钮将清空本地相册');
            return;
        }

        // 读取所有相册
        window.localAlbumList.push(...await readAllClassAlbums(classFolders));

        $("#localAlbums").bootstrapTable('load', window.localAlbumList);
        $("#localAlbums").bootstrapTable('resetView');

        // 取消按钮禁用
        $('#generateAlbums').removeAttr("disabled");

        $('#localAlbums-tips').text('读取本地相册完成，请点击生成按钮开始生成本地相册');
    };

    // 打开本地相册
    $('#selectFolder').click(async function() {

        // 浏览器检测
        if (!window.showDirectoryPicker) {
            $('#localAlbums-tips').text('无法使用，要求Chromium内核版本86+');
            $('#selectFolder').attr('disabled');
            return;
        }

        // 选择文件夹
        showDirectoryPicker().then((folder) => {
            // 全局变量
            window.rootFolder = folder;

            // 开始生成相册信息
            readAlbums(folder);
        }).catch((e) => {
            console.warn('取消选择文件夹', e);
        });
    });

    // 写入文件
    const writeFile = async(fileHandle, contents) => {
        // Create a FileSystemWritableFileStream to write to.
        const writable = await fileHandle.createWritable();
        // Write the contents of the file to the stream.
        await writable.write(contents);
        // Close the file and write the contents to disk.
        await writable.close();
    }

    // 写入相册
    $('#generateAlbums').click(async function() {

        $('#localAlbums-tips').text('本地相册生成中...');

        // 相册目录
        let albumsFolder = await getFolder(window.rootFolder, 'Albums');
        if (!albumsFolder) {
            return;
        }

        // JSON目录
        let jsonFolder = await getFolder(albumsFolder, 'json');
        if (!jsonFolder) {
            return;
        }

        // 相册JSON文件
        let jsonFileHandle = await jsonFolder.getFileHandle('albums.js');
        if (!jsonFileHandle) {
            return;
        }
        let jsonFile = await jsonFileHandle.getFile();

        // 执行JSON的JS文件
        let jsonStr = await jsonFile.text();
        let albums = JSON.parse(jsonStr.replace('window.albums = ', ''));

        // 过来本地相册
        albums = albums.filter(function(item, index, arr) {
            return item.isLocal === undefined || item.isLocal === false;
        });

        // 将本地相册合并到QQ空间相册
        albums.push(...window.localAlbumList);

        // 写入JSON文件
        writeFile(jsonFileHandle, 'window.albums = ' + JSON.stringify(albums)).then(async() => {
            // 修改相册首页，添加本地相册
            // 重新生成相册首页
            // 根据类别分组
            const albumsMapping = API.Utils.groupedByField(albums, 'className');
            const html = await API.Common.getHtmlTemplate('albums', {
                albumsMapping: albumsMapping
            });

            writeFile(window.albumIndexFile, html).then(() => {
                $('#localAlbums-tips').text('本地相册生成完成，请重新查看备份...');
            }).catch((e) => {
                console.error(e);
                $('#localAlbums-tips').text('本地相册生成失败，请尝试关闭正在使用QQ空间备份文件夹的程序，如正在查看的网页...');
            });

        }).catch((e) => {
            console.error(e);
            $('#localAlbums-tips').text('本地相册生成失败，请尝试关闭正在使用QQ空间备份文件夹的程序，如正在查看的网页...');
            return;
        });

    });

    // 相册管理表格
    const initAlbumManagerTable = data => {
        $("#albumTable").bootstrapTable('destroy').bootstrapTable({
            undefinedText: '-',
            toggle: 'albumTable',
            locale: 'zh-CN',
            columns: [{
                field: 'name',
                title: '相册名称',
                align: 'center',
                sortable: true
            }, {
                field: 'photoList',
                title: '相片数量',
                align: 'center',
                sortable: true,
                formatter: (value, row, index, field) => {
                    return row.photoList && row.photoList.length || 0;
                }
            }, {
                field: 'operate',
                title: '操作',
                align: 'center',
                clickToSelect: false,
                events: {
                    'click .removeAlbum': function(e, value, row, index) {
                        // 移除选中相册
                        $("#albumTable").bootstrapTable('remove', {
                            field: 'id',
                            values: [row.id]
                        })

                        // 移除全局变量中的相册

                        // 目标QQ
                        const targetUin = $('#backedup-uin').val();
                        const rows = window.Backedup[targetUin];
                        const photoModule = _.find(rows, ['module', 'Photos']);
                        _.remove(photoModule.data, ['id', row.id]);

                        chrome.storage.local.set({
                            Backedup: window.Backedup
                        }, function() {
                            console.info("保存当前备份数据到Storage完成");

                            // 刷新QQ号清单
                            resetUinSelect(Object.keys(window.Backedup));

                            // 触发选中事件
                            $('#backedup-uin').change();
                        });
                    }
                },
                formatter: function(value, row, index) {
                    return [
                        '<a class="removeAlbum" href="javascript:void(0)" title="删除相册">',
                        '<i class="fa fa-trash"></i>',
                        '</a>'
                    ].join('');
                }
            }],
            data: data
        })
    }


    // 备份管理表格
    $("#backedupItems").bootstrapTable('destroy').bootstrapTable({
        undefinedText: '',
        toggle: 'backedupItems',
        locale: 'zh-CN',
        clickToSelect: true,
        theadClasses: 'thead-light',
        toolbar: "#backedup-toolbar",
        toolbarAlign: "left",
        columns: [{
            field: 'operate',
            align: 'center',
            width: "80",
            checkbox: true,
            clickToSelect: true
        }, {
            field: 'module',
            title: '模块',
            align: 'left',
            sortable: true,
            formatter: (value, row, index, field) => {
                return MODULE_NAME_MAPS[value];
            }
        }, {
            field: 'total',
            title: '已备份数量',
            align: 'left',
            sortable: true,
            formatter: (value, row, index, field) => {
                if (row.module === 'Boards' || row.module === 'Visitors') {
                    // 留言/访客
                    return row.data.total || 0
                }
                return row.data.length || 0
            }
        }, {
            field: 'time',
            title: '上次备份时间',
            align: 'left',
            sortable: true,
            formatter: (value, row, index, field) => {
                return new Date(value).format('yyyy-MM-dd hh:mm:ss');
            }
        }, {
            field: 'other',
            title: '更多',
            align: 'center',
            clickToSelect: false,
            events: {
                'click .managerAlbums': function(e, value, row, index) {
                    // 显示相册管理表格
                    initAlbumManagerTable(row.data);
                }
            },
            formatter: function(value, row, index) {
                if (row.module !== 'Photos') {
                    return;
                }
                return [
                    '<a class="managerAlbums" href="javascript:void(0)" title="管理相册" data-toggle="modal" data-target="#albumTableModal">',
                    '<i class="fa fa-photo"></i>',
                    '</a>  '
                ].join('');
            }
        }],
        data: []
    });

    // 刷新QQ号下拉
    const resetUinSelect = (uins) => {
        const uinSelect = document.getElementById('backedup-uin');
        if (!uinSelect) {
            return;
        }
        // 清空
        uinSelect.options.length = 0;
        for (const uin of uins) {
            uinSelect.options.add(new Option(uin, uin));
        }
    }

    // QQ号选择事件
    $('#backedup-uin').change(function() {
        const data = window.Backedup[this.value] || [];
        console.log('指定QQ数据', this.value, data);
        $("#backedupItems").bootstrapTable('load', data);
        $("#backedupItems").bootstrapTable('resetView');
    })

    // 增量备份显示
    $('#nav-backedup-tab').on('show.bs.tab', function(event) {

        // 遮罩
        $('#nav-backedup').mask();

        // 读取已备份数据
        API.Common.getBackupItems().then(data => {
            console.log('已备份数据', data);
            window.Backedup = data.Backedup || {};

            // 刷新QQ号清单
            resetUinSelect(Object.keys(window.Backedup));

            // 触发选中事件
            $('#backedup-uin').change();

            // 解除遮罩
            $('#nav-backedup').unmask();
        }).catch(e => {
            console.error('获取已备份数据错误', e)
        })
    })

    // 增量备份显示
    $('#nav-backedup-tab').on('hidden.bs.tab', function(event) {
        window.Backedup = {};
    })

    // 导入备份数据
    const importBackedupData = (importBackedup) => {
        // 目标QQ
        let targetUin = $('#backedup-uin').val();

        // 导入数据不一致
        if (!importBackedup.hasOwnProperty('Backedup')) {
            alert('导入的非助手备份数据文件');
            return;
        }

        // 是否导入其它QQ数据文件，若是，直接全量覆盖
        const isOtherUin = !importBackedup.Backedup.hasOwnProperty(targetUin);
        if (isOtherUin && !confirm('导入备份数据非当前QQ号，是否导入，确定导入将全量覆盖导入？')) {
            return;
        }

        // 导入的QQ
        targetUin = Object.keys(importBackedup.Backedup)[0];

        // 开始导入
        const items = $('#backedupItems').bootstrapTable('getSelections');
        const modules = items.map(item => item.module);
        const msg = isOtherUin || modules.length == 0 ? '确认全量导入？' : '确认导入选中行？';
        if (confirm(msg)) {

            const oldItems = window.Backedup[targetUin] || [];
            const newItems = importBackedup.Backedup[targetUin] || [];
            if (modules.length == 0) {
                // 导入全量模块
                oldItems.length = 0;
                oldItems.push(...newItems);
            } else {
                // 导入指定模块
                for (const moduleName of modules) {
                    const oldTargetIdx = oldItems.getIndex(moduleName, 'module');
                    const newTargetIdx = newItems.getIndex(moduleName, 'module');
                    if (newTargetIdx == -1) {
                        // 导入数据没有找到指定模块，不导入
                        console.warn('导入数据没有找到指定模块，不导入', moduleName);
                        continue;
                    }
                    if (oldTargetIdx == -1) {
                        // 没有找到，直接新增
                        oldItems.push(newItems[newTargetIdx]);
                        console.log('导入前没有找到指定模块，直接新增', moduleName);
                        continue;
                    }
                    // 存在相同的模块，更新
                    oldItems[oldTargetIdx] = newItems[newTargetIdx];
                }
            }

            window.Backedup[targetUin] = oldItems;

            // 导入完成后，保存
            chrome.storage.local.set({
                Backedup: window.Backedup
            }, function() {
                console.info("保存当前备份数据到Storage完成");

                // 刷新QQ号清单
                resetUinSelect(Object.keys(window.Backedup));

                // 触发选中事件
                $('#backedup-uin').change();
            });
        }
    }

    // 导入按钮点击
    $('#importBackedup').click(function() {

        // 浏览器检测
        if (!window.showOpenFilePicker) {
            $('#backedup-tips').text('无法使用，要求Chromium内核版本86+');
            return;
        }

        // 选择文件夹
        showOpenFilePicker({
            types: [{
                description: '助手备份数据',
                accept: {
                    'application/json': ['.qzbackedup', '.json']
                }
            }],
            excludeAcceptAllOption: true
        }).then((files) => {
            // 遮罩
            $('#nav-backedup').mask();

            return files[0].getFile();
        }).then(jsonFile => {
            return jsonFile.text();
        }).then(jsonStr => {
            // 导入的数据
            const importBackedup = JSON.parse(jsonStr);
            console.log('读取到的数据', importBackedup);

            // 导入数据
            importBackedupData(importBackedup);

            // 解除遮罩
            $('#nav-backedup').unmask();

        }).catch((e) => {

            // 遮罩
            $('#nav-backedup').unmask();

            console.error('未知异常', e);
        });
    });

    $('#exportBackedup').click(function() {
        // 遮罩
        $('#nav-backedup').mask();

        // 导出QQ
        const targetUin = $('#backedup-uin').val();
        // 下载数据
        const downloadData = {
            Backedup: {}
        }
        downloadData.Backedup[targetUin] = window.Backedup[targetUin];

        const urlObject = window.URL || window.webkitURL || window;
        const export_blob = new Blob([JSON.stringify(downloadData)], { type: "application/json" });
        const save_link = document.createElement("a")

        save_link.href = urlObject.createObjectURL(export_blob);
        save_link.download = '助手备份数据_' + targetUin + '.json';
        save_link.click();

        // 遮罩
        $('#nav-backedup').unmask();
    });

    // 删除按钮点击
    $('#resetBackedup').click(function() {

        const items = $('#backedupItems').bootstrapTable('getSelections');
        const modules = items.map(item => item.module);
        const msg = modules.length == 0 ? '确认删除全部？' : '确认删除选中行？';
        if (confirm(msg)) {

            // 遮罩
            $('#nav-backedup').mask();

            if (modules.length == 0) {
                // 移除全部
                $('#backedupItems').bootstrapTable('removeAll');
            } else {
                // 移除指定模块
                $('#backedupItems').bootstrapTable('remove', {
                    field: 'module',
                    values: modules
                })
            }

            // 保存
            chrome.storage.local.set({
                Backedup: window.Backedup
            }, function() {
                // 遮罩
                $('#nav-backedup').unmask();
            });
        }
    });

})();