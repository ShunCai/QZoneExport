/**
 * 提示信息
 */

const MAX_MSG = {
    Blogs: '正在获取日志，已获取 <span style="color: #1ca5fc;">{0}</span> 篇，总共 <span style="color: #1ca5fc;">{1}</span> 篇，已导出 <span style="color: #1ca5fc;">{2}</span> 篇，请稍后...',
    Diaries: '正在获取私密日记，已获取 <span style="color: #1ca5fc;">{0}</span> 篇，总共 <span style="color: #1ca5fc;">{1}</span> 篇，已导出 <span style="color: #1ca5fc;">{2}</span> 篇，请稍后...',
    Messages: '正在获取说说列表，已获取 <span style="color: #1ca5fc;">{0}</span> 条，总共 <span style="color: #1ca5fc;">{1}</span> 条，已导出 <span style="color: #1ca5fc;">{2}</span> 条，请稍后...',
    Friends: '正在获取QQ好友，已获取好友 <span style="color: #1ca5fc;">{0}</span> 个，总共 <span style="color: #1ca5fc;">{1}</span> 个，已导出 <span style="color: #1ca5fc;">{2}</span> 个，请稍后...',
    Boards: '正在获取留言板列表，已获取 <span style="color: #1ca5fc;">{0}</span> 条，总共 <span style="color: #1ca5fc;">{1}</span> 条，已导出 <span style="color: #1ca5fc;">{2}</span> 条，请稍后...',
    Photos: '正在获取相册列表，请稍后...',
    Images: '正在下载图片，已下载 <span style="color: #1ca5fc;">{0}</span> 张图片，已失败 <span style="color: red;"> {1} </span> 张图片...',
}

const MODAL_HTML = `
    <div class="modal fade" id="exampleModalCenter" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="exampleModalLongTitle">QQ空间备份</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <h3 id="backupStatus">正在导出备份，请不要关闭或刷新当前页面和打开新的QQ空间页面。</h3>
                <hr/>
                <p id="exportBlogs" style="display: none;" >正在获取日志，请稍后...</p>
                <p id="exportDiaries" style="display: none;" >正在获取私密日记，请稍后...</p>
                <p id="exportMessages" style="display: none;" >正在获取说说，请稍后...</p>
                <p id="exportFriends" style="display: none;" >正在获取QQ好友信息，请稍后...</p>
                <p id="exportBoards" style="display: none;" >正在获取留言板，请稍后...</p>
                <p id="exportPhotos" style="display: none;" >正在获取相册，请稍后...</p>
                <p id="exportImages">正在下载图片，已下载 - 张图片，已失败 - 张图片...</p>
            </div>
            <div class="modal-footer">
                <button id="downloadBtn" type="button" class="btn btn-primary" >下载备份</button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
            </div>
            </div>
        </div>
    </div>
`

const DETAIL_HTML = `
    <div class="container-fluid">
        <nav>
        <div class="nav nav-tabs" id="nav-tab" role="tablist">
            <a class="nav-item nav-link active" id="nav-messages-tab" data-toggle="tab" href="#nav-messages" role="tab" aria-controls="nav-messages" aria-selected="true">说说</a>
            <a class="nav-item nav-link" id="nav-blogs-tab" data-toggle="tab" href="#nav-blogs" role="tab" aria-controls="nav-blogs" aria-selected="false">日志</a>
            <a class="nav-item nav-link" id="nav-diaries-tab" data-toggle="tab" href="#nav-diaries" role="tab" aria-controls="nav-diaries" aria-selected="false">私密日记</a>
            <a class="nav-item nav-link" id="nav-photos-tab" data-toggle="tab" href="#nav-photos" role="tab" aria-controls="nav-photos" aria-selected="false">相册</a>
            <a class="nav-item nav-link" id="nav-boards-tab" data-toggle="tab" href="#nav-boards" role="tab" aria-controls="nav-boards" aria-selected="false">留言板</a>
            <a class="nav-item nav-link" id="nav-friends-tab" data-toggle="tab" href="#nav-friends" role="tab" aria-controls="nav-friends" aria-selected="false">好友</a>
            <a class="nav-item nav-link" id="nav-settings-tab" data-toggle="tab" href="#nav-settings" role="tab" aria-controls="nav-settings" aria-selected="false">设置</a>
        </div>
        </nav>
        <div class="tab-content" id="nav-tabContent">
        <div class="tab-pane fade show active" id="nav-messages" role="tabpanel" aria-labelledby="nav-messages-tab">
            <table id="tb_messages"></table>
        </div>
        <div class="tab-pane fade" id="nav-blogs" role="tabpanel" aria-labelledby="nav-blogs-tab">
            <table id="tb_blogs"></table>
        </div>
        <div class="tab-pane fade" id="nav-diaries" role="tabpanel" aria-labelledby="nav-diaries-tab">
            <table id="tb_diaries"></table>
        </div>
        <div class="tab-pane fade" id="nav-photos" role="tabpanel" aria-labelledby="nav-photos-tab">
            <table id="tb_photos"></table>
        </div>
        <div class="tab-pane fade" id="nav-boards" role="tabpanel" aria-labelledby="nav-boards-tab">
            <table id="tb_boards"></table>
        </div>
        <div class="tab-pane fade" id="nav-friends" role="tabpanel" aria-labelledby="nav-friends-tab">
            <table id="tb_boards"></table>
        </div>
        </div>
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
└--- 私密日记
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    |--- 私密日记A.md
    |--- 私密日记B.md
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
    └--- 2019.md
    └--- 2018.md
    └---- ....
└--- 留言板
    └--- images
        |--- 图片A
        |--- 图片B
        └---- ....
    └--- 留言板.md
└--- 好友
    └--- 好友.xlsx

推荐使用 [Atom](https://atom.io/)
`

/**
 * 操作类型
 */
const OperatorType = {
    /**
     * 初始化
     */
    INIT: 'INIT',
    /**
     * 显示弹窗
     */
    SHOW: 'SHOW',

    /**
     * 等待日志图片下载完成
     */
    AWAIT_IMAGES: 'AWAIT_IMAGES',

    /**
     * 获取日志所有列表
     */
    BLOG_LIST: 'BLOG_LIST',

    /**
     * 获取私密日记所有列表
     */
    DIARY_LIST: 'DIARY_LIST',

    /**
     * 获取所有说说列表
     */
    MESSAGES_LIST: 'MESSAGES_LIST',

    /**
    * 获取好友列表
    */
    FRIEND_LIST: 'FRIEND_LIST',

    /**
    * 获取留言板列表
    */
    BOARD_LIST: 'BOARD_LIST',

    /**
    * 获取相册照片
    */
    PHOTO_LIST: 'PHOTO_LIST',

    /**
     * 压缩
     */
    ZIP: 'ZIP'
};

if (Object.freeze) {
    Object.freeze(OperatorType);
}


var operator = createOperator();
var statusIndicator = createStatusIndicator();
// 转换MarkDown
var turndownService = new TurndownService();


/**
 * 页面加载时初始化
 */
document.addEventListener('DOMContentLoaded', function () {
    operator.next(OperatorType.INIT);
});


/**
 * 创建备份流程控制者
 */
function createOperator() {
    let operator = new Object();
    operator.next = async function (type) {
        switch (type) {
            case OperatorType.INIT:
                init();
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                showModal();
                initFolder();
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.next(OperatorType.BLOG_LIST);
                break;
            case OperatorType.BLOG_LIST:
                // 获取日志所有列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.DIARY_LIST, () => {
                    API.Blogs.fetchAllList();
                });
                break;
            case OperatorType.DIARY_LIST:
                // 获取私密日记所有列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.MESSAGES_LIST, () => {
                    API.Diaries.fetchAllList();
                });
                break;
            case OperatorType.MESSAGES_LIST:
                // 获取说说列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.FRIEND_LIST, () => {
                    API.Messages.fetchAllList();
                });
                break;
            case OperatorType.FRIEND_LIST:
                // 获取并下载QQ好友Excel
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.BOARD_LIST, () => {
                    API.Friends.fetchAllList();
                });
                break;
            case OperatorType.BOARD_LIST:
                // 获取留言板列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.PHOTO_LIST, () => {
                    API.Boards.fetchAllList();
                });
                break;
            case OperatorType.PHOTO_LIST:
                // 获取相册列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.checkedNext(type, OperatorType.AWAIT_IMAGES, () => {
                    API.Photos.fetchAllList();
                });
                break;
            case OperatorType.AWAIT_IMAGES:
                // 如果图片还没下载完，弄个会动的提示，让用户知道不是页面卡死
                while (statusIndicator.Images.downloading > 0) {
                    var dot = '';
                    if (Math.random() > 0.5) {
                        dot = '...'
                    };
                    statusIndicator.updateTitle("还没下载完图片， 等一等..." + dot);
                    await API.Utils.sleep(CONFIG.SLEEP_TIME);
                }
                // 压缩
                API.Utils.Zip(FOLDER_ROOT, () => {
                    operator.next(OperatorType.ZIP);
                }, (error) => {
                    console.error(error);
                });
                break;
            case OperatorType.ZIP:
                // 延迟3秒，确保压缩完
                await API.Utils.sleep(3000);
                statusIndicator.complete();
                break;
            default:
                break;
        }
    };

    operator.checkedNext = function (operatorType, nextOperatorType, nextFun) {
        if (QZone.Common.ExportType[operatorType]) {
            nextFun.call();
        } else {
            operator.next(nextOperatorType);
        }
    }

    operator.downloadImage = async function (imageInfo) {
        statusIndicator.download();
        API.Utils.writeImage(imageInfo.url, imageInfo.filepath, imageInfo.isMimeType, (fileEntry) => {
            statusIndicator.downloadSuccess();
        }, (e) => {
            console.info("下载失败URL：" + imageInfo.url);
            console.info("失败的文件路径：" + imageInfo.filepath);
            statusIndicator.downloadFailed();
        });
    };
    return operator;
};

/**
 * 创建状态更新指示器
 */
function createStatusIndicator() {
    var status = {
        Blogs: {
            id: 'exportBlogs',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Images: {
            id: 'exportImages',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Diaries: {
            id: 'exportDiaries',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Messages: {
            id: 'exportMessages',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Photos: {
            id: 'exportPhotos',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Boards: {
            id: 'exportBoards',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        },
        Friends: {
            id: 'exportFriends',
            downloaded: 0,
            downloading: 0,
            downloadFailed: 0,
            total: 0
        }
    };

    status.start = function (type) {
        type = type || 'Images';
        let obj = this[type];
        if (type && obj.id !== 'exportImages') {
            $("#" + obj.id).show();
            this.update(type);
        }
    };

    status.update = function (type) {
        type = type || 'Images';
        let obj = this[type];
        if (type && obj.id !== 'exportImages') {
            $("#" + obj.id).show();
            let tip = MAX_MSG[type].format(QZone[type].Data.length, obj.total, obj.downloaded);
            if (obj.downloaded + obj.downloadFailed === obj.total) {
                tip = tip.replace('请稍后', '已完成');
            }
            $("#" + obj.id).html(tip);
        }
        let imgTip = MAX_MSG.Images.format(this.Images.downloaded, this.Images.downloadFailed);
        if (this.Images.downloaded + this.Images.downloadFailed === this.Images.total) {
            imgTip = imgTip.replace('请稍后', '已完成');
        }
        $("#exportImages").html(imgTip);
    };

    status.updateImages = function () {
        let imgTip = MAX_MSG.Images.format(this.Images.downloaded, this.Images.downloadFailed);
        if (this.Images.downloaded + this.Images.downloadFailed === this.Images.total) {
            imgTip = imgTip.replace('请稍后', '已完成');
        }
        $("#exportImages").html(imgTip);
    };

    status.updatePhotosInfo = function (arg) {
        let tip = MAX_MSG.Photos.format(arg);
        $("#exportPhotos").html(tip);
        this.updateImages();
    };

    status.complete = function () {
        $("#downloadBtn").show();
        $("#backupStatus").html("备份完成");
    };

    status.updateTitle = function (title) {
        $("#backupStatus").html(title);
    };

    status.download = function (type) {
        type = type || 'Images';
        this[type].downloading += 1;
        this.update(type);
    };

    status.downloadFailed = function (type, count) {
        type = type || 'Images';
        this[type].downloadFailed += (count || 1);
        this[type].downloading -= (count || 1);
        this.update(type);
    };

    status.downloadSuccess = function (type) {
        type = type || 'Images';
        this[type].downloaded += 1;
        this[type].downloading -= 1;
        this.update(type);
    };

    status.total = function (total, type) {
        type = type || 'Images';
        this[type].total = total;
        this.update(type);
    };
    return status;
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
    QZone.Common.Filer = new Filer();
    QZone.Common.Filer.init({ persistent: false, size: 300 * 1024 * 1024 }, function (fs) {
        QZone.Common.Filer.ls(FOLDER_ROOT, function (entries) {
            QZone.Common.Filer.rm(FOLDER_ROOT, function () {

            });
        });
    });

    // 初始化压缩工具
    QZone.Common.Zip = new JSZip();

    // 添加按钮监听
    chrome.runtime.onMessage.addListener(function (data) {
        if (data.from === 'popup' && data.subject === 'startBackup') {
            QZone.Common.ExportType = data.exportType;
            operator.next(OperatorType.SHOW);
        }
    });
}

/**
 * 显示模态对话框
 *
 * 状态显示，错误信息，下载都在这里显示
 */
function showModal() {
    $('body').append(MODAL_HTML);
    $('#exampleModalCenter').modal({})

    $('#exampleModalCenter').on('hide.bs.modal', function (e) {
        var r = confirm("确认离开吗？");
        if (!r) {
            return false;
        }
    })

    var blobLink = $('#downloadBtn');
    blobLink.hide();
    blobLink.click(() => {
        blobLink.attr('disabled', true);
        blobLink.text('正在下载...');

        // 压缩
        QZone.Common.Zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",// 压缩，STORE压缩
            compressionOptions: {
                level: 9
            }
        }).then(function (blob) {
            saveAs(blob, QZone.ZIP_NAME);
            blobLink.text('已导出');
            blobLink.attr('disabled', false);
        }, (err) => {
            console.error(err);
            blobLink.text('下载失败，请重试。');
            blobLink.attr('disabled', false);
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
        let rootPath = obj['IMAGES_ROOT'] || obj['ROOT'];
        if (!rootPath) {
            continue;
        }
        QZone.Common.Filer.mkdir(rootPath, false, (entry) => {
            console.info('创建目录成功：' + entry.fullPath);
        });
    }

    // 创建说明文件
    QZone.Common.Filer.write(FOLDER_ROOT + "说明.txt", { data: README_TEXT, type: "text/plain" }, (entry) => {
        console.info('创建文件成功：' + entry.fullPath);
    });
};

/**
 * 获取一页的日志列表
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Blogs.fetchList = function (uin, page, nextFunc) {
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
        // 提示信息
        statusIndicator.total(QZone.Blogs.total, 'Blogs');
        statusIndicator.update('Blogs');
        nextFunc(page, result, null);
    }, nextFunc);
}

/**
 * 获取全部日志列表
 */
API.Blogs.fetchAllList = function () {

    // 提示信息
    statusIndicator.start("Blogs");

    // 重置数据
    QZone.Blogs.Data = [];
    QZone.Blogs.Images = [];

    // 获取数据
    var nextListFunc = function (page, result, err) {
        if (QZone.Blogs.Data.length < QZone.Blogs.total) {
            // 总数不相等时继续获取
            API.Blogs.fetchList(QZone.Common.uin, page + 1, arguments.callee);
        } else {
            // 获取日志所有信息
            API.Blogs.fetchAllInfo();
        }
    }
    API.Blogs.fetchList(QZone.Common.uin, 0, nextListFunc);
};

/**
 * 获取一篇日志的内容
 * 
 * @param {string} uin QQ号 
 * @param {integer} idx 日志列表中的第几篇日志
 * @param {function} nextFunc 获取完后执行的函数
 */
API.Blogs.fetchInfo = function (uin, idx, nextFunc) {
    let blogid = QZone.Blogs.Data[idx].blogId;
    let postTime = QZone.Blogs.Data[idx].pubTime;
    let title = QZone.Blogs.Data[idx].title;

    statusIndicator.download("Blogs");
    API.Blogs.getInfo(uin, blogid, function (data) {
        API.Blogs.contentToFile(data, idx, title, postTime, nextFunc);
    }, nextFunc);
}

/**
 * 获得所有日志的内容
 */
API.Blogs.fetchAllInfo = function () {
    // 获取数据
    var nextBlogFunc = function (idx, err) {
        if (QZone.Blogs.Data.length > idx + 1) {
            API.Blogs.fetchInfo(QZone.Common.uin, idx + 1, arguments.callee);
        } else {
            // 告知完成获取所有日志，并开始等待日志图片下载完成
            operator.next(OperatorType.DIARY_LIST);
        }
    }
    nextBlogFunc(-1, null);
};

/**
 * 读取私密日记内容到文件
 * @param {html} data 日志详情页
 * @param {integer} idx 
 * @param {string} title 标题
 * @param {string} postTime 创建时间
 * @param {funcation} nextFunc 回调函数
 */
API.Blogs.contentToFile = function (data, idx, title, postTime, nextFunc) {
    let blogPage = jQuery(data);
    let blogData = null;
    let blogInfo = {};
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
        blogInfo = JSON.parse(blogData[1]);
    }
    // 获得日志正文
    let blogContentHtml = blogPage.find("#blogDetailDiv:first").html();
    let markdown = turndownService.turndown(blogContentHtml);
    if (markdown) {
        // 合并标题正文评论
        API.Blogs.constructContent(title, postTime, markdown, blogInfo, (content) => {
            let label = API.Blogs.getBlogLabel(blogInfo.data);
            API.Blogs.writeFile(idx, label, title, postTime, content);
            nextFunc(idx, null);
        });
    } else {
        nextFunc(idx, err);
    }
};

/**
 * 拼接出一篇markdown格式的日志，包含标题，正文，评论等; 会将网络图片下载下来作为本地图片
 * 
 * @param {string} title 日志标题
 * @param {string} postTime 日志发表时间，从QQ空间API里获得的
 * @param {string} markdown 转换为 mardown 格式的日志
 * @param {dictionary} blogInfo 日志的信息，用于获取评论 
 */
API.Blogs.constructContent = function (title, postTime, markdown, blogInfo, doneFun) {
    // 拼接标题，日期，内容
    let result = "# " + title + "\r\n\r\n";
    result = result + "> " + postTime + "\r\n\r\n";
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "> 评论:\r\n\r\n";
    blogInfo.data.comments.forEach(function (entry) {
        let mdContent = API.Utils.formatContent(entry.content, 'MD');
        let content = '* [{0}](https://user.qzone.qq.com/{1})：{2}'.format(entry.poster.name, entry.poster.id, mdContent) + "\r\n";

        entry.replies.forEach(function (rep) {
            let c = "\t* " + rep.poster.name + ": " + API.Utils.formatContent(rep.content, 'MD') + "\r\n";
            content = content + c;
        });
        result = result + content;
    });

    // 转为本地图片
    let imageLinkM = /!\[.*?\]\((.+?)\)/g;
    let match;
    let tmpResult = result;
    while (match = imageLinkM.exec(tmpResult)) {
        let orgUrl = match[1];
        let url = orgUrl.replace(/http:\//, "https:/");
        let uid = API.Utils.guid();
        let fileName = uid;
        var imageInfo = {
            uid: uid,
            url: url,
            filename: fileName,
            filepath: QZone.Blogs.IMAGES_ROOT + "/" + fileName
        };
        result = result.split(orgUrl).join("images/" + imageInfo.filename);
        QZone.Blogs.Images.push(imageInfo);
        operator.downloadImage(imageInfo);
    }
    doneFun(result);
};

/**
 * 保存日志到 HTML5 filesystem
 * 
 * @param {string} title 
 * @param {string} postTime 
 * @param {string} content 
 */
API.Blogs.writeFile = function (idx, label, title, postTime, content) {
    let filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    let orderNum = API.Utils.prefixNumber(idx + 1, QZone.Blogs.total.toString().length);
    filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    if (label && label != "") {
        filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_" + label + "【" + title + "】");
    }
    filepath = QZone.Blogs.ROOT + '/' + filename + ".md";

    API.Utils.writeFile(content, filepath, (fileEntry) => {
        statusIndicator.downloadSuccess('Blogs');
    }, (error) => {
        statusIndicator.downloadFailed('Blogs');
    });
};


/**
 * 获取一页的私密日记列表
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Diaries.fetchList = function (uin, page, nextFunc) {
    API.Diaries.getDiaries(uin, page, function (data) {
        // 去掉函数，保留json
        data = data.replace(/^_Callback\(/, "");
        data = data.replace(/\);$/, "");
        result = JSON.parse(data);
        QZone.Diaries.total = result.data.total_num;
        result.data.titlelist.forEach(function (item) {
            var i = {
                blogId: item.blogid,
                pubTime: new Date(1E3 * item.pubtime).format('yyyy-MM-dd hh:mm:ss'),
                title: item.title
            };
            QZone.Diaries.Data.push(i);
        });
        // 开始获取日志内容
        statusIndicator.total(QZone.Diaries.total, 'Diaries');
        statusIndicator.update('Diaries');
        nextFunc(page, result, null);
    }, nextFunc);
}


/**
 * 获取全部私密日记列表
 */
API.Diaries.fetchAllList = function () {
    // 重置数据
    QZone.Diaries.Data = [];
    QZone.Diaries.Images = [];

    statusIndicator.start("Diaries");

    // 获取数据
    var nextListFunc = function (page, result, err) {
        // TODO error
        if (QZone.Diaries.Data.length < QZone.Diaries.total) {
            // 总数不相等时继续获取
            API.Diaries.fetchList(QZone.Common.uin, page + 1, arguments.callee);
        } else {
            // 获取私密日记所有信息
            API.Diaries.fetchAllInfo();
        }
    }
    API.Diaries.fetchList(QZone.Common.uin, 0, nextListFunc);
};

/**
 * 获取一篇私密日记的内容
 * 
 * @param {string} uin QQ号 
 * @param {integer} idx 日志列表中的第几篇私密日记
 * @param {function} nextFunc 获取完后执行的函数
 */
API.Diaries.fetchInfo = function (uin, idx, nextFunc) {
    let blogid = QZone.Diaries.Data[idx].blogId;
    let postTime = QZone.Diaries.Data[idx].pubTime;
    let title = QZone.Diaries.Data[idx].title;

    statusIndicator.download("Diaries");
    API.Diaries.getInfo(uin, blogid, function (data) {
        API.Diaries.contentToFile(data, idx, title, postTime, nextFunc);
    }, nextFunc);
};

/**
 * 获得所有私密日记的内容
 */
API.Diaries.fetchAllInfo = function () {
    // 获取数据
    var nextFun = function (idx, err) {
        if (QZone.Diaries.Data.length > idx + 1) {
            API.Diaries.fetchInfo(QZone.Common.uin, idx + 1, arguments.callee);
        } else {
            // 下一步，获取说说列表
            operator.next(OperatorType.MESSAGES_LIST);
        }
    }
    nextFun(-1, null);
};

/**
 * 读取私密日记内容到文件
 * @param {html} data 私密日记详情页
 * @param {integer} idx 
 * @param {string} title 标题
 * @param {string} postTime 创建时间
 * @param {funcation} nextFunc 回调函数
 */
API.Diaries.contentToFile = function (data, idx, title, postTime, nextFunc) {
    let blogPage = jQuery(data);
    let blogData = null;
    let blogInfo = {};
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
        blogInfo = JSON.parse(blogData[1]);
    }
    // 获得私密日记正文
    let blogContentHtml = blogPage.find("#blogDetailDiv:first").html();
    let markdown = turndownService.turndown(blogContentHtml);
    if (markdown) {
        // 合并标题正文评论
        let content = API.Diaries.constructContent(idx, title, postTime, markdown, blogInfo);
        API.Diaries.writeFile(idx, title, postTime, content);
        nextFunc(idx, null);
    } else {
        nextFunc(idx, err);
    }
};

/**
 * 拼接出一篇markdown格式的私密日记，包含标题，正文，评论等; 会将网络图片下载下来作为本地图片
 * 
 * @param {string} title 私密日记标题
 * @param {string} postTime 私密日记发表时间，从QQ空间API里获得的
 * @param {string} markdown 转换为 mardown 格式的私密日记
 * @param {dictionary} blogInfo 私密日记的信息，用于获取评论
 */
API.Diaries.constructContent = function (index, title, postTime, markdown, blogInfo) {
    // 拼接标题，日期，内容
    let result = "# " + title + "\r\n\r\n";
    result = result + "> " + postTime + "\r\n\r\n";
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 转为本地图片
    let imageLinkM = /!\[.*?\]\((.+?)\)/g;
    let match;
    let tmpResult = result;
    while (match = imageLinkM.exec(tmpResult)) {
        let orgUrl = match[1];
        let url = orgUrl.replace(/http:\//, "https:/");
        let uid = API.Utils.guid();
        let fileName = uid;
        var imageInfo = {
            uid: uid,
            url: url,
            filename: fileName,
            filepath: QZone.Diaries.IMAGES_ROOT + "/" + fileName
        };
        result = result.split(orgUrl).join("images/" + imageInfo.filename);
        QZone.Diaries.Images.push(imageInfo);
        operator.downloadImage(imageInfo);
    }
    return result;
};

/**
 * 保存私密日记到 HTML5 filesystem
 * 
 * @param {string} title 
 * @param {string} postTime 
 * @param {string} content 
 */
API.Diaries.writeFile = function (idx, title, postTime, content) {
    let filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    let orderNum = API.Utils.prefixNumber(idx + 1, QZone.Diaries.total.toString().length);
    filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    filepath = QZone.Diaries.ROOT + '/' + filename + ".md";

    API.Utils.writeFile(content, filepath, (fileEntry) => {
        statusIndicator.downloadSuccess('Diaries');
    }, (error) => {
        statusIndicator.downloadFailed('Diaries');
    });
};


/**
 * 获取一页的说说列表
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Messages.fetchList = function (uin, page, nextFunc) {
    API.Messages.getMessages(uin, page, function (data) {
        // 去掉函数，保留json
        data = data.replace(/^_preloadCallback\(/, "");
        data = data.replace(/\);$/, "");
        result = JSON.parse(data);
        QZone.Messages.total = result.total;
        result.msglist.forEach(function (item) {
            var info = {
                content: item.content,
                comments: item.commentlist || [],
                images: item.pic || [],
                audio: item.audio || [],
                video: item.video || [],
                location: item.lbs,
                rt_con: item.rt_con,
                rt_uin: item.rt_uin,
                rt_uinname: item.rt_uinname,
                createTime: new Date(item.created_time * 1000).format('yyyy-MM-dd hh:mm:ss')
            };
            if (info.images.length > 0) {
                // 图片信息
                info.images.forEach(function (entry) {
                    var uid = API.Utils.guid();
                    var url = entry.url2.replace(/http:\//, "https:/");
                    var imageInfo = {
                        uid: uid,
                        url: url,
                        filename: uid,
                        filepath: QZone.Messages.IMAGES_ROOT + "/" + uid
                    };
                    entry.url = imageInfo.url;
                    entry.uid = imageInfo.uid;
                    entry.filepath = imageInfo.filepath;
                    // 下载图片
                    operator.downloadImage(imageInfo);
                });
            };
            QZone.Messages.Data.push(info);
        });
        // 提示信息
        statusIndicator.total(QZone.Messages.total, 'Messages');
        statusIndicator.update('Messages');
        nextFunc(page, result, null);
    }, nextFunc);
};


/**
 * 获取全部说说列表
 */
API.Messages.fetchAllList = function () {

    // 重置数据
    QZone.Messages.Data = [];
    QZone.Messages.Images = [];

    statusIndicator.start("Messages");

    // 获取数据
    var nextListFunc = function (page, result, err) {
        // TODO error
        if (QZone.Messages.Data.length < QZone.Messages.total) {
            // 总数不相等时继续获取
            API.Messages.fetchList(QZone.Common.uin, page + 1, arguments.callee);
        } else {
            // 说说写入到文件
            API.Messages.contentToFiles();
        }
    }
    API.Messages.fetchList(QZone.Common.uin, 0, nextListFunc);
};


/**
 * 构建说说文件内容
 */
API.Messages.contentToFiles = function () {
    const yearMap = API.Utils.groupedByTime(QZone.Messages.Data, "createTime");
    yearMap.forEach((monthMap, year) => {
        let content = "# " + year + "年\r\n\r\n";
        monthMap.forEach((items, month) => {
            content += "## " + month + "月\r\n\r\n";
            items.forEach((item) => {
                statusIndicator.download("Messages");
                content = content + "---\r\n" + API.Messages.writeFiles(item);
                statusIndicator.downloadSuccess("Messages");
            });
        });
        const yearFilePath = QZone.Messages.ROOT + "/" + year + "年.md";
        API.Utils.writeFile(content, yearFilePath, () => {
            console.info("已下载：" + yearFilePath);
        });
    });

    // 下一步，获取QQ好友信息
    operator.next(OperatorType.FRIEND_LIST);
};

/**
 * 写入说说到文件
 */
API.Messages.writeFiles = function (item) {
    statusIndicator.download('Messages');

    let location = item.location['name'];
    var result = "> " + item.createTime;
    // 地理位置
    if (location && location !== "") {
        result += "【" + location + "】";
    }

    // 转发标示
    if (item.rt_con) {
        result += "【转发】";
    }

    var content = item.content.replace(/\n/g, "\r\n") + "\r\n";
    // 转换内容
    content = API.Utils.formatContent(content);
    result += "\r\n\r\n" + content;

    // 图片信息
    let rt_imgs = [], msg_imgs = [];
    item.images.forEach(function (entry) {
        if (entry.who == 4) {
            rt_imgs.push(entry);
        } else {
            msg_imgs.push(entry);
        }
    });


    // 说说图片
    if (msg_imgs.length > 0) {
        let imageContent = '<div style="width: 800px;" >';
        let imgSrc = '<img src="{0}" width="200px" height="200px" align="center" />';
        if (msg_imgs.length <= 2) {
            imgSrc = '<img src="{0}" width="200px" align="center" />';
        }
        // 图片信息
        msg_imgs.forEach(function (entry) {
            imageContent = imageContent + '\r\n' + imgSrc.format('images/' + entry.uid) + '\r\n';
        });
        imageContent = imageContent + '</div>' + '\r\n\r\n';
        result += imageContent + "\r\n";
    };

    // 添加转发内容
    if (item.rt_con) {
        result += "> 原文:\r\n";
        // 转换内容
        rtContent = '[{0}](https://user.qzone.qq.com/{1})：{2}'.format(item.rt_uinname, item.rt_uin, API.Utils.formatContent(item.rt_con.content))
        result += "\r\n" + rtContent + "\r\n";
    }
    // 转发内容图片
    if (rt_imgs.length > 0) {
        let imageContent = '<div style="width: 800px;" >';
        let imgSrc = '<img src="{0}" width="200px" height="200px" align="center" />';
        if (rt_imgs.length <= 2) {
            imgSrc = '<img src="{0}" width="200px" align="center" />';
        }
        // 图片信息
        rt_imgs.forEach(function (entry) {
            imageContent = imageContent + '\r\n' + imgSrc.format('images/' + entry.uid) + '\r\n';
        });
        imageContent = imageContent + '</div>' + '\r\n\r\n';
        result += imageContent + "\r\n";
    };

    // 评论内容
    result += "> 评论:\r\n\r\n";
    item.comments.forEach(function (comment) {
        let content = API.Utils.formatContent(comment.content, 'MD');
        result += "*  [{0}](https://user.qzone.qq.com/{1})：{2}".format(comment.name, comment.uin, content) + "\r\n";

        // 回复包含图片
        var commentImgs = comment.pic || [];
        commentImgs.forEach(function (img) {
            let commentImgUid = API.Utils.guid();
            let commentImgUrl = img.hd_url.replace(/http:\//, "https:/");
            let comImageInfo = {
                uid: commentImgUid,
                url: commentImgUrl,
                filename: commentImgUid,
                filepath: QZone.Messages.IMAGES_ROOT + "/" + commentImgUid
            };
            // 替换URL
            result += "![](" + comImageInfo.filepath + ")" + '\r\n';
            // 下载图片
            operator.downloadImage(comImageInfo);
        });
        var replies = comment.list_3 || [];
        replies.forEach(function (repItem) {
            let content = API.Utils.formatContent(repItem.content, 'MD');
            let repContent = "\t* [{0}](https://user.qzone.qq.com/{1})：{2}".format(repItem.name, repItem.uin, content) + "\r\n";
            var repImgs = repItem.pic || [];
            repImgs.forEach(function (repImg) {
                let repImgUid = API.Utils.guid();
                let repImgUrl = repImg.hd_url.replace(/http:\//, "https:/");
                let repImgageInfo = {
                    uid: repImgUid,
                    url: repImgUrl,
                    filename: repImgUid,
                    filepath: QZone.Messages.IMAGES_ROOT + "/" + repImgUid
                };
                // 替换URL
                result += "![](" + repImgageInfo.filepath + ")" + '\r\n';
                // 下载图片
                operator.downloadImage(repImgageInfo);
            });
            result += repContent;
        });
    });
    // 转换视频 // TODO
    // 转换音频 // TODO
    result = result + "\r\n"
    return result;
};


/**
 * 获取QQ好友列表
 */
API.Friends.fetchAllList = function () {

    // 重置数据
    QZone.Friends.Data = [];
    QZone.Friends.Images = [];

    statusIndicator.start("Friends");

    API.Friends.getFriends(QZone.Common.uin, (data) => {
        data = data.replace(/^_Callback\(/, "");
        data = data.replace(/\);$/, "");
        result = JSON.parse(data);
        QZone.Friends.total = result.data.items.length;
        QZone.Friends.Data = result.data.items;
        statusIndicator.total(QZone.Friends.total, "Friends");


        // 将QQ分组进行分组
        let groups = result.data.gpnames;
        let groupMap = new Map();
        groups.forEach(group => {
            groupMap.set(group.gpid, group.gpname);
        });

        // Excel数据
        let ws_data = [
            ["QQ号", "备注名称", "QQ昵称", "所在分组", "成为好友时间"],
        ];

        let writeToExcel = function (ws_data) {
            // 创建WorkBook
            let workbook = XLSX.utils.book_new();

            let worksheet = XLSX.utils.aoa_to_sheet(ws_data);

            XLSX.utils.book_append_sheet(workbook, worksheet, "QQ好友");

            // 写入XLSX到HTML5的FileSystem
            let xlsxArrayBuffer = API.Utils.toArrayBuffer(XLSX.write(workbook, { bookType: 'xlsx', bookSST: false, type: 'binary' }));
            API.Utils.writeExcel(xlsxArrayBuffer, QZone.Friends.ROOT + "/QQ好友.xlsx", (fileEntry) => {
                console.info("创建文件成功：" + fileEntry.fullPath);
                // 下一步，等待图片下载完成
                operator.next(OperatorType.BOARD_LIST);
            }, (error) => {
                console.error(error);
            });
        }

        // 处理QQ好友
        let friends = result.data.items;
        friends.forEach(friend => {
            statusIndicator.download("Friends");
            let groupId = friend.groupid;
            let groupName = groupMap.get(groupId) || "默认分组";
            let rowData = [friend.uin, friend.remark, friend.name, groupName];
            API.Friends.getFriendshipTime(friend.uin, (timeData) => {
                timeData = timeData.replace(/^_Callback\(/, "");
                timeData = timeData.replace(/\);$/, "");
                let timeInfo = JSON.parse(timeData);
                let addTime = 0;
                if (timeInfo.data && timeInfo.data.hasOwnProperty('addFriendTime')) {
                    addTime = timeInfo.data.addFriendTime || 0;
                } else {
                    console.warn(timeData);
                }
                addTime = addTime == 0 ? "老朋友啦" : new Date(addTime * 1000).format("yyyy-MM-dd hh:mm:ss");
                rowData[4] = addTime;
                ws_data.push(rowData);
                statusIndicator.downloadSuccess("Friends");
                if (friends.length == ws_data.length - 1) {
                    writeToExcel(ws_data);
                }
            });
        });
    });
};


/**
 * 获取一页的留言板列表
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Boards.fetchList = function (uin, page, nextFunc) {
    API.Boards.getBoards(uin, page, function (data) {
        // 去掉函数，保留json
        data = data.replace(/^_Callback\(/, "");
        data = data.replace(/\);$/, "");
        data = JSON.parse(data);

        let commentList = data.data.commentList || [];
        QZone.Boards.Data = QZone.Boards.Data.concat(commentList);

        // 提示信息
        QZone.Boards.total = data.data.total || 0;
        statusIndicator.total(QZone.Boards.total, 'Boards');

        nextFunc(page);
    }, nextFunc);
};


/**
 * 获取全部留言板列表
 */
API.Boards.fetchAllList = function () {

    // 重置数据
    QZone.Boards.Data = [];
    QZone.Boards.Images = [];

    statusIndicator.start("Boards");

    // 获取数据
    var nextListFunc = function (page) {
        // TODO error
        if (QZone.Boards.Data.length < QZone.Boards.total) {
            // 总数不相等时继续获取
            API.Boards.fetchList(QZone.Common.uin, page + 1, arguments.callee);
        } else {
            // 留言板数据写入到文件
            API.Boards.contentToFile();
        }
    }
    API.Boards.fetchList(QZone.Common.uin, 0, nextListFunc);
};

/**
 * 将留言写入到文件
 */
API.Boards.contentToFile = function () {
    let result = "", newline = '\r\n\r\n';
    let items = QZone.Boards.Data;
    for (let index = 0; index < items.length; index++) {
        const borad = items[index];
        // 提示信息，下载数+1
        statusIndicator.download("Boards");

        result += '#### 第' + (items.length - index) + '楼\r\n';
        result += '> {0} 【{1}】'.format(borad.pubtime, borad.nickname) + newline;
        result += '> 正文：' + newline;
        let htmlContent = borad.htmlContent.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');
        htmlContent = htmlContent.replace(/\n/g, "\r\n");
        let mdContent = turndownService.turndown(htmlContent);
        mdContent = API.Utils.mentionFormat(mdContent, "MD");
        mdContent = API.Utils.emojiFormat(mdContent, "MD");
        let nickname = QZone.Common.uin == borad.uin ? "我" : borad.nickname;
        result += '- [{0}](https://user.qzone.qq.com/{1})：{2}'.format(nickname, borad.uin, mdContent) + newline;

        result += '> 回复：' + newline;

        let replyList = borad.replyList || [];
        replyList.forEach(reply => {
            let replyName = QZone.Common.uin == reply.uin ? "我" : reply.nick;
            let replyContent = API.Utils.formatContent(reply.content, "MD");
            let replyTime = new Date(reply.time * 1000).format('yyyy-MM-dd hh:mm:ss');
            let replyMd = '- [{0}](https://user.qzone.qq.com/{1})：{2} 【*{3}*】'.format(replyName, reply.uin, replyContent, replyTime);
            result += replyMd + newline;
        });
        result += '---' + newline;
        // 提示信息，下载数+1
        statusIndicator.downloadSuccess("Boards");
    }

    let filepath = QZone.Boards.ROOT + "/留言板.md";
    API.Utils.writeFile(result, filepath, (fileEntry) => {
        console.info("已下载：" + fileEntry.fullPath);
        // 下一步，下载相册
        operator.next(OperatorType.PHOTO_LIST);
    }, (error) => {
        console.error(error);
        // 提示信息，下载数+1
        statusIndicator.downloadFailed("Boards", item.length);
    });

};

/**
 * 获取相册一页的照片
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Photos.fetchOneList = async function (albumItem, page, nextFunc) {
    await API.Photos.getImages(albumItem.id, page, async (imgData) => {
        let albumId = albumItem.id;
        // 去掉函数，保留json
        imgData = imgData.replace(/^shine0_Callback\(/, "");
        imgData = imgData.replace(/\);$/, "");
        imgData = JSON.parse(imgData);
        let photoList = imgData.data.photoList || [];

        QZone.Photos.Data = QZone.Photos.Data.concat(photoList);
        let albumnIdList = QZone.Photos.Images.get(albumId) || [];
        QZone.Photos.Images.set(albumId, albumnIdList.concat(photoList));

        await nextFunc(page);
    }, nextFunc);
};


/**
 * 获取单个相册的全部照片
 */
API.Photos.fetchOneAllList = async function (albumItem, endFun) {
    // 获取玩一个相册后等待3秒再获取下一个相册
    await API.Utils.sleep(3000);

    // 重置数据
    QZone.Photos.Images.set(albumItem.id, []);

    // 获取数据
    var nextListFunc = async function (page) {
        // TODO error
        if (QZone.Photos.Images.get(albumItem.id).length < albumItem.total && page * 80 < albumItem.total) {
            // 请求一页成功后等待一秒再请求下一页
            await API.Utils.sleep(3000);
            // 总数不相等时继续获取
            await API.Photos.fetchOneList(albumItem, page + 1, arguments.callee);
        } else {
            await endFun(albumItem);
        }
    }
    await API.Photos.fetchOneList(albumItem, 0, nextListFunc);
};

/**
 * 获取相册列表
 */
API.Photos.fetchAllList = async function () {
    // 重置数据
    QZone.Photos.Data = [];
    QZone.Photos.Images = new Map();
    QZone.Photos.Video = [];
    QZone.Photos.Failed = [];

    statusIndicator.start("Photos");

    await API.Photos.getPhotos(QZone.Common.uin, async (albumData) => {
        // 去掉函数，保留json
        albumData = albumData.replace(/^shine0_Callback\(/, "");
        albumData = albumData.replace(/\);$/, "");
        albumData = JSON.parse(albumData);

        // 相册分类
        let classList = albumData.data.classList || [];
        let classMap = new Map();
        for await (let classItem of classList) {
            classMap.set(classItem.id, classItem.name);
        }
        // 相册分类列表
        let albumListModeClass = albumData.data.albumListModeClass || [];
        for await (let modeClass of albumListModeClass) {
            // 分类ID
            let classId = modeClass.classId;
            // 分类名称
            let className = classMap.get(classId) || "默认分类";
            // 相册列表            
            let albumList = modeClass.albumList || [];
            for await (let album of albumList) {
                await API.Photos.fetchOneAllList(album, async (album) => {
                    let alnumName = API.Utils.filenameValidate(album.name);
                    QZone.Common.Filer.cd('/', () => {
                        console.info('切换到根目录');
                        QZone.Common.Filer.mkdir(QZone.Photos.ROOT + "/" + className + "/" + alnumName, false, async (entry) => {
                            console.info('创建目录成功：' + entry.fullPath);
                            let photoList = QZone.Photos.Images.get(album.id) || [];
                            for await (let photo of photoList) {
                                // 普通图下载
                                let url = photo.url;
                                // 高清图下载
                                // let url = photo.raw;
                                // 原图下载
                                // let url = photo.origin_url;
                                // 自动识别，默认原图优先
                                // let url = API.Photos.getDownloadUrl(photo);
                                // let url = photo.raw || photo.url;
                                if (photo.is_video) {
                                    QZone.Photos.Video.push(photo);
                                    continue;
                                }
                                url = url.replace(/http:\//, "https:/");
                                let photoName = photo.name + "_" + API.Utils.guid();
                                photoName = API.Utils.filenameValidate(photoName);
                                let filepath = QZone.Photos.ROOT + "/" + className + "/" + alnumName + "/" + photoName;

                                // 正在下载的照片+1
                                statusIndicator.download();
                                await API.Utils.writeImage(url, filepath, true, (fileEntry) => {
                                    // 下载成功的照片+1
                                    statusIndicator.downloadSuccess();
                                }, (e) => {
                                    QZone.Photos.Failed.push(photo);
                                    // 下载失败的照片+1
                                    statusIndicator.downloadFailed();
                                });
                                // 请求完一个相册后，等待5秒再请求下一个相册
                                await API.Utils.sleep(500);
                            }
                        });
                    });
                    // 请求完一个相册后，等待5秒再请求下一个相册
                    await API.Utils.sleep(3000);
                });
                // 请求完一个相册后，等待5秒再请求下一个相册
                await API.Utils.sleep(3000);
            }
        }
        operator.next(OperatorType.AWAIT_IMAGES);
    }, (error) => {
        console.log(error);
    });
}