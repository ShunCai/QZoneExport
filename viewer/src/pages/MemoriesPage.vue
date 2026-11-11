<script setup lang="ts">
import { computed, ref } from 'vue';
import { navigate, routeQuery } from '../router';
import ThatYearTodayPanel from '../components/ThatYearTodayPanel.vue';
import NightOwlPanel from '../components/NightOwlPanel.vue';
import FirstRecordsPanel from '../components/FirstRecordsPanel.vue';
import TopLikesPanel from '../components/TopLikesPanel.vue';
import TopCommentsPanel from '../components/TopCommentsPanel.vue';
import TopViewsPanel from '../components/TopViewsPanel.vue';
import TopLocationsPanel from '../components/TopLocationsPanel.vue';

/**
 * 回忆清单（完整榜单页）
 *
 * 首页每类只摆前 5 条的紧凑卡片，这里展开到前 10 条、并保留完整条目卡片。
 * 这样首页不必再挂载 6 个折叠面板（<details> 收起时 Vue 一样会渲染并读数据），
 * 也避免同一批数据在首页出现两套渲染。页面不进侧栏菜单，只从卡片「查看更多」进入。
 */
/** 榜单条目上限：比首页卡（5）多一倍，页头说明也按这个值写 */
const MEMORIES_TOP_N = 10;
const GROUPS = [
    // 那年今日本身就是全量，不设上限
    { key: 'thatYear', title: '那年今日', note: '往年的今天 · 全站聚合', component: ThatYearTodayPanel },
    { key: 'night', title: '深夜动态', note: '凌晨 0–5 点', component: NightOwlPanel, topN: MEMORIES_TOP_N },
    { key: 'first', title: '最初的记忆', note: '各模块的第一条记录', component: FirstRecordsPanel, topN: MEMORIES_TOP_N },
    { key: 'likes', title: '最多点赞', note: '按赞数排序', component: TopLikesPanel, topN: MEMORIES_TOP_N },
    { key: 'comments', title: '最多评论', note: '按评论数排序', component: TopCommentsPanel, topN: MEMORIES_TOP_N },
    { key: 'views', title: '最多浏览', note: '按浏览数排序', component: TopViewsPanel, topN: MEMORIES_TOP_N },
    { key: 'locations', title: '常驻地点', note: '发布位置分布', component: TopLocationsPanel, topN: MEMORIES_TOP_N },
];

const backTo = computed(() => routeQuery.value.from || 'home');

/** 分组折叠状态：默认全部展开；折叠开关放在外层标题行 */
const collapsed = ref<Record<string, boolean>>({});
function toggle(key: string): void {
    collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
}

/** 面板把各自统计 emit 上来，汇总到外层分组标题，避免标题重复两层、数字又不丢 */
const stats = ref<Record<string, string>>({});
function onSummary(key: string, text: string): void {
    stats.value = { ...stats.value, [key]: text };
}

/**
 * 从卡片「查看更多」进来时，把目标分组排到第一位。
 * 不用 scrollIntoView：面板数据是异步加载的，先滚动再等内容撑开会停错位置。
 */
const orderedGroups = computed(() => {
    const type = routeQuery.value.type;
    if (!type) return GROUPS;
    const target = GROUPS.filter((group) => group.key === type);
    return target.length ? [...target, ...GROUPS.filter((group) => group.key !== type)] : GROUPS;
});
</script>

<template>
    <div class="page-body memories-page">
        <div class="mem-head">
            <button type="button" class="mem-back" @click="navigate(backTo)">← 返回</button>
            <h1>回忆清单</h1>
            <p>按时间与互动整理出来的完整榜单。首页每类只显示前 5 条，这里展开到前 {{ MEMORIES_TOP_N }} 条；那年今日是全量。</p>
        </div>

        <!--
            标题只在最外层出现一层；这一行同时是折叠开关。
            面板自带的 n-collapse 头已隐藏（它原本是唯一开关），所以折叠必须由外层接管。
        -->
        <section v-for="group in orderedGroups" :id="`mem-${group.key}`" :key="group.key" class="mem-group">
            <div
                class="mem-group-head"
                role="button"
                tabindex="0"
                :aria-expanded="!collapsed[group.key]"
                @click="toggle(group.key)"
                @keydown.enter.prevent="toggle(group.key)"
                @keydown.space.prevent="toggle(group.key)"
            >
                <span class="mem-caret">{{ collapsed[group.key] ? '▸' : '▾' }}</span>
                <h2>{{ group.title }}</h2>
                <span class="mem-stat">{{ stats[group.key] || group.note }}</span>
                <span class="mem-toggle">{{ collapsed[group.key] ? '展开' : '收起' }}</span>
            </div>
            <!-- v-show 而非 v-if：收起时面板仍挂载，数据不会重复加载，展开是瞬时的 -->
            <div v-show="!collapsed[group.key]">
                <component
                    :is="group.component"
                    :default-open="true"
                    v-bind="group.topN ? { topN: group.topN } : {}"
                    @summary="(text: string) => onSummary(group.key, text)"
                />
            </div>
        </section>
    </div>
</template>

<style scoped>
.mem-head {
    margin-bottom: 24px;
}
.mem-back {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font-size: 13px;
    cursor: pointer;
}
.mem-back:hover {
    color: var(--accent-pressed);
}
.mem-head h1 {
    font-family: Georgia, "Songti SC", "SimSun", serif;
    font-size: 26px;
    font-weight: 500;
    margin: 12px 0 6px;
}
.mem-head p {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
}
.mem-group {
    scroll-margin-top: 16px;
    margin-bottom: 22px;
}
.mem-group-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
    padding: 4px 0 8px;
    border-bottom: 1px solid var(--border-card);
    cursor: pointer;
    user-select: none;
}
.mem-group-head:hover h2 {
    color: var(--accent-pressed);
}
.mem-group-head:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 4px;
}
.mem-caret {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--accent);
}
.mem-group-head h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
}
.mem-stat {
    flex: 1 1 auto;
    font-size: 11px;
    color: var(--text-muted);
}
.mem-toggle {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--accent);
}
/* 外层已有分组标题，面板自带的折叠头（标题+统计）不再重复渲染。
   用 :deep 穿透到子组件，7 个面板一行都不用各改一份。 */
.mem-group :deep(.n-collapse-item__header),
.mem-group :deep(.panel-title),
.mem-group :deep(.panel-note) {
    display: none;
}
.mem-group :deep(.n-collapse-item__content-wrapper) {
    padding-top: 0;
}

</style>
