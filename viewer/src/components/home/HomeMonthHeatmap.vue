<script setup lang="ts">
import { computed } from 'vue';

/**
 * 月活跃热力图（横轴年份 × 纵轴月份）
 *
 * 刻意「月份为行、年份为列」并给单元格固定行高：这个组件现在放在区块下方的
 * 全宽折叠里，若沿用 `aspect-ratio: 1`，单元格会被容器宽度撑成 70px 见方，
 * 15 行直接顶出一屏。固定 22px 行高既压住高度，又能在宽屏下把年份铺满。
 */
const props = defineProps<{
    months: Map<string, number>;
    firstMonth: string;
    lastMonth: string;
}>();

const years = computed(() => {
    const start = Number((props.firstMonth || '').slice(0, 4));
    const end = Number((props.lastMonth || '').slice(0, 4));
    if (!start || !end || end < start) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
});

/** 12 行 × 年份列：rows[月份][年份下标] */
const rows = computed(() => Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
        month,
        cells: years.value.map((year) => ({
            year,
            count: props.months.get(`${year}年${String(month).padStart(2, '0')}月`) || 0,
        })),
    };
}));

const max = computed(() => Math.max(1, ...rows.value.flatMap((row) => row.cells.map((c) => c.count))));

function cellStyle(count: number): Record<string, string> {
    if (count <= 0) {
        return { background: 'var(--bg-toolbar)', opacity: '0.35' };
    }
    const ratio = count / max.value;
    return { background: 'var(--accent)', opacity: String(0.15 + ratio * 0.85) };
}
</script>

<template>
    <div v-if="years.length" class="heat">
        <div class="heat-grid" :style="{ '--year-cols': years.length }">
            <span class="corner" />
            <span v-for="year in years" :key="year" class="year">{{ year }}</span>
            <template v-for="row in rows" :key="row.month">
                <span class="month">{{ row.month }}月</span>
                <span
                    v-for="cell in row.cells"
                    :key="cell.year"
                    class="cell"
                    :style="cellStyle(cell.count)"
                    :title="`${cell.year} 年 ${row.month} 月：${cell.count} 条内容`"
                />
            </template>
        </div>
        <div class="legend">
            <span>少</span>
            <span class="cell" style="background:var(--accent);opacity:.15" />
            <span class="cell" style="background:var(--accent);opacity:.45" />
            <span class="cell" style="background:var(--accent);opacity:.75" />
            <span class="cell" style="background:var(--accent);opacity:1" />
            <span>多</span>
        </div>
    </div>
    <p v-else class="empty">暂无月度数据</p>
</template>

<style scoped>
.heat-grid {
    display: grid;
    grid-template-columns: 40px repeat(var(--year-cols), minmax(0, 1fr));
    gap: 3px;
    align-items: center;
}
.month,
.year {
    font-size: 10px;
    color: var(--text-muted);
}
.month {
    text-align: right;
    padding-right: 2px;
}
.year {
    text-align: center;
    white-space: nowrap;
}
.cell {
    display: block;
    height: 22px;
    border-radius: 3px;
    background: var(--bg-toolbar);
}
.legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
}
.legend .cell {
    width: 12px;
    height: 12px;
}
.empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
