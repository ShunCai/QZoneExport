const initSidebar = function() {
    // 清空目录
    $("#BlogAnchor").remove();
    // 重新生成
    const haders = $("body").find("h1,h2,h3,h4,h5,h6,.h1,.h2,.h3,.h4,.h5,.h6,.sidebar-h1,.sidebar-h2,.sidebar-h3,.sidebar-h4,.sidebar-h5,.sidebar-h6");
    if (haders.length == 0) {
        return;
    }

    var links = document.links;
    for (var i = 0; i < links.length; i++) {
        if (!links[i].target) {
            if (
                links[i].hostname !== window.location.hostname ||
                /\.(?!html?)([a-z]{0,3}|[a-zt]{0,4})$/.test(links[i].pathname)
            ) {
                links[i].target = '_blank';
            }
        }
    }

    $("body").prepend('<div id="BlogAnchor" class="BlogAnchor">' +
        '<div id="AnchorContent" class="AnchorContent"> </div>' +
        '</div>');


    haders.each(function(i, item) {
        const tag = $(this).attr('data-tag') || $(item).get(0).tagName.toLowerCase();
        var id = API.Utils.newUid();
        var className = 'item_' + tag;
        $(item).attr("id", "wow" + id);
        $(item).addClass("wow_head");
        // 显示的内容
        const html = $(this).attr('data-sidebar') || $(this).html();
        $("#AnchorContent").css('max-height', ($(window).height() - 80) + 'px');
        $("#AnchorContent").append('<li><a class="nav_item ' + className + ' anchor-link text-truncate" title=' + $('<div>' + html + '</div>').text() + ' href="#wow' + id + '">' + "" + "" + html + '</a></li>');
    });

    $(".anchor-link").click(function() {
        $(".BlogAnchor li .nav_item.current").removeClass('current');
        $(this).addClass('current');
    });

    // hash发生变化
    window.onhashchange = function() {
        // 减去头部高度，便于精确定位
        const $hashDom = $(location.hash);
        if ($hashDom) {
            $("html,body").animate({ scrollTop: $hashDom.offset().top - 58 });
        }
    }

}

$(document).ready(initSidebar);

$(window).resize(function() {
    $("#AnchorContent").css('max-height', ($(window).height() - 80) + 'px');
});