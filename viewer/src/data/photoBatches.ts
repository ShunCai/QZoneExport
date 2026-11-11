import { timeValue } from './format';

/**
 * 相片按「上传批次」归并
 *
 * QQ 相片自带 `batchId`（一次批量上传共用一个，通常是毫秒时间戳），比按上传时间猜批次准得多：
 * 实测一份备份里 1 小时窗口归并出的 480 批中，有 42 批混进了 2 个以上不同的 batchId。
 *
 * 但 batchId 有两个坑：
 *  - 老相片 / 单张上传常是 `0` 或空（这份备份 6402 张里 875 张如此），这些必须退回时间窗口；
 *  - 极少数 id 被复用，组内时间能跨好几年，不能整组并成一条动态。
 *
 * 所以规则是：有有效 batchId 的按 id 归并（组内跨度超阈值再切开），没有的按时间窗口归并，
 * 两类互不混合；最后按每组首张的时间排序。纯函数，便于单测。
 */
export interface PhotoBatchOptions {
    /** 无有效 batchId 时的归并窗口（毫秒，默认 1 小时） */
    windowMs?: number;
    /** 同一 batchId 允许的最大时间跨度（毫秒，默认 24 小时），超过就拆开 */
    maxSpanMs?: number;
}

/** 有效批次 id：'0' / 空 / 字符串化的 null 都视为「没有批次」 */
export function photoBatchId(photo: Record<string, any>): string {
    const raw = String(photo?.batchId ?? '').trim();
    if (!raw || raw === '0' || raw === 'null' || raw === 'undefined') {
        return '';
    }
    return raw;
}

export function groupPhotoBatches<T extends Record<string, any>>(
    photos: T[],
    timeOf: (photo: T) => any,
    options: PhotoBatchOptions = {},
): T[][] {
    const windowMs = options.windowMs ?? 3600 * 1000;
    const maxSpanMs = options.maxSpanMs ?? 24 * 3600 * 1000;

    interface Row { photo: T; ts: number }
    const rows: Row[] = [];
    for (const photo of photos) {
        const ts = timeValue(timeOf(photo));
        if (ts) {
            rows.push({ photo, ts });
        }
    }
    rows.sort((a, b) => a.ts - b.ts);

    const byId = new Map<string, Row[]>();
    const noId: Row[] = [];
    for (const row of rows) {
        const id = photoBatchId(row.photo);
        if (!id) {
            noId.push(row);
            continue;
        }
        const list = byId.get(id);
        if (list) {
            list.push(row);
        } else {
            byId.set(id, [row]);
        }
    }

    const groups: T[][] = [];
    // 有 id：整组一批，只有跨度异常（复用 id / 跨年）才按窗口切开
    for (const list of byId.values()) {
        let part: T[] = [];
        let start = 0;
        for (const row of list) {
            if (part.length === 0) {
                part = [row.photo];
                start = row.ts;
            } else if (row.ts - start <= maxSpanMs) {
                part.push(row.photo);
            } else {
                groups.push(part);
                part = [row.photo];
                start = row.ts;
            }
        }
        if (part.length) {
            groups.push(part);
        }
    }

    // 无 id：沿用原来的「批首时间 + 窗口」归并
    let part: T[] = [];
    let start = 0;
    for (const row of noId) {
        if (part.length === 0) {
            part = [row.photo];
            start = row.ts;
        } else if (row.ts - start <= windowMs) {
            part.push(row.photo);
        } else {
            groups.push(part);
            part = [row.photo];
            start = row.ts;
        }
    }
    if (part.length) {
        groups.push(part);
    }

    groups.sort((a, b) => timeValue(timeOf(a[0]!)) - timeValue(timeOf(b[0]!)));
    return groups;
}
