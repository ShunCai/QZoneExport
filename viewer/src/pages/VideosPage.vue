<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { loadList } from '../data/sources';
import { itemComments, likeTotal, locationOf } from '../data/content';
import { timeValue } from '../data/format';
import { useGridColumns } from '../data/gridColumns';
import { routeQuery } from '../router';
import ListPage from '../components/ListPage.vue';
import MediaGrid from '../components/MediaGrid.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import VideoItem from '../components/items/VideoItem.vue';
import { videoMediaOf, videoTimeOf, videoUploadTime } from '../data/media';

/**
 * 视频列表（数据来自 Videos/json/videos.js）
 *
 * 与相册内页同一套展示：只摆封面缩略图（不直接渲染视频，否则一页几十个
 * video 标签极耗资源）；封面上叠赞与评论数，点封面弹出带评论的播放窗，
 * 外部视频（腾讯视频/Flash）点封面跳原站。视频多时按页翻（一页 60 个）。
 */
const loading = ref(true);
const list = ref<Record<string, any>[]>([]);

onMounted(async () => {
    list.value = await loadList('videos');
    loading.value = false;
});

/**
 * 视频时间：拍摄时间优先，其次上传时间
 * 它与单条视频→媒体项的拼装（videoMediaOf）都在 data/media.ts，与个人中心共用。
 */
const timeOf = videoTimeOf;

/** 排序字段：上传时间（默认）/ 拍摄时间（兜底上传）/ 点赞 / 评论，均可升降序 */
const sorts = [
    { label: '上传时间', value: 'upload', valueOf: (item: Record<string, any>) => timeValue(videoUploadTime(item)) },
    { label: '拍摄时间', value: 'shoot', valueOf: (item: Record<string, any>) => timeValue(videoTimeOf(item)) },
    { label: '点赞数', value: 'like', valueOf: (item: Record<string, any>) => likeTotal(item) },
    { label: '评论数', value: 'comment', valueOf: (item: Record<string, any>) => itemComments(item).length },
];

/** 网格容器（屏宽不同每行列数不同），按列数让每页条数取整数倍，保证最后一行铺满 */
const gridWrap = ref<HTMLElement | null>(null);
const gridColumns = useGridColumns(gridWrap, 220, 8);
const pageSize = computed(() => Math.max(1, Math.round(60 / gridColumns.value)) * gridColumns.value);
</script>

<template>
    <list-page
        title="视频"
        :pref-key="'videos'"
        :items="list"
        :focus-item="(video: Record<string, any>) => !!routeQuery.vid && String(video.vid || video.uniKey || '') === routeQuery.vid"
        :loading="loading"
        empty-hint="暂无视频内容（本次备份可能未包含视频模块）"
        unit="个"
        :page-size="pageSize"
        :time-of="timeOf"
        sort-label="拍摄时间"
        :sorts="sorts"
        :text-of="(item) => [item.name, item.desc, locationOf(item)].filter(Boolean).join(' ')"
        :comments-of="(item: Record<string, any>) => itemComments(item).flatMap((comment: Record<string, any>) => [String(comment.content || ''), ...((comment.replyList || []) as Record<string, any>[]).map((reply: Record<string, any>) => String(reply.content || ''))]).filter(Boolean)"
    >
        <!-- 那年今日（按上传时间算） -->
        <template #lead>
            <that-year-today
                :items="list"
                :time-of="timeOf"
            >
                <template #item="{ item }">
                    <video-item :item="item" />
                </template>
            </that-year-today>
        </template>

        <template #default="{ items, paginate }">
            <div ref="gridWrap">
                <media-grid
                    :medias="items.map(videoMediaOf)"
                    :masonry="!paginate"
                    :item-width="220"
                    :open-key="routeQuery.vid"
                    :highlight-comment="routeQuery.comment"
                />
            </div>
        </template>
    </list-page>
</template>
