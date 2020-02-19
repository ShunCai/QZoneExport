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

        // 获取所有相册的相片列表
        let imagesMapping = await API.Photos.getAllAlbumImageList(albumList);
        console.info('获取所有相册的所有相片列表完成', imagesMapping);

        // 获取所有相册的所有相片的评论列表
        let images = API.Photos.toImages(imagesMapping);
        images = await API.Photos.getAllImagesComments(images);
        console.info('获取所有相册的所有相片的评论列表完成', images);

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
        QZone.Photos.Album.total = data.albumsInUser || 0;
        indicator.setTotal(QZone.Photos.Album.total);

        let dataList = data.albumList || [];

        // 相片分类信息
        let classList = data.classList || [];
        for (const cls of classList) {
            QZone.Photos.Class[cls.id] = cls.name;
        }

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
    // console.debug("开始获取单个相册的指定页相片列表，当前页：", pageIndex + 1, item);
    // 显示当前处理相册
    indicator.index = item.name;

    // 更新获取中数据
    indicator.addDownload(Qzone_Config.Photos.Images.pageSize);

    return await API.Photos.getImages(item.id, pageIndex).then(async (data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^shine0_Callback\(/);
        data = data.data;

        // console.debug("成功获取单个相册的指定页相片列表，当前页：", pageIndex + 1, data);

        // 更新总数
        QZone.Photos.Images[item.id].total = data.totalInAlbum || 0;
        indicator.setTotal(data.totalInAlbum || 0);

        // 相片列表
        let dataList = data.photoList || [];

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

    let dataList = await nextPage(0, indicator);

    // 处理数据与添加下载任务
    await API.Photos.addDownloadTasks(item, dataList);

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
        if (item.allowAccess == 0) {
            // 没权限的跳过不获取
            console.warn("无权限访问该相册", item);
        }
        let photos = await API.Photos.getAlbumImageAllList(item);
        item.photoList = photos;
    }
    return QZone.Photos.Images;
}


/**
 * 获取单张相片的评论
 *  @param {Object} item 相片对象
 *  @param {integer} pageIndex 页索引
 */
API.Photos.getImagePageComments = async (item, pageIndex) => {
    return await API.Photos.getImageComments(item.albumId, item.lloc, pageIndex).then((data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        return data.data;
    });
}

/**
 * 获取单张相片的所有评论
 * @param {Object} item 相片对象
 * @param {StatusIndicator} indicator 进度更新器
 */
API.Photos.getImageComments = async (item, indicator) => {
    // 清空相册原有的评论
    item.comments = [];

    let CONFIG = Qzone_Config.Photos.Images.Comments;

    // 更新下载中
    indicator.addDownload(item);

    let nextPage = async function (item, pageIndex) {
        return await API.Photos.getImagePageComments(item, pageIndex).then(async (data) => {

            // 合并评论列表
            item.comments = item.comments.concat(data.comments || []);
            indicator.addSuccess(data.comments);

            // 是否还有下一页
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.forum, item.comments);
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
            let hasNextPage = API.Utils.hasNextPage(pageIndex + 1, CONFIG.pageSize, item.forum, item.comments);
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
    if (!Qzone_Config.Photos.Images.Comments.isGet || Qzone_Config.Photos.Images.exportType !== 'File') {
        return items;
    }
    for (let index = 0; index < items.length; index++) {
        // 相片评论进度更新器
        let indicator = new StatusIndicator('Photos_Images_Comments');
        const item = items[index];
        if (item.forum === 0) {
            // 没评论时，跳过
            continue;
        }
        // 更新总数
        indicator.setTotal(item.forum);
        indicator.setIndex(index + 1);
        await API.Photos.getImageComments(item, indicator);
        // 完成
        indicator.complete();
    }
    return items;
}

/**
 * 添加相片下载任务
 * @param {object} album 相册对象
 * @param {Array} photos 相片列表
 * @param {StatusIndicator} indicator 进度更新器
 */
API.Photos.addDownloadTasks = async (album, photos) => {
    let exportType = Qzone_Config.Photos.Images.exportType;
    if (exportType === 'JSON') {
        // JSON文件导出时，不需要添加下载任务
        return photos;
    }
    // 相片评论进度更新器
    let indicator = new StatusIndicator('Photos_Images_Mime');
    // 设置当前位置
    indicator.setIndex(album.name);
    // 设置总数
    indicator.setTotal(photos.length);
    for (let index = 0; index < photos.length; index++) {

        const photo = photos[index];

        // 更新下载中
        indicator.addDownload(photo);

        photo.albumId = album.id;
        photo.albumName = album.name;
        photo.albumClassId = album.classid;
        photo.albumClass = album.className || QZone.Photos.Class[album.classid] || '其他';

        let orderNumber = API.Utils.prefixNumber(index + 1, photos.length.toString().length);

        photo.custom_filename = API.Utils.filenameValidate(orderNumber + '_' + photo.name + '_' + API.Utils.newSimpleUid(8, 16));

        // 下载相对目录
        let moudel_dir = '相册/';

        // 默认高清
        let url = API.Photos.getDownloadUrl(photo, Qzone_Config.Photos.Images.exifType);
        url = API.Utils.toHttps(url);
        photo.custom_url = url;

        // 添加下载任务
        let albumClass = API.Utils.filenameValidate(photo.albumClass);
        let albumName = API.Utils.filenameValidate(photo.albumName);
        // 获取图片类型
        let suffix = await API.Utils.autoFileSuffix(url);
        if (suffix) {
            indicator.addSuccess(photo);
        } else {
            indicator.addFailed(photo);
        }
        photo.custom_filename = photo.custom_filename + suffix;
        let fileName = API.Utils.filenameValidate(photo.custom_filename);

        // 添加下载任务
        API.Utils.newDownloadTask(photo.custom_url, moudel_dir + albumClass + '/' + albumName, fileName);

        if (Qzone_Config.Photos.Images.exportType === 'File') {
            // 如果相片导出类型为文件时，则不处理评论的配图// 评论图片
            continue;
        }
        let comments = photo.comments || [];
        for (const comment of comments) {
            // 获取评论的图片
            let images = comment.pic || [];
            for (const image of images) {
                let url = image.hd_url || image.b_url;
                url = API.Utils.toHttps(url);
                image.custom_url = url;
                image.custom_filename = API.Utils.newSimpleUid(8, 16);
                // 获取图片类型
                let suffix = await API.Utils.autoFileSuffix(url);
                image.custom_filename = image.custom_filename + suffix;
                // 添加下载任务
                API.Utils.newDownloadTask(image.custom_url, moudel_dir + albumClass + '/' + albumName + '/评论图片', image.custom_filename);
            }
        }
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
    await API.Photos.exportAllPhotosToFiles(albums);
    // 导出相片
    await API.Photos.exportAllImagesToFiles(albums);
}

/**
 * 导出相册
 * @param {Array} albums 相册列表
 */
API.Photos.exportAllPhotosToFiles = async (albums) => {
    // 获取用户配置
    let exportType = Qzone_Config.Photos.exportType;
    switch (exportType) {
        case 'MarkDown':
            await API.Photos.exportPhotosMdToFiles(albums);
            break;
        case 'JSON':
            await API.Photos.exportPhotosJsonToFile(albums);
            break;
        default:
            break;
    }
}

/**
 * 导出相册到MD文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosMdToFiles = async (albums) => {
    let photoCls = QZone.Photos.Class;
    let indicator = new StatusIndicator('Photos_Export');
    indicator.setTotal(albums.length);
    for (const key in photoCls) {
        if (!photoCls.hasOwnProperty(key)) {
            continue;
        }
        const name = photoCls[key] || '其他';
        let contents = [];
        contents.push('### {0}'.format(name));
        let items = [];
        for (const item of albums) {
            let clsName = item.className || QZone.Photos.Class[item.classid] || '其他';
            if (name !== clsName) {
                continue;
            }
            let albumName = item.name;
            contents.push('\r\n\r\n---\r\n\r\n');
            contents.push('>***名称：***[{0}](https://user.qzone.qq.com/{1}/photo/{2})\r'.format(albumName, QZone.Common.Target.uin, item.id));
            contents.push('\r\n');
            contents.push('>[![{0}]({1})](https://user.qzone.qq.com/{2}/photo/{3})\r'.format(albumName, API.Photos.getPhotoPreUrl(item.pre), QZone.Common.Target.uin, item.id));
            contents.push('\r\n');
            contents.push('>***描述：***{0}\r\n'.format(item.desc || albumName));
            items.push(item);
        }
        indicator.addDownload(items);
        let content = contents.join('');
        let categoryName = API.Utils.filenameValidate(name);
        let folderName = QZone.Common.Config.ZIP_NAME + '/相册/' + categoryName;
        await API.Utils.siwtchToRoot();
        await API.Utils.createFolder(folderName);
        let filepath = folderName + '/' + categoryName + ".md";
        await API.Utils.writeText(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(items);
        }).catch((e) => {
            indicator.addFailed(items);
            console.error('写入相册MD文件异常', e);
        })
    }
    indicator.complete();
    return albums;
}

/**
 * 导出相册到JSON文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportPhotosJsonToFile = async (albums) => {
    let indicator = new StatusIndicator('Photos_Export');
    indicator.setTotal(albums.length);
    let json = JSON.stringify(albums);
    await API.Utils.writeText(json, QZone.Photos.ROOT + '/相册.json').then((fileEntry) => {
        console.info('导出相册JSON文件到FileSystem完成', albums, fileEntry);
        indicator.addSuccess(albums);
    }).catch((error) => {
        console.info('导出相册JSON文件到FileSystem异常', albums, error);
        indicator.addFailed(albums);
    });
    indicator.complete();
}


/**
 * 导出相片
 * @param {Array} albums 相册列表
 */
API.Photos.exportAllImagesToFiles = async (albums) => {
    // 获取用户配置
    let exportType = Qzone_Config.Photos.Images.exportType;
    switch (exportType) {
        case 'MarkDown':
            await API.Photos.exportImagesMdToFiles(albums);
            break;
        case 'JSON':
            await API.Photos.exportImagesJsonToFile(albums);
            break;
        default:
            break;
    }
}

/**
 * 导出相片到MD文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportImagesMdToFiles = async (albums) => {

}

/**
 * 导出相片到JSON文件
 * @param {Array} albums 相册列表
 */
API.Photos.exportImagesJsonToFile = async (albums) => {
    let photoCls = QZone.Photos.Class;
    for (const key in photoCls) {
        if (!photoCls.hasOwnProperty(key)) {
            continue;
        }
        let categoryName = photoCls[key] || '其他';
        categoryName = API.Utils.filenameValidate(categoryName);
        for (const album of albums) {
            let albumName = API.Utils.filenameValidate(album.name);
            const photos = album.photoList || [];
            let indicator = new StatusIndicator('Photos_Images_Export');
            indicator.setIndex(album.name);
            indicator.setTotal(photos.length);
            let json = JSON.stringify(photos);
            indicator.addDownload(photos);
            let folderName = QZone.Photos.ROOT + '/' + categoryName + '/' + albumName;
            await API.Utils.siwtchToRoot();
            await API.Utils.createFolder(folderName);
            await API.Utils.writeText(json, folderName + "/" + albumName + '.json');
            indicator.addSuccess(photos);
            indicator.complete();
        }
    }
    return true;
}