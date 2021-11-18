$(function () {
    // 初始化日志表格
    API.Utils.initTable("diaries-table", [{
        checkbox: true,
        clickToSelect: true,
        width: "50"
    }, {
        field: 'title',
        title: '标题',
        align: 'left',
        width: "30",
        widthUnit: "%",
        sortable: true,
        formatter: (value, row) => {
            return '<a href="info.html?blogId={0}" >{1}</a> '.format(row.blogid, value);
        }
    }, {
        field: 'category',
        title: '类别',
        align: 'center',
        width: "150",
        sortable: true
    }, {
        field: 'rt_uin',
        title: '类型',
        align: 'center',
        width: "50",
        sortable: true,
        formatter: (value, row, index, field) => {
            return API.Blogs.getBlogLabel(row) || '原创';
        }
    }, {
        field: 'pubtime',
        title: '发布时间',
        align: 'center',
        width: "150",
        sortable: true,
        formatter: (value) => {
            return API.Utils.formatDate(value);
        }
    }, {
        field: 'replynum',
        title: '评论数',
        align: 'center',
        width: "20",
        sortable: true
    }, {
        field: 'custom_visitor.viewCount',
        title: '阅读数',
        align: 'center',
        width: "20",
        sortable: true
    }], diaries);

});