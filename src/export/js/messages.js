$(async function () {
    // 获取相册列表
    const messageList = await $.getJSON('../json/messages.json');
    // 根据时间
    const messageMaps = API.Utils.groupedByTime(messageList, 'created_time');
    // 获取模板元素
    const messages_tpl = document.getElementById('messages_tpl').innerHTML;
    // 生成模板
    const messages_html = template(messages_tpl, { messageMaps: messageMaps, total: messageList.length });
    // 渲染模板到页面
    $("#messages_html").html(messages_html);
    // 初始化导航
    initSidebar();
});