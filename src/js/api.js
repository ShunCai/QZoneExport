/**
 * QQ空间Rest API配置
 */
const QZone_URLS = {

    /** 个人统计 */
    USER_COUNT_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi",

    /** 个人信息 */
    USER_INFO_URL: "https://user.qzone.qq.com/proxy/domain/base.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all",

    /** 说说列表URL */
    MESSAGES_LIST_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6",

    /** 说说详情URL */
    MESSAGES_DETAIL_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 说说配图URL */
    MESSAGES_IMAGES_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_get_pics_v6",

    /** 说说评论列表URL */
    MESSAGES_COMMONTS_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 语音详情URL */
    MESSAGES_VOICE_INFO_URL: "https://user.qzone.qq.com/proxy/domain/snsapp.qzone.qq.com/cgi-bin/sound/GetVoice",

    /** 日志列表URL */
    BLOGS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs",

    /** 日志阅读数URL */
    BLOGS_READ_COUNT_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_count",

    /** 日志评论列表URL */
    BLOGS_COMMENTS_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_comment_list",

    /** 日志详情URL */
    BLOGS_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/blog_output_data",

    /** 私密日志列表URL */
    DIARY_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_get_titlelist",

    /** 私密日志详情URL */
    DIARY_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_output_data",

    /** 相册路由URL */
    PHOTOS_ROUTE_URL: 'https://user.qzone.qq.com/proxy/domain/route.store.qq.com/GetRoute',

    /** 相册列表URL */
    ALBUM_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3',

    /** 相册评论列表URL */
    ALBUM_COMMENTS_URL: 'https://user.qzone.qq.com/proxy/domain/app.photo.qzone.qq.com/cgi-bin/app/cgi_pcomment_xml_v2',

    /** 相片列表URL */
    IMAGES_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo',

    /** 相片详情URL */
    IMAGES_INFO_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_floatview_photo_list_v2',

    /** 相片评论列表 */
    IMAGES_COMMENTS_URL: 'https://user.qzone.qq.com/proxy/domain/app.photo.qzone.qq.com/cgi-bin/app/cgi_pcomment_xml_v2',

    /** 好友列表URL */
    FRIENDS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_show_qqfriends.cgi",

    /** 好友资料 */
    QZONE_USER_INFO_URL: "https://user.qzone.qq.com/proxy/domain/base.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all",

    /** 好友添加时间 */
    USER_ADD_TIME_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/friendship/cgi_friendship",

    /** 好友亲密度 */
    INTIMACY_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi",

    /** 留言板列表URL */
    BOARD_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb',

    /** 视频列表URL */
    VIDEO_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data',

    /** 视频详情URL */
    VIDEO_INFO_URL: 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data',

    /** 视频评论URL */
    VIDEO_COMMENTS_URL: 'https://user.qzone.qq.com/proxy/domain/taotao.qzone.qq.com/cgi-bin/emotion_cgi_getcmtreply_v6',

    /** 我的收藏 */
    FAVORITE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/fav.qzone.qq.com/cgi-bin/get_fav_list',

    /** 分享列表 */
    SHARE_LIST_URL: 'https://user.qzone.qq.com/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzsharegetmylistbytype',

    /** 分享评论 */
    SHARE_COMMENTS_URL: 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshareget_comment',

    /** 点赞数目 */
    LIKE_COUNT_URL: 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/qz_opcnt2',

    /** 点赞数目 */
    LIKE_COUNT_URL_88: 'https://rsh.qzone.qq.com/cgi-bin/user/qz_opcnt2_sh',

    /** 点赞列表 */
    LIKE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/users.qzone.qq.com/cgi-bin/likes/get_like_list_app',

    /** 浏览数 */
    VISITOR_COUNT_URL_88: 'https://rsh.qzone.qq.com/cgi-bin/user/qz_opcnt2_sh',

    /** 说说、日志浏览记录列表 */
    VISITOR_SINGLE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_single',

    /** 相册浏览记录列表 */
    VISITOR_SIMPLE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_simple',

    /** 空间访问记录 */
    VISITOR_MORE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_more',

    /** 特别关心列表（含被关心个数） */
    SPECIAL_CARE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/specialcare_get.cgi'

};

// WeChat Emoji Datas
const emojis = [{ "index": 2002, "key": "Smirk", "cn": "[奸笑]", "en": "[Smirk]", "image": "2_02.png" }, { "index": 2004, "key": "Hey", "cn": "[嘿哈]", "en": "[Hey]", "image": "2_04.png" }, { "index": 2005, "key": "Facepalm", "cn": "[捂脸]", "en": "[Facepalm]", "image": "2_05.png" }, { "index": 2006, "key": "Smart", "cn": "[机智]", "en": "[Smart]", "image": "2_06.png" }, { "index": 2007, "key": "Tea", "cn": "[茶]", "en": "[Tea]", "image": "2_07.png" }, { "index": 2009, "key": "Packet", "cn": "[红包]", "en": "[Packet]", "image": "2_09.png" }, { "index": 2010, "key": "Candle", "cn": "[蜡烛]", "en": "[Candle]", "image": "2_10.png" }, { "index": 2011, "key": "Yeah!", "cn": "[耶]", "en": "[Yeah!]", "image": "2_11.png" }, { "index": 2018, "key": "Concerned", "cn": "[皱眉]", "en": "[Concerned]", "image": "2_12.png" }, { "index": 2013, "key": "Blush", "cn": "[囧]", "en": "[Blush]", "image": "smiley_17b.png" }, { "index": 2014, "key": "Salute", "cn": "[抱拳]", "en": "[Salute]", "image": "smiley_17b.png" }, { "index": 2015, "key": "Chick", "cn": "[鸡]", "en": "[Chick]", "image": "2_14.png" }, { "index": 2016, "key": "Blessing", "cn": "[福]", "en": "[Blessing]", "image": "2_15.png" }, { "index": 2017, "key": "Bye", "cn": "[再见]", "en": "[Bye]", "image": "smiley_39b.png" }, { "index": 2019, "key": "Rich", "cn": "[發]", "en": "[Rich]", "image": "2_16.png" }, { "index": 2020, "key": "Pup", "cn": "[小狗]", "en": "[Pup]", "image": "2_17.png" }, { "index": 2021, "key": "Onlooker", "cn": "[吃瓜]", "en": "[Onlooker]", "image": "Watermelon.png" }, { "index": 2022, "key": "GoForIt", "cn": "[加油]", "en": "[GoForIt]", "image": "Addoil.png" }, { "index": 2023, "key": "Sweats", "cn": "[汗]", "en": "[Sweats]", "image": "Sweat.png" }, { "index": 2025, "key": "OMG", "cn": "[天啊]", "en": "[OMG]", "image": "Shocked!.png" }, { "index": 2027, "key": "Emm", "cn": "[Emm]", "en": "[Emm]", "image": "Cold.png" }, { "index": 2028, "key": "Respect", "cn": "[社会社会]", "en": "[Respect]", "image": "Social.png" }, { "index": 2030, "key": "Doge", "cn": "[旺柴]", "en": "[Doge]", "image": "Yellowdog.png" }, { "index": 2034, "key": "NoProb", "cn": "[旺柴]", "en": "[NoProb]", "image": "NoProb.png" }, { "index": 2036, "key": "MyBad", "cn": "[打脸]", "en": "[MyBad]", "image": "Slap.png" }, { "index": 2037, "key": "Wow", "cn": "[哇]", "en": "[Wow]", "image": "Wow!.png" }, { "index": 2038, "key": "KeepFighting", "cn": "[哇]", "en": "[KeepFighting]", "image": "KeepFighting.png" }, { "index": 2043, "key": "Boring", "cn": "[翻白眼]", "en": "[Boring]", "image": "Boring.png" }, { "index": 2044, "key": "666", "cn": "[666]", "en": "[Awesome]", "image": "666.png" }, { "index": 2045, "key": "LetMeSee", "cn": "[让我看看]", "en": "[LetMeSee]", "image": "LetMeSee.png" }, { "index": 2046, "key": "Sigh", "cn": "[叹气]", "en": "[Sigh]", "image": "Sigh.png" }, { "index": 2047, "key": "Hurt", "cn": "[苦涩]", "en": "[Hurt]", "image": "Hurt.png" }, { "index": 2048, "key": "Broken", "cn": "[裂开]", "en": "[Broken]", "image": "Broken.png" }, { "index": 2049, "key": "Flushed", "cn": "[脸红]", "en": "[Flushed]", "image": "Flushed.png" }, { "index": 2050, "key": "Happy", "cn": "[笑脸]", "en": "[Happy]", "image": "Happy.png" }, { "index": 2051, "key": "Lol", "cn": "[破涕为笑]", "en": "[Lol]", "image": "Lol.png" }, { "index": 2052, "key": "Fireworks", "cn": "[烟花]", "en": "[Fireworks]", "image": "Fireworks.png" }, { "index": 2053, "key": "gift", "cn": "[礼物]", "en": "[Gift]", "image": "Gift.png" }, { "index": 2054, "key": "Party", "cn": "[庆祝]", "en": "[Party]", "image": "Party.png" }, { "index": 2055, "key": "Terror", "cn": "[恐惧]", "en": "[Terror]", "image": "Terror.png" }, { "index": 2056, "key": "Duh", "cn": "[恐惧]", "en": "[Duh]", "image": "Duh.png" }, { "index": 2057, "key": "LetDown", "cn": "[失望]", "en": "[Let Down]", "image": "Let Down.png" }, { "index": 2058, "key": "Sick", "cn": "[生病]", "en": "[Sick]", "image": "Sick.png" }, { "index": 2059, "key": "Worship", "cn": "[合十]", "en": "[Worship]", "image": "Worship.png" }];

// 表情转换实现
const emotionMap = {}
emojis.forEach((item, index) => {
    if (item.cn) {
        emotionMap[item.cn] = item
    }
    if (item.en) {
        emotionMap[item.en] = item
    }
})

/**
 * 转换微信新表情
 * @param {string} content 转换内容
 */
const parseEmoji = (content) => {
    let emojiIndexList = []
    for (const k in emotionMap) {
        let idx = content.indexOf(k)
        while (idx >= 0) {
            emojiIndexList.push({ idx, code: k, type: 2 })
            idx = content.indexOf(k, idx + k.length)
        }
    }

    emojiIndexList = emojiIndexList.sort((a, b) => {
        return a.idx - b.idx
    })
    const newContentList = []
    let lastTextIndex = 0
    emojiIndexList.forEach(item => {
        if (lastTextIndex !== item.idx) {
            newContentList.push({
                type: 1,
                content: content.substring(lastTextIndex, item.idx)
            })
        }
        if (item.type === 2) {
            newContentList.push({
                type: item.type,
                content: content.substr(item.idx, item.code.length),
                image: emotionMap[item.code].image
            })
        } else {
            newContentList.push({
                type: item.type,
                content: item.code,
                image: item.image
            })
        }
        lastTextIndex = item.idx + item.code.length
    })
    const lastText = content.substring(lastTextIndex)
    if (lastText) {
        newContentList.push({
            type: 1,
            content: lastText
        })
    }
    return newContentList;
}

const API = {
    Utils: {},  // 工具类
    Common: {}, // 公共模块
    Blogs: {},  // 日志模块
    Diaries: {},// 日记模块
    Friends: {},// 好友模块
    Messages: {},// 说说模块
    Boards: {},// 留言模块
    Photos: {},// 相册模块
    Videos: {},// 视频模块
    Favorites: {},// 收藏模块
    Shares: {}, // 分享模块
    Visitors: {} // 访问模块
};

/**
 * 工具类
 */
API.Utils = {

    /**
     * 转换为ArrayBuffer
     */
    toArrayBuffer(str) {
        let buf = new ArrayBuffer(str.length)
        let view = new Uint8Array(buf)
        for (let i = 0; i !== str.length; ++i) {
            view[i] = str.charCodeAt(i) & 0xFF
        }
        return buf;
    },

    /**
     * 根据年月份分组数据
     * @param {array} data 数据集合
     * @param {object} timeField 时间字段名
     * @param {string} type 分组类型 all/year/month
     */
    groupedByTime(data, timeField, type) {
        data = data || [];
        let resMaps = new Map();
        for (const item of data) {
            let time = item[timeField];
            if (Array.isArray(timeField) && !time) {
                for (const field of timeField) {
                    time = item[field];
                    if (time) {
                        break;
                    }
                }
            }
            let date = null;
            if (typeof (time) === 'string') {
                date = new Date(time);
            } else {
                date = new Date(time * 1000);
            }
            if (!date) {
                date = new Date('1970-01-01');
            }
            switch (type) {
                case 'year':
                    let year_items = resMaps.get(date.getFullYear()) || [];
                    year_items.push(item);
                    resMaps.set(date.getFullYear(), year_items);
                    break;
                case 'month':
                    let month_items = resMaps.get(date.getMonth() + 1) || [];
                    month_items.push(item);
                    resMaps.set(date.getMonth() + 1, month_items);
                    break;
                case 'day':
                    let day_items = resMaps.get(date.getDate()) || [];
                    day_items.push(item);
                    resMaps.set(date.getDate(), day_items);
                    break;
                default:
                    let all_month_maps = resMaps.get(date.getFullYear()) || new Map();
                    let all_month_items = all_month_maps.get(date.getMonth() + 1) || [];
                    all_month_items.push(item);
                    all_month_maps.set(date.getMonth() + 1, all_month_items);
                    resMaps.set(date.getFullYear(), all_month_maps);
                    break;
            }
        }
        return resMaps;
    },

    /**
     * 根据指定字段分组
     * @param {array} data 数据集合
     * @param {string} field 字段名
     */
    groupedByField(data, field) {
        data = data || [];
        const groupData = new Map();
        for (const item of data) {
            const targetVal = item[field];
            const targetList = groupData.get(targetVal) || [];
            targetList.push(item);
            groupData.set(targetVal, targetList);
        }
        return groupData;
    },

    /**
     * 获取文件类型
     * @param {string} url 文件URL
     * @param {funcation} doneFun 回调函数
     */
    getMimeType(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            // 超时设置
            xhr.timeout = (QZone_Config.Common.autoFileSuffixTimeOut || 15) * 1000;
            xhr.onreadystatechange = function () {
                if (2 == xhr.readyState) {
                    let contentType = xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type') || '';
                    let suffix = contentType.split('/')[1];
                    if ('octet-stream' === suffix) {
                        let disposition = xhr.getResponseHeader('content-disposition') || xhr.getResponseHeader('Content-Disposition') || '';
                        suffix = disposition.split('=')[1].split('.')[1];
                    }
                    var ret = {
                        suffix: suffix,
                        size: xhr.getResponseHeader('content-length') || xhr.getResponseHeader('Content-Length') || 0
                    };
                    this.abort();
                    resolve(ret);
                }
            }
            xhr.onerror = function (e) {
                reject(e);
            }
            xhr.ontimeout = function (e) {
                this.abort();
                reject(e);
            }
            xhr.send();
        });
    },

    /**
     * 通过URL直接匹配文件后缀名
     * @param {string} url 文件地址
     */
    getFileSuffixByUrl(url) {
        url = url || '';
        // 尝试从URL直接匹配后缀名
        let _url = url.split('?')[0]; //去参数
        let res = /([^\.\/\\]+)\.([a-z]+)$/i.exec(_url);
        if (res) {
            return '.' + res[2];
        }
        return res || '';
    },

    /**
     * 通过URL请求文件识别后缀名
     * @param {string} url 文件地址
     */
    async getFileSuffix(url) {
        let suffix = API.Utils.getFileSuffixByUrl(url);
        return await this.getMimeType(url).then((data) => {
            let suffix = data.suffix
            if (suffix) {
                return '.' + suffix;
            }
            return suffix || '.jpeg';
        }).catch((e) => {
            console.error('获取文件类型异常', url, e);
            return suffix || '.jpeg';
        });
    },

    /**
     * 根据配置获取文件后缀名
     * @param {string} url 文件地址
     */
    async autoFileSuffix(url) {
        let suffix = API.Utils.getFileSuffixByUrl(url);
        if (!QZone_Config.Common.isAutoFileSuffix) {
            return suffix;
        }
        // 转换HTTPS
        url = API.Utils.makeDownloadUrl(url, true);
        return API.Utils.getFileSuffix(this.toHttps(url));
    },

    /**
     * 写入内容到文件
     * @param {string} content 内容
     * @param {string} filepath FileSystem路径
     */
    writeText(content, filepath) {
        return new Promise(function (resolve, reject) {
            QZone.Common.Filer.write(filepath, { data: content, type: "text/plain", append: false }, (fileEntry) => {
                resolve(fileEntry);
            }, (error) => {
                reject(error);
            });
        });
    },

    /**
     * 写入内容到Excel
     * @param {string} buffer 内容
     * @param {string} filepath FS的文件路径
     */
    writeFile(buffer, filepath) {
        return new Promise(function (resolve, reject) {
            QZone.Common.Filer.write(filepath, { data: buffer }, (fileEntry) => {
                resolve(fileEntry);
            }, (err) => {
                reject(err);
            });
        });

    },

    /**
     * 下载并写入文件到FileSystem
     * @param {string} url 图片URL
     * @param {string} path FileSystem文件路径
     */
    downloadToFile(url, path) {
        return new Promise(async function (resolve, reject) {
            await API.Utils.send(url, 'blob').then((xhr) => {
                let res = xhr.response;
                QZone.Common.Filer.write(path, { data: res, type: "blob" }, (fileEntry) => {
                    resolve(fileEntry);
                }, (e) => {
                    reject(e);
                });
            }).catch((e) => {
                reject(e);
            })
        });
    },

    /**
     * 切换根目录
     */
    switchToRoot() {
        return new Promise(async function (resolve, reject) {
            QZone.Common.Filer.cd('/', (root) => {
                resolve(root);
            }, (e) => {
                reject(e);
            });
        });
    },

    /**
     * 压缩
     * @param {string} root 文件或文件夹路径
     * @param {function} doneFun 
     * @param {function} failFun 
     */
    Zip(root) {
        return new Promise(async function (resolve, reject) {
            let zipOneFile = function (entry) {
                let newName = encodeURIComponent(entry.name);
                let fullPath = entry.fullPath.replace(entry.name, newName);
                QZone.Common.Filer.open(fullPath, (f) => {
                    let reader = new FileReader();
                    reader.onload = function (event) {
                        QZone.Common.Zip.file(entry.fullPath, event.target.result, { binary: true });
                    }
                    reader.readAsArrayBuffer(f);
                }, reject);
            };

            (function (path) {
                let cl = arguments.callee;
                QZone.Common.Filer.ls(path, (entries) => {
                    var i = 0;
                    for (i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        if (entry.isDirectory) {
                            QZone.Common.Zip.folder(entry.fullPath);
                            cl(path + entry.name + '/');
                        } else {
                            zipOneFile(entry);
                        }
                    }
                    resolve();
                }, reject);
            })(root);
        });
    },

    /**
     * 发送请求
     * @param {string} url 
     * @param {string} responseType 
     * @param {integer} timeout 超时秒数 
     */
    send(url, responseType, timeout) {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.open("GET", url);
            if (responseType) {
                request.responseType = responseType;
            }
            // 允许跨域
            request.withCredentials = true;
            // 超时秒数
            if (timeout) {
                request.timeout = timeout * 1000;
            }
            request.onload = function () {
                resolve(this);
            };
            request.onerror = function (error) {
                reject(error);
                this.abort();
            };
            request.ontimeout = function (error) {
                reject(error);
                this.abort();
            };
            request.send();
        });
    },

    /**
     * 下载文件
     * @param {string} url 
     */
    downloadFile(url) {
        return API.Utils.send(url, 'blob');
    },

    /**
     * GET 请求
     * @param {string} url 请求URL
     */
    get(url, params) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                type: 'GET',
                data: params,
                // async: false,
                // cache: false,
                retries: QZone_Config.Common.listRetryCount,// 重试次数
                retryInterval: QZone_Config.Common.listRetrySleep * 1000,// 每次重试间隔秒数
                success: function (result) {
                    resolve(result);
                },
                error: function (xhr, status, error) {
                    if (this.retries > 0) {
                        this.retries--;
                        // 指定秒数后继续请求
                        let scope = this;
                        setTimeout(function () {
                            console.warn('请求接口异常，正在尝试重试', url, params, scope.retries);
                            $.ajax(scope);
                        }, this.retryInterval);
                        return;
                    }
                    console.info('重试次数已用完，准备回调');
                    reject(error);
                }
            });
        });
    },

    /**
     * POST 请求
     * @param {string} url 请求URL
     * @param {object} data 请求数据
     */
    post(url, data) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                type: 'POST',
                data: data,
                contentType: "application/json;charset=utf-8",
                success: function (result) {
                    resolve(result);
                },
                error: function (xhr, status, error) {
                    reject(error);
                }
            });
        });
    },

    /**
     * 获取URL参数值
     * @param {string} name 
     */
    getUrlParam(name) {
        const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        const r = window.location.search.substr(1).match(reg);
        if (r != null) return decodeURI(r[2]); return null;
    },

    /**
     * 获取URL参数值
     * @param {string} url 
     */
    toParams(url) {
        var reg_url = /^[^\?]+\?([\w\W]+)$/,
            reg_para = /([^&=]+)=([\w\W]*?)(&|$|#)/g,
            arr_url = reg_url.exec(url),
            ret = {};
        if (arr_url && arr_url[1]) {
            var str_para = arr_url[1], result;
            while ((result = reg_para.exec(str_para)) != null) {
                ret[result[1]] = result[2];
            }
        }
        return ret;
    },

    /**
     * 通过参数构建URL
     * @param {string} url 
     * @param {object} params 
     */
    toUrl(url, params) {
        let paramsArr = [];
        if (params) {
            Object.keys(params).forEach(item => {
                paramsArr.push(item + '=' + params[item]);
            })
            if (url.search(/\?/) === -1) {
                url += '?' + paramsArr.join('&');
            } else {
                url += '&' + paramsArr.join('&');
            }

        }
        return url;
    },

    /**
     * 获得一个Cookie值
     * @param {string} name 
     */
    getCookie(name) {
        if (location.protocol === 'chrome-extension:') {
            chrome.cookies.get({
                url: "https://user.qzone.qq.com",
                name: name
            }, (res) => {
                console.info("cookie", name, res);
            });
        }
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length == 2) {
            return parts.pop().split(";").shift();
        }
    },

    /**
     * 从 HTML 页面找到 token 保存起来
     */
    getQzoneToken() {
        $("script").each(function () {
            var t = $(this).text();
            t = t.replace(/\ /g, "");
            if (t.indexOf('window.g_qzonetoken') !== -1) {
                var qzonetokenM = /return"(\w*?)";/g;
                var qzonetoken = qzonetokenM.exec(t);
                if (qzonetoken != null && qzonetoken != '') {
                    QZone.Common.Config.token = qzonetoken[1];
                    return false;
                }
            }
        });
        return QZone.Common.Config.token;
    },

    /**
     * 获取QQ号
     */
    initUin() {
        // 获取目标QQ
        let rs = /\/user\.qzone\.qq\.com\/([\d]+)/.exec(window.location.href);
        if (rs) {
            // 获取登录QQ
            const res = /\d.+/g.exec(API.Utils.getCookie('uin'));
            if (res && res.length > 0) {
                QZone.Common.Owner.uin = /\d.+/g.exec(API.Utils.getCookie('uin'))[0] - 0;
                QZone.Common.Target = {
                    uin: rs[1] - 0,
                    title: document.title,
                    description: $('meta[name="description"]').attr("content"),
                }
            }
        }
        return QZone.Common;
    },

    /**
     * 生成 g_tk
     * @param {string} url
     */
    initGtk(url) {
        var skey;
        url = url || window.location.href;
        if (url.indexOf("qzone.qq.com") > 0) {
            skey = API.Utils.getCookie("p_skey");
        } else {
            if (url.indexOf("qq.com") > 0) {
                skey = API.Utils.getCookie("skey") || API.Utils.getCookie("rv2");
            }
        }
        if (!skey) {
            return undefined;
        }
        var hash = 5381;
        for (var i = 0, len = skey.length; i < len; ++i) {
            hash += (hash << 5) + skey.charAt(i).charCodeAt();
        }
        return QZone.Common.Config.gtk = hash & 2147483647;
    },

    /**
     * @param {integer} ms 毫秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    },

    /**
     * Promise超时
     */
    timeoutPromise(promise, ms) {
        const timeout = API.Utils.sleep(ms).then(function () {
            throw new Error('Operation timed out after ' + ms + ' ms');
        });
        return Promise.race([promise, timeout]);
    },

    /**
     * 生成一个UUID
     */
    newUid() {
        const s4 = function () {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    },

    /**
     * 生成一个简短的UUID
     * @param {integer} len 长度
     * @param {integer} radix 算法类型
     */
    newSimpleUid(len, radix) {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [], i;
        radix = radix || chars.length;
        if (len) {
            for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
        } else {
            var r;
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4'; for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }
        return uuid.join('');
    },

    /**
     * 替换文件名特殊符号
     *
     * @param {原名} name
     */
    filenameValidate(name) {
        // 操作系统特殊符号
        name = name.replace(/'|#|~|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g, "_");
        return name;
    },

    /**
     * 按照长度给指定的数字前面补0
     * @param {int} num 
     * @param {int} length 
     */
    prefixNumber(num, length) {
        return (Array(length).join('0') + num).slice(-length);
    },

    /**
     * 转码
     * @param {string} b 
     */
    decode(b) {
        return b && b.replace(/(%2C|%25|%7D)/g, function (b) {
            return unescape(b);
        })
    },

    /**
     * 获取超链接
     */
    getLink(url, title, type) {
        // 默认HTML超链接
        let res = "<a href='{url}' target='_blank'>{title}</a>";
        switch (type) {
            case 'MD':
                res = '[{title}]({url})';
                break;
            default:
                break;
        }
        return res.format({
            url: url,
            title: title
        });
    },

    /**
     * 转换@内容
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    formatMention(contet, type) {
        if (!contet) {
            return contet;
        }
        const format = (item) => {
            var result = "<a href='https://user.qzone.qq.com/{uin}' target='_blank'>@{name}</a>".format(item);
            switch (type) {
                case 'MD':
                    result = '[@{name}](https://user.qzone.qq.com/{uin})'.format(item);
                    break;
            }
            return result;
        }
        if (typeof contet === 'object') {
            return format(contet);
        }

        // 先处理一遍正常的@的内容
        contet = contet.replace(/@\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))?(?:,auto:([^\}]*))?\}/g, function (str, uin, name) {
            return format({
                uin: uin,
                name: name
            });
        })

        // 如果处理后，仍包含uin、nick、who，则表示是特殊情况(即nick存的是内容)，再处理一遍
        if (contet.indexOf('uin') > -1 && contet.indexOf('nick') > -1 && contet.indexOf('who') > -1) {
            contet = contet.replace(/\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))\}/g, function (str, uin, name) {
                return name;
            })
        }
        return contet;
    },

    /**
     * 转换表情内容
     * @param {string} contet 表情内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    formatEmoticon(contet, type) {
        if (!contet) {
            return contet;
        }

        // 替换无协议的链接
        contet = contet.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');

        // 转换emoji表情链接
        contet = contet.replace(/\[em\]e(\d+)\[\/em\]/gi, function (emoji, eid) {
            let url = 'http://qzonestyle.gtimg.cn/qzone/em/e{0}.gif'.format(eid);
            // 默认返回HMTL格式
            let res = "<img src='{0}' >".format(url);
            switch (type) {
                case 'MD':
                    res = API.Utils.getImagesMarkdown(url);
            }
            return res;
        });

        return contet;
    },

    /**
     * 转换HTML特殊字符
     */
    escHTML(content) {
        var l = { "&amp;": /&/g, "&lt;": /</g, "&gt;": />/g, "&#039;": /\x27/g, "&quot;": /\x22/g };
        for (var i in l) {
            content = content.replace(l[i], i);
        }
        return content;
    },

    /**
     * 获取分享来源标题
     */
    getURLTitle(item, index) {
        return item["url_title_" + index] || "";
    },

    /**
     * 获取评论数
     */
    getCommentCount(item) {
        return item.replies || item.reply_num || item.cmtnum || 0;
    },

    /**
     * 转换内容
     * @param {string} contet 内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     * @param {boolean} isRt 是否是处理转发内容
     * @param {boolean} isSupportedHtml 内容本身是否支持HTML
     */
    formatContent(item, type, isRt, isSupportedHtml) {
        if (typeof item === 'string') {
            // 转换特殊符号
            if (!isSupportedHtml) {
                item = API.Utils.escHTML(item);
            }
            // 转换话题
            item = API.Utils.formatTopic(item, type);
            // 转换表情
            item = API.Utils.formatEmoticon(item, type);
            // 转换@内容
            item = API.Utils.formatMention(item, type);
            // 转换微信表情
            item = API.Common.formatWxEmoji(item, type);
            return item;
        }
        var conlist = (isRt && item.rt_con && item.rt_con['conlist']) || item.conlist || [];
        var contents = [];
        var titleIndex = 0;
        for (let index = 0; index < conlist.length; index++) {
            let info = conlist[index];
            // 说说内容类型
            switch (info.type) {
                case 0:
                    // 艾特某人？
                    info.custom_url = "http://user.qzone.qq.com/{uin}".format(info);
                    // 转换特殊符号
                    info.custom_display = API.Utils.escHTML(info.nick);
                    // 转换话题
                    info.custom_display = this.formatTopic(info.con || info.custom_display, type);
                    // 转换表情
                    info.custom_display = API.Utils.formatEmoticon(info.custom_display, type);
                    // 转换微信表情
                    info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
                    // 转换@内容
                    info.custom_display = API.Utils.formatMention({
                        uin: info.uin,
                        name: info.custom_display
                    }, type);
                    // 添加到内容数组
                    contents.push(info.custom_display);
                    break;
                case 1:
                    // 分享来源？
                    titleIndex++;
                    // 获取分享URL
                    info.url = API.Utils.escHTML(info.url);
                    // 获取分享提示
                    info.text = API.Utils.getURLTitle(item, titleIndex) || info.url;
                    // 获取Link
                    info.custom_display = API.Utils.getLink(info.url, info.text, type);
                    // 添加到内容数组
                    contents.push(info.custom_display)
                    break;
                case 2:
                    // 普通说说内容？
                    if (info.con) {
                        // 转换话题
                        info.custom_display = API.Utils.formatTopic(info.con, type);
                        // 转换表情
                        info.custom_display = API.Utils.formatEmoticon(info.custom_display, type);
                        // 转换微信表情
                        info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
                        // 转换@内容
                        info.custom_display = API.Utils.formatMention(info.custom_display, type);
                        // 替换换行符
                        switch (type) {
                            case 'MD':
                                info.custom_display = info.custom_display.replaceAll('\n', '\r\r\r\n');
                                break;
                            default:
                                break;
                        }
                        // 添加到内容数组
                        contents.push(info.custom_display)
                    }
                    break;
            }
        }
        let content = contents.join("");
        content = content.replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, "");
        return content;
    },

    /**
     * 字节转换大小
     * @param {byte} bytes 
     */
    bytesToSize(bytes) {
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes == 0) return 'n/a';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        if (i == 0) return bytes + ' ' + sizes[i];
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    },

    /**
     * 创建文件夹
     * @param {string} path 
     */
    createFolder(path) {
        return new Promise(function (resolve, reject) {
            QZone.Common.Filer.mkdir(path, false, (entry) => {
                resolve(entry);
            }, (e) => {
                reject(e);
            });
        });
    },

    /**
     * 消息通知
     */
    notification: (title, message) => {
        if (!window.Notification) {
            return;
        }
        Notification.requestPermission().then(function (permission) {
            if (permission === 'denied') {
                return;
            }
            if (permission === 'granted') {
                var notice_ = new Notification(title, {
                    body: message,
                    icon: API.Common.getUserLogoUrl(QZone.Common.Target.uin || API.Utils.initUin().Target.uin),
                    requireInteraction: true
                });
                notice_.onclick = function () {
                    // 单击消息提示框，进入浏览器页面
                    window.focus();
                }
            }
        });
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    formatDate(time, str) {
        str = str || 'yyyy-MM-dd hh:mm:ss';
        return new Date(time * 1000).format(str);
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    toDate(time) {
        const now = new Date();
        if (time.indexOf('今天') > -1) {
            // 今天 13:46
            time = time.replace('今天', now.format('yyyy-MM-dd'));
        } else if (time.indexOf('昨天') > -1) {
            // 昨天 23:46
            time = time.replace('昨天', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).format('yyyy-MM-dd'));
        } else if (time.indexOf('前天') > -1) {
            // 前天 23:46
            time = time.replace('前天', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).format('yyyy-MM-dd'));
        } else if (time.indexOf('年') == -1) {
            // 11 月 01 日 03:29
            time = new Date().getFullYear() + '-' + time.replace('月', '-').replace('日', '');
        } else if (time.indexOf('年') > -1) {
            // 2019 年 08 月 01 日 16:36
            time = time.replace('年', '-').replace('月', '-').replace('日', '');
        }
        return new Date(time);
    },

    /**
     * 转换JSON对象
     *  @param {string} json 
     *  @param {string} jsonpKey 
     */
    toJson(json, jsonpKey) {
        json = json.replace(jsonpKey, "");
        json = json.replace(/\);\s+$/, "");
        json = json.replace(/\);$/, "");
        json = json.replace(/\)\s+$/, "");
        json = json.replace(/\)$/, "");
        return JSON.parse(json);
    },

    /**
     * 转换超链接
     * @param {string} content 内容
     * @param {string} type 转换类型，默认HTML,MD
     */
    formatLink(content, type) {
        return content.replace(/(https|http|ftp|rtsp|mms)?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*/g, function (e, t, i) {
            return API.Utils.getLink(e, '网页链接', type);
        })
    },

    /**
     * 转换话题
     * @param {string} content 内容
     * @param {string} type 转换类型，默认HTML,MD
     */
    formatTopic(content, type) {
        content = (content || "") + "";
        var t = content.split(/(#(?:.|<br\/>)+?#)/g);
        var o = false;
        var n = ""
            , res = "";
        for (var a = 0; a < t.length; a++) {
            tag = t[a];
            o = false;
            n = "";
            n = tag.replace(/#((?:.|<br\/>)+?)#/g, function (e, t, n) {
                o = true;
                let url = 'http://rc.qzone.qq.com/qzonesoso/?search=' + encodeURIComponent(t);
                var a = API.Utils.getLink(url, '#{0}#'.format(t));
                switch (type) {
                    case 'MD':
                        a = API.Utils.getLink(url, '#{0}#'.format(t), type);
                        break;
                    default:
                        break;
                }
                return a
            });
            if (!o) {
                n = tag;
            }
            res += n
        }
        return res;
    },

    /**
     * 随机秒数
     */
    randomSeconds(min, max) {
        min = min - 0;
        max = max - 0;
        var range = max - min;
        var random = Math.random();
        var num = min + Math.round(random * range); //四舍五入
        return num;
    },

    /**
     * 替换URL
     * @param {string} url URL
     */
    toHttps(url) {
        url = url || '';
        if (url.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1) {
            // 替换图片代理URL为实际URL
            url = API.Utils.toParams(url)['url'] || url;
        }
        // 替换相对协议
        url = url.replace(/^\/\//g, 'https://');
        // 替换HTTP协议
        url = url.replace(/http:\//, "https:/");
        url = decodeURIComponent(url);
        return url;
    },

    /**
     * 替换URL
     * @param {string} url URL
     */
    toHttp(url) {
        url = url || '';
        if (url.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1) {
            // 替换图片代理URL为实际URL
            url = API.Utils.toParams(url)['url'] || url;
        }
        // 替换相对协议
        url = url.replace(/^\/\//g, 'http://');
        // 替换HTTPS协议
        url = url.replace(/https:\//, "http:/");
        url = decodeURIComponent(url);
        return url;
    },

    /**
     * 迅雷下载
     * @param {ThunderInfo} taskInfo 
     */
    downloadByThunder(taskInfo) {
        thunderLink.newTask(taskInfo);
    },

    /**
     * 浏览器下载(发送消息给背景页下载)
     * @param {BrowserTask} task
     */
    downloadByBrowser(task) {
        return new Promise(function (resolve, reject) {
            // 简单克隆
            let options = JSON.parse(JSON.stringify(task));

            // 删除多余属性
            delete options.id;
            delete options.dir;
            delete options.name;
            delete options.source;
            delete options.state;
            delete options.downloadState;

            chrome.runtime.sendMessage({
                from: 'content',
                type: 'download_browser',
                options: options
            }, function (id) {
                if (chrome.runtime.lastError) {
                    task.setId(0);
                    console.error('添加到下载器失败', chrome.runtime.lastError.message, task);
                    resolve(task);
                    return;
                }
                task.setId(id);
                resolve(task);
            })
        });
    },

    /**
     * Aria2下载
     * @param {DownloadTask} task
     */
    downloadByAria2(task) {
        const Aria2Setting = QZone_Config.Common.Aria2;
        const token = "token:" + Aria2Setting.token;
        const data = {
            "jsonrpc": "2.0",
            "method": "aria2.addUri",
            "id": Date.now(),
            "params": [
                token,
                [
                    task.url
                ],
                {
                    "referer": 'https://user.qzone.qq.com/',
                    "out": QZone.Common.Config.ZIP_NAME + '/' + task.dir + "/" + task.name
                }
            ]
        }
        // 添加下载任务到Aria2
        return API.Utils.post(Aria2Setting.rpc, JSON.stringify(data));
    },

    /**
     * 获取浏览器下载管理器的列表
     * @param {string} state
     */
    getDownloadList(state) {
        return new Promise(function (resolve, reject) {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'download_list',
                options: {
                    limit: 0,
                    orderBy: ['-startTime'],
                    state: state
                }
            }, function (data) {
                if (chrome.runtime.lastError) {
                    // 发生异常，默认当作成功
                    resolve([]);
                    return;
                }
                resolve(data);
            })
        });
    },

    /**
     * 恢复下载
     * @param {integer} downloadId
     */
    resumeDownload(downloadId) {
        return new Promise(function (resolve, reject) {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'download_resume',
                downloadId: downloadId
            }, function (data) {
                if (chrome.runtime.lastError) {
                    resolve(0);
                    return;
                }
                resolve(data);
            })
        });
    },

    /**
     * Base64编码
     * @param {string} str 原始字符串
     */
    utf8ToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    },

    /**
     * Base64解码
     * @param {string} str base64字符串
     */
    base64ToUtf8(str) {
        return decodeURIComponent(escape(atob(str)));
    },

    /**
     * 转换URL
     * @param {string} e 
     */
    trimDownloadUrl(url) {
        url = url || '';
        if (url && url.indexOf("?t=5&") > 0) {
            url = url.replace("?t=5&", "?")
        } else if (url && url.indexOf("?t=5") > 0) {
            url = url.replace("?t=5", "")
        } else if (url && url.indexOf("&t=5") > 0) {
            url = url.replace("&t=5", "")
        }
        return url
    },

    /**
     * 转换下载链接
     * @param {string} e 
     */
    makeDownloadUrl(url, isDownload) {
        url = url || '';
        var d = "save=1" + (isDownload ? '&d=1' : '');
        if (url && url.indexOf("?") > 0) {
            url = url + "&" + d
        } else if (url) {
            url = url + "?" + d
        }
        return this.trimDownloadUrl(url);
    },

    /**
     * 转换查看地址
     * @param {string} e 
     */
    makeViewUrl(url) {
        url = url || '';
        url = url.replace("?save=1&d=1", "")
        url = url.replace("&save=1&d=1", "")
        url = url.replace("?save=1", "")
        url = url.replace("&save=1", "")
        url = url.replace("?d=1", "")
        url = url.replace("&d=1", "")
        return url
    },

    /**
     * 获取Markdown的图片内容
     * @param {string} url 图片地址
     * @param {string} title 图片提示
     */
    getImagesMarkdown(url, title) {
        return '![{0}]({1})'.format(title || '', url);
    },

    /**
     * 对象中的字符串字段简单排序
     * @param {Array} items 对象数组
     * @param {string} filed 排序字段
     * @param {boolean} desc 是否倒序
     */
    sort(items, filed, desc) {
        if (!items || items.length === 1) {
            return items;
        }
        const compare = function (obj1, obj2) {
            let val1 = obj1[filed];
            let val2 = obj2[filed];
            if (typeof val1 === 'string' && typeof val2 === 'string') {
                return desc ? -val1.localeCompare(val2) : val1.localeCompare(val2);
            }
            if (val1 === val2) {
                return 0;
            }
            let isMax = val1 > val2 ? 1 : -1;
            return desc ? -isMax : isMax;
        }
        return items.sort(compare);
    },

    /**
     * 合并数组
     * @param {Array} items_a 数组A
     * @param {Array} items_b 数组B
     */
    unionItems(items_a, items_b) {
        items_a = items_a || [];
        items_b = items_b || [];
        return items_a.concat(items_b);
    }
};

/**
 * QQ空间公共模块
 */
API.Common = {

    /**
     * 获取来源类型（该判断不严谨）
     */
    getSourceType(source) {
        if (source.tid) {
            return 'Messages';
        } else if (source.vid) {
            return 'Videos';
        } else if (source.phototype) {
            return 'Images';
        } else if (source.blogid) {
            return 'Blogs';
        }
        return 'Others';
    },

    /**
     * 获取用户统计信息
     */
    getUserStatistics() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "param": 16,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.USER_COUNT_URL, params);
    },

    /**
     * 获取用户信息
     */
    getUserInfos() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "fupdate": 1,
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.USER_INFO_URL, params);
    },

    /**
     * 获取点赞列表
     * @param {string} unikey 来源Key
     */
    getLikeInfo(unikey) {
        let params = {
            "fupdate": 1,
            "unikey": unikey,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
        }
        let _like_info_url = QZone.Common.Owner.uin % 100 == 88 ? LIKE_COUNT_URL_88 : LIKE_COUNT_URL
        return API.Utils.get(_like_info_url, params);
    },

    /**
     * 获取点赞列表
     * @param {string} unikey 来源Key
     * @param {string} begin_uin 分页拉取，第一次为0，以后为上次数据最末uin的值
     */
    getLikeList(unikey, begin_uin) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "unikey": unikey,
            "begin_uin": begin_uin || 0,
            "query_count": 60,
            "if_first_page": begin_uin === 0 ? 1 : 0,//标识是否为首次请求 第一次请求为1，以后为0
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.LIKE_LIST_URL, params);
    },

    /**
     * 获取特别关心列表
     */
    getSpecialCare() {
        let params = {
            "uin": QZone.Common.Owner.uin,
            "do": 3,
            "fupdate": 1,
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.SPECIAL_CARE_LIST_URL, params);
    },

    /**
     * 获取用户空间地址
     */
    getUserUrl(uin) {
        return 'https://user.qzone.qq.com/' + uin;
    },

    /**
     * 获取唤起QQ聊天地址
     * @param {string} uin 目标QQ号
     */
    getMessageUrl(uin) {
        return "tencent://message/?uin=" + uin;
    },

    /**
     * 获取用户空间超链接
     * @param {string} uin 目标QQ号
     * @param {string} nickName 目标昵称
     * @param {string} type 类型
     */
    getUserLink(uin, nickName, type, isConfig) {
        if (isConfig && !QZone_Config.Common.hasUserLink) {
            return nickName;
        }
        return API.Utils.getLink(this.getUserUrl(uin), nickName, type);
    },

    /**
     * 获取用户空间超链接
     * @param {string} uin 目标QQ号
     * @param {string} nickName 目标昵称
     * @param {string} type 类型
     */
    getMessageLink(uin, nickName, type) {
        return API.Utils.getLink(this.getMessageUrl(uin), nickName, type);
    },

    /**
     * 是否为指定下载方式
     * @param {string} type 类型
     */
    isDownloadType(type) {
        // 文件备份类型
        let downloadType = QZone_Config.Common.downloadType;
        // 是否为QQ空间外链
        return downloadType === type;
    },

    /**
     * 下载工具是否为QQ空间外链
     */
    isQzoneUrl() {
        return this.isDownloadType('QZone');
    },

    /**
     * 下载工具是否为迅雷
     */
    isThunder() {
        return this.isDownloadType('Thunder');
    },

    /**
     * 下载工具是否为Aria2
     */
    isAria2() {
        return this.isDownloadType('Aria2');
    },

    /**
     * 下载工具是否为助手内部
     */
    isFile() {
        return this.isDownloadType('File');
    },

    /**
     * 下载工具是否为浏览器
     */
    isBrowser() {
        return this.isDownloadType('File');
    },

    /**
     * 获取用户空间的头像在线地址
     */
    getUserLogoUrl(uin) {
        return "https://qlogo{host}.store.qq.com/qzone/{uin}/{uin}/{size}".format({
            host: uin % 4 || 1,
            uin: uin,
            size: 100
        });
    },

    /**
     * 获取用户空间的本地地址
     */
    getUserLogoLocalUrl(uin) {
        // 头像默认PNG格式
        return "Common/images/{uin}".format({
            uin: uin
        });
    },

    /**
     * 获取图片Class乐行
     * @param {Object} message 说说
     */
    getImgClassType(message, isShare) {
        let medias = isShare ? message.source.images || [] : message.custom_images || [];
        if (message.custom_magics && message.custom_magics.length > 0) {
            medias = medias.concat(message.custom_magics || []);
        }
        if (message.custom_videos && message.custom_videos.length > 0) {
            medias = medias.concat(message.custom_videos || []);
        }
        if (medias.length == 3) {
            // 数量为3，小图，放一行
            return 'three';
        } else if (1 < medias.length && medias.length <= 4) {
            // 数量为2-4的，大图
            return 'two';
        } else if (5 <= medias.length) {
            // 数量大于5的，小图
            return 'three';
        }
        return '';
    },

    /**
     * 转换微信新表情
     */
    formatWxEmoji(content, type) {
        const contentList = parseEmoji(content);
        const imgRelativePath = 'https://cdn.jsdelivr.net/gh/ShunCai/QZoneExport@dev/src/img/emoji';
        const result = [];
        for (const _content of contentList) {
            if (_content.type === 1) {
                result.push(_content.content);
            }
            if (_content.type === 2) {
                let res = "<img src='{0}' >".format(imgRelativePath + "/" + _content.image);
                switch (type) {
                    case 'MD':
                        res = API.Utils.getImagesMarkdown(url);
                }
                result.push(res);
            }
        }
        return result.join('');
    }
}

/**
 * 日志模块API
 */
API.Blogs = {

    getBlogMediaTypeTitle(e) {
        var t = {
            0: "日志中包含图片",
            13: "日志中包含视频"
        };
        for (var i in t) {
            if (API.Blogs.getEffectBit(e, i)) {
                return t[i];
            }
        }
        return null;
    },

    getBlogLabel(e) {
        var t = [["8", "审核不通过"], ["22", "审核中"], ["4", "顶"], ["21", "荐"], ["3", "转"], ["28", "转"], ["35", "转"], ["36", "转"]];
        var a = '';
        for (var o = 0; o < t.length; o++) {
            var n = t[o][0];
            if (n == 22) {
                continue;
            }
            if (API.Blogs.getEffectBit(e, n)) {
                a += '[{0}]'.format(t[o][1]);
                break;
            }
        }
        return a;
    },

    getEffectBit(e, t) {
        if (t < 0 || t > 63) {
            throw new Error("nBit param error")
        }
        if (t < 32) {
            return (e.effect || e.effect1) & 1 << t
        } else if (t < 64) {
            return e.effect2 & 1 << t
        }
    },

    /**
     * 获取日志UniKey，用于获取点赞数据
     * @param {string} blogid 日志ID
     */
    getUniKey(blogid) {
        return 'http://user.qzone.qq.com/{0}/blog/{1}'.format(QZone.Common.Target.uin, blogid);
    },

    /**
     * 获取日志列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getBlogs(page) {
        let params = {
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "blogType": "0",
            "cateName": "",
            "cateHex": "",
            "statYear": new Date().getFullYear(),
            // 理论上可以用startTime来做增量
            // 但是目前先按其它类型导出的套路做增量判断吧
            // "startTime": 0,
            // "endTime": Math.floor(Date.now() / 1000),
            "reqInfo": "7",
            "pos": page * QZone_Config.Blogs.pageSize,
            "num": QZone_Config.Blogs.pageSize,
            "sortType": "0",
            "source": "0",
            "rand": Math.random(),
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "verbose": "1",
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.BLOGS_LIST_URL, params);
    },

    /**
     * 获取日志阅读数
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getReadCount(blogIds) {
        const params = {
            "type": 1,
            "uinList": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "idList": blogIds.join('_'),
            "r": Math.random(),
            "iNotice": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk()
        };
        return API.Utils.get(QZone_URLS.BLOGS_READ_COUNT_URL, params);
    },

    /**
     * 获取日志详情
     *
     * @param {integer} blogid 日志ID
     */
    getInfo(blogid) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "blogid": blogid,
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "mode": "2",
            "numperpage": "50",
            "timestamp": Math.floor(Date.now() / 1000),
            "dprefix": "",
            "inCharset": "gb2312",
            "outCharset": "gb2312",
            "ref": "qzone",
            "page": "1",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&page=1&catalog=list"
        };
        return API.Utils.get(QZone_URLS.BLOGS_INFO_URL, params);
    },


    /**
     * 获取日志评论列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getComments(blogid, page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "num": QZone_Config.Blogs.Comments.pageSize,
            "topicId": (QZone.Common.Target.uin || API.Utils.initUin().Target.uin) + "_" + blogid,
            "start": page * QZone_Config.Blogs.Comments.pageSize,
            "r": Math.random(),
            "iNotice": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.BLOGS_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 2,//311：说说，2：日志
            "param": targeId,
            "beginNum": QZone_Config.Blogs.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Blogs.Visitor.pageSize,
            "needFriend": 1,// TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VISITOR_SINGLE_LIST_URL, params);
    }

};

/**
 * 私密日记模块API
 */
API.Diaries = {

    /**
     * 获取私密日志列表
     *
     * @param {integer} page 第几页
     */
    getDiaries(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "pos": page * QZone_Config.Diaries.pageSize,
            "numperpage": QZone_Config.Diaries.pageSize,
            "pwd2sig": "",
            "r": Math.random(),
            "fupdate": "1",
            "iNotice": "0",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.DIARY_LIST_URL, params);
    },

    /**
    * 获取私密日志详情
    *
    * @param {string} uin QQ号
    * @param {integer} blogid 日志ID
    */
    getInfo(blogid) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "blogid": blogid,
            "pwd2sig": QZone.Common.Config.pwd2sig || "",
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "rs": Math.random(),
            "private": "1",
            "ref": "qzone",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&catalog=private&page=1"
        };
        return API.Utils.get(QZone_URLS.DIARY_INFO_URL, params);
    }
};

/**
 * QQ好友模块API
 */
API.Friends = {

    /**
     * 获取QQ好友列表
     * @param {string} uin QQ号
     */
    getFriends() {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "follow_flag": 0,//是否获取关注的认证空间
            "groupface_flag": 0,//是否获取QQ群组信息
            "fupdate": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.FRIENDS_LIST_URL, params);
    },

    /**
     * 获取QQ好友详情
     */
    getQzoneUserInfo() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "fupdate": "1",
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        // code = -3000 未登录
        // code = -4009 无权限
        return API.Utils.get(QZone_URLS.QZONE_USER_INFO_URL, params);
    },

    /**
     * 获取QQ好友添加时间
     * @param {string} 目标QQ号
     */
    getFriendshipTime(targetUin) {
        let params = {
            "activeuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "passiveuin": targetUin,
            "situation": 1,
            "isCalendar": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.USER_ADD_TIME_URL, params);
    },

    /**
     * 获取好友亲密度
     * @param {string} 目标QQ号
     */
    getIntimacy(targetUin) {
        let params = {
            "uin": targetUin,
            "param": 15,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.INTIMACY_URL, params);
    }
};

/**
 * 说说模块API
 */
API.Messages = {

    /**
     * 获取说说UniKey，用于获取点赞数据
     * @param {string} tid 说说ID
     */
    getUniKey(tid) {
        return 'http://user.qzone.qq.com/{0}/mood/{1}'.format(QZone.Common.Target.uin, tid);
    },

    /**
     * 获取说说列表
     * @param {integer} page 第几页
     */
    getMessages(page) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "ftype": 0,
            "sort": 0,
            "pos": page * QZone_Config.Messages.pageSize,
            "num": QZone_Config.Messages.pageSize,
            "replynum": 100,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "_preloadCallback",
            "code_version": 1,
            "format": "jsonp",
            "need_private_comment": 1,
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.MESSAGES_LIST_URL, params);
    },

    /**
     * 获取全文说说的列表
     * @param {Array} items 说说列表
     */
    getMoreItems(items) {
        let new_items = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.has_more_con === 1 || item.rt_has_more_con === 1) {
                // 长说说与转发长说说
                new_items.push(item)
            }
        }
        return new_items;
    },

    /**
     * 获取全文说说的条目数
     * @param {Array} items 说说列表
     */
    getMoreCount(items) {
        return getMoreItems(items).length
    },

    /**
     * 获取说说全文
     * @param {integer} id 说说ID
     */
    getFullContent(id) {
        let params = {
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "tid": id,
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "t1_source": 1,
            "not_trunc_con": 1,
            "hostuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "code_version": 1,
            "format": "jsonp",
            "qzreferrer": 'https://user.qzone.qq.com'
        }
        return API.Utils.get(QZone_URLS.MESSAGES_DETAIL_URL, params);
    },


    /**
     * 获取说说配图（超9张后需要单独获取）
     * @param {integer} id 说说ID
     */
    getImageInfos(id) {
        let params = {
            "r": Math.random(),
            "tid": id,
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "t1_source": 1,
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.MESSAGES_IMAGES_URL, params);
    },

    /**
     * 获取说说评论列表
     * @param {integer} page 第几页
     */
    getComments(id, page) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "tid": id,
            "t1_source": "undefined",
            "ftype": 0,
            "sort": 0,
            "pos": page * QZone_Config.Messages.Comments.pageSize,
            "num": QZone_Config.Messages.Comments.pageSize,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "_preloadCallback",
            "code_version": 1,
            "format": "jsonp",
            "need_private_comment": 1,
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.MESSAGES_COMMONTS_URL, params);
    },

    /**
     * 获取说说语音的实际地址
     * @param {Object} voice 语音信息
     */
    getVoiceInfo(voice) {
        const params = API.Utils.toParams(voice.url);
        return API.Utils.get(QZone_URLS.MESSAGES_VOICE_INFO_URL, params);
    },

    /**
     * 获取语音内容（HTML）
     * @param {Object} item 说说
     */
    getVoiceHTML(item) {
        const contents = [];
        const voices = item.custom_voices || [];
        for (let i = 0; i < voices.length; i++) {
            const voice = voices[i];
            contents.push('<audio controls src="{0}"></audio>'.format(voice.custom_filepath || voice.custom_url))
        }
        return contents.join('\r\n');
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 311,//311：说说，2：日志
            "param": targeId,
            "beginNum": QZone_Config.Messages.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Messages.Visitor.pageSize,
            "needFriend": 1,// TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 获取图片MD内容
     * @param {Array} images 图片列表
     */
    getImagesMarkdown(images, width, height) {
        const result = [];
        width = width || '';
        height = height || '';
        for (const image of images) {
            if (image.is_video && image.video_info) {
                // 视频
                const video = image.video_info;
                const target_url = API.Videos.getVideoUrl(video);
                const filepath = API.Common.isQzoneUrl() ? video.custom_pre_url : video.custom_pre_filepath;
                if (API.Videos.isExternalVideo(video)) {
                    // 外部视频，只显示图片，点击跳转
                    result.push('<a href="{0}" target="_blank"><img src="{1}" {2} {3} align="center" /></a>'.format(target_url, filepath, width, height));
                } else {
                    // 空间视频
                    const url = video.custom_filepath || video.custom_url;
                    result.push('<video src="{0}" {1} {2} controls="controls" ></video>'.format(url, width, height));
                }
            } else {
                // 普通图片
                const url = API.Common.isQzoneUrl() ? image.custom_url : image.custom_filepath;
                result.push('<img src="{0}" {1} {2} align="center" />'.format(url, width, height));
            }
        }
        return result.join('\r\n');
    },

    /**
     * 转换多媒体内容
     */
    formatMediaMarkdown(item) {
        let images = item.custom_images || [];
        let videos = item.custom_videos || [];
        let audios = item.custom_audios || [];
        let result = [];
        if (images.length > 0) {
            // 说说配图
            if (images.length == 1) {
                // 数量等于1的，不限制图片宽高
                result.push('<div>');
                result.push(this.getImagesMarkdown(images, 'width="600px"'));
                result.push('</div>');
            } else if (2 <= images.length && images.length <= 3) {
                // 数量小于3的，一行存放所有照片
                result.push('<div>');
                result.push(this.getImagesMarkdown(images, 'width="200px"'));
                result.push('</div>');
            } else if (images.length == 4) {
                // 数量为4的，两行，每行两张照片
                result.push('\r\n');
                let _images = _.chunk(images, 2);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            } else if (5 <= images.length && images.length <= 6) {
                // 数量为5和6的，两行，每行2到3张照片
                result.push('\r\n');
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            } else if (images.length >= 7) {
                // 数量为7,8,9以及更多的，每行2到3张照片
                result.push('\r\n');
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            }
        }
        // 视频（这里一般为单视频，多视频的逻辑会走上面图片逻辑）
        for (const video of videos) {
            result.push('\r\n');
            const target_url = API.Videos.getVideoUrl(video);
            const filepath = API.Common.isQzoneUrl() ? video.custom_pre_url : video.custom_pre_filepath;
            if (API.Videos.isExternalVideo(video)) {
                // 外部视频，只显示图片，点击跳转
                result.push('<a href="{0}" target="_blank"><img src="{1}" width="600px" height="400px" align="center" /></a>'.format(target_url, filepath));
            } else {
                // 空间视频
                const url = video.custom_filepath || video.custom_url;
                result.push('<video src="{0}" width="600px" height="400px" controls="controls" ></video>'.format(url));
            }
            result.push('\r\n');
        }
        // 歌曲
        for (const audio of audios) {
            result.push('\r\n');
            if (API.Common.isQzoneUrl()) {
                result.push('[![{0}-{1}]({2})]({3})\n'.format(audio.albumname, audio.singername, audio.custom_url, audio.playurl));
            } else {
                result.push('[![{0}-{1}]({2})]({3})\n'.format(audio.albumname, audio.singername, audio.custom_filepath, audio.playurl));
            }
            result.push('\r\n');
        }
        return result.join('\r\n');
    },

    /**
     * 获取地图超链接
     * @param {object} ibs 坐标信息
     */
    getMapUrl(ibs) {
        if (!ibs) {
            return '#';
        }
        return 'https://apis.map.qq.com/uri/v1/marker?marker=coord:{pos_y},{pos_x};title:{idname};addr:{name}'.format(ibs);
    }
};

/**
 * 留言板模块API
 */
API.Boards = {

    /**
     * 获取留言板列表
     * @param {integer} page 第几页
     */
    getBoards(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Boards.pageSize,
            "s": Math.random(),
            "format": "jsonp",
            "num": QZone_Config.Boards.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.BOARD_LIST_URL, params);
    },

    /**
     * 获取留言人
     * @param {object} board 留言对象
     */
    getOwner(board) {
        let nickname = board.nickname || board.nick;
        nickname = nickname || '神秘者';
        return nickname;
    }
};

/**
 * 相册模块API
 */
API.Photos = {

    /**
     * 获取相册路由
     */
    async getRoute() {
        let params = {
            "UIN": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "type": "json",
            "version": 2,
            "json_esc": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        let data = await API.Utils.get(QZone_URLS.PHOTOS_ROUTE_URL, params);
        data = API.Utils.toJson(data, /^photoDomainNameCallback\(/);

        var e = new RegExp("^domain_\\d$"), o, c = [];

        function u(t, a, e) {
            for (var i = 0, o = c.length; i < o; i++) {
                if (c[i].domain === t) {
                    c[i].failed = a;
                    return
                }
            }
            c.push({
                domain: t,
                failed: a,
                idcNum: e
            })
        }
        function m() {
            for (var e = 0, i = c.length; e < i; e++) {
                if (!c[e].failed) {
                    return c[e]
                }
            }
            return false
        }

        if (data.domain && data.domain["default"]) {
            o = data.domain["default"];
            if (data[o] && data[o].p) {
                u(data[o].p, 0, data.idcno || 102)
            }
        }
        for (o in data) {
            if (e.test(o) && data[o].p) {
                u(data[o].p, 0, 102)
            }
        }
        let res = m();
        QZone.Common.Target.route = res.idcNum || 102
        return QZone.Common.Target.route;
    },

    /**
     * 获取相册UniKey，用于获取点赞数据
     * @param {string} albumId 相册ID
     */
    getUniKey(albumId) {
        return 'http://user.qzone.qq.com/{0}/photo/{1}'.format(QZone.Common.Target.uin, albumId);
    },

    /**
     * 获取相片UniKey，用于获取点赞数据
     * @param {Object} photo 相片
     */
    getPhotoUniKey(photo) {
        return 'http://user.qzone.qq.com/{0}/photo/{1}/{2}^||^http://user.qzone.qq.com/{3}/batchphoto/{4}/{5}^||^1'.format(QZone.Common.Target.uin, photo.albumId, photo.lloc || photo.sloc, QZone.Common.Target.uin, photo.albumId, photo.batchId);
    },

    /**
     * 获取相册地址
     */
    getAlbumUrl(uin, albumId) {
        return 'https://user.qzone.qq.com/{0}/photo/{1}'.format(uin, albumId);
    },

    /**
     * 获取查看相片的在线链接
     * @param {object} photo 相片对象
     */
    getImageViewLink(photo) {
        return 'https://user.qzone.qq.com/{0}/photo/{1}/{2}'.format(QZone.Common.Target.uin, photo.albumId, this.getImageKey(photo));
    },

    /**
     * 获取相片Key
     * @param {object} photo 相片对象
     */
    getImageKey(photo) {
        return photo.lloc || photo.sloc;
    },

    /**
     * 获取相册列表
     * @param {integer} page 当前页
     */
    getAlbums(page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "appid": 4,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "source": "qzone",
            "plat": "qzone",
            "format": "jsonp",
            "notice": 0,
            "filter": 1,
            "handset": 4,
            "needUserInfo": 1,
            "idcNum": QZone.Common.Target.route || this.getRoute(),
            "mode": 2, // 视图：普通视图
            "sortOrder": 2, // 排序类型：自定义排序
            "pageStart": page * QZone_Config.Photos.pageSize,
            "pageNum": QZone_Config.Photos.pageSize,
            // "needSave": 1, // 保存视图
            "callbackFun": "shine0",
            "_": Date.now()
        }
        return API.Utils.get(QZone_URLS.ALBUM_LIST_URL, params);
    },

    /**
     * 获取相册评论列表
     * @param {string} albumId 相册ID
     * @param {integer} page 当前页
     */
    getAlbumComments(albumId, page) {
        let params = {
            "need_private_comment": 1,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Photos.Comments.pageSize,
            "num": QZone_Config.Photos.Comments.pageSize,
            "order": 1, //倒序
            "topicId": albumId,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "t": Date.now(),
            "cmtType": 1,
            "plat": "qzone",
            "source": "qzone",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.ALBUM_COMMENTS_URL, params);
    },

    /**
     * 获取相册相片列表
     * @param {string} topicId 相册ID
     * @param {integer} page 当前页
     */
    getImages(topicId, page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "mode": 0,
            "idcNum": QZone.Common.Target.route || this.getRoute(), // 存储相册的服务器路由？
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "topicId": topicId,
            "noTopic": 0,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "pageStart": page * QZone_Config.Photos.Images.pageSize,
            "pageNum": QZone_Config.Photos.Images.pageSize,
            "skipCmtCount": 0,
            "singleurl": 1,
            "batchId": "",
            "notice": 0,
            "appid": 4,
            "inCharset": "gb2312",
            "outCharset": "gb2312",
            "source": "qzone",
            "plat": "qzone",
            "outstyle": "json",
            "format": "jsonp",
            "json_esc": 1,
            "callbackFun": "shine0",
            "_": Date.now()
        };
        return API.Utils.get(QZone_URLS.IMAGES_LIST_URL, params);
    },


    /**
     * 获取相片详情
     * @param {string} topicId 相册ID
     * @param {integer} picKey 相片ID
     */
    getImageInfo(topicId, picKey) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "topicId": topicId,
            "picKey": picKey,
            "shootTime": "",
            "cmtOrder": 1,
            "fupdate": 1,
            "plat": "qzone",
            "source": "qzone",
            "cmtNum": 10,
            "likeNum": 5,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "offset": 0,// 偏移量
            "number": 40,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4,
            "isFirst": 1,
            "sortOrder": 1,
            "showMode": 1,
            "need_private_comment": 1,
            "prevNum": 0,// 前序的照片数量
            "postNum": 0,// 后续的照片数量
            "_": Date.now()
        }
        return API.Utils.get(QZone_URLS.IMAGES_INFO_URL, params);
    },

    /**
     * 获取相片评论列表
     * @param {string} albumId 相册ID
     * @param {integer} page 当前页
     */
    getImageComments(albumId, picKey, page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Photos.Images.Comments.pageSize,
            "num": QZone_Config.Photos.Images.Comments.pageSize,
            "order": 1, // 倒序
            "topicId": albumId + '_' + picKey,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "photo",
            "need_private_comment": 1,
            "albumId": albumId,
            "qzone": "qzone",
            "plat": "qzone",
            "random": Date.now(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        };
        return API.Utils.get(QZone_URLS.IMAGES_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4,//4:相册
            "param": "2;" + targeId,
            "beginNum": QZone_Config.Blogs.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Blogs.Visitor.pageSize,
            "needFriend": 1,// TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors_2(targeId) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "mask": 2,
            "mod": 2,
            "contentid": targeId,
            "fupdate": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VISITOR_SIMPLE_LIST_URL, params);
    },

    /**
     * 获取相片外链(无权限也可以访问)
     */
    getExternalUrl(oldurl) {
        //var reg = /http\w?:\/\/.*?\/psb\?\/(.*?)\/(.*?)\/\w\/(.*?)&/gi
        var reg = /http\w?:\/\/.*?\/ps(\w)\?\/(.*?)\/(.*?)\/\w\/(.*?)$/gi
        var reg2 = /http\w?:\/\/.*?\/psc\?\/(.*?)$/gi
        var result;
        var newurl;
        if ((result = reg.exec(oldurl)) !== null) {
            console.log('匹配1');
            newurl = "//r.photo.store.qq.com/ps" + result[1] + "?/" + result[2] + "/" + result[3] + "/r/" + result[4] + "_yake_qzoneimgout.png";
            return newurl;
        } else {
            if ((result = reg2.exec(oldurl)) !== null) {
                console.log('匹配2');
                newurl = "//r.photo.store.qq.com/psc?/" + result[1] + "/r/_yake_qzoneimgout.png";
                return newurl;
            }
        }
        return oldurl;
    },

    /**
     * 获取照片下载URL
     * @param {object} photo 
     */
    getDownloadUrl(photo, type) {
        let url = photo.url;
        // 原图
        let raw_url = photo.raw_upload === 1 ? photo.raw : undefined;
        // 高清原图
        let origin_url = photo.origin || photo.origin_url;
        // 常规
        let normal_url = photo.downloadUrl || photo.url;
        switch (type) {
            case 'raw':
                // 原图，原图不存在去高清，高清不存在取普通
                url = raw_url || origin_url || normal_url;
                break;
            case 'original':
                // 高清，高清不存在取普通
                url = origin_url || normal_url;
                break;
            default:
                // 一般
                url = normal_url;
                break;
        }
        return API.Utils.trimDownloadUrl(url);
    },

    /**
     * 获取相册预览地址
     * @param {object} url 
     */
    getPhotoPreUrl(url) {
        var reg = /http\w?:\/\/.*?\/ps(\w)\?\/(.*?)\/(.*?)\/\w\/(.*?)$/gi
        var reg2 = /http\w?:\/\/.*?\/psc\?\/(.*?)$/gi
        var result;
        var newurl;
        if ((result = reg.exec(url)) !== null) {
            newurl = "https://r.photo.store.qq.com/ps" + result[1] + "?/" + result[2] + "/" + result[3] + "/m/" + result[4];
            return newurl;
        } else {
            if ((result = reg2.exec(url)) !== null) {
                newurl = "https://r.photo.store.qq.com/psc?/" + result[1] + "/m";
                return newurl;
            }
        }
        return API.Utils.trimDownloadUrl(url);
    },

    /**
     * 获取相片类型
     * @param {string} photo 相片对象
     */
    getPhotoType(photo) {
        const type = photo.phototype;
        // 默认类型
        let extName = ".jpeg";
        switch (type) {
            case 1:
                extName = ".jpeg";
                break;
            case 2:
                extName = ".gif";
                break;
            case 3:
                extName = ".png";
                break;
            case 4:
                extName = ".bmp";
                break;
            case 5:
                extName = ".jpeg";
                break;
        }
        return extName;
    },

    /**
     * 获取已用容量显示值
     * @param {Number} t 已用容量
     */
    getCapacityDisplay(t) {
        t = t > 0 ? t : 0;
        if (t < 100) {
            return t + " M"
        } else if (t < 1024 * 1024) {
            return Math.round(t / 1024 * 10) / 10 + " G"
        } else {
            return Math.round(t / 1024 / 1024 * 10) / 10 + " T"
        }
    }

};

/**
 * 视频模块API
 */
API.Videos = {

    /**
     * 获取视频列表
     * @param {integer} page 当前页
     */
    getVideos(page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4,
            "getMethod": 2,
            "start": page * QZone_Config.Videos.pageSize,
            "count": QZone_Config.Videos.pageSize,
            "need_old": 0,
            "getUserInfo": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "refer": "qzone",
            "source": "qzone",
            "callbackFun": "shine0",
            "_": Date.now()
        }
        return API.Utils.get(QZone_URLS.VIDEO_LIST_URL, params);
    },

    /**
     * 获取视频详情
     * @param {string} tid 说说ID
     * @param {string} vid 视频ID
     */
    getVideoInfo(tid, vid) {
        const params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "viewer_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "topicId": tid,
            "picKey": vid,
            "shootTime": "",
            "cmtOrder": 1,
            "fupdate": 1,
            "plat": "qzone",
            "source": "qzone",
            "cmtNum": 10,
            "likeNum": 5,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "callbackFun": "viewer",
            "offset": 0,
            "number": 1,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 311,
            "isFirst": 1,
            "need_private_comment": 1,
            "getMethod": 3,
            "_": Date.now()
        }
        return API.Utils.get(QZone_URLS.VIDEO_INFO_URL, params);
    },

    /**
     * 获取视频评论列表
     * @param {string} tid 说说ID
     * @param {integer} page 当前页
     */
    getComments(tid, page) {
        const params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Videos.Comments.pageSize,
            "num": QZone_Config.Videos.Comments.pageSize,
            "order": 0,
            "topicId": QZone.Common.Target.uin + "_" + tid,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "qzone",
            "need_private_comment": 1,
            "code_version": 1,
            "out_charset": "UTF-8",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VIDEO_COMMENTS_URL, params);
    },

    /**
     * 获取视频文件名
     * @param {string} url 视频地址
     */
    getFileName(url) {
        url = url || '';
        let result = /http:\/\/(.+)\/(.+\.mp4)\?(.+)/gi.exec(url);
        if (result) {
            return result[2];
        }
        return API.Utils.newSimpleUid(8, 16) + '.mp4';
    }
};

/**
 * 收藏夹模块API
 */
API.Favorites = {

    /**
     * 获取查询类型
     */
    getQueryType(innerType) {
        let Fav_Tyep = {
            0: "全部",
            1: "日志",
            2: "照片",
            3: "说说",
            4: "分享",
            5: "文字",
            6: "网页",
            7: "未知",
            8: "未知"
        }
        return Fav_Tyep[innerType] || "未知";
    },


    /**
     * 获取类型
     */
    getType(innerType) {
        let Fav_Tyep = {
            0: "全部",
            1: "网页",
            2: "照片",
            3: "日志",
            4: "照片",
            5: "说说",
            6: "文字",
            7: "分享",
            8: "未知"
        }
        return Fav_Tyep[innerType] || "未知";
    },

    /**
     * 获取收藏源用户
     * @param {Object} favorite 收藏夹
     */
    getFavoriteOwner(favorite) {
        const user = {
            uin: favorite.custom_uin,
            name: favorite.custom_name
        };
        switch (favorite.type) {
            case 3:
                // 日志                    
                user.uin = favorite.blog_info && favorite.blog_info.owner_uin;
                user.name = favorite.blog_info && favorite.blog_info.owner_name;
                break;
            case 4:
                if (favorite.album_info && favorite.album_info.owner_uin) {
                    // 相册收藏？暂无数据
                    user.uin = favorite.album_info.owner_uin;
                    user.name = favorite.album_info.owner_name;
                } else {
                    // 照片收藏
                    user.uin = favorite.photo_list && favorite.photo_list[0].owner_uin;
                    user.name = favorite.photo_list && favorite.photo_list[0].owner_name;
                }
                break;
            case 5:
                // 说说
                user.uin = favorite.shuoshuo_info && favorite.shuoshuo_info.owner_uin;
                user.name = favorite.shuoshuo_info && favorite.shuoshuo_info.owner_name;
                break;
            case 7:
                // 分享
                user.uin = favorite.share_info && favorite.share_info.owner_uin;
                user.name = favorite.share_info && favorite.share_info.owner_name;
                break;
            default:
                break;
        }
        return user;
    },

    /**
     * 转换数据
     */
    convert(data) {
        if (!data) {
            return data;
        }
        for (var i = 0; i < data.length; i++) {
            let temp = data[i];
            temp.custom_create_time = API.Utils.formatDate(temp.create_time);
            temp.custom_uin = QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin;
            temp.custom_name = QZone.Common.Target.nickname;
            temp.custom_abstract = temp.abstract || "";
            temp.album_info = temp.album_info || {};
            temp.blog_info = temp.blog_info || {};
            temp.photo_list = temp.photo_list || [];
            temp.shuoshuo_info = temp.shuoshuo_info || {};
            temp.share_info = temp.share_info || {};
            temp.url_info = temp.url_info || {};
            // 源信息
            temp.source_info = {};
            // 多媒体-配图
            temp.custom_images = temp.img_list || [];
            temp.custom_origin_images = temp.origin_img_list || [];
            // 多媒体-视频
            temp.source_info.video_list = [];
            temp.custom_videos = [];
            // 多媒体-歌曲
            temp.source_info.music_list = [];
            temp.custom_audios = [];
            switch (temp.type) {
                case 1:
                    // 网页                   
                    temp.source_info.video_list = temp.url_info.video_list || [];
                    temp.source_info.music_list = temp.url_info.music_list || [];
                    break;
                case 3:
                    // 日志                    
                    temp.source_info.video_list = temp.blog_info.video_list || [];
                    temp.source_info.music_list = temp.blog_info.music_list || [];
                    break;
                case 4:
                    // 照片或相册？
                    temp.source_info.video_list = temp.album_info.video_list || [];
                    temp.source_info.music_list = temp.album_info.music_list || [];
                    break;
                case 5:
                    // 说说
                    temp.source_info.video_list = temp.shuoshuo_info.video_list || [];
                    temp.source_info.music_list = temp.shuoshuo_info.music_list || [];
                    temp.shuoshuo_info.detail_shuoshuo_info = temp.shuoshuo_info.detail_shuoshuo_info || {};
                    break;
                case 7:
                    // 分享
                    temp.share_info.reason = temp.share_info.reason.split('||')[0];
                    temp.source_info.video_list = temp.share_info.video_list || [];
                    temp.source_info.music_list = temp.share_info.music_list || [];
                    break;
                default:
                    console.warn('其他收藏类型或未知类型不转换数据', temp);
                    break;
            }
            // 统一处理多媒体信息
            // 配图
            for (let index = 0; index < temp.custom_images.length; index++) {
                const url = temp.custom_images[index];
                if (temp.type === 1) {
                    temp.custom_images[index] = {
                        url: url
                    };
                    temp.custom_origin_images[index] = {
                        url: url
                    };
                    continue;
                }
                let temp_urls = url.split('/');
                // 删除最后一个参数
                temp_urls.pop();
                // 添加新的参数
                temp_urls.push("0");
                temp.custom_images[index] = {
                    url: temp_urls.join('/')
                };
                temp.custom_origin_images[index] = {
                    url: temp_urls.join('/')
                };
            }
            // 视频
            for (const video of temp.source_info.video_list) {
                temp.custom_videos.push(video.video_info);
            }
            // 歌曲
            for (const music of temp.source_info.music_list) {
                temp.custom_audios.push(music.music_info);
            }
            // 处理完成后，移除来源信息
            delete temp.source_info;
        }
        return data;
    },

    /**
     * 获取收藏列表
     * @param {integer} page 当前页
     */
    getFavorites(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "type": 0,//全部\
            "start": page * QZone_Config.Favorites.pageSize,
            "num": QZone_Config.Favorites.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "need_nick": 1,
            "need_cnt": 0,
            "need_new_user": 0,
            "fupdate": 1,
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.FAVORITE_LIST_URL, params);
    }

};


/**
 * 分享源
 */
class ShareSource {

    /**
     * 
     * @param {string} title 分享标题
     * @param {string} desc 分享内容
     * @param {string} url 分享URL
     * @param {string} source_url 分享来源URL
     * @param {string} source_name 分享来源名称
     * @param {integer} count 分享次数
     * @param {Array} images 图片
     */
    constructor(title, desc, url, source_url, source_name, count, images) {
        this.title = title || '' // 标题
        this.desc = desc || '' // 内容
        this.url = url || ''// URL
        this.from = {
            url: source_url,
            name: source_name
        } // 来源
        this.count = count || 0 // 分享次数
        this.images = images || [] // 来源的图片
    }
}

/**
 * 分享信息
 */
class ShareInfo {

    /**
     * 
     * @param {integer} id ID
     * @param {string} uin 分享人
     * @param {string} nickname 分享人昵称
     * @param {string} type 分享类型
     * @param {string} desc 分享描述
     * @param {ShareSource} source 分享来源
     * @param {integer} shareTime 分享时间
     */
    constructor(id, uin, nickname, type, desc, source, shareTime) {
        this.id = id // ID
        this.uin = uin // 分享人
        this.nickname = nickname || '' // 分享人昵称
        this.type = type || ''// 分享类型
        this.desc = desc || ''// 分享信息
        this.source = source || {} // 分享来源
        this.shareTime = shareTime || 0 // 分享时间
        this.likes = [] // 点赞人
        this.likeTotal = 0 // 点赞数
        this.uniKey = '00' + uin + '00' + id
        this.comments = [] // 评论列表
        this.commentTotal = 0 // 评论数
    }
}

/**
 * 分享数据
 */
class ShareData {

    /**
     * 
     * @param {Array} list 分享信息
     * @param {integer} total 条目总数据
     */
    constructor(list, total) {
        this.list = list || [] // 分享信息
        this.total = total || 0 // 条目总数据
    }
}


/**
 * 分享模块API
 */
API.Shares = {

    /**
     * 获取类型
     */
    getDisplayType(innerType) {
        const Share_Types = {
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
        return Share_Types[innerType] || "其它";
    },

    getSourceType(url, defaultName) {
        if (!url) {
            return defaultName;
        }
        for (const sourceType of QZone_Config.Shares.SourceType) {
            const name = sourceType.name;
            for (const reg of sourceType.regulars) {
                if (url.match(new RegExp(reg))) {
                    return name;
                }
            }
        }
        if ('undefined' === defaultName) {
            // 特殊处理undefined字符串
            return '网页';
        }
        return defaultName;
    },

    /**
     * 获取分享列表
     * @param {integer} page 当前页
     */
    getList(page) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "page": page,  // 当前页，从1开始
            "num": QZone_Config.Shares.pageSize,  // 每页条目数
            "spaceuin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "isfriend": 0,
            "ttype": 0 // 全部分享类型
        }
        return API.Utils.get(QZone_URLS.SHARE_LIST_URL, params);
    },

    /**
     * 转换分享网页到数据
     * @param {String} html 分享页面内容
     */
    convert(html) {
        const shareData = new ShareData();
        if (!html) {
            return shareData;
        }
        // 转换到JQuery对象
        const $sharePage = jQuery(html);
        const shares = $sharePage.find('#shares > li') || [];
        // 总数
        const $total = $($sharePage.find('#app_mod > div.wrap > div.aside.col_lar.bg3 > div.mod_info.bg > div.mod_conts > p'));
        shareData.total = $total && $total.text().replace('条分享', '') * 1 || 0;
        // 当前页
        const currentPage = $($sharePage.find('#app_mod > div.page_wrap > div > p.mod_pagenav_main > span > span > span')).text();

        console.info('分析分享列表中，当前页：%s，条目数：%d，总条目数：%s', currentPage, shares.length, shareData.total);

        const dataList = [];
        for (const li of shares) {
            const $li = $(li);
            const $infoDiv = $($li.find('div.mod_info.bbor3.__item_main__'));
            if (!$infoDiv) {
                continue;
            }
            $li.find('script').each(function () {
                const text = $(this).text();
                if (text.indexOf('shareInfos.push') > -1) {
                    eval('window.infoJson=' + /[\s\S]+shareInfos.push\((\{[\s\S]+\})\);[\s\S]+/.exec(text)[1]);
                    return false;
                }
            })
            // 分享显示区
            const $contentDiv = $($infoDiv.find('div.mod_conts._share_desc_cont'));
            // 分享描述
            const $temp_desc = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming'));
            // 分享审核中
            const isReviewing = $temp_desc && $temp_desc.text() === '此条分享正在审核中';
            if (!window.infoJson || !window.infoJson.ugcPlatform || window.infoJson.ugcPlatform === '' || isReviewing) {
                continue;
            }
            // 分享源
            // 标题
            const $targetLink = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > h5 > strong > a.c_tx._share_title'));
            const title = $targetLink && $targetLink.html() || '';
            // 描述
            const $desc = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p:not(.mod_music,.c_tx3.comming)'));
            const desc = $desc && $desc.html() || '';
            // URL
            let url = $targetLink && $targetLink.attr('href') || '#';
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = "https://user.qzone.qq.com/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/" + url;
            }
            // 分享次数
            const $share_count = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p > span.share_count'));
            const count = $share_count && $share_count.text() || 0;
            // 分享来源URL
            const $fromLink = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming > a.c_tx3.mgrm'));
            const fromUrl = $fromLink && $fromLink.attr('href') || '#';
            let fromName = $fromLink && $fromLink.text() || '';
            fromName = API.Shares.getSourceType(fromUrl, fromName);
            // 配图
            const images = [];
            // 左图右文的图
            const $normal_images = $($contentDiv.find('div.mod_details.lbor > div.layout_s > a.img_wrap > img')) || [];
            if ($normal_images) {
                $normal_images.each(function () {
                    images.push({
                        url: $(this).attr('src') || $(this).attr('data-src')
                    });
                });
            }
            // 相册、相片的图
            const $album_images = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > div.mod_list > ul > li > a.img_wrap > img')) || [];
            if ($album_images) {
                $album_images.each(function () {
                    images.push({
                        url: $(this).attr('src') || $(this).attr('data-src')
                    });
                });
            }
            const shareSource = new ShareSource(title, desc, url, fromUrl, fromName, count * 1, images);

            // 分享时间
            const $shareTime = $($contentDiv.find('div.c_tx3.mod_scraps > span:nth-child(1)'));

            let shareTime = $shareTime && $shareTime.text() || '1970-01-01';

            const poster = infoJson.poster || {};
            const shareInfo = new ShareInfo(infoJson.id, poster.uin, poster.nickname, infoJson.type, infoJson.memo, shareSource, API.Utils.toDate(shareTime).getTime() / 1000);
            // 评论数
            const $commentCount = $($contentDiv.find('#' + li.id + '_commentCount'));
            shareInfo.commentTotal = $commentCount && $commentCount.text() * 1 || 0;
            // 点赞数
            const $likeTotal = $($contentDiv.find('div.c_tx3.mod_scraps > span.mgrs.like_count.right > span > a:nth-child(3)'));
            const likeTotal = $likeTotal && /赞\((\d)\)/.exec($likeTotal.text()) && /赞\((\d)\)/.exec($likeTotal.text())[1] || 0;
            shareInfo.likeTotal = likeTotal * 1;
            dataList.push(shareInfo);
        }
        shareData.list = dataList;
        return shareData;
    },

    /**
     * 获取分享评论列表
     * @param {integer} page 当前页
     */
    getComments(id, page) {
        const params = {
            "fupdate": 2,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Shares.Comments.pageSize,
            "num": QZone_Config.Shares.Comments.pageSize,
            "order": 1,
            "topicId": (QZone.Common.Target.uin || API.Utils.initUin().Target.uin) + "_" + id,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.SHARE_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 202,//202
            "param": targeId,
            "beginNum": QZone_Config.Shares.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Shares.Visitor.pageSize,
            "needFriend": 1,// TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        return API.Utils.get(QZone_URLS.VISITOR_SINGLE_LIST_URL, params);
    }

}

/**
 * 访客模块API
 */
API.Visitors = {

    /**
     * 获取访客列表
     * @param {integer} page 当前页
     */
    getList(page) {
        const isOwner = QZone.Common.Owner.uin === QZone.Common.Target.uin;
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "mask": isOwner ? 7 : 2,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "page": page,
            "fupdate": 1,
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQzoneToken()
        }
        if (isOwner) {
            params.clear = 1;
            params.sd = Math.random()
        }
        return API.Utils.get(isOwner ? QZone_URLS.VISITOR_MORE_LIST_URL : QZone_URLS.VISITOR_SIMPLE_LIST_URL, params);
    },

    /**
     * 是否访问主页
     * @param {Object} item 访客
     */
    isHome(item) {
        item.blogs = item.blogs || [];
        item.photoes = item.photoes || [];
        item.shuoshuoes = item.shuoshuoes || [];
        item.shares = item.shares || [];
        return item.blogs.length === 0 && item.photoes.length === 0 && item.shuoshuoes.length === 0 && item.shares.length === 0;
    },

    /**
     * 获取访问标题
     * @param {Object} item 访客
     */
    getTitle(item) {
        item.blogs = item.blogs || [];
        item.photoes = item.photoes || [];
        item.shuoshuoes = item.shuoshuoes || [];
        item.shares = item.shares || [];
        if (API.Visitors.isHome(item)) {
            // 主页
            return "访问了主页";
        }
        const titles = [];
        // 说说
        if (item.shuoshuoes.length > 0) {
            titles.push('说说');
        }
        // 日志
        if (item.blogs.length > 0) {
            titles.push('日志');
        }
        // 相册
        if (item.photoes.length > 0) {
            titles.push('相册');
        }
        // 分享
        if (item.shares.length > 0) {
            titles.push('分享');
        }
        return '查看了' + titles.join('、');
    }
}