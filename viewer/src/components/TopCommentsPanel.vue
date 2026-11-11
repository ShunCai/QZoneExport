<script setup lang="ts">
const props = withDefaults(defineProps<{ defaultOpen?: boolean; topN?: number }>(), { defaultOpen: false, topN: 5 });

import { computed, onMounted, ref, watch } from 'vue';
import { NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui';
import { loadTopComments, type TopRecord } from '../data/counts';
import { navigate } from '../router';
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';
import ShareItem from './items/ShareItem.vue';
import FavoriteItem from './items/FavoriteItem.vue';
import VideoItem from './items/VideoItem.vue';

/**
 * 最多评论 Top 5 独立面板
 *
 * 从原「点赞最多和评论最多」父面板中拆出的独立面板，
 * 与「最初的记忆」「月度活跃度」等面板完全同级：
 * 左边色条 + 柔和背景色 + 内部 NCollapse 默认收起；
 * 子条目样式统一复用 .memory 结构，与最初的记忆同款。
 */

/** 条目上限：首页卡取 5，回忆清单页传 10 */
const TOP_N = props.topN;

const loading = ref(true);
const list = ref<TopRecord[]>([]);

onMounted(async () => {
    list.value = await loadTopComments(TOP_N);
    loading.value = false;
});

const hasData = computed(() => list.value.length > 0);
const summary = computed(() => {
    if (list.value.length <= 0) return `共 ${TOP_N} 条互动数据`;
    const top = list.value[0];
    return `Top1「${top.label}」，评论 ${top.comments ?? '—'}`;
});

/** 把统计上报给「回忆清单」页的外层分组标题：标题只出现一层，数字不丢 */
const emit = defineEmits<{ summary: [text: string] }>();
const statText = computed(() => `共 ${list.value.length} 条 · ${summary.value}`);
watch(statText, (text) => emit('summary', text), { immediate: true });
</script>

<template>
    <div class="panel">
        <n-spin v-if="loading" size="small" />
        <template v-else-if="!hasData">
            <div class="panel-title">
                最多评论
                <span class="panel-note">暂无评论数据</span>
            </div>
            <p class="empty">暂无评论记录</p>
        </template>
        <n-collapse v-else :default-expanded-names="props.defaultOpen ? ['comments'] : []">
            <n-collapse-item name="comments">
                <template #header>
                    <span class="panel-title">最多评论</span>
                    <span class="panel-note">共 {{ list.length }} 条，{{ summary }}</span>
                </template>

                <div class="records-panel-body">
                    <div v-for="(item, i) in list" :key="'c-' + i" class="memory">
                        <n-tag
                            class="memory-label"
                            size="small"
                            :bordered="false"
                            @click="navigate(item.kind)"
                        >{{ item.label }}</n-tag>
                        <div class="memory-body">
                            <message-item
                                v-if="item.kind === 'messages'"
                                :item="item.item"
                            />
                            <article-item
                                v-else-if="item.kind === 'blogs' || item.kind === 'diaries'"
                                :item="item.item"
                                :config-key="item.kind === 'diaries' ? 'Diaries' : 'Blogs'"
                                @open="(it) => navigate(item.kind, { id: String(it.blogid || it.blogId || '') })"
                            />
                            <board-item v-else-if="item.kind === 'boards'" :item="item.item" />
                            <share-item
                                v-else-if="item.kind === 'shares'"
                                :item="item.item"
                            />
                            <favorite-item v-else-if="item.kind === 'favorites'" :item="item.item" />
                            <video-item v-else-if="item.kind === 'videos'" :item="item.item" />
                        </div>
                    </div>
                </div>
            </n-collapse-item>
        </n-collapse>
    </div>
</template>

<style scoped>
/* —— 与「最初的记忆」「深夜动态」完全一致的面板外壳：左边色条 + 柔和背景 —— */
.panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-tint-blue);            /* 浅蓝底：与💬评论语义一致 */
    border-left: 3px solid #3370ff; /* 蓝：评论主色 */
    border-radius: 2px;
}

.panel-title {
    font-size: 15px;
    font-weight: 600;
}

.panel-note {
    margin-left: 10px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-muted);
}

.empty {
    margin: 8px 0 4px;
    font-size: 13px;
    color: var(--text-muted);
}

.records-panel-body {
    display: flex;
    flex-direction: column;
    padding-top: 4px;
}

/* —— 每条记录：与 FirstRecordsPanel 的 .memory 结构完全一致 —— */
.memory {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
}
.memory-label {
    flex: none;
    margin-top: 12px;
    cursor: pointer;
}
.memory-body {
    flex: 1;
    min-width: 0;
}
.memory-body :deep(.card-item) {
    margin-bottom: 0;
    background: var(--bg-primary);
}
</style>
