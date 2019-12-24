document.addEventListener('DOMContentLoaded', function () {

	// 定位Tab页
	if (window.location.hash === "") {
		window.location.hash = "#v-pills-settings-tab";
	}

	$(window.location.hash).tab('show');

	$('#v-pills-tab a').on('click', function (e) {
		e.preventDefault();
		window.location.hash = "#" + this.id;
	});

	// 读取数据，第一个参数是指定要读取的key以及设置默认值
	chrome.storage.sync.get(Qzone_Config, function (Qzone_Config) {
		// 说说模块赋值
		$("#messages_exportFormat").val(Qzone_Config.Messages.exportType);
		$("#messages_list_cost").val(Qzone_Config.Messages.querySleep);
		$("#messages_list_limit").val(Qzone_Config.Messages.pageSize);

		// 日志模块赋值
		$("#blogs_exportFormat").val(Qzone_Config.Blogs.exportType);
		$("#blogs_list_cost").val(Qzone_Config.Blogs.querySleep);
		$("#blogs_list_limit").val(Qzone_Config.Blogs.pageSize);

		// 私密日志赋值
		$("#diaries_exportFormat").val(Qzone_Config.Diaries.exportType);
		$("#diaries_list_cost").val(Qzone_Config.Diaries.querySleep);
		$("#diaries_list_limit").val(Qzone_Config.Diaries.pageSize);

		// 相册模块赋值
		$("#photos_exportFormat").val(Qzone_Config.Photos.exportType);
		$("#photos_list_cost").val(Qzone_Config.Photos.querySleep);
		$("#photos_list_limit").val(Qzone_Config.Photos.pageSize);
		$("#photos_down_limit").val(Qzone_Config.Photos.downCount);
		$("#photos_exifType").val(Qzone_Config.Photos.exifType);

		// 视频模块赋值
		$("#videos_exportFormat").val(Qzone_Config.Videos.exportType);
		$("#videos_list_cost").val(Qzone_Config.Videos.querySleep);
		$("#videos_list_limit").val(Qzone_Config.Videos.pageSize);

		// 留言板模块赋值
		$("#boards_exportFormat").val(Qzone_Config.Boards.exportType);
		$("#boards_list_cost").val(Qzone_Config.Boards.querySleep);
		$("#boards_list_limit").val(Qzone_Config.Boards.pageSize);

		// 好友模块赋值
		$("input[type='radio'][name='friends_exportFormat'][value='" + Qzone_Config.Friends.exportType + "']").attr("checked", "checked");

		// 收藏夹模块赋值
		$("#favorites_exportFormat").val(Qzone_Config.Favorites.exportType);
		$("#favorites_list_cost").val(Qzone_Config.Favorites.querySleep);
		$("#favorites_list_limit").val(Qzone_Config.Favorites.pageSize);

	});



	$('#saveQzoneConfig').click(() => {

		// 说说模块赋值
		Qzone_Config.Messages.exportType = $("#messages_exportFormat").val();
		Qzone_Config.Messages.querySleep = $("#messages_list_cost").val();
		Qzone_Config.Messages.pageSize = $("#messages_list_limit").val();

		// 日志模块赋值
		Qzone_Config.Blogs.exportType = $("#blogs_exportFormat").val();
		Qzone_Config.Blogs.querySleep = $("#blogs_list_cost").val();
		Qzone_Config.Blogs.pageSize = $("#blogs_list_limit").val();

		// 私密日志赋值
		Qzone_Config.Diaries.exportType = $("#diaries_exportFormat").val();
		Qzone_Config.Diaries.querySleep = $("#diaries_list_cost").val();
		Qzone_Config.Diaries.pageSize = $("#diaries_list_limit").val();

		// 相册模块赋值
		Qzone_Config.Photos.exportType = $("#photos_exportFormat").val();
		Qzone_Config.Photos.querySleep = $("#photos_list_cost").val();
		Qzone_Config.Photos.pageSize = $("#photos_list_limit").val();
		Qzone_Config.Photos.downCount = $("#photos_down_limit").val();
		Qzone_Config.Photos.exifType = $("#photos_exifType").val();

		// 视频模块赋值
		Qzone_Config.Videos.exportType = $("#videos_exportFormat").val();
		Qzone_Config.Videos.querySleep = $("#videos_list_cost").val();
		Qzone_Config.Videos.pageSize = $("#videos_list_limit").val();

		// 留言板模块赋值
		Qzone_Config.Boards.exportType = $("#boards_exportFormat").val();
		Qzone_Config.Boards.querySleep = $("#boards_list_cost").val();
		Qzone_Config.Boards.pageSize = $("#boards_list_limit").val();

		// 好友模块赋值
		Qzone_Config.Friends.exportType = $("#friends_exportFormat").val();

		// 收藏夹模块赋值
		Qzone_Config.Favorites.exportType = $("#favorites_exportFormat").val();
		Qzone_Config.Favorites.querySleep = $("#favorites_list_cost").val();
		Qzone_Config.Favorites.pageSize = $("#favorites_list_limit").val();

		chrome.storage.sync.set(Qzone_Config, function () {
			console.info("保存成功！");
		});

	})

	const readerTable = (tableId, columns, data) => {
		$("#" + tableId).bootstrapTable('destroy').bootstrapTable({
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
			// virtualScroll: true,
			// showExport: false,
			// exportDataType: 'all',
			// exportTypes: ['json', 'xml', 'csv', 'txt', 'excel'],
			toolbar: "#" + tableId + "-toolbar",
			toolbarAlign: "left",
			// filterControl: true,
			columns: columns || [],
			data: data || []
		})
		$("#" + tableId).bootstrapTable('resetView')
	}

	// 读取数据
	chrome.storage.local.get(QZone, function (QZone) {


		// 设置目标信息
		$("#qzone_title").text(QZone.Common.Target.title);


		// 初始化说说表格
		readerTable("messages-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'content',
			title: '内容',
			titleTooltip: '内容',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return API.Utils.formatContent(value, "HTML");
			}
		}, {
			field: 'createTime',
			title: '发布时间',
			titleTooltip: '发布时间',
			align: 'center',
			// filterControl: "datepicker",
			// filterDatepickerOptions:{
			// 	language:"zh-CN",
			// 	autoclose:true, 
			// 	clearBtn: true, 
			// 	todayHighlight: true
			// },
			visible: true
		}, {
			field: 'rt_uin',
			title: '类型',
			titleTooltip: '类型',
			align: 'center',
			visible: true,
			formatter: (value, row, index, field) => {
				return row.rt_uin ? '转发' : '原创';
			}
		}, {
			field: 'location.name',
			title: '位置',
			titleTooltip: '发布时间',
			align: 'center',
			visible: true
		}], QZone.Messages && QZone.Messages.Data || []);

		// 初始化日志表格
		readerTable("blogs-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'title',
			title: '标题',
			titleTooltip: '标题',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return '<a target="_brank" href="http://user.qzone.qq.com/{0}/blog/{1}" >{2}</a> '.format(QZone.Common.Target.uin, row.blogId, value);
			}
		}, {
			field: 'cate',
			title: '类别',
			titleTooltip: '类别',
			align: 'center',
			visible: true
		}, {
			field: 'pubTime',
			title: '发布时间',
			titleTooltip: '发布时间',
			align: 'center',
			visible: true
		}], QZone.Blogs && QZone.Blogs.Data || []);

		// 初始化私密日志表格
		readerTable("diaries-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'title',
			title: '标题',
			titleTooltip: '标题',
			align: 'left',
			visible: true
		}, {
			field: 'pubTime',
			title: '发布时间',
			titleTooltip: '发布时间',
			align: 'center',
			visible: true
		}], QZone.Diaries && QZone.Diaries.Data || []);

		// 初始化相册表格
		readerTable("photos-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'name',
			title: '名称',
			titleTooltip: '名称',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return '<a target="_brank" href="https://user.qzone.qq.com/{0}/photo/{1}" >{2}</a> '.format(QZone.Common.Target.uin, row.id, value);
			}
		}, {
			field: 'desc',
			title: '描述',
			titleTooltip: '描述',
			align: 'left',
			filterControl: "input",
			visible: true
		}, {
			field: 'image',
			title: '预览',
			titleTooltip: '预览',
			align: 'center',
			filterControl: "input",
			visible: true
		}, {
			field: 'total',
			title: '数量',
			titleTooltip: '数量',
			align: 'center',
			visible: true
		}, {
			field: 'classid',
			title: '类别',
			titleTooltip: '类别',
			align: 'center',
			visible: true,
			filterControl: "select",
			formatter: (value, row, index, field) => {
				return QZone.Photos.ClassMap[value] || "其他";
			}
		}], QZone.Photos && QZone.Photos.Album || []);

		// 初始化视频表格
		readerTable("videos-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'desc',
			title: '描述',
			titleTooltip: '描述',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return API.Utils.formatContent(value, "HTML");
			}
		}, {
			field: 'uploadTime',
			title: '上传时间',
			titleTooltip: '上传时间',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return new Date(value * 1000).format("yyyy-MM-dd hh:mm:ss");
			}
		}, {
			field: 'url',
			title: '链接',
			titleTooltip: '链接',
			align: 'center',
			visible: true,
			formatter: (value, row, index, field) => {
				return '<a target="_brank" href="{0}" >查看</a> '.format(value);
			}
		}], QZone.Videos && QZone.Videos.Data || []);

		// 初始化留言板表格
		readerTable("boards-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'nickname',
			title: '发布人',
			titleTooltip: '发布人',
			align: 'center',
			visible: true,
			formatter: (value, row, index, field) => {
				return API.Utils.getUserLink(row.uin, value);
			}
		}, {
			field: 'htmlContent',
			title: '内容',
			titleTooltip: '内容',
			align: 'left',
			visible: true,
			formatter: (value, row, index, field) => {
				return API.Utils.formatContent(value, "HTML");
			}
		}, {
			field: 'pubtime',
			title: '发布时间',
			titleTooltip: '发布时间',
			align: 'center',
			visible: true
		}], QZone.Boards && QZone.Boards.Data || []);

		// 初始化好友表格
		readerTable("friends-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'uin',
			title: 'QQ号',
			titleTooltip: 'QQ号',
			align: 'center',
			visible: true,
			formatter: (value, row, index, field) => {
				return API.Utils.getUserLink(value, value);
			}
		}, {
			field: 'name',
			title: '昵称',
			titleTooltip: '昵称',
			align: 'center',
			visible: true
		}, {
			field: 'remark',
			title: '备注',
			titleTooltip: '备注',
			align: 'center',
			visible: true
		}, {
			field: 'groupName',
			title: '所属分组',
			titleTooltip: '所属分组',
			align: 'center',
			visible: true
		}, {
			field: 'addFriendTime',
			title: '相识时间',
			titleTooltip: '相识时间',
			align: 'center',
			visible: true
		}], QZone.Friends && QZone.Friends.Data || []);

		// 初始化收藏夹表格
		readerTable("favorites-table", [{
			checkbox: true,
			clickToSelect: true
		}, {
			field: 'content',
			title: '内容',
			titleTooltip: '内容',
			align: 'center',
			width: '30%',
			visible: true
		}, {
			field: 'category',
			title: '类别',
			titleTooltip: '类别',
			align: 'center',
			width: '30%',
			visible: true
		}, {
			field: 'createTime',
			title: '收藏时间',
			titleTooltip: '收藏时间',
			align: 'center',
			width: '30%',
			visible: true
		}], QZone.Favorites && QZone.Favorites.Data || []);

	});
});