$(async function () {
    // 获取相册列表
    const boardList = await $.getJSON('../json/boards.json');
    // 根据时间
    const boardMaps = API.Utils.groupedByTime(boardList, 'pubtime');
    // 获取模板元素
    const boards_tpl = document.getElementById('boards_tpl').innerHTML;
    // 生成模板
    const boards_html = template(boards_tpl, { boardMaps: boardMaps, total: boardList.length });
    // 渲染模板到页面
    $("#boards_html").html(boards_html);
    // 初始化导航
    initSidebar();
});