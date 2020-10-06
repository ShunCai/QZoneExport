/**
 * 单条HTML模板
 */
const ITEM_TPL = `
<div class="card border p-2 mt-1">
    <div class="card-body">
        <div class="p-1 comments">
            <div class="container comment  m-1 p-0">
                <a class="me-a avatar p-0 m-0" target="_blank" href="<%:=API.Common.getUserUrl(board.uin)%>">
                    <img class="lazyload w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(board.uin)%>">
                </a>
                <div class="ml-4">
                    <div class="container ml-4">
                        <a class="author">
                            <a target="_blank" href="<%:=API.Common.getUserUrl(board.uin)%>">
                                <span><%:=API.Common.formatContent(board.nickname)%></span>
                            </a>
                            <br>
                            <span class="text-muted small"><%:=API.Utils.formatDate(board.pubtime)%></span>
                        </a>
                    </div>
                    <div class="messageText ml-4 container m-2">
                        <%:=API.Common.formatContent(board.htmlContent,'HTML', false, true)%>
                    </div>
                    <%if(board.replyList){%>
                        <div class="p-1 comments m-3">
                            <%for (var reply of board.replyList) {%>
                                <div class="container comment  m-3 p-0">
                                    <a class="me-a avatar p-0 m-0 " target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                        <img class="lazyload w-100 h-100 border rounded-circle" src="<%:=API.Common.getUserLogoUrl(reply.uin)%>">
                                    </a>
                                    <div class=" ml-4  ">
                                        <div class="container ml-4">
                                            <a class="author">
                                                <a target="_blank" href="<%:=API.Common.getUserUrl(reply.uin)%>">
                                                    <span class="text-info"><%:=API.Common.formatContent(reply.nick)%></span>
                                                </a>
                                                <br>
                                                <span class="text-muted small"><%:=API.Utils.formatDate(reply.time)%></span>
                                            </a>
                                        </div>
                                        <div class="messageText ml-4 container m-2"><%:=API.Common.formatContent(reply.content)%></div>
                                    </div>
                                </div>
                            <%}%>
                        </div>
                    <%}%>
                </div>
            </div>
        </div>
    </div>
</div>
`;

/**
 * 那年今日模板
 */
const YEAR_ITEMS = `
    <%if (yearMaps && yearMaps.size > 0) {%>
        <h3 class="sidebar-h1" data-tag="h1" data-sidebar="那年今日">那年今日</h3>
        <%for (const [year, yearItems] of yearMaps) {%>
            <%if (yearItems && yearItems.length > 0) {%>
                <span class="sidebar-h2" data-tag="h2" data-sidebar="<%:=year%>年"></span>
                <%for (const board of yearItems) {%>
                    `+ ITEM_TPL +`
                <%}%>  
            <%}%>       
        <%}%>
        <hr>
    <%}%>        
`;

$(function () {

    // 那年今日
    // 时间分组
    const yearMaps = API.Utils.groupedByTime(dataList, "pubtime", 'all');
    const date = new Date();
    // 当前年份跳过
    const currentYear = date.getFullYear();
    const currentMonthDay = date.format('-MM-dd');
    const _yearMaps = new Map();
    if(yearMaps){
        // 移除今年数据
        yearMaps.delete(currentYear);
    }
    for (const [year, yearItemMaps] of yearMaps) {
        for (const [month, monthItems] of yearItemMaps) {
            const monthDayItems = [];
            for (const item of monthItems) {
                const pubtime = API.Utils.formatDate(item.pubtime);
                if(pubtime.indexOf(currentMonthDay) > -1){
                    monthDayItems.push(item);
                }
            }
            if(monthDayItems.length > 0){
                _yearMaps.set(year, monthDayItems);
            }
        }
    }

    // 那年今日HTML
    const items_html = template(YEAR_ITEMS, { yearMaps: _yearMaps });
    $('#boards_html').prepend(items_html);

    // 重新渲染左侧目录
    initSidebar();

    // 图片懒加载
    lazyload();
    
});