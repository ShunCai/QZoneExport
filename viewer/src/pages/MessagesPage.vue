<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NSelect } from 'naive-ui';
import { loadList } from '../data/sources';
import { CONTENT_SHAPE_OPTIONS, matchesContentShape, type ContentShapeFilter } from '../data/contentShape';
import { useVisitorFilter } from '../data/visitorFilter';
import { itemComments, likeTotal, locationOf, messageEffectiveTime, messagePublishTime, viewCount } from '../data/content';
import { timeValue } from '../data/format';
import { navigate, routeQuery } from '../router';
import ListPage from '../components/ListPage.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import MessageItem from '../components/items/MessageItem.vue';

/**
 * 说说列表 + 详情（数据来自 Messages/json/messages.js）
 * 单条说说的渲染在 items/MessageItem.vue，与个人中心的那年今日共用同一套。
 * 详情页地址形如 #/messages?id=xxx（tid），供访客记录等外部链接定位到具体说说。
 */
const loading = ref(true);
const list = ref<Record<string, any>[]>([]);

onMounted(async () => {
    list.value = await loadList('messages');
    loading.value = false;
});

/** 按浏览者过滤（互动面板「我浏览过的说说」卡片跳转携带 ?visitor=UIN） */
const { filter: visitorFilter, hasVisitor, visitorName, visitorUin, clearVisitor } = useVisitorFilter(list);

/** 内容形态筛选（纯文字 / 含图片 / 含视频）；与浏览者过滤是两个正交维度，组合后交 ListPage */
const shape = ref<ContentShapeFilter>('all');
const combinedFilter = computed(() => (item: Record<string, any>) =>
    visitorFilter.value(item) && matchesContentShape(item, shape.value),
);

/** 详情页：地址形如 #/messages?id=xxx */
const currentId = computed(() => routeQuery.value.id || '');
const current = computed(() => list.value.find((item) => String(item.tid) === currentId.value) || null);

/** 排序字段：发表时间（默认）/ 修改时间（兜底发表时间）/ 点赞 / 评论 / 访问数，均可升降序 */
const sorts = [
    { label: '发表时间', value: 'publish', valueOf: (item: Record<string, any>) => timeValue(messagePublishTime(item)) },
    { label: '修改时间', value: 'modify', valueOf: (item: Record<string, any>) => timeValue(messageEffectiveTime(item)) },
    { label: '点赞数', value: 'like', valueOf: (item: Record<string, any>) => likeTotal(item) },
    { label: '评论数', value: 'comment', valueOf: (item: Record<string, any>) => itemComments(item).length },
    { label: '访问数', value: 'view', valueOf: (item: Record<string, any>) => viewCount(item) },
];
</script>

<template>
    <!-- 详情页 -->
    <template v-if="currentId">
        <div class="page-head">
            <n-button text @click="() => {
                if (routeQuery.from === 'interaction') navigate('interaction', { qq: routeQuery.qq });
                else if (routeQuery.from) navigate(routeQuery.from);
                else navigate('messages');
            }">
                ← 返回
            </n-button>
        </div>
        <div class="page-body">
            <message-item
                v-if="current"
                :item="current"
                :expand-comments="true"
                :highlight-comment="routeQuery.comment"
            />
            <p v-else class="missing">没有找到这条说说，它可能未包含在本次备份中。</p>
        </div>
    </template>

    <!-- 列表页 -->
    <list-page
        v-else
        title="说说"
        :pref-key="'messages'"
        :items="list"
        :filter="combinedFilter"
        :loading="loading"
        empty-hint="暂无说说内容（本次备份可能未包含说说模块）"
        :time-of="(item) => item.created_time || item.custom_create_time"
        sort-label="发表时间"
        :sorts="sorts"
        :text-of="(item) => [item.content, item.rt_con, item.rt_uinname, locationOf(item)].filter(Boolean).join(' ')"
    >
        <!-- 形态筛选放在工具栏最左侧，与 ListPage 自带的时间/排序/搜索并列 -->
        <template #toolbar>
            <div class="shape-filter">
                <span>形态</span>
                <n-select v-model:value="shape" :options="CONTENT_SHAPE_OPTIONS" style="width: 120px;" />
            </div>
        </template>

        <!-- 那年今日（旧版在侧边栏，这里放列表顶部、默认折叠） -->
        <template #lead>
            <div v-if="hasVisitor" class="visitor-filter-bar">
                仅显示 <b>{{ visitorName || visitorUin }}</b> 浏览过的说说
                <button class="visitor-clear" type="button" @click="clearVisitor">清除筛选</button>
            </div>
            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.created_time || item.custom_create_time"
            >
                <template #item="{ item }">
                    <message-item :item="item" />
                </template>
            </that-year-today>
        </template>

        <template #default="{ items }">
            <message-item v-for="item in items" :key="item.tid" :item="item" />
        </template>
    </list-page>
</template>

<style scoped>
/* 形态筛选：插槽内容由本组件渲染，不能复用 ListPage 的 scoped .toolbar-group */
.shape-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.missing {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    text-align: center;
    color: var(--text-muted);
}
/* 浏览者过滤提示条（互动面板「我浏览过的说说」跳入时显示） */
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
