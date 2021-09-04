/**
 * QQ空间数据统计信息
 * @author https://lvshuncai.com
 */
"use strict";


API.Statistics = {};

const messages = [];
// 坐标清单
const lbsList = [];
// 处理特殊坐标数据，避免地图跳转错误
API.Messages.dealLbs(messages);
for (const item of messages) {
    const lbs = item.lbs;
    if (!lbs || !lbs.pos_x || !lbs.pos_y) {
        continue;
    }
    lbsList.push(lbs);
}
console.info(lbsList);