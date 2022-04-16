$(function() {

    // 是否需要生成那年今日
    if (QZone_Config.Shares.hasThatYearToday) {

        // 那年今日
        const _yearMaps = API.Common.getOldYearData(shares, "shareTime");

        // 那年今日HTML
        const items_html = template(TPL.SHARES_YEAR_ITEMS, { yearMaps: _yearMaps });
        $('#shares_html').prepend(items_html);
    }

    // 重新渲染左侧目录
    initSidebar();

    // 图片懒加载
    lazyload();


    // 点击图片查看时，实例化画廊相册
    $('.lightgallery .message-lightbox').on('click', function() {

        // 画廊相册DOM
        const $galleryDom = $(this).parent().get(0);
        // 点击的图片的索引位置
        const imgIdx = $(this).attr('data-idx');
        if ($galleryDom.galleryIns) {
            $galleryDom.galleryIns.openGallery(imgIdx * 1);
            return;
        }

        // 注册监听
        $galleryDom.moduleName = 'Shares';
        API.Common.registerEvents($galleryDom);

        // 实例化画廊相册
        const galleryIns = lightGallery($galleryDom, {
            plugins: [
                lgZoom,
                lgAutoplay,
                lgComment,
                lgFullscreen,
                lgRotate,
                lgThumbnail,
                lgVideo
            ],
            mode: 'lg-fade',
            selector: '.message-lightbox',
            download: false,
            thumbnail: false,
            mousewheel: true,
            commentBox: true,
            loop: false,
            autoplayVideoOnSlide: false,
            commentsMarkup: '<div id="lg-comment-box" class="lg-comment-box lg-fb-comment-box"><div class="lg-comment-header"><h3 class="lg-comment-title">评论</h3><span class="lg-comment-close lg-icon"></span></div><div class="lg-comment-body"></div></div>'
        });

        $galleryDom.galleryIns = galleryIns;

        // 打开画廊
        galleryIns.openGallery(imgIdx * 1);
    })

    // 查看评论中的图片
    $('.comment-lightgallery .comment-img-lightbox').on('click', function() {
        // 画廊相册DOM
        const $galleryDom = $(this).parent().parent().get(0);
        // 点击的图片的索引位置
        const imgIdx = $(this).attr('data-idx');

        if ($galleryDom.galleryIns) {
            $galleryDom.galleryIns.openGallery(imgIdx * 1);
            return;
        }

        // 实例化画廊相册
        const galleryIns = lightGallery($galleryDom, {
            plugins: [
                lgZoom,
                lgFullscreen,
                lgThumbnail,
                lgRotate
            ],
            mode: 'lg-fade',
            selector: '.comment-img-lightbox',
            download: false,
            thumbnail: false,
            loop: false
        });
        $galleryDom.galleryIns = galleryIns;

        // 打开画廊
        galleryIns.openGallery(imgIdx * 1);
    })

    // 点赞列表
    API.Common.registerShowVisitorsWin(shares);

    // 最近访问
    API.Common.registerShowLikeWin(shares);

    // 取消懒加载样式
    API.Common.registerImageLoadedEvent();

});