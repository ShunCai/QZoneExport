/**
 * 空间动态 / 时间轴
 *
 * 汇集所有模块（说说、日志、日记、相册/相片、视频、留言、分享、收藏）的内容，
 * 按发表时间/上传时间统一排序，支持按模块过滤。
 *
 * 相片批量归类：优先按相片自带的 batchId（同一批上传）合并，老相片没有批次号时
 * 才退回相邻 1 小时时间窗口；描述取该批相片共同描述（全相同则显示，否则不显示）。
 */
import { loadItems } from './sources';
import { formatTime, timeValue } from './format';
import { isFeedAlbum } from './counts';
import { resolvePhotoTime } from './media';
import { groupPhotoBatches } from './photoBatches';
import type { DataKey } from './sources';

/** 单条时间轴条目 */
export interface TimelineEntry {
    /** 模块标识 */
    module: DataKey | 'photos';
    /** 模块中文名 */
    moduleLabel: string;
    /** 时间（秒级时间戳） */
    time: number;
    /** 格式化后的时间字符串 */
    timeText: string;
    /** 标题/摘要 */
    title: string;
    /** 描述/附加信息 */
    desc: string;
    /** 原始条目数据 */
    item: Record<string, any>;
    /** 相片批量：该批相片列表（仅 photos 模块有值） */
    photoBatch?: Record<string, any>[];
    /** 相片批量：所属相册名（仅 photos 模块有值） */
    albumName?: string;
    /** 相片批量：共同描述（仅 photos 模块有值，所有相片描述一致时显示） */
    commonDesc?: string;
    /** 路由跳转路径 */
    route: string;
}

/** 模块定义：取时间字段、标题字段、路由 */
interface ModuleDef {
    key: DataKey | 'photos';
    label: string;
    timeOf: (item: Record<string, any>) => any;
    titleOf: (item: Record<string, any>) => string;
    descOf?: (item: Record<string, any>) => string;
    route: string;
    /** 是否批量处理（如相片需要按相册+时间窗口合并） */
    batch?: boolean;
}

/** 相片批量归并的时间窗口（秒）——默认 1 小时 */
const PHOTO_BATCH_WINDOW_SEC = 3600;

/**
 * 从各模块收集条目，统一时间排序
 * @param order 'desc' 时间倒序（新的在前），'asc' 时间正序（旧的在前）
 */
export async function loadTimeline(
    order: 'desc' | 'asc' = 'desc',
): Promise<TimelineEntry[]> {
    const modules: ModuleDef[] = [
        {
            key: 'messages',
            label: '说说',
            timeOf: (i) => i.created_time || i.custom_create_time,
            titleOf: (i) => (i.content || '').slice(0, 80) || '说说',
            route: 'messages',
        },
        {
            key: 'blogs',
            label: '日志',
            timeOf: (i) => i.pubtime || i.pubTime || i.time,
            titleOf: (i) => i.title || '日志',
            route: 'blogs',
        },
        {
            key: 'diaries',
            label: '日记',
            timeOf: (i) => i.pubtime || i.pubTime || i.time,
            titleOf: (i) => i.title || '日记',
            route: 'diaries',
        },
        {
            key: 'boards',
            label: '留言',
            timeOf: (i) => i.pubtime || i.pubTime,
            titleOf: (i) => (i.content || '').slice(0, 80) || '留言',
            route: 'boards',
        },
        {
            key: 'shares',
            label: '分享',
            timeOf: (i) => i.shareTime || i.custom_create_time,
            titleOf: (i) => (i.content || i.title || '').slice(0, 80) || '分享',
            route: 'shares',
        },
        {
            key: 'favorites',
            label: '收藏',
            timeOf: (i) => i.custom_create_time || i.create_time,
            titleOf: (i) => (i.title || i.content || '').slice(0, 80) || '收藏',
            route: 'favorites',
        },
        {
            key: 'photos',
            label: '相片',
            timeOf: (i) => resolvePhotoTime(i, 'upload'),
            titleOf: (i) => i.name || i.desc || '相片',
            route: 'albums',
            batch: true,
        },
    ];

    const entries: TimelineEntry[] = [];

    for (const mod of modules) {
        if (mod.batch) {
            // 相片：按相册 + 时间窗口批量归并
            const photoEntries = await loadPhotoBatches(mod);
            entries.push(...photoEntries);
        } else {
            const items = await loadItems(mod.key as DataKey);
            for (const item of items) {
                const rawTime = mod.timeOf(item);
                const ts = timeValue(rawTime);
                const timeText = formatTime(rawTime);
                if (!ts || !timeText) continue;
                entries.push({
                    module: mod.key as DataKey,
                    moduleLabel: mod.label,
                    time: Math.floor(ts / 1000),
                    timeText,
                    title: mod.titleOf(item),
                    desc: mod.descOf?.(item) || '',
                    item,
                    route: mod.route,
                });
            }
        }
    }

    // 排序
    entries.sort((a, b) => {
        const diff = order === 'desc' ? b.time - a.time : a.time - b.time;
        return diff || a.moduleLabel.localeCompare(b.moduleLabel);
    });

    return entries;
}

/**
 * 加载相片并批量归并
 * 优先用相片自带的 batchId（同一批上传），没有 batchId 的老相片才退回 1 小时时间窗口。
 * 详见 data/photoBatches.ts。
 */
async function loadPhotoBatches(mod: ModuleDef): Promise<TimelineEntry[]> {
    const albums = await loadItems('albums');
    const entries: TimelineEntry[] = [];

    for (const album of albums) {
        // 「说说和日志相册」是 QQ 空间自动归档的说说配图/日志插图，不属于主动上传的相册，排除不计入时间轴
        if (isFeedAlbum(album)) continue;
        const photos: Record<string, any>[] = album.photoList || [];
        if (photos.length === 0) continue;

        for (const batch of groupPhotoBatches(photos, mod.timeOf, {
            windowMs: PHOTO_BATCH_WINDOW_SEC * 1000,
        })) {
            const entry = createPhotoBatchEntry(mod, album, batch);
            if (entry) entries.push(entry);
        }
    }

    return entries;
}

/** 为一组相片创建批量条目 */
function createPhotoBatchEntry(
    mod: ModuleDef,
    album: Record<string, any>,
    photos: Record<string, any>[],
): TimelineEntry | null {
    if (photos.length === 0) return null;

    const firstPhoto = photos[0];
    const rawTime = mod.timeOf(firstPhoto);
    const ts = timeValue(rawTime);
    const timeText = formatTime(rawTime);
    if (!ts || !timeText) return null;

    const albumName = String(album?.name || '相册');
    const count = photos.length;

    // 描述：取这批相片的共同描述，全相同则显示，否则不显示
    const descs = photos.map((p) => (p.desc || '').trim()).filter(Boolean);
    let commonDesc = '';
    if (descs.length === photos.length) {
        const first = descs[0];
        if (descs.every((d) => d === first)) {
            commonDesc = first;
        }
    }

    const title = count === 1
        ? `在「${albumName}」上传了 1 张相片`
        : `在「${albumName}」上传了 ${count} 张相片`;

    // 挂上相册引用，供 PhotoBatchItem 组件使用
    const firstWithAlbum = { ...firstPhoto, __album: album };

    return {
        module: 'photos',
        moduleLabel: mod.label,
        time: Math.floor(ts / 1000),
        timeText,
        title,
        desc: commonDesc,
        item: firstWithAlbum,
        photoBatch: photos,
        albumName,
        commonDesc: commonDesc || undefined,
        route: mod.route,
    };
}