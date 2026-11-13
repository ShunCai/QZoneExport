<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import { escapeHtml, formatText } from '../data/richText';
import { commentEntriesHtml } from '../data/commentHtml';
import { usePrivacy } from '../composables/usePrivacy';
import { maskContent } from '../data/mask';
import type { MediaItem } from '../data/media';
import VideoThumb from './VideoThumb.vue';
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
    /** 从搜索结果跳进来时，要在灯箱里打开的那张相片（对应 MediaItem.key） */
    openKey?: string;
    /** 还要展开评论并定位到这条评论 */
    highlightComment?: string;
}>();

/**
 * 能进查看器的媒体
 * 图片与「有本地源文件的视频」都走同一个查看器：视频也需要看自己的赞与评论，
 * 而评论面板就在查看器里；外部视频（腾讯视频/Flash）无源文件，仍点封面跳原站。
 */
const viewables = computed(() => props.medias.filter((media) => (
    media.type === 'image' || (media.type === 'video' && !!media.src && !media.link)
)));

/**
 * 该媒体在查看器里的位置（不可查看时为 -1）
 *
 * 按 key/src 查而不是对象引用：调用方常在模板里 `items.map(videoMediaOf)` 现造数组，
 * 每轮渲染都是新对象，用 indexOf 会因引用失配返回 -1，灯箱就打不开。
 */
function viewIndex(media: MediaItem): number {
    const key = media.key || media.src;
    if (!key) {
        return viewables.value.indexOf(media);
    }
    return viewables.value.findIndex((item) => (item.key || item.src) === key);
}

/**
 * 从搜索结果跳进来：等媒体就绪后自动打开到指定这一张（同一次跳转只开一次）
 *
 * 必须放在 viewables 之后：immediate 首次回调就要读它，提前访问会撞 TDZ。
 */
let autoOpenedKey = '';
watch(
    // 监听数组引用而不是长度：相册翻页后同样是 60 张，长度不变不会触发
    [() => props.openKey, () => props.medias],
    () => {
        const key = props.openKey;
        if (!key || autoOpenedKey === key) {
            return;
        }
        const media = viewables.value.find((item) => item.key === key);
        if (!media) {
            return;
        }
        autoOpenedKey = key;
        nextTick(() => {
            void openViewer(media, { expandComments: !!props.highlightComment });
        });
    },
    { immediate: true },
);

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
        // 多列流式布局：列宽自适应，图片/视频按原始比例错落排列。
        // column-count 上限设为媒体数：只写 column-width 时浏览器按容器宽度生成列，
        // 媒体少（如 4 个视频）时会多出空列，视觉上就是「多一个空白块」。
        return {
            display: 'block',
            columns: '220px',
            columnCount: String(Math.max(1, Math.min(props.medias.length, 8))),
            columnGap: '8px',
        };
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

/** 评论面板宽度，需与 styles.css 的 --pswp-comments-width 保持一致 */
const PANEL_WIDTH = 352;

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
 * 带超时的尺寸测量
 *
 * 打开灯箱前要测完当前页所有图的尺寸；从搜索结果跳到相册深处时，
 * 这一页 60 张全是首次加载，逐张等会拖到十几秒。超时先用默认尺寸占位，
 * 图真正加载完仍会写进缓存，之后再打开就是准的。
 */
function measureWithTimeout(src: string, ms = 1500): Promise<{ width: number; height: number }> {
    return Promise.race([
        measure(src),
        new Promise<{ width: number; height: number }>((resolve) => {
            setTimeout(() => resolve({ width: 1200, height: 900 }), ms);
        }),
    ]);
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

/**
 * 大图下方常驻的相片描述（方案 A）：与评论面板里的 pswp-media-desc 并存。
 * 只做展示：剥 UBB/HTML 由 formatText 负责，长文截断 120 字，隐私模式打码，
 * 乱码内容不自动改写（与评论面板保持同一口径）。
 */
function captionHtml(index: number): string {
    const item = viewables.value[index];
    const raw = String(item?.info?.desc || '').trim();
    if (!raw) return '';
    const clipped = raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
    const safe = hideSensitive.value ? maskContent(clipped) : clipped;
    return `<div class="pswp-media-caption-text">${formatText(safe)}</div>`;
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
        : '评论';
    // 顶部先展示该媒体自己的信息（名称/拍摄时间/地点）
    const info = infoHtml(media);
    if (list.length === 0) {
        return info + '<div class="pswp-comments-title">评论</div><div class="pswp-comments-empty">没有评论</div>';
    }
    // 条目 HTML 抽到 data/commentHtml.ts：支持头像与一层回复，且便于纯函数单测
    return info + `<div class="pswp-comments-title">${title}（${list.length}）</div>`
        + commentEntriesHtml(list, hideSensitive.value, props.highlightComment);
}

async function openViewer(media: MediaItem, options?: { expandComments?: boolean }): Promise<void> {
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
        const size = await measureWithTimeout(item.src);
        return { src: item.src, width: size.width, height: size.height };
    }));

    // 评论侧栏默认收起：打开大图先看图，需要时再点顶栏的评论按钮展开
    // 窗口太窄时（与 styles.css 断点一致）连切换按钮也不注册，避免展开后没地方放
    const canTogglePanel = window.innerWidth > 900;
    // 从搜索结果跳进来时直接展开评论面板，否则保持默认收起
    let commentsVisible = options?.expandComments === true;
    const pswp = new PhotoSwipe({
        dataSource,
        index,
        bgOpacity: 0.92,
        // 默认收起，不给右侧留面板宽度；展开后由 applyCommentsVisibility 动态改
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        mainClass: '',
    });

    /** 同步面板可见性到 CSS 类与 PhotoSwipe 的视口 padding */
    const applyCommentsVisibility = () => {
        pswp.element?.classList.toggle('pswp--with-comments', commentsVisible);
        pswp.options.padding = {
            top: 0,
            bottom: 0,
            left: 0,
            right: commentsVisible ? PANEL_WIDTH : 0,
        };
        // padding 变了必须强制重算视口，否则当前图片不会立刻让出/占回面板宽度
        pswp.updateSize(true);
    };
   // 缩略图条的 HTML（底部画廊导航）
    const thumbsHtml = viewables.value.map((item, i) => {
        const thumb = item.type === 'video' ? (item.poster || '') : (item.thumb || item.src);
        const cls = i === index ? 'pswp-thumb active' : 'pswp-thumb';
        return thumb
            ? `<div class="${cls}" data-index="${i}"><img src="${escapeHtml(thumb)}" /></div>`
            : `<div class="${cls} pswp-thumb--video" data-index="${i}"><span>▶</span></div>`;
    }).join('');
    /** 是否真的会有底部缩略图条：只有一项时整条不注册（连空横条都不留） */
    const hasThumbBar = viewables.value.length > 1 && !!thumbsHtml;

    pswp.on('uiRegister', () => {
        // 大图下方常驻描述条：不依赖评论面板展开；无描述时整条隐藏，不占位置
        pswp.ui?.registerElement({
            name: 'mediaCaption',
            appendTo: 'root',
            order: 7,
            onInit: (element) => {
                element.className = 'pswp-media-caption'
                    + (hasThumbBar ? ' pswp-media-caption--thumbs' : '');
                const render = () => {
                    const html = captionHtml(pswp.currIndex);
                    element.innerHTML = html;
                    element.style.display = html ? '' : 'none';
                };
                render();
                pswp.on('change', render);
            },
        });
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
        // 底部缩略图条：单图时不注册，多图且至少有一个可导航项才显示
        if (hasThumbBar) {
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

        // 评论面板收起/展开：顶栏里 zoom 是 order 10、close 是 20，取 12 正好在放大镜右侧
        if (canTogglePanel) {
            pswp.ui?.registerElement({
                name: 'commentsToggle',
                appendTo: 'bar',
                order: 12,
                isButton: true,
                // 默认收起：按钮初始为略暗（off）状态，展开后点亮为主题色
                className: 'pswp__button--comments-toggle pswp__button--comments-off',
                title: '展开评论',
                ariaLabel: '展开评论',
                // 从搜索结果跳进来时默认就展开评论：初始化时把面板与按钮状态一起同步
                onInit: (element: HTMLElement) => {
                    if (!commentsVisible) {
                        return;
                    }
                    applyCommentsVisibility();
                    element.title = '收起评论';
                    element.setAttribute('aria-label', '收起评论');
                    element.classList.remove('pswp__button--comments-off');
                },
                html: {
                    isCustomSVG: true,
                    // 实心对话气泡 + 三个挖空的圆点（fill-rule=evenodd 让圆点成为洞）。
                    // 注意坐标必须是 32×32 画布：PhotoSwipe 的图标（close/zoom）都是按 32 写的，
                    // 之前直接塞 Material 的 24×24 双路径（M20 2H4…）会只占左上 3/4 且整体偏小，
                    // 远看像个旗子/书签——那才是「看着很奇怪」的真正原因，不是形状选错了。
                    inner: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.6L11 24.6V21h-1a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z'
                        + 'M10.85 16a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0z'
                        + 'M14.85 16a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0z'
                        + 'M18.85 16a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0z" id="pswp__icn-comments"/>',
                    outlineID: 'pswp__icn-comments',
                },
                onClick: (_event, element) => {
                    commentsVisible = !commentsVisible;
                    applyCommentsVisibility();
                    const text = commentsVisible ? '收起评论' : '展开评论';
                    element.title = text;
                    element.setAttribute('aria-label', text);
                    element.classList.toggle('pswp__button--comments-off', !commentsVisible);
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
    // 命中评论：等面板渲染完再滚过去，否则拿不到节点
    if (props.highlightComment) {
        nextTick(() => {
            setTimeout(() => {
                const hit = pswp.element?.querySelector('.pswp-comment.is-hit') as HTMLElement | null;
                hit?.scrollIntoView({ block: 'center' });
            }, 80);
        });
    }
    // 只有真的存在缩略图条时才给视频底部留白；单条媒体没有导航条，
    // 留着那段 80px 会让视频的原生进度条悬在屏幕中间，看着像一条多余的「导航条」
    pswp.element?.classList.toggle('pswp--has-thumbs', hasThumbBar);
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
                <img v-if="media.poster" :src="media.poster" loading="lazy" decoding="async" />
                <span class="play-badge">▶</span>
                <span v-if="hasStats(media)" class="media-stats">
                    <span class="stat-item">赞 {{ media.stats?.likes || 0 }}</span>
                    <span class="stat-item">评论 {{ media.stats?.comments || 0 }}</span>
                </span>
            </a>
            <!-- 空间视频：封面可能失效（QQ 有时给黑场帧），交给 VideoThumb 抽本地视频首帧 -->
            <video-thumb
                v-else-if="media.type === 'video'"
                :media="media"
                :stats="media.stats"
                @click="openViewer(media)"
            />
            <!-- 图片：带统计角标时需包一层定位容器 -->
            <div v-else-if="hasStats(media)" class="media media-cover media-playable" @click="openViewer(media)">
                <img :src="media.thumb || media.src" loading="lazy" decoding="async" />
                <span class="media-stats">
                    <span class="stat-item">赞 {{ media.stats?.likes || 0 }}</span>
                    <span class="stat-item">评论 {{ media.stats?.comments || 0 }}</span>
                </span>
            </div>
            <img
                v-else
                class="media media-image"
                :src="media.thumb || media.src"
                loading="lazy" decoding="async"
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
