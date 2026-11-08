<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NSelect, NRadioButton, NRadioGroup, NTag, NEmpty, NPagination, NSpin } from 'naive-ui';
import { loadTimeline, type TimelineEntry } from '../data/timeline';
import { getModulePref, savePref } from '../data/displayPrefs';
import { navigate } from '../router';
import MessageItem from '../components/items/MessageItem.vue';
import ArticleItem from '../components/items/ArticleItem.vue';
import BoardItem from '../components/items/BoardItem.vue';
import PhotoBatchItem from '../components/items/PhotoBatchItem.vue';
import ShareItem from '../components/items/ShareItem.vue';
import FavoriteItem from '../components/items/FavoriteItem.vue';

const loading = ref(true);
const allEntries = ref<TimelineEntry[]>([]);

/** 模块筛选选项 */
const MODULE_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: '全部模块' },
    { value: 'messages', label: '说说' },
    { value: 'blogs', label: '日志' },
    { value: 'diaries', label: '日记' },
    { value: 'photos', label: '相片' },
    { value: 'boards', label: '留言' },
    { value: 'shares', label: '分享' },
    { value: 'favorites', label: '收藏' },
];

const filterModule = ref('all');
const sortOrder = ref<'desc' | 'asc'>(getModulePref('timeline').sortDir);
/** 排序下拉选项 */
const sortOptions = [
    { label: '时间倒序', value: 'desc' },
    { label: '时间正序', value: 'asc' },
];
const page = ref(1);
const PAGE_SIZE = 50;
/** 布局：true=分页（默认）/ false=瀑布流（滚动加载）。偏好记忆在 localStorage，刷新不丢，与其他模块一致 */
const paginate = ref(getModulePref('timeline').paginate ?? true);
/**
 * 列表体：瀑布流列数按它的实际宽度算
 * （模板里一直写着 ref="listBodyRef"，但 script 从没声明过，等于没绑上——顺手补掉）
 */
const listBodyRef = ref<HTMLElement | null>(null);

const filtered = computed(() => {
    let items = allEntries.value;
    if (filterModule.value !== 'all') {
        items = items.filter((e) => e.module === filterModule.value);
    }
    // 排序已在 loadTimeline 中完成，这里直接返回
    return items;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));

/** 瀑布流已加载的条数（分页模式下不参与渲染） */
const loadedCount = ref(PAGE_SIZE);
const visibleForFlow = computed(() => filtered.value.slice(0, loadedCount.value));
/** 瀑布流是否到底：已加载全部，不再触发加载更多 */
const flowExhausted = computed(() => loadedCount.value >= filtered.value.length);

/**
 * 瀑布流列数
 *
 * 分页与瀑布流此前只有「有没有分页器」的差别，布局完全一样，切换看不出意义。
 * 这里让瀑布流真正分多列（与列表页同一套规则：每列 ≥420px、最多 3 列）。
 */
const flowCols = ref(1);
let flowResize: ResizeObserver | null = null;

/** 按行优先分配到各列：追加只长最后一列，不顶走已看过的内容 */
const flowColumns = computed(() => {
    const cols = Math.max(1, flowCols.value);
    const items = visibleForFlow.value;
    if (cols === 1) {
        return [items];
    }
    const out: TimelineEntry[][] = Array.from({ length: cols }, () => []);
    items.forEach((entry, index) => {
        out[index % cols]!.push(entry);
    });
    return out;
});

/** 分页给单列、瀑布流给多列——条目模板只写一份 */
const displayColumns = computed(() => (paginate.value ? [paged.value] : flowColumns.value));

function setupFlowCols(): void {
    if (paginate.value) {
        flowResize?.disconnect();
        flowResize = null;
        return;
    }
    const el = listBodyRef.value;
    if (!el) {
        return;
    }
    const measure = (): void => {
        const width = el.clientWidth || 0;
        if (width <= 0) {
            // 还没布局完：保持现值，等 ResizeObserver 下一轮再算
            return;
        }
        flowCols.value = Math.max(1, Math.min(3, Math.floor(width / 420)));
    };
    measure();
    if (!flowResize) {
        flowResize = new ResizeObserver(measure);
        flowResize.observe(el);
    }
}

// 同时监听条目数与容器 ref：数据异步加载 / 挂载时机，任一晚了都会测到 0 宽
watch([paginate, () => filtered.value.length, listBodyRef], () => {
    nextTick(setupFlowCols);
}, { immediate: true });

onBeforeUnmount(() => {
    flowResize?.disconnect();
    flowResize = null;
});

/** 分页模式实际渲染的当前页 */
const paged = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE;
    return filtered.value.slice(start, start + PAGE_SIZE);
});

/** 布局切换（分页 / 瀑布流），切换后滚动到列表顶部，记忆偏好 */
function toggleLayout(value: boolean): void {
    paginate.value = value;
    savePref('timeline', { paginate: value });
    resetPaging();
}
watch(paginate, () => nextTick(() => scrollTop()));

/** 筛选/排序变化时重置到第一页，并把瀑布流回退到首屏 */
function resetPaging(): void {
    page.value = 1;
    loadedCount.value = PAGE_SIZE;
}

/** 滚动到时间轴顶部（布局切换 / 筛选变化后，从新位置看起） */
function scrollTop(): void {
    const el = scrollContainerRef.value;
    if (el) {
        el.scrollTop = 0;
    }
}

/**
 * 瀑布流：滚动加载更多
 * 监听列表底部的哨兵元素，进入可视区就再多加载一屏；到底后停止。
 * observer 的 root 用真正滚动的 .tl-page（见模板），列表本身不滚动。
 */
let observer: IntersectionObserver | null = null;
const sentinelRef = ref<HTMLElement | null>(null);
const scrollContainerRef = ref<HTMLElement | null>(null);

function setupObserver(): void {
    teardownObserver();
    const sentinel = sentinelRef.value;
    const root = scrollContainerRef.value;
    if (!sentinel || !root || paginate.value) {
        return;
    }
    observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !loading.value && !flowExhausted.value) {
            loadedCount.value += PAGE_SIZE;
        }
    }, {
        // 以页面滚动器为根：哨兵滚进可视区（提前 200px 预载）就追加一屏
        root,
        rootMargin: '200px',
    });
    observer.observe(sentinel);
}

function teardownObserver(): void {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

watch(paginate, async () => {
    await nextTick();
    setupObserver();
});

// 筛选变化时重置分页/瀑布流（数据重载完成由 loading 兜底重建 observer）
watch(filterModule, () => {
    resetPaging();
    nextTick(() => setupObserver());
});

// 数据首次加载完成（loading true→false）后，哨兵就位，建立瀑布流观察器
watch(loading, (value) => {
    if (!value) {
        nextTick(() => setupObserver());
    }
});

onBeforeUnmount(() => {
    teardownObserver();
});

/** 各模块条目数统计（用于筛选下拉旁显示） */
const moduleCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const e of allEntries.value) {
        counts[e.module] = (counts[e.module] || 0) + 1;
    }
    return counts;
});

/** 模块筛选下拉选项（带实时条数） */
const moduleFilterOptions = computed(() => MODULE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.value !== 'all' && moduleCounts.value[o.value] ? `${o.label}（${moduleCounts.value[o.value]}）` : o.label,
})));

function kindLabel(module: string): string {
    const map: Record<string, string> = {
        messages: '说说', blogs: '日志', diaries: '日记',
        photos: '相片', boards: '留言',
        shares: '分享', favorites: '收藏',
    };
    return map[module] || module;
}

function navToItem(entry: TimelineEntry): void {
    // 跳详情均携带 from=timeline，详情页返回时回到空间动态（与互动面板的 from=interaction 一致）
    switch (entry.module) {
        case 'messages':
            navigate('messages', { from: 'timeline', id: String(entry.item.tid ?? '') });
            break;
        case 'blogs':
            navigate('blogs', { from: 'timeline', id: String(entry.item.blogid ?? entry.item.blogId ?? entry.item.id ?? '') });
            break;
        case 'diaries':
            navigate('diaries', { from: 'timeline', id: String(entry.item.id ?? '') });
            break;
        case 'photos':
            navigate('albums', { from: 'timeline', id: String(entry.item.__album?.id ?? '') });
            break;
        case 'boards':
            navigate('boards', { from: 'timeline', id: String(entry.item.tid ?? entry.item.id ?? '') });
            break;
        case 'shares':
            navigate('shares', { from: 'timeline', id: String(entry.item.id ?? entry.item.shareId ?? '') });
            break;
        case 'favorites':
            navigate('favorites');
            break;
    }
}

async function reload(): Promise<void> {
    loading.value = true;
    try {
        allEntries.value = await loadTimeline(sortOrder.value);
    } catch {
        allEntries.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    reload();
});

// 切换排序方向时重新加载数据（resetPaging 由下方 watch([filterModule, loading]) 统一处理）
watch(sortOrder, () => {
    // 排序方向持久化（与其他列表一致的排序记忆）
    savePref('timeline', { sortDir: sortOrder.value });
    reload();
});
</script>

<template>
    <div ref="scrollContainerRef" class="tl-page">
        <div v-if="loading" class="tl-loading"><n-spin size="large" /></div>

        <n-empty
            v-else-if="!allEntries.length"
            description="暂无动态数据"
            class="tl-empty"
        />

        <div v-else class="tl-body">
            <!-- 筛选工具栏 -->
            <div class="tl-toolbar">
                <span class="tl-field">模块
                    <n-select v-model:value="filterModule" :options="moduleFilterOptions" style="width: 130px;" />
                </span>
                <span class="tl-field">排序
                    <n-select v-model:value="sortOrder" :options="sortOptions" style="width: 110px;" />
                </span>
                <span class="tl-count">共 {{ filtered.length }} 条动态</span>
                <!-- 布局切换：分页 / 瀑布流 -->
                <div class="tl-layout-switch">
                    <n-radio-group
                        :value="paginate"
                        size="small"
                        @update:value="(v: boolean) => toggleLayout(v)"
                    >
                        <n-radio-button :value="true">分页</n-radio-button>
                        <n-radio-button :value="false">瀑布流</n-radio-button>
                    </n-radio-group>
                </div>
            </div>

            <!-- 列表体（ref 绑在滚动容器上供瀑布流 Observer 使用）；分页=单列、瀑布流=多列，条目模板只写一份 -->
            <div ref="listBodyRef" class="tl-timeline">
                <div
                    class="tl-masonry"
                    :style="{ gridTemplateColumns: `repeat(${paginate ? 1 : flowCols}, minmax(0, 1fr))` }"
                >
                    <div v-for="(column, ci) in displayColumns" :key="ci" class="tl-masonry-col">
                        <div
                            v-for="(entry, i) in column"
                            :key="i"
                            class="tl-event"
                            @click="navToItem(entry)"
                        >
                    <div class="tl-event-head">
                        <n-tag size="small" :bordered="false" type="info">
                            {{ kindLabel(entry.module) }}
                        </n-tag>
                        <span class="tl-time">{{ entry.timeText }}</span>
                    </div>
                    <div class="tl-event-body">
                        <!-- 说说：使用 MessageItem 组件 -->
                        <message-item
                            v-if="entry.module === 'messages'"
                            :item="entry.item"
                        />
                        <!-- 日志/日记：使用 ArticleItem 组件 -->
                        <article-item
                            v-else-if="entry.module === 'blogs'"
                            :item="entry.item"
                            config-key="Blogs"
                        />
                        <article-item
                            v-else-if="entry.module === 'diaries'"
                            :item="entry.item"
                            config-key="Diaries"
                        />
                        <!-- 留言：使用 BoardItem 组件 -->
                        <board-item
                            v-else-if="entry.module === 'boards'"
                            :item="entry.item"
                        />
                        <!-- 相片批量：使用 PhotoBatchItem 组件 -->
                        <photo-batch-item
                            v-else-if="entry.module === 'photos' && entry.photoBatch"
                            :album="entry.item.__album || { name: entry.albumName }"
                            :photos="entry.photoBatch"
                        />
                        <!-- 分享：使用 ShareItem 组件 -->
                        <share-item
                            v-else-if="entry.module === 'shares'"
                            :item="entry.item"
                        />
                        <!-- 收藏：使用 FavoriteItem 组件 -->
                        <favorite-item
                            v-else-if="entry.module === 'favorites'"
                            :item="entry.item"
                        />
                        <!-- 其他类型：紧凑卡片 -->
                        <div v-else class="tl-compact-entry">
                            <span class="tl-compact-title">{{ entry.title }}</span>
                            <span v-if="entry.desc" class="tl-compact-desc">{{ entry.desc }}</span>
                        </div>
                    </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 分页：仅分页模式显示 -->
            <div class="tl-pager" v-if="paginate && totalPages > 1">
                <n-pagination
                    :page="page"
                    :page-count="totalPages"
                    @update:page="(p: number) => (page = p)"
                />
            </div>

            <!-- 瀑布流：滚动加载更多 + 底部状态（哨兵进入可视区触发加载；到底后提示全部加载完） -->
            <div v-if="!paginate" class="tl-flow-footer">
                <div ref="sentinelRef" v-if="!flowExhausted" class="tl-flow-sentinel">
                    <n-spin size="small" />
                    加载更多…
                </div>
                <span v-else class="tl-flow-done">已加载全部 {{ filtered.length }} 条动态</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tl-page {
    height: 100%;
    overflow-y: auto;
    padding: 18px 20px 28px;
    box-sizing: border-box;
}
.tl-empty {
    padding: 60px 0;
}
.tl-loading {
    display: flex;
    justify-content: center;
    padding: 80px 0;
}
.tl-body {
    width: 100%;
}
.tl-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 10px 12px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-card);
    border-radius: 6px;
}
.tl-field {
    font-size: 13px;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.tl-count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
}
.tl-timeline {
    display: flex;
    flex-direction: column;
}
/* 卡片流：分页=1 列、瀑布流=多列（列数由内联 grid-template-columns 给） */
.tl-masonry {
    display: grid;
    gap: 0 8px;
    align-items: start;
}
.tl-masonry-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}
.tl-event {
    padding: 10px 12px;
    border: 1px solid var(--border-card);
    border-left-width: 3px;
    border-left-color: #2080f0;
    border-radius: 6px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: box-shadow 0.15s, transform 0.15s;
}
.tl-event:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transform: translateX(2px);
}
.tl-event-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}
.tl-time {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.tl-event-body {
    font-size: 13px;
    line-height: 1.6;
}
.tl-event-body :deep(.qm-card),
.tl-event-body :deep(.media-card),
.tl-event-body :deep(.article-item) {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 4px;
}
.tl-compact-entry {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 10px;
    background: var(--bg-toolbar);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}
.tl-compact-title {
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tl-compact-desc {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tl-pager {
    display: flex;
    justify-content: center;
    margin-top: 16px;
}
/* 瀑布流底部：加载中的哨兵与「全部加载完」状态 */
.tl-count {
    margin-left: auto;
}
.tl-flow-footer {
    display: flex;
    justify-content: center;
    padding: 16px 0 6px;
}
.tl-flow-sentinel {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
}
.tl-flow-done {
    font-size: 12px;
    color: var(--text-muted);
}
</style>