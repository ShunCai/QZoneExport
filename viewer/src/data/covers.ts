import { assetUrl, loadList } from './sources';
import { PHOTO_TIME_FIELDS } from './counts';
import { isValidTimestampMs, timeValue } from './format';
import { photoThumbUrl } from './media';

/** Hero 九宫格的一格：本地缩略图 + 分享卡片用的外链 + 所属相册（点击跳该相册详情） */
export interface CoverPhoto {
    thumb: string;
    remote: string;
    albumId: string;
}

interface AlbumCover {
    url: string;
    remote: string;
    albumId: string;
    /** 该相册最近一次上传的时间，用于「最近上传的相册」排序 */
    latestUpload: number;
}

/** 相册里的视频条目：is_video 或本地文件是 mp4 或带 video_info */
function isVideoPhoto(photo: Record<string, any>): boolean {
    const local = String(photo.custom_filepath || photo.custom_filename || '');
    return photo.is_video === true || !!photo.video_info || /\.(mp4|mov|avi|mkv|m3u8)(\?|$)/i.test(local);
}

/**
 * 分享卡片用的外链地址。
 *
 * 备份里同时存了本地文件和 QQ 图片 CDN 的原始外链；分享卡片在 file:// 下
 * 不能把本地图片画进可导出的 canvas（不透明源会污染画布），但 CDN 会回显
 * Origin，因此用 https + crossOrigin=anonymous 就能导出真图。
 * 视频条目只取预览图（pre / custom_pre_url），绝不取 mp4 流；加载失败时由调用方兜底色块。
 */
function remoteUrl(photo: Record<string, any>): string {
    // 视频严格只认预览图外链，避免误取到 mp4 / 视频原图
    const candidates = isVideoPhoto(photo)
        ? [photo.custom_pre_url, photo.pre]
        : [photo.custom_pre_url, photo.pre, photo.custom_url, photo.url, photo.yurl];
    for (const raw of candidates) {
        if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) continue;
        if (/\.mp4|\.m3u8|photovideo|f20\.mp4|h265/i.test(raw)) continue;
        return raw.replace(/^http:\/\//i, 'https://');
    }
    return '';
}

/** 本地缩略图：视频必须落到预览图，不能指向 mp4（img 会加载失败） */
function localThumb(photo: Record<string, any>): string {
    const preview = typeof photo.custom_pre_filepath === 'string' ? photo.custom_pre_filepath : '';
    if (preview && !/\.(mp4|m3u8)(\?|$)/i.test(preview)) return assetUrl(preview);
    const url = photoThumbUrl(photo);
    return /\.(mp4|m3u8)(\?|$)/i.test(url) ? '' : url;
}

/** 相片上传时间（毫秒）；非法时间（1970 占位、未来哨兵等）按 0 处理 */
function photoUploadTime(photo: Record<string, any>): number {
    const ts = timeValue(PHOTO_TIME_FIELDS.timeOf(photo));
    return isValidTimestampMs(ts) ? ts : 0;
}

/**
 * 取一个相册里「最新上传的那一张」，同时把它的上传时间作为相册活跃度。
 *
 * 不用相册自带的 lastuploadtime/createtime：不少老备份只有相片里有时间，
 * 相册级字段全缺（本仓库的样例备份就是如此），混用秒/毫秒还会排错序。
 * 统一用相片时间，口径一致且一定有值。
 */
function albumCover(album: Record<string, any>): AlbumCover | null {
    let url = '';
    let remote = '';
    let latestUpload = 0;
    for (const photo of album.photoList || []) {
        const ts = photoUploadTime(photo);
        if (!ts || ts < latestUpload) continue;
        const candidate = localThumb(photo);
        if (!candidate) continue;
        url = candidate;
        remote = remoteUrl(photo);
        latestUpload = ts;
    }
    if (!url) return null;
    return { url, remote, albumId: String(album.id ?? ''), latestUpload };
}

/**
 * 九宫格取图规则：**最近有上传的 9 个相册，各取其中最新上传的 1 张**。
 * 不再按相册顺序一路平铺，避免前 5 格都来自同一个相册。
 */
export async function loadCoverPhotos(): Promise<CoverPhoto[]> {
    const albums = await loadList('albums');
    const ranked = albums
        .map(albumCover)
        .filter((cover): cover is AlbumCover => cover !== null)
        .sort((a, b) => b.latestUpload - a.latestUpload);

    const seen = new Set<string>();
    const out: CoverPhoto[] = [];
    for (const cover of ranked) {
        if (seen.has(cover.url)) continue;
        seen.add(cover.url);
        out.push({ thumb: cover.url, remote: cover.remote, albumId: cover.albumId });
        if (out.length >= 9) break;
    }
    return out;
}
