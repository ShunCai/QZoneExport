<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui';
import { loadTopLikes, loadTopComments, type TopRecord } from '../data/counts';
import { navigate } from '../router';
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';
import ShareItem from './items/ShareItem.vue';
import FavoriteItem from './items/FavoriteItem.vue';
import VideoItem from './items/VideoItem.vue';

/**
 * 空间之最
 *
 * 统计点赞最多、评论最多的 Top 5 条内容，两栏并排展示；
 * 整体面板结构与「最初的记忆」「深夜动态」完全一致：
 * 左边色条 + 柔和背景色 + 内部 NCollapse 默认收起；
 * 子条目样式统一复用 .memory 结构，与最初的记忆同款。
 */

const TOP_N = 5;

const loading = ref(true);
const topLikes = ref<TopRecord[]>([]);
const topComments = ref<TopRecord[]>([]);

onMounted(async () => {
    const [tl, tc] = await Promise.all([loadTopLikes(TOP_N), loadTopComments(TOP_N)]);
    topLikes.value = tl;
    topComments.value = tc;
    loading.value = false;
});

const hasAny = computed(() => topLikes.value.length > 0 || topComments.value.length > 0);
const summary = computed(() => {
    const parts: string[] = [];
    if (topLikes.value.length > 0) parts.push(`点赞最多 ${topLikes.value.length} 条`);
    if (topComments.value.length > 0) parts.push(`评论最多 ${topComments.value.length} 条`);
    return parts.join(' · ');
});
</script>

<template>
    <div class="top-panel">
        <n-spin v-if="loading" size="small" />
        <template v-else-if="!hasAny">
            <div class="panel-title">
                空间之最
                <span class="panel-note">点赞 / 评论 互动最多的 {{ TOP_N }} 条</span>
            </div>
            <p class="empty">暂无互动记录</p>
        </template>
        <n-collapse v-else :default-expanded-names="[]">
            <n-collapse-item name="top">
                <template #header>
                    <span class="panel-title">空间之最</span>
                    <span class="panel-note">{{ summary }}</span>
                </template>

                <div class="top-records-row">
                    <!-- 点赞最多：暖红色系（沿用主页的色条风格） -->
                    <div v-if="topLikes.length > 0" class="records-panel records-panel-likes">
                        <div class="records-panel-header">
                            <span class="records-panel-title">点赞最多的 {{ topLikes.length }} 条</span>
                        </div>
                        <div class="records-panel-body">
                            <div v-for="(item, i) in topLikes" :key="'l-' + i" class="memory">
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
                    </div>

                    <!-- 评论最多：浅蓝色系（与点赞区色系统一但区分） -->
                    <div v-if="topComments.length > 0" class="records-panel records-panel-comments">
                        <div class="records-panel-header">
                            <span class="records-panel-title">评论最多的 {{ topComments.length }} 条</span>
                        </div>
                        <div class="records-panel-body">
                            <div v-for="(item, i) in topComments" :key="'c-' + i" class="memory">
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
                    </div>
                </div>
            </n-collapse-item>
        </n-collapse>
    </div>
</template>

<style scoped>
/* —— 与「最初的记忆」「深夜动态」完全一致的面板外壳：左边色条 + 柔和背景 —— */
.top-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-tint-green);            /* 淡青绿底色：空间之最 = 最佳高光，与主色呼应 */
    border-left: 3px solid #2080f0; /* 主色绿：与主页整体视觉一致 */
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

/* —— 两栏并排：左 点赞最多 / 右 评论最多 —— */
.top-records-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-top: 4px;
}

/* —— 每个子栏：继续用与最初的记忆一致的色条风格 —— */
.records-panel {
    padding: 8px 16px;
    border-radius: 2px;
}
.records-panel-likes {
    background: var(--bg-tint-red);
    border-left: 3px solid #e64a5e;
}
.records-panel-comments {
    background: var(--bg-tint-blue);
    border-left: 3px solid #3370ff;
}

.records-panel-header {
    margin-bottom: 8px;
}
.records-panel-title {
    font-size: 15px;
    font-weight: 600;
}
.records-panel-body {
    display: flex;
    flex-direction: column;
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

/* 手机端：两栏合并为单栏 */
@media (max-width: 580px) {
    .top-records-row {
        grid-template-columns: 1fr;
    }
}
</style>
