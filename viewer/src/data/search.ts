/**
 * 全局搜索索引
 *
 * file:// 下没有后端，所有数据本来就已读进内存（sources.ts 有 Map 缓存）。
 * 实测这个备份：条目 3,334 + 相片 9,808 + 评论 2,045，全量文本扫描 < 10ms，
 * 所以**不建倒排索引**，直接线性扫描 + 分组截断，够用且实现简单。
 *
 * 记录分两类：
 * - item    ：条目自身的标题/正文
 * - comment ：评论与回复（二级数据）。必须带 author 与所属条目的 context，
 *             否则一堆孤立的「哈哈哈」没法判断是哪条内容下的。
 */
import { loadItems, loadList, type DataKey } from './sources';
import {
    articlePublishTime,
    decodeHtml,
    fixHtmlAssets,
    itemComments,
    messagePublishTime,
    locationOf,
} from './content';
import { plainText } from './summary';
import { timeValue } from './format';

export type SearchKind = 'item' | 'comment';

/** 一条可搜记录（条目或评论） */
export interface SearchRecord {
    /** 模块标识，用于分组 */
    module: string;
    moduleLabel: string;
    kind: SearchKind;
    /** 条目主键：评论记录靠它定位到所属条目 */
    itemId: string;
    /** 评论自身标识（结果页高亮用；评论无稳定 id 时退化为序号） */
    commentId?: string;
    /** 秒级时间戳，用于组内排序与展示 */
    time: number;
    /** 结果标题：日志/日记取标题，说说/留言取正文开头，评论取评论者 */
    title: string;
    /** 参与匹配的文本（已转纯文本） */
    body: string;
    /** 评论者（仅评论记录） */
    author?: string;
    /** 所属条目的正文摘要（仅评论记录，帮助判断上下文） */
    context?: string;
    /** 跳转路由名 */
    route: string;
    /** 跳转查询参数 */
    query: Record<string, string>;
}

/** 命中结果：记录 + 可直接高亮的片段 */
export interface SearchHit {
    record: SearchRecord;
    /** 命中位置附近截取的一段文本 */
    snippet: string;
    /** snippet 内命中词起点 */
    matchStart: number;
    /** snippet 内命中词长度 */
    matchLength: number;
}

/** 按模块聚合的结果 */
export interface SearchGroup {
    module: string;
    moduleLabel: string;
    /** 该模块命中总数（可能大于 hits.length） */
    total: number;
    /** 其中「内容条目」命中数：列表页的搜索只覆盖这部分，跳过去能看到的就是这些 */
    itemTotal: number;
    /** 其中「评论」命中数 */
    commentTotal: number;
    /** 截断后的命中列表 */
    hits: SearchHit[];
}

export interface SearchOptions {
    /** 'item' 只搜内容、'comment' 只搜评论、'all' 全搜 */
    kind?: SearchKind | 'all';
    /** 每组最多返回几条，默认 8 */
    limitPerGroup?: number;
}

/** 片段命中点前后各保留的字数 */
const SNIPPET_PAD = 26;

/**
 * 截取命中位置附近的片段
 *
 * 中文按字符切即可（不涉及组合字符），命中词不区分大小写但位置要落回原文。
 */
export function snippetOf(text: string, keyword: string, pad = SNIPPET_PAD): { snippet: string; matchStart: number; matchLength: number } | null {
    const source = String(text ?? '');
    const word = String(keyword ?? '').trim();
    if (!source || !word) {
        return null;
    }
    const at = source.toLowerCase().indexOf(word.toLowerCase());
    if (at < 0) {
        return null;
    }
    const start = Math.max(0, at - pad);
    const end = Math.min(source.length, at + word.length + pad);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < source.length ? '…' : '';
    return {
        snippet: prefix + source.slice(start, end) + suffix,
        matchStart: prefix.length + (at - start),
        matchLength: word.length,
    };
}

/**
 * 在记录集合里搜索
 *
 * 纯函数，便于单测：不读盘、不碰 DOM。
 * 标题与正文都参与匹配；命中在标题上时片段取标题，否则取正文。
 */
export function searchRecords(
    records: SearchRecord[],
    keyword: string,
    options: SearchOptions = {},
): { groups: SearchGroup[]; total: number } {
    const word = String(keyword ?? '').trim();
    if (!word) {
        return { groups: [], total: 0 };
    }
    const kind = options.kind ?? 'all';
    const limit = Math.max(1, options.limitPerGroup ?? 8);
    const lowered = word.toLowerCase();
    const byModule = new Map<string, SearchGroup>();
    let total = 0;

    for (const record of records) {
        if (kind !== 'all' && record.kind !== kind) {
            continue;
        }
        const bodyHit = record.body.toLowerCase().indexOf(lowered) >= 0;
        const titleHit = record.title.toLowerCase().indexOf(lowered) >= 0;
        if (!bodyHit && !titleHit) {
            continue;
        }
        const piece = bodyHit ? snippetOf(record.body, word) : snippetOf(record.title, word);
        if (!piece) {
            continue;
        }
        total += 1;
        let group = byModule.get(record.module);
        if (!group) {
            group = {
                module: record.module,
                moduleLabel: record.moduleLabel,
                total: 0,
                itemTotal: 0,
                commentTotal: 0,
                hits: [],
            };
            byModule.set(record.module, group);
        }
        group.total += 1;
        if (record.kind === 'comment') {
            group.commentTotal += 1;
        } else {
            group.itemTotal += 1;
        }
        if (group.hits.length < limit) {
            group.hits.push({ record, ...piece });
        }
    }

    // 组按命中数降序，组内按时间倒序（越近的越可能是在找的）
    const groups = [...byModule.values()].sort((a, b) => b.total - a.total);
    for (const group of groups) {
        group.hits.sort((a, b) => b.record.time - a.record.time);
    }
    return { groups, total };
}

/** 取条目正文纯文本（限长，避免把整篇日志塞进索引） */
function textOf(value: unknown, max = 4000): string {
    const text = plainText(value);
    return text.length > max ? text.slice(0, max) : text;
}

/** 没有 `?id=` 深链的模块：命中后只能落到列表 */
const NO_DEEP_LINK = new Set(['favorites']);

/** 条目 id 的统一兜底链：不同模块的主键字段不同 */
function pickId(item: Record<string, any>, fields: string[]): string {
    for (const field of fields) {
        const value = item?.[field];
        if (value !== undefined && value !== null && String(value) !== '') {
            return String(value);
        }
    }
    return '';
}

/** 评论自身的标识：优先真实 id，缺失时用「条目 id + 序号」保证结果可定位 */
function commentKey(itemId: string, comment: Record<string, any>, index: number): string {
    return pickId(comment, ['tid', 'id', 'commentid', 'commentId']) || `${itemId}#${index}`;
}

/** 评论时间字段的回退链 */
function commentTime(comment: Record<string, any>): number {
    return timeValue(comment.postTime || comment.create_time || comment.createTime || comment.time);
}

/* ===== 各模块定义 ===== */

interface ModuleDef {
    module: string;
    label: string;
    /** 主键字段回退链 */
    idFields: string[];
    load: () => Promise<Record<string, any>[]>;
    timeOf: (item: Record<string, any>) => number;
    titleOf: (item: Record<string, any>) => string;
    bodyOf: (item: Record<string, any>) => string;
    route: string;
    /** 评论来源：默认 itemComments(item)；留言的回复挂在 replyList 上，需要单独指定 */
    commentsOf?: (item: Record<string, any>) => Record<string, any>[];
    /** 跳转参数名，默认 id（视频页用 vid） */
    queryKey?: string;
}

/** 说说/留言这类没有标题的：取正文开头当标题 */
function leadingText(text: string, max = 32): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
}

const MODULES: ModuleDef[] = [
    {
        module: 'messages',
        label: '说说',
        idFields: ['tid', 'id'],
        load: () => loadList('messages'),
        timeOf: (item) => timeValue(messagePublishTime(item)),
        titleOf: (item) => leadingText(textOf(item.content || item.custom_content)),
        bodyOf: (item) => textOf([item.content, item.custom_content, item.rt_con, locationOf(item)].filter(Boolean).join(' ')),
        route: 'messages',
    },
    {
        module: 'blogs',
        label: '日志',
        idFields: ['blogid', 'blogId', 'uniKey', 'title'],
        load: () => loadList('blogs'),
        timeOf: (item) => timeValue(articlePublishTime(item)),
        titleOf: (item) => plainText(item.title || item.custom_title),
        bodyOf: (item) => textOf(fixHtmlAssets(decodeHtml(item.custom_html || item.html), 'Blogs')),
        route: 'blogs',
    },
    {
        module: 'diaries',
        label: '日记',
        idFields: ['blogid', 'blogId', 'uniKey', 'title'],
        load: () => loadList('diaries'),
        timeOf: (item) => timeValue(articlePublishTime(item)),
        titleOf: (item) => plainText(item.title || item.custom_title),
        bodyOf: (item) => textOf(fixHtmlAssets(decodeHtml(item.custom_html || item.html), 'Diaries')),
        route: 'diaries',
    },
    {
        module: 'boards',
        label: '留言',
        idFields: ['tid', 'id'],
        load: () => loadItems('boards'),
        timeOf: (item) => timeValue(item.pubtime || item.pubTime || item.time),
        titleOf: (item) => leadingText(textOf(item.content)),
        bodyOf: (item) => textOf(item.content),
        route: 'boards',
        // 留言的「评论」就是它的回复列表
        commentsOf: (item) => (Array.isArray(item.replyList) ? item.replyList : []),
    },
    {
        module: 'shares',
        label: '分享',
        idFields: ['id', 'tid'],
        load: () => loadList('shares'),
        timeOf: (item) => timeValue(item.createTime || item.create_time || item.time),
        titleOf: (item) => leadingText(textOf(item.content || item.title || item.desc)),
        bodyOf: (item) => textOf([item.content, item.title, item.desc, item.summary].filter(Boolean).join(' ')),
        route: 'shares',
    },
    {
        module: 'videos',
        label: '视频',
        idFields: ['vid', 'uniKey', 'id'],
        load: () => loadList('videos'),
        timeOf: (item) => timeValue(item.createTime || item.create_time || item.uploadTime || item.time),
        titleOf: (item) => leadingText(textOf(item.title || item.name)),
        bodyOf: (item) => textOf([item.title, item.name, item.desc, item.custom_desc].filter(Boolean).join(' ')),
        route: 'videos',
        // 视频页的参数名是 vid（不是 id）
        queryKey: 'vid',
    },
    {
        module: 'favorites',
        label: '收藏',
        idFields: ['id', 'tid'],
        // 收藏页没有 ?id= 深链，命中后只能落到列表
        load: () => loadList('favorites'),
        timeOf: (item) => timeValue(item.createTime || item.create_time || item.time),
        titleOf: (item) => leadingText(textOf(item.content || item.title || item.desc)),
        bodyOf: (item) => textOf([item.content, item.title, item.desc, item.summary].filter(Boolean).join(' ')),
        route: 'favorites',
    },
];

/**
 * 构建全量搜索记录
 *
 * 会顺带把评论拉平成独立记录（含回复）。只保留有文本的记录，
 * 避免索引里堆一堆空正文。调用方应缓存结果（一次构建、多次搜索）。
 */
export async function buildSearchRecords(): Promise<SearchRecord[]> {
    const out: SearchRecord[] = [];

    for (const def of MODULES) {
        let items: Record<string, any>[] = [];
        try {
            items = await def.load();
        } catch {
            continue;
        }
        for (const item of items) {
            const itemId = pickId(item, def.idFields);
            const body = def.bodyOf(item);
            const title = def.titleOf(item);
            if (itemId && (body || title)) {
                out.push({
                    module: def.module,
                    moduleLabel: def.label,
                    kind: 'item',
                    itemId,
                    time: def.timeOf(item),
                    title: title || body.slice(0, 32),
                    body: body || title,
                    route: def.route,
                    // 收藏没有 ?id= 深链：不带 id，落到列表
                    query: NO_DEEP_LINK.has(def.module) ? {} : { [def.queryKey ?? 'id']: itemId },
                });
            }

            // 评论与回复（留言的评论来自 replyList，见 ModuleDef.commentsOf）
            let index = 0;
            for (const comment of (def.commentsOf ? def.commentsOf(item) : itemComments(item))) {
                const text = textOf(comment.content);
                if (text) {
                    const cid = commentKey(itemId, comment, index);
                    out.push({
                        module: def.module,
                        moduleLabel: def.label,
                        kind: 'comment',
                        itemId,
                        commentId: cid,
                        time: commentTime(comment) || def.timeOf(item),
                        title: plainText(comment.name || comment.nickname) || '评论',
                        body: text,
                        author: plainText(comment.name || comment.nickname),
                        context: leadingText(title || body, 40),
                        route: def.route,
                        query: NO_DEEP_LINK.has(def.module) ? {} : { [def.queryKey ?? 'id']: itemId, comment: cid },
                    });
                }
                const replies = comment.replyList || comment.replies || [];
                let replyIndex = 0;
                for (const reply of replies) {
                    const replyText = textOf(reply.content);
                    if (replyText) {
                        const rid = commentKey(itemId, reply, index * 1000 + replyIndex + 1);
                        out.push({
                            module: def.module,
                            moduleLabel: def.label,
                            kind: 'comment',
                            itemId,
                            commentId: rid,
                            time: commentTime(reply) || commentTime(comment) || def.timeOf(item),
                            title: plainText(reply.name || reply.nickname) || '回复',
                            body: replyText,
                            author: plainText(reply.name || reply.nickname),
                            context: leadingText(title || body, 40),
                            route: def.route,
                            query: def.module === 'favorites' ? {} : { id: itemId, comment: rid },
                        });
                    }
                    replyIndex += 1;
                }
                index += 1;
            }
        }
    }

    // 相片：只索引「有描述或有评论」的，绝大多数相片无文字，全量索引只增噪音
    try {
        const albums = await loadList('albums');
        for (const album of albums) {
            const albumId = pickId(album, ['id']);
            const albumName = plainText(album.name || album.title);
            const albumDesc = textOf(album.desc || album.custom_desc, 500);
            const albumClass = plainText(album.className);

            // 相册本身：名称 / 分组 / 描述都进索引（此前只索引了相片，相册名搜不到）
            const albumBody = textOf([albumName, albumClass, albumDesc].filter(Boolean).join(' '));
            if (albumId && albumBody) {
                out.push({
                    module: 'albums',
                    moduleLabel: '相册',
                    kind: 'item',
                    itemId: albumId,
                    time: timeValue(album.createtime || album.createTime),
                    title: albumName || '相册',
                    body: albumBody,
                    route: 'albums',
                    query: { id: albumId },
                });
            }
            for (const photo of album.photoList || []) {
                // 与 media.ts 的 MediaItem.key 保持同一规则，灯箱才能定位到这一张
                const photoKey = String(photo.lloc || photo.name || '');
                const photoName = plainText(photo.name);
                const photoDesc = textOf(photo.desc || photo.custom_desc || photo.title, 500);
                // 相片名称（多为拍摄日期）与描述一起进索引；展示时优先用描述
                const caption = textOf([photoName, photoDesc].filter(Boolean).join(' '), 500);
                const photoTime = timeValue(photo.uploadTime || photo.createTime || photo.time);
                let index = 0;
                for (const comment of itemComments(photo)) {
                    const text = textOf(comment.content);
                    if (text && albumId) {
                        out.push({
                            module: 'photos',
                            moduleLabel: '相片',
                            kind: 'comment',
                            itemId: albumId,
                            commentId: commentKey(albumId, comment, index),
                            time: commentTime(comment) || photoTime,
                            title: plainText(comment.name || comment.nickname) || '评论',
                            body: text,
                            author: plainText(comment.name || comment.nickname),
                            context: albumName ? `${albumName} · 相片评论` : '相片评论',
                            route: 'albums',
                            query: { id: albumId, ...(photoKey ? { photo: photoKey } : {}), comment: commentKey(albumId, comment, index) },
                        });
                    }
                    index += 1;
                }
                // 相片本身只在有描述时入索引（标题=相册名，正文=描述）
                if (caption && albumId) {
                    out.push({
                        module: 'photos',
                        moduleLabel: '相片',
                        kind: 'item',
                        itemId: albumId,
                        time: photoTime,
                        title: [albumName, photoDesc || photoName].filter(Boolean).join(' · ') || '相片',
                        body: caption,
                        route: 'albums',
                        query: { id: albumId, ...(photoKey ? { photo: photoKey } : {}) },
                    });
                }
            }
        }
    } catch {
        /* 相册模块缺失时跳过 */
    }

    return out;
}
