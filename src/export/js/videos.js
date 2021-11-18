$(function() {

    // 指定年份的页面
    const isYearPage = yearItems !== '<%:=JSON.stringify(videos)%>';
    if (isYearPage) {
        videos = JSON.parse(yearItems);
    }

    // 获取模板元素
    const videos_tpl = document.getElementById('videos_tpl').innerHTML;
    // 生成模板
    const videos_html = template(videos_tpl, { videos: videos || [] });
    // 渲染模板到页面
    $("#lightgallery").html(videos_html);

    // 图片懒加载
    lazyload();

    // 相册画廊
    const $gallery = document.getElementById('lightgallery');
    $gallery.moduleName = 'Videos';

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
        autoplayVideoOnSlide: true,
        commentsMarkup: '<div id="lg-comment-box" class="lg-comment-box lg-fb-comment-box"><div class="lg-comment-header"><h3 class="lg-comment-title">评论</h3><span class="lg-comment-close lg-icon"></span></div><div class="lg-comment-body"></div></div>'
    });
    $gallery.galleryIns = galleryIns;

    // 查看赞
    $('.viewlikes').on('click', function() {
        API.Common.showLikeWin(this, videos);
    });

    // 查看评论
    $('.viewcomments').on('click', function() {
        API.Common.showCommentsWin(this, videos);
    });

    // 取消懒加载样式
    API.Common.registerImageLoadedEvent();

});