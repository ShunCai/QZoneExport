<script setup lang="ts">
import { computed } from 'vue';

/**
 * 月份分布（全年 12 个月合计）
 *
 * 首页只回答「你更常在几月发东西」这一个问题，因此把各年各月压成 12 根柱子；
 * 年 × 月的完整热力图放在本区块的「按年 × 月查看」折叠里，避免它在首屏喧宾夺主。
 */
const props = defineProps<{
    months: { month: number; total: number }[];
}>();

const max = computed(() => Math.max(1, ...props.months.map((m) => m.total)));
const peak = computed(() => {
    const top = [...props.months].sort((a, b) => b.total - a.total)[0];
    return top && top.total > 0 ? top.total : 0;
});

function pct(total: number): number {
    if (total <= 0) return 0;
    return Math.max(1.2, (total / max.value) * 100);
}
</script>

<template>
    <div class="month-bars">
        <div v-for="item in months" :key="item.month" class="col" :class="{ peak: item.total === peak && peak > 0 }">
            <div class="track">
                <div class="bar" :style="{ height: pct(item.total) + '%' }" :title="`${item.month} 月：${item.total.toLocaleString()} 条内容`" />
            </div>
            <div class="name">{{ item.month }}</div>
        </div>
    </div>
</template>

<style scoped>
/* 卡片是 flex 列，这里吃掉「年活跃度」卡里里程碑那一段多出来的高度，两卡齐平 */
.month-bars {
    display: flex;
    flex: 1 1 auto;
    align-items: flex-end;
    gap: 4px;
    min-height: 150px;
    padding: 8px 2px 0;
}
.col {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.bar {
    width: 68%;
    max-width: 22px;
    min-height: 3px;
    background: #b5d4f4;
    border-radius: 3px 3px 0 0;
    transition: height 0.2s;
}
.col.peak .bar {
    background: var(--accent);
}
.name {
    margin-top: 6px;
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
</style>
