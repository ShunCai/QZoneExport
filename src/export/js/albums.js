$(function() {
    // 查看评论
    API.Common.registerShowCommentsWin(albums);

    // 点赞列表
    API.Common.registerShowVisitorsWin(albums);

    // 最近访问
    API.Common.registerShowLikeWin(albums);

    // 初始化提示
    $('[data-toggle="tooltip"]').tooltip({
        placement: 'auto',
        container: 'body',
        boundary: 'window'
    })

});