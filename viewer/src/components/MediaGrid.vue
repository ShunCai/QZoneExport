<script setup lang="ts">
import { computed } from 'vue';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import { formatTime } from '../data/format';
import { commentUser } from '../data/content';
import { escapeHtml, formatText } from '../data/richText';
import { usePrivacy } from '../composables/usePrivacy';
import { maskedUserLabel } from '../data/mask';
import type { MediaItem } from '../data/media';
const { hidden: hideSensitive } = usePrivacy();

/**
 * 媒体网格 + 大图查看
 *
 * 大图用 PhotoSwipe（MIT，随产物打包，无 CDN），并在右侧挂一个自写的评论面板：
 * 空间里图片可以单独被评论，旧页面用 lightGallery 的 comment 插件展示，这里用
 * PhotoSwipe 的 registerElement 自己实现（lightGallery 2.x 是 GPLv3，与本项目
 * Apache-2.0 打包分发不兼容，故不沿用）。
 */
const props = defineProps<{
    medias: MediaItem[];
    /** 整条记录的评论，作为单图评论的兜底 */
    comments?: Record<string, any>[];
    /**
     * 九宫格模式（说说/分享及收藏中的说说/分享用）：
     * 按条数自适应列数（1〜3 一行、4 两列、5+ 三列），超过 9 条只摆前 8 张、
     * 末格显示剩余张数。相册/视频等需完整平铺的场景不启用。
     */
    nineGrid?: boolean;
    /**
     * 瀑布流模式（仅非九宫格生效）：取消等高方格，按图片原始比例分多列错落排布；
     * 由所属模块的「分页/瀑布流」偏好驱动（瀑布流即 !paginate）。
     */
    masonry?: boolean;
    /**
     * 平铺模式（非九宫格、非瀑布流）下单项宽度，默认 160。
     * 相片列表（相册内）与视频列表传 220，与瀑布流列宽保持一致；
     * 其余模块（说说配图等）不传，维持 160 的紧凑排布。
     */
    itemWidth?: number;
}>();

/**
 * 能进查看器的媒体
 * 图片与「有本地源文件的视频」都走同一个查看器：视频也需要看自己的赞与评论，
 * 而评论面板就在查看器里；外部视频（腾讯视频/Flash）无源文件，仍点封面跳原站。
 */
const viewables = computed(() => props.medias.filter((media) => (
    media.type === 'image' || (media.type === 'video' && !!media.src && !media.link)
)));

/** 该媒体在查看器里的位置（不可查看时为 -1） */
function viewIndex(media: MediaItem): number {
    return viewables.value.indexOf(media);
}

/** 统计角标是否需要展示（0 也展示，便于对比；但完全没给 stats 的不占位） */
function hasStats(media: MediaItem): boolean {
    return !!media.stats;
}

/* ===== 九宫格布局（仅 nineGrid 模式生效） ===== */

/** 九宫格最多摆 9 格，超出只摆前 8 张 + 1 格剩余数 */
const GRID_LIMIT = 9;

/** 按条数决定列数：1→1、2→2、3→3、4→2（2×2）、5+→3 */
const cols = computed(() => {
    const n = props.medias.length;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    return 3;
});

const overflow = computed(() => props.nineGrid === true && props.medias.length > GRID_LIMIT);
/** 实际摆出的媒体：溢出时只取前 8 张 */
const displayMedias = computed(() => (overflow.value ? props.medias.slice(0, GRID_LIMIT - 1) : props.medias));
/** 末格要显示的剩余张数 */
const remaining = computed(() => (overflow.value ? props.medias.length - (GRID_LIMIT - 1) : 0));

/** 网格列与宽：九宫格按列数等分并限宽；其余场景按 itemWidth（默认 160px）自动换行平铺 */
const gridStyle = computed(() => {
    if (props.nineGrid === true) {
        const c = cols.value;
        const maxWidth = c === 1 ? '240px' : c * 160 + (c - 1) * 8 + 'px';
        return { gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))`, maxWidth };
    }
    if (props.masonry === true) {
        // 多列等高流式布局：列宽自适应，图片按原始比例错落排列
        return { display: 'block', columns: '220px', columnGap: '8px' };
    }
    const w = props.itemWidth ?? 160;
    return { gridTemplateColumns: `repeat(auto-fill, ${w}px)` };
});

/** 点末格「+N」打开大图，定位到第一张被收起的媒体 */
function openOverflow(): void {
    const hidden = props.medias.slice(displayMedias.value.length);
    const first = hidden.find((media) => viewIndex(media) >= 0);
    if (first) {
        openViewer(first);
    }
}

/** 评论面板宽度，需与 styles.css 里的 .pswp-comments 保持一致 */
const PANEL_WIDTH = 300;

/**
 * 图片尺寸
 * PhotoSwipe 需要宽高才能正确缩放，而备份数据里的尺寸字段不一定齐全，
 * 故打开前实测一次并缓存；读不到时给一个常见比例兜底。
 */
const sizeCache = new Map<string, { width: number; height: number }>();
function measure(src: string): Promise<{ width: number; height: number }> {
    const cached = sizeCache.get(src);
    if (cached) {
        return Promise.resolve(cached);
    }
    return new Promise((resolve) => {
        const image = new Image();
        image.addEventListener('load', () => {
            const size = { width: image.naturalWidth || 1200, height: image.naturalHeight || 900 };
            sizeCache.set(src, size);
            resolve(size);
        });
        image.addEventListener('error', () => resolve({ width: 1200, height: 900 }));
        image.src = src;
    });
}

/**
 * 当前图片自身的信息
 * 名称、说明、属性行分三种样式渲染，而不是堆成一段同样字号的文字。
 */
function infoHtml(media?: MediaItem): string {
    const info = media?.info;
    if (!info || (!info.name && !info.desc && !info.meta?.length)) {
        return '';
    }
    const parts: string[] = [];
    if (info.name) {
        parts.push(`<div class="pswp-media-name">${escapeHtml(info.name)}</div>`);
    }
    if (info.desc) {
        parts.push(`<div class="pswp-media-desc">${formatText(info.desc)}</div>`);
    }
    const meta = (info.meta || []).filter((row) => row.value);
    if (meta.length > 0) {
        parts.push('<div class="pswp-media-meta">' + meta.map((row) => (
            `<div class="pswp-media-row"><span class="pswp-media-label">${escapeHtml(row.label)}</span>`
            + `<span class="pswp-media-value">${escapeHtml(row.value)}</span></div>`
        )).join('') + '</div>');
    }
    return `<div class="pswp-media-info">${parts.join('')}</div>`;
}

/** 评论面板内容（面板在 PhotoSwipe 的 DOM 里，只能给 HTML 字符串）
 *
 * 评论正文与昵称来自他人输入，故一律先经 escapeHtml / formatText 转义后再拼接，
 * 拼出的字符串里只有本函数自己生成的标签。
 */
function commentsHtml(index: number): string {
    const media = viewables.value[index];
    const list = media?.comments?.length ? media.comments : (props.comments || []);
    const title = media?.comments?.length
        ? (media.type === 'video' ? '这个视频的评论' : '这张图片的评论')
        : '内容的评论';
    // 顶部先展示该媒体自己的信息（名称/拍摄时间/地点）
    const info = infoHtml(media);
    if (list.length === 0) {
        return info + '<div class="pswp-comments-title">评论</div><div class="pswp-comments-empty">没有评论</div>';
    }
    const items = list.map((comment) => {
        const user = commentUser(comment);
        // 这里拼的是 HTML 字符串、不走 Vue 模板，隐私态需手动调用统一出口（含无昵称时打码 QQ）
        const label = hideSensitive.value
            ? maskedUserLabel(user)
            : String(user.name || user.uin || '');
        return '<div class="pswp-comment">'
            + `<div class="pswp-comment-head"><span class="pswp-comment-name">${escapeHtml(label)}</span>`
            + `<span class="pswp-comment-time">${escapeHtml(formatTime(comment.postTime || comment.create_time))}</span></div>`
            + `<div class="pswp-comment-text">${formatText(comment.content)}</div>`
            + '</div>';
    });
    return info + `<div class="pswp-comments-title">${title}（${list.length}）</div>` + items.join('');
}

async function openViewer(media: MediaItem): Promise<void> {
    const index = viewIndex(media);
    if (index < 0) {
        return;
    }
    // 视频用自定义 HTML 内容项（PhotoSwipe 支持 html slide），图片需先测尺寸
    const dataSource = await Promise.all(viewables.value.map(async (item) => {
        if (item.type === 'video') {
            return {
                html: '<div class="pswp-video">'
                    + `<video src="${escapeHtml(item.src)}"`
                    + (item.poster ? ` poster="${escapeHtml(item.poster)}"` : '')
                    + ' controls playsinline preload="metadata"></video>'
                    + '</div>',
            };
        }
        const size = await measure(item.src);
        return { src: item.src, width: size.width, height: size.height };
    }));

    // 评论面板占右侧一条：窗口太窄时（与 styles.css 的断点一致）不显示，不能往右留白
    const withPanel = window.innerWidth > 900;
    const pswp = new PhotoSwipe({
        dataSource,
        index,
        bgOpacity: 0.92,
        // 给面板留出位置，否则图片会铺到面板下面去
        padding: { top: 0, bottom: 0, left: 0, right: withPanel ? PANEL_WIDTH : 0 },
        // 用于把关闭按钮与“下一张”箭头向内移，不被面板遮住
        mainClass: withPanel ? 'pswp--with-comments' : '',
    });
   // 缩略图条的 HTML（底部画廊导航）
    const thumbsHtml = viewables.value.map((item, i) => {
        const thumb = item.type === 'video' ? (item.poster || '') : (item.thumb || item.src);
        const cls = i === index ? 'pswp-thumb active' : 'pswp-thumb';
        return thumb
            ? `<div class="${cls}" data-index="${i}"><img src="${escapeHtml(thumb)}" /></div>`
            : `<div class="${cls} pswp-thumb--video" data-index="${i}"><span>▶</span></div>`;
    }).join('');

    pswp.on('uiRegister', () => {
        // 评论面板
        pswp.ui?.registerElement({
            name: 'comments',
            appendTo: 'root',
            order: 9,
            onInit: (element) => {
                element.className = 'pswp-comments';
                element.innerHTML = commentsHtml(pswp.currIndex);
                // 切换媒体时同步评论，保证看到的始终是当前这一项的评论
                pswp.on('change', () => {
                    element.innerHTML = commentsHtml(pswp.currIndex);
                });
            },
        });
        // 底部缩略图条（仅多于 1 张时显示）
        if (viewables.value.length > 1) {
            pswp.ui?.registerElement({
                name: 'thumbnails',
                appendTo: 'root',
                order: 8,
                onInit: (element) => {
                    element.className = 'pswp-thumbnails';
                    element.innerHTML = thumbsHtml;
                    // 点击缩略图跳转
                    element.addEventListener('click', (event) => {
                        const target = (event.target as HTMLElement).closest('.pswp-thumb') as HTMLElement | null;
                        if (!target) return;
                        const idx = Number(target.dataset.index);
                        if (Number.isFinite(idx) && idx !== pswp.currIndex) {
                            pswp.goTo(idx);
                        }
                    });
                    // 切换时高亮 + 滚动到可见
                    const syncActive = () => {
                        const thumbs = element.querySelectorAll('.pswp-thumb');
                        thumbs.forEach((thumb, i) => {
                            thumb.classList.toggle('active', i === pswp.currIndex);
                        });
                        const activeEl = thumbs[pswp.currIndex] as HTMLElement | undefined;
                        activeEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    };
                    pswp.on('change', syncActive);
                    // 初始定位
                    requestAnimationFrame(() => {
                        const activeEl = element.querySelectorAll('.pswp-thumb')[index] as HTMLElement | undefined;
                        activeEl?.scrollIntoView({ inline: 'center', block: 'nearest' });
                    });
                },
            });
        }
    });
    // 切页与关闭时暂停视频，否则关闭后声音会继续响
    const pauseAll = () => {
        pswp.element?.querySelectorAll('video').forEach((video) => (video as HTMLVideoElement).pause());
    };
    pswp.on('change', pauseAll);
    pswp.on('close', pauseAll);
    // 切到视频项时给查看器根元素加 pswp--video-active：CSS 据此给视频容器底部留白，
    // 让原生进度条/播放按钮抬高到缩略图条之上，避免被遮挡（#3，支持图片/视频混合交叉浏览）。
    const syncVideoState = () => {
        const media = viewables.value[pswp.currIndex];
        pswp.element?.classList.toggle('pswp--video-active', !!media && media.type === 'video');
    };
    pswp.on('change', syncVideoState);
    pswp.init();
    // 初始定位（打开即视频时也需抬高控件）
    syncVideoState();
}
</script>

<template>
    <div v-if="props.medias.length > 0" class="medias" :class="{ masonry: props.masonry }" :style="gridStyle">
        <template v-for="(media, index) in displayMedias" :key="index">
            <!-- 外部视频（腾讯视频、Flash）无可播放的本地文件，与旧页一致：点封面跳原站 -->
            <a
                v-if="media.type === 'video' && media.link"
                class="media media-cover"
                :href="media.link"
                target="_blank"
                rel="noreferrer"
                title="外部视频，点击跳转原站播放（需联网）"
            >
                <img v-if="media.poster" :src="media.poster" loading="lazy" />
                <span class="play-badge">▶</span>
                <span v-if="hasStats(media)" class="media-stats">
                    <span class="stat-item">赞 {{ media.stats?.likes || 0 }}</span>
                    <span class="stat-item">评论 {{ media.stats?.comments || 0 }}</span>
                </span>
            </a>
            <!-- 空间视频：展示封面，点击弹出带评论的播放窗（与相片看大图同一套交互） -->
            <div
                v-else-if="media.type === 'video'"
                class="media media-cover media-playable"
                title="点击播放"
                @click="openViewer(media)"
            >
                <img v-if="media.poster" :src="media.poster" loading="lazy" />
                <span v-else class="media-noposter">无封面</span>
                <span class="play-badge">▶</span>
                <span v-if="hasStats(media)" class="media-stats">
                    <span class="stat-item">赞 {{ media.stats?.likes || 0 }}</span>
                    <span class="stat-item">评论 {{ media.stats?.comments || 0 }}</span>
                </span>
            </div>
            <!-- 图片：带统计角标时需包一层定位容器 -->
            <div v-else-if="hasStats(media)" class="media media-cover media-playable" @click="openViewer(media)">
                <img :src="media.thumb || media.src" loading="lazy" />
                <span class="media-stats">
                    <span class="stat-item">赞 {{ media.stats?.likes || 0 }}</span>
                    <span class="stat-item">评论 {{ media.stats?.comments || 0 }}</span>
                </span>
            </div>
            <img
                v-else
                class="media media-image"
                :src="media.thumb || media.src"
                loading="lazy"
                @click="openViewer(media)"
            />
        </template>
        <!-- 九宫格溢出时的末格：显示剩余张数，点开看全部 -->
        <div v-if="remaining > 0" class="media media-more" @click="openOverflow">+{{ remaining }}</div>
    </div>
</template>

<style scoped>
.medias {
    display: grid;
    gap: 8px;
    margin-top: 10px;
}

/* 瀑布流：多列流式，图片按原始比例错落排布 */
.medias.masonry {
    display: block;
}
.medias.masonry .media {
    aspect-ratio: auto;
    margin-bottom: 8px;
    break-inside: avoid;
    /* 大数据量优化：跳过屏幕外节点的布局/绘制，只渲染视口附近，避免全量 DOM 导致切换卡顿；
       contain-intrinsic-size 预留占位高度，多列平衡与缩放滚动更稳 */
    content-visibility: auto;
    contain-intrinsic-size: auto 240px;
}
.medias.masonry .media img,
.medias.masonry .media-cover img {
    height: auto;
    object-fit: initial;
}

.media {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-light);
    border-radius: 2px;
}

/* 九宫格溢出末格：半透明遮罩 + 剩余张数，点它看全部 */
.media-more {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 22px;
    font-weight: 600;
    cursor: pointer;
}

.media-image {
    cursor: zoom-in;
}

/* 封面型媒体（视频、带角标的相片）：需定位容器才能叠播放图标与统计条 */
.media-cover {
    position: relative;
    display: block;
    overflow: hidden;
}

.media-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.media-playable {
    cursor: pointer;
}

/* 无封面的视频给个占位，不能是一片空白 */
.media-noposter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-subtle);
    font-size: 12px;
}

.play-badge {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 14px;
    line-height: 34px;
    text-align: center;
}
</style>
