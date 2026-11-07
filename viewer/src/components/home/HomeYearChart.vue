<script setup lang="ts">
import { computed } from 'vue';

interface YearItem {
    year: string;
    total: number;
    parts: { label: string; count: number }[];
}

const props = defineProps<{
    items: YearItem[];
    maxTotal: number;
    peakYears: string[];
}>();

const max = computed(() => Math.max(1, props.maxTotal));

function isPeak(year: string): boolean {
    return props.peakYears.includes(year);
}

function pct(total: number): number {
    if (total <= 0) return 0;
    return Math.max(1, (total / max.value) * 100);
}

function tip(item: YearItem): string {
    return `${item.year}年：共 ${item.total} 条\n${item.parts.map((p) => `${p.label} ${p.count}`).join('、')}`;
}
</script>

<template>
    <div class="year-chart">
        <div
            v-for="item in items"
            :key="item.year"
            class="year-col"
            :class="{ peak: isPeak(item.year) }"
            :title="tip(item)"
        >
            <div class="year-col-value">
                <template v-if="isPeak(item.year)">{{ item.total }}</template>
                <template v-else>&nbsp;</template>
            </div>
            <div class="year-col-track">
                <div class="year-col-bar" :style="{ height: pct(item.total) + '%' }" />
            </div>
            <div class="year-col-name">{{ item.year }}</div>
        </div>
    </div>

    <div class="year-list">
        <div
            v-for="item in items"
            :key="item.year"
            class="year-list-row"
            :class="{ peak: isPeak(item.year) }"
            :title="tip(item)"
        >
            <span class="year-list-year">
                <template v-if="isPeak(item.year)">★</template>
                {{ item.year }}
            </span>
            <div class="year-list-bar-track">
                <div class="year-list-bar" :style="{ width: pct(item.total) + '%' }" />
            </div>
            <span class="year-list-total">{{ item.total }}</span>
        </div>
    </div>
</template>

<style scoped>
.year-chart {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 150px;
    padding: 8px 0 0;
    overflow: hidden;
}
/* 半栏宽度要容得下 15 年：列不再设最小宽度，让它们等分，避免最后几年被裁掉 */
.year-col {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.year-col-value {
    margin-bottom: 4px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.year-col-track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.year-col-bar {
    width: 60%;
    max-width: 32px;
    min-height: 3px;
    background: #b5d4f4;
    border-radius: 3px 3px 0 0;
    transition: height 0.2s;
}
.year-col.peak .year-col-bar {
    background: var(--accent);
}
.year-col.peak .year-col-value {
    color: var(--accent-pressed);
    font-weight: 500;
}
.year-col-name {
    margin-top: 6px;
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.year-list {
    display: none;
    flex-direction: column;
    gap: 2px;
    padding: 2px 0;
}
.year-list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 26px;
    padding: 0 4px;
    border-radius: 4px;
}
.year-list-row:hover {
    background: var(--bg-toolbar);
}
.year-list-year {
    flex: 0 0 54px;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.year-list-bar-track {
    flex: 1;
    height: 8px;
    background: var(--bg-toolbar);
    border-radius: 4px;
    overflow: hidden;
}
.year-list-bar {
    height: 100%;
    min-width: 2px;
    background: #b5d4f4;
    border-radius: 4px;
}
.year-list-row.peak .year-list-bar {
    background: var(--accent);
}
.year-list-row.peak .year-list-year,
.year-list-row.peak .year-list-total {
    color: var(--accent-pressed);
    font-weight: 500;
}
.year-list-total {
    flex: 0 0 50px;
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
@media (max-width: 580px) {
    .year-chart {
        display: none;
    }
    .year-list {
        display: flex;
    }
}
</style>
