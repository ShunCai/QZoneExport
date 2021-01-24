/**
 * 单条说说的HTML模板
 */
const ITEM_TPL = `
<div class="card w-70 mt-3 border">
    <div class="card-body">
        <div class="p-1 comments">
            <div class="container comment  m-1 p-0">
                <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(message.uin)%>">
                    <img class="w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(message.uin)%>">
                </a>
                <div class="ml-4">
                    <div class="messageText ml-4 container m-2">
                        <%/* 说说内容 */%>
                        <%/* 说说全文 */%>
                        <%if(message.has_more_con){%>
                            <details>
                                <summary>查看全文</summary>
                                <div class="container">
                                    <%:=API.Common.formatContent(message, "HTML", false, false)%>
                                </div>
                            </details>
                        <%}else{%>
                            <pre class="card-text content"><%:=API.Common.formatContent(message, "HTML", false, false)%></pre>
                        <%}%>
                        <%/* 语音内容 */%>
                        <%if(message.custom_voices){%>
                            <%for (const voice of message.custom_voices) {%>
                                <audio controls src="<%:=(voice.custom_filepath || voice.custom_url)%>"></audio>
                            <%}%>
                        <%}%>
                        <%/* 转发内容 */%>
                        <%if(message.rt_tid){%>
                            <hr>
                            <a class="float-left" target="_blank" href="<%:=API.Common.getUserUrl(message.rt_uin)%>">
                                <span class="text-info"><%:=API.Common.formatContent(message.rt_uinname)%>：</span>
                            </a>
                            <%/* 转发全文 */%>
                            <%if(message.rt_has_more_con && message.rt_con){%>
                                <details class="float-left ml-3" >
                                    <summary>查看全文</summary>
                                    <div class="container">
                                        <%:=API.Common.formatContent(message, "HTML", true, false)%>
                                    </div>
                                </details>
                            <%}else{%>
                                <pre class="card-text content"><%:=API.Common.formatContent(message, "HTML", true, false)%></pre>
                            <%}%>
                        <%}%>
                        <%/* 多媒体内容 */%>
                        <div class="medias row p-3 lightgallery <%:=API.Common.getImgClassType(message)%>">
                            <%/* 视频内容（一般为单视频） */%>
                            <%if(message.custom_videos){%>
                                <%for(let video of message.custom_videos){%>
                                    <%if (API.Videos.isExternalVideo(video)) {%>
                                        <a class="medias-item border message-lightbox-external" href="<%:=API.Videos.getVideoUrl(video)%>" target="_blank">
                                            <span class="message-video"></span>
                                            <img class="lazyload w-100 h-100" data-src="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>">
                                        </a>
                                    <%}else{%>
                                        <%/* 空间视频 */%>
                                        <a class="medias-item border message-lightbox" data-poster="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>" data-html="#<%:=video.video_id || video.vid || video.pic_id%>">
                                            <span class="message-video"></span>
                                            <div style="display:none;" id="<%:=video.video_id || video.vid || video.pic_id%>">
                                                <video class="lg-video-object lg-html5" src="<%:=(video.custom_filepath || video.custom_url || video.url3)%>" controls="controls"></video>
                                            </div>
                                            <img class="lazyload w-100 h-100" data-src="<%:=video.custom_pre_filepath || video.custom_pre_url || video.url1%>" />
                                        </a>
                                    <%}%>
                                <%}%>
                            <%}%>
                            <%/*  图片内容(含视频，即同时存在图片与视频) */%>
                            <%if(message.custom_images){%>
                                <%for(let image of message.custom_images){%>
                                    <%if(image.is_video && image.video_info){%>
                                        <%if (API.Videos.isExternalVideo(image.video_info)) {%>
                                            <a class="medias-item border message-lightbox-external" href="<%:=API.Videos.getVideoUrl(image.video_info)%>" target="_blank">
                                                <span class="message-video"></span>
                                                <img class="lazyload w-100 h-100" data-src="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>">
                                            </a>
                                        <%}else{%>
                                            <%/* 空间视频 */%>
                                            <a class="medias-item border message-lightbox" data-poster="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>" data-html="#<%:=image.video_info.video_id || image.video_info.vid || image.pic_id%>">
                                                <span class="message-video"></span>
                                                <div style="display:none;" id="<%:=image.video_info.video_id || image.video_info.vid || image.pic_id%>">
                                                    <video class="lg-video-object lg-html5" src="<%:=(image.video_info.custom_filepath || image.video_info.custom_url || image.video_info.url3)%>" controls="controls"></video>
                                                </div>
                                                <img class="lazyload w-100 h-100" data-src="<%:=image.video_info.custom_pre_filepath || image.video_info.custom_pre_url || image.video_info.url1%>" />
                                            </a>
                                        <%}%>
                                    <%}else{%>
                                        <a class="medias-item border message-lightbox" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                            <img class="lazyload w-100 h-100" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                        </a>
                                    <%}%>
                                <%}%>
                            <%}%>
                            <%/* 动画表情内容（目前只支持一个） */%>
                            <%if(message.custom_magics){%>
                                <%for(let image of message.custom_magics){%>
                                    <a class="medias-item border message-lightbox" data-src="<%:=(image.custom_filepath || image.custom_url)%>">
                                        <img class="lazyload w-100 h-100" data-src='<%:=(image.custom_filepath || image.custom_url)%>'>
                                    </a>
                                    <hr>
                                <%}%>
                            <%}%>
                        </div>
                        <%/* 音乐内容（目前已无法正常播放，直接显示专辑图片与歌曲信息） */%>
                        <%if(message.custom_audios && message.audiototal > 0){%>
                            <div class="medias row p-3">
                                <ul class="list-unstyled w-100">
                                    <%for(let music of message.custom_audios){%>
                                        <li class="border">
                                            <a class="medias-item text-center" data-src="<%:=(music.custom_filepath || music.image)%>" href="<%:=music.playurl%>">
                                                <img class="lazyload border" data-src="<%:=(music.custom_filepath || music.image)%>">
                                                <span><%:=music.name%></span>
                                            </a>
                                        </li>
                                    <%}%>
                                </ul>
                            </div>
                        <%}%>
                        <%/* 投票内容（待定） */%>
                        <%/* 说说评论 */%>
                        <%if(message.custom_comments && message.custom_comments.length > 0){%>
                            <%/* 遍历评论 */%>
                            <%for(let comment of message.custom_comments){%>
                                <div class="p-1 border-top comments mt-3">
                                    <div class="container comment  m-1 p-0">
                                        <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(comment.uin)%>">
                                            <img class="lazyload w-100 border rounded-circle" data-src="<%:=API.Common.getUserLogoUrl(comment.uin)%>" >
                                        </a>
                                        <div class="ml-4">
                                            <%/* 评论 */%>
                                            <div class="container ml-4">
                                                <a class="author">
                                                    <a target="_blank" href="<%:=API.Common.getUserUrl(comment.uin)%>">
                                                        <span><%:=API.Common.formatContent(comment.name)%></span>
                                                    </a>
                                                    <%if(comment.private){%>
                                                        <span class="text-info"> 私密评论 </span>
                                                    <%}%>
                                                    <br>
                                                    <span class="text-muted small"><%:=comment.createTime2%></span>
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
                                            <%if(comment.list_3){%>
                                                <%for(let reply of comment.list_3){%>
                                                    <div class="comments m-1">
                                                        <div class="container comment  m-3 p-0">
                                                            <a class="me-a avatar p-0 m-0 " target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                                                <img class="lazyload w-100 border rounded-circle" data-src="<%:=API.Common.getUserLogoUrl(reply.uin)%>">
                                                            </a>
                                                            <div class=" ml-4  ">
                                                                <div class="container ml-4">
                                                                    <a class="author">
                                                                        <a target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                                                            <span class="text-info"><%:=API.Common.formatContent(reply.name)%></span>
                                                                        </a>
                                                                        <%if(reply.private){%>
                                                                            <span class="text-info"> 私密回复 </span>
                                                                        <%}%>
                                                                        <br>
                                                                        <span class="text-muted small"><%:=API.Common.formatContent(reply.createTime2)%></span>
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
                    <ul class="list-group list-group-flush ml-4">
                        <%if(message.lbs && message.lbs.pos_x && message.lbs.pos_y){%>
                            <li class="list-group-item">
                                <a class="fa fa-map-marker" target="_blank" href="<%:=API.Messages.getMapUrl(message.lbs)%>" class="card-link"> <%:=message.lbs.idname || message.lbs.name%></a>
                            </li>
                        <%}%>
                        <%if(message.source_name){%>
                            <li class="list-group-item">
                                <%if(message.source_url){%>
                                    <span class="text-info"><a target="_blank" href="<%:=message.source_url%>"><%:=API.Common.formatContent(message.source_name)%></a></span>
                                <%}else{%>
                                    <span class="text-info fa fa-mobile-phone"> <%:=API.Common.formatContent(message.source_name)%></span>
                                <%}%>
                            </li>	
                        <%}%>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <div class="card-footer text-muted">
        <%:=API.Common.formatContent(message.custom_create_time)%>
        <span class="text-primary p-1 float-right fa fa-thumbs-up mr-2 cursor viewlikes" title="点赞列表" data-field="tid" data-target="<%:=message.tid%>"><%:=message.likeTotal || 0 %></span>
        <span class="text-primary p-1 float-right fa fa-eye mr-2 cursor viewVisitors" title="最近访问" data-field="tid" data-target="<%:=message.tid%>"><%:=message.custom_visitor && message.custom_visitor.viewCount || 0 %></span>
    </div>
</div>
`;

/**
 * 那年今日的说说模板
 */
const YEAR_ITEMS = `
    <%if (yearMaps && yearMaps.size > 0) {%>
        <h3 class="sidebar-h1" data-tag="h1" data-sidebar="那年今日">那年今日</h3>
        <%for (const [year, yearItems] of yearMaps) {%>
            <%if (yearItems && yearItems.length > 0) {%>
                <span class="sidebar-h2" data-tag="h2" data-sidebar="<%:=year%>年"></span>
                <%for (const message of yearItems) {%>
                    `+ ITEM_TPL + `
                <%}%>  
            <%}%>       
        <%}%>
        <hr>
    <%}%>        
`;

$(function () {

    // 那年今日
    const _yearMaps = API.Common.getOldYearData(dataList, "created_time");

    // 那年今日HTML
    const items_html = template(YEAR_ITEMS, { yearMaps: _yearMaps });
    $('#messages_html').prepend(items_html);

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