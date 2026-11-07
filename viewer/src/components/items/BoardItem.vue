<script setup lang="ts">
import { formatTime } from '../../data/format';
import { commentUser, decodeHtml, fixHtmlAssets } from '../../data/content';
import { formatHtmlContent, formatNickname } from '../../data/richText';
import { displayName } from '../../data/friendNames';
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

/**
 * 展示名（HTML）：昵称里可能内嵌 `[em]e258151[/em]`，与正文同一套转换。
 * 隐私态先脱敏（脱敏结果已是纯文本），再交给同一函数 —— 两种情况都安全。
 */
function nameOf(name: unknown, uin: unknown): string {
    const label = hideSensitive.value
        ? maskedNameOf(name, uin)
        : displayName(uin as any, name as any);
    return formatNickname(String(label ?? ''));
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
            <span class="item-name" v-html="nameOf(props.item.nickname || props.item.name, props.item.uin)"></span>
            <span class="item-time">{{ formatTime(props.item.pubtime || props.item.pubTime) }}</span>
        </div>
        <div class="item-content" v-html="contentOf(props.item)" />

        <div v-for="(reply, replyIndex) in props.item.replyList || []" :key="replyIndex" class="reply">
            <div class="item-head">
                <user-avatar :uin="commentUser(reply).uin" :size="26" :class="{ 'privacy-blur': hideSensitive }" />
                <span class="item-name" v-html="nameOf(commentUser(reply).name, commentUser(reply).uin)"></span>
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
