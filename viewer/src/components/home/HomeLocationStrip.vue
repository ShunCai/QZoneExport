<script setup lang="ts">
import type { TopLocation } from '../../data/counts';

/**
 * 常驻地点 / 常驻城市 横条（与「最常用的表情 / 最常用的词」同款外壳）
 *
 * 纯展示：chip 是「地名 + 次数」，hover 的 title 给占比与最近时间。
 * 城市条与地点条共用本组件，靠 props 区分标题与口径说明。
 */
const props = defineProps<{
    title: string;
    note: string;
    rows: TopLocation[];
    loading?: boolean;
}>();
</script>

<template>
    <div class="word-strip">
        <div class="strip-head">
            <span class="strip-title">{{ props.title }}</span>
            <span class="strip-note">{{ props.loading ? '正在统计…' : props.note }}</span>
        </div>
        <div class="strip-body">
            <span v-if="props.loading" class="strip-empty">正在统计…</span>
            <span v-else-if="!props.rows.length" class="strip-empty">没有带地点的内容</span>
            <span
                v-for="row in props.rows"
                :key="row.location"
                class="loc-chip"
                :title="`${row.location}：${row.count} 次（${row.percent}%）· 最近 ${row.latestTime}`"
            >
                <span class="word">{{ row.location }}</span>
                <span class="count">{{ row.count }}</span>
            </span>
        </div>
    </div>
</template>

<style scoped>
/* 外壳与「最常用的表情 / 词」保持一致（scoped 各自独立，样式同步维护） */
.word-strip {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 14px 20px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.word-strip:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.strip-head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.strip-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}
.strip-note {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.strip-body {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    min-width: 0;
}
.strip-empty {
    font-size: 12px;
    color: var(--text-secondary);
}
/* 地点 chip：与词条 chip 同构（地名 + 次数） */
.loc-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 4px 9px;
    border: 1px solid var(--border-light);
    border-radius: 999px;
    background: var(--bg-toolbar);
}
.word {
    font-size: 13px;
    color: var(--text-primary);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.count {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
</style>
