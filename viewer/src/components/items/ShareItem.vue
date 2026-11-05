<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NModal, NTag } from 'naive-ui';
import { formatTime } from '../../data/format';
import { commentReplies, commentUser, imageUrl, itemComments, locationOf, messageSource, shareFromInfo, shareTypeLabel } from '../../data/content';
import { formatText } from '../../data/richText';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskedUserLabel } from '../../data/mask';
import CommentList from '../CommentList.vue';
const { hidden: hideSensitive } = usePrivacy();
import ItemStats from '../ItemStats.vue';
import UserAvatar from '../UserAvatar.vue';
import MediaGrid from '../MediaGrid.vue';

/**
 * 单条分享
 * 抽出来供分享列表页与个人中心的那年今日共用。
 */
const props = defineProps<{
    item: Record<string, any>;
    /** 详情页传入：评论全部直接内嵌展开，不走「>15 弹窗」规则 */
    expandComments?: boolean;
}>();

/** 评论内嵌阈值：不超过该数直接全展开，超过则只内嵌前几条 + 「查看更多」弹窗；详情页（expandComments）全展开 */
const COMMENT_LIMIT = 15;
const commentList = computed(() => itemComments(props.item));
const inlineComments = computed(() => (
    props.expandComments || commentList.value.length <= COMMENT_LIMIT
        ? commentList.value
        : commentList.value.slice(0, COMMENT_LIMIT)
));
const showAllComments = ref(false);

/** 分享元数据（坐标 / 来源标签 / 设备渠道名）——与说说 MessageItem 结构保持一致，保证旧版显示效果重现 */
const hasMeta = computed(() => (
    !!locationOf(props.item)
    || !!messageSource(props.item)
    || !!props.item.source_name
    || !!props.item.custom_source_name
));

/** 分享类型徽章（显示在昵称右侧，与旧版 API.Shares.getDisplayType 一致） */
const shareType = computed(() => shareTypeLabel(props.item));

/** 分享源「来源信息」（严格复用旧版结构：source.from.name / source.from.url / source.count 三个字段 */
const sourceFrom = computed(() => shareFromInfo(props.item));
const hasSourceFrom = computed(() => !!sourceFrom.value.name || sourceFrom.value.count > 0);

/** 被分享内容的图片 */
function mediasOf(item: Record<string, any>): { type: 'image' | 'video'; src: string }[] {
    const images = item.source?.images || item.custom_images || [];
    return images
        .map((image: Record<string, any>) => ({ type: 'image' as const, src: imageUrl(image) }))
        .filter((media: { src: string }) => !!media.src);
}
</script>

<template>
    <div class="card-item">
        <div class="item-head">
            <user-avatar :uin="props.item.uin" :size="32" :class="{ 'privacy-blur': hideSensitive }" />
            <span class="item-name">{{ hideSensitive
                ? maskedUserLabel({ uin: props.item.uin, name: props.item.nickname })
                : (props.item.nickname || props.item.uin) }}</span>
            <span class="share-type-badge" title="分享类型">
                分享了
                <n-tag size="small" :bordered="false" type="warning" round>
                    {{ shareType }}
                </n-tag>
            </span>
            <span class="item-time">
                {{ formatTime(props.item.shareTime || props.item.custom_create_time) }}
            </span>
        </div>

        <div v-if="props.item.desc" class="item-desc" v-html="formatText(props.item.desc)" />

        <div v-if="props.item.source" class="source">
            <a
                v-if="props.item.source.title"
                class="source-title"
                :href="props.item.source.url"
                target="_blank"
                rel="noreferrer"
            >{{ props.item.source.title }}</a>
            <div v-if="props.item.source.desc" class="source-desc" v-html="formatText(props.item.source.desc)" />
            <media-grid :medias="mediasOf(props.item)" :comments="itemComments(props.item)" nine-grid />
        </div>

        <!-- 分享来源（被分享内容来自哪里/共分享多少次）——严格对齐旧版 blockquote.source 下方的 list-group 行 -->
        <div v-if="hasSourceFrom" class="source-from">
            <span v-if="sourceFrom.name" class="source-from-name">
                来自
                <a
                    v-if="sourceFrom.url"
                    class="source-from-link"
                    :href="sourceFrom.url"
                    target="_blank"
                    rel="noreferrer"
                >{{ sourceFrom.name }}</a>
                <template v-else>{{ sourceFrom.name }}</template>
                <template v-if="sourceFrom.count > 0"> &nbsp; </template>
            </span>
            <span v-if="sourceFrom.count > 0" class="source-from-count">
                共分享 {{ sourceFrom.count }} 次
            </span>
        </div>

        <!-- 赞/浏览名单：可点开看名单 -->
        <item-stats :item="props.item" :show-comments="false" />
        
        <!-- 分享元信息：位置标签 + 分享来源渠道标签（消息来源/朋友网来源） + 设备名称 -->
        <div v-if="hasMeta" class="item-meta">
            <n-tag
                v-if="locationOf(props.item)"
                size="small"
                :bordered="false"
                type="info"
                round
            >
                📍 {{ locationOf(props.item) }}
            </n-tag>
            <n-tag
                v-else-if="messageSource(props.item) === '微信朋友圈'"
                size="small"
                :bordered="false"
                type="success"
            >
                💬 来自微信朋友圈
            </n-tag>
            <n-tag
                v-else-if="messageSource(props.item) === '朋友网'"
                size="small"
                :bordered="false"
                type="default"
            >
                🕸️ 来自朋友网
            </n-tag>
            <span v-if="props.item.source_name || props.item.custom_source_name" class="item-source">
                📱 {{ props.item.source_name || props.item.custom_source_name }}
            </span>
        </div>

        <!-- 评论：详情页全展开；列表页 ≤15 条直接内嵌，>15 条内嵌前 15 条 + 「查看更多」弹窗 -->
        <template v-if="commentList.length > 0">
            <comment-list
                :comments="inlineComments"
                :total="commentList.length"
                :user-of="commentUser"
                :replies-of="commentReplies"
            />
            <div v-if="!props.expandComments && commentList.length > COMMENT_LIMIT" class="comments-more">
                <n-button text type="primary" @click="showAllComments = true">
                    查看更多（共 {{ commentList.length }} 条）
                </n-button>
            </div>
            <n-modal v-model:show="showAllComments" preset="card" title="评论" style="width: 620px;">
                <div class="comments-modal-body">
                    <comment-list :comments="commentList" :user-of="commentUser" :replies-of="commentReplies" />
                </div>
            </n-modal>
        </template>
    </div>
</template>

<style scoped>
.item-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.item-name {
    color: #2080f0;
    font-weight: 600;
    flex: none;
}
.share-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    flex: none;
}
.item-time {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 12px;
}
/* 被分享的内容引用块：来源行（旧版 list-group-flush 位置）
 * 与上方 .source 引用块保持对齐：左边框位置、内容左内边距完全一致 */
.source-from {
    margin-top: -2px;
    padding: 2px 10px 8px;
    border-left: 3px solid var(--border-dashed);
    border-bottom-left-radius: 2px;
    background: linear-gradient(180deg, var(--bg-toolbar) 0%, var(--bg-primary) 70%);
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.7;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    row-gap: 2px;
}
.source-from-name,
.source-from-count {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: nowrap;
}
.source-from-link {
    color: #2080f0;
    text-decoration: none;
    margin: 0 2px;
}
.source-from-link:hover {
    text-decoration: underline;
}
/* 分享元信息：赞/浏览下方单独一行，窄屏自动换行 */
.item-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 12px;
}
.item-meta .item-source {
    color: var(--text-secondary);
}
.item-desc {
    margin: 6px 0 0;
    font-family: inherit;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
}
/* 被分享的原内容作为引用块，与说说的转发块保持一致 */
.source {
    margin-top: 10px;
    padding: 8px 10px;
    background: var(--bg-toolbar);
    border-left: 3px solid var(--border-dashed);
}
.source-title {
    color: #2080f0;
    font-weight: 600;
    word-break: break-all;
}
.source-desc {
    margin: 4px 0 0;
    font-family: inherit;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}
.comments-more {
    margin-top: 6px;
    text-align: center;
}
/* 评论弹窗内容限高可滚，避免评论多时弹窗被撑得看不到头 */
.comments-modal-body {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
