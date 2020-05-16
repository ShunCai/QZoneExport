const initSidebar = function () {
    const haders = $("body").find("h1,h2,h3,h4,h5,h6,.h1,.h2,.h3,.h4,.h5,.h6,.sidebar-h1,.sidebar-h2,.sidebar-h3,.sidebar-h4,.sidebar-h5,.sidebar-h6");
    if (haders.length == 0) {
        return;
    }
    const newUid = function () {
        var s4 = function () {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
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

    $("body").prepend('<div class="BlogAnchor">' +
        '<div class="AnchorContent" id="AnchorContent"> </div>' +
        '</div>');


    haders.each(function (i, item) {
        const tag = $(this).attr('data-tag') || $(item).get(0).tagName.toLowerCase();
        var id = newUid();
        var className = 'item_' + tag;
        $(item).attr("id", "wow" + id);
        $(item).addClass("wow_head");
        const title = $(this).attr('data-sidebar') || $(this).text();
        $("#AnchorContent").css('max-height', ($(window).height() - 80) + 'px');
        $("#AnchorContent").append('<li><a class="nav_item ' + className + ' anchor-link text-truncate" onclick="return false;" title=' + title + ' href="#" link="#wow' + id + '">' + "" + "" + title + '</a></li>');
    });

    $(".anchor-link").click(function () {
        $(".BlogAnchor li .nav_item.current").removeClass('current');
        $("html,body").animate({ scrollTop: $($(this).attr("link")).offset().top - 56 });
        $(this).addClass('current');
    });
}

$(document).ready(initSidebar);

$(window).resize(function () {
    $("#AnchorContent").css('max-height', ($(window).height() - 80) + 'px');
});
