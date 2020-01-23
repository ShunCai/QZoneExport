streamSaver.mitm = 'https://github.lvshuncai.com/StreamSaver.js/mitm.html'

/**
 * 迅雷任务
 */
class ThunderTask {

    /**
     * 
     * @param {string} uid 唯一标识
     * @param {string} dir 下载目录
     * @param {string} name 文件名，包含后缀
     * @param {string} url 文件地址
     */
    constructor(dir, name, url) {
        this.dir = dir
        this.name = name
        this.url = url.replace(/http:\//, "https:/");
    }
}

/**
 * 迅雷任务信息
 */
class ThunderInfo {

    /**
     * 
     * @param {string} dir 下载目录
     * @param {integer} threadCount 下载
     * @param {ThunderTask} tasks 任务
     */
    constructor(taskGroupName, threadCount, tasks) {
        this.taskGroupName = taskGroupName
        this.tasks = tasks || []
        this.threadCount = threadCount
    }

    /**
    * 添加下载任务
    * @param {ThunderTask} task 任务
    */
    addTask(task) {
        this.tasks.push(task);
    }

    /**
     * 删除指定索引任务
     * @param {integer} index 数组索引
     */
    delTask(index) {
        this.tasks.splice(index, 1);
    }

    /**
     * 根据下载链接删除任务
     * @param {string} url 下载链接
     */
    removeTask(url) {
        this.tasks.remove(url, 'url')
    }
}

/**
 * 浏览器下载任务
 */
class BrowserTask {

    /**
     * 
     * @param {string} url 下载地址
     * @param {filename} filename 文件名称
     */
    constructor(url, filename) {
        this.url = url.replace(/http:\//, "https:/");
        this.filename = filename;
    }
}

/**
 * 备份进度
 */
class StatusIndicator {

    /**
     * 提示信息
     */
    static MAX_MSG = {
        Messages: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的说说列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Messages_Full_Content: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的全文',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Messages_Comments: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的评论列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Messages_Export: [
            '正在导出说说',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Blogs: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的日志列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
            '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
            '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
            '请稍后...'
        ],
        Blogs_Content: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇的日志内容',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
            '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
            '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
            '请稍后...'
        ],
        Blogs_Comments: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的评论列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Blogs_Export: [
            '正在导出日志',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Diaries: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的私密日记列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
            '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
            '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
            '请稍后...'
        ],
        Diaries_Content: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇的私密日记内容',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
            '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
            '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
            '请稍后...'
        ],
        Diaries_Export: [
            '正在导出私密日记',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Photos: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的相册列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Photos_Images: [
            '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Photos_Images_Comments: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 张相片的评论列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Photos_Images_Mime: [
            '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片类型',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Photos_Export: [
            '正在导出相册',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Photos_Images_Export: [
            '正在导出 <span style="color: #1ca5fc;">{index}</span> 的相片',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Videos: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的视频列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Videos_Export: [
            '正在导出视频',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Boards: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的留言板列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Boards_Export: [
            '正在导出 <span style="color: #1ca5fc;">{index}</span> 年的留言',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Friends: [
            '正在获取QQ好友列表',
            '已获取好友 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Friends_Export: [
            '正在导出QQ好友列表',
            '已获取好友 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Favorites: [
            '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的收藏列表',
            '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
            '已失败 <span style="color: red;">{downloadFailed}</span> 个',
            '总共 <span style="color: #1ca5fc;">{total}</span> 个',
            '请稍后...'
        ],
        Favorites_Export: [
            '正在导出视频',
            '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '已失败 <span style="color: red;">{downloadFailed}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Common_File: [
            '正在下载文件',
            '已下载 <span style="color: #1ca5fc;">{downloaded}</span> ',
            '已失败 <span style="color: red;">{downloadFailed}</span> ',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ],
        Common_Thunder: [
            '正在唤起迅雷X下载文件',
            '请稍后...'
        ],
        Common_Browser: [
            '正在添加下载任务到浏览器',
            '已添加 <span style="color: #1ca5fc;">{downloaded}</span> 条',
            '总共 <span style="color: #1ca5fc;">{total}</span> 条',
            '请稍后...'
        ]
    }

    /**
     * 
     * @param {string} type 导出类型
     */
    constructor(type) {
        this.id = type + '_Tips'
        this.type = type
        this.tip = StatusIndicator.MAX_MSG[type] || ''
        this.total = 0
        this.index = 0
        this.pageSize = 0
        this.exported = 0
        this.downloaded = 0
        this.downloading = 0
        this.downloadFailed = 0
    }

    /**
     * 获取数据
     */
    getData(dataType) {
        return this.data[dataType] || []
    }


    /**
     * 输出提示信息
     */
    print() {
        let $tip_dom = $("#" + this.id);
        $tip_dom.show();
        $tip_dom.html(this.tip.join('，').format(this));
    }

    /**
     * 完成
     * @param {object} params 格式化参数
     */
    complete() {
        let $tip_dom = $("#" + this.id)
        $tip_dom.show()
        $tip_dom.html(this.tip.join('，').format(this).replace('正在', '已').replace('请稍后', '已完成'))
    }

    /**
     * 下载
     */
    addDownload(pageSize) {
        this.downloading = this.downloaded + pageSize
        this.print()
    }

    /**
     * 下载失败
     */
    addFailed(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        }
        if (item['isPage']) {
            count = item['pageSize']
        }
        this.downloadFailed = this.downloadFailed + (count * 1)
        this.downloading = this.downloading - (count * 1)
        this.print()
    }

    /**
     * 下载失败
     */
    setFailed(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        }
        if (item['isPage']) {
            count = item['pageSize']
        }
        this.downloadFailed = count;
        this.downloading = 0
        this.print()
    }

    /**
     * 下载成功
     */
    addSuccess(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length;
        }
        if (typeof item === 'number') {
            count = item;
        }
        this.downloaded = this.downloaded + (count * 1)
        this.downloading = this.downloading - (count * 1)
        this.print()
    }


    /**
     * 下载成功
     */
    setSuccess(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length;
        }
        if (typeof item === 'number') {
            count = item;
        }
        this.downloaded = count
        this.downloading = 0
        this.print()
    }

    /**
     * 设置当前位置
     * @param {object} index 当前位置
     */
    setIndex(index) {
        this.index = index
        this.print()
    }

    /**
     * 设置总数
     * @param {integer} total
     */
    setTotal(total) {
        this.total = total
        this.print()
    }
}

/**
 * 导出操作
 */
class QZoneOperator {

    /**
     * 操作类型
     */
    static OperatorType = {

        /**
         * 初始化
         */
        INIT: 'INIT',
        /**
         * 显示弹窗
         */
        SHOW: 'SHOW',

        /**
         * 获取所有说说列表
         */
        MESSAGES_LIST: 'MESSAGES_LIST',

        /**
         * 获取日志所有列表
         */
        BLOG_LIST: 'BLOG_LIST',

        /**
         * 获取私密日记所有列表
         */
        DIARY_LIST: 'DIARY_LIST',

        /**
        * 获取相册照片
        */
        PHOTO_LIST: 'PHOTO_LIST',

        /**
        * 获取视频列表
        */
        VIDEO_LIST: 'VIDEO_LIST',

        /**
        * 获取留言板列表
        */
        BOARD_LIST: 'BOARD_LIST',

        /**
        * 获取QQ好友列表
        */
        FRIEND_LIST: 'FRIEND_LIST',

        /**
        * 获取收藏列表
        */
        FAVORITE_LIST: 'FAVORITE_LIST',

        /**
         * 下载文件
         */
        FILE_LIST: 'FILE_LIST',

        /**
         * 压缩
         */
        ZIP: 'ZIP',

        /**
         * 压缩
         */
        COMPLETE: 'COMPLETE'
    }

    /**
     * 下一步操作
     */
    async next(moduleType) {
        let OperatorType = QZoneOperator.OperatorType
        switch (moduleType) {
            case OperatorType.INIT:
                this.init();
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                this.showProcess();
                await this.initModelFolder();
                this.next(OperatorType.MESSAGES_LIST);
                break;
            case OperatorType.MESSAGES_LIST:
                // 获取说说列表
                if (this.isExport(moduleType)) {
                    await API.Messages.export();
                }
                this.next(OperatorType.BLOG_LIST);
                break;
            case OperatorType.BLOG_LIST:
                // 获取日志列表
                if (this.isExport(moduleType)) {
                    await API.Blogs.export();
                }
                this.next(OperatorType.DIARY_LIST);
                break;
            case OperatorType.DIARY_LIST:
                // 获取私密日记列表
                if (this.isExport(moduleType)) {
                    await API.Diaries.export();
                }
                this.next(OperatorType.PHOTO_LIST);
                break;
            case OperatorType.PHOTO_LIST:
                // 获取相册列表
                if (this.isExport(moduleType)) {
                    await API.Photos.export();
                }
                this.next(OperatorType.VIDEO_LIST);
                break;
            case OperatorType.VIDEO_LIST:
                // 获取视频列表
                if (this.isExport(moduleType)) {
                    await API.Videos.export();
                }
                this.next(OperatorType.BOARD_LIST);
                break;
            case OperatorType.BOARD_LIST:
                // 获取留言列表
                if (this.isExport(moduleType)) {
                    await API.Boards.export();
                }
                this.next(OperatorType.FRIEND_LIST);
                break;
            case OperatorType.FRIEND_LIST:
                // 获取QQ好友列表
                if (this.isExport(moduleType)) {
                    await API.Friends.export();
                }
                this.next(OperatorType.FAVORITE_LIST);
                break;
            case OperatorType.FAVORITE_LIST:
                // 获取收藏列表
                if (this.isExport(moduleType)) {
                    await API.Favorites.export();
                }
                this.next(OperatorType.FILE_LIST);
                break;
            case OperatorType.FILE_LIST:
                // 下载文件
                await API.Utils.downloadAllFiles();
                this.next(OperatorType.ZIP);
                break;
            case OperatorType.ZIP:
                await API.Utils.sleep(1000);
                // 压缩
                await API.Utils.Zip(FOLDER_ROOT);
                operator.next(OperatorType.COMPLETE);
                break;
            case OperatorType.COMPLETE:
                // 延迟3秒，确保压缩完
                await API.Utils.sleep(1000);
                $("#downloadBtn").show();
                $("#backupStatus").html("备份完成，请下载。");
                API.Utils.notification("QQ空间导出助手通知", "空间数据已获取完成，请点击下载！");
                break;
            default:
                break;
        }
    }

    /**
     * 当前模块是否需要导出
     * @param {string} moduleType 当前模块
     */
    isExport(moduleType) {
        return QZone.Common.ExportType[moduleType];
    }


    /**
     * 初始化
     */
    init() {
        if (location.href.indexOf("qzone.qq.com") == -1 || location.protocol == 'filesystem:') {
            return;
        }

        // 读取配置项
        chrome.storage.sync.get(Default_Config, function (item) {

            Qzone_Config = item;

            // 获取gtk
            API.Utils.initGtk();
            // 获取Token
            API.Utils.getQzoneToken();
            // 获取QQ号
            API.Utils.initUin();
            // 获取用户信息
            API.Utils.getOwnerProfile();

            // 初始化文件夹
            QZone.Common.Filer.init({ persistent: false, size: 10 * 1024 * 1024 * 1024 }, function (fs) {
                QZone.Common.Filer.ls(FOLDER_ROOT, function (entries) {
                    console.debug('当前子目录：', entries);
                    QZone.Common.Filer.rm(FOLDER_ROOT, function () {
                        console.debug('清除历史数据成功！');
                    });
                });
            })
        })

    }

    /**
     * 初始化各个备份模块的文件夹
     */
    async initModelFolder() {
        console.debug('初始化模块文件夹开始', QZone);

        // 切换到根目录
        let root = await API.Utils.siwtchToRoot();
        console.debug("切换到根目录", root);
        // 创建模块文件夹
        let createModuleFolder = async function () {
            // 创建所有模块的目录
            for (let x in QZone) {
                let obj = QZone[x];
                if (typeof (obj) !== "object") {
                    continue;
                }
                let rootPath = obj['IMAGES_ROOT'] || obj['ROOT'];
                if (!rootPath) {
                    continue;
                }
                let entry = await API.Utils.createFolder(rootPath);
                console.debug('创建目录成功', entry);
            }
        }

        // 创建模块文件夹
        await createModuleFolder();

        // 创建说明文件
        let readmeUrl = chrome.runtime.getURL('others/README.md');
        let res = await API.Utils.get(readmeUrl);
        QZone.Common.Filer.write(FOLDER_ROOT + "说明.md", {
            data: res,
            type: "text/plain"
        }, (entry) => {
            console.debug('创建文件成功', entry);
        });
        console.debug('初始化模块文件夹结束', QZone);
    }

    /**
     * 显示备份进度窗口
     */
    showProcess() {
        $('body').append(MODAL_HTML);

        $('#exampleModalCenter').modal({})

        let $progressbar = $("#progressbar");
        let $downloadBtn = $('#downloadBtn');

        $downloadBtn.click(() => {

            $('#progress').show();
            $progressbar.css("width", "0%");
            $progressbar.attr("aria-valuenow", "0");
            $progressbar.text('已下载0%');

            $('#showFailedImages').attr('disabled', true);
            $downloadBtn.attr('disabled', true);
            $downloadBtn.text('正在下载');

            let zipName = QZone.Common.Config.ZIP_NAME + "_" + QZone.Common.Target.uin + ".zip";
            // QZone.Common.Filer.df(function (used, free, cap) {
            //     let usedSize = API.Utils.bytesToSize(used);
            //     console.debug("已使用：", API.Utils.bytesToSize(used));
            //     console.debug("剩余：", API.Utils.bytesToSize(free));
            //     console.debug("总容量：", API.Utils.bytesToSize(cap));

            //     // 1G
            //     let usedMax = 1024 * 1024 * 1024;
            //     if (usedMax > used) {
            //         QZone.Common.Zip.generateAsync({ type: "blob" }, (metadata) => {
            //             $progressbar.css("width", metadata.percent.toFixed(2) + "%");
            //             $progressbar.attr("aria-valuenow", metadata.percent.toFixed(2));
            //             $progressbar.text('已下载' + metadata.percent.toFixed(2) + '%');
            //         }).then(function (content) {
            //             saveAs(content, zipName);
            //             $progressbar.css("width", "100%");
            //             $progressbar.attr("aria-valuenow", 100);
            //             $progressbar.text('已下载' + '100%');
            //             $downloadBtn.text('已下载');
            //             $downloadBtn.attr('disabled', false);
            //             $("#showFolder").show();
            //             API.Utils.notification("QQ空间导出助手通知", "你的QQ空间数据下载完成！");
            //         });
            //     } else {
            //         let writeStream = streamSaver.createWriteStream(zipName).getWriter()
            //         QZone.Common.Zip.generateInternalStream({
            //             type: "blob",
            //             streamFiles: usedSize.endsWith('MB')
            //         }).on('data', (data, metadata) => {
            //             $progressbar.css("width", metadata.percent.toFixed(2) + "%");
            //             $progressbar.attr("aria-valuenow", metadata.percent.toFixed(2));
            //             $progressbar.text('已下载' + metadata.percent.toFixed(2) + '%');
            //             writeStream.write(data)
            //         }).on('error', (e) => {
            //             console.error(e);
            //             writeStream.abort(e);
            //             $downloadBtn.text('下载失败，请重试。');
            //             $downloadBtn.attr('disabled', false);
            //         }).on('end', () => {
            //             writeStream.close();
            //             $progressbar.css("width", "100%");
            //             $progressbar.attr("aria-valuenow", 100);
            //             $progressbar.text('已下载' + '100%');
            //             $downloadBtn.text('已下载');
            //             $downloadBtn.attr('disabled', false);
            //             $("#showFolder").show();
            //             API.Utils.notification("QQ空间导出助手通知", "你的QQ空间数据下载完成！");
            //         }).resume();
            //     }
            // });

            QZone.Common.Zip.generateAsync({ type: "blob" }, (metadata) => {
                $progressbar.css("width", metadata.percent.toFixed(2) + "%");
                $progressbar.attr("aria-valuenow", metadata.percent.toFixed(2));
                $progressbar.text('已下载' + metadata.percent.toFixed(2) + '%');
            }).then(function (content) {
                saveAs(content, zipName);
                $progressbar.css("width", "100%");
                $progressbar.attr("aria-valuenow", 100);
                $progressbar.text('已下载' + '100%');
                $downloadBtn.text('已下载');
                $downloadBtn.attr('disabled', false);
                $("#showFolder").show();
                API.Utils.notification("QQ空间导出助手通知", "你的QQ空间数据下载完成！");
            });

        });

        let $showFolder = $('#showFolder');
        $showFolder.click(() => {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'show_export_zip'
            });
        })

        //进度模式窗口隐藏后
        $('#exampleModalCenter').on('hidden.bs.modal', function () {
            $("#exampleModalCenter").remove();
            $("#modalTable").remove();
        })
    }
}

const MODAL_HTML = `
    <div class="modal fade" id="exampleModalCenter" data-backdrop="static" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title h5" id="exampleModalLongTitle">QQ空间备份</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <h6 class="h6" id="backupStatus">正在导出备份，请不要关闭或刷新当前页面和打开新的QQ空间页面。</h6>
                    <hr/>
                    <div class="container">  
                        <p id="Messages_Tips" style="font-size: medium;" ></p>
                        <p id="Messages_Full_Content_Tips" style="font-size: medium;" ></p>            
                        <p id="Messages_Comments_Tips" style="font-size: medium;" ></p>            
                        <p id="Messages_Export_Tips" style="font-size: medium;" ></p>        
                        <p id="Blogs_Tips" style="font-size: medium;" ></p>
                        <p id="Blogs_Content_Tips" style="font-size: medium;" ></p>
                        <p id="Blogs_Comments_Tips" style="font-size: medium;" ></p>
                        <p id="Blogs_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Diaries_Tips" style="font-size: medium;" ></p>
                        <p id="Diaries_Content_Tips" style="font-size: medium;" ></p>
                        <p id="Diaries_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Images_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Images_Mime_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Images_Comments_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Photos_Images_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Videos_Tips" style="font-size: medium;" ></p>     
                        <p id="Videos_Export_Tips" style="font-size: medium;" ></p>  
                        <p id="Boards_Tips" style="font-size: medium;" ></p>
                        <p id="Boards_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Friends_Tips" style="font-size: medium;" ></p>
                        <p id="Friends_Export_Tips" style="font-size: medium;" ></p>
                        <p id="Favorites_Tips" style="font-size: medium;" ></p>     
                        <p id="Favorites_Export_Tips" style="font-size: medium;" ></p>          
                        <p id="Common_File_Tips" style="font-size: medium;" ></p>           
                        <p id="Common_Thunder_Tips" style="font-size: medium;" ></p>        
                        <p id="Common_Browser_Tips" style="font-size: medium;" ></p>   
                    </div>
                    <br/>
                    <div id="progress" class="progress" style="display: none;">
                        <div id="progressbar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">已下载 0%</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="showFolder" type="button" class="btn btn-success" style="display: none;" >查看备份</button>
                    <button id="downloadBtn" type="button" class="btn btn-primary" style="display: none;" >下载</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
                </div>
            </div>
        </div>
    </div>
`

// 操作器
const operator = new QZoneOperator();
// 迅雷下载信息
const thunderInfo = new ThunderInfo(QZone.Common.Config.ZIP_NAME);
// 浏览器下载信息
const browserTasks = new Array();

/**
 * 初始化监听
 */
(function () {

    // 消息监听
    chrome.runtime.onConnect.addListener(function (port) {
        console.debug("消息发送者：", port);
        switch (port.name) {
            case 'popup':
                port.onMessage.addListener(function (request) {
                    switch (request.subject) {
                        case 'startBackup':
                            QZone.Common.ExportType = request.exportType;
                            operator.next(QZoneOperator.OperatorType.SHOW);
                            port.postMessage(QZone.Common.ExportType);
                            break;
                        case 'initUin':
                            // 获取QQ号
                            let res = API.Utils.initUin();
                            port.postMessage(res);
                            break;
                        case 'initDiaries':
                            // 获取私密日志
                            API.Diaries.getDiaries(0).then((data) => {
                                port.postMessage(API.Utils.toJson(data, /^_Callback\(/));
                            });
                            break;
                        case 'initModules':
                            // 获取上次勾选的模块
                            port.postMessage(QZone.Common.ExportType);
                            break;
                        default:
                            break;
                    }
                });
                break;
            default:
                break;
        }
    });
    operator.next(QZoneOperator.OperatorType.INIT);
})()


/**
 * 添加图片下载任务
 * @param {string} image 图片对象
 * @param {string} url URL
 * @param {string} download_dir 下载目录
 * @param {string} moudel_dir 模块下载目录
 * @param {string} FILE_URLS 文件下载链接
 */
API.Utils.addDownloadTasks = async (image, url, download_dir, moudel_dir, FILE_URLS) => {
    let downloadType = Qzone_Config.Common.downloadType;
    let isQzoneUrl = downloadType === 'QZone';
    if (isQzoneUrl) {
        return;
    }
    url = API.Utils.replaceUrl(url);
    let filename = FILE_URLS.get(url);
    if (!filename) {
        filename = API.Utils.newSimpleUid(16, 16);
    }
    image.custom_url = url;

    let suffix = await API.Utils.autoFileSuffix(url);
    filename = filename + suffix;
    image.custom_uid = filename;
    image.custom_mimeType = suffix;
    image.custom_dir = '图片';
    image.custom_filename = filename;
    image.custom_filepath = '图片/' + filename;
    // 添加下载任务
    API.Utils.newDownloadTask(url, download_dir, moudel_dir, filename);
    FILE_URLS.set(url, filename);
}

/**
 * 添加下载任务
 * @param {url} url 下载地址
 * @param {dir} dir 下载目录
 * @param {folder} folder 下载相对目录
 * @param {name} name 文件名称
 */
API.Utils.newDownloadTask = (url, dir, folder, name) => {
    url = API.Utils.makeDownloadUrl(url, true)
    // 添加浏览器下载任务
    browserTasks.push(new BrowserTask(url, dir + folder + '/' + name));
    // 添加迅雷下载任务
    thunderInfo.addTask(new ThunderTask(folder, name, url));
}

/**
 * 通过Ajax请求下载文件
 * @param {ThunderTask} tasks
 */
API.Utils.downloadsByAjax = async (tasks) => {

    // 任务分组
    const _tasks = _.chunk(tasks, Qzone_Config.Common.downloadThread);

    let indicator = new StatusIndicator('Common_File');
    indicator.setTotal(tasks.length);
    let folderMapping = new Map();

    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        let down_tasks = [];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];


            // 切换到根目录
            await API.Utils.siwtchToRoot();

            // 创建文件夹
            let folderName = QZone.Common.Config.ZIP_NAME + '/' + task.dir;
            if (!folderMapping.has(folderName)) {
                let folderEntry = await API.Utils.createFolder(folderName);
                folderMapping.set(folderName, folderEntry);
            }

            let filepath = folderName + '/' + task.name;

            down_tasks.push(API.Utils.writeFile(task.url, filepath).then(() => {
                indicator.addSuccess(task);
            }).catch((error) => {
                indicator.addFailed(task);
                console.error('下载文件异常', task, error);
            }));
        }
        await Promise.all(down_tasks);
    }
    indicator.complete();
    return true;
}

/**
 * 通过浏览器下载文件
 * @param {BrowserTask} tasks 浏览器下载任务
 */
API.Utils.downloadsByBrowser = async (tasks) => {
    let indicator = new StatusIndicator('Common_Browser');
    indicator.setTotal(tasks.length);
    // 开始下载
    const _tasks = _.chunk(tasks, Qzone_Config.Common.downloadThread);
    for (let i = 0; i < _tasks.length; i++) {
        const list = _tasks[i];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];
            API.Utils.downloadByBrowser(task);
        }
        // 等待1秒再继续添加
        await API.Utils.sleep(1000);
        indicator.addSuccess(list);
    }
    indicator.complete();
    return true;
}

/**
 * 通过迅雷下载
 */
API.Utils.invokeThunder = () => {
    let indicator = new StatusIndicator('Common_Thunder');
    indicator.setTotal(thunderInfo.tasks.length);
    // 下载线程数
    thunderInfo.threadCount = Qzone_Config.Common.downloadThread;
    API.Utils.downloadByThunder(thunderInfo);
    indicator.addSuccess(thunderInfo.tasks);
    indicator.complete();
}

/**
 * 下载文件
 */
API.Utils.downloadAllFiles = async () => {
    let downloadType = Qzone_Config.Common.downloadType;
    if (downloadType === 'QZone') {
        // 使用QQ空间外链时，不需要下载文件
        return;
    }
    if (thunderInfo.tasks.length === 0 || browserTasks.length === 0) {
        // 没有下载任务的时候，不调用下载逻辑
        return;
    }
    switch (downloadType) {
        case 'File':
            await API.Utils.downloadsByAjax(thunderInfo.tasks);
            break;
        case 'Thunder':
            API.Utils.invokeThunder();
            break;
        case 'Browser':
            await API.Utils.downloadsByBrowser(browserTasks);
            break;
        default:
            console.warn('未识别类型', downloadType);
            break;
    }
}