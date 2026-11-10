<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import {
    NAlert, NButton, NEmpty, NInput, NRadioButton, NRadioGroup, NSelect, NSpin, NTag,
} from 'naive-ui';
import { formatTime, monthOf, timeValue } from '../data/format';
import { collectFootprints, topPlaceOf, visitCountOf, type Footprint } from '../data/footprints';
import { navigate, routeQuery } from '../router';
import { useTheme } from '../composables/useTheme';
import { usePrivacy } from '../composables/usePrivacy';
import { maskContent } from '../data/mask';
import { assignRegions, countByRegion, type RegionCount } from '../data/mapRegions';

/**
 * 足迹面板
 *
 * 五模块：概览统计条 / 筛选检索栏 / 足迹时间线列表（主体）/ 地图（概览）/ 空·错状态。
 * 地图实现沿用旧统计页：ECharts 平面地图 + 打卡散点 + 途径省份热力图，依赖从备份的
 * Common/vendor 下按需加载（不打开本页就不付这 ~2MB 代价）。
 *
 * 依赖是传统脚本（地图数据依赖全局 echarts 的 UMD 包），只能用 <script> 注入，故全局量以 declare 引用。
 */
interface EChartsMap {
    geoJson?: { type?: string; features?: any[] };
    specialAreas?: Record<string, unknown>;
}
interface EChartsInstance {
    setOption(option: any, opts?: { notMerge?: boolean }): void;
    resize(): void;
    dispose(): void;
    clear(): void;
    on(event: string, handler: (params: any) => void): void;
    dispatchAction(payload: any): void;
    getOption(): any;
}
interface EChartsStatic {
    init(el: HTMLElement, theme?: unknown, opts?: { width?: number; height?: number }): EChartsInstance;
    getMap(name: string): EChartsMap | undefined;
    registerMap(name: string, geoJson: any, specialAreas?: Record<string, unknown>): void;
}
interface MapNameConfig {
    KEY_TO_NAME: Record<string, string>;
}
declare const echarts: EChartsStatic;
declare const coordtransform: { gcj02towgs84(x: number, y: number): [number, number] };
declare const MAP_CONFIG_CHINA: MapNameConfig;
declare const MAP_CONFIG_WORLD: MapNameConfig;
declare const SHOW_NAME_ON_WORLD: { NAME_TO_KEY: Record<string, string> };

const { isDark } = useTheme();
const { hidden: hideSensitive } = usePrivacy();
/** 隐私模式：地点名/正文走全站统一的部分打码，缩略图直接不渲染（位置数据只留在本地） */
function displayPlace(name: string): string {
    return hideSensitive.value ? maskContent(name) : name;
}
function displayText(text: string): string {
    return hideSensitive.value ? maskContent(text) : text;
}

const chartEl = ref<HTMLElement | null>(null);
const chart = shallowRef<EChartsInstance | null>(null);
const loading = ref(true);
const dataError = ref('');
/** 地图依赖/渲染失败只影响右侧地图区，列表仍可用 */
const mapError = ref('');
const mapLoading = ref(true);
/** 'china' 中国地图 · 'world' 世界地图（取值即 registerMap 的地图名） */
const mapType = ref<'china' | 'world'>('china');

const footprints = ref<Footprint[]>([]);
const footprintCount = ref(0);
const regionCount = ref(0);
const earliest = ref<number | null>(null);
const latest = ref<number | null>(null);
const spanYears = ref(0);
/** 点击卡片/散点后的就地预览（不再直接跳走原文） */
const selected = ref<Footprint | null>(null);
const selectedVisits = ref(0);
function selectFootprint(fp: Footprint, visits = 0): void {
    selected.value = fp;
    selectedVisits.value = visits || visitCountOf(footprints.value, fp);
}
function closePreview(): void {
    selected.value = null;
}

/** 最常去的地点（按地点名聚合 Top1） */
const topPlace = computed(() => topPlaceOf(footprints.value));
function focusTopPlace(): void {
    if (topPlace.value) {
        regionFilter.value = topPlace.value.name;
    }
}

/** 展开全文的 tid 集合 */
const expandedIds = ref<Set<string>>(new Set());

// —— 筛选/排序状态 ——
const keyword = ref('');
const regionFilter = ref('');
const typeFilter = ref<'' | 'messages' | 'photos'>('');
const sortDir = ref<'desc' | 'asc'>('desc');
/** 省份/国家下钻：点地图区域后，列表与散点只留该区域 */
const drillRegion = ref('');
/** tid → 区域显示名（全量点算一次，避免筛选后归属缺失） */
const regionOf = ref<Map<string, string>>(new Map());
function matchesDrill(item: Footprint): boolean {
    return !drillRegion.value || regionOf.value.get(item.tid) === drillRegion.value;
}
function toggleDrill(name: string): void {
    drillRegion.value = drillRegion.value === name ? '' : name;
}
function clearDrill(): void {
    drillRegion.value = '';
}

/** 依赖脚本只加载一次（按 src 去重） */
const loadedScripts = new Set<string>();
function loadScript(src: string): Promise<void> {
    if (loadedScripts.has(src)) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.addEventListener('load', () => {
            loadedScripts.add(src);
            resolve();
        });
        script.addEventListener('error', () => reject(new Error('加载失败：' + src)));
        document.head.appendChild(script);
    });
}


/**
 * 只加载当前地图所需的依赖：默认中国图不再预载 world.js（约 404 KB），
 * 切到世界地图时再按需加载。config.js 含两套地图的名称映射，必须一起加载。
 */
async function ensureMapDeps(type: 'china' | 'world'): Promise<void> {
    await loadScript('./Common/vendor/echarts.min.js');
    await Promise.all([
        loadScript('./Common/vendor/coordtransform.min.js'),
        loadScript('./Common/vendor/maps/config.js'),
    ]);
    await loadScript(`./Common/vendor/maps/${type}.js`);
}



/** 区域归属统计已抽到 ../data/mapRegions.ts（纯函数 + bbox 粗筛，可单测） */

/** 由足迹计算概览统计（途经地区数用 distinct 地点名，不依赖地图数据，故可早于渲染显示） */
function computeStats(items: Footprint[]): void {
    footprintCount.value = items.length;
    regionCount.value = new Set(items.map((item) => item.name)).size;
    if (items.length === 0) {
        earliest.value = null;
        latest.value = null;
        spanYears.value = 0;
        return;
    }
    const times = items.map((item) => timeValue(item.time)).filter(Boolean).sort((a, b) => a - b);
    earliest.value = times[0]!;
    latest.value = times[times.length - 1]!;
    const y0 = new Date(times[0]!).getFullYear();
    const y1 = new Date(times[times.length - 1]!).getFullYear();
    spanYears.value = y1 - y0 + 1;
}

// —— 筛选 + 排序 + 分组 ——
const filtered = computed(() => {
    const word = keyword.value.trim().toLowerCase();
    return footprints.value.filter((item) => {
        if (typeFilter.value && item.source !== typeFilter.value) {
            return false;
        }
        if (regionFilter.value && item.name !== regionFilter.value) {
            return false;
        }
        if (drillRegion.value && !matchesDrill(item)) {
            return false;
        }
        if (drillRegion.value && !matchesDrill(item)) {
            return false;
        }
        if (word && !`${item.name} ${item.content}`.toLowerCase().includes(word)) {
            return false;
        }
        return true;
    });
});

const sorted = computed(() => {
    const arr = [...filtered.value];
    arr.sort((a, b) => {
        const diff = timeValue(a.time) - timeValue(b.time);
        return sortDir.value === 'desc' ? -diff : diff;
    });
    return arr;
});

/** 按「年月」分组（倒序：新的年月在前），组内顺序由 sorted 决定 */
const grouped = computed(() => {
    const map = new Map<string, Footprint[]>();
    for (const item of sorted.value) {
        const month = monthOf(item.time);
        if (!map.has(month)) {
            map.set(month, []);
        }
        map.get(month)!.push(item);
    }
    // 分组顺序必须跟随 sortDir：倒序(默认) newest 在前，正序 oldest 在前。
    // 旧实现硬编码 b[0].localeCompare(a[0])（恒倒序），导致点「时间↑」时月份分组不翻转、
    // 仅组内顺序变，整体看起来「排序没生效」。
    const groupCmp = sortDir.value === 'asc'
        ? (a: [string, Footprint[]], b: [string, Footprint[]]) => a[0].localeCompare(b[0])
        : (a: [string, Footprint[]], b: [string, Footprint[]]) => b[0].localeCompare(a[0]);
    return [...map.entries()]
        .sort(groupCmp)
        .map(([month, items]) => ({ month, items }));
});

// —— 列表分块渲染：千级打卡点不能一次全铺 DOM ——
const PAGE_CHUNK = 60;
const visibleCount = ref(PAGE_CHUNK);
/** 按年月分组结构截取前 N 条，保持分组标题连续 */
const renderedGroups = computed(() => {
    let left = visibleCount.value;
    const out: { month: string; items: Footprint[] }[] = [];
    for (const group of grouped.value) {
        if (left <= 0) {
            break;
        }
        const items = group.items.slice(0, left);
        out.push({ month: group.month, items });
        left -= items.length;
    }
    return out;
});
const renderedCount = computed(() => renderedGroups.value.reduce((sum, group) => sum + group.items.length, 0));
function onListScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200
        && renderedCount.value < filtered.value.length) {
        visibleCount.value = Math.min(filtered.value.length, visibleCount.value + PAGE_CHUNK);
    }
}

/** 地区筛选下拉：数据里实际出现的地点（去重排序） */
const regionOptions = computed(() => {
    const names = [...new Set(footprints.value.map((item) => item.name))].sort();
    return [{ label: '全部地点', value: '' }].concat(names.map((name) => ({ label: name, value: name })));
});

/** 类型筛选下拉：说说 / 相片（仅这两类带坐标） */
const typeOptions = [
    { label: '全部类型', value: '' },
    { label: '说说', value: 'messages' },
    { label: '相片', value: 'photos' },
];

/** 地图散点跟随全部筛选（含关键词），与左侧列表保持一致；重绘由防抖 watch 控制 */
const mapPoints = computed(() => {
    const word = keyword.value.trim().toLowerCase();
    return footprints.value.filter((item) => {
        if (typeFilter.value && item.source !== typeFilter.value) {
            return false;
        }
        if (regionFilter.value && item.name !== regionFilter.value) {
            return false;
        }
        if (word && !`${item.name} ${item.content}`.toLowerCase().includes(word)) {
            return false;
        }
        return true;
    });
});

let lastHighlighted: number | null = null;
function clearMapFocus(): void {
    if (!chart.value || lastHighlighted == null) {
        return;
    }
    chart.value.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: lastHighlighted });
    chart.value.dispatchAction({ type: 'hideTip' });
    lastHighlighted = null;
}

function isExpanded(tid: string): boolean {
    return expandedIds.value.has(tid);
}
function toggleExpand(tid: string): void {
    const next = new Set(expandedIds.value);
    if (next.has(tid)) {
        next.delete(tid);
    } else {
        next.add(tid);
    }
    expandedIds.value = next;
}
/** 点击卡片/散点：跳原文（说说→#/messages?id，相片→#/albums?id 所在相册） */
function openDetail(fp: Footprint): void {
    if (fp.source === 'photos' && fp.albumId) {
        navigate('albums', { id: fp.albumId, from: 'map' });
    } else {
        navigate('messages', { id: fp.tid, from: 'map' });
    }
}

/**
 * 区域统计缓存：射线法只与「地图类型 + 点集」有关，与主题/隐私/关键词无关。
 * 主题切换、隐私切换时直接复用，不重算 O(点 × 区域 × 顶点)。
 */
let regionAssignSig = '';
const regionCache = new Map<string, RegionCount[]>();
function regionSignature(points: Footprint[]): string {
    return [
        mapType.value, typeFilter.value, regionFilter.value,
        points.length, points[0]?.tid ?? '', points[points.length - 1]?.tid ?? '',
    ].join('|');
}

const pointIndexById = new Map<string, number>();

/**
 * 渲染地图
 *
 * 必须确保容器已有宽高：echarts 6 在 0×0 容器上会于 geo 坐标系内部抛
 * TypeError: Cannot read properties of null (reading '0')（resizeGeo → legacyCopyOverallTrans），
 * 而不是像 echarts 5 那样只告警。
 */
async function render(): Promise<void> {
    const el = chartEl.value;
    if (!el) {
        return;
    }
    const points = mapPoints.value;
    // 无足迹：不初始化图表，避免 0×0 容器抛错（页面已显式占位）
    if (points.length === 0) {
        chart.value?.dispose();
        chart.value = null;
        return;
    }
    if (!el.clientWidth || !el.clientHeight) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    // 复用实例：筛选 / 主题 / 隐私切换不再 dispose + init，click 事件只注册一次
    if (!chart.value) {
        const fallbackSize = (!el.clientWidth || !el.clientHeight) ? { width: 900, height: 520 } : undefined;
        chart.value = echarts.init(el, undefined, fallbackSize);
        chart.value.on('click', (params: any) => {
            if (params?.componentType === 'series' && params.seriesType === 'map'
                && params.name && params.name !== '南海诸岛') {
                toggleDrill(params.name);
                return;
            }
            const item: Footprint | undefined = params?.data?.item;
            if (item?.tid) {
                selectFootprint(item, params?.data?.count ?? 0);
            }
        });
    }

    const nameMap = mapType.value === 'world'
        ? (typeof MAP_CONFIG_WORLD === 'undefined' ? {} : MAP_CONFIG_WORLD.KEY_TO_NAME)
        : (typeof MAP_CONFIG_CHINA === 'undefined' ? {} : MAP_CONFIG_CHINA.KEY_TO_NAME);
    const showNameOnWorld = typeof SHOW_NAME_ON_WORLD === 'undefined' ? null : SHOW_NAME_ON_WORLD;

    // 国内地图用的是腾讯的火星坐标系（GCJ02），世界地图需转成 WGS84，否则整体偏移
    const plotted = mapType.value === 'world'
        ? points.map((item) => {
            const [posX, posY] = coordtransform.gcj02towgs84(item.posX, item.posY);
            return { ...item, posX, posY };
        })
        : points;

    const geoJson = echarts.getMap(mapType.value)?.geoJson;
    // 点 → 省/国家归属：按全量点算一次，供下钻筛选；世界地图需先转 WGS84
    const regionSig = `${mapType.value}|${footprints.value.length}`;
    if (regionSig !== regionAssignSig) {
        const base = mapType.value === 'world'
            ? footprints.value.map((item) => {
                const [x, y] = coordtransform.gcj02towgs84(item.posX, item.posY);
                return { tid: item.tid, posX: x, posY: y };
            })
            : footprints.value.map((item) => ({ tid: item.tid, posX: item.posX, posY: item.posY }));
        regionOf.value = assignRegions(base, geoJson, nameMap);
        regionAssignSig = regionSig;
    }
    const cacheKey = regionSignature(points);
    let regions = regionCache.get(cacheKey);
    if (!regions) {
        regions = countByRegion(plotted, geoJson, nameMap);
        regionCache.set(cacheKey, regions);
    }
    // 区域计数呈长尾（实测 1001 / 35 / 3…），直接线性映射会让除第一热点外全挤在最低色。
    // 这里用 log1p 压缩后作为色阶 value，raw 保留真实次数供 tooltip 显示。
    // 打卡点高度集中时（例如常年只在一个省），固定全国视图会浪费大半画布。
    // 按点集 bbox 自动聚焦；世界地图与全国分散的数据保持默认视图。
    let geoCenter: number[] = mapType.value === 'world' ? [5, 18] : [106.278179, 35.46637];
    let geoZoom = mapType.value === 'world' ? 1 : 1.5;
    const focusPoints = drillRegion.value
        ? plotted.filter((item) => regionOf.value.get(item.tid) === drillRegion.value)
        : plotted;
    if (mapType.value === 'china' && focusPoints.length > 3) {
        // 用 10%~90% 分位而非全量 min/max：少数跨省离群点不该把主视图拉回全国。
        const xs = focusPoints.map((item) => item.posX).sort((a, b) => a - b);
        const ys = focusPoints.map((item) => item.posY).sort((a, b) => a - b);
        const at = (arr: number[], ratio: number): number => arr[Math.floor((arr.length - 1) * ratio)]!;
        const loX = at(xs, 0.1), hiX = at(xs, 0.9);
        const loY = at(ys, 0.1), hiY = at(ys, 0.9);
        const spanX = hiX - loX, spanY = hiY - loY;
        if (spanX < 25 && spanY < 20) {
            geoCenter = [(loX + hiX) / 2, (loY + hiY) / 2];
            geoZoom = Math.min(4, Math.max(1.6, 20 / Math.max(spanX, spanY, 1)));
        }
    }

    const regionMax = Math.max(1, ...regions.map((region) => region.value));
    const regionData = regions.map((region) => ({
        name: region.name,
        value: Math.log1p(region.value),
        raw: region.value,
    }));
    // 同一坐标的多次打卡聚成一个气泡：大小反映密度，避免千点糊成一团
    const clusterMap = new Map<string, { item: Footprint; count: number; tids: string[] }>();
    for (const item of plotted) {
        const key = `${item.posX.toFixed(5)},${item.posY.toFixed(5)}`;
        const found = clusterMap.get(key);
        if (found) {
            found.count++;
            found.tids.push(item.tid);
        } else {
            clusterMap.set(key, { item, count: 1, tids: [item.tid] });
        }
    }
    const clusters = [...clusterMap.values()];
    pointIndexById.clear();
    clusters.forEach((cluster, index) => {
        for (const tid of cluster.tids) {
            pointIndexById.set(tid, index);
        }
    });

    chart.value.setOption({
        tooltip: { trigger: 'item', confine: true },
        toolbox: {
            show: true,
            feature: {
                ...(hideSensitive.value ? {} : { saveAsImage: { title: '截图分享' } }),
                restore: {},
            },
        },
        visualMap: [{
            type: 'continuous',
            min: 0,
            max: Math.log1p(regionMax),
            text: ['常驻', '逗留'],
            calculable: true,
            seriesIndex: 1,
            inRange: { color: ['lightskyblue', 'yellow', 'orangered'] },
        }],
        geo: [{
            map: mapType.value,
            roam: true,
            zoom: geoZoom,
            scaleLimit: { min: 1 },
            center: geoCenter,
            ...(isDark.value ? {
                itemStyle: { areaColor: '#1a1a24', borderColor: '#3a3a4a', borderWidth: 0.8 },
                emphasis: {
                    itemStyle: { areaColor: '#2a2a3a' },
                    label: { show: true, color: '#e0e0e0', formatter: (params: any) => params.name },
                },
            } : {
                // 浅灰陆地 + 明确省界：与浅蓝海面拉开对比，九段线也不会糊在背景里
                itemStyle: { areaColor: '#f1f4f8', borderColor: '#aebfd0', borderWidth: 0.8 },
                emphasis: {
                    itemStyle: { areaColor: '#e2ebf5' },
                    label: { show: true, color: '#334', formatter: (params: any) => params.name },
                },
            }),
            label: {
                show: true,
                color: isDark.value ? '#aaa' : undefined,
                formatter: (params: any) => {
                    if (mapType.value === 'world' && showNameOnWorld
                        && !Object.prototype.hasOwnProperty.call(showNameOnWorld.NAME_TO_KEY, params.name)) {
                        return '';
                    }
                    return params.name;
                },
            },
            emphasis: { label: { show: true, formatter: (params: any) => params.name } },
            // 南海诸岛/九段线要素保持可见（合规要素不可隐藏），仅小窗里不显示文字标签
            // 九段线要素单独描深蓝、加粗：之前与海面同色才「看不见」
            regions: [{
                name: '南海诸岛',
                label: { show: false },
                itemStyle: { areaColor: '#f7fbff', borderColor: '#1f5a99', borderWidth: 2 },
            }],
            nameMap,
        }],
        // 恒有一个 text 元素：切世界地图时文本置空（空数组在 notMerge 下会残留）
        graphic: [{
            type: 'text',
            right: '4%',
            bottom: '3%',
            silent: true,
            style: {
                text: mapType.value === 'china' ? '南海诸岛' : '',
                fill: '#1f4f7a',
                font: '600 12px sans-serif',
            },
        }],
        series: [
            {
                name: '打卡足迹',
                type: 'scatter',
                coordinateSystem: 'geo',
                geoIndex: 0,
                symbolSize: (_value: any, params: any) => Math.min(26, 7 + Math.sqrt(params.data.count) * 2.2),
                itemStyle: { color: isDark.value ? '#409eff' : '#007bff' },
                tooltip: {
                    formatter: (params: any) => {
                        const item: Footprint = params.data.item;
                        const lines = [`我的足迹：<b>${displayPlace(item.name)}</b>`];
                        if (params.data.count > 1) {
                            lines.push(`此处打卡 <b>${params.data.count}</b> 次`);
                        }
                        if (item.time) {
                            lines.push(`打卡时间：${formatTime(item.time)}`);
                        }
                        if (item.summary) {
                            lines.push(`${item.source === 'photos' ? '相片' : '说说'}：${displayText(item.summary)}`);
                        }
                        return lines.join('<br>');
                    },
                },
                data: clusters.map((cluster) => ({
                    name: cluster.item.name,
                    value: [cluster.item.posX, cluster.item.posY],
                    item: cluster.item,
                    count: cluster.count,
                })),
            },
            {
                name: '途径区域',
                type: 'map',
                geoIndex: 0,
                tooltip: {
                    formatter: (params: any) => {
                        const raw = params.data?.raw ?? 0;
                        if (!raw || raw < 1) {
                            return `还没去过 <b>${params.name}</b>`;
                        }
                        return `途径：<b>${params.name}</b><br>足迹：<b>${raw}</b> 处`;
                    },
                },
                data: regionData,
            },
        ],
    }, { notMerge: true });
}

/** 列表 hover / 选中时，让地图对应散点高亮并弹 tip（tid → dataIndex） */
function focusOnMap(tid: string): void {
    const idx = pointIndexById.get(tid);
    if (idx == null || !chart.value) {
        return;
    }
    if (lastHighlighted != null && lastHighlighted !== idx) {
        chart.value.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: lastHighlighted });
    }
    chart.value.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
    chart.value.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: idx });
    lastHighlighted = idx;
}

function onResize(): void {
    chart.value?.resize();
}

async function loadData(): Promise<void> {
    loading.value = true;
    dataError.value = '';
    try {
        const items = await collectFootprints();
        footprints.value = items;
        computeStats(items);
    } catch (err) {
        console.error('读取足迹数据失败', err);
        dataError.value = '读取足迹数据失败：' + ((err as Error).message || '未知错误');
    } finally {
        loading.value = false;
    }
}

async function initMap(): Promise<void> {
    if (dataError.value || mapPoints.value.length === 0) {
        mapLoading.value = false;
        return;
    }
    mapLoading.value = true;
    mapError.value = '';
    try {
        await ensureMapDeps(mapType.value);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await render();
        window.removeEventListener('resize', onResize);
        window.addEventListener('resize', onResize);
    } catch (err) {
        console.error('地图加载失败', err);
        mapError.value = (err as Error).message || '未知错误';
    } finally {
        mapLoading.value = false;
    }
}
function retryMap(): void {
    void initMap();
}
function retryData(): void {
    void loadData().then(() => {
        if (!dataError.value) {
            void initMap();
        }
    });
}

onMounted(async () => {
    // 渐进呈现：数据先出（统计条 + 列表），地图依赖与渲染单独加载
    await loadData();
    if (!dataError.value) {
        await initMap();
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    chart.value?.dispose();
});

watch(mapType, async () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value) {
        return;
    }
    try {
        await ensureMapDeps(mapType.value);
        await render();
    } catch (err) {
        console.error('切换地图失败', err);
        mapError.value = '切换地图失败：' + ((err as Error).message || '未知错误');
    }
});

watch(drillRegion, async () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value) {
        return;
    }
    try {
        await render();
    } catch (err) {
        console.error('下钻重绘地图失败', err);
    }
});

watch([typeFilter, regionFilter], async () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value || !chartEl.value) {
        return;
    }
    try {
        await render();
    } catch (err) {
        console.error('筛选重绘地图失败', err);
    }
});

/** 筛选状态写进 URL：刷新 / 分享链接可还原，与 ListPage 同款做法 */
function syncToUrl(): void {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, search = ''] = raw.split('?');
    if (!path) {
        return;
    }
    const params = new URLSearchParams(search);
    const put = (key: string, value: string): void => {
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
    };
    put('q', keyword.value.trim());
    put('type', typeFilter.value);
    put('region', regionFilter.value);
    put('dir', sortDir.value === 'asc' ? 'asc' : '');
    const next = params.toString();
    const target = '#/' + path + (next ? '?' + next : '');
    if (location.hash !== target) {
        history.replaceState(null, '', target);
    }
}
function applyFromUrl(query: Record<string, string>): void {
    keyword.value = query.q ?? '';
    typeFilter.value = query.type === 'messages' || query.type === 'photos' ? query.type : '';
    regionFilter.value = query.region ?? '';
    sortDir.value = query.dir === 'asc' ? 'asc' : 'desc';
}
applyFromUrl(routeQuery.value);
watch(() => routeQuery.value, (query) => applyFromUrl(query));

/** 关键词变化防抖重绘地图（不阻塞输入） */
let keywordTimer: number | undefined;
watch(keyword, () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value) {
        return;
    }
    window.clearTimeout(keywordTimer);
    keywordTimer = window.setTimeout(() => {
        render().catch((err) => console.error('关键词重绘地图失败', err));
    }, 250);
});

watch(hideSensitive, async () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value) {
        return;
    }
    try {
        await render();
    } catch (err) {
        console.error('隐私模式切换后重绘地图失败', err);
    }
});

watch([keyword, typeFilter, regionFilter, sortDir, drillRegion], () => {
    syncToUrl();
    visibleCount.value = PAGE_CHUNK;
    const el = document.querySelector('.list-scroll');
    if (el) {
        el.scrollTop = 0;
    }
});

watch(isDark, async () => {
    if (loading.value || dataError.value || mapLoading.value || mapError.value) {
        return;
    }
    try {
        await render();
    } catch (err) {
        console.error('主题切换后重新渲染地图失败', err);
    }
});
</script>

<template>
    <div class="page-head">
        足迹地图
        <span v-if="!loading && !dataError" class="head-count">
            共 {{ footprintCount }} 处打卡，途经 {{ regionCount }} 个{{ mapType === 'world' ? '国家/地区' : '省/市/区' }}
        </span>
        <n-radio-group v-model:value="mapType" size="small" class="switch">
            <n-radio-button value="china">中国</n-radio-button>
            <n-radio-button value="world">世界</n-radio-button>
        </n-radio-group>
    </div>

    <div class="page-body foot-body">
        <n-spin v-if="loading" size="large" class="foot-loading" />

        <n-alert v-else-if="dataError" type="warning" :show-icon="true" class="foot-error">
            {{ dataError }}
            <n-button size="small" class="foot-retry" @click="retryData">重试</n-button>
        </n-alert>

        <template v-else>
            <!-- 模块 A：概览统计条 -->
            <div class="stat-bar">
                <div class="stat-item">
                    <span class="stat-num">{{ footprintCount }}</span>
                    <span class="stat-label">处打卡</span>
                </div>
                <div class="stat-item">
                    <span class="stat-num">{{ regionCount }}</span>
                    <span class="stat-label">个地点</span>
                </div>
                <div class="stat-item">
                    <span class="stat-num">{{ earliest ? new Date(earliest).getFullYear() : '—' }}</span>
                    <span class="stat-label">最早</span>
                </div>
                <div class="stat-item">
                    <span class="stat-num">{{ latest ? new Date(latest).getFullYear() : '—' }}</span>
                    <span class="stat-label">最晚</span>
                </div>
                <div class="stat-item">
                    <span class="stat-num">{{ spanYears || '—' }}</span>
                    <span class="stat-label">跨度(年)</span>
                </div>
                <div class="stat-item stat-click" title="点击筛选到该地点" @click="focusTopPlace">
                    <span class="stat-num">{{ topPlace ? displayPlace(topPlace.name) : '—' }}</span>
                    <span class="stat-label">最常去 · {{ topPlace?.count || 0 }} 次</span>
                </div>
            </div>

            <div class="foot-layout">
                <!-- 模块 B + C：筛选栏 + 足迹时间线列表 -->
                <section class="foot-list">
                    <div class="toolbar">
                        <n-input
                            v-model:value="keyword"
                            placeholder="搜索地点 / 内容"
                            clearable
                            size="small"
                            style="width: 160px;"
                        />
                        <n-select
                            v-model:value="typeFilter"
                            :options="typeOptions"
                            size="small"
                            style="width: 110px;"
                        />
                        <n-select
                            v-model:value="regionFilter"
                            :options="regionOptions"
                            placeholder="全部地点"
                            clearable
                            size="small"
                            style="width: 150px;"
                        />
                        <n-radio-group v-model:value="sortDir" size="small">
                            <n-radio-button value="desc">时间↓</n-radio-button>
                            <n-radio-button value="asc">时间↑</n-radio-button>
                        </n-radio-group>
                    </div>

                    <div v-if="selected" class="fp-preview">
                        <div class="fp-preview-head">
                            <b>{{ displayPlace(selected.name) }}</b>
                            <span>
                                {{ selected.source === 'photos' ? '相片' : '说说' }} · {{ formatTime(selected.time) }}
                                <template v-if="selectedVisits > 1"> · 此处 {{ selectedVisits }} 次打卡</template>
                            </span>
                            <button type="button" class="fp-preview-close" @click="closePreview">×</button>
                        </div>
                        <div class="fp-preview-body">{{ displayText(selected.content || selected.summary) }}</div>
                        <img
                            v-if="selected.thumb && !hideSensitive"
                            :src="selected.thumb"
                            class="fp-preview-thumb"
                            alt=""
                        />
                        <div class="fp-preview-acts">
                            <n-button size="small" @click="closePreview">关闭</n-button>
                            <n-button size="small" type="primary" @click="openDetail(selected)">查看原文 →</n-button>
                        </div>
                    </div>

                    <div v-if="drillRegion" class="drill-badge">
                        已下钻 <b>{{ drillRegion }}</b>
                        <button type="button" @click="clearDrill">清除 ×</button>
                    </div>

                    <div class="list-scroll" @scroll="onListScroll">
                        <n-empty
                            v-if="filtered.length === 0"
                            description="没有符合条件的足迹"
                            class="list-empty"
                        />
                        <div v-for="group in renderedGroups" :key="group.month" class="month-group">
                            <div class="month-label">{{ group.month }}</div>
                            <div
                                v-for="item in group.items"
                                :key="item.tid"
                                class="fp-card"
                                :class="{ 'fp-card-sel': selected?.tid === item.tid }"
                                @click="selectFootprint(item)"
                                @mouseenter="focusOnMap(item.tid)"
                                @mouseleave="clearMapFocus"
                            >
                                <div class="fp-head">
                                    <n-tag size="small" :bordered="false" :type="item.source === 'photos' ? 'warning' : 'info'">{{ item.source === 'photos' ? '相片' : '说说' }}</n-tag>
                                    <n-tag size="small" :bordered="false" type="info">{{ displayPlace(item.name) }}</n-tag>
                                    <span class="fp-time">{{ formatTime(item.time) }}</span>
                                </div>
                                <div class="fp-content">
                                    {{ displayText(isExpanded(item.tid) ? item.content : item.summary) }}
                                    <n-button
                                        v-if="item.content.length > 80"
                                        text
                                        size="tiny"
                                        type="primary"
                                        class="fp-expand"
                                        @click.stop="toggleExpand(item.tid)"
                                    >{{ isExpanded(item.tid) ? '收起' : '展开' }}</n-button>
                                </div>
                                <img
                                    v-if="item.thumb && !hideSensitive"
                                    :src="item.thumb"
                                    class="fp-thumb"
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        </div>
                        <div v-if="renderedCount < filtered.length" class="list-more">
                            已显示 {{ renderedCount }} / {{ filtered.length }} 条 · 向下滚动加载更多
                        </div>
                    </div>
                </section>

                <!-- 模块 D：地图（概览） -->
                <section class="foot-map">
                    <div v-show="mapPoints.length > 0" ref="chartEl" class="map" />
                    <n-empty
                        v-if="mapPoints.length === 0 && !mapLoading && !mapError"
                        :description="footprintCount === 0 ? '本备份没有带位置的足迹（说说选择地点、或相片带上传/拍摄地点）' : '当前筛选条件下没有足迹'"
                        class="map-empty"
                    />
                    <n-spin v-if="mapLoading" size="medium" class="map-loading" />
                    <n-alert v-else-if="mapError" type="warning" :show-icon="true" class="map-error">
                        <div>地图加载失败：{{ mapError }}</div>
                        <div class="map-error-hint">
                            列表与统计仍可正常使用。若提示依赖缺失，可在助手设置页的「工具 → 升级已有备份」中选中本备份目录补齐地图依赖。
                        </div>
                        <n-button size="small" class="map-retry" @click="retryMap">重试加载地图</n-button>
                    </n-alert>
                </section>
            </div>
        </template>
    </div>
</template>

<style scoped src="../styles/map.css"></style>
