<script setup lang="ts">
import { avatarFallbackUrl, avatarUrl } from '../data/content';
import UserLink from './UserLink.vue';

/**
 * 用户头像
 * 优先用备份里下载好的本地头像（Common/images/{uin}，无扩展名），取不到时回落到在线地址
 * （需联网），仍失败则隐藏，避免出现浏览器的破图图标。
 */
const props = withDefaults(defineProps<{
    uin?: string | number | null;
    size?: number;
    /** 是否可点击跳到对方空间（需联网） */
    link?: boolean;
}>(), { size: 32, link: true });

function onError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = avatarFallbackUrl(props.uin);
    if (fallback && img.src !== fallback) {
        img.src = fallback;
        return;
    }
    img.style.visibility = 'hidden';
}
</script>

<template>
    <user-link v-if="props.link && props.uin" :uin="props.uin" class="avatar">
        <img
            :src="avatarUrl(props.uin)"
            :style="{ width: props.size + 'px', height: props.size + 'px' }"
            alt=""
            loading="lazy" decoding="async"
            @error="onError"
        />
    </user-link>
    <span v-else class="avatar">
        <img
            :src="avatarUrl(props.uin)"
            :style="{ width: props.size + 'px', height: props.size + 'px' }"
            alt=""
            loading="lazy" decoding="async"
            @error="onError"
        />
    </span>
</template>

<style scoped>
.avatar {
    flex: none;
    line-height: 0;
}

.avatar img {
    border-radius: 50%;
    object-fit: cover;
    background: var(--bg-toolbar);
}
</style>
