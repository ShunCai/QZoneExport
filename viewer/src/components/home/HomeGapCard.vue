<script setup lang="ts">
import type { GapStats } from '../../data/counts';

/**
 * 榜单卡的「断档」：跨度内「沉默的月份」与最长空白段。
 * 与「那年今日」成对——那年今日是「在场的日子」，这里是「消失的日子」。
 * 纯统计展示，无隐私内容。
 */
const props = defineProps<{
    stats: GapStats | null;
    loading?: boolean;
}>();
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>断档</span>
            <span class="note">沉默的月份</span>
        </div>
        <p v-if="props.loading" class="empty">正在统计…</p>
        <p v-else-if="!props.stats" class="empty">内容太少，谈不上断档</p>
        <template v-else>
            <div class="gap-hero">
                <span class="gap-num">{{ props.stats.longestGapMonths }}</span>
                <span class="gap-unit">个月最长沉默</span>
            </div>
            <div v-if="props.stats.longestGapMonths > 0" class="gap-range">
                {{ props.stats.gapStart }} → {{ props.stats.gapEnd }}
            </div>
            <div class="gap-row">
                <span class="gap-label">沉默月</span>
                <span class="gap-value">
                    {{ props.stats.silentMonths }} / {{ props.stats.totalMonths }} 个月
                    <span class="gap-percent">（{{ props.stats.silentPercent }}%）</span>
                </span>
            </div>
            <div class="gap-row">
                <span class="gap-label">空白年份</span>
                <span class="gap-value">
                    {{ props.stats.emptyYears.length ? props.stats.emptyYears.join('、') : '无整年空白' }}
                </span>
            </div>
        </template>
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
.empty {
    margin: 12px 0;
    font-size: 12px;
    color: var(--text-secondary);
}
/* 主指标：最长沉默 */
.gap-hero {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
}
.gap-num {
    font-size: 34px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.gap-unit {
    font-size: 12px;
    color: var(--text-secondary);
}
.gap-range {
    margin-bottom: 10px;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.gap-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border-light);
    font-size: 12px;
}
.gap-label {
    flex: none;
    width: 56px;
    color: var(--text-secondary);
}
.gap-value {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.gap-percent {
    color: var(--text-secondary);
}
</style>
