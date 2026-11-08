<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildSearchRecords, searchRecords, type SearchHit, type SearchKind, type SearchRecord } from '../data/search';
import { formatTime } from '../data/format';
import { maskContent } from '../data/mask';
import { escapeHtml } from '../data/richText';
import { usePrivacy } from '../composables/usePrivacy';
import { navigate } from '../router';

/**
 * 全局搜索面板
 *
 * 跨模块检索内容与评论。索引一次性构建后缓存在模块作用域（同一份备份内不重建），
 * 之后每次输入只是线性扫描内存记录——实测万级记录 <10ms，不需要防抖以外的优化。
 */
const props = defineProps<{
    open: boolean;
    /** 外部预填的关键词（如点「最常用的词」里的某个词） */
    seed?: string;
}>();
const emit = defineEmits<{ close: [] }>();

const { hidden: hideSensitive } = usePrivacy();

const FILTERS: { value: SearchKind | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'item', label: '内容' },
    { value: 'comment', label: '评论' },
];

const keyword = ref('');
const kind = ref<SearchKind | 'all'>('all');
const building = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);

/** 索引缓存在模块作用域：关闭面板再打开不重建 */
let cachedRecords: SearchRecord[] | null = null;

const records = ref<SearchRecord[]>([]);
const result = computed(() => searchRecords(records.value, keyword.value, { kind: kind.value, limitPerGroup: 6 }));
/** 平铺结果，供键盘上下选择 */
const flat = computed(() => result.value.groups.flatMap((group) => group.hits));
const activeIndex = ref(0);

watch(keyword, () => {
    activeIndex.value = 0;
});
watch(kind, () => {
    activeIndex.value = 0;
});

/** 打开时聚焦输入框；索引未建好则先建 */
watch(
    () => props.open,
    async (open) => {
        if (!open) {
            return;
        }
        await nextTick();
        if (props.seed) {
            keyword.value = props.seed;
        }
        inputRef.value?.focus();
        if (cachedRecords) {
            records.value = cachedRecords;
            return;
        }
        building.value = true;
        try {
            cachedRecords = await buildSearchRecords();
            records.value = cachedRecords;
        } catch {
            cachedRecords = [];
            records.value = [];
        } finally {
            building.value = false;
        }
    },
    { immediate: true },
);

function hitKey(hit: SearchHit, index: number): string {
    return `${hit.record.module}:${hit.record.kind}:${hit.record.itemId}:${hit.record.commentId ?? ''}:${index}`;
}

/** 正文里的 mark 高亮：先在纯文本上切三段再转义，避免把 HTML 塞进 v-html */
function highlight(hit: SearchHit): string {
    if (hideSensitive.value) {
        return maskContent(hit.snippet);
    }
    const { snippet, matchStart, matchLength } = hit;
    const before = escapeHtml(snippet.slice(0, matchStart));
    const match = escapeHtml(snippet.slice(matchStart, matchStart + matchLength));
    const after = escapeHtml(snippet.slice(matchStart + matchLength));
    return `${before}<mark class="gs-mark">${match}</mark>${after}`;
}

function displayTitle(hit: SearchHit): string {
    const raw = hit.record.title || '';
    if (hideSensitive.value) {
        return maskContent(raw) || '（已隐藏）';
    }
    return raw || (hit.record.kind === 'comment' ? '评论' : '（无标题）');
}

function displayContext(hit: SearchHit): string {
    const raw = hit.record.context || '';
    if (!raw) {
        return '';
    }
    return hideSensitive.value ? maskContent(raw) : raw;
}

function timeText(hit: SearchHit): string {
    return hit.record.time > 0 ? formatTime(hit.record.time).slice(0, 10) : '';
}

function move(step: number): void {
    const total = flat.value.length;
    if (total === 0) {
        return;
    }
    const next = Math.min(total - 1, Math.max(0, activeIndex.value + step));
    activeIndex.value = next;
    // 让选中项滚进可视区
    nextTick(() => {
        const el = bodyRef.value?.querySelector('.gs-hit.active');
        el?.scrollIntoView({ block: 'nearest' });
    });
}

/** 模块到列表页路由的映射：相片没有独立列表页，落到相册页 */
const LIST_ROUTE: Record<string, string> = { photos: 'albums' };

/**
 * 不支持「查看全部」的模块
 *
 * 相片的命中来自「相片描述 / 相片评论」，而相册列表页搜的是「相册名 / 分类 / 相册描述」，
 * 两者不是一个维度——跳过去搜同一个词必然是 0 个结果。与其给个走不通的入口，不如不显示。
 */
const NO_GROUP_ALL = new Set(['photos']);

/** 该分组是否值得提供「查看全部」 */
function canViewAll(group: { module: string; itemTotal: number }): boolean {
    return group.itemTotal > 0 && !NO_GROUP_ALL.has(group.module);
}

/**
 * 查看该模块的全部命中
 *
 * 列表页已支持从 URL 恢复关键词（`?q=`），所以直接跳过去就是筛选好的列表，
 * 比在面板里分页更符合「我要看全部」的预期。
 */
function openGroupAll(group: { module: string }): void {
    const word = keyword.value.trim();
    if (!word) {
        return;
    }
    navigate(LIST_ROUTE[group.module] ?? group.module, { q: word });
    emit('close');
}

function openHit(hit: SearchHit | undefined): void {
    if (!hit) {
        return;
    }
    navigate(hit.record.route, hit.record.query);
    emit('close');
}

function openActive(): void {
    openHit(flat.value[activeIndex.value]);
}

/** 全局快捷键：面板打开时接管 Esc / ↑ / ↓ */
function onKeydown(event: KeyboardEvent): void {
    if (!props.open) {
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('close');
    }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div v-if="props.open" class="gs-mask" @click.self="emit('close')">
        <div class="gs-panel" role="dialog" aria-label="全局搜索">
            <div class="gs-head">
                <svg class="gs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    ref="inputRef"
                    v-model="keyword"
                    class="gs-input"
                    type="search"
                    placeholder="搜索说说、日志、留言、评论…"
                    @keydown.down.prevent="move(1)"
                    @keydown.up.prevent="move(-1)"
                    @keydown.enter.prevent="openActive"
                />
                <button v-if="keyword" type="button" class="gs-clear" title="清空" @click="keyword = ''">✕</button>
            </div>

            <div class="gs-filters">
                <button
                    v-for="filter in FILTERS"
                    :key="filter.value"
                    type="button"
                    class="gs-filter"
                    :class="{ active: kind === filter.value }"
                    @click="kind = filter.value"
                >{{ filter.label }}</button>
                <span v-if="keyword.trim() && !building" class="gs-count">{{ result.total }} 条</span>
            </div>

            <div ref="bodyRef" class="gs-body">
                <p v-if="building" class="gs-hint">正在建立搜索索引…</p>
                <p v-else-if="!keyword.trim()" class="gs-hint">输入关键词，可跨模块查找内容与评论</p>
                <p v-else-if="result.total === 0" class="gs-hint">没有找到「{{ keyword }}」</p>
                <div v-else class="gs-groups">
                    <section v-for="group in result.groups" :key="group.module" class="gs-group">
                        <div class="gs-group-head">
                            <span class="gs-group-name">{{ group.moduleLabel }}</span>
                            <span class="gs-group-count">{{ group.total }}</span>
                            <span v-if="group.commentTotal" class="gs-group-split">
                                内容 {{ group.itemTotal }} · 评论 {{ group.commentTotal }}
                            </span>
                            <button
                                v-if="canViewAll(group)"
                                type="button"
                                class="gs-group-all"
                                :title="`到${group.moduleLabel}列表看全部 ${group.itemTotal} 条内容命中（列表搜索只覆盖正文，不含评论）`"
                                @click="openGroupAll(group)"
                            >查看全部 {{ group.itemTotal }} 条内容 →</button>
                        </div>
                        <button
                            v-for="(hit, index) in group.hits"
                            :key="hitKey(hit, index)"
                            type="button"
                            class="gs-hit"
                            :class="{ active: flat[activeIndex] === hit }"
                            @click="openHit(hit)"
                            @mouseenter="activeIndex = flat.indexOf(hit)"
                        >
                            <span class="gs-hit-top">
                                <span class="gs-hit-title">
                                    <span v-if="hit.record.kind === 'comment'" class="gs-tag">评论</span>
                                    {{ displayTitle(hit) }}
                                </span>
                                <span class="gs-hit-time">{{ timeText(hit) }}</span>
                            </span>
                            <span class="gs-hit-snippet" v-html="highlight(hit)" />
                            <span v-if="hit.record.kind === 'comment' && hit.record.context" class="gs-hit-context">
                                评论于：{{ displayContext(hit) }}
                            </span>
                        </button>
                    </section>
                </div>
            </div>

            <div class="gs-foot">
                <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
                <span v-if="result.total > flat.length">每组只列前几条，可点「查看全部」进列表</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.gs-mask {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10vh 20px 20px;
    background: rgba(15, 18, 24, 0.38);
    backdrop-filter: blur(2px);
}
.gs-panel {
    display: flex;
    flex-direction: column;
    width: min(760px, 100%);
    max-height: 72vh;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 12px;
    box-shadow: 0 18px 48px var(--shadow-lg);
    overflow: hidden;
}
.gs-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light);
}
.gs-icon {
    width: 17px;
    height: 17px;
    flex: none;
    color: var(--text-muted);
}
.gs-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 15px;
    color: var(--text-primary);
    outline: none;
}
.gs-input::placeholder {
    color: var(--text-muted);
}
.gs-clear {
    flex: none;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: var(--bg-toolbar);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
}
.gs-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--border-light);
    background: var(--bg-toolbar);
}
.gs-filter {
    padding: 3px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
}
.gs-filter.active {
    border-color: var(--border-card);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 500;
}
.gs-count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.gs-body {
    flex: 1;
    min-height: 120px;
    overflow-y: auto;
    /* 上内边距必须为 0：sticky 标题贴顶时否则会留一条缝，滚动中内容从缝里透出来 */
    padding: 0 8px 10px;
}
.gs-hint {
    margin: 28px 0;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
}
.gs-group {
    margin-top: 2px;
}
/* 分组标题：比条目更明确（13px/600），并用细线与上一组分开；
   原来 12px 常规字重，比右侧蓝色的「查看全部」还弱，层级是倒的 */
.gs-group-head {
    display: flex;
    align-items: baseline;
    gap: 7px;
    /* 负 margin 抵消 .gs-body 的 8px 内边距，让底色铺满整行 */
    margin: 6px -8px 0;
    padding: 9px 16px 7px;
    border-top: 1px solid var(--border-light);
    border-bottom: 1px solid var(--border-light);
    /* --bg-tint-blue(#ecf5ff) 在白底上几乎看不出，再加一层 10% 品牌蓝；
       不支持 color-mix 的旧内核会回落到第一行 */
    background: var(--bg-tint-blue);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
    /* 滚动时吸顶：多组结果往下翻也不会忘了自己在看哪个模块 */
    position: sticky;
    top: 0;
    z-index: 1;
}
.gs-group:first-child .gs-group-head {
    border-top: none;
    margin-top: 0;
}
.gs-group-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}
/* 命中数做成徽标，读起来是「标题 + 数量」而不是一串数字 */
.gs-group-count {
    padding: 1px 7px;
    border: 1px solid var(--border-light);
    border-radius: 999px;
    background: var(--bg-toolbar);
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
/* 内容/评论拆分：比徽标更淡，作为补充说明 */
.gs-group-split {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
/* 查看该模块全部命中：跳列表页并带上关键词；次要动作，不用主色抢戏 */
.gs-group-all {
    margin-left: auto;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.15s;
}
.gs-group-all:hover {
    color: var(--accent-pressed);
    text-decoration: underline;
}
.gs-hit {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    text-align: left;
    cursor: pointer;
}
.gs-hit:hover,
.gs-hit.active {
    background: var(--bg-toolbar);
}
.gs-hit-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.gs-hit-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--text-primary);
}
.gs-tag {
    display: inline-block;
    margin-right: 4px;
    padding: 0 5px;
    border-radius: 4px;
    background: var(--bg-tint-blue);
    color: var(--accent-pressed);
    font-size: 11px;
}
.gs-hit-time {
    flex: none;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.gs-hit-snippet {
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
}
/* 命中底色统一由全局 mark.gs-mark 定义（含暗色） */
.gs-hit-context {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gs-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    border-top: 1px solid var(--border-light);
    font-size: 11px;
    color: var(--text-muted);
}
</style>
