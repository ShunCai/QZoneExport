<script setup lang="ts">
import { computed } from 'vue';
import { formatText } from '../../data/richText';
import type { EmojiCount } from '../../data/emojiStats';

/**
 * 最常用的表情（横向条，不占卡位）
 *
 * 表达习惯是最有个人色彩的一类统计：早年爱用「偷笑/害羞/流泪」，后来改用大表情包，
 * 一排图就能看出变化。做成横条而不是卡片：它本质是「6 个图标 + 数字」，
 * 竖排成卡会显得很空，横条也不占分组里的两个卡位。
 */
const props = defineProps<{ rows: EmojiCount[]; total: number }>();

/** 直接用富文本管线生成表情图：本地 gif → 在线地址 → 占位图，三级兜底现成可复用 */
const cells = computed(() => props.rows.map((row) => ({
    ...row,
    html: formatText(`[em]e${row.id}[/em]`),
    percent: props.total > 0 ? (row.count / props.total) * 100 : 0,
})));
</script>

<template>
    <div v-if="cells.length" class="emoji-strip">
        <div class="strip-head">
            <span class="strip-title">最常用的表情</span>
            <span class="strip-note">共 {{ total.toLocaleString() }} 次表情 · 说说与留言</span>
        </div>
        <div class="strip-body">
            <div v-for="cell in cells" :key="cell.id" class="strip-cell" :title="`${cell.count} 次（占 ${Math.round(cell.percent)}%）`">
                <span class="strip-icon" v-html="cell.html" />
                <span class="strip-count">{{ cell.count }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.emoji-strip {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 4px;
    padding: 14px 20px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.emoji-strip:hover {
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
    color: var(--text-muted);
}
.strip-body {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 18px;
    min-width: 0;
}
.strip-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}
/* 横条里的表情比正文里大一号：这里就是主角 */
.strip-icon :deep(img.emoticon) {
    width: 30px;
    height: 30px;
    vertical-align: middle;
}
.strip-count {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
</style>
