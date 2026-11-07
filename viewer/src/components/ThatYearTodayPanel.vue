<script setup lang="ts">
const props = withDefaults(defineProps<{ defaultOpen?: boolean }>(), { defaultOpen: false });

import { computed, onMounted, ref, watch } from 'vue';
import { NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui';
import { loadItems, type DataKey } from '../data/sources';
import { formatTime, timeValue } from '../data/format';
import { thatYearToday } from '../data/thatYearToday';
import { resolvePhotoTime } from '../data/media';
import { navigate } from '../router';
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';
import ShareItem from './items/ShareItem.vue';
import FavoriteItem from './items/FavoriteItem.vue';
import VisitorItem from './items/VisitorItem.vue';
import PhotoBatchItem from './items/PhotoBatchItem.vue';
import VideoItem from './items/VideoItem.vue';
import FriendItem from './items/FriendItem.vue';

/**
 * 那年今日（全站聚合）
 *
 * 与旧版一致按「打开页面的当天」实时计算，但旧版只在说说/留言/分享三个模块的侧边栏里出现，
 * 且受采集时的 hasThatYearToday 开关控制；这里不看任何配置——查看器直接从备份数据现算，
 * 备份里有哪个模块就聚合哪个模块。
 *
 * 每条回忆都交给对应模块自己的条目组件渲染（items/ 下那一批），与各列表页完全同款，
 * 不再另写一份「单行摘要」——两套渲染早晚会长歪。
 */

/** 一条回忆：带上模块标识与原始数据，渲染时按 kind 分派给对应组件 */
interface Memory {
    kind: DataKey | 'photos';
    label: string;
    route: string;
    /** 跳转时附带的参数（如相片直达对应相册） */
    query?: Record<string, string>;
    time: string;
    item: Record<string, any>;
}

/** 参与聚合的模块：取时间的字段各模块不同，在此收口 */
const MODULES: {
    key: DataKey;
    label: string;
    route: string;
    timeOf: (item: Record<string, any>) => any;
}[] = [
    { key: 'messages', label: '说说', route: 'messages', timeOf: (item) => item.created_time || item.custom_create_time },
    { key: 'blogs', label: '日志', route: 'blogs', timeOf: (item) => item.pubtime || item.pubTime },
    { key: 'diaries', label: '日记', route: 'diaries', timeOf: (item) => item.pubtime || item.pubTime },
    { key: 'boards', label: '留言', route: 'boards', timeOf: (item) => item.pubtime },
    { key: 'shares', label: '分享', route: 'shares', timeOf: (item) => item.shareTime },
    { key: 'favorites', label: '收藏', route: 'favorites', timeOf: (item) => item.create_time },
    { key: 'videos', label: '视频', route: 'videos', timeOf: (item) => item.uploadtime || item.uploadTime },
    { key: 'friends', label: '好友', route: 'friends', timeOf: (item) => item.addFriendTime },
    { key: 'visitors', label: '访客', route: 'visitors', timeOf: (item) => item.time },
];

const loading = ref(true);
const groups = ref<{ year: string; items: Memory[] }[]>([]);
const total = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0));

/**
 * 条目是完整卡片，比原来的单行摘要高得多，
 * 因此默认一律收起，由用户自己点开，避免个人中心一打开就是几屏回忆。
 */
const defaultExpanded = ref<string[]>(props.defaultOpen ? ['year'] : []);

/** 相片时间：上传优先、拍摄兜底（与时间轴口径一致），共用统一解析 */
const photoTimeOf = (photo: Record<string, any>): number | string | undefined => resolvePhotoTime(photo, 'upload');

/**
 * 相片多为批量上传，同一相册内间隔不超过该值的相片合并成一条
 * 否则一次批量上传就能把整个面板刷满几十条相同内容。
 */
const PHOTO_MERGE_GAP = 30 * 60 * 1000;

onMounted(async () => {
    const memories: Memory[] = [];
    for (const module of MODULES) {
        const items = await loadItems(module.key);
        for (const group of thatYearToday(items, module.timeOf)) {
            for (const item of group.items) {
                memories.push({
                    kind: module.key,
                    label: module.label,
                    route: module.route,
                    time: formatTime(module.timeOf(item)),
                    item,
                });
            }
        }
    }

    // 相片藏在每个相册的 photoList 里，逐个相册处理，顺带按时间聚簇合并批量上传
    const albums = await loadItems<Record<string, any>>('albums');
    for (const album of albums) {
        for (const group of thatYearToday(album.photoList || [], photoTimeOf)) {
            const sorted = [...group.items].sort((a, b) => timeValue(photoTimeOf(a)) - timeValue(photoTimeOf(b)));
            const batches: Record<string, any>[][] = [];
            let batch: Record<string, any>[] = [];
            for (const photo of sorted) {
                const previous = batch[batch.length - 1];
                if (previous && timeValue(photoTimeOf(photo)) - timeValue(photoTimeOf(previous)) > PHOTO_MERGE_GAP) {
                    batches.push(batch);
                    batch = [];
                }
                batch.push(photo);
            }
            if (batch.length > 0) {
                batches.push(batch);
            }
            for (const each of batches) {
                memories.push({
                    kind: 'photos',
                    label: '相片',
                    route: 'albums',
                    query: album.id ? { id: String(album.id) } : undefined,
                    time: formatTime(photoTimeOf(each[0])),
                    item: { album, photos: each },
                });
            }
        }
    }

    // 汇总后按年份重新分组（同一年里各模块的回忆混在一起，按时间倒序）
    const byYear = new Map<string, Memory[]>();
    for (const memory of memories) {
        const year = memory.time.slice(0, 4);
        const list = byYear.get(year) || [];
        list.push(memory);
        byYear.set(year, list);
    }
    groups.value = [...byYear.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([year, list]) => ({
            year,
            items: list.sort((a, b) => b.time.localeCompare(a.time)),
        }));
    loading.value = false;
});

const todayText = computed(() => formatTime(Date.now()).slice(5, 10));

/** 把统计上报给「回忆清单」页的外层分组标题：标题只出现一层，数字不丢 */
const emit = defineEmits<{ summary: [text: string] }>();
const statText = computed(() => `共 ${total.value} 条 · ${todayText.value}`);
watch(statText, (text) => emit('summary', text), { immediate: true });
</script>

<template>
    <!-- 无往年记录时整个面板不渲染，与各模块列表的那年今日保持一致 -->
    <div v-if="loading || total > 0" class="year-panel">
        <n-spin v-if="loading" size="small" />
        <n-collapse v-else :default-expanded-names="defaultExpanded">
            <n-collapse-item name="year">
                <template #header>
                    <span class="panel-title">那年今日</span>
                    <span class="panel-note">今天是 {{ todayText }}，共 {{ total }} 条同月同日的回忆</span>
                </template>
                <div v-for="group in groups" :key="group.year" class="year">
                    <div class="year-title">
                        {{ group.year }} 年
                        <span class="count">{{ group.items.length }} 条</span>
                    </div>
                    <div v-for="(memory, index) in group.items" :key="index" class="memory">
                        <!-- 模块标签兼作入口：点它跳到对应模块 -->
                        <n-tag
                            class="memory-label"
                            size="small"
                            :bordered="false"
                            @click="navigate(memory.route, memory.query)"
                        >{{ memory.label }}</n-tag>

                        <div class="memory-body">
                            <message-item
                                v-if="memory.kind === 'messages'"
                                :item="memory.item"
                            />
                            <article-item
                                v-else-if="memory.kind === 'blogs' || memory.kind === 'diaries'"
                                :item="memory.item"
                                :config-key="memory.kind === 'diaries' ? 'Diaries' : 'Blogs'"
                                @open="navigate(memory.route, { id: String(memory.item.blogid || memory.item.blogId || '') })"
                            />
                            <board-item v-else-if="memory.kind === 'boards'" :item="memory.item" />
                            <share-item
                                v-else-if="memory.kind === 'shares'"
                                :item="memory.item"
                            />
                            <favorite-item v-else-if="memory.kind === 'favorites'" :item="memory.item" />
                            <video-item v-else-if="memory.kind === 'videos'" :item="memory.item" />
                            <friend-item v-else-if="memory.kind === 'friends'" :item="memory.item" />
                            <visitor-item v-else-if="memory.kind === 'visitors'" :item="memory.item" />
                            <photo-batch-item
                                v-else-if="memory.kind === 'photos'"
                                :album="memory.item.album"
                                :photos="memory.item.photos"
                            />
                        </div>
                    </div>
                </div>
            </n-collapse-item>
        </n-collapse>
    </div>
</template>

<style scoped>
.year-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-page);
    border-left: 3px solid #2080f0;
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

.year + .year {
    margin-top: 12px;
}

.year-title {
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--text-secondary);
}

.count {
    margin-left: 8px;
    color: var(--text-muted);
}

/* 一条回忆：左侧模块标签，右侧是该模块自己的条目卡片 */
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

/* 条目卡片在面板里改成白底，与面板的浅绿底分开 */
.memory-body :deep(.card-item) {
    margin-bottom: 0;
    background: var(--bg-primary);
}
</style>
