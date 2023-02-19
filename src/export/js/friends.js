moment.locale('zh-CN'); // 设置默认/全局的语言环境。

/**
 * 列表方式显示
 */
API.Friends.showList = function() {
    // 群组分组
    const groupMaps = API.Utils.groupedByField(friends, 'groupName');

    // 特殊分组
    const newGroupMaps = API.Friends.getSpecialGroup(friends);

    // QQ分组
    for (const [groupName, groupItems] of groupMaps) {
        newGroupMaps.set(groupName, groupItems);
    }

    // 基于模板渲染列表
    const list_html = template(TPL.FRIENDS_GROUP_LIST, { friends: friends, groupMaps: newGroupMaps });

    // 渲染
    $('#friends-list').html(list_html);
}

/**
 * 获取特殊分组
 * @param {Array} friends 
 */
API.Friends.getSpecialGroup = function(friends) {

    // 指定排序的分组
    const groupMaps = new Map();

    // 特殊分组
    const groupList = QZone_Config.Friends.SpecialGroup || [];

    // 特别关心
    if (groupList.includes('care')) {
        const careItems = _.filter(friends, ['care', true]);
        const careShowTip = careItems.length == 1 ? "TA" : "TA们";
        groupMaps.set('<span title="你特别关心的' + careShowTip + '，' + careShowTip + '一定很重要、重要、重要吧"><span class="fa fa-heartbeat text-danger mr-2"></span>特别关心<span>', careItems);
    }

    // 无权限分组
    if (groupList.includes('access')) {
        const notAccessItems = _.filter(friends, ['access', false]);
        groupMaps.set('<span title="无权限访问TA们的空间或TA们未开通QQ空间"><span class="fa fa-lock text-danger mr-2"></span>无权访问</span>', notAccessItems);
    }

    // 单向好友
    if (groupList.includes('isFriend')) {
        const oneWayItems = _.filter(friends, ['isFriend', 2]);
        groupMaps.set('<span title="TA们在你的QQ好友列表，你不在TA们的QQ好友列表，反正很让人心情不爽就对了"><span class="fa fa-user-times text-danger mr-2"></span>单向好友<span>', oneWayItems);
    }

    // 已删好友
    if (groupList.includes('deleted')) {
        const deletedItems = _.filter(friends, ['deleted', true]);
        groupMaps.set('<span title="可能是你删除了，也有可能是对方删除了，基于好友增量备份识别"><span class="fa fa-trash text-danger mr-2"></span>已删好友<span>', deletedItems);
    }

    // 一年的毫秒数
    const yearTimeMillis = 31557600000;

    // 五年好友
    if (groupList.includes('5')) {
        const fiveItems = _.filter(friends, item => item.addFriendTime && Date.now() - item.addFriendTime * 1000 >= yearTimeMillis * 5);
        groupMaps.set('<span title="五年以上好友"><span class="fa fa-battery-1 mr-2"></span>五年好友<span>', fiveItems);
    }

    // 十年好友
    if (groupList.includes('10')) {
        const tenItems = _.filter(friends, item => item.addFriendTime && Date.now() - item.addFriendTime * 1000 >= yearTimeMillis * 10);
        groupMaps.set('<span title="十年以上好友，如果那两个字没有颤抖，我不会发现我难受。"><span class="fa fa-battery-3 mr-2"></span>十年老友<span>', tenItems);
    }

    // 二十年好友
    if (groupList.includes('20')) {
        const twentyItems = _.filter(friends, item => item.addFriendTime && Date.now() - item.addFriendTime * 1000 >= yearTimeMillis * 20);
        groupMaps.set('<span title="二十年以上好友，QQ24周年了，又能有多少二十年还在联系的好友呢"><span class="fa fa-battery-4 mr-2"></span>廿年旧友<span>', twentyItems);
    }

    return groupMaps;
}

/**
 * 表格方式显示
 */
API.Friends.showTableList = function() {
    // 初始化好友表格
    API.Utils.initTable("friends-table", [{
        field: 'avatar',
        title: 'QQ头像',
        align: 'center',
        formatter: (value, row) => {
            // 头像图片HTML
            const imgDom = API.Utils.getImageHTML(API.Common.getUserLogoLocalUrl(row.uin, true));
            return API.Utils.getLink(API.Common.getUserUrl(row.uin), imgDom, 'HTML');
        }
    }, {
        field: 'uin',
        title: 'QQ',
        align: 'center',
        sortable: true
    }, {
        field: 'name',
        title: 'QQ昵称',
        align: 'center',
        formatter: (value, row) => {
            return API.Common.formatContent(value, "HTML", false, false, false, false, true);
        }
    }, {
        field: 'remark',
        title: 'QQ备注',
        align: 'center',
        formatter: (value, row) => {
            return API.Common.formatContent(value || row.name, "HTML", false, false, false, false, true);
        }
    }, {
        field: 'groupName',
        title: 'QQ分组',
        align: 'center',
        sortable: true
    }, {
        field: 'message',
        title: 'QQ通讯',
        align: 'center',
        formatter: (value, row) => {
            return API.Friends.getShowMessage(row);
        }
    }, {
        field: 'care',
        title: '特别关心',
        align: 'center',
        formatter: (value, row) => {
            return API.Friends.getShowCare(row, 'HTML');
        }
    }, {
        field: 'access',
        title: '访问权限',
        align: 'center',
        formatter: (value, row) => {
            return API.Friends.getShowAccessType(row, 'HTML');
        }
    }, {
        field: 'isFriend',
        title: '好友关系',
        align: 'center',
        formatter: (value, row) => {
            return API.Friends.getShowFriendType(row, 'HTML');
        }
    }, {
        field: 'addFriendTime',
        title: '相识时间',
        align: 'center',
        sortable: true,
        formatter: (value, row) => {
            return API.Friends.getShowFriendTime(row, 0);
        }
    }, {
        field: 'intimacyScore',
        title: '亲密度',
        align: 'center',
        sortable: true,
        formatter: (value, row) => {
            return API.Friends.getShowIntimacyScore(row);
        }
    }, {
        field: 'common.friend',
        title: '共同好友',
        align: 'center',
        sortable: true,
        formatter: (value, row) => {
            return API.Friends.getShowCommonFriend(row);
        }
    }, {
        field: 'common.group',
        title: '共同群组',
        align: 'center',
        sortable: true,
        formatter: (value, row) => {
            return API.Friends.getShowCommonGroup(row, '，');
        }
    }], friends);
}

$(function() {

    // 显示日志列表
    switch (QZone_Config.Friends.showType) {
        case '0':
            // 表格方式展示
            API.Friends.showTableList();
            break;
        default:
            // HTML方式展示
            API.Friends.showList();
            break;
    }
});