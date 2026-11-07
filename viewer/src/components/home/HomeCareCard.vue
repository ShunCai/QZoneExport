<script setup lang="ts">
import { computed } from 'vue';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskedUserLabel } from '../../data/mask';
import { formatNickname } from '../../data/richText';
import type { CareFriend } from '../../data/top-people';
import UserAvatar from '../UserAvatar.vue';

/**
 * 在意的人（特别关心）
 *
 * 好友列表里被我标成「特别关心」的那几个人，以及他们在我空间留下的赞/评论次数。
 * 从「互动最多的人」里拆出来独立成卡：两者口径不同——一个是**我在意谁**（主观标记），
 * 一个是**谁最活跃**（客观计数），混在一张卡里会让人分不清排名含义。
 *
 * 只有本人空间才有这份数据：他人空间备份不含好友列表，所以那张卡不会渲染。
 */
const props = defineProps<{ care: CareFriend[]; hidden?: number }>();

const emit = defineEmits<{ select: [uin: string]; openAll: [] }>();

const { hidden: hideSensitive } = usePrivacy();

const rows = computed(() => props.care.map((row) => {
    const label = hideSensitive.value
        ? (maskedUserLabel({ uin: row.uin, name: row.name }) || row.uin)
        : (row.name || row.uin);
    return { ...row, html: formatNickname(label) };
}));
</script>

<template>
    <div class="home-card care-card">
        <div class="card-title">
            <span>在意的人</span>
            <span class="note">特别关心 · 赞 + 评论</span>
        </div>
        <template v-if="rows.length">
            <button
                v-for="row in rows"
                :key="row.uin"
                type="button"
                class="person-row"
                :title="row.score > 0 ? `特别关心：赞 ${row.likes} · 评论 ${row.comments}` : '特别关心：还没有往来'"
                @click="emit('select', row.uin)"
            >
                <user-avatar :uin="row.uin" :size="24" :link="false" :class="{ 'privacy-blur': hideSensitive }" />
                <span class="person-name" v-html="row.html" />
                <span class="person-score">{{ row.score ? row.score.toLocaleString() : '—' }}</span>
            </button>
            <button type="button" class="card-link" @click="emit('openAll')">查看完整互动 →</button>
        </template>
        <p v-else class="empty">好友列表里还没有标记特别关心的人</p>
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
.person-score {
    margin-left: auto;
    flex: none;
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
