<script setup lang="ts">
const props = withDefaults(defineProps<{ defaultOpen?: boolean }>(), { defaultOpen: false });

import { computed, onMounted, ref, watch } from 'vue';
import { NCollapse, NCollapseItem, NSpin, NTag } from 'naive-ui';
import { loadTopLocations, type TopLocation } from '../data/counts';
import { loadCityStats, type CityRow } from '../data/cityStats';
import ModeSwitch from './ModeSwitch.vue';
import { navigate } from '../router';
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';
import ShareItem from './items/ShareItem.vue';
import FavoriteItem from './items/FavoriteItem.vue';
import VideoItem from './items/VideoItem.vue';

/**
 * 最常访问地点 Top N
 *
 * 数据来源与统计口径与「时间跨度 / 最初的记忆 / 年活跃量 / 月度活跃度」完全一致：
 *  1. 复用 YEAR_MODULES（7 个内容模块：说说/日志/日记/视频/分享/收藏/留言）
 *  2. 额外统计相册相片（遍历 albums.photoList，取拍摄/上传地点）
 *  3. 同地点名按 count 从大到小排序，默认取前 5 名
 *
 * 视觉风格：
 *  - 外壳：与「空间之最 / 最初的记忆 / 深夜动态」完全一致的色条+柔和背景+默认收起折叠面板
 *  - 主体：横向进度条列表（风格与主页「内容构成」统一），每行包含
 *          左侧：彩色圆点 + 地点名 + 所属模块小标签
 *          中间：渐变进度条（长度按最大地点归一化）
 *          右侧：访问次数 + 占比 + 最近访问时间（🕒 yyyy-MM-dd HH:mm）
 *  - 下方预览：点击展开折叠后，每个地点下展示最近一次访问的对应条目卡片
 */

const TOP_N = 5;

/** 地点色板（与主页「内容构成」的 ringColors 色系一致，柔和渐变不刺眼） */
const LOCATION_COLORS = [
    '#7c6bc4', // 主紫（与最初的记忆一致）
    '#4e9de0', // 蓝
    '#3b82f6', // 绿
    '#e0a04e', // 橙
    '#d95f7d', // 粉
    '#8a7fd1', // 浅紫
    '#4ca1f5', // 青
];

const loading = ref(true);
const topLocations = ref<TopLocation[]>([]);

onMounted(async () => {
    topLocations.value = await loadTopLocations(TOP_N);
    loading.value = false;
});

/** 地点 / 城市两个视角（城市按坐标归属，懒加载内置市级地图） */
const mode = ref('place');
const MODE_OPTIONS = [
    { label: '地点', value: 'place' },
    { label: '城市', value: 'city' },
];
const cityRows = ref<CityRow[]>([]);
const cityLoading = ref(false);
let cityLoaded = false;
async function ensureCity(): Promise<void> {
    if (cityLoaded) {
        return;
    }
    cityLoaded = true;
    cityLoading.value = true;
    try {
        cityRows.value = await loadCityStats(TOP_N);
    } catch {
        cityRows.value = [];
    } finally {
        cityLoading.value = false;
    }
}
watch(mode, (value) => {
    if (value === 'city') {
        void ensureCity();
    }
});

const hasAny = computed(() => (mode.value === 'city'
    ? cityRows.value.length > 0 || cityLoading.value
    : topLocations.value.length > 0));
const cityMax = computed(() => Math.max(0, ...cityRows.value.map((row) => row.count)));
const maxCount = computed(() => Math.max(0, ...topLocations.value.map((l) => l.count)));
const summary = computed(() => {
    if (mode.value === 'city') {
        if (cityLoading.value) return '正在统计…';
        if (cityRows.value.length === 0) return '';
        const top = cityRows.value[0];
        return `共 ${cityRows.value.length} 个城市 · 最多的是「${top.name}」${top.count} 次`;
    }
    if (topLocations.value.length === 0) return '';
    const first = topLocations.value[0];
    return `共 ${topLocations.value.length} 个地点 · 最多的是「${first.location}」${first.count} 次`;
});

/** 每行的进度条渐变颜色（按 LOCATION_COLORS 轮换） */
function locationFillStyle(idx: number): Record<string, string> {
    const color = LOCATION_COLORS[idx % LOCATION_COLORS.length];
    return {
        // 与主页「内容构成」同款渐变方向：90deg 浅色 → 深色
        background: `linear-gradient(90deg, ${color}33 0%, ${color} 100%)`,
    };
}
function locationDotColor(idx: number): string {
    return LOCATION_COLORS[idx % LOCATION_COLORS.length];
}

/** 把统计上报给「回忆清单」页的外层分组标题：标题只出现一层，数字不丢 */
const emit = defineEmits<{ summary: [text: string] }>();
const statText = computed(() => summary.value);
watch(statText, (text) => emit('summary', text), { immediate: true });
</script>

<template>
    <div class="locs-panel">
        <n-spin v-if="loading" size="small" />
        <template v-else-if="!hasAny">
            <div class="panel-title">
                {{ mode === 'place' ? '常驻地点' : '常驻城市' }}
                <span class="panel-note">{{ mode === 'place' ? '按发布/拍摄地点聚合的前 ' + TOP_N + ' 名' : '按打卡坐标归属的城市' }}</span>
                <mode-switch v-model="mode" :options="MODE_OPTIONS" class="panel-switch" />
            </div>
            <p class="empty">暂无地点信息（内容里未采集到 lbs 定位数据）</p>
        </template>
        <n-collapse v-else :default-expanded-names="props.defaultOpen ? ['locs'] : []">
            <n-collapse-item name="locs">
                <template #header>
                    <span class="panel-title">{{ mode === 'place' ? '常驻地点' : '常驻城市' }}</span>
                    <span class="panel-note">{{ summary }}</span>
                    <mode-switch v-model="mode" :options="MODE_OPTIONS" class="panel-switch" />
                </template>

                <!-- 横向进度条列表：风格与主页「内容构成」统一 -->
                <template v-if="mode === 'place'">
                <div class="loc-bar-chart" title="各地点访问次数：横向条长度按最多地点为基准对比">
                    <div
                        v-for="(loc, idx) in topLocations"
                        :key="loc.location"
                        class="loc-bar-row"
                        :title="loc.location + '：访问 ' + loc.count + ' 次 · 占所有带地点内容的 ' + loc.percent + '% · 最近访问于 ' + loc.latestTime + '（' + loc.label + '）'"
                    >
                        <!-- 左侧：圆点 + 地点名 + 模块tag -->
                        <div class="loc-bar-head">
                            <span class="loc-bar-dot" :style="{ background: locationDotColor(idx) }" />
                            <span class="loc-bar-name" :title="loc.location">{{ loc.location }}</span>
                            <n-tag
                                class="loc-bar-mod-tag"
                                size="small"
                                :bordered="false"
                                round
                                @click="navigate(loc.route)"
                            >{{ loc.label }}</n-tag>
                        </div>
                        <!-- 中间：渐变进度条 -->
                        <div class="loc-bar-track">
                            <div
                                class="loc-bar-fill"
                                :style="{
                                    width: (maxCount > 0 ? (loc.count / maxCount * 100) : 0) + '%',
                                    ...locationFillStyle(idx),
                                }"
                            />
                        </div>
                        <!-- 右侧：次数 + 占比 + 最近访问时间 -->
                        <div class="loc-bar-tail">
                            <span class="loc-bar-count">{{ loc.count.toLocaleString() }}</span>
                            <span class="loc-bar-pct">{{ loc.percent }}%</span>
                            <span class="loc-bar-time" :title="'最近一次访问于 ' + loc.latestTime + '（' + loc.label + '）'">
                                🕒 {{ loc.latestTime.slice(0, 10) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 最近一次访问预览：与 TopRecordsPanel / FirstRecordsPanel 的 .memory 结构完全一致（左侧NTag模块名 + 右侧卡片） -->
                <div class="sub-title">每个地点最近一次访问的内容</div>
                <div v-for="(loc, idx) in topLocations" :key="'preview-' + idx" class="memory">
                    <n-tag
                        class="memory-label"
                        size="small"
                        :bordered="false"
                        @click="navigate(loc.route)"
                    >{{ loc.label }}</n-tag>
                    <div class="memory-body">
                        <message-item
                            v-if="loc.kind === 'messages'"
                            :item="loc.latestItem"
                        />
                        <article-item
                            v-else-if="loc.kind === 'blogs' || loc.kind === 'diaries'"
                            :item="loc.latestItem"
                            :config-key="loc.kind === 'diaries' ? 'Diaries' : 'Blogs'"
                            @open="(it) => navigate(loc.route, { id: String(it.blogid || it.blogId || '') })"
                        />
                        <board-item v-else-if="loc.kind === 'boards'" :item="loc.latestItem" />
                        <share-item v-else-if="loc.kind === 'shares'" :item="loc.latestItem" />
                        <favorite-item v-else-if="loc.kind === 'favorites'" :item="loc.latestItem" />
                        <video-item v-else-if="loc.kind === 'videos'" :item="loc.latestItem" />
                        <!-- 相片：与最初的记忆同款紧凑渲染 -->
                        <div v-else-if="loc.kind === 'photos'" class="card-item">
                            <div class="photo-mini">
                                <img
                                    class="photo-thumb"
                                    :src="loc.latestItem.custom_pre_filepath || loc.latestItem.custom_filepath || loc.latestItem.url || ''"
                                    :alt="loc.latestItem.name || '照片'"
                                    loading="lazy" decoding="async"
                                    @click="navigate('albums')"
                                />
                                <div class="photo-info">
                                    <div class="photo-name">
                                        {{ loc.latestItem.name || (loc.latestItem.__album ? '《' + (loc.latestItem.__album.name || '相册') + '》的一张照片' : '一张照片') }}
                                    </div>
                                    <div class="photo-meta">
                                        <span v-if="loc.latestItem.__album?.name" class="photo-album-tag">📂 {{ loc.latestItem.__album.name }}</span>
                                        <span class="photo-time">🕒 {{ loc.latestTime }}</span>
                                        <span v-if="loc.latestItem.desc" class="photo-desc">— {{ (loc.latestItem.desc as string).slice(0, 60) }}{{ (loc.latestItem.desc as string).length > 60 ? '…' : '' }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </template>
                <template v-else>
                    <n-spin v-if="cityLoading" size="small" />
                    <p v-else-if="cityRows.length === 0" class="empty">
                        暂无城市数据（缺少内置市级地图，或用的是旧备份）
                    </p>
                    <div v-else class="loc-bar-chart" title="各城市打卡次数：点击可在足迹地图上查看">
                        <div
                            v-for="(row, idx) in cityRows"
                            :key="row.name"
                            class="loc-bar-row city-row"
                            :title="row.name + '：' + row.count + ' 次 · 占全部打卡点的 ' + row.percent + '%，点击在地图查看'"
                            @click="navigate('map', { city: row.name })"
                        >
                            <div class="loc-bar-head">
                                <span class="loc-bar-dot" :style="{ background: locationDotColor(idx) }" />
                                <span class="loc-bar-name" :title="row.name">{{ row.name }}</span>
                            </div>
                            <div class="loc-bar-track">
                                <div
                                    class="loc-bar-fill"
                                    :style="{
                                        width: (cityMax > 0 ? (row.count / cityMax * 100) : 0) + '%',
                                        ...locationFillStyle(idx),
                                    }"
                                />
                            </div>
                            <div class="loc-bar-tail">
                                <span class="loc-bar-count">{{ row.count.toLocaleString() }}</span>
                                <span class="loc-bar-pct">{{ row.percent }}%</span>
                            </div>
                        </div>
                    </div>
                </template>
            </n-collapse-item>
        </n-collapse>
    </div>
</template>

<style scoped>
/* —— 与「最初的记忆」「深夜动态」完全一致的面板外壳：左边色条 + 柔和背景 —— */
.locs-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    position: relative;
    background: var(--bg-tint-purple);
    border-radius: 2px;
}
.locs-panel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #7c6bc4;
    border-radius: 2px 0 0 2px;
}
.panel-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.panel-note {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
}
.empty {
    font-size: 12px;
    color: var(--text-muted);
    margin: 8px 2px 0;
}
.sub-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 16px 0 8px;
    padding-left: 2px;
    border-left: 2px solid #7c6bc4;
    padding-left: 8px;
}

/* —— 横向进度条列表：风格与主页「内容构成」完全统一 —— */
.loc-bar-chart {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-tint-purple);
    border: 1px solid var(--border-separator);
    border-radius: 8px;
    margin-top: 6px;
}
.loc-bar-row {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) auto;
    gap: 12px;
    align-items: center;
}
.loc-bar-head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.loc-bar-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
    box-shadow: 0 0 0 2px rgba(124, 107, 196, 0.08);
}
.loc-bar-name {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
.loc-bar-mod-tag {
    font-size: 10px !important;
    padding: 0 6px !important;
    line-height: 16px !important;
    flex: none;
    cursor: pointer;
}
.loc-bar-track {
    position: relative;
    height: 10px;
    border-radius: 5px;
    background: var(--border-separator);
    overflow: hidden;
}
.loc-bar-fill {
    display: block;
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s ease;
}
.loc-bar-tail {
    display: flex;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
    flex: none;
    font-size: 11px;
}
.loc-bar-count {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
    min-width: 32px;
    text-align: right;
}
.loc-bar-pct {
    color: var(--text-secondary);
    min-width: 44px;
    text-align: right;
}
.loc-bar-time {
    color: var(--text-muted);
    white-space: nowrap;
}

/* —— 每个地点预览的 .memory 条目：与 TopRecordsPanel/FirstRecordsPanel 结构完全一致 —— */
.memory {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border-separator);
}
.memory:last-child {
    border-bottom: none;
    padding-bottom: 0;
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

/* —— 相片紧凑渲染：与最初的记忆/深夜动态同款 —— */
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
    color: #7c6bc4;
    font-weight: 500;
}
.photo-desc {
    color: var(--text-muted);
}

/* —— 响应式：移动端收紧三栏网格比例，时间隐藏避免换行 —— */
@media (max-width: 768px) {
    .loc-bar-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        gap: 8px;
    }
    .loc-bar-mod-tag {
        display: none;
    }
    .loc-bar-time {
        display: none;
    }
    .loc-bar-pct {
        min-width: 36px;
    }
}
</style>


/* 视角切换：贴在面板标题右侧 */
.panel-switch {
    margin-left: auto;
    font-weight: 400;
}
.city-row {
    cursor: pointer;
}
.city-row:hover .loc-bar-name {
    color: var(--accent);
}
