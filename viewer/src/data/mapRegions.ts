/**
 * 足迹地图的区域归属统计（纯函数，不依赖 ECharts / DOM，便于单测）
 *
 * 原实现内联在 MapPage.vue，且每次切换主题、筛选都会重新跑一遍射线法：
 * O(点数 × 区域数 × 顶点数)，在千级打卡点上是明显的主线程开销。
 * 这里把每个多边形环预计算包围盒，先用 bbox 粗筛再做精确射线判定。
 */

export interface MapPoint {
    posX: number;
    posY: number;
}

export interface RegionCount {
    name: string;
    value: number;
}

/** 带标识的点，用于建立「点 → 区域」归属（下钻筛选） */
export interface RegionPoint extends MapPoint {
    tid: string;
}

interface Ring {
    coords: number[][];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/** 射线法：点是否落在多边形内（坐标顺序为 [经度, 纬度]） */
export function inPolygon(point: [number, number], polygon: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i++) {
        const [sx, sy] = polygon[i]!;
        const [tx, ty] = polygon[j]!;
        if ((sx === point[0] && sy === point[1]) || (tx === point[0] && ty === point[1])) {
            return true;
        }
        if ((sy < point[1] && ty >= point[1]) || (sy >= point[1] && ty < point[1])) {
            const x = sx + (point[1] - sy) * (tx - sx) / (ty - sy);
            if (x === point[0]) {
                return true;
            }
            if (x > point[0]) {
                inside = !inside;
            }
        }
    }
    return inside;
}

function buildRings(feature: any): Ring[] {
    const rings: number[][][] = feature.geometry?.type === 'MultiPolygon'
        ? (feature.geometry.coordinates || []).flatMap((item: number[][][]) => item)
        : (feature.geometry?.coordinates || []);
    return rings
        .filter((ring) => Array.isArray(ring) && ring.length > 2)
        .map((ring) => {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const [x, y] of ring) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
            return { coords: ring, minX, maxX, minY, maxY };
        });
}

/**
 * 统计每个区域（省/国家）内的打卡数量。
 * geoJson 为已注册的地图 GeoJSON（由调用方从 echarts.getMap() 取），nameMap 用于区域名重映射。
 */
export function countByRegion(
    points: MapPoint[],
    geoJson: any,
    nameMap: Record<string, string> = {},
): RegionCount[] {
    if (!geoJson?.features) {
        return [];
    }
    const result: RegionCount[] = [];
    for (const feature of geoJson.features) {
        const name = feature.properties?.name;
        if (!name) {
            continue;
        }
        const rings = buildRings(feature);
        let count = 0;
        for (const point of points) {
            const x = point.posX;
            const y = point.posY;
            // bbox 粗筛：绝大多数区域可直接跳过，避免逐顶点射线判定
            const hit = rings.some((ring) => x >= ring.minX && x <= ring.maxX
                && y >= ring.minY && y <= ring.maxY
                && inPolygon([x, y], ring.coords));
            if (hit) {
                count++;
            }
        }
        result.push({ name: nameMap[name] || name, value: count });
    }
    return result;
}


/**
 * 建立「打卡点 tid → 区域显示名」映射，供省份/国家下钻筛选列表与散点。
 * 与 countByRegion 同一套 bbox 粗筛 + 射线判定，只在地图数据或点集变化时算一次。
 */
export function assignRegions(
    points: RegionPoint[],
    geoJson: any,
    nameMap: Record<string, string> = {},
): Map<string, string> {
    const result = new Map<string, string>();
    if (!geoJson?.features) {
        return result;
    }
    const regions: { name: string; rings: Ring[] }[] = geoJson.features
        .map((feature: any) => {
            const rawName = feature.properties?.name;
            return {
                name: rawName ? (nameMap[rawName] || rawName) : '',
                rings: buildRings(feature),
            };
        })
        .filter((region: { name: string; rings: Ring[] }) => !!region.name && region.rings.length > 0);

    for (const point of points) {
        const x = point.posX;
        const y = point.posY;
        for (const region of regions) {
            const hit = region.rings.some((ring) => x >= ring.minX && x <= ring.maxX
                && y >= ring.minY && y <= ring.maxY
                && inPolygon([x, y], ring.coords));
            if (hit) {
                result.set(point.tid, region.name);
                break;
            }
        }
    }
    return result;
}
