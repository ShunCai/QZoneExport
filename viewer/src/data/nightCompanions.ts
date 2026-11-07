/**
 * 深夜对话（0–5 点里「有来有往」的互动）
 *
 * 早先做过一版叫「深夜陪我的人」，但那只是「谁在深夜留过言」——单向的，称不上「陪」。
 * 这里改成**同一线程内双方都在深夜发过言**才算一次对话：
 * TA 在 0–5 点评论/留言，我也在同一条内容里于 0–5 点回复过。
 * 只有真正聊起来的那几次才算，样本会少很多，但语义站得住。
 *
 * 线程 = 一条说说（含其评论与回复）或一条留言（含其回复）。
 * 只统计带时间戳的内容；点赞没有时间戳，不参与。
 */
import { loadItems } from './sources';
import { commentReplies, commentUser, itemComments } from './content';
import { timeValue } from './format';
import { friendRemarks, preferRemarks } from './friendNames';

export interface NightDialog {
    uin: string;
    name: string;
    /** 深夜对话的线程数 */
    count: number;
    /** 双方深夜发言里最晚的那一次（毫秒） */
    latest: number;
}

/** 是否属于深夜：0 ≤ hour < 5（5 点算早，与 NightOwlPanel 同口径） */
export function isLateNight(ms: number): boolean {
    if (!ms) return false;
    const hour = new Date(ms).getHours();
    return hour >= 0 && hour < 5;
}

/** 深夜时刻文案：03:12 */
export function clockOf(ms: number): string {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeOfComment(comment: Record<string, any>): number {
    return timeValue(comment.postTime || comment.create_time || comment.time);
}

/**
 * 逐线程判定「双方都在深夜说过话」
 * @param meUin 我（备份操作者）的 uin：只有我也在深夜发言，这条线程才算「对话」
 * @param exclude 排除空间主人与备份操作者自身
 */
export function collectNightDialogs(
    sources: { messages: Record<string, any>[]; boards: Record<string, any>[] },
    meUin: string,
    exclude: Set<string>,
    limit = 5,
): NightDialog[] {
    const me = String(meUin ?? '');
    const map = new Map<string, NightDialog>();

    /** 一条线程里收集到的发言 → 只有我也在深夜说过话时，才把对方记一次对话 */
    const collectThread = (speakers: { uin: string; name: string; time: number }[]): void => {
        const myLatest = speakers
            .filter((s) => s.uin === me && isLateNight(s.time))
            .reduce((max, s) => Math.max(max, s.time), 0);
        if (!myLatest) return; // 我没在深夜参与这条线程 → 不算对话

        const seen = new Set<string>();
        for (const speaker of speakers) {
            if (speaker.uin === me || exclude.has(speaker.uin) || !isLateNight(speaker.time)) continue;
            const row = map.get(speaker.uin) ?? { uin: speaker.uin, name: '', count: 0, latest: 0 };
            if (!row.name && speaker.name) row.name = speaker.name;
            // 同一线程同一个人只算一次对话，但最晚时间要取更大值
            if (!seen.has(speaker.uin)) {
                seen.add(speaker.uin);
                row.count += 1;
            }
            row.latest = Math.max(row.latest, speaker.time, myLatest);
            map.set(speaker.uin, row);
        }
    };

    for (const msg of sources.messages || []) {
        const speakers: { uin: string; name: string; time: number }[] = [];
        for (const comment of itemComments(msg)) {
            const author = commentUser(comment);
            const uin = author.uin === undefined || author.uin === null ? '' : String(author.uin);
            if (uin) speakers.push({ uin, name: String(author.name ?? ''), time: timeOfComment(comment) });
            for (const reply of commentReplies(comment)) {
                const ru = commentUser(reply);
                const rUin = ru.uin === undefined || ru.uin === null ? '' : String(ru.uin);
                if (rUin) speakers.push({ uin: rUin, name: String(ru.name ?? ''), time: timeOfComment(reply) });
            }
        }
        collectThread(speakers);
    }

    for (const board of sources.boards || []) {
        const speakers: { uin: string; name: string; time: number }[] = [];
        const boardUin = board.uin === undefined || board.uin === null ? '' : String(board.uin);
        if (boardUin) {
            speakers.push({
                uin: boardUin,
                name: String(board.nickname || board.name || ''),
                time: timeValue(board.pubtime || board.pubTime),
            });
        }
        for (const reply of board.replyList || []) {
            const rUin = reply.uin === undefined || reply.uin === null ? '' : String(reply.uin);
            if (rUin) {
                speakers.push({
                    uin: rUin,
                    name: String(reply.nickname || reply.name || ''),
                    time: timeValue(reply.time || reply.pubtime),
                });
            }
        }
        collectThread(speakers);
    }

    return [...map.values()]
        .sort((a, b) => b.count - a.count || b.latest - a.latest)
        .slice(0, Math.max(0, limit));
}

/** 全站聚合：深夜对话最多的几个人（他人空间里对象只有空间主人一个，故只用于本人空间） */
export async function loadNightDialogs(
    user: Record<string, any> | null,
    limit = 5,
): Promise<NightDialog[]> {
    if (!user) return [];
    const me = String(user.ownerUin ?? user.uin ?? '');
    const exclude = new Set(
        [user.uin, user.ownerUin]
            .filter((v) => v !== undefined && v !== null && v !== '')
            .map(String),
    );
    const [messages, boards, remarks] = await Promise.all([
        loadItems('messages'),
        loadItems('boards'),
        friendRemarks(),
    ]);
    return preferRemarks(collectNightDialogs({ messages, boards }, me, exclude, limit), remarks);
}
