import { describe, expect, it } from 'vitest';
import { assignRegions, countByRegion, inPolygon } from '../viewer/src/data/mapRegions';

const square: number[][] = [[0, 0], [10, 0], [10, 10], [0, 10]];

/** 两个正方形区域：A 在左下，B 在右上（MultiPolygon 也用同样的环结构） */
const geoJson = {
    features: [
        {
            properties: { name: 'A_raw' },
            geometry: { type: 'Polygon', coordinates: [square] },
        },
        {
            properties: { name: 'B_raw' },
            geometry: {
                type: 'MultiPolygon',
                coordinates: [[[[20, 20], [30, 20], [30, 30], [20, 30]]]],
            },
        },
    ],
};

describe('inPolygon', () => {
    it('点在多边形内 / 外', () => {
        expect(inPolygon([5, 5], square)).toBe(true);
        expect(inPolygon([15, 5], square)).toBe(false);
        expect(inPolygon([-1, 5], square)).toBe(false);
    });

    it('顶点与边缘视为命中（与原实现口径一致）', () => {
        expect(inPolygon([0, 0], square)).toBe(true);
        expect(inPolygon([10, 10], square)).toBe(true);
    });
});

describe('countByRegion', () => {
    it('按区域统计点数，bbox 粗筛不改变结果', () => {
        const points = [
            { posX: 5, posY: 5 },
            { posX: 6, posY: 6 },
            { posX: 25, posY: 25 },
            { posX: 100, posY: 100 },
        ];
        const result = countByRegion(points, geoJson);
        expect(result).toEqual([
            { name: 'A_raw', value: 2 },
            { name: 'B_raw', value: 1 },
        ]);
    });

    it('nameMap 重映射区域名', () => {
        const result = countByRegion([{ posX: 5, posY: 5 }], geoJson, { A_raw: '甲', B_raw: '乙' });
        expect(result.map((item) => item.name)).toEqual(['甲', '乙']);
    });

    it('geoJson 为空时返回空数组', () => {
        expect(countByRegion([{ posX: 1, posY: 1 }], null)).toEqual([]);
        expect(countByRegion([], {})).toEqual([]);
    });
});


describe('assignRegions', () => {
    it('把点归到所属区域并支持 nameMap', () => {
        const result = assignRegions([
            { tid: 'a', posX: 5, posY: 5 },
            { tid: 'b', posX: 25, posY: 25 },
            { tid: 'c', posX: 100, posY: 100 },
        ], geoJson, { A_raw: '甲', B_raw: '乙' });
        expect(result.get('a')).toBe('甲');
        expect(result.get('b')).toBe('乙');
        expect(result.has('c')).toBe(false);
    });

    it('空 geoJson 返回空映射', () => {
        expect(assignRegions([{ tid: 'x', posX: 5, posY: 5 }], null).size).toBe(0);
    });
});
