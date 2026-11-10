/**
 * 常驻城市统计（首页「常驻地点」卡的城市视角）
 *
 * 为什么不走逆地理编码：那需要腾讯地图 Key，只覆盖开了「刷新微信坐标」的用户。
 * 这里直接用内置的全国市级地图（china-cities，477 个市/区）做「坐标 → 城市」归属，
 * 零 key、零外部请求，所有备份都能算。
 *
 * 数据加载是懒的：首页不主动加载 3.7MB 的市级地图，等卡片真正需要时才注入脚本。
 * china-cities.js 由构建内置并在 UMD 包装里额外挂到 window.__QZE_CHINA_CITIES__，
 * 因此这里不依赖 echarts（首页没有 echarts）。
 */

import { loadList } from './sources';
import { YEAR_MODULES } from './counts';
import { countByCity, type MapPoint, type RegionCount } from './mapRegions';

const CITY_SCRIPT = './Common/vendor/maps/china-cities.js';

export interface CityRow {
    name: string;
    count: number;
    percent: number;
}

let cityGeoPromise: Promise<any | null> | null = null;

/** 懒加载全国市级地图数据（只加载一次） */
export function loadChinaCitiesGeoJson(): Promise<any | null> {
    if (cityGeoPromise) {
        return cityGeoPromise;
    }
    cityGeoPromise = new Promise((resolve) => {
        const holder = window as unknown as { __QZE_CHINA_CITIES__?: unknown };
        if (holder.__QZE_CHINA_CITIES__) {
            resolve(holder.__QZE_CHINA_CITIES__);
            return;
        }
        const script = document.createElement('script');
        script.src = CITY_SCRIPT;
        script.addEventListener('load', () => resolve(holder.__QZE_CHINA_CITIES__ || null));
        script.addEventListener('error', () => resolve(null));
        document.head.appendChild(script);
    });
    return cityGeoPromise;
}

/**
 * 合并两种来源的城市计数：
 *  - cityHint（腾讯逆地理编码给的 city，仅开启刷新的微信说说才有）优先
 *  - 其余按坐标归属到市（内置全国市级地图）
 */
export function mergeCityCounts(
    items: Array<{ cityHint?: string; posX: number; posY: number }>,
    geoJson: any,
): RegionCount[] {
    const counts = new Map<string, number>();
    const rest: MapPoint[] = [];
    for (const item of items) {
        const hint = (item.cityHint || '').trim();
        if (hint) {
            counts.set(hint, (counts.get(hint) || 0) + 1);
        } else {
            rest.push({ posX: item.posX, posY: item.posY });
        }
    }
    for (const region of countByCity(rest, geoJson)) {
        counts.set(region.name, (counts.get(region.name) || 0) + region.value);
    }
    return [...counts.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

/** 把按城市的计数转成卡片行（取前 n，带占比） */
export function toCityRows(counts: RegionCount[], n = 5): CityRow[] {
    const total = counts.reduce((sum, item) => sum + item.value, 0);
    return counts.slice(0, n).map((item) => ({
        name: item.name,
        count: item.value,
        percent: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }));
}

/** 收集所有带坐标的打卡点（说说带逆地理编码城市时一并返回，相片按实体键跨相册去重） */
async function collectPoints(): Promise<Array<{ cityHint?: string; posX: number; posY: number }>> {
    const points: Array<{ cityHint?: string; posX: number; posY: number }> = [];
    for (const mod of YEAR_MODULES) {
        const items = await loadList<Record<string, any>>(mod.key);
        for (const item of items) {
            const lbs = item.lbs;
            const x = Number(lbs?.pos_x);
            const y = Number(lbs?.pos_y);
            if (Number.isFinite(x) && Number.isFinite(y) && x !== 0 && y !== 0) {
                const address = item.custom_lbsInfo?.address_component;
                const cityHint = String(address?.city || address?.province || '').trim() || undefined;
                points.push({ posX: x, posY: y, cityHint });
            }
        }
    }

    const albums = await loadList<Record<string, any>>('albums');
    const seen = new Set<string>();
    for (const album of albums) {
        for (const photo of (album.photoList || []) as Record<string, any>[]) {
            const lbs = photo.custom_lbs || photo.lbs || photo.shootGeo;
            const x = Number(lbs?.pos_x);
            const y = Number(lbs?.pos_y);
            if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
                continue;
            }
            const key = photo.picKey != null
                ? String(photo.picKey)
                : (photo.lloc != null
                    ? String(photo.lloc)
                    : (photo.sloc != null
                        ? String(photo.sloc)
                        : `album:${album.id}:${photo.name || ''}`));
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            points.push({ posX: x, posY: y });
        }
    }
    return points;
}

/** 常驻城市 Top n（没有市级地图数据时返回空数组，卡片自动隐藏城市视角） */
export async function loadCityStats(n = 5): Promise<CityRow[]> {
    const geoJson = await loadChinaCitiesGeoJson();
    if (!geoJson) {
        return [];
    }
    const points = await collectPoints();
    return toCityRows(mergeCityCounts(points, geoJson), n);
}
