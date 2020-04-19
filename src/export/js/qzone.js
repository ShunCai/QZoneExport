// 初始化日志表格
const readerTable = (tableId, columns, data, options) => {
    let tableOptions = {
        undefinedText: '',
        toggle: tableId,
        locale: 'zh-CN',
        height: "700",
        search: true,
        searchAlign: 'right',
        showButtonText: true,
        pagination: true,
        pageList: "[10, 20, 50, 100, 200, 500, All]",
        paginationHAlign: 'left',
        clickToSelect: true,
        paginationDetailHAlign: 'right',
        theadClasses: 'thead-light',
        showSearchButton: true,
        toolbar: "#" + tableId + "-toolbar",
        toolbarAlign: "left",
        columns: columns || [],
        data: data || []
    };
    Object.assign(tableOptions, options);
    $("#" + tableId).bootstrapTable('destroy').bootstrapTable(tableOptions);
    $("#" + tableId).bootstrapTable('resetView')
}