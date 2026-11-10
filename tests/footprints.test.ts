import { describe, expect, it } from 'vitest';
import { topPlaceOf, visitCountOf, type Footprint } from '../viewer/src/data/footprints';

function fp(tid: string, name: string, posX = 113, posY = 23): Footprint {
    return { tid, source: 'messages', name, posX, posY, time: 0, summary: '', content: '', html: '', thumb: '' };
}

describe('topPlaceOf', () => {
    it('按地点名取出现次数最多的地点', () => {
        expect(topPlaceOf([fp('1', 'A'), fp('2', 'B'), fp('3', 'A')])).toEqual({ name: 'A', count: 2 });
    });

    it('空数据返回 null', () => {
        expect(topPlaceOf([])).toBeNull();
    });
});

describe('visitCountOf', () => {
    it('统计同坐标打卡次数', () => {
        const items = [fp('1', 'A'), fp('2', 'B'), fp('3', 'A', 114, 24)];
        expect(visitCountOf(items, items[0]!)).toBe(2);
    });
});
