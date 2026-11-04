// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
    classifyModuleStatus,
    classifyMediaPath,
    computeMediaStats,
    localPathRatio,
    type MediaStats,
} from '../viewer/src/data/counts';

const emptyStat = (): MediaStats => ({
    photos: 0,
    videos: 0,
    localPhotos: 0,
    localVideos: 0,
    externalPhotos: 0,
    externalVideos: 0,
    unknownPhotos: 0,
    unknownVideos: 0,
});

describe('模块备份状态：消解卡片「0」的歧义', () => {
    it('数据文件缺失优先判为 missing，即便总数意外非 0', () => {
        expect(classifyModuleStatus(false, 0)).toBe('missing');
        expect(classifyModuleStatus(false, 5)).toBe('missing');
    });

    it('文件存在但 0 条 = 已备份无内容，有数据 = 正常', () => {
        expect(classifyModuleStatus(true, 0)).toBe('empty');
        expect(classifyModuleStatus(true, 12)).toBe('ok');
    });
});

describe('媒体路径归类', () => {
    it('无路径 / 空串归为 unknown，不再被误算成本地', () => {
        expect(classifyMediaPath(undefined)).toBe('unknown');
        expect(classifyMediaPath(null)).toBe('unknown');
        expect(classifyMediaPath('')).toBe('unknown');
        expect(classifyMediaPath('   ')).toBe('unknown');
        expect(classifyMediaPath(123)).toBe('unknown');
    });

    it('外链 URL 与协议相对地址归 external，根相对路径归 local', () => {
        expect(classifyMediaPath('https://qpic.cn/a.jpg')).toBe('external');
        expect(classifyMediaPath('http://qpic.cn/a.jpg')).toBe('external');
        expect(classifyMediaPath('//qpic.cn/a.jpg')).toBe('external');
        expect(classifyMediaPath('Albums/images/a.jpg')).toBe('local');
    });
});

describe('媒体统计口径', () => {
    it('排除「说说和日志相册」，并把无路径条目单列 unknown', () => {
        const albums = [
            {
                name: '普通相册',
                photoList: [
                    { custom_filepath: 'Albums/images/a.jpg' },
                    { custom_url: 'https://qpic.cn/b.jpg' },
                    {},
                ],
            },
            { name: '说说和日志相册', photoList: [{ custom_filepath: 'ignored.jpg' }] },
        ];
        const videos = [
            { url3: 'Videos/a.mp4' },
            { url3: 'https://v.qq.com/b.mp4' },
            {},
        ];
        const s = computeMediaStats(albums, videos);
        expect(s.photos).toBe(3);
        expect(s.localPhotos).toBe(1);
        expect(s.externalPhotos).toBe(1);
        expect(s.unknownPhotos).toBe(1);
        expect(s.videos).toBe(3);
        expect(s.localVideos).toBe(1);
        expect(s.externalVideos).toBe(1);
        expect(s.unknownVideos).toBe(1);
    });

    it('空备份返回全 0', () => {
        expect(computeMediaStats([], [])).toEqual(emptyStat());
    });
});

describe('本地路径占比', () => {
    it('分母含「无路径」条目，避免比例虚高', () => {
        const s: MediaStats = {
            ...emptyStat(),
            photos: 4,
            videos: 1,
            localPhotos: 2,
            externalPhotos: 1,
            unknownPhotos: 1,
            unknownVideos: 1,
        };
        // 2 / (4+1) = 40%；若把 unknown 从分母剔除会虚高成 2/3 = 67%
        expect(localPathRatio(s)).toBe(40);
    });

    it('无媒体时返回 0，不产生 NaN', () => {
        expect(localPathRatio(emptyStat())).toBe(0);
    });
});

