$(async function () {
    // 获取用户信息
    const userInfo = await $.getJSON('../json/user.json');
    // 获取收藏列表
    const favorites = await $.getJSON('../json/favorites.json');
    // 根据时间
    const favoritesMaps = API.Utils.groupedByTime(favorites, 'create_time');
    // 获取模板元素
    const favorites_tpl = document.getElementById('favorites_tpl').innerHTML;
    // 生成模板
    const favorites_html = template(favorites_tpl, { user: userInfo, favoritesMaps: favoritesMaps, total: favorites.length });
    // 渲染模板到页面
    $("#favorites_html").html(favorites_html);
    // 初始化导航
    initSidebar();
});