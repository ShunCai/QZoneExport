import type { QzoneContext } from '../../qzone-api/context';
import type { Requester } from '../../qzone-api/request';
import type { Logger } from '../../shared/logger';
import type { IncrementConfig } from '../increment';

/**
 * 采集器域层类型定义
 * 配置结构对齐 src/js/config.js 的 Default_Config（QZone_Config），
 * 环境接口（CollectorEnv）由接线层（内容脚本）注入实现，域层不触碰DOM/chrome API
 */

/** 随机延迟范围（秒） */
export interface RandomSeconds {
    min: number;
    max: number;
}

/** 模块通用配置 */
export interface ModuleBaseConfig extends IncrementConfig {
    /** 内容备份类型（HTML/JSON/MarkDown/Excel/Link/File） */
    exportType: string;
    pageSize: number;
    randomSeconds: RandomSeconds;
}

/** 点赞采集配置 */
export interface LikeConfig {
    /** 是否继承 Common.Like 公共配置（默认 true）；false 时本模块使用下方自身字段 */
    inherit?: boolean;
    isGet: boolean;
    randomSeconds: RandomSeconds;
}

/** 最近访问采集配置 */
export interface VisitorConfig {
    /** 是否继承 Common.Visitor 公共配置（默认 true）；false 时本模块使用下方自身字段 */
    inherit?: boolean;
    isGet: boolean;
    pageSize: number;
    randomSeconds: RandomSeconds;
}

/** 评论采集配置（全模块统一：isGet 是否获取评论；开启后拉全部，关闭则跳过全量翻页——部分模块列表自带少量首页评论仍可能保留） */
export interface CommentsConfig {
    /** 是否继承 Common.Comments 公共配置（默认 true）；false 时本模块使用下方自身字段 */
    inherit?: boolean;
    isGet: boolean;
    pageSize: number;
    randomSeconds: RandomSeconds;
}

/** 说说模块配置 */
export interface MessagesConfig extends ModuleBaseConfig {
    /** 是否过滤关键字 */
    isFilterKeyword: boolean;
    FilterKeyWords: string[];
    /** 刷新朋友圈坐标信息 */
    refreshWeChatLbs: boolean;
    /**
     * 非微信同步的说说也补一次地点信息（只反查地址/地点名，不动坐标）。
     * 这些说说的坐标本身已是 GCJ02，再走坐标转换会整体偏移，故只调逆地址解析。
     */
    refreshAllLbs?: boolean;
    /** 是否获取语音说说 */
    GetVoice: boolean;
    Comments: CommentsConfig;
    Like: LikeConfig;
    Visitor: VisitorConfig;
}

/** 日志模块配置 */
export interface BlogsConfig extends ModuleBaseConfig {
    /** 详情获取延迟 */
    Info: { randomSeconds: RandomSeconds };
    Comments: CommentsConfig;
    Like: LikeConfig;
    Visitor: VisitorConfig;
}

/** 日记模块配置 */
export interface DiariesConfig extends ModuleBaseConfig {
    /** 详情获取延迟 */
    Info: { randomSeconds: RandomSeconds };
    Comments: CommentsConfig;
    Like: LikeConfig;
    Visitor: VisitorConfig;
}

/** 留言模块配置 */
export type BoardsConfig = ModuleBaseConfig;

/** 好友模块配置（无分页与增量时间字段） */
export interface FriendsConfig {
    exportType: string;
    randomSeconds: RandomSeconds;
    /** 是否获取好友互动信息（亲密度/添加时间/共同好友群组） */
    Interactive: boolean;
    /** 是否判断空间权限 */
    ZoneAccess: boolean;
    /** 是否获取特别关心 */
    SpecialCare: boolean;
    /** 增量模式：继承通用默认 IncrementType；!=='Full' 时做增量处理（识别已删好友 + 跳过既有好友互动重抓） */
    IncrementType?: string;
    /** 分组排序，QQ分组（QQ）或助手分组（default） */
    SortType?: string;
}

/** 相册模块配置 */
export interface PhotosConfig extends ModuleBaseConfig {
    Comments: CommentsConfig;
    Like: LikeConfig;
    Visitor: VisitorConfig;
    Images: {
        pageSize: number;
        /** 相片列表获取方式（List分页/Detail详情递归） */
        listType?: string;
        randomSeconds: RandomSeconds;
        Comments: CommentsConfig;
        /** 相片清晰度（raw原图/original高清/其余普通） */
        exifType?: string;
        /** 相片详情 */
        Info: { isGet: boolean; pageSize: number; randomSeconds: RandomSeconds };
        /** 是否获取相片关联的视频 */
        isGetVideo: boolean;
        /** 是否获取预览图 */
        isGetPreview?: boolean;
        /** 文件夹结构类型 */
        fileStructureType?: string;
        /** 相片文件名方式（同 PHOTO_RENAME_OPTIONS，无序号前缀） */
        RenameType?: string;
    };
}

/** 视频模块配置 */
export interface VideosConfig extends ModuleBaseConfig {
    /** 文件夹结构类型 */
    fileStructureType?: string;
    /** 文件名方式：Default=链接指纹(URL哈希) / Name=视频标题 / Time=视频标题_上传时间 */
    RenameType?: string;
    Comments: CommentsConfig;
    Like: LikeConfig;
}

/** 收藏模块配置 */
export type FavoritesConfig = ModuleBaseConfig;

/** 分享模块配置 */
export interface SharesConfig extends ModuleBaseConfig {
    Info: { randomSeconds: RandomSeconds };
    Comments: CommentsConfig;
    Like: LikeConfig;
    Visitor: VisitorConfig;
    /** 分享来源识别规则 */
    SourceType?: Array<{ name: string; regulars: string }>;
}

/** 访客模块配置（无pageSize，按接口返回的totalPage翻页） */
export type VisitorsConfig = Omit<ModuleBaseConfig, 'pageSize'>;

/** 采集所需的完整配置视图（QZone_Config 的域层子集） */
export interface QzoneBackupConfig {
    Common: {
        /** 媒体策略：Link=不下载引用外链 */
        mediaMode?: string;
        /** 下载器（Browser/Aria2/Disk；历史值 QZone 已归一化为 mediaMode=Link） */
        downloadType: string;
        /** Aria2 协议下载器配置 */
        Aria2?: {
            rpc: string;
            token?: string;
            /** Aria2 基础下载目录（绝对路径），为空时 dir 走相对路径 */
            dir?: string;
        };
        /** 是否请求URL识别文件后缀 */
        isAutoFileSuffix: boolean;
        /** 头像下载域名编号（0按uin取模，其余为固定编号；负数不拼域名编号） */
        AvatarHost?: number;
        /** 导出格式（HTML / MarkDown），彻底全局，各模块不再单独配置 */
        exportType: string;
        /** 增量备份公共默认（各模块可取消继承、单独配置） */
        Increment: { IncrementType: 'Full' | 'LastTime' | 'Custom' | string; IncrementTime: string };
        /** 获取点赞公共默认 */
        Like: { isGet: boolean; randomSeconds: RandomSeconds };
        /** 获取评论公共默认（全模块统一 isGet） */
        Comments: { isGet: boolean; pageSize: number; randomSeconds: RandomSeconds };
        /** 获取最近访客公共默认 */
        Visitor: { isGet: boolean; pageSize: number; randomSeconds: RandomSeconds };
    };
    Messages: MessagesConfig;
    Blogs: BlogsConfig;
    Diaries: DiariesConfig;
    Boards: BoardsConfig;
    Friends: FriendsConfig;
    Photos: PhotosConfig;
    Videos: VideosConfig;
    Favorites: FavoritesConfig;
    Shares: SharesConfig;
    Visitors: VisitorsConfig;
    Dev: { Maps: { TxKey: string } };
}

/** 媒体下载任务（登记后由接线层分发给 Browser/Aria2/Disk 下载器） */
export interface MediaTask {
    /** 所属模块 */
    module: string;
    /** 下载地址（已追加下载参数） */
    url: string;
    /** 相对备份根的目录（如 Messages/images） */
    dir: string;
    /** 文件名 */
    name: string;
    /** 来源条目引用（失败重试展示用） */
    source?: unknown;
    /** 是否前置下载（视频存在有效期，MP4/M3U8任务需尽早下载） */
    prioritized?: boolean;
    /** 所属内容 ID（说说 tid / 日志 blogId / 相册 albumId / 视频 vid 等） */
    ownerId?: string;
    /** 所属内容摘要（说说前 20 字 / 相册名 / 日志标题 / 视频标题等，用于下载失败时告诉用户「缺了哪条内容的图」） */
    ownerTitle?: string;
    /** 缩略图地址（预览/网格视图里快速展示） */
    thumbUrl?: string;
}

/**
 * 采集器运行环境（由接线层注入）
 * 域层只依赖此接口，便于单测与多环境复用
 */
export interface CollectorEnv {
    /** 登录/备份目标上下文 */
    ctx: QzoneContext;
    /** 助手配置 */
    config: QzoneBackupConfig;
    /** 统一请求器 */
    requester: Requester;
    /**
     * 腾讯地图 API 代理（background 直连，绕开 MV3 content script 的 CORS 限制）。
     * 未提供时 refreshLbsInfo 退回 requester（页面上下文，Chrome 下会 Failed to fetch）。
     */
    lbsProxy?: (url: string) => Promise<string>;
    /** 分级日志器（诊断信息统一收口，可随备份导出） */
    logger: Logger;
    /** 暂停/取消检查点（透传 pipeline CollectContext.tick） */
    tick(): Promise<void>;
    /** 进度上报（phase + 已完成/总数，自动附带累计的 failed） */
    report(phase: string, done: number, total: number, failed?: number, label?: string, subject?: { done: number; total: number }): Promise<void>;
    /** 累加失败计数（请求失败跳过时调用，下次 report 时自动附带） */
    fail(count?: number): void;
    /** 读取上次备份数据（增量用；Boards/Visitors 为对象结构，其余为数组） */
    getOldData<T = unknown>(module: string): Promise<T | undefined>;
    /** 登记媒体下载任务 */
    addMediaTask(task: MediaTask): void;
    /**
     * 返回本轮/上一轮备份已成功下载的媒体 URL 集合（断点去重用）。
     * 未提供时视为空集合，媒体登记不跳过。
     */
    getDownloadedUrls?: () => Promise<Set<string>>;
    /** URL后缀探测（isAutoFileSuffix 时经SW请求MIME识别，失败返回空串） */
    detectSuffix(url: string): Promise<string>;
    /** 写数据文件：window.<global> = <data> */
    writeJsonToJs(global: string, data: unknown, path: string): Promise<void>;
    /** 写文本文件 */
    writeText(text: string, path: string): Promise<void>;
    /** 写二进制文件（如好友 Excel .xlsx） */
    writeFile(data: Uint8Array | Blob, path: string): Promise<void>;
    /** 读取模块暂存数据（断点续传用：从 staging 恢复上次采集结果） */
    loadStaging<T = unknown>(module: string): Promise<T | undefined>;
    /** 保存模块暂存数据（各阶段结束后调用，供续传时恢复） */
    saveStaging(module: string, data: unknown): Promise<void>;
    /** 等待（接线层可注入随机抖动/测试免等待） */
    sleep(ms: number): Promise<void>;
    /** MarkDown 导出（exportType === 'MarkDown' 时调用，委托旧运行时渲染） */
    exportMarkdown?(module: string, items: unknown): Promise<void>;
}

/** 媒体策略是否为不下载（内容直接引用QQ空间外链） */
export function isQzoneUrl(config: QzoneBackupConfig): boolean {
    return config.Common.mediaMode === 'Link' || config.Common.downloadType === 'QZone';
}

/** 是否需要获取赞（移植自 common.js isGetLike L1284-1286） */
export function isGetLike(cfg: { Like: LikeConfig; exportType: string }): boolean {
    return cfg.Like.isGet && cfg.exportType === 'HTML';
}

/** 是否需要获取最近访问（移植自 common.js isGetVisitor L1292-1294） */
export function isGetVisitor(cfg: { Visitor: VisitorConfig; exportType: string }): boolean {
    return cfg.Visitor.isGet && cfg.exportType === 'HTML';
}
