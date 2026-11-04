/**
 * 「互动最密切的人」全站聚合。
 *
 * 用于互动页入口态：本人备份下原本必须手输好友 QQ 号，这里给出互动最多的几个人，
 * 点击直接带入，解决「不知道该查谁」的门槛。
 *
 * 与 owner-target.ts 的区别：那个只统计「我 ↔ 某一个 TA」，这里是对所有出现过的人做排名。
 * 计算部分刻意拆成纯函数（collectPersonEvents / computeTopPeople），便于单测，不依赖 window.* 数据源。
 */
import { loadList, loadItems, type DataKey } from './sources';
import { likeUsers, itemComments, commentUser, commentReplies, visitorUsers } from './content';

export type InteractionKind = 'like' | 'comment' | 'visit';

export interface PersonEvent {
    uin?: string | number;
    name?: string;
    kind: InteractionKind;
}

export interface TopPerson {
    key: string;
    /** 无 uin 时为空串：无法带入 QQ 号，入口态禁用点击 */
    uin: string;
    name: string;
    /** 互动分 = 点赞 + 评论，**仅用它排名** */
    score: number;
    likes: number;
    comments: number;
    /**
     * 出现在多少条内容的「最近访客」名单里；只作附注展示，不参与排名。
     * 原因：访客名单是最近窗口采样、且按人去重，既不是访问次数也不完整，
     * 与点赞/评论（事件计数）口径不同，等权混入会让人气榜失真。
     */
    visits: number;
}

/** 从条目里收集所有出现过的人：点赞、评论及其回复、访客 */
export function collectPersonEvents(items: Record<string, any>[]): PersonEvent[] {
    const events: PersonEvent[] = [];
    for (const item of items || []) {
        for (const u of likeUsers(item)) {
            events.push({ uin: u.uin, name: u.name, kind: 'like' });
        }
        for (const comment of itemComments(item)) {
            const author = commentUser(comment);
            events.push({ uin: author.uin, name: author.name, kind: 'comment' });
            for (const reply of commentReplies(comment)) {
                const ru = commentUser(reply);
                events.push({ uin: ru.uin, name: ru.name, kind: 'comment' });
            }
        }
        for (const v of visitorUsers(item)) {
            events.push({ uin: v.uin, name: v.name, kind: 'visit' });
        }
    }
    return events;
}

/**
 * 按 uin 聚合出互动最多的人。
 * - 排除空间主人与备份操作者（由调用方传入 exclude）
 * - 无 uin 的匿名记录按名字归并，可能误合并同名；这类结果 uin 为空、不可点击进入互动页
 * - 同分时按 key 稳定排序，避免每次打开顺序抖动
 */
export function computeTopPeople(events: PersonEvent[], exclude: Set<string>, limit = 5): TopPerson[] {
    const map = new Map<string, TopPerson>();
    for (const e of events) {
        const uin = e.uin === undefined || e.uin === null || e.uin === '' ? '' : String(e.uin);
        const key = uin ? `u:${uin}` : e.name ? `n:${String(e.name)}` : '';
        if (!key || (uin && exclude.has(uin))) continue;

        const row = map.get(key) || {
            key, uin, name: '', score: 0, likes: 0, comments: 0, visits: 0,
        };
        if (!row.name && e.name) row.name = String(e.name);
        if (e.kind === 'like') row.likes++;
        else if (e.kind === 'comment') row.comments++;
        else row.visits++;
        row.score = row.likes + row.comments;
        map.set(key, row);
    }
    return [...map.values()]
        // 只按「赞 + 评论」排名：访客是浏览行为且为采样名单，纯浏览者（score=0）不进榜
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
        .slice(0, Math.max(0, limit));
}

/** 全站聚合：7 个内容模块 + 留言 + 各相册的相片 */
export async function loadTopPeople(user: Record<string, any> | null): Promise<TopPerson[]> {
    const keys: DataKey[] = ['messages', 'blogs', 'diaries', 'videos', 'shares', 'favorites'];
    const items: Record<string, any>[] = [];
    for (const key of keys) {
        items.push(...(await loadList(key)));
    }
    items.push(...(await loadItems('boards')));
    for (const album of await loadList('albums')) {
        items.push(...(album.photoList || []));
    }

    const exclude = new Set(
        [user?.uin, user?.ownerUin]
            .filter((v) => v !== undefined && v !== null && v !== '')
            .map(String),
    );
    return computeTopPeople(collectPersonEvents(items), exclude);
}
