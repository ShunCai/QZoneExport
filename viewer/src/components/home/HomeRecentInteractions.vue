<script setup lang="ts">
import { computed } from 'vue';
import { formatTime } from '../../data/format';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent, maskName, plainName } from '../../data/mask';
import { formatNickname } from '../../data/richText';
import { actionOf, type RecentInteraction } from '../../data/recentInteractions';

/**
 * 最近互动卡（本人空间概览）
 *
 * 概览里原本只有「互动最多的人」这张人榜，缺少「最近发生了什么」。
 * 这条事件流把最近几条别人留下的评论 / 回复 / 留言按时间列出来。
 *
 * 口径限制：点赞没有时间戳，进不了这条时间线——卡片上要写清，否则会被误读成
 * 「最近只有这么几条互动」。
 */
const props = defineProps<{ items: RecentInteraction[] }>();

const emit = defineEmits<{ open: [] }>();

const { hidden: hideSensitive } = usePrivacy();

function nameHtml(row: RecentInteraction): string {
    const plain = plainName(row.name || row.uin);
    return formatNickname(hideSensitive.value ? maskName(plain) : plain);
}

/** 只到日：最近互动看的是「哪天」，精确到分反而干扰 */
const rows = computed(() => props.items.map((row) => ({
    ...row,
    day: row.time ? formatTime(row.time).slice(5, 10) : '—',
    /** 悬浮提示用完整时间：卡片上只显示月日，跨年时看不出是哪一年 */
    full: row.time ? formatTime(row.time).slice(0, 16) : '—',
    action: actionOf(row.kind),
})));
</script>

<template>
    <div class="home-card recent-card">
        <div class="card-title">
            <span>最近互动</span>
            <span class="note">评论 · 回复 · 留言</span>
        </div>
        <template v-if="rows.length">
            <div class="recent-rows">
                <div
                    v-for="row in rows"
                    :key="`${row.time}-${row.uin}-${row.kind}`"
                    class="recent-row"
                    :title="hideSensitive ? `${row.day} · ${row.action}` : `${row.full} · ${row.action}：${row.snippet}`"
                >
                    <span class="day">{{ row.day }}</span>
                    <span class="who" v-html="nameHtml(row)"></span>
                    <span class="act">{{ row.action }}：</span>
                    <span class="what">{{ hideSensitive ? maskContent(row.snippet) : row.snippet }}</span>
                </div>
            </div>
            <p class="recent-note">点赞没有时间戳，不在上面这条流里</p>
        </template>
        <p v-else class="empty">还没有人在你的空间留下评论或留言</p>

        <div class="foot">
            <button type="button" class="link" @click="emit('open')">查看完整互动 →</button>
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
.recent-rows {
    display: flex;
    flex-direction: column;
}
/* 两列布局（每卡 ~494px）下四段并排就够用：日期 · 谁 · 动作 · 摘要，单行更紧凑 */
.recent-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    padding: 5px 0;
    font-size: 12px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-light);
}
.recent-row:last-child {
    border-bottom: none;
}
.day {
    flex: none;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.who {
    flex: 0 1 auto;
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    color: var(--text-primary);
}
.act {
    flex: none;
    color: var(--text-secondary);
}
/* 摘要吃掉剩余宽度，超出省略 */
.what {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
}
.recent-note {
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
.foot {
    margin-top: auto;
    padding-top: 12px;
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
</style>
