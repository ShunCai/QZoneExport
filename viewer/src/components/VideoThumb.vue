<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { MediaItem } from '../data/media';

/**
 * 视频封面（列表/回忆里的缩略图）
 *
 * 为什么不能直接用备份里的封面图：QQ 给的 `custom_pre_filepath` 并不总是有效画面——
 * 实测 485 张封面里有 38 张近乎纯黑（视频开头黑场被当成封面），看起来就像「没渲染预览图」。
 * 本地视频文件是有的，所以这里在进入视口后挂一个 `<video preload="metadata">`，
 * 读取元数据后 seek 到 0.4s 抽出真实首帧，抽到就把封面图换掉。
 *
 * 另外封面是竖屏（9:16）时不再用 cover 硬裁成正方形——裁完只剩中间一条，
 * 文字类视频等于什么都看不见。竖屏改 contain + 黑底，画面完整。
 */
const props = defineProps<{
    media: MediaItem;
    /** 赞/评论角标（有才显示） */
    stats?: { likes?: number; comments?: number };
}>();

const host = ref<HTMLElement | null>(null);
const video = shallowRef<HTMLVideoElement | null>(null);
/** 是否已接近视口：一页几十个视频不能同时解码，先只挂可见的 */
const near = ref(false);
/** 真实首帧是否已抽出 */
const frameReady = ref(false);
/** 封面图是否加载失败（失败就只剩 video 兜底） */
const posterBroken = ref(false);
/** 画面宽高比（封面或视频元数据先到先用） */
const ratio = ref(0);

const poster = computed(() => props.media.poster || '');
const isPortrait = computed(() => ratio.value > 0 && ratio.value < 0.95);
const showPoster = computed(() => !!poster.value && !posterBroken.value && !frameReady.value);

let observer: IntersectionObserver | null = null;
onMounted(() => {
    const el = host.value;
    if (!el || typeof IntersectionObserver === 'undefined') {
        near.value = true;
        return;
    }
    // 提前 400px 挂载：滚到跟前时首帧已经抽好了，不会看到黑块
    observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            near.value = true;
            observer?.disconnect();
            observer = null;
        }
    }, { rootMargin: '400px' });
    observer.observe(el);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
});

function onPosterLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
        ratio.value = img.naturalWidth / img.naturalHeight;
    }
}
function onPosterError(): void {
    posterBroken.value = true;
}

/** 元数据到手：记下真实比例并 seek 出首帧（不能 seek 到 0，很多视频开头是黑场） */
function onLoadedMetadata(): void {
    const el = video.value;
    if (!el) {
        return;
    }
    if (el.videoWidth && el.videoHeight) {
        ratio.value = el.videoWidth / el.videoHeight;
    }
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    const target = duration > 0 ? Math.min(0.4, duration * 0.1) : 0;
    try {
        el.currentTime = target;
    } catch {
        // 个别容器不支持 seek：保持封面图，不影响播放
    }
}
function onSeeked(): void {
    frameReady.value = true;
}
</script>

<template>
    <div
        ref="host"
        class="media media-cover media-playable thumb"
        :class="{ 'thumb-portrait': isPortrait }"
        title="点击播放"
    >
        <!-- 真实首帧：进入视口后才挂载，避免整页视频同时解码 -->
        <video
            v-if="near"
            ref="video"
            class="thumb-frame"
            :src="props.media.src"
            muted
            playsinline
            preload="metadata"
            @loadedmetadata="onLoadedMetadata"
            @seeked="onSeeked"
        />
        <img
            v-if="showPoster"
            class="thumb-frame thumb-poster"
            :src="poster"
            loading="lazy"
            decoding="async"
            @load="onPosterLoad"
            @error="onPosterError"
        />
        <span v-if="!poster && !frameReady" class="thumb-noposter">视频</span>
        <span class="play-badge">▶</span>
        <span v-if="props.stats" class="media-stats">
            <span class="stat-item">赞 {{ props.stats.likes || 0 }}</span>
            <span class="stat-item">评论 {{ props.stats.comments || 0 }}</span>
        </span>
    </div>
</template>

<style scoped>
.thumb-frame {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.thumb-poster {
    position: absolute;
    inset: 0;
}
/* 竖屏封面不硬裁：contain + 深色底，画面完整可辨（裁成方形只剩中间一条） */
.thumb-portrait .thumb-frame {
    object-fit: contain;
    background: #0b0b0d;
}
.thumb-noposter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-subtle);
    font-size: 12px;
}
</style>
