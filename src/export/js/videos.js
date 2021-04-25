$(function () {
    // 获取视频列表
    // 获取模板元素
    const videos_tpl = document.getElementById('videos_tpl').innerHTML;
    // 生成模板
    const videos_html = template(videos_tpl, { videos: dataList || [] });
    // 渲染模板到页面
    $("#lightgallery").html(videos_html);

    // 图片懒加载
    lazyload();

    // 渲染画廊
    $("#lightgallery").lightGallery({
        selector: '.lightbox',
        share: false,
        loop: false,
        download: false
    });
    
    // 查看赞
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, dataList);
    });

    // 查看评论
    $('.viewcomments').on('click', function () {
        API.Common.showCommentsWin(this, dataList);
    });
});