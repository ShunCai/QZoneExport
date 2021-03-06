// PDF组件兼容大小写
//window.jsPDF = window.jspdf.jsPDF;

/**
 * Ajax下载任务
 */
class DownloadTask {

    /**
     * @param {string} dir 下载目录
     * @param {string} name 文件名，包含后缀
     * @param {string} url 文件地址
     * @param {object} source 文件来源
     */
    constructor(dir, name, url, source) {
        this.dir = dir
        this.name = name
        this.url = url
        this.downloadState = 'in_progress'
        this.source = source
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
    }
}

/**
 * 迅雷任务
 */
class ThunderTask {

    /**
     * 
     * @param {string} dir 下载目录
     * @param {string} name 文件名，包含后缀
     * @param {string} url 文件地址
     * @param {object} source 文件来源
     */
    constructor(dir, name, url, source) {
        this.dir = dir
        this.name = name
        this.url = url
        this.downloadState = 'in_progress'
        this.source = source
        this.referer = 'https://user.qzone.qq.com/'
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
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
     * @param {string} root 下载根目录名称
     * @param {string} folder 根目录相对名称
     * @param {string} name 文件名称
     * @param {object} source 文件来源
     */
    constructor(url, root, folder, name, source) {
        this.id = 0;
        this.url = url;
        this.dir = folder;
        this.name = name;
        this.filename = root + '/' + folder + '/' + name;
        this.downloadState = 'in_progress'
        this.source = source
    }

    /**
     * 设置下载管理器ID
     * @param {integer} id 下载管理器ID
     */
    setId(id) {
        this.id = id
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
    }
}



/**
 * 分页信息
 */
class PageInfo {

    /**
     * 
     * @param {integer} index 页索引
     * @param {integer} size 页条目大小
     */
    constructor(index, size) {
        this.index = 0;
        this.size = 0;
    }
}

/**
 * 提示信息
 */
const MAX_MSG = {
    Messages: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的说说列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Filter: [
        '正在根据屏蔽词过滤说说列表',
        '已屏蔽 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Full_Content: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的全文',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_More_Images: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的更多图片',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Voices: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的语音信息',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Images_Mime: [
        '正在识别说说的图片类型',
        '已识别 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '请稍后...'
    ],
    Messages_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Messages_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
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
    Messages_Export_Other: [
        '正在导出说说到 <span style="color: #1ca5fc;">{index}</span> 文件',
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
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍后...'
    ],
    Blogs_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍后...'
    ],
    Blogs_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍后...'
    ],
    Blogs_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍后...'
    ],
    Blogs_Export: [
        '正在导出日志',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Blogs_Export_Other: [
        '正在导出日志到 <span style="color: #1ca5fc;">{index}</span> 文件',
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
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
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
    Diaries_Export_Other: [
        '正在导出私密日记到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Boards: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的留言板列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Boards_Images_Mime: [
        '正在识别留言的图片类型',
        '已识别 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已失败 <span style="color: red;">{downloadFailed}</span> 张',
        '请稍后...'
    ],
    Boards_Export: [
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 年的留言',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Boards_Export_Other: [
        '正在导出留言到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Friends: [
        '正在获取QQ好友列表',
        '已获取好友 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Friends_Time: [
        '正在获取好友详细信息',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Friends_Export: [
        '正在导出QQ好友到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Photos: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的相册列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Photos_Albums_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Photos_Albums_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Photos_Albums_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Photos_Images: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已失败 <span style="color: red;">{downloadFailed}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍后...'
    ],
    Photos_Images_Info: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片详情',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍后...'
    ],
    Photos_Images_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 张相片的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍后...'
    ],
    Photos_Images_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 张相片的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍后...'
    ],
    Photos_Images_Mime: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片类型',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍后...'
    ],
    Photos_Export: [
        '正在导出相册到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Photos_Images_Export: [
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 的相片',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Photos_Images_Export_Other: [
        '正在导出相片到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Videos: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的视频列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Videos_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个视频的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Videos_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个视频的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍后...'
    ],
    Videos_Export: [
        '正在导出视频到 <span style="color: #1ca5fc;">{index}</span> 文件',
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
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 年的收藏',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Favorites_Export_Other: [
        '正在导出收藏到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Shares: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的分享列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Shares_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Shares_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Shares_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Shares_Export: [
        '正在导出分享',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Shares_Export_Other: [
        '正在导出分享到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍后...'
    ],
    Visitors: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的访客列表',
        '总共 <span style="color: #1ca5fc;">{totalPage}</span> 页',
        '<span style="color: #1ca5fc;">{total}</span> 访问量',
        '请稍后...'
    ],
    Visitors_Export: [
        '正在导出访客',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Visitors_Export_Other: [
        '正在导出访客到 <span style="color: #1ca5fc;">{index}</span> 文件',
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
        '正在第 <span style="color: #1ca5fc;">{index}</span> 次唤起迅雷下载文件',
        '将在 <span style="color: #1ca5fc;">{nextTip}</span> 秒后再次唤起迅雷',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Common_Thunder_Link: [
        '正在生成迅雷下载链接',
        '打包下载后，打开迅雷复制根目录下的【迅雷下载链接.txt】',
        '请稍后...'
    ],
    Common_Browser: [
        '正在添加下载任务到浏览器',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '添加超时或失败 <span style="color: red;">{downloadFailed}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ],
    Common_Aria2: [
        '正在添加下载任务到Aria2',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '添加超时或失败 <span style="color: red;">{downloadFailed}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍后...'
    ]
}

/**
 * 备份进度
 */
class StatusIndicator {

    /**
     * 
     * @param {string} type 导出类型
     */
    constructor(type) {
        this.id = type + '_Tips'
        this.type = type
        this.tip = MAX_MSG[type] || ''
        this.total = 0
        this.index = 0
        this.pageSize = 0
        this.totalPage = 0
        this.nextTip = 0
        this.downloaded = 0
        this.downloading = 0
        this.downloadFailed = 0
        this.skip = 0;
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
        $tip_dom.html(this.tip.join('，').format(this).replace('正在', '已').replace('请稍后', '已完成').replace('...', ''))
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
     * @param {Object} item 
     */
    addFailed(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        } else if (item instanceof PageInfo) {
            count = item['size']
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
        } else if (item instanceof PageInfo) {
            count = item['size']
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

    /**
     * 设置下一步提示
     * @param {string} tip
     */
    setNextTip(tip) {
        this.nextTip = tip
        this.print()
    }

    /**
     * 添加跳过条目数
     * @param {Object} item 
     */
    addSkip(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        }
        this.skip = this.skip + count
        this.print()
    }

    /**
     * 设置跳过条目数
     */
    setSkip(count) {
        if (Array.isArray(count)) {
            count = item.length
        }
        this.skip = count
        this.print()
    }

    /**
     * 设置总数
     * @param {integer} totalPage
     */
    setTotalPage(totalPage) {
        this.totalPage = totalPage
        this.print()
    }
}


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
     * 初始化用户信息
     */
    INIT_USER_INFO: 'INIT_USER_INFO',

    /**
     * 导出用户信息
     */
    USER_INFO: 'USER_INFO',

    /**
     * 获取所有说说列表
     */
    Messages: 'Messages',

    /**
     * 获取日志所有列表
     */
    Blogs: 'Blogs',

    /**
     * 获取私密日记所有列表
     */
    Diaries: 'Diaries',

    /**
    * 获取相册照片
    */
    Photos: 'Photos',

    /**
    * 获取视频列表
    */
    Videos: 'Videos',

    /**
    * 获取留言板列表
    */
    Boards: 'Boards',

    /**
    * 获取QQ好友列表
    */
    Friends: 'Friends',

    /**
    * 获取收藏列表
    */
    Favorites: 'Favorites',

    /**
    * 获取分享列表
    */
    Shares: 'Shares',

    /**
    * 获取访客列表
    */
    Visitors: 'Visitors',

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
 * 导出操作
 */
class QZoneOperator {

    /**
     * 下一步操作
     */
    async next(moduleType) {
        switch (moduleType) {
            case OperatorType.INIT:
                this.init();
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                await this.showProcess();
                // 初始化FS文件夹
                await this.initModelFolder();
                this.next(OperatorType.INIT_USER_INFO);
                break;
            case OperatorType.INIT_USER_INFO:
                // 重置QQ空间备份数据
                API.Common.resetQzoneItems();
                // 初始化用户信息
                await API.Common.initUserInfo();
                // 初始化上次备份信息
                await API.Common.initBackedUpItems();
                this.next(OperatorType.Messages);
                break;
            case OperatorType.Messages:
                // 获取说说列表
                if (API.Common.isExport(moduleType)) {
                    await API.Messages.export();
                }
                this.next(OperatorType.Blogs);
                break;
            case OperatorType.Blogs:
                // 获取日志列表
                if (API.Common.isExport(moduleType)) {
                    await API.Blogs.export();
                }
                this.next(OperatorType.Diaries);
                break;
            case OperatorType.Diaries:
                // 获取私密日记列表
                if (API.Common.isExport(moduleType)) {
                    await API.Diaries.export();
                }
                this.next(OperatorType.Boards);
                break;
            case OperatorType.Boards:
                // 获取留言列表
                if (API.Common.isExport(moduleType)) {
                    await API.Boards.export();
                }
                this.next(OperatorType.Friends);
                break;
            case OperatorType.Friends:
                // 获取QQ好友列表
                if (API.Common.isExport(moduleType)) {
                    await API.Friends.export();
                }
                this.next(OperatorType.Favorites);
                break;
            case OperatorType.Favorites:
                // 获取收藏列表
                if (API.Common.isExport(moduleType)) {
                    await API.Favorites.export();
                }
                this.next(OperatorType.Shares);
                break;
            case OperatorType.Shares:
                // 获取分享列表
                if (API.Common.isExport(moduleType)) {
                    await API.Shares.export();
                }
                this.next(OperatorType.Visitors);
                break;
            case OperatorType.Visitors:
                // 获取访客
                if (API.Common.isExport(moduleType)) {
                    await API.Visitors.export();
                }
                this.next(OperatorType.Photos);
                break;
            case OperatorType.Photos:
                // 获取相册列表
                if (API.Common.isExport(moduleType)) {
                    await API.Photos.export();
                }
                this.next(OperatorType.Videos);
                break;
            case OperatorType.Videos:
                // 获取视频列表
                if (API.Common.isExport(moduleType)) {
                    await API.Videos.export();
                }
                this.next(OperatorType.USER_INFO);
                break;
            case OperatorType.USER_INFO:
                // 导出用户信息
                await API.Common.exportUser();
                this.next(OperatorType.FILE_LIST);
                break;
            case OperatorType.FILE_LIST:
                // 保存数据
                await API.Common.saveBackupItems();
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
                $("#fileList").show();
                $("#backupStatus").html("数据采集完成，<span style='color:red' >请点击下方【打包下载】ZIP包</span>。");
                API.Utils.notification("QQ空间导出助手通知", "空间数据已获取完成，请点击下载！");
                break;
            default:
                break;
        }
    }

    /**
     * 初始化
     */
    init() {
        if (location.href.indexOf("qzone.qq.com") == -1 || location.protocol == 'filesystem:') {
            return;
        }

        // 获取gtk
        API.Utils.initGtk();
        // 获取Token
        API.Utils.getQzoneToken();
        // 获取QQ号
        API.Utils.initUin();
        // 获取相册路由
        API.Photos.getRoute();

        // 读取配置项
        chrome.storage.sync.get(Default_Config, function (item) {
            QZone_Config = item;
        })

        // 初始化文件夹
        QZone.Common.Filer.init({ persistent: false, size: 10 * 1024 * 1024 * 1024 }, function (fs) {
            QZone.Common.Filer.ls(FOLDER_ROOT, function (entries) {
                console.info('当前子目录：', entries);
                QZone.Common.Filer.rm(FOLDER_ROOT, function () {
                    console.info('清除历史数据成功！');
                });
            });
        })
    }

    /**
     * 初始化各个备份模块的文件夹
     */
    async initModelFolder() {
        console.info('初始化模块文件夹开始', QZone);

        // 切换根目录
        await API.Utils.switchToRoot();

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
                console.info('创建目录成功', entry);
            }
        }

        // 创建模块文件夹
        await createModuleFolder();

        // 创建说明文件
        let res = await API.Utils.get(chrome.runtime.getURL('others/README.md'));
        let fileEntry = await API.Utils.writeText(res, FOLDER_ROOT + "README.md");
        console.info('生成说明文件完成', fileEntry);
        console.info('初始化模块文件夹结束', QZone);
    }

    /**
     * 显示备份进度窗口
     */
    async showProcess() {
        const html = await API.Utils.get(chrome.extension.getURL('html/indicator.html'));

        $('body').append(html);

        $('#progressModal').modal({
            backdrop: "static",
            keyboard: false
        });

        const $progressbar = $("#progressbar");
        const $downloadBtn = $('#downloadBtn');
        const $fileListBtn = $('#fileList');
        // 继续重试
        const $againDownloadBtn = $("#againDownload");
        // 浏览器下载
        const $browserDownloadBtn = $("#browserDownload");
        // 迅雷下载
        const $thunderDownloadBtn = $("#thunderDownload");

        // 下载方式
        const downloadType = QZone_Config.Common.downloadType;
        switch (downloadType) {
            case 'Browser':
                // 下载方式为浏览器下载时隐藏【浏览器下载】按钮
                $browserDownloadBtn.hide();
                // 修改继续重试按钮文本为【继续重试】
                $againDownloadBtn.text('继续重试');
                break;
            case 'Aria2':
                // 修改继续重试按钮文本为【Aria2下载】
                $againDownloadBtn.text('Aria2下载');
                break;
            case 'Thunder':
                // 下载方式为迅雷下载时隐藏【迅雷下载】按钮
                $thunderDownloadBtn.hide();
                // 修改继续重试按钮文本为【唤起迅雷】
                $againDownloadBtn.text('唤起迅雷');
                break;
            case 'Thunder_Link':
                // 隐藏重试按钮
                $againDownloadBtn.hide();
                break;
            case 'File':
                // 助手内部
                $againDownloadBtn.text('继续重试');
                break;
            default:
                break;
        }

        // 【打包下载】按钮点击事件
        $downloadBtn.click(() => {

            $('#progress').show();
            $progressbar.css("width", "0%");
            $progressbar.attr("aria-valuenow", "0");
            $progressbar.text('已下载0%');

            $fileListBtn.attr('disabled', true);
            $downloadBtn.attr('disabled', true);
            $downloadBtn.text('正在下载');

            let zipName = QZone.Common.Config.ZIP_NAME + "_" + QZone.Common.Target.uin + ".zip";

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
                $fileListBtn.attr('disabled', false);
                $("#showFolder").show();
                API.Utils.notification("QQ空间导出助手通知", "你的QQ空间数据下载完成！");
            });

        });

        // 【查看备份】按钮点击事件
        let $showFolder = $('#showFolder');
        $showFolder.click(() => {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'show_export_zip'
            });
        })

        //进度模式窗口隐藏后
        $('#progressModal').on('hidden.bs.modal', function () {
            $("#progressModal").remove();
            $("#modalTable").remove();
        })

        /**
         * 筛选数据
         * @param {string} value 过滤标识
         */
        const filterData = async function (value) {
            if (value === 'all') {
                $("#table").bootstrapTable('filterBy');
                return;
            }
            switch (downloadType) {
                case 'Browser':
                    // 下载方式为浏览器下载时
                    // 查询全部下载列表
                    let downlist = await API.Utils.getDownloadList(undefined);
                    for (const task of browserTasks) {
                        // 更新下载状态到表格
                        let index = downlist.getIndex(task.id, 'id');
                        if (index == -1) {
                            // 根据ID找下载项没找到表示没成功添加到浏览器中
                            task.downloadState = 'interrupted';
                            continue;
                        }
                        let downloadItem = downlist[index];
                        task.downloadState = downloadItem.state;
                    }
                    break;
                default:
                    break;
            }
            $("#table").bootstrapTable('filterBy', {
                downloadState: value
            })
        }

        // 查看指定状态的数据
        $('#statusFilter').change(function () {
            let value = $(this).val();
            if ('interrupted' === value || ('Thunder' === downloadType && 'all' === value)) {
                // 失败列表与迅雷下载全部列表时才展示【继续重试】按钮
                $againDownloadBtn.show();
            } else {
                $againDownloadBtn.hide();
            }
            filterData(value);
        })

        // 【重试】按钮点击事件
        $againDownloadBtn.click(async function () {
            let tasks = $('#table').bootstrapTable('getSelections');
            switch (downloadType) {
                case 'File':
                    // 下载方式为助手下载时
                    await API.Common.downloadsByAjax(tasks);
                    // 重新压缩
                    operator.next(OperatorType.ZIP);
                    break;
                case 'Browser':
                    // 下载方式为浏览器下载时
                    for (const task of tasks) {
                        if (!task.id || task.id === 0) {
                            // 无ID时表示添加到下载器失败，需要重新添加
                            await API.Utils.downloadByBrowser(task);
                            return;
                        }
                        await API.Utils.resumeDownload(task.id);
                    }
                    break;
                case 'Aria2':
                    // 下载方式为Aria2时
                    await API.Common.downloadByAria2(tasks);
                    break;
                case 'Thunder':
                    // 下载方式为迅雷下载时
                    const newThunderInfo = new ThunderInfo(thunderInfo.taskGroupName, QZone_Config.Common.downloadThread, tasks);
                    await API.Common.invokeThunder(newThunderInfo);
                    break;
                default:
                    break;
            }
        })

        // 【迅雷下载】点击事件
        $("#thunderDownload").click(async function () {
            let tasks = $('#table').bootstrapTable('getSelections');
            let newThunderInfo = new ThunderInfo(thunderInfo.taskGroupName, QZone_Config.Common.downloadThread);
            for (const task of tasks) {
                newThunderInfo.tasks.push(new ThunderTask(task.dir, task.name, API.Utils.toHttp(task.url)));
                task.setState('complete');
            }
            await API.Common.invokeThunder(newThunderInfo)
        })

        // 【浏览器下载】点击事件
        $browserDownloadBtn.click(function () {
            let tasks = $('#table').bootstrapTable('getSelections');
            let newBrowserTasks = [];
            for (const task of tasks) {
                newBrowserTasks.push(new BrowserTask(API.Utils.toHttp(task.url), thunderInfo.taskGroupName, task.dir, task.name));
                task.setState('in_progress');
            }
            API.Common.downloadsByBrowser(newBrowserTasks);
        })

        //显示下载任务列表
        $('#modalTable').on('shown.bs.modal', function () {

            // 重置筛选条件
            $('#statusFilter').val('interrupted');

            $("#table").bootstrapTable('destroy').bootstrapTable({
                undefinedText: '-',
                toggle: 'table',
                locale: 'zh-CN',
                search: true,
                searchAlign: 'right',
                height: "450",
                pagination: true,
                pageList: "[10, 20, 50, 100, 200, 500, 1000, 2000, 5000, All]",
                paginationHAlign: 'left',
                clickToSelect: true,
                paginationDetailHAlign: 'right',
                toolbar: '#toolbar',
                columns: [{
                    field: 'state',
                    checkbox: true,
                    align: 'left'
                }, {
                    field: 'name',
                    title: '名称',
                    titleTooltip: '名称',
                    align: 'left',
                    visible: true
                }, {
                    field: 'dir',
                    title: '路径',
                    titleTooltip: '路径',
                    align: 'left',
                    visible: true,
                    sortable: true
                }, {
                    field: 'url',
                    title: '地址（建议点击预览）',
                    titleTooltip: '地址（建议点击预览）',
                    align: 'left',
                    visible: true,
                    formatter: (value) => {
                        return '<a target="_brank" href="{0}" >预览</a> '.format(API.Utils.makeViewUrl(value));
                    }
                }, {
                    field: 'source',
                    title: '来源（<span style="color:red">打包下载前请勿点击访问</span>）',
                    titleTooltip: '来源，未打包下载前，请勿点击超链接访问，否则将清理已收集的数据。',
                    align: 'left',
                    visible: true,
                    formatter: (value, row, index, field) => {
                        let type = API.Common.getSourceType(value);
                        switch (type) {
                            case 'Messages':
                                // 说说
                                return API.Utils.getLink(API.Messages.getUniKey(value.tid), '查看说说');
                            case 'Blogs':
                                // 日志
                                return API.Utils.getLink(API.Blogs.getUniKey(value.blogid), '查看日志');
                            case 'Diaries':
                                // 私密日记
                                return API.Utils.getLink('https://rc.qzone.qq.com/blog?catalog=private', '私密日记');
                            case 'Photos':
                                // 相册（暂无相册逻辑，直接查看照片即可）
                                return API.Utils.getLink('#', '无');
                            case 'Images':
                                // 相片
                                return API.Utils.getLink(API.Photos.getImageViewLink(value), '查看相片');
                            case 'Videos':
                                // 视频
                                return API.Utils.getLink(value.url, '查看视频');
                            case 'Boards':
                                // 留言板
                                return API.Utils.getLink('https://user.qzone.qq.com/{0}/334'.format(QZone.Common.Target.uin), '查看留言');
                            case 'Favorites':
                                // 收藏夹
                                return API.Utils.getLink('https://user.qzone.qq.com/{0}/favorite'.format(QZone.Common.Target.uin), '查看收藏');
                            default:
                                return API.Utils.getLink('#', '无');
                        }
                    }
                }],
                data: API.Utils.getDownloadTasks()
            })
            $('#table').bootstrapTable('resetView')

            // 默认加载失败的数据
            filterData("interrupted");
        })
    }
}

// 操作器
const operator = new QZoneOperator();
// Ajax下载任务
const downloadTasks = new Array();
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
        console.info("消息发送者：", port);
        switch (port.name) {
            case 'popup':
                port.onMessage.addListener(function (request) {
                    switch (request.subject) {
                        case 'startBackup':
                            QZone.Common.ExportType = request.exportType;
                            // 清空之前选择的相册
                            QZone.Photos.Album.Select = [];
                            QZone.Photos.Album.Select = request.albums || [];
                            // 显示进度窗口
                            operator.next(OperatorType.SHOW);
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
                        case 'getAlbumList':
                            // 获取相册列表
                            if (_.isEmpty(QZone.Photos.Album.Data)) {
                                API.Photos.getAllAlbumList().then((data) => {
                                    port.postMessage(data);
                                });
                            } else {
                                port.postMessage(QZone.Photos.Album.Data);
                            }
                            break;
                        case 'initConfig':
                            // 初始化配置
                            chrome.storage.sync.get(Default_Config, function (item) {
                                port.postMessage(item);
                            })
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
    operator.next(OperatorType.INIT);

})()


/**
 * 添加下载任务
 * @param {string} item 对象
 * @param {string} url URL
 * @param {string} module_dir 模块下载目录
 * @param {object} source 来源
 * @param {string} FILE_URLS 文件下载链接
 * @param {string} suffix 文件后缀
 */
API.Utils.addDownloadTasks = async (item, url, module_dir, source, FILE_URLS, suffix) => {
    url = API.Utils.toHttp(url);
    item.custom_url = url;
    if (API.Common.isQzoneUrl()) {
        return;
    }
    let filename = FILE_URLS.get(url);
    if (!filename) {
        filename = API.Utils.newSimpleUid(8, 16);
        if (suffix) {
            filename = filename + suffix;
            item.custom_mimeType = suffix;
        } else {
            let autoSuffix = await API.Utils.autoFileSuffix(url);
            filename = filename + autoSuffix;
            item.custom_mimeType = autoSuffix;
        }
    }
    item.custom_filename = filename;
    item.custom_filepath = 'Images/' + filename;
    if (!FILE_URLS.has(url)) {
        // 添加下载任务
        API.Utils.newDownloadTask(url, module_dir, filename, source, suffix);
        FILE_URLS.set(url, filename);
    }
}

/**
 * 添加下载任务
 * @param {url} url 下载地址
 * @param {folder} folder 下载相对目录
 * @param {name} name 文件名称
 * @param {object} source 文件来源
 */
API.Utils.newDownloadTask = (url, folder, name, source, makeOrg) => {
    if (!url) {
        return;
    }
    url = makeOrg ? url : API.Utils.makeDownloadUrl(url, true);

    // 添加Ajax请求下载任务
    const ajax_down = new DownloadTask(folder, name, API.Common.isFile() ? API.Utils.toHttps(url) : url, source);
    // 添加浏览器下载任务
    const browser_down = new BrowserTask(url, QZone.Common.Config.ZIP_NAME, folder, name, source);
    // 添加迅雷下载任务
    const thunder_down = new ThunderTask(folder, name, url, source);

    // 因为视频存在有效期，所以尽量将MP4文件前置，尽早下载
    if (name && name.indexOf('mp4') > -1) {
        downloadTasks.unshift();
        downloadTasks.unshift(ajax_down);
        browserTasks.unshift(browser_down);
        thunderInfo.addTask(thunder_down);
        return;
    }
    downloadTasks.push(ajax_down);
    browserTasks.push(browser_down);
    thunderInfo.addTask(thunder_down);
}

/**
 * 下载文件
 */
API.Utils.downloadAllFiles = async () => {
    let downloadType = QZone_Config.Common.downloadType;
    if (downloadType === 'QZone') {
        // 使用QQ空间外链时，不需要下载文件
        return;
    }
    if (downloadTasks.length === 0 || thunderInfo.tasks.length === 0 || browserTasks.length === 0) {
        // 没有下载任务的时候，不调用下载逻辑
        return;
    }
    switch (downloadType) {
        case 'File':
            await API.Common.downloadsByAjax(downloadTasks);
            break;
        case 'Aria2':
            await API.Common.downloadByAria2(downloadTasks);
            break;
        case 'Thunder':
            await API.Common.invokeThunder(thunderInfo);
            break;
        case 'Thunder_Link':
            // 写入迅雷任务到文件
            await API.Common.writeThunderTaskToFile(thunderInfo);
            break;
        case 'Browser':
            await API.Common.downloadsByBrowser(browserTasks);
            break;
        default:
            console.warn('未识别类型', downloadType);
            break;
    }
}

/**
 * 获取下载任务
 */
API.Utils.getDownloadTasks = () => {
    // 下载方式
    let downloadType = QZone_Config.Common.downloadType;
    let tasks = [];
    switch (downloadType) {
        case 'File':
            tasks = downloadTasks;
            break;
        case 'Browser':
            tasks = browserTasks;
            break;
        case 'Aria2':
            tasks = downloadTasks;
            break;
        case 'Thunder':
            tasks = thunderInfo.tasks;
            break;
        case 'Thunder_Link':
            tasks = thunderInfo.tasks;
            break;
        default:
            break;
    }
    return tasks;
}

/**
 * 获取下载失败的下载任务
 */
API.Utils.getFailedTasks = () => {
    // 下载方式
    let downloadType = QZone_Config.Common.downloadType;
    let tasks = [];
    switch (downloadType) {
        case 'File':
            for (const downloadTask of downloadTasks) {
                if (downloadTask.success) {
                    continue;
                }
                tasks.push(downloadTask);
            }
            break;
        case 'Browser':
            tasks = browserTasks;
            break;
        case 'Thunder':
            tasks = thunderInfo.tasks;
            break;
        default:
            break;
    }
    return tasks;
}