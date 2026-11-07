/**
 * 记录摘要（列表里那一行文字）的统一口径
 *
 * 为什么需要单独一层：备份数据里「一行摘要」有三种看起来「没内容」的情况，混在一起
 * 就会退化成满屏的「无内容」——
 *
 * 1. **字段选错**（最常见）：留言的正文只在 `htmlContent` / `ubbContent`，`content` 恒为空字符串；
 *    视频的 `name` 恒空、正文在 `desc`；分享也是 `desc` 而非 `content`。
 *    实测某备份 14211 条留言 `content` 100% 为空，视频 34 条 `name` 100% 为空。
 *    注意这里必须用「取第一个非空字段」而不是 `??`：空字符串不是 nullish，`??` 会直接短路。
 *
 * 2. **只有表情/图片**：QQ 空间表情是 `[em]e117[/em]`（UBB）或 `qzonestyle` 的 gif（HTML），
 *    剥掉标签后什么都不剩。这类要报出「表情 × 2」「图片 × 1」，比「无内容」有意义。
 *
 * 3. **真的没有正文**：退到模块兜底——说说看是不是转发，再退图片/视频，视频退「视频动态」。
 */
import type { DataKey } from './sources';

/** 模块短名：卡片左侧小标签、兜底摘要都用它，避免各处各写一份 */
export const MODULE_LABEL: Record<string, string> = {
    messages: '说说', blogs: '日志', diaries: '日记', videos: '视频',
    boards: '留言', shares: '分享', favorites: '收藏', visitors: '访客', photos: '相片',
    friends: '好友',
};

/** QQ 空间表情：`[em]e117[/em]`，新版大表情是更长的 e400308 */
const EM_UBB = /\[em\]e\d+\[\/em\]/gi;
/** UBB 图片：`[img,150,140]url[/img]` */
const IMG_UBB = /\[img[^\]]*\][\s\S]*?\[\/img\]/gi;
/** UBB 视频：`[video,..]..[/video]` */
const VIDEO_UBB = /\[video[^\]]*\][\s\S]*?\[\/video\]/gi;
/** HTML 图片标签 */
const IMG_TAG = /<img\b[^>]*>/gi;
/** HTML 里能认出是表情的 img：qzone 表情域名或 emoji 类名（其余按普通图片算） */
const EMOJI_IMG = /(?:qzone\/em\/|\/em\/e\d+\.|class\s*=\s*"[^"]*emoji)/i;

/** 纯文本化：剥 UBB、HTML 标签与实体，压空白。只做展示，不追求还原富文本 */
export function plainText(value: unknown): string {
    const raw = String(value ?? '');
    if (!raw) {
        return '';
    }
    return raw
        // @ 提及：数据里是 @{uin:…,nick:…,who:1}（旧数据也有方括号写法）。
        // 摘要走的是纯文本链路（不经 formatMention），不处理就会把 token 原样露出来；
        // 也不能靠后面的 BBCode 清理——花括号形式不在它的匹配范围内。
        .replace(/@[\[{]uin:[^}\]]*?,nick:([^}\]]*?)(?:,[^}\]]*?)?[\]}]/g, '@$1')
        .replace(EM_UBB, ' ')
        .replace(IMG_UBB, ' ')
        .replace(VIDEO_UBB, ' ')
        // 其余 BBCode 标签（签名字段里的 [ft=..][url=..][I] 之类）
        .replace(/\[\/?[a-zA-Z][^\]]*\]/g, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface MediaCount {
    emoji: number;
    image: number;
}

/** 数一条内容里的表情与图片个数 */
export function countMedia(value: unknown): MediaCount {
    const raw = String(value ?? '');
    if (!raw) {
        return { emoji: 0, image: 0 };
    }
    let emoji = (raw.match(EM_UBB) || []).length;
    let image = (raw.match(IMG_UBB) || []).length;
    for (const tag of raw.match(IMG_TAG) || []) {
        // HTML 里表情与普通图片都是 <img>，只能靠 src/class 区分
        if (EMOJI_IMG.test(tag)) {
            emoji += 1;
        } else {
            image += 1;
        }
    }
    return { emoji, image };
}

/** 「表情 × 2 · 图片 × 1」；没有则为空串 */
export function mediaLabel(media: MediaCount): string {
    const parts: string[] = [];
    if (media.emoji > 0) {
        parts.push(`表情 × ${media.emoji}`);
    }
    if (media.image > 0) {
        parts.push(`图片 × ${media.image}`);
    }
    return parts.join(' · ');
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
}

/**
 * 通用片段：正文优先，没正文时报媒体数量，再没有才「无内容」。
 * 需要模块级兜底（转发 / 视频动态 / 相片）时用 {@link summaryOf}。
 */
export function snippet(value: unknown, max = 30): string {
    const text = plainText(value);
    if (text) {
        return truncate(text, max);
    }
    return mediaLabel(countMedia(value)) || '无内容';
}

/** 取第一个「非空」字段：空字符串也算空（`content: ""` 是留言的常态） */
function firstFilled(item: Record<string, any>, fields: string[]): string {
    for (const field of fields) {
        const value = item?.[field];
        if (value === undefined || value === null) {
            continue;
        }
        const text = String(value);
        if (text.trim()) {
            return text;
        }
    }
    return '';
}

/**
 * 各模块正文的真实字段（顺序按实测数据定，不要按模块名猜）。
 * 留言必须把 htmlContent/ubbContent 排在 content 前面——后者恒为空。
 */
export function rawBodyOf(key: string, item: Record<string, any>): string {
    if (!item) {
        return '';
    }
    switch (key) {
        case 'messages':
            return firstFilled(item, ['content', 'custom_content']);
        case 'boards':
            return firstFilled(item, ['htmlContent', 'ubbContent', 'content']);
        case 'shares':
            return firstFilled(item, ['desc', 'content', 'title']);
        case 'videos':
            return firstFilled(item, ['desc', 'title', 'name']);
        case 'photos':
            // 相片没有正文，只有文件名/相册名
            return '';
        default:
            return firstFilled(item, ['title', 'name', 'content', 'html', 'abstract', 'desc', 'desp']);
    }
}

/**
 * 一行摘要：正文 → 表情/图片数量 → 模块兜底。
 *
 * 说说的「转发」优先于表情数量：用户对无正文说说明确要求「没内容时显示转发了谁的」，
 * 而「表情 × 2」给不出信息量。
 */
export function summaryOf(key: string | DataKey, item: Record<string, any>, max = 30): string {
    const body = rawBodyOf(key, item);
    const text = plainText(body);
    if (text) {
        return truncate(text, max);
    }

    if (key === 'messages') {
        // 昵称里也可能夹表情码（实测「转发：琪琪[em]e328139[/em]」），一并清掉
        const original = plainText(item?.rt_uinname || item?.rt_uin || '');
        if (original) {
            return `转发：${truncate(original, max)}`;
        }
    }

    // UBB 原文能区分「表情」与「图片」；HTML 里两者都是 <img>，故优先拿它计数
    const media = mediaLabel(countMedia(item?.ubbContent || body));
    if (media) {
        return media;
    }

    // 分享类常常没有正文，内容在被分享对象的 source 里（音乐名/视频标题），比「无内容」有用
    const shared = plainText(item?.source?.title || item?.source?.desc || item?.abstract || '');
    if (shared) {
        return truncate(shared, max);
    }

    if (key === 'messages') {
        const pictures = Array.isArray(item?.pic) ? item.pic.length : 0;
        if (pictures > 0) {
            return `图片 × ${pictures}`;
        }
        if (Array.isArray(item?.custom_videos) && item.custom_videos.length > 0) {
            return '视频动态';
        }
    }
    if (key === 'photos') {
        return '相片';
    }
    if (key === 'videos') {
        return '视频动态';
    }
    return '无内容';
}
