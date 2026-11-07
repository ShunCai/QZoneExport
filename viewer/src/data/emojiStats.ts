/**
 * 最常用的表情
 *
 * 表达习惯是最有个人色彩的一类统计：早年爱用「偷笑 / 害羞 / 流泪」，后来改用大表情包，
 * 一眼就能看出表达方式随年份变化。数据全在正文 token 里（`[em]e120[/em]`），
 * 表情图片本来就随备份下载在 `Common/images/`，不需要联网。
 *
 * 只数说说（正文 + 评论 + 回复）与留言（正文 + 回复）——
 * 这两处是「我写的字」密度最高的地方；日志/日记正文里的表情极少，忽略以求快。
 */
import { loadItems } from './sources';
import { commentReplies, itemComments } from './content';

export interface EmojiCount {
    /** QQ 表情编号（e120 → '120'） */
    id: string;
    count: number;
}

const EMOJI_RE = /\[em\]e(\d+)\[\/em\]/gi;

/** 从一段文本里累加表情次数（就地写入 counts） */
export function scanEmoji(text: unknown, counts: Map<string, number>): void {
    const raw = String(text ?? '');
    if (!raw) return;
    EMOJI_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMOJI_RE.exec(raw)) !== null) {
        const id = match[1]!;
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
}

/** 取次数最高的前 N 个，同次数按编号稳定排序（避免每次打开顺序抖动） */
export function topEmojis(counts: Map<string, number>, limit = 6): EmojiCount[] {
    return [...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, limit));
}

/** 全站统计：说说正文/评论/回复 + 留言正文/回复 */
export async function loadEmojiStats(limit = 6): Promise<{ rows: EmojiCount[]; total: number }> {
    const [messages, boards] = await Promise.all([loadItems('messages'), loadItems('boards')]);
    const counts = new Map<string, number>();

    for (const msg of messages) {
        scanEmoji(msg.content, counts);
        for (const comment of itemComments(msg)) {
            scanEmoji(comment.content, counts);
            for (const reply of commentReplies(comment)) {
                scanEmoji(reply.content, counts);
            }
        }
    }
    for (const board of boards) {
        // 留言正文在 htmlContent 里已经是渲染后的 <img>，没有 [em] token；
        // 必须优先读 ubbContent（token 形态），否则留言的表情全被漏掉（实测少算 700+ 次）
        scanEmoji(board.ubbContent || board.htmlContent, counts);
        for (const reply of board.replyList || []) {
            scanEmoji(reply.ubbContent || reply.content || reply.htmlContent, counts);
        }
    }

    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    return { rows: topEmojis(counts, limit), total };
}
