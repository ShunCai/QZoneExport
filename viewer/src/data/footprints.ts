import { loadList } from './sources';
import { imageUrl, videoPoster } from './content';
import { photoUrl, photoTimeOf } from './media';

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
    /** 纯文本全文（展开用） */
    content: string;
    /** 首图/视频封面 URL（无则空串） */
    thumb: string;
}

/** 说说正文转纯文本（去 [表情]/[图片] 等 token 标记），用于列表预览 */
function plainText(message: Record<string, any>): string {
    return String(message.content || '')
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
        items.push({
            tid: String(message.tid),
            source: 'messages',
            name: lbs.idname || lbs.name || '未知地点',
            posX: Number(lbs.pos_x),
            posY: Number(lbs.pos_y),
            time: message.created_time || message.custom_create_time,
            summary: text.slice(0, 80),
            content: text,
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
            items.push({
                tid: photoKey,
                source: 'photos',
                albumId: String(album.id),
                name: lbs.idname || lbs.name || '未知地点',
                posX: Number(lbs.pos_x),
                posY: Number(lbs.pos_y),
                time: photoTimeOf(photo),
                summary: '📷 ' + caption,
                content: caption,
                thumb: photoUrl(photo),
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
