/**
 * 单条分享的HTML模板
 */
const ITEM_TPL = `
<div class="card w-70 mt-3 border">
    <div class="card-body">
        <div class="p-1 comments">
            <div class="container comment  m-1 p-0">
                <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(share.uin)%>">
                    <img class="w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(share.uin)%>">
                </a>
                <div class="ml-4">
                    <div class="messageText ml-4 container m-2">
                        <%/* 分享描述 */%>
                        <p><a target="_blank" href="<%:=API.Common.getUserUrl(share.uin)%>"><%:=API.Common.formatContent(share.nickname)%></a> <span class="text-secondary">分享<span class="border-warning border rounded text-warning small p-1"><%:=API.Shares.getDisplayType(share.type)%></span>：</span><%:=API.Common.formatContent(share.desc, "HTML", false, false)%></p>
                        <%/* 分享源标题 */%>
                        <%if(share.source && share.source.title){%>
                            <p>《<a target="_blank" href="<%:=share.source.url%>"><%:=share.source.title%></a>》</p>
                        <%}%>
                        <%/* 分享源描述 */%>
                        <%if(share.source && share.source.desc){%>
                            <p><%:=API.Common.formatContent(share.source.desc, "HTML", false, false)%></p>
                        <%}%>
                        <%/* 分享内容 */%>
                        <%/* 多媒体内容 */%>
                        <div class="medias row p-3 lightgallery <%:=API.Common.getImgClassType(share,true)%>">
                            <%/*  分享源图片 */%>
                            <%if(share.source.images){%>
                                <%for(let image of share.source.images){%>
                                    <a class="medias-item border message-lightbox" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                        <img class="lazyload w-100 h-100" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                    </a>
                                <%}%>
                            <%}%>
                        </div>
                        <%/* 分享评论 */%>
                        <%if(share.comments && share.comments.length > 0){%>
                            <%/* 遍历评论 */%>
                            <%for(let comment of share.comments){%>
                                <div class="p-1 border-top comments mt-3">
                                    <div class="container comment  m-1 p-0">
                                        <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(comment.poster.id)%>">
                                            <img class="lazyload w-100 h-100 border rounded-circle" data-src="<%:=API.Common.getUserLogoUrl(comment.poster.id)%>" >
                                        </a>
                                        <div class="ml-4">
                                            <%/* 评论 */%>
                                            <div class="container ml-4">
                                                <a class="author">
                                                    <a target="_blank" href="<%:=API.Common.getUserUrl(comment.poster.id)%>">
                                                        <span><%:=API.Common.formatContent(comment.poster.name)%></span>
                                                    </a>
                                                    <%if(comment.private){%>
                                                        <span class="text-info"> 私密评论 </span>
                                                    <%}%>
                                                    <br>
                                                    <span class="text-muted small"><%:=API.Utils.formatDate(comment.postTime)%></span>
                                                </a>
                                            </div>
                                            <div class="messageText ml-4 container m-1">
                                                <%/* 评论内容 */%>
                                                <p><%:=API.Common.formatContent(comment.content)%></p>
                                                <%/* 评论图片 */%>
                                                <%if(comment.pic){%>
                                                    <%for(let image of comment.pic){%>
                                                        <img src="<%:=(image.custom_filepath || image.custom_url)%>" class="comment-img img-thumbnail">
                                                    <%}%>
                                                <%}%>
                                            </div>
                                            <%/* 评论回复 */%>
                                            <%if(comment.replies){%>
                                                <%for(let reply of comment.replies){%>
                                                    <div class="comments m-1">
                                                        <div class="container comment  m-3 p-0">
                                                            <a class="me-a avatar p-0 m-0 " target="_blank" href="<%:=API.Common.getUserUrl(reply.poster.id)%>">
                                                                <img class="lazyload w-100 h-100 border rounded-circle" data-src="<%:=API.Common.getUserLogoUrl(reply.poster.id)%>">
                                                            </a>
                                                            <div class=" ml-4  ">
                                                                <div class="container ml-4">
                                                                    <a class="author">
                                                                        <a target="_blank" href="<%:=API.Common.getUserUrl(reply.poster.id)%>">
                                                                            <span class="text-info"><%:=API.Common.formatContent(reply.poster.name)%></span>
                                                                        </a>
                                                                        <%if(reply.private){%>
                                                                            <span class="text-info"> 私密回复 </span>
                                                                        <%}%>
                                                                        <br>
                                                                        <span class="text-muted small"><%:=API.Utils.formatDate(reply.postTime)%></span>
                                                                    </a>
                                                                </div>
                                                                <div class="messageText ml-4 container m-1">
                                                                    <%/* 回复内容 */%>
                                                                    <p><%:=API.Common.formatContent(reply.content)%></p>
                                                                    <%/* 回复图片 */%>
                                                                    <%if(reply.pic){%>
                                                                        <%for(let image of reply.pic){%>
                                                                            <img src="<%:=(image.custom_filepath || image.custom_url)%>" class="comment-img img-thumbnail">
                                                                        <%}%>
                                                                    <%}%>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                <%}%>
                                            <%}%>
                                        </div>
                                    </div>
                                </div>
                            <%}%>
                        <%}%>
                    </div>
                    <%/* 分享源来源 */%>
                    <%if(share.source && share.source.from){%>
                        <ul class="list-group list-group-flush ml-3">
                            <li class="list-group-item">
                                <span class="text-secondary">来自<a target="_blank" href="<%:=share.source.from.url%>"><%:=share.source.from.name%></a> 共分享<%:=share.source.count%>次</span>
                            </li>
                        </ul>
                    <%}%>
                </div>
            </div>
        </div>
    </div>
    <div class="card-footer text-muted">
        <%:=API.Utils.formatDate(share.shareTime)%>
        <span class="text-primary p-1 float-right fa fa-thumbs-up mr-2 cursor viewlikes" title="点赞列表" data-field="id" data-target="<%:=share.id%>"><%:=share.likeTotal || 0 %></span>
        <span class="text-primary p-1 float-right fa fa-eye mr-2 cursor viewVisitors" title="最近访问" data-field="id" data-target="<%:=share.id%>"><%:=share.custom_visitor && share.custom_visitor.viewCount || 0 %></span>
    </div>
</div>
`;

/**
 * 那年今日的分享模板
 */
const YEAR_ITEMS = `
    <%if (yearMaps && yearMaps.size > 0) {%>
        <h3 class="sidebar-h1" data-tag="h1" data-sidebar="那年今日">那年今日</h3>
        <%for (const [year, yearItems] of yearMaps) {%>
            <%if (yearItems && yearItems.length > 0) {%>
                <span class="sidebar-h2" data-tag="h2" data-sidebar="<%:=year%>年"></span>
                <%for (const share of yearItems) {%>
                    `+ ITEM_TPL + `
                <%}%>  
            <%}%>       
        <%}%>
        <hr>
    <%}%>        
`;

$(function () {

    // 那年今日
    const _yearMaps = API.Common.getOldYearData(dataList, "shareTime");

    // 那年今日HTML
    const items_html = template(YEAR_ITEMS, { yearMaps: _yearMaps });
    $('#shares_html').prepend(items_html);

    // 重新渲染左侧目录
    initSidebar();

    // 图片懒加载
    lazyload();

    // 渲染画廊
    $(".lightgallery").lightGallery({
        selector: '.message-lightbox',
        share: false,
        loop: false,
        download: false
    });

    // 点赞列表
    $('.viewlikes').on('click', function () {
        API.Common.showLikeWin(this, dataList);
    });

    // 最近访问
    $('.viewVisitors').on('click', function () {
        API.Common.showVisitorsWin(this, dataList);
    });

});