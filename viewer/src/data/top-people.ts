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
import { friendRemarks, preferRemarks } from './friendNames';
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
 * 按 uin 聚合、排序，但**不截断**。
 *
 * 拆出来的原因：「TOP5」与「特别关心某人的互动分」读的是同一份聚合结果——
 * 后者需要按 uin 回查分数，若只拿截断后的 5 条就查不到排在 23 名的关心好友。
 * - 排除空间主人与备份操作者（由调用方传入 exclude）
 * - 无 uin 的匿名记录按名字归并，可能误合并同名；这类结果 uin 为空、不可点击进入互动页
 * - 同分时按 key 稳定排序，避免每次打开顺序抖动
 */
export function rankPeople(events: PersonEvent[], exclude: Set<string>): TopPerson[] {
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
        .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/** 互动最多的人（默认前 5） */
export function computeTopPeople(events: PersonEvent[], exclude: Set<string>, limit = 5): TopPerson[] {
    return rankPeople(events, exclude).slice(0, Math.max(0, limit));
}

/** 「特别关心」最多列几位：再多会把下方的 QQ 号输入框挤出视口 */
export const CARE_LIMIT = 8;

/** 特别关心好友（来自好友列表，与互动量无关） */
export interface CareFriend {
    key: string;
    uin: string;
    name: string;
    /** 互动分（赞 + 评论）；0 表示对方没在空间留下痕迹 */
    score: number;
    likes: number;
    comments: number;
}

/**
 * 从好友列表里挑出「特别关心」的人，并把互动分补上。
 *
 * 为什么单独取而不是混进 TOP 榜：关心是「我在意谁」，互动是「谁留痕多」，
 * 两条信号独立。实测某个备份里 3 位关心好友排在全站第 23/86/108 名，
 * 靠加长榜单（TOP10）永远轮不到，只能单独列出。
 *
 * - 排除空间主人与备份操作者（同 rankPeople 的 exclude）
 * - 备注优先于昵称：用户自己起的备注才是他认得出的名字
 * - 按互动分降序、同分按名字稳定排序
 */
export function collectCareFriends(
    friends: Record<string, any>[],
    ranked: TopPerson[],
    exclude: Set<string>,
): CareFriend[] {
    const byUin = new Map(ranked.map((row) => [row.uin, row]));
    const seen = new Set<string>();
    const rows: CareFriend[] = [];
    for (const friend of friends || []) {
        if (!friend || friend.care !== true || friend.isMe) continue;
        const uin = friend.uin === undefined || friend.uin === null ? '' : String(friend.uin);
        if (!uin || exclude.has(uin) || seen.has(uin)) continue;
        seen.add(uin);
        const hit = byUin.get(uin);
        rows.push({
            key: `u:${uin}`,
            uin,
            name: String(friend.remark || friend.nick || friend.name || ''),
            score: hit?.score ?? 0,
            likes: hit?.likes ?? 0,
            comments: hit?.comments ?? 0,
        });
    }
    return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN') || a.uin.localeCompare(b.uin));
}

/**
 * 拆分关心名单：已进 TOP5 的人从关心组去掉（改在 TOP5 行挂「关心」标签），
 * 其余按上限截断，并算出没列出的数量用于「还有 N 位」提示。
 */
export function splitCareSelection(
    allCare: CareFriend[],
    topUins: Set<string>,
    careLimit = CARE_LIMIT,
): { care: CareFriend[]; careHidden: number } {
    const rest = allCare.filter((row) => !topUins.has(row.uin));
    const care = rest.slice(0, Math.max(0, careLimit));
    return { care, careHidden: rest.length - care.length };
}

/** 互动页入口态需要的两份名单 + 它们的关系 */
export interface InteractionSelection {
    /** 互动最多的人（默认前 5） */
    top: TopPerson[];
    /** 特别关心好友中「没进 top」的部分，最多 careLimit 位 */
    care: CareFriend[];
    /** 因超出上限未列出的关心好友数，用于「还有 N 位」提示 */
    careHidden: number;
    /** 全部关心好友的 uin：给 top 行挂「关心」标签用（不因去重丢失） */
    careUins: Set<string>;
}

/** 全站聚合的数据源：6 个内容模块 + 留言 + 各相册的相片 */
async function loadInteractionItems(): Promise<Record<string, any>[]> {
    const keys: DataKey[] = ['messages', 'blogs', 'diaries', 'videos', 'shares', 'favorites'];
    const items: Record<string, any>[] = [];
    for (const key of keys) {
        items.push(...(await loadList(key)));
    }
    items.push(...(await loadItems('boards')));
    for (const album of await loadList('albums')) {
        items.push(...(album.photoList || []));
    }
    return items;
}

/** 排除空间主人与备份操作者本人（自己给自己点赞/评论不算互动） */
function excludeOf(user: Record<string, any> | null): Set<string> {
    return new Set(
        [user?.uin, user?.ownerUin]
            .filter((v) => v !== undefined && v !== null && v !== '')
            .map(String),
    );
}

/** 互动页入口态：互动最多的人 + 特别关心好友，共用一次全站聚合 */
export async function loadInteractionSelection(
    user: Record<string, any> | null,
    topLimit = 5,
    careLimit = CARE_LIMIT,
): Promise<InteractionSelection> {
    if (!user) {
        return { top: [], care: [], careHidden: 0, careUins: new Set() };
    }
    const exclude = excludeOf(user);
    const remarks = await friendRemarks();
    const ranked = preferRemarks(rankPeople(collectPersonEvents(await loadInteractionItems()), exclude), remarks);
    const top = ranked.slice(0, Math.max(0, topLimit));

    const allCare = collectCareFriends(await loadList('friends'), ranked, exclude);
    const topUins = new Set(top.map((row) => row.uin));
    const { care, careHidden } = splitCareSelection(allCare, topUins, careLimit);
    return {
        top,
        care,
        careHidden,
        careUins: new Set(allCare.map((row) => row.uin)),
    };
}

/** 全站聚合：只取互动最多的人（概览页那张卡用它） */
export async function loadTopPeople(user: Record<string, any> | null): Promise<TopPerson[]> {
    if (!user) {
        return [];
    }
    const exclude = excludeOf(user);
    const remarks = await friendRemarks();
    return preferRemarks(computeTopPeople(collectPersonEvents(await loadInteractionItems()), exclude), remarks);
}
