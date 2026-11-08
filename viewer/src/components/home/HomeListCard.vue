<script setup lang="ts">
import { navigate } from '../../router';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent } from '../../data/mask';
import type { RankRow } from '../../data/rankings';

/** 回忆之页的统一卡片：与「那年今日 / 回忆之最」同一套壳子，5 行摘要 + 查看更多 */
const props = defineProps<{
    title: string;
    note?: string;
    items: RankRow[];
    /** 对应 #/memories 里的分组；'all' 表示只打开清单页、不定位 */
    moreType?: string;
    emptyText?: string;
    /** 统计未完成时先显示加载占位 */
    loading?: boolean;
}>();

const { hidden: hideSensitive } = usePrivacy();

/** 隐私模式：卡片里的摘要属于私密内容，截图分享会直接泄漏 */
function textOf(row: RankRow): string {
    return hideSensitive.value ? maskContent(row.text) : row.text;
}

function open(row: RankRow): void {
    if (row.route) navigate(row.route, row.query);
}

function goMore(): void {
    if (!props.moreType) return;
    const type = props.moreType === 'all' ? undefined : props.moreType;
    navigate('memories', { ...(type ? { type } : {}), from: 'home' });
}
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>{{ title }}</span>
            <span v-if="note" class="note">{{ note }}</span>
        </div>
        <div v-if="items.length" class="list">
            <component
                :is="row.route ? 'button' : 'div'"
                v-for="(row, i) in items"
                :key="i"
                class="row"
                :class="{ clickable: !!row.route }"
                :type="row.route ? 'button' : undefined"
                :title="textOf(row)"
                @click="open(row)"
            >
                <span class="row-label">{{ row.label }}</span>
                <span class="row-text">{{ textOf(row) }}</span>
                <span v-if="row.meta" class="row-meta">{{ row.meta }}</span>
            </component>
        </div>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else class="empty">{{ emptyText || '暂无数据' }}</p>
        <button v-if="moreType" type="button" class="card-more" @click="goMore">查看更多 →</button>
    </div>
</template>

<style scoped>
.home-card {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    padding: 20px;
    min-width: 0;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.home-card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.card-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
}
.card-title .note {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}
.list {
    /* 回忆组三张卡都是固定 5 条清单：行按可用高度均分，三卡行基线才能对齐 */
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.row {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 0;
    border: none;
    border-bottom: 1px solid var(--border-light);
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
}
.row:last-child {
    border-bottom: none;
}
.row.clickable {
    cursor: pointer;
}
.row.clickable:hover .row-text {
    color: var(--accent-pressed);
}
.row-label {
    flex: 0 0 auto;
    min-width: 52px;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.row-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
}
.row-meta {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
}
.card-more {
    align-self: flex-start;
    margin-top: 12px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.card-more:hover {
    color: var(--accent-pressed);
}
</style>
