import { assetUrl, loadList } from './sources';
import { PHOTO_TIME_FIELDS } from './counts';
import { isValidTimestampMs, timeValue } from './format';
import { photoThumbUrl } from './media';

/** Hero 九宫格的一格：本地缩略图 + 分享卡片用的外链 + 所属相册（点击跳该相册详情） */
export interface CoverPhoto {
    thumb: string;
    /** 分享卡片主用：相片取原图，视频只取预览图 */
    remote: string;
    /** 原图加载失败时回退到预览图 */
    remoteFallback: string;
    albumId: string;
}

interface AlbumCover {
    url: string;
    remote: string;
    remoteFallback: string;
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
 * 预览图外链：视频主用；相片原图 403 / 超时时由调用方回退到这里。
 */
function previewUrl(photo: Record<string, any>): string {
    for (const raw of [photo.custom_pre_url, photo.pre]) {
        if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) continue;
        if (/\.mp4|\.m3u8|photovideo|f20\.mp4|h265/i.test(raw)) continue;
        return raw.replace(/^http:\/\//i, 'https://');
    }
    return '';
}

/**
 * 分享卡片用的外链地址。
 *
 * 分享卡片在 file:// 下不能把本地图片画进可导出的 canvas（不透明源会污染画布），
 * 但 QQ 图片 CDN 会回显 Origin，用 https + crossOrigin=anonymous 即可导出真图。
 *
 * 相片优先取**原图**（custom_url / url，QQ CDN 以 /r 结尾的全尺寸图），
 * 不再用 pre 预览图——预览图放大到满幅格子会明显发糊。
 * 视频严格只取预览图（custom_pre_url / pre）：它的 custom_url 是 /b&bo= 视频流，绝不能取。
 */
function remoteUrl(photo: Record<string, any>): string {
    if (isVideoPhoto(photo)) return previewUrl(photo);
    const candidates = [photo.custom_url, photo.url, photo.yurl, photo.custom_pre_url, photo.pre];
    for (const raw of candidates) {
        if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) continue;
        if (/\.mp4|\.m3u8|photovideo|f20\.mp4|h265|\/b&bo=/i.test(raw)) continue;
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
    let remoteFallback = '';
    let latestUpload = 0;
    for (const photo of album.photoList || []) {
        const ts = photoUploadTime(photo);
        if (!ts || ts < latestUpload) continue;
        const candidate = localThumb(photo);
        if (!candidate) continue;
        url = candidate;
        remote = remoteUrl(photo);
        remoteFallback = previewUrl(photo);
        latestUpload = ts;
    }
    if (!url) return null;
    return { url, remote, remoteFallback, albumId: String(album.id ?? ''), latestUpload };
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
        out.push({
            thumb: cover.url,
            remote: cover.remote,
            remoteFallback: cover.remoteFallback,
            albumId: cover.albumId,
        });
        if (out.length >= 9) break;
    }
    return out;
}
