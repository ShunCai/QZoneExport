import { describe, expect, it } from 'vitest';
import { mergeCityCounts } from '../viewer/src/data/cityStats';

const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
const geoJson = {
    features: [
        { properties: { name: '广州市', parent: { adcode: 440000 } }, geometry: { type: 'Polygon', coordinates: [square] } },
        { properties: { name: '佛山市', parent: { adcode: 440000 } }, geometry: { type: 'MultiPolygon', coordinates: [[[[20, 20], [30, 20], [30, 30], [20, 30]]]] } },
    ],
};

describe('mergeCityCounts', () => {
    it('有 cityHint 时优先用逆地理编码结果，其余按坐标归属', () => {
        const rows = mergeCityCounts([
            { cityHint: '深圳市', posX: 0, posY: 0 },
            { cityHint: '深圳市', posX: 0, posY: 0 },
            { posX: 5, posY: 5 },
            { posX: 25, posY: 25 },
        ], geoJson);
        expect(rows).toEqual([
            { name: '深圳市', value: 2 },
            { name: '广州市', value: 1 },
            { name: '佛山市', value: 1 },
        ]);
    });

    it('全部没有 cityHint 时退化为坐标归属', () => {
        const rows = mergeCityCounts([{ posX: 5, posY: 5 }], geoJson);
        expect(rows).toEqual([{ name: '广州市', value: 1 }]);
    });
});
