$(async function () {
    // 获取好友列表
    const friendList = await $.getJSON('../json/friends.json');

    // 初始化好友表格
    readerTable("friends-table", [{
        checkbox: true,
        clickToSelect: true,
        width: "50"
    }, {
        field: 'uin',
        title: 'QQ号',
        align: 'center',
        formatter: (value) => {
            return API.Common.getUserLink(value, value);
        }
    }, {
        field: 'name',
        title: '昵称',
        align: 'center'
    }, {
        field: 'remark',
        title: '备注',
        align: 'center'
    }, {
        field: 'groupName',
        title: '分组',
        align: 'center'
    }, {
        field: 'message',
        title: '通讯',
        align: 'center',
        formatter: (value, row) => {
            return API.Common.getMessageLink(row.uin, 'QQ聊天');
        }
    }, {
        field: 'addFriendTime',
        title: '相识',
        align: 'center'
    }], friendList);
});