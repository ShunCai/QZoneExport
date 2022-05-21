;
(function(root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD
		define([ 'jquery', './jquery.loadmask.css' ], factory);
	} else if (typeof exports === 'object') {

		require("./jquery.loadmask.css");

		// Node, CommonJS之类的
		module.exports = factory(require('jquery'));
	} else {
		// 浏览器全局变量(root 即 window)
		root.returnExports = factory(root.jQuery);
	}
}(this, function($) {

	// 需要调整大小的遮罩元素
	var $mask_elements = [];

	// 窗口调整大小定时器
	var mask_resize_timer;

	$(window).on("resize.mask", function() {

		mask_resize_timer && clearTimeout(mask_resize_timer);

		mask_resize_timer = setTimeout(function() {

			var $body = $(document.body);

			if ($body.hasClass("mask"))
				reposIcon($body, $body.find("> .mask-icon"));

			for (var i = 0, l = $mask_elements.length; i < l; i++) {

				var $ele = $mask_elements[i];

				var $maskEle = $ele;

				if (!$ele.hasClass("mask")) {

					$maskEle = $ele.parent();

					$maskEle.css({
						width : "",
						height : ""
					});

					$maskEle.width($ele.outerWidth());

					$maskEle.height($ele.outerHeight());

				}

				reposIcon($maskEle, $maskEle.find("> .mask-icon"));
			}

		}, 20);

	});

	// 有些元素需要包装一层DIV去执行MASK
	function isElementAskDiv($ele) {

		var tagName = $ele[0].tagName;

		if (tagName == 'TABLE')
			return true;

		return false;
	}

	function calMaskElementRect($ele) {

		if ($ele[0].tagName == 'BODY') {

			var width = window.innerWidth, height = window.innerHeight;

			if (typeof width != 'number') {// IE 5/6/7/8

				if (document.compatMode == 'CSS1Compat') {

					width = document.documentElement.clientWidth;

					height = document.docuementElement.clientHeight;

				} else {

					width = document.body.clientWidth;

					height = document.body.clientHeight;

				}
			}

			return {
				width : width,
				height : height
			};
		}

		return {
			height : $ele.outerHeight(),
			width : $ele.outerWidth()
		};
	}

	function reposIcon($maskEle, $icon) {

		var windowRect = calMaskElementRect($maskEle);

		var width = windowRect.width, height = windowRect.height;

		var iheight = $icon.outerHeight(), iwidth = $icon.outerWidth();

		var top = (height - iheight) / 2, left = (width - iwidth) / 2;

		$icon.css({
			top : top + "px",
			left : left + "px"
		});

	}

	// DIV等容器性元素
	function maskElement($ele, options) {

		if ($ele[0].tagName == 'BODY')
			return maskBody($ele, options);

		var maskCount = ($ele.data("masked") || 0) + 1;

		$ele.data("masked", maskCount);

		// 已经开启遮罩了,
		if (maskCount > 1)
			return;

		options.iconCls = options.iconCls || "fa fa-spinner fa-spin fa-3x";

		var $maskEle = $ele;

		$mask_elements.push($ele);

		if (isElementAskDiv($ele)) {

			$maskEle = $ele.wrap('<div></div>').parent();

			$maskEle.width($ele.outerWidth());

			$maskEle.height($ele.outerHeight());
		}

		$maskEle.addClass("mask mask-hidden");

		$maskEle.css("position") == 'static'
				&& $maskEle.addClass("mask-relative");

		var $mask = $('<div class="mask-backdrop"></div>').appendTo($maskEle);

		var $icon = $('<i class="mask-icon ' + options.iconCls + '"></i>')
				.appendTo($maskEle);

		reposIcon($maskEle, $icon);

	}

	function unMaskElement($ele) {

		if ($ele[0].tagName == 'BODY')
			return unMaskBody($ele);

		var maskCount = ($ele.data("masked") || 0) - 1;

		// 从来没遮罩过
		if (maskCount > 0)
			return $ele.data("masked", maskCount);

		$ele.removeData("masked");

		var $maskEle = $ele.hasClass("mask") ? $ele : $ele.parent();

		$maskEle.removeClass("mask mask-relative mask-hidden");

		$maskEle.find("> .mask-backdrop").remove();

		$maskEle.find("> .mask-icon").remove();

		// 窗口缩放监听从数组中移除出去
		for (var i = 0, l = $mask_elements.length; i < l; i++)
			if ($mask_elements[i].get(0) == $maskEle[0])
				$mask_elements.splice(i, 1);

	}

	function maskBody($ele, options) {

		if ($ele[0].tagName != 'BODY')
			return maskElement($ele, options);

		var maskCount = ($ele.data("masked") || 0) + 1;

		$ele.data("masked", maskCount);

		// 已经开启遮罩了,
		if (maskCount > 1)
			return;

		options.iconCls = options.iconCls || "fa fa-spinner fa-spin fa-5x";

		var $maskEle = $ele.addClass("mask");

		var $mask = $('<div class="mask-backdrop mask-backdrop-fixed"></div>')
				.appendTo($maskEle);

		var $icon = $(
				'<i class="mask-icon mask-icon-fixed ' + options.iconCls
						+ '"></i>').appendTo($maskEle);

		reposIcon($maskEle, $icon);

	}

	function unMaskBody($ele) {

		if ($ele[0].tagName != 'BODY')
			return unMaskElement($ele);

		var maskCount = ($ele.data("masked") || 0) - 1;

		// 从来没遮罩过
		if (maskCount > 0)
			return $ele.data("masked", maskCount);

		var $maskEle = $ele.removeData("masked");

		$maskEle.removeClass("mask");

		$maskEle.find("> .mask-backdrop").remove();

		$maskEle.find("> .mask-icon").remove();

	}

	$.fn.mask = function(options) {

		options = options || {};

		$(this).each(function() {

			maskElement($(this), options);

		});
	};

	$.fn.unmask = function() {

		$(this).each(function() {

			unMaskElement($(this));

		});
	};

	$.fn.isMasked = function() {

		return (this.data("masked") || 0) > 1;
	};

	return $;

}));