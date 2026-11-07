import { loadItems, loadList } from './sources';
import { YEAR_MODULES, PHOTO_TIME_FIELDS, isFeedAlbum } from './counts';
import { formatTime, timeValue, isValidTimestampMs } from './format';
import { loadTopLikes, loadTopComments, type TopRecord } from './counts';
import { MODULE_LABEL as MODULE_LABELS, snippet, summaryOf } from './summary';

// 摘要口径收敛在 data/summary.ts（留言/视频等模块的正文不在 content 里，见那里的说明）
export { snippet };

/**
 * 首页回忆卡片的公共计算
 *
 * 首页只显示每类的前 5 条，完整榜单在 #/memories。把「取 Top N」收敛到这里，
 * 卡片组件只负责渲染，不再各自写一份排序；同时也避免首页为了拿 5 行数据
 * 去挂载那些会渲染完整条目卡的面板组件。
 */
export interface RankRow {
    /** 左侧小标签（时刻 / 日期 / 模块） */
    label: string;
    text: string;
    /** 右侧补充数字 */
    meta?: string;
    route?: string;
    query?: Record<string, string>;
}

export interface HomeRankings {
    night: RankRow[];
    first: RankRow[];
    likes: RankRow[];
    comments: RankRow[];
}

const MODULE_LABEL = MODULE_LABELS;

/**
 * 说说摘要：直接走统一口径（正文 → 转发 → 表情/图片 → 视频动态）。
 * 保留这个薄封装是因为 home.ts 里「最热闹的说说」用的就是它。
 */
export function messageSummary(item: Record<string, any>, max = 30): string {
    return summaryOf('messages', item, max);
}

/** 按记录真实所属模块生成深链；from=home 让详情页能返回首页 */
export function deepLinkOf(
    key: string,
    item: Record<string, any>,
    albumId?: string,
): { route: string; query: Record<string, string> } {
    const from = { from: 'home' };
    const id = (value: unknown): Record<string, string> => (value ? { id: String(value) } : {});
    switch (key) {
        case 'messages':
            return { route: 'messages', query: { ...from, ...id(item.tid) } };
        case 'blogs':
        case 'diaries':
            return { route: key, query: { ...from, ...id(item.blogid || item.blogId || item.uniKey) } };
        case 'boards':
            return { route: 'boards', query: { ...from, ...id(item.tid ?? item.id) } };
        case 'shares':
            return { route: 'shares', query: { ...from, ...id(item.id) } };
        case 'photos':
            return { route: 'albums', query: { ...from, ...id(albumId) } };
        // 视频/收藏/访客没有详情页，退到对应列表页
        default:
            return { route: key === 'visitors' ? 'visitors' : key, query: from };
    }
}

export async function loadHomeRankings(): Promise<HomeRankings> {
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

    const groups: Record<string, Record<string, any>[]> = {
        messages, blogs, diaries, videos, boards, shares, favorites, visitors,
    };
    const realAlbums = albums.filter((album) => !isFeedAlbum(album));

    /** 深夜动态：0–5 点（与 NightOwlPanel 同口径），按一天内时刻从晚到早取 5 条 */
    const nightCandidates: { minute: number; row: RankRow }[] = [];
    function considerNight(key: string, item: Record<string, any>, rawTime: any, albumId?: string): void {
        const ts = timeValue(rawTime);
        if (!isValidTimestampMs(ts)) return;
        const date = new Date(ts);
        const hour = date.getHours();
        if (hour < 0 || hour >= 5) return;
        const clock = formatTime(ts).slice(11, 16);
        const link = deepLinkOf(key, item, albumId);
        nightCandidates.push({
            minute: hour * 60 + date.getMinutes(),
            row: {
                // 与「最多点赞 / 最多评论」同构：左列统一是模块名，右列是数字（这里是时刻）
                label: MODULE_LABEL[key] || key,
                text: summaryOf(key, item),
                meta: clock,
                ...link,
            },
        });
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
    const night = nightCandidates
        .sort((a, b) => b.minute - a.minute)
        .slice(0, 5)
        .map((candidate) => candidate.row);

    /** 最初的记忆：各模块最早的一条记录，按时间从早到晚取 5 条 */
    const firstCandidates: { ts: number; row: RankRow }[] = [];
    function considerFirst(
        key: string,
        item: Record<string, any>,
        rawTime: any,
        albumId?: string,
        textOverride?: string,
    ): void {
        const ts = timeValue(rawTime);
        if (!isValidTimestampMs(ts)) return;
        const link = deepLinkOf(key, item, albumId);
        firstCandidates.push({
            ts,
            row: {
                label: MODULE_LABEL[key] || key,
                // 相片的默认摘要是「相片」，与左侧标签重复，这里改成相册名
                text: textOverride ?? summaryOf(key, item),
                meta: formatTime(ts).slice(0, 10),
                ...link,
            },
        });
    }
    for (const mod of YEAR_MODULES) {
        const list = [...(groups[mod.key] || [])].sort((a, b) => timeValue(mod.timeOf(a)) - timeValue(mod.timeOf(b)));
        if (list[0]) considerFirst(mod.key, list[0], mod.timeOf(list[0]));
    }
    for (const item of [...visitors].sort((a, b) => timeValue(a.time) - timeValue(b.time)).slice(0, 1)) {
        considerFirst('visitors', item, item.time);
    }
    // 相片：只取全站最早的一张。原先按相册各取最早一张，
    // 「最初的记忆」5 行里会出现 3 行「相片 相片」，把各模块的「起点」语义稀释掉了。
    let earliestPhoto: { photo: Record<string, any>; albumId?: string; ts: number; albumName: string } | null = null;
    for (const album of realAlbums) {
        for (const photo of album.photoList || []) {
            const ts = timeValue(PHOTO_TIME_FIELDS.timeOf(photo));
            if (!isValidTimestampMs(ts)) continue;
            if (!earliestPhoto || ts < earliestPhoto.ts) {
                earliestPhoto = {
                    photo,
                    albumId: album.id ? String(album.id) : undefined,
                    ts,
                    albumName: String(album.name || album.title || '').trim(),
                };
            }
        }
    }
    if (earliestPhoto) {
        considerFirst(
            'photos',
            earliestPhoto.photo,
            PHOTO_TIME_FIELDS.timeOf(earliestPhoto.photo),
            earliestPhoto.albumId,
            earliestPhoto.albumName ? `「${earliestPhoto.albumName}」` : '相片',
        );
    }
    const first = firstCandidates
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 5)
        .map((candidate) => candidate.row);

    /**
     * 最多点赞 / 最多评论：直接复用 counts.ts 的 loadTopLikes / loadTopComments，
     * 与完整清单页的面板是**同一份计算**，不再另写一套排序。
     */
    const [topLikes, topComments] = await Promise.all([loadTopLikes(5), loadTopComments(5)]);
    const toRow = (record: TopRecord, meta: string): RankRow => {
        const raw = snippet(record.title);
        // counts.ts 的 titleOf 对没有标题字段的模块会返回「无标题」，留言这类还会返回「无内容」；
        // 这时按模块自身口径（htmlContent/转发/表情…）现算一份摘要，别把占位词摆到卡片上
        const text = raw && raw !== '无标题' && raw !== '无内容'
            ? raw
            : summaryOf(record.kind, record.item);
        return {
            label: record.label,
            text,
            meta,
            ...deepLinkOf(record.kind, record.item),
        };
    };
    const likes = topLikes.map((record) => toRow(record, `${record.likes} 赞`));
    const comments = topComments.map((record) => toRow(record, `${record.comments} 评论`));

    return { night, first, likes, comments };
}
