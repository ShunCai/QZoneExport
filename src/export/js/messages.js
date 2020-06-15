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

    // 查看赞
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, dataList);
    });

});