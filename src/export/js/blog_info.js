$(async function () {
    // 获取类型
    const type = API.Utils.getUrlParam('type');
    // 获取日志列表
    let blogList = [];
    if ('private' === type) {
        blogList = await $.getJSON('../json/diaries.json');
    } else {
        blogList = await $.getJSON('../json/blogs.json');
    }
    // 获取指定ID的日志
    const blogId = API.Utils.getUrlParam('blogId') * 1;
    const blogIndex = blogList.getIndex(blogId, 'blogid');
    const blog = blogList[blogIndex];

    // 渲染日志标题
    const title = '《' + blog.title + '》';
    document.title = 'QQ空间备份-《' + blog.title + '》';
    $("#blog_title").text(title);
    $(".breadcrumb-item.active").text(title);
    $("#blog_time").text(API.Utils.formatDate(blog.pubtime));

    const blogHtml = API.Utils.base64ToUtf8(blog.html);
    const $blogHtml = $('<div><div>').html(blogHtml);
    $blogHtml.find("embed").each(function () {
        const $embed = $(this);
        let mp4_url = $embed.attr('data-mp4');
        const data_type = $embed.attr('data-type');
        if (data_type == 51) {
            mp4_url = 'https://v.qq.com/txp/iframe/player.html?autoplay=true&vid=' + $embed.attr('data-vid');
        } else {
            mp4_url = 'https://h5.qzone.qq.com/video/index?vid=' + $embed.attr('data-vid');
        }
        $embed.replaceWith('<iframe src="' + mp4_url + '" height="' + $embed.attr('height') + '" width="' + $embed.attr('width') + '" allowfullscreen="true"></iframe>');
    });
    $('#blog_content').html($blogHtml.html());
});