$(function () {
    // 初始化好友表格
    API.Utils.initTable("friends-table", [{
        checkbox: true,
        clickToSelect: true,
        width: "50"
    }, {
        field: 'uin',
        title: 'QQ号',
        align: 'center',
        sortable: true,
        formatter: (value) => {
            return API.Common.getUserLink(value, value);
        }
    }, {
        field: 'name',
        title: '昵称',
        align: 'center',
        sortable: true,
        formatter: (value) => {
            return API.Common.formatContent(value, 'HTML');
        }
    }, {
        field: 'remark',
        title: '备注',
        align: 'center'
    }, {
        field: 'groupName',
        title: '分组',
        align: 'center',
        sortable: true
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
        align: 'center',
        sortable: true
    }], dataList);
});