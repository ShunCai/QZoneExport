$(async function () {
    // 获取视频列表
    const videoList = await $.getJSON('../json/videos.json');
    // 获取模板元素
    const videos_tpl = document.getElementById('videos_tpl').innerHTML;
    // 生成模板
    const videos_html = template(videos_tpl, { videos: videoList || [] });
    // 渲染模板到页面
    $("#lightgallery").html(videos_html);
    // 渲染画廊
    $("#lightgallery").lightGallery({
        selector: '.lightbox',
        share: false,
        loop: false,
        download: false
    });
});