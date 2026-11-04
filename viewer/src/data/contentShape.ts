/**
 * 内容形态（纯文字 / 含图片 / 含视频）
 *
 * 字段与 items/MessageItem.vue 的媒体渲染保持一致：
 * - custom_videos：独立视频数组
 * - custom_images：图片数组，其中 is_video && video_info 的条目实际也是视频
 * 一条说说同时含图和视频时归入「含视频」（视频优先），保证三类互斥、筛选结果不重复计数。
 */
export type ContentShape = 'text' | 'image' | 'video';
export type ContentShapeFilter = 'all' | ContentShape;

export function contentShapeOf(item: Record<string, any>): ContentShape {
    const videos = item?.custom_videos;
    if (Array.isArray(videos) && videos.length > 0) return 'video';

    const images = item?.custom_images;
    if (Array.isArray(images) && images.length > 0) {
        if (images.some((img) => img?.is_video && img?.video_info)) return 'video';
        return 'image';
    }
    return 'text';
}

export const CONTENT_SHAPE_OPTIONS = [
    { value: 'all', label: '全部形态' },
    { value: 'text', label: '纯文字' },
    { value: 'image', label: '含图片' },
    { value: 'video', label: '含视频' },
] as const;

export function matchesContentShape(item: Record<string, any>, shape: ContentShapeFilter): boolean {
    return shape === 'all' || contentShapeOf(item) === shape;
}
