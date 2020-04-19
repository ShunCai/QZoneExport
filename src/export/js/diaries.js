$(async function () {
    // 获取日志列表
    const diariesList = await $.getJSON('../json/diaries.json');

    // 初始化私密日志表格
    readerTable("diaries-table", [{
        checkbox: true,
        clickToSelect: true,
        width: "50"
    }, {
        field: 'title',
        title: '标题',
        align: 'left',
        width: "60",
        widthUnit: "%",
        formatter: (value, row, index, field) => {
            return '<a target="_blank" href="blog_info.html?blogId={0}&type=private">{1}</a> '.format(row.blogid, value);
        }
    }, {
        field: 'pubtime',
        title: '发布时间',
        align: 'center',
        width: "150",
        formatter: (value) => {
            return API.Utils.formatDate(value);
        }
    }], diariesList);
});