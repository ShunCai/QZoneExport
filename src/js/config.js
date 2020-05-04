// 默认配置
const Default_Config = {
    // 公共配置
    Common: {
        // 重试次数
        listRetryCount: 2,
        // 重试间隔
        listRetrySleep: 1,
        // 文件下载类型
        downloadType: 'File',
        // 自动识别文件后缀
        isAutoFileSuffix: false,
        // 后缀识别超时秒数
        autoFileSuffixTimeOut: 30,
        // 迅雷任务数        
        thunderTaskNum: 5000,
        // 唤起迅雷间隔        
        thunderTaskSleep: 60,
        // 文件下载并发数        
        downloadThread: 10,
        // 是否启用下载状态栏提醒
        enabledShelf: true,
        // 生成内容是否包含其他空间用户链接
        hasUserLink: true
    },
    // 说说模块
    Messages: {
        exportType: "HTML",// 内容备份类型
        pageSize: 20,
        randomSeconds: {
            min: 1,
            max: 2
        },
        isFull: true, //是否获取全文
        Comments: {
            isFull: true, //是否全部评论
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 日志模块
    Blogs: {
        exportType: "HTML",// 内容备份类型
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Info: {
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Comments: {
            isFull: true, //是否全部评论
            pageSize: 50,
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 私密日记模块
    Diaries: {
        exportType: "HTML",// 内容备份类型
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Info: {
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 相册模块
    Photos: {
        exportType: "HTML",
        pageSize: 3000,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Comments: {
            isGet: false, // 是否获取评论，默认不获取
            pageSize: 100,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Images: {
            pageSize: 90,
            exifType: "raw",
            randomSeconds: {
                min: 1,
                max: 2
            },
            Comments: {
                isGet: false, // 是否获取评论，默认不获取
                pageSize: 100,
                randomSeconds: {
                    min: 1,
                    max: 2
                }
            }
        }
    },
    // 视频模块
    Videos: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20
    },
    // 留言板模块
    Boards: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20
    },
    // QQ好友模块
    Friends: {
        exportType: "HTML",
        hasAddTime: true
    },
    // 收藏夹模块
    Favorites: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 30
    },
};

// 用户配置
let Qzone_Config = {
    // 公共配置
    Common: {
        // 重试次数
        listRetryCount: 2,
        // 重试间隔
        listRetrySleep: 1,
        // 文件下载类型
        downloadType: 'File',
        // 自动识别文件后缀
        isAutoFileSuffix: false,
        // 后缀识别超时秒数
        autoFileSuffixTimeOut: 30,
        // 迅雷任务数        
        thunderTaskNum: 5000,
        // 唤起迅雷间隔        
        thunderTaskSleep: 60,
        // 文件下载并发数        
        downloadThread: 10,
        // 是否启用下载状态栏提醒
        enabledShelf: true,
        // 生成内容是否包含其他空间用户链接
        hasUserLink: true
    },
    // 说说模块
    Messages: {
        exportType: "HTML",// 内容备份类型
        pageSize: 20,
        randomSeconds: {
            min: 1,
            max: 2
        },
        isFull: true, //是否获取全文
        Comments: {
            isFull: true, //是否全部评论
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 日志模块
    Blogs: {
        exportType: "HTML",// 内容备份类型
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Info: {
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Comments: {
            isFull: true, //是否全部评论
            pageSize: 50,
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 私密日记模块
    Diaries: {
        exportType: "HTML",// 内容备份类型
        pageSize: 50,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Info: {
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 相册模块
    Photos: {
        exportType: "HTML",
        pageSize: 3000,
        randomSeconds: {
            min: 1,
            max: 2
        },
        Comments: {
            isGet: false, // 是否获取评论，默认不获取
            pageSize: 100,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Images: {
            pageSize: 90,
            exifType: "raw",
            randomSeconds: {
                min: 1,
                max: 2
            },
            Comments: {
                isGet: false, // 是否获取评论，默认不获取
                pageSize: 100,
                randomSeconds: {
                    min: 1,
                    max: 2
                }
            }
        }
    },
    // 视频模块
    Videos: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20
    },
    // 留言板模块
    Boards: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20
    },
    // QQ好友模块
    Friends: {
        exportType: "HTML",
        hasAddTime: true
    },
    // 收藏夹模块
    Favorites: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 30
    },
};

const FOLDER_ROOT = '/QQ空间备份/';
const QZone = {
    Common: {
        ROOT: FOLDER_ROOT + 'Common',
        ExportType: {
            "MESSAGES_LIST": true,
            "BLOG_LIST": true,
            "DIARY_LIST": true,
            "PHOTO_LIST": true,
            "VIDEO_LIST": true,
            "BOARD_LIST": true,
            "FRIEND_LIST": true,
            "FAVORITE_LIST": true
        },
        Owner: {
            uin: undefined
        },
        Target: {
            uin: undefined,
            route: 102
        },
        Config: {
            ZIP_NAME: 'QQ空间备份'
        },
        FILE_URLS: new Map(),
        Zip: window['JSZip'] ? new JSZip() : undefined,
        MD: window['TurndownService'] ? new TurndownService() : undefined,
        Filer: window['Filer'] ? new Filer() : undefined,
        ExportFiles: [
            {
                original: 'export/css/common.css',
                target: FOLDER_ROOT + 'Common/css/common.css'
            }, {
                original: 'export/js/sidebar.js',
                target: FOLDER_ROOT + 'Common/js/sidebar.js'
            }, {
                original: 'export/images/index.jpg',
                target: FOLDER_ROOT + 'Common/images/index.jpg'
            }, {
                original: 'export/images/video-play.png',
                target: FOLDER_ROOT + 'Common/images/video-play.png'
            }, {
                original: 'vendor/template/template.js',
                target: FOLDER_ROOT + 'Common/js/template.js'
            }, {
                original: 'export/js/common.js',
                target: FOLDER_ROOT + 'Common/js/common.js'
            }, {
                original: 'export/js/blogs.js',
                target: FOLDER_ROOT + 'Common/js/blogs.js'
            }, {
                original: 'export/js/bloginfo.js',
                target: FOLDER_ROOT + 'Common/js/bloginfo.js'
            }, {
                original: 'export/js/diaries.js',
                target: FOLDER_ROOT + 'Common/js/diaries.js'
            }, {
                original: 'export/js/diaryinfo.js',
                target: FOLDER_ROOT + 'Common/js/diaryinfo.js'
            }, {
                original: 'export/js/friends.js',
                target: FOLDER_ROOT + 'Common/js/friends.js'
            }, {
                original: 'export/js/photos.js',
                target: FOLDER_ROOT + 'Common/js/photos.js'
            }, {
                original: 'export/js/videos.js',
                target: FOLDER_ROOT + 'Common/js/videos.js'
            }
        ]
    },
    // QQ好友模块
    Friends: {
        ROOT: FOLDER_ROOT + 'Friends',
        Data: []
    },
    // 日志模块
    Blogs: {
        ROOT: FOLDER_ROOT + 'Blogs',
        IMAGES_ROOT: FOLDER_ROOT + 'Blogs/Images',
        Data: [],
        FILE_URLS: new Map()
    },
    // 私密日记模块
    Diaries: {
        ROOT: FOLDER_ROOT + 'Diaries',
        IMAGES_ROOT: FOLDER_ROOT + 'Diaries/Images',
        Data: [],
        FILE_URLS: new Map()
    },
    // 相册模块
    Photos: {
        ROOT: FOLDER_ROOT + 'Albums',
        Album: {
            total: 0,
            Data: []
        },
        Images: {

        },
        // 相册分类
        Class: {
            100: "最爱",
            101: "人物",
            102: "风景",
            103: "动物",
            104: "游记",
            105: "卡通",
            106: "生活",
            107: "其他"
        },
        // 相册权限
        Access: {
            1: "所有人可见",
            2: "密码访问",
            3: "仅自己可见",
            4: "QQ好友可见",
            5: "回答问题的人可见",
            6: "部分好友可见",
            8: "部分好友不可见"
        },
        // 相册权限分类
        AccessType: {
            1: "公开",
            3: "仅主人可见",
            4: "好友和同学可见"
        },
        // 相册类型
        ViewType: {
            1: "个性",
            5: "亲子",
            6: "旅游",
            7: "校友"
        },
        FILE_URLS: new Map()
    },
    // 视频模块
    Videos: {
        ROOT: FOLDER_ROOT + 'Videos',
        Data: [],
        FILE_URLS: new Map()
    },
    // 说说模块
    Messages: {
        ROOT: FOLDER_ROOT + 'Messages',
        IMAGES_ROOT: FOLDER_ROOT + 'Messages/Images',
        Data: [],
        FILE_URLS: new Map()
    },
    // 留言板模块
    Boards: {
        ROOT: FOLDER_ROOT + 'Boards',
        Data: [],
        FILE_URLS: new Map()
    },
    // 收藏夹模块
    Favorites: {
        ROOT: FOLDER_ROOT + 'Favorites',
        IMAGES_ROOT: FOLDER_ROOT + 'Favorites/Images',
        Data: [],
        FILE_URLS: new Map()
    }
};