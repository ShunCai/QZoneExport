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
import VisitorItem from './items/VisitorItem.vue';
import VideoItem from './items/VideoItem.vue';

/**
 * 深夜动态
 *
 * 统计凌晨 0 点到 5 点之间发布的动态。
 * ⚠️ 统计口径与「时间跨度/年活跃/最初的记忆」一致：
 * - 7个内容模块复用 YEAR_MODULES 的字段回退链
 * - 加入相片（PHOTO_TIME_FIELDS）
 * - 另外保留 visitors 访客（深夜访问也算）
 * - 统一用 isValidTimestampMs 过滤异常时间
 */

interface NightItem {
    kind: DataKey | 'photos';
    label: string;
    route: string;
    time: string;
    /** 当天分钟数（0:00=0，4:59=299），用于排序「最晚」 */
    minuteOfDay: number;
    item: Record<string, any>;
}

/** 各 DataKey 对应的跳转路由（与最初的记忆一致） */
const ROUTE_OF: Record<string, string> = {
    messages: 'messages',
    blogs: 'blogs',
    diaries: 'diaries',
    boards: 'boards',
    shares: 'shares',
    favorites: 'favorites',
    videos: 'videos',
    visitors: 'visitors',
    photos: 'albums',
};

/** 参与统计的模块：
 *  1) 7 内容模块：严格复用 YEAR_MODULES（字段回退链一致）
 *  2) 深夜动态独有：visitors 访客（凌晨也算访问）
 */
const MODULES: {
    key: DataKey;
    label: string;
    route: string;
    timeOf: (item: Record<string, any>) => any;
}[] = [
    ...YEAR_MODULES.map((m) => ({ ...m, route: ROUTE_OF[m.key] || m.key })),
    { key: 'visitors', label: '访客', route: 'visitors', timeOf: (item) => item.time },
];

/** 展示的「最晚」条数 */
const TOP_N = 5;

/** 深夜动态时段配色（参考主页内容构成），柔和紫色系渐变 */
const NIGHT_COLORS = ['#7c6bc4', '#9988de', '#5e4db0', '#b5a5ee', '#49398e'];

/** 解析凌晨时间：返回小时与当天分钟数；非凌晨 0-5 点返回 null */
function lateNightInfo(value: any): { hour: number; minuteOfDay: number } | null {
    const text = formatTime(value);
    if (!text || text.length < 16) return null;
    const hour = Number(text.slice(11, 13));
    const minute = Number(text.slice(14, 16));
    if (!Number.isFinite(hour) || hour < 0 || hour >= 5) return null;
    return { hour, minuteOfDay: hour * 60 + (Number.isFinite(minute) ? minute : 0) };
}

const loading = ref(true);
const total = ref(0);
const topItems = ref<NightItem[]>([]);
const hourBuckets = ref<{ label: string; count: number }[]>([]);
const defaultExpanded = ref<string[]>(props.defaultOpen ? ['night'] : []);

const maxBucket = computed(() => Math.max(1, ...hourBuckets.value.map((b) => b.count)));

onMounted(async () => {
    const all: NightItem[] = [];
    const buckets = [0, 0, 0, 0, 0]; // 小时 0..4 的计数

    // 1) 7 内容模块 + visitors
    for (const module of MODULES) {
        const list = await loadItems(module.key);
        for (const item of list) {
            const raw = module.timeOf(item);
            const ts = timeValue(raw);
            if (!isValidTimestampMs(ts)) continue; // 过滤异常时间
            const info = lateNightInfo(raw);
            if (!info) continue;
            buckets[info.hour]++;
            all.push({
                kind: module.key,
                label: module.label,
                route: module.route,
                time: formatTime(raw),
                minuteOfDay: info.minuteOfDay,
                item,
            });
        }
    }

    // 2) 相册相片（与其他统计口径一致，避免漏统计深夜上传/拍摄的老照片；自动归档的「说说和日志相册」不计）
    const albums = await loadList('albums');
    for (const album of albums) {
        if (isFeedAlbum(album)) continue;
        const photos = album.photoList || [];
        for (const photo of photos) {
            const raw = PHOTO_TIME_FIELDS.timeOf(photo);
            const ts = timeValue(raw);
            if (!isValidTimestampMs(ts)) continue;
            const info = lateNightInfo(raw);
            if (!info) continue;
            buckets[info.hour]++;
            all.push({
                kind: 'photos',
                label: PHOTO_TIME_FIELDS.label,
                route: ROUTE_OF.photos,
                time: formatTime(raw),
                minuteOfDay: info.minuteOfDay,
                item: { ...photo, __album: album },
            });
        }
    }

    total.value = all.length;
    // 最晚的 N 条：按当天分钟数倒序（越靠近 5 点越前）
    topItems.value = [...all]
        .sort((a, b) => b.minuteOfDay - a.minuteOfDay)
        .slice(0, TOP_N);
    // 时间段柱状图：0~1、1~2、2~3、3~4、4~5 点
    hourBuckets.value = buckets.map((count, hour) => ({ label: `${hour}~${hour + 1}点`, count }));
    loading.value = false;
});

/** 把统计上报给「回忆清单」页的外层分组标题：标题只出现一层，数字不丢 */
const emit = defineEmits<{ summary: [text: string] }>();
const statText = computed(() => `凌晨 0–5 点 · 共 ${total.value} 条`);
watch(statText, (text) => emit('summary', text), { immediate: true });
</script>

<template>
    <div class="night-panel">
        <n-spin v-if="loading" size="small" />
        <template v-else-if="total === 0">
            <div class="panel-title">
                深夜动态
                <span class="panel-note">凌晨 0:00 – 5:00 的记录</span>
            </div>
            <p class="empty">没有深夜发布的记录</p>
        </template>
        <n-collapse v-else :default-expanded-names="defaultExpanded">
            <n-collapse-item name="night">
                <template #header>
                    <span class="panel-title">深夜动态</span>
                    <span class="panel-note">凌晨 0:00 – 5:00 共 {{ total }} 条记录</span>
                </template>

                <!-- 各时段分布放最前：先给全貌，再看具体条目（与「常驻地点」同序） -->
                <div class="sub-title">各时段分布（共 {{ total }} 条）</div>
                <div class="hour-bar-chart" title="凌晨各时段发布动态数量：横向条长度按最多时段为基准对比">
                    <div
                        v-for="(bucket, idx) in hourBuckets"
                        :key="bucket.label"
                        class="hour-bar-row"
                        :title="bucket.label + '：' + bucket.count + ' 条 · 占深夜动态的 ' + (total > 0 ? Math.round(bucket.count / total * 1000) / 10 : 0) + '%'"
                    >
                        <div class="hour-bar-head">
                            <span class="hour-bar-dot" :style="{ background: NIGHT_COLORS[idx % NIGHT_COLORS.length] }" />
                            <span class="hour-bar-name">{{ bucket.label }}</span>
                        </div>
                        <div class="hour-bar-track">
                            <div
                                class="hour-bar-fill"
                                :style="{
                                    width: (bucket.count / maxBucket * 100) + '%',
                                    background: `linear-gradient(90deg, ${NIGHT_COLORS[idx % NIGHT_COLORS.length]}dd 0%, ${NIGHT_COLORS[idx % NIGHT_COLORS.length]} 100%)`,
                                }"
                            />
                        </div>
                        <div class="hour-bar-tail">
                            <span class="hour-bar-count">{{ bucket.count }}</span>
                            <span class="hour-bar-pct">{{ total > 0 ? (Math.round(bucket.count / total * 1000) / 10) + '%' : '—' }}</span>
                        </div>
                    </div>
                </div>
                <!-- 最晚的几条 -->
                <div class="sub-title">最晚的 {{ topItems.length }} 条</div>
                <div v-for="(entry, index) in topItems" :key="index" class="memory">
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
                        <visitor-item v-else-if="entry.kind === 'visitors'" :item="entry.item" />
                        <!-- 相片：与最初的记忆同款紧凑渲染 -->
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
                                        {{ entry.item.name || (entry.item.__album ? '《' + (entry.item.__album.name || '相册') + '》的一张照片' : '一张照片') }}
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
.night-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-toolbar);
    border-left: 3px solid #7c6bc4;
    border-radius: 2px;
}

.panel-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
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

.sub-title {
    margin: 12px 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
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

/* 各时段分布：横向条形图（风格与主页「内容构成」统一，柔和紫色系） */
.hour-bar-chart {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-light);
    border-radius: 8px;
    margin-top: 6px;
}
.hour-bar-row {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
}
.hour-bar-head {
    display: flex;
    align-items: center;
    gap: 6px;
}
.hour-bar-dot {
    width: 8px;
    height: 8px;
    border-radius: 3px;
    flex: none;
    box-shadow: 0 0 0 2px rgba(124, 107, 196, 0.1);
}
.hour-bar-name {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.hour-bar-track {
    position: relative;
    height: 10px;
    border-radius: 5px;
    background: var(--border-separator);
    overflow: hidden;
}
.hour-bar-fill {
    display: block;
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s ease;
}
.hour-bar-tail {
    display: flex;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
    flex: none;
}
.hour-bar-count {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
    min-width: 32px;
    text-align: right;
}
.hour-bar-pct {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 36px;
    text-align: right;
}

/* —— 深夜动态中的「相片」条目：与最初的记忆同款紧凑渲染 —— */
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
    border: 1px solid var(--border-card);
    background: var(--bg-toolbar);
    cursor: pointer;
    transition: transform 0.15s;
}
.photo-thumb:hover {
    transform: scale(1.02);
    box-shadow: 0 2px 8px var(--shadow-sm);
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
    color: var(--text-muted);
    line-height: 1.6;
}
.photo-meta > span {
    margin-right: 10px;
}
.photo-album-tag {
    color: #7c6bc4;
    font-weight: 500;
}
.photo-desc {
    color: var(--text-muted);
}
</style>
