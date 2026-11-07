<script setup lang="ts">
import { computed } from 'vue';

/**
 * 时间轴窄条（Hero 的延伸，不占 section 编号）
 *
 * 原先「时间脉络」是首块，两张图表 + 折叠条约 250px，喧宾夺主。
 * 这里把 15 年的起伏压成一条 ~90px 的横条：初识 / 峰值 / 最近三个结论直接写在右侧，
 * 想看细的年份柱、月份分布再展开详情，默认收起。
 */
const props = defineProps<{
    items: { year: string; total: number }[];
    peakYears: string[];
    milestones: { first: string; peak: string; last: string };
}>();

const max = computed(() => Math.max(1, ...props.items.map((item) => item.total)));

function heightPct(total: number): number {
    // 低活跃年份也要看得见：2px 的柱子在这一栏里就是一根横线，会被误当成「没数据」
    if (total <= 0) return 18;
    return Math.max(18, (total / max.value) * 100);
}
</script>

<template>
    <details class="strip-wrap">
        <summary class="strip-head">
            <span class="strip-meta">
                <span class="strip-label">时间轴</span>
                <span v-if="items.length" class="strip-range">{{ items[0].year }} — {{ items[items.length - 1].year }}</span>
            </span>
            <span class="strip-chart">
                <span
                    v-for="item in items"
                    :key="item.year"
                    class="tick"
                    :class="{ peak: peakYears.includes(item.year) }"
                    :title="`${item.year} 年：${item.total.toLocaleString()} 条内容`"
                >
                    <span class="tick-track">
                        <span class="tick-bar" :style="{ height: heightPct(item.total) + '%' }" />
                    </span>
                    <span class="tick-year">{{ item.year }}</span>
                </span>
            </span>
            <span class="strip-miles">
                <span>初识 <b>{{ milestones.first }}</b></span>
                <span>最活跃 <b>{{ milestones.peak }}</b></span>
                <span>最近 <b>{{ milestones.last }}</b></span>
            </span>
            <span class="strip-more" />
        </summary>
        <div class="strip-body"><slot /></div>
    </details>
</template>

<style scoped>
/*
 * 恢复成卡片：非卡片的细线带反而更没层次。
 * 真正缺的是「表面」——和全站 .card-item 一致的浅阴影 + hover 反馈，
 * 所有首页卡片（.home-card / .home-more）都补了同一套，见各自样式。
 */
.strip-wrap {
    border: 1px solid var(--border-card);
    border-radius: 14px;
    background: var(--bg-primary);
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
    margin: 16px 0 36px;
}
.strip-wrap:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.strip-head {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 12px 18px;
    cursor: pointer;
    list-style: none;
}
.strip-head::-webkit-details-marker {
    display: none;
}
.strip-meta {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex: 0 0 auto;
}
.strip-label {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.04em;
}
.strip-range {
    font-size: 13px;
    color: var(--text-primary);
}
.strip-chart {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 46px;
}
.tick {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
}
/* 百分比柱高必须相对「轨道」算，否则再加上年份标签会超出窄条 */
.tick-track {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    border-bottom: 1px solid var(--border-light);
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.tick-bar {
    width: 100%;
    max-width: 18px;
    min-height: 5px;
    border-radius: 2px 2px 0 0;
    background: #b5d4f4;
}
.tick.peak .tick-bar {
    background: var(--accent);
}
.tick-year {
    flex: 0 0 12px;
    font-size: 9px;
    line-height: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.strip-miles {
    display: flex;
    gap: 12px;
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
}
.strip-miles b {
    font-weight: 500;
    color: var(--text-primary);
}
.strip-more {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--accent);
}
.strip-wrap:not([open]) .strip-more::after {
    content: "展开详情";
}
.strip-wrap[open] .strip-more::after {
    content: "收起详情";
}
.strip-body {
    border-top: 1px solid var(--border-card);
    padding: 18px;
}
@media (max-width: 860px) {
    .strip-head {
        flex-wrap: wrap;
        gap: 10px;
    }
    .strip-chart {
        order: 3;
        flex-basis: 100%;
    }
    .strip-miles {
        gap: 8px;
        flex-wrap: wrap;
    }
}
</style>
