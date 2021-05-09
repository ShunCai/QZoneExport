$(function () {
    // 查看赞
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, albums);
    });

    // 查看评论
    $('.viewcomments').on('click', function () {
        API.Common.showCommentsWin(this, albums);
    });

    // 最近访问
    $('.viewVisitors').on('click', function () {
        API.Common.showVisitorsWin(this, albums);
    });

});