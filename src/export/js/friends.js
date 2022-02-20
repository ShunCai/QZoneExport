moment.locale('zh-CN'); // 设置默认/全局的语言环境。

/**
 * 列表方式显示
 */
API.Friends.showList = function() {
    // 群组分组
    const groupMaps = API.Utils.groupedByField(friends, 'groupName');

    // 指定排序的分组
    const newGroupMaps = new Map();

    // 虚拟特别关心
    const careFriends = friends.filter((item) => item.care === true);
    const careShowTip = careFriends.length == 1 ? "TA" : "TA们";
    newGroupMaps.set('<span title="你特别关心的' + careShowTip + '，' + careShowTip + '一定很重要、重要、重要吧"><span class="fa fa-heartbeat text-danger mr-2"></span>特别关心<span>', careFriends);
    // 虚拟无权限分组
    const notAccessFriends = friends.filter((item) => item.access === false);
    newGroupMaps.set('<span title="无权限访问TA们的空间或TA们未开通QQ空间"><span class="fa fa-lock text-danger mr-2"></span>无权访问</span>', notAccessFriends);

    // 虚拟单向好友分组
    const oneWayFriends = friends.filter((item) => item.isFriend === 2);
    newGroupMaps.set('<span title="TA们在你的QQ好友列表，你不在TA们的QQ好友列表，反正很让人心情不爽就对了"><span class="fa fa-user-times text-danger mr-2"></span>单向好友<span>', oneWayFriends);

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
 * 表格方式显示
 */
API.Friends.showTableList = function() {
    // 初始化好友表格
    API.Utils.initTable("friends-table", [{
        field: 'avatar',
        title: 'QQ头像',
        align: 'center',
        formatter: (value, row) => {
            // 用户头像地址
            value = value || API.Common.getUserLogoUrl(row.uin);
            // 头像图片HTML
            const imgDom = API.Utils.getImageHTML(API.Common.getMediaPath(value, row.custom_avatar, "Friends_HTML"));
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
            return API.Common.formatContent(value, 'HTML');
        }
    }, {
        field: 'remark',
        title: 'QQ备注',
        align: 'center',
        formatter: (value, row) => {
            return API.Common.formatContent(value || row.name, 'HTML');
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