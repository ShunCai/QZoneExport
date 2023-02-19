// 默认增量备份时间
const Default_IncrementTime = "2005-06-06 00:00:00";

/**
 * 默认配置
 */
const Default_Config = {
    // 公共配置
    Common: {
        // 重试次数
        listRetryCount: 5,
        // 重试间隔
        listRetrySleep: 2,
        // 稍后次数
        waitCount: 2,
        // 稍后间隔
        waitTime: 3600,
        RestSleepUrls: [],
        // 头像下载地址
        AvatarHost: 1,
        // 文件下载类型
        downloadType: 'Browser',
        Aria2: {
            rpc: 'http://localhost:6800/jsonrpc',
            token: undefined
        },
        // 自动识别文件后缀
        isAutoFileSuffix: true,
        // 后缀识别超时秒数
        autoFileSuffixTimeOut: 30,
        // 迅雷任务数        
        thunderTaskNum: 1500,
        // 唤起迅雷间隔        
        thunderTaskSleep: 60,
        // 文件下载并发数        
        downloadThread: 10,
        // 文件下载间隔        
        downloadSleep: 2,
        // 是否禁用下载状态栏提醒
        disabledShelf: false,
        // 生成内容是否包含其他空间用户链接
        hasUserLink: true,
        // 需要添加来源页的URL，目前主要用来下载视频
        refererUrls: [
            "gtimg.com"
        ]
    },
    // 开发者
    Dev: {
        Maps: {
            // 腾讯Key
            TxKey: "",
            BdKey: "",
            GdKey: ""
        }
    },
    // 说说模块
    Messages: {
        exportType: "HTML", // 内容备份类型
        pageSize: 20,
        randomSeconds: {
            min: 1,
            max: 2
        },
        isFull: true, //是否获取全文
        isShowMore: false, //是否展开全文
        Comments: {
            isFull: true, //是否全部评论
            pageSize: 20,
            randomSeconds: {
                min: 1,
                max: 2
            }
        },
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "created_time", // 增量字段
        isFilterKeyword: false, // 是否过滤关键字
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
        hasThatYearToday: true,
        refreshWeChatLbs: false, // 刷新朋友圈坐标信息
        GetVoice: false, // 是否获取语音说说
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
        exportType: "HTML", // 内容备份类型
        showType: '1', // HTML查看方式，0:表格视图，1:列表视图
        viewType: '1', // 视图类型，0:列表视图，1:摘要视图
        pageSize: 15,
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
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "pubTime", // 增量字段
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
    // 日记模块
    Diaries: {
        exportType: "HTML", // 内容备份类型
        showType: '1', // HTML查看方式，0:表格视图，1:列表视图
        pageSize: 15,
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
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "pubtime", // 增量字段
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
                min: 2,
                max: 3
            }
        },
        SortType: "4", // 相册排序方式
        RenameType: "Default", // 相册命名规则
        Images: {
            pageSize: 90,
            listType: 'Detail', // 默认为列表详情
            randomSeconds: {
                min: 2,
                max: 4
            },
            Comments: {
                isGet: false, // 是否获取评论，默认不获取
                pageSize: 100,
                randomSeconds: {
                    min: 2,
                    max: 3
                }
            },
            exifType: "raw",
            Info: {
                isGet: true, // 是否获取详情
                pageSize: 200,
                randomSeconds: {
                    min: 1,
                    max: 2
                }
            },
            isGetVideo: true, // 是否获取相片关联的视频
            isGetPreview: false, // 是否获取预览图
            fileStructureType: 'File', // 文件夹结构类型
            RenameType: "Default", // 相片命名规则
        },
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "uploadTime", // 增量字段
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
        fileStructureType: 'File', // 文件夹结构类型
        RenameType: "Default", // 视频命名规则
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
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "uploadTime", // 增量字段
        Like: {
            isGet: false, //是否获取赞
            randomSeconds: {
                min: 1,
                max: 2
            }
        }
    },
    // 留言模块
    Boards: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 20,
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "pubtime", // 增量字段
        hasThatYearToday: true
    },
    // 好友模块
    Friends: {
        exportType: "HTML", // 导出类型
        randomSeconds: {
            min: 1,
            max: 2
        },
        showType: '1', // HTML查看方式，0:表格视图，1:列表视图
        Interactive: true, // 是否获取好友互动信息，如亲密度、添加时间、共同好友、共同群组等
        ZoneAccess: true, // 是否判断空间权限
        SpecialCare: true, // 是否获取特别关心
        isIncrement: false, // 是否增量备份
        SpecialGroup: ['care', 'access', 'isFriend', 'deleted', '5', '10', '20'], // 特殊分组
        SortType: 'QQ' // 分组排序，QQ分组（QQ）或助手分组（default）
    },
    // 收藏模块
    Favorites: {
        exportType: "HTML",
        randomSeconds: {
            min: 1,
            max: 2
        },
        pageSize: 30,
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "create_time" // 增量字段
    },
    // 分享模块
    Shares: {
        exportType: "HTML", // 内容备份类型
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
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "shareTime", // 增量字段
        hasThatYearToday: true,
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
            "name": "QQ空间秘密",
            "regulars": "zone.qq.com/secret"
        }, {
            "name": "手机QQ空间",
            "regulars": "mobile.qzone.qq.com"
        }, {
            "name": "QQ空间",
            "regulars": "qzone.qq.com"
        }, {
            "name": "QQ音乐",
            "regulars": "y.qq.com"
        }, {
            "name": "QQ音乐",
            "regulars": "i.y.qq.com"
        }, {
            "name": "QQ音乐",
            "regulars": "music.qq.com"
        }, {
            "name": "网易云音乐",
            "regulars": "music.163.com"
        }, {
            "name": "网易云音乐",
            "regulars": "y.music.163.com"
        }, {
            "name": "酷狗音乐",
            "regulars": "kugou.com"
        }, {
            "name": "酷狗音乐",
            "regulars": "m.kugou.com"
        }, {
            "name": "酷狗音乐",
            "regulars": "t1.kugou.com"
        }, {
            "name": "全民K歌",
            "regulars": "kg.qq.com"
        }, {
            "name": "全民K歌",
            "regulars": "kg2.qq.com"
        }, {
            "name": "匿问我答",
            "regulars": "ti.qq.com"
        }, {
            "name": "微信公众号",
            "regulars": "mp.weixin.qq.com"
        }, {
            "name": "天天爱消除",
            "regulars": "peng.qq.com"
        }, {
            "name": "QQ手游中心",
            "regulars": "gamecenter.qq.com"
        }, {
            "name": "QQ手游中心",
            "regulars": "youxi.vip.qq.com"
        }, {
            "name": "知乎",
            "regulars": "zhihu.com"
        }, {
            "name": "知乎",
            "regulars": "m.zhihu.com"
        }, {
            "name": "新浪微博",
            "regulars": "weibo.com"
        }, {
            "name": "新浪微博",
            "regulars": "m.weibo.cn"
        }, {
            "name": "腾讯看点",
            "regulars": "post.mp.qq.com"
        }, {
            "name": "腾讯视频",
            "regulars": "v.qq.com"
        }, {
            "name": "腾讯视频",
            "regulars": "m.v.qq.com"
        }, {
            "name": "QQ小程序-腾讯视频",
            "regulars": "mqqapi://microapp/open\\?mini_appid=1109840991"
        }, {
            "name": "QQ小程序",
            "regulars": "mqqapi://microapp"
        }, {
            "name": "易企秀",
            "regulars": "i.eqxiu.com"
        }, {
            "name": "爱奇艺",
            "regulars": "iqiyi.com"
        }, {
            "name": "爱奇艺",
            "regulars": "www.iqiyi.com"
        }, {
            "name": "爱奇艺",
            "regulars": "m.iqiyi.com"
        }, {
            "name": "IT之家",
            "regulars": "m.ithome.com"
        }, {
            "name": "IT之家",
            "regulars": "www.ithome.com"
        }, {
            "name": "中国联通",
            "regulars": "10010.com"
        }, {
            "name": "中国联通",
            "regulars": "m.10010.com"
        }, {
            "name": "芒果TV",
            "regulars": "mgtv.com"
        }, {
            "name": "芒果TV",
            "regulars": "m.mgtv.com"
        }, {
            "name": "乐视TV",
            "regulars": "letv.com"
        }, {
            "name": "乐视TV",
            "regulars": "m.letv.com"
        }, {
            "name": "一点资讯",
            "regulars": "yidianzixun.com"
        }, {
            "name": "哔哩哔哩",
            "regulars": "bilibili.com"
        }, {
            "name": "百度贴吧",
            "regulars": "tieba.baidu.com"
        }, {
            "name": "水滴筹",
            "regulars": "shuidichou.com"
        }, {
            "name": "Reddit",
            "regulars": "reddit.com"
        }, {
            "name": "GitHub",
            "regulars": "github.com"
        }, {
            "name": "抖音",
            "regulars": "douyin.com"
        }, {
            "name": "今日头条",
            "regulars": "toutiao.com"
        }, {
            "name": "今日头条",
            "regulars": "toutiao.org"
        }, {
            "name": "酷我音乐",
            "regulars": "kuwo.cn"
        }, {
            "name": "火锅视频",
            "regulars": "yoo.qq.com"
        }, {
            "name": "全民小视频",
            "regulars": "quanmin.baidu.com"
        }, {
            "name": "王者荣耀",
            "regulars": "svp.tencent-cloud.com"
        }, {
            "name": "王者荣耀",
            "regulars": "qt.qq.com"
        }, {
            "name": "QQ飞车手游",
            "regulars": "speedm.qq.com"
        }, {
            "name": "QQ飞车",
            "regulars": "speed.qq.com"
        }, {
            "name": "QQ飞车",
            "regulars": "speed.qq.com"
        }, {
            "name": "英雄联盟",
            "regulars": "lol.qq.com"
        }, {
            "name": "看点快报",
            "regulars": "kuaibao.qq.com"
        }, {
            "name": "腾讯新闻",
            "regulars": "news.qq.com"
        }, {
            "name": "51CTO 学院",
            "regulars": "edu.51cto.com"
        }, {
            "name": "轻松筹",
            "regulars": "qschou.com"
        }, {
            "name": "搜狐视频",
            "regulars": "tv.sohu.com"
        }]
    },
    // 访客模块
    Visitors: {
        exportType: "HTML", // 内容备份类型
        randomSeconds: {
            min: 1,
            max: 2
        },
        IncrementType: "Full", // 增量备份类型
        IncrementTime: Default_IncrementTime, // 增量时间
        IncrementField: "time" // 增量字段
    },

    // 访客模块
    Statistics: {
        exportType: "HTML" // 内容备份类型
    }
};

/**
 * 用户配置（直接从默认配置拷贝属性，后续会从Chrome配置读取覆盖）
 */
var QZone_Config = Object.assign({}, Default_Config);

/**
 * 备份文件夹根目录
 */
const FOLDER_ROOT = '/QQ空间备份';

/**
 * 支持备份的模块名称 
 */
const MODULE_NAME_LIST = ['Messages', 'Blogs', 'Diaries', 'Photos', 'Videos', 'Boards', 'Friends', 'Favorites', 'Shares', 'Visitors'];

/**
 * 支持备份的模块名称 
 */
const MODULE_NAME_MAPS = {
    Messages: '说说',
    Blogs: '日志',
    Diaries: '日记',
    Photos: '相册',
    Videos: '视频',
    Boards: '留言',
    Friends: '好友',
    Favorites: '收藏',
    Shares: '分享',
    Visitors: '访客'
};

/**
 * HTML备份导出文件
 */
const ExportFiles = [{
    original: 'export/css/common.css',
    target: 'Common/css/common.css'
}, {
    original: 'export/js/sidebar.js',
    target: 'Common/js/sidebar.js'
}, {
    original: 'export/images/index.jpg',
    target: 'Common/images/index.jpg'
}, {
    original: 'export/images/video-play.png',
    target: 'Common/images/video-play.png'
}, {
    original: 'export/images/loading.gif',
    target: 'Common/images/loading.gif'
}, {
    original: 'export/images/favicon.ico',
    target: 'Common/images/favicon.ico'
}, {
    original: 'export/js/common.js',
    target: 'Common/js/common.js'
}, {
    original: 'export/js/messages.js',
    target: 'Messages/js/messages.js'
}, {
    original: 'export/js/blogs.js',
    target: 'Blogs/js/blogs.js'
}, {
    original: 'export/js/bloginfo.js',
    target: 'Blogs/js/bloginfo.js'
}, {
    original: 'export/js/diaries.js',
    target: 'Diaries/js/diaries.js'
}, {
    original: 'export/js/diaryinfo.js',
    target: 'Diaries/js/diaryinfo.js'
}, {
    original: 'export/js/friends.js',
    target: 'Friends/js/friends.js'
}, {
    original: 'export/js/photos.js',
    target: 'Albums/js/photos.js'
}, {
    original: 'export/js/albums.js',
    target: 'Albums/js/albums.js'
}, {
    original: 'export/js/videos.js',
    target: 'Videos/js/videos.js'
}, {
    original: 'export/js/boards.js',
    target: 'Boards/js/boards.js'
}, {
    original: 'export/js/favorites.js',
    target: 'Favorites/js/favorites.js'
}, {
    original: 'export/js/shares.js',
    target: 'Shares/js/shares.js'
}, {
    original: 'export/js/visitors.js',
    target: 'Visitors/js/visitors.js'
}, {
    original: 'export/js/statistics.js',
    target: 'Statistics/js/statistics.js'
}, {
    original: 'export/images/earth.svg',
    target: 'Statistics/images/earth.svg'
}, {
    original: 'export/images/share.svg',
    target: 'Statistics/images/share.svg'
}, {
    original: 'export/js/lib/coordtransform.min.js',
    target: 'Statistics/js/lib/coordtransform.min.js'
}, {
    original: 'export/js/maps/china/china-cities.js',
    target: 'Statistics/js/maps/china/china-cities.js'
}, {
    original: 'export/js/maps/china/china.js',
    target: 'Statistics/js/maps/china/china.js'
}, {
    original: 'export/js/maps/config.js',
    target: 'Statistics/js/maps/config.js'
}, {
    original: 'export/js/maps/world/world.js',
    target: 'Statistics/js/maps/world/world.js'
}, {
    original: 'templates/statistics.html',
    target: 'Statistics/index.html'
}]

/**
 * QQ空间信息
 */
var QZone = {
    Common: {
        ROOT: 'Common',
        ExportTypes: [
            "Messages",
            "Blogs",
            "Diaries",
            "Photos",
            "Videos",
            "Boards",
            "Friends",
            "Favorites",
            "Shares",
            "Visitors",
            "Statistics"
        ],
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
        ROOT: 'Messages',
        IMAGES_ROOT: 'Messages/images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 日志模块
    Blogs: {
        ROOT: 'Blogs',
        IMAGES_ROOT: 'Blogs/images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 日记模块
    Diaries: {
        ROOT: 'Diaries',
        IMAGES_ROOT: 'Diaries/images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 相册模块
    Photos: {
        ROOT: 'Albums',
        Album: {
            total: 0,
            Data: [],
            Select: [],
        },
        Images: {

        },
        // 默认相册分类
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
        ROOT: 'Videos',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 留言模块
    Boards: {
        ROOT: 'Boards',
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
    // 好友模块
    Friends: {
        ROOT: 'Friends',
        total: 0,
        Data: []
    },
    // 收藏模块
    Favorites: {
        ROOT: 'Favorites',
        IMAGES_ROOT: 'Favorites/images',
        total: 0,
        Data: [],
        FILE_URLS: new Map()
    },
    // 分享模块
    Shares: {
        ROOT: 'Shares',
        IMAGES_ROOT: 'Shares/images',
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
        ROOT: 'Visitors',
        IMAGES_ROOT: 'Visitors/images',
        Data: {
            items: [],
            total: 0,
            totalPage: 0
        },
        FILE_URLS: new Map()
    },
    // 数据统计模板
    Statistics: {
        ROOT: 'Statistics',
        IMAGES_ROOT: 'Statistics/images',
        Data: {

        },
        FILE_URLS: new Map()
    }
};