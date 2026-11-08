<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton } from 'naive-ui';
import { loadData } from '../data/sources';
import { fixHtmlAssets } from '../data/content';
import { navigate, routeQuery } from '../router';
import { useSearchHighlight } from '../composables/useSearchHighlight';
import ListPage from '../components/ListPage.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import BoardItem from '../components/items/BoardItem.vue';

/**
 * 留言列表 + 详情（数据挂在 Boards/json/boards.js 的 boardInfo）
 * boardInfo 是对象：{ authorInfo（含主人寄语 message）, items, total }，不是数组；
 * 单条留言的渲染在 items/BoardItem.vue，与个人中心的那年今日共用同一套。
 * 详情页地址形如 #/boards?id=xxx，供时间轴/互动等外部链接定位到具体留言。
 */
const loading = ref(true);

/** 从全局搜索跳进来时，把正文里的命中词标出来 */
useSearchHighlight();
const list = ref<Record<string, any>[]>([]);
const slogan = ref('');

onMounted(async () => {
    const data = await loadData<{ items?: Record<string, any>[]; authorInfo?: Record<string, any> }>('boards');
    list.value = Array.isArray(data?.items) ? data.items : [];
    slogan.value = data?.authorInfo?.message || '';
    loading.value = false;
});

/** 详情页：地址形如 #/boards?id=xxx */
const currentId = computed(() => routeQuery.value.id || '');
const current = computed(() => (
    list.value.find((item) => String(item.tid ?? item.id) === currentId.value) || null
));
</script>

<template>
    <!-- 详情页 -->
    <template v-if="currentId">
        <div class="page-head">
            <n-button text @click="() => {
                if (routeQuery.from === 'interaction') navigate('interaction', { qq: routeQuery.qq });
                else if (routeQuery.from) navigate(routeQuery.from);
                else navigate('boards');
            }">
                ← 返回
            </n-button>
        </div>
        <div class="page-body">
            <board-item v-if="current" :item="current"  :highlight-comment="routeQuery.comment" />
            <p v-else class="missing">没有找到这条留言，它可能未包含在本次备份中。</p>
        </div>
    </template>

    <!-- 列表页 -->
    <list-page
        v-else
        title="留言"
        :pref-key="'boards'"
        :items="list"
        :loading="loading"
        empty-hint="暂无留言内容（本次备份可能未包含留言模块）"
        :time-of="(item) => item.pubtime || item.pubTime"
        :text-of="(item) => [item.content, item.nickname, item.name].filter(Boolean).join(' ')"
        :comments-of="(item: Record<string, any>) => ((item.replyList || []) as Record<string, any>[]).map((reply: Record<string, any>) => String(reply.content || '')).filter(Boolean)"
    >
        <!-- 主人寄语（旧留言页顶部同款）与那年今日 -->
        <template #lead>
            <div class="slogan">
                <div class="slogan-title">主人寄语</div>
                <div class="slogan-body" v-html="fixHtmlAssets(slogan, 'Boards') || '说些寄语，欢迎您的空间访客吧'" />
            </div>
            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.pubtime"
            >
                <template #item="{ item }">
                    <board-item :item="item" />
                </template>
            </that-year-today>
        </template>
        <template #default="{ items }">
            <board-item v-for="(item, index) in items" :key="item.id || index" :item="item" />
        </template>
    </list-page>
</template>

<style scoped>
/* 详情页未找到提示 */
.missing {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    text-align: center;
    color: var(--text-muted);
}
/* 主人寄语 */
.slogan {
    margin-bottom: 14px;
    padding: 12px 16px;
    background: var(--bg-page);
    border-left: 3px solid #2080f0;
    border-radius: 2px;
}
.slogan-title {
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--text-secondary);
}
.slogan-body {
    line-height: 1.7;
    word-break: break-word;
}
</style>
