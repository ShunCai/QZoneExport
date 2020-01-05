// 默认配置
var Qzone_Config = {
    // 说说模块
    Messages: {
        exportType: "markdown",
        pageSize: 40,
        randomSeconds: {
            min: 1,
            max: 3
        },
        Comments: {
            isFull: true,
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 3
            }
        }
    },
    // 日志模块
    Blogs: {
        exportType: "markdown",
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 3
        },
        Comments: {
            isFull: true,
            pageSize: 50,
            randomSeconds: {
                min: 1,
                max: 3
            }
        }
    },
    // 私密日记模块
    Diaries: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 50
    },
    // 相册模块
    Photos: {
        exportType: "file",
        querySleep: 2,
        pageSize: 90,
        downCount: 5,
        exifType: "hd"
    },
    // 视频模块
    Videos: {
        exportType: "downlist",
        querySleep: 2,
        pageSize: 20
    },
    // 留言板模块
    Boards: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 20
    },
    // QQ好友模块
    Friends: {
        exportType: "excel"
    },
    // 收藏夹模块
    Favorites: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 20
    },
};

const FOLDER_ROOT = '/QQ空间备份/';
var QZone = {
    Common: {
        Owner: {

        },
        Target: {

        },
        Config: {
            ZIP_NAME: 'QQ空间备份'
        },
        Zip: null,
        Filer: null
    },
    // QQ好友模块
    Friends: {
        ROOT: FOLDER_ROOT + '好友',
        Data: [],
        Images: []
    },
    // 日志模块
    Blogs: {
        ROOT: FOLDER_ROOT + '日志',
        IMAGES_ROOT: FOLDER_ROOT + '日志/images',
        Data: [],
        Images: []
    },
    // 私密日记模块
    Diaries: {
        ROOT: FOLDER_ROOT + '私密日记',
        IMAGES_ROOT: FOLDER_ROOT + '私密日记/images',
        Data: [],
        Images: []
    },
    // 相册模块
    Photos: {
        ROOT: FOLDER_ROOT + '相册',
        Data: [],
        Images: []
    },
    // 视频模块
    Videos: {
        ROOT: FOLDER_ROOT + '视频',
        Data: []
    },
    // 说说模块
    Messages: {
        ROOT: FOLDER_ROOT + '说说',
        IMAGES_ROOT: FOLDER_ROOT + '说说/images',
        Data: [],
        Images: []
    },
    // 留言板模块
    Boards: {
        ROOT: FOLDER_ROOT + '留言板',
        Data: [],
        Images: []
    },
    // 收藏夹模块
    Favorites: {
        ROOT: FOLDER_ROOT + '收藏夹',
        Data: [],
        Images: []
    }
};