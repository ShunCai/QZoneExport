// 默认配置
var Default_Config = {
    // 公共配置
    Common: {
        // 是否禁用下载状态栏提醒
        enabledShelf: true
    },
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
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 3
        }
    },
    // 相册模块
    Photos: {
        exportType: "folder",
        pageSize: 90,
        randomSeconds: {
            min: 1,
            max: 3
        },
        Images: {
            exportType: "file",
            pageSize: 90,
            downloadType: 'zip',
            downloadThread: 5,
            exifType: "hd",
            randomSeconds: {
                min: 1,
                max: 3
            }
        }
    },
    // 视频模块
    Videos: {
        exportType: "downlist",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
    // 留言板模块
    Boards: {
        exportType: "markdown",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
    // QQ好友模块
    Friends: {
        exportType: "excel"
    },
    // 收藏夹模块
    Favorites: {
        exportType: "markdown",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
};

// 用户配置
var Qzone_Config = {
    // 公共配置
    Common: {
        // 是否禁用下载状态栏提醒
        enabledShelf: true
    },
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
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 3
        }
    },
    // 相册模块
    Photos: {
        exportType: "folder",
        pageSize: 90,
        randomSeconds: {
            min: 1,
            max: 3
        },
        Images: {
            exportType: "file",
            pageSize: 90,
            downloadType: 'zip',
            downloadThread: 5,
            exifType: "hd",
            randomSeconds: {
                min: 1,
                max: 3
            }
        }
    },
    // 视频模块
    Videos: {
        exportType: "downlist",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
    // 留言板模块
    Boards: {
        exportType: "markdown",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
    // QQ好友模块
    Friends: {
        exportType: "excel"
    },
    // 收藏夹模块
    Favorites: {
        exportType: "markdown",
        randomSeconds: {
            min: 1,
            max: 3
        },
        pageSize: 20
    },
};


const FOLDER_ROOT = '/QQ空间备份/';
var QZone = {
    Common: {
        ExportType: {
            "MESSAGES_LIST": true,
            "BLOG_LIST": true,
            "DIARY_LIST": true,
            "PHOTO_LIST": true,
            "VIDEO_LIST": true,
            "BOARD_LIST": true,
            "FRIEND_LIST": true,
            "FAVORITES_LIST": true
        },
        Owner: {
            uin: undefined,
            name: undefined
        },
        Target: {
            uin: undefined,
            name: undefined,
            title: undefined
        },
        Config: {
            ZIP_NAME: 'QQ空间备份'
        },
        Zip: window['JSZip'] ? new JSZip() : undefined,
        MD: window['TurndownService'] ? new TurndownService() : undefined,
        Filer: window['Filer'] ? new Filer() : undefined
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