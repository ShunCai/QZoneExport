<script setup lang="ts">
import { computed } from 'vue';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskedUserLabel } from '../../data/mask';
import { formatNickname } from '../../data/richText';
import { clockOf, type NightDialog } from '../../data/nightCompanions';
import UserAvatar from '../UserAvatar.vue';

/**
 * 深夜对话卡
 *
 * 只算「同一线程内双方都在 0–5 点发过言」——单向的深夜留言不算，那是「来访」不是「陪」。
 * 因此这张卡比「深夜动态」稀疏得多，但每一条都真的是一次聊起来。
 */
const props = defineProps<{ people: NightDialog[] }>();

const emit = defineEmits<{ select: [uin: string]; openAll: [] }>();

const { hidden: hideSensitive } = usePrivacy();

const rows = computed(() => props.people.map((p) => ({
    ...p,
    label: hideSensitive.value
        ? maskedUserLabel({ uin: p.uin, name: p.name })
        : (p.name || p.uin),
    clock: clockOf(p.latest),
})));

function nameHtml(row: { uin: string; name: string }): string {
    // 隐私模式：昵称也要打码（此前漏了，深夜对话卡会直接显示对方昵称）
    const label = hideSensitive.value
        ? (maskedUserLabel({ uin: row.uin, name: row.name }) || row.uin)
        : (row.name || row.uin);
    return formatNickname(label);
}
</script>

<template>
    <div class="home-card night-card">
        <div class="card-title">
            <span>深夜对话</span>
            <span class="note">0–5 点有来有往</span>
        </div>
        <template v-if="rows.length">
            <button
                v-for="row in rows"
                :key="row.uin"
                type="button"
                class="person-row"
                :title="`${row.label}：${row.count} 次深夜对话，最晚 ${row.clock}`"
                @click="emit('select', row.uin)"
            >
                <user-avatar :uin="row.uin" :size="24" :link="false" :class="{ 'privacy-blur': hideSensitive }" />
                <span class="person-name" v-html="nameHtml(row)"></span>
                <span class="person-clock">最晚 {{ row.clock }}</span>
                <span class="person-score">{{ row.count }}</span>
            </button>
            <button type="button" class="card-link" @click="emit('openAll')">查看深夜详情 →</button>
        </template>
        <p v-else class="empty">还没有出现过「双方都在深夜」的对话</p>
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
.person-row {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 0;
    border: none;
    border-bottom: 1px solid var(--border-light);
    background: transparent;
    text-align: left;
    cursor: pointer;
}
.person-row:last-of-type {
    border-bottom: none;
}
.person-row:hover .person-name {
    color: var(--accent-pressed);
}
.person-name {
    font-size: 13px;
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* 最晚时刻是这张卡的"情绪点"：凌晨3点还在，比次数更打动人 */
.person-clock {
    flex: none;
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.person-score {
    flex: 0 0 34px;
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.card-link {
    display: inline-block;
    margin-top: auto;
    padding-top: 12px;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
    text-align: left;
}
.card-link:hover {
    text-decoration: underline;
}
.empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
