/**
 * 提示信息
 */

const MAX_MSG = {
    Blogs: '正在获取日志，已获取 {0} 篇，总共 {1} 篇，已导出 {2} 篇，请稍后...',
    Diaries: '正在获取私密日记，已获取 {0} 篇，总共 {1} 篇，已导出 {2} 篇，请稍后...',
    Messages: '正在获取说说列表，已获取 {0} 条，总共 {1} 条，已导出 {2} 条，请稍后...',
    Photos: '正在获取相册列表，已获取 {0} 个，总共 {1} 个，已导出 {2} 个，请稍后...',
    Boards: '正在获取留言板列表，已获取 {0} 条，总共 {1} 条，已导出 {2} 条，请稍后...',
    Friends: '正在获取QQ好友，已获取好友 {0} 个，总共 {1} 个，已导出 {2} 个，请稍后...',
    Groups: '正在获取QQ群列表，已获取 {0} 个，总共 {1} 个，已导出 {2} 个，请稍后...',
    Images: '正在下载图片，已下载 {0} 张图片，已失败 <span style="color: red;"> {1} </span> 张图片...',
}

const MODAL_HTML = `
    <div class="modal">
        </br>
        </br>
        <h3 id="backupStatus">正在导出备份，请不要关闭或刷新当前页面</h3>
        <br/>
        <hr/>
        <br/>
        <p id="exportBlogs" style="display: none;" >正在获取日志，请稍后...</p>
        <p id="exportDiaries" style="display: none;" >正在获取私密日记，请稍后...</p>
        <p id="exportMessages" style="display: none;" >正在获取说说，请稍后...</p>
        <p id="exportPhotos" style="display: none;" >正在获取说说，请稍后...</p>
        <p id="exportBoards" style="display: none;" >正在获取留言板，请稍后...</p>
        <p id="exportFriends" style="display: none;" >正在获取QQ好友信息，请稍后...</p>
        <p id="exportGroups" style="display: none;" >正在获取QQ群组，请稍后...</p>
        <br/>
        <p id="exportImages">正在下载图片，已下载 - 张图片，已失败 - 张图片...</p>
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
└--- 群组
    └--- 群组.xlsx


Windows 推荐使用 [MarkdownPad](http://markdownpad.com/)
MacOS 推荐使用 [MacDown](http://macdown.uranusjr.com/)
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
     * 获取所有日志信息
     */
    BLOG_INFO: 'BLOG_INFO',

    /**
     * 获取私密日记所有列表
     */
    DIARY_LIST: 'DIARY_LIST',

    /**
     * 获取所有私密日记信息
     */
    DIARY_INFO: 'DIARY_INFO',

    /**
     * 获取所有说说列表
     */
    MESSAGES_LIST: 'MESSAGES_LIST',

    /**
     * 获取所有私密日记信息
     */
    MESSAGES_WRITE: 'MESSAGES_WRITE',

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

$(document).ready(
    function () {
        operator.next(OperatorType.INIT);
    }
);
/**
 * 创建备份流程控制者
 */
function createOperator() {
    let operator = new Object();
    operator.next = async function (type) {
        switch (type) {
            case OperatorType.INIT:
                init();
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                showModal();
                initFolder();
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                operator.next(OperatorType.MESSAGES_LIST);
                break;
            case OperatorType.BLOG_LIST:
                // 获取日志所有列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Blogs.fetchAllList();
                break;
            case OperatorType.BLOG_INFO:
                // 获取日志所有信息
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Blogs.fetchAllInfo();
                break;
            case OperatorType.DIARY_LIST:
                // 获取私密日记所有列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Diaries.fetchAllList();
                break;
            case OperatorType.DIARY_INFO:
                // 获取私密日记所有信息
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Diaries.fetchAllInfo();
                break;
            case OperatorType.MESSAGES_LIST:
                // 获取说说列表
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Messages.fetchAllList();
                break;
            case OperatorType.MESSAGES_WRITE:
                // 说说写入到文件
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                API.Messages.contentToFiles();
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
                });
                break;
            case OperatorType.ZIP:
                // 延迟0.5秒，确保压缩完
                await API.Utils.sleep(CONFIG.SLEEP_TIME);
                statusIndicator.complete();
                break;
            default:
                break;
        }
    };

    operator.downloadImage = async function (url, savePath) {
        statusIndicator.download();
        API.Utils.writeImage(url, savePath, (fileEntry) => {
            if (CONFIG.DEBUG) {
                console.log(fileEntry);
            }
            statusIndicator.downloadSuccess();
        }, (e) => {
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
        },
        Groups: {
            id: 'exportGroups',
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
            $("#" + obj.id).text(tip);
        }
        let imgTip = MAX_MSG.Images.format(this.Images.downloaded, this.Images.downloadFailed);
        if (this.Images.downloaded + this.Images.downloadFailed === this.Images.total) {
            imgTip = imgTip.replace('请稍后', '已完成');
        }
        $("#exportImages").html(imgTip);
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
    initializeFiler();

    // 初始化压缩工具
    QZone.Common.Zip = new JSZip();

    // 添加按钮监听
    chrome.runtime.onMessage.addListener(function (msg, sender) {
        if (msg.from === 'popup' && msg.subject === 'startBackup') {
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
    $('.modal').modal({});

    var blobLink = $('#downloadBtn');
    blobLink.hide();
    blobLink.click(() => {
        blobLink.attr('disabled', true);
        blobLink.text('正在下载...');
        // 压缩
        QZone.Common.Zip.generateAsync({ type: "blob" }).then(function (blob) {
            saveAs(blob, QZone.ZIP_NAME);
            blobLink.text('已导出');
        }, (err) => {
            blobLink.innerHTML += " " + err;
        });
    });
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
            });
        }, function () {

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
            // 开始获取日志内容
            operator.next(OperatorType.BLOG_INFO);
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
        let content = API.Blogs.constructContent(idx, title, postTime, markdown, blogInfo);
        API.Blogs.writeFile(idx, title, postTime, content);
        nextFunc(idx, null);
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
API.Blogs.constructContent = function (index, title, postTime, markdown, blogInfo) {
    // 拼接标题，日期，内容
    let result = "# " + title + "\r\n\r\n";
    result = result + "> " + postTime + "\r\n\r\n";
    result = result + markdown.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n";

    // 拼接评论
    result = result + "> 评论:\r\n\r\n";
    blogInfo.data.comments.forEach(function (entry) {
        let content = "* " + entry.poster.name + ": " + API.Utils.formatContent(entry.content, 'MD') + "\r\n";
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
    let images = [];
    while (match = imageLinkM.exec(tmpResult)) {
        var imageInfo = {};
        imageInfo.filename = API.Utils.guid();
        imageInfo.filepath = QZone.Blogs.IMAGES_ROOT + "/" + imageInfo.filename;
        result = result.split(match[1]).join("images/" + imageInfo.filename);
        // imageInfo.url = API.Photos.getExternalUrl(match[1]) || match[1].replace(/http:\//, "https:/");
        imageInfo.url = match[1].replace(/http:\//, "https:/");
        imageInfo.title = title;
        images.push(imageInfo);
        QZone.Blogs.Images.push(imageInfo);

    }
    QZone.Blogs.Data[index].images = images;
    for (let i = 0; i < images.length; i++) {
        let imageInfo = images[i];
        operator.downloadImage(imageInfo.url, imageInfo.filepath);
    }
    return result;
};

/**
 * 保存日志到 HTML5 filesystem
 * 
 * @param {string} title 
 * @param {string} postTime 
 * @param {string} content 
 */
API.Blogs.writeFile = function (idx, title, postTime, content) {
    let filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    let orderNum = API.Utils.prefixNumber(idx + 1, QZone.Blogs.total.toString().length);
    filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    filepath = QZone.Blogs.ROOT + '/' + filename + ".md";

    API.Utils.writeFile(content, filepath, (fileEntry) => {
        if (CONFIG.DEBUG) {
            console.info('已保存：' + fileEntry.fullPath);
        }
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
            operator.next(OperatorType.DIARY_INFO);
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
    let images = [];
    while (match = imageLinkM.exec(tmpResult)) {
        var imageInfo = {};
        imageInfo.filename = API.Utils.guid();
        imageInfo.filepath = QZone.Diaries.IMAGES_ROOT + "/" + imageInfo.filename;
        result = result.split(match[1]).join("images/" + imageInfo.filename);
        // imageInfo.url = API.Photos.getExternalUrl(match[1]) || match[1].replace(/http:\//, "https:/");
        imageInfo.url = match[1].replace(/http:\//, "https:/");
        imageInfo.title = title;
        images.push(imageInfo);
        QZone.Diaries.Images.push(imageInfo);

    }
    QZone.Diaries.Data[index].images = images;
    for (let i = 0; i < images.length; i++) {
        let imageInfo = images[i];
        operator.downloadImage(imageInfo.url, imageInfo.filepath);
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
        if (CONFIG.DEBUG) {
            console.info('已保存：' + fileEntry.fullPath);
        }
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
                location: item.lbs || {},
                createTime: new Date(item.created_time * 1000).format('yyyy-MM-dd hh:mm:ss')
            };
            if (info.images.length > 0) {
                // 图片信息
                info.images.forEach(function (entry) {
                    var uid = API.Utils.guid();
                    entry.uid = uid;
                    entry.filepath = QZone.Messages.IMAGES_ROOT + "/" + uid;
                    var url = entry.url2.replace(/http:\//, "https:/");
                    // 下载图片
                    operator.downloadImage(url, entry.filepath);
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
            // 下一步，开始写入说说到文件
            operator.next(OperatorType.MESSAGES_WRITE);
        }
    }
    API.Messages.fetchList(QZone.Common.uin, 0, nextListFunc);
};



/**
 * 构建说说文件内容
 */
API.Messages.contentToFiles = function () {
    let content = "# 说说\r\n\r\n";
    var yearFilePath = QZone.Messages.ROOT + "/说说.md";
    QZone.Messages.Data.forEach((data) => {
        content = content + API.Messages.writeFiles(data, yearFilePath);
        statusIndicator.downloadSuccess("Messages");
    });
    API.Utils.writeFile(content, yearFilePath, () => {
        // 下一步，等待图片下载完成
        operator.next(OperatorType.AWAIT_IMAGES);
    });
};

/**
 * 写入说说到文件
 */
API.Messages.writeFiles = function (item) {
    statusIndicator.download('Messages');

    let location = item.location['name'];
    var result = "> " + item.createTime;
    if (location && location !== "") {
        result += "【" + location + "】";
    }

    var content = item.content.replace(/\n/g, "\r\n") + "\r\n";
    // 转换内容
    content = API.Utils.formatContent(content);
    result = result + "\r\n\r\n" + content;

    var imageContent = '<div style="width: 800px;" >';
    var imgSrc = '<img src="{0}" width="200px" height="200px" align="center" />';
    if (item.images.length > 0) {
        // 图片信息
        item.images.forEach(function (entry) {
            // var uid = API.Utils.guid();
            imageContent = imageContent + '\r\n' + imgSrc.format('images/' + entry.uid) + '\r\n';
            // var imgFilePath = QZone.Messages.IMAGES_ROOT + "/" + uid;
            // var url = entry.url2.replace(/http:\//, "https:/");
            // var url = API.Photos.getExternalUrl(entry.url2);
            // var url = entry.url2;
            // 下载图片
            // operator.downloadImage(url, imgFilePath);
        });
        imageContent = imageContent + '</div>' + '\r\n\r\n';
        result = result + imageContent;
    };
    // 评论内容
    var commentContent = "> 评论:\r\n\r\n";
    item.comments.forEach(function (entry) {
        commentContent = "* " + entry.name + ": " + API.Utils.formatContent(entry.content, 'MD') + "\r\n";
        // 回复包含图片
        var repImgs = entry.pic || [];
        repImgs.forEach(function (entry) {
            var uid = API.Utils.guid();
            commentContent = commentContent + '\r\n' + imgSrc.format('images/' + uid) + '\r\n';
            var imgFilePath = QZone.Messages.IMAGES_ROOT + "/" + uid;
            var url = entry.hd_url.replace(/http:\//, "https:/");
            // var url = API.Photos.getExternalUrl(entry.hd_url);
            // var url = entry.hd_url;
            // 下载图片
            operator.downloadImage(url, imgFilePath);
        });
        var replies = entry.list_3 || [];
        replies.forEach(function (rep) {
            var c = "\t* " + rep.name + ": " + API.Utils.formatContent(rep.content, 'MD') + "\r\n";
            commentContent = commentContent + c;
        });
    });
    // 转换视频 // TODO
    // 转换音频 // TODO
    result = result + commentContent + "\r\n\r\n";
    result = result + "---" + "\r\n";
    return result;
};
