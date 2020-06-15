/**
 * QQ空间相册模块的导出A
 * @author https://lvshuncai.com
 */


/**
 * 导出相册数据
 */
API.Photos.export = async () => {
    try {
        // 用户选择的备份相册列表
        let albumList = await API.Photos.initAlbums();
        console.info('获取所有的相册列表完成', albumList);

        // 获取相册的评论列表
        albumList = await API.Photos.getAllAlbumsComments(albumList);

        // 获取相册赞记录
        await API.Photos.getAlbumsLikeList(albumList);

        // 获取所有相册的相片列表
        let imagesMapping = await API.Photos.getAllAlbumImageList(albumList);
        console.info('获取所有相册的所有相片列表完成', imagesMapping);

        // 获取所有相片的详情
        albumList = await API.Photos.getAllImagesInfos(albumList);
        console.info('获取所有相片的详情完成', albumList);

        // 获取相片的评论列表
        let images = API.Photos.toImages(imagesMapping);
        images = await API.Photos.getAllImagesComments(images);
        console.info('获取所有相册的所有相片的评论列表完成', images);

        // 添加点赞Key
        API.Photos.addPhotoUniKey(images);

        // 获取相片赞记录
        await API.Photos.getPhotosLikeList(images);

        // 添加相片下载任务
        await API.Photos.addAlbumsDownloadTasks(albumList);
        console.info('添加相片下载任务完成', albumList);

        // 根据导出类型导出数据    
        await API.Photos.exportAllListToFiles(albumList);
        console.info('根据导出类型导出数据   完成', albumList);

        // 设置备份时间
        API.Common.setBackupInfo(QZone_Config.Photos);

    } catch (error) {
        console.error('相册导出异常', error);
    }
}

/**
 * 转换相片集合
 * @param {Object} imagesMapping 相册与相片的映射关系
 */
API.Photos.toImages = (imagesMapping) => {
    let allImages = [];
    for (let x in imagesMapping) {
        let obj = imagesMapping[x];
        allImages = allImages.concat(obj.Data || []);
    }
    return allImages;
}

/**
 * 获取所有相片的详情
 * @param {Array} albumList 相册列表
 */
API.Photos.getAllImagesInfos = async (albumList) => {
    console.info('获取所有相片的详情开始', albumList);

    for (const album of albumList) {

        // 进度更新器
        const indicator = new StatusIndicator('Photos_Images_Info');

        // 开始
        indicator.print();

        // 设置当前相册
        indicator.setIndex(album.name);

        const photos = album.photoList || [];

        // 设置总数
        indicator.setTotal(photos.length);

        // 同时请求数（提高相片处理速度）
        const _photos = _.chunk(photos, QZone_Config.Common.downloadThread);
        for (const list of _photos) {
            let imageInfoTasks = [];
            for (const photo of list) {

                if (!API.Photos.isNewItem(album.id, photo)) {
                    // 已备份数据跳过不处理
                    indicator.addSkip(photo);
                    continue;
                }

                // 更新获取进度
                indicator.addDownload(photo);
                let picKey = API.Photos.getImageKey(photo);
                const imageInfoTask = API.Photos.getImageInfo(album.id, picKey).then((data) => {
                    // 去掉函数，保留json
                    data = API.Utils.toJson(data, /^_Callback\(/);
                    data = data.data.photos || [];

                    // 拷贝覆盖属性到photo
                    // 清空源属性
                    let keys = Object.keys(photo);
                    for (const key of keys) {
                        delete photo[key];
                    }
                    Object.assign(photo, data[0]);

                    // 更新获取进度
                    indicator.addSuccess(photo);
                }).catch((error) => {
                    console.error('获取相片详情异常', photo, error);
                    // 更新获取进度
                    indicator.addFailed(photo);
                });
                imageInfoTasks.push(imageInfoTask);
            }

            await Promise.all(imageInfoTasks);
            // 每一批次完成后暂停半秒
            await API.Utils.sleep(500);
        }

        // 更新信息
        for (const photo of photos) {
            photo.albumClassId = album.classid;
            photo.albumClassName = album.className || QZone.Photos.Class[album.classid] || '其他';
            // 上传时间处理
            if (!photo.uploadTime && photo.uploadtime) {
                photo.uploadTime = photo.uploadtime
            }
        }

        // 完成
        indicator.complete();
    }

    console.info('获取所有相片的详情完成', albumList);
    return albumList;
}

/**
 * 获取单页的相册列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Photos.getAlbumPageList = async (pageIndex, indicator) => {

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中数据
    indicator.addDownload(QZone_Config.Photos.pageSize);

    // 查询相册
    return await API.Photos.getAlbums(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data;

        // 更新总数
        QZone.Photos.Album.total = data.albumsInUser || QZone.Photos.Album.total || 0;
        indicator.setTotal(QZone.Photos.Album.total);

        let dataList = data.albumList || [];

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}

/**
 * 获取所有的相册列表
 */
API.Photos.getAllAlbumList = async () => {
    // 进度更新器
    const indicator = new StatusIndicator('Photos');

    // 开始
    indicator.print();

    const CONFIG = QZone_Config.Photos;

    const nextPage = async function (pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Photos.getAlbumPageList(pageIndex, indicator).then(async (dataList) => {

            // 合并数据
            QZone.Photos.Album.Data = API.Utils.unionItems(QZone.Photos.Album.Data, dataList);

            if (API.Common.isPreBackupPos(dataList, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Photos.Album.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Photos.Album.total, QZone.Photos.Album.Data, arguments.callee, nextPageIndex, indicator);

        }).catch(async (e) => {
            console.error("获取相册列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Photos.Album.total, QZone.Photos.Album.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 更新相册类别
    for (const album of QZone.Photos.Album.Data) {
        album.className = QZone.Photos.Class[album.classid] || '其他';
        album.photoList = album.photoList || [];
    }

    // 完成
    indicator.complete();

    return QZone.Photos.Album.Data;

}

/**
 * 获取单个相册的指定页相片列表
 * @param {Object} item 相册
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Photos.getAlbumImagePageList = async (item, pageIndex, indicator) => {
    // 显示当前处理相册
    indicator.setIndex(item.name);

    // 更新获取中数据
    indicator.addDownload(QZone_Config.Photos.Images.pageSize);

    return await API.Photos.getImages(item.id, pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data;

        // 更新总数
        QZone.Photos.Images[item.id].total = data.totalInAlbum || QZone.Photos.Images[item.id].total || 0;
        indicator.setTotal(data.totalInAlbum || 0);

        // 合并相册信息到相册(主要是合并预览图与封面图地址)
        if (data.topic) {
            item.pre = data.topic.pre || item.pre;
            item.url = data.topic.url || item.url;
        }

        // 相片列表
        let dataList = data.photoList || [];

        // 添加相册信息到相片

        // 更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
}

/**
 * 获取单个相册的全部相片列表
 * @param {Object} album 相册
 */
API.Photos.getAlbumImageAllList = async (album) => {
    // 获取已备份数据
    const OLD_Data = API.Photos.getPhotosByAlbumId(QZone.Photos.Album.OLD_Data, album.id);
    // 重置单个相册的数据
    QZone.Photos.Images[album.id] = {
        total: 0,
        OLD_Data: OLD_Data,
        Data: []
    };
    // 进度更新器
    const indicator = new StatusIndicator('Photos_Images');
    // 开始
    indicator.print();

    // 相册配置项
    const ALBUM_CONFIG = QZone_Config.Photos
    // 相片配置项
    const PHOTO_CONFIG = ALBUM_CONFIG.Images;

    const nextPage = async function (pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Photos.getAlbumImagePageList(album, pageIndex, indicator).then(async (dataList) => {

            // 设置比较信息
            dataList = API.Common.setCompareFiledInfo(dataList, 'uploadtime', 'uploadTime');

            // 合并数据
            QZone.Photos.Images[album.id].Data = API.Utils.unionItems(QZone.Photos.Images[album.id].Data, dataList);
            if (API.Common.isPreBackupPos(dataList, ALBUM_CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return QZone.Photos.Images[album.id].Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, PHOTO_CONFIG, QZone.Photos.Images[album.id].total, QZone.Photos.Images[album.id].Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async (e) => {
            console.error("获取相册列表异常，当前页：", pageIndex + 1, album, e);
            indicator.addFailed(new PageInfo(pageIndex, PHOTO_CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, PHOTO_CONFIG, QZone.Photos.Images[album.id].total, QZone.Photos.Images[album.id].Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator) || [];

    if (!API.Photos.isNewAlbum(album.id)) {
        // 合并、过滤数据
        QZone.Photos.Images[album.id].Data = API.Common.unionBackedUpItems(ALBUM_CONFIG, QZone.Photos.Images[album.id].OLD_Data, QZone.Photos.Images[album.id].Data);

        // 上传时间倒序
        QZone.Photos.Images[album.id].Data = API.Utils.sort(QZone.Photos.Images[album.id].Data, ALBUM_CONFIG.PreBackup.field, true);
    }

    // 完成
    indicator.complete();

    return QZone.Photos.Images[album.id].Data;
}

/**
 * 获取指定相册的相片列表
 * @param {Array} items 相册列表
 */
API.Photos.getAllAlbumImageList = async (items) => {
    for (const item of items) {
        if (item.allowAccess === 0) {
            // 没权限的跳过不获取
            console.warn("无权限访问该相册", item);
            continue;
        }
        let photos = await API.Photos.getAlbumImageAllList(item);
        item.photoList = photos;
    }
    return QZone.Photos.Images;
}


/**
 * 获取单个相册的所有评论
 * @param {Object} item 相册对象
 * @param {StatusIndicator} indicator 进度更新器
 */
API.Photos.getAlbumAllComments = async (item, indicator) => {
    // 清空相册原有的评论
    item.comments = [];

    const CONFIG = QZone_Config.Photos.Comments;

    // 更新下载中
    indicator.addDownload(item);

    const nextPage = async function (item, pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Photos.getAlbumComments(item.id, pageIndex).then(async (data) => {

            // 去掉函数，保留json
            data = API.Utils.toJson(data, /^_Callback\(/);
            data = data.data;
            data.comments = data.comments || [];

            // 合并数据
            item.comments = API.Utils.unionItems(item.comments, data.comments);
            indicator.addSuccess(data.comments);

            if (API.Common.isPreBackupPos(data.comments, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return item.comments;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.comment, item.comments, arguments.callee, item, nextPageIndex, indicator);

        }).catch(async (e) => {
            console.error("获取单个相册的评论列表异常：", pageIndex + 1, item, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.comment, item.comments, arguments.callee, item, nextPageIndex, indicator);
        });
    }

    await nextPage(item, 0, indicator);

    return item.comments;
}


/**
 * 获取所有的相册的评论
 * @param {Array} items 相册列表
 */
API.Photos.getAllAlbumsComments = async (items) => {
    // 是否需要获取相册的评论
    if (!QZone_Config.Photos.Comments.isGet || API.Photos.isFile()) {
        return items;
    }
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!API.Photos.isNewAlbum(item.id)) {
            // 已备份数据跳过不处理
            continue;
        }
        if (item.comment === 0) {
            // 没评论时，跳过
            continue;
        }
        // 相册评论进度更新器
        let indicator = new StatusIndicator('Photos_Albums_Comments');
        // 更新总数
        indicator.setTotal(item.comment);
        indicator.setIndex(index + 1);
        await API.Photos.getAlbumAllComments(item, indicator);
        // 完成
        indicator.complete();
    }
    return items;
}

/**
 * 获取单张相片的所有评论
 * @param {Object} item 相片对象
 * @param {StatusIndicator} indicator 进度更新器
 */
API.Photos.getImageAllComments = async (item, indicator) => {
    // 清空相片原有的评论
    item.comments = [];

    const CONFIG = QZone_Config.Photos.Images.Comments;

    // 更新下载中
    indicator.addDownload(item);

    const nextPage = async function (item, pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Photos.getImageComments(item.albumId, item.lloc, pageIndex).then(async (data) => {

            // 去掉函数，保留json
            data = API.Utils.toJson(data, /^_Callback\(/);
            data = data.data;
            data.comments = data.comments || [];


            // 合并数据
            item.comments = API.Utils.unionItems(item.comments, data.comments);
            indicator.addSuccess(data.comments);

            if (API.Common.isPreBackupPos(data.comments, CONFIG)) {
                // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                return item.comments;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.cmtTotal, item.comments, arguments.callee, item, nextPageIndex, indicator);

        }).catch(async (e) => {
            console.error("获取单张相片的评论列表异常：", pageIndex + 1, item, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.cmtTotal, item.comments, arguments.callee, item, nextPageIndex, indicator);
        });
    }

    await nextPage(item, 0, indicator);

    return item.comments;
}

/**
 * 获取所有的相片的评论
 * @param {Array} items 相片列表
 */
API.Photos.getAllImagesComments = async (items) => {
    // 是否需要获取相片的评论
    if (!QZone_Config.Photos.Images.Comments.isGet || API.Photos.isFile()) {
        return items;
    }
    // 相片评论进度更新器
    const indicator = new StatusIndicator('Photos_Images_Comments');
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 更新总数
        indicator.setTotal(item.cmtTotal || 0);
        indicator.setIndex(index + 1);
        if (item.cmtTotal === 0) {
            // 没评论时，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!API.Photos.isNewItem(item.albumId, item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }
        await API.Photos.getImageAllComments(item, indicator);
    }
    // 完成
    indicator.complete();
    return items;
}


/**
 * 添加所有相册的相片下载任务
 * @param {object} albums 相册列表
 */
API.Photos.addAlbumsDownloadTasks = async (albums) => {
    for (const album of albums) {
        const photos = album.photoList || [];

        // 新备份数据才添加预览图与评论图下载任务
        if (API.Photos.isNewAlbum(album.id)) {

            // 添加相册预览图的下载任务
            await API.Photos.addPreviewDownloadTasks(album, 'Albums/Images');

            // 添加评论的图片的下载任务
            await API.Photos.addCommentDownloadTasks(album, 'Albums/Images');
        }

        // 添加相片的下载任务
        await API.Photos.addPhotosDownloadTasks(album, photos);
    }
}

/**
 * 添加相册预览图的下载任务
 * @param {object} item 相册或相片
 */
API.Photos.addPreviewDownloadTasks = async (item, dir) => {
    if (API.Common.isQzoneUrl()) {
        // QQ空间外链导出时，不需要添加下载任务，但是需要处理
        return;
    }
    item.custom_url = item.custom_url || item.url || item.pre;
    item.custom_filename = API.Utils.newSimpleUid(8, 16);
    // 预览图直接写死后缀（有权限的默认JPEG，无权限的，根据文件名获取）
    item.custom_filename = item.custom_filename + (API.Utils.getFileSuffixByUrl(item.custom_url) || '.jpeg');
    item.custom_filepath = 'Images/' + item.custom_filename;
    // 添加下载任务
    API.Utils.newDownloadTask(item.custom_url, dir, item.custom_filename, item);
    return item;
}

/**
 * 添加评论的下载任务
 * @param {object} item 相册或相片
 */
API.Photos.addCommentDownloadTasks = async (item, dir) => {
    item.comments = item.comments || [];
    for (let i = 0; i < item.comments.length; i++) {
        const comment = item.comments[i];
        // 获取评论的图片
        let images = comment.pic || [];
        for (let j = 0; j < images.length; j++) {
            const image = images[j];
            image.custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
            if (API.Common.isQzoneUrl()) {
                // QQ空间外链导出时，不需要添加下载任务，但是需要处理
                continue;
            }
            image.custom_filename = API.Utils.newSimpleUid(8, 16);
            // 获取图片类型
            let suffix = await API.Utils.autoFileSuffix(image.custom_url);
            image.custom_filename = image.custom_filename + suffix;
            image.custom_filepath = 'Images/' + image.custom_filename;
            // 添加下载任务
            API.Utils.newDownloadTask(image.custom_url, dir, image.custom_filename, item);
        }
    }
    return item;
}

/**
 * 添加单个相册的相片下载任务
 * @param {object} album 相册对象
 * @param {Array} photos 相片列表
 * @param {StatusIndicator} indicator 进度更新器
 */
API.Photos.addPhotosDownloadTasks = async (album, photos) => {

    // 相片评论进度更新器
    const indicator = new StatusIndicator('Photos_Images_Mime');
    // 设置当前位置
    indicator.setIndex(album.name);

    // 设置总数
    indicator.setTotal(photos.length);

    for (let index = 0; index < photos.length; index++) {

        const photo = photos[index];

        if (!API.Photos.isNewItem(album.id, photo)) {
            // 已备份数据跳过不处理
            indicator.addSkip(photo);
            continue;
        }

        // 处理中
        indicator.addDownload(photo);

        let orderNumber = API.Utils.prefixNumber(index + 1, photos.length.toString().length);

        const albumClass = API.Utils.filenameValidate(album.className);
        const albumName = API.Utils.filenameValidate(album.name);
        const albumFolder = 'Albums/' + albumClass + '/' + albumName;

        if (API.Common.isQzoneUrl()) {
            // QQ空间外链导出时，不需要添加下载任务，但是需要处理
            // 根据配置的清晰度匹配图片，默认高清
            photo.custom_url = API.Photos.getDownloadUrl(photo, QZone_Config.Photos.Images.exifType);
        } else {
            // 非QQ空间外链导出时，需要添加下载任务
            // 如果相片是视频，需要下载视频

            if (photo.is_video && photo.video_info) {
                // 预览图与视频共用一个文件名
                let filename = API.Utils.filenameValidate(orderNumber + '_' + photo.name + '_' + API.Utils.newSimpleUid(8, 16));

                // 下载预览图
                // 根据配置的清晰度匹配图片，默认高清
                photo.custom_url = API.Photos.getDownloadUrl(photo, QZone_Config.Photos.Images.exifType);
                // 获取图片类型
                const suffix = API.Photos.getPhotoType(photo);
                photo.custom_pre_filename = filename + suffix;
                photo.custom_pre_filepath = albumFolder + '/' + photo.custom_pre_filename;
                // 添加下载任务
                API.Utils.newDownloadTask(photo.custom_url, albumFolder, photo.custom_pre_filename, photo);

                // 下载视频
                photo.custom_filename = QZone.Photos.FILE_URLS.get(photo.video_info.video_url);
                if (!photo.custom_filename) {
                    photo.custom_filename = filename + '.mp4';
                    // 添加下载任务
                    API.Utils.newDownloadTask(photo.video_info.video_url, albumFolder, photo.custom_filename, photo);
                    QZone.Photos.FILE_URLS.set(photo.video_info.video_url, photo.custom_filename);
                }
                photo.custom_filepath = albumFolder + '/' + photo.custom_filename;
            } else {
                // 根据配置的清晰度匹配图片，默认高清
                photo.custom_url = API.Photos.getDownloadUrl(photo, QZone_Config.Photos.Images.exifType);

                photo.custom_filename = QZone.Photos.FILE_URLS.get(photo.custom_url);
                if (!photo.custom_filename) {
                    // 获取图片类型
                    const suffix = API.Photos.getPhotoType(photo);
                    photo.custom_filename = API.Utils.filenameValidate(orderNumber + '_' + photo.name + '_' + API.Utils.newSimpleUid(8, 16));
                    photo.custom_filename = photo.custom_filename + suffix;
                    // 添加下载任务
                    API.Utils.newDownloadTask(photo.custom_url, albumFolder, photo.custom_filename, photo);
                    QZone.Photos.FILE_URLS.set(photo.custom_url, photo.custom_filename);
                }
                photo.custom_filepath = albumFolder + '/' + photo.custom_filename;
            }
        }

        // 处理成功
        indicator.addSuccess(photo);

        if (API.Photos.isFile()) {
            // 如果相片导出类型为文件时，则不处理评论的配图// 评论图片
            continue;
        }

        // 添加评论的下载任务
        await API.Photos.addCommentDownloadTasks(photo, albumFolder + '/Images');
    }

    // 完成
    indicator.complete();
    return photos;
}

/**
 * 导出相册与相片
 * @param {Array} albums 相册列表
 */
API.Photos.exportAllListToFiles = async (albums) => {
    // 导出相册
    await API.Photos.exportAlbumsToFiles(albums);
    // 导出相片
    await API.Photos.exportPhotosToFiles(albums);
}

/**
 * 导出相册
 * @param {Array} albums 相册列表
 */
API.Photos.exportAlbumsToFiles = async (albums) => {
    // 获取用户配置
    let exportType = QZone_Config.Photos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Photos.exportAlbumsToHtml(albums);
            break;
        case 'MarkDown':
            await API.Photos.exportAlbumsToMarkdown(albums);
            break;
        case 'JSON':
            await API.Photos.exportAlbumsToJson(albums);
            break;
        default:
            break;
    }
}

/**
 * 导出相册到HTML文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportAlbumsToHtml = async (albums) => {
    // 进度器
    const indicator = new StatusIndicator('Photos_Export');
    indicator.setIndex('HTML')
    try {
        // 根据类别分组
        const albumsMapping = API.Utils.groupedByField(albums, 'className');

        console.info('生成相册首页HTML文件开始', albumsMapping);
        // 基于模板生成相册首页HTML
        let params = {
            albumsMapping: albumsMapping
        }
        let fileEntry = await API.Common.writeHtmlofTpl('albums', params, QZone.Photos.ROOT + "/index.html");
        console.info('生成汇总HTML文件结束', fileEntry, albumsMapping);
    } catch (error) {
        console.error('导出相册到HTML异常', error, albums);
    }
    indicator.complete();
    return albums;
}

/**
 * 导出相册到MD文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportAlbumsToMarkdown = async (albums) => {
    // 进度器
    const indicator = new StatusIndicator('Photos_Export');
    indicator.setIndex('Markdown');

    // 根据类别分组
    const albumsMapping = API.Utils.groupedByField(albums, 'className');
    // 遍历分组
    for (const [className, items] of albumsMapping) {
        let contents = [];
        contents.push('### {0}'.format(className));

        // 获取相册的Markdown内容
        contents.push(API.Photos.getAlbumsMarkdown(items));

        // 创建文件夹
        let categoryName = API.Utils.filenameValidate(className);
        let folderName = QZone.Photos.ROOT + '/' + categoryName;
        await API.Utils.createFolder(folderName);

        // 写入Markdown文件
        await API.Utils.writeText(contents.join('\r\n'), folderName + '/' + categoryName + ".md").then((file) => {
            // 更新成功信息
            console.info('导出相册到Markdown文件完成', file, items);
        }).catch((e) => {
            console.error('写入相册MD文件异常', items, e);
        })
    }

    // 完成
    indicator.complete();
    return albums;
}

/**
 * 获取相册的Markdown内容
 * @param {Array} albums 相册列表
 */
API.Photos.getAlbumsMarkdown = (albums) => {
    const contents = [];
    for (const album of albums) {

        // 相册名称与地址
        const albumName = album.name;
        const albumUrl = API.Photos.getAlbumUrl(QZone.Common.Target.uin, album.id);
        contents.push('> ' + API.Utils.getLink(albumUrl, albumName, "MD"));
        contents.push('\r\n');

        // 相册预览图
        let pre = API.Common.isQzoneUrl() ? (album.url || API.Photos.getPhotoPreUrl(album.pre)) : '../' + album.custom_filepath;
        contents.push('>[![{0}]({1})](https://user.qzone.qq.com/{2}/photo/{3}) '.format(albumName, pre, QZone.Common.Target.uin, album.id));
        contents.push('\r\n');
        contents.push('>{0} '.format(album.desc || albumName));
        contents.push('\r\n');

        // 评论
        album.comments = album.comments || [];
        contents.push('> 评论({0})'.format(album.comments.length));
        contents.push('\r\n');

        for (const comment of album.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD');
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");

            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD');
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : '../' + image.custom_filepath;
                    // 添加评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {

                // 回复人
                let repName = API.Common.formatContent(repItem.poster.name, 'MD');
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");

                // 回复内容
                let content = API.Common.formatContent(repItem.content, 'MD');
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : '../' + repImg.custom_filepath;
                    // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }
        contents.push('---');
    }
    return contents.join('\r\n');
}

/**
 * 导出相册到JSON文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportAlbumsToJson = async (albums) => {
    const indicator = new StatusIndicator('Photos_Export');
    indicator.setIndex('JSON')
    let json = JSON.stringify(albums);
    await API.Utils.writeText(json, QZone.Photos.ROOT + '/albums.json').then((fileEntry) => {
        console.info('导出相册JSON文件到FileSystem完成', albums, fileEntry);
    }).catch((error) => {
        console.info('导出相册JSON文件到FileSystem异常', albums, error);
    });
    indicator.complete();
    return albums;
}


/**
 * 导出相片
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosToFiles = async (albums) => {
    // 获取用户配置
    let exportType = QZone_Config.Photos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Photos.exportPhotosToHtml(albums);
            break;
        case 'MarkDown':
            await API.Photos.exportPhotosToMarkdown(albums);
            break;
        case 'JSON':
            await API.Photos.exportPhotosToJson(albums);
            break;
        default:
            break;
    }
}

/**
 * 导出相片到HTML文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosToHtml = async (albums) => {
    let indicator = new StatusIndicator('Photos_Images_Export_Other');
    indicator.setIndex('HTML');
    try {
        // 基于JSON生成JS
        console.info('生成相册JSON开始', albums);
        await API.Utils.createFolder(QZone.Common.ROOT + '/json');
        const jsonFile = await API.Common.writeJsonToJs('dataList', albums, QZone.Common.ROOT + '/json/albums.js');
        console.info('生成相册JSON结束', jsonFile, albums);

        // 生成相片列表HTML
        console.info('生成相片列表HTML开始', albums);
        const infoFile = await API.Common.writeHtmlofTpl('photos', null, QZone.Photos.ROOT + "/photos.html");
        console.info('生成相片列表HTML结束', infoFile, albums);

        for (const album of albums) {
            // 生成相片列表HTML
            console.info('生成相册的相片HTML开始', album);

            const name = API.Utils.filenameValidate(album.name);
            const albumFile = await API.Common.writeHtmlofTpl('photos_static', { album: album }, QZone.Photos.ROOT + "/" + name + ".html");

            console.info('生成相册的相片HTML结束', albumFile, album);
        }

    } catch (error) {
        console.error('导出相片到HTML异常', error, albums);
    }
    // 更新完成信息
    indicator.complete();
    return albums;
}

/**
 * 导出相片到MD文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosToMarkdown = async (albums) => {
    for (const album of albums) {
        let categoryName = album.className || QZone.Photos.Class[album.classid] || '其他';
        let albumName = API.Utils.filenameValidate(album.name);
        const photos = album.photoList || [];

        // 每个相册的进度器
        const indicator = new StatusIndicator('Photos_Images_Export');
        indicator.setIndex(album.name);
        indicator.setTotal(photos.length);
        indicator.addDownload(photos);

        const folderName = QZone.Photos.ROOT + '/' + categoryName + '/' + albumName;
        await API.Utils.createFolder(folderName);

        // 生成相片年份的MD文件
        const year_maps = API.Utils.groupedByTime(photos, 'uploadTime', 'year');
        for (const [year, year_photos] of year_maps) {
            let year_content = API.Photos.getPhotosMarkdownContents(year_photos);
            await API.Utils.writeText(year_content, folderName + "/" + year + '.md');
        }

        // 生成相册汇总的MD文件
        const album_content = API.Photos.getPhotosMarkdownContents(photos);
        await API.Utils.writeText(album_content, folderName + "/" + albumName + '.md');

        indicator.addSuccess(photos);
        indicator.complete();
    }
    return albums;
}

/**
 * 获取相片的MD内容
 * @param {Array} albums 相片列表
 */
API.Photos.getPhotosMarkdownContents = (photos) => {
    const contents = [];
    for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        // 相片名称
        contents.push('> ' + API.Common.formatContent(photo.name || '', 'MD'));
        contents.push('\r\n');

        // 相片
        if (photo.is_video) {
            // 视频
            contents.push('<video src="{0}" controls="controls" ></video>'.format(photo.custom_filename || photo.custom_url));
        } else {
            // 图片
            contents.push(API.Utils.getImagesMarkdown(photo.custom_filename || photo.custom_url || photo.url, photo.name));
        }
        contents.push('\r\n');

        // 相片描述
        contents.push('> ' + API.Common.formatContent(photo.desc || photo.name || '', 'MD'));
        contents.push('\r\n');

        // 相片评论
        contents.push('> 评论({0})'.format(photo.cmtTotal || 0));
        contents.push('\r\n');

        // 评论 TODO 兼容私密评论
        photo.comments = photo.comments || [];
        for (const comment of photo.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD');
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");
            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD');
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            const comment_images = comment.pic || [];
            for (const image of comment_images) {
                let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : image.custom_filepath
                // 添加评论图片
                contents.push(API.Utils.getImagesMarkdown(custom_url));
            }

            // 评论的回复
            const replies = comment.replies || [];
            for (const repItem of replies) {
                // 回复人
                const repName = API.Common.formatContent(repItem.poster.name, 'MD');
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");
                // 回复内容
                const content = API.Common.formatContent(repItem.content, 'MD');
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : repImg.custom_filepath
                    // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }
        contents.push('---');
    }
    return contents.join('\r\n');
}

/**
 * 导出相片到JSON文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosToJson = async (albums) => {
    let indicator = new StatusIndicator('Photos_Images_Export_Other');
    for (const album of albums) {
        const categoryName = album.className || QZone.Photos.Class[album.classid] || '其他';
        const albumName = API.Utils.filenameValidate(album.name);
        const photos = album.photoList || [];
        const json = JSON.stringify(photos);
        const folderName = QZone.Photos.ROOT + '/' + categoryName + '/' + albumName;
        await API.Utils.createFolder(folderName);
        await API.Utils.writeText(json, folderName + "/" + albumName + '.json');
    }
    indicator.complete();
    return albums;
}

/**
 * 导出类型是否为文件夹或文件
 */
API.Photos.isFile = () => {
    return QZone_Config.Photos.exportType == 'Folder' || QZone_Config.Photos.exportType == 'File'
}

/**
 * 根据相册ID获取相册列表中的相册
 * @param {Array} items 相册列表
 * @param {integer} albumId 模板相册ID
 */
API.Photos.getAlbumById = (items, albumId) => {
    items = items || [];
    // 获取指定相册数据
    const albumIndex = items.getIndex(albumId, 'id');
    const album = items[albumIndex];
    return album;
}

/**
 * 根据相册ID获取相册列表中的相片列表
 * @param {Array} items 相册列表
 * @param {integer} albumId 模板相册ID
 */
API.Photos.getPhotosByAlbumId = (items, albumId) => {
    const album = API.Photos.getAlbumById(items, albumId);
    if (!album) {
        return [];
    }
    return album.photoList || [];
}

/**
 * 是否增量条目
 * @param {integer} albumId 相册ID
 */
API.Photos.isNewAlbum = (albumId) => {
    if (!QZone.Photos.Album.OLD_Data || QZone.Photos.Album.OLD_Data.length === 0) {
        // 没有存在已备份数据的，当作新数据处理
        return true;
    }
    // 因为用户可以指定相册备份，不全量相册备份的情况下，不能直接取IncrementTime增量时间判断相片是否需要备份，IncrementTime仅适用全量备份的场景
    const album = API.Photos.getAlbumById(QZone.Photos.Album.OLD_Data, albumId);
    if (!album) {
        return true;
    }
    return API.Common.isNewItem(album);
}

/**
 * 是否增量条目
 * @param {integer} albumId 相册ID
 * @param {Object} photo 相片
 */
API.Photos.isNewItem = (albumId, photo) => {
    // 因为用户可以指定相册备份，不全量相册备份的情况下，不能直接取IncrementTime增量时间判断相片是否需要备份，IncrementTime仅适用全量备份的场景
    const album = API.Photos.getAlbumById(QZone.Photos.Album.OLD_Data, albumId);
    if (!album) {
        return true;
    }
    // 已备份相册，可以直接判断，其实也不严谨，先不处理
    // 存在一种场景有问题（如1号只备份A相册，2号A相册上传了相片，3号只备份B相册，这时IncrementTime已刷成3号，此时备份A相册将无法备份2号上传的相片）
    return API.Common.isNewItem(photo);
}

/**
 * 初始化相册列表
 */
API.Photos.initAlbums = async () => {
    let albumList = QZone.Photos.Album.Data || [];
    const selects = QZone.Photos.Album.Select || [];
    if (selects.length === 0) {
        // 用户没有选择时，默认获取所有相册列表
        albumList = await API.Photos.getAllAlbumList();
    } else {
        // 如果用户选择了备份指定的相册
        // 合并数据
        QZone.Photos.Album.Data = QZone.Photos.Album.Data.concat(selects);
        albumList = QZone.Photos.Album.Data;
    }
    // 处理增量相册
    // 合并、过滤数据
    QZone.Photos.Album.Data = API.Utils.unionItems(QZone.Photos.Album.OLD_Data, QZone.Photos.Album.Data);
    let albumIds = [];
    for (let i = QZone.Photos.Album.Data.length - 1; i >= 0; i--) {
        const album = QZone.Photos.Album.Data[i];
        if (albumIds.indexOf(album.id) > -1) {
            QZone.Photos.Album.Data.splice(i, 1);
            continue;
        }
        albumIds.push(album.id);
    }
    for (const item of albumList) {
        // 添加点赞Key
        item.uniKey = API.Photos.getUniKey(item.id);
    }
    return albumList;
}

/**
 * 获取相册赞记录
 * @param {Array} items 相册列表
 */
API.Photos.getAlbumsLikeList = async (items) => {
    if (!API.Common.isGetLike(QZone_Config.Photos)) {
        // 不获取赞
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Photos_Albums_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, QZone_Config.Common.downloadThread);

    // 获取点赞列表
    let count = 0;
    for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {

            const item = list[j];
            item.likes = item.likes || [];

            if (!API.Photos.isNewAlbum(item.id)) {
                // 已备份数据跳过不处理
                indicator.addSkip(item);
                continue;
            }

            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Photos).then((likes) => {
                console.info('获取相册点赞完成', likes);
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取相册点赞异常：", item, e);
                indicator.addFailed();
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 完成
    indicator.complete();

    return items;
}

/**
 * 获取相片赞记录
 * @param {Array} items 相片列表
 */
API.Photos.getPhotosLikeList = async (items) => {
    if (!API.Common.isGetLike(QZone_Config.Photos)) {
        // 不获取赞
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Photos_Images_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, QZone_Config.Common.downloadThread);

    // 获取点赞列表
    let count = 0;
    for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {

            const item = list[j];
            item.likes = item.likes || [];

            if (!API.Photos.isNewItem(item.albumId, item)) {
                // 已备份数据跳过不处理
                indicator.addSkip(item);
                continue;
            }

            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Photos).then((likes) => {
                console.info('获取相片点赞完成', likes);
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取相片点赞异常：", item, e);
                indicator.addFailed();
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 完成
    indicator.complete();

    return items;
}

/**
 * 转换数据
 */
API.Photos.addPhotoUniKey = (photos) => {
    for (const photo of photos) {
        // 添加点赞Key
        photo.uniKey = API.Photos.getPhotoUniKey(photo);
    }
}