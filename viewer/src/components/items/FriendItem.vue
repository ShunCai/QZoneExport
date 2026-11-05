<script setup lang="ts">
import { NTag } from 'naive-ui';
import { formatDay } from '../../data/format';
import { formatSummary } from '../../data/richText';
import {
    friendCommonCount,
    friendDisplayName,
    friendNick,
} from '../../data/content';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskName, maskUin, plainName } from '../../data/mask';
import UserAvatar from '../UserAvatar.vue';

/**
 * 单个好友卡片
 * 好友列表页的卡片视图与个人中心的那年今日（相识纪念日）共用同一套。
 */
const props = defineProps<{ item: Record<string, any> }>();

const { hidden: hideSensitive } = usePrivacy();

/**
 * 隐私态下的展示名：名字里可能带 [em]e100[/em] 表情 token 或 HTML，
 * 必须先剥成纯文本再按字符脱敏，否则会把 [em] 当字符切开、切出乱码。
 * 代价是脱敏态下名字里的表情图不显示——本来也要模糊掉身份，可接受。
 */
function maskDisplayName(raw: string): string {
    // 先剥掉表情 token / HTML 标签再按字符脱敏（否则 [em] 会被当成字符切开）
    return maskName(plainName(raw));
}
function maskedDisplayName(item: Record<string, any>): string {
    return maskDisplayName(String(friendDisplayName(item) ?? ''));
}
function maskedNick(item: Record<string, any>): string {
    return maskDisplayName(String(friendNick(item) ?? ''));
}
</script>

<template>
    <div class="friend">
        <user-avatar :uin="props.item.uin" :size="44" :class="{ 'privacy-blur': hideSensitive }" />
        <div class="friend-main">
            <div class="friend-name">
                <span v-if="hideSensitive">{{ maskedDisplayName(props.item) }}</span>
                <span v-else v-html="formatSummary(friendDisplayName(props.item))"></span>
                <n-tag v-if="props.item.care" size="tiny" :bordered="false" type="warning">特别关心</n-tag>
                <n-tag v-if="props.item.isFriend === 0" size="tiny" :bordered="false">已不是好友</n-tag>
                <n-tag v-if="props.item.access === false" size="tiny" :bordered="false" type="error">无权限</n-tag>
                <n-tag v-else-if="props.item.access === true" size="tiny" :bordered="false" type="success">可访问</n-tag>
            </div>
            <!-- 有备注时主名显示的是备注，昵称在此补上，否则看不到对方叫什么 -->
            <div v-if="props.item.remark && friendNick(props.item)" class="friend-nick">
                昵称：<span v-if="hideSensitive">{{ maskedNick(props.item) }}</span>
                <span v-else v-html="formatSummary(friendNick(props.item))"></span>
            </div>
            <div class="friend-meta">
                <span>{{ hideSensitive ? maskUin(props.item.uin) : props.item.uin }}</span>
                <span>{{ props.item.groupName || '未分组' }}</span>
                <span v-if="props.item.addFriendTime">相识于 {{ formatDay(props.item.addFriendTime) }}</span>
                <span v-if="props.item.intimacyScore">亲密度 {{ props.item.intimacyScore }}</span>
                <span v-if="friendCommonCount(props.item)">共同好友 {{ friendCommonCount(props.item) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 卡片边界与其它模块的 .card-item 保持一致（网格布局不能直接用它的 margin） */
.friend {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    height: 100%;
    box-sizing: border-box;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.friend:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
}
.friend-main {
    min-width: 0;
    flex: 1;
}
.friend-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
}
.friend-nick {
    margin-top: 2px;
    color: var(--text-secondary);
    font-size: 12px;
}
.friend-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 12px;
}
</style>
