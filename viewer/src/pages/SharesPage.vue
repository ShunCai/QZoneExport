<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NSelect } from 'naive-ui';
import { loadList } from '../data/sources';
import { useVisitorFilter } from '../data/visitorFilter';
import { navigate, routeQuery } from '../router';
import { itemComments, shareFromInfo, shareTypeLabel } from '../data/content';
import { useSearchHighlight } from '../composables/useSearchHighlight';
import ListPage from '../components/ListPage.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import ShareItem from '../components/items/ShareItem.vue';

/**
 * 分享列表 + 详情（数据来自 Shares/json/shares.js）
 * 分享的被分享内容在 source 里（标题、简介、原链接、图片）；
 * 单条分享的渲染在 items/ShareItem.vue，与个人中心的那年今日共用同一套。
 * 详情页地址形如 #/shares?id=xxx，供访客记录等外部链接定位到具体分享。
 */
const loading = ref(true);

/** 从全局搜索跳进来时，把正文里的命中词标出来 */
useSearchHighlight();
const list = ref<Record<string, any>[]>([]);

onMounted(async () => {
    list.value = await loadList('shares');
    loading.value = false;
});

/** 按浏览者过滤（互动面板「我浏览过的分享」卡片跳转携带 ?visitor=UIN） */
const { filter: visitorFilter, hasVisitor, visitorName, visitorUin, clearVisitor } = useVisitorFilter(list);

/** 详情页：地址形如 #/shares?id=xxx */
const currentId = computed(() => routeQuery.value.id || '');
const current = computed(() => list.value.find((item) => String(item.id) === currentId.value) || null);

/**
 * 分享类型筛选：与分享类型徽章同源（shareTypeLabel），
 * 空串表示不限。选项取自实际数据中出现过的类型。
 */
const shareType = ref('');
const shareTypeOptions = computed(() => {
    const names = new Set<string>();
    for (const item of list.value) {
        names.add(shareTypeLabel(item));
    }
    return [{ label: '全部类型', value: '' }]
        .concat([...names].sort().map((name) => ({ label: name, value: name })));
});

/**
 * 分享来源筛选：按被分享内容的「来自 XXX」字段过滤，
 * 空串表示不限。同样只列数据中出现过的来源名。
 */
const shareSource = ref('');
const shareSourceOptions = computed(() => {
    const names = new Set<string>();
    for (const item of list.value) {
        const name = shareFromInfo(item).name;
        if (name) {
            names.add(name);
        }
    }
    return [{ label: '全部来源', value: '' }]
        .concat([...names].sort().map((name) => ({ label: name, value: name })));
});

/**
 * 合并的筛选谓词：类型 + 来源 同时命中才算通过。
 * 必须用 computed，不能在模板里用内联箭头函数，
 * 否则每次渲染都会生成一个新的函数引用，
 * 导致 ListPage 的 watch 以为筛选条件变了，不断重置回第 1 页。
 */
const combinedFilter = computed(() => (item: Record<string, any>) => {
    if (!visitorFilter.value(item)) return false;
    if (shareType.value && shareTypeLabel(item) !== shareType.value) {
        return false;
    }
    if (shareSource.value && shareFromInfo(item).name !== shareSource.value) {
        return false;
    }
    return true;
});
</script>

<template>
    <!-- 详情页 -->
    <template v-if="currentId">
        <div class="page-head">
            <n-button text @click="() => {
                if (routeQuery.from === 'interaction') navigate('interaction', { qq: routeQuery.qq });
                else if (routeQuery.from) navigate(routeQuery.from);
                else navigate('shares');
            }">
                ← 返回
            </n-button>
        </div>
        <div class="page-body">
            <share-item v-if="current" :item="current" :expand-comments="true" :highlight-comment="routeQuery.comment" />
            <p v-else class="missing">没有找到这条分享，它可能未包含在本次备份中。</p>
        </div>
    </template>

    <!-- 列表页 -->
    <list-page
        v-else
        title="分享"
        :pref-key="'shares'"
        :items="list"
        :loading="loading"
        empty-hint="暂无分享内容（本次备份可能未包含分享模块）"
        :time-of="(item) => item.shareTime || item.custom_create_time"
        :filter="combinedFilter"
        sort-label="分享时间"
        :text-of="(item) => [item.desc, item.source?.title, item.source?.desc, item.nickname, shareFromInfo(item).name].filter(Boolean).join(' ')"
        :comments-of="(item: Record<string, any>) => itemComments(item).flatMap((comment: Record<string, any>) => [String(comment.content || ''), ...((comment.replyList || []) as Record<string, any>[]).map((reply: Record<string, any>) => String(reply.content || ''))]).filter(Boolean)"
    >
        <!-- 那年今日（按分享时间算） -->
        <template #lead>
            <div v-if="hasVisitor" class="visitor-filter-bar">
                仅显示 <b>{{ visitorName || visitorUin }}</b> 浏览过的分享
                <button class="visitor-clear" type="button" @click="clearVisitor">清除筛选</button>
            </div>
        </template>

        <!-- 筛选条：类型 + 来源 -->
        <template #toolbar>
            <div class="toolbar-group">
                <span class="toolbar-label">类型</span>
                <n-select
                    v-model:value="shareType"
                    :options="shareTypeOptions"
                    style="width: 120px;"
                    clearable
                />
            </div>
            <div class="toolbar-group">
                <span class="toolbar-label">来源</span>
                <n-select
                    v-model:value="shareSource"
                    :options="shareSourceOptions"
                    style="width: 150px;"
                    clearable
                />
            </div>
        </template>

        <template #default="{ items }">
            <share-item v-for="(item, index) in items" :key="item.id || index" :item="item" />
        </template>
    <template #after-toolbar>
            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.shareTime"
            >
                <template #item="{ item }">
                    <share-item :item="item" />
                </template>
            </that-year-today>
    </template>
    </list-page>
</template>

<style scoped>
.missing {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    text-align: center;
    color: var(--text-muted);
}
/* 浏览者过滤提示条（互动面板「我浏览过的分享」跳入时显示） */
.visitor-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding: 8px 14px;
    background: var(--bg-tint-blue, #eef3ff);
    border: 1px solid #d6e4ff;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
}
.visitor-filter-bar b { color: #3370ff; }
.visitor-clear {
    margin-left: auto;
    padding: 3px 12px;
    font-size: 12px;
    color: #3370ff;
    background: #fff;
    border: 1px solid #d6e4ff;
    border-radius: 4px;
    cursor: pointer;
}
.visitor-clear:hover { background: #f0f5ff; }
</style>
