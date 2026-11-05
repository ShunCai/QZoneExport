<script setup lang="ts">
import { ref } from 'vue';
import { NTag } from 'naive-ui';
import { formatTime } from '../data/format';
import { imageUrl } from '../data/content';
import { formatText } from '../data/richText';
import { openImageLightbox } from '../data/lightbox';
import { usePrivacy } from '../composables/usePrivacy';
import { maskedUserLabel } from '../data/mask';
import UserAvatar from './UserAvatar.vue';

const { hidden: hideSensitive } = usePrivacy();

/**
 * 评论列表（含一层回复）
 * 取发表人与回复列表的方式由调用方传入，因为各模块字段名不完全一致
 */
const props = defineProps<{
    comments: Record<string, any>[];
    userOf: (comment: Record<string, any>) => { uin?: string | number; name?: string };
    repliesOf: (comment: Record<string, any>) => Record<string, any>[];
    /** 标题显示的总数；内嵌只展示部分时传入完整总数 */
    total?: number;
}>();

/** 根节点 ref：用于收集本列表内全部评论配图，组成可左右切换的画廊 */
const root = ref<HTMLElement | null>(null);

/**
 * 评论/回复配图点击看大图
 * 收集当前评论列表里所有配图（评论 + 回复），点击哪张就从哪张打开。
 */
function onCommentImageClick(event: MouseEvent): void {
    const img = (event.target as HTMLElement).closest('img') as HTMLImageElement | null;
    if (!img || !root.value) {
        return;
    }
    const imgs = Array.from(root.value.querySelectorAll('.comment-pics img')) as HTMLImageElement[];
    const index = Math.max(imgs.indexOf(img), 0);
    void openImageLightbox(
        imgs.map((el) => ({ src: el.getAttribute('src') || el.src })),
        index,
    );
}
</script>

<template>
    <div v-if="props.comments.length > 0" class="comments" ref="root">
        <div class="comments-title">评论 {{ props.total ?? props.comments.length }}</div>
        <div v-for="(comment, index) in props.comments" :key="index" class="comment">
            <user-avatar
                :uin="props.userOf(comment).uin"
                :size="32"
                :class="['comment-avatar', { 'privacy-blur': hideSensitive }]"
            />
            <div class="comment-main">
                <div class="comment-head">
                    <span class="comment-name">{{ hideSensitive
                        ? maskedUserLabel(props.userOf(comment))
                        : (props.userOf(comment).name || props.userOf(comment).uin) }}</span>
                    <n-tag v-if="comment.private" size="tiny" :bordered="false" type="warning">私密</n-tag>
                    <span class="comment-time">{{ formatTime(comment.postTime || comment.create_time) }}</span>
                </div>
                <div class="comment-text" v-html="formatText(comment.content)" />
                <div v-if="comment.pic && comment.pic.length" class="comment-pics">
                    <img v-for="(pic, picIndex) in comment.pic" :key="picIndex" :src="imageUrl(pic)" loading="lazy" @click="onCommentImageClick" />
                </div>

                <div
                    v-for="(reply, replyIndex) in props.repliesOf(comment)"
                    :key="replyIndex"
                    class="comment reply"
                >
                    <user-avatar
                        :uin="props.userOf(reply).uin"
                        :size="26"
                        :class="['comment-avatar', { 'privacy-blur': hideSensitive }]"
                    />
                    <div class="comment-main">
                        <div class="comment-head">
                            <span class="comment-name">{{ hideSensitive
                                ? maskedUserLabel(props.userOf(reply))
                                : (props.userOf(reply).name || props.userOf(reply).uin) }}</span>
                            <n-tag v-if="reply.private" size="tiny" :bordered="false" type="warning">私密</n-tag>
                            <span class="comment-time">{{ formatTime(reply.postTime || reply.create_time) }}</span>
                        </div>
                        <div class="comment-text" v-html="formatText(reply.content)" />
                        <div v-if="reply.pic && reply.pic.length" class="comment-pics">
                            <img v-for="(pic, picIndex) in reply.pic" :key="picIndex" :src="imageUrl(pic)" loading="lazy" @click="onCommentImageClick" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.comments {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-light);
}
.comments-title {
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--text-muted);
}
.comment {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
}
.comment-avatar {
    margin-top: 2px;
}
.comment-main {
    flex: 1;
    min-width: 0;
}
.comment-head {
    display: flex;
    align-items: center;
    gap: 8px;
}
.comment-name {
    color: var(--accent);
    font-size: 13px;
}
.comment-time {
    color: var(--text-subtle);
    font-size: 12px;
}
.comment-text {
    margin: 2px 0 0;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}
.comment-pics img {
    width: 90px;
    height: 90px;
    object-fit: cover;
    margin: 6px 6px 0 0;
    border: 1px solid var(--border-light);
    cursor: zoom-in;
}
/* 回复缩进一层，层级与空间一致 */
.reply {
    margin: 8px 0 0;
    padding-left: 10px;
    border-left: 2px solid var(--border-light);
}
</style>
