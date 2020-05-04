$(function () {
    // 获取相册ID
    const albumId = API.Utils.getUrlParam('albumId');
    // 获取指定相册数据
    const albumIndex = dataList.getIndex(albumId, 'id');
    const album = dataList[albumIndex];
    // 渲染导航相册名称
    $(".breadcrumb-item.active").text(album.name);
    // 获取模板元素
    const photos_tpl = document.getElementById('photos_tpl').innerHTML;
    // 生成模板
    const photos_html = template(photos_tpl, { photos: album.photoList || [] });
    // 渲染模板到页面
    $("#lightgallery").html(photos_html);
    // 渲染画廊
    $("#lightgallery").lightGallery({
        selector: '.lightbox',
        share: false,
        loop: false,
        download: false
    });
});