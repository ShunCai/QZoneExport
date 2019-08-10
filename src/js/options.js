// 默认配置
var Qzone_Config = {
	// 说说模块
	Messages: {
		exportType: "markdown",
		querySleep: 2,
		pageSize: 40,
		isDownloadImgages: true,
		isDownloadVideo: false,
		isDownloadMusic: false
	},
	// 日志模块
	Blogs: {
		exportType: "markdown",
		querySleep: 2,
		pageSize: 50,
		isDownloadImgages: true,
		isDownloadVideo: false,
		isDownloadMusic: false
	},
	// 私密日记模块
	Diaries: {
		exportType: "markdown",
		querySleep: 2,
		pageSize: 50,
		isDownloadImgages: true,
		isDownloadVideo: false,
		isDownloadMusic: false
	},
	// 相册模块
	Photos: {
		exportType: "file",
		querySleep: 2,
		pageSize: 90,
		downCount: 5,
		isDownloadOriginal: true,
		isWriteExif: false
	},
	// 视频模块
	Videos: {
		exportType: "downlist",
		querySleep: 2,
		pageSize: 20
	},
	// 留言板模块
	Boards: {
		exportType: "markdown",
		querySleep: 2,
		pageSize: 20,
		isDownloadImgages: true
	},
	// QQ好友模块
	Friends: {
		exportType: "excel"
	}
};

document.addEventListener('DOMContentLoaded', function () {
	// 读取数据，第一个参数是指定要读取的key以及设置默认值
	chrome.storage.local.get(Qzone_Config, function (item) {
		// 说说模块赋值
		$("input[type='radio'][name='messages_exportFormat'][value='" + item.Messages.exportType + "']").attr("checked", "checked");
		$("#messages_list_cost").val(item.Messages.querySleep);
		$("#messages_list_limit").val(item.Messages.pageSize);
		$("#messages_download_images").attr("checked", item.Messages.isDownloadImgages);
		$("#messages_download_video").attr("checked", item.Messages.isDownloadVideo);
		$("#messages_download_music").attr("checked", item.Messages.isDownloadMusic);

		// 日志模块赋值
		$("input[type='radio'][name='blogs_exportFormat'][value='" + item.Blogs.exportType + "']").attr("checked", "checked");
		$("#blogs_list_cost").val(item.Blogs.querySleep);
		$("#blogs_list_limit").val(item.Blogs.pageSize);
		$("#blogs_download_images").attr("checked", item.Blogs.isDownloadImgages);
		$("#blogs_download_video").attr("checked", item.Blogs.isDownloadVideo);
		$("#blogs_download_music").attr("checked", item.Blogs.isDownloadMusic);

		// 私密日志赋值
		$("input[type='radio'][name='diaries_exportFormat'][value='" + item.Diaries.exportType + "']").attr("checked", "checked");
		$("#diaries_list_cost").val(item.Diaries.querySleep);
		$("#diaries_list_limit").val(item.Diaries.pageSize);
		$("#diaries_download_images").attr("checked", item.Diaries.isDownloadImgages);
		$("#diaries_download_video").attr("checked", item.Diaries.isDownloadVideo);
		$("#diaries_download_music").attr("checked", item.Diaries.isDownloadMusic);

		// 相册模块赋值
		$("input[type='radio'][name='photos_exportFormat'][value='" + item.Photos.exportType + "']").attr("checked", "checked");
		$("#photos_list_cost").val(item.Photos.querySleep);
		$("#photos_list_limit").val(item.Photos.pageSize);
		$("#photos_down_limit").val(item.Photos.downCount);
		$("#photos_download_orgimages").attr("checked", item.Photos.isDownloadOriginal);
		$("#photos_download_exifimages").attr("checked", item.Photos.isWriteExif);

		// 视频模块赋值
		$("input[type='radio'][name='videos_exportFormat'][value='" + item.Videos.exportType + "']").attr("checked", "checked");
		$("#videos_list_cost").val(item.Videos.querySleep);
		$("#videos_list_limit").val(item.Videos.pageSize);

		// 留言板赋值
		$("input[type='radio'][name='boards_exportFormat'][value='" + item.Boards.exportType + "']").attr("checked", "checked");
		$("#boards_list_cost").val(item.Boards.querySleep);
		$("#boards_list_limit").val(item.Boards.pageSize);
		$("#boards_download_images").attr("checked", item.Boards.isDownloadImgages);

		// 好友模块
		$("input[type='radio'][name='friends_exportFormat'][value='" + item.Friends.exportType + "']").attr("checked", "checked");
	});
});
$('#saveQzoneConfig').click(() => {

	// 说说模块赋值
	Qzone_Config.Messages.exportType = $("input[type='radio'][name='messages_exportFormat']").val();
	Qzone_Config.Messages.querySleep = $("#messages_list_cost").val();
	Qzone_Config.Messages.pageSize = $("#messages_list_limit").val();
	Qzone_Config.Messages.isDownloadImgages = $("#messages_download_images").prop("checked");
	Qzone_Config.Messages.isDownloadVideo = $("#messages_download_video").prop("checked");
	Qzone_Config.Messages.isDownloadMusic = $("#messages_download_music").prop("checked");

	// 日志模块赋值
	Qzone_Config.Blogs.exportType = $("input[type='radio'][name='blogs_exportFormat']").val();
	Qzone_Config.Blogs.querySleep = $("#blogs_list_cost").val();
	Qzone_Config.Blogs.pageSize = $("#blogs_list_limit").val();
	Qzone_Config.Blogs.isDownloadImgages = $("#blogs_download_images").prop("checked");
	Qzone_Config.Blogs.isDownloadVideo = $("#blogs_download_video").prop("checked");
	Qzone_Config.Blogs.isDownloadMusic = $("#blogs_download_music").prop("checked");

	// 私密日志赋值
	Qzone_Config.Diaries.exportType = $("input[type='radio'][name='diaries_exportFormat']").val();
	Qzone_Config.Diaries.querySleep = $("#diaries_list_cost").val();
	Qzone_Config.Diaries.pageSize = $("#diaries_list_limit").val();
	Qzone_Config.Diaries.isDownloadImgages = $("#diaries_download_images").prop("checked");
	Qzone_Config.Diaries.isDownloadVideo = $("#diaries_download_video").prop("checked");
	Qzone_Config.Diaries.isDownloadMusic = $("#diaries_download_music").prop("checked");

	// 相册模块赋值
	Qzone_Config.Photos.exportType = $("input[type='radio'][name='photos_exportFormat']").val();
	Qzone_Config.Photos.querySleep = $("#photos_list_cost").val();
	Qzone_Config.Photos.pageSize = $("#photos_list_limit").val();
	Qzone_Config.Photos.downCount = $("#photos_down_limit").val();
	Qzone_Config.Photos.isDownloadOriginal = $("#photos_download_orgimages").prop("checked");
	Qzone_Config.Photos.isWriteExif = $("#photos_download_exifimages").prop("checked");

	// 视频模块赋值
	Qzone_Config.Videos.exportType = $("input[type='radio'][name='videos_exportFormat']").val();
	Qzone_Config.Videos.querySleep = $("#videos_list_cost").val();
	Qzone_Config.Videos.pageSize = $("#videos_list_limit").val();

	// 留言板赋值
	Qzone_Config.Boards.exportType = $("input[type='radio'][name='boards_exportFormat']").val();
	Qzone_Config.Boards.querySleep = $("#boards_list_cost").val();
	Qzone_Config.Boards.pageSize = $("#boards_list_limit").val();
	Qzone_Config.Boards.isDownloadImgages = $("#boards_download_images").prop("checked");

	// 好友模块
	Qzone_Config.Friends.exportType = $("input[type='radio'][name='friends_exportFormat']").val();

	chrome.storage.local.set(Qzone_Config, function () {
		console.info("保存成功！");
	});
})