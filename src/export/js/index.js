$(async function () {
    // 获取相册列表
    const userInfo = await $.getJSON('../json/user.json');
    // 渲染标题
    document.title = 'QQ空间备份-' + userInfo.spacename;
    // 获取模板元素
    const index_tpl = document.getElementById('index_tpl').innerHTML;
    // 生成模板
    const index_html = template(index_tpl, { user: userInfo });
    // 渲染模板到页面
    $("#index_html").html(index_html);
});