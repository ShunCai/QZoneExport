/**
 * 文字量构成（按模块统计正文字数）
 *
 * 与「内容构成」互补：那张卡数的是「条数」，这张数的是「字数」——
 * 留言通常条数多但每条短，日志条数少却篇幅长，两个维度一起看才知道内容到底长什么样。
 *
 * 两个刻意的取舍：
 * 1. **不复用 `summary.rawBodyOf`**：它是为「一行摘要」设计的，字段优先级里 title 在前；
 *    日志/日记的正文字段是 html，用它会只数到标题（实测日志 4.1 万字被算成 282 字）。
 *    这里按模块单独列正文字段，标题一律不算。
 * 2. **不用 `plainText` 逐层剥**：那套十几次 replace 在 1.4 万条留言的 HTML 上要 800ms+。
 *    计数不需要中间结果，一个合并了所有「噪声」的正则替换一次即可（实测降到 60ms 级）。
 */
import { loadItems } from './sources';
import { MODULE_LABEL } from './summary';

export interface WordCountRow {
    key: string;
    label: string;
    chars: number;
}

export interface WordCounts {
    /** 所有模块字数之和 */
    total: number;
    /** 只保留有字的模块，按字数降序 */
    rows: WordCountRow[];
}

/** 各模块的**正文**字段（不含 title）：按顺序取第一个非空的 */
const BODY_FIELDS: Record<string, string[]> = {
    messages: ['content', 'custom_content'],
    blogs: ['html', 'abstract', 'content'],
    diaries: ['html', 'content'],
    boards: ['htmlContent', 'ubbContent', 'content'],
    shares: ['desc', 'content'],
};

/** 参与统计的模块：只有这些模块有「正文」 */
export const WORD_MODULES = ['messages', 'blogs', 'diaries', 'boards', 'shares'] as const;

/**
 * 计入「非文字」的部分，一次替换掉：
 * 表情 / UBB 图片 / UBB 视频 / 其余 BBCode / HTML 标签 / HTML 实体 / 空白
 */
const NOISE = /\[em\]e\d+\[\/em\]|\[img[^\]]*\][\s\S]*?\[\/img\]|\[video[^\]]*\][\s\S]*?\[\/video\]|\[\/?[a-zA-Z][^\]]*\]|<[^>]*>|&[a-zA-Z#0-9]+;|\s/g;

/** 正文字数：剥掉标记与空白后按字符（非字节）计数 */
export function countChars(value: unknown): number {
    const raw = String(value ?? '');
    return raw ? raw.replace(NOISE, '').length : 0;
}

/** 取该模块的正文（第一个非空字段），标题不算 */
export function bodyOf(key: string, item: Record<string, any>): string {
    for (const field of BODY_FIELDS[key] ?? []) {
        const value = item?.[field];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value);
        }
    }
    return '';
}

/** 把一批条目按正文汇总成一行 */
export function sumChars(key: string, items: Record<string, any>[]): WordCountRow {
    let chars = 0;
    for (const item of items || []) {
        chars += countChars(bodyOf(key, item));
    }
    return { key, label: MODULE_LABEL[key] ?? key, chars };
}

/** 各模块正文字数（过滤掉 0 字模块，按字数降序） */
export async function loadWordCounts(): Promise<WordCounts> {
    const rows: WordCountRow[] = [];
    for (const key of WORD_MODULES) {
        const row = sumChars(key, await loadItems(key));
        if (row.chars > 0) {
            rows.push(row);
        }
    }
    rows.sort((a, b) => b.chars - a.chars);
    return { total: rows.reduce((sum, row) => sum + row.chars, 0), rows };
}
