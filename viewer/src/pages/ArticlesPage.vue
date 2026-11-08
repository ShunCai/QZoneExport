<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NAlert, NButton, NDataTable, NRadioButton, NRadioGroup, NSelect, NTag, type DataTableColumns } from 'naive-ui';
import { loadList, type DataKey } from '../data/sources';
import { getModulePref, savePref, type ShowType, type ViewType } from '../data/displayPrefs';
import { formatTime, timeValue } from '../data/format';
import { articleEffectiveTime, articlePublishTime, blogLabels, blogLabelType, commentReplies, commentUser, decodeHtml, fixHtmlAssets, isArticleTop, itemComments, likeTotal, viewCount } from '../data/content';
import { openImageLightbox } from '../data/lightbox';
import { navigate, routeQuery } from '../router';
import CommentList from '../components/CommentList.vue';
import ItemStats from '../components/ItemStats.vue';
import { useSearchHighlight } from '../composables/useSearchHighlight';
import ListPage from '../components/ListPage.vue';
import { useVisitorFilter } from '../data/visitorFilter';
import ThatYearToday from '../components/ThatYearToday.vue';
import ArticleItem from '../components/items/ArticleItem.vue';

/**
 * 日志与日记（两者数据结构一致，只是数据源与标题不同）
 *
 * 展示方式（showType 表格/列表、viewType 列表/摘要）的默认值来自查看器侧偏好
 * （displayPrefs，按模块记忆在 localStorage），不再读备份配置；页面上可随时切换并持久化。
 * 正文为 base64 的 HTML，只在详情页解码渲染，避免列表页一次性渲染上百篇长文。
 */
const props = defineProps<{
    source: DataKey;
    title: string;
    /** 备份配置里的模块名，用于取展示方式默认值 */
    configKey: 'Blogs' | 'Diaries';
}>();

const loading = ref(true);

/** 从全局搜索跳进来时，把正文里的命中词标出来 */
useSearchHighlight();
const list = ref<Record<string, any>[]>([]);
/** 展示偏好键：Blogs/Diaries 对应路由 key（小写），用于按模块记忆偏好 */
const prefKey = computed(() => props.configKey.toLowerCase());
/** '0' 表格 · '1' 列表 */
const showType = ref<ShowType>('1');
/** '0' 仅标题 · '1' 含摘要 */
const viewType = ref<ViewType>('1');

onMounted(async () => {
    list.value = await loadList(props.source);
    const pref = getModulePref(prefKey.value);
    showType.value = pref.showType;
    viewType.value = pref.viewType;
    loading.value = false;
});

/** 按浏览者过滤（互动面板「我浏览过的日志/日记」卡片跳转携带 ?visitor=UIN） */
const { filter: visitorFilter, hasVisitor, visitorName, visitorUin, clearVisitor } = useVisitorFilter(list);

/** 备份是否含摘要数据（abstract 文本或配图）：决定 viewType=摘要 时能否真正显示摘要，否则回退列表 */
const hasSummary = computed(() => (list.value || []).some((item) => {
    const abstract = typeof item.abstract === 'string' ? item.abstract.replace(/<[^>]+>/g, '').trim() : '';
    const imgs = Array.isArray(item.img) ? item.img.length : 0;
    return abstract.length > 0 || imgs > 0;
}));
/** 仅日志（Blogs）具备摘要概念；日记（Diaries）无摘要，不触发任何摘要相关提示或回落 */
const isBlog = computed(() => props.source === 'blogs');
/** 实际生效的视图类型：用户选了摘要但数据无摘要时，强制回落为仅标题（仅日志场景） */
const effectiveViewType = computed<ViewType>(() => (
    isBlog.value && viewType.value === '1' && !hasSummary.value ? '0' : viewType.value
));
/** 用户选了摘要却无数据时的轻提示（仅日志场景；日记本身无摘要，绝不提示） */
const summaryFallback = computed(() => isBlog.value && viewType.value === '1' && !hasSummary.value);

/**
 * 展示方式三组合（方案 A）
 *
 * 原本「列表/表格」与「仅标题/含摘要」是两个 radio 组、视觉上像四选一；
 * 有效组合其实只有 3 种（表格态下详略不起作用）。合并成一个下拉后：
 *  - 内部仍写回 showType / viewType 两个状态，偏好存储零迁移
 *  - 无摘要数据时「含摘要列表」置灰，沿用既有 effectiveViewType 回退
 */
type ViewPreset = 'list-title' | 'list-summary' | 'table';
const viewPreset = computed<ViewPreset>({
    get: () => (showType.value === '0' ? 'table' : (viewType.value === '1' ? 'list-summary' : 'list-title')),
    set: (value) => {
        if (value === 'table') {
            showType.value = '0';
        } else {
            showType.value = '1';
            viewType.value = value === 'list-summary' ? '1' : '0';
        }
    },
});
const presetOptions = computed(() => [
    { label: '仅标题列表', value: 'list-title' },
    { label: '含摘要列表', value: 'list-summary', disabled: isBlog.value && !hasSummary.value },
    { label: '表格', value: 'table' },
]);

// 展示方式变更后按模块持久化
watch(showType, (value) => savePref(prefKey.value, { showType: value }));
watch(viewType, (value) => savePref(prefKey.value, { viewType: value }));

function keyOf(item: Record<string, any>): string {
    return String(item.blogid || item.blogId || item.uniKey || item.title);
}

function timeOf(item: Record<string, any>): any {
    return item.pubtime || item.pubTime || item.time;
}

/** 排序字段：发表时间（默认）/ 修改时间（兜底发表时间）/ 点赞 / 评论 / 访问数，均可升降序 */
const sorts = [
    { label: '发表时间', value: 'publish', valueOf: (item: Record<string, any>) => timeValue(articlePublishTime(item)) },
    { label: '修改时间', value: 'modify', valueOf: (item: Record<string, any>) => timeValue(articleEffectiveTime(item)) },
    { label: '点赞数', value: 'like', valueOf: (item: Record<string, any>) => likeTotal(item) },
    { label: '评论数', value: 'comment', valueOf: (item: Record<string, any>) => itemComments(item).length },
    { label: '访问数', value: 'view', valueOf: (item: Record<string, any>) => viewCount(item) },
];

/** 正文：解码 base64 后再修正内嵌图片的相对路径 */
const contentCache = new Map<string, string>();
function contentOf(item: Record<string, any>): string {
    const key = keyOf(item);
    if (!contentCache.has(key)) {
        contentCache.set(key, fixHtmlAssets(decodeHtml(item.custom_html || item.html), props.configKey));
    }
    return contentCache.get(key) || '';
}

/** 详情页：地址形如 #/blogs?id=xxx，刷新与浏览器后退都能用 */
const currentId = computed(() => routeQuery.value.id || '');
const current = computed(() => list.value.find((item) => keyOf(item) === currentId.value) || null);

function openDetail(item: Record<string, any>): void {
    navigate(props.source === 'diaries' ? 'diaries' : 'blogs', { id: keyOf(item) });
}

/**
 * 正文 HTML（v-html 渲染）里的图片点击看大图
 * 通过事件委托捕获点击的 <img>（含被 <a> 包裹的图片），并把同一篇正文里的所有图片
 * 组成一个画廊，点击哪张就从哪张打开。阻止 <a> 默认的跳转/新窗口打开图片行为。
 */
function onContentImageClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // 先找被点中的图片本身；再兼容「图片被 <a> 包裹、点到的是 <a>」的情况
    let img = target.closest('img') as HTMLImageElement | null;
    if (!img) {
        const anchor = target.closest('a');
        if (anchor && anchor.querySelector('img')) {
            img = anchor.querySelector('img');
        }
    }
    if (!img) {
        return;
    }
    event.preventDefault();
    const container = event.currentTarget as HTMLElement;
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const index = Math.max(imgs.indexOf(img), 0);
    void openImageLightbox(
        imgs.map((el) => ({ src: el.getAttribute('src') || el.src })),
        index,
    );
}

const emptyHint = computed(() => `暂无${props.title}内容（本次备份可能未包含${props.title}模块）`);

/**
 * 分类筛选
 * 旧页把分类做成了左侧锚点目录（需一次渲染全部内容才能跳转，数据量大时很卡），
 * 这里改成筛选条件，与月份、搜索可叠加。
 */
const category = ref('');
const categoryOptions = computed(() => {
    const names = new Set<string>();
    for (const item of list.value) {
        names.add(item.category || '未分类');
    }
    return [{ label: '全部分类', value: '' }]
        .concat([...names].sort().map((name) => ({ label: name, value: name })));
});
/** 用 computed 而非模板里的内联函数：后者每次渲染都是新函数，会让列表页不断重置页码 */
const categoryFilter = computed(() => (item: Record<string, any>) => {
    if (!visitorFilter.value(item)) return false;
    return !category.value || (item.category || '未分类') === category.value;
});

const columns = computed<DataTableColumns<Record<string, any>>>(() => [
    {
        title: '标题',
        key: 'title',
        ellipsis: { tooltip: true },
        render: (row) => h(
            NButton,
            { text: true, type: 'primary', onClick: () => openDetail(row) },
            { default: () => row.title || row.custom_title || '（无标题）' },
        ),
    },
    {
        // 原创/转载/置顶等标识，旧表格页同样有这一列
        title: '标识',
        key: 'labels',
        width: 110,
        render: (row) => blogLabels(row).map((label) => h(
            NTag,
            { size: 'small', bordered: false, type: blogLabelType(label), style: 'margin-right:4px;' },
            { default: () => label },
        )),
    },
    { title: '分类', key: 'category', width: 120, render: (row) => row.category || '—' },
    { title: '发表时间', key: 'time', width: 170, render: (row) => formatTime(timeOf(row)) },
    { title: '赞', key: 'like', width: 70, render: (row) => row.likeTotal || 0 },
    { title: '评论', key: 'comment', width: 70, render: (row) => itemComments(row).length },
    {
        title: '阅读',
        key: 'read',
        width: 80,
        render: (row) => row.custom_visitor?.viewCount || row.readNum || 0,
    },
]);
</script>

<template>
    <!-- 详情页 -->
    <template v-if="currentId">
        <div class="page-head">
            <n-button text @click="() => {
                if (routeQuery.from === 'interaction') navigate('interaction', { qq: routeQuery.qq });
                else if (routeQuery.from) navigate(routeQuery.from);
                else navigate(props.source === 'diaries' ? 'diaries' : 'blogs');
            }">
                ← 返回
            </n-button>
        </div>
        <div class="page-body">
            <template v-if="current">
                <div class="article-detail">
                    <h2 class="detail-title">{{ current.title || current.custom_title || '（无标题）' }}</h2>
                    <div class="item-meta">
                        <span>{{ formatTime(timeOf(current)) }}</span>
                        <n-tag
                            v-for="label in blogLabels(current)"
                            :key="label"
                            size="small"
                            :bordered="false"
                            :type="blogLabelType(label)"
                        >{{ label }}</n-tag>
                        <n-tag v-if="current.category" size="small" :bordered="false">{{ current.category }}</n-tag>
                        <n-tag v-if="current.private" size="small" :bordered="false" type="warning">私密</n-tag>
                        <span>阅读 {{ current.custom_visitor?.viewCount || current.readNum || 0 }}</span>
                    </div>
                    <div class="item-content" v-html="contentOf(current)" @click="onContentImageClick" />
                    <item-stats :item="current" :show-comments="false" />
                    <comment-list
                        :comments="itemComments(current)"
                        :user-of="commentUser"
                        :replies-of="commentReplies"
                        :highlight-id="routeQuery.comment"
                        :item-id="keyOf(current)"
                    />
                </div>
            </template>
            <p v-else class="missing">没有找到这篇{{ props.title }}，它可能未包含在本次备份中。</p>
        </div>
    </template>

    <!-- 列表页 -->
    <list-page
        v-else
        :pref-key="prefKey"
        :title="props.title"
        :items="list"
        :loading="loading"
        :empty-hint="emptyHint"
        unit="篇"
        :page-size="15"
        :time-of="timeOf"
        :filter="categoryFilter"
        :top-of="isArticleTop"
        sort-label="发表时间"
        :sorts="sorts"
        :text-of="(item) => [item.title, item.custom_title, item.category].filter(Boolean).join(' ')"
        :comments-of="(item: Record<string, any>) => itemComments(item).flatMap((comment: Record<string, any>) => [String(comment.content || ''), ...((comment.replyList || []) as Record<string, any>[]).map((reply: Record<string, any>) => String(reply.content || ''))]).filter(Boolean)"
    >
        <!-- 那年今日（按发表时间算） -->
        <template #lead>
            <div v-if="hasVisitor" class="visitor-filter-bar">
                仅显示 <b>{{ visitorName || visitorUin }}</b> 浏览过的{{ props.title }}
                <button class="visitor-clear" type="button" @click="clearVisitor">清除筛选</button>
            </div>
        </template>

        <!-- 分类筛选与展示方式（展示方式默认取自备份配置，可在此临时切换） -->
        <template #toolbar>
            <div class="toolbar-group">
                <span class="toolbar-label">形态</span>
                <n-select
                    v-model:value="viewPreset"
                    :options="presetOptions"
                    size="small"
                    style="width: 132px;"
                />
            </div>
            <div v-if="categoryOptions.length > 2" class="toolbar-group">
                <span class="toolbar-label">分类</span>
                <n-select v-model:value="category" :options="categoryOptions" style="width: 150px;" />
            </div>
        </template>

        <template #default="{ items }">
            <n-alert
                v-if="summaryFallback"
                type="warning"
                :show-icon="true"
                style="margin-bottom: 10px;"
            >
                该备份未采集日志摘要，已切换为「仅标题」视图；如需摘要请在备份设置中开启摘要采集后重新备份。
            </n-alert>
            <n-data-table
                v-if="showType === '0'"
                :columns="columns"
                :data="items"
                :row-key="(row) => keyOf(row)"
                :bordered="false"
                size="small"
            />
            <template v-else>
                <article-item
                    v-for="item in items"
                    :key="keyOf(item)"
                    :item="item"
                    :config-key="props.configKey"
                    :view-type="effectiveViewType"
                    @open="openDetail"
                />
            </template>
        </template>
    <template #after-toolbar>
            <that-year-today
                :items="list"
                :time-of="timeOf"
            >
                <template #item="{ item }">
                    <article-item :item="item" :config-key="props.configKey" :view-type="effectiveViewType" @open="openDetail" />
                </template>
            </that-year-today>
    </template>
    </list-page>
</template>

<style scoped>
/* 详情页的元信息行（列表条目的同名样式已随渲染一起进了 items/ArticleItem.vue） */
.item-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 12px;
}
.detail-title {
    margin: 0 0 8px;
    font-size: 20px;
}
/* 浏览者过滤提示条（互动面板「我浏览过的日志/日记」跳入时显示） */
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
/*
 * 正文阅读区限宽：桌面端居中、最大约 A4 纸比例（约 920px，与 V2 一致），
 * 窄屏自动占满（配合 .page-body 的左右内边距，移动端/平板端自然适配）。
 */
.article-detail {
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
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
/* 备份下来的正文自带排版，这里只做溢出与图片自适应约束 */
.item-content {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-light);
    line-height: 1.8;
    word-break: break-word;
}
.item-content :deep(img),
.item-content :deep(video),
.item-content :deep(embed) {
    max-width: 100%;
    height: auto;
}
/* 正文图片可点开看大图，给出放大光标提示 */
.item-content :deep(img) {
    cursor: zoom-in;
}
.item-content :deep(table) {
    max-width: 100%;
}
</style>
