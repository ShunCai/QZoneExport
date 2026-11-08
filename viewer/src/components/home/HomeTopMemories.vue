<script setup lang="ts">
import { navigate } from '../../router';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent } from '../../data/mask';

defineProps<{
    items: { title: string; detail: string; route?: string; query?: Record<string, string> }[];
    /** 统计未完成时先显示加载占位 */
    loading?: boolean;
}>();

const { hidden: hideSensitive } = usePrivacy();

/** 有对应记录的条目可点开定位；「连续打卡」这类聚合项没有单条记录，保持不可点 */
function open(item: { route?: string; query?: Record<string, string> }): void {
    if (!item.route) return;
    navigate(item.route, item.query);
}
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>回忆之最</span>
            <span class="note">从全部内容里挑的</span>
        </div>
        <div v-if="items.length" class="list">
            <component
                :is="item.route ? 'button' : 'div'"
                v-for="(item, i) in items"
                :key="i"
                class="row"
                :class="{ clickable: !!item.route }"
                :type="item.route ? 'button' : undefined"
                @click="open(item)"
            >
                <span class="rank">{{ i + 1 }}</span>
                <div class="body">
                    <div class="title">{{ hideSensitive ? maskContent(item.title) : item.title }}</div>
                    <div class="detail">{{ hideSensitive ? maskContent(item.detail) : item.detail }}</div>
                </div>
            </component>
        </div>
        <p v-else-if="loading" class="empty">正在统计…</p>
        <p v-else class="empty">暂无回忆数据</p>
        <button type="button" class="card-more" @click="navigate('memories', { from: 'home' })">查看更多 →</button>
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
/* 与左侧「那年今日」同高：条目均分剩余高度，避免底部留空 */
.list {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
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
.row {
    flex: 1 1 auto;
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 9px 0;
    border: none;
    border-bottom: 1px solid var(--border-light);
    background: transparent;
    text-align: left;
    font: inherit;
    color: inherit;
}
.row:last-child {
    border-bottom: none;
}
.row.clickable {
    cursor: pointer;
}
.row.clickable:hover .title {
    color: var(--accent-pressed);
}
.rank {
    width: 18px;
    flex: 0 0 18px;
    font-size: 14px;
    color: var(--accent);
}
.title {
    font-size: 13px;
    color: var(--text-primary);
}
.detail {
    margin-top: 1px;
    font-size: 11px;
    color: var(--text-muted);
}
.card-more {
    align-self: flex-start;
    margin-top: 12px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.card-more:hover {
    color: var(--accent-pressed);
}
.empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
