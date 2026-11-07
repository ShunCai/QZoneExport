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
/** 已成功加载的外链封面图（下标对应九宫格）；加载失败/无外链的格子兜底色块 */
const coverImages = ref<(HTMLImageElement | null)[]>([]);
let loadToken = 0;

function loadCoverImages(): void {
    const token = ++loadToken;
    coverImages.value = Array(9).fill(null);
    props.covers.slice(0, 9).forEach((cover, index) => {
        // 隐私模式也要加载：加载后在画的时候做模糊脱敏，而不是退化成纯色块
        if (!cover.remote) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (token !== loadToken) return;
            const next = [...coverImages.value];
            next[index] = img;
            coverImages.value = next;
            draw();
        };
        img.onerror = () => { /* 404 / CORS 失败：保留兜底色块 */ };
        img.src = cover.remote;
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
    cell: number,
): void {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(cell));
    off.height = Math.max(1, Math.round(cell));
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.filter = `blur(${Math.max(8, Math.round(cell * 0.18))}px)`;
    const scale = Math.max(cell / img.naturalWidth, cell / img.naturalHeight) * 1.15;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    octx.drawImage(img, (cell - dw) / 2, (cell - dh) / 2, dw, dh);
    ctx.drawImage(off, x, y, cell, cell);
}

function drawMosaic(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, gap: number): void {
    for (let i = 0; i < 9; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = x + col * (cell + gap);
        const cy = y + row * (cell + gap);
        roundRect(ctx, cx, cy, cell, cell, 12);
        ctx.fillStyle = MOSAIC[i]!;
        ctx.fill();
        const img = coverImages.value[i];
        if (!img) continue;
        ctx.save();
        roundRect(ctx, cx, cy, cell, cell, 12);
        ctx.clip();
        if (hideSensitive.value) {
            // 隐私模式：模糊脱敏（仍保留照片墙的视觉形态，只是看不清人脸）
            drawBlurred(ctx, img, cx, cy, cell);
            ctx.restore();
            continue;
        }
        // object-fit: cover 的等比裁切
        const scale = Math.max(cell / img.naturalWidth, cell / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, cx + (cell - dw) / 2, cy + (cell - dh) / 2, dw, dh);
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
    const h = portrait ? 1340 : 900;
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
            const cy = cy0 + Math.floor(i / 3) * (portrait ? 108 : 92);
            ctx.fillStyle = C.accentInk;
            ctx.font = kpiFont(portrait ? 50 : 42);
            ctx.fillText(k.v, cx, cy);
            ctx.fillStyle = C.muted;
            ctx.font = labelFont(19);
            ctx.fillText(k.l, cx, cy + (portrait ? 27 : 24));
        });
    };
    const drawStories = (cx0: number, cy0: number): number => {
        let sy = cy0;
        ctx.font = labelFont(portrait ? 26 : 23);
        for (const story of stories) {
            ctx.fillStyle = C.accent;
            ctx.fillText('•', cx0 - 4, sy);
            ctx.fillStyle = C.secondary;
            ctx.fillText(story, cx0 + 24, sy);
            sy += portrait ? 50 : 44;
        }
        return sy;
    };

    if (portrait) {
        // ===== 竖版：单栏自上而下 =====
        let y = cardY + pad + 6;
        const titleSize = fitTitleFont(ctx, displayTitle.value, contentW, 64, 40);
        ctx.font = `500 ${titleSize}px ${SERIF}`;
        ctx.fillStyle = C.text;
        y = drawWrapped(ctx, displayTitle.value, x, y, contentW, 78, 2);

        // 空间描述（隐私模式下由 leadText 换成通用文案）
        if (leadText.value) {
            ctx.fillStyle = C.secondary;
            ctx.font = labelFont(26);
            y = drawWrapped(ctx, leadText.value, x, y + 14, contentW, 36, 2);
        }

        ctx.fillStyle = C.secondary;
        ctx.font = labelFont(27);
        y += 34;
        ctx.fillText(periodText.value, x, y);

        y += 52;
        const cell = 126;
        const gap = 10;
        const mosaicW = cell * 3 + gap * 2;
        drawMosaic(ctx, x + (contentW - mosaicW) / 2, y, cell, gap);
        y += cell * 3 + gap * 2 + 76;

        // 细分隔线：把「照片墙」与「数字矩阵」分成两块，避免数字像九宫格的附属
        ctx.fillStyle = C.border;
        ctx.fillRect(x, y - 54, contentW, 1);

        drawMatrix(x, y, contentW);
        y += 216;

        if (stories.length) {
            y = drawStories(x, y + 14) + 10;
        }

        // ===== 底部品牌：全卡唯一一处 =====
        const footY = Math.max(y, cardY + cardH - pad - 30);
        // 尾部留白处放一句淡色标语：填补空白，也给卡片一个收尾
        ctx.fillStyle = '#c9ccd2';
        ctx.font = `400 28px ${SERIF}`;
        ctx.fillText('落叶随风，青春，稍纵即逝。', x, footY - 54);
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

    let y = cardY + pad + 6;
    const titleSize = fitTitleFont(ctx, displayTitle.value, leftW, 54, 38);
    ctx.font = `500 ${titleSize}px ${SERIF}`;
    ctx.fillStyle = C.text;
    y = drawWrapped(ctx, displayTitle.value, x, y, leftW, 66, 2);

    // 空间描述（隐私模式下由 leadText 换成通用文案）
    if (leadText.value) {
        ctx.fillStyle = C.secondary;
        ctx.font = labelFont(23);
        y = drawWrapped(ctx, leadText.value, x, y + 12, leftW, 32, 2);
    }

    ctx.fillStyle = C.secondary;
    ctx.font = labelFont(24);
    y += 30;
    ctx.fillText(periodText.value, x, y);

    y += 52;
    drawMatrix(x, y, leftW);
    y += 188;

    if (stories.length) {
        y = drawStories(x, y + 12);
    }

    // 右栏：九宫格 + 签名（从栏顶开始，别用左栏累计高度——会把九宫格推出卡外）
    const cell = 168;
    const gap = 10;
    const mosaicW = cell * 3 + gap * 2;
    const mosaicY = cardY + pad + 6;
    drawMosaic(ctx, rightX + (rightW - mosaicW) / 2, mosaicY, cell, gap);

    // 左栏尾部标语：填补下半部留白
    ctx.fillStyle = '#c9ccd2';
    ctx.font = `400 26px ${SERIF}`;
    ctx.fillText('落叶随风，青春，稍纵即逝。', x, cardY + cardH - pad - 78);

    // ===== 底部品牌：全卡唯一一处 =====
    const footY = cardY + cardH - pad - 24;
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
