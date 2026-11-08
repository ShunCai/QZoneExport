<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NAlert, NButton, NEmpty, NSelect, NSpin, NTag } from 'naive-ui';
import { loadList, assetUrl } from '../data/sources';
import { useVisitorFilter } from '../data/visitorFilter';
import { formatTime, timeValue } from '../data/format';
import { itemComments, likeTotal, viewCount } from '../data/content';
import { navigate, routeQuery } from '../router';
import ItemStats from '../components/ItemStats.vue';
import ListPage from '../components/ListPage.vue';
import MediaGrid from '../components/MediaGrid.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import PhotoBatchItem from '../components/items/PhotoBatchItem.vue';
import { photoLocation, photoMediaOf, photoTimeOf, resolvePhotoTime, type MediaItem } from '../data/media';
import { useGridColumns } from '../data/gridColumns';
import { getModulePref, savePref, type AlbumView } from '../data/displayPrefs';

/**
 * 相册页：无 id 时显示相册列表（按分类分组），带 id 时显示该相册的相片
 * 数据来自 Albums/json/albums.js，相片列表内嵌在每个相册的 photoList 里
 */
const loading = ref(true);
const albums = ref<Record<string, any>[]>([]);

/* 相册列表偏好记忆键：区别于相册内相片列表 ListPage 使用的 'albums' */
const LIST_PREF_KEY = 'albumsList';

onMounted(async () => {
    albums.value = await loadList('albums');
    loading.value = false;
});

/** 按浏览者过滤（互动面板「我浏览过的相册」卡片跳转携带 ?visitor=UIN） */
const { filter: visitorFilter, hasVisitor, visitorName, visitorUin, clearVisitor } = useVisitorFilter(albums);
/** 过滤后的相册（仅当前浏览者浏览过的） */
const filteredAlbums = computed(() => albums.value.filter(visitorFilter.value));

const currentId = computed(() => routeQuery.value.id || '');
const current = computed(() => albums.value.find((item) => String(item.id) === currentId.value) || null);

/** 相册排序方式（与 Options 相册模块的排序方式一致；「空间自定义」=QQ 空间页面上用户自定义排定的相册顺序） */
const ALBUM_SORTS: { label: string; value: string; cmp: ((a: Record<string, any>, b: Record<string, any>) => number) | null }[] = [
    { label: '空间自定义', value: 'custom', cmp: null },
    { label: '最新创建在前', value: 'createDesc', cmp: (a, b) => albumCreate(b) - albumCreate(a) },
    { label: '最新创建在后', value: 'createAsc', cmp: (a, b) => albumCreate(a) - albumCreate(b) },
    { label: '最新上传在前', value: 'uploadDesc', cmp: (a, b) => albumUpload(b) - albumUpload(a) },
];
/** 相册排序下拉选项（naive-ui select，与其它模块排序控件一致） */
const albumSortOptions = ALBUM_SORTS.map((s) => ({ label: s.label, value: s.value }));
/** 相册创建时间（秒/毫秒 → 数值，缺失按 0 处理） */
function albumCreate(a: Record<string, any>): number {
    return Number(a.createtime ?? a.createTime ?? 0) || 0;
}
/** 相册最近上传时间（秒/毫秒 → 数值，缺失回落创建时间再按 0） */
function albumUpload(a: Record<string, any>): number {
    return Number(a.lastuploadtime ?? a.uploadtime ?? a.createtime ?? a.createTime ?? 0) || 0;
}
/** 稳定排序：同 cmp 相等时保持原相对顺序（同值/同分类内不被打乱） */
function sortStable<T>(list: T[], cmp: (a: T, b: T) => number): T[] {
    const order = new Map<T, number>();
    list.forEach((item, i) => order.set(item, i));
    return list.sort((a, b) => cmp(a, b) || (order.get(a)! - order.get(b)!));
}

/** 视图类型：分类视图（默认，按分类分组）/ 普通视图（不分组平铺） */
const viewMode = ref<AlbumView>('category');
/** 相册排序：作用于分类视图每个分类内部 / 普通视图整份列表；「空间自定义」保持原顺序不重排 */
const albumSort = ref('custom');
/** 恢复相册列表的视图与排序偏好（默认分类视图 / 空间自定义，识别到已保存记忆则覆盖） */
onMounted(() => {
    const pref = getModulePref(LIST_PREF_KEY);
    viewMode.value = pref.albumView;
    albumSort.value = pref.albumSort;
});
/** 视图/排序选择变更后按模块持久化（与其它列表页的记忆方式一致） */
watch(viewMode, (v) => savePref(LIST_PREF_KEY, { albumView: v }));
watch(albumSort, (v) => savePref(LIST_PREF_KEY, { albumSort: v }));
/** 当前排序比较函数（无则保持接口返回顺序） */
const albumCmp = computed(() => ALBUM_SORTS.find((s) => s.value === albumSort.value)?.cmp || null);

/** 普通视图：整份列表按所选排序排列（不分组） */
const flatList = computed(() => {
    const list = filteredAlbums.value.slice();
    if (albumCmp.value) sortStable(list, albumCmp.value);
    return list;
});

/** 分类视图：按分类分组；组间按采集端落盘的分类顺序(classSort)排，组内按所选排序排 */
const grouped = computed(() => {
    const groups = new Map<string, { albums: Record<string, any>[]; classSort: number }>();
    for (const album of filteredAlbums.value) {
        const name = album.className || '其他';
        const g = groups.get(name) || { albums: [], classSort: album.classSort != null ? Number(album.classSort) : Number.MAX_SAFE_INTEGER };
        g.albums.push(album);
        groups.set(name, g);
    }
    const entries = [...groups.values()];
    // 组间：按分类顺序(classSort)升序（sort 稳定，同序分类保持原出现顺序）
    entries.sort((a, b) => a.classSort - b.classSort);
    // 组内：按当前相册排序（custom 时保持接口返回顺序）
    for (const g of entries) {
        if (albumCmp.value) sortStable(g.albums, albumCmp.value);
    }
    return entries.map((g) => [g.albums[0]!.className || '其他', g.albums] as const);
});

/** 供模板统一渲染的分组：分类视图=分组列表；普通视图=单组（无标题） */
const displayGroups = computed(() => (viewMode.value === 'plain' ? [[null, flatList.value] as const] : grouped.value));

/** 相册封面：优先本地文件。相册数据里的封面路径已带 ../ 前缀（供旧页面用），需剥掉 */
function coverUrl(album: Record<string, any>): string {
    const path = album.custom_filepath || album.custom_url || album.url || album.pre || '';
    return assetUrl(String(path).replace(/^\.\.\//, ''));
}

/** 相片排序字段：上传时间（默认）/ 拍摄时间（兜底上传）/ 点赞 / 评论，均可升降序 */
const photoSorts = [
    { label: '上传时间', value: 'upload', valueOf: (p: Record<string, any>) => timeValue(resolvePhotoTime(p, 'upload')) },
    { label: '拍摄时间', value: 'shoot', valueOf: (p: Record<string, any>) => timeValue(resolvePhotoTime(p, 'shoot')) },
    { label: '点赞数', value: 'like', valueOf: (p: Record<string, any>) => likeTotal(p) },
    { label: '评论数', value: 'comment', valueOf: (p: Record<string, any>) => itemComments(p).length },
];

/** 相片→媒体项（过滤掉无地址的），供网格渲染 */
function toMedias(photos: Record<string, any>[]): MediaItem[] {
    return photos.map((photo) => photoMediaOf(photo)).filter((media) => !!media.src);
}

/** 网格容器（屏宽不同每行列数不同），按列数让每页条数取整数倍，保证最后一行铺满 */
const gridWrap = ref<HTMLElement | null>(null);
const gridColumns = useGridColumns(gridWrap, 220, 8);
const pageSize = computed(() => Math.max(1, Math.round(60 / gridColumns.value)) * gridColumns.value);

/** 相册是否可访问（旧页用 allowAccess 判定，加密相册采集不到内容） */
function accessTag(album: Record<string, any>): string {
    if (album.allowAccess === false || album.allowAccess === 0) {
        return '无访问权限';
    }
    return '';
}
</script>

<template>
    <!-- 相册内相片：复用列表外壳获得年份/月份筛选、搜索、排序与分页 -->
    <template v-if="currentId">
        <div v-if="!current" class="page-body">
            <n-alert type="warning" :show-icon="true">
                没有找到该相册，可能备份数据已变化，请返回相册列表重新进入。
            </n-alert>
        </div>
        <list-page
            v-else
            :pref-key="'albums'"
            :title="current.name || '相册'"
            :items="current.photoList || []"
            :loading="false"
            empty-hint="这个相册还没有相片"
            unit="张"
            :page-size="pageSize"
            :time-of="photoTimeOf"
            :sorts="photoSorts"
            :text-of="(photo: Record<string, any>) => [photo.name, photo.desc, photoLocation(photo)].filter(Boolean).join(' ')"
            :focus-item="(photo: Record<string, any>) => !!routeQuery.photo && String(photo.lloc || photo.name || '') === routeQuery.photo"
        >
            <template #head-prefix>
                <n-button text class="back" @click="() => {
                    if (routeQuery.from === 'interaction') navigate('interaction', { qq: routeQuery.qq });
                    else if (routeQuery.from) navigate(routeQuery.from);
                    else navigate('albums');
                }">← 返回</n-button>
            </template>
            <template #lead>
                <!-- 相册自身的信息与赞/评/浏览 -->
                <div class="album-info">
                    <div class="album-info-line">
                        <n-tag v-if="current.className" size="small" :bordered="false">{{ current.className }}</n-tag>
                        <n-tag v-if="accessTag(current)" size="small" :bordered="false" type="warning">
                            {{ accessTag(current) }}
                        </n-tag>
                        <span class="album-time">{{ formatTime(current.createtime || current.createTime) }}</span>
                    </div>
                    <p v-if="current.desc" class="album-desc">{{ current.desc }}</p>
                    <item-stats :item="current" />
                </div>

                <!-- 那年今日：相册本身不算，只算本册相片（按相片上传时间） -->
                <that-year-today
                    :items="current.photoList || []"
                    :time-of="(photo: Record<string, any>) => resolvePhotoTime(photo, 'upload')"
                >
                    <template #item="{ item }">
                        <photo-batch-item :album="current" :photos="[item]" />
                    </template>
                </that-year-today>
            </template>

            <!-- 点任一张在大图里翻当页，单张相片的评论在大图右侧面板 -->
            <template #default="{ items, paginate }">
                <div ref="gridWrap">
                    <media-grid
                        :medias="toMedias(items)"
                        :comments="itemComments(current)"
                        :masonry="!paginate"
                        :item-width="220"
                        :open-key="routeQuery.photo"
                        :highlight-comment="routeQuery.comment"
                    />
                </div>
            </template>
        </list-page>
    </template>

    <!-- 相册列表 -->
    <template v-else>
        <div class="page-head">
            相册
            <span v-if="!loading && albums.length > 0" class="head-count">共 {{ albums.length }} 个</span>
        </div>
        <div v-if="hasVisitor" class="visitor-filter-bar">
            仅显示 <b>{{ visitorName || visitorUin }}</b> 浏览过的相册
            <button class="visitor-clear" type="button" @click="clearVisitor">清除筛选</button>
        </div>
        <div class="page-body">
            <div v-if="loading" class="loading">
                <n-spin size="large" />
            </div>

            <n-empty
                v-else-if="albums.length === 0"
                description="暂无相册内容（本次备份可能未包含相册模块）"
                size="large"
                class="albums-empty"
            />
            <n-empty
                v-else-if="filteredAlbums.length === 0"
                description="没有该浏览者浏览过的相册"
                size="large"
                class="albums-empty"
            />

            <template v-else>
                <!-- 工具条：视图切换 + 相册排序 -->
                <div class="album-toolbar">
                    <div class="view-switch" role="tablist" aria-label="视图切换">
                        <button type="button" :class="{ active: viewMode === 'category' }" @click="viewMode = 'category'">分类视图</button>
                        <button type="button" :class="{ active: viewMode === 'plain' }" @click="viewMode = 'plain'">普通视图</button>
                    </div>
                    <span class="album-toolbar-label">排序</span>
                    <n-select
                        v-model:value="albumSort"
                        :options="albumSortOptions"
                        style="width: 130px;"
                    />
                </div>

                <div v-for="g in displayGroups" :key="g[0] ?? 'whole'" class="group" :class="{ 'group-plain': !g[0] }">
                    <div v-if="g[0]" class="group-title">{{ g[0] }}（{{ g[1].length }}）</div>
                    <div class="albums">
                        <div
                            v-for="album in g[1]"
                            :key="album.id"
                            class="album"
                            @click="navigate('albums', { id: String(album.id) })"
                        >
                            <img v-if="coverUrl(album)" class="album-cover" :src="coverUrl(album)" loading="lazy" />
                            <div v-else class="album-cover album-cover-empty">无封面</div>
                            <div class="album-name" :title="album.name">{{ album.name }}</div>
                            <div class="album-meta">
                                {{ album.photoList?.length || album.total || 0 }} 张
                                <n-tag v-if="album.isLocal" size="tiny" :bordered="false">本地</n-tag>
                                <n-tag v-if="accessTag(album)" size="tiny" :bordered="false" type="warning">
                                    {{ accessTag(album) }}
                                </n-tag>
                            </div>
                            <!-- 赞/评论/浏览数直接显在卡片上，不用点进相册才能看到（旧页如此） -->
                            <div class="stat-badges album-stats">
                                <span class="stat-item" :class="{ 'has-value': likeTotal(album) > 0 }">
                                    赞 {{ likeTotal(album) }}
                                </span>
                                <span class="stat-item" :class="{ 'has-value': itemComments(album).length > 0 }">
                                    评论 {{ itemComments(album).length }}
                                </span>
                                <span class="stat-item" :class="{ 'has-value': viewCount(album) > 0 }">
                                    浏览 {{ viewCount(album) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </template>
</template>

<style scoped>
.back {
    /* 返回按钮放在标题栏（page-head 为 flex），与相册名同行，字号略小 */
    margin-right: 6px;
    font-size: 14px;
}
.head-count {
    margin-left: 10px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-muted);
}
/* 浏览者过滤提示条（互动面板「我浏览过的相册」跳入时显示） */
.visitor-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
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
.loading {
    display: flex;
    justify-content: center;
    padding: 40px 0;
}
/* 模块无数据：与列表页一致的居中“暂无数据”占位 */
.albums-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.group {
    margin-bottom: 22px;
}
/* 普通视图：不分组，无标题，去掉分组下边距（与分类视图视觉统一） */
.group.group-plain {
    margin-bottom: 0;
}
.group-title {
    margin-bottom: 10px;
    padding: 8px 12px;
    background: var(--bg-page);
    border-left: 3px solid #2080f0;
    font-weight: 600;
}
/* 相册列表工具条：视图切换 + 排序下拉 */
.album-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin: 0 0 14px;
}
.view-switch {
    display: inline-flex;
    border: 1px solid var(--border-card);
    border-radius: 6px;
    overflow: hidden;
}
.view-switch button {
    padding: 5px 14px;
    background: var(--bg-primary);
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.2s, color 0.2s;
}
.view-switch button + button {
    border-left: 1px solid var(--border-card);
}
.view-switch button:hover {
    color: var(--text-primary);
}
.view-switch button.active {
    background: #2080f0;
    color: #fff;
}
/* 与其它模块工具栏相同的「排序」文字标签 */
.album-toolbar-label {
    color: var(--text-muted);
    font-size: 12px;
}
.albums {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 14px;
}
/* 相册卡片：与其它模块的卡片一致的边界，否则一片图挤在一起分不清归属 */
.album {
    padding: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    cursor: pointer;
    transition: box-shadow 0.2s, border-color 0.2s;
}
.album:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
}
.album-cover {
    width: 100%;
    height: 150px;
    object-fit: cover;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-light);
    border-radius: 4px;
}
.album-cover-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-subtle);
    font-size: 12px;
    box-sizing: border-box;
}
.album-name {
    margin-top: 6px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.album-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 12px;
}
/* 统计行与上方信息拉开，并用细分隔线隔开 */
.album-stats {
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px dashed var(--border-toolbar);
}
/* 相册自身的信息区 */
.album-info {
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-light);
}
.album-info-line {
    display: flex;
    align-items: center;
    gap: 10px;
}
.album-time {
    color: var(--text-muted);
    font-size: 12px;
}
.album-desc {
    margin: 8px 0 0;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}
.photo-pager {
    display: flex;
    justify-content: center;
    padding: 16px 0 4px;
}
</style>
