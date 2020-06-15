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
        // 支持属性多层嵌套替换
        const getValueByPath = (obj, path) => {
            const arr = path.split('.')
            const len = arr.length - 1
            return arr.reduce((cur, key, index) => {
                if (index === len) {
                    return cur[key] || ''
                }
                return cur[key] || ''
            }, obj)
        }
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

/**
 * ReplaceAll的实现
 * @param {String} search 搜索字符
 * @param {String} target 替换字符
 */
String.prototype.replaceAll = function (search, target) {
    return this.replace(new RegExp(search, "gm"), target);
}

/**
 * 数组查找索引
 */
Array.prototype.getIndex = function (val, field) {
    if (field) {
        return this.findIndex((obj) => {
            if (obj[field] == val) {
                return obj;
            }
        })
    } else {
        return this.indexOf(val);
    }
};

/**
 * 删除元素
 */
Array.prototype.remove = function (val, field) {
    var index = this.getIndex(val, field);
    if (index > -1) {
        this.splice(index, 1);
    }
};

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
    Favorites: {}// 收藏模块
};

/**
 * 工具类
 */
API.Utils = {

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
     * 转换时间
     *  @param {integer} time 
     */
    formatDate(time) {
        return new Date(time * 1000).format('yyyy-MM-dd hh:mm:ss');
    },

    /**
     * Base64解码
     * @param {string} str base64字符串
     */
    base64ToUtf8(str) {
        return decodeURIComponent(escape(atob(str)));
    },

    /**
     * 初始化表格
     * @param {string} tableId 表格DOM
     * @param {Array} columns 列配置
     * @param {Array} data 表格数据
     * @param {Object} options 其他配置
     */
    initTable(tableId, columns, data, options) {
        let tableOptions = {
            undefinedText: '',
            toggle: tableId,
            locale: 'zh-CN',
            height: "700",
            search: true,
            searchAlign: 'right',
            showButtonText: true,
            pagination: true,
            pageList: "[10, 20, 50, 100, 200, 500, All]",
            paginationHAlign: 'left',
            clickToSelect: true,
            paginationDetailHAlign: 'right',
            theadClasses: 'thead-light',
            showSearchButton: true,
            toolbar: "#" + tableId + "-toolbar",
            toolbarAlign: "left",
            columns: columns || [],
            data: data || []
        };
        Object.assign(tableOptions, options);
        $("#" + tableId).bootstrapTable('destroy').bootstrapTable(tableOptions);
        $("#" + tableId).bootstrapTable('resetView');
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
     * 获取Markdown的图片内容
     * @param {string} url 图片地址
     * @param {string} title 图片提示
     */
    getImagesMarkdown(url, title) {
        return '![{0}]({1})'.format(title || '', url);
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

}


/**
 * QQ空间公共模块
 */
API.Common = {

    /**
     * 获取用户空间地址
     */
    getUserUrl(uin) {
        return 'https://user.qzone.qq.com/' + uin;
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
     * 转换内容
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     * @param {boolean} isRt 是否是处理转发内容
     * @param {boolean} isSupportedHtml 内容本身是否支持HTML
     */
    formatContent(item, type, isRt, isSupportedHtml) {
        if (typeof item === 'string') {
            // 转换特殊符号
            if (!isSupportedHtml) {
                item = this.escHTML(item);
            }
            // 转换话题
            item = this.formatTopic(item, type);
            // 转换表情
            item = this.formatEmoticon(item, type);
            // 转换@内容
            item = this.formatMention(item, type);
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
                    info.custom_display = this.escHTML(info.nick);
                    // 转换话题
                    info.custom_display = this.formatTopic(info.con, type);
                    // 转换表情
                    info.custom_display = this.formatEmoticon(info.custom_display, type);
                    // 转换@内容
                    info.custom_display = this.formatMention({
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
                    info.url = this.escHTML(info.url);
                    // 获取分享提示
                    info.text = this.getURLTitle(item, titleIndex) || info.url;
                    // 获取Link
                    info.custom_display = API.Utils.getLink(info.url, info.text, type);
                    // 添加到内容数组
                    contents.push(info.custom_display)
                    break;
                case 2:
                    // 普通说说内容？
                    if (info.con) {
                        // 转换话题
                        info.custom_display = this.formatTopic(info.con, type);
                        // 转换表情
                        info.custom_display = this.formatEmoticon(info.custom_display, type);
                        // 转换@内容
                        info.custom_display = this.formatMention(info.custom_display, type);
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
     * 获取用户空间超链接
     * @param {string} uin 目标QQ号
     * @param {string} nickName 目标昵称
     * @param {string} type 类型
     */
    getUserLink(uin, nickName, type) {
        return API.Utils.getLink(this.getUserUrl(uin), nickName, type);
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
    getMessageLink(uin, nickName, type) {
        return API.Utils.getLink(this.getMessageUrl(uin), nickName, type);
    },

    /**
     * 获取多媒体路径
     * @param {string} url 远程URL
     * @param {string} filepath 本地文件路径
     * @param {string} sourceType 来源类型
     */
    getMediaPath(url, filepath, sourceType) {
        if (!filepath) {
            return url;
        }
        let res = filepath || url;
        switch (sourceType) {
            case 'Messages_HTML':
                res = '../' + res;
                break;
            case 'Photos_HTML':
                res = '../' + res;
                break;
            case 'Videos_HTML':
                res = '../' + res;
                break;
            default:
                break;
        }
        return res;
    },

    /**
     * 显示赞列表窗口
     * @param {Object} dom DOM元素
     * @param {Array} dataList 列表
     */
    showLikeWin(dom, dataList) {
        const targetId = $(dom).attr('data-target');
        if (!targetId) {
            return;
        }
        // 获取指定数据
        const itemIndex = dataList.getIndex(targetId, $(dom).attr('data-field'));
        if (itemIndex == -1) {
            return;
        }
        const item = dataList[itemIndex];

        // 渲染列表
        const like_html = template(TPL.LIKE_LIST, {
            items: item.likes || []
        });

        // 渲染模式窗口
        const modal_html = template(TPL.MODAL_WIN, {
            id: 'like_win',
            size: '',
            title: '赞列表',
            body: like_html
        });

        // 存在元素直接移除重新创建
        const $like_win = $('#like_win');
        if ($like_win) {
            $like_win.modal('hide');
            $like_win.remove();
        }

        // 添加HTML到页面
        $('body').append(modal_html);

        // 显示窗口
        $('#like_win').modal('show');
    },

    /**
     * 显示评论列表窗口
     * @param {Object} dom DOM元素
     * @param {Array} dataList 列表
     */
    showCommentsWin(dom, dataList) {
        const targetId = $(dom).attr('data-target');
        if (!targetId) {
            return;
        }
        // 获取指定数据
        const itemIndex = dataList.getIndex(targetId, $(dom).attr('data-field'));
        if (itemIndex == -1) {
            return;
        }
        const item = dataList[itemIndex];

        // 渲染列表
        const comments_html = template(TPL.ALBUMS_COMMENTS, {
            comments: item.comments || []
        });

        // 渲染模式窗口
        const modal_html = template(TPL.MODAL_WIN, {
            id: 'comments_win',
            title: '评论列表',
            size: 'modal-lg',
            body: comments_html
        });

        // 存在元素直接移除重新创建
        const $comments_win = $('#comments_win');
        if ($comments_win) {
            $comments_win.modal('hide');
            $comments_win.remove();
        }

        // 添加HTML到页面
        $('body').append(modal_html);

        // 显示窗口
        $('#comments_win').modal('show');
    }
}

/**
 * 日志模块API
 */
API.Blogs = {

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
    }
}

/**
 * 模板常量
 */
const TPL = {
    /**
     * 模式窗口
     */
    MODAL_WIN: `
        <div id="<%:=id%>" class="modal" tabindex="-1" role="dialog">
            <div class="modal-dialog <%:=size%> modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-center"><%:=title%></h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <%:=body%>
                    </div>
                </div>
            </div>
        </div>
    `,
    /**
     * 点赞列表
     */
    LIKE_LIST: `
        <div class="list-group">
            <%if(items.length === 0 ){%>
                <p>没人点赞，好伤心哦^_^</p>
            <%}%>
            <%for (const item of items) {%>
                <a href="<%:=API.Common.getUserUrl(item.fuin)%>" target="_blank" class="list-group-item list-group-item-action border rounded">
                    <div class="d-flex flex-row bd-highlight">
                        <div class="bd-highlight">
                            <img class="rounded-circle" src="<%:=API.Common.getUserLogoUrl(item.fuin)%>" alt="" style="height: 50px;width: 50px;">
                        </div>
                        <div class="flex-fill bd-highlight align-self-center ml-3">
                            <%:=item.nick%>
                        </div>
                        <div class="bd-highlight align-self-center ml-3">
                            <small>
                                <%if(item.gender){%>
                                    <span><%:=item.gender%></span>
                                <%}%>
                                <%if(item.constellation){%>
                                    <span><%:=item.constellation%></span>
                                <%}%>
                                <%if(item.addr){%>
                                    <span><%:=item.addr%></span>
                                <%}%>
                            </small>
                        </div>
                    </div>
                </a>
            <%}%>
        </div>
    `,
    /**
     * 相册评论模板
     */
    ALBUMS_COMMENTS: `
        <%if(comments.length === 0 ){%>
            <p>没人评论，好伤心哦^_^</p>
        <%}%>
        <%for(const comment of comments){%>
            <div class="border-bottom comments mt-3">
                <div class="container comment">
                    <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(comment.poster.id)%>">
                        <img class="lazyload w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(comment.poster.id)%>" >
                    </a>
                    <div class="ml-5">
                        <div class="container">
                            <a class="author">
                                <a target="_blank" href="<%:=API.Common.getUserUrl(comment.poster.id)%>">
                                    <span><%:=API.Common.formatContent(comment.poster.name)%></span>
                                </a>
                                <%if(comment.private){%>
                                    <span class="text-info"> 私密评论 </span>
                                <%}%>
                                <br>
                                <span class="text-muted small"><%:=API.Utils.formatDate(comment.postTime)%></span>
                            </a>
                        </div>
                        <div class="messageText container">
                            <p><%:=API.Common.formatContent(comment.content)%></p>
                            <%if(comment.pic){%>
                                <%for(let image of comment.pic){%>
                                    <img src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>" class="comment-img img-thumbnail">
                                <%}%>
                            <%}%>
                        </div>
                        <%if(comment.replies){%>
                            <%for(const reply of comment.replies){%>
                                <div class="comments">
                                    <div class="container comment p-0">
                                        <a class="me-a avatar p-0 m-0 " target="_blank" href="<%:=API.Common.getUserUrl(reply.poster.id)%>">
                                            <img class="lazyload w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(reply.poster.id)%>">
                                        </a>
                                        <div class="ml-5">
                                            <div class="container">
                                                <a class="author">
                                                    <a target="_blank" href="<%:=API.Common.getUserUrl(reply.poster.id)%>">
                                                        <span class="text-info"><%:=API.Common.formatContent(reply.poster.name)%></span>
                                                    </a>
                                                    <%if(reply.private){%>
                                                        <span class="text-info"> 私密回复 </span>
                                                    <%}%>
                                                    <br>
                                                    <span class="text-muted small"><%:=API.Utils.formatDate(reply.postTime)%></span>
                                                </a>
                                            </div>
                                            <div class="messageText container">
                                                <p><%:=API.Common.formatContent(reply.content)%></p>
                                                <%if(reply.pic){%>
                                                    <%for(let image of reply.pic){%>
                                                        <img src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>" class="comment-img img-thumbnail">
                                                    <%}%>
                                                <%}%>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            <%}%>
                        <%}%>
                    </div>
                </div>
            </div>
        <%}%>
    `
}