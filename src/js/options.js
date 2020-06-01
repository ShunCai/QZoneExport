(function () {
	$(window.location.hash).tab('show');

	// 初始化提示
	$('[data-toggle="tooltip"]').tooltip({
		placement: 'auto'
	});

	// 屏蔽词管理点击事件
	$('#managerKeywords').click(function () {
		$('#managerKeywordsModal').modal('show');
	});

	// 添加默认屏蔽词
	$('#defaultFilterKeyword').click(function () {
		$('#filterKeywords').val(Default_Config.Messages.FilterKeyWords.join('\n'));
	});

	// 添加屏蔽词
	$('#addFilterKeyword').click(function () {
		// 添加的值
		const addValue = $('#filterKeyword').val();
		if (!addValue) {
			return;
		}
		// 现在的值
		let filterKeywordValues = $('#filterKeywords').val();
		if (!filterKeywordValues) {
			filterKeywordValues = [];
		} else {
			filterKeywordValues = filterKeywordValues.split('\n');
		}
		filterKeywordValues.unshift(addValue);
		$('#filterKeywords').val(filterKeywordValues.join('\n'));
	});

	// 屏蔽开关监听事件
	$('#message_is_filter').change(function () {
		if (this.checked) {
			$('.managerKeywordsDiv').show();
			return;
		}
		$('.managerKeywordsDiv').hide();
	})

	const tips = (message) => {
		$('.toast-body').html(message);
		$(".toast").toast('show');
	}

	// 初始化日期选择控件
	$('.increment_time').datetimepicker({
		locale: 'zh-cn',
		defaultDate: "2005-06-06 00:00:00",// QQ空间正式发行日期？
		minDate: "2005-04-01 00:00:00",// QQ空间内测发行日期？
		format: 'YYYY-MM-DD HH:mm:ss',
		toolbarPlacement: 'top',
		keepOpen: true,
		sideBySide: true,
		buttons: {
			showToday: true,
			showClear: true,
			showClose: true
		},
		tooltips: {
			today: '今天',
			clear: '清除选择',
			close: '关闭',
			selectMonth: '选择月份',
			prevMonth: '上一月',
			nextMonth: '下一月',
			selectYear: '选择年份',
			prevYear: '上一年',
			nextYear: '下一年',
			incrementHour: '增一小时',
			pickHour: '选择小时',
			decrementHour: '减一小时',
			incrementMinute: '增一分钟',
			pickMinute: '选择分钟',
			decrementMinute: '减一分钟',
			pickSecond: "选择秒钟",
			incrementSecond: "增一秒钟",
			decrementSecond: "减一秒钟",
			selectTime: '选择时间',
			selectDate: '选择日期'
		},
		icons: {
			clear: 'fa fa-trash-o'
		}
	})

	// 增量类型选择事件
	$(".increment_type").change(function () {
		const $this = $(this);
		const value = $this.val();
		const target_module = QZone_Config[$this.attr("data-module")];
		const $increment_time = $($this.attr("data-time"));
		const $increment_time_row = $($this.attr("data-time-row"));
		switch (value) {
			case 'Full':
				// 全量备份
				$increment_time_row.hide();
				$increment_time.val("2005-06-06 00:00:00");
				break;
			case 'LastTime':
				// 上次备份
				$increment_time_row.show();
				$increment_time.val(target_module.PreBackup.time);
				$increment_time.attr('readonly', true);
				break;
			case 'Custom':
				// 自定义
				$increment_time_row.show();
				$increment_time.attr('readonly', false);
				$increment_time.val(target_module.IncrementTime);
				break;
			default:
				break;
		}
	})

	// 增量数据重置点击事件
	$(".reset_increment").click(function () {
		const $this = $(this);
		const moduleName = $this.attr("data-module");
		const module = QZone_Config[moduleName];
		// 获取模块上次备份的信息
		// 上次备份QQ号
		const uin = module.PreBackup.uin;
		if (!uin) {
			tips('重置QQ：<span class="text-info">无</span><br>重置模块：<span class="text-info">{1}</span><br>上次备份：<span class="text-info">未备份</span><br>重置结果：<span class="text-info">无需重置</span>'.format(uin, moduleName));
			return;
		}
		// 上次备份文件下载方式
		const downloadType = module.PreBackup.downloadType || QZone_Config.Common.downloadType;
		// 上次备份文件下载方式
		const time = module.PreBackup.time;

		// 重置上次备份时间
		module.IncrementTime = '2005-06-06 00:00:00';

		module.PreBackup.time = '2005-06-06 00:00:00';

		// 重置配置
		chrome.storage.sync.set(QZone_Config, function () {
			// 覆盖配置
			loadOptions(QZone_Config);

			// 重置数据
			// 获取指定模块的上次备份的数据
			const key = uin + "_" + downloadType;

			// 获取数据
			chrome.storage.local.get([key], function (data) {
				if (Object.keys(data).length === 0) {
					tips('重置QQ：<span class="text-info">{0}</span><br>重置模块：<span class="text-info">{1}</span><br>下载方式：<span class="text-info">{2}</span><br>上次备份：<span class="text-info">{3}</span><br>重置结果：<span class="text-info">未方式该备份数据</span>'.format(uin, moduleName, downloadType, time));
					return;
				}
				data[key][moduleName] = undefined;
				// 保存数据
				chrome.storage.local.set(data, function (data) {
					tips('重置QQ：<span class="text-info">{0}</span><br>重置模块：<span class="text-info">{1}</span><br>下载方式：<span class="text-info">{2}</span><br>上次备份：<span class="text-info">{3}</span><br>重置结果：<span class="text-info">重置成功</span>'.format(uin, moduleName, downloadType, time));
					return;
				});
			});
		});


	})

	// 监听个人中心菜单点击事件
	$('#v-pills-tab a').on('click', function (e) {
		e.preventDefault();
		window.location.hash = "#" + this.id;
	})

	// 监听配置Tab点击事件
	$('#nav-tab a').on('click', function (e) {
		e.preventDefault();
		window.location.hash = "#" + this.id;
	});

	// 监听下载工具选择事件
	$('#common_download_type').change(function () {
		let value = $(this).val();
		let task_count_dom = $('#common_thunder_task_count')[0].parentNode.parentNode;
		let task_sleep_dom = $('#common_thunder_task_sleep')[0].parentNode.parentNode;
		let download_status_dom = $('#common_download_status')[0].parentNode.parentNode.parentNode;
		let file_suffix_dom = $('#common_file_suffix')[0].parentNode.parentNode.parentNode;
		let suffix_timeout_dom = $('#common_file_suffix_timeout')[0].parentNode.parentNode;
		let download_thread_dom = $('#common_download_thread')[0].parentNode.parentNode;
		switch (value) {
			case 'File':
				$(task_count_dom).hide();
				$(task_sleep_dom).hide();
				$(download_status_dom).hide();
				$(file_suffix_dom).show();
				$(suffix_timeout_dom).show();
				$(download_thread_dom).show();
				$('#common_download_type_help').html('助手内部目前<span style="color:red">暂不支持数据容量大于2G的备份</span>，2G内建议使用助手内部下载，超2G的建议使用其他方式下载');
				break;
			case 'Thunder':
				$(task_count_dom).show();
				$(task_sleep_dom).show();
				$(download_status_dom).hide();
				$(file_suffix_dom).show();
				$(suffix_timeout_dom).show();
				$(download_thread_dom).show();
				$('#common_download_type_help').html('仅在<span style="color:red">正版的安装版迅雷X（不禁用迅雷X基础服务）的10.1.3以上版本</span>测试通过，禁用服务或其他版本建议切换迅雷X（剪切板）');
				break;
			case 'Thunder_Link':
				$(task_count_dom).hide();
				$(task_sleep_dom).hide();
				$(download_status_dom).hide();
				$(file_suffix_dom).show();
				$(suffix_timeout_dom).show();
				$(download_thread_dom).show();
				$('#common_download_type_help').html('仅支持迅雷X且打开剪切板监听，打开迅雷X，复制ZIP包中【<span style="color:red">迅雷下载链接.txt</span>】文本内容自动新建下载任务');
				break;
			case 'Browser':
				$(task_count_dom).hide();
				$(task_sleep_dom).hide();
				$(download_status_dom).show();
				$(file_suffix_dom).show();
				$(suffix_timeout_dom).show();
				$(download_thread_dom).show();
				$('#common_download_type_help').html('使用浏览器下载，请确保已关闭浏览器设置中的<span style="color:red">【下载前询问每个文件的保存位置】</span>选项，否则浏览器将会一直弹窗提示保存文件');
				break;
			case 'QZone':
				$(task_count_dom).hide();
				$(task_sleep_dom).hide();
				$(download_status_dom).hide();
				$(file_suffix_dom).hide();
				$(suffix_timeout_dom).hide();
				$(download_thread_dom).hide();
				$('#common_download_type_help').text('QQ空间外链仅适用于备份类型为非文件类型的，例如日志、说说等，文件类型的，例如相片、视频，将默认使用助手内部下载');
				break;
			default:
				break;
		}
	})

	// 监听相册备份类型选择事件
	$('#photos_exportFormat').change(function () {
		let value = $(this).val();
		switch (value) {
			case 'File':
				// 隐藏相册评论模块
				$('#photos_albums_comments_panel').hide();
				// 隐藏相片评论模块
				$('#photos_images_comments_panel').hide();
				break;
			case 'JSON':
				// 显示相册评论模块
				$('#photos_albums_comments_panel').show();
				// 显示相片评论模块
				$('#photos_images_comments_panel').show();
				// 隐藏相片清晰度
				$('#photos_exifType_panel').hide();
				break;
			default:
				// 显示相片评论模块
				$('#photos_albums_comments_panel').show();
				// 显示相片评论模块
				$('#photos_images_comments_panel').show();
				// 显示相片清晰度
				$('#photos_exifType_panel').show();
				break;
		}
	})

	// 监听类型识别开关改变事件
	$('#common_file_suffix').change(function () {
		let downloadType = $('#common_download_type').val();
		let suffix_timeout = $('#common_file_suffix_timeout')[0].parentNode.parentNode;
		let isChecked = $(this).prop("checked");
		if (isChecked && 'QZone' !== downloadType) {
			$(suffix_timeout).show();
		} else {
			$(suffix_timeout).hide();
		}
	})

	let loadOptions = (options) => {
		// 公共模块赋值
		$("#common_list_retry_count").val(options.Common.listRetryCount);
		$("#common_list_retry_sleep").val(options.Common.listRetrySleep);
		$("#common_download_type").val(options.Common.downloadType).change();
		$('#common_file_suffix').prop("checked", options.Common.isAutoFileSuffix).change();
		$("#common_file_suffix_timeout").val(options.Common.autoFileSuffixTimeOut);
		$('#common_download_status').prop("checked", options.Common.enabledShelf);
		chrome.downloads.setShelfEnabled(options.Common.enabledShelf);
		$("#common_thunder_task_count").val(options.Common.thunderTaskNum);
		$("#common_thunder_task_sleep").val(options.Common.thunderTaskSleep);
		$("#common_download_thread").val(options.Common.downloadThread);
		$('#common_user_link').prop("checked", options.Common.hasUserLink);

		// 说说模块赋值
		$("#messages_exportFormat").val(options.Messages.exportType);
		$("#messages_increment_type").val(options.Messages.IncrementType).change();
		$("#messages_increment_time").val(options.Messages.IncrementTime);
		$("#messages_list_cost_min").val(options.Messages.randomSeconds.min);
		$("#messages_list_cost_max").val(options.Messages.randomSeconds.max);
		$("#messages_list_limit").val(options.Messages.pageSize);
		$("#messages_full").prop("checked", options.Messages.isFull);
		$("#message_is_filter").prop("checked", options.Messages.isFilterKeyword).change();
		$("#filterKeywords").val(options.Messages.FilterKeyWords.join('\n'));


		// 说说评论选项
		$("#messages_download_full_comments").prop("checked", options.Messages.Comments.isFull);
		$("#messages_comments_min").val(options.Messages.Comments.randomSeconds.min);
		$("#messages_comments_max").val(options.Messages.Comments.randomSeconds.max);
		$("#messages_comments_limit").val(options.Messages.Comments.pageSize);

		// 日志模块赋值
		$("#blogs_exportFormat").val(options.Blogs.exportType);
		$("#blogs_increment_type").val(options.Blogs.IncrementType).change();
		$("#blogs_increment_time").val(options.Blogs.IncrementTime);
		$("#blogs_list_cost_min").val(options.Blogs.randomSeconds.min);
		$("#blogs_list_cost_max").val(options.Blogs.randomSeconds.max);
		$("#blogs_info_cost_min").val(options.Blogs.Info.randomSeconds.min);
		$("#blogs_info_cost_max").val(options.Blogs.Info.randomSeconds.max);
		$("#blogs_list_limit").val(options.Blogs.pageSize);


		// 日志评论选项
		$("#blogs_download_full_comments").prop("checked", options.Blogs.Comments.isFull);
		$("#blogs_comments_min").val(options.Blogs.Comments.randomSeconds.min);
		$("#blogs_comments_max").val(options.Blogs.Comments.randomSeconds.max);
		$("#blogs_comments_limit").val(options.Blogs.Comments.pageSize);

		// 私密日志赋值
		$("#diaries_exportFormat").val(options.Diaries.exportType);
		$("#diaries_increment_type").val(options.Diaries.IncrementType).change();
		$("#diaries_increment_time").val(options.Diaries.IncrementTime);
		$("#diaries_list_cost_min").val(options.Diaries.randomSeconds.min);
		$("#diaries_list_cost_max").val(options.Diaries.randomSeconds.max);
		$("#diaries_info_cost_min").val(options.Diaries.Info.randomSeconds.min);
		$("#diaries_info_cost_max").val(options.Diaries.Info.randomSeconds.max);
		$("#diaries_list_limit").val(options.Diaries.pageSize);

		// 相册模块赋值
		$("#photos_exportFormat").val(options.Photos.exportType).change();
		$("#photos_increment_type").val(options.Photos.IncrementType).change();
		$("#photos_increment_time").val(options.Photos.IncrementTime);
		$("#photos_list_cost_min").val(options.Photos.randomSeconds.min);
		$("#photos_list_cost_max").val(options.Photos.randomSeconds.max);
		$("#photos_list_limit").val(options.Photos.pageSize);
		$("#photos_albums_comments_has").prop("checked", options.Photos.Comments.isGet);
		$("#photos_albums_comments_cost_min").val(options.Photos.Comments.randomSeconds.min);
		$("#photos_albums_comments_cost_max").val(options.Photos.Comments.randomSeconds.max);
		$("#photos_albums_comments_limit").val(options.Photos.Comments.pageSize);

		$("#photos_images_cost_min").val(options.Photos.Images.randomSeconds.min);
		$("#photos_images_cost_max").val(options.Photos.Images.randomSeconds.max);
		$("#photos_images_limit").val(options.Photos.Images.pageSize);
		$("#photos_images_comments_has").prop("checked", options.Photos.Images.Comments.isGet);
		$("#photos_images_comments_cost_min").val(options.Photos.Images.Comments.randomSeconds.min);
		$("#photos_images_comments_cost_max").val(options.Photos.Images.Comments.randomSeconds.max);
		$("#photos_images_comments_limit").val(options.Photos.Images.Comments.pageSize);
		$("#photos_exifType").val(options.Photos.Images.exifType);

		// 视频模块赋值
		$("#videos_exportFormat").val(options.Videos.exportType);
		$("#videos_increment_type").val(options.Videos.IncrementType).change();
		$("#videos_increment_time").val(options.Videos.IncrementTime);
		$("#videos_list_cost_min").val(options.Videos.randomSeconds.min);
		$("#videos_list_cost_max").val(options.Videos.randomSeconds.max);
		$("#videos_list_limit").val(options.Videos.pageSize);

		// 留言板模块赋值
		$("#boards_exportFormat").val(options.Boards.exportType);
		$("#boards_increment_type").val(options.Boards.IncrementType).change();
		$("#boards_increment_time").val(options.Boards.IncrementTime);
		$("#boards_list_cost_min").val(options.Boards.randomSeconds.min);
		$("#boards_list_cost_max").val(options.Boards.randomSeconds.max);
		$("#boards_list_cost").val(options.Boards.querySleep);
		$("#boards_list_limit").val(options.Boards.pageSize);

		// 好友模块赋值
		$("#friends_exportFormat").val(options.Friends.exportType);
		$("#friends_has_add_time").prop("checked", options.Friends.hasAddTime);
		$("#friends_is_increment").prop("checked", options.Friends.isIncrement);

		// 收藏夹模块赋值
		$("#favorites_exportFormat").val(options.Favorites.exportType);
		$("#favorites_increment_type").val(options.Favorites.IncrementType).change();
		$("#favorites_increment_time").val(options.Favorites.IncrementTime);
		$("#favorites_list_cost_min").val(options.Favorites.randomSeconds.min);
		$("#favorites_list_cost_max").val(options.Favorites.randomSeconds.max);
		$("#favorites_list_limit").val(options.Favorites.pageSize);
	}

	// 读取数据，第一个参数是指定要读取的key以及设置默认值
	chrome.storage.sync.get(Default_Config, function (options) {
		console.info('读取配置完成！', options);
		QZone_Config = options;
		loadOptions(options);
	});

	let setOptions = () => {

		// 公共模块赋值		
		QZone_Config.Common.listRetryCount = $("#common_list_retry_count").val() * 1;
		QZone_Config.Common.listRetrySleep = $("#common_list_retry_sleep").val() * 1;
		QZone_Config.Common.isAutoFileSuffix = $('#common_file_suffix').prop("checked");
		QZone_Config.Common.autoFileSuffixTimeOut = $("#common_file_suffix_timeout").val() * 1;
		QZone_Config.Common.downloadType = $('#common_download_type').val();
		QZone_Config.Common.enabledShelf = $('#common_download_status').prop("checked");
		chrome.downloads.setShelfEnabled(QZone_Config.Common.enabledShelf);
		QZone_Config.Common.thunderTaskNum = $("#common_thunder_task_count").val() * 1;
		QZone_Config.Common.thunderTaskSleep = $("#common_thunder_task_sleep").val() * 1;
		QZone_Config.Common.downloadThread = $("#common_download_thread").val() * 1;
		QZone_Config.Common.hasUserLink = $('#common_user_link').prop("checked");

		// 说说模块赋值
		QZone_Config.Messages.exportType = $("#messages_exportFormat").val();
		QZone_Config.Messages.IncrementType = $("#messages_increment_type").val();
		QZone_Config.Messages.IncrementTime = $("#messages_increment_time").val();
		QZone_Config.Messages.randomSeconds.min = $("#messages_list_cost_min").val() * 1;
		QZone_Config.Messages.randomSeconds.max = $("#messages_list_cost_max").val() * 1;
		QZone_Config.Messages.pageSize = $("#messages_list_limit").val() * 1;
		QZone_Config.Messages.isFull = $("#messages_full").prop("checked");
		QZone_Config.Messages.isFilterKeyword = $("#message_is_filter").prop("checked");
		QZone_Config.Messages.FilterKeyWords = $("#filterKeywords").val().split('\n');


		// 说说评论赋值
		QZone_Config.Messages.Comments.isFull = $("#messages_download_full_comments").prop("checked");
		QZone_Config.Messages.Comments.randomSeconds.min = $("#messages_comments_min").val() * 1;
		QZone_Config.Messages.Comments.randomSeconds.max = $("#messages_comments_max").val() * 1;
		QZone_Config.Messages.Comments.pageSize = $("#messages_comments_limit").val() * 1;


		// 日志模块赋值
		QZone_Config.Blogs.exportType = $("#blogs_exportFormat").val();
		QZone_Config.Blogs.IncrementType = $("#blogs_increment_type").val();
		QZone_Config.Blogs.IncrementTime = $("#blogs_increment_time").val();
		QZone_Config.Blogs.randomSeconds.min = $("#blogs_list_cost_min").val() * 1;
		QZone_Config.Blogs.randomSeconds.max = $("#blogs_list_cost_max").val() * 1;
		QZone_Config.Blogs.Info.randomSeconds.min = $("#blogs_info_cost_min").val() * 1;
		QZone_Config.Blogs.Info.randomSeconds.max = $("#blogs_info_cost_max").val() * 1;
		QZone_Config.Blogs.pageSize = $("#blogs_list_limit").val() * 1;

		// 日志评论赋值
		QZone_Config.Blogs.Comments.isFull = $("#blogs_download_full_comments").prop("checked");
		QZone_Config.Blogs.Comments.randomSeconds.min = $("#blogs_comments_min").val() * 1;
		QZone_Config.Blogs.Comments.randomSeconds.max = $("#blogs_comments_max").val() * 1;
		QZone_Config.Blogs.Comments.pageSize = $("#blogs_comments_limit").val() * 1;

		// 私密日志赋值
		QZone_Config.Diaries.exportType = $("#diaries_exportFormat").val();
		QZone_Config.Diaries.IncrementType = $("#diaries_increment_type").val();
		QZone_Config.Diaries.IncrementTime = $("#diaries_increment_time").val();
		QZone_Config.Diaries.randomSeconds.min = $("#diaries_list_cost_min").val() * 1;
		QZone_Config.Diaries.randomSeconds.max = $("#diaries_list_cost_max").val() * 1;
		QZone_Config.Diaries.Info.randomSeconds.min = $("#diaries_info_cost_min").val() * 1;
		QZone_Config.Diaries.Info.randomSeconds.max = $("#diaries_info_cost_max").val() * 1;
		QZone_Config.Diaries.pageSize = $("#diaries_list_limit").val() * 1;

		// 相册模块赋值
		QZone_Config.Photos.exportType = $("#photos_exportFormat").val();
		QZone_Config.Photos.IncrementType = $("#photos_increment_type").val();
		QZone_Config.Photos.IncrementTime = $("#photos_increment_time").val();
		QZone_Config.Photos.pageSize = $("#photos_list_limit").val() * 1;
		QZone_Config.Photos.randomSeconds.min = $("#photos_list_cost_min").val() * 1;
		QZone_Config.Photos.randomSeconds.max = $("#photos_list_cost_max").val() * 1;
		QZone_Config.Photos.Comments.isGet = $("#photos_albums_comments_has").prop("checked");
		QZone_Config.Photos.Comments.randomSeconds.min = $("#photos_albums_comments_cost_min").val() * 1;
		QZone_Config.Photos.Comments.randomSeconds.max = $("#photos_albums_comments_cost_max").val() * 1;
		QZone_Config.Photos.Comments.pageSize = $("#photos_albums_comments_limit").val() * 1;

		QZone_Config.Photos.Images.randomSeconds.min = $("#photos_images_cost_min").val() * 1;
		QZone_Config.Photos.Images.randomSeconds.max = $("#photos_images_cost_max").val() * 1;
		QZone_Config.Photos.Images.pageSize = $("#photos_images_limit").val() * 1;
		QZone_Config.Photos.Images.Comments.isGet = $("#photos_images_comments_has").prop("checked");
		QZone_Config.Photos.Images.Comments.randomSeconds.min = $("#photos_images_comments_cost_min").val() * 1;
		QZone_Config.Photos.Images.Comments.randomSeconds.max = $("#photos_images_comments_cost_max").val() * 1;
		QZone_Config.Photos.Images.Comments.pageSize = $("#photos_images_comments_limit").val() * 1;
		QZone_Config.Photos.Images.exifType = $("#photos_exifType").val();

		// 视频模块赋值
		QZone_Config.Videos.exportType = $("#videos_exportFormat").val();
		QZone_Config.Videos.IncrementType = $("#videos_increment_type").val();
		QZone_Config.Videos.IncrementTime = $("#videos_increment_time").val();
		QZone_Config.Videos.randomSeconds.min = $("#videos_list_cost_min").val() * 1;
		QZone_Config.Videos.randomSeconds.max = $("#videos_list_cost_max").val() * 1;
		QZone_Config.Videos.pageSize = $("#videos_list_limit").val() * 1;

		// 留言板模块赋值
		QZone_Config.Boards.exportType = $("#boards_exportFormat").val();
		QZone_Config.Boards.IncrementType = $("#boards_increment_type").val();
		QZone_Config.Boards.IncrementTime = $("#boards_increment_time").val();
		QZone_Config.Boards.randomSeconds.min = $("#boards_list_cost_min").val() * 1;
		QZone_Config.Boards.randomSeconds.max = $("#boards_list_cost_max").val() * 1;
		QZone_Config.Boards.pageSize = $("#boards_list_limit").val() * 1;

		// 好友模块赋值
		QZone_Config.Friends.exportType = $("#friends_exportFormat").val();
		QZone_Config.Friends.hasAddTime = $("#friends_has_add_time").prop("checked");
		QZone_Config.Friends.isIncrement = $("#friends_is_increment").prop("checked");

		// 收藏夹模块赋值
		QZone_Config.Favorites.exportType = $("#favorites_exportFormat").val();
		QZone_Config.Favorites.IncrementType = $("#favorites_increment_type").val();
		QZone_Config.Favorites.IncrementTime = $("#favorites_increment_time").val();
		QZone_Config.Favorites.randomSeconds.min = $("#favorites_list_cost_min").val() * 1;
		QZone_Config.Favorites.randomSeconds.max = $("#favorites_list_cost_max").val() * 1;
		QZone_Config.Favorites.pageSize = $("#favorites_list_limit").val() * 1;

		chrome.storage.sync.set(QZone_Config, function () {
			console.info("保存成功！");
		});
	}

	// 保存按钮
	$('form').submit(function () {
		if (this.checkValidity() === false) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		setOptions();
		tips('<span class="text-success">保存成功</span>，<span class="text-danger">刷新空间</span>页面后备份');
		event.preventDefault();
		event.stopPropagation();
		return;
	})

	// 重置按钮
	$('.reset').click(function () {
		const $form = $(this.form);

		// 模块名称
		let moduleName = $form.attr('data-module');

		QZone_Config[moduleName] = Default_Config[moduleName]
		loadOptions(QZone_Config);

		tips('已重置默认值，<strong>确认无误</strong>后保存');
	})

	const readerTable = (tableId, columns, data, options) => {
		let tableOptions = {
			undefinedText: '',
			toggle: tableId,
			locale: 'zh-CN',
			height: "700",
			search: true,
			searchAlign: 'right',
			showButtonText: true,
			pagination: true,
			pageList: "[10, 20, 50, 100, 200, 500, 1000, 2000, 5000, All]",
			paginationHAlign: 'left',
			clickToSelect: true,
			paginationDetailHAlign: 'right',
			theadClasses: 'thead-light',
			showSearchButton: true,
			toolbar: "#" + tableId + "-toolbar",
			toolbarAlign: "left",
			columns: columns || [],
			data: data || []
		};
		Object.assign(tableOptions, options);
		$("#" + tableId).bootstrapTable('destroy').bootstrapTable(tableOptions);
		$("#" + tableId).bootstrapTable('resetView')
	}

	// 读取数据
	chrome.storage.local.get(QZone, function (OLD_QZone) {
		// 赋值全局变量
		Object.assign(QZone, OLD_QZone);


		// 初始化说说表格
		readerTable("messages-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'content',
			title: '内容',
			align: 'left',
			width: "50",
			widthUnit: "%",
			formatter: (value, row, index, field) => {
				const content = API.Utils.formatContent(value, "HTML") || '[无内容]';
				const target = API.Messages.getUniKey(row.tid);
				return '<a target="_brank" href="{0}" data-toggle="tooltip" data-placement="right" data-html="true" title="{1}" >{2}</a>'.format(target, content, content);
			}
		}, {
			field: 'previews',
			title: '多媒体',
			align: 'center',
			width: "100",
			formatter: (value, row, index, field) => {
				return '预览';
			}
		}, {
			field: 'custom_create_time',
			title: '发布时间',
			align: 'center',
			width: "180"
		}, {
			field: 'rt_uin',
			title: '类型',
			align: 'center',
			width: "100",
			formatter: (value, row, index, field) => {
				return row.rt_tid ? '转发' : '原创';
			}
		}, {
			field: 'lbs.idname',
			title: '位置',
			align: 'center',
			width: "150"
		}], QZone.Messages && QZone.Messages.Data || []);

		// 初始化日志表格
		readerTable("blogs-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'title',
			title: '标题',
			align: 'left',
			width: "60",
			widthUnit: "%",
			formatter: (value, row) => {
				return '<a target="_brank" href="http://user.qzone.qq.com/{0}/blog/{1}" >{2}</a> '.format(QZone.Common.Target.uin, row.blogid, value);
			}
		}, {
			field: 'category',
			title: '类别',
			align: 'center',
			width: "150",
		}, {
			field: 'rt_uin',
			title: '类型',
			align: 'center',
			width: "50",
			formatter: (value, row, index, field) => {
				return row.rt_uin ? '转发' : '原创';
			}
		}, {
			field: 'pubtime',
			title: '发布时间',
			align: 'center',
			width: "150",
			formatter: (value) => {
				return API.Utils.formatDate(value);
			}
		}], QZone.Blogs && QZone.Blogs.Data || []);

		// 初始化私密日志表格
		readerTable("diaries-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'title',
			title: '标题',
			align: 'left',
			width: "60",
			widthUnit: "%",
			formatter: (value, row, index, field) => {
				return '<a target="_brank" href="https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_output_data?uin={0}&blogid={1}" >{2}</a> '.format(QZone.Common.Target.uin, row.blogid, value);
			}
		}, {
			field: 'pubtime',
			title: '发布时间',
			align: 'center',
			width: "150",
			formatter: (value) => {
				return API.Utils.formatDate(value);
			}
		}], QZone.Diaries && QZone.Diaries.Data || []);

		// 初始化相册表格
		readerTable("photos-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50",
		}, {
			field: 'name',
			title: '名称',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return '<a target="_brank" href="https://user.qzone.qq.com/{0}/photo/{1}" >{2}</a> '.format(QZone.Common.Target.uin, row.id, value);
			}
		}, {
			field: 'desc',
			title: '描述',
			align: 'left',
			visible: true
		}, {
			field: 'image',
			title: '预览',
			align: 'center',
			visible: true
		}, {
			field: 'total',
			title: '数量',
			align: 'center',
			visible: true
		}, {
			field: 'classid',
			title: '类别',
			align: 'center',
			visible: true,
			formatter: (value) => {
				return QZone.Photos.Class[value] || "其他";
			}
		}], QZone.Photos && QZone.Photos.Album || []);

		// 初始化视频表格
		readerTable("videos-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'desc',
			title: '描述',
			align: 'left',
			formatter: (value, row) => {
				value = value || API.Utils.formatDate(row.uploadTime);
				value = API.Utils.formatContent(value, "HTML");
				const target = row.shuoshuoid ? API.Messages.getUniKey(row.shuoshuoid) : API.Videos.getVideoUrl(row);
				return '<a target="_brank" href="{0}" data-toggle="tooltip" data-placement="right" data-html="true" title="{1}" >{2}</a>'.format(target, value, value);
			}
		}, {
			field: 'uploadTime',
			title: '上传时间',
			align: 'left',
			formatter: (value) => {
				return API.Utils.formatDate(value);
			}
		}, {
			field: 'url',
			title: '链接',
			align: 'center',
			formatter: (value) => {
				return '<a target="_brank" href="{0}" >查看</a> '.format(value);
			}
		}], QZone.Videos && QZone.Videos.Data || []);

		// 初始化留言板表格
		readerTable("boards-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'nickname',
			title: '发布人',
			align: 'center',
			width: "200",
			formatter: (value, row, index, field) => {
				return API.Common.getUserLink(row.uin, API.Utils.formatContent(value, "HTML"));
			}
		}, {
			field: 'htmlContent',
			title: '内容',
			align: 'left',
			width: "60",
			widthUnit: "%",
			formatter: (value, row, index, field) => {
				return API.Utils.formatContent(value, "HTML");
			}
		}, {
			field: 'pubtime',
			title: '发布时间',
			align: 'center',
			width: "200"
		}], QZone.Boards && QZone.Boards.Data || []);

		// 初始化好友表格
		readerTable("friends-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'uin',
			title: 'QQ号',
			align: 'center',
			formatter: (value) => {
				return API.Common.getUserLink(value, value);
			}
		}, {
			field: 'name',
			title: '昵称',
			align: 'center'
		}, {
			field: 'remark',
			title: '备注',
			align: 'center'
		}, {
			field: 'groupName',
			title: '所属分组',
			align: 'center'
		}, {
			field: 'addFriendTime',
			title: '相识时间',
			align: 'center'
		}], QZone.Friends && QZone.Friends.Data || []);

		// 初始化收藏夹表格
		readerTable("favorites-table", [{
			checkbox: true,
			clickToSelect: true,
			width: "50"
		}, {
			field: 'custom_abstract',
			title: '内容',
			align: 'left',
			formatter: (value, row) => {
				value = value || API.Favorites.getType(row.type);
				return API.Utils.formatContent(value, "HTML");
			},
			detailFormatter: (index, row) => {
				return "详情";
			}
		}, {
			field: 'type',
			title: '类别',
			align: 'center',
			width: "100",
			formatter: (value) => {
				return API.Favorites.getType(value);
			}
		}, {
			field: 'custom_create_time',
			title: '收藏时间',
			align: 'center',
			width: "200"
		}], QZone.Favorites && QZone.Favorites.Data || [], {
			detailView: true,
			detailViewByClick: true,
		});

	});
})()
