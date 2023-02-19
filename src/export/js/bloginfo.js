$(function() {
    let blogId = API.Utils.getUrlParam('blogId');

    // 获取指定ID的日志
    const blogIndex = blogs.getIndex(blogId * 1, 'blogid');
    const blog = blogs[blogIndex];

    // 渲染日志标题
    document.title = 'QQ空间备份-' + blog.custom_title;
    $("#blog_title").text(blog.custom_title);
    $("#blog_time").text(API.Utils.formatDate(blog.lastModifyTime ||  blog.pubtime));

    const $blogHtml = $('<div><div>').html(API.Utils.base64ToUtf8(blog.custom_html));
    $('#blog_content').html($blogHtml.html());

    // 获取模板元素
    const comments_tpl = document.getElementById('comments_tpl').innerHTML;
    // 生成模板
    const comments_html = template(comments_tpl, { blog: blog });
    // 渲染模板到页面
    $("#comments_html").html(comments_html);

    // 日志中的图片
    $('#blog_content img').on('click', function() {
        // 画廊相册DOM
        const $galleryDom = $('#blog_content').get(0);
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
            thumbnail: true,
            loop: false
        });
        $galleryDom.galleryIns = galleryIns;

        // 打开画廊
        galleryIns.openGallery(imgIdx * 1);
    })

    // 点赞列表
    API.Common.registerShowVisitorsWin(blogs);

    // 最近访问
    API.Common.registerShowLikeWin(blogs);


});