// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符， 
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) 
// 例子： 
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18 
Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};

/**
 * String.format
 * //两种调用方式
 * var template1="我是{0}，今年{1}了";
 * var template2="我是{name}，今年{age}了";
 * var result1=template1.format("loogn",22);
 * var result2=template2.format({name:"loogn",age:22});
 */
String.prototype.format = function (args) {
    var result = this;
    if (arguments.length <= 0) {
        return result;
    }
    if (arguments.length == 1 && Array.isArray(args)) {
        for (var i = 0; i < args.length; i++) {
            if (args[i] != undefined) {
                var reg = new RegExp("({)" + i + "(})", "g");
                result = result.replace(reg, args[i]);
            }
        }
    } else if (arguments.length == 1 && typeof (args) == "object") {
        for (var key in args) {
            if (args[key] != undefined) {
                var reg = new RegExp("({" + key + "})", "g");
                result = result.replace(reg, args[key]);
            }
        }
    } else {
        for (var i = 0; i < arguments.length; i++) {
            if (arguments[i] != undefined) {
                var reg = new RegExp("({)" + i + "(})", "g");
                result = result.replace(reg, arguments[i]);
            }
        }
    }
    return result;
}

// 默认配置
var Qzone_Config = {
    // 说说模块
    Messages: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 40,
        isDownloadImgages: true,
        isDownloadVideo: false,
        isDownloadMusic: false
    },
    // 日志模块
    Blogs: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 50,
        isDownloadImgages: true,
        isDownloadVideo: false,
        isDownloadMusic: false
    },
    // 私密日记模块
    Diaries: {
        exportType: "markdown",
        querySleep: 2,
        pageSize: 50,
        isDownloadImgages: true,
        isDownloadVideo: false,
        isDownloadMusic: false
    },
    // 相册模块
    Photos: {
        exportType: "file",
        querySleep: 2,
        pageSize: 90,
        downCount: 5,
        isDownloadOriginal: true,
        isWriteExif: false
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
        pageSize: 20,
        isDownloadImgages: true
    },
    // QQ好友模块
    Friends: {
        exportType: "excel"
    }
};

/**
 * QQ空间Rest API配置
 */
const QZone_URLS = {

    /** 日志列表URL */
    BLOGS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs",

    /** 日志详情URL */
    BLOGS_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/blog_output_data",

    /** 私密日志列表URL */
    DIARY_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_get_titlelist",

    /** 私密日志详情URL */
    DIARY_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_output_data",

    /** QQ好友列表URL */
    FRIENDS_LIST_URL: "https://h5.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_show_qqfriends.cgi",

    /** QQ好友QQ空间个人档资料 */
    QZONE_USER_INFO_URL: "https://h5.qzone.qq.com/proxy/domain/base.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all",

    /** QQ好友添加时间 */
    USER_ADD_TIME_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/friendship/cgi_friendship",

    /** 好友亲密度 */
    INTIMACY_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi",

    /** 说说列表URL */
    MESSAGES_LIST_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6",

    /** 留言板列表URL */
    BOARD_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb',

    /** 相册列表URL */
    PHOTOS_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3',

    /** 相片列表URL */
    IMAGES_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo',

    /** 视频列表URL */
    VIDEO_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data'
};

const FOLDER_ROOT = '/QQ空间备份/';
var QZone = {
    ZIP_NAME: 'QQ空间备份',
    Common: {
        loginUin: null,
        targetUin: null,
        token: null,
        gtk: null,
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
    }
};

var API = {};
/**
 * 工具类
 */
API.Utils = {

    /**
     * 转换为ArrayBuffer
     */
    toArrayBuffer: function (str) {
        let buf = new ArrayBuffer(str.length)
        let view = new Uint8Array(buf)
        for (let i = 0; i !== str.length; ++i) {
            view[i] = str.charCodeAt(i) & 0xFF
        }
        return buf;
    },

    /**
     * 根据时间分组
     * @param {array} data 数据集合
     * @param {string} timeField 时间字段名
     */
    groupedByTime: function (data, timeField) {
        data = data || [];
        let groupData = new Map();
        data.forEach(function (item) {
            let time = item[timeField];
            let date = null;
            if (typeof (time) === 'string') {
                date = new Date(time);
            } else {
                date = new Date(time * 1000);
            }
            if (!date) {
                date = new Date('1970-01-01');
            }
            let yearTempData = groupData.get(date.getFullYear()) || new Map();
            let monthTempData = yearTempData.get(date.getMonth() + 1) || [];
            monthTempData.push(item);
            yearTempData.set(date.getMonth() + 1, monthTempData);
            groupData.set(date.getFullYear(), yearTempData);
        });
        return groupData;
    },

    /**
     * 写入内容到文件
     * @param {string} content 内容
     * @param {string} filepath FileSystem路径
     * @param {funcation} doneFun 
     * @param {funcation} failFun 
     */
    writeFile: function (content, filepath, doneFun, failFun) {
        QZone.Common.Filer.write(filepath, { data: content, type: "text/plain", append: true }, (fileEntry) => {
            doneFun(fileEntry);
        }, (err) => {
            if (failFun) {
                failFun(err);
            }
        });
    },

    /**
     * 写入内容到文件
     * @param {string} buffer 内容
     * @param {string} filepath FileSystem路径
     * @param {funcation} doneFun 
     * @param {funcation} failFun 
     */
    writeExcel: function (buffer, filepath, doneFun, failFun) {
        QZone.Common.Filer.write(filepath, { data: buffer }, (fileEntry) => {
            doneFun(fileEntry);
        }, (err) => {
            if (failFun) {
                failFun(err);
            }
        });
    },

    /**
     * 获取文件类型
     * @param {string} url 文件URL
     * @param {funcation} doneFun 回调函数
     */
    getMimeType: function (url, doneFun) {
        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', url, true);
        xhr.onreadystatechange = function () {
            if (2 == xhr.readyState) {
                var ret = {
                    mimeType: xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type'),
                    size: xhr.getResponseHeader('content-length') || xhr.getResponseHeader('Content-Length')
                };
                doneFun(ret);
            }
        };
        xhr.send();
    },

    /**
     * 下载并写入文件到FileSystem
     * @param {string} url 图片URL
     * @param {string} path FileSystem文件路径
     * @param {funcation} doneFun 
     * @param {funcation} failFun 
     */
    writeImage: function (url, path, isMimeType) {
        return new Promise(async function (resolve, reject) {
            await API.Utils.send(url, 'blob').then((xhr) => {
                let res = xhr.response;
                if (isMimeType && res) {
                    path += '.' + res.type.split('/')[1];
                }
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
     * 压缩
     * @param {string} root 文件或文件夹路径
     * @param {function} doneFun 
     * @param {function} failFun 
     */
    Zip: function (root) {
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

    send: function (url, responseType) {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.open("GET", url);
            if (responseType) {
                request.responseType = responseType;
            }
            // 允许跨域
            request.withCredentials = true;
            request.onload = (xhr) => resolve(request);
            request.onerror = (xhr) => reject(xhr);
            request.ontimeout = (xhr) => reject(xhr);
            request.onabort = (xhr) => reject(xhr);
            request.send();
        });
    },

    downloadFile: function (url) {
        return this.send(url, 'blob');
    },

    /**
     * GET 请求
     * @param {*} url 
     * @param {*} doneFun 
     * @param {*} failFun 
     */
    get: function (url, doneFun, failFun) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                success: function (result, status, xhr) {
                    resolve(result);
                },
                error: function (xhr, status, error) {
                    reject(error);
                }
            });
        });
    },

    /**
     * POST 请求
     * @param {string} url 
     * @param {object} params 
     * @param {function} doneFun 
     * @param {function} failFun 
     */
    post: function (url, params, doneFun, failFun) {
        $.ajax({
            url: url,
            method: 'POST',
            data: params
        })
            .done(function (data, textStatus, jqXHR) {
                if (doneFun) {
                    doneFun(data, textStatus, jqXHR);
                } else {
                    return data;
                }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                if (failFun) {
                    failFun([], textStatus, errorThrown);
                } else {
                    return [];
                }
            });
    },

    /**
     * 获取URL参数值
     * @param {string} name 
     */
    getUrlParam: function (name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return decodeURI(r[2]); return null;
    },

    /**
     * 获取URL参数值
     * @param {string} url 
     * @param {string} name 
     */
    getUrlParam: function (url, name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        var r = url.search.substr(1).match(reg);
        if (r != null) return decodeURI(r[2]); return null;
    },

    /**
     * 获取URL参数值
     * @param {string} url 
     */
    toParams: function (url) {
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
    toUrl: function (url, params) {
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
    getCookie: function (name) {
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length == 2) {
            return parts.pop().split(";").shift();
        }
    },

    /**
     * 从 HTML 页面找到 token 保存起来
     */
    getQzoneToken: function () {
        $("script").each(function (index) {
            var t = $(this).text();
            t = t.replace(/\ /g, "");
            if (t.indexOf('window.g_qzonetoken') !== -1) {
                var qzonetokenM = /return"(\w*?)";/g;
                var qzonetoken = qzonetokenM.exec(t);
                if (qzonetoken != null && qzonetoken != '') {
                    QZone.Common.token = qzonetoken[1];
                    return false;
                }
            }
        });
        return QZone.Common.token;
    },

    /**
     * 获取QQ号
     */
    getUin: function () {
        // 获取目标QQ
        let rs = /\/user\.qzone\.qq\.com\/([\d]+)/.exec(window.location.href);
        if (rs) {
            QZone.Common.targetUin = rs[1] - 0;
            // 获取登录QQ
            QZone.Common.loginUin = /\d.+/g.exec(this.getCookie('uin'))[0] - 0;
        }
        return {
            'loginUin': QZone.Common.loginUin,
            'targetUin': QZone.Common.targetUin
        }
    },

    /**
     * 生成 g_tk
     * @param {string} url
     */
    gen_gtk: function (url) {
        var skey;
        url = url || window.location.href;
        if (url.indexOf("qzone.qq.com") > 0) {
            skey = this.getCookie("p_skey");
        } else {
            if (url.indexOf("qq.com") > 0) {
                skey = this.getCookie("skey") || this.getCookie("rv2");
            }
        }
        var hash = 5381;
        for (var i = 0, len = skey.length; i < len; ++i) {
            hash += (hash << 5) + skey.charAt(i).charCodeAt();
        }
        return hash & 2147483647;
    },

    /**
     * @param {integer} ms 毫秒
     */
    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    },

    /**
     * 生成一个UUID
     */
    guid: function () {
        var s4 = function () {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    },

    /**
     * 去掉标题里不太方便的字符
     *
     * @param {原名} name
     */
    filenameValidate: function (name) {
        name = name.replace(/:/g, "-");
        name = name.replace(/[\\\/\*\"<>|]/g, "_");
        return name;
    },

    /**
     * 按照长度给指定的数字前面补0
     * @param {int} num 
     * @param {int} length 
     */
    prefixNumber: function (num, length) {
        return (Array(length).join('0') + num).slice(-length);
    },

    decode: function (b) {
        return b && b.replace(/(%2C|%25|%7D)/g, function (b) {
            return unescape(b);
        })
    },

    /**
     * 转换@内容
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    mentionFormat: function (contet, type) {
        if (!contet || 0 > contet.indexOf("@"))
            return contet;
        return contet = contet.replace(/@\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))?(?:,auto:([^\}]*))?\}/g, function (str, uin, name) {
            var result = "@" + API.Utils.decode(name);
            switch (type) {
                case 'HTML':
                    result = "<a href='https://user.qzone.qq.com/'" + uin + " target='_blank'>" + result + "</a>";
                    break;
                case 'MD':
                    result = '[' + result + '](https://user.qzone.qq.com/' + uin + ')';
                    break;
            }
            return result;
        })
    },

    /**
     * 转换表情内容
     * @param {string} contet 表情内容
     */
    emojiFormat: function (contet) {
        if (!contet) {
            return contet;
        }
        return contet = contet.replace(/\[em\]e\d+\[\/em\]/gi, function (emoji) {
            let eId = emoji.replace('[em]', '').replace('[/em]', '');
            if (eId) {
                emoji = '![](http://qzonestyle.gtimg.cn/qzone/em/' + emoji.replace('[em]', '').replace('[/em]', '') + '.gif)';
            }
            return emoji;
        })
    },

    /**
     * 替换URL链接
     * @param {string} contet 表情内容
     */
    urlFormat: function (contet) {
        if (!contet) {
            return contet;
        }
        return contet = contet.replace(/(https|http|ftp|rtsp|mms)?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*/g, function (url) {
            return '[网页链接](' + url + ')';
        })
    },

    /**
     * 转换内容
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    formatContent: function (contet, type) {
        if (!contet) {
            return contet;
        }
        // 替换URL内容
        contet = this.urlFormat(contet);
        // 转换@内容
        contet = this.mentionFormat(contet, type);
        // 转换表情内容
        contet = this.emojiFormat(contet);
        return contet;
    },

    /**
     * 字节转换大小
     * @param {byte} bytes 
     */
    bytesToSize: function (bytes) {
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
    createFolder: function (path) {
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
        if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission(function (status) {
                var notice_ = new Notification(title, { body: message });
                notice_.onclick = function () {
                    // 单击消息提示框，进入浏览器页面
                    window.focus();
                }
            });
        }
    }
};

/**
 * 日志模块API
 */
API.Blogs = {

    getBlogMediaTypeTitle: function (e) {
        var t = {
            0: "日志中包含图片",
            13: "日志中包含视频"
        };
        for (var i in t) {
            if (this.getEffectBit(e, i)) {
                return t[i];
            }
        }
        return null;
    },

    getBlogLabel: function (e) {
        var t = [["8", "审核不通过"], ["22", "审核中"], ["4", "顶"], ["21", "荐"], ["3", "转"], ["28", "转"], ["35", "转"], ["36", "转"]];
        var a = '';
        for (var o = 0; o < t.length; o++) {
            var n = t[o][0];
            if (n == 22) {
                continue;
            }
            if (this.getEffectBit(e, n)) {
                a += '[{0}]'.format(t[o][1]);
                break;
            }
        }
        return a;
    },

    getEffectBit: function (e, t) {
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
     * 获取日志列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getBlogs: function (page) {
        let params = {
            "hostUin": QZone.Common.targetUin,
            "uin": QZone.Common.loginUin,
            "blogType": "0",
            "cateName": "",
            "cateHex": "",
            "statYear": new Date().getFullYear(),
            "reqInfo": "7",
            "pos": page * Qzone_Config.Blogs.pageSize,
            "num": Qzone_Config.Blogs.pageSize,
            "sortType": "0",
            "source": "0",
            "rand": Math.random(),
            "ref": "qzone",
            "g_tk": API.Utils.gen_gtk(),
            "verbose": "1",
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.BLOGS_LIST_URL, params));
    },

    /**
     * 获取日志详情
     *
     * @param {integer} blogid 日志ID
     */
    getInfo: function (blogid) {
        let params = {
            "uin": QZone.Common.targetUin,
            "blogid": blogid,
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "mode": "2",
            "numperpage": "15",
            "timestamp": Math.floor(Date.now() / 1000),
            "dprefix": "",
            "inCharset": "gb2312",
            "outCharset": "gb2312",
            "ref": "qzone",
            "page": "1",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&page=1&catalog=list"
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.BLOGS_INFO_URL, params));
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
    getDiaries: function (page) {
        let params = {
            "uin": QZone.Common.loginUin,
            "vuin": QZone.Common.loginUin,
            "pos": page * Qzone_Config.Diaries.pageSize,
            "numperpage": Qzone_Config.Diaries.pageSize,
            "pwd2sig": "",
            "r": Math.random(),
            "fupdate": "1",
            "iNotice": "0",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.DIARY_LIST_URL, params));
    },

    /**
    * 获取私密日志详情
    *
    * @param {string} uin QQ号
    * @param {integer} blogid 日志ID
    */
    getInfo: function (blogid) {
        let params = {
            "uin": QZone.Common.loginUin,
            "blogid": blogid,
            "pwd2sig": "",
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "rs": Math.random(),
            "private": "1",
            "ref": "qzone",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&catalog=private&page=1"
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.DIARY_INFO_URL, params));
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
    getFriends: function () {
        let params = {
            "uin": QZone.Common.loginUin,
            "follow_flag": "0",//是否获取关注的认证空间
            "groupface_flag": "0",//是否获取QQ群组信息
            "fupdate": "1",
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.FRIENDS_LIST_URL, params));
    },

    /**
     * 获取QQ好友详情
     */
    getQzoneUserInfo: function (targetUin) {
        let params = {
            "uin": targetUin,
            "vuin": QZone.Common.loginUin,
            "fupdate": "1",
            "rd": Math.random(),
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        // code = -3000 未登录
        // code = -4009 无权限
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.QZONE_USER_INFO_URL, params));
    },

    /**
     * 获取QQ好友添加时间
     * @param {string} targetUin 好友QQ号
     */
    getFriendshipTime: function (targetUin) {
        let params = {
            "activeuin": QZone.Common.loginUin,
            "passiveuin": targetUin,
            "situation": "1",
            "isCalendar": "1",
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.USER_ADD_TIME_URL, params));
    },

    /**
     * 获取好友亲密度
     * @param {string} targetUin 搜索的QQ号
     */
    getIntimacy: function (targetUin) {
        let params = {
            "uin": targetUin,
            "param": "15",
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.INTIMACY_URL, params));
    }
};

/**
 * 说说模块API
 */
API.Messages = {

    /**
     * 获取说说列表
     * @param {integer} page 第几页
     */
    getMessages: function (page) {
        let params = {
            "uin": QZone.Common.targetUin,
            "ftype": "0",
            "sort": "0",
            "pos": page * Qzone_Config.Messages.pageSize,
            "num": Qzone_Config.Messages.pageSize,
            "replynum": "100",
            "g_tk": API.Utils.gen_gtk(),
            "callback": "_preloadCallback",
            "code_version": "1",
            "format": "jsonp",
            "need_private_comment": "1",
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_LIST_URL, params));
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
    getBoards: function (page) {
        let params = {
            "uin": QZone.Common.loginUin,
            "hostUin": QZone.Common.targetUin,
            "start": page * Qzone_Config.Boards.pageSize,
            "s": Math.random(),
            "format": "jsonp",
            "num": Qzone_Config.Boards.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "g_tk": API.Utils.gen_gtk(),
            "qzonetoken": QZone.Common.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.BOARD_LIST_URL, params));
    }
};

/**
 * 相册模块API
 */
API.Photos = {

    /**
     * 获取相册列表
     * @param {integer} page 当前页
     */
    getPhotos: function (page) {
        let params = {
            "g_tk": API.Utils.gen_gtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "hostUin": QZone.Common.targetUin,
            "uin": QZone.Common.loginUin,
            "appid": "4",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "source": "qzone",
            "plat": "qzone",
            "format": "jsonp",
            "notice": "0",
            "filter": "1",
            "handset": "4",
            "pageNumModeSort": "40",
            "pageNumModeClass": "40",
            "needUserInfo": "1",
            "idcNum": "4",
            "pageStart": page * Qzone_Config.Photos.pageSize,
            "pageNum": Qzone_Config.Photos.pageSize,
            "mode": "2",// 指定查询普通视图
            // "mode": "3",// 指定查询分类视图
            "callbackFun": "shine0",
            "_": Date.now()
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.PHOTOS_LIST_URL, params));
    },

    /**
     * 获取相册相片列表
     * @param {string} topicId 相册ID
     * @param {string} page 当前页
     */
    getImages: function (topicId, page) {
        let params = {
            "g_tk": API.Utils.gen_gtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "mode": "0",
            "idcNum": "4",
            "hostUin": QZone.Common.targetUin,
            "topicId": topicId,
            "noTopic": "0",
            "uin": QZone.Common.loginUin,
            "pageStart": page * Qzone_Config.Photos.pageSize,
            "pageNum": Qzone_Config.Photos.pageSize,
            "skipCmtCount": "0",
            "singleurl": "1",
            "batchId": "",
            "notice": "0",
            "appid": "4",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "source": "qzone",
            "plat": "qzone",
            "outstyle": "json",
            "format": "jsonp",
            "json_esc": "1",
            "callbackFun": "shine0",
            "_": Date.now()
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.IMAGES_LIST_URL, params));
    },

    /**
     * 获取相片外链(无权限也可以访问)
     */
    getExternalUrl: function (oldurl) {
        let reg = /http\w?:\/\/.*?\/psb\?\/(.*?)\/(.*?)\/\w\/(.*?)$/gi
        let result;
        let newurl;
        if ((result = reg.exec(oldurl)) !== null) {
            newurl = "//r.photo.store.qq.com/psb?/" + result[1] + "/" + result[2] + "/r/" + result[3] + "_yake_qzoneimgout.png";
            return newurl;
        } else {
            return null;
        }
    },

    /**
     * 转换URL
     * @param {string} e 
     */
    trimDownloadUrl: function (url) {
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
     * 获取照片下载URL
     * @param {object} photo 
     */
    getDownloadUrl: function (photo) {
        if (photo.origin_upload == 1) {
            return API.Photos.trimDownloadUrl(photo.origin_url || photo.url);
        } else if (photo.raw_upload == 1) {
            return API.Photos.trimDownloadUrl(photo.raw || photo.url);
        } else {
            return API.Photos.trimDownloadUrl(photo.downloadUrl || photo.url);
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
    getVideos: function (page) {
        let params = {
            "g_tk": API.Utils.gen_gtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "uin": QZone.Common.loginUin,
            "hostUin": QZone.Common.targetUin,
            "appid": "4",
            "getMethod": "2",
            "start": page * Qzone_Config.Videos.pageSize,
            "count": Qzone_Config.Videos.pageSize,
            "need_old": "0",
            "getUserInfo": "0",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "refer": "qzone",
            "source": "qzone",
            "callbackFun": "shine0",
            "_": Date.now()
        }
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.VIDEO_LIST_URL, params));
    }

};