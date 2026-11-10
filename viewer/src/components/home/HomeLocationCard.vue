<script setup lang="ts">
import { ref } from 'vue';
import { navigate } from '../../router';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent } from '../../data/mask';
import type { TopLocation } from '../../data/counts';
import type { CityRow } from '../../data/cityStats';

/**
 * 榜单卡的「常驻地点」：与 HomeListCard 同一套壳子（标题 + 行列表 + 查看更多），
 * 行 = 最近一次的模块标签 + 地点名 + 次数；点行跳该地点最近条目所在的模块列表，
 * 「查看更多」跳 #/memories?type=locations（常驻地点面板，含各地点的条目明细）。
 */
const props = defineProps<{
    rows: TopLocation[];
    cityRows?: CityRow[];
    loading?: boolean;
    cityLoading?: boolean;
}>();

/** 地点 / 城市两个视角：城市由内置全国市级地图按坐标归属算出（不依赖腾讯 Key） */
const mode = ref<'place' | 'city'>('place');

/** 地名属于位置信息，隐私模式下与其它摘要一样打码；次数是数字，保留 */
const { hidden: hideSensitive } = usePrivacy();
function labelOf(location: string): string {
    return hideSensitive.value ? maskContent(location) : location;
}

/** 地点行：跳地图并按该地点筛选（比跳「该地点最近一条内容」更符合直觉） */
function openPlace(row: TopLocation): void {
    navigate('map', { region: row.location });
}

/** 城市行：跳地图并按城市下钻 + 筛选 */
function openCity(name: string): void {
    navigate('map', { city: name });
}

function goMore(): void {
    navigate('memories', { type: 'locations', from: 'home' });
}
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>常驻{{ mode === 'place' ? '地点' : '城市' }}</span>
            <span class="note">{{ mode === 'place' ? '发布/拍摄地点分布' : '按打卡坐标归属' }}</span>
            <span class="mode-switch">
                <button type="button" :class="{ on: mode === 'place' }" @click="mode = 'place'">地点</button>
                <button type="button" :class="{ on: mode === 'city' }" @click="mode = 'city'">城市</button>
            </span>
        </div>
        <div v-if="mode === 'city'" class="list">
            <button
                v-for="row in (cityRows || [])"
                :key="row.name"
                type="button"
                class="row clickable"
                :title="`在地图查看 ${labelOf(row.name)}`"
                @click="openCity(row.name)"
            >
                <span class="row-text">{{ labelOf(row.name) }}</span>
                <span class="row-meta">{{ row.count }} 次 · {{ row.percent }}%</span>
            </button>
            <p v-if="!cityRows?.length" class="empty">{{ cityLoading ? '正在统计…' : '没有可归属的城市数据' }}</p>
        </div>
        <div v-else-if="rows.length" class="list">
            <button
                v-for="(row, i) in rows"
                :key="i"
                type="button"
                class="row clickable"
                :title="`在地图查看 ${labelOf(row.location)}（${row.percent}%）`"
                @click="openPlace(row)"
            >
                <span class="row-label">{{ row.label }}</span>
                <span class="row-text">{{ labelOf(row.location) }}</span>
                <span class="row-meta">{{ row.count }} 次</span>
            </button>
        </div>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else-if="mode === 'place'" class="empty">没有带地点的内容</p>
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
/* 地点 / 城市切换：放在标题右侧，不占额外行 */
.mode-switch {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
    margin-left: auto;
    font-size: 11px;
}
.mode-switch button {
    border: 0;
    background: transparent;
    padding: 1px 4px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    cursor: pointer;
}
.mode-switch button:hover {
    color: var(--text-primary);
}
.mode-switch button.on {
    color: var(--accent);
    font-weight: 600;
}
.mode-switch button + button::before {
    content: '/';
    margin-right: 4px;
    color: var(--border-hover, #c9d1dc);
    font-weight: 400;
}
</style>
