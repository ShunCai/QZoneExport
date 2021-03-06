$(function () {
    // 查看赞
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, dataList);
    });

    // 查看评论
    $('.viewcomments').on('click', function () {
        API.Common.showCommentsWin(this, dataList);
    });

    // 最近访问
    $('.viewVisitors').on('click', function () {
        API.Common.showVisitorsWin(this, dataList);
    });

});