import { loadList } from './sources';
import { imageUrl, videoPoster } from './content';
import { photoThumbUrl, photoUrl, photoTimeOf } from './media';
import { formatMessageContent, formatText } from './richText';

export interface Footprint {
    /** 唯一键（统一字段名，值来源不同）：说说=message.tid；相片=相片实体键 picKey/lloc/sloc（无则「相册 id+名称」）。注意相片没有稳定的 id 字段，严禁用 photo.id。 */
    tid: string;
    /** 数据来源：说说 / 相片 */
    source: 'messages' | 'photos';
    /** 相片来源时所属相册 id（跳相册详情用） */
    albumId?: string;
    name: string;
    posX: number;
    posY: number;
    time: any;
    /** 纯文本摘要（去 [表情] 标记，截断展示） */
    summary: string;
    /** 纯文本全文（搜索 / 隐私脱敏用） */
    content: string;
    /** 富文本 HTML（先转义再渲染表情 / @ / 话题，可安全 v-html） */
    html: string;
    /** 逆地理编码给出的城市（仅开启「刷新微信坐标」的备份才有，用于城市统计优先取值） */
    cityHint?: string;
    /** 首图/视频封面 URL（无则空串） */
    thumb: string;
    /**
     * 坐标不可用于地图定位：整数度的粗坐标（如 110, 21）、(0,0) 附近的占位值
     * （如 pos_x = pos_y = 0.00009）、或超出经纬度范围。
     * 这类记录仍留在列表里，但不参与地图定位与地域归属。
     */
    coarse?: boolean;
    /**
     * 地图相片图层用的缩略图地址（只有相片来源才给；用预览图而非原图，
     * 地图上最多同时铺 200 张，原图会明显拖慢渲染）
     */
    preview?: string;
}

/**
 * 说说正文转纯文本（搜索 / 隐私脱敏用）。
 * 必须先整段删掉 [em]…[/em]：单独剥方括号会把里面的 e100 留成裸文本。
 */
function plainText(message: Record<string, any>): string {
    return String(message.content || '')
        .replace(/\[em\][^\[]*\[\/em\]/gi, ' ')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 取说说的首张图/视频封面（复用 content.ts 的取图逻辑，与说说卡片一致） */
function firstThumb(message: Record<string, any>): string {
    const img = message.custom_images?.[0];
    if (img) {
        return imageUrl(img.is_video && img.video_info ? img.video_info : img);
    }
    const vid = message.custom_videos?.[0];
    if (vid) {
        return videoPoster(vid);
    }
    const magic = message.custom_magics?.[0];
    if (magic) {
        return imageUrl(magic);
    }
    return '';
}

/**
 * 坐标是否只有整数精度：QQ 偶发把 pos_x/pos_y 截成 (110, 21)，
 * 这种点落到哪个省纯看运气，不能拿来做地图定位。
 */
export function isCoarseCoord(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y);
}

/**
 * 坐标能不能拿来定位
 *
 * 除了经纬度范围，还要排掉 QQ 的占位值：对「翻了旧说说但没拿到 GPS」的条目，
 * 接口会回 `pos_x = pos_y = 0.00009`。中国地图上它落在图外看不出来，
 * 一切到世界地图就跑到几内亚湾（本初子午线与赤道交点附近），
 * 例如「广东省高州市石鼓镇石鼓中学」那条 2012 年的说说。
 */
export function isUsableCoord(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return false;
    }
    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
        return false;
    }
    // QQ 的占位特征是两个值**完全相同**（pos_x = pos_y = 0.00009）；
    // 只否掉这种同值近零，别把恰好路过赤道/本初子午线附近的真实坐标一起误伤
    if (x === y && Math.abs(x) < 0.01) {
        return false;
    }
    return true;
}

/** 能否用于地图定位：范围合法、不是占位值、也不是整数度那种粗坐标 */
export function isLocatable(x: number, y: number): boolean {
    return isUsableCoord(x, y) && !isCoarseCoord(x, y);
}

/**
 * 收集带坐标的足迹
 * 来源一：说说（message.lbs）——位置为发说说时选择的地点
 * 来源二：相册相片（album.photoList 下 photo.custom_lbs || photo.lbs || photo.shootGeo）——
 *        位置为上传/拍摄地点，时间取拍摄优先、兜底上传（photoTimeOf）
 * 两者跳原文入口不同：说说→#/messages?id，相片→#/albums?id（所在相册）
 */
export async function collectFootprints(): Promise<Footprint[]> {
    const items: Footprint[] = [];

    // 1) 说说
    const messages = await loadList<Record<string, any>>('messages');
    for (const message of messages) {
        if (message.rt_tid) {
            continue;
        }
        const lbs = message.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        const text = plainText(message);
        const html = formatMessageContent(message) || formatText(text);
        const address = message.custom_lbsInfo?.address_component;
        const cityHint = String(address?.city || address?.province || '').trim() || undefined;
        const posX = Number(lbs.pos_x);
        const posY = Number(lbs.pos_y);
        items.push({
            tid: String(message.tid),
            source: 'messages',
            name: lbs.idname || lbs.name || '未知地点',
            posX,
            posY,
            coarse: !isLocatable(posX, posY),
            time: message.created_time || message.custom_create_time,
            summary: text.slice(0, 80),
            content: text,
            html,
            cityHint,
            thumb: firstThumb(message),
        });
    }

    // 2) 相册相片（位置优先级 custom_lbs → lbs → shootGeo）
    const albums = await loadList<Record<string, any>>('albums');
    // 跨相册去重：同一张相片可能同时属于多个相册（如「我的照片」+ 命名相册），需按相片实体唯一键去重。
    // 注意：相片的唯一键是 picKey / lloc / sloc（见 core/collector/modules/photos.ts 的 getImageKey），
    // PhotoItem 并没有稳定的 id 字段——之前误用 photo.id 实际恒为 undefined，导致去重全部失效、
    // 跨相册同名相片被重复渲染。
    const seenPhotoKeys = new Set<string>();
    for (const album of albums) {
        const photoList: Record<string, any>[] = album.photoList || [];
        for (const photo of photoList) {
            const lbs = photo.custom_lbs || photo.lbs || photo.shootGeo;
            if (!lbs || !lbs.pos_x || !lbs.pos_y) {
                continue;
            }
            // 实体身份键：优先 picKey → lloc → sloc；三者皆无再退化为「相册+名称」
            const photoKey = photo.picKey != null
                ? String(photo.picKey)
                : (photo.lloc != null
                    ? String(photo.lloc)
                    : (photo.sloc != null
                        ? String(photo.sloc)
                        : `album:${album.id}:${photo.name || ''}`));
            if (seenPhotoKeys.has(photoKey)) {
                continue;
            }
            seenPhotoKeys.add(photoKey);
            const caption = photo.desc || photo.name || '照片';
            const posX = Number(lbs.pos_x);
            const posY = Number(lbs.pos_y);
            items.push({
                tid: photoKey,
                source: 'photos',
                albumId: String(album.id),
                name: lbs.idname || lbs.name || '未知地点',
                posX,
                posY,
                coarse: !isLocatable(posX, posY),
                time: photoTimeOf(photo),
                summary: '📷 ' + caption,
                content: caption,
                html: formatText(caption),
                thumb: photoUrl(photo),
                preview: photoThumbUrl(photo),
            });
        }
    }

    return items;
}


/** 最常去地点（按地点名聚合 Top1） */
export function topPlaceOf(items: Footprint[]): { name: string; count: number } | null {
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return ranked.length ? { name: ranked[0]![0], count: ranked[0]![1] } : null;
}

/** 同坐标打卡次数（预览浮层用） */
export function visitCountOf(items: Footprint[], fp: Footprint): number {
    let count = 0;
    for (const item of items) {
        if (item.posX === fp.posX && item.posY === fp.posY) {
            count++;
        }
    }
    return count;
}
