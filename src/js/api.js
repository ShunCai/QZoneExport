/**
 * QQ空间Rest API配置
 */
const QZone_URLS = {

    /** 日志列表URL */
    BLOGS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs",

    /** 日志评论列表URL */
    BLOGS_COMMENTS_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_comment_list",

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

    /** 说说详情URL */
    MESSAGES_DETAIL_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 说说评论列表URL */
    MESSAGES_COMMONTS_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 留言板列表URL */
    BOARD_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb',

    /** 相册列表URL */
    PHOTOS_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3',

    /** 相片列表URL */
    IMAGES_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo',

    /** 视频列表URL */
    VIDEO_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data',

    /** 我的收藏 */
    FAVORITE_LIST_URL: 'https://h5.qzone.qq.com/proxy/domain/fav.qzone.qq.com/cgi-bin/get_fav_list'
};

var API = {

};

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

    /**
     * 发送请求
     * @param {string} url 
     * @param {string} responseType 
     */
    send: function (url, responseType) {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.open("GET", url);
            if (responseType) {
                request.responseType = responseType;
            }
            // 允许跨域
            request.withCredentials = true;
            request.onload = () => resolve(request);
            request.onerror = (xhr) => reject(xhr);
            request.ontimeout = (xhr) => reject(xhr);
            request.onabort = (xhr) => reject(xhr);
            request.send();
        });
    },

    /**
     * 下载文件
     * @param {string} url 
     */
    downloadFile: function (url) {
        return this.send(url, 'blob');
    },

    /**
     * GET 请求
     * @param {*} url 
     * @param {*} doneFun 
     * @param {*} failFun 
     */
    get: function (url) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
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
    getQzoneToken: function () {
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
     * 从 HTML 页面找到用户信息
     */
    getOwnerProfile: function () {
        $("script").each(function () {
            var t = $(this).text();
            t = t.replace(/\ /g, "");
            if (t.indexOf('ownerProfileSummary') !== -1) {
                let regRes = /ownerProfileSummary=([\s\S]+)]/g.exec(t)[1];
                let profile = JSON.parse(regRes.substr(0, regRes.indexOf('"]') + 2));
                QZone.Common.Owner = {
                    uin: QZone.Common.Owner.uin,
                    name: profile[0],
                    city: profile[3],
                    title: profile[4],
                    desc: profile[5]
                }
            }
        });
        return QZone.Common.Owner;
    },

    /**
     * 获取QQ号
     */
    initUin: function () {
        // 获取目标QQ
        let rs = /\/user\.qzone\.qq\.com\/([\d]+)/.exec(window.location.href);
        if (rs) {
            // 获取登录QQ
            QZone.Common.Owner.uin = /\d.+/g.exec(this.getCookie('uin'))[0] - 0;
            QZone.Common.Target = {
                uin: rs[1] - 0,
                title: document.title,
                description: $('meta[name="description"]').attr("content"),
            }
        }
        return QZone.Common;
    },

    /**
     * 生成 g_tk
     * @param {string} url
     */
    initGtk: function (url) {
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
        return QZone.Common.Config.gtk = hash & 2147483647;
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
     * 替换文件名特殊符号
     *
     * @param {原名} name
     */
    filenameValidate: function (name) {
        var reg = new RegExp(/'|#|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g);
        name = name.replace(reg, "_");
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

    /**
     * 转码
     * @param {string} b 
     */
    decode: function (b) {
        return b && b.replace(/(%2C|%25|%7D)/g, function (b) {
            return unescape(b);
        })
    },

    /**
     * 获取用户空间地址
     */
    getUserLink: (uin, nickName) => {
        return "<a href='https://user.qzone.qq.com/" + uin + "' target='_blank'>" + nickName + "</a>"
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
                    result = "<a href='https://user.qzone.qq.com/" + uin + "' target='_blank'>" + result + "</a>";
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
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    emojiFormat: function (contet, type) {
        if (!contet) {
            return contet;
        }
        return contet = contet.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em').replace(/\[em\]e\d+\[\/em\]/gi, function (emoji) {
            let eId = emoji.replace('[em]', '').replace('[/em]', '');
            if (eId) {
                let imgSrc = '/qzone/em/' + emoji.replace('[em]', '').replace('[/em]', '') + '.gif';
                switch (type) {
                    case 'HTML':
                        emoji = "<img src='http://qzonestyle.gtimg.cn" + imgSrc + "'";
                        break;
                    case 'MD':
                        emoji = '![](http://qzonestyle.gtimg.cn' + imgSrc + ')';
                        break;
                }
            }
            return emoji;
        })
    },

    /**
     * 替换URL链接
     * @param {string} contet URL
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    urlFormat: function (contet, type) {
        if (!contet) {
            return contet;
        }
        return contet = contet.replace(/(https|http|ftp|rtsp|mms)?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*/g, function (url) {
            switch (type) {
                case 'MD':
                    url = '[网页链接](' + url + ')';
                    break;
            }
            return url;
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
        contet = this.urlFormat(contet, type);
        // 转换@内容
        contet = this.mentionFormat(contet, type);
        // 转换表情内容
        contet = this.emojiFormat(contet, type);
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
            Notification.requestPermission(function () {
                var notice_ = new Notification(title, { body: message });
                notice_.onclick = function () {
                    // 单击消息提示框，进入浏览器页面
                    window.focus();
                }
            });
        }
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    formatDate: (time) => {
        return new Date(time * 1000).format('yyyy-MM-dd hh:mm:ss');
    },

    /**
     * JSON转换对象
     *  @param {string} json 
     *  @param {string} jsonpKey 
     */
    parseData: (json, jsonpKey) => {
        json = json.replace(jsonpKey, "");
        json = json.replace(/\);$/, "");
        return JSON.parse(json);
    },

    /**
     * 转换超链接
     * @param {string} str 
     */
    urlToLink: function (str) {
        var urlPattern = new RegExp('((news|telnet|nttp|file|http|ftp|https)://)(([-A-Za-z0-9_]+(\\.[-A-Za-z0-9_]+)*(\\.[-A-Za-z]{2,5}))|([0-9]{1,3}(\\.[0-9]{1,3}){3}))(:[0-9]*)?(/[-A-Za-z0-9_\\$\\.\\+\\!*()<>{},;:@&=?/~#%\'`]*)*', 'ig');
        if (str == '') {
            return str;
        }
        return str.replace(urlPattern, function ($1) {
            return '<a href="' + $1 + '" target="_blank" >' + $1 + '</a>';
        });
    },

    /**
     * 转换@内容
     * @param {string} str 
     */
    replaceMention: function (str) {
        var mentionPattern = /(?:@\{uin:([\w-_]+),nick:([^\},]*)(?:,who:(\d+))?(?:,auto:(\d+))?\})|[^@]+/g;
        if (str == '') {
            return str;
        }
        return str.replace(mentionPattern, function () {
            var arg = arguments;
            var mentionEncodingMap = {
                '}': /%7D/g,
                ',': /%2C/g,
                '%': /%25/g
            };
            if (arg[1] && arg[2]) {
                var nick = arg[2];
                for (var i in mentionEncodingMap) {
                    nick = nick.replace(mentionEncodingMap[i], i);
                }
                return '<a href="http://user.qzone.qq.com/' + arg[1] + '" target="_blank">@' + nick + '</a>';
            } else {
                return arg[0];
            }
        });
    },

    /**
     * 转换表情内容为超链接
     * @param {string} str 
     */
    changeToUBBHTML: function (str) {
        return str.replace(/\[em\](\w+)\[\/em\]/g, function ($1, $2) {
            return '<img src="http://' + window.siDomain + '/qzone/em/' + $2 + '.gif" />';
        });
    },

    /**
     * 转换内容
     * @param {string} str 
     */
    richTextReplace: function (str) {
        return API.Utils.replaceMention(API.Utils.changeToUBBHTML(API.Utils.urlToLink(str)));
    },

    /**
     * 转换话题
     * @param {string} str 
     */
    replaceTopic: function (str) {
        var arr = str.split('#');
        if (arr.length <= 2) {
            return str;
        }
        return arr.shift() + '<a href="http://rc.qzone.qq.com/qzonesoso/?search=' + encodeURIComponent(arr[1]) + '" target="_blank">#' + arr.shift() + '#</a>' + arr.join('#');
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
            "hostUin": QZone.Common.Target.uin,
            "uin": QZone.Common.Owner.uin,
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
            "g_tk": QZone.Common.Config.gtk,
            "verbose": "1",
            "qzonetoken": QZone.Common.Config.token
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
            "uin": QZone.Common.Target.uin,
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
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.BLOGS_INFO_URL, params));
    },


    /**
     * 获取日志评论列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getComments: function (blogid, page) {
        let params = {
            "uin": QZone.Common.Owner.uin,
            "num": 50,
            "topicId": QZone.Common.Target.uin + "_" + blogid,
            "start": page * 50,
            "r": Math.random(),
            "iNotice": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.BLOGS_COMMENTS_URL, params));
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
            "uin": QZone.Common.Owner.uin,
            "vuin": QZone.Common.Owner.uin,
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
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
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
            "uin": QZone.Common.Owner.uin,
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
            "uin": QZone.Common.Owner.uin,
            "follow_flag": "0",//是否获取关注的认证空间
            "groupface_flag": "0",//是否获取QQ群组信息
            "fupdate": "1",
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.FRIENDS_LIST_URL, params));
    },

    /**
     * 获取QQ好友详情
     */
    getQzoneUserInfo: function () {
        let params = {
            "uin": QZone.Common.Target.uin,
            "vuin": QZone.Common.Owner.uin,
            "fupdate": "1",
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        };
        // code = -3000 未登录
        // code = -4009 无权限
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.QZONE_USER_INFO_URL, params));
    },

    /**
     * 获取QQ好友添加时间
     */
    getFriendshipTime: function () {
        let params = {
            "activeuin": QZone.Common.Owner.uin,
            "passiveuin": QZone.Common.Target.uin,
            "situation": "1",
            "isCalendar": "1",
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.USER_ADD_TIME_URL, params));
    },

    /**
     * 获取好友亲密度
     */
    getIntimacy: function () {
        let params = {
            "uin": QZone.Common.Target.uin,
            "param": "15",
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
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
            "uin": QZone.Common.Target.uin,
            "ftype": "0",
            "sort": "0",
            "pos": page * Qzone_Config.Messages.pageSize,
            "num": Qzone_Config.Messages.pageSize,
            "replynum": "100",
            "g_tk": QZone.Common.Config.gtk,
            "callback": "_preloadCallback",
            "code_version": "1",
            "format": "jsonp",
            "need_private_comment": "1",
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_LIST_URL, params));
    },


    /**
     * 获取说说详情
     * @param {integer} id 说说ID
     */
    getDetail: function (id) {
        let params = {
            "uin": QZone.Common.Target.uin,
            "tid": id,
            "t1_source": "undefined",
            "ftype": 0,
            "sort": 0,
            "pos": 0,
            "num": 50,
            "g_tk": QZone.Common.Config.gtk,
            "callback": "_preloadCallback",
            "code_version": 1,
            "format": "jsonp",
            "need_private_comment": 1,
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_DETAIL_URL, params));
    },


    /**
     * 获取说说评论列表
     * @param {integer} page 第几页
     */
    getComments: function (id, page) {
        let params = {
            "need_private_comment": 1,
            "uin": QZone.Common.Owner.uin,
            "hostUin": QZone.Common.Target.uin,
            "start": page * 50,
            "num": 50,
            "order": 0,
            "topicId": QZone.Common.Target.uin + "_" + id,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        };
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_COMMONTS_URL, params));
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
            "uin": QZone.Common.Owner.uin,
            "hostUin": QZone.Common.Target.uin,
            "start": page * Qzone_Config.Boards.pageSize,
            "s": Math.random(),
            "format": "jsonp",
            "num": Qzone_Config.Boards.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
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
            "g_tk": QZone.Common.Config.gtk,
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "hostUin": QZone.Common.Target.uin,
            "uin": QZone.Common.Owner.uin,
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
            "g_tk": QZone.Common.Config.gtk,
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "mode": "0",
            "idcNum": "4",
            "hostUin": QZone.Common.Target.uin,
            "topicId": topicId,
            "noTopic": "0",
            "uin": QZone.Common.Owner.uin,
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
            "g_tk": QZone.Common.Config.gtk,
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "uin": QZone.Common.Owner.uin,
            "hostUin": QZone.Common.Target.uin,
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



/**
 * 收藏夹模块API
 */
API.Favorites = {

    /**
     * 获取查询类型
     */
    getQueryType: (innerType) => {
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
    getType: (innerType) => {
        let Fav_Tyep = {
            0: "全部",
            1: "网页",
            2: "未知",
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
     * 转换数据
     */
    parse: (data) => {
        console.info("收藏列表转换前：", data);
        for (var i = 0; i < data.length; i++) {
            let temp = data[i];
            temp.custom_create_time = API.Utils.formatDate(temp.create_time);
            temp.custom_uin = QZone.Common.Owner.uin;
            temp.custom_name = QZone.Common.Owner.name;
            temp.custom_abstract = API.Utils.richTextReplace(temp.abstract || "");
            temp.album_info = temp.album_info || {};
            temp.blog_info = temp.blog_info || {};
            temp.photo_list = temp.photo_list || [];
            temp.shuoshuo_info = temp.shuoshuo_info || {};
            temp.share_info = temp.share_info || {};
            temp.url_info = temp.url_info || {};
            temp.img_list = temp.img_list || [];
            temp.origin_img_list = temp.origin_img_list || [];
            temp.text = temp.text || '';
            temp.custom_text = API.Utils.richTextReplace(temp.text || '');
            temp.custom_title = temp.title;
            temp.album_info.description = temp.album_info.description || '';
            switch (temp.type) {
                case 0:
                    break;
                case 1:
                    temp.url_info.custom_url = API.Utils.richTextReplace(temp.url_info.url);
                    temp.custom_video_list = temp.url_info.video_list;
                    temp.custom_music_list = temp.url_info.music_list;
                    break;
                case 2:
                    break;
                case 3:
                    temp.custom_video_list = temp.blog_info.video_list;
                    temp.custom_music_list = temp.blog_info.music_list;
                    break;
                case 4:
                    temp.custom_video_list = temp.album_info.video_list;
                    temp.custom_music_list = temp.album_info.music_list;
                    break;
                case 5:
                    temp.custom_abstract = API.Utils.replaceTopic(temp.custom_abstract);
                    temp.custom_video_list = temp.shuoshuo_info.video_list;
                    temp.custom_music_list = temp.shuoshuo_info.music_list;
                    temp.shuoshuo_info.custom_reason = API.Utils.richTextReplace(temp.shuoshuo_info.reason || "");
                    temp.shuoshuo_info.detail_shuoshuo_info = temp.shuoshuo_info.detail_shuoshuo_info || {};
                    temp.shuoshuo_info.detail_shuoshuo_info.content = API.Utils.richTextReplace(temp.shuoshuo_info.detail_shuoshuo_info.content || "");
                    break;
                case 6:
                    break;
                case 7:
                    temp.share_info.reason = temp.share_info.reason.split('||')[0];
                    temp.custom_video_list = temp.share_info.video_list;
                    temp.custom_music_list = temp.share_info.music_list;
                    break;
                case 8:
                    break;
                default:
                    break;
            }
            temp.custom_video_list = temp.custom_video_list || [];
            temp.custom_music_list = temp.custom_music_list || [];
            if (temp.share_info.reason) {
                temp.share_info.custom_reason = API.Utils.richTextReplace(temp.share_info.reason);
            }
        }
        console.info("收藏列表转换后：", data);
        return data;
    },

    /**
     * 获取收藏列表
     * @param {integer} page 当前页
     */
    getFavorites: function (page) {
        let params = {
            "uin": QZone.Common.Owner.uin,
            "type": "0",
            "start": page * Qzone_Config.Favorites.pageSize,
            "num": Qzone_Config.Favorites.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "need_nick": "1",
            "need_cnt": "1",
            "need_new_user": "1",
            "fupdate": "1",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk,
            "qzonetoken": QZone.Common.Config.token
        }
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.FAVORITE_LIST_URL, params));
    }

};