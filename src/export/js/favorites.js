$(function() {
    // 图片懒加载
    lazyload();

    // 点击图片查看时，实例化画廊相册
    $('.lightgallery .message-lightbox img').on('click', function() {

        // 画廊相册DOM
        const $galleryDom = $(this).parent().parent().get(0);
        // 点击的图片的索引位置
        const imgIdx = $(this).attr('data-idx');
        if ($galleryDom.galleryIns) {
            $galleryDom.galleryIns.openGallery(imgIdx * 1);
            return;
        }

        // 注册监听
        $galleryDom.moduleName = 'Favorites';
        API.Common.registerEvents($galleryDom);

        // 实例化画廊相册
        const galleryIns = lightGallery($galleryDom, {
            plugins: [
                lgZoom,
                lgAutoplay,
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
            loop: false,
            autoplayVideoOnSlide: false
        });

        $galleryDom.galleryIns = galleryIns;

        // 打开画廊
        galleryIns.openGallery(imgIdx * 1);
    })

    // 取消懒加载样式
    API.Common.registerImageLoadedEvent();

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip();
});