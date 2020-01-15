/**
 * QQ空间Rest API配置
 */
const QZone_URLS = {

    /** 说说列表URL */
    MESSAGES_LIST_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6",

    /** 说说详情URL */
    MESSAGES_DETAIL_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 说说评论列表URL */
    MESSAGES_COMMONTS_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

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
     * @param {string} timeField 时间字段名
     */
    groupedByTime(data, timeField) {
        data = data || [];
        let groupData = new Map();
        for (const item of data) {
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
        }
        return groupData;
    },

    /**
     * 写入内容到文件
     * @param {string} content 内容
     * @param {string} filepath FileSystem路径
     */
    writeFile(content, filepath) {
        return new Promise(function (resolve, reject) {
            QZone.Common.Filer.write(filepath, { data: content, type: "text/plain", append: true }, (fileEntry) => {
                resolve(fileEntry);
            }, (error) => {
                reject(error);
            });
        });
    },

    /**
     * 写入内容到文件
     * @param {string} buffer 内容
     * @param {string} filepath FileSystem路径
     * @param {funcation} doneFun 
     * @param {funcation} failFun 
     */
    writeExcel(buffer, filepath, doneFun, failFun) {
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
    getMimeType(url) {
        return new Promise(function (resolve, reject) {
            url = url.replace(/http:\//, "https:/");
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onreadystatechange = function () {
                if (2 == xhr.readyState) {
                    var ret = {
                        mimeType: xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type'),
                        size: xhr.getResponseHeader('content-length') || xhr.getResponseHeader('Content-Length')
                    };
                    this.abort();
                    resolve(ret);
                }
            }
            xhr.onerror = (e) => {
                reject(e);
            }
            xhr.ontimeout = (e) => {
                reject(e);
            }
            xhr.send();
        });
    },

    /**
     * 下载并写入文件到FileSystem
     * @param {string} url 图片URL
     * @param {string} path FileSystem文件路径
     */
    writeImage(url, path) {
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
     */
    send(url, responseType) {
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
    downloadFile(url) {
        return API.Utils.send(url, 'blob');
    },

    /**
     * GET 请求
     * @param {*} url 
     */
    get(url) {
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
     */
    post(url, params) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                type: 'POST',
                data: params,
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
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return decodeURI(r[2]); return null;
    },

    /**
     * 获取URL参数值
     * @param {string} url 
     * @param {string} name 
     */
    getUrlParam(url, name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        var r = url.search.substr(1).match(reg);
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
     * 从 HTML 页面找到用户信息
     */
    getOwnerProfile() {
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
    initUin() {
        // 获取目标QQ
        let rs = /\/user\.qzone\.qq\.com\/([\d]+)/.exec(window.location.href);
        if (rs) {
            // 获取登录QQ
            QZone.Common.Owner.uin = /\d.+/g.exec(API.Utils.getCookie('uin'))[0] - 0;
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
     * 生成一个UUID
     */
    newUid() {
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
    filenameValidate(name) {
        var reg = new RegExp(/'|#|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g);
        name = name.replace(reg, "_");
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
                res = '[{title}]({url})'.format(title, url);
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
     * 获取用户空间地址
     */
    getUserLink(uin, nickName, type) {
        return API.Utils.getLink('https://user.qzone.qq.com/' + uin, nickName, type);
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
        return contet = contet.replace(/@\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))?(?:,auto:([^\}]*))?\}/g, function (str, uin, name) {
            return format({
                uin: uin,
                name: name
            });
        })
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
            // 默认返回HMTL格式
            let res = "<img src='http://qzonestyle.gtimg.cn/qzone/em/e{0}.gif' >".format(eid);
            switch (type) {
                case 'MD':
                    res = '![](http://qzonestyle.gtimg.cn/qzone/em/e{0}.gif)'.format(eid);;
            }
            return res;
        });

        return contet;
    },

    /**
     * 替换URL链接
     * @param {string} contet URL
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    urlFormat(contet, type) {
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
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     * @param {boolean} isRt 是否是处理转发内容
     */
    formatContent(item, type, isRt) {
        if (typeof item === 'string') {
            // 转换特殊符号
            item = API.Utils.escHTML(item);
            // 转换话题
            item = API.Utils.formatTopic(item, type);
            // 转换表情
            item = API.Utils.formatEmoticon(item, type);
            // 转换@内容
            item = API.Utils.formatMention(item, type);
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
                    info.custom_url = "http://user.qzone.qq.com/{uin}".format(info);
                    // 转换特殊符号
                    info.custom_display = API.Utils.escHTML(info.nick);
                    // 转换表情
                    info.custom_display = API.Utils.formatEmoticon(info.custom_display, type);
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
                        // 替换换行符
                        switch (type) {
                            case 'MD':
                                info.custom_display = info.custom_display.replaceAll('\n', '\r\r\r\n');
                                break;
                            default:
                                info.custom_display = info.custom_display.replaceAll('\n', '<br>');
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
                console.debug('用户拒绝通知');
                return;
            }
            if (permission === 'granted') {
                console.debug('用户允许通知');
                var notice_ = new Notification(title, {
                    body: message,
                    icon: API.Utils.getUserLogoUrl(QZone.Common.Target.uin),
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
    formatDate(time) {
        return new Date(time * 1000).format('yyyy-MM-dd hh:mm:ss');
    },

    /**
     * 转换JSON对象
     *  @param {string} json 
     *  @param {string} jsonpKey 
     */
    toJson(json, jsonpKey) {
        json = json.replace(jsonpKey, "");
        json = json.replace(/\);$/, "");
        return JSON.parse(json);
    },

    /**
     * 转换话题
     * @param {string} content 内容
     * @param {string} type 转换类型，默认HTML,MD
     */
    formatTopic(content, type) {
        return content.replace(/^(?!&)#((?:.|<br\/>)+?)(?!&)#/gi, function (t, e) {
            let url = 'http://rc.qzone.qq.com/qzonesoso/?search=' + encodeURIComponent(e);
            let res = '<a href="{0}" target="_blank">{1}</a>'.format(url, API.Utils.escHTML(t));
            switch (type) {
                case 'MD':
                    res = API.Utils.getLink(url, t, type);
                    break;
                default:
                    break;
            }
            return res;
        });
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
     * 获取用户空间的头像地址
     */
    getUserLogoUrl(uin) {
        return "http://qlogo{host}.store.qq.com/qzone/{uin}/{uin}/{size}".format({
            host: uin % 4 || 1,
            uin: uin,
            size: 100
        });
    },

    /**
     * 是否获取结束
     */
    hasNextPage(pageIndex, pageSize, total, list) {
        return list.length < total && pageIndex * pageSize < total;
    },

    /**
     * 替换URL
     * @param {string} url URL
     */
    replaceUrl(url) {
        url = url || '';
        if (url.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1) {
            // 替换图片代理URL为实际URL
            url = API.Utils.toParams(url)['url'] || url;
        }
        url = url.replace(/http:\//, "https:/");
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
     * @param {object} options
     */
    downloadByBrowser(options) {
        return new Promise(function (resolve) {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'download_browser',
                options: options
            }, (res) => {
                resolve(res);
                console.debug('添加到下载器完成', res);
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
    }
};

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
     * 获取日志列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getBlogs(page) {
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
    getInfo(blogid) {
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
    getComments(blogid, page) {
        let params = {
            "uin": QZone.Common.Owner.uin,
            "num": Qzone_Config.Blogs.Comments.pageSize,
            "topicId": QZone.Common.Target.uin + "_" + blogid,
            "start": page * Qzone_Config.Blogs.Comments.pageSize,
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
    },

    /**
     * 获取日志所有的评论
     * @param {object} 日志信息
     * @param {function} 回调函数
     */
    getAllComments(item, callback) {
        // 清空原有的评论列表
        item.comments = [];

        // 获取一页的评论列表
        var nextPage = function (item, page) {

            // 更新获取评论进度
            callback('working', item, page);

            // 开始获取评论
            API.Blogs.getComments(item.blogid || item.blogId, page).then(async (data) => {
                // 去掉函数，保留json
                data = API.Utils.toJson(data, /^_Callback\(/);

                item.comments = item.comments.concat(data.data.comments || []);

                let total = item.replynum || 0;

                let comment_config = Qzone_Config.Blogs.Comments;

                // 是否还有下一页
                let hasNextPage = API.Utils.hasNextPage(page, comment_config.pageSize, total, item.comments);
                if (hasNextPage) {
                    // 请求一页成功后等待一秒再请求下一页
                    let min = comment_config.randomSeconds.min;
                    let max = comment_config.randomSeconds.max;
                    let seconds = API.Utils.randomSeconds(min, max);
                    await API.Utils.sleep(seconds * 1000);
                    // 总数不相等时继续获取
                    await arguments.callee(item, page + 1);
                } else {
                    callback('end', item, page);
                }
            }).catch(async (e) => {
                // 当前页失败后，跳过继续请求下一页
                console.error("获取日志评论列表异常！", item, page, e);
                callback('error', item, page);
                let comment_config = Qzone_Config.Blogs.Comments;
                let min = comment_config.randomSeconds.min;
                let max = comment_config.randomSeconds.max;
                let seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
                // 总数不相等时继续获取
                return await arguments.callee(item, page + 1);
            })
        }

        // 开始请求
        nextPage(item, 0);
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
    getInfo(blogid) {
        let params = {
            "uin": QZone.Common.Owner.uin,
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
    getFriends() {
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
    getQzoneUserInfo() {
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
    getFriendshipTime() {
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
    getIntimacy() {
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
    getMessages(page) {
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
     * 转换数据
     * @param pageIndex 需要转换的数据
     * @param data 需要转换的数据
     * @param onprocess 获取评论进度回调函数
     */
    convert(data) {
        data = data || [];
        for (let index = 0; index < data.length; index++) {

            let item = data[index];
            item.index = index;

            // ID
            item.custom_id = item.tid;
            item.custom_owner = {
                uin: item.uin,
                name: item.name
            }
            // 内容
            item.custom_content = item.content;
            // 评论
            item.custom_comments = item.commentlist || [];
            // 评论数
            item.custom_comment_total = API.Utils.getCommentCount(item);
            // 配图
            item.custom_images = item.pic || [];
            // 配图数
            item.custom_image_total = item.pictotal || 0;
            // 音乐
            item.custom_audio = item.audio || [];
            // 音乐数，一般没有或一条
            item.custom_audio_total = item.audiototal || 0;
            // 视频
            item.custom_video = item.video || [];
            for (let index = 0; index < item.custom_video.length; index++) {
                let video = item.custom_video[index];
                // 处理异常数据的视频URL
                video.video_id = video.video_id || '';
                video.video_id = video.video_id.replace("http://v.qq.com/", "");
            }
            // 视频数
            item.custom_video_total = item.videototal || 0;
            // 位置
            item.custom_location = {
                id: item.lbs['id'] || '',
                idname: item.lbs['idname'] || '',
                name: item.lbs['name'] || '',
                pos_x: item.lbs['pos_x'] || '',
                pos_y: item.lbs['pos_y'] || ''
            };
            // 来源说说，一般为转发说说
            // 转发的说说
            item.custom_original = {
                data: item.rt_con,
                uin: item.rt_uin || '',
                nickname: item.rt_uinname || ''
            };
            // 来源
            item.custom_source = {
                id: item.source_appid,
                name: item.source_name,
                url: item.source_url,
            };
            // 转发数量
            item.custom_forward_total = item.fwdnum || 0;
            // 创建时间
            item.custom_create_time = API.Utils.formatDate(item.created_time);
        }
        return data;
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
            "qzonetoken": QZone.Common.Config.token,
            "g_tk": QZone.Common.Config.gtk,
            "tid": id,
            "uin": QZone.Common.Target.uin,
            "t1_source": 1,
            "not_trunc_con": 1,
            "hostuin": QZone.Common.Owner.uin,
            "code_version": 1,
            "format": "jsonp",
            "qzreferrer": 'https://user.qzone.qq.com'
        }
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_DETAIL_URL, params));
    },


    /**
     * 获取说说评论列表
     * @param {integer} page 第几页
     */
    getComments(id, page) {
        let params = {
            "uin": QZone.Common.Target.uin,
            "tid": id,
            "t1_source": "undefined",
            "ftype": 0,
            "sort": 0,
            "pos": page * Qzone_Config.Messages.Comments.pageSize,
            "num": Qzone_Config.Messages.Comments.pageSize,
            "g_tk": QZone.Common.Config.gtk,
            "callback": "_preloadCallback",
            "code_version": 1,
            "format": "jsonp",
            "need_private_comment": 1,
            "qzonetoken": QZone.Common.Config.token
        }
        return API.Utils.get(API.Utils.toUrl(QZone_URLS.MESSAGES_COMMONTS_URL, params));
    },

    /**
     * 转换媒体内容
     */
    formatMedia(item) {
        let downloadType = Qzone_Config.Common.downloadType;
        let isQzoneUrl = downloadType === 'QZone';
        let images = item.custom_images || [];
        let videos = item.custom_video || [];
        let audios = item.custom_audio || [];
        let result = [];
        if (images.length > 0) {
            // 说说配图
            if (images.length == 1) {
                result.push('\r\n\r\n')
                // 数量等于1的，不限制图片宽高
                result.push('<div>\n');
                for (let index = 0; index < images.length; index++) {
                    const image = images[index];
                    let url = isQzoneUrl ? image.custom_url : image.custom_filepath
                    result.push('<img src="{0}" align="center" />\n'.format(url));
                }
                result.push('</div>\n');
                result.push('\r\n\r\n');
            } else if (2 <= images.length && images.length <= 3) {
                result.push('\r\n\r\n')
                // 数量小于3的，一行存放所有照片
                result.push('<div>\n');
                for (let index = 0; index < images.length; index++) {
                    const image = images[index];
                    let url = isQzoneUrl ? image.custom_url : image.custom_filepath
                    result.push('<img src="{0}" width="200px" align="center" />\n'.format(url));
                }
                result.push('</div>\n');
                result.push('\r\n\r\n');
            } else if (images.length == 4) {
                // 数量为4的，两行，每行两张照片
                result.push('\r\n\r\n')
                let _images = _.chunk(images, 2);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>\n');
                    for (let j = 0; j < _image_list.length; j++) {
                        const _temp = _image_list[j];
                        let url = isQzoneUrl ? _temp.custom_url : _temp.custom_filepath
                        result.push('<img src="{0}" width="200px" height="200px" align="center" />\n'.format(url));
                    }
                    result.push('</div>\n');
                }
                result.push('\r\n\r\n');
            } else if (5 <= images.length && images.length <= 6) {
                // 数量为5和6的，两行，每行2到3张照片
                result.push('\r\n\r\n')
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>\n');
                    for (let j = 0; j < _image_list.length; j++) {
                        const _temp = _image_list[j];
                        let url = isQzoneUrl ? _temp.custom_url : _temp.custom_filepath
                        result.push('<img src="{0}" width="200px" height="200px" align="center" />\n'.format(url));
                    }
                    result.push('</div>\n');
                }
                result.push('\r\n\r\n');
            } else if (images.length >= 7) {
                // 数量为7,8,9的，三行，每行2到3张照片
                result.push('\r\n\r\n')
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>\n');
                    for (let j = 0; j < _image_list.length; j++) {
                        const _temp = _image_list[j];
                        let url = isQzoneUrl ? _temp.custom_url : _temp.custom_filepath
                        result.push('<img src="{0}" width="200px" height="200px" align="center" />\n'.format(url));
                    }
                    result.push('</div>\n');
                }
                result.push('\r\n\r\n');
            }
        } else if (videos.length > 0) {
            // 视频
            for (let index = 0; index < videos.length; index++) {
                const video = videos[index];
                let url = API.Messages.getVideoUrl(video);
                let filepath = isQzoneUrl ? video.custom_url : video.custom_filepath
                result.push('\r\n\r\n');
                result.push('[![点击查看视频]({0})]({1})\n'.format(filepath, url));
                result.push('\r\n\r\n');
            }
        } else if (audios.length > 0) {
            // 歌曲
            for (let index = 0; index < audios.length; index++) {
                const audio = audios[index];
                result.push('\r\n\r\n');
                if (isQzoneUrl) {
                    result.push('[![{albumname}-{singername}]({custom_url})]({playurl})\n'.format(audio));
                } else {
                    result.push('[![{albumname}-{singername}]({custom_filepath})]({playurl})\n'.format(audio));
                }
                result.push('\r\n\r\n');
            }
        }
        return result.join('');
    },

    /**
     * 获取视频连接
     * @param {object} 视频信息
     */
    getVideoUrl(video) {
        // URL3个人相册视频？
        let url = video.url3;
        if (video.source_type == "share") {
            // 分享视频连接？
            url = video.rt_url;
        }
        // 腾讯视频或第三方视频？
        if (video.url2) {
            let params = {
                "origin": "https://user.qzone.qq.com",
                "vid": video.video_id,
                "autoplay": true,
                "volume": 1,
                "disableplugin": "UiSpeed,UiDefinition,IframeBottomOpenClientBar",
                "additionplugin": "IframeUiSearch",
                "platId": "qzone_feed",
                "show1080p": false,
                "isDebugIframe": false
            }
            url = API.Utils.toUrl('https://v.qq.com/txp/iframe/player.html', params);
        }
        return url;
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
    getPhotos(page) {
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
    getImages(topicId, page) {
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
    getExternalUrl(oldurl) {
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
    trimDownloadUrl(url) {
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
    getDownloadUrl(photo) {
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
    getVideos(page) {
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
    convert(data) {
        for (var i = 0; i < data.length; i++) {
            let temp = data[i];
            temp.custom_create_time = API.Utils.formatDate(temp.create_time);
            temp.custom_uin = QZone.Common.Owner.uin;
            temp.custom_name = QZone.Common.Owner.name;
            temp.custom_abstract = API.Utils.formatContent(temp.abstract || "");
            temp.album_info = temp.album_info || {};
            temp.blog_info = temp.blog_info || {};
            temp.photo_list = temp.photo_list || [];
            temp.shuoshuo_info = temp.shuoshuo_info || {};
            temp.share_info = temp.share_info || {};
            temp.url_info = temp.url_info || {};
            temp.img_list = temp.img_list || [];
            temp.origin_img_list = temp.origin_img_list || [];
            temp.text = temp.text || '';
            temp.custom_text = API.Utils.formatContent(temp.text || '');
            temp.custom_title = temp.title;
            temp.album_info.description = temp.album_info.description || '';
            switch (temp.type) {
                case 0:
                    break;
                case 1:
                    temp.url_info.custom_url = API.Utils.formatContent(temp.url_info.url);
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
                    temp.custom_abstract = API.Utils.formatTopic(temp.custom_abstract);
                    temp.custom_video_list = temp.shuoshuo_info.video_list;
                    temp.custom_music_list = temp.shuoshuo_info.music_list;
                    temp.shuoshuo_info.custom_reason = API.Utils.formatContent(temp.shuoshuo_info.reason || "");
                    temp.shuoshuo_info.detail_shuoshuo_info = temp.shuoshuo_info.detail_shuoshuo_info || {};
                    temp.shuoshuo_info.detail_shuoshuo_info.content = API.Utils.formatContent(temp.shuoshuo_info.detail_shuoshuo_info.content || "");
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
                temp.share_info.custom_reason = API.Utils.formatContent(temp.share_info.reason);
            }
        }
        return data;
    },

    /**
     * 获取收藏列表
     * @param {integer} page 当前页
     */
    getFavorites(page) {
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