/**
 * 实时统计（现算各模块条目数与按年分布）
 *
 * 不再依赖备份时写入 user.js 的统计数字，改为打开查看器时加载各模块数据现算。
 * 依赖 sources 的加载缓存：主页、左侧导航多处调用只会首次加载、之后命中缓存，
 * 不会重复读盘。
 */
import { loadData, loadItems, loadList, type DataKey } from './sources';
import { formatTime, monthOf, timeValue, isValidTimestampMs } from './format';
import { likeTotal, itemComments, viewCount, isExternalVideo, videoUrl, locationOf } from './content';
import { resolvePhotoTime } from './media';

/** 各模块条目数（键名与左侧导航 count 字段、旧 user.js 字段一致） */
export interface ModuleCounts {
    /** 允许按字段名字符串索引（导航/概览按 count 字段名取值） */
    [key: string]: number;
    messages: number;
    blogs: number;
    diaries: number;
    /** 相册总数 */
    albums: number;
    /** 相片总数（各相册相片之和；导航「相册」显示的就是它） */
    photos: number;
    videos: number;
    boards: number;
    friends: number;
    favorites: number;
    shares: number;
    visitors: number;
}

/**
 * 「说说和日志相册」：QQ 空间自动生成的相册，相片是说说配图/日志插图等自动归档内容。
 * 统计「相册照片总数」时按用户要求排除该相册（名字精确匹配，去掉首尾空白）。
 */
export function isFeedAlbum(album: Record<string, any>): boolean {
    return String(album?.name ?? '').trim() === '说说和日志相册';
}

/** 单相册的相片数；「说说和日志相册」按 0 计（不参与照片总数） */
export function albumPhotoCount(album: Record<string, any>): number {
    if (isFeedAlbum(album)) return 0;
    return album?.photoList?.length || album?.total || 0;
}

/** 实时统计各模块条目数 */
export async function loadModuleCounts(): Promise<ModuleCounts> {
    const len = async (key: DataKey) => (await loadList(key)).length;

    const albums = await loadList('albums');
    const photos = albums.reduce(
        (sum, album) => sum + albumPhotoCount(album),
        0,
    );
    // 留言/访客是 { items, total } 对象而非数组
    const boards = (await loadItems('boards')).length;
    const visitorsData = await loadData<{ items?: unknown[]; total?: number }>('visitors');
    const visitors = visitorsData?.total || visitorsData?.items?.length || 0;

    return {
        messages: await len('messages'),
        blogs: await len('blogs'),
        diaries: await len('diaries'),
        albums: albums.length,
        photos,
        videos: await len('videos'),
        boards,
        friends: await len('friends'),
        favorites: await len('favorites'),
        shares: await len('shares'),
        visitors,
    };
}

/** 参与「按年分布」统计的模块（取时间的字段各模块不同）
 *  注意：该 MODULES 列表被以下四处复用——时间跨度、年活跃、月度活跃、初识空间、深夜动态——
 *  一旦修改字段回退链请同时改一处，保证统计口径完全一致，避免出现"同一份数据多处最早年份不一致"。
 */
export const YEAR_MODULES: {
    key: DataKey;
    label: string;
    timeOf: (item: Record<string, any>) => any;
}[] = [
    { key: 'messages', label: '说说', timeOf: (item) => item.created_time || item.custom_create_time },
    { key: 'blogs', label: '日志', timeOf: (item) => item.pubtime || item.pubTime || item.time },
    { key: 'diaries', label: '日记', timeOf: (item) => item.pubtime || item.pubTime || item.time },
    { key: 'videos', label: '视频', timeOf: (item) => item.uploadtime || item.uploadTime },
    { key: 'boards', label: '留言', timeOf: (item) => item.pubtime || item.pubTime },
    { key: 'shares', label: '分享', timeOf: (item) => item.shareTime || item.custom_create_time },
    { key: 'favorites', label: '收藏', timeOf: (item) => item.custom_create_time || item.create_time },
];

/** 相片时间字段（统计时间跨度、月年活跃度、初识空间、深夜动态都需要；与 YEAR_MODULES 同口径） */
export const PHOTO_TIME_FIELDS = {
    label: '相片',
    timeOf: (photo: Record<string, any>) => resolvePhotoTime(photo, 'upload'),
};

/** 单个模块的按年计数 */
export interface ModuleYearStat {
    label: string;
    total: number;
    years: Map<string, number>;
}

/** 实时统计各模块的「按年分布」（用于主页的年度分布图，包括相片，过滤无效时间） */
export async function loadYearStats(formatYear: (time: any) => string): Promise<ModuleYearStat[]> {
    const result: ModuleYearStat[] = [];
    for (const module of YEAR_MODULES) {
        const items = await loadList(module.key);
        const years = new Map<string, number>();
        let moduleTotal = 0;
        for (const item of items) {
            const rawTime = module.timeOf(item);
            const ts = timeValue(rawTime);
            // 只有合法时间才参与统计聚合（避免 1970/2106 等异常值干扰年分布）
            if (isValidTimestampMs(ts)) {
                const year = formatYear(rawTime) || '未知';
                years.set(year, (years.get(year) || 0) + 1);
                moduleTotal++;
            }
        }
        result.push({ label: module.label, total: moduleTotal, years });
    }

    // 相片按年统计（「说说和日志相册」的相片为自动归档的配图/插图，不参与年活跃分布统计）
    const albums = await loadList('albums');
    const photoYears = new Map<string, number>();
    let photoTotal = 0;
    for (const album of albums) {
        if (isFeedAlbum(album)) continue;
        const photos = album.photoList || [];
        for (const photo of photos) {
            const rawTime = PHOTO_TIME_FIELDS.timeOf(photo);
            const ts = timeValue(rawTime);
            if (isValidTimestampMs(ts)) {
                photoTotal++;
                const year = formatYear(rawTime) || '未知';
                photoYears.set(year, (photoYears.get(year) || 0) + 1);
            }
        }
    }
    if (photoTotal > 0) {
        result.push({ label: PHOTO_TIME_FIELDS.label, total: photoTotal, years: photoYears });
    }

    return result;
}

/** ========== 以下为看板新增统计函数 ========== */

/** 时间跨度：最早/最晚记录时间 */
export interface TimeRange {
    earliest: string;
    latest: string;
}

/** 判断时间戳是否在合理范围内（1990-01-01 ~ 2100-12-31，与 format 中的 isValidTimestampMs 保持一致） */
function validTs(ts: number): ts is number {
    return isValidTimestampMs(ts);
}

/** 统计全站时间跨度（遍历所有有时间字段的模块，排除好友数据） */
export async function loadTimeRange(): Promise<TimeRange> {
    let minTs = Infinity;
    let maxTs = -Infinity;

    for (const module of YEAR_MODULES) {
        const items = await loadList(module.key);
        for (const item of items) {
            const ts = timeValue(module.timeOf(item));
            if (validTs(ts)) {
                if (ts < minTs) minTs = ts;
                if (ts > maxTs) maxTs = ts;
            }
        }
    }

    // 相片时间也要算（「说说和日志相册」为自动归档相册，不计入时间跨度）
    const albums = await loadList('albums');
    for (const album of albums) {
        if (isFeedAlbum(album)) continue;
        const photos = album.photoList || [];
        for (const photo of photos) {
            const ts = timeValue(resolvePhotoTime(photo, 'upload'));
            if (validTs(ts)) {
                if (ts < minTs) minTs = ts;
                if (ts > maxTs) maxTs = ts;
            }
        }
    }

    if (minTs === Infinity || maxTs === -Infinity) {
        return { earliest: '', latest: '' };
    }

    const fmt = (ts: number) => formatTime(ts);
    return {
        earliest: fmt(minTs),
        latest: fmt(maxTs),
    };
}

/** 互动热度统计 */
export interface InteractionStats {
    totalLikes: number;
    totalComments: number;
    totalViews: number;
}

/** 聚合全站的点赞、评论、浏览量 */
export async function loadInteractionStats(): Promise<InteractionStats> {
    let totalLikes = 0;
    let totalComments = 0;
    let totalViews = 0;

    const likeModules: DataKey[] = ['messages', 'blogs', 'diaries', 'videos', 'shares', 'favorites'];
    for (const key of likeModules) {
        const items = await loadList(key);
        for (const item of items) {
            totalLikes += likeTotal(item);
            totalComments += itemComments(item).length;
            totalViews += viewCount(item);
        }
    }

    // 留言的点赞/评论
    const boards = await loadItems('boards');
    for (const board of boards) {
        totalLikes += likeTotal(board);
        totalComments += itemComments(board).length;
    }

    // 相片的互动
    const albums = await loadList('albums');
    for (const album of albums) {
        const photos = album.photoList || [];
        for (const photo of photos) {
            totalLikes += likeTotal(photo);
            totalComments += itemComments(photo).length;
        }
    }

    // 访客总数已在 counts 中
    return { totalLikes, totalComments, totalViews };
}

/** 媒体资源统计 */
export interface MediaStats {
    photos: number;
    videos: number;
    /** 已登记本地相对路径的条目数（注意：不等于文件确实存在） */
    localPhotos: number;
    localVideos: number;
    externalPhotos: number;
    externalVideos: number;
    /** 记录里没有任何可用媒体路径，无法判定本地/外链的条目数 */
    unknownPhotos: number;
    unknownVideos: number;
}

/** 媒体路径归类：外链 / 本地相对路径 / 无路径 */
export function classifyMediaPath(path: unknown): 'external' | 'local' | 'unknown' {
    if (typeof path !== 'string' || !path.trim()) return 'unknown';
    return /^(https?:)?\/\//.test(path) ? 'external' : 'local';
}

/**
 * 纯计算：按「备份记录里登记的路径」把相片/视频归为本地、外链、未记录三类。
 *
 * 口径说明：这里只能判断「记录里写的是本地相对路径还是外链 URL」，
 * 无法在 file:// 下探测磁盘文件是否真实存在，因此结果不得表述为「可离线打开率」。
 * 旧实现把「没有路径」的条目一律算作 local，会虚高本地占比，这里单列 unknown。
 */
export function computeMediaStats(
    albums: Record<string, any>[],
    videoList: Record<string, any>[],
): MediaStats {
    const stat: MediaStats = {
        photos: 0, videos: 0,
        localPhotos: 0, localVideos: 0,
        externalPhotos: 0, externalVideos: 0,
        unknownPhotos: 0, unknownVideos: 0,
    };

    for (const album of albums) {
        // 「说说和日志相册」的相片不计入媒体统计（与照片总数口径一致）
        if (isFeedAlbum(album)) continue;
        for (const photo of album.photoList || []) {
            stat.photos++;
            const path = photo.custom_filepath || photo.custom_pre_filepath || photo.custom_url || photo.url;
            const kind = classifyMediaPath(path);
            if (kind === 'external') stat.externalPhotos++;
            else if (kind === 'local') stat.localPhotos++;
            else stat.unknownPhotos++;
        }
    }

    for (const video of videoList) {
        stat.videos++;
        const v = video.video_info || video;
        if (isExternalVideo(v)) {
            stat.externalVideos++;
            continue;
        }
        const kind = classifyMediaPath(videoUrl(v));
        if (kind === 'external') stat.externalVideos++;
        else if (kind === 'local') stat.localVideos++;
        else stat.unknownVideos++;
    }

    return stat;
}

/** 统计媒体资源及本地/外链占比 */
export async function loadMediaStats(): Promise<MediaStats> {
    return computeMediaStats(await loadList('albums'), await loadList('videos'));
}

/**
 * 已登记本地路径的媒体占比。
 * 分母用「全部媒体条目」（含无路径的 unknown），避免把无法判定的条目排除后虚高比例。
 */
export function localPathRatio(stat: MediaStats): number {
    const total = stat.photos + stat.videos;
    if (total === 0) return 0;
    return Math.round(((stat.localPhotos + stat.localVideos) / total) * 100);
}

/** 模块备份状态：区分「数据文件缺失」与「已备份但确实没有内容」 */
export type ModuleStatus = 'missing' | 'empty' | 'ok';

export interface ModuleStatusEntry {
    key: string;
    status: ModuleStatus;
    total: number;
}

/**
 * 纯判定：数据文件是否存在 + 条目数 → 模块状态。
 * 抽成纯函数便于单测，不必 mock window.* 数据源。
 */
export function classifyModuleStatus(hasData: boolean, total: number): ModuleStatus {
    if (!hasData) return 'missing';
    return total > 0 ? 'ok' : 'empty';
}

/** 模块数据键 → 数据源键（相片与相册共用 albums 数据源） */
const MODULE_DATA_KEYS: { key: keyof ModuleCounts; dataKey: DataKey }[] = [
    { key: 'messages', dataKey: 'messages' },
    { key: 'blogs', dataKey: 'blogs' },
    { key: 'diaries', dataKey: 'diaries' },
    { key: 'videos', dataKey: 'videos' },
    { key: 'boards', dataKey: 'boards' },
    { key: 'shares', dataKey: 'shares' },
    { key: 'favorites', dataKey: 'favorites' },
    { key: 'albums', dataKey: 'albums' },
    { key: 'photos', dataKey: 'albums' },
    { key: 'friends', dataKey: 'friends' },
    { key: 'visitors', dataKey: 'visitors' },
];

/**
 * 逐模块判定备份状态。loadData 返回 null 表示该 .js 文件不存在或全局变量未挂载，
 * 即「没有这份数据」；文件存在但 0 条则可能是用户本来就没有该内容。
 */
export async function loadModuleStatuses(counts: ModuleCounts): Promise<ModuleStatusEntry[]> {
    const hasData = new Map<DataKey, boolean>();
    for (const { dataKey } of MODULE_DATA_KEYS) {
        if (!hasData.has(dataKey)) {
            hasData.set(dataKey, (await loadData(dataKey)) !== null);
        }
    }
    return MODULE_DATA_KEYS.map(({ key, dataKey }) => {
        const total = counts[key] ?? 0;
        // ModuleCounts 带字符串索引签名，keyof 会含 number，显式转字符串以匹配 ModuleStatusEntry
        return { key: String(key), total, status: classifyModuleStatus(hasData.get(dataKey) ?? false, total) };
    });
}

/** 月度活跃度统计（用于热力图） */
export interface MonthlyStat {
    /** yyyy年MM月 → 条目数 */
    months: Map<string, number>;
    /** 最早年月 */
    firstMonth: string;
    /** 最晚年月 */
    lastMonth: string;
}

/** 按月份聚合全站条目数（包括相片，过滤无效时间） */
export async function loadMonthlyStats(): Promise<MonthlyStat> {
    const months = new Map<string, number>();

    for (const module of YEAR_MODULES) {
        const items = await loadList(module.key);
        for (const item of items) {
            const rawTime = module.timeOf(item);
            const ts = timeValue(rawTime);
            if (isValidTimestampMs(ts)) {
                const month = monthOf(rawTime);
                if (month && month !== '未知时间') {
                    months.set(month, (months.get(month) || 0) + 1);
                }
            }
        }
    }

    // 相片月度统计（「说说和日志相册」为自动归档相册，不计入月度活跃度）
    const albums = await loadList('albums');
    for (const album of albums) {
        if (isFeedAlbum(album)) continue;
        const photos = album.photoList || [];
        for (const photo of photos) {
            const rawTime = PHOTO_TIME_FIELDS.timeOf(photo);
            const ts = timeValue(rawTime);
            if (isValidTimestampMs(ts)) {
                const month = monthOf(rawTime);
                if (month && month !== '未知时间') {
                    months.set(month, (months.get(month) || 0) + 1);
                }
            }
        }
    }

    let firstMonth = '';
    let lastMonth = '';
    for (const m of months.keys()) {
        if (!firstMonth || m < firstMonth) firstMonth = m;
        if (!lastMonth || m > lastMonth) lastMonth = m;
    }

    return { months, firstMonth, lastMonth };
}


/** 空间之最：点赞最多/评论最多的条目 */
export interface TopRecord {
    kind: DataKey;
    label: string;
    title: string;
    time: string;
    likes: number;
    comments: number;
    views: number;
    /** 原始条目数据，用于在面板中直接渲染对应组件 */
    item: Record<string, any>;
}

/** 取某字段最大的 Top N 条目 */
async function topByMetric(
    modules: { key: DataKey; label: string; timeOf: (item: Record<string, any>) => any; titleOf: (item: Record<string, any>) => string }[],
    metricOf: (item: Record<string, any>) => number,
    n: number,
): Promise<TopRecord[]> {
    const all: TopRecord[] = [];
    for (const mod of modules) {
        const items = await loadList(mod.key);
        for (const item of items) {
            const metric = metricOf(item);
            if (metric > 0) {
                all.push({
                    kind: mod.key,
                    label: mod.label,
                    title: mod.titleOf(item),
                    time: formatTime(mod.timeOf(item)),
                    likes: likeTotal(item),
                    comments: itemComments(item).length,
                    views: viewCount(item),
                    item,
                });
            }
        }
    }
    // 注意：必须传 a.item / b.item（原始条目数据），不能传 TopRecord 本身
    // 否则 likeTotal/itemComments 会在 TopRecord 上找 likeTotal/custom_comments 等字段，全是 undefined，排序返回 NaN → 顺序保持不变
    return all.sort((a, b) => metricOf(b.item) - metricOf(a.item)).slice(0, n);
}

/** 获取点赞最多的 Top N */
export function loadTopLikes(n = 5): Promise<TopRecord[]> {
    return topByMetric(
        [
            { key: 'messages', label: '说说', timeOf: (i) => i.created_time || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'blogs', label: '日志', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'diaries', label: '日记', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'videos', label: '视频', timeOf: (i) => i.uploadtime || i.uploadTime, titleOf: (i) => i.name || '无标题' },
            { key: 'shares', label: '分享', timeOf: (i) => i.shareTime || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'favorites', label: '收藏', timeOf: (i) => i.create_time || i.custom_create_time, titleOf: (i) => (i.title || i.content || '').slice(0, 30) || '无标题' },
            { key: 'boards', label: '留言', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
        ],
        (i) => likeTotal(i),
        n,
    );
}

/** 获取评论最多的 Top N */
export function loadTopComments(n = 5): Promise<TopRecord[]> {
    return topByMetric(
        [
            { key: 'messages', label: '说说', timeOf: (i) => i.created_time || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'blogs', label: '日志', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'diaries', label: '日记', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'videos', label: '视频', timeOf: (i) => i.uploadtime || i.uploadTime, titleOf: (i) => i.name || '无标题' },
            { key: 'shares', label: '分享', timeOf: (i) => i.shareTime || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'favorites', label: '收藏', timeOf: (i) => i.create_time || i.custom_create_time, titleOf: (i) => (i.title || i.content || '').slice(0, 30) || '无标题' },
            { key: 'boards', label: '留言', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
        ],
        (i) => itemComments(i).length,
        n,
    );
}

/** 获取浏览最多的 Top N */
export function loadTopViews(n = 5): Promise<TopRecord[]> {
    return topByMetric(
        [
            { key: 'messages', label: '说说', timeOf: (i) => i.created_time || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'blogs', label: '日志', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'diaries', label: '日记', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => i.title || '无标题' },
            { key: 'videos', label: '视频', timeOf: (i) => i.uploadtime || i.uploadTime, titleOf: (i) => i.name || '无标题' },
            { key: 'shares', label: '分享', timeOf: (i) => i.shareTime || i.custom_create_time, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
            { key: 'favorites', label: '收藏', timeOf: (i) => i.create_time || i.custom_create_time, titleOf: (i) => (i.title || i.content || '').slice(0, 30) || '无标题' },
            { key: 'boards', label: '留言', timeOf: (i) => i.pubtime || i.pubTime, titleOf: (i) => (i.content || '').slice(0, 30) || '无标题' },
        ],
        (i) => viewCount(i),
        n,
    );
}

/* ==================== 最常访问地点 Top N ==================== */

/** 相片的上传地点（与 media.ts 的 photoLocation 回退链一致，避免重复依赖） */
const PHOTO_LOCATION_FIELDS = {
    label: '相片',
    locationOf: (photo: Record<string, any>) => {
        const lbs = photo.custom_lbs || photo.lbs;
        return lbs ? (lbs.idname || lbs.name || '') : '';
    },
    timeOf: (photo: Record<string, any>) => resolvePhotoTime(photo, 'upload'),
};

/** 最常访问地点的条目 */
export interface TopLocation {
    /** 地点名称（已通过 lbs.idname/lbs.name 归一化） */
    location: string;
    /** 访问次数（在该地点发布的内容条数 + 在该地点拍摄的相片数） */
    count: number;
    /** 占所有带地点内容的百分比（0~100，保留1位） */
    percent: number;
    /** 最近一次访问时间（该地点所有内容中最新的一条，格式 yyyy-MM-dd HH:mm） */
    latestTime: string;
    /** 最近一次访问所属模块标识（messages / blogs / diaries / videos / shares / favorites / boards / photos） */
    kind: DataKey | 'photos';
    /** 最近一次访问所属模块中文名（说说 / 日志 / … / 相片） */
    label: string;
    /** 路由跳转路径（用于点击标签跳到对应模块） */
    route: string;
    /** 最近一次访问的原始条目数据（留给面板做卡片渲染预览，可选） */
    latestItem: Record<string, any>;
}

/**
 * 获取最常访问的 Top N 地点
 *
 * 统计口径（与时间跨度/初识空间一致，复用 YEAR_MODULES + 相片独立处理）：
 *  1. YEAR_MODULES 7 个模块：用 content.locationOf 取地点，回退链 story_info?.lbs → lbs → idname/name
 *  2. 相册相片（photoList）：用 PHOTO_LOCATION_FIELDS，回退链 custom_lbs → lbs → idname/name（与 media.ts 对齐）
 *  3. 空字符串/空白地点直接跳过；同地点名归并计数，保留最新访问时间
 *  4. 最终按 count 从大到小排序取 Top N，percent 按「带地点的内容总数」归一化
 */
export async function loadTopLocations(n = 5): Promise<TopLocation[]> {
    type Bucket = { count: number; latestTs: number; latestItem: Record<string, any>; kind: DataKey | 'photos'; label: string; route: string };
    const buckets = new Map<string, Bucket>();
    let totalLocated = 0;

    const ROUTE_OF: Record<string, string> = {
        messages: 'messages', blogs: 'blogs', diaries: 'diaries', videos: 'videos',
        shares: 'shares', favorites: 'favorites', boards: 'boards', photos: 'albums',
    };

    // 1) 7 个普通模块（messages/blogs/diaries/videos/shares/favorites/boards）
    // 这里复用 YEAR_MODULES 保证模块列表 + 时间字段回退链，与其它 4 处统计一致
    for (const mod of YEAR_MODULES) {
        const items = await loadList(mod.key);
        for (const item of items) {
            const loc = locationOf(item);
            if (!loc || !loc.trim()) continue;
            const raw = mod.timeOf(item);
            const ts = timeValue(raw);
            if (!isValidTimestampMs(ts)) continue;
            totalLocated++;
            const key = loc.trim();
            const prev = buckets.get(key);
            if (!prev || ts > prev.latestTs) {
                buckets.set(key, {
                    count: (prev?.count ?? 0) + 1,
                    latestTs: ts,
                    latestItem: item,
                    kind: mod.key,
                    label: mod.label,
                    route: ROUTE_OF[mod.key] || mod.key,
                });
            } else {
                prev.count++;
            }
        }
    }

    // 2) 相册相片（独立遍历，因为 albums 容器不在 YEAR_MODULES 里，相片挂在 album.photoList 下）
    const albums = await loadList('albums');
    for (const album of albums) {
        const photos = album.photoList || [];
        for (const photo of photos) {
            const loc = PHOTO_LOCATION_FIELDS.locationOf(photo);
            if (!loc || !loc.trim()) continue;
            const raw = PHOTO_LOCATION_FIELDS.timeOf(photo);
            const ts = timeValue(raw);
            if (!isValidTimestampMs(ts)) continue;
            totalLocated++;
            const key = loc.trim();
            // 把所属相册信息挂在 photo 上，方便面板渲染时知道是哪本相册的照片
            const photoWithAlbum = { ...photo, __album: album };
            const prev = buckets.get(key);
            if (!prev || ts > prev.latestTs) {
                buckets.set(key, {
                    count: (prev?.count ?? 0) + 1,
                    latestTs: ts,
                    latestItem: photoWithAlbum,
                    kind: 'photos',
                    label: PHOTO_LOCATION_FIELDS.label,
                    route: ROUTE_OF.photos || 'albums',
                });
            } else {
                prev.count++;
            }
        }
    }

    // 3) 按 count 从大到小排序 → 取 Top N → 填 percent
    const list = Array.from(buckets.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, n)
        .map(([location, b]) => ({
            location,
            count: b.count,
            percent: totalLocated > 0 ? Math.round((b.count / totalLocated) * 1000) / 10 : 0,
            latestTime: formatTime(b.latestTs),
            kind: b.kind,
            label: b.label,
            route: b.route,
            latestItem: b.latestItem,
        }));
    return list;
}
