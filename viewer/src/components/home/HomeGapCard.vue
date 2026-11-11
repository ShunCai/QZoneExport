<script setup lang="ts">
import { computed } from 'vue';
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

/** 主指标换算：≥12 个月显示「X 年 Y 个月」，不足一年保持「N 个月」 */
const hero = computed(() => {
    const months = props.stats?.longestGapMonths ?? 0;
    if (months >= 12) {
        return { years: Math.floor(months / 12), rest: months % 12 };
    }
    return null;
});
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>断档时期</span>
            <span class="note">沉默的月份</span>
        </div>
        <p v-if="props.loading" class="empty">正在统计…</p>
        <p v-else-if="!props.stats" class="empty">内容太少，谈不上断档</p>
        <template v-else>
            <div class="gap-hero">
                <template v-if="hero">
                    <span class="gap-num">{{ hero.years }}</span>
                    <span class="gap-unit">年</span>
                    <template v-if="hero.rest">
                        <span class="gap-num">{{ hero.rest }}</span>
                        <span class="gap-unit">个月</span>
                    </template>
                </template>
                <template v-else>
                    <span class="gap-num">{{ props.stats.longestGapMonths }}</span>
                    <span class="gap-unit">个月</span>
                </template>
                <span class="gap-unit">最长沉默</span>
            </div>
            <div v-if="props.stats.longestGapMonths > 0" class="gap-range">
                {{ props.stats.gapStart }} →
                <template v-if="props.stats.gapOngoing">至今</template>
                <template v-else>{{ props.stats.gapEnd }}</template>
            </div>

            <!-- 断段列表：最长的前 3 段 -->
            <div v-if="props.stats.topGaps.length" class="gap-list">
                <div v-for="(g, i) in props.stats.topGaps" :key="i" class="gap-item">
                    <span class="gap-item-rank">{{ i + 1 }}</span>
                    <span class="gap-item-range">
                        {{ g.start }} → <template v-if="g.ongoing">至今</template><template v-else>{{ g.end }}</template>
                    </span>
                    <span class="gap-item-months">{{ g.months }} 个月</span>
                </div>
            </div>
            <div v-if="props.stats.totalGaps > props.stats.topGaps.length" class="gap-more">
                共 {{ props.stats.totalGaps }} 段空白，仅显示最长的 {{ props.stats.topGaps.length }} 段
            </div>

            <div class="gap-row">
                <span class="gap-label">沉默月</span>
                <span class="gap-value">
                    {{ props.stats.silentMonths }} / {{ props.stats.totalMonths }} 个月
                    <span class="gap-percent">（{{ props.stats.silentPercent }}%）</span>
                </span>
            </div>
            <div class="gap-row gap-row-wide" title="按内容条数统计的月度峰值：说说等内容一条算一条，相片按张逐张计数（不含「说说和日志相册」自动归档的配图）">
                <span class="gap-label">内容最多的月</span>
                <span class="gap-value">
                    {{ props.stats.peakMonth.month }} · {{ props.stats.peakMonth.count }} 条
                    <span class="gap-note">含相片逐张计数</span>
                </span>
            </div>
            <div class="gap-row">
                <span class="gap-label">活跃年份</span>
                <span class="gap-value">{{ props.stats.activeYearCount }} 个年头</span>
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
    font-size: 13px;
    font-weight: 500;
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
/* 断段 Top3 列表 */
.gap-list {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
    border-top: 1px solid var(--border-light);
}
.gap-more {
    margin: -2px 0 8px;
    font-size: 11px;
    color: var(--text-secondary);
}
.gap-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
    border-bottom: 1px solid var(--border-light);
    font-size: 12px;
}
.gap-item-rank {
    flex: none;
    width: 16px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.gap-item-range {
    flex: 1;
    min-width: 0;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.gap-item-months {
    flex: none;
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
/* 「内容最多的月」比其它行标题长，单独放宽；口径说明用弱化小字跟在后面 */
.gap-row-wide .gap-label {
    width: 76px;
}
.gap-note {
    margin-left: 6px;
    font-size: 11px;
    color: var(--text-secondary);
}
</style>
