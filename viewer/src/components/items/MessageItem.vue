<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NModal, NTag } from 'naive-ui';
import { formatTime } from '../../data/format';
import {
    commentReplies,
    commentUser,
    externalVideoUrl,
    imageUrl,
    isExternalVideo,
    itemComments,
    locationOf,
    messageEffectiveTime,
    messagePublishTime,
    messageSource,
    videoPoster,
    videoUrl,
} from '../../data/content';
import { formatMessageContent } from '../../data/richText';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskedUserLabel } from '../../data/mask';
import CommentList from '../CommentList.vue';
const { hidden: hideSensitive } = usePrivacy();
import ItemStats from '../ItemStats.vue';
import UserAvatar from '../UserAvatar.vue';
import UserLink from '../UserLink.vue';
import MediaGrid from '../MediaGrid.vue';
import type { MediaItem } from '../../data/media';

/**
 * 单条说说
 *
 * 从说说列表页抽出来独立成组件，好让个人中心的「那年今日」直接复用同一套渲染，
 * 而不是另写一份简化版——两份渲染必然会渐渐长歪。
 */
const props = defineProps<{
    item: Record<string, any>;
    /** 详情页传入：评论全部直接内嵌展开，不走「>15 弹窗」规则 */
    expandComments?: boolean;
}>();

/** 展示时间：有修改时间优先显示修改时间，否则发表时间 */
const displayTime = computed(() => formatTime(messageEffectiveTime(props.item)));
/** 有修改时间时，悬浮提示实际发表时间 */
const timeTitle = computed(() => (
    props.item.lastmodify ? '发表时间：' + formatTime(messagePublishTime(props.item)) : ''
));

/** 评论内嵌阈值：不超过该数直接全展开，超过则只内嵌前几条 + 「查看更多」弹窗；详情页（expandComments）全展开 */
const COMMENT_LIMIT = 15;
const commentList = computed(() => itemComments(props.item));
const inlineComments = computed(() => (
    props.expandComments || commentList.value.length <= COMMENT_LIMIT
        ? commentList.value
        : commentList.value.slice(0, COMMENT_LIMIT)
));
const showAllComments = ref(false);

/** 地址/来源/机型任一存在时才渲染 meta 行，避免空行占位 */
const hasMeta = computed(() => (
    !!locationOf(props.item) || !!messageSource(props.item) || !!props.item.source_name
));

/**
 * 某张图片/视频自己的评论
 * 空间里可以单独评论某张图，这类评论仍存在说说的评论里，靠 targetImage.id 与媒体的
 * pic_id / video_id 对应（旧实现见 src/export/js/common.js 的 handleCommentBomEvent）。
 * 旧实现只取第一条命中的评论，这里改为取全部命中项，否则同一张图的多条评论会丢。
 */
function mediaComments(item: Record<string, any>, mediaId?: string | number): Record<string, any>[] {
    if (!mediaId) {
        return [];
    }
    return itemComments(item).filter((comment) => comment.targetImage && comment.targetImage.id === mediaId);
}

/** 视频项：外部视频（腾讯视频等）没有本地文件，改为点封面跳原站 */
function videoMedia(item: Record<string, any>, video: Record<string, any>): MediaItem {
    const comments = mediaComments(item, video.video_id);
    if (isExternalVideo(video)) {
        return {
            type: 'video',
            src: videoPoster(video),
            poster: videoPoster(video),
            link: externalVideoUrl(video),
            comments,
        };
    }
    return { type: 'video', src: videoUrl(video), poster: videoPoster(video), comments };
}

/** 说说的媒体：视频与图片（图片项本身也可能是视频） */
function mediasOf(item: Record<string, any>): MediaItem[] {
    const medias: MediaItem[] = [];
    for (const video of item.custom_videos || []) {
        medias.push(videoMedia(item, video));
    }
    for (const image of item.custom_images || []) {
        if (image.is_video && image.video_info) {
            medias.push(videoMedia(item, image.video_info));
            continue;
        }
        medias.push({
            type: 'image',
            src: imageUrl(image),
            comments: mediaComments(item, image.pic_id),
        });
    }
    for (const magic of item.custom_magics || []) {
        medias.push({ type: 'image', src: imageUrl(magic) });
    }
    return medias.filter((media) => !!media.src);
}
</script>

<template>
    <div class="card-item">
        <div class="item-head">
            <user-avatar :uin="props.item.uin" :size="32" :class="{ 'privacy-blur': hideSensitive }" />
            <span class="item-name">{{ hideSensitive
                ? maskedUserLabel({ uin: props.item.uin, name: props.item.nickname || props.item.name })
                : (props.item.nickname || props.item.name || props.item.uin) }}</span>
            <span class="item-time" :title="timeTitle">
                {{ displayTime }}
            </span>
            <n-tag v-if="props.item.private" size="small" :bordered="false" type="warning">私密</n-tag>
        </div>

        <!-- 正文含表情/@/话题等 token，需先转为富文本再渲染 -->
        <div class="item-content" v-html="formatMessageContent(props.item)" />

        <div v-if="props.item.rt_tid" class="forward">
        <div class="forward-name">
            <user-link :uin="props.item.rt_uin">
                {{ hideSensitive
                    ? maskedUserLabel({ uin: props.item.rt_uin, name: props.item.rt_uinname })
                    : props.item.rt_uinname }}
            </user-link>：
        </div>
            <div class="item-content" v-html="formatMessageContent(props.item.rt_con || {})" />
        </div>

        <media-grid :medias="mediasOf(props.item)" :comments="itemComments(props.item)" nine-grid />

        <!-- 赞/浏览名单：可点开看名单 -->
        <item-stats :item="props.item" :show-comments="false" />
        <!-- 地址/来源/机型：同 QQ 空间原生布局放在赞/浏览下方单独一行，移动端头部更宽松 -->
        <div v-if="hasMeta" class="item-meta">
            <n-tag v-if="locationOf(props.item)" size="small" :bordered="false" type="info">
                {{ locationOf(props.item) }}
            </n-tag>
            <!-- 来源标识（微信朋友圈/朋友网），旧页同样会标出 -->
            <n-tag
                v-if="messageSource(props.item)"
                size="small"
                :bordered="false"
                :type="messageSource(props.item) === '微信朋友圈' ? 'success' : 'default'"
            >{{ messageSource(props.item) }}</n-tag>
            <span v-if="props.item.source_name" class="item-source">{{ props.item.source_name }}</span>
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
    margin-bottom: 8px;
}
/* 发表时间是辅助信息，不加粗（加粗后比正文还跳） */
.item-time {
    color: var(--text-muted);
    font-size: 12px;
}
.item-name {
    color: #2080f0;
    font-weight: 600;
}
/* 发布渠道（如“手机QQ空间”）弱化展示 */
.item-source {
    color: var(--text-muted);
    font-size: 12px;
}
/* 地址/来源/机型：赞/浏览下方单独一行，窄屏自动换行 */
.item-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
}
/* 说说正文保留换行与空格，与空间原样式一致 */
.item-content {
    margin: 0;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
}
.forward {
    margin-top: 10px;
    padding: 8px 10px;
    background: var(--bg-toolbar);
    border-left: 3px solid var(--border-dashed);
}
.forward-name {
    color: #2080f0;
    margin-bottom: 4px;
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
