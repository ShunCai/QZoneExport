$(function() {
    // 获取视频列表
    // 获取模板元素
    const videos_tpl = document.getElementById('videos_tpl').innerHTML;
    // 生成模板
    const videos_html = template(videos_tpl, { videos: videos || [] });
    // 渲染模板到页面
    $("#lightgallery").html(videos_html);

    // 图片懒加载
    lazyload();

    // 渲染画廊
    const gallery = $("#lightgallery").lightGallery({
        selector: '.lightbox',
        share: false,
        loop: true,
        download: false
    });

    // 自动加载画廊预览图
    API.Common.autoLoadPreview(gallery);

    // 查看赞
    $('.viewlikes').on('click', function() {
        API.Common.showLikeWin(this, videos);
    });

    // 查看评论
    $('.viewcomments').on('click', function() {
        API.Common.showCommentsWin(this, videos);
    });
});