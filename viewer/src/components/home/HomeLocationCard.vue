<script setup lang="ts">
import { navigate } from '../../router';
import type { TopLocation } from '../../data/counts';

/**
 * 榜单卡的「常驻地点」：与 HomeListCard 同一套壳子（标题 + 行列表 + 查看更多），
 * 行 = 最近一次的模块标签 + 地点名 + 次数；点行跳该地点最近条目所在的模块列表，
 * 「查看更多」跳 #/memories?type=locations（常驻地点面板，含各地点的条目明细）。
 */
const props = defineProps<{
    rows: TopLocation[];
    loading?: boolean;
}>();

function open(row: TopLocation): void {
    if (row.route) navigate(row.route);
}

function goMore(): void {
    navigate('memories', { type: 'locations', from: 'home' });
}
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>常驻地点</span>
            <span class="note">发布/拍摄地点分布</span>
        </div>
        <div v-if="rows.length" class="list">
            <component
                :is="row.route ? 'button' : 'div'"
                v-for="(row, i) in rows"
                :key="i"
                class="row"
                :class="{ clickable: !!row.route }"
                :type="row.route ? 'button' : undefined"
                :title="`${row.location}（${row.percent}%）· 最近 ${row.latestTime}`"
                @click="open(row)"
            >
                <span class="row-label">{{ row.label }}</span>
                <span class="row-text">{{ row.location }}</span>
                <span class="row-meta">{{ row.count }} 次</span>
            </component>
        </div>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else class="empty">没有带地点的内容</p>
        <button type="button" class="card-more" @click="goMore">查看更多 →</button>
    </div>
</template>

<style scoped>
/* 与 HomeListCard 同一套壳子（scoped 各自独立，样式同步维护） */
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
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}
.card-title .note {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-secondary);
}
.list {
    display: flex;
    flex-direction: column;
    flex: 1;
}
.row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 0;
    border: none;
    background: transparent;
    text-align: left;
    font: inherit;
    color: var(--text-primary);
}
.row.clickable {
    cursor: pointer;
}
.row.clickable:hover .row-text {
    color: var(--accent);
}
.row-label {
    flex: none;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-toolbar);
    font-size: 11px;
    color: var(--text-secondary);
}
.row-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
}
.row.clickable:hover .row-text {
    text-decoration: underline;
}
.row-meta {
    flex: none;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.empty {
    margin: 12px 0;
    font-size: 12px;
    color: var(--text-secondary);
}
.card-more {
    align-self: flex-start;
    margin-top: 10px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.card-more:hover {
    text-decoration: underline;
}
</style>
