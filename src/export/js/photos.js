$(function() {

    // 获取相册ID
    albumId = albumId !== '<%:=(albumId)%>' ? albumId : API.Utils.getUrlParam('albumId');
    // 获取指定相册数据
    const albumIndex = albums.getIndex(albumId, 'id');
    window.album = albums[albumIndex];

    // 渲染导航相册名称
    $(".breadcrumb-item.active").text(album.name);

    // 非静态页面，需要生成相片列表，静态页面默认生成
    // 获取模板元素
    const photos_tpl = document.getElementById('photos_tpl').innerHTML;
    // 生成模板
    const photos_html = template(photos_tpl, { album: album || {} });
    // 渲染模板到页面
    $("#lightgallery").html(photos_html);

    // 图片懒加载
    lazyload();


    // 相册画廊
    const $gallery = document.getElementById('lightgallery');
    $gallery.moduleName = 'Albums';

    // 注册监听
    API.Common.registerEvents($gallery);

    // 实例化画廊相册
    const galleryIns = lightGallery($gallery, {
        plugins: [
            lgZoom,
            lgAutoplay,
            lgComment,
            lgFullscreen,
            lgHash,
            lgRotate,
            lgThumbnail,
            lgVideo
        ],
        mode: 'lg-fade',
        selector: '.lightbox',
        download: false,
        mousewheel: true,
        thumbnail: true,
        commentBox: true,
        loop: false,
        autoplayVideoOnSlide: false,
        commentsMarkup: '<div id="lg-comment-box" class="lg-comment-box lg-fb-comment-box"><div class="lg-comment-header"><h3 class="lg-comment-title">评论</h3><span class="lg-comment-close lg-icon"></span></div><div class="lg-comment-body"></div></div>'
    });

    $gallery.galleryIns = galleryIns;

    // 查看赞
    $('.viewlikes').on('click', function() {
        API.Common.showLikeWin(this, album.photoList);
    });

    // 查看评论
    $('.viewcomments').on('click', function() {
        API.Common.showCommentsWin(this, album.photoList);
    });

    // 取消懒加载样式
    API.Common.registerImageLoadedEvent();

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip({
        placement: 'auto',
        container: 'body',
        boundary: 'window'
    })

});