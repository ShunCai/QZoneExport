<script lang="ts">
/** 排序字段定义：调用方按需声明可排序的字段 */
export interface SortOption {
    /** 显示名，如「修改时间」「点赞数」 */
    label: string;
    /** 唯一 key */
    value: string;
    /** 排序取值（时间字段建议用 timeValue 归一，数量字段直接用数字） */
    valueOf: (item: Record<string, any>) => number;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton, NEmpty, NInput, NPagination, NPopover, NRadioButton, NRadioGroup, NSelect, NSpin } from 'naive-ui';
import { formatTime, timeValue } from '../data/format';
import { getModulePref, savePref, type ModuleDisplayPref } from '../data/displayPrefs';
import { routeQuery } from '../router';

/**
 * 列表页外壳
 * 各模块列表页的结构一致（标题 + 计数 + 年份/月份筛选 + 搜索 + 排序 + 分页），抽出来避免逐页重复；
 * 模块特有的筛选（如日志分类、收藏类型）由调用方把控件放进 toolbar 插槽、并传一个 filter 谓词；
 * 条目本身的渲染由调用方通过默认插槽提供。
 */
const props = withDefaults(defineProps<{
    title: string;
    items: Record<string, any>[];
    loading: boolean;
    /** 数据文件缺失时的提示（该模块未备份） */
    emptyHint: string;
    /** 取条目时间的字段，用于年/月筛选与排序；不传则两者都不显示 */
    timeOf?: (item: Record<string, any>) => number | string | undefined;
    /** 取条目可搜索文本；不传则不显示搜索框 */
    textOf?: (item: Record<string, any>) => string;
    /**
     * 参与搜索的评论内容
     *
     * 每条评论/回复返回一段可搜文本；不传则搜索只覆盖正文。
     * 评论命中时条目也算命中，但高亮只标正文里的关键词（评论区靠蓝底定位）。
     */
    commentsOf?: (item: Record<string, any>) => string[];
    /** 模块特有的额外筛选条件 */
    filter?: (item: Record<string, any>) => boolean;
    /**
     * 置顶判定（如日志的 effect 位 4）：置顶条目不受自定义排序控制，始终排在最前；
     * 同为置顶的按 timeOf 时间倒序。不传则无置顶逻辑。
     */
    topOf?: (item: Record<string, any>) => boolean;
    /** 排序下拉的时间叫法，如「发表时间」「收藏时间」（未传 sorts 时用于时间排序） */
    sortLabel?: string;
    /**
     * 可排序字段清单；不传则按 timeOf 做时间排序（兼容旧用法）。
     * 传了之后排序区显示「字段 + 升降序」两个下拉。
     */
    sorts?: SortOption[];
    pageSize?: number;
    /** 单位量词，如「条」「个」 */
    unit?: string;
    /**
     * 是否分页
     * 缩略图网格（如视频、相片）一屏能摆很多项，分页反而碎，此时关掉。
     */
    paginate?: boolean;
    /**
     * 展示偏好键：传入后，分页/瀑布流状态将按模块记忆在 localStorage，
     * 并在工具栏显示「分页 / 瀑布流」切换；不传则使用 paginate prop 默认值且不持久化。
     */
    prefKey?: string;
    /**
     * 需要定位到的条目：给出谓词，ListPage 会在**排序后的完整列表**里找到它、
     * 自动跳到它所在的那一页（瀑布流则追加到包含它的那一块）。
     * 用于从搜索结果跳进来时落到具体条目（如相册里的某张相片）。
     */
    focusItem?: (item: Record<string, any>) => boolean;
}>(), {
    pageSize: 20,
    unit: '条',
    sortLabel: '时间',
    paginate: true,
});

const keyword = ref('');
/** 输入框绑这个，防抖 250ms 后再喂给 keyword：避免每敲一个字就全量重过滤 + 重渲染 */
const keywordInput = ref('');
let keywordTimer: number | null = null;
watch(keywordInput, (value) => {
    if (keywordTimer !== null) {
        window.clearTimeout(keywordTimer);
    }
    keywordTimer = window.setTimeout(() => {
        keyword.value = value;
        keywordTimer = null;
    }, 250);
});
/**
 * 布局三态
 *
 * - paged：分页器翻页，单列
 * - plain：不分页——单列滚动加载（与瀑布流同一套分块，只是恒为 1 列）
 * - flow ：瀑布流——多列滚动加载，列数按宽度自适应
 *
 * plain 与 flow 共用分块逻辑（masonryRendered），差别只在列数；
 * 「不分页」绝不全量渲染——那是 9 万 DOM 卡顿的根源。
 */
type LayoutMode = 'paged' | 'plain' | 'flow';

function readSavedLayout(key: string | undefined, fallback: boolean): LayoutMode {
    if (key) {
        const saved = getModulePref(key) as ModuleDisplayPref & { layout?: string };
        if (saved.layout === 'paged' || saved.layout === 'plain' || saved.layout === 'flow') {
            return saved.layout;
        }
        // 旧偏好迁移：只有 paginate 布尔的时代，false 即瀑布流
        if (saved.paginate === false) {
            return 'flow';
        }
    }
    return fallback ? 'paged' : 'flow';
}

const layout = ref<LayoutMode>(readSavedLayout(props.prefKey, props.paginate));
watch(layout, (value) => {
    if (props.prefKey) {
        savePref(props.prefKey, { layout: value });
    }
    // 切换后回到第一页 / 第一块
    page.value = 1;
    masonryRendered.value = MASONRY_CHUNK;
    nextTick(setupMasonry);
});
/** 每页条数：默认取调用方给的 pageSize，用户改过则按模块记忆 */
/** 条目密度：紧凑档把卡片内边距/行高收紧（样式见 styles.css 的 .is-compact 组） */
const compact = ref(props.prefKey ? getModulePref(props.prefKey).compact : false);
watch(compact, (value) => {
    if (props.prefKey) {
        savePref(props.prefKey, { compact: value });
    }
});

/**
 * 工具栏窄屏折叠
 *
 * 内容区 <1200px 时把「月份 / 排序」收进「更多筛选」弹出面板，
 * 常驻行只留「形态 / 年份 / 布局 / 密度 / 搜索」；宽屏平铺不受影响。
 * 用 ResizeObserver 量工具栏自身宽度（分屏/改窗口都会触发）。
 */
const toolbarNarrow = ref(false);
const toolbarRef = ref<HTMLElement | null>(null);
let toolbarResize: ResizeObserver | null = null;
const moreFilterCount = computed(() => {
    let count = 0;
    if (monthNum.value) {
        count += 1;
    }
    if (effectiveSorts.value.length > 1 && sortField.value !== effectiveSorts.value[0]!.value) {
        count += 1;
    }
    if (sortDir.value !== 'desc') {
        count += 1;
    }
    return count;
});

const pageSize = ref(props.pageSize);
if (props.prefKey) {
    const saved = getModulePref(props.prefKey).pageSize;
    if (saved && saved > 0) {
        pageSize.value = saved;
    }
}
/** 可选的每页条数：把页面自己的默认值也并进来（相册按列数算出来的值不在常规档位里） */
const sizeOptions = computed(() => [...new Set([20, 50, 100, props.pageSize])].sort((a, b) => a - b));
watch(pageSize, (value) => {
    if (props.prefKey) {
        savePref(props.prefKey, { pageSize: value });
    }
    page.value = 1;
});

/** 年与月分开筛（空串表示不限）：先选年再选月，比一个「yyyy年MM月」长列表好翻 */
const year = ref('');
const monthNum = ref('');
const page = ref(1);

/** 取条目的年份、月份（两位），取不到时为空串 */
function yearOf(item: Record<string, any>): string {
    return props.timeOf ? formatTime(props.timeOf(item)).slice(0, 4) : '';
}
function monthOfItem(item: Record<string, any>): string {
    return props.timeOf ? formatTime(props.timeOf(item)).slice(5, 7) : '';
}

/** 年份选项：取自数据里实际出现的年份（降序），无数据的年份不列出来 */
const yearOptions = computed(() => {
    if (!props.timeOf) {
        return [];
    }
    const years = new Set<string>();
    for (const item of props.items) {
        const value = yearOf(item);
        if (value) {
            years.add(value);
        }
    }
    return [{ label: '全部年份', value: '' }]
        .concat([...years].sort().reverse().map((value) => ({ label: value + ' 年', value })));
});

/** 月份选项：只列出当前年份（未选年则全部）实际有数据的月份 */
const monthOptions = computed(() => {
    if (!props.timeOf) {
        return [];
    }
    const months = new Set<string>();
    for (const item of props.items) {
        if (year.value && yearOf(item) !== year.value) {
            continue;
        }
        const value = monthOfItem(item);
        if (value) {
            months.add(value);
        }
    }
    return [{ label: '全部月份', value: '' }]
        .concat([...months].sort().map((value) => ({ label: Number(value) + ' 月', value })));
});

const filtered = computed(() => props.items.filter((item) => {
    if (props.filter && !props.filter(item)) {
        return false;
    }
    if (props.timeOf) {
        if (year.value && yearOf(item) !== year.value) {
            return false;
        }
        if (monthNum.value && monthOfItem(item) !== monthNum.value) {
            return false;
        }
    }
    const word = keyword.value.trim().toLowerCase();
    if (!word) {
        return true;
    }
    if (!props.textOf && !props.commentsOf) {
        return true;
    }
    // 正文命中或评论命中都算该条命中（列表搜索默认覆盖评论）
    if (props.textOf && (props.textOf(item) || '').toLowerCase().includes(word)) {
        return true;
    }
    if (props.commentsOf && (props.commentsOf(item) || []).some((text) => (text ?? '').toLowerCase().includes(word))) {
        return true;
    }
    return false;
}));

/**
 * 排序：支持多字段 + 升降序（凡排序皆可正反向）。
 * 未传 sorts 时退回按 timeOf 时间排序，保持旧页面行为不变。
 */
const sortDir = ref<'desc' | 'asc'>(props.prefKey ? getModulePref(props.prefKey).sortDir : 'desc');
const sortField = ref(props.prefKey ? getModulePref(props.prefKey).sortField : '');

/** 实际生效的排序字段清单：优先用调用方的 sorts，否则由 timeOf 兜底出一个时间项 */
const effectiveSorts = computed<SortOption[]>(() => {
    if (props.sorts && props.sorts.length > 0) {
        return props.sorts;
    }
    if (props.timeOf) {
        const timeOf = props.timeOf;
        return [{ label: props.sortLabel, value: '__time__', valueOf: (item) => timeValue(timeOf(item)) }];
    }
    return [];
});

// 默认选中第一个排序字段
watch(effectiveSorts, (sorts) => {
    if (sorts.length > 0 && !sortField.value) {
        sortField.value = sorts[0]!.value;
    }
}, { immediate: true });

// 排序字段/方向变更后按模块持久化（与相册列表一致的排序记忆；仅在传入 prefKey 时生效）
watch(sortField, (v) => { if (props.prefKey) savePref(props.prefKey, { sortField: v }); });
watch(sortDir, (v) => { if (props.prefKey) savePref(props.prefKey, { sortDir: v }); });

const activeSort = computed(() => (
    effectiveSorts.value.find((s) => s.value === sortField.value) || effectiveSorts.value[0]
));

const sorted = computed(() => {
    const valueOf = activeSort.value?.valueOf;
    if (!valueOf) {
        return filtered.value;
    }
    // 不能直接排 filtered（那是 computed 的结果数组，sort 会原地修改它）
    return [...filtered.value].sort((a, b) => {
        // 置顶优先：置顶条目不受自定义排序控制，始终排在最前；同为置顶按时间倒序
        if (props.topOf) {
            const topA = props.topOf(a) ? 1 : 0;
            const topB = props.topOf(b) ? 1 : 0;
            if (topA !== topB) {
                return topB - topA;
            }
            if (topA === 1 && props.timeOf) {
                return timeValue(props.timeOf(b)) - timeValue(props.timeOf(a));
            }
        }
        const diff = valueOf(a) - valueOf(b);
        return sortDir.value === 'desc' ? -diff : diff;
    });
});

const dirOptions = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
];

/**
 * 瀑布流分块渲染
 *
 * 原先瀑布流是「不分页 = 全量渲染」：3072 条说说会一次铺出 9 万多 DOM，切过去要十几秒。
 * 现在按块增量渲染，滚动接近底部再追加；卡片仍按行优先分配到各列，
 * 阅读顺序保持「从左到右、从上到下」，追加时只长最后一列、不会顶走已看过的内容。
 */
const MASONRY_CHUNK = 150;
const masonryRendered = ref(MASONRY_CHUNK);
/** 列数按容器宽度自适应：每列不低于 420px，最多 3 列 */
const masonryCols = ref(1);
const contentRef = ref<HTMLElement | null>(null);
let masonryScrollEl: HTMLElement | null = null;
let masonryResize: ResizeObserver | null = null;

/**
 * 一次性定位：数据到位后跳到目标条目所在页。
 * 只执行一次——用户之后手动翻页不该被拉回去。
 */
let focusApplied = false;
watch(
    [() => props.focusItem, sorted, pageSize],
    () => {
        if (focusApplied || !props.focusItem) {
            return;
        }
        const index = sorted.value.findIndex((item) => props.focusItem!(item));
        if (index < 0) {
            return;
        }
        focusApplied = true;
        if (layout.value === 'paged') {
            page.value = Math.floor(index / pageSize.value) + 1;
        } else {
            const need = Math.ceil((index + 1) / MASONRY_CHUNK) * MASONRY_CHUNK;
            masonryRendered.value = Math.max(masonryRendered.value, Math.min(sorted.value.length, need));
        }
    },
    { immediate: true },
);

const paged = computed(() => {
    if (layout.value === 'paged') {
        return sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
    }
    // plain 与 flow 都走分块滚动加载，差别只在列数
    return sorted.value.slice(0, masonryRendered.value);
});

const masonryColumns = computed(() => {
    const cols = Math.max(1, masonryCols.value);
    if (cols === 1) {
        return [paged.value];
    }
    const out: Record<string, any>[][] = Array.from({ length: cols }, () => []);
    paged.value.forEach((item, index) => {
        out[index % cols]!.push(item);
    });
    return out;
});

const hasMoreMasonry = computed(() => layout.value !== 'paged' && sorted.value.length > paged.value.length);

function loadMoreMasonry(): void {
    masonryRendered.value = Math.min(sorted.value.length, masonryRendered.value + MASONRY_CHUNK);
}

/** 滚动到距底 600px 时预取下一块：滚动监听挂在真正滚动的 .page-body 上 */
function onMasonryScroll(): void {
    const el = masonryScrollEl;
    if (!el || layout.value === 'paged' || !hasMoreMasonry.value) {
        return;
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) {
        loadMoreMasonry();
    }
}

function teardownMasonry(): void {
    masonryResize?.disconnect();
    masonryResize = null;
    if (masonryScrollEl) {
        masonryScrollEl.removeEventListener('scroll', onMasonryScroll);
        masonryScrollEl = null;
    }
}

function setupMasonry(): void {
    teardownMasonry();
    if (layout.value === 'paged') {
        return;
    }
    const el = contentRef.value;
    if (!el) {
        return;
    }
    const measure = (): void => {
        const width = el.clientWidth || 0;
        if (width <= 0) {
            // 还没布局完：保持现值，等 ResizeObserver 下一轮再算，别把列数压成 1
            return;
        }
        if (layout.value === 'plain') {
            // 不分页：恒为单列
            masonryCols.value = 1;
            return;
        }
        // 每列不低于 420px：说说这类图文卡片在 3 列时九宫格会被压得太小，
        // 常规笔记本宽度（内容区 ~1100px）落到 2 列，大屏才 3 列
        masonryCols.value = Math.max(1, Math.min(3, Math.floor(width / 420)));
    };
    measure();
    masonryResize = new ResizeObserver(measure);
    masonryResize.observe(el);
    masonryScrollEl = (el.closest('.page-body') as HTMLElement | null) || null;
    masonryScrollEl?.addEventListener('scroll', onMasonryScroll, { passive: true });
}

/**
 * 列数测量依赖 DOM
 *
 * 必须同时监听 items：从 URL 恢复 layout=flow 时，paginate 在**数据加载完成前**就变成 false，
 * 那一刻 `.list-content` 还没渲染、contentRef 为 null，setup 直接返回且没挂上 ResizeObserver，
 * 结果列数永远是 1（看起来就像普通单列列表）。
 */
watch(
    [() => props.items.length],
    () => {
        masonryRendered.value = MASONRY_CHUNK;
        nextTick(setupMasonry);
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    teardownMasonry();
    if (keywordTimer !== null) {
        window.clearTimeout(keywordTimer);
    }
});

// 筛选与排序变化后回到第一页，否则可能停在一个已不存在的页码上
watch([keyword, year, monthNum, sortDir, sortField, () => props.filter], () => {
    page.value = 1;
    // 条件变了就回到第一块：否则停下的是「上一次筛选」的深度，容易看到空白
    masonryRendered.value = MASONRY_CHUNK;
});
// 每页条数变化（如媒体网格随屏宽调整列数）时，把超出新页数的页码钳回最后一页，避免显示空页
watch(pageSize, () => {
    const maxPage = Math.max(1, Math.ceil(filtered.value.length / pageSize.value));
    if (page.value > maxPage) {
        page.value = maxPage;
    }
});
// 切年份时清掉月份：旧月份在新年份里可能无数据，留着会让列表突然空掉
watch(year, () => {
    monthNum.value = '';
});
// 切页后回到顶部，长列表下翻页不至于停在页面底部
watch(page, () => {
    document.querySelector('.page-body')?.scrollTo({ top: 0 });
});

const maxPage = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));

/**
 * 键盘快捷键
 *
 * `/` 聚焦搜索、`Esc` 清空并失焦、`←/→` 翻页（仅分页态）。
 * 在输入框里打字时不拦截方向键与斜杠；全局搜索面板打开时也完全让位。
 */
function onListHotkey(event: KeyboardEvent): void {
    if (document.querySelector('.gs-panel')) {
        return;
    }
    const target = event.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === '/' && !typing && props.textOf) {
        const input = document.querySelector('.list-toolbar input[placeholder="搜索内容"]') as HTMLInputElement | null;
        if (input) {
            event.preventDefault();
            input.focus();
        }
        return;
    }
    if (event.key === 'Escape' && typing) {
        keywordInput.value = '';
        target?.blur();
        return;
    }
    if (typing || layout.value !== 'paged') {
        return;
    }
    if (event.key === 'ArrowLeft' && page.value > 1) {
        event.preventDefault();
        page.value -= 1;
    } else if (event.key === 'ArrowRight' && page.value < maxPage.value) {
        event.preventDefault();
        page.value += 1;
    }
}

onMounted(() => window.addEventListener('keydown', onListHotkey));
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onListHotkey);
    toolbarResize?.disconnect();
    toolbarResize = null;
});

/**
 * 工具栏宽度监测：驱动「更多筛选」折叠
 *
 * 用 watch(toolbarRef) 而不是 onMounted：工具栏在 items 加载完成的分支里，
 * mounted 那一刻还不存在——与瀑布流列数测量是同一个坑。
 */
watch(
    toolbarRef,
    (el) => {
        toolbarResize?.disconnect();
        toolbarResize = null;
        if (!el) {
            return;
        }
        const measure = (): void => {
            toolbarNarrow.value = (el.clientWidth || 0) < 1200;
        };
        measure();
        toolbarResize = new ResizeObserver(measure);
        toolbarResize.observe(el);
    },
    { immediate: true, flush: 'post' },
);

/* ===== 筛选状态与 URL 双向同步 ===== */
/**
 * 写回 URL
 *
 * 用 replaceState：筛选变化不该堆历史记录，浏览器返回仍回到上一个页面。
 * 只在参数真正变化时写，避免无谓的 history 操作。
 * 相册详情的 id / photo 等参数保持不动，只增删自己这几个键。
 */
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
    put('year', year.value);
    put('month', monthNum.value);
    put('sort', sortField.value);
    put('dir', sortDir.value === 'asc' ? 'asc' : '');
    put('layout', layout.value === 'paged' ? '' : layout.value);
    const next = params.toString();
    const target = '#/' + path + (next ? '?' + next : '');
    if (location.hash !== target) {
        history.replaceState(null, '', target);
    }
}

watch([keyword, year, monthNum, sortField, sortDir, layout], syncToUrl);

/**
 * 用 URL 参数覆盖当前筛选
 *
 * 分享链接、刷新、从详情页返回、以及**点左侧菜单重进同一模块**都走这里。
 * 月份放下一帧恢复，因为 year 的 watch 会主动清空 month（那是「用户切换年份」的语义）。
 */
function applyFromUrl(query: Record<string, string>): void {
    // 菜单点「说说」会把 hash 改回不带参数的 #/messages，此时必须把筛选清掉，
    // 否则界面还停在上一次的搜索结果、而 URL 已经干净了，两者对不上
    keywordInput.value = query.q ?? '';
    keyword.value = query.q ?? '';
    year.value = query.year ?? '';
    if (query.sort) {
        sortField.value = query.sort;
    }
    if (query.dir === 'asc' || query.dir === 'desc') {
        sortDir.value = query.dir;
    }
    if (query.layout === 'flow' || query.layout === 'plain') {
        layout.value = query.layout;
    } else if (query.layout === 'page') {
        layout.value = 'paged';
    }
    nextTick(() => {
        monthNum.value = query.month ?? '';
    });
}

applyFromUrl(routeQuery.value);

/**
 * 监听 URL 变化
 *
 * 同一路由下改 hash（点侧栏菜单、浏览器前进后退）不会重建组件，
 * 只靠 setup 里那一次调用会漏掉。自身的 syncToUrl 用 replaceState，不会触发这里，无循环风险。
 */
watch(() => routeQuery.value, (query) => applyFromUrl(query));
</script>

<template>
    <div class="page-head">
        <!-- 标题前置内容（如详情页的返回按钮） -->
        <slot name="head-prefix" />
        {{ props.title }}
        <span v-if="!props.loading && props.items.length > 0" class="head-count">
            共 {{ props.items.length }} {{ props.unit }}{{
                filtered.length !== props.items.length ? `，筛选出 ${filtered.length} ${props.unit}` : ''
            }}
        </span>
    </div>

    <div class="page-body">
        <!-- 列表之前的固定内容（如留言页的主人寄语），不参与筛选与分页 -->
        <slot name="lead" />

        <div v-if="props.loading" class="list-loading">
            <n-spin size="large" />
        </div>

        <!-- 该模块无数据（未备份或本来就空）：居中的“暂无数据”占位，而非告警条 -->
        <n-empty
            v-else-if="props.items.length === 0"
            :description="props.emptyHint"
            size="large"
            class="list-empty-full"
        />

        <template v-else>
            <div v-if="props.timeOf || props.textOf" ref="toolbarRef" class="list-toolbar" :class="{ 'is-narrow': toolbarNarrow }">
                <slot name="toolbar" />
                <div v-if="props.timeOf" class="toolbar-group">
                    <span class="toolbar-label">时间</span>
                    <n-select
                        v-model:value="year"
                        :options="yearOptions"
                        style="width: 110px;"
                    />
                    <n-select
                        v-if="!toolbarNarrow"
                        v-model:value="monthNum"
                        :options="monthOptions"
                        style="width: 110px;"
                    />
                </div>
                <div v-if="props.prefKey" class="toolbar-group">
                    <span class="toolbar-label">密度</span>
                    <n-select
                        v-model:value="compact"
                        :options="[{ label: '舒适', value: false }, { label: '紧凑', value: true }]"
                        size="small"
                        style="width: 88px;"
                    />
                </div>
                <n-popover v-if="toolbarNarrow && (props.timeOf || effectiveSorts.length > 0)" trigger="click" placement="bottom-end">
                    <template #trigger>
                        <n-button size="small" :type="moreFilterCount > 0 ? 'primary' : 'default'" ghost>
                            更多筛选{{ moreFilterCount > 0 ? ` · ${moreFilterCount}` : '' }}
                        </n-button>
                    </template>
                    <div class="toolbar-pop">
                        <div v-if="props.timeOf" class="toolbar-group">
                            <span class="toolbar-label">月份</span>
                            <n-select v-model:value="monthNum" :options="monthOptions" style="width: 110px;" />
                        </div>
                        <div v-if="effectiveSorts.length > 1" class="toolbar-group">
                            <span class="toolbar-label">排序</span>
                            <n-select v-model:value="sortField" :options="effectiveSorts.map((s) => ({ label: s.label, value: s.value }))" style="width: 130px;" />
                        </div>
                        <div v-if="effectiveSorts.length > 0" class="toolbar-group">
                            <span class="toolbar-label">方向</span>
                            <n-select v-model:value="sortDir" :options="dirOptions" style="width: 90px;" />
                        </div>
                    </div>
                </n-popover>
                <div class="toolbar-group to-right">
                    <div v-if="props.prefKey" class="toolbar-group">
                        <span class="toolbar-label">布局</span>
                        <n-select
                            v-model:value="layout"
                            :options="[
                                { label: '分页', value: 'paged' },
                                { label: '不分页', value: 'plain' },
                                { label: '瀑布流', value: 'flow' },
                            ]"
                            size="small"
                            style="width: 104px;"
                        />
                    </div>
                    <template v-if="effectiveSorts.length > 0 && !toolbarNarrow">
                        <span class="toolbar-label">排序</span>
                        <n-select
                            v-if="effectiveSorts.length > 1"
                            v-model:value="sortField"
                            :options="effectiveSorts.map((s) => ({ label: s.label, value: s.value }))"
                            style="width: 130px;"
                        />
                        <n-select
                            v-model:value="sortDir"
                            :options="dirOptions"
                            style="width: 90px;"
                        />
                    </template>
                    <span v-if="props.textOf && keyword.trim()" class="match-hint">
                        {{ filtered.length }} {{ props.unit }}
                    </span>
                    <n-input
                        v-if="props.textOf"
                        v-model:value="keywordInput"
                        placeholder="搜索内容（/ 聚焦）"
                        clearable
                        style="width: 200px;"
                    />
                </div>
            </div>

            <!-- 工具栏之后的附加区（如「那年今日」）：放在筛选之下、列表之上，避免被误当筛选条件 -->
            <slot name="after-toolbar" />

            <n-empty v-if="filtered.length === 0" description="没有符合条件的内容" class="list-empty" />

            <div v-else ref="contentRef" class="list-content" :class="{ 'is-masonry': layout !== 'paged', 'is-compact': compact }">
                <!-- 分页：整宽单列 + 分页器 -->
                <slot v-if="layout === 'paged'" :items="paged" :paginate="true" />
                <!-- 不分页 / 瀑布流：同一套分块滚动加载，差别只在列数（plain 恒为 1 列） -->
                <div
                    v-else
                    class="masonry-grid"
                    :style="{ gridTemplateColumns: `repeat(${layout === 'plain' ? 1 : masonryCols}, minmax(0, 1fr))` }"
                >
                    <div v-for="(column, index) in masonryColumns" :key="index" class="masonry-col">
                        <slot :items="column" :paginate="false" />
                    </div>
                </div>

                <div v-if="layout === 'paged' && filtered.length > pageSize" class="list-pager" :title="props.textOf ? '按 / 聚焦搜索，Esc 清空，←/→ 翻页' : '←/→ 翻页'">
                    <n-pagination
                        v-model:page="page"
                        v-model:page-size="pageSize"
                        :item-count="filtered.length"
                        :page-sizes="sizeOptions"
                        show-size-picker
                        show-quick-jumper
                    />
                    <span class="pager-hotkey" aria-hidden="true">← / → 翻页</span>
                </div>

                <div v-if="hasMoreMasonry" class="masonry-more">
                    <span class="masonry-more-text">
                        已显示 {{ paged.length }} / {{ sorted.length }} {{ props.unit }}
                    </span>
                    <n-button size="small" @click="loadMoreMasonry">加载更多</n-button>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.head-count {
    margin-left: 10px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-muted);
}
.list-loading {
    display: flex;
    justify-content: center;
    padding: 40px 0;
}
.list-empty {
    padding: 30px 0;
}
/* 模块无数据：占满滚动区剩余高度，上下左右居中 */
.list-empty-full {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.list-pager {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 10px 0 20px;
}
/* 快捷键提示：常驻在分页器右侧，避免藏在 title 里没人发现 */
.pager-hotkey {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    color: var(--text-secondary);
    pointer-events: none;
}
/* 列表内容区 */
.list-content {
    position: relative;
}
/* 瀑布流：多列 grid，每列独立堆叠；列间距交给 grid，卡片自身 margin-bottom 负责行间距 */
.masonry-grid {
    display: grid;
    gap: 0 14px;
    align-items: start;
}
.masonry-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.masonry-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 0 24px;
}
.masonry-more-text {
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
/* 搜索命中数：就近反馈在搜索框左侧 */
.match-hint {
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
/* 内容滚动区作为遮罩的定位容器，遮罩覆盖整个可视区（而非仅当前内容高度） */
.page-body {
    position: relative;
}
/* 切换到瀑布流时的「处理中」遮罩：覆盖内容区可视范围，半透明不挡视线，首帧后自动消失 */
.masonry-mask {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 240px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(1px);
}
.masonry-mask-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
}
</style>
