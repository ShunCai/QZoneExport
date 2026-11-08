<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { assetUrl, normalizeModulePath } from '../../data/sources';
import { formatTime } from '../../data/format';
import { articleEffectiveTime, articlePublishTime, blogLabels, blogLabelType, decodeHtml, fixHtmlAssets, itemComments } from '../../data/content';
import { formatHtmlContent, formatText } from '../../data/richText';

/**
 * 单篇日志/日记的列表条目
 *
 * 正文为 base64 的 HTML，列表里只渲染摘要（abstract 本身也是 HTML），
 * 抽出来供日志/日记列表页与个人中心的那年今日共用。
 */
const props = defineProps<{
    item: Record<string, any>;
    /** 摘要配图的相对路径需要模块名前缀（Blogs / Diaries） */
    configKey: 'Blogs' | 'Diaries';
    /** 是否显示摘要与配图（'0' 仅标题 · '1' 含摘要，与 config 的 viewType 一致） */
    viewType?: string;
}>();

const emit = defineEmits<{ open: [item: Record<string, any>] }>();

/** 展示时间：有修改时间优先显示修改时间，否则发表时间（日记无修改时间时自然兜底发表时间） */
const displayTime = computed(() => formatTime(articleEffectiveTime(props.item)));
/** 有修改时间时，悬浮提示实际发表时间 */
const timeTitle = computed(() => (
    props.item.lastModifyTime ? '发表时间：' + formatTime(articlePublishTime(props.item)) : ''
));

/**
 * 摘要
 * 备份里的 abstract 本身就是 HTML（带排版与表情），必须按富文本渲染，否则会把标签
 * 当成文字显示；没有 abstract 时才从正文抽一段纯文本。
 * 用 computed 而非方法：正文是 base64，放在模板里调会每次渲染都重新解码一遍。
 */
const abstractHtml = computed(() => {
    const item = props.item;
    if (item.abstract) {
        return formatHtmlContent(fixHtmlAssets(String(item.abstract), props.configKey));
    }
    const text = fixHtmlAssets(decodeHtml(item.custom_html || item.html), props.configKey)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return formatText(text.length > 140 ? text.slice(0, 140) + '…' : text);
});

/**
 * 摘要视图的配图
 * 旧页的摘要卡片也会先排一行 blog.img（见 src/export/js/common.js 的 TPL.BLOG_INFO）；
 * 旧备份的 custom_url 是模块相对路径（images/xxx），需补上模块名；新备份是根相对
 * （如 Blogs/images/xxx.jpg）不受影响；未下载时退回空间外链。
 */
const abstractImages = computed<string[]>(() => (props.item.img || [])
    .map((image: Record<string, any>) => (image.custom_url
        ? assetUrl(normalizeModulePath(image.custom_url, props.configKey))
        : image.url))
    .filter(Boolean)
    .slice(0, 9));
</script>

<template>
    <div class="card-item">
        <div class="item-head">
            <!-- 原创/转载/置顶标识：放标题左边，与标题的对比更强 -->
            <n-tag
                v-for="label in blogLabels(props.item)"
                :key="label"
                size="small"
                :bordered="false"
                :type="blogLabelType(label)"
            >{{ label }}</n-tag>
            <n-tag v-if="props.item.category" size="small" :bordered="false">{{ props.item.category }}</n-tag>
            <n-button text class="item-title" @click="emit('open', props.item)">
                {{ props.item.title || props.item.custom_title || '（无标题）' }}
            </n-button>
            <n-tag v-if="props.item.private" size="small" :bordered="false" type="warning">私密</n-tag>
        </div>
        <div class="item-meta">
            <span :title="timeTitle">{{ displayTime }}</span>
            <span>赞 {{ props.item.likeTotal || 0 }}</span>
            <span>评论 {{ itemComments(props.item).length }}</span>
            <span>阅读 {{ props.item.custom_visitor?.viewCount || props.item.readNum || 0 }}</span>
        </div>
        <template v-if="props.viewType !== '0'">
            <div
                v-if="abstractImages.length > 0"
                class="item-images"
                @click="emit('open', props.item)"
            >
                <img
                    v-for="(src, index) in abstractImages"
                    :key="index"
                    :src="src"
                    loading="lazy" decoding="async"
                />
            </div>
            <div class="item-abstract" v-html="abstractHtml" />
        </template>
    </div>
</template>

<style scoped>
.item-head {
    display: flex;
    align-items: center;
    gap: 10px;
}
.item-title {
    font-size: 15px;
    font-weight: 600;
    /* 关键：min-width:0 允许 flex 收缩（否则长内容把标题撑出列边界）；
       flex:1 让标题流动填满标签后的剩余行宽，文字超长才在剩余空间内断行 */
    flex: 1 1 auto;
    min-width: 0;
    /* naive 的居中在 button 自身（.n-button { justify-content: center }），
       不是内部 content——必须覆盖 button，否则 flex:1 占满行后文字仍居中 */
    justify-content: flex-start;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
    text-align: left;
}
/* n-button 默认不换行，长标题下强制恢复 */
.item-title :deep(.n-button__content) {
    white-space: normal;
    text-align: left;
    /* 标题 flex:1 占满整行后，naive 按钮内容默认居中会显形——强制靠左 */
    justify-content: flex-start;
}
.item-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 12px;
}
.item-abstract {
    margin: 8px 0 0;
    color: var(--text-secondary);
    line-height: 1.7;
    /* 摘要是备份下来的 HTML，长度不可控，限高以免列表被单篇占满 */
    max-height: 96px;
    overflow: hidden;
    word-break: break-word;
}
.item-abstract :deep(img) {
    max-width: 100%;
    max-height: 80px;
}
/* 摘要视图的配图：一行缩略图，点击进详情 */
.item-images {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    cursor: pointer;
}
.item-images img {
    width: 96px;
    height: 96px;
    object-fit: cover;
    border-radius: 3px;
}
</style>
