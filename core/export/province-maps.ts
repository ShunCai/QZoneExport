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
}

/**
 * 下载并写入全国市级地图（单个文件）。
 * 已存在则跳过，重复备份不会重复下载。
 */
export async function exportChinaCitiesMap(
    writer: FileWriter,
    logger?: ProvinceMapLogger,
): Promise<CityMapExportResult> {
    try {
        if (await writer.exists(TARGET)) {
            return { mode: 'skipped', bytes: 0 };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const resp = await fetch(SOURCE_URL, { signal: controller.signal });
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status);
            }
            const geoJson = await resp.json();
            const script = buildChinaCitiesScript(geoJson);
            await writer.writeText(script, TARGET);
            logger?.info?.('全国市级地图已写入', { target: TARGET, mb: Math.round((script.length / 1024 / 1024) * 10) / 10 });
            return { mode: 'written', bytes: script.length };
        } finally {
            clearTimeout(timer);
        }
    } catch (error) {
        const reason = (error as Error)?.message || String(error);
        logger?.warn?.('全国市级地图导出失败（不影响查看器）', { reason });
        return { mode: 'failed', bytes: 0, reason };
    }
}
