<script setup lang="ts">
import { computed, ref } from 'vue';
import { NModal } from 'naive-ui';
import {
    commentReplies,
    commentUser,
    itemComments,
    likeTotal,
    likeUsers,
    viewCount,
    visitorUsers,
} from '../data/content';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 模板中 <comment-list> 使用
import CommentList from './CommentList.vue';
import UserList from './UserList.vue';

/**
 * 记录的赞 / 评论 / 浏览统计条
 * 与旧页面一致：数字可点击，点开弹出明细名单（旧实现是 export/js/common.js 的
 * showLikeWin / showCommentsWin / showVisitorsWin + Bootstrap 模态框）。
 */
const props = withDefaults(defineProps<{
    item: Record<string, any>;
    /** 评论数据可由调用方指定（如相片评论与说说评论是两份数据） */
    comments?: Record<string, any>[];
    /** 部分模块（相片、留言）没有浏览量 */
    showViews?: boolean;
    /** 评论已在列表里展开显示时，不必再给一个弹窗入口 */
    showComments?: boolean;
}>(), { showViews: true, showComments: true });

const likes = computed(() => likeUsers(props.item));
const likeCount = computed(() => likeTotal(props.item));
const commentList = computed(() => props.comments ?? itemComments(props.item));
const visitors = computed(() => visitorUsers(props.item));
const views = computed(() => viewCount(props.item));

const showLikes = ref(false);
const showCommentsModal = ref(false);
const showVisitors = ref(false);
</script>

<template>
    <div class="stats">
        <span v-if="likeCount > 0" class="stat" @click="showLikes = true">赞 {{ likeCount }}</span>
        <span v-if="props.showComments && commentList.length > 0" class="stat" @click="showCommentsModal = true">
            评论 {{ commentList.length }}
        </span>
        <span v-if="props.showViews && views > 0" class="stat" @click="showVisitors = true">
            浏览 {{ views }}
        </span>

        <n-modal v-model:show="showLikes" preset="card" title="点赞" style="width: 460px;">
            <!-- 名单可能少于总数：接口只返回前若干个点赞人 -->
            <p v-if="likes.length < likeCount" class="modal-note">
                共 {{ likeCount }} 人点赞，备份到 {{ likes.length }} 人的名单
            </p>
            <div class="users-modal-body">
                <user-list :users="likes" empty-text="没有点赞名单" />
            </div>
        </n-modal>

        <n-modal v-model:show="showCommentsModal" preset="card" title="评论" style="width: 620px;">
            <div class="comments-modal-body">
                <comment-list :comments="commentList" :user-of="commentUser" :replies-of="commentReplies" />
            </div>
        </n-modal>

        <n-modal v-model:show="showVisitors" preset="card" title="最近访问" style="width: 460px;">
            <p v-if="visitors.length < views" class="modal-note">
                共 {{ views }} 次浏览，备份到 {{ visitors.length }} 人的名单
            </p>
            <div class="users-modal-body">
                <user-list :users="visitors" empty-text="没有访问名单" />
            </div>
        </n-modal>
    </div>
</template>

<style scoped>
.stats {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary);
}

.stat {
    cursor: pointer;
}

.stat:hover {
    color: #2080f0;
}

.modal-note {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--text-muted);
}
/* 评论弹窗内容限高可滚，避免评论多时弹窗被撑得看不到头 */
.comments-modal-body {
    max-height: 60vh;
    overflow-y: auto;
}
/* 点赞 / 最近访问弹窗同款限高：名单长时内部滚动，弹窗不被撑出屏幕 */
.users-modal-body {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
