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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { NButton, NEmpty, NInput, NPagination, NRadioButton, NRadioGroup, NSelect, NSpin } from 'naive-ui';
import { formatTime, timeValue } from '../data/format';
import { getModulePref, savePref } from '../data/displayPrefs';
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
/** 分页/瀑布流：传入 prefKey 时从 localStorage 读偏好，否则用 prop 默认 */
const paginate = ref(props.paginate);
if (props.prefKey) {
    paginate.value = getModulePref(props.prefKey).paginate;
}
/**
 * 布局切换的「用户意图」：工具栏单选直接绑它，而非直接绑 paginate。
 * 切到瀑布流时先把遮罩（含文案）同步点亮，再延到下一帧执行繁重的瀑布流 DOM 重建，
 * 避免「先卡顿、遮罩才出来」；切回分页是轻量操作，直接落。
 */
const layoutMode = ref(paginate.value);
const masonryBusy = ref(false);
// 仅负责隐藏：paginate 才是真正驱动渲染的状态，瀑布流首帧渲染完成后撤掉遮罩
watch(paginate, (value) => {
    if (value === false) {
        nextTick().then(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => { masonryBusy.value = false; }));
        });
    } else {
        masonryBusy.value = false;
    }
});
watch(layoutMode, (val) => {
    if (props.prefKey) {
        savePref(props.prefKey, { paginate: val });
    }
    if (val === false) {
        // 立即点亮遮罩（同步设 true，本次刷新只多一个轻量节点，浏览器可立即绘制出遮罩与文案）
        masonryBusy.value = true;
        // 等遮罩绘制完再重建瀑布流 DOM，把卡顿挡在遮罩之后
        nextTick().then(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => { paginate.value = false; }));
        });
    } else {
        masonryBusy.value = false;
        paginate.value = true;
    }
});
/** 每页条数：默认取调用方给的 pageSize，用户改过则按模块记忆 */
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
    if (!word || !props.textOf) {
        return true;
    }
    return (props.textOf(item) || '').toLowerCase().includes(word);
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
        if (paginate.value) {
            page.value = Math.floor(index / pageSize.value) + 1;
        } else {
            const need = Math.ceil((index + 1) / MASONRY_CHUNK) * MASONRY_CHUNK;
            masonryRendered.value = Math.max(masonryRendered.value, Math.min(sorted.value.length, need));
        }
    },
    { immediate: true },
);

const paged = computed(() => (paginate.value
    ? sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
    : sorted.value.slice(0, masonryRendered.value)));

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

const hasMoreMasonry = computed(() => !paginate.value && sorted.value.length > paged.value.length);

function loadMoreMasonry(): void {
    masonryRendered.value = Math.min(sorted.value.length, masonryRendered.value + MASONRY_CHUNK);
}

/** 滚动到距底 600px 时预取下一块：滚动监听挂在真正滚动的 .page-body 上 */
function onMasonryScroll(): void {
    const el = masonryScrollEl;
    if (!el || paginate.value || !hasMoreMasonry.value) {
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
    if (paginate.value) {
        return;
    }
    const el = contentRef.value;
    if (!el) {
        return;
    }
    const measure = (): void => {
        const width = el.clientWidth || 0;
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

watch(paginate, () => {
    masonryRendered.value = MASONRY_CHUNK;
    nextTick(setupMasonry);
}, { immediate: true });

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
    put('layout', paginate.value ? '' : 'flow');
    const next = params.toString();
    const target = '#/' + path + (next ? '?' + next : '');
    if (location.hash !== target) {
        history.replaceState(null, '', target);
    }
}

watch([keyword, year, monthNum, sortField, sortDir, paginate], syncToUrl);

/**
 * 从 URL 恢复筛选
 *
 * 分享链接、刷新、从详情页返回时都能还原筛选；月份放下一帧恢复，
 * 因为 year 的 watch 会主动清空 month（那是「用户切换年份」的语义）。
 */
function restoreFromUrl(): void {
    const query = routeQuery.value;
    if (query.q) {
        keywordInput.value = query.q;
    }
    if (query.year) {
        year.value = query.year;
    }
    if (query.sort) {
        sortField.value = query.sort;
    }
    if (query.dir === 'asc' || query.dir === 'desc') {
        sortDir.value = query.dir;
    }
    if (query.layout === 'flow') {
        layoutMode.value = false;
    } else if (query.layout === 'page') {
        layoutMode.value = true;
    }
    if (query.month) {
        nextTick(() => {
            monthNum.value = query.month ?? '';
        });
    }
}
restoreFromUrl();
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
            <div v-if="props.timeOf || props.textOf" class="list-toolbar">
                <slot name="toolbar" />
                <div v-if="props.timeOf" class="toolbar-group">
                    <span class="toolbar-label">时间</span>
                    <n-select
                        v-model:value="year"
                        :options="yearOptions"
                        style="width: 110px;"
                    />
                    <n-select
                        v-model:value="monthNum"
                        :options="monthOptions"
                        style="width: 110px;"
                    />
                </div>
                <div class="toolbar-group to-right">
                    <div v-if="props.prefKey" class="toolbar-group">
                        <span class="toolbar-label">布局</span>
                        <n-radio-group v-model:value="layoutMode" size="small">
                            <n-radio-button :value="true">分页</n-radio-button>
                            <n-radio-button :value="false">瀑布流</n-radio-button>
                        </n-radio-group>
                    </div>
                    <template v-if="effectiveSorts.length > 0">
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
                        placeholder="搜索内容"
                        clearable
                        style="width: 200px;"
                    />
                </div>
            </div>

            <n-empty v-if="filtered.length === 0" description="没有符合条件的内容" class="list-empty" />

            <div v-else ref="contentRef" class="list-content" :class="{ 'is-masonry': !paginate }">
                <!-- 分页：整宽单列 -->
                <slot v-if="paginate" :items="paged" :paginate="paginate" />
                <!-- 瀑布流：多列各自堆叠，追加只长最后一列 -->
                <div
                    v-else
                    class="masonry-grid"
                    :style="{ gridTemplateColumns: `repeat(${masonryCols}, minmax(0, 1fr))` }"
                >
                    <div v-for="(column, index) in masonryColumns" :key="index" class="masonry-col">
                        <slot :items="column" :paginate="false" />
                    </div>
                </div>

                <div v-if="paginate && filtered.length > pageSize" class="list-pager">
                    <n-pagination
                        v-model:page="page"
                        v-model:page-size="pageSize"
                        :item-count="filtered.length"
                        :page-sizes="sizeOptions"
                        show-size-picker
                        show-quick-jumper
                    />
                </div>

                <div v-if="hasMoreMasonry" class="masonry-more">
                    <span class="masonry-more-text">
                        已显示 {{ paged.length }} / {{ sorted.length }} {{ props.unit }}
                    </span>
                    <n-button size="small" @click="loadMoreMasonry">加载更多</n-button>
                </div>
            </div>

            <!-- 切换到瀑布流时盖在内容区之上的「处理中」遮罩：点击即点亮（含文案），首帧渲染完成后自动隐藏 -->
            <div v-if="masonryBusy" class="masonry-mask">
                <n-spin size="large" />
                <span class="masonry-mask-text">处理中…</span>
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
    display: flex;
    justify-content: center;
    padding: 10px 0 20px;
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
