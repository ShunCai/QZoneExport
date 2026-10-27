/**
 * 采集器数据模型（共享类型定义）
 */

/* ===== 通用子结构 ===== */

export interface QzoneUserBrief {
    uin?: number;
    nickname?: string;
    name?: string;
    [key: string]: unknown;
}

export interface LikeRecord {
    fuin?: number;
    nick?: string;
    user?: QzoneUserBrief;
    [key: string]: unknown;
}

export interface CommentRecord {
    content?: string;
    nick?: string;
    user?: QzoneUserBrief;
    createTime?: string | number;
    postTime?: string | number;
    replys?: CommentRecord[];
    replies?: CommentRecord[];
    list_3?: CommentRecord[];
    pic?: Array<{ hd_url?: string; b_url?: string; [key: string]: unknown }>;
    [key: string]: unknown;
}

export interface VisitorRecord {
    uin?: number;
    nickname?: string;
    visitTime?: number;
    [key: string]: unknown;
}

/* ===== 说说专用 ===== */

export interface MessageMediaItem {
    url?: string;
    hd_url?: string;
    b_url?: string;
    video_url?: string;
    video_id?: string;
    [key: string]: unknown;
}

export type MessageCommentItem = CommentRecord;

/* ===== 相册/相片专用 ===== */

export interface VideoInfo {
    videoid?: string;
    vid?: string;
    url?: string;
    /** 原视频地址（MP4）：仅浮层接口 cgi_floatview_photo_list_v2 下发，列表接口无此字段 */
    download_url?: string;
    /** 播放地址（M3U8/MP4 转码档）：列表接口与浮层接口均有 */
    video_url?: string;
    duration?: number;
    [key: string]: unknown;
}

export interface PhotoLocation {
    id?: string;
    idname?: string;
    pos_x?: number;
    pos_y?: number;
    name?: string;
    address?: string;
    [key: string]: unknown;
}

/** 相册访客汇总 */
export interface PhotoVisitorSummary {
    viewCount: number;
    totalNum: number;
    list: VisitorRecord[];
}

/* ===== 说说访客汇总 ===== */

export interface MessageVisitorSummary {
    viewCount: number;
    totalNum: number;
    list: VisitorRecord[];
}

/* ===== 分享模块 ===== */

export interface ShareSourceInfo {
    url?: string;
    images?: Array<{ url?: string; [key: string]: unknown }>;
    [key: string]: unknown;
}

/* ===== 访客模块 ===== */

export interface VisitorEntry {
    uin?: number;
    nickname?: string;
    visitTime?: number;
    shuoshuoes?: VisitorRecord[];
    blogs?: VisitorRecord[];
    photoes?: VisitorRecord[];
    shares?: VisitorRecord[];
    uins?: number[];
}
