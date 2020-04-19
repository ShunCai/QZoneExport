$(async function () {
    // 获取相册列表
    const albumsList = await $.getJSON('../json/albums.json');
    // 根据分类分组
    const albumnsMap = API.Utils.groupedByField(albumsList, 'className');
    // 获取模板元素
    const albums_tpl = document.getElementById('albums_tpl').innerHTML;
    // 生成模板
    const albumns_html = template(albums_tpl, { albumsMapping: albumnsMap });
    // 渲染模板到页面
    $("#albums_html").html(albumns_html);
    // 初始化导航
    initSidebar();
});