/**
 * 备份面板工具函数（格式化、转义、媒体类型判断）
 */

import { MODULES, getModuleLabel } from '../../core/shared/backup-options';

/** 字节数 → 人类可读字符串 */
export function fmtBytes(b?: number): string {
    if (b == null || Number.isNaN(b)) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
    return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/** 毫秒 → 人类可读时长 */
export function fmtDuration(ms?: number): string {
    if (ms == null || Number.isNaN(ms) || !isFinite(ms) || ms < 0) return '-';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60); const r = s % 60;
    if (m < 60) return m + 'm' + (r > 0 ? r + 's' : '');
    const h = Math.floor(m / 60); const mm = m % 60;
    return h + 'h' + (mm > 0 ? mm + 'm' : '');
}

/** 文件名是否为图片 */
export function isImageName(name?: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp|svg|tif?f)$/i.test(name || '');
}

/** 文件名是否为视频 */
export function isVideoName(name?: string): boolean {
    return /\.(mp4|m4v|mov|wmv|avi|mkv|flv|m3u8|ts|webm)$/i.test(name || '');
}

/** HTML 实体转义 */
export function escapeHtml(s: unknown): string {
    if (s == null) return '';
    const str = String(s);
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** HTML 属性值转义（复用 escapeHtml） */
export function escapeAttr(s: unknown): string { return escapeHtml(s); }

/** 对 CSS url() 里作为 background-image 的 URL 做基本转义 */
export function cssEscapeUrl(url: string): string {
    if (!url) return '';
    return String(url).replace(/'/g, "%27").replace(/\n/g, '');
}

const MODULE_ORDER: string[] = MODULES.map((m) => m.value);

/**
 * 同步「按模块筛选」下拉选项：按当前数据中的模块集合（去重，并按 MODULES 顺序排序）重建选项，
 * 保留「全部模块」首项；仅在选项集合变化时重建（用 dataset.sig 兜底），避免每帧重绘。
 * 若当前选择值已不在新集合中（例如明细数据变化），修正为 'all' 并返回。
 */
export function syncModuleFilterOptions(sel: HTMLSelectElement, current: string, modules: string[], labelMap?: Record<string, string>): string {
    // 相册子项键是 `Photos:<albumId>`（每个相册一个可筛选值），原按「找不到 → 999」全排末尾，
    // 几十个相册会把下拉尾部占满、淹没后面的模块。归到 Photos 的位置即可，值与筛选语义不变。
    const orderOf = (m: string): number => {
        const base = m.startsWith('Photos:') ? 'Photos' : m;
        const i = MODULE_ORDER.indexOf(base);
        return i < 0 ? 999 : i;
    };
    const wanted = Array.from(new Set((modules || []).filter(Boolean)))
        .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b, 'zh'));
    const sig = wanted.join('�');
    if (sel.dataset.sig !== sig) {
        const opts = ['<option value="all">全部模块</option>']
            .concat(wanted.map((m) => `<option value="${escapeAttr(m)}">${escapeHtml(labelMap?.[m] ?? getModuleLabel(m))}</option>`));
        sel.innerHTML = opts.join('');
        sel.dataset.sig = sig;
    }
    if (current !== 'all' && wanted.indexOf(current) < 0) return 'all';
    return current;
}

