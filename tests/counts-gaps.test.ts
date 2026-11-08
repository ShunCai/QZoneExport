import { describe, expect, it } from 'vitest';
import { computeGaps, type MonthlyStat } from '../viewer/src/data/counts';

/** 造月度数据：key 格式与 monthOf 产出一致（yyyy年MM月） */
function stat(entries: [string, number][]): MonthlyStat {
    const months = new Map(entries);
    let firstMonth = '';
    let lastMonth = '';
    for (const m of months.keys()) {
        if (!firstMonth || m < firstMonth) firstMonth = m;
        if (!lastMonth || m > lastMonth) lastMonth = m;
    }
    return { months, firstMonth, lastMonth };
}

describe('computeGaps', () => {
    it('计算跨度、沉默月与最长断档', () => {
        // 2013年01月~2017年01月：共 49 个月；活跃 4 个月；最长断档 2013年03月→2016年10月 44 个月
        const result = computeGaps(
            stat([
                ['2013年01月', 2],
                ['2013年02月', 1],
                ['2016年11月', 3],
                ['2017年01月', 1],
            ]),
        );
        expect(result).not.toBeNull();
        expect(result!.totalMonths).toBe(49);
        expect(result!.activeMonths).toBe(4);
        expect(result!.silentMonths).toBe(45);
        expect(result!.longestGapMonths).toBe(44);
        expect(result!.gapStart).toBe('2013年3月');
        expect(result!.gapEnd).toBe('2016年10月');
        expect(result!.emptyYears).toEqual(['2014年', '2015年']);
    });

    it('沉默占比取整', () => {
        const result = computeGaps(
            stat([
                ['2013年01月', 1],
                ['2013年04月', 1],
            ]),
        );
        // 跨 4 个月，活跃 2，沉默 2 → 50%
        expect(result!.silentPercent).toBe(50);
    });

    it('活跃月不足 2 个返回 null', () => {
        expect(computeGaps(stat([['2013年01月', 1]]))).toBeNull();
        expect(computeGaps(stat([]))).toBeNull();
    });

    it('连续无断档时 longestGap 为 0', () => {
        const result = computeGaps(
            stat([
                ['2013年01月', 1],
                ['2013年02月', 1],
                ['2013年03月', 1],
            ]),
        );
        expect(result!.longestGapMonths).toBe(0);
        expect(result!.silentMonths).toBe(0);
        expect(result!.emptyYears).toEqual([]);
    });
});
