<script setup lang="ts">
import { computed } from 'vue';

interface CompositionCard {
    key: string;
    label: string;
    total: number;
    excludeFromTotal?: boolean;
}

const props = defineProps<{
    cards: CompositionCard[];
    total: number;
}>();

const emit = defineEmits<{ select: [key: string] }>();

/**
 * 配色按「占比重」分配，而不是按模块钉死
 *
 * 约定：占比第一的品牌蓝、第二的品牌绿，其余依次取区分度高的色。
 * （按模块钉死会撞色：相片与说说都落到蓝色系时，最大的一块反而分不出来。）
 */
const RANK_COLORS = ['#2080f0', '#1d9e75', '#7c6bc4', '#d4537e', '#ba7517', '#0f8fb3', '#888780', '#c2410c'];

/** 有效内容：按条目数从大到小，行内比例条与数字同序，从大块读起 */
const included = computed(() => props.cards
    .filter((c) => !c.excludeFromTotal && c.total > 0)
    .sort((a, b) => b.total - a.total));

/**
 * 不计入项（好友、访客、相册这类「容器 / 行为」）：单独分组，
 * 它们与「内容条数」不是一个量纲，混进比例里会让相片只剩个位数百分比。
 */
const excluded = computed(() => props.cards
    .filter((c) => c.excludeFromTotal && c.total > 0)
    .sort((a, b) => b.total - a.total));

/** 比例基数 = 有效内容总数（父组件已算好，缺失时退回求和） */
const sum = computed(() => {
    const total = props.total > 0 ? props.total : included.value.reduce((s, c) => s + c.total, 0);
    return Math.max(1, total);
});

const rows = computed(() => included.value.map((c, i) => {
    const percent = (c.total / sum.value) * 100;
    return {
        ...c,
        color: RANK_COLORS[i % RANK_COLORS.length]!,
        /** 条形长度**就是百分比**：轨道代表「全部有效内容」，图形与右侧数字严格对应 */
        percent,
        width: percent,
    };
}));

/**
 * 不计入项**不画比例条**：它们与「内容条数」不是一个量纲（访客 12 万 vs 相片 1 千），
 * 无论怎么归一都会误导——早先「按最大项比例、封顶 15%」的写法，会让访客的灰条
 * 反而比相的实条更长。这里只给一个固定长度的小灰块表示「有数据、口径不同」。
 */

/** 占比文案：不足 1% 的给 <1%，避免一排 0% 看着像没数据 */
function percentText(percent: number): string {
    if (percent <= 0) return '0%';
    if (percent < 1) return '<1%';
    return `${Math.round(percent)}%`;
}
</script>

<template>
    <div class="home-card comp-card">
        <div class="card-title">
            <span>内容构成</span>
            <span class="note">共 {{ sum.toLocaleString() }} 条有效内容</span>
        </div>
        <template v-if="rows.length">
            <!-- 逐行内联比例条：数值与图形贴在同一行，不用在条形与图例之间来回对照 -->
            <div class="comp-rows">
                <button
                    v-for="row in rows"
                    :key="row.key"
                    type="button"
                    class="comp-row"
                    :title="`${row.label}：${row.total.toLocaleString()} 条 · 占 ${percentText(row.percent)}`"
                    @click="emit('select', row.key)"
                >
                    <span class="name"><i class="dot" :style="{ background: row.color }" />{{ row.label }}</span>
                    <span class="track"><span class="fill" :style="{ width: row.width + '%', background: row.color }" /></span>
                    <span class="count">{{ row.total.toLocaleString() }}</span>
                    <span class="pct">{{ percentText(row.percent) }}</span>
                </button>
            </div>

            <div v-if="excluded.length" class="comp-excluded">
                <div class="ex-head">不计入 <em>不参与上面的比例基数</em></div>
                <button
                    v-for="row in excluded"
                    :key="row.key"
                    type="button"
                    class="comp-row is-muted"
                    :title="`${row.label}：${row.total.toLocaleString()} 条（不计入比例）`"
                    @click="emit('select', row.key)"
                >
                    <span class="name"><i class="dot dot-muted" />{{ row.label }}</span>
                    <span class="track"><i class="block-muted" /></span>
                    <span class="count">{{ row.total.toLocaleString() }}</span>
                    <span class="pct">—</span>
                </button>
            </div>

            <p class="comp-note">条长 = 占有效内容的百分比；灰色块仅作标识，不参与基数</p>
        </template>
        <p v-else class="empty">暂无内容构成数据</p>
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

/* 行会被卡片的多余高度均分，避免这一列比右侧榜单矮一截时底部留白 */
.comp-rows {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2px;
}
.comp-row {
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
.comp-row:hover {
    background: var(--bg-toolbar);
    color: var(--text-primary);
}
.comp-row:hover .fill {
    filter: saturate(1.15);
}

/* 名称列定宽：条形起点对齐，扫读时长度才可比 */
.comp-row .name {
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
.dot-muted {
    background: var(--border-dashed);
}

/* 轨道带极浅底色：它代表「全部有效内容」，条形在其中的长度就是百分比 */
.comp-row .track {
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
    /* 保底 4px：<1% 的条目按真实比例不足 1px，给个能让眼睛看见的宽度 */
    min-width: 4px;
    border-radius: 5px;
    background: var(--accent);
}
.block-muted {
    display: block;
    width: 16px;
    height: 100%;
    border-radius: 5px;
    background: var(--border-dashed);
}

.comp-row .count {
    flex: 0 0 56px;
    text-align: right;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.comp-row .pct {
    flex: 0 0 42px;
    text-align: right;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.comp-excluded {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-light);
}
.ex-head {
    margin-bottom: 2px;
    font-size: 11px;
    color: var(--text-secondary);
}
.ex-head em {
    font-style: normal;
    color: var(--text-muted);
}
.comp-row.is-muted .name {
    color: var(--text-secondary);
}
.comp-row.is-muted .count {
    color: var(--text-secondary);
}

.comp-note {
    margin: 8px 0 0;
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
