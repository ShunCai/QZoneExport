// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { contentShapeOf, matchesContentShape } from '../viewer/src/data/contentShape';

describe('内容形态筛选（说说列表）', () => {
    it('三类互斥：纯文字 / 含图 / 含视频', () => {
        expect(contentShapeOf({ content: '只有文字' })).toBe('text');
        expect(contentShapeOf({ custom_images: [{ url: 'a.jpg' }] })).toBe('image');
        expect(contentShapeOf({ custom_videos: [{ video_info: {} }] })).toBe('video');
    });

    it('custom_images 里的视频条目也归为视频，且视频优先于图片', () => {
        expect(contentShapeOf({ custom_images: [{ is_video: true, video_info: { video_url: 'a.mp4' } }] })).toBe('video');
        expect(contentShapeOf({
            custom_images: [{ url: 'a.jpg' }],
            custom_videos: [{ video_info: {} }],
        })).toBe('video');
    });

    it('空数组不算有媒体；all 放行全部', () => {
        expect(contentShapeOf({ custom_images: [], custom_videos: [] })).toBe('text');
        const item = { custom_images: [{ url: 'a.jpg' }] };
        expect(matchesContentShape(item, 'all')).toBe(true);
        expect(matchesContentShape(item, 'image')).toBe(true);
        expect(matchesContentShape(item, 'video')).toBe(false);
    });
});
