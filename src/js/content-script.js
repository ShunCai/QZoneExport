streamSaver.mitm = 'https://github.lvshuncai.com/StreamSaver.js/mitm.html'

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
    Videos: '正在获取视频列表，已获取 <span style="color: #1ca5fc;">{0}</span> 条，总共 <span style="color: #1ca5fc;">{1}</span> 条，已导出 <span style="color: #1ca5fc;">{2}</span> 条，请稍后...',
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
                <p id="exportVideos" style="display: none;" >正在获取视频，请稍后...</p>
                <p id="exportImages">正在下载图片，已下载 - 张图片，已失败 - 张图片...</p>
                <br/>
                <div id="progress" class="progress" style="display: none;">
                    <div id="progressbar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">已下载 0%</div>
                </div>
            </div>
            <div class="modal-footer">
                <button id="showFailedImages" type="button" class="btn btn-danger" style="display: none;" data-toggle="modal" data-target="#modalTable">详情</button>
                <button id="downloadBtn" type="button" class="btn btn-primary" style="display: none;" >下载</button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
            </div>
            </div>
        </div>
    </div>
    <div id="modalTable" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myLargeModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
        <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title">下载失败的列表</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
            <table id="table"></table>
        </div>
        <div class="modal-footer">
            <button id="againDownload" type="button" class="btn btn-primary" data-dismiss="modal">重试</button>
            <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
        </div>
        </div>
    </div>
    </div>
`

const README_TEXT = `
# QQ空间导出助手

> QQ空间导出助手，用于备份QQ空间的说说、日志、私密日记、相册、视频、留言板、QQ好友为文件，供永久保存

## 简介

互联网产品都有着自己的生命周期，新浪博客相册，网易相册，QQ账号注销等等，于是写了这个基于Chrome的QQ空间导出助手的谷歌扩展，用于备份QQ空间的说说、日志、私密日记、相册、视频、留言板、QQ好友为文件，供永久保存。

## 安装
#### 源码安装
- 下载源码
- 打开[谷歌扩展](chrome://extensions/)
- 勾选开发者模式
- 点击[加载已解压的扩展程序]按钮
- 选择QZoneExport/src文件夹

#### Google
- [QQ空间导出助手](https://atom.io/)


## 使用
- 登录QQ空间  
  支持空间URL：https://user.qzone.qq.com/QQ号  
  不支持空间URL：https://QQ号.qzone.qq.com
- 右上角点击插件图标  
 ![](https://i.loli.net/2019/08/04/Td5hUAfcvH14Yik.png)
- 勾选备份内容
- 点击开始备份
- 等待备份完成   
![](https://i.loli.net/2019/08/04/wiIQYvGEsR38Z12.png)
- 点击下载备份  
![](https://i.loli.net/2019/08/04/LSoxmFJAf4Ms9NZ.png)
- 下载并保存  
![](https://i.loli.net/2019/08/04/NIkosuxiRKLHlFB.png)
- 推荐使用 [Atom](https://atom.io/) Markdown编辑器查看.md备份内容
- 备份目录结构如下    
    ├─好友  
    │  └─QQ好友.xlsx  
    ├─日志  
    │  ├─images  
    │  │  └─图片名称  
    │  └─分类名称  
    │      └─日志标题.md  
    ├─留言板  
    │  └─留言板.md  
    ├─相册  
    │  └─分类名称  
    │      └─相册名称  
    │          └─相片名称  
    ├─私密日记  
    │  ├─images  
    │  │  └─图片名称  
    │  └─日志标题.md  
    ├─视频  
    │  └─视频链接.downlist  
    └─说说  
    │   ├─2019年.md  
    │   └─images  
    │       └─图片名称  
    ├─说明.md  

## 备份内容预览
### 说说
![](https://s2.ax1x.com/2019/08/04/eySxun.png)
### 日志
![](https://s2.ax1x.com/2019/08/04/eySjjs.png)
### 留言板
![](https://i.loli.net/2019/08/04/3oj4emPFhC29iAQ.png)
### 好友
![](https://i.loli.net/2019/08/04/AhQB1PeGfTFl3N2.png)



## 配置
- 右键点击插件图标
- 弹出菜单选择【选项】  
- 配置页面可配置备份方式和选项
![](https://i.loli.net/2019/08/04/XcqReS1sHInlCMN.png)
- 推荐使用默认配置，遇到QQ冻结时，可调整查询间隔
- 无法更改的配置表示尚未支持


## TO-DO
- [x] 普通日志导出
- [x] 私密日记导出
- [x] 普通说说导出
- [x] QQ好友导出
- [x] 普通相册导出
- [x] 留言板导出
- [x] 优化插件UI
- [x] 原图相册导出
- [x] 视频导出
- [ ] JSON导出

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
    * 获取视频列表
    */
    VIDEO_LIST: 'VIDEO_LIST',

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
    // 添加按钮监听
    chrome.runtime.onMessage.addListener(function (data) {
        if (data.from === 'popup' && data.subject === 'startBackup') {
            QZone.Common.ExportType = data.exportType;
            operator.next(OperatorType.SHOW);
        }
    });
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
                await API.Utils.sleep(500);
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                showModal();
                await initFolder();
                await API.Utils.sleep(500);
                operator.next(OperatorType.BLOG_LIST);
                break;
            case OperatorType.BLOG_LIST:
                // 获取日志所有列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.DIARY_LIST, () => {
                    API.Blogs.fetchAllList();
                });
                break;
            case OperatorType.DIARY_LIST:
                // 获取私密日记所有列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.MESSAGES_LIST, () => {
                    API.Diaries.fetchAllList();
                });
                break;
            case OperatorType.MESSAGES_LIST:
                // 获取说说列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.FRIEND_LIST, () => {
                    API.Messages.hadlerAllList();
                });
                break;
            case OperatorType.FRIEND_LIST:
                // 获取并下载QQ好友Excel
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.BOARD_LIST, () => {
                    API.Friends.fetchAllList();
                });
                break;
            case OperatorType.BOARD_LIST:
                // 获取留言板列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.PHOTO_LIST, () => {
                    API.Boards.fetchAllList();
                });
                break;
            case OperatorType.PHOTO_LIST:
                // 获取相册列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.VIDEO_LIST, () => {
                    API.Photos.fetchAllList();
                });
                break;
            case OperatorType.VIDEO_LIST:
                // 获取视频列表
                await API.Utils.sleep(500);
                operator.checkedNext(type, OperatorType.AWAIT_IMAGES, () => {
                    API.Videos.hadlerAllList();
                });
                break;
            case OperatorType.AWAIT_IMAGES:
                // 如果图片还没下载完，弄个会动的提示，让用户知道不是页面卡死
                let isComplate = (statusIndicator.Images.downloadFailed + statusIndicator.Images.downloaded) >= statusIndicator.Images.total;
                while (statusIndicator.Images.downloading > 0 && isComplate) {
                    var dot = '';
                    if (Math.random() > 0.5) {
                        dot = '...'
                    };
                    statusIndicator.updateTitle("还没下载完图片， 等一等..." + dot);
                    await API.Utils.sleep(500);
                }
                // 压缩
                await API.Utils.Zip(FOLDER_ROOT);
                operator.next(OperatorType.ZIP);
                break;
            case OperatorType.ZIP:
                // 延迟3秒，确保压缩完
                await API.Utils.sleep(500);
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
        await API.Utils.writeImage(imageInfo.url, imageInfo.filepath, imageInfo.isMimeType).then((fileEntry) => {
            imageInfo.filepath = fileEntry.fullPath;
            statusIndicator.downloadSuccess();
            statusIndicator.Images.data.success.push(imageInfo);
        }).catch((e) => {
            statusIndicator.Images.data.failed.push(imageInfo);
            console.error("下载失败", e, imageInfo);
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
            data: {
                success: [],
                failed: [],
                downloading: []
            },
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
        Videos: {
            id: 'exportVideos',
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
        if (statusIndicator.Images.downloadFailed > 0) {
            $("#showFailedImages").show();
        }
        $("#backupStatus").html("备份完成，请下载。");
    };

    status.updateTitle = function (title) {
        $("#backupStatus").html(title);
    };

    status.download = function (type) {
        type = type || 'Images';
        this[type].downloading += 1;
        if ('Images' === type) {
            this[type].total += 1;
        }
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
    if (window.location.href.indexOf("qzone.qq.com") == -1 || window.location.protocol == 'filesystem:') {
        return;
    }

    // 读取配置项
    chrome.storage.local.get(Qzone_Config, function (item) {
        Qzone_Config = item;
    })

    // 获取Token
    API.Utils.getQzoneToken();
    // 获取QQ号
    API.Utils.getUin();

    // 初始化文件夹
    QZone.Common.Filer = new Filer();
    QZone.Common.Filer.init({ persistent: false, size: 10 * 1024 * 1024 * 1024 }, function (fs) {
        QZone.Common.Filer.ls(FOLDER_ROOT, function (entries) {
            QZone.Common.Filer.rm(FOLDER_ROOT, function () {

            });
        });
    });

    // 初始化压缩工具
    QZone.Common.Zip = new JSZip();
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

    $('#downloadBtn').click(() => {

        $('#progress').show();
        $("#progressbar").css("width", "0%");
        $("#progressbar").attr("aria-valuenow", "0");
        $('#progressbar').text('已下载0%');

        $('#showFailedImages').attr('disabled', true);
        $('#downloadBtn').attr('disabled', true);
        $('#downloadBtn').text('正在下载');

        let writeStream = streamSaver.createWriteStream(QZone.ZIP_NAME).getWriter()
        QZone.Common.Zip.generateInternalStream({
            type: "blob",
            streamFiles: true
        }).on('data', (data, metadata) => {
            $("#progressbar").css("width", metadata.percent.toFixed(2) + "%");
            $("#progressbar").attr("aria-valuenow", metadata.percent.toFixed(2));
            $('#progressbar').text('已下载' + metadata.percent.toFixed(2) + '%');
            writeStream.write(data)
        }).on('error', (e) => {
            console.error(e);
            writeStream.abort(e);
            $('#downloadBtn').text('下载失败，请重试。');
            $('#showFailedImages').attr('disabled', false);
            $('#downloadBtn').attr('disabled', false);
        }).on('end', () => {
            writeStream.close();
            $("#progressbar").css("width", "100%");
            $("#progressbar").attr("aria-valuenow", 100);
            $('#progressbar').text('已下载' + '100%');
            $('#downloadBtn').text('已下载');
            $('#showFailedImages').attr('disabled', false);
            $('#downloadBtn').attr('disabled', false);
        }).resume();
    });

    //进度模式窗口隐藏后
    $('#exampleModalCenter').on('hidden.bs.modal', function () {
        $("#exampleModalCenter").remove();
        $("#modalTable").remove();
        statusIndicator = createStatusIndicator();
    })

    //显示下载失败的图片
    $('#modalTable').on('shown.bs.modal', function () {
        $("#table").bootstrapTable('destroy').bootstrapTable({
            undefinedText: '-',
            toggle: 'table',
            locale: 'zh-CN',
            search: true,
            searchAlign: 'left',
            height: "50%",
            pagination: true,
            pageList: [10, 25, 50, 100, 200, 'All'],
            paginationHAlign: 'left',
            clickToSelect: true,
            paginationDetailHAlign: 'right',
            columns: [{
                field: 'state',
                checkbox: true,
                align: 'left'
            }, {
                field: 'name',
                title: '名称',
                titleTooltip: '名称',
                align: 'left',
                width: '30%',
                visible: true
            }, {
                field: 'desc',
                title: '描述',
                titleTooltip: '描述',
                align: 'left',
                width: '30%',
                visible: true
            }, {
                field: 'source',
                title: '来源',
                titleTooltip: '来源',
                align: 'left',
                width: '30%',
                visible: true,
                formatter: function (value, row, index, field) {
                    return value + "[" + row.className + "]";
                }
            }, {
                field: 'className',
                title: '分类',
                visible: false
            }, {
                field: 'url',
                title: '地址',
                titleTooltip: '地址',
                align: 'left',
                width: '5%',
                visible: true,
                formatter: function (value, row, index, field) {
                    return '<a target="_blank" class="like" href="' + value + '" title="访问">访问</a>';
                }
            }, {
                field: 'uid',
                visible: false
            }, {
                field: 'filename',
                visible: false
            }, {
                field: 'filepath',
                visible: false
            }, {
                field: 'isMimeType',
                visible: false
            }],
            data: statusIndicator.Images.data.failed
        })
        $('#table').bootstrapTable('resetView')

        $("#againDownload").click(async function () {
            let selects = $('#table').bootstrapTable('getSelections');
            let faileds = statusIndicator.Images.data.failed;
            let tasks = [];
            for (let index = 0; index < selects.length; index++) {
                const element = selects[index];
                statusIndicator["Images"].downloadFailed -= 1;
                faileds.splice(faileds.findIndex(item => item.uuid === element.uuid), 1)
                tasks.push(operator.downloadImage(element));
            }
            await Promise.all(tasks);
            operator.next(OperatorType.AWAIT_IMAGES);
        })
    })
}

/**
 * 创建在Filesystem临时文件夹
 */
async function initFolder() {

    console.info('所有模块信息', QZone);

    // 切换到根目录
    QZone.Common.Filer.cd('/', async (root) => {
        console.info("切换到根目录", root);
        // 创建模块文件夹
        let createModuleFolder = () => {
            return new Promise(async function (resolve, reject) {
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
                    let entry = await API.Utils.createFolder(rootPath);
                    console.info('创建目录成功', entry);
                }
                resolve();
            });
        }

        // 创建模块文件夹
        await createModuleFolder();

        // 创建说明文件
        QZone.Common.Filer.write(FOLDER_ROOT + "说明.md", { data: README_TEXT, type: "text/plain" }, (entry) => {
            console.info('创建文件成功', entry);
            return true;
        });
        return true;
    });
    return true;
};

/**
 * 获取一页的日志列表
 *
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Blogs.fetchList = function (page, nextFunc) {
    API.Blogs.getBlogs(page).then((data) => {
        // 去掉函数，保留json
        data = data.replace(/^_Callback\(/, "");
        data = data.replace(/\);$/, "");
        result = JSON.parse(data);
        QZone.Blogs.total = result.data.totalNum;
        result.data.list.forEach(function (item) {
            var i = {
                blogId: item.blogId,
                pubTime: item.pubTime,
                title: item.title,
                cate: item.cate
            };
            QZone.Blogs.Data.push(i);
        });
        // 提示信息
        statusIndicator.total(QZone.Blogs.total, 'Blogs');
        statusIndicator.update('Blogs');
        nextFunc(page);
    }).catch((e) => {
        nextFunc(page);
        console.error("获取日志列表异常，当前页：" + page);
    })
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
    var nextList = function (page) {
        if (QZone.Blogs.Data.length < QZone.Blogs.total && page * Qzone_Config.Blogs.pageSize < QZone.Blogs.total) {
            // 总数不相等时继续获取
            API.Blogs.fetchList(page + 1, arguments.callee);
        } else {
            // 获取日志所有信息
            API.Blogs.fetchAllInfo();
        }
    }
    API.Blogs.fetchList(0, nextList);
};

/**
 * 获取一篇日志的内容
 * 
 * @param {integer} idx 日志列表中的第几篇日志
 * @param {function} nextFunc 获取完后执行的函数
 */
API.Blogs.fetchInfo = function (idx, nextFunc) {
    let blogid = QZone.Blogs.Data[idx].blogId;
    let postTime = QZone.Blogs.Data[idx].pubTime;
    let title = QZone.Blogs.Data[idx].title;

    statusIndicator.download("Blogs");
    API.Blogs.getInfo(blogid).then((data) => {
        API.Blogs.contentToFile(data, idx, title, postTime, nextFunc);
    }).catch((e) => {
        console.error("获取日志异常", title);
        nextFunc(idx, "获取日志异常，日志标题=" + title);
    })
}

/**
 * 获得所有日志的内容
 */
API.Blogs.fetchAllInfo = function () {
    // 获取数据
    var nextBlogFunc = function (idx, err) {
        if (QZone.Blogs.total > idx + 1) {
            API.Blogs.fetchInfo(idx + 1, arguments.callee);
        } else {
            // 告知完成获取所有日志，并开始等待日志图片下载完成
            operator.next(OperatorType.DIARY_LIST);
        }
    }
    nextBlogFunc(-1, null);
};

/**
 * 读取日志内容到文件
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
            API.Blogs.writeFile(idx, label, title, postTime, content, blogInfo);
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
            filepath: QZone.Blogs.IMAGES_ROOT + "/" + fileName,
            isMimeType: false,
            name: title,
            desc: title,
            source: title,
            className: blogInfo.data.category
        };

        result = result.split(orgUrl).join("../images/" + imageInfo.filename);
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
API.Blogs.writeFile = function (idx, label, title, postTime, content, blogInfo) {
    let filename, filepath;
    postTime = new Date(postTime).format('yyyyMMddhhmmss');
    let orderNum = API.Utils.prefixNumber(idx + 1, QZone.Blogs.total.toString().length);
    filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_【" + title + "】");
    if (label && label != "") {
        filename = API.Utils.filenameValidate(orderNum + "_" + postTime + "_" + label + "【" + title + "】");
    }
    filepath = QZone.Blogs.ROOT + "/" + blogInfo.data.category;
    API.Utils.createFolder(filepath).then(() => {
        filepath += '/' + filename + ".md";
        API.Utils.writeFile(content, filepath, (fileEntry) => {
            statusIndicator.downloadSuccess('Blogs');
        }, (error) => {
            statusIndicator.downloadFailed('Blogs');
        });
    });

};


/**
 * 获取一页的私密日记列表
 *
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Diaries.fetchList = function (page, nextFunc) {
    API.Diaries.getDiaries(page).then((data) => {
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
        nextFunc(page);
    }).catch((e) => {
        nextFunc(page);
        console.error("获取私密日志列表异常，当前页：" + page);
    })
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
    var nextListFunc = function (page) {
        // TODO error
        if (QZone.Diaries.Data.length < QZone.Diaries.total && page * Qzone_Config.Diaries.pageSize < QZone.Diaries.total) {
            // 总数不相等时继续获取
            API.Diaries.fetchList(page + 1, arguments.callee);
        } else {
            // 获取私密日记所有信息
            API.Diaries.fetchAllInfo();
        }
    }
    API.Diaries.fetchList(0, nextListFunc);
};

/**
 * 获取一篇私密日记的内容
 * 
 * @param {integer} idx 日志列表中的第几篇私密日记
 * @param {function} nextFunc 获取完后执行的函数
 */
API.Diaries.fetchInfo = function (idx, nextFunc) {
    let blogid = QZone.Diaries.Data[idx].blogId;
    let postTime = QZone.Diaries.Data[idx].pubTime;
    let title = QZone.Diaries.Data[idx].title;

    statusIndicator.download("Diaries");
    API.Diaries.getInfo(blogid).then((data) => {
        API.Diaries.contentToFile(data, idx, title, postTime, nextFunc);
    }).catch((e) => {
        console.error("获取私密日志异常，日志标题=" + title);
        nextFunc(idx, "获取私密日志异常，日志标题=" + title);
    })
};

/**
 * 获得所有私密日记的内容
 */
API.Diaries.fetchAllInfo = function () {
    // 获取数据
    var nextFun = function (idx, err) {
        if (QZone.Diaries.Data.length > idx + 1) {
            API.Diaries.fetchInfo(idx + 1, arguments.callee);
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
            filepath: QZone.Diaries.IMAGES_ROOT + "/" + fileName,
            isMimeType: false,
            name: title,
            desc: title,
            source: title,
            className: "私密日志"
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
 * 获取全部说说列表
 */
API.Messages.fetchAllList = async function (page) {
    statusIndicator.start("Messages");
    return new Promise(async function (resolve, reject) {
        // 获取数据
        var nextList = async function (page) {

            let data = await API.Messages.getMessages(page);

            // 去掉函数，保留json
            data = data.replace(/^_preloadCallback\(/, "");
            data = data.replace(/\);$/, "");
            data = JSON.parse(data);

            QZone.Messages.total = data.total;
            // 提示信息
            statusIndicator.total(QZone.Messages.total, 'Messages');

            if (data.msglist == null || data.msglist.length == 0) {
                // 返回的总数包括无权限的说说的条目数，这里返回为空时表示无权限获取其它的数据
                resolve(QZone.Messages.Data);
                return;
            }

            let tasks = [];
            let msgList = data.msglist || [];
            // 构建说说信息和下载信息
            msgList.forEach(function (item) {
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
                            filepath: QZone.Messages.IMAGES_ROOT + "/" + uid,
                            isMimeType: false,
                            name: item.content,
                            desc: item.content,
                            source: item.content,
                            className: "说说"
                        };

                        entry.url = imageInfo.url;
                        entry.uid = imageInfo.uid;
                        entry.filepath = imageInfo.filepath;
                        // 下载图片
                        tasks.push(operator.downloadImage(imageInfo));
                    });
                };
                QZone.Messages.Data.push(info);
            });

            statusIndicator.update("Messages");

            // 先下载完成当前页的所有图片后再获取下一页
            await Promise.all(tasks);

            if (QZone.Messages.Data.length < QZone.Messages.total && page * Qzone_Config.Messages.pageSize < QZone.Messages.total) {
                // 请求一页成功后等待一秒再请求下一页
                await API.Utils.sleep(Qzone_Config.Messages.querySleep * 1000);
                // 总数不相等时继续获取
                await arguments.callee(page + 1);
            } else {
                resolve(QZone.Messages.Data);
            }
        }
        await nextList(page);
    });
};



/**
 * 处理所有说说
 */
API.Messages.hadlerAllList = function () {

    // 重置数据
    QZone.Messages.Data = [];
    QZone.Messages.Images = [];

    API.Messages.fetchAllList(0).then((data) => {
        // 写入说说到文件
        API.Messages.contentToFiles();
    }).catch((msg) => {
        console.error(msg);
        // 下一步，获取QQ好友信息
        operator.next(OperatorType.FRIEND_LIST);
    });
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
        API.Utils.writeFile(content, yearFilePath, (fileEntry) => {
            console.info("已下载：", fileEntry);
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
                filepath: QZone.Messages.IMAGES_ROOT + "/" + commentImgUid,
                isMimeType: false,
                name: comment.content,
                desc: comment.content,
                source: comment.content,
                className: "评论"
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
                    filepath: QZone.Messages.IMAGES_ROOT + "/" + repImgUid,
                    isMimeType: false,
                    name: repItem.content,
                    desc: repItem.content,
                    source: repItem.content,
                    className: "回复"
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

    API.Friends.getFriends().then((data) => {
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
                console.info("创建文件成功", fileEntry);
                // 下一步，等待图片下载完成
                operator.next(OperatorType.BOARD_LIST);
            }, (error) => {
                // 下一步，等待图片下载完成
                operator.next(OperatorType.BOARD_LIST);
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
            API.Friends.getFriendshipTime(friend.uin).then((timeData) => {
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
            }).catch((e) => {
                console.error("获取好友添加时间异常", friend);
            })
        });
    }).catch((e) => {
        // 下一步，等待图片下载完成
        operator.next(OperatorType.BOARD_LIST);
        console.error("获取好友列表异常");
    })
};


/**
 * 获取一页的留言板列表
 *
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Boards.fetchList = function (page, nextFunc) {
    API.Boards.getBoards(page).then((data) => {
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
    }).catch((e) => {
        console.error("获取留言板异常，当前页：" + page);
        nextFunc(page);
    })
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
            API.Boards.fetchList(page + 1, arguments.callee);
        } else {
            // 留言板数据写入到文件
            API.Boards.contentToFile();
        }
    }
    API.Boards.fetchList(0, nextListFunc);
};

/**
 * 将留言写入到文件
 */
API.Boards.contentToFile = function () {
    let newline = '\r\n\r\n';

    let total = QZone.Boards.Data.length;
    const yearMap = API.Utils.groupedByTime(QZone.Boards.Data, "pubtime");
    yearMap.forEach((monthMap, year) => {
        let content = "# " + year + "年" + newline;
        monthMap.forEach((items, month) => {
            content += "## " + month + "月" + newline;

            for (let index = 0; index < items.length; index++) {
                const borad = items[index];

                // 提示信息，下载数+1
                statusIndicator.download("Boards");
                content += "---\r\n";

                content += '#### 第' + (total--) + '楼\r\n';
                content += '> {0} 【{1}】'.format(borad.pubtime, borad.nickname) + newline;
                content += '> 正文：' + newline;
                let htmlContent = borad.htmlContent.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');
                htmlContent = htmlContent.replace(/\n/g, "\r\n");
                let mdContent = turndownService.turndown(htmlContent);
                mdContent = API.Utils.mentionFormat(mdContent, "MD");
                mdContent = API.Utils.emojiFormat(mdContent, "MD");
                let nickname = QZone.Common.loginUin == borad.uin ? "我" : borad.nickname;
                content += '- [{0}](https://user.qzone.qq.com/{1})：{2}'.format(nickname, borad.uin, mdContent) + newline;

                content += '> 回复：' + newline;

                let replyList = borad.replyList || [];
                replyList.forEach(reply => {
                    let replyName = QZone.Common.loginUin == reply.uin ? "我" : reply.nick;
                    let replyContent = API.Utils.formatContent(reply.content, "MD");
                    let replyTime = new Date(reply.time * 1000).format('yyyy-MM-dd hh:mm:ss');
                    let replyMd = '- [{0}](https://user.qzone.qq.com/{1})：{2} 【*{3}*】'.format(replyName, reply.uin, replyContent, replyTime);
                    content += replyMd + newline;
                });
                content += '---' + newline;
                // 提示信息，下载数+1
                statusIndicator.downloadSuccess("Boards");
            };
        });
        const yearFilePath = QZone.Boards.ROOT + "/" + year + "年.md";
        API.Utils.writeFile(content, yearFilePath, (fileEntry) => {
            console.info("已下载：", fileEntry);
        });
    });

    // 下一步，下载相册
    operator.next(OperatorType.PHOTO_LIST);
};

/**
 * 获取相册一页的照片
 *
 * @param {string} uin QQ号
 * @param {integer} page 第几页
 * @param {function} nextFunc
 */
API.Photos.fetchOneList = async function (albumItem, page, nextList) {
    let imgData = await API.Photos.getImages(albumItem.id, page);
    // 去掉函数，保留json
    imgData = imgData.replace(/^shine0_Callback\(/, "");
    imgData = imgData.replace(/\);$/, "");
    imgData = JSON.parse(imgData);
    let photoList = imgData.data.photoList || [];
    QZone.Photos.Data = QZone.Photos.Data.concat(photoList);
    let albumnIdList = QZone.Photos.Images.get(albumItem.id) || [];
    QZone.Photos.Images.set(albumItem.id, albumnIdList.concat(photoList));
    nextList(albumItem, page, nextList);
};


/**
 * 获取单个相册的全部照片
 */
API.Photos.fetchOneAllList = function (albumItem) {
    return new Promise(async function (resolve, reject) {
        // 重置数据
        QZone.Photos.Images.set(albumItem.id, []);

        // 获取数据
        var nextList = async function (albumItem, page) {
            if (QZone.Photos.Images.get(albumItem.id).length < albumItem.total && page * Qzone_Config.Photos.pageSize < albumItem.total) {
                // 请求一页成功后等待一秒再请求下一页
                await API.Utils.sleep(Qzone_Config.Photos.querySleep * 1000);
                // 总数不相等时继续获取
                await API.Photos.fetchOneList(albumItem, page + 1, arguments.callee);
            } else {
                resolve(QZone.Photos.Images.get(albumItem.id));
            }
        }
        // 获取单个相册的第一页相片列表
        await API.Photos.fetchOneList(albumItem, 0, nextList);
    });
};


/**
 * 获取所有的相册
 */
API.Photos.fetchAllAlbums = function () {
    return new Promise(async function (resolve, reject) {
        // 重置数据
        QZone.Photos.Album = [];
        QZone.Photos.Data = [];
        QZone.Photos.ClassMap = new Map();
        QZone.Photos.Images = new Map();

        // 获取数据
        var nextList = async function (page) {

            let albumData = await API.Photos.getPhotos(page);
            // 去掉函数，保留json
            albumData = albumData.replace(/^shine0_Callback\(/, "");
            albumData = albumData.replace(/\);$/, "");
            albumData = JSON.parse(albumData);

            // 相册分类
            let classList = albumData.data.classList || [];
            classList.forEach(classItem => {
                QZone.Photos.ClassMap.set(classItem.id, classItem.name);
            });

            // 相册列表
            let albumList = albumData.data.albumList || [];
            let total = albumData.data.albumsInUser;
            QZone.Photos.Album = QZone.Photos.Album.concat(albumList);

            if (QZone.Photos.Album.length < total && page * Qzone_Config.Photos.pageSize < total) {
                // 请求一页成功后等待一秒再请求下一页
                await API.Utils.sleep(Qzone_Config.Photos.querySleep * 1000);
                // 总数不相等时继续获取
                await arguments.callee(page + 1);
            } else {
                resolve(QZone.Photos.Album);
            }
        }
        // 获取第一页相册列表
        await nextList(0);
    });
};

/**
 * 获取相册列表
 */
API.Photos.fetchAllList = async function () {
    // 重置数据
    QZone.Photos.Album = [];
    QZone.Photos.Data = [];
    QZone.Photos.ClassMap = new Map();
    QZone.Photos.Images = new Map();

    statusIndicator.start("Photos");

    // 获取所有相册
    let albumList = await API.Photos.fetchAllAlbums();

    // 下载相片
    for (let i = 0; i < albumList.length; i++) {
        const album = albumList[i];
        // 获取每个相册的相片列表
        const photoList = await API.Photos.fetchOneAllList(album);
        // 分类名称
        let className = QZone.Photos.ClassMap.get(album.classid) || "其它";

        const _photoList = _.chunk(photoList, Qzone_Config.Photos.downCount);

        for (let j = 0; j < _photoList.length; j++) {

            const list = _photoList[j];
            let tasks = [];
            for (let k = 0; k < list.length; k++) {

                const photo = list[k];

                // 创建文件夹
                let folderName = QZone.Photos.ROOT + "/" + className + "/" + album.name;
                await API.Utils.createFolder(folderName);

                // 下载相片
                // 自动识别，默认原图优先
                let url = photo.url;
                if (Qzone_Config.Photos.isDownloadOriginal) {
                    url = API.Photos.getDownloadUrl(photo);
                }
                url = url.replace(/http:\//, "https:/");
                let uid = API.Utils.guid();
                let photoName = photo.name + "_" + uid;
                photoName = API.Utils.filenameValidate(photoName);
                let filepath = QZone.Photos.ROOT + "/" + className + "/" + album.name + "/" + photoName;

                let imageInfo = {
                    uid: photoName,
                    filename: photoName,
                    filepath: filepath,
                    isMimeType: true,
                    name: photo.name,
                    desc: photo.desc,
                    url: url,
                    source: album.name,
                    className: className
                };
                tasks.push(operator.downloadImage(imageInfo));
            }

            await Promise.all(tasks);
        }

        // 请求完一个相册后，等待1秒再请求下一个相册
        await API.Utils.sleep(Qzone_Config.Photos.querySleep * 1000);
    }

    //下一步，等待图片下载完成
    operator.next(OperatorType.VIDEO_LIST);
}

/**
 * 获取所有视频列表
 */
API.Videos.fetchAllList = function (page) {
    statusIndicator.start("Videos");
    return new Promise(async function (resolve, reject) {
        // 获取数据
        var nextList = async function (page) {

            statusIndicator['Videos'].downloading += 20;
            statusIndicator.update('Videos');
            let videoPageData = await API.Videos.getVideos(page);

            // 去掉函数，保留json
            videoPageData = videoPageData.replace(/^shine0_Callback\(/, "");
            videoPageData = videoPageData.replace(/\);$/, "");
            videoPageData = JSON.parse(videoPageData);

            statusIndicator['Videos'].downloading -= videoPageData.data.Videos.length;
            statusIndicator['Videos'].downloaded += videoPageData.data.Videos.length;
            statusIndicator.update('Videos');

            QZone.Videos.total = videoPageData.data.total;
            QZone.Videos.Data = QZone.Videos.Data.concat(videoPageData.data.Videos);

            // 提示信息
            statusIndicator.total(QZone.Videos.total, 'Videos');
            statusIndicator.update('Videos');

            if (QZone.Videos.Data.length < QZone.Videos.total && page * Qzone_Config.Videos.pageSize < QZone.Videos.total) {
                // 请求一页成功后等待一秒再请求下一页
                await API.Utils.sleep(Qzone_Config.Videos.querySleep * 1000);
                // 总数不相等时继续获取
                await arguments.callee(page + 1);
            } else {
                resolve(QZone.Videos.Data);
            }
        }
        await nextList(page);
    });
};

/**
 * 处理所有视频
 */
API.Videos.hadlerAllList = function () {
    // 重置数据
    QZone.Videos.Data = [];

    API.Videos.fetchAllList(0).then((data) => {
        let videoUrls = [];
        for (let index = 0; index < data.length; index++) {
            const videoInfo = data[index];
            videoUrls.push(videoInfo.url);
        }
        let filepath = QZone.Videos.ROOT + '/视频链接.downlist';
        API.Utils.writeFile(videoUrls.join("\r\n"), filepath, (fileEntry) => {
            //下一步，等待图片下载完成
            operator.next(OperatorType.AWAIT_IMAGES);
        }, (error) => {
            //下一步，等待图片下载完成
            operator.next(OperatorType.AWAIT_IMAGES);
        });
    }).catch((msg) => {
        console.error(msg);
        //下一步，等待图片下载完成
        operator.next(OperatorType.AWAIT_IMAGES);
    });
}