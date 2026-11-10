/**
 * 地图相片图层：从足迹里挑出「可以贴在地图上」的相片标记。
 *
 * 为什么要挑而不是全放：一次备份里带坐标的相片常有上千张，
 * 全部铺成缩略图既拖渲染也没有可读性（同一点叠成一片）。
 * 这里按「先覆盖、再加密」的顺序取前 N 张：
 *   1. 同坐标（同一次出游/同一个地点）归成一桶，只挑最新的一张；
 *   2. 所有桶按最新时间倒序，先保证每个地点都有一张；
 *   3. 还有额度再按桶内张数从多到少补，热点地点自然更密。
 * 上限由调用方按当前缩放级别传入（见 MapPage 的相片图层）。
 */

import { timeValue } from './format';
import type { Footprint } from './footprints';

export interface PhotoMarker {
    tid: string;
    posX: number;
    posY: number;
    /** 缩略图相对地址（备份根目录起） */
    preview: string;
    /** 所属相册（点击跳详情用） */
    albumId?: string;
    item: Footprint;
}

interface Bucket {
    key: string;
    photos: Footprint[];
    newest: number;
}

/** 坐标合并精度：小数点后 4 位 ≈ 11 米，足够把同一次拍摄合并成一桶 */
const COORD_PRECISION = 4;

function coordKey(item: Footprint): string {
    return `${item.posX.toFixed(COORD_PRECISION)},${item.posY.toFixed(COORD_PRECISION)}`;
}

function newestOf(photos: Footprint[]): number {
    let newest = 0;
    for (const photo of photos) {
        const t = timeValue(photo.time);
        if (t > newest) {
            newest = t;
        }
    }
    return newest;
}

export function pickPhotoMarkers(items: Footprint[], limit = 200): PhotoMarker[] {
    if (limit <= 0) {
        return [];
    }
    const buckets = new Map<string, Bucket>();
    for (const item of items) {
        if (item.source !== 'photos' || !item.preview) {
            continue;
        }
        const key = coordKey(item);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.photos.push(item);
        } else {
            buckets.set(key, { key, photos: [item], newest: 0 });
        }
    }
    const list = [...buckets.values()];
    for (const bucket of list) {
        bucket.photos.sort((a, b) => timeValue(b.time) - timeValue(a.time));
        bucket.newest = newestOf(bucket.photos);
    }
    // 新的地点优先占位，时间轴上的「最近去过」先上地图
    list.sort((a, b) => b.newest - a.newest);

    const picked: PhotoMarker[] = [];
    const push = (photo: Footprint): boolean => {
        if (picked.length >= limit) {
            return false;
        }
        picked.push({
            tid: photo.tid,
            posX: photo.posX,
            posY: photo.posY,
            preview: photo.preview as string,
            albumId: photo.albumId,
            item: photo,
        });
        return true;
    };

    // 第一轮：每个地点一张
    for (const bucket of list) {
        if (!push(bucket.photos[0]!)) {
            return picked;
        }
    }
    // 第二轮起：按桶内张数从多到少补，让常驻地点更密
    const sizeOf = (bucket: Bucket): number => bucket.photos.length;
    for (let round = 1; ; round++) {
        let added = false;
        for (const bucket of [...list].sort((a, b) => sizeOf(b) - sizeOf(a))) {
            const photo = bucket.photos[round];
            if (!photo) {
                continue;
            }
            if (!push(photo)) {
                return picked;
            }
            added = true;
        }
        if (!added) {
            return picked;
        }
    }
}
