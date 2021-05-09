$(function () {
    let blogId = API.Utils.getUrlParam('blogId');

    // 获取指定ID的日志
    const blogIndex = blogs.getIndex(blogId * 1, 'blogid');
    const blog = blogs[blogIndex];

    // 渲染日志标题
    document.title = 'QQ空间备份-' + blog.custom_title;
    $("#blog_title").text(blog.custom_title);
    $("#blog_time").text(API.Utils.formatDate(blog.pubtime));

    const $blogHtml = $('<div><div>').html(API.Utils.base64ToUtf8(blog.custom_html));
    $('#blog_content').html($blogHtml.html());

    // 获取模板元素
    const comments_tpl = document.getElementById('comments_tpl').innerHTML;
    // 生成模板
    const comments_html = template(comments_tpl, { blog: blog });
    // 渲染模板到页面
    $("#comments_html").html(comments_html);

    // 查看赞
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, blogs);
    });

    // 最近访问
    $('.viewVisitors').on('click', function () {
        API.Common.showVisitorsWin(this, blogs);
    });

});