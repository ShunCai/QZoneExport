/**
 * 用户个人档模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出用户个人档信息
 */
API.Common.exportUser = async () => {
    try {
        // 获取所有的QQ好友
        let userInfo = await API.Common.getUserInfos();

        userInfo = API.Utils.toJson(userInfo, /^_Callback\(/);
        userInfo = userInfo.data;

        // 更换用户图片
        userInfo.avatar = API.Utils.getUserLogoUrl(userInfo.uin);

        // 添加统计信息到用户信息
        userInfo.messages = QZone.Messages.Data.length;
        userInfo.blogs = QZone.Blogs.Data.length;
        userInfo.diaries = QZone.Diaries.Data.length;
        let photos = [];
        for (const album of QZone.Photos.Album.Data) {
            photos = photos.concat(album.photoList || []);
        }
        userInfo.photos = photos.length;
        userInfo.videos = QZone.Videos.Data.length;
        userInfo.boards = QZone.Boards.Data.length;
        userInfo.favorites = QZone.Favorites.Data.length;
        userInfo.friends = QZone.Friends.Data.length;

        // 根据导出类型导出数据
        await API.Common.exportUserToJson(userInfo);

    } catch (error) {
        console.error('导出用户个人档信息失败', error);
    }
}


/**
 * 导出QQ好友到JSON
 * @param {Array} friends 好友列表
 */
API.Common.exportUserToJson = async (userInfo) => {
    let json = JSON.stringify(userInfo);
    await API.Utils.writeText(json, QZone.User.ROOT + '/用户.json').then((fileEntry) => {
        console.info("导出用户个人档信息完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的JSON文件到FileSystem异常", error);
    });
}