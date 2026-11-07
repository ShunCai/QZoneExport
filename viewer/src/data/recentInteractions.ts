/**
 * 最近互动（本人空间概览用）
 *
 * 本人空间备份没有「我 ↔ TA」可言（owner === target），概览里原本只有「互动最多的人」这张人榜，
 * 没有任何「最近发生了什么」的信息。这条事件流补上这个缺口：最近几条别人在我空间留下的
 * 评论 / 回复 / 留言。
 *
 * 口径限制：**点赞没有时间戳**（likeUsers 只有 uin/nick），所以点赞进不了这条时间线；
 * 卡片的说明里要写清，否则会被当成「最近互动只有这几条」。
 */
import { loadItems } from './sources';
import { commentReplies, commentUser, itemComments } from './content';
import { summaryOf } from './summary';
import { timeValue } from './format';
import { friendRemarks, preferRemarks } from './friendNames';

export type RecentKind = 'comment' | 'reply' | 'board';

export interface RecentInteraction {
    /** 毫秒时间戳（用于排序；展示时再格式化） */
    time: number;
    kind: RecentKind;
    /** 发表人 */
    uin: string;
    name: string;
    /** 事件对象摘要：评论/回复取所在记录的摘要，留言取留言内容摘要 */
    snippet: string;
}

const KIND_ACTION: Record<RecentKind, string> = {
    comment: '评论',
    reply: '回复',
    board: '留言',
};

/**
 * 摘要清洗：`plainText` 只剥 BBCode，不认 `@{uin:123,nick:某某}` 这种提及 token，
 * 不清掉会在卡片上直接露出 `@{uin:1129136924,nick:吕顺才,...}`。
 */
function cleanSnippet(text: string): string {
    return text.replace(/@\{uin:[^}]*?,nick:([^},]*)[^}]*\}/g, (_m, nick: string) => `@${nick || '某人'}`);
}

export function actionOf(kind: RecentKind): string {
    return KIND_ACTION[kind];
}

/** 时间字段：评论/回复用 postTime 或 create_time，留言用 pubtime（都可能是秒或毫秒） */
function timeOfComment(comment: Record<string, any>): number {
    return timeValue(comment.postTime || comment.create_time || comment.time);
}

function timeOfBoard(board: Record<string, any>): number {
    return timeValue(board.pubtime || board.pubTime);
}

/**
 * 从各模块条目里挑出最近的互动事件（纯函数，便于单测）
 *
 * @param exclude 需要排除的 uin（空间主人与备份操作者：自己给自己的互动不算「最近互动」）
 */
export function pickRecentInteractions(
    sources: { messages: Record<string, any>[]; boards: Record<string, any>[] },
    exclude: Set<string>,
    limit = 5,
): RecentInteraction[] {
    const rows: RecentInteraction[] = [];

    const push = (kind: RecentKind, user: { uin?: string | number; name?: string }, time: number, snippet: string): void => {
        const uin = user?.uin === undefined || user?.uin === null ? '' : String(user.uin);
        if (!uin || exclude.has(uin) || !time) return;
        rows.push({
            time,
            kind,
            uin,
            name: String(user?.name ?? ''),
            snippet: snippet || '',
        });
    };

    /**
     * 一条互动自己的内容摘要；空内容时退到所在记录的摘要（纯表情、纯图片的评论）。
     * 注意先 `cleanSnippet` 再 `summaryOf`——后者会按 max 截断，被截断的 token 缺右花括号就清不掉了。
     */
    const snippetOf = (content: unknown, fallback: string): string => {
        const own = summaryOf('messages', { content: cleanSnippet(String(content ?? '')) }, 24);
        return own && own !== '无内容' ? own : fallback;
    };

    for (const msg of sources.messages || []) {
        const subject = summaryOf('messages', { content: cleanSnippet(String(msg.content ?? '')) }, 24);
        for (const comment of itemComments(msg)) {
            push('comment', commentUser(comment), timeOfComment(comment), snippetOf(comment.content, subject));
            for (const reply of commentReplies(comment)) {
                push('reply', commentUser(reply), timeOfComment(reply), snippetOf(reply.content, subject));
            }
        }
    }

    for (const board of sources.boards || []) {
        push(
            'board',
            { uin: board.uin, name: board.nickname || board.name },
            timeOfBoard(board),
            summaryOf('boards', {
                htmlContent: cleanSnippet(String(board.htmlContent ?? '')),
                ubbContent: cleanSnippet(String(board.ubbContent ?? '')),
                content: cleanSnippet(String(board.content ?? '')),
            }, 24),
        );
    }

    return rows
        .sort((a, b) => b.time - a.time)
        .slice(0, Math.max(0, limit));
}

/** 全站聚合：最近 N 条评论 / 回复 / 留言（排除自己） */
export async function loadRecentInteractions(
    user: Record<string, any> | null,
    limit = 5,
): Promise<RecentInteraction[]> {
    if (!user) return [];
    const exclude = new Set(
        [user.uin, user.ownerUin]
            .filter((v) => v !== undefined && v !== null && v !== '')
            .map(String),
    );
    const [messages, boards, remarks] = await Promise.all([
        loadItems('messages'),
        loadItems('boards'),
        // 评论人优先显示好友备注（我给他起的名字比他自己昵称更好认）
        friendRemarks(),
    ]);
    return preferRemarks(pickRecentInteractions({ messages, boards }, exclude, limit), remarks);
}
