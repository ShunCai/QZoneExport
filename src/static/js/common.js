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

const BLOG_LIST_URL = "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs";
const BLOG_INFO_URL = "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/blog_output_data";

var APP = {
    Common: {}, // 公共
    Blog: {}, //  日志
    Photos: {}, // 相册
    Messages: {},// 说说
    Board: {} // 留言板
};

APP.Common = {

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
                    window.qzone.token = qzonetoken[1];
                    return false;
                }
            }
        });
    },

    /**
     * 获取QQ号
     */
    getUin: function () {
        var url = window.location.href;
        var UinM = /\/user\.qzone\.qq\.com\/([\d]+)/;
        var r = UinM.exec(url);
        if (r != null) {
            window.qzone.uin = r[1];
        }
    },

    /**
     * 转换成正式URI，好像实际上没用到
     * 
     * @param {string} 不规范的url
     */
    formalURI: function (s) {
        if (!(typeof s == "string")) {
            return null;
        }
        if (s.indexOf("//") == 0) {
            s = window.location.protocol + s;
        }
        if (s.indexOf("://") < 1) {
            s = location.protocol + "//" + location.host + (s.indexOf("/") == 0 ? "" : location.pathname.substr(0, location.pathname.lastIndexOf("/") + 1)) + s;
        }
        var depart = s.split("://");
        if (typeof depart == "array" && (depart.length > 1 && /^[a-zA-Z]+$/.test(depart[0]))) {
            this.protocol = depart[0].toLowerCase();
            var h = depart[1].split("/");
            if (typeof h == "array") {
                this.host = h[0];
                this.pathname = "/" + h.slice(1).join("/").replace(/(\?|\#).+/i, "");
                this.href = s;
                var se = depart[1].lastIndexOf("?"), ha = depart[1].lastIndexOf("#");
                this.search = se >= 0 ? depart[1].substring(se) : "";
                this.hash = ha >= 0 ? depart[1].substring(ha) : "";
                if (this.search.length > 0 && this.hash.length > 0) {
                    if (ha < se) {
                        this.search = "";
                    } else {
                        this.search = depart[1].substring(se, ha);
                    }
                }
                return this;
            } else {
                return null;
            }
        } else {
            return null;
        }
    },

    /**
     * 生成 g_tk
     * @param {string} url api的URL，好像传null也可以生成可用的g_tk
     */
    gen_gtk: function (url) {
        url = this.formalURI(url);
        var skey;
        if (url) {
            if (url.host && url.host.indexOf("qzone.qq.com") > 0) {
                skey = this.getCookie("p_skey");
            } else {
                if (url.host && url.host.indexOf("qq.com") > 0) {
                    skey = this.getCookie("skey");
                }
            }
        }
        if (!skey) {
            try {
                skey = this.getCookie("p_skey") || "";
            } catch (err) {
                // 逻辑有问题
                skey = this.getCookie("p_skey") || "";
            }
        }
        if (!skey) {
            skey = this.getCookie("skey") || this.getCookie("rv2");
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
    }
};

APP.Blog = {

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
        var i = function (e) {
            for (var i = 0; i < t.length; i++) {
                if (t[i][0] == e) {
                    return t[i][1];
                }
            }
        };
        var a = "";
        for (var o = 0; o < t.length; o++) {
            var n = t[o][0];
            if (n == 22) {
                continue;
            }
            if (this.getEffectBit(e, n)) {
                a += '<span class="' + (n == 3 || n == 28 || n == 35 || n == 36 ? "c_tx3" : "c_tx4") + '" rel="blog-detail-link" blogid="' + e.blogId + '"' + ">[" + t[o][1] + "]</span>";
                if (n == 8) {
                    break;
                }
            }
        }
        return a;
    },
    getEffectBit: function (e, t) {
        if (t < 0 || t > 63) {
            throw new Error("nBit param error")
        }
        if (t < 32) {
            return e.effect1 & 1 << t
        } else if (t < 64) {
            return e.effect2 & 1 << t
        }
    },

    /**
     * 生成获得日志列表的URL，每次获得10条日志
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getBlogList: function (uin, page) {
        var params = {
            "hostUin": uin,
            "uin": uin,
            "blogType": "0",
            "cateName": "",
            "cateHex": "",
            "statYear": "2019",
            "reqInfo": "7",
            "pos": page * BLOG_PER_PAGE,
            "num": "15",
            "sortType": "0",
            "source": "0",
            "rand": Math.random(),
            "ref": "qzone",
            "g_tk": APP.Common.gen_gtk(),
            "verbose": "1",
            "qzonetoken": window.qzone.token
        };
        return APP.Common.toUrl(BLOG_LIST_URL, params);
    },

    /**
     * 生成获得日志页面的URL
     * @param {string} uin QQ号
     * @param {string} blogid 日志ID
     */
    getBlogData: function (uin, blogid) {
        var params = {
            "uin": uin,
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
        return APP.Common.toUrl(BLOG_INFO_URL, params);
    }
}