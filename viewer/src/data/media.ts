/**
 * 媒体项类型与视频转换
 * 单独成文件：`<script setup>` 里不能有 ES 模块导出（含类型导出），而 MediaGrid 与各页面
 * 都要用同一份定义。
 */
import { formatTime, timeValue, isValidTimestampMs } from './format';
import { assetUrl } from './sources';
import {
    externalVideoUrl,
    isExternalVideo,
    itemComments,
    likeTotal,
    videoPoster,
    videoUrl,
} from './content';

/**
 * viewer 端的同步 URL 解包（解 cgi_imgproxy + 协议归一化）：
 * 与 content.ts 中 unwrapViewerImageUrl 保持完全等价的实现（避免跨目录循环 import）。
 */
function unwrapViewerImageUrl(url?: string | null): string {
    if (!url) return '';
    let u = url;
    const hasQpic = (s: string) => s.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1
        || s.indexOf('p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1;
    if (hasQpic(u)) {
        const regUrl = /^[^?]+\?([\w\W]+)$/;
        const regPara = /([^&=]+)=([\w\W]*?)(&|$|#)/g;
        const arrUrl = regUrl.exec(u);
        if (arrUrl && arrUrl[1]) {
            const params: Record<string, string> = {};
            let m: RegExpExecArray | null;
            while ((m = regPara.exec(arrUrl[1])) != null) {
                params[m[1]!] = m[2]!;
            }
            if (params['url']) u = params['url'];
        }
    }
    try { u = decodeURIComponent(u); } catch { /* ignore */ }
    if (hasQpic(u)) {
        const regUrl = /^[^?]+\?([\w\W]+)$/;
        const regPara = /([^&=]+)=([\w\W]*?)(&|$|#)/g;
        const arrUrl = regUrl.exec(u);
        if (arrUrl && arrUrl[1]) {
            const params: Record<string, string> = {};
            let m: RegExpExecArray | null;
            while ((m = regPara.exec(arrUrl[1])) != null) {
                params[m[1]!] = m[2]!;
            }
            if (params['url']) {
                u = params['url'];
                try { u = decodeURIComponent(u); } catch { /* ignore */ }
            }
        }
    }
    u = u.replace(/^\/\//g, 'https://').replace(/^http:\/\//g, 'https://');
    return u;
}

/**
 * 大图面板顶部展示的媒体信息
 * 拆成三段而不是一大段文本：名称与说明是内容，时间地点是属性，两者得有视觉差异，
 * 否则一片同样字号同样颜色的文字根本分不出哪个是什么。
 */
export interface MediaInfo {
    name?: string;
    desc?: string;
    /** 属性行（如拍摄时间、拍摄地点） */
    meta?: { label: string; value: string }[];
}

export interface MediaItem {
    type: 'image' | 'video';
    /**
     * 媒体自身的稳定标识（相片取 lloc，缺省退相片名/地址）。
     * 供「从搜索结果跳进相册灯箱」时定位到具体这一张。
     */
    key?: string;
    /** 图片或视频地址（已转为查看器可用的相对路径）；灯箱大图用原图 */
    src: string;
    /**
     * 卡片缩略图地址（用于网格列表展示）。相片优先用预览图（custom_pre_filepath），
     * 与 Options「相片预览」配置一致；缺预览时回退原图。灯箱大图仍用 src（原图）。
     */
    thumb?: string;
    /** 视频封面 */
    poster?: string;
    /** 媒体自身的信息，展示在大图面板顶部 */
    info?: MediaInfo;
    /**
     * 外部视频的跳转地址（腾讯视频、Flash 等）
     * 这类视频没有可下载的源文件，只能点击跳到原站播放（需联网）。
     */
    link?: string;
    /** 该媒体自身的评论；没有时大图查看器会回落到整条记录的评论 */
    comments?: Record<string, any>[];
    /**
     * 叠在缩略图上的互动统计
     * 旧页在相片/视频封面上就能看到赞与评论数，方便快速挑出有互动的内容，
     * 不必逐张点开看。
     */
    stats?: {
        likes?: number;
        comments?: number;
    };
}

/** 视频时间：拍摄时间优先，其次上传时间 */
export function videoTimeOf(item: Record<string, any>): number | string | undefined {
    return item.shootTime || item.uploadTime || item.uploadtime;
}

/** 视频上传时间 */
export function videoUploadTime(item: Record<string, any>): number | string | undefined {
    return item.uploadTime || item.uploadtime;
}

/**
 * 一条视频 → 媒体项
 * 视频列表页与个人中心的那年今日共用，故收在这里。
 */
export function videoMediaOf(item: Record<string, any>): MediaItem {
    const video = item.video_info || item;
    const poster = videoPoster(item) || videoPoster(item.video_info);
    const comments = itemComments(item);
    const info = {
        name: item.name || '',
        desc: item.desc && item.desc !== item.name ? item.desc : '',
        meta: [
            { label: '时间', value: formatTime(videoTimeOf(item)) },
            { label: '赞', value: String(likeTotal(item)) },
        ],
    };
    // 封面上的统计：旧页在视频卡片上就能看到赞与评论数
    const stats = { likes: likeTotal(item), comments: comments.length };
    // 外部视频（腾讯视频、Flash）没有源文件，只能跳原站看
    if (isExternalVideo(video)) {
        return {
            type: 'video',
            src: poster,
            poster,
            link: externalVideoUrl(video),
            info,
            comments,
            stats,
        };
    }
    return {
        type: 'video',
        src: videoUrl(item) || videoUrl(item.video_info),
        poster,
        info,
        comments,
        stats,
    };
}

/** 相片地址：优先本地原图，其次缩略图，最后外链（用于灯箱大图，始终取原图） */
export function photoUrl(photo: Record<string, any>): string {
    const rawPath = photo.custom_filepath || photo.custom_pre_filepath || photo.custom_url || photo.url;
    const path = rawPath && /^(https?:)?\/\//.test(rawPath) ? unwrapViewerImageUrl(rawPath) : rawPath;
    return assetUrl(path);
}

/**
 * 相片卡片缩略图地址：预览图优先（与 Options「相片预览」配置一致），其次原图/外链。
 * 仅用于网格列表展示，灯箱大图仍走 photoUrl 取原图。
 */
export function photoThumbUrl(photo: Record<string, any>): string {
    const rawPath = photo.custom_pre_filepath || photo.custom_filepath || photo.custom_url || photo.url;
    const path = rawPath && /^(https?:)?\/\//.test(rawPath) ? unwrapViewerImageUrl(rawPath) : rawPath;
    return assetUrl(path);
}

/** 相片时间优先级：upload=上传优先、拍摄兜底；shoot=拍摄优先、上传兜底 */
export type PhotoTimePriority = 'upload' | 'shoot';

/** 相片时间：拍摄优先、兜底上传（用于年/月筛选与默认排序） */
export function photoTimeOf(photo: Record<string, any>): number | string | undefined {
    return resolvePhotoTime(photo, 'shoot');
}

/**
 * 统一相片时间解析：按 priority 决定 upload(上传) / shoot(拍摄) 谁优先，另一类兜底；
 * 逐字段跳过非法时间（1970 纪元占位、未来时间戳等，见 isValidTimestampMs）：转载相片
 * uploadTime 常回 "1970-01-01 07:59:59"、shootTime 可能是 UINT32 哨兵换算成的未来年份，都应忽略。
 * 与 Markdown 导出的 resolveTime 同一口径，供多页面复用。
 */
export function resolvePhotoTime(photo: Record<string, any>, priority: PhotoTimePriority = 'upload'): number | string | undefined {
    const uploadFields = ['uploadtime', 'uploadTime'];
    const shootFields = ['rawshoottime', 'shootTime', 'shoottime'];
    const order = priority === 'upload' ? [...uploadFields, ...shootFields] : [...shootFields, ...uploadFields];
    for (const key of order) {
        const raw = photo[key];
        if (raw === undefined || raw === null || raw === '') continue;
        const ts = timeValue(raw);
        if (!ts || !isValidTimestampMs(ts)) continue; // 1970 纪元占位 / 未来时间戳等非法值
        return raw;
    }
    return undefined;
}

/** 相片拍摄地点 */
export function photoLocation(photo: Record<string, any>): string {
    const lbs = photo.custom_lbs || photo.lbs;
    return lbs ? (lbs.idname || lbs.name || '') : '';
}

/**
 * 「上传时间」展示文本：QQ 对转载相片常回 1970 纪元占位（uploadtime/uploadTime = "1970-01-01..."，
 * 真实拍摄时间在 shootTime），也可能返回未来时间戳哨兵。此时不展示该行（返回空串，被 meta 的
 * 空值过滤掉），避免显示 1970 或未来年份。
 */
function uploadTimeText(photo: Record<string, any>): string {
    const raw = photo.uploadtime || photo.uploadTime;
    if (raw === undefined || raw === null || raw === '') return '';
    const ts = timeValue(raw);
    return !ts || !isValidTimestampMs(ts) ? '' : formatTime(raw);
}

/**
 * 一张相片 → 媒体项（相片可能本身是视频）
 * 相册详情页与个人中心的那年今日共用，故收在这里。
 */
export function photoMediaOf(photo: Record<string, any>): MediaItem {
    // 相片信息：名称与说明是内容，时间地点是属性，分开给（对应旧页鼠标悬停的 tooltip）
    const comments = itemComments(photo);
    const lbs = photo.custom_lbs || photo.lbs;
    const info = {
        name: photo.name || '',
        desc: photo.desc && photo.desc !== photo.name ? photo.desc : '',
        meta: [
            { label: '拍摄时间', value: formatTime(photo.rawshoottime || photo.shootTime) },
            { label: '上传时间', value: uploadTimeText(photo) },
            { label: '拍摄地点', value: lbs ? (lbs.idname || lbs.name || '') : '' },
            { label: '赞', value: String(likeTotal(photo)) },
        ],
    };
    // 缩略图上叠赞与评论数（旧页每张相片卡片上就有），不必逐张点开看
    const stats = { likes: likeTotal(photo), comments: comments.length };

    if (photo.is_video && photo.video_info) {
        return {
            type: 'video',
            key: String(photo.lloc || photo.name || ''),
            src: videoUrl(photo.video_info) || assetUrl(photo.video_info.video_url),
            // 相册视频的预览图挂在 photo 层级（custom_pre_filepath），video_info 里没有；
            // 回退必须用 preview 优先的 photoThumbUrl，否则会退到 custom_filepath（.mp4 本体）被当图片解码失败
            poster: videoPoster(photo.video_info) || photoThumbUrl(photo),
            info,
            comments,
            stats,
        };
    }
    return {
        type: 'image',
        key: String(photo.lloc || photo.name || ''),
        src: photoUrl(photo),
        thumb: photoThumbUrl(photo),
        info,
        comments,
        stats,
    };
}
