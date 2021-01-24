
/**
 * 默认配置
 */
const Default_Config = {
    // 公共配置
    Common: {
        // 重试次数
        listRetryCount: 2,
        // 重试间隔
        listRetrySleep: 1,
        // 文件下载类型
        downloadType: 'File',
        Aria2: {
            rpc: 'http://localhost:6800/jsonrpc',
            token: undefined
        },
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
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "created_time",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        },
        isFilterKeyword: false,// 是否过滤关键字
        FilterKeyWords: [
            '促销',
            '下单',
            "抢购",
            "抢购价",
            '特价',
            '秒杀',
            '秒杀价',
            '包邮',
            '免费',
            '爽肤水',
            '唇膏',
            '面膜',
            '现货&&送礼',
            '优惠',
            '广受好评',
            '预购从速',
            '福利',
            '不计成本',
            '售完即止',
            '清货',
            '清货价',
            '清仓',
            '清仓价',
            '低价',
            '低价出售',
            '数量有限',
            '先到先得',
            '洗面奶',
            '眼霜',
            '免费领取',
            '0元抢购'
        ],
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Visitor: {
            isGet: false, //是否获取最近访问
            pageSize: 24,
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
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "pubtime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        },
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Visitor: {
            isGet: false, //是否获取最近访问
            pageSize: 24,
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
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "pubtime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
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
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "uploadTime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        },
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Visitor: {
            isGet: false, //是否获取最近访问
            pageSize: 24,
            randomSeconds: {
                min: 1,
                max: 2
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
        pageSize: 20,
        Comments: {
            isGet: false, // 是否获取评论，默认不获取
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "uploadTime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        },
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 留言板模块
    Boards: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20,
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "pubtime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        }
    },
    // QQ好友模块
    Friends: {
        exportType: "HTML", // 导出类型
        hasAddTime: true,// 是否获取好友添加时间
        isIncrement: false // 是否增量备份
    },
    // 收藏夹模块
    Favorites: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 30,
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "create_time",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        }
    },
    // 分享模块
    Shares: {
        exportType: "HTML",// 内容备份类型
        pageSize: 10,
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
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "shareTime",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        },
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        Visitor: {
            isGet: false, //是否获取最近访问
            pageSize: 24,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        SourceType: [{
            name: "QQ空间秘密",
            regulars: [
                'zone.qq.com/secret'
            ]
        }, {
            name: "手机QQ空间",
            regulars: [
                'mobile.qzone.qq.com'
            ]
        }, {
            name: "QQ空间",
            regulars: [
                'qzone.qq.com'
            ]
        }, {
            name: "QQ音乐",
            regulars: [
                'y.qq.com', 'i.y.qq.com', 'music.qq.com'
            ]
        }, {
            name: "网易云音乐",
            regulars: [
                'music.163.com', 'y.music.163.com'
            ]
        }, {
            name: "酷狗音乐",
            regulars: [
                'kugou.com', 'm.kugou.com', 't1.kugou.com'
            ]
        }, {
            name: "全民K歌",
            regulars: [
                'kg.qq.com', 'kg2.qq.com'
            ]
        }, {
            name: "匿问我答",
            regulars: [
                'ti.qq.com'
            ]
        }, {
            name: "微信公众号",
            regulars: [
                'mp.weixin.qq.com'
            ]
        }, {
            name: "天天爱消除",
            regulars: [
                'peng.qq.com'
            ]
        }, {
            name: "QQ手游中心",
            regulars: [
                'gamecenter.qq.com', 'youxi.vip.qq.com'
            ]
        }, {
            name: "知乎",
            regulars: [
                'zhihu.com', 'm.zhihu.com'
            ]
        }, {
            name: "新浪微博",
            regulars: [
                'weibo.com', 'm.weibo.cn'
            ]
        }, {
            name: "腾讯看点",
            regulars: [
                'post.mp.qq.com'
            ]
        }, {
            name: "腾讯视频",
            regulars: [
                'v.qq.com', 'm.v.qq.com'
            ]
        }, {
            name: "QQ小程序-腾讯视频",
            regulars: [
                'mqqapi://microapp/open\\?mini_appid=1109840991'
            ]
        }, {
            name: "QQ小程序",
            regulars: [
                'mqqapi://microapp'
            ]
        }, {
            name: "易企秀",
            regulars: [
                'i.eqxiu.com'
            ]
        }, {
            name: "爱奇艺",
            regulars: [
                'iqiyi.com', 'www.iqiyi.com', 'm.iqiyi.com'
            ]
        }, {
            name: "IT之家",
            regulars: [
                'm.ithome.com', 'www.ithome.com'
            ]
        }, {
            name: "中国联通",
            regulars: [
                '10010.com', 'm.10010.com'
            ]
        }, {
            name: "芒果TV",
            regulars: [
                'mgtv.com', 'm.mgtv.com'
            ]
        }, {
            name: "乐视TV",
            regulars: [
                'letv.com', 'm.letv.com'
            ]
        }, {
            name: "一点资讯",
            regulars: [
                'yidianzixun.com'
            ]
        }, {
            name: "哔哩哔哩",
            regulars: [
                'bilibili.com'
            ]
        }, {
            name: "百度贴吧",
            regulars: [
                'tieba.baidu.com'
            ]
        }, {
            name: "水滴筹",
            regulars: [
                'shuidichou.com'
            ]
        }, {
            name: "Reddit",
            regulars: [
                'reddit.com'
            ]
        }, {
            name: "GitHub",
            regulars: [
                'github.com'
            ]
        }, {
            name: "抖音",
            regulars: [
                'douyin.com'
            ]
        }, {
            name: "今日头条",
            regulars: [
                'toutiao.com', 'toutiao.org'
            ]
        }, {
            name: "酷我音乐",
            regulars: [
                'kuwo.cn'
            ]
        }, {
            name: "火锅视频",
            regulars: [
                'yoo.qq.com'
            ]
        }, {
            name: "全民小视频",
            regulars: [
                'quanmin.baidu.com'
            ]
        }, {
            name: "王者荣耀",
            regulars: [
                'svp.tencent-cloud.com', 'qt.qq.com'
            ]
        }, {
            name: "QQ飞车手游",
            regulars: [
                'speedm.qq.com'
            ]
        }, {
            name: "QQ飞车",
            regulars: [
                'speed.qq.com'
            ]
        }, {
            name: "QQ飞车",
            regulars: [
                'speed.qq.com'
            ]
        }, {
            name: "英雄联盟",
            regulars: [
                'lol.qq.com'
            ]
        }, {
            name: "看点快报",
            regulars: [
                'kuaibao.qq.com'
            ]
        }, {
            name: "腾讯新闻",
            regulars: [
                'news.qq.com'
            ]
        }, {
            name: "51CTO 学院",
            regulars: [
                'edu.51cto.com'
            ]
        }, {
            name: "轻松筹",
            regulars: [
                'qschou.com'
            ]
        }]
    },
    // 访客模块
    Visitors: {
        exportType: "HTML",// 内容备份类型
        randomSeconds: {
            min: 1,
            max: 2
        },
        IncrementType: "Full",// 增量备份类型
        IncrementTime: "2005-06-06 00:00:00",// 增量时间
        PreBackup: {
            uin: 0, // 备份QQ
            downloadType: undefined, // 下载方式
            exportType: undefined, // 备份类型
            field: "time",// 比较字段
            time: "2005-06-06 00:00:00"// 上次备份时间，用于增量数据识别
        }
    }
};

/**
 * 用户配置（直接从默认配置拷贝属性，后续会从Chrome配置读取覆盖）
 */
var QZone_Config = Object.assign({}, Default_Config);

/**
 * 备份文件夹根目录
 */
const FOLDER_ROOT = '/QQ空间备份/';

/**
 * HTML备份导出文件
 */
const ExportFiles = [
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
        original: 'export/js/messages.js',
        target: FOLDER_ROOT + 'Common/js/messages.js'
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
        original: 'export/js/albums.js',
        target: FOLDER_ROOT + 'Common/js/albums.js'
    }, {
        original: 'export/js/videos.js',
        target: FOLDER_ROOT + 'Common/js/videos.js'
    }, {
        original: 'export/js/boards.js',
        target: FOLDER_ROOT + 'Common/js/boards.js'
    }, {
        original: 'export/js/favorites.js',
        target: FOLDER_ROOT + 'Common/js/favorites.js'
    }, {
        original: 'export/js/shares.js',
        target: FOLDER_ROOT + 'Common/js/shares.js'
    }, {
        original: 'export/js/visitors.js',
        target: FOLDER_ROOT + 'Common/js/visitors.js'
    }
]

/**
 * QQ空间信息
 */
var QZone = {
    Common: {
        ROOT: FOLDER_ROOT + 'Common',
        ExportType: {
            "Messages": true,
            "Blogs": true,
            "Diaries": true,
            "Photos": true,
            "Videos": true,
            "Boards": true,
            "Friends": true,
            "Favorites": true,
            "Shares": true,
            "Visitors": true
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
        ExportFiles: ExportFiles
    },
    // 说说模块
    Messages: {
        ROOT: FOLDER_ROOT + 'Messages',
        IMAGES_ROOT: FOLDER_ROOT + 'Messages/Images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 日志模块
    Blogs: {
        ROOT: FOLDER_ROOT + 'Blogs',
        IMAGES_ROOT: FOLDER_ROOT + 'Blogs/Images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 私密日记模块
    Diaries: {
        ROOT: FOLDER_ROOT + 'Diaries',
        IMAGES_ROOT: FOLDER_ROOT + 'Diaries/Images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 相册模块
    Photos: {
        ROOT: FOLDER_ROOT + 'Albums',
        Album: {
            total: 0,
            Data: [],
            Select: [],
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
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 留言板模块
    Boards: {
        ROOT: FOLDER_ROOT + 'Boards',
        Data: {
            items: [],
            authorInfo: {
                message: '',
                sign: ''
            },
            total: 0
        },
        FILE_URLS: new Map()
    },
    // QQ好友模块
    Friends: {
        ROOT: FOLDER_ROOT + 'Friends',
        total: 0,
        Data: []
    },
    // 收藏夹模块
    Favorites: {
        ROOT: FOLDER_ROOT + 'Favorites',
        IMAGES_ROOT: FOLDER_ROOT + 'Favorites/Images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 分享模块
    Shares: {
        ROOT: FOLDER_ROOT + 'Shares',
        IMAGES_ROOT: FOLDER_ROOT + 'Shares/Images',
        total: 0,
        Data: [],
        FILE_URLS: new Map(),
        // 分享类型
        ShareType: {
            1: '日志',
            2: '相册',
            3: "照片",
            4: "网页",
            5: '视频',
            10: '商品',
            13: '新闻',
            17: '微博',
            18: "音乐"
        }
    },
    // 访客模块
    Visitors: {
        ROOT: FOLDER_ROOT + 'Visitors',
        IMAGES_ROOT: FOLDER_ROOT + 'Visitors/Images',
        Data: {
            items: [],
            total: 0,
            totalPage: 0
        },
        FILE_URLS: new Map()
    }
};