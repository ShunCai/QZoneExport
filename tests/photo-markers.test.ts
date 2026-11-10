import { describe, expect, it } from 'vitest';
import { pickPhotoMarkers } from '../viewer/src/data/photoMarkers';
import type { Footprint } from '../viewer/src/data/footprints';

function photo(
    tid: string,
    posX: number,
    posY: number,
    time: number,
    preview = `${tid}.jpg`,
): Footprint {
    return {
        tid,
        source: 'photos',
        name: '某地',
        posX,
        posY,
        time,
        summary: '',
        content: '',
        html: '',
        thumb: preview,
        preview,
    };
}

describe('pickPhotoMarkers', () => {
    it('只收带缩略图的相片，说说不上图', () => {
        const message: Footprint = {
            tid: 'm1', source: 'messages', name: '某地', posX: 113, posY: 23,
            time: 1, summary: '', content: '', html: '', thumb: 'a.jpg',
        };
        const noPreview = { ...photo('p2', 114, 24, 2), preview: '' };
        const picked = pickPhotoMarkers([message, noPreview, photo('p3', 115, 25, 3)], 10);
        expect(picked.map((item) => item.tid)).toEqual(['p3']);
    });

    it('同坐标只挑最新一张，且先保证每个地点都有一张', () => {
        const items = [
            photo('a1', 113.0, 23.0, 100),
            photo('a2', 113.0, 23.0, 300),
            photo('b1', 121.0, 31.0, 200),
            photo('c1', 116.0, 39.0, 150),
        ];
        const picked = pickPhotoMarkers(items, 3);
        expect(picked).toHaveLength(3);
        // 三个坐标各一张；a 桶取最新的 a2
        expect(new Set(picked.map((item) => item.tid))).toEqual(new Set(['a2', 'b1', 'c1']));
        // 地点按各自最新时间倒序：a(300) → b(200) → c(150)
        expect(picked.map((item) => item.tid)).toEqual(['a2', 'b1', 'c1']);
    });

    it('额度有余时按桶内张数补，热点地点更密', () => {
        const items = [
            photo('a1', 113.0, 23.0, 400),
            photo('a2', 113.0, 23.0, 300),
            photo('a3', 113.0, 23.0, 200),
            photo('b1', 121.0, 31.0, 500),
        ];
        const picked = pickPhotoMarkers(items, 3);
        expect(picked.map((item) => item.tid)).toEqual(['b1', 'a1', 'a2']);
    });

    it('不超过 limit，limit<=0 直接空', () => {
        const items = Array.from({ length: 30 }, (_, i) => photo(`p${i}`, 100 + i, 20 + i, i));
        expect(pickPhotoMarkers(items, 5)).toHaveLength(5);
        expect(pickPhotoMarkers(items, 0)).toEqual([]);
    });

    it('坐标精度按小数点后 4 位合并（≈11 米内的照片算同一处）', () => {
        const items = [
            photo('near1', 113.12344, 23.12344, 100),
            photo('near2', 113.12341, 23.12341, 200),
            photo('far', 113.2, 23.2, 300),
        ];
        expect(pickPhotoMarkers(items, 2).map((item) => item.tid)).toEqual(['far', 'near2']);
    });
});
