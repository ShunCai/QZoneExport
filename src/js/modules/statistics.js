/**
 * QQ空间数据统计分析信息
 * @author https://lvshuncai.com
 */
"use strict";

/**
 * 获取空间数据所有的坐标信息
 */
API.Statistics.getAllLbs = () => {
    // 所有的坐标信息
    const lbsItems = [];

    // 获取所有说说的坐标
    const messageLbs = API.Messages.getAllLbs(messages);
    console.log("所有说说坐标信息：", messageLbs);
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
        const lbs = item.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        const newLbs = Object.assign({}, lbs);
        newLbs.module = 'Messages';
        newLbs.source = item;
        allLbs.push(newLbs);
    }
    return allLbs;
}



$(function() {

    const chart = echarts.init(document.getElementById('main'));

    const data = API.Statistics.getAllLbs();

    const toData = function(items) {
        const res = [];
        for (const item of items) {
            res.push({
                name: item.name || item.idname,
                value: [item.pos_x, item.pos_y]
            });
        }
        return res;
    }

    const option = {
        title: {
            text: 'QQ空间 - 我的打卡足迹',
            link: 'https://qzone.qq.com',
            subtext: '基于QQ空间导出助手',
            sublink: 'https://github.com/ShunCai/QZoneExport',
            left: 'center'
        },
        tooltip: {
            trigger: 'item'
        },
        geo: [{
            map: 'china',
            roam: true,
            center: [115.97, 29.71],
            label: {
                show: true
            },
            nameMap: {
                '澳门特别行政区': '澳门',
                '香港特别行政区': '香港'
            }
        }],
        series: [{
                type: 'scatter',
                name: '我的足迹',
                coordinateSystem: 'geo',
                geoIndex: 0,
                data: toData(data)
            }, {
                type: 'effectScatter',
                name: '常驻城市',
                coordinateSystem: 'geo',
                geoIndex: 0,
                data: []
            },
            {
                // 省会  红色五角星
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
                        show: true,
                        position: "top",
                        color: "#0f0",
                        formatter: "{b}",
                        textStyle: {
                            color: "#0f0",
                        },
                    },
                    emphasis: {
                        show: true,
                        color: "#f60",
                    },
                },
                symbol: "image://http://going-global.oss-cn-beijing.aliyuncs.com/20201026/dff56578f2ba465cb967b2124dd17f62.png", //图片
                symbolSize: 20, //图元的大小。
                symbolOffset: [0, "-50%"],
                color: "#000",
                data: [{
                    name: '广州市',
                    value: [113.280637, 23.125178]
                }],
            }
        ]
    };
    chart.setOption(option);
    chart.on('click', function(params) {
        console.info(params);
    });

});