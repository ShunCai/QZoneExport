<script setup lang="ts">
import { computed } from 'vue';
import { usePrivacy } from '../../composables/usePrivacy';
import { formatNickname } from '../../data/richText';
import { navigate } from '../../router';
import type { MediaStats, TimeRange } from '../../data/counts';
import type { CoverPhoto } from '../../data/covers';
import { maskContent } from '../../data/mask';

const props = defineProps<{
    user: Record<string, any>;
    timeRange: TimeRange;
    totalItems: number;
    media: MediaStats;
    signature: string;
    coverPhotos: CoverPhoto[];
    /** 全站累计互动量：并进同一行 KPI，不再单独占「互动」分组的一行 */
    likes?: number;
    comments?: number;
    views?: number;
}>();

const emit = defineEmits<{ openShare: [] }>();

const { hidden: hideSensitive } = usePrivacy();

/** 互动量上万后位数太长，用「万」压缩；不足一万保留千分位 */
function formatWan(n: number | undefined): string {
    const v = Number(n ?? 0);
    if (v >= 10000) {
        const wan = v / 10000;
        return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')} 万`;
    }
    return v.toLocaleString();
}

/** 不足 9 张时的占位底色，保证九宫格始终填满，不出现空洞 */
const FALLBACK_COLORS = ['#dbe9f8', '#e3eee4', '#f6e7dc', '#eee2f0', '#e6e9ef', '#f3ead9', '#dfe9ee'];

/**
 * 主标题直接用空间名称（QQ 空间自定义标题），不再拼「某某的空间」：
 * 左侧栏已有头像、昵称、QQ 号，Hero 再报一次昵称是重复信息。
 * 没有设置空间名称时才退回昵称。
 */
const title = computed(() => {
    const spaceName = String(props.user?.spacename || '').trim();
    if (spaceName) return spaceName;
    const nickname = String(props.user?.nickname || '').trim();
    return nickname ? `${nickname} 的空间` : 'QQ空间';
});

/** 标题的 HTML：空间名/昵称里可能内嵌 `[em]` 表情 token，与正文同一套转换 */
const titleText = computed(() => title.value);
const titleHtml = computed(() => formatNickname(title.value));

/** 空间描述：用户自己写的一句话，优先于通用引导语 */
const spaceDesc = computed(() => String(props.user?.desc || '').trim());

const covers = computed<CoverPhoto[]>(() => Array.from(
    { length: 9 },
    (_, i) => props.coverPhotos[i] || { thumb: '', remote: '', albumId: '' },
));

/** 点封面进入它所属的相册详情；from=home 让详情页的「← 返回」回到概览页 */
function openAlbum(cover: CoverPhoto): void {
    if (!cover.albumId) return;
    navigate('albums', { id: cover.albumId, from: 'home' });
}
</script>

<template>
    <header class="home-hero">
        <div class="hero-main">
            <!-- 空间名同样可能内嵌 [em] token，与正文同一套转换 -->
            <h1 class="hero-title" v-html="hideSensitive ? maskContent(titleText) : titleHtml"></h1>
            <p class="hero-lead">
                {{ hideSensitive
                    ? maskContent(spaceDesc || '这里收录了这些年在 QQ 空间留下的全部痕迹。慢慢翻，像翻开一本属于你自己的书。')
                    : (spaceDesc || '这里收录了这些年在 QQ 空间留下的全部痕迹。慢慢翻，像翻开一本属于你自己的书。') }}
            </p>

            <div class="hero-signature">
                <span v-if="signature" class="quote">「{{ hideSensitive ? maskContent(signature) : signature }}」</span>
                <span class="hero-actions">
                    <button type="button" class="profile-link" @click="emit('openShare')">分享卡片</button>
                </span>
            </div>

            <div class="hero-kpis">
                <div class="kpi">
                    <div class="v">{{ totalItems.toLocaleString() }}</div>
                    <div class="l">
                        内容条目
                        <span class="info" title="不含相册容器、好友与访客">i</span>
                    </div>
                </div>
                <div class="kpi">
                    <div class="v">{{ media.photos.toLocaleString() }}</div>
                    <div class="l">
                        相片
                        <span class="info" title="不含「说说和日志相册」">i</span>
                    </div>
                </div>
                <div class="kpi">
                    <div class="v">{{ media.videos.toLocaleString() }}</div>
                    <div class="l">视频</div>
                </div>
                <!-- 全站累计互动量：与上面三个内容量并列，语义是「这些东西被看了多少」 -->
                <div class="kpi kpi-shift">
                    <div class="v">{{ formatWan(props.likes) }}</div>
                    <div class="l">累计赞</div>
                </div>
                <div class="kpi">
                    <div class="v">{{ formatWan(props.comments) }}</div>
                    <div class="l">累计评论</div>
                </div>
                <div class="kpi">
                    <div class="v">{{ formatWan(props.views) }}</div>
                    <div class="l">累计浏览<span class="info" title="不含留言与相片；接口无浏览量">i</span></div>
                </div>
            </div>
        </div>

        <div class="hero-media">
            <template v-for="(cover, i) in covers" :key="i">
                <button
                    v-if="cover.thumb"
                    type="button"
                    class="cover-link"
                    :aria-label="`查看第 ${i + 1} 张相片所在的相册`"
                    @click="openAlbum(cover)"
                >
                    <img :src="cover.thumb" :class="{ 'privacy-blur-strong': hideSensitive }" decoding="async" alt="" />
                </button>
                <span v-else class="cover-placeholder" :style="{ background: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }" />
            </template>
        </div>
    </header>
</template>

<style scoped>
.home-hero {
    --serif: Georgia, "Songti SC", "SimSun", serif;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 40px;
    align-items: center;
    /* 时间轴窄条紧跟 Hero，两者之间不留大空隙；与下方区块的间距交给窄条自己 */
    margin-bottom: 0;
}
.hero-title {
    font-family: var(--serif);
    font-size: 36px;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.02em;
    margin: 0 0 8px;
    color: var(--text-primary);
    /* 空间名称可能很长，必须允许换行，不能把九宫格挤出去 */
    overflow-wrap: anywhere;
}
.hero-lead {
    font-size: 13px;
    color: var(--text-muted);
    margin: 12px 0 0;
    max-width: 640px;
}
.hero-signature {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-top: 16px;
    min-height: 20px;
}
.quote {
    font-family: var(--serif);
    font-size: 14px;
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* 操作入口靠右，给宽栏一个视觉落点，不再和引文挤在左端 */
.hero-actions {
    margin-left: auto;
    flex: 0 0 auto;
    display: flex;
    gap: 12px;
}
.profile-link {
    border: none;
    background: transparent;
    font-size: 11px;
    color: var(--text-muted);
    flex: 0 0 auto;
    padding: 0;
    cursor: pointer;
}
.profile-link:hover {
    color: var(--accent-pressed);
}
.hero-kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    border-top: 1px solid var(--border-card);
    border-bottom: 1px solid var(--border-card);
    margin-top: 24px;
}
.kpi {
    padding: 16px 0 16px 20px;
    border-left: 1px solid var(--border-card);
}
.kpi:first-child {
    border-left: none;
    padding-left: 0;
}
/* 前三个是内容量、后三个是互动量：在交界处加一条略深的分隔，避免混成一组数字 */
.kpi.kpi-shift {
    border-left-color: var(--border-separator);
}
.kpi .v {
    /* 不用 --serif：Georgia 的 old-style 数字（3/4/5/7/9 下沉）会让一排数字高低不齐 */
    font-family: inherit;
    font-size: 30px;
    font-weight: 500;
    line-height: 1.1;
    color: var(--accent-pressed);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
}
.kpi .l {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 5px;
}
.info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1px solid var(--border-card);
    border-radius: 50%;
    font-size: 11px;
    line-height: 1;
    color: var(--text-muted);
    margin-left: 4px;
    cursor: help;
    vertical-align: middle;
}
.hero-media {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.cover-link,
.cover-placeholder {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    display: block;
}
.cover-link {
    padding: 0;
    border: none;
    background: transparent;
    overflow: hidden;
    cursor: pointer;
}
.cover-link img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    transition: transform 0.2s;
}
.cover-link:hover img {
    transform: scale(1.05);
}
.cover-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
@media (max-width: 1024px) {
    .home-hero {
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: 24px;
    }
}
@media (max-width: 860px) {
    .home-hero {
        grid-template-columns: 1fr;
    }
    .hero-media {
        display: none;
    }
    .hero-title {
        font-size: 28px;
    }
}
</style>
