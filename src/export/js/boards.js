$(function() {

    // 是否需要生成那年今日
    if (QZone_Config.Boards.hasThatYearToday) {
        // 那年今日
        const _yearMaps = API.Common.getOldYearData(boardInfo.items, "pubtime");

        // 那年今日HTML
        const items_html = template(TPL.BOARDS_YEAR_ITEMS, { yearMaps: _yearMaps });
        $('.boards-items').before(items_html);
    }

    // 重新渲染左侧目录
    initSidebar();

    // 图片懒加载
    lazyload();

    // 日志中的图片
    $('.messageText img').on('click', function() {
        // 画廊相册DOM
        const $galleryDom = $(this).parents('.messageText').get(0);
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
            selector: '.lightgallery',
            download: false,
            thumbnail: false,
            loop: false
        });
        $galleryDom.galleryIns = galleryIns;

        // 打开画廊
        galleryIns.openGallery(imgIdx * 1);
    })

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip();

});