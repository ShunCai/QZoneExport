<script setup lang="ts">
import { usePrivacy } from '../../composables/usePrivacy';
import { maskedUserLabel } from '../../data/mask';
import type { TopPerson } from '../../data/top-people';
import { formatNickname } from '../../data/richText';
import UserAvatar from '../UserAvatar.vue';

const props = defineProps<{ people: TopPerson[]; loading?: boolean }>();

const emit = defineEmits<{ select: [uin: string]; openAll: [] }>();

const { hidden: hideSensitive } = usePrivacy();

function labelOf(person: TopPerson): string {
    if (hideSensitive.value) {
        return maskedUserLabel({ uin: person.uin, name: person.name }) || '匿名用户';
    }
    return person.name || person.uin || '匿名用户';
}

/** 展示名（HTML）：昵称里的 [em] token 与正文同一套转换；悬浮提示仍用纯文本 */
function nameHtml(person: TopPerson): string {
    return formatNickname(labelOf(person));
}

</script>

<template>
    <div class="home-card people-card">
        <div class="card-title">
            <span>互动最多的人</span>
            <span class="note">赞 + 评论</span>
        </div>
        <template v-if="people.length">
            <button
                v-for="person in people"
                :key="person.key"
                type="button"
                class="person-row"
                :disabled="!person.uin"
                :title="`${labelOf(person)}：赞 ${person.likes} · 评论 ${person.comments}`"
                @click="emit('select', person.uin)"
            >
                <user-avatar
                    :uin="person.uin"
                    :size="24"
                    :link="false"
                    :class="{ 'privacy-blur': hideSensitive }"
                />
                <span class="person-name" v-html="nameHtml(person)"></span>
                <span class="person-score">{{ person.score.toLocaleString() }}</span>
            </button>
            <button type="button" class="card-link" @click="emit('openAll')">查看完整互动 →</button>
        </template>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else class="empty">暂无互动数据</p>
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
    /* 卡片可被同行撑高，但行保持自然高度，多余空间留给底部链接 */
    flex: 0 0 auto;
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
.person-row:disabled {
    cursor: default;
    opacity: 0.7;
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
