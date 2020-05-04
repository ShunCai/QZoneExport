/**
 * QQ空间相册模块的导出A
 * @author https://lvshuncai.com
 */


/**
 * 导出相册数据
 */
API.Photos.export = async () => {
    try {
        // 获取所有的相册列表
        let albumList = QZone.Photos.Album.Data || [];
        if (albumList.length === 0) {
            // 相册列表为空时才获取相册列表，不为空时代表是指定相册备份
            albumList = await API.Photos.getAllAlbumList();
        }
        console.info('获取所有的相册列表完成', albumList);

        // 获取相册的评论列表
        albumList = await API.Photos.getAllAlbumsComments(albumList);

        // 获取所有相册的相片列表
        let imagesMapping = await API.Photos.getAllAlbumImageList(albumList);
        console.info('获取所有相册的所有相片列表完成', imagesMapping);

        // 获取所有相片的详情
        albumList = await API.Photos.getAllImagesInfos(albumList);

        // 获取相片的评论列表
        let images = API.Photos.toImages(imagesMapping);
        images = await API.Photos.getAllImagesComments(images);
        console.info('获取所有相册的所有相片的评论列表完成', images);

        // 添加相片下载任务
        await API.Photos.addAlbumsDownloadTasks(albumList);

        // 根据导出类型导出数据    
        await API.Photos.exportAllListToFiles(albumList);
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

    for (let i = 0; i < albumList.length; i++) {
        const album = albumList[i];

        // 进度更新器
        let indicator = new StatusIndicator('Photos_Images_Info');

        // 开始
        indicator.print();

        // 设置当前相册
        indicator.setIndex(album.name);

        let photos = album.photoList || [];

        // 设置总数
        indicator.setTotal(photos.length);

        // 同时请求数（提高相片处理速度）
        const _photos = _.chunk(photos, Qzone_Config.Common.downloadThread);
        for (let j = 0; j < _photos.length; j++) {
            const list = _photos[j];
            let imageInfoTasks = [];
            for (let k = 0; k < list.length; k++) {
                const photo = list[k];
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
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        delete photo[key];
                    }
                    Object.assign(photo, data[0]);

                    // 更新相片的分类信息
                    photo.albumClassId = album.classid;
                    photo.albumClassName = album.className || QZone.Photos.Class[album.classid] || '其他';

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
    console.debug("开始获取相册列表，当前页：", pageIndex + 1);

    // 状态更新器当前页
    indicator.setIndex(pageIndex + 1);

    // 更新获取中数据
    indicator.addDownload(Qzone_Config.Photos.pageSize);

    // 查询相册
    return await API.Photos.getAlbums(pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data;

        console.debug("成功获取相册列表，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Photos.Album.total = data.albumsInUser || QZone.Album.total || 0;
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
    // 重置数据
    QZone.Photos.Album.Data = [];

    // 进度更新器
    let indicator = new StatusIndicator('Photos');

    // 开始
    indicator.print();

    let CONFIG = Qzone_Config.Photos;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Photos.getAlbumPageList(pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Photos.Album.Data = QZone.Photos.Album.Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Photos.Album.total, QZone.Photos.Album.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Photos.Album.Data;
        }).catch(async (e) => {
            console.error("获取相册列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Photos.Album.total, QZone.Photos.Album.Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Photos.Album.Data;
        });
    }

    let albums = await nextPage(0, indicator);

    // 更新相册类别
    for (const album of albums) {
        album.className = QZone.Photos.Class[album.classid] || '其他';
    }

    // 完成
    indicator.complete();

    return albums;

}

/**
 * 获取单个相册的指定页相片列表
 * @param {Object} item 相册
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Photos.getAlbumImagePageList = async (item, pageIndex, indicator) => {
    // 显示当前处理相册
    indicator.index = item.name;

    // 更新获取中数据
    indicator.addDownload(Qzone_Config.Photos.Images.pageSize);

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
 * @param {Object} item 相册
 */
API.Photos.getAlbumImageAllList = async (item) => {
    // 重置单个相册的数据
    QZone.Photos.Images[item.id] = {
        total: 0,
        Data: []
    };
    // 进度更新器
    let indicator = new StatusIndicator('Photos_Images');
    // 开始
    indicator.print();

    // 相册相片配置项
    let CONFIG = Qzone_Config.Photos.Images;

    let nextPage = async function (pageIndex, indicator) {
        return await API.Photos.getAlbumImagePageList(item, pageIndex, indicator).then(async (dataList) => {
            // 添加到全局变量
            QZone.Photos.Images[item.id].Data = QZone.Photos.Images[item.id].Data.concat(dataList);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Photos.Images[item.id].total, QZone.Photos.Images[item.id].Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Photos.Images[item.id].Data;
        }).catch(async (e) => {
            console.error("获取相册列表异常，当前页：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, QZone.Photos.Images[item.id].total, QZone.Photos.Images[item.id].Data);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(pageIndex + 1, indicator);
            }
            return QZone.Photos.Images[item.id].Data;
        });
    }

    let dataList = await nextPage(0, indicator) || [];

    // 完成
    indicator.complete();

    return dataList;
}

/**
 * 获取指定相册的相片列表
 * @param {Array} items 相册列表
 */
API.Photos.getAllAlbumImageList = async (items) => {
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
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

    let CONFIG = Qzone_Config.Photos.Comments;

    // 更新下载中
    indicator.addDownload(item);

    let nextPage = async function (item, pageIndex) {
        return await API.Photos.getAlbumComments(item.id, pageIndex).then(async (data) => {

            // 去掉函数，保留json
            data = API.Utils.toJson(data, /^_Callback\(/);
            data = data.data;

            // 合并评论列表
            item.comments = item.comments.concat(data.comments || []);
            indicator.addSuccess(data.comments);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.comment, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        }).catch(async (e) => {
            console.error("获取单个相册的评论列表异常：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.comment, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        });
    }

    await nextPage(item, 0);

    return item.comments;
}


/**
 * 获取所有的相册的评论
 * @param {Array} items 相册列表
 */
API.Photos.getAllAlbumsComments = async (items) => {
    // 是否需要获取相册的评论
    if (!Qzone_Config.Photos.Comments.isGet || API.Photos.isFile()) {
        return items;
    }
    for (let index = 0; index < items.length; index++) {
        // 相册评论进度更新器
        let indicator = new StatusIndicator('Photos_Albums_Comments');
        const item = items[index];
        if (item.comment === 0) {
            // 没评论时，跳过
            continue;
        }
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

    let CONFIG = Qzone_Config.Photos.Images.Comments;

    // 更新下载中
    indicator.addDownload(item);

    let nextPage = async function (item, pageIndex) {
        return await API.Photos.getImageComments(item.albumId, item.lloc, pageIndex).then(async (data) => {

            // 去掉函数，保留json
            data = API.Utils.toJson(data, /^_Callback\(/);
            data = data.data;

            // 合并评论列表
            item.comments = item.comments.concat(data.comments || []);
            indicator.addSuccess(data.comments);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.cmtTotal, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        }).catch(async (e) => {
            console.error("获取单张相片的评论列表异常：", pageIndex + 1, item, e);
            indicator.addFailed({
                pageIndex: pageIndex,
                pageSize: CONFIG.pageSize,
                isPage: true
            });
            // 当前页失败后，跳过继续请求下一页
            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.cmtTotal, item.comments);
            if (hasNextPage) {
                // 请求一页成功后等待一秒再请求下一页
                let min = CONFIG.randomSeconds.min;
                let max = CONFIG.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, pageIndex + 1);
            }
            return item.comments;
        });
    }

    await nextPage(item, 0);

    return item.comments;
}

/**
 * 获取所有的相片的评论
 * @param {Array} items 相片列表
 */
API.Photos.getAllImagesComments = async (items) => {
    // 是否需要获取相片的评论
    if (!Qzone_Config.Photos.Images.Comments.isGet || API.Photos.isFile()) {
        return items;
    }
    for (let index = 0; index < items.length; index++) {
        // 相片评论进度更新器
        let indicator = new StatusIndicator('Photos_Images_Comments');
        const item = items[index];
        if (item.cmtTotal === 0) {
            // 没评论时，跳过
            continue;
        }
        // 更新总数
        indicator.setTotal(item.cmtTotal);
        indicator.setIndex(index + 1);
        await API.Photos.getImageAllComments(item, indicator);
        // 完成
        indicator.complete();
    }
    return items;
}


/**
 * 添加所有相册的相片下载任务
 * @param {object} albums 相册列表
 */
API.Photos.addAlbumsDownloadTasks = async (albums) => {
    // 下载相对目录
    let module_dir = 'Albums/';

    for (let index = 0; index < albums.length; index++) {
        const album = albums[index];
        let photos = album.photoList || [];

        // 添加相册预览图的下载任务
        await API.Photos.addPreviewDownloadTasks(album, 'Albums/Images');

        // 添加评论的图片的下载任务
        await API.Photos.addCommentDownloadTasks(album, 'Albums/Images');

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
    let indicator = new StatusIndicator('Photos_Images_Mime');
    // 设置当前位置
    indicator.setIndex(album.name);
    // 设置总数
    indicator.setTotal(photos.length);

    for (let index = 0; index < photos.length; index++) {

        const photo = photos[index];

        // 处理中
        indicator.addDownload(photo);

        let orderNumber = API.Utils.prefixNumber(index + 1, photos.length.toString().length);

        const albumClass = API.Utils.filenameValidate(album.className);
        const albumName = API.Utils.filenameValidate(album.name);
        const albumFolder = 'Albums/' + albumClass + '/' + albumName;

        if (API.Common.isQzoneUrl()) {
            // QQ空间外链导出时，不需要添加下载任务，但是需要处理
            // 根据配置的清晰度匹配图片，默认高清
            photo.custom_url = API.Photos.getDownloadUrl(photo, Qzone_Config.Photos.Images.exifType);
        } else {
            // 非QQ空间外链导出时，需要添加下载任务
            // 如果相片是视频，需要下载视频

            if (photo.is_video && photo.video_info) {
                // 预览图与视频共用一个文件名
                let filename = API.Utils.filenameValidate(orderNumber + '_' + photo.name + '_' + API.Utils.newSimpleUid(8, 16));

                // 下载预览图
                // 根据配置的清晰度匹配图片，默认高清
                photo.custom_url = API.Photos.getDownloadUrl(photo, Qzone_Config.Photos.Images.exifType);
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
                photo.custom_url = API.Photos.getDownloadUrl(photo, Qzone_Config.Photos.Images.exifType);

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
    let exportType = Qzone_Config.Photos.exportType;
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
        let albumName = album.name;
        // 相册名称与地址
        let albumUrl = API.Photos.getAlbumUrl(QZone.Common.Target.uin, album.id);
        contents.push('> ' + API.Utils.getLink(albumUrl, albumName, "MD"));
        contents.push('\r\n');
        // 相册预览图
        let pre = API.Common.isQzoneUrl() ? (album.url || API.Photos.getPhotoPreUrl(album.pre)) : '../' + album.custom_filepath;
        contents.push('>[![{0}]({1})](https://user.qzone.qq.com/{2}/photo/{3}) '.format(albumName, pre, QZone.Common.Target.uin, album.id));
        contents.push('\r\n');
        contents.push('>{0} '.format(album.desc || albumName));
        contents.push('\r\n');
        album.comments = album.comments || [];
        contents.push('> 评论({0})'.format(album.comments.length));
        contents.push('\r\n');
        // 评论
        for (let i = 0; i < album.comments.length; i++) {
            const comment = album.comments[i];
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD');
            let content = API.Common.formatContent(comment.content, 'MD');
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");
            contents.push("* {0}：{1}".format(poster_display, content));
            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : '../' + image.custom_filepath;
                    // 添加评论图片
                    contents.push(API.Utils.getMdImage(custom_url));
                }
            }
            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {
                let repName = API.Common.formatContent(repItem.poster.name, 'MD');
                let content = API.Common.formatContent(repItem.content, 'MD');
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));
                if (repItem.pictotal > 0) {
                    var repImgs = repItem.pic || [];
                    for (const repImg of repImgs) {
                        // 回复包含图片
                        let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                        custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : '../' + repImg.custom_filepath;
                        // 添加回复评论图片
                        contents.push(API.Utils.getMdImage(custom_url));
                    }
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
    let exportType = Qzone_Config.Photos.exportType;
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
        let indicator = new StatusIndicator('Photos_Images_Export');
        indicator.setIndex(album.name);
        indicator.setTotal(photos.length);
        indicator.addDownload(photos);

        let folderName = QZone.Photos.ROOT + '/' + categoryName + '/' + albumName;
        await API.Utils.createFolder(folderName);

        // 生成相片年份的MD文件
        let year_maps = API.Utils.groupedByTime(photos, 'uploadTime', 'year');
        for (const [year, year_photos] of year_maps) {
            let year_content = API.Photos.getPhotosMarkdownContents(year_photos);
            await API.Utils.writeText(year_content, folderName + "/" + year + '.md');
        }

        // 生成相册汇总的MD文件
        let album_content = API.Photos.getPhotosMarkdownContents(photos);
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
    let contents = [];
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
            contents.push(API.Utils.getMdImage(photo.custom_filename || photo.custom_url || photo.url, photo.name));
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

        for (let i = 0; i < photo.comments.length; i++) {
            const comment = photo.comments[i];
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD');
            let content = API.Common.formatContent(comment.content, 'MD');
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : image.custom_filepath
                    // 添加评论图片
                    contents.push(API.Utils.getMdImage(custom_url));
                }
            }

            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {
                let repName = API.Common.formatContent(repItem.poster.name, 'MD');
                let content = API.Common.formatContent(repItem.content, 'MD');
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));
                if (repItem.pictotal > 0) {
                    var repImgs = repItem.pic || [];
                    for (const repImg of repImgs) {
                        // 回复包含图片
                        let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                        custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : repImg.custom_filepath
                        // 添加回复评论图片
                        contents.push(API.Utils.getMdImage(custom_url));
                    }
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
        let categoryName = album.className || QZone.Photos.Class[album.classid] || '其他';
        let albumName = API.Utils.filenameValidate(album.name);
        const photos = album.photoList || [];
        let json = JSON.stringify(photos);
        let folderName = QZone.Photos.ROOT + '/' + categoryName + '/' + albumName;
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
    return Qzone_Config.Photos.exportType == 'Folder' || Qzone_Config.Photos.exportType == 'File'
}
