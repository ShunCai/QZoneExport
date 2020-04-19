$(async function () {
    // 获取日志列表
    const blogList = await $.getJSON('../json/blogs.json');

    // 初始化日志表格
    readerTable("blogs-table", [{
        checkbox: true,
        clickToSelect: true,
        width: "50"
    }, {
        field: 'title',
        title: '标题',
        align: 'left',
        width: "60",
        widthUnit: "%",
        formatter: (value, row) => {
            return '<a target="_blank" href="blog_info.html?blogId={0}" >{1}</a> '.format(row.blogid, value);
        }
    }, {
        field: 'category',
        title: '类别',
        align: 'center',
        width: "150",
    }, {
        field: 'rt_uin',
        title: '类型',
        align: 'center',
        width: "50",
        formatter: (value, row, index, field) => {
            return API.Blogs.getBlogLabel(row) || '原创';
        }
    }, {
        field: 'pubtime',
        title: '发布时间',
        align: 'center',
        width: "150",
        formatter: (value) => {
            return API.Utils.formatDate(value);
        }
    }], blogList);
});