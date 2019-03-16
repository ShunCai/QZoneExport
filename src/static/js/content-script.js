const MODAL_HTML = `
    <div class="modal">
        </br>
        </br>
        <h3 id="backupStatus">正在备份，请不要关闭或刷新当前页面</h3>
        <br/>
        <hr/>
        <br/>
        <p id="backupProgress">导出 -/- 篇文章，正在下载 - 张图片，已下载 - 张图片，失败 - 张图片</p>
        <br/>
        <br/>
        <button id="downloadBtn" class="btn btn-primary">下载备份</button>
    </div>
    `
const README_TEXT = `
目录格式：

QQ空间备份
|--- 说明.txt
└--- 日志
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    |--- 日志A.md
    |--- 日志B.md
    |--- ...
└--- 日记
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    |--- 日记A.md
    |--- 日记B.md
    |--- ...
└--- 相册
    └--- 相册A
        |--- 图片A
        |--- 图片B
        └---- ....
└--- 说说
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    └--- 说说.md
└--- 留言板
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    └--- 留言板.md
└--- 好友
    └--- 好友.xlsx
└--- 群组
    └--- 群组.xlsx


Windows 推荐使用 [MarkdownPad](http://markdownpad.com/)
MacOS 推荐使用 [MacDown](http://macdown.uranusjr.com/)
`

operator = createOperator();
statusIndicator = createStatusIndicator();

$(document).ready(
    function () {
        operator.done('ready');
    }
);
/**
 * 创建备份流程控制者
 */
function createOperator() {
    var o = new Object();
    o.done = async function (procedure) {
        switch (procedure) {
            case 'ready':
                init();
                break;
            case 'start_trigger':
                // 显示模态对话框并且开始获取日志列表
                showModal();
                initFolder();
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                fetchAllBlogList();
                break;
            case 'fetch_blog_list':
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                fetchAllBlog();
                break;
            case 'fetch_blog':
                // 如果图片还没下载完，弄个会动的提示，让用户知道不是页面卡死
                //var completed = statusIndicator.downloadedImageCnt + statusIndicator.failedImageCnt;
                var blogCompletedTime = Date.now(); // 等待超时统计
                var isCancel = false;
                while (statusIndicator.downloadingImageCnt > 0 && !isCancel) {
                    var cost = (Date.now() - blogCompletedTime) / 1000;
                    if (cost > 30) {
                        isCancel = true;
                        // 超过60秒仍未处理完成，则自动取消
                        statusIndicator.canceledImageCnt = statusIndicator.downloadingImageCnt;
                        statusIndicator.updateTitle("网络似乎存在点问题，正在取消剩余图片下载..." + dot);
                        statusIndicator.update();
                    }
                    var dot = '';
                    if (Math.random() > 0.5) {
                        dot = '...'
                    };
                    statusIndicator.updateTitle("还没下载完图片， 等一等..." + dot);
                    await API.Utils.sleep(CONFIG.SLEEP_TIME);
                }
                // 压缩
                API.Utils.Zip(FOLDER_ROOT, () => {
                    operator.done("zip");
                }, (error) => {
                    console.error(err);
                });
                break;
            case 'zip':
                // 延迟0.5秒，确保压缩完
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                statusIndicator.showDownload();
                break;
        }
    };

    o.downloadImage = async function (url, savePath) {
        statusIndicator.imageStartDownload();
        API.Utils.writeImage(url, savePath, (fileEntry) => {
            if (CONFIG.DEBUG) {
                console.log(fileEntry);
            }
            statusIndicator.imageDownloadSuccess();
        }, (e) => {
            console.error(e);
            statusIndicator.imageDownloadFailed();
        });
    };
    return o;
}

/**
 * 创建状态更新指示器
 */
function createStatusIndicator() {
    var o = new Object();
    o.downloadingImageCnt = 0;
    o.downloadedImageCnt = 0;
    o.canceledImageCnt = 0;
    o.failedImageCnt = 0;
    o.downloadedBlogCnt = 0;

    o.update = function () {
        $("#backupProgress").text("导出 " + this.downloadedBlogCnt + "/" + QZone.Blogs.Data.length + " 篇文章，已下载 " + this.downloadedImageCnt + " 张图片，已失败 " + this.failedImageCnt + " 张图片，已取消 " + this.canceledImageCnt + " 张图片");
    }

    o.showDownload = function () {
        $("#downloadBtn").show();
        $("#backupStatus").html("备份完成");
    }

    o.updateTitle = function (title) {
        $("#backupStatus").html(title);
    }

    o.blogDownloaded = function () {
        this.downloadedBlogCnt += 1;
        this.update();
    }

    o.imageStartDownload = function () {
        this.downloadingImageCnt += 1;
    }

    o.imageDownloadFailed = function () {
        this.downloadingImageCnt -= 1;
        this.failedImageCnt += 1;
        this.update();
    }

    o.imageDownloadSuccess = function () {
        this.downloadingImageCnt -= 1;
        this.downloadedImageCnt += 1;
        this.update();
    }

    return o;
}

/**
 * 初始化
 */
function init() {
    // 获取Token
    API.Utils.getQzoneToken();
    // 获取QQ号
    API.Utils.getUin();

    // 初始化文件夹
    initializeFiler();

    // 初始化压缩工具
    QZone.Common.Zip = new JSZip();

    // 添加按钮监听
    chrome.runtime.onMessage.addListener(function (msg, sender) {
        if (msg.from === 'popup' && msg.subject === 'startBackup') {
            operator.done('start_trigger');
        }
    });
}

/**
 * 创建并显示模态对话框
 *
 * 状态显示，错误信息，下载都在这里显示
 */
function showModal() {
    $('body').append(MODAL_HTML);
    $('.modal').modal({});
    $('#downloadBtn').hide();

    var blobLink = $('#downloadBtn');
    var downloadWithBlob = function () {
        blobLink.attr('disabled', true);
        blobLink.text('正在下载...');
        // 压缩
        QZone.Common.Zip.generateAsync({ type: "blob" }).then(function (blob) {
            saveAs(blob, QZone.ZIP_NAME);
            blobLink.text('已导出');
        }, (err) => {
            blobLink.innerHTML += " " + err;
        });
        return false;
    }

    blobLink.click(downloadWithBlob);
}

/**
 * 初始化Filesystem，删除文件夹
 */
function initializeFiler() {
    QZone.Common.Filer = new Filer();

    QZone.Common.Filer.init({ persistent: false, size: 300 * 1024 * 1024 }, function (fs) {
        QZone.Common.Filer.ls(FOLDER_ROOT, function (entries) {
            if (CONFIG.DEBUG) {
                console.info(entries);
            }
            QZone.Common.Filer.rm(FOLDER_ROOT, function () {
                if (CONFIG.DEBUG) {
                    console.info("删除成功：" + FOLDER_ROOT);
                }
            }, function (error) {
                console.error("删除失败：" + error);
            });
        }, function (error) {
            console.warn("获取文件失败：" + error);
        });
    });
}

/**
 * 创建在Filesystem临时文件夹
 */
function initFolder() {

    // 切换到根目录
    QZone.Common.Filer.cd('/', () => {
        console.info('切换工作空间成功');
    });

    // 创建所有模块的目录
    for (x in QZone) {
        let obj = QZone[x];
        if (typeof (obj) !== "object") {
            continue;
        }
        let imgRoot = obj['IMAGES_ROOT'];
        if (!imgRoot) {
            continue;
        }
        QZone.Common.Filer.mkdir(imgRoot, false, (entry) => {
            console.info('创建目录成功：' + entry.fullPath);
        });
    }

    // 创建说明文件
    QZone.Common.Filer.write(FOLDER_ROOT + "说明.txt", { data: README_TEXT, type: "text/plain" }, (entry) => {
        console.info('创建文件成功：' + entry.fullPath);
    });
};

/**
 * 获取全部日志列表
 */
function fetchAllBlogList() {
    // 重置数据
    QZone.Blogs.Data = [];
    QZone.Blogs.Images = [];

    // 获取数据
    var nextListFunc = function (page, result, err) {
        statusIndicator.update();
        // TODO error
        if (QZone.Blogs.Data.length < QZone.Blogs.total) {
            // 总数不相等时继续获取
            fetchBlogList(QZone.Common.uin, page + 1, arguments.callee);
        } else {
            // 告知完成获取列表
            operator.done("fetch_blog_list");
        }
    }
    fetchBlogList(QZone.Common.uin, 0, nextListFunc);
}

/**
 * 获得所有日志
 */
function fetchAllBlog() {
    // 获取数据
    var nextBlogFunc = function (idx, err) {
        if (QZone.Blogs.Data.length > idx + 1) {
            fetchBlog(QZone.Common.uin, idx + 1, arguments.callee);
        } else {
            // 告知完成获取所有博客
            operator.done("fetch_blog");
        }
    }
    nextBlogFunc(-1, null);
}

/**
 * 获取一页日志列表
 *
 * 追加到 QZone.Blogs.Data 数组
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
function fetchBlogList(uin, page, nextFunc) {
    API.Blogs.getBlogs(uin, page, function (data) {
        // 去掉函数，保留json
        data = data.replace(/^_Callback\(/, "");
        data = data.replace(/\);$/, "");
        result = JSON.parse(data);
        QZone.Blogs.total = result.data.totalNum;
        result.data.list.forEach(function (item) {
            var i = {
                blogId: item.blogId,
                pubTime: item.pubTime,
                title: item.title
            };
            QZone.Blogs.Data.push(i);
        });

        nextFunc(page, result, null);
    }, nextFunc);
}


/**
 * 获取一篇日志的内容
 * 
 * @param {string} uin QQ号 
 * @param {integer} idx 日志列表中的第几篇日志
 * @param {function} nextFunc 获取完后执行的函数
 */
function fetchBlog(uin, idx, nextFunc) {
    let blogid = QZone.Blogs.Data[idx].blogId;
    let postTime = QZone.Blogs.Data[idx].pubTime;
    let title = QZone.Blogs.Data[idx].title;

    API.Blogs.getInfo(uin, blogid, function (data) {
        let blogPage = jQuery(data);
        let blogData = null;
        let blogInfo = {}

        // 获得网页里的JSON数据
        blogPage.find('script').each(function (index) {
            let t = $(this).text();
            if (t.indexOf('g_oBlogData') !== -1) {
                let dataM = /var g_oBlogData\s+=\s+({[\s\S]+});\s/;
                blogData = dataM.exec(t);
                if (blogData != null) {
                    return false;
                }
            }
        });

        if (blogData != null) {
            blogInfo = JSON.parse(blogData[1])
        }

        // 获得日志正文
        let blogContentHtml = blogPage.find("#blogDetailDiv:first").html();

        let turndownService = new TurndownService();
        let markdown = turndownService.turndown(blogContentHtml);
        if (markdown) {
            // 合并标题正文评论
            let content = constructBlog(idx, title, postTime, markdown, blogInfo);
            saveBlog(idx, title, postTime, content);
            nextFunc(idx, null);
        } else {
            nextFunc(idx, err);
        }

    }, nextFunc);
}


/**
 * 拼接出一篇markdown格式的日志，包含标题，正文，评论等; 会将网络图片下载下来作为本地图片
 * 
 * @param {string} title 日志标题
 * @param {string} postTime 日志发表时间，从QQ空间API里获得的
 * @param {string} markdown 转换为 mardown 格式的日志
 * @param {dictionary} blogInfo 日志的信息，用于获取评论 
 */
function constructBlog(index, title, postTime, markdown, blogInfo) {
    // 拼接标题，日期，内容
    let result = "# " + title + "\r\n\r\n";
    result = result + postTime + "\r\n\r\n";
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "### 评论:\r\n\r\n";
    blogInfo.data.comments.forEach(function (entry) {
        let content = "* " + entry.poster.name + ": " + API.Blogs.parseMentionFormat(entry.content, 'MD') + "\r\n";
        entry.replies.forEach(function (rep) {
            let c = "\t* " + rep.poster.name + ": " + API.Blogs.parseMentionFormat(rep.content, 'MD') + "\r\n";
            content = content + c;
        });
        result = result + content;
    });

    // 转为本地图片
    let imageLinkM = /!\[.*?\]\((.+?)\)/g;
    let match;
    let tmpResult = result;
    let images = [];
    while (match = imageLinkM.exec(tmpResult)) {
        var imageInfo = {};
        imageInfo.filename = postTime + "_" + API.Utils.guid();
        imageInfo.filename = API.Utils.filenameValidate(imageInfo.filename);
        imageInfo.filepath = QZone.Blogs.IMAGES_ROOT + "/" + imageInfo.filename;
        result = result.split(match[1]).join("images/" + imageInfo.filename);
        // imageInfo.url = API.Photos.getExternalUrl(match[1]) || match[1].replace(/http:\//, "https:/");
        imageInfo.url = match[1].replace(/http:\//, "https:/");
        imageInfo.title = title;
        imageInfo.title = title;
        images.push(imageInfo);
        QZone.Blogs.Images.push(imageInfo);

    }
    QZone.Blogs.Data[index].images = images;
    for (let i = 0; i < images.length; i++) {
        let imageInfo = images[i];
        operator.downloadImage(imageInfo.url, imageInfo.filepath, title);
    }
    return result;
}

/**
 * 保存日志到 HTML5 filesystem
 * 
 * @param {string} title 
 * @param {string} postTime 
 * @param {string} content 
 */
function saveBlog(idx, title, postTime, content) {
    let filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    let orderNum = API.Utils.prefixNumber(idx + 1, QZone.Blogs.total.toString().length);
    filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    filepath = QZone.Blogs.ROOT + '/' + filename + ".md";

    API.Utils.writeFile(content, filepath, (fileEntry) => {
        if (CONFIG.DEBUG) {
            console.info('已保存：' + fileEntry.fullPath);
        }
        statusIndicator.blogDownloaded();
    }, (error) => {
        console.error(error);
    });
}