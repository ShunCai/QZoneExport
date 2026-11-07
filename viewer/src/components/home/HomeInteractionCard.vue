<script setup lang="ts">
import { computed } from 'vue';
import { formatTime } from '../../data/format';
import { heShe } from '../../data/pronoun';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskName, plainName } from '../../data/mask';
import { formatNickname } from '../../data/richText';
import type { OwnerTargetInteraction, InteractionCategory } from '../../data/owner-target';

/**
 * 概览页的「你与 TA 的互动」速览卡
 *
 * 原来这块直接用互动明细页的整块面板（4 指标 + 访问区 + 时间轴 + 两个折叠面板），
 * 压在概览底部与上下单卡节奏不一致，而且只有他人空间备份才有，两种空间结构不一样。
 * 概览只需回答三件事：往来多少、谁更主动、还联系吗——其余（明细/趋势/浏览痕迹）都在互动页。
 */
const props = defineProps<{
    data: OwnerTargetInteraction;
    /** 空间主人性别（user.sex），用于把「TA」换成他/她 */
    targetSex?: number | string;
}>();

const emit = defineEmits<{ open: []; openOthers: []; stat: [payload: { category: InteractionCategory; dir: 'me' | 'ta' }] }>();

const { hidden: hideSensitive } = usePrivacy();
const t = computed(() => heShe(props.targetSex));

/** 空间主人展示名：昵称里可能带 [em] token，与全站同一套转换；隐私态先剥 token 再打码 */
const targetNameHtml = computed(() => {
    const plain = plainName(String(props.data?.targetName ?? ''));
    return formatNickname(hideSensitive.value ? maskName(plain) : plain);
});

const total = computed(() => props.data?.totalInteractions ?? 0);
const fromMe = computed(() => props.data?.fromMe ?? 0);
const fromTa = computed(() => props.data?.fromTa ?? 0);
/** 双向条两端占比：都从 0 开始时各占一半，避免出现 NaN */
const barMe = computed(() => {
    const sum = fromMe.value + fromTa.value;
    return sum > 0 ? (fromMe.value / sum) * 100 : 50;
});

/**
 * 三个「我主动」的动作。category 用单数（board/comment/like）——
 * 互动页的筛选参数与明细事件的 category 字段都是单数，写成复数会筛不到。
 */
const actions = computed(() => [
    { key: 'board', label: '留言', value: props.data?.myBoards ?? 0 },
    { key: 'comment', label: '评论', value: props.data?.myComments ?? 0 },
    { key: 'like', label: '点赞', value: props.data?.myLikes ?? 0 },
] as { key: InteractionCategory; label: string; value: number }[]);

const rateText = computed(() => {
    const r = props.data?.responseRate;
    if (r === null || r === undefined) return '—';
    return `${Math.round(r * 1000) / 10}%`;
});

/**
 * 按年的互动量（最小柱图）
 *
 * 只用数字的话卡片中下部会空一大块，而「这些年还联系吗」正是概览该回答的第三件事。
 * 注意 monthly 只包含「有互动的月份」，直接按月画会缺月份、看着像随机虚线；
 * 这里按年补齐（没互动的年份留零柱），柱子才有的读。
 */
const spark = computed(() => {
    const monthly = props.data?.monthly ?? [];
    if (!monthly.length) return [];
    const byYear = new Map<string, number>();
    for (const m of monthly) {
        const year = String(m.key).slice(0, 4);
        byYear.set(year, (byYear.get(year) ?? 0) + m.count);
    }
    const years = [...byYear.keys()].sort();
    const first = Number(years[0]);
    const last = Number(years[years.length - 1]);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
    const rows: { year: string; count: number }[] = [];
    for (let y = first; y <= last; y++) {
        rows.push({ year: String(y), count: byYear.get(String(y)) ?? 0 });
    }
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({
        ...r,
        height: r.count > 0 ? Math.max(8, (r.count / max) * 100) : 3,
    }));
});

/** 首末互动的年月：只有年份月份够用，缺失时给「—」 */
function monthOf(ts: number | null | undefined): string {
    if (!ts) return '—';
    return formatTime(ts).slice(0, 7);
}
const periodText = computed(() => {
    const first = monthOf(props.data?.firstTime);
    const last = monthOf(props.data?.lastTime);
    if (first === '—' && last === '—') return '';
    if (first === last) return `最近 ${last}`;
    return `${first} → ${last}`;
});
</script>

<template>
    <div class="home-card interaction-card">
        <div class="card-title">
            <span class="title-text">我 与 <span v-html="targetNameHtml"></span> 的互动</span>
            <span class="note">共 {{ total.toLocaleString() }} 次往来</span>
        </div>

        <template v-if="total > 0">
            <!-- 双向条：一眼看出谁更主动，比四个孤立数字有信息量 -->
            <div class="duo">
                <span class="duo-side">
                    我发起 <b>{{ fromMe.toLocaleString() }}</b>
                </span>
                <span class="duo-side is-right">
                    <b>{{ fromTa.toLocaleString() }}</b> {{ t }}回应
                </span>
            </div>
            <div class="duo-bar" :title="`我发起 ${fromMe} 次 · ${t}回应 ${fromTa} 次`">
                <span class="seg seg-me" :style="{ width: barMe + '%' }" />
                <span class="seg seg-ta" :style="{ width: 100 - barMe + '%' }" />
            </div>

            <!-- 三个主动动作：点任意一个进互动页并带上对应筛选 -->
            <div class="actions">
                <button
                    v-for="a in actions"
                    :key="a.key"
                    type="button"
                    class="action"
                    :title="`查看${a.label}明细`"
                    @click="emit('stat', { category: a.key, dir: 'me' })"
                >
                    {{ a.label }}<b>{{ a.value.toLocaleString() }}</b>
                </button>
            </div>

            <div class="meta">
                回应率 <b>{{ rateText }}</b>
                <template v-if="periodText"> · {{ periodText }}</template>
            </div>

            <div v-if="spark.length > 1" class="spark-wrap">
                <div class="spark" :title="`按年互动量：${spark[0]!.year}–${spark[spark.length - 1]!.year}`">
                    <span v-for="r in spark" :key="r.year" class="spark-col">
                        <span
                            class="spark-bar"
                            :class="{ 'is-zero': !r.count }"
                            :style="{ height: r.height + '%' }"
                            :title="`${r.year}：${r.count} 次`"
                        />
                    </span>
                </div>
                <div class="spark-axis">
                    <span v-for="r in spark" :key="r.year">{{ r.year }}</span>
                </div>
            </div>
        </template>
        <p v-else class="empty">这份备份里没有捕捉到我与 {{ t }} 的往来（留言、评论、点赞）</p>

        <div class="foot">
            <button type="button" class="link" @click="emit('open')">查看完整互动 →</button>
            <button type="button" class="link is-quiet" @click="emit('openOthers')">看{{ t }}与别人 →</button>
        </div>
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
    gap: 10px;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 500;
    min-width: 0;
}
/* 空间名可能很长：标题一侧允许省略，别把「共 N 次往来」挤掉 */
.title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.note {
    flex: none;
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}

.duo {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--text-secondary);
}
.duo-side b {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.duo-side.is-right {
    text-align: right;
}

.duo-bar {
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--bg-toolbar);
}
.seg {
    display: block;
    height: 100%;
    min-width: 3px;
}
/* 与「内容构成」同一套配色语义：第一序列蓝、第二序列绿 */
.seg-me {
    background: #2080f0;
}
.seg-ta {
    background: #1d9e75;
}

.actions {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-secondary);
}
.action {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    padding: 2px 4px;
    margin: -2px -4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
}
.action:hover {
    background: var(--bg-toolbar);
    color: var(--text-primary);
}
.action b {
    font-weight: 500;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}

.meta {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
}
.meta b {
    font-weight: 500;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}

.empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
}

.spark-wrap {
    /* 等高布局下由这块吸收剩余高度：柱子跟着变高，卡片不会出现空白 */
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 60px;
    margin-top: 14px;
}
.spark {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    flex: 1;
    min-height: 42px;
}
.spark-col {
    flex: 1;
    display: flex;
    align-items: flex-end;
    height: 100%;
}
.spark-bar {
    width: 100%;
    border-radius: 2px 2px 0 0;
    background: rgba(32, 128, 240, 0.32);
}
.spark-bar.is-zero {
    background: var(--border-light);
}
.spark:hover .spark-bar:not(.is-zero) {
    background: rgba(32, 128, 240, 0.55);
}
/* 年份轴：只给两位数字，够定位到哪一年，不抢主数字 */
.spark-axis {
    display: flex;
    gap: 4px;
    margin-top: 3px;
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.spark-axis span {
    flex: 1;
    text-align: center;
}

.foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
}
.link {
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.link:hover {
    text-decoration: underline;
}
.link.is-quiet {
    color: var(--text-secondary);
}
</style>
