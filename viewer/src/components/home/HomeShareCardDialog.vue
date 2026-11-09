<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskName, plainName } from '../../data/mask';
import type { CoverPhoto } from '../../data/covers';

const props = defineProps<{
    open: boolean;
    user: Record<string, any> | null;
    timeRange: { earliest: string; latest: string };
    totalItems: number;
    media: { photos: number; videos: number };
    signature: string;
    covers: CoverPhoto[];
    /** 回忆故事行的素材（全部可选：缺省时对应行跳过） */
    extras?: {
        /** 最初的记忆第一条（label=模块名，measure=量词，date=日期） */
        firstRecord?: { label: string; measure: string; date: string };
        /** 最热闹的一年 */
        peakYear?: { year: string; count: number };
        /** 全站文字总量 */
        words: number;
        /** 全站表情次数 */
        emojiTotal: number;
        /** 说说条数 */
        messages: number;
        /** 访客量 */
        visitors: number;
    };
}>();

const emit = defineEmits<{ close: [] }>();

const { hidden: hideSensitive } = usePrivacy();
const ratio = ref<'3:4' | '16:9'>('3:4');
const canvasRef = ref<HTMLCanvasElement | null>(null);
/** 封面槽位：按原顺序占位，加载失败的位置留 null */
const coverSlots = ref<(HTMLImageElement | null)[]>(Array(9).fill(null));
/** 只排加载成功的图——不再画固定 9 个方格、也不留白色空格子 */
const coverImages = computed(() => coverSlots.value.filter((x): x is HTMLImageElement => !!x));
let loadToken = 0;

function loadCoverImages(): void {
    const token = ++loadToken;
    coverSlots.value = Array(9).fill(null);
    /** 原图 403 / CORS / 超时 → 回退到预览图，避免整格变空 */
    const place = (cover: CoverPhoto, index: number, src: string, canFallback: boolean): void => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (token !== loadToken) return;
            const next = [...coverSlots.value];
            next[index] = img;
            coverSlots.value = next;
            draw();
        };
        img.onerror = () => {
            if (token !== loadToken) return;
            if (canFallback && cover.remoteFallback && cover.remoteFallback !== src) {
                place(cover, index, cover.remoteFallback, false);
            }
        };
        img.src = src;
    };
    props.covers.slice(0, 9).forEach((cover, index) => {
        // 隐私模式也要加载：加载后在画的时候做模糊脱敏，而不是退化成纯色块
        if (!cover.remote) return;
        place(cover, index, cover.remote, true);
    });
}

const spaceName = computed(() => String(props.user?.spacename || props.user?.nickname || 'QQ空间').trim());
const spaceDesc = computed(() => plainName(String(props.user?.desc || '')));
// canvas 只能画文字：昵称/描述里的 [em] token 必须先剥掉，否则分享图上会露出一串标记
const displayTitle = computed(() => {
    const plain = plainName(spaceName.value);
    return hideSensitive.value ? maskName(plain) : plain;
});

const startYear = computed(() => (props.timeRange.earliest || '').slice(0, 4));
const endYear = computed(() => (props.timeRange.latest || '').slice(0, 4));

const periodText = computed(() => {
    if (!startYear.value || !endYear.value) return `${fmt(props.totalItems)} 条内容`;
    const years = Math.max(1, Number(endYear.value) - Number(startYear.value));
    return `${startYear.value} — ${endYear.value} · ${years} 年 · ${fmt(props.totalItems)} 条内容`;
});

const leadText = computed(() => {
    if (hideSensitive.value) return '把 QQ 空间的青春，备份成一本随时能翻开的书。';
    return spaceDesc.value || '把 QQ 空间的青春，备份成一本随时能翻开的书。';
});

const fileName = computed(() => {
    const safe = displayTitle.value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 20) || 'QQ空间';
    return `QQ空间备份_${safe}_${ratio.value.replace(':', 'x')}.png`;
});

function fmt(n: number): string {
    return Number(n || 0).toLocaleString('zh-CN');
}

/** 大数压缩：上万用「万」，与概览 KPI 同口径 */
function fmtWan(n: number): string {
    const v = Number(n || 0);
    if (v >= 10000) {
        const wan = v / 10000;
        return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')} 万`;
    }
    return v.toLocaleString('zh-CN');
}

const SERIF = 'Georgia, "Songti SC", "SimSun", serif';
const SANS = '-apple-system, "Microsoft YaHei", sans-serif';
const C = {
    bg: '#f5f5f8',
    card: '#ffffff',
    border: '#ebedf0',
    text: '#333333',
    secondary: '#666666',
    muted: '#999999',
    accent: '#2080f0',
    accentInk: '#1366d6',
};
const MOSAIC = ['#e6f1fb', '#e1f5ee', '#faeeda', '#f1efe8', '#dbeafe', '#fbeaf0', '#eaf3de', '#fcebeb', '#eeedfe'];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fontSize: number): void {
    roundRect(ctx, x, y, size, size, size * 0.3);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${fontSize}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q', x + size / 2, y + size / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

/**
 * 隐私模式下的模糊脱敏：先在离屏 canvas 上用 ctx.filter='blur()' 处理，
 * 再贴回格子——直接对主 canvas 模糊会连带把已画的内容也糊掉。
 * 放大 15% 再裁，模糊后边缘不会透出透明。
 */
function drawBlurred(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.filter = `blur(${Math.max(8, Math.round(Math.min(w, h) * 0.18))}px)`;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.15;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    octx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.drawImage(off, x, y, w, h);
}

/**
 * 满幅自适应照片墙：按实际张数排版，铺满给定 width × height。
 *
 * 旧版固定 3×3 方格居中，在 3:4 里左右各空 249px、16:9 右栏底部空一大块；
 * 现在行数由张数决定、最后一行不足 3 张时把这几张均分整行宽度，不留空格子。
 * 一张都没加载出来时画 3×3 柔和色块（仍铺满，不会退化成一片空白）。
 */
function drawMosaic(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    gap: number,
    maxCells = 9,
): void {
    const imgs = coverImages.value;
    const n = Math.min(imgs.length, maxCells);
    const cells = n > 0 ? n : Math.min(9, maxCells);
    const rows = Math.max(1, Math.ceil(cells / 3));
    const cellH = Math.max(1, (height - gap * (rows - 1)) / rows);

    for (let i = 0; i < cells; i++) {
        const row = Math.floor(i / 3);
        const inRow = Math.min(3, cells - row * 3);
        const cw = (width - gap * (inRow - 1)) / inRow;
        const cx = x + (i % 3) * (cw + gap);
        const cy = y + row * (cellH + gap);

        roundRect(ctx, cx, cy, cw, cellH, 10);
        ctx.fillStyle = MOSAIC[i % MOSAIC.length]!;
        ctx.fill();

        const img = imgs[i];
        if (!img) continue;
        ctx.save();
        roundRect(ctx, cx, cy, cw, cellH, 10);
        ctx.clip();
        if (hideSensitive.value) {
            drawBlurred(ctx, img, cx, cy, cw, cellH);
        } else {
            const scale = Math.max(cw / img.naturalWidth, cellH / img.naturalHeight);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            ctx.drawImage(img, cx + (cw - dw) / 2, cy + (cellH - dh) / 2, dw, dh);
        }
        ctx.restore();
    }
}

/**
 * 标题字号自适应：避免长空间名称把最后一两个字单独挤到第二行。
 * 优先一行放下；放不下时至少保证第二行不是孤字。
 */
function fitTitleFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, base: number, min: number): number {
    for (let size = base; size >= min; size -= 2) {
        ctx.font = `500 ${size}px ${SERIF}`;
        const lines: string[] = [];
        let line = '';
        for (const ch of Array.from(text)) {
            if (ctx.measureText(line + ch).width > maxWidth && line) {
                lines.push(line);
                line = ch;
            } else {
                line += ch;
            }
        }
        if (line) lines.push(line);
        if (lines.length === 1) return size;
        if (lines.length === 2 && Array.from(lines[1]!).length >= 3) return size;
    }
    return min;
}

function drawWrapped(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
): number {
    const chars = Array.from(text);
    const all: string[] = [];
    let line = '';
    for (const ch of chars) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
            all.push(line);
            line = ch;
        } else {
            line = test;
        }
    }
    if (line) all.push(line);
    const lines = all.slice(0, maxLines);
    if (all.length > maxLines) {
        let last = lines[maxLines - 1] || '';
        while (last.length && ctx.measureText(last + '…').width > maxWidth) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '…';
    }
    lines.forEach((item, i) => ctx.fillText(item, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
}

function draw(): void {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const portrait = ratio.value === '3:4';
    const w = portrait ? 1080 : 1600;
    const h = portrait ? 1440 : 900;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cardX = 36;
    const cardY = 36;
    const cardW = w - 72;
    const cardH = h - 72;
    const pad = 56;
    const x = cardX + pad;
    const contentW = cardW - pad * 2;
    /** 两版共用的「顶部下移」基线：空间名不贴顶，右栏照片墙也从这里起 */
    const topInset = 38;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    roundRect(ctx, cardX, cardY, cardW, cardH, 32);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数字统一 SANS：Georgia 的 old-style 数字（3/4/5/7/9 下沉）在 KPI 上高低不齐
    const kpiFont = (size: number): string => `500 ${size}px ${SANS}`;
    const labelFont = (size: number): string => `400 ${size}px ${SANS}`;

    const extras = props.extras;
    const cells: { v: string; l: string }[] = [
        { v: fmt(props.totalItems), l: '内容条目' },
        { v: fmt(props.media.photos), l: '相片' },
        { v: fmt(props.media.videos), l: '视频' },
        { v: fmtWan(extras?.words ?? 0), l: '文字' },
        { v: fmt(extras?.messages ?? 0), l: '说说' },
        { v: fmtWan(extras?.visitors ?? 0), l: '访客' },
    ];
    const stories: string[] = [];
    if (extras?.firstRecord?.date) {
        stories.push(`一切从 ${extras.firstRecord.date} 的第一${extras.firstRecord.measure}${extras.firstRecord.label}开始`);
    }
    if (extras?.peakYear?.year) {
        stories.push(`最热闹的 ${extras.peakYear.year} 年，写下了 ${fmt(extras.peakYear.count)} 条内容`);
    }
    if (extras && extras.words > 0) {
        const parts = [`${fmtWan(extras.words)} 字`];
        if (extras.emojiTotal > 0) parts.push(`${fmt(extras.emojiTotal)} 次表情`);
        stories.push(`累计 ${parts.join(' · ')}`);
    }

    const drawMatrix = (cx0: number, cy0: number, width: number): void => {
        const colW = width / 3;
        cells.forEach((k, i) => {
            const cx = cx0 + (i % 3) * colW;
            const cy = cy0 + Math.floor(i / 3) * (portrait ? 92 : 104);
            ctx.fillStyle = C.accentInk;
            ctx.font = kpiFont(42);
            ctx.fillText(k.v, cx, cy);
            ctx.fillStyle = C.muted;
            ctx.font = labelFont(18);
            ctx.fillText(k.l, cx, cy + 28);
        });
    };
    const drawStories = (cx0: number, cy0: number): number => {
        let sy = cy0;
        ctx.font = labelFont(portrait ? 25 : 23);
        for (const story of stories) {
            ctx.fillStyle = C.accent;
            ctx.fillText('•', cx0 - 4, sy);
            ctx.fillStyle = C.secondary;
            ctx.fillText(story, cx0 + 24, sy);
            sy += portrait ? 46 : 52;
        }
        return sy;
    };

    if (portrait) {
        // ===== 竖版：单栏自上而下 =====
        let y = cardY + pad + topInset;
        const titleSize = fitTitleFont(ctx, displayTitle.value, contentW, 52, 34);
        ctx.font = `500 ${titleSize}px ${SERIF}`;
        ctx.fillStyle = C.text;
        y = drawWrapped(ctx, displayTitle.value, x, y, contentW, 68, 2);

        // 空间描述（隐私模式下由 leadText 换成通用文案）
        if (leadText.value) {
            ctx.fillStyle = C.secondary;
            ctx.font = labelFont(25);
            y = drawWrapped(ctx, leadText.value, x, y + 14, contentW, 34, 2);
        }

        ctx.fillStyle = C.secondary;
        ctx.font = labelFont(27);
        y += 30;
        ctx.fillText(periodText.value, x, y);

        y += 48;
        // 满幅 + 3×2 六格：292×275 近正方形（3:4 画布里 9 格必然被压成横矩形）
        const mosaicH = 560;
        drawMosaic(ctx, x, y, contentW, mosaicH, 10, 6);
        y += mosaicH + 66;

        // 照片墙与数字矩阵靠 66px 留白分隔即可：这里原本有一条 1px 细线（y-38），
        // 但 42px 数字的的字顶约在 y-42，线几乎贴着数字，观感很差，故去掉。
        // 16:9 横版本来也没有这条线，去掉后两版更一致。
        drawMatrix(x, y, contentW);
        y += 152;

        if (stories.length) {
            y = drawStories(x, y + 14) + 10;
        }

        // ===== 落款区：细线 + 寄语 + 品牌，让底部留白变成有意的收尾 =====
        const footY = cardY + cardH - 42;
        ctx.fillStyle = '#e0e3e9';
        ctx.fillRect(x, footY - 96, contentW, 1);
        ctx.fillStyle = '#c9ccd2';
        ctx.font = `400 28px ${SERIF}`;
        ctx.fillText('落叶随风，青春，稍纵即逝。', x, footY - 48);
        drawBrandMark(ctx, x, footY - 15, 20, 10);
        ctx.fillStyle = C.text;
        ctx.font = `500 17px ${SANS}`;
        ctx.fillText('QQ空间导出助手', x + 28, footY);
        ctx.fillStyle = C.muted;
        ctx.font = labelFont(15);
        ctx.fillText(' · github.com/ShunCai/QZoneExport', x + 172, footY);
        return;
    }

    // ===== 横版：左文右图两栏（16:9 不再溢出/大留白） =====
    const leftW = Math.round(contentW * 0.52);
    const rightX = x + leftW + 56;
    const rightW = contentW - leftW - 56;

    let y = cardY + pad + topInset;
    const titleSize = fitTitleFont(ctx, displayTitle.value, leftW, 52, 34);
    ctx.font = `500 ${titleSize}px ${SERIF}`;
    ctx.fillStyle = C.text;
    y = drawWrapped(ctx, displayTitle.value, x, y, leftW, 68, 2);

    // 空间描述（隐私模式下由 leadText 换成通用文案）
    if (leadText.value) {
        ctx.fillStyle = C.secondary;
        ctx.font = labelFont(25);
        y = drawWrapped(ctx, leadText.value, x, y + 14, leftW, 34, 2);
    }

    ctx.fillStyle = C.secondary;
    ctx.font = labelFont(27);
    y += 30;
    ctx.fillText(periodText.value, x, y);

    // 时间跨度行与 KPI 之间留出呼吸：27px 的说明字与 42px 的数字不能贴边
    y += 76;
    drawMatrix(x, y, leftW);
    y += 164;

    if (stories.length) {
        // 比竖版多下沉一点：左栏内容偏短，把空白从「故事与落款之间」挪到上方。
        // KPI 区已下移 28px，这里相应少挪 8px，保证故事与落款仍有呼吸
        y = drawStories(x, y + 40);
    }

    // 右栏：照片墙从栏顶拉到卡底附近，填满右下角（别用左栏累计高度定位）
    const mosaicY = cardY + pad + topInset;
    // 右栏照片墙一直铺到与左栏品牌行齐平，右下不再留空
    const footY = cardY + cardH - pad;
    const mosaicH = footY - mosaicY;
    drawMosaic(ctx, rightX, mosaicY, rightW, mosaicH, 10);

    // 左栏落款：细线 + 寄语，与右栏照片墙底边对齐
    ctx.fillStyle = '#e0e3e9';
    ctx.fillRect(x, footY - 96, leftW, 1);
    ctx.fillStyle = '#c9ccd2';
    ctx.font = `400 24px ${SERIF}`;
    ctx.fillText('落叶随风，青春，稍纵即逝。', x, footY - 48);

    // ===== 底部品牌：全卡唯一一处 =====

    drawBrandMark(ctx, x, footY - 15, 20, 10);
    ctx.fillStyle = C.text;
    ctx.font = `500 17px ${SANS}`;
    ctx.fillText('QQ空间导出助手', x + 28, footY);
    ctx.fillStyle = C.muted;
    ctx.font = labelFont(15);
    ctx.fillText(' · github.com/ShunCai/QZoneExport', x + 172, footY);
}

function download(): void {
    const canvas = canvasRef.value;
    if (!canvas) return;
    canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.value;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
}

watch(
    [() => props.open, ratio, () => props.user, () => props.signature, () => props.totalItems, () => props.covers, hideSensitive],
    async () => {
        if (!props.open) return;
        await nextTick();
        draw();
        loadCoverImages();
    },
    { immediate: true },
);
</script>

<template>
    <div v-if="open" class="share-overlay" @click.self="emit('close')">
        <div class="share-dialog" role="dialog" aria-modal="true" aria-label="生成分享卡片">
            <div class="share-head">
                <strong>生成分享卡片</strong>
                <button type="button" class="close" @click="emit('close')">关闭</button>
            </div>
            <div class="share-body">
                <div class="ratio-tabs">
                    <button type="button" :class="{ active: ratio === '3:4' }" @click="ratio = '3:4'">3:4 竖版</button>
                    <button type="button" :class="{ active: ratio === '16:9' }" @click="ratio = '16:9'">16:9 横版</button>
                </div>
                <canvas ref="canvasRef" class="preview" />
                <p class="hint">优先使用备份内的相片外链；外链失效时该格自动回退为色块。隐私模式下自动脱敏。</p>
            </div>
            <div class="share-foot">
                <button type="button" class="btn" @click="emit('close')">取消</button>
                <button type="button" class="btn primary" @click="download">下载 PNG</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.share-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.28);
}
.share-dialog {
    width: min(720px, 94vw);
    max-height: 92vh;
    overflow: auto;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    color: var(--text-primary);
}
.share-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-card);
}
.share-head strong {
    font-size: 14px;
    font-weight: 500;
}
.close {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
}
.share-body {
    padding: 16px 20px;
}
.ratio-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.ratio-tabs button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--border-card);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
}
.ratio-tabs button.active {
    border-color: var(--accent);
    color: var(--accent-pressed);
    background: var(--bg-tint-blue);
}
.preview {
    display: block;
    max-width: 100%;
    max-height: 56vh;
    width: auto;
    height: auto;
    margin: 0 auto;
    border: 1px solid var(--border-card);
    border-radius: 10px;
    background: #fff;
}
.hint {
    margin: 10px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
}
.share-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--border-card);
}
.btn {
    height: 32px;
    padding: 0 14px;
    border: 1px solid var(--border-card);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
}
.btn.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
}
.btn.primary:hover {
    background: var(--accent-pressed);
    border-color: var(--accent-pressed);
}
</style>
