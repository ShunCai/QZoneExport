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
import { openImageLightbox } from '../data/lightbox';
import { assignRegions, countByCity, countByRegion, type RegionCount } from '../data/mapRegions';
import { ensureCityMapRegistered, loadChinaCitiesGeoJson, mergeCityCounts } from '../data/cityStats';
import { pickPhotoMarkers, type PhotoMarker } from '../data/photoMarkers';

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
    convertToPixel(finder: any, value: any): number[] | null;
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
/** 当前页播放的视频地址（空串=未打开） */
const previewVideo = ref('');

/**
 * 预览缩略图点击：图片走 PhotoSwipe 灯箱、视频走当前页弹层播放，
 * 不再 target="_blank" 把用户丢出查看器（file:// 下新标签还常触发路径/编码问题）。
 */
function openPreviewMedia(item: Footprint): void {
    const src = item.thumb;
    if (!src) return;
    if (/\.(mp4|m4v|mov|webm|avi|mkv|m3u8)(\?|$)/i.test(src)) {
        previewVideo.value = src;
        return;
    }
    void openImageLightbox([{ src, thumb: item.preview || src }]);
}
function closePreviewVideo(): void {
    previewVideo.value = '';
}
/**
 * 点散点后只看该坐标的全部足迹。
 * 相片常有「同一坐标连拍/连传多张」，它们在地图上永远重叠、放大也分不开；
 * 点一下就把这几条一起筛进列表，而不是只选中其中一条。
 */
const spotFilter = ref<string | null>(null);
/** 与散点聚合同一口径（5 位小数），否则浮点尾差会让「同位置 11 条」筛出 5 条 */
function spotKey(item: Footprint): string {
    return `${item.posX.toFixed(5)},${item.posY.toFixed(5)}`;
}
const spotCount = computed(() => {
    const spot = spotFilter.value;
    if (!spot) {
        return 0;
    }
    return footprints.value.filter((fp) => spotKey(fp) === spot).length;
});
function selectFootprint(fp: Footprint, visits = 0): void {
    selected.value = fp;
    selectedVisits.value = visits || visitCountOf(footprints.value, fp);
}
function closePreview(): void {
    selected.value = null;
}

/** 最常去的城市（按坐标归属到市，懒加载内置市级地图后计算；无数据时退回 POI 口径） */
const cityTop = ref<{ name: string; count: number } | null>(null);
async function loadCityTop(): Promise<void> {
    if (footprints.value.length === 0) {
        return;
    }
    const geoJson = await loadChinaCitiesGeoJson();
    if (!geoJson) {
        return;
    }
    // 市级地图这时才注册进 echarts：补算一次城市归属，否则统计条的「座城市」一直是 —
    updateCityAssign();
    const ranked = mergeCityCounts(footprints.value, geoJson);
    if (ranked.length > 0) {
        cityTop.value = { name: ranked[0]!.name, count: ranked[0]!.value };
    }
}

/** 最常去的地点（按地点名聚合 Top1） */
const topPlace = computed(() => topPlaceOf(footprints.value));
function focusTopPlace(): void {
    if (topPlace.value) {
        regionFilter.value = topPlace.value.name;
    }
}

// —— 相片图层：缩略图与散点共存，随缩放联动（放大后自动变密） ——
/** 全量上限：再多就既拖渲染也没可读性 */
const PHOTO_LIMIT = 200;
/** 当前 geo 的缩放值（漫游/缩放后由 georoam 回写） */
const geoZoomNow = ref(1.5);
/**
 * 等效缩放：省级/市级地图每张都是独立 bbox，默认 zoom=1 看的就已经是一座城，
 * 所以按 1 ≈ 全国图的 3.2 折算，避免进了市级视图反而看不到相片。
 */
const photoZoom = computed(() => (provinceMap.value ? Math.max(geoZoomNow.value, 1) * 3.2 : geoZoomNow.value));
/** 缩略图边长：放大后同步变大，最多 40px（再大就挡地图了） */
const photoSize = computed(() => Math.round(Math.min(40, Math.max(22, 18 + photoZoom.value * 2.2))));
/**
 * 允许的最小像素间距系数：缩得很小时按整张缩略图排（摊得开），
 * 放大后逐步放宽到 0.62 张，让常驻地点自然堆成一小摞——密度就是这么随缩放长出来的。
 */
const photoGapRatio = computed(() => {
    const zoom = photoZoom.value;
    if (zoom >= 6) {
        return 0.62;
    }
    if (zoom <= 3) {
        return 1;
    }
    return 1 - ((zoom - 3) / 3) * 0.38;
});
/** 本次最多铺几张：随缩放递增（24 → 200），上限 200 */
const photoQuota = computed(() => Math.min(PHOTO_LIMIT, Math.max(24, Math.round(photoZoom.value * 12))));
/** 铺在地图上的相片（near = 被挤到同一位置的相片张数，>1 时 tooltip 提示） */
interface ShownPhoto extends PhotoMarker {
    /** 同一坐标（完全重合）的相片张数，含自己——这类点无论放多大都分不开 */
    same: number;
    /** 像素上挨得近但坐标不同的张数——放大后会各自分开 */
    near: number;
}
/** 候选池上限：只防极端数据（上万张带坐标的相片），真正的显示上限是 PHOTO_LIMIT */
const PHOTO_POOL_LIMIT = 5000;
/** 所有可上图的相片（隐私模式下不上图：位置数据只留在本地） */
const photoPool = computed(() => (hideSensitive.value ? [] : pickPhotoMarkers(mapPoints.value, PHOTO_POOL_LIMIT)));
/**
 * 实际铺在地图上的相片：按「屏幕像素间距」抽稀，避免缩略图叠成一坨。
 * near = 被挤到同一位置的总张数（tooltip 里告诉用户这里还有多少张）。
 */
const photoShown = shallowRef<ShownPhoto[]>([]);

/** 展开全文的 tid 集合 */
const expandedIds = ref<Set<string>>(new Set());

// —— 筛选/排序状态 ——
const keyword = ref('');
const regionFilter = ref('');
const typeFilter = ref<'' | 'messages' | 'photos'>('');
const sortDir = ref<'desc' | 'asc'>('desc');
/** 省份/国家下钻：点地图区域后，列表与散点只留该区域 */
const drillRegion = ref('');
/** 省级地图（adcode）：数据驱动下钻，空=全国/世界 */
const provinceMap = ref('');
const provinceName = ref('');
/** 下钻层级栈（省 → 市 …），空表示全国/世界 */
const levels = ref<Array<{ adcode: string; name: string }>>([]);
/** 省级视图里再点市 → 按市筛（tid → 市名） */
const cityOf = ref<Map<string, string>>(new Map());
/** tid → 区县名（仅市级视图里按当前地图算，供「点区县」筛选） */
const countyOf = ref<Map<string, string>>(new Map());
const cityFilter = ref('');
/** tid → 区域显示名（全量点算一次，避免筛选后归属缺失） */
const regionOf = ref<Map<string, string>>(new Map());
function matchesDrill(item: Footprint): boolean {
    return !drillRegion.value || regionOf.value.get(item.tid) === drillRegion.value;
}
function toggleDrill(name: string): void {
    drillRegion.value = drillRegion.value === name ? '' : name;
}
function clearDrill(): void {
    if (cityFilter.value) {
        cityFilter.value = '';
        return;
    }
    spotFilter.value = null;
    drillRegion.value = '';
}

/** 从全国市级地图（china-cities）里按省级归属切出该省的市/区，注册成临时地图 */
function sliceProvince(adcode: string): void {
    ensureCityMapRegistered();
    const all = echarts.getMap('china-cities')?.geoJson;
    const features = (all?.features || []).filter(
        (f: any) => String(f.properties?.parent?.adcode) === adcode,
    );
    if (features.length) {
        echarts.registerMap(adcode, { type: 'FeatureCollection', features });
    }
}

/** 进入下一级：压栈、切图、重绘 */
/** 省级 adcode：末四位为 0000（110000 北京、440000 广东…） */
function isProvinceAdcode(adcode: string): boolean {
    return /^\d{2}0000$/.test(adcode);
}

function pushLevel(adcode: string, name: string): void {
    const firstEntry = levels.value.length === 0;
    levels.value = [...levels.value, { adcode, name }];
    provinceMap.value = adcode;
    provinceName.value = name;
    cityFilter.value = '';
    if (firstEntry && isProvinceAdcode(adcode)) {
        // 列表按「省」筛选只在第一次进入省级视图时设置（regionOf 是省归属）
        drillRegion.value = name;
    }
    void render();
}

/** 优先用本地 provinces/<adcode>.js（用户自己下的市级数据） */
async function enterLocalLevel(adcode: string, name: string): Promise<boolean> {
    if (!echarts.getMap(adcode)) {
        const ok = await loadScript(`./Common/vendor/maps/provinces/${adcode}.js`)
            .then(() => !!echarts.getMap(adcode))
            .catch(() => false);
        if (!ok) {
            return false;
        }
    }
    pushLevel(adcode, name);
    return true;
}

/** 全国 → 省：用内置 china-cities 按 parent.adcode 切片 */
async function enterProvinceFromCities(adcode: string, name: string): Promise<boolean> {
    if (!echarts.getMap('china-cities')) {
        const ok = await loadScript('./Common/vendor/maps/china-cities.js')
            .then(() => !!echarts.getMap('china-cities'))
            .catch(() => false);
        if (!ok) {
            return false;
        }
    }
    sliceProvince(adcode);
    if (!echarts.getMap(adcode)) {
        return false;
    }
    pushLevel(adcode, name);
    return true;
}

/**
 * 点地图区域：能进下一级就进（省 → 市 → 区县），否则降级
 * 降级行为：全国层 → 放大 + 筛列表；已在下级 → 按该区域名筛列表
 */
async function tryDrill(name: string): Promise<void> {
    const activeMap = provinceMap.value || mapType.value;
    const geo = echarts.getMap(activeMap)?.geoJson;
    const feature = geo?.features?.find((f: any) => {
        const raw = f.properties?.name || '';
        return raw === name || (MAP_CONFIG_CHINA.KEY_TO_NAME[raw] || '') === name;
    });
    const adcode = feature?.properties?.adcode ? String(feature.properties.adcode) : '';

    if (mapType.value === 'china' && adcode) {
        // 1) 本地已有/可下载的下一级数据（省文件或市文件）
        if (await enterLocalLevel(adcode, name)) {
            return;
        }
        // 2) 全国层点省：内置全国市级地图切片
        if (!provinceMap.value && await enterProvinceFromCities(adcode, name)) {
            return;
        }
    }

    if (!provinceMap.value) {
        toggleDrill(name);
    } else {
        cityFilter.value = cityFilter.value === name ? '' : name;
    }
}

/** 返回上一级（市 → 省 → 全国） */
function backOneLevel(): void {
    const next = levels.value.slice(0, -1);
    levels.value = next;
    const top = next[next.length - 1];
    provinceMap.value = top?.adcode || '';
    provinceName.value = top?.name || '';
    cityFilter.value = '';
    void render();
}

/**
 * 按城市名下钻：有该市下级数据 → 市级视图；否则进省视图并按城市筛选
 * 供首页「常驻城市」跳转使用
 */
async function applyCityParam(cityName: string): Promise<void> {
    const cities = await loadChinaCitiesGeoJson();
    // 首页先加载过市级地图（当时无 echarts）时，这里补注册，否则下面的城市归属表为空
    ensureCityMapRegistered();
    const feature = cities?.features?.find((f: any) => f.properties?.name === cityName);
    const adcode = feature?.properties?.adcode ? String(feature.properties.adcode) : '';
    const parentAdcode = feature?.properties?.parent?.adcode ? String(feature.properties.parent.adcode) : '';
    if (!adcode) {
        return;
    }
    // 1) 有该市的区县数据 → 直接进入市级视图，并按该市筛选列表
    if (await enterLocalLevel(adcode, cityName)) {
        cityFilter.value = cityName;
        await render();
        return;
    }
    // 2) 退一步：进省级视图，再按城市筛选（省级视图的 cityOf 已按市归属）
    if (parentAdcode) {
        const national = echarts.getMap('china')?.geoJson;
        const province = national?.features?.find((f: any) => String(f.properties?.adcode) === parentAdcode);
        const provinceName = province?.properties?.name || '';
        if (await enterProvinceFromCities(parentAdcode, provinceName)) {
            cityFilter.value = cityName;
            await render();
        }
    }
}

function backToChina(): void {
    levels.value = [];
    provinceMap.value = '';
    provinceName.value = '';
    cityFilter.value = '';
    drillRegion.value = '';
    spotFilter.value = null;
    void render();
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

/**
 * 统计条的地域/时间口径
 *
 * regionOf / cityOf 是 render() 里按**全量**足迹算的 tid → 省/市归属（不随筛选变化），
 * 地图依赖没加载完时为空，此时显示「—」而不是误导性的 0。
 */
const provinceCount = computed(() => (
    regionOf.value.size === 0
        ? '—'
        : new Set([...regionOf.value.values()].filter(Boolean)).size
));
const cityCount = computed(() => (
    cityOf.value.size === 0
        ? '—'
        : new Set([...cityOf.value.values()].filter(Boolean)).size
));
/** 三个时间格子合并成一格：保留「带坐标足迹」独有的时间跨度，又不和概览页三格重复 */
const timeSummary = computed(() => (
    earliest.value && latest.value
        ? `${new Date(earliest.value).getFullYear()}–${new Date(latest.value).getFullYear()}`
        : '—'
));

// —— 筛选 + 排序 + 分组 ——
const filtered = computed(() => {
    const word = keyword.value.trim().toLowerCase();
    return footprints.value.filter((item) => {
        if (spotFilter.value && spotKey(item) !== spotFilter.value) {
            return false;
        }
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
        if (cityFilter.value
            && cityOf.value.get(item.tid) !== cityFilter.value
            && countyOf.value.get(item.tid) !== cityFilter.value) {
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
        // 坐标被 QQ 截成整数（如 110, 21）的点不参与地图定位：位置毫无意义，
        // 画上去会与列表里写的地点名（如「茂名市高州市」）严重矛盾
        if (item.coarse) {
            return false;
        }
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

/** 参与地域归属的点：剔除粗坐标（否则会把高州的点算进雷州市，省份/城市数也会虚高） */
const locatedFootprints = computed(() => footprints.value.filter((item) => !item.coarse));

let lastHighlighted: number | null = null;
let lastHighlightedPhoto: number | null = null;
function clearMapFocus(): void {
    if (!chart.value) {
        return;
    }
    if (lastHighlighted != null) {
        chart.value.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: lastHighlighted });
    }
    if (lastHighlightedPhoto != null) {
        chart.value.dispatchAction({ type: 'downplay', seriesIndex: PHOTO_SERIES_INDEX, dataIndex: lastHighlightedPhoto });
        lastHighlightedPhoto = null;
    }
    if (lastHighlighted != null) {
        chart.value.dispatchAction({ type: 'hideTip' });
        lastHighlighted = null;
    }
}

function canExpand(item: Footprint): boolean {
    // 有表情/图片 token 时也要能展开（clamp 可能藏住图片）
    return item.content.length > 80 || item.html.includes('<img');
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
let cityAssignSig = '';
let countyAssignSig = '';

/**
 * tid → 市名：始终按全国市级地图算（与当前视图无关），
 * 这样「从首页跳转到某市」和「省级视图点市」都能按同一个口径筛列表。
 *
 * 市级地图是懒加载的，常常在首帧 render() 之后才注册进 echarts；
 * 所以除 render() 外，loadCityTop() 拿到数据后也要调一次，
 * 否则 cityOf 一直为空，城市筛选与统计条的「座城市」都出不来。
 */
function updateCityAssign(): void {
    if (typeof echarts === 'undefined') {
        return;
    }
    ensureCityMapRegistered();
    const cities = echarts.getMap('china-cities')?.geoJson;
    const sig = `${footprints.value.length}`;
    if (!cities || sig === cityAssignSig) {
        return;
    }
    cityOf.value = assignRegions(
        locatedFootprints.value.map((item) => ({ tid: item.tid, posX: item.posX, posY: item.posY })),
        cities,
        {},
    );
    cityAssignSig = sig;
}
const regionCache = new Map<string, RegionCount[]>();
function regionSignature(points: Footprint[]): string {
    return [
        mapType.value, typeFilter.value, regionFilter.value,
        points.length, points[0]?.tid ?? '', points[points.length - 1]?.tid ?? '',
    ].join('|');
}

const pointIndexById = new Map<string, number>();
/** 相片图层：ECharts 系列 id（缩放时只增量更新这一层，不整体 setOption） */
const PHOTO_SERIES_ID = 'photo-layer';
/** 系列顺序：0 散点 · 1 途径区域（visualMap.seriesIndex 依赖此下标）· 2 相片 */
const PHOTO_SERIES_INDEX = 2;
const photoIndexById = new Map<string, number>();

function photoSeriesData(): any[] {
    photoIndexById.clear();
    return photoShown.value.map((marker, index) => {
        photoIndexById.set(marker.tid, index);
        return {
            name: marker.item.name,
            value: [marker.posX, marker.posY],
            item: marker.item,
            preview: marker.preview,
            same: marker.same,
            near: marker.near,
            albumId: marker.albumId,
        };
    });
}

/** 相片层只更新自己这一个系列，不重算区域统计、不重置视野 */
function syncPhotoLayer(): void {
    const instance = chart.value;
    if (!instance) {
        return;
    }
    instance.setOption({
        series: [{
            id: PHOTO_SERIES_ID,
            symbolSize: photoSize.value,
            data: photoSeriesData(),
        }],
    });
}

/**
 * 相片坐标 → 当前地图坐标系。
 * 与散点同口径：世界地图要转 WGS84，否则整体偏移；省级/市级地图仍是 GCJ02。
 */
function photoPlotPoint(x: number, y: number): [number, number] {
    if (mapType.value === 'world' && !provinceMap.value) {
        const [tx, ty] = coordtransform.gcj02towgs84(x, y);
        return [tx, ty];
    }
    return [x, y];
}

/**
 * 重挑当前视野能铺下的相片。
 *
 * 按时间倒序遍历候选，逐个换算成屏幕像素：与已选点的间距不足「边距 × 系数」就跳过，
 * 并把被挤掉的张数记到最近那张头上（tooltip 里显示「此处共 N 张」）。
 * 系数随缩放放宽 + 配额随放大提高，于是「放大 → 露出更多相片」自然成立。
 */
function refreshPhotoLayer(): void {
    const instance = chart.value;
    if (!instance) {
        photoShown.value = [];
        return;
    }
    const pool = photoPool.value;
    if (pool.length === 0) {
        photoShown.value = [];
        syncPhotoLayer();
        return;
    }
    const gap = Math.max(8, photoSize.value * photoGapRatio.value);
    const gapSq = gap * gap;
    const quota = photoQuota.value;
    const picked: ShownPhoto[] = [];
    const px: Array<{ x: number; y: number }> = [];
    for (const marker of pool) {
        if (picked.length >= quota) {
            break;
        }
        const [plotX, plotY] = photoPlotPoint(marker.posX, marker.posY);
        let point: number[] | null = null;
        try {
            point = instance.convertToPixel({ geoIndex: 0 }, [plotX, plotY]);
        } catch {
            point = null;
        }
        if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
            continue;
        }
        const x = point[0] as number;
        const y = point[1] as number;
        let nearest = -1;
        for (let i = 0; i < px.length; i++) {
            const dx = px[i]!.x - x;
            const dy = px[i]!.y - y;
            if (dx * dx + dy * dy < gapSq) {
                nearest = i;
                break;
            }
        }
        if (nearest >= 0) {
            const target = picked[nearest]!;
            // 坐标完全相同的点永远不会被放大分开，单独计数，别再骗用户「放大可分开」
            if (marker.posX === target.posX && marker.posY === target.posY) {
                target.same++;
            } else {
                target.near++;
            }
            continue;
        }
        px.push({ x, y });
        picked.push({ ...marker, posX: plotX, posY: plotY, same: 1, near: 0 });
    }
    photoShown.value = picked;
    syncPhotoLayer();
}

let zoomTimer: number | undefined;
/** georoam 会高频触发：合并到 160ms 一次 */
function schedulePhotoLayerSync(): void {
    window.clearTimeout(zoomTimer);
    zoomTimer = window.setTimeout(() => {
        const raw = Number(chart.value?.getOption()?.geo?.[0]?.zoom);
        if (Number.isFinite(raw)) {
            const next = Math.round(raw * 100) / 100;
            if (Math.abs(next - geoZoomNow.value) >= 0.01) {
                geoZoomNow.value = next;
            }
        }
        // 纯平移也会改变屏幕间距，所以 zoom 没变也要重挑
        refreshPhotoLayer();
    }, 160);
}

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
                void tryDrill(params.name);
                return;
            }
            const item: Footprint | undefined = params?.data?.item;
            if (item?.tid) {
                // 同坐标多条时把列表筛到该位置：否则点一次只能看到其中一条，
                // 而它们在地图上永远重叠（坐标完全相同），用户会以为「只剩一张」
                const key = spotKey(item);
                const sameSpot = footprints.value.filter((fp) => spotKey(fp) === key);
                spotFilter.value = sameSpot.length > 1 ? key : null;
                selectFootprint(item, params?.data?.count ?? 0);
            }
        });
        // 缩放 → 相片图层密度/尺寸联动（只在缩放变化后更新相片层）
        chart.value.on('georoam', () => schedulePhotoLayerSync());
    }

    // 省级地图（数据驱动下钻）用原始市级名称，不做简称映射
    const activeMap = provinceMap.value || mapType.value;
    const nationalNameMap = mapType.value === 'world'
        ? (typeof MAP_CONFIG_WORLD === 'undefined' ? {} : MAP_CONFIG_WORLD.KEY_TO_NAME)
        : (typeof MAP_CONFIG_CHINA === 'undefined' ? {} : MAP_CONFIG_CHINA.KEY_TO_NAME);
    const nameMap = provinceMap.value ? {} : nationalNameMap;
    const showNameOnWorld = typeof SHOW_NAME_ON_WORLD === 'undefined' ? null : SHOW_NAME_ON_WORLD;

    // 国内地图用的是腾讯的火星坐标系（GCJ02），世界地图需转成 WGS84，否则整体偏移
    const plotted = mapType.value === 'world' && !provinceMap.value
        ? points.map((item) => {
            const [posX, posY] = coordtransform.gcj02towgs84(item.posX, item.posY);
            return { ...item, posX, posY };
        })
        : points;

    const geoJson = echarts.getMap(activeMap)?.geoJson;
    const nationalGeo = echarts.getMap(mapType.value)?.geoJson;
    // 点 → 省/国家归属：始终按全国/世界地图算，省级视图只改显示、不改列表筛选口径
    const regionSig = `${mapType.value}|${footprints.value.length}`;
    if (regionSig !== regionAssignSig) {
        const base = mapType.value === 'world'
            ? locatedFootprints.value.map((item) => {
                const [x, y] = coordtransform.gcj02towgs84(item.posX, item.posY);
                return { tid: item.tid, posX: x, posY: y };
            })
            : locatedFootprints.value.map((item) => ({ tid: item.tid, posX: item.posX, posY: item.posY }));
        regionOf.value = assignRegions(base, nationalGeo, nationalNameMap);
        regionAssignSig = regionSig;
    }
    // tid → 市名：按全国市级地图算，无论当前是哪个下钻视图
    updateCityAssign();
    // 市级视图（当前地图不是省级）里按当前地图建立 tid → 区县名，供「点区县」筛选。
    // 注意不能用 levels 长度判断：从首页直接跳某市时 levels 只有 1 层（省这一层被跳过）。
    const countyView = !!provinceMap.value && !isProvinceAdcode(provinceMap.value);
    const countySig = `${activeMap}|${footprints.value.length}`;
    if (countyView && countySig !== countyAssignSig) {
        countyOf.value = assignRegions(
            locatedFootprints.value.map((item) => ({ tid: item.tid, posX: item.posX, posY: item.posY })),
            geoJson,
            {},
        );
        countyAssignSig = countySig;
    } else if (!countyView && countyOf.value.size > 0) {
        countyOf.value = new Map();
        countyAssignSig = '';
    }
    const cacheKey = `${regionSignature(points)}|${activeMap}`;
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
    // 下钻时按省份自身中心放大，点再少也生效（之前只看打卡点数 >3，湖南 3 条就不放大）
    if (drillRegion.value) {
        const feature = geoJson?.features?.find((f: any) => {
            const raw = f.properties?.name;
            return raw && (nameMap[raw] || raw) === drillRegion.value;
        });
        const center = feature?.properties?.center || feature?.properties?.centroid;
        if (center) {
            geoCenter = center;
            // 真正放大到省级视图；不能被后面的常规自适应覆盖
            geoZoom = 5;
        }
    }
    if (mapType.value === 'china' && !drillRegion.value && focusPoints.length > 3) {
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
    // 本次渲染的初始缩放：漫游过后 geoZoomNow 会被 georoam 回写，重绘时按新视图重置
    geoZoomNow.value = provinceMap.value ? 1 : geoZoom;
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
            inRange: { color: ['#e6f0f8', '#efd49a', '#e08a5c'] },
        }],
        geo: [{
            map: activeMap,
            roam: true,
            // 省级地图由 ECharts 按自身 bbox 自适应，不套用全国视图的 center/zoom
            ...(provinceMap.value ? {} : {
                zoom: geoZoom,
                scaleLimit: { min: 1 },
                center: geoCenter,
            }),
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
                    if (mapType.value === 'world' && !provinceMap.value && showNameOnWorld
                        && !Object.prototype.hasOwnProperty.call(showNameOnWorld.NAME_TO_KEY, params.name)) {
                        return '';
                    }
                    return params.name;
                },
            },
            emphasis: { label: { show: true, formatter: (params: any) => params.name } },
            // 南海诸岛/九段线要素保持可见（合规要素不可隐藏），仅小窗里不显示文字标签
            // 九段线要素单独描深蓝、加粗：之前与海面同色才「看不见」
            regions: [
                ...(!provinceMap.value ? [{
                    name: '南海诸岛',
                    label: { show: false },
                    itemStyle: { areaColor: '#f7fbff', borderColor: '#1f5a99', borderWidth: 2 },
                }] : []),
                ...(!provinceMap.value && drillRegion.value ? [{
                    name: drillRegion.value,
                    itemStyle: { borderColor: '#1f5a99', borderWidth: 2 },
                }] : []),
                ...(provinceMap.value && cityFilter.value ? [{
                    name: cityFilter.value,
                    itemStyle: { borderColor: '#1f5a99', borderWidth: 2 },
                }] : []),
            ],
            nameMap,
        }],
        // 恒有一个 text 元素：切世界地图时文本置空（空数组在 notMerge 下会残留）
        graphic: [{
            type: 'text',
            right: '4%',
            bottom: '3%',
            silent: true,
            style: {
                text: !provinceMap.value && mapType.value === 'china' ? '南海诸岛' : '',
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
            {
                // 相片图层：缩略图直接贴在地图上，与散点共存。
                // data 先留空，setOption 之后再按屏幕间距抽稀填充（见 refreshPhotoLayer）
                id: PHOTO_SERIES_ID,
                name: '相片',
                type: 'scatter',
                coordinateSystem: 'geo',
                geoIndex: 0,
                z: 10,
                symbol: (_value: any, params: any) => `image://${params?.data?.preview || ''}`,
                symbolSize: photoSize.value,
                itemStyle: {
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    shadowBlur: 8,
                    shadowColor: 'rgba(0, 0, 0, 0.28)',
                },
                emphasis: { itemStyle: { borderColor: '#1f5a99', borderWidth: 3 } },
                tooltip: {
                    formatter: (params: any) => {
                        const item: Footprint = params.data.item;
                        const lines = [
                            `我的相片：<b>${displayPlace(item.name)}</b>`,
                            `时间：${formatTime(item.time)}`,
                        ];
                        if ((params.data.same || 0) > 1) {
                            lines.push(`同位置共 <b>${params.data.same}</b> 张相片（坐标完全相同），点击左侧会一起列出`);
                        }
                        if ((params.data.near || 0) > 0) {
                            lines.push(`附近还有 <b>${params.data.near}</b> 张，放大可分开看`);
                        }
                        lines.push('<span style="opacity:.7">点击在左侧预览 · 缩略图可点开原图</span>');
                        return lines.join('<br>');
                    },
                },
                data: [],
            },
        ],
    }, { notMerge: true });
    // 视野刚变过：按新的像素间距重挑相片（缩略图不叠、放大更密）
    refreshPhotoLayer();
}

/** 列表 hover / 选中时，让地图对应散点高亮并弹 tip（tid → dataIndex） */
function focusOnMap(tid: string): void {
    if (!chart.value) {
        return;
    }
    const idx = pointIndexById.get(tid);
    if (idx != null) {
        if (lastHighlighted != null && lastHighlighted !== idx) {
            chart.value.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: lastHighlighted });
        }
        chart.value.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
        chart.value.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: idx });
        lastHighlighted = idx;
    }
    // 相片层也一起亮：列表里 hover 一张相片时，地图上的缩略图要能被找到
    const photoIdx = photoIndexById.get(tid);
    if (photoIdx != null) {
        if (lastHighlightedPhoto != null && lastHighlightedPhoto !== photoIdx) {
            chart.value.dispatchAction({ type: 'downplay', seriesIndex: PHOTO_SERIES_INDEX, dataIndex: lastHighlightedPhoto });
        }
        chart.value.dispatchAction({ type: 'highlight', seriesIndex: PHOTO_SERIES_INDEX, dataIndex: photoIdx });
        lastHighlightedPhoto = photoIdx;
    }
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
        // 统计条的「最常去城市」：懒加载内置市级地图后算一次，不阻塞地图渲染
        const idle = (window as any).requestIdleCallback || ((fn: () => void) => window.setTimeout(fn, 300));
        idle(() => {
            void loadCityTop().catch(() => { /* 无市级地图时保持 POI 口径 */ });
        });

        // 从「常驻城市」跳进来：自动下钻到该市（有区县数据）或进省并按城市筛选
        if (pendingCity.value) {
            const city = pendingCity.value;
            pendingCity.value = '';
            await applyCityParam(city);
        }
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
/** 从首页「常驻城市」跳进来时的待处理城市（地图未就绪前先存着） */
const pendingCity = ref('');

function applyFromUrl(query: Record<string, string>): void {
    pendingCity.value = query.city ?? '';
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
            <!-- 模块 A：概览统计条（口径都写在 title 里，免得「处打卡」被当成去重地点数） -->
            <div class="stat-bar">
                <div class="stat-item" title="带坐标的说说与相片总数：一条内容算一条，不去重；相片按实体键跨相册去重。坐标被截成整数的记录仍计入，但不参与地图定位与地域归属">
                    <span class="stat-num">{{ footprintCount }}</span>
                    <span class="stat-label">条足迹</span>
                </div>
                <div class="stat-item" title="按打卡地点名（POI）去重后的数量，不是城市也不是省份">
                    <span class="stat-num">{{ regionCount }}</span>
                    <span class="stat-label">个地点</span>
                </div>
                <div
                    class="stat-item"
                    :title="mapType === 'world' ? '按世界地图归属统计的国家/地区数' : '按全国地图归属统计的省级行政区数'"
                >
                    <span class="stat-num">{{ provinceCount }}</span>
                    <span class="stat-label">{{ mapType === 'world' ? '个国家/地区' : '个省份' }}</span>
                </div>
                <div class="stat-item" title="按内置全国市级地图归属的市级行政区数（仅境内坐标可归属）">
                    <span class="stat-num">{{ cityCount }}</span>
                    <span class="stat-label">座城市</span>
                </div>
                <div class="stat-item" title="只统计带坐标的足迹：说说取发表时间，相片取拍摄时间（拍摄优先、上传兜底）；与概览按全站发表时间/上传时间的口径不同">
                    <span class="stat-num">{{ timeSummary }}</span>
                    <span class="stat-label">足迹年份 · {{ spanYears || '—' }} 年</span>
                </div>
                <div v-if="cityTop" class="stat-item">
                    <span class="stat-num">{{ displayPlace(cityTop.name) }}</span>
                    <span class="stat-label">最常去城市 · {{ cityTop.count }} 次</span>
                </div>
                <div v-else class="stat-item stat-click" title="点击筛选到该地点" @click="focusTopPlace">
                    <span class="stat-num">{{ topPlace ? displayPlace(topPlace.name) : '—' }}</span>
                    <span class="stat-label">最常去 · {{ topPlace?.count || 0 }} 次</span>
                </div>
                <div v-if="!loading && !dataError" class="stat-hint">
                    <span class="stat-hint-main">{{ levels.length ? '继续点下一级可深入 · 再点同一区域取消筛选' : '按打卡时间排列 · 点地图省份可下钻' }}</span>
                    <button v-if="levels.length > 1" type="button" @click="backOneLevel">返回上一级</button>
                    <button v-if="levels.length" type="button" @click="backToChina">返回全国 ×</button>
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
                        <div v-if="selected.coarse" class="fp-preview-note">
                            这条记录只有粗略坐标（经纬度被截成整数），地图上未定位
                        </div>
                        <div class="fp-preview-body">
                            <span v-if="hideSensitive">{{ displayText(selected.content || selected.summary) }}</span>
                            <span v-else v-html="selected.html" />
                        </div>
                        <button
                            v-if="selected.thumb && !hideSensitive"
                            type="button"
                            class="fp-preview-thumb-link"
                            title="点击查看大图 / 播放视频"
                            @click="openPreviewMedia(selected)"
                        >
                            <!-- 视频相片的 thumb 是 .mp4 本体（不能当图片解码），预览一律优先 preview(.jpeg) -->
                            <img :src="selected.preview || selected.thumb" class="fp-preview-thumb" alt="" />
                        </button>
                        <div class="fp-preview-acts">
                            <n-button size="small" @click="closePreview">关闭</n-button>
                            <n-button size="small" type="primary" @click="openDetail(selected)">查看原文 →</n-button>
                        </div>
                    </div>
                    <!-- 当前页视频播放（点遮罩或 × 关闭，不再新开标签页） -->
                    <div v-if="previewVideo" class="fp-video-overlay" @click.self="closePreviewVideo">
                        <div class="fp-video-box">
                            <video :src="previewVideo" controls autoplay playsinline />
                            <button type="button" class="fp-video-close" @click="closePreviewVideo">×</button>
                        </div>
                    </div>

                    <div v-if="drillRegion || levels.length || spotFilter" class="drill-badge">
                        <template v-if="spotFilter">同位置 {{ spotCount }} 条足迹</template>
                        <template v-else>{{ levels.length ? levels.map((l) => l.name).join(' / ') + (cityFilter && cityFilter !== levels[levels.length - 1]?.name ? ' · ' + cityFilter : '') : '已下钻 ' + drillRegion }}</template>
                        <button v-if="spotFilter && !drillRegion && !levels.length" type="button" @click="spotFilter = null">清除筛选 ×</button>
                        <button v-else type="button" @click="clearDrill">清除筛选 ×</button>
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
                                    <n-tag v-if="item.coarse" size="small" :bordered="false" type="warning">位置粗略</n-tag>
                                    <span class="fp-time">{{ formatTime(item.time) }}</span>
                                </div>
                                <div class="fp-content">
                                    <div class="fp-text" :class="{ 'fp-clamped': !isExpanded(item.tid) }">
                                        <span v-if="hideSensitive">{{ displayText(item.content) }}</span>
                                        <span v-else v-html="item.html" />
                                    </div>
                                    <n-button
                                        v-if="canExpand(item)"
                                        text
                                        size="tiny"
                                        type="primary"
                                        class="fp-expand"
                                        @click.stop="toggleExpand(item.tid)"
                                    >{{ isExpanded(item.tid) ? '收起' : '展开' }}</n-button>
                                </div>
                                <img
                                    v-if="(item.preview || item.thumb) && !hideSensitive"
                                    :src="item.preview || item.thumb"
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
                    <div
                        v-if="!hideSensitive && photoPool.length && !mapLoading"
                        class="map-photo-hint"
                    >
                        <template v-if="photoShown.length === 0">放大可见相片</template>
                        <template v-else>相片 {{ photoShown.length }} 张 · 放大更密</template>
                    </div>
                    <div
                        class="map-footer"
                        :title="'底图来自阿里云 DataV.GeoAtlas（数据源高德开放平台，版本 2021.5）；文件不附审图号、页面声明仅供学习交流。公开使用含地图的截图或衍生产品前，请对照自然资源部标准地图核对国界、台湾与南海诸岛等要素。'"
                    >底图 © DataV.GeoAtlas（高德 2021.5）· 不附审图号 · 仅供学习交流</div>
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
