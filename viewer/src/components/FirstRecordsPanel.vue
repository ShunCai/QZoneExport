<script setup lang="ts">
const props = withDefaults(defineProps<{ defaultOpen?: boolean }>(), { defaultOpen: false });

import { computed, onMounted, ref, watch } from 'vue';
import { NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui';
import { loadItems, loadList, type DataKey } from '../data/sources';
import { YEAR_MODULES, PHOTO_TIME_FIELDS, isFeedAlbum } from '../data/counts';
import { formatTime, timeValue, isValidTimestampMs } from '../data/format';
import { navigate } from '../router';
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';
import ShareItem from './items/ShareItem.vue';
import FavoriteItem from './items/FavoriteItem.vue';
import VideoItem from './items/VideoItem.vue';

/**
 * 最初的记忆
 *
 * 统计备份内容中最早的 N 条记录，展示空间最初的足迹。
 * ⚠️ 统计口径严格与「时间跨度 / 年活跃量 / 月度活跃度」保持一致：
 * - 复用 YEAR_MODULES 的 7 个内容模块 + 相册照片
 * - 复用 YEAR_MODULES 与 PHOTO_TIME_FIELDS 的 timeOf 字段回退链
 * - 使用 isValidTimestampMs 过滤异常时间（1970/2106等）
 * 避免出现"不同面板最早年份不一致"。
 */

interface FirstItem {
    kind: DataKey | 'photos';
    label: string;
    route: string;
    time: string;
    ts: number;
    item: Record<string, any>;
}

/** 各 DataKey 对应的跳转路由（YEAR_MODULES 不含 route，这里补齐） */
const ROUTE_OF: Record<string, string> = {
    messages: 'messages',
    blogs: 'blogs',
    diaries: 'diaries',
    boards: 'boards',
    shares: 'shares',
    favorites: 'favorites',
    videos: 'videos',
    photos: 'albums', // 照片属于相册模块，点击跳相册
};

/** 参与统计的模块：直接复用 YEAR_MODULES（保证字段回退链完全一致），仅追加 route 字段 */
const MODULES = YEAR_MODULES.map((m) => ({ ...m, route: ROUTE_OF[m.key] || m.key }));

const TOP_N = 5;

const loading = ref(true);
const items = ref<FirstItem[]>([]);

onMounted(async () => {
    const all: FirstItem[] = [];

    // 1) 7 个内容模块：严格走 YEAR_MODULES 的 timeOf
    for (const module of MODULES) {
        const list = await loadItems(module.key);
        for (const item of list) {
            const raw = module.timeOf(item);
            const ts = timeValue(raw);
            if (isValidTimestampMs(ts)) {
                all.push({
                    kind: module.key,
                    label: module.label,
                    route: module.route,
                    time: formatTime(raw),
                    ts,
                    item,
                });
            }
        }
    }

    // 2) 相册里的照片：与 年活跃量 / 月度活跃度 / 时间跨度 同一口径
    // 「说说和日志相册」是空间自动归档的配图/插图相册，其相片已由「说说/日志」模块统计，且非用户主动上传，排除不计入
    const albums = await loadList('albums');
    for (const album of albums) {
        if (isFeedAlbum(album)) continue;
        const photos = album.photoList || [];
        for (const photo of photos) {
            const raw = PHOTO_TIME_FIELDS.timeOf(photo);
            const ts = timeValue(raw);
            if (isValidTimestampMs(ts)) {
                all.push({
                    kind: 'photos',
                    label: PHOTO_TIME_FIELDS.label,
                    route: ROUTE_OF.photos,
                    time: formatTime(raw),
                    ts,
                    item: { ...photo, __album: album }, // 保留所属相册信息
                });
            }
        }
    }

    // 按时间升序取最早的 N 条
    all.sort((a, b) => a.ts - b.ts);
    items.value = all.slice(0, TOP_N);
    loading.value = false;
});

const earliest = computed(() => items.value.length > 0 ? items.value[0].time.slice(0, 10) : '');

/** 把统计上报给「回忆清单」页的外层分组标题：标题只出现一层，数字不丢 */
const emit = defineEmits<{ summary: [text: string] }>();
const statText = computed(() => `始于 ${earliest.value} · ${items.value.length} 条`);
watch(statText, (text) => emit('summary', text), { immediate: true });
</script>

<template>
    <div class="first-panel">
        <n-spin v-if="loading" size="small" />
        <template v-else-if="items.length === 0">
            <div class="panel-title">
                最初的记忆
                <span class="panel-note">最早的 {{ TOP_N }} 条记录</span>
            </div>
            <p class="empty">没有可追溯的记录</p>
        </template>
        <n-collapse v-else :default-expanded-names="props.defaultOpen ? ['first'] : []">
            <n-collapse-item name="first">
                <template #header>
                    <span class="panel-title">最初的记忆</span>
                    <span class="panel-note">始于 {{ earliest }}，最早的 {{ items.length }} 条记录</span>
                </template>
                <div v-for="(entry, index) in items" :key="index" class="memory">
                    <n-tag
                        class="memory-label"
                        size="small"
                        :bordered="false"
                        @click="navigate(entry.route)"
                    >{{ entry.label }}</n-tag>
                    <div class="memory-body">
                        <message-item
                            v-if="entry.kind === 'messages'"
                            :item="entry.item"
                        />
                        <article-item
                            v-else-if="entry.kind === 'blogs' || entry.kind === 'diaries'"
                            :item="entry.item"
                            :config-key="entry.kind === 'diaries' ? 'Diaries' : 'Blogs'"
                            @open="navigate(entry.route, { id: String(entry.item.blogid || entry.item.blogId || '') })"
                        />
                        <board-item v-else-if="entry.kind === 'boards'" :item="entry.item" />
                        <share-item
                            v-else-if="entry.kind === 'shares'"
                            :item="entry.item"
                        />
                        <favorite-item v-else-if="entry.kind === 'favorites'" :item="entry.item" />
                        <video-item v-else-if="entry.kind === 'videos'" :item="entry.item" />
                        <!-- 相片：没有独立组件，用与其他模块同款的 card-item 风格渲染 -->
                        <div v-else-if="entry.kind === 'photos'" class="card-item">
                            <div class="photo-mini">
                                <img
                                    class="photo-thumb"
                                    :src="entry.item.custom_pre_filepath || entry.item.custom_filepath || entry.item.url || ''"
                                    :alt="entry.item.name || '照片'"
                                    loading="lazy" decoding="async"
                                    @click="navigate('albums')"
                                />
                                <div class="photo-info">
                                    <div class="photo-name">
                                        {{ entry.item.name || (entry.item.__album ? '《' + (entry.item.__album.name || '相册') + '》的一张照片' : '一张老照片') }}
                                    </div>
                                    <div class="photo-meta">
                                        <span v-if="entry.item.__album?.name" class="photo-album-tag">📂 {{ entry.item.__album.name }}</span>
                                        <span class="photo-time">🕒 {{ entry.time }}</span>
                                        <span v-if="entry.item.desc" class="photo-desc">— {{ (entry.item.desc as string).slice(0, 60) }}{{ (entry.item.desc as string).length > 60 ? '…' : '' }}</span>
                                    </div>
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
.first-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-tint-yellow);
    border-left: 3px solid #e6a23c;
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

/* —— 最初的记忆中最早的「相片」条目：与其他模块同款卡片的紧凑渲染 —— */
.photo-mini {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}
.photo-thumb {
    flex: none;
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--border-light);
    background: var(--bg-primary);
    cursor: pointer;
    transition: transform 0.15s;
}
.photo-thumb:hover {
    transform: scale(1.02);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.photo-info {
    flex: 1;
    min-width: 0;
}
.photo-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
}
.photo-meta {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.6;
}
.photo-meta > span {
    margin-right: 10px;
}
.photo-album-tag {
    color: #e6a23c;
    font-weight: 500;
}
.photo-desc {
    color: var(--text-muted);
}
</style>
