import { describe, expect, it } from 'vitest';
import { isCoarseCoord, isLocatable, isUsableCoord, topPlaceOf, visitCountOf, type Footprint } from '../viewer/src/data/footprints';

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

describe('isCoarseCoord', () => {
    it('经纬度都被截成整数时视为粗略坐标', () => {
        expect(isCoarseCoord(110, 21)).toBe(true);
        expect(isCoarseCoord(120, 30)).toBe(true);
    });

    it('任一小数位存在就是正常精度', () => {
        expect(isCoarseCoord(110.733452, 21.845022)).toBe(false);
        expect(isCoarseCoord(110, 21.845022)).toBe(false);
        expect(isCoarseCoord(110.733452, 21)).toBe(false);
    });
});

describe('isUsableCoord / isLocatable', () => {
    it('QQ 占位坐标 pos_x = pos_y = 0.00009 不可用', () => {
        expect(isUsableCoord(0.00009, 0.00009)).toBe(false);
        expect(isLocatable(0.00009, 0.00009)).toBe(false);
    });

    it('真的在 (0,0) 附近、但两值不相等的坐标照常可用（不误杀）', () => {
        expect(isUsableCoord(0.005, 0.008)).toBe(true);
        expect(isLocatable(0.005, 0.008)).toBe(true);
        expect(isUsableCoord(0.5, 0.5)).toBe(true);
    });

    it('正常坐标可用且可定位', () => {
        expect(isUsableCoord(110.733452, 21.845022)).toBe(true);
        expect(isLocatable(110.733452, 21.845022)).toBe(true);
    });

    it('越界或非数字不可用', () => {
        expect(isUsableCoord(200, 21)).toBe(false);
        expect(isUsableCoord(110, 95)).toBe(false);
        expect(isUsableCoord(Number.NaN, 21)).toBe(false);
    });

    it('整数度粗坐标范围合法，但不用于定位', () => {
        expect(isUsableCoord(110, 21)).toBe(true);
        expect(isLocatable(110, 21)).toBe(false);
    });
});
