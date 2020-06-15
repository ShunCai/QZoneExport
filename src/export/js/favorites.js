$(function () {
    // 图片懒加载
    lazyload();
    
    // 渲染画廊
    $(".lightgallery").lightGallery({
        selector: '.message-lightbox',
        share: false,
        loop: false,
        download: false
    });
});