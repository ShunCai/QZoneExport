<script setup lang="ts">
import { computed } from 'vue';
import type { WordCountRow } from '../../data/wordCounts';

/**
 * 文字量构成卡
 *
 * 与「内容构成」成对出现：那张按条数，这张按字数。条形口径与前一张保持一致——
 * 条长就是百分比（轨道代表全站文字总量），这样两张卡的行可以直接对比着读。
 */
const props = defineProps<{
    rows: WordCountRow[];
    total: number;
    /** 数据未到时卡片仍挂载，只把结果区换成加载占位 */
    loading?: boolean;
}>();

const emit = defineEmits<{ select: [key: string] }>();

const RANK_COLORS = ['#2080f0', '#1d9e75', '#7c6bc4', '#d4537e', '#ba7517', '#0f8fb3', '#888780', '#c2410c'];

const sum = computed(() => Math.max(1, props.total || 0));

const list = computed(() => props.rows.map((row, i) => ({
    ...row,
    color: RANK_COLORS[i % RANK_COLORS.length]!,
    percent: (row.chars / sum.value) * 100,
})));

/** 字数文案：上万用「万」，避免一行里出现 6 位数字 */
function formatChars(chars: number): string {
    if (chars >= 10000) {
        const wan = chars / 10000;
        return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')} 万`;
    }
    return chars.toLocaleString();
}

function percentText(percent: number): string {
    if (percent <= 0) return '0%';
    if (percent < 1) return '<1%';
    return `${Math.round(percent)}%`;
}
</script>

<template>
    <div class="home-card word-card">
        <div class="card-title">
            <span>文字量构成</span>
            <span class="note">共 {{ formatChars(sum) }} 字</span>
        </div>
        <template v-if="list.length">
            <div class="word-rows">
                <button
                    v-for="row in list"
                    :key="row.key"
                    type="button"
                    class="word-row"
                    :title="`${row.label}：${row.chars.toLocaleString()} 字 · 占 ${percentText(row.percent)}`"
                    @click="emit('select', row.key)"
                >
                    <span class="name"><i class="dot" :style="{ background: row.color }" />{{ row.label }}</span>
                    <span class="track"><span class="fill" :style="{ width: row.percent + '%', background: row.color }" /></span>
                    <span class="chars">{{ formatChars(row.chars) }}</span>
                    <span class="pct">{{ percentText(row.percent) }}</span>
                </button>
            </div>
            <p class="word-note">字数不含标题；相片与视频计入其描述；条长 = 占全站文字的百分比</p>
        </template>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else class="empty">暂无文字内容</p>
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
/* 行会被卡片的多余高度均分，与「内容构成」同款处理 */
.word-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.word-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 3px 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: left;
    cursor: pointer;
}
.word-row:hover {
    background: var(--bg-toolbar);
    color: var(--text-primary);
}
.word-row .name {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 62px;
    color: var(--text-primary);
}
.dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
}
.track {
    flex: 1;
    min-width: 0;
    height: 10px;
    border-radius: 5px;
    background: var(--bg-toolbar);
    overflow: hidden;
}
.fill {
    display: block;
    height: 100%;
    min-width: 4px;
    border-radius: 5px;
}
.word-row .chars {
    flex: 0 0 62px;
    text-align: right;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.word-row .pct {
    flex: 0 0 42px;
    text-align: right;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.word-note {
    /* 说明贴卡片底部：行少时不要把行拉散 */
    margin: auto 0 0;
    padding-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
}
.empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
