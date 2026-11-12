/**
 * 全国市级地图数据导出（足迹地图「点省 → 进入该省看下级市」）
 *
 * 数据来源：阿里云 DataV.GeoAtlas
 *   https://geo.datav.aliyun.com/areas_v3/bound/100000_full_city.json
 * 实测：3.87 MB、477 个要素、35 组（34 个省级 + 九段线），每个要素带
 * `properties.parent.adcode`（省级归属），因此**一个文件即可替代 33 个省级文件**：
 * 查看器点省时按 `parent.adcode` 切片注册成临时省级地图（见 MapPage.sliceProvince）。
 *
 * 相比逐省下载（33 次请求 / 33 个文件 / Firefox 需合并 all.js）：
 *  - 只下载 1 次，Chrome 与 Firefox 都是单文件，无需特殊分支
 *  - 体积 3.87 MB，与原 33 省合计 3.7 MB 基本持平
 *  - 附带 9 段线要素，全国视图也能用同一份数据
 *
 * 失败不阻断备份：缺失时查看器自动降级为「中国地图放大 + 筛选」。
 * 注意：DataV 数据源自高德开放平台（版本 2021.5），文件不附审图号、页面声明仅供学习交流，
 * 公开使用地图请对照自然资源部标准地图核对要素。
 */

import type { FileWriter } from '../fs/writer';

export interface ProvinceMapLogger {
    info?(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
    error?(...args: unknown[]): void;
}

/** 供手动准备的脚本/文档复用：33 个省级 adcode（DataV 无台湾 710000 的 _full 文件） */
export const PROVINCE_ADCODES: readonly number[] = [
    110000, 120000, 130000, 140000, 150000, 210000, 220000, 230000,
    310000, 320000, 330000, 340000, 350000, 360000, 370000,
    410000, 420000, 430000, 440000, 450000, 460000,
    500000, 510000, 520000, 530000, 540000,
    610000, 620000, 630000, 640000, 650000,
    810000, 820000,
];

const SOURCE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full_city.json';
const TARGET = 'Common/vendor/maps/china-cities.js';
const MAP_NAME = 'china-cities';
const FETCH_TIMEOUT_MS = 30000;

/** 生成「全国市级」UMD 脚本（与 viewer/map-vendor/maps/china.js 同款加载方式） */
export function buildChinaCitiesScript(geoJson: unknown): string {
    return '/* 全国市级地图 · 阿里云 DataV.GeoAtlas（高德开放平台 2021.5，不附审图号） */\n'
        + '(function(root, factory){'
        + "if(typeof define==='function'&&define.amd){define(['exports','echarts'],factory);}"
        + "else if(typeof exports==='object'&&typeof exports.nodeName!=='string'){factory(exports,require('echarts'));}"
        + 'else{factory({},root.echarts);}'
        + '}(this,function(exports,echarts){var data=' + JSON.stringify(geoJson) + ';'
        // 首页「常驻城市」不加载 echarts，需要从 window 取同一份数据
        + "if(typeof window!=='undefined'){window.__QZE_CHINA_CITIES__=data;}"
        + `if(echarts&&echarts.registerMap){echarts.registerMap('${MAP_NAME}',data);}`
        + '}));\n';
}

/** 生成单省 UMD（保留给「手动只放某几个省」的场景与测试） */
export function buildProvinceMapScript(adcode: number, geoJson: unknown): string {
    return `/* 省级地图 ${adcode} · 阿里云 DataV.GeoAtlas（不附审图号，公开使用请核对标准地图） */\n`
        + '(function(root, factory){'
        + "if(typeof define==='function'&&define.amd){define(['exports','echarts'],factory);}"
        + "else if(typeof exports==='object'&&typeof exports.nodeName!=='string'){factory(exports,require('echarts'));}"
        + 'else{factory({},root.echarts);}'
        + '}(this,function(exports,echarts){'
        + `if(echarts&&echarts.registerMap){echarts.registerMap('${adcode}',${JSON.stringify(geoJson)});}`
        + '}));\n';
}

export interface CityMapExportResult {
    /** written=新下载并写入；skipped=已存在；failed=下载/写入失败 */
    mode: 'written' | 'skipped' | 'failed';
    bytes: number;
    /** 失败原因（mode=failed 时有值） */
    reason?: string;
    /** 本次拿到的全国市级 geojson（供「市→区县」地图归属计算复用；仅 needGeoJson 时返回） */
    geoJson?: unknown;
}

export interface ChinaCitiesExportOptions {
    /** 即使文件已存在也重新下载 geojson（不重写文件）——「市→区县」归属计算需要原始数据 */
    needGeoJson?: boolean;
    /**
     * 拉取 DataV geojson 文本。页面上下文直连会带 qzone Referer 触发阿里云 403
     * （且 MV3 content script 受 CORS 约束），生产环境必须传 background 代理。
     */
    fetchText?: (url: string) => Promise<string>;
}

/**
 * 下载并写入全国市级地图（单个文件）。
 * 已存在则跳过，重复备份不会重复下载；needGeoJson 时额外返回 geojson 本体。
 */
export async function exportChinaCitiesMap(
    writer: FileWriter,
    logger?: ProvinceMapLogger,
    options?: ChinaCitiesExportOptions,
): Promise<CityMapExportResult> {
    const needGeoJson = !!options?.needGeoJson;
    try {
        const existed = await writer.exists(TARGET);
        if (existed && !needGeoJson) {
            return { mode: 'skipped', bytes: 0 };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            let rawText: string;
            if (options?.fetchText) {
                // 背景页代理：无 Referer（避开阿里云防盗链 403）、无 CORS 限制
                rawText = await options.fetchText(SOURCE_URL);
            } else {
                const resp = await fetch(SOURCE_URL, { signal: controller.signal });
                if (!resp.ok) {
                    throw new Error('HTTP ' + resp.status);
                }
                rawText = await resp.text();
            }
            const geoJson = JSON.parse(rawText);
            const script = buildChinaCitiesScript(geoJson);
            if (!existed) {
                await writer.writeText(script, TARGET);
                logger?.info?.('全国市级地图已写入', { target: TARGET, mb: Math.round((script.length / 1024 / 1024) * 10) / 10 });
            }
            return { mode: existed ? 'skipped' : 'written', bytes: script.length, geoJson };
        } finally {
            clearTimeout(timer);
        }
    } catch (error) {
        const reason = (error as Error)?.message || String(error);
        logger?.warn?.('全国市级地图导出失败（不影响查看器）', { reason });
        return { mode: 'failed', bytes: 0, reason };
    }
}

/* ==================== 市 → 区县地图（足迹地图第三级下钻） ==================== */

const DISTRICT_SOURCE_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound';

/** 射线法：点是否落在多边形内（坐标为 [lng, lat]） */
function pointInPolygon(lng: number, lat: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i++) {
        const sx = ring[i]![0]!;
        const sy = ring[i]![1]!;
        const tx = ring[j]![0]!;
        const ty = ring[j]![1]!;
        if ((sy < lat && ty >= lat) || (sy >= lat && ty < lat)) {
            const x = sx + (lat - sy) * (tx - sx) / (ty - sy);
            if (x > lng) {
                inside = !inside;
            }
        }
    }
    return inside;
}

export interface GeoPoint {
    posX: number;
    posY: number;
}

interface CityFeature {
    adcode: string;
    rings: number[][][];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/** 预处理市级要素：拍平 MultiPolygon、预算包围盒（bbox 粗筛用） */
function buildCityFeatures(chinaCities: unknown): CityFeature[] {
    const raw = (chinaCities as { features?: any[] })?.features || [];
    const out: CityFeature[] = [];
    for (const feature of raw) {
        const props = feature?.properties || {};
        const adcode = String(props.adcode || '');
        // 直辖市的区 level=district 且无下级：省级切片已含它们，不需要单独的区县文件
        if (!adcode || Number(props.childrenNum || 0) <= 0 || String(props.level || '') !== 'city') {
            continue;
        }
        const rings: number[][][] = (feature.geometry?.type === 'MultiPolygon'
            ? (feature.geometry?.coordinates || []).flatMap((item: number[][][]) => item)
            : (feature.geometry?.coordinates || [])) as number[][][];
        if (rings.length === 0) {
            continue;
        }
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const ring of rings) {
            for (const point of ring) {
                if (point[0]! < minX) minX = point[0]!;
                if (point[0]! > maxX) maxX = point[0]!;
                if (point[1]! < minY) minY = point[1]!;
                if (point[1]! > maxY) maxY = point[1]!;
            }
        }
        out.push({ adcode, rings, minX, maxX, minY, maxY });
    }
    return out;
}

/**
 * 从足迹点算出需要「区县地图」的市 adcode 列表
 *
 * 逐点做 bbox 粗筛 + 射线法，命中哪个市就记下哪个市；
 * 坐标失真（整数度 / 占位值）的点不在任何市边界内，天然被跳过。
 * 纯函数，便于单测。
 */
export function collectCityAdcodes(points: GeoPoint[], chinaCities: unknown): string[] {
    const cities = buildCityFeatures(chinaCities);
    const out = new Set<string>();
    for (const point of points) {
        for (const city of cities) {
            if (out.has(city.adcode)) {
                continue;
            }
            if (point.posX < city.minX || point.posX > city.maxX
                || point.posY < city.minY || point.posY > city.maxY) {
                continue;
            }
            if (city.rings.some((ring) => pointInPolygon(point.posX, point.posY, ring))) {
                out.add(city.adcode);
                break;
            }
        }
    }
    return [...out];
}

export interface DistrictMapsExportResult {
    written: number;
    skipped: number;
    failed: number;
}

export interface DistrictMapsExportOptions {
    adcodes: readonly string[];
    writer: FileWriter;
    /** 拉取 DataV geojson 文本（content 里走 background 代理避开 CORS） */
    fetchText: (url: string) => Promise<string>;
    logger?: ProvinceMapLogger;
    concurrency?: number;
}

/**
 * 按 adcode 列表下载「市 → 区县」地图并写入备份。
 * 已存在的文件跳过；单个失败不影响其余，也不阻断备份。
 */
export async function exportDistrictMaps(
    options: DistrictMapsExportOptions,
): Promise<DistrictMapsExportResult> {
    const { adcodes, writer, fetchText, logger } = options;
    if (adcodes.length === 0) {
        return { written: 0, skipped: 0, failed: 0 };
    }
    await writer.createFolder('Common/vendor/maps/provinces');
    let written = 0;
    let skipped = 0;
    let failed = 0;
    const queue = [...adcodes];
    const worker = async (): Promise<void> => {
        for (;;) {
            const adcode = queue.shift();
            if (!adcode) {
                return;
            }
            const target = `Common/vendor/maps/provinces/${adcode}.js`;
            try {
                if (await writer.exists(target)) {
                    skipped++;
                    continue;
                }
                const text = await fetchText(`${DISTRICT_SOURCE_BASE}/${adcode}_full.json`);
                const geoJson = JSON.parse(text);
                if (!geoJson?.features?.length) {
                    failed++;
                    logger?.warn?.('区县地图无下级要素', { adcode });
                    continue;
                }
                await writer.writeText(buildProvinceMapScript(Number(adcode), geoJson), target);
                written++;
            } catch (error) {
                failed++;
                logger?.warn?.('区县地图导出失败', { adcode, reason: (error as Error)?.message || String(error) });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 4, queue.length) }, worker));
    logger?.info?.('区县地图导出完成', { written, skipped, failed, total: adcodes.length });
    return { written, skipped, failed };
}

/** 组合：足迹点 → 市归属 → 区县地图导出（备份收尾一键调用） */
export async function exportDistrictMapsForPoints(
    writer: FileWriter,
    points: GeoPoint[],
    chinaCities: unknown,
    fetchText: (url: string) => Promise<string>,
    logger?: ProvinceMapLogger,
): Promise<DistrictMapsExportResult> {
    if (points.length === 0) {
        return { written: 0, skipped: 0, failed: 0 };
    }
    const adcodes = collectCityAdcodes(points, chinaCities);
    if (adcodes.length === 0) {
        return { written: 0, skipped: 0, failed: 0 };
    }
    logger?.info?.('按足迹归属补齐区县地图', { cities: adcodes.length });
    return exportDistrictMaps({ adcodes, writer, fetchText, logger });
}
