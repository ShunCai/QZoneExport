$(function () {
    let blogId = API.Utils.getUrlParam('blogId');
    
    // 获取指定ID的日志
    const blogIndex = dataList.getIndex(blogId * 1, 'blogid');
    const blog = dataList[blogIndex];

    // 渲染日志标题
    document.title = 'QQ空间备份-' + blog.custom_title;
    $("#blog_title").text(blog.custom_title);
    $("#blog_time").text(API.Utils.formatDate(blog.pubtime));

    const $blogHtml = $('<div><div>').html(API.Utils.base64ToUtf8(blog.custom_html));
    $('#blog_content').html($blogHtml.html());
});