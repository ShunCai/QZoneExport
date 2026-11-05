<script setup lang="ts">
import { formatTime } from '../../data/format';
import { commentUser, decodeHtml, fixHtmlAssets } from '../../data/content';
import { formatHtmlContent } from '../../data/richText';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskName, maskUin, plainName } from '../../data/mask';
import UserAvatar from '../UserAvatar.vue';

/**
 * 单条留言（含回复）
 * 抽出来供留言列表页与个人中心的那年今日共用。
 */
const props = defineProps<{ item: Record<string, any> }>();

const { hidden: hideSensitive } = usePrivacy();

/** 隐私态展示名：剥掉表情 token / HTML 后脱敏；没有昵称时退回打码 QQ，而不是露出原号 */
function maskedNameOf(name: unknown, uin: unknown): string {
    return maskName(plainName(String(name ?? ''))) || maskUin(String(uin ?? ''));
}

/** 正文：htmlContent 已是 HTML，content 是纯文本，两者取其一；均需 token 转换（表情/@提及） */
function contentOf(item: Record<string, any>): string {
    const raw = item.htmlContent || decodeHtml(item.custom_html) || item.content || '';
    return fixHtmlAssets(formatHtmlContent(raw), 'Boards');
}
</script>

<template>
    <div class="card-item">
        <div class="item-head">
            <user-avatar :uin="props.item.uin" :size="32" :class="{ 'privacy-blur': hideSensitive }" />
            <span class="item-name">{{ hideSensitive
                ? maskedNameOf(props.item.nickname || props.item.name, props.item.uin)
                : (props.item.nickname || props.item.name || props.item.uin) }}</span>
            <span class="item-time">{{ formatTime(props.item.pubtime || props.item.pubTime) }}</span>
        </div>
        <div class="item-content" v-html="contentOf(props.item)" />

        <div v-for="(reply, replyIndex) in props.item.replyList || []" :key="replyIndex" class="reply">
            <div class="item-head">
                <user-avatar :uin="commentUser(reply).uin" :size="26" :class="{ 'privacy-blur': hideSensitive }" />
                <span class="item-name">{{ hideSensitive
                    ? maskedNameOf(commentUser(reply).name, commentUser(reply).uin)
                    : (commentUser(reply).name || commentUser(reply).uin) }}</span>
                <span class="item-time">{{ formatTime(reply.time || reply.pubtime) }}</span>
            </div>
            <div class="item-content" v-html="fixHtmlAssets(formatHtmlContent(reply.htmlContent || reply.content || ''), 'Boards')" />
        </div>
    </div>
</template>

<style scoped>
.item-head {
    display: flex;
    align-items: center;
    gap: 10px;
}
.item-name {
    color: #2080f0;
    font-weight: 600;
}
.item-time {
    color: var(--text-muted);
    font-size: 12px;
}
.item-content {
    margin-top: 6px;
    line-height: 1.7;
    word-break: break-word;
}
.item-content :deep(img) {
    max-width: 120px;
    max-height: 120px;
    vertical-align: middle;
}
/* 回复缩进一层，与空间层级一致 */
.reply {
    margin: 8px 0 0 18px;
    padding-left: 10px;
    border-left: 2px solid var(--border-separator);
}
</style>
