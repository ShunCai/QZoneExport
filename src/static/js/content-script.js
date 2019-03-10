const DEBUG = true;
const BLOG_PER_PAGE = 15;
const IMAGE_FOLDER_NAME = 'image';
const MODAL_HTML = `
    <div class="modal">
        </br>
        </br>
        <h3 id="backupStatus">正在备份，请不要关闭或刷新当前页面</h3>
        <br/>
        <hr/>
        <br/>
        <p id="backupProgress">导出 -/- 篇文章，下载 - 张图片，失败 - 张图片</p>
        <br/>
        <br/>
        <button id="downloadBtn" class="btn btn-primary">下载备份</button>
    </div>
    `
const README_TEXT = `
目录格式：

qzone-xxxxx (xxx 是QQ号）
|--- 说明.txt
└--- blog (日志)
    └--- image (图片)
        |--- 2007-01-01_00-00_xxxx-xxx-xx-xx (这是图片，可能是jpg，png，gif或webp格式）
        |--- 2007-01-01_00-01_xxxx-xxx-xx-xx
        └---- ....
    |--- 2007-01-01_00-00-日志标题1.md (这是日志正文和评论，markdown格式，记事本也可以打开）
    |--- 2007-01-01_00-01-日志标题2.md
    |--- ...
    └--- 2007-01-01_00-0n-日志标题n.md

Windows 推荐使用 [MarkdownPad](http://markdownpad.com/)， MacOS 推荐使用 [MacDown](http://macdown.uranusjr.com/) 来打开 .md 文件。

直接用记事本也可以打开 .md 文件，但看不到图片。
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
                initialize();
                break;
            case 'start_trigger':
                // 显示模态对话框并且开始获取日志列表
                showModal();
                buildFolder();
                await APP.Common.sleep(30);
                fetchAllBlogList();
                break;
            case 'fetch_blog_list':
                await APP.Common.sleep(500);
                fetchAllBlog();
                break;
            case 'fetch_blog':
                // 如果图片还没下载完，弄个会动的提示，让用户知道不是页面卡死
                while (statusIndicator.downloadingImageCnt > 0) {
                    var dot = '';
                    if (Math.random() > 0.5) {
                        dot = '...'
                    };
                    statusIndicator.updateTitle("还没下载完图片， 等一等..." + dot);
                    await APP.Common.sleep(500);
                }
                zipQzone();
                break;
            case 'zip':
                // 延迟0.5秒，确保压缩完
                await APP.Common.sleep(500);
                statusIndicator.showDownload();
                break;
        }
    };

    o.downloadImage = async function (url, savePath, title) {
        downloadImage(url, savePath, title);
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
    o.failedImageCnt = 0;
    o.downloadedBlogCnt = 0;

    o.hasError = function (msg) {
        $("#errorMessage").append("<p>" + msg + "</p>");
    };

    o.update = function () {
        $("#backupProgress").text("导出 " + this.downloadedBlogCnt + "/" + window.qzone.blog.list.length + " 篇文章，下载 " + this.downloadedImageCnt + " 张图片，失败 " + this.failedImageCnt + " 张图片");
    }

    o.showDownload = function () {
        $("#downloadBtn").show();
        $("#backupStatus").text("备份完成");
    }

    o.updateTitle = function (title) {
        $("#backupStatus").text(title);
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
 * 初始化，获得必须的token，qq号，初始化变量，文件夹等
 */
function initialize() {
    window.qzone = new Object();
    window.qzone.blog = {};

    APP.Common.getQzoneToken();
    APP.Common.getUin();

    window.qzone.fsRoot = "/QQ空间导出-" + window.qzone.uin + "/";
    window.qzone.blog.root = window.qzone.fsRoot + "blog/";
    window.qzone.blog.imgRoot = window.qzone.blog.root + IMAGE_FOLDER_NAME + "/";
    window.qzone.blog.list = [];

    initializeFiler();

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
        blobLink.text('正在生成压缩文件...');
        window.qzone.zip.generateAsync({ type: "blob" }).then(function (blob) {
            saveAs(blob, "QQ空间导出-" + window.qzone.uin + ".zip");
            blobLink.text('已导出');
        }, function (err) {
            blobLink.innerHTML += " " + err;
        });
        return false;
    }

    blobLink.click(downloadWithBlob);
}

/**
 * 初始化 HTML5 filesystem, 把旧文件删掉
 */
function initializeFiler() {
    window.qzone.filer = new Filer();

    window.qzone.filer.init({ persistent: false, size: 300 * 1024 * 1024 }, function (fs) {
        window.qzone.filer.ls(window.qzone.fsRoot, function (entries) {
            window.qzone.filer.rm(window.qzone.fsRoot, function () {

            }, function (error) {
                console.error("remove old folder failed, reason " + error);
            });
        }, function () {

        });
    });
}

/**
 * 创建在 HTML5 filesystem 中临时保存日志和图片的文件夹
 */
function buildFolder() {
    // rm 后 cwd 会变，所以要回到原来位置
    window.qzone.filer.cd('/', function () {
        window.qzone.filer.mkdir(window.qzone.blog.imgRoot, false, function (dirEntry) {
            window.qzone.filer.write(window.qzone.fsRoot + "说明.txt", { data: README_TEXT, type: "text/plain" }, function (fileEntry) {

            }, function (err) {
                console.error("filepath: " + filepath + " " + err);
            });
        }, function (error) {
            console.error("mkdir image error: " + error);
        });
    });

};

/**
 * 获取全部日志列表
 * 
 * 保存到 window.qzone.blog.list 数组
 */
function fetchAllBlogList() {
    var uin = window.qzone.uin;
    var nextListFunc = function (page, result, err) {
        statusIndicator.update();
        if (err != null) {
            statusIndicator.hasError("获取列表 " + (page * BLOG_PER_PAGE) + "-" + ((page + 1) * BLOG_PER_PAGE) + "失败, 如果只是某段错误，可稍后再试");
        }
        // TODO error
        if (window.qzone.blog.list.length < window.qzone.blog.totalNum) {
            // 总数不相等时继续获取
            fetchBlogList(uin, page + 1, arguments.callee);
        } else {
            // 告知完成获取列表
            operator.done("fetch_blog_list");
        }
    }
    fetchBlogList(uin, 0, nextListFunc);
}

/**
 * 获得所有日志
 * 
 * 根据 window.qzone.blog.list 数组，一篇一篇地下载
 */
function fetchAllBlog() {
    var uin = window.qzone.uin;
    var nextBlogFunc = function (idx, err) {
        if (err != null) {
            statusIndicator.hasError("获取日志：" + window.qzone.blog.list[idx].title + " 失败，错误原因：" + err);
        }

        if (window.qzone.blog.list.length > idx + 1) {
            fetchBlog(uin, idx + 1, arguments.callee);
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
 * 追加到 window.qzone.blog.list 数组
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
function fetchBlogList(uin, page, nextFunc) {
    $.ajax({
        url: APP.Blog.getBlogList(uin, page)
    })
        .done(function (data) {
            // 去掉函数，保留json
            data = data.replace(/^_Callback\(/, "");
            data = data.replace(/\);$/, "");
            result = JSON.parse(data);
            window.qzone.blog.totalNum = result.data.totalNum;
            result.data.list.forEach(function (item) {
                var i = { blogId: item.blogId, pubTime: item.pubTime, title: item.title };
                window.qzone.blog.list.push(i);
            });

            nextFunc(page, result, null);
        })
        .fail(function (jqXHR, textStatus) {
            nextFunc(page, [], textStatus);
        });
}

/**
 * 获取一篇日志的内容
 * 
 * @param {string} uin QQ号 
 * @param {integer} idx 日志列表中的第几篇日志
 * @param {function} nextFunc 获取完后执行的函数
 */
function fetchBlog(uin, idx, nextFunc) {
    var blogid = window.qzone.blog.list[idx].blogId;
    var postTime = window.qzone.blog.list[idx].pubTime;
    var title = window.qzone.blog.list[idx].title;

    $.ajax({
        url: APP.Blog.getBlogData(uin, blogid)
    }).done(function (data) {
        var blogPage = jQuery(data);
        var blogData = null;
        var blogInfo = {}

        // 获得网页里的JSON数据
        blogPage.find('script').each(function (index) {
            var t = $(this).text();
            if (t.indexOf('g_oBlogData') !== -1) {
                var dataM = /var g_oBlogData\s+=\s+({[\s\S]+});\s/;
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
        var blogContentHtml = blogPage.find("#blogDetailDiv:first").html();

        var turndownService = new TurndownService();
        var markdown = turndownService.turndown(blogContentHtml);
        if (markdown) {
            // 合并标题正文评论
            var blogMd = constructBlog(title, postTime, markdown, blogInfo);
            saveBlog(idx, title, postTime, blogMd);
            nextFunc(idx, null);
        } else {
            nextFunc(idx, err);
        }

    }).fail(function (jqXHR, textStatus) {
        nextFunc(idx, textStatus);
    });
}


/**
 * 拼接出一篇markdown格式的日志，包含标题，正文，评论等; 会将网络图片下载下来作为本地图片
 * 
 * @param {string} title 日志标题
 * @param {string} postTime 日志发表时间，从QQ空间API里获得的
 * @param {string} markdown 转换为 mardown 格式的日志
 * @param {dictionary} blogInfo 日志的信息，用于获取评论 
 */
function constructBlog(title, postTime, markdown, blogInfo) {
    // 拼接标题，日期，内容
    var result = "# " + title + "\r\n\r\n";
    result = result + postTime + "\r\n\r\n";
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";
    // 拼接评论
    result = result + "### 评论:\r\n\r\n";
    blogInfo.data.comments.forEach(function (entry) {
        var content = "* " + entry.poster.name + ": " + entry.content + "\r\n";
        entry.replies.forEach(function (rep) {
            var c = "\t* " + rep.poster.name + ": " + rep.content + "\r\n";
            content = content + c;
        });
        result = result + content;
    });

    // 转为本地图片
    var imageLinkM = /!\[.*?\]\((.+?)\)/g;
    var match;
    var tmpResult = result;
    while (match = imageLinkM.exec(tmpResult)) {
        var filename, filepath, url;
        filename = postTime + "_" + APP.Common.guid();
        filename = APP.Common.filenameValidate(filename);
        filepath = IMAGE_FOLDER_NAME + "/" + filename;
        // filepath = decodeURI(filepath);
        result = result.split(match[1]).join(filepath);
        url = match[1].replace(/http:\//, "https:/")
        operator.downloadImage(url, window.qzone.blog.root + filepath, title);
    }
    return result;
}

/**
 * 保存日志到 HTML5 filesystem
 * 
 * @param {string} title 
 * @param {string} postTime 
 * @param {string} blog 
 */
function saveBlog(idx, title, postTime, blog) {
    var filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    var orderNum = APP.Common.prefixNumber(idx + 1, window.qzone.blog.totalNum.toString().length);
    filename = APP.Common.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    filepath = window.qzone.blog.root + filename + ".md";
    // filepath = decodeURI(filepath);

    window.qzone.filer.write(filepath, { data: blog, type: "text/plain" }, function (fileEntry) {
        statusIndicator.blogDownloaded();
    }, function (err) {
        console.error("filepath: " + filepath + " " + err);
        statusIndicator.hasError("保存日志：" + filename + " 失败");
    });
}

/**
 * 下载图片到 filesystem
 * 
 * @param {string} url 图片URL 
 * @param {string} savePath 图片应该存放在 filesystem 的路径 
 * @param {string} title 图片所在日志的标题，仅用于打印错误报告
 */
function downloadImage(url, savePath, title) {
    try {
        statusIndicator.imageStartDownload();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";

        xhr.onload = function (oEvent) {
            var arrayBuffer = xhr.response;
            var byteArray = new Uint8Array(arrayBuffer);

            window.qzone.filer.write(savePath, { data: byteArray.buffer }, function (fileEntry, fileWriter) {

            }, function (err) {
                console.error(err);
            });
            statusIndicator.imageDownloadSuccess();
        };

        xhr.onerror = function (e) {
            statusIndicator.hasError("下载不到：" + title + "的一张图片， URL：" + url);
            statusIndicator.imageDownloadFailed();
        }

        xhr.send();

    } catch (error) {
        console.error(error);
    }
}

/**
 * 压缩下载下来的日志和图片以待用户下载
 */
function zipQzone() {
    window.qzone.zip = new JSZip();
    var zipOneFile = function (entry) {
        var newName = encodeURIComponent(entry.name);
        var fullPath = entry.fullPath.replace(entry.name, newName);
        console.info(fullPath);
        window.qzone.filer.open(fullPath, function (f) {
            var reader = new FileReader();
            reader.onload = function (event) {
                window.qzone.zip.file(entry.fullPath, event.target.result, { binary: true });
            }
            reader.readAsArrayBuffer(f);
        }, function (error) {
            console.error("压缩错误: " + error);
        });
    };

    (function (path) {
        var cl = arguments.callee;
        window.qzone.filer.ls(path, function (entries) {
            var i = 0;
            for (i = 0; i < entries.length; i++) {
                var entry = entries[i];
                if (entry.isDirectory) {
                    cl(path + entry.name + '/');
                    // cl(path + entry.name);
                } else {
                    zipOneFile(entry);
                }
            }
            operator.done("zip");
        });
    })(window.qzone.fsRoot);
}
