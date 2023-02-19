/**
 * QQ空间数据统计分析信息
 * @author https://lvshuncai.com
 */
"use strict";

// 空间基本信息，共发表多少说说、上传了多少相片、上传了多少个视频、写了多少篇日志、
// 写了多少篇日记、分享了多少条XX的数据、有多少好友、有多少访客、写了多少字
// 
// 
// 空间足迹，生成足迹地图、打卡散点图、常驻城市、常驻省份
// 省份最早/最新动态、城市最早/最新动态
// 
// 
// 空间过客，存在互动但非QQ好友
// 互动用户，存在互动的QQ好友与非QQ好友
// 旧友、不存在互动但为QQ好友的用户
// 亲密好友，存在互动，也是QQ好友
// 
// 常互动好友、久不互动好友
// 第一个互动好友、最新互动好友
// 
// 最近1月/1年内新增好友
// 5年/10年前添加的好友
// 首个添加的好友、最新添加的好友
// 
// 最多共同好友的好友
// 最多共同QQ群的好友
// 
// 特别关心的人，隐身访问
// 
// 最多查看、最多评论、最多点赞的动态，空间最早动态与最新动态

// 中国地图
const CHINA_MAP = "china";
// 世界地图
const WORLD_MAP = "world";

/**
 * 获取地图名称映射
 * @param {String} mapType 地图类型
 * @returns 
 */
API.Statistics.getNameMap = mapType => {
    return mapType === 'world' ? MAP_CONFIG_WORLD.KEY_TO_NAME : MAP_CONFIG_CHINA.KEY_TO_NAME;
}

/**
 * 获取空间数据所有的坐标信息
 */
API.Statistics.getAllLbs = () => {
    // 所有的坐标信息
    const lbsItems = [];

    // 获取所有说说的坐标
    const messageLbs = API.Messages.getAllLbs(messages);
    lbsItems.push(...messageLbs);

    return messageLbs;
}

/**
 * 获取说说的坐标位置
 */
API.Messages.getAllLbs = items => {
    // 所有的坐标信息
    const allLbs = [];

    items = items || [];

    for (const item of items) {
        if (['1c434d43a0ab3050878f0800', '1c434d43e624435091110400'].includes(item.tid)) {
            // 本人模拟定位错误的地址
            continue;
        }
        // 转发的说说跳过
        if (item.rt_tid) {
            continue;
        }
        const lbs = item.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        const newLbs = Object.assign({}, lbs);
        newLbs.module = '说说';
        newLbs.source = item;
        allLbs.push(newLbs);
    }
    return allLbs;
}

/**
 * 初始化城市
 * @param {String} mapName 地图内部值
 * @param {String} dom_id DOM元素ID
 */
API.Statistics.makeCity = (mapName, dom_id) => {
    achart = echarts.init(document.getElementById(dom_id));
    var option = {
        "title": [{
            "textStyle": {
                "color": "#000",
                "fontSize": 18
            },
            "subtext": "",
            "text": mapName,
            "top": "auto",
            "subtextStyle": {
                "color": "#aaa",
                "fontSize": 12
            },
            "left": "auto"
        }],
        "legend": [{
            "selectedMode": "multiple",
            "top": "top",
            "orient": "horizontal",
            "data": [
                ""
            ],
            "left": "center",
            "show": true
        }],
        "backgroundColor": "#fff",
        "series": [{
            "mapType": mapName,
            "data": [],
            "name": "",
            "symbol": "circle",
            "type": "map",
            "roam": true
        }]
    };
    achart.setOption(option);
}

/**
 * 获取常驻省份的信息
 * @param {Array} lbsItems 坐标信息
 * @param {Boolean} isAll 是否获取全部省份
 */
API.Statistics.getSummaryProvinceTrace = (mapType, lbsItems, isAll) => {
    // 地图名称映射
    const nameMap = API.Statistics.getNameMap(mapType);

    // 所有的省份
    const geoJson = echarts.getMap(mapType).geoJson;
    const provinceList = echarts.parseGeoJson(geoJson) && geoJson.features;

    // 省份名称映射
    const provinceMap = new Map();
    // 省份的坐标范围
    const provinceLbsMap = new Map();
    // 省份的所有涉及的坐标
    const provinceLbsItemMap = new Map();
    for (const province of provinceList) {
        // 省份属性
        const provinceAttr = province.properties;
        if (!provinceAttr.name) {
            continue;
        }

        provinceMap.set(provinceAttr.name, province);
        provinceLbsItemMap.set(provinceAttr.name, []);

        // 省份的坐标范围
        const coordinates = province.geometry && province.geometry.coordinates || [];
        provinceLbsMap.set(provinceAttr.name, coordinates);
    }
    const res = [];

    for (const lbsItem of lbsItems) {
        // 需要匹配的坐标
        const matchLbsItem = [lbsItem.pos_x * 1, lbsItem.pos_y * 1];
        // 区域坐标信息
        for (const [province, provinceLbs] of provinceLbsMap) {
            const provinceLbsItems = provinceLbsItemMap.get(province) || [];
            // 是否在省份坐标范围内
            let isInPolygon = false;
            for (const _provinceLbs of provinceLbs) {
                if (_provinceLbs.length === 0) {
                    continue;
                }
                if (API.Statistics.rayCasting(matchLbsItem, _provinceLbs) || API.Statistics.rayCasting(matchLbsItem, _provinceLbs[0])) {
                    isInPolygon = true;
                }
            }
            if (isInPolygon) {
                provinceLbsItems.push(lbsItem);
            }
            provinceLbsItemMap.set(province, provinceLbsItems);
            if (isInPolygon) {
                break;
            }
        }
    }

    for (const [province, provinceLbsItems] of provinceLbsItemMap) {
        if (!isAll && provinceLbsItems.length < 1) {
            continue;
        }
        const provinceAttr = provinceMap.get(province).properties;
        const resItem = {
            name: nameMap[province] || province,
            items: provinceLbsItems,
            center: provinceAttr.center || provinceAttr.cp,
            value: provinceLbsItems.length
        }

        // 不受视觉组件管控
        if (provinceLbsItems.length == 0) {
            resItem.visualMap = false;
        }

        res.push(resItem);
    }
    return res;
}

/**
 * 初始化所有的省会城市
 */
API.Statistics.initProvincialCapital = () => {
    // 所有的省份
    const provinceList = echarts.getMap(mapType).geoJson.features;
    const res = [];
    for (const province of provinceList) {
        const provinceAttr = province.properties;
        // 获取省份对应的地图
        const provinceMap = echarts.getMap(provinceAttr.name);
        if (!provinceMap) {
            // 直辖市
            res.push({
                name: provinceAttr.name,
                value: provinceAttr.cp || provinceAttr.center
            });
            continue;
        }
        const cityList = provinceMap.geoJson.features;
        for (const city of cityList) {
            const cityAttr = city.properties;
            if (_.isEqual(provinceAttr.center || provinceAttr.cp, cityAttr.center || cityAttr.cp)) {
                res.push({
                    name: cityAttr.name,
                    value: provinceAttr.center || provinceAttr.cp
                });
            }
        }
    }
    return res;
}

/**
 * 坐标是否在指定范围内
 * @param {*} checkPoint 
 * @param {*} polygonPoints 
 * @returns 
 */
API.Statistics.isInPolygon = (checkPoint, polygonPoints) => {
    var counter = 0;
    var i;
    var xinters;
    var p1, p2;
    var pointCount = polygonPoints.length;
    p1 = polygonPoints[0];

    for (i = 1; i <= pointCount; i++) {
        p2 = polygonPoints[i % pointCount];
        if (
            checkPoint[0] > Math.min(p1[0], p2[0]) &&
            checkPoint[0] <= Math.max(p1[0], p2[0])
        ) {
            if (checkPoint[1] <= Math.max(p1[1], p2[1])) {
                if (p1[0] != p2[0]) {
                    xinters =
                        (checkPoint[0] - p1[0]) *
                        (p2[1] - p1[1]) /
                        (p2[0] - p1[0]) +
                        p1[1];
                    if (p1[1] == p2[1] || checkPoint[1] <= xinters) {
                        counter++;
                    }
                }
            }
        }
        p1 = p2;
    }
    if (counter % 2 == 0) {
        return false;
    } else {
        return true;
    }
}

/**
 * 坐标是否在指定范围内
 * @param {*} checkPoint 
 * @param {*} polygonPoints 
 * @returns 
 */
API.Statistics.rayCasting = (p, poly) => {
    var px = p[0],
        py = p[1],
        flag = false

    for (var i = 0, l = poly.length, j = l - 1; i < l; j = i, i++) {
        var sx = poly[i][0],
            sy = poly[i][1],
            tx = poly[j][0],
            ty = poly[j][1]

        // 点与多边形顶点重合
        if ((sx === px && sy === py) || (tx === px && ty === py)) {
            return true
        }

        // 判断线段两端点是否在射线两侧
        if ((sy < py && ty >= py) || (sy >= py && ty < py)) {
            // 线段上与射线 Y 坐标相同的点的 X 坐标
            var x = sx + (py - sy) * (tx - sx) / (ty - sy)

            // 点在多边形的边上
            if (x === px) {
                return true
            }

            // 射线穿过多边形的边界
            if (x > px) {
                flag = !flag
            }
        }
    }

    // 射线穿过多边形边界的次数为奇数时点在多边形内
    return flag ? true : false
}

/**
 * 转换LBA到Geo坐标，用于散点展示
 * @param {Array} items LBS清单
 * @returns 
 */
API.Statistics.toGeoCoord = items => {
    const res = [];
    for (const item of items) {
        res.push({
            name: item.name || item.idname,
            value: [item.pos_x, item.pos_y],
            item: item
        });
    }
    return res;
}



/**
 * 格式化途径省份提示内容
 * @param {Object} params 鼠标悬浮的对象
 */
API.Statistics.formatterResidentProvince = params => {
    if (params.name === '南海诸岛') {
        return '';
    }
    const mapType = window.chart.mapType;
    if (!params.value || params.value < 1) {
        return `<span class="text-primary">${MAP_TYPE_CFG.KEY_TO_NAME[mapType]}</span>那么大，还没去<span class="text-primary">${params.name}</span>看看`;
    }
    // 显示内容
    const contetns = [];
    contetns.push(`途径：<span class="text-primary">${params.name}</span><br>`);
    contetns.push(`足迹：<span class="text-primary">${params.value}</span>处<br>`);

    // 最早动态
    const fisrtItem = _.minBy(params.data.items, item => item.source.created_time);

    if (fisrtItem.module === '说说') {
        const message = fisrtItem.source;
        const custom_content = API.Common.formatContent(message, "HTML", false, false, false, false, true);

        contetns.push('<hr>');
        contetns.push(`最早打卡：<span class="text-primary">${message.custom_create_time}</span><br>`);
        if (!custom_content && message.rt_tid) {
            contetns.push(`转发了说说：${API.Common.formatContent(message, "HTML", true, false, false, false, true)}<br>`);
        } else {
            contetns.push(`发表了说说：${custom_content}<br>`);
        }
    }

    // 最新的动态
    const latestItem = _.maxBy(params.data.items, item => item.source.created_time);

    if (latestItem.module === '说说') {
        const message = latestItem.source;
        const custom_content = API.Common.formatContent(message, "HTML", false, false, false, false, true);

        contetns.push('<hr>');
        contetns.push(`最新打卡：<span class="text-primary">${message.custom_create_time}</span><br>`);
        if (!custom_content && message.rt_tid) {
            contetns.push(`转发了说说：${API.Common.formatContent(message, "HTML", true, false, false, false, true)}<br>`);
        } else {
            contetns.push(`发表了说说：${custom_content}<br>`);
        }
    }
    return contetns.join('');
}


/**
 * 格式化打卡足迹提示内容
 * @param {Object} params 鼠标悬浮的对象
 */
API.Statistics.formatterWayMarker = (params) => {
    // 目标对象
    const targetItem = params.data.item;

    // 显示内容
    const contetns = [];
    contetns.push(`我的足迹：<span class="text-primary">${targetItem.idname || targetItem.name }</span><br>`);

    if (targetItem.module === '说说') {
        const message = targetItem.source;
        const custom_content = API.Common.formatContent(message, "HTML", false, false, false, false, true);
        contetns.push(`打卡时间：<span class="text-primary">${message.custom_create_time}</span><br>`);

        contetns.push('<hr>');
        if (!custom_content && message.rt_tid) {
            contetns.push(`转发了说说：${API.Common.formatContent(message, "HTML", true, false, false, false, true)}<br>`);
        } else {
            contetns.push(`发表了说说：${custom_content}<br>`);
        }
    }

    return contetns.join('');
}

/**
 * 转换坐标，用于世界地图展示
 * @param {Array} lbsItems LBS清单
 */
API.Statistics.transformCoord = (lbsItems, mapType) => {
    if (_.isEmpty(lbsItems) || WORLD_MAP !== mapType) {
        // 国内地图，无需转换，腾讯使用的火星坐标系
        return;
    }

    for (const item of lbsItems) {
        let res = coordtransform.gcj02towgs84(item.pos_x * 1, item.pos_y * 1)
        item.pos_x = res[0];
        item.pos_y = res[1];
    }
}

/**
 * 获取标题区域名称
 * @param {String} mapType 地图类型
 * @returns 
 */
API.Statistics.getTitleRegionName = (mapType) => {
    if (WORLD_MAP === mapType) {
        return "国家/地区";
    }
    return "省/市/区";
}

/**
 * 获取地图标题
 * @param {String} mapType 地图类型
 * @param {Object} region 区域数量
 * @param {Number} count 打卡数量
 * @returns 
 */
API.Statistics.getTitle = (mapType, region, count) => {
    return [{
        text: `QQ空间打卡足迹`,
        link: 'https://qzone.qq.com',
        subtext: userInfo.spacename,
        sublink: `https://user.qzone.qq.com/${userInfo.uin}`,
        left: 'left'
    }, {
        text: `{map|${MAP_TYPE_CFG.KEY_TO_NAME[mapType]}}那么大，才打卡{region|${region}}个${API.Statistics.getTitleRegionName(mapType)}，留下{count|${count}}处足迹`,
        textStyle: {
            rich: {
                map: {
                    color: "red",
                    fontSize: 18
                },
                region: {
                    color: "#28a745",
                    fontSize: 20
                },
                count: {
                    color: "orange",
                    fontSize: 20
                }
            }
        },
        subtext: `曾梦想仗剑走天涯，看一看` + MAP_TYPE_CFG.KEY_TO_NAME[mapType] + `的繁华`,
        subtextStyle: {
            rich: {
                map: {
                    color: "orangered",
                    fontSize: 13
                }
            }
        },
        left: 'center'
    }, {
        subtext: 'Powered By QQ空间导出助手',
        sublink: 'https://github.com/ShunCai/QZoneExport',
        left: 'center',
        bottom: "0"
    }]
}

/**
 * 获取过客，即存在互动但非QQ好友
 * @param {Array} users 互动用户
 */
API.Statistics.getInteractivePasserby = (users) => {
    if (_.isEmpty(users) || _.isEmpty(friends)) {
        return [];
    }
    return users.filter(item => _.findIndex(friends, ['uin', item.uin]) === -1);
}

/**
 * 获取旧友，即不存在互动但为QQ好友
 * @param {Array} users 互动用户
 */
API.Statistics.getInteractiveOldFriends = (users) => {
    if (_.isEmpty(users) || _.isEmpty(friends)) {
        return [];
    }
    return friends.filter(item => _.findIndex(users, ['uin', item.uin]) === -1);
}

/**
 * 获取亲密好友，存在互动，也是QQ好友
 * @param {Array} users 互动用户
 */
API.Statistics.getIntimacyFriends = (users) => {
    if (_.isEmpty(users) || _.isEmpty(friends)) {
        return [];
    }
    return friends.filter(item => _.findIndex(users, ['uin', item.uin]) > -1);
}

/**
 * 获取老友，基于好友成立时间
 * @param {Number} year 多少个年之前为老友
 */
API.Statistics.getOldFriends = (year) => {
    if (_.isEmpty(friends)) {
        return [];
    }
    return friends.filter(item => item.addFriendTime && item.addFriendTime * 1000 < Date.now() - 1000 * 60 * 60 * 24 * 31 * 12 * year);
}

/**
 * 获取新友，基于好友成立时间
 * @param {Number} month 多少个月为新好友
 */
API.Statistics.getNewFriends = (month) => {
    if (_.isEmpty(friends)) {
        return [];
    }
    return friends.filter(item => item.addFriendTime && item.addFriendTime * 1000 > Date.now() - 1000 * 60 * 60 * 24 * 31 * month);
}

/**
 * 获取首个添加的好友
 */
API.Statistics.getFirstFriend = () => {
    return _.minBy(_.filter(friends, item => item.addFriendTime > 0), 'addFriendTime');
}

/**
 * 获取最新添加的好友
 */
API.Statistics.getLastFriend = () => {
    return _.maxBy(_.filter(friends, item => item.addFriendTime > 0), 'addFriendTime');
}

/**
 * 初始化地图
 * @param {String} mapType 地图类型
 */
API.Statistics.initMap = (mapType) => {
    const chart = window.chart = echarts.init(document.getElementById('qzone-maps'));
    window.chart.mapType = mapType;

    // 所有坐标信息
    const lbsItems = API.Statistics.getAllLbs();

    // 坐标转换
    API.Statistics.transformCoord(lbsItems, mapType);

    const geoItems = API.Statistics.toGeoCoord(lbsItems);

    // 省份清单
    const residentProvinceList = API.Statistics.getSummaryProvinceTrace(mapType, lbsItems, true);

    // 途径省份
    const onlyWayProvinceList = residentProvinceList.filter(item => item.value > 0);

    const option = {
        title: API.Statistics.getTitle(mapType, onlyWayProvinceList.length, lbsItems.length),
        tooltip: {
            trigger: 'item'
        },
        toolbox: {
            show: true,
            feature: {
                // 导出分享
                saveAsImage: {
                    title: "截图分享",
                    icon: "path://M625.792 302.912V64L1024 482.112l-398.208 418.176V655.36C341.312 655.36 142.208 750.912 0 960c56.896-298.688 227.584-597.312 625.792-657.088z"
                },
                mySwitchMap: {
                    show: true,
                    title: mapType === CHINA_MAP ? "切换到世界地图" : "切换到中国地图",
                    icon: "image://data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjU0OTE4MzI5NDI4IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjIzMjMiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj48L3N0eWxlPjwvZGVmcz48cGF0aCBkPSJNMTAyMy45ODQwNCA1MTJjMCAyODIuNzQ5NTgyLTIyOS4yMTY0MTggNTEyLTUxMS45ODQgNTEyQzIyOS4yMzQ0NTggMTAyNCAwLjAwMDA0IDc5NC43NDk1ODIgMC4wMDAwNCA1MTIgMC4wMDAwNCAyMjkuMjM0NDE4IDIyOS4yMzQ0NTggMCA1MTIuMDAwMDQgMCA3OTQuNzY3NjIyIDAgMTAyMy45ODQwNCAyMjkuMjM0NDE4IDEwMjMuOTg0MDQgNTEyeiIgZmlsbD0iIzVEOUNFQyIgcC1pZD0iMjMyNCI+PC9wYXRoPjxwYXRoIGQ9Ik05OTguODkwNDMyIDM1My4yMDQ0ODFjLTI0LjAzMTYyNS03My42ODg4NDktNjUuNDA0OTc4LTE0Mi4xNzE3NzktMTE5LjcxODEyOS0xOTguMDQ2OTA1LTU0LjI0OTE1Mi01NS43ODExMjgtMTIxLjQzODEwMy05OS4wNzg0NTItMTk0LjI4MDk2NC0xMjUuMjE4MDQ0bC0yMS4yODE2NjgtNy42Mzk4OC02LjM3NTkgMjEuNzE3NjZjLTIuOTM3OTU0IDkuOTA3ODQ1LTUuMTU1OTE5IDE3LjA2MzczMy02LjY4OTg5NiAyMS4zNzU2NjYtMTguOTk5NzAzIDguOTA1ODYxLTM5LjMxMTM4NiAxNi45Mzc3MzUtNTguOTY3MDc4IDI0Ljc0OTYxNC02Mi43MTUwMiAyNC44NDE2MTItMTI3LjU0NDAwNyA1MC41NDUyMS0xNzIuMjYzMzA5IDEwOS40ODIyODktMTkuNDU1Njk2IDI1LjYyNTYtMjEuNzA1NjYxIDUyLjM5MTE4MS01Ljg1OTkwOCA2OS44Mjg5MDkgOC4yOTU4NyA5LjEzOTg1NyAyMC4zNzU2ODIgMTMuNzgxNzg1IDM1LjkwNTQzOSAxMy43ODE3ODQgMTAuMTIzODQyIDAgMjAuNjg3Njc3LTEuOTA1OTcgMjkuOTk5NTMxLTMuNTc3OTQ0IDYuNTYxODk3LTEuMTg3OTgxIDEzLjM0Mzc5Mi0yLjQwNTk2MiAxNy4zMjc3MjktMi40MDU5NjIgMC4yOTU5OTUgMCAwLjU2MTk5MSAwLjAxNiAwLjgyNzk4NyAwLjAzMTk5OSAyMi45MjE2NDIgMS42Mzk5NzQgNjUuNjI0OTc1IDkuNzQ5ODQ4IDEwMy44NzQzNzcgMTkuNzE3NjkyIDQyLjAzMTM0MyAxMC45Mzc4MjkgNjQuMzEyOTk1IDIwLjE4NzY4NSA3My44MTI4NDcgMjUuNTc5NjAxLTYuMzc1OSA3LjU5Mzg4MS0yMy40Njc2MzMgMTkuMzI5Njk4LTQ2LjM0NTI3NiAxOS4zMjk2OTgtMTEuMTg3ODI1IDAtMjIuMDYxNjU1LTIuODg5OTU1LTMyLjM3NTQ5NC04LjU3OTg2Ni0xNS43ODE3NTMtOC43MDM4NjQtNTUuMjgxMTM2LTE2Ljk2NzczNS0xMDkuNzE4Mjg2LTI2LjY4NzU4M2wtNS4yODE5MTctMC45NTM5ODVjLTIuMjgxOTY0LTAuNDA1OTk0LTQuODg5OTI0LTAuNjA5OTktNy45NTM4NzYtMC42MDk5OTEtMjIuODc1NjQzIDAtNzYuODI4OCAxMS4wNzc4MjctMTE3LjIxODE2OCA1My4wMzExNzItMzUuMzI3NDQ4IDM2LjY3MTQyNy01Mi4wNDUxODcgODcuMjE4NjM3LTQ5LjY4NzIyNCAxNTAuMjE3NjUyIDEuNDUzOTc3IDM4LjczMzM5NSAxNC41OTM3NzIgNzEuNjA4ODgxIDM4LjAxNTQwNiA5NS4wNDQ1MTUgMjMuNzY1NjI5IDIzLjgxMzYyOCA1Ni44NzUxMTEgMzYuNTk1NDI4IDk1LjczNDUwNCAzNy4wNjM0MjEgNC42MjM5MjggMC4wMzIgOS4yNjU4NTUgMC4wMzIgMTMuODc1NzgzIDAuMDMyaDMuMDkzOTUyYzIyLjQ1MzY0OSAwIDQ1LjY1NTI4NyAwIDYyLjgxMTAxOSA2LjQ2Nzg5OSAxMC45ODU4MjggNC4xMjM5MzYgMjQuNTE3NjE3IDEyLjI0OTgwOSAzMS44Mjk1MDIgMzguNjI1Mzk2IDcuNTYxODgyIDI3LjQzNzU3MSA5Ljc0OTg0OCA1NS40OTkxMzMgMTEuOTk5ODEzIDg1LjIxNjY2OSAyLjEyMzk2NyAyNy45Njc1NjMgNC4zNzU5MzIgNTYuOTA1MTExIDExLjQ5OTgyIDg1LjY1NDY2MSAxNC4xMjM3NzkgNTYuOTM5MTEgNDMuMjE3MzI1IDcxLjE1Njg4OCA2NS4xMjI5ODMgNzMuMDY0ODU5IDMuMTIzOTUxIDAuMjQ5OTk2IDYuMjQ5OTAyIDAuMzc1OTk0IDkuMzExODU0IDAuMzc1OTk0IDQ4Ljc1MTIzOCAwIDgxLjEyNDczMi0zMi44MTM0ODcgMTA3LjU5NDMxOS02My41OTUwMDcgNi4zMTE5MDEtNy4zNDU4ODUgMTMuMjE3NzkzLTE0LjQzOTc3NCAyMC41MzE2NzktMjEuOTM5NjU3IDE2LjEyNTc0OC0xNi41MzE3NDIgMzIuODEzNDg3LTMzLjYyMzQ3NSA0NC42ODkzMDItNTUuMzQzMTM1IDEzLjcxNzc4Ni0yNC45OTk2MDkgMTguNjIzNzA5LTUxLjI0OTE5OSAyMy40Mzc2MzQtNzYuNTkyODAzIDQuNDk5OTMtMjQuMDYxNjI0IDguODExODYyLTQ2Ljc4MzI2OSAyMC4yNDk2ODMtNjYuNjU2OTU5IDEuNTYxOTc2LTIuNjg3OTU4IDMuMzc1OTQ3LTUuNzQ5OTEgNS4zNzU5MTYtOS4yMTc4NTYgNTguMDk1MDkyLTk5LjYxMDQ0NCA3Mi4wNjI4NzQtMTM2LjQ4Mzg2NyA1OS43ODMwNjYtMTU3Ljg3MzUzMy01LjUzMTkxNC05LjU5Mzg1LTE1LjY1NTc1NS0xNC43ODE3NjktMjcuNDY5NTcxLTEzLjg3NTc4My01LjYyMzkxMiAwLjQzNzk5My0xMS4xODc4MjUgMC42NTU5OS0xNi40OTk3NDIgMC42NTU5OS0zNC45OTk0NTMgMC02My45MzcwMDEtOS42MjU4NS03OS40MDQ3NTktMjYuNDA3NTg4LTQuMzc1OTMyLTQuNzQ5OTI2LTYuNDY3ODk5LTguODQzODYyLTcuNDA1ODg0LTExLjU2MzgxOSAwLjUzMTk5Mi0wLjAzMiAxLjEyMzk4Mi0wLjA0NTk5OSAxLjgxMTk3MS0wLjA0NTk5OSAxMC4yNDk4NCAwIDI1Ljk5OTU5NCA0LjIwMzkzNCA0MS4yMTczNTYgOC4yODE4NyAxOC40MDU3MTIgNC45Mzc5MjMgMzcuNDY3NDE1IDEwLjAzMTg0MyA1NC4yMTcxNTMgMTAuMDMxODQzIDI3LjI4MzU3NCAwIDQ1LjAzMzI5Ni0xNC4xNzE3NzkgNDguOTM5MjM1LTM4Ljk4NTM5IDMuODc1OTM5LTcuMDMxODkgMjIuMDYxNjU1LTI0LjE3MTYyMiAzNC4zNzU0NjMtMjUuNzgxNTk4bDI1LjQ5OTYwMi0zLjMyNzk0OC03Ljk2Nzg3Ni0yNC40MzE2MTh6TTE2NC4yOTc0NzMgNjExLjc1MDQ0MWMtMTYuMDMzNzQ5LTIzLjMxMzYzNi0zNC4zOTE0NjMtNDUuODc1MjgzLTUwLjg3NTIwNS02OC44Mjg5MjQtMTUuMzU5NzYtMjEuNDA1NjY2LTc1LjMxMDgyMy0xMTguNzUwMTQ1LTEwMy4wOTQzODktMTMzLjcxNzkxMUE1MTQuNjIzOTU5IDUxNC42MjM5NTkgMCAwIDAgMC4wMDAwNCA1MTJjMCAxMjQuNjI0MDUzIDQ0LjUzMzMwNCAyMzguODEyMjY5IDExOC41MzIxNDggMzI3LjYyMjg4MSAwLjA2MTk5OSAwLjA2MTk5OSAwLjE3MTk5NyAwLjA5Mzk5OSAwLjMyNzk5NSAwLjA5Mzk5OCA0LjQ4MzkzIDAgNDYuMTg5Mjc4LTMwLjk5OTUxNiA0OS45NjkyMTktMzQuMjE3NDY1IDE2LjQyMTc0My0xMy45Mzc3ODIgMzAuMTcxNTI5LTMwLjk2NzUxNiAzNi4zMjc0MzItNTEuOTM3MTg4IDE0LjM1OTc3Ni00OC44MTEyMzctMTMuODU5NzgzLTEwMi41NjIzOTctNDAuODU5MzYxLTE0MS44MTE3ODV6IiBmaWxsPSIjQTBENDY4IiBwLWlkPSIyMzI1Ij48L3BhdGg+PC9zdmc+",
                    onclick: function() {
                        // 直接摧毁重建
                        chart.dispose();
                        API.Statistics.initMap(mapType === CHINA_MAP ? WORLD_MAP : CHINA_MAP);
                    }
                },
                restore: {}
            }
        },
        visualMap: [{
            // 连续性视觉映射，用于展示最多打卡的省份
            type: 'continuous',
            min: 0,
            max: lbsItems.length,
            text: ['常驻', '逗留'],
            calculable: true,
            inRange: {
                color: ['lightskyblue', 'yellow', 'orangered'] // 渐变颜色
            },
            seriesIndex: 1
        }],
        geo: [{
            map: mapType,
            roam: true,
            zoom: mapType === WORLD_MAP ? 1 : 1.5,
            scaleLimit: {
                min: 1
            },
            center: mapType === WORLD_MAP ? [5, 18] : [
                106.278179,
                35.46637
            ],
            label: {
                normal: {
                    show: true,
                    formatter: function(params) {
                        if (mapType === WORLD_MAP && !SHOW_NAME_ON_WORLD.NAME_TO_KEY.hasOwnProperty(params.name)) {
                            return '';
                        }
                        return params.name;
                    }
                },
                emphasis: {
                    show: true,
                    formatter: function(params) {
                        return params.name;
                    }
                },
            },
            regions: [{
                name: "南海诸岛",
                itemStyle: {
                    normal: {
                        opacity: 0
                    }
                },
                label: {
                    normal: {
                        show: false
                    },
                    emphasis: {
                        show: false
                    }
                }
            }],
            nameMap: API.Statistics.getNameMap(mapType)
        }],
        series: [{
                type: 'scatter',
                name: '打卡足迹',
                coordinateSystem: 'geo',
                geoIndex: 0,
                symbol: "path://M832.179718 379.057175c0-176.277796-143.353942-319.077106-320.18023-319.077106-176.898943 0-320.18023 142.79931-320.18023 319.077106 0 212.71159 320.18023 584.961732 320.18023 584.961732S832.179718 591.768765 832.179718 379.057175zM378.580826 379.057175c0-73.443709 59.737546-132.942825 133.418662-132.942825 73.610508 0 133.421732 59.499116 133.421732 132.942825 0 73.364915-59.811224 132.942825-133.421732 132.942825C438.318372 512 378.580826 452.42209 378.580826 379.057175z",
                symbolSize: 8,
                color: "#007bff",
                tooltip: {
                    show: true,
                    confine: true,
                    formatter: API.Statistics.formatterWayMarker
                },
                data: geoItems
            },
            {
                name: '途径省份',
                type: 'map',
                geoIndex: 0,
                color: '#eee',
                tooltip: {
                    show: true,
                    confine: true,
                    formatter: API.Statistics.formatterResidentProvince
                },
                data: residentProvinceList
            },
            {
                // 五角星亮出首都
                type: "scatter",
                coordinateSystem: "geo",
                zlevel: 2,
                rippleEffect: {
                    //涟漪特效
                    period: 4,
                    brushType: "stroke",
                    scale: 4,
                },
                label: {
                    normal: {
                        show: false,
                        position: "top",
                        color: "#0f0",
                        formatter: "{b}",
                        textStyle: {
                            color: "#0f0",
                        },
                    },
                    emphasis: {
                        show: true,
                        scale: true,
                        color: "#f60",
                    },
                },
                symbol: "path://M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3-12.3 12.7-12.1 32.9 0.6 45.3l183.7 179.1-43.4 252.9c-1.2 6.9-0.1 14.1 3.2 20.3 8.2 15.6 27.6 21.7 43.2 13.4L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z", //图片
                symbolSize: 10,
                symbolOffset: [0, "-50%"],
                color: "red",
                tooltip: {
                    show: true,
                    formatter: "大{b}，还是得去一趟"
                },
                data: [{
                    name: "首都",
                    value: [116.405285, 39.904989]
                }]
            }
        ]
    };
    chart.setOption(option);

    // 鼠标点击
    chart.on('click', function(params) {
        console.debug("鼠标点击", params);
    });

    chart.on('selectchanged', function(params) {
        console.debug("选中事件", params);
    });

    return chart;
}

$(function() {
    // 初始化中国地图
    API.Statistics.initMap(CHINA_MAP);
});