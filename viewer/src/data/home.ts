import { loadItems, loadList } from './sources';
import { YEAR_MODULES, PHOTO_TIME_FIELDS, isFeedAlbum } from './counts';
import { formatTime, timeValue, isValidTimestampMs } from './format';
import { likeTotal } from './content';
import { snippet, messageSummary, deepLinkOf } from './rankings';
import { plainText, summaryOf } from './summary';

export interface TopMemory {
    title: string;
    detail: string;
    /** 点开后跳转的页面与定位参数（无对应单条记录时留空，如「连续打卡」） */
    route?: string;
    query?: Record<string, string>;
}

export interface HomeMemoriesData {
    top: TopMemory[];
}

function commentsOf(item: Record<string, any>): Record<string, any>[] {
    const list = item.custom_comments || item.comments;
    return Array.isArray(list) ? list : [];
}

type NightKing = { key: string; item: Record<string, any>; albumId?: string };

function dayOf(ts: number): string {
    return formatTime(ts).slice(0, 10);
}

/**
 * 「回忆之最」（minis 已迁到 #/memories 完整清单页）。
 * 口径：说说取 messages；日志取 blogs + diaries；相册排除「说说和日志相册」；
 * 深夜为 0–5 点（与「深夜动态」面板同口径）；连续打卡按「有内容的自然日」去重后求最长连续天数。
 */
export async function loadHomeMemories(): Promise<HomeMemoriesData> {
    const [messages, blogs, diaries, videos, boards, shares, favorites, albums, visitors] = await Promise.all([
        loadItems('messages'),
        loadItems('blogs'),
        loadItems('diaries'),
        loadItems('videos'),
        loadItems('boards'),
        loadItems('shares'),
        loadItems('favorites'),
        loadList('albums'),
        loadItems('visitors'),
    ]);

    let hot: { item: Record<string, any>; score: number } | null = null;
    for (const item of messages) {
        const score = likeTotal(item) + commentsOf(item).length;
        if (!hot || score > hot.score) hot = { item, score };
    }

    let longest: { item: Record<string, any>; len: number; route: string } | null = null;
    for (const [route, list] of [['blogs', blogs], ['diaries', diaries]] as const) {
        for (const item of list) {
            // 日志/日记的正文在 html 里（blog 另有 abstract 摘要），content 字段始终为空
            const text = String(item.html || item.abstract || item.content || item.custom_html || '')
                .replace(/<[^>]+>/g, '');
            const len = text.length;
            if (!longest || len > longest.len) longest = { item, len, route };
        }
    }

    const realAlbums = albums.filter((album) => !isFeedAlbum(album));
    let busiest: Record<string, any> | null = null;
    for (const album of realAlbums) {
        const count = (album.photoList || []).length;
        if (!busiest || count > (busiest.photoList || []).length) busiest = album;
    }

    const groups: Record<string, Record<string, any>[]> = {
        messages, blogs, diaries, videos, boards, shares, favorites, visitors,
    };

    /**
     * 深夜口径与「深夜动态」面板一致：7 个内容模块 + 访客 + 相册相片（自动归档相册除外）。
     * 「最晚」按一天内时刻比较（04:58 比 00:30 晚），并记录该记录所属模块，
     * 这样跳转目标才会跟着真实模块走，而不是一律打开说说。
     */
    let nightCount = 0;
    // 用对象容器保存：闭包内赋值时 TS 能正确保留类型，直接 let 会被窄化成 never
    const nightState: { king: (NightKing & { ts: number; minutes: number }) | null } = { king: null };

    function considerNight(key: string, item: Record<string, any>, rawTime: any, albumId?: string): void {
        const ts = timeValue(rawTime);
        if (!isValidTimestampMs(ts)) return;
        const date = new Date(ts);
        const hour = date.getHours();
        if (hour < 0 || hour >= 5) return;
        nightCount++;
        const minutes = hour * 60 + date.getMinutes();
        if (!nightState.king || minutes > nightState.king.minutes) {
            nightState.king = { key, item, albumId, ts, minutes };
        }
    }

    for (const mod of YEAR_MODULES) {
        for (const item of groups[mod.key] || []) considerNight(mod.key, item, mod.timeOf(item));
    }
    for (const item of visitors) considerNight('visitors', item, item.time);
    for (const album of realAlbums) {
        for (const photo of album.photoList || []) {
            considerNight('photos', photo, PHOTO_TIME_FIELDS.timeOf(photo), album.id ? String(album.id) : undefined);
        }
    }

    const days = new Set<string>();
    for (const mod of YEAR_MODULES) {
        for (const item of groups[mod.key] || []) {
            const ts = timeValue(mod.timeOf(item));
            if (isValidTimestampMs(ts)) days.add(dayOf(ts));
        }
    }
    for (const album of realAlbums) {
        for (const photo of album.photoList || []) {
            const ts = timeValue(PHOTO_TIME_FIELDS.timeOf(photo));
            if (isValidTimestampMs(ts)) days.add(dayOf(ts));
        }
    }
    let bestStreak = 0;
    let currentStreak = 0;
    let prevDay = 0;
    for (const day of [...days].sort()) {
        const ts = new Date(`${day}T00:00:00`).getTime();
        if (!Number.isFinite(ts)) continue;
        if (prevDay && ts - prevDay === 86400000) currentStreak++;
        else currentStreak = 1;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
        prevDay = ts;
    }

    const top: TopMemory[] = [];
    if (hot && hot.score > 0) {
        top.push({
            title: '最热闹的说说',
            detail: `${messageSummary(hot.item)} · ${likeTotal(hot.item)} 赞 · ${commentsOf(hot.item).length} 评论`,
            route: 'messages',
            query: { from: 'home', ...(hot.item.tid ? { id: String(hot.item.tid) } : {}) },
        });
    }
    if (longest && longest.len > 0) {
        const lengthText = longest.len >= 10000
            ? `${(longest.len / 10000).toFixed(1)} 万字`
            : `${longest.len} 字`;
        const blogId = longest.item.blogid || longest.item.blogId || longest.item.uniKey;
        top.push({
            title: '最长的一篇日志',
            detail: `${lengthText} · ${summaryOf(longest.route, longest.item, 20)}`,
            route: longest.route,
            query: { from: 'home', ...(blogId ? { id: String(blogId) } : {}) },
        });
    }
    if (busiest && (busiest.photoList || []).length > 0) {
        const albumName = plainText(busiest.name || busiest.title || '');
        top.push({
            title: '最热闹的一个相册',
            detail: `「${albumName ? (albumName.length > 16 ? albumName.slice(0, 16) + '…' : albumName) : '未命名相册'}」${(busiest.photoList || []).length} 张`,
            route: 'albums',
            query: { from: 'home', ...(busiest.id ? { id: String(busiest.id) } : {}) },
        });
    }
    if (nightCount > 0 && nightState.king) {
        // 「王」比的是熬得多晚：取一天内时刻最晚的那条，而不是条数最多
        const king = nightState.king;
        const latestText = formatTime(king.ts);
        top.push({
            title: '深夜发文之王',
            detail: `凌晨 ${latestText.slice(11, 16)} · ${latestText.slice(0, 10)} · 共 ${nightCount} 条`,
            ...deepLinkOf(king.key, king.item, king.albumId),
        });
    }
    if (bestStreak >= 2) {
        // 口径：全部模块（含相片）按自然日去重后的最长连续天数，即「整个空间」而非单模块
        top.push({ title: '连续打卡最久', detail: `连续 ${bestStreak} 天 · 全空间都有更新` });
    }

    return { top: top.slice(0, 5) };
}
