(function() {

    'use strict';

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip({
        placement: 'auto'
    });

    let tableOptions = {
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
                return 'QQ空间备份/Albums/本地/' + value;
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
    };

    $("#localAlbums").bootstrapTable(tableOptions);

    // 浏览器检测
    if (!window.showDirectoryPicker) {
        $('#localAlbums-tips').text('无法使用，要求Chromium内核版本86+');
        $('#selectFolder').attr('disabled');
        return;
    }

    const getFolder = async function(dirHandle, name) {
        try {
            return await dirHandle.getDirectoryHandle(name);
        } catch (error) {

        }
        return undefined;
    }

    // 获取所有的相册
    const getAllPhotos = async function(dirHandle, parentPath) {
        let photos = [];

        parentPath = parentPath + '/' + dirHandle.name;

        for await (const handle of dirHandle.values()) {
            switch (handle.kind) {
                case 'file':
                    photos.push({
                        name: handle.name,
                        path: parentPath + '/' + handle.name
                    });
                    break;
                case 'directory':
                    photos = photos.concat(await getAllPhotos(handle, parentPath + '/' + handle.name));
                    break;
                default:
                    break;
            }
        }
        return photos;
    }

    // 打开本地相册
    $('#selectFolder').click(async function() {
        // 根目录
        window.rootFolder = await window.showDirectoryPicker();
        if (!window.rootFolder) {
            $('#localAlbums-tips').text('请选择QQ空间备份文件夹！');
            return;
        }

        $('#localAlbums-tips').text('正在读取本地相册...');

        // 相册目录
        let albumsFolder = await getFolder(window.rootFolder, 'Albums');
        if (!albumsFolder) {
            return;
        }

        // 相册首页文件
        window.albumIndexFile = await albumsFolder.getFileHandle('index.html');
        if (!window.albumIndexFile) {
            return;
        }

        // 本地相册目录
        let localAlbumsFolder = await getFolder(albumsFolder, '本地');
        if (!localAlbumsFolder) {
            // 取消按钮禁用
            $('#generateAlbums').removeAttr("disabled");
            $('#localAlbums-tips').text('没有读取到本地相册，点击生成按钮将清空本地相册');
            return;
        }

        // 相册名称
        window.localAlbumList = [];
        for await (const handle of localAlbumsFolder.values()) {
            if (!'directory' === handle.kind) {
                continue;
            }
            let allPhotosFile = await getAllPhotos(handle, 'Albums/本地');
            if (!allPhotosFile || allPhotosFile.length == 0) {
                continue;
            }
            // 相册信息
            let album = {
                isLocal: true,
                id: API.Utils.newUid(),
                name: handle.name,
                desc: handle.name,
                classid: 0,
                className: '本地',
                photoList: allPhotosFile
            }
            for (const photo of allPhotosFile) {

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

                photo.is_video = photo.name.toLowerCase().endsWith('.mp4');
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
            // 相册预览图
            let _allPhotosFile = allPhotosFile.filter(function(item, index, arr) {
                return item.is_video === undefined || item.is_video === false;
            });
            album.custom_filepath = '../' + _allPhotosFile[0].custom_filepath;
            album.total = album.photoList.length

            window.localAlbumList.push(album);
        }

        $("#localAlbums").bootstrapTable('load', window.localAlbumList);
        $("#localAlbums").bootstrapTable('resetView');

        // 取消按钮禁用
        $('#generateAlbums').removeAttr("disabled");

        $('#localAlbums-tips').text('读取本地相册完成，请点击生成按钮开始生成本地相册');
    });

    // 写入文件
    async function writeFile(fileHandle, contents) {
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

        // 公共目录
        let commonFolder = await getFolder(window.rootFolder, 'Common');
        if (!commonFolder) {
            return;
        }

        // JSON目录
        let jsonFolder = await getFolder(commonFolder, 'json');
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
        let albums = JSON.parse(jsonStr.replace('const albums = ', ''));

        // 过来本地相册
        albums = albums.filter(function(item, index, arr) {
            return item.isLocal === undefined || item.isLocal === false;
        });
        // 合并相册
        albums = albums.concat(window.localAlbumList || []);
        await writeFile(jsonFileHandle, 'const albums = ' + JSON.stringify(albums)).catch((e) => {
            $('#localAlbums-tips').text('本地相册生成失败，请尝试关闭正在使用QQ空间备份文件夹的程序，如正在查看的网页...');
        });

        // 修改相册首页，添加本地相册
        // 重新生成相册首页
        // 根据类别分组
        const albumsMapping = API.Utils.groupedByField(albums, 'className');
        let html = await API.Common.getHtmlTemplate('albums', {
            albumsMapping: albumsMapping
        });

        await writeFile(window.albumIndexFile, html).catch((e) => {
            $('#localAlbums-tips').text('本地相册生成失败，请尝试关闭正在使用QQ空间备份文件夹的程序，如正在查看的网页...');
        });;

        $('#localAlbums-tips').text('本地相册生成完成，请重新查看备份...');

    });

})()