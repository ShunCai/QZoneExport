// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符， 
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) 
// 例子： 
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18 
Date.prototype.format = function(fmt) {
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
String.prototype.format = function(args) {
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
    } else if (arguments.length == 1 && typeof(args) == "object") {
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
String.prototype.replaceAll = function(search, target) {
    return this.replace(new RegExp(search, "gm"), target);
}

/**
 * 数组查找索引
 */
Array.prototype.getIndex = function(val, field) {
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
Array.prototype.remove = function(val, field) {
    var index = this.getIndex(val, field);
    if (index > -1) {
        this.splice(index, 1);
    }
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
    Utils: {}, // 工具类
    Common: {}, // 公共模块
    Blogs: {}, // 日志模块
    Diaries: {}, // 日记模块
    Friends: {}, // 好友模块
    Messages: {}, // 说说模块
    Boards: {}, // 留言模块
    Photos: {}, // 相册模块
    Videos: {}, // 视频模块
    Favorites: {}, // 收藏模块
    Shares: {}, // 分享模块
    Visitors: {}, // 访客模块
    Statistics: {} // 数据统计模块
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
        if (r != null) {
            return decodeURI(r[2]);
        }
        return null;
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
            var str_para = arr_url[1],
                result;
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
     * 转换时间
     *  @param {integer} time 
     */
    formatDate(time, str) {
        if (!Number.isInteger(time)) {
            return time;
        }
        str = str || 'yyyy-MM-dd hh:mm:ss';
        return new Date(time * 1000).format(str);
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    parseDate(time) {
        if (_.isNumber(time)) {
            const sec = time * 1000;
            if (sec < Date.now()) {
                return new Date(sec);
            }
        }
        return new Date(time);
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
    getLink(url, text, type) {
        // 默认HTML超链接
        let res = "<a href='{url}' target='_blank'>{text}</a>";
        switch (type) {
            case 'MD':
                res = '[{text}]({url})'.format(text, url);
                break;
            default:
                break;
        }
        return res.format({
            url: url,
            text: text
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
     * 获取HTML的图片内容
     * @param {string} url 图片地址
     */
    getImageHTML(url) {
        return "<img src='{0}' >".format(url);
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
            if (typeof(time) === 'string') {
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
     * 生成一个UUID
     */
    newUid() {
        const s4 = function() {
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
        var uuid = [],
            i;
        radix = radix || chars.length;
        if (len) {
            for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
        } else {
            var r;
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }
        return uuid.join('');
    },

    /**
     * 格式化文件大小, 输出成带单位的字符串
     * @param {Number} size 文件大小
     * @param {Number} [pointLength=2] 精确到的小数点数。
     * @param {Array} [units=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB" ]] 单位数组。
     */
    formatFileSize(size, pointLength, units) {
        var unit;
        units = units || ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        while ((unit = units.shift()) && size > 1024) {
            size = size / 1024;
        }
        return (unit === 'Bytes' ? size : size.toFixed(pointLength === undefined ? 2 : pointLength)) + unit;
    },

    /**
     * 计算年份条目数量
     * @param {Map} yearMaps 
     */
    sumYearItemSize(yearMaps) {
        let i = 0;
        for (const [year, yearMap] of yearMaps) {
            // 如果是Map
            if (yearMap instanceof Map) {
                i += this.sumYearItemSize(yearMap);
            }
            // 如果是数组
            if (Array.isArray(yearMap)) {
                i += yearMap.length;
            }
        }
        return i;
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
     * 获取评论人
     * @param {Comment} comment 评论
     */
    getCommentUser(comment) {
        if (comment.poster) {
            comment.poster.id = comment.poster.id || comment.poster.uin || comment.poster.fuin;
            comment.poster.uin = comment.poster.uin || comment.poster.id || comment.poster.fuin;
            comment.poster.who = !!comment.t3_wc_uin * 2 || comment.t3_source || !!comment.t2_wc_uin * 2 || comment.t2_source || 1
            return comment.poster;
        }
        return {
            uin: comment.uin || comment.fuin,
            name: comment.name || comment.nick || comment.nickname,
            who: !!comment.t3_wc_uin * 2 || comment.t3_source || !!comment.t2_wc_uin * 2 || comment.t2_source || 1
        }
    },


    /**
     * 添加表情下载任务
     * @param {string} content 表情内容
     * @returns 
     */
    addEmoticonDowanloadTask(content) {
        if (this.isQzoneUrl() || !content) {
            content;
        }

        // 匹配QQ表情地址
        const imageUrls = content.match(/(https|http):\/\/qzonestyle.gtimg.cn\/qzone\/em\/e\d+.gif/g) || [];
        // 遍历，并添加任务
        for (const imageUrl of imageUrls) {
            const custom_filename = QZone.Common.FILE_URLS.get(imageUrl);
            if (custom_filename) {
                continue;
            }
            // 添加下载任务
            API.Utils.newDownloadTask('Common', url, 'Common/images', this.getFileName(imageUrl, 'gif'));
            QZone.Common.FILE_URLS.set(url, custom_filename);
        }

        // 匹配微信表情地址
        const wxImageUrls = content.match(/https:\/\/cdn.jsdelivr.net\/gh\/ShunCai\/QZoneExport@dev\/src\/img\/emoji\/(.{1,15}).png/g) || [];
        // 遍历，并添加任务
        for (const imageUrl of wxImageUrls) {
            const custom_filename = QZone.Common.FILE_URLS.get(imageUrl);
            if (custom_filename) {
                continue;
            }
            // 添加下载任务
            API.Utils.newDownloadTask('Common', url, 'Common/images', this.getFileName(imageUrl, 'png'));
            QZone.Common.FILE_URLS.set(url, custom_filename);
        }

        return content;
    },

    /**
     * 替换表情路径
     * @param {string} content 表情内容
     * @returns 
     */
    formatEmoticonPath(content) {
        if (this.isQzoneUrl() || !content) {
            return content;
        }

        // 替换QQ表情地址
        content = content.replace(/(https|http):\/\/qzonestyle.gtimg.cn\/qzone\/em\/e(\d+).gif/g, function(emoji, protocol, eid) {
            return API.Common.getMediaPath(emoji, 'Common/images/e{0}.gif'.format(eid), true);
        });

        // 替换微信表情地址
        content = content.replace(/https:\/\/cdn.jsdelivr.net\/gh\/ShunCai\/QZoneExport@dev\/src\/img\/emoji\/(.{1,15}).png/g, function(emoji, eid) {
            return API.Common.getMediaPath(emoji, 'Common/images/{0}.png'.format(eid), true);
        });

        return content;
    },

    /**
     * 获取用户空间的头像地址
     */
    getUserLogoUrl(uin) {
        if (!_.isFinite(uin)) {
            // 这里简单判断一下，不是数字，就认为是朋友网的，腾讯微博的，也当朋友网，使用who判断太麻烦了。
            return 'http://py.qlogo.cn/friend/{0}/audited/100'.format(uin);
        }
        return "https://qlogo{host}.store.qq.com/qzone/{uin}/{uin}/{size}".format({
            host: QZone_Config.Common.AvatarHost <= 0 ? uin % 4 || 1 : QZone_Config.Common.AvatarHost,
            uin: uin,
            size: 100
        });
    },

    /**
     * 获取用户空间的头像本地地址
     */
    getUserLogoLocalUrl(uin, isAppendPrePath, count) {
        let filePath;
        if (!this.isQzoneUrl()) {
            filePath = 'Common/images/' + uin;
        }
        return API.Common.getMediaPath(this.getUserLogoUrl(uin), filePath, isAppendPrePath, count);
    },

    /**
     * 转换HTML特殊字符
     */
    escHTML(content) {
        var l = { "&amp;": /&/g, "&lt;": /</g, "&gt;": />/g, "&quot;": /\x22/g };
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
        var n = "",
            res = "";
        for (var a = 0; a < t.length; a++) {
            tag = t[a];
            o = false;
            n = "";
            n = tag.replace(/#((?:.|<br\/>)+?)#/g, function(e, t, n) {
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
        contet = contet.replace(/\[em\]e(\d+)\[\/em\]/gi, function(emoji, eid) {
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

        // 先处理一遍正常的@的内容
        contet = contet.replace(/@\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))?(?:,auto:([^\}]*))?\}/g, function(str, uin, name) {
            return format({
                uin: uin,
                name: name
            });
        })

        // 如果处理后，仍包含uin、nick、who，则表示是特殊情况(即nick存的是内容)，再处理一遍
        if (contet.indexOf('uin') > -1 && contet.indexOf('nick') > -1 && contet.indexOf('who') > -1) {
            contet = contet.replace(/\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))\}/g, function(str, uin, name) {
                return name;
            })
        }
        return contet;
    },

    /**
     * 转换内容
     * @param {string} contet @内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     * @param {boolean} isRt 是否是处理转发内容
     * @param {boolean} isSupportedHtml 内容本身是否支持HTML
     * @param {boolean} isEscHTML 是否全部转换HTML标签
     * @param {boolean} isDownloadEmoticon 是否下载表情
     * @param {boolean} isFormatEmoticonPath 是否转换本地地址
     */
    formatContent(item, type, isRt, isSupportedHtml, isEscHTML, isDownloadEmoticon, isFormatEmoticonPath) {
        if (!item) {
            return item;
        }
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
            // 转换微信表情
            item = API.Common.formatWxEmoji(item, type);
            // 转换特殊字符
            item = isEscHTML ? API.Utils.escHTML(item) : item;
            // 是否下载表情
            item = isDownloadEmoticon ? API.Common.addEmoticonDowanloadTask(item) : item;
            // 转换表情路径
            return isFormatEmoticonPath ? API.Common.formatEmoticonPath(item) : item;
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
                    info.custom_display = this.formatTopic(info.con || info.custom_display, type);
                    // 转换表情
                    info.custom_display = this.formatEmoticon(info.custom_display, type);
                    // 转换微信表情
                    info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
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
                        info.custom_display = this.formatTopic(this.escHTML(info.con), type);
                        // 转换表情
                        info.custom_display = this.formatEmoticon(info.custom_display, type);
                        // 转换微信表情
                        info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
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
        // 转换特殊字符
        let content = contents.join("").replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, "");
        content = isEscHTML ? API.Utils.escHTML(content) : content;

        // 是否下载表情
        content = isDownloadEmoticon ? API.Common.addEmoticonDowanloadTask(content) : content;

        // 转换表情路径
        return isFormatEmoticonPath ? API.Common.formatEmoticonPath(content) : content;
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
     * @param {string} isAppendPrePath 是否追加前一个路径
     */
    getMediaPath(url, filepath, isAppendPrePath, count) {
        if (!filepath) {
            return url;
        }
        count = count || 1;
        if (isAppendPrePath) {
            for (let i = 0; i < count; i++) {
                filepath = '../' + filepath;
            }
        }
        return filepath;
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
            title: '点赞列表',
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
     * 显示最近访问窗口
     * @param {Object} dom DOM元素
     * @param {Array} dataList 列表
     */
    showVisitorsWin(dom, dataList) {
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
        const like_html = template(TPL.VISITOR_LIST, {
            items: item.custom_visitor && item.custom_visitor.list || []
        });

        // 渲染模式窗口
        const modal_html = template(TPL.MODAL_WIN, {
            id: 'visitors_win',
            size: '',
            title: '最近访问',
            body: like_html
        });

        // 存在元素直接移除重新创建
        const $like_win = $('#visitors_win');
        if ($like_win) {
            $like_win.modal('hide');
            $like_win.remove();
        }

        // 添加HTML到页面
        $('body').append(modal_html);

        // 显示窗口
        $('#visitors_win').modal('show');
    },

    /**
     * 获取评论的HTML
     * @param {Array} comments 评论清单
     * @param {String} tplContent 评论HTMML模板
     * @returns 
     */
    getCommentHtml(comments, tplContent) {
        // 渲染列表
        const comments_html = template(tplContent || TPL.COMMON_COMMENTS, {
            comments: comments || []
        });
        return comments_html;
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
        const comments_html = API.Common.getCommentHtml(item.comments);

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
    },

    /**
     * 获取那年今日的数据
     * @param {Array} dataList 数组
     * @param {string} field 时间字段
     */
    getOldYearData(dataList, field) {
        // 时间分组
        // 时间分组
        const yearMaps = API.Utils.groupedByTime(dataList, field, 'all');
        const date = new Date();
        // 当前年份跳过
        const currentYear = date.getFullYear();
        const currentMonthDay = date.format('-MM-dd');
        const _yearMaps = new Map();
        if (yearMaps) {
            // 移除今年数据
            yearMaps.delete(currentYear);
        }
        for (const [year, yearItemMaps] of yearMaps) {
            for (const [month, monthItems] of yearItemMaps) {
                const monthDayItems = [];
                for (const item of monthItems) {
                    const targetTime = API.Utils.formatDate(item[field]);
                    if (targetTime.indexOf(currentMonthDay) > -1) {
                        monthDayItems.push(item);
                    }
                }
                if (monthDayItems.length > 0) {
                    _yearMaps.set(year, monthDayItems);
                }
            }
        }
        return _yearMaps;
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
                const url = imgRelativePath + "/" + _content.image;
                const res = type === 'MD' ? API.Utils.getImagesMarkdown(url) : "<img src='{0}' >".format(url);
                result.push(res);
            }
        }
        return result.join('');
    },

    /**
     * 预加载前后预览图图片
     * @param {CustomEvent} event 画廊事件
     */
    renderPreviews(event) {
        // 当前图片索引
        const imageIdx = event.detail.index;
        // 画廊相册实例
        const instance = event.target.galleryIns;
        // 画廊相册相片列表
        const items = instance.items;
        // 画廊相册容器
        const galleryOuter = instance.outer;

        const renderPreview = function(idx) {
            // 预览图
            const $thumbItem = galleryOuter.selector.querySelector('.lg-thumb-item img[data-lg-item-id="' + idx + '"]');
            if (!$thumbItem) {
                return;
            }
            // 预览图地址
            const thumbSrc = $thumbItem.getAttribute('src');
            // 原始图地址
            const dataSrc = items[idx].querySelector('img').getAttribute('data-src');
            if (!thumbSrc || thumbSrc == 'null' || thumbSrc.endsWith('loading.gif')) {
                $thumbItem.setAttribute('src', dataSrc);
            }
        }

        // 往后加10
        for (let idx = imageIdx; idx < imageIdx + 30; idx++) {
            renderPreview(idx);
        }

        // // 往前减10
        for (let idx = imageIdx; idx > imageIdx - 30; idx--) {
            renderPreview(idx);
        }
    },

    /**
     * 预加载前后预览图图片
     * @param {integer} index 当前幻灯片位置
     * @param {integer} loadSize 加载个数
     */
    renderPhotoPreviews(index, loadSize) {

        // 加载当前位置
        const renderPreview = function(index) {
            const $img = $('.lightbox img').eq(index);
            const $thumbItems = $('.lg-thumb-item img[data-lg-item-id="' + index + '"]');
            if ($thumbItems) {
                let oldSrc = $thumbItems.attr("src");
                if (oldSrc && oldSrc.endsWith('loading.gif')) {
                    $thumbItems.attr('src', $img.attr('data-src'));
                }
            }
            const $pagerItems = $('span[data-lg-item-id="' + index + '"].lg-pager-cont img');
            if ($pagerItems) {
                let oldSrc = $pagerItems.attr("src");
                if (oldSrc && oldSrc.endsWith('loading.gif')) {
                    $pagerItems.attr('src', $img.attr('data-src'));
                }
            }
        }

        // 加载前后位置
        for (var i = 0; i < loadSize; i++) {
            renderPreview(index + i);
            renderPreview(index - i);
        }

    },

    /**
     * 基于画廊事件初始化评论列表框
     * @param {CustomEvent} moduleName 
     * @param {CustomEvent} moduleName 
     */
    renderCommentBox(comments, tplContent) {
        const $comment_btn = $('.lg-comment-toggle.lg-icon');
        if (!$comment_btn) {
            return;
        }

        comments = comments || [];

        // 渲染评论图标样式，有评论时显示蓝色
        if (comments.length > 0) {
            $comment_btn.attr('title', '查看评论');
            $comment_btn.addClass('has-comments');
        } else {
            $comment_btn.attr('title', '无评论');
            $comment_btn.removeClass('has-comments');
        }

        // 渲染评论列表
        const comments_html = API.Common.getCommentHtml(comments, tplContent);
        const $comments_box = $('.lg-comment-body');
        if ($comments_box) {
            $comments_box.html(comments_html);
        }
    },

    /**
     * 基于画廊事件初始化评论列表框
     * @param {CustomEvent} event 
     */
    handleCommentBomEvent(event) {
        const eventTarget = event.target;
        if (!eventTarget.moduleName) {
            return;
        }

        // 评论模板
        let tplContent = TPL.COMMON_COMMENTS;
        // 评论清单
        let comments = [];
        switch (eventTarget.moduleName) {
            case 'Albums':
                comments = album.photoList[event.detail.index].comments || [];
                break;
            case 'Videos':
                comments = videos[event.detail.index].comments || [];
                break;
            case 'Messages':
                const messageIdx = messages.getIndex(eventTarget.id.replace('QZ-', ''), 'tid');
                // 当前相片的评论
                const message = messages[messageIdx];
                // 相册相识的图片，单纯的视频，或者图片中含视频
                const targetItems = message.custom_videos.length > 0 ? message.custom_videos : message.custom_images;
                const targetItem = targetItems[event.detail.index];
                const targetId = targetItem.video_info && targetItem.video_info.video_id || targetItem.video_id || targetItem.pic_id;

                // 实际上需要显示的评论
                comments = message.commentlist || [];

                // 图片本身是否存在评论，存在则使用本身的评论，不存在则使用说说的评论
                for (const comment of comments) {
                    if (comment.targetImage && targetId === comment.targetImage.id) {
                        // 如果是图片的评论，则使用图片本身的评论，如果图片的评论没有，再显示说说本身的评论
                        comments = [comment];
                        break;
                    }
                }

                break;
            case 'Shares':
                const shareIdx = shares.getIndex(eventTarget.id.replace('share-medias-', ''), 'id');
                // 当前相片的评论
                const share = shares[shareIdx];
                // 实际上需要显示的评论
                comments = share.comments || [];
                break;
            default:
                break;
        }
        API.Common.renderCommentBox(comments, tplContent);
    },

    /**
     * 注冊画廊事件
     * @param {object} gallery 画廊相册
     */
    registerEvents(gallery) {

        // 画廊打开后
        gallery.addEventListener('lgAfterOpen', (event) => {
            // 主要用于相册缩略图拖动缩略图
            $('.lg-thumb-item').mousedown(function() {
                // 渲染缩略图，其实这里时候把原图当缩略图
                const index = $(this).index();
                API.Common.renderPhotoPreviews(index, 30);
            })


        });

        // 画廊切换图片前
        gallery.addEventListener('lgBeforeSlide', (event) => {
            API.Common.renderPreviews(event);
        });

        // 画廊切换图片后
        gallery.addEventListener('lgAfterSlide', (event) => {
            // 处理评论信息
            API.Common.handleCommentBomEvent(event);

            // 初始化提示信息
            $('.lg-sub-html [data-toggle="tooltip"]').tooltip();
        });
    },

    /**
     * 图片加载后
     */
    registerImageLoadedEvent() {
        $('img.lazyload').on('load', function() {
            if (this.src && (this.src !== 'null' || !this.src.endsWith('loading.gif'))) {
                $(this).removeClass('loading');
            }
        })
    },

    /**
     * 显示点赞窗口
     * @param {Array} items 数据列表
     */
    registerShowLikeWin(items) {
        // 点赞列表
        $('.viewlikes').on('click', function() {
            API.Common.showLikeWin(this, items);
        });
    },

    /**
     * 显示最近浏览窗口
     * @param {Array} items 数据列表
     */
    registerShowVisitorsWin(items) {
        // 最近访问
        $('.viewVisitors').on('click', function() {
            API.Common.showVisitorsWin(this, items);
        });
    },

    /**
     * 显示评论窗口
     * @param {Array} items 数据列表
     */
    registerShowCommentsWin(items) {
        // 查看评论
        $('.viewcomments').on('click', function() {
            API.Common.showCommentsWin(this, items);
        });
    },

    /**
     * 查看全文
     */
    registerReadMoreEvents() {
        $(".readMore").unbind("click").click(function(e) {
            const text = $(this).attr('title');
            if (text == "展开全文") {
                $(this).attr('title', "收起全文");
                $(this).removeClass("fa-angle-down");
                $(this).addClass("fa-angle-up");
                $(this).prev().addClass("more");
            }
            if (text == "收起全文") {
                $(this).attr('title', "展开全文");
                $(this).removeClass("fa-angle-up");
                $(this).addClass("fa-angle-down");
                $(this).prev().removeClass("more");
            }
        });
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

    /**
     * 获取日志标签
     * @param {Object} item 日志详情
     * @returns 
     */
    getBlogLabel(item) {
        const allLabelCfg = [
            ["8", "审核不通过"],
            ["22", "审核中"],
            ["4", "置顶"],
            ["21", "推荐"],
            ["3", "转载"],
            ["28", "转载"],
            ["35", "转载"],
            ["36", "转载"]
        ];
        const labels = [];
        for (let i = 0; i < allLabelCfg.length; i++) {
            const bit = allLabelCfg[i][0];
            if (bit == 22) {
                continue;
            }
            if (API.Blogs.getEffectBit(item, bit)) {
                let label = allLabelCfg[i][1];
                if (labels.indexOf(label) > -1) {
                    continue;
                }
                labels.push(label);
            }
        }
        if (labels.length === 0) {
            labels.push('原创');
        }
        return labels;
    }
}

/**
 * 说说模块API
 */
API.Messages = {
    /**
     * 获取地图超链接
     * @param {object} lbs 坐标信息
     */
    getMapUrl(lbs) {
        if (!lbs) {
            return '#';
        }
        return 'https://apis.map.qq.com/uri/v1/marker?marker=coord:{pos_y},{pos_x};title:{idname};addr:{name}'.format(lbs);
    }
}

/**
 * 相册模块API
 */
API.Photos = {

    /**
     * 获取相片类型
     * @param {string} photo 相片对象
     */
    getPhotoType(photo) {
        const type = photo.phototype || 1;
        // 默认类型
        let photoType = "JPEG";
        switch (type) {
            case 1:
                photoType = "JPEG";
                break;
            case 2:
                photoType = "GIF";
                break;
            case 3:
                photoType = "PNG";
                break;
            case 4:
                photoType = "BMP";
                break;
            case 5:
                photoType = "JPEG";
                break;
        }
        return photoType;
    },

    /**
     * 获取相片LBS位置
     * @param {Object} photo 相片
     */
    getPhotoLbs(photo) {
        photo = photo || {};
        return photo.shootGeo && (photo.shootGeo.idname || photo.shootGeo.name) ? photo.shootGeo : photo.lbs;
    },

    /**
     * 获取相册的悬浮提示
     * @param {Album} album 相册
     */
    getAlbumBasicInfoTooltip(album) {
        const htmls = [];
        htmls.push("<div class='text-left'>");
        // 相册名称
        htmls.push('<p><strong>相册名称：</strong>{0}</p>'.format(album.name));
        // 相册描述
        htmls.push('<p><strong>相册描述：</strong>{0}</p>'.format(API.Common.formatContent(album.desc || '暂无描述', "HTML", false, false, false, false, true)));
        // 创建时间
        htmls.push('<p><strong>创建时间：</strong>{0}</p>'.format(API.Utils.formatDate(album.createtime || album.create_time)));
        // 更新时间
        htmls.push('<p><strong>更新时间：</strong>{0}</p>'.format(API.Utils.formatDate(album.modifytime)));
        // 最后上传时间
        htmls.push('<p><strong>最后上传：</strong>{0}</p>'.format(album.lastuploadtime ? API.Utils.formatDate(album.lastuploadtime) : "暂未上传"));
        htmls.push('</div>');
        return htmls.join('');
    },


    /**
     * 获取相片的悬浮提示
     * @param {Album} photo 相片
     */
    getPhotoBasicInfoTooltip(photo) {
        const htmls = [];
        htmls.push("<div class='text-left'>");
        // 相片名称
        htmls.push('<p><strong>相片名称：</strong>{0}</p>'.format(photo.name || API.Utils.formatDate(photo.uploadtime || photo.uploadTime)));
        // 相片描述
        htmls.push('<p><strong>相片描述：</strong>{0}</p>'.format(API.Common.formatContent(photo.desc || '暂无描述', "HTML", false, false, false, false, true)));
        // 上传时间
        htmls.push('<p><strong>上传时间：</strong>{0}</p>'.format(API.Utils.formatDate(API.Utils.parseDate(photo.uploadtime || photo.uploadTime).getTime() / 1000) || '未知'));
        // 拍摄时间
        htmls.push('<p><strong>拍摄时间：</strong>{0}</p>'.format(API.Utils.formatDate(API.Utils.parseDate(photo.rawshoottime || photo.shootTime).getTime() / 1000) || '未知'));
        // 拍摄地点
        const custom_lbs = API.Photos.getPhotoLbs(photo);
        htmls.push('<p><strong>拍摄/上传地点：</strong>{0}</p>'.format(custom_lbs ? custom_lbs.idname || custom_lbs.name || '未知' : '未知'));
        htmls.push('</div>');
        return htmls.join('');
    }
}

/**
 * 收藏模块API
 */
API.Favorites = {

    /**
     * 获取收藏分享的URL
     * @param {object} share_info 收藏分享信息
     */
    getShareUrl(share_info) {
        if (!share_info) {
            return "#";
        }
        // 相册分享
        if (share_info.album_info && Object.keys(share_info.album_info).length > 0) {
            return 'https://user.qzone.qq.com/{owner_uin}/photo/{id}'.format(share_info.album_info);
        }
        // 日志分享
        if (share_info.blog_info && Object.keys(share_info.blog_info).length > 0) {
            return 'https://user.qzone.qq.com/{owner_uin}/blog/{id}'.format(share_info.blog_info);
        }
        // 音乐分享
        if (share_info.music_list && share_info.music_list.length > 0) {
            return share_info.music_list[0].music_info.play_url;
        }
        // 视频分享
        if (share_info.video_list && share_info.video_list.length > 0) {
            return share_info.video_list[0].video_info.play_url;
        }
        return share_info.share_url;
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
    }
}

/**
 * 访客模块API
 */
API.Visitors = {

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

/**
 * 视频模块API
 */
API.Videos = {

    /**
     * 是否腾讯视频（判断不严谨，先临时判断）
     * @param {object} 视频信息
     */
    isTencentVideo(video) {
        let url2 = video.url2 || '';
        let url3 = video.url3 || '';
        if (!url2 || url3.indexOf('.mp4') > -1) {
            // 如果URL都没有值，或者地址含有.mp4，肯定是空间视频？
            return false;
        }
        if (url3.indexOf('tencentvideo') > -1) {
            // 该判断不严谨，但是不知道怎么判断的好
            return true;
        }
        return false;
    },

    /**
     * 是否外部视频（判断不严谨，先临时判断）
     * @param {object} 视频信息
     */
    isExternalVideo(video) {
        let url3 = video.url3 || '';
        const isTencentTV = API.Videos.isTencentVideo(video);
        if (isTencentTV) {
            return true;
        }
        if (url3.indexOf('.swf') > -1) {
            // Flash地址肯定是外部视频？
            return true;
        }
        return false;
    },

    /**
     * 获取视频连接
     * @param {object} 视频信息
     */
    getVideoUrl(video) {
        // URL3个人相册视频？
        let url = video.url3 || video.url;
        if (video.source_type == "share") {
            // 分享视频连接？
            url = video.rt_url;
        }
        if (API.Videos.isTencentVideo(video)) {
            // 腾讯视频
            if (!video.video_id) {
                return video.url2;
            }
            url = API.Videos.getTencentVideoUrl(video.video_id);
        }
        // 其他第三方视频
        return url;
    },

    /**
     * 获取腾讯视频的播放地址
     * @param {string} vid 视频ID
     */
    getTencentVideoUrl(vid) {
        let params = {
            "origin": "https://user.qzone.qq.com",
            "vid": vid,
            "autoplay": true,
            "volume": 100,
            "disableplugin": "IframeBottomOpenClientBar",
            "additionplugin": "IframeUiSearch",
            "platId": "qzone_feed",
            "show1080p": true,
            "isDebugIframe": false
        }
        return API.Utils.toUrl('https://v.qq.com/txp/iframe/player.html', params);
    }
}



/**
 * 留言模块API
 */
API.Boards = {

    /**
     * 获取留言人
     * @param {object} board 留言对象
     */
    getOwner(board) {
        return board.nickname || board.nick || '神秘者';
    }
}

/**
 * 好友模块APi
 */
API.Friends = {

    /**
     * 获取共同好友
     * @param {Object} friend 好友
     */
    getCommonFriend(friend) {
        const list = [];
        if (!friend || !friend.common || !friend.common.friend) {
            return list;
        }
        return friend.common.friend;
    },

    /**
     * 获取共同好友
     * @param {Object} friend 好友
     */
    getShowCommonFriend(friend) {
        if (friend.isMe) {
            return '本人';
        }
        const friends = API.Friends.getCommonFriend(friend);
        return friends.length;
    },

    /**
     * 获取共同群组
     * @param {Object} friend 好友
     */
    getCommonGroup(friend) {
        const list = [];
        if (!friend || !friend.common || !friend.common.group) {
            return list;
        }
        for (const item of friend.common.group) {
            list.push(item['name'] || item);
        }
        friend.common.group = list;
        return list;
    },

    /**
     * 获取共同群组
     * @param {Object} friend 好友
     */
    getShowCommonGroup(friend, joinStr) {
        if (friend.isMe) {
            return '本人';
        }
        const groups = API.Friends.getCommonGroup(friend);
        return groups.length == 0 ? '无' : groups.join(joinStr);
    },

    /**
     * 获取相识显示时间
     * @param {Object} friend 好友
     */
    getShowFriendTime(friend, showType) {
        if (friend.isMe) {
            return '本人';
        }
        if (!friend.addFriendTime || friend.addFriendTime === 0) {
            return '未知';
        }
        if (0 === showType) {
            return API.Utils.formatDate(friend.addFriendTime);
        }
        return moment().from(moment(friend.addFriendTime * 1000), true);
    },

    /**
     * 获取QQ好友关系类型
     * @param {Object} friend 好友信息
     */
    getShowFriendType(friend, showType) {
        let showText = '未知';
        let showClass = 'fa-user-times text-danger';
        if (friend.isMe) {
            showText = '本人';
            showClass = 'fa-user-plus';
        }
        if (friend.deleted) {
            showText = '已删';
            showClass = 'fa-trash text-danger';
        } else {
            if (friend.isFriend === 2) {
                showText = '单向';
            } else if (friend.isFriend === 1) {
                showText = '正常';
                showClass = 'fa-user-plus';
            }
        }
        if (showType === 'HTML') {
            return `<span title="好友关系：{0}" class="fa {1}"></span>`.format(showText, showClass);
        }
        return showText;
    },

    /**
     * 获取空间权限
     * @param {Object} friend 好友信息
     */
    getShowAccessType(friend, showType) {
        let showText = '未知';
        let showClass = 'fa-lock text-danger';
        if (friend.isMe) {
            showText = '本人';
            showClass = 'fa-unlock';
        }
        if (friend.access === false) {
            showText = '无';
        } else if (friend.access === true) {
            showText = '有';
            showClass = 'fa-unlock';
        }
        if (showType === 'HTML') {
            return `<span title="访问权限：{0}" class="fa {1}"></span>`.format(showText, showClass);
        }
        return showText;
    },

    /**
     * 获取特别关心显示值
     * @param {Object} friend 好友信息
     */
    getShowCare(friend, showType) {
        const showText = friend.isMe ? '本人' : friend.care ? '已关心' : '未关心'
        if (showType === 'HTML') {
            return `<span title="{0}" class="fa {1}"></span>`.format(showText, friend.care ? 'fa-heartbeat text-danger' : 'fa-heart-o');
        }
        return showText;
    },

    /**
     * 亲密度显示
     * @param {Object} friend 好友信息
     */
    getShowIntimacyScore(friend) {
        if (friend.isMe) {
            return '本人';
        }
        return friend.intimacyScore || 0;
    },

    /**
     * QQ通讯显示值
     * @param {Object} friend 好友信息
     */
    getShowMessage(friend) {
        return `<a href="{0}" target="_blank">
                    <span title="与TA聊天" class="fa fa-qq"></span>
                </a>`
            .format(API.Common.getMessageUrl(friend.uin));
    }
}

/**
 * 模板常量
 */
const TPL = {};

/**
 * 模式窗口
 */
TPL.MODAL_WIN = `
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
`

/**
 * 点赞列表模板
 */
TPL.LIKE_LIST = `
<div class="list-group">
    <%if(items.length === 0 ){%>
        <p>没人点赞，好伤心哦^_^</p>
    <%}%>
    <%for (const item of items) {%>
        <a href="<%:=API.Common.getUserUrl(item.fuin)%>" target="_blank" class="list-group-item list-group-item-action border rounded">
            <div class="d-flex flex-row bd-highlight">
                <div class="avatar bd-highlight">
                    <img class="rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(item.fuin, true)%>" alt="" style="height: 50px;width: 50px;">
                </div>
                <div class="flex-fill bd-highlight align-self-center ml-3">
                    <%:=API.Common.formatContent(item.nick, "HTML", false, false, false, false, true)%>
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
`

/**
 * 最近浏览列表模板
 */
TPL.VISITOR_LIST = `
<div class="list-group">
    <%if(items.length === 0 ){%>
        <p>没人查看，好伤心哦^_^</p>
    <%}%>
    <%for (const item of items) {%>
        <a href="<%:=API.Common.getUserUrl(item.uin)%>" target="_blank" class="list-group-item list-group-item-action border rounded">
            <div class="d-flex flex-row bd-highlight">
                <div class="avatar bd-highlight">
                    <img class="rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(item.uin, true)%>" alt="" style="height: 50px;width: 50px;">
                </div>
                <div class="flex-fill bd-highlight align-self-center ml-3">
                    <%:=API.Common.formatContent(item.name, "HTML", false, false, false, false, true)%>
                </div>
                <div class="bd-highlight align-self-center ml-3">
                    <small>
                        <span><%:=API.Utils.formatDate(item.time)%></span>
                    </small>
                </div>
            </div>
        </a>
    <%}%>
</div>
`

/**
 * 通用的单条评论模板
 */
TPL.COMMON_COMMENT = `
<div class="comments mt-2">
    <div class="comment">
        <div class="d-flex justify-content-start ">
            <div class="comment-avatar">
                <a class="avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(API.Common.getCommentUser(comment).uin)%>">
                    <img class="lazyload loading w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(API.Common.getCommentUser(comment).uin, true)%>" >
                </a>
            </div>
            <div class="comment-infos ml-2">
                <a target="_blank" href="<%:=API.Common.getUserUrl(API.Common.getCommentUser(comment).uin)%>">
                    <span><%:=API.Common.formatContent(API.Common.getCommentUser(comment).name, "HTML", false, false, false, false, true)%></span>
                </a>
                <%if(comment.private){%>
                    <span class="text-warning"> 私密评论 </span>
                <%}%>
                <div class="text-muted small"><%:=API.Utils.formatDate(comment.postTime || comment.create_time)%></div>
            </div>
        </div>
        <div class="comment-text">
            <div class="messageText">
                <p><%:=API.Common.formatContent(comment.content, 'HTML', false, false, false, false, true)%></p>
                <%if(comment.pic){%>
                    <div class="comment-lightgallery">
                        <%for (let cmIdx = 0; cmIdx < comment.pic.length; cmIdx++) {%>
                            <%const image = comment.pic[cmIdx];%>
                            <a class="comment-img-lightbox" data-idx="<%:=cmIdx%>" data-sub-html="<%:=API.Common.formatContent(comment.content, 'HTML', false, false, false, false, true)%>"
                                data-src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>">
                                <img src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>" class="comment-img img-thumbnail">
                            </a>
                        <%}%>
                    </div>
                <%}%>
            </div>
            <% const replies = comment.replies || comment.list_3 || []%>
            <%if(replies.length > 0){%>
                <%for(const reply of replies){%>
                    <div class="comments">
                        <div class="comment">
                            <div class="d-flex justify-content-start">
                                <div class="comment-avatar">
                                    <a class="avatar p-0 m-0 " target="_blank" href="<%:=API.Common.getUserUrl(API.Common.getCommentUser(reply).uin)%>">
                                        <img class="lazyload loading w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(API.Common.getCommentUser(reply).uin, true)%>">
                                    </a>
                                </div>
                                <div class="comment-infos ml-2">
                                    <a target="_blank" href="<%:=API.Common.getUserUrl(API.Common.getCommentUser(reply).uin)%>">
                                        <span><%:=API.Common.formatContent(API.Common.getCommentUser(reply).name, "HTML", false, false, false, false, true)%></span>
                                    </a>
                                    <%if(reply.private){%>
                                        <span class="text-warning"> 私密回复 </span>
                                    <%}%>
                                    <div class="text-muted small"><%:=API.Utils.formatDate(reply.postTime || reply.create_time)%></div>
                                </div>
                            </div>
                            <div class="comment-text">
                                <div class="messageText">
                                    <p><%:=API.Common.formatContent(reply.content, 'HTML', false, false, false, false, true)%></p>
                                    <%if(reply.pic){%>
                                        <div class="comment-lightgallery">
                                            <%for (let cmIdx = 0; cmIdx < reply.pic.length; cmIdx++) {%>
                                                <%const image = reply.pic[cmIdx];%>
                                                <a class="comment-img-lightbox" data-idx="<%:=cmIdx%>" data-sub-html="<%:=API.Common.formatContent(reply.content, 'HTML', false, false, false, false, true)%>" 
                                                    data-src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>">
                                                    <img src="<%:=(image.custom_filepath || image.custom_url || image.o_url || image.hd_url || image.b_url || image.s_url || image.url)%>" class="comment-img img-thumbnail">
                                                </a>
                                            <%}%>
                                        </div>
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
`

/**
 * 通用的评论模板
 */
TPL.COMMON_COMMENTS = `
 <%if(comments.length === 0 ){%>
     <div class="empty-comments">
         <p class="content">没人评论，好伤心哦^_^</p>
     </div>
 <%}%>
 <%for(const comment of comments){%>
    ` + TPL.COMMON_COMMENT + `
 <%}%>
`

/**
 * 说说那年今日的说说的评论模板
 */
TPL.MESSAGES_COMMENTS = `
<%if(message.custom_comments && message.custom_comments.length > 0){%>
    <%/* 遍历评论 */%>
    <%for(let comment of message.custom_comments){%>
        <hr>
        ` + TPL.COMMON_COMMENT + `
    <%}%>
<%}%>
`

/**
 * 说说年今日的单条说说模板
 */
TPL.MESSAGES_ITEM = `
<div class="card w-70 mt-2 border">
    <div class="card-body">
        <div class="d-flex justify-content-start message-infos">
            <div class="message-avatar-img">
                <a class="avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(message.uin)%>">
                    <img class="w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(message.uin, true)%>">
                </a>
            </div>
            <div class="message-info ml-2">
                <a class="message-avatar-name" target="_blank" href="<%:=API.Common.getUserUrl(message.uin)%>">
                    <%:=API.Common.formatContent(message.name, "HTML", false, false, false, false, true)%>
                </a>
                <div class="message-time text-muted small"><%:=API.Common.formatContent(message.custom_create_time)%></div>
            </div>
        </div>
        <div class="messageText mt-3">
            <!-- 说说内容 -->
            <pre class="card-text content <%:=message.has_more_con ? 'hasMore' : ''%> <%:=QZone_Config.Messages.isShowMore ? 'more' : ''%> "><%:=API.Common.formatContent(message, "HTML", false, false, false, false, true)%></pre>
            <!-- 说说全文 -->
            <%if(message.has_more_con){%>
                <span class="fa fa-2x <%:=QZone_Config.Messages.isShowMore ? 'fa-angle-up' : 'fa-angle-down'%> cursor <%:=QZone_Config.Messages.isShowMore ? 'more' : ''%> readMore" title="<%:=QZone_Config.Messages.isShowMore ? '收起全文' : '展开全文'%>"></span>
            <%}%>
            <!-- 语音内容 -->
            <%if(message.custom_voices){%>
                <%for (const voice of message.custom_voices) {%>
                    <audio controls src="<%:=(voice.custom_filepath || voice.custom_url)%>"></audio>
                <%}%>
            <%}%>
            <!-- 转发内容 -->
            <%if(message.rt_tid){%>
                <hr>
                <a class="float-left" target="_blank" href="<%:=API.Common.getUserUrl(message.rt_uin)%>">
                    <span class="text-info"><%:=API.Common.formatContent(message.rt_uinname, "HTML", false, false, false, false, true)%>：</span>
                </a>
                <!-- 转发全文 -->
                <pre class="card-text content <%:=message.has_more_con ? 'hasMore' : ''%> <%:=QZone_Config.Messages.isShowMore ? 'more' : ''%> "><%:=API.Common.formatContent(message, "HTML", true, false, false, false, true)%></pre>
                <%if(message.rt_has_more_con && message.rt_con){%>
                    <span class="fa fa-2x <%:=QZone_Config.Messages.isShowMore ? 'fa-angle-up' : 'fa-angle-down'%> cursor readMore" title="<%:=QZone_Config.Messages.isShowMore ? '收起全文' : '展开全文'%>"></span>
                <%}%>
            <%}%>
            <!-- 查看大图 -->
            <div id="<%:= 'QZIMG-'+ message.tid%>" class='photo-detail' style="display:none">
                <div class="container">
                    <div class="row">
                        <div class="col text-white-50 text-left">
                            <p>
                                <i title="发表时间" class="fa fa-clock-o text-primary"><%:=API.Utils.formatDate(message.created_time)%></i>
                            </p>
                            <p>
                                <%if(!(!message.story_info || !message.story_info.time || !message.story_info.lbs)){%>
                                    <a class="fa fa-map-marker text-primary" target="_blank" href="<%:=API.Messages.getMapUrl(message.story_info.lbs)%>" class="card-link"><%:=message.story_info.lbs.idname || message.story_info.lbs.name%></a> 
                                    <span class="fa fa-camera text-muted">拍摄于 <%:=API.Utils.formatDate(message.story_info.time)%> </span>
                                <%}else{%>
                                    <%if(message.lbs && message.lbs.pos_x && message.lbs.pos_y){%>
                                        <a title="上传地点" class="text-primary" href="<%:=API.Messages.getMapUrl(message.lbs)%>" target="_blank"><i class="fa fa-map-marker"></i><%:=message.lbs.idname || message.lbs.name%></a>
                                    <%}%>
                                <%}%>
                            </p>
                        </div>
                        <div class="col text-truncate">
                            <p class="text-white" data-toggle="tooltip" data-html="true" title="<%:=API.Common.formatContent(message, "HTML", false, false, false, false, true)%>">
                                <%:=API.Common.formatContent(message, "HTML", false, false, false, false, true)%>
                            </p>
                        </div>
                        <div class="col"></div>
                    </div>
                </div>
            </div>
            <!-- 多媒体内容 -->
            <div id="<%:= 'QZ-'+ message.tid%>" class="medias row pl-3 lightgallery <%:=API.Common.getImgClassType(message)%>">
                <!-- 视频内容（一般为单视频） -->
                <%if(message.custom_videos){%>
                    <%let imgIdx = 0%>
                    <%for(let video of message.custom_videos){%>
                        <%if (API.Videos.isExternalVideo(video)) {%>
                            <!-- 外部视频 -->
                            <a class="medias-item border message-lightbox-external" href="<%:=API.Videos.getVideoUrl(video)%>" target="_blank">
                                <span class="message-video"></span>
                                <img class="lazyload loading w-100 h-100" src="../Common/images/loading.gif" data-src="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>">
                            </a>
                        <%}else{%>
                            <!-- 空间视频 -->
                            <a class="medias-item border message-lightbox" data-idx="<%:=imgIdx%>" data-video='{"source": [{"src":"<%:=(video.custom_filepath || video.custom_url || video.url3)%>", "type":"video/mp4"}],"attributes": {"preload": false, "controls": true}}'
                                data-poster="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>" data-sub-html="#<%:= 'QZIMG-'+ message.tid%>">
                                <span class="message-video"></span>
                                <img class="lazyload loading w-100 h-100" data-id="<%:=video.video_id%>" src="../Common/images/loading.gif"  data-src="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>" />
                            </a>
                            <%imgIdx++%>
                        <%}%>
                    <%}%>
                <%}%>
                <!-- 图片内容(含视频，即同时存在图片与视频) -->
                <%if(message.custom_images){%>
                    <%let imgIdx = 0%>
                    <%for(let image of message.custom_images){%>
                        <%if(image.is_video && image.video_info){%>
                            <%if (API.Videos.isExternalVideo(image.video_info)) {%>
                                <!-- 外部视频 -->
                                <a class="medias-item border message-lightbox-external" href="<%:=API.Videos.getVideoUrl(image.video_info)%>" target="_blank">
                                    <span class="message-video"></span>
                                    <img class="lazyload loading w-100 h-100" src="../Common/images/loading.gif" data-src="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>">
                                </a>
                            <%}else{%>
                                <!-- 空间视频 -->
                                <a class="medias-item border message-lightbox" data-idx="<%:=imgIdx%>" data-video='{"source": [{"src":"<%:=(image.video_info.custom_filepath || image.video_info.custom_url || image.video_info.url3)%>", "type":"video/mp4"}],"attributes": {"preload": false, "controls": true}}'
                                    data-poster="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>" data-sub-html="#<%:= 'QZIMG-'+ message.tid%>">
                                    <span class="message-video"></span>
                                    <img class="lazyload loading w-100 h-100" data-id="<%:=image.video_info.video_id%>" src="../Common/images/loading.gif" data-src="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>" />
                                </a>
                                <%imgIdx++%>
                            <%}%>
                        <%}else{%>
                            <a class="medias-item border message-lightbox" data-idx="<%:=imgIdx%>" data-src="<%:=(image.custom_filepath || image.custom_url)%>" data-sub-html="#<%:= 'QZIMG-'+ message.tid%>">
                                <img class="lazyload loading w-100 h-100" data-id="<%:=image.pic_id%>" src="../Common/images/loading.gif" src="../Common/images/loading.gif" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                            </a>
                            <%imgIdx++%>
                        <%}%>
                    <%}%>
                <%}%>
                <!-- 动画表情内容（目前只支持一个） -->
                <%if(message.custom_magics){%>
                    <%for(let image of message.custom_magics){%>
                        <a class="medias-item border" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                            <img class="lazyload loading w-100 h-100" data-src='<%:=(image.custom_filepath || image.custom_url)%>'>
                        </a>
                        <hr>
                    <%}%>
                <%}%>
            </div>
            <!-- 音乐内容（目前已无法正常播放，直接显示专辑图片与歌曲信息） -->
            <%if(message.custom_audios && message.audiototal > 0){%>
                <div class="medias row p-3">
                    <ul class="list-unstyled w-100">
                        <%for(let music of message.custom_audios){%>
                            <li class="border">
                                <a class="medias-item text-center" data-src="<%:=(music.custom_filepath || music.image)%>" href="<%:=music.playurl%>">
                                    <img class="lazyload loading border" data-src="<%:=(music.custom_filepath || music.image)%>">
                                    <span><%:=music.name%></span>
                                </a>
                            </li>
                        <%}%>
                    </ul>
                </div>
            <%}%>
            <!-- 投票内容（待定），功能下线了，找不到历史数据，暂不实现 -->
            <!-- 说说评论 -->
            ` + TPL.MESSAGES_COMMENTS + `
        </div>
        <!-- 说说额外信息 -->
        <ul class="message-infos small list-group list-group-flush">
            <%if(message.lbs && message.lbs.pos_x && message.lbs.pos_y){%>
                <li class="list-group-item pl-0">
                    <a class="fa fa-map-marker" target="_blank" href="<%:=API.Messages.getMapUrl(message.lbs)%>" class="card-link"> <%:=message.lbs.idname || message.lbs.name%></a>
                </li>
            <%}%>
            <%if(!(!message.story_info || !message.story_info.time || !message.story_info.lbs)){%>
                <li class="list-group-item pl-0">
                    <a class="fa fa-map-marker" target="_blank" href="<%:=API.Messages.getMapUrl(message.story_info.lbs)%>" class="card-link"><%:=message.story_info.lbs.idname || message.story_info.lbs.name%></a> 
                    <span class="fa fa-camera text-muted">拍摄于 <%:=API.Utils.formatDate(message.story_info.time)%> </span>
                </li>
            <%}%>
            <%if(message.source_name){%>
                <li class="list-group-item pl-0">
                    <%if(message.source_url){%>
                        <span class="text-info"><a target="_blank" href="<%:=message.source_url%>"><%:=API.Common.formatContent(message.source_name, "HTML", false, false, false, false, true)%></a></span>
                    <%}else{%>
                        <span class="text-info fa fa-mobile-phone"> <%:=API.Common.formatContent(message.source_name, "HTML", false, false, false, false, true)%></span>
                    <%}%>
                </li>	
            <%}%>
        </ul>
    </div>
    <div class="card-footer text-muted">
        <span class="text-primary p-1 fa fa-thumbs-up mr-2 cursor viewlikes" title="点赞列表" data-field="tid" data-target="<%:=message.tid%>"><%:=message.likeTotal || 0 %></span>
        <span class="text-primary p-1 fa fa-eye mr-2 cursor viewVisitors" title="最近访问" data-field="tid" data-target="<%:=message.tid%>"><%:=message.custom_visitor && message.custom_visitor.viewCount || 0 %></span>
    </div>
</div>
`

/**
 * 说说那年今日模板
 */
TPL.MESSAGES_YEAR_ITEMS = `
<%if (yearMaps && yearMaps.size > 0) {%>
    <h4 class="sidebar-h1" data-tag="h1">那年今日</h4>
    <%for (const [year, yearItems] of yearMaps) {%>
        <%if (yearItems && yearItems.length > 0) {%>
            <h5 class="sidebar-h2 mt-2" data-tag="h2"><%:=year%>年<span class="badge badge-primary badge-pill itemSize"><%:=yearItems.length%><span></h5>
            <%for (const message of yearItems) {%>
                ` + TPL.MESSAGES_ITEM + `
            <%}%>  
        <%}%>       
    <%}%>
    <div class="text-center text-black-50 mt-3">回忆有底线<i class="fa fa-heart text-danger m-2"></i>未来无限量</div>
<%}%>        
`

/**
 * 单条留言模板
 */
TPL.BOARDS_ITEM = `
<div class="card border mt-1">
    <div class="card-body">
        <div class="comments">
            <div class="comment p-0">
                <div class="d-flex justify-content-start ">
                    <div class="comment-avatar">
                        <a class="avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(board.uin)%>">
                            <img class="lazyload loading w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(board.uin, true)%>" >
                        </a>
                    </div>
                    <div class="comment-infos ml-2">
                        <a target="_blank" href="<%:=API.Common.getUserUrl(board.uin)%>">
                            <span><%:=API.Common.formatContent(API.Boards.getOwner(board), "HTML", false, false, false, false, true)%></span>
                        </a>
                        <div class="text-muted small mt-1"><%:=API.Utils.formatDate(board.pubtime)%></div>
                    </div>
                </div>
                <div class="messageText ml-5">
                    <%:=API.Common.formatContent(board.htmlContent,'HTML', false, true, false, false, true)%>
                </div>
                <%if(board.replyList && board.replyList.length > 0){%>
                    <hr>
                    <div class="comments m-3">
                        <%for (const reply of board.replyList) {%>
                            <div class="comment p-0 mt-2">
                                <div class="d-flex justify-content-start ">
                                    <div class="comment-avatar">
                                        <a class="avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                            <img class="lazyload loading w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(reply.uin, true)%>" >
                                        </a>
                                    </div>
                                    <div class="comment-infos ml-2">
                                        <a target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                            <span><%:=API.Common.formatContent(reply.nick, "HTML", false, false, false, false, true)%></span>
                                        </a>
                                        <div class="text-muted small"><%:=API.Utils.formatDate(reply.time)%></div>
                                    </div>
                                </div>
                                <div class="messageText ml-5">
                                    <%:=API.Common.formatContent(reply.content, 'HTML', false, false, false, false, true)%>
                                </div>
                            </div>
                        <%}%>
                    </div>
                <%}%>
            </div>
        </div>
    </div>
</div>
`

/**
 * 留言那年今日模板
 */
TPL.BOARDS_YEAR_ITEMS = `
<%if (yearMaps && yearMaps.size > 0) {%>
    <h4 class="sidebar-h1" data-tag="h1">那年今日</h4>
    <%for (const [year, yearItems] of yearMaps) {%>
        <%if (yearItems && yearItems.length > 0) {%>
            <h5 class="sidebar-h2" data-tag="h2"><%:=year%>年<span class="badge badge-primary badge-pill itemSize"><%:=yearItems.length%><span></h5>
            <%for (const board of yearItems) {%>
                ` + TPL.BOARDS_ITEM + `
            <%}%>  
        <%}%>       
    <%}%>
    <div class="text-center text-black-50 mt-3">回忆有底线<i class="fa fa-heart text-danger m-2"></i>未来无限量</div>
<%}%>        
`

/**
 * 那年今日的分享的评论模板
 */
TPL.SHARES_COMMENTS = `
 <%if(share.comments && share.comments.length > 0){%>
     <%/* 遍历评论 */%>
     <%for(let comment of share.comments){%>
        <hr>
         ` + TPL.COMMON_COMMENT + `
     <%}%>
 <%}%>
 `

/**
 * 单条分享的那年今日模板
 */
TPL.SHARES_ITEM = `
<div id="<%:='share-' + share.id%>" class="card w-70 mt-3 border share-row">
    <div class="card-body">
        <div class="comments">
            <div class="comment p-0">
                <div class="d-flex justify-content-start ">
                    <div class="comment-avatar">
                        <a class="avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(share.uin)%>">
                            <img class="lazyload loading w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoLocalUrl(share.uin, true)%>" >
                        </a>
                    </div>
                    <div class="comment-infos ml-2">
                        <a target="_blank" href="<%:=API.Common.getUserUrl(share.uin)%>">
                            <span><%:=API.Common.formatContent(share.nickname, "HTML", false, false, false, false, true)%></span>
                        </a>
                        分享<span class="border-warning border rounded text-warning small p-1"><%:=API.Shares.getDisplayType(share.type)%></span>
                        <div class="text-muted small mt-1"><%:=API.Utils.formatDate(share.shareTime)%></div>
                    </div>
                </div>
                <div class="messageText mt-2">
                    <!-- 分享描述 -->
                    <%if(share && share.desc){%>
                        <p id="<%:='share-desc-' + share.id%>"><%:=API.Common.formatContent(share.desc, "HTML", false, false, false, false, true)%></p>
                    <%}%>
                    <blockquote class="source">
                        <!-- 分享源标题 -->
                        <%if(share.source && Object.keys(share.source).length > 0 ){%>
                            <%if(share.source.title){%>
                                <p><a target="_blank" href="<%:=share.source.url%>"><%:=share.source.title%></a></p>
                            <%}%>
                            <!-- 分享源描述 -->
                            <%if(share.source.desc){%>
                                <p id="<%:='share-source-desc-' + share.id%>"><%:=API.Common.formatContent(share.source.desc, "HTML", false, false, false, false, true)%></p>
                            <%}%>
                        <%}%>
                        <!-- 分享内容 -->
                        <!-- 多媒体内容 -->
                        <!-- 分享源图片 -->
                        <%if(share.source.images && share.source.images.length > 0){%>
                            <div id="<%:='share-medias-' + share.id%>" class="medias row pl-3 lightgallery <%:=API.Common.getImgClassType(share,true)%>">
                                <%for (let idx = 0; idx < share.source.images.length; idx++) {%>
                                    <%const image = share.source.images[idx];%>
                                    <a class="medias-item border message-lightbox" data-idx="<%:=idx%>" data-src="<%:=(image.custom_filepath || image.custom_url)%>" data-sub-html="#<%:='share-source-desc-' + share.id%>">
                                        <img class="lazyload loading w-100 h-100" data-idx="<%:=idx%>" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                    </a>
                                <%}%>
                            </div>
                        <%}%>
                    </blockquote>
                    <!-- 分享评论 -->
                    ` + TPL.SHARES_COMMENTS + `
                </div>
                <!-- 分享源来源 -->
                <%if(share.source && share.source.from){%>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item pl-0">
                            <%if(share.source.from.name){%>
                                <span class="text-secondary">来自<a target="_blank" href="<%:=share.source.from.url%>"><%:=share.source.from.name%></a> </span>
                            <%}%>
                            <span class="text-secondary">共分享<%:=share.source.count%>次</span>
                        </li>
                    </ul>
                <%}%>
            </div>
        </div>
    </div>
    <div class="card-footer text-muted">
        <span class="text-primary p-1 fa fa-thumbs-up mr-2 cursor viewlikes" title="点赞列表" data-field="id" data-target="<%:=share.id%>"><%:=share.likeTotal || 0 %></span>
        <span class="text-primary p-1 fa fa-eye mr-2 cursor viewVisitors" title="最近访问" data-field="id" data-target="<%:=share.id%>"><%:=share.custom_visitor && share.custom_visitor.viewCount || 0 %></span>
    </div>
</div>
`

/**
 * 分享那年今日模板
 */
TPL.SHARES_YEAR_ITEMS = `
<%if (yearMaps && yearMaps.size > 0) {%>
    <h5 class="sidebar-h1" data-tag="h1">那年今日</h5>
    <%for (const [year, yearItems] of yearMaps) {%>
        <%if (yearItems && yearItems.length > 0) {%>
            <h6 class="sidebar-h2" data-tag="h2"><%:=year%>年<span class="badge badge-primary badge-pill itemSize"><%:=yearItems.length%><span></h6>
            <%for (const share of yearItems) {%>
                ` + TPL.SHARES_ITEM + `
            <%}%>  
        <%}%>       
    <%}%>
    <div class="text-center text-black-50 mt-3">回忆有底线<i class="fa fa-heart text-danger m-2"></i>未来无限量</div>
<%}%>        
`

/**
 * 日志列表单篇日志模板
 */
TPL.BLOGS_LIST_ITEM = `
    <a href="./info.html?blogId=<%:=blog.blogid || blog.blogId%>" class="list-group-item list-group-item-action mb-2">
        <div class="d-flex w-100 justify-content-start">
            <h5 class="mb-2 font-weight-bold">
                <%let labels = API.Blogs.getBlogLabel(blog)%>
                <%for (const label of labels) {%>
                    <%if (label === '置顶') {%>
                        <span class="badge badge-warning badge-pill">置顶</span>
                    <%}else if (label === '原创'){%>
                        <span class="badge badge-primary badge-pill">原创</span>
                    <%}else{%>
                        <span class="badge badge-secondary badge-pill"><%:=label%></span>
                    <%}%>
                <%}%>
                <%:=blog.title%>
            </h5>
        </div>
        <%if (blog.img && blog.img.length > 0) {%>
            <div class="d-flex w-100 justify-content-start mb-2">
                <%for (const image of blog.img) {%>
                    <img class="rounded mr-1" src="<%:=image.custom_url || image.url%>">
                <%}%>
            </div>
        <%}%>
        <p class="mb-2"><%:=blog.abstract || '' %></p>
        <div class="d-flex w-100 justify-content-start mt-2 mb-2 small">
            <span class="mr-2 text-wrap" title="发表时间"><%:=API.Utils.formatDate(blog.lastModifyTime ||  blog.pubtime) %></span>
            <span class="text-primary fa fa-thumbs-up ml-2 mr-2 viewlikes" title="点赞数"><%:=blog.likeTotal%></span>
            <span class="text-primary fa fa-comments-o mr-2 viewcomments" title="评论数"><%:=blog.replynum%></span>
            <span class="text-primary fa fa-eye mr-2 viewVisitors" title="阅读数"><%:=blog.custom_visitor && blog.custom_visitor.viewCount || 0%></span>
        </div>
    </a>
`

/**
 * 所有日志列表模板
 */
TPL.BLOGS_LIST = `
    <%for (const blog of blogs) {%>
        ` + TPL.BLOGS_LIST_ITEM + `
    <%}%> 
`

/**
 * 分类日志列表模板
 */
TPL.BLOGS_LIST_TYPE = `
    <%for (const blog of categoryItems) {%>
        ` + TPL.BLOGS_LIST_ITEM + `
    <%}%> 
`

/**
 * 日志列表模板
 */
TPL.BLOGS_TYPE_LIST = `
<div class="row">
    <%const cateHexMaps = new Map()%>
    <%for (const [category, categoryItems] of categoryMaps) {%>
        <%let cateHex = categoryItems[0].cateHex || API.Utils.newUid()%>
        <%cateHexMaps.set(category,cateHex)%>
    <%}%> 
    <div class="col-2" id="blogs-types">
        <div class="list-group" id="list-tab" role="tablist">
            <a class="list-group-item list-group-item-action align-items-center active" id="list-all-list" data-toggle="list" href="#list-all" role="tab">
                全部日志
                <span class="badge badge-warning badge-pill float-right"><%:=blogs.length%></span>
            </a>
            <%for (const [category, categoryItems] of categoryMaps) {%>
                <a class="list-group-item list-group-item-action align-items-center" id="list-<%:=cateHexMaps.get(category)%>-list" data-category="<%:=category%>" data-toggle="list" href="#list-<%:=cateHexMaps.get(category)%>" role="tab">
                    <%:=category%>
                    <span class="badge badge-warning badge-pill float-right"><%:=categoryItems.length%></span>
                </a>
            <%}%> 
        </div>
    </div>
    <div class="col-8" id="blogs-type-list">
        <div class="tab-content" id="nav-tabContent">
            <div class="tab-pane fade show active" id="list-all" role="tabpanel" aria-labelledby="list-all-list">
                <div class="list-group">
                    ` + TPL.BLOGS_LIST + `
                </div>
            </div>
            <%for (const [category, categoryItems] of categoryMaps) {%>
                <div class="tab-pane fade" id="list-<%:=cateHexMaps.get(category)%>" data-category="<%:=category%>" role="tabpanel" aria-labelledby="list-<%:=cateHexMaps.get(category)%>-list">
                    <div class="list-group">
                        ` + TPL.BLOGS_LIST_TYPE + `
                    </div>
                </div>
            <%}%> 
        </div>
    </div>
</div>
`

/**
 * 好友列表单个好友模板
 */
TPL.FRIENDS_LIST_ITEM = `
 <div class="list-group-item list-group-item-action mb-2">
     <div class="align-middle mb-2">
        <a class="avatar" href="<%:=API.Common.getUserUrl(friend.uin)%>" target="_blank" title="访问TA的QQ空间">
            <img src="<%:=API.Common.getUserLogoLocalUrl(friend.uin, true)%>">
        </a>
        <span title="备注/昵称" class="ml-2"><%:=API.Common.formatContent(friend.remark || friend.name, "HTML", false, false, false, false, true)%></span>
     </div>
     <ul class="list-inline">
        <li class="list-inline-item qq-message">
            <%:=API.Friends.getShowMessage(friend)%>
        </li>
        <li class="list-inline-item care">
            <%:=API.Friends.getShowCare(friend, 'HTML')%>
        </li>
        <li class="list-inline-item access">
            <%:=API.Friends.getShowAccessType(friend, 'HTML')%>
        </li>
        <li class="list-inline-item oneWay">
            <%:=API.Friends.getShowFriendType(friend, 'HTML')%>
        </li>
    </ul>
    <ul class="list-inline">
        <li class="list-inline-item addFriendTime">
            <span class="badge badge-primary badge-pill" title="好友成立时间：<%:=API.Friends.getShowFriendTime(friend, 0)%>" >相识：<%:=API.Friends.getShowFriendTime(friend, 1)%></small>
        </li>
        <li class="list-inline-item intimacyScore">
            <span title="亲密度" class="badge badge-success badge-pill">亲密：<%:=API.Friends.getShowIntimacyScore(friend)%></span>
        </li>
        <li class="list-inline-item commonFriend ">
            <span title="共同好友" class="badge badge-info badge-pill">好友：<%:=API.Friends.getShowCommonFriend(friend)%></span>
        </li>
        <li class="list-inline-item commonGroup">
            <span title="共同群组：<%:=API.Friends.getShowCommonGroup(friend, '，')%>" class="badge badge-secondary badge-pill">群组：<%:=API.Friends.getCommonGroup(friend).length%></span>
        </li>
    </ul>
 </div>
`

/**
 * 好友列表模板
 */
TPL.FRIENDS_LIST = `
 <%for (const friend of friends) {%>
     ` + TPL.FRIENDS_LIST_ITEM + `
 <%}%> 
`

/**
 * 分组好友列表模板
 */
TPL.FRIENDS_LIST_GROUP = `
 <%for (const friend of groupNameItems) {%>
     ` + TPL.FRIENDS_LIST_ITEM + `
 <%}%> 
`

/**
 * 好友列表模板
 */
TPL.FRIENDS_GROUP_LIST = `
<div class="row">
    <%const groupKeyMaps = new Map()%>
    <%for (const [groupName, groupNameItems] of groupMaps) {%>
        <%let groupKey = groupName ==groupNameItems[0] && groupNameItems[0].groupName && groupNameItems[0].groupid || API.Utils.newUid()%>
        <%groupKeyMaps.set(groupName,groupKey)%>
    <%}%> 
    <div class="col-2" id="friends-types">
        <div class="list-group" id="list-tab" role="tablist">
            <a class="list-group-item list-group-item-action align-items-center active" id="list-all-list" data-toggle="list" href="#list-all" role="tab">
                全部好友
                <span class="badge badge-warning badge-pill float-right"><%:=friends.length%></span>
            </a>
            <%for (const [groupName, groupNameItems] of groupMaps) {%>
                <a class="list-group-item list-group-item-action align-items-center" id="list-<%:=groupKeyMaps.get(groupName)%>-list" data-toggle="list" href="#list-<%:=groupKeyMaps.get(groupName)%>" role="tab">
                    <%:=groupName%>
                    <span class="badge badge-warning badge-pill float-right"><%:=groupNameItems.length%></span>
                </a>
            <%}%> 
        </div>
    </div>
    <div class="col-8" id="friends-type-list">
        <div class="tab-content" id="nav-tabContent">
            <div class="tab-pane fade show active" id="list-all" role="tabpanel" aria-labelledby="list-all-list">
                <div class="list-group">
                    ` + TPL.FRIENDS_LIST + `
                </div>
            </div>
            <%for (const [groupName, groupNameItems] of groupMaps) {%>
                <div class="tab-pane fade" id="list-<%:=groupKeyMaps.get(groupName)%>" role="tabpanel" aria-labelledby="list-<%:=groupKeyMaps.get(groupName)%>-list">
                    <div class="list-group">
                        ` + TPL.FRIENDS_LIST_GROUP + `
                    </div>
                </div>
            <%}%> 
        </div>
    </div>
</div>
`