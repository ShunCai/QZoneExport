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

/** 尾部终点 = 打开查看器的今天 */
const nowY = new Date().getFullYear();
const nowM = new Date().getMonth() + 1;
/** 两个 (年, 月) 之间的空白整月数（与 computeGaps 同口径：索引差 - 1） */
function blankMonths(from: [number, number], to: [number, number]): number {
    return (to[0] - from[0]) * 12 + (to[1] - from[1]) - 1;
}

describe('computeGaps', () => {
    it('中间断档与尾部断档并列取最长（尾部 117 > 中间 43）', () => {
        // 活跃：2013-01、2013-02、2016-11、2017-01
        // 尾部：2017年02月 → 2026年11月 = 117；中间：2013年03月 → 2016年10月 = 43
        const result = computeGaps(
            stat([
                ['2013年01月', 2],
                ['2013年02月', 1],
                ['2016年11月', 3],
                ['2017年01月', 1],
            ]),
        );
        expect(result).not.toBeNull();
        expect(result!.totalMonths).toBe(49); // 首末内容间跨度（不含尾部）
        expect(result!.activeMonths).toBe(4);
        expect(result!.silentMonths).toBe(45);
        expect(result!.longestGapMonths).toBe(blankMonths([2017, 1], [nowY, nowM]));
        expect(result!.gapStart).toBe('2017年2月');
        expect(result!.gapEnd).toBe(`${nowY}年${nowM}月`);
        expect(result!.gapOngoing).toBe(true);
        // Top3：尾部第一，中间「2013年3月→2016年10月」第二
        expect(result!.topGaps[0]!.ongoing).toBe(true);
        expect(result!.topGaps[1]!.months).toBe(blankMonths([2013, 2], [2016, 11]));
        expect(result!.emptyYears).toEqual(['2014年', '2015年']);
    });

    it('中间断档长于尾部时取中间', () => {
        // 活跃：2013-01、2020-01、当前月 → 尾部 0，最长 = 2013年02月 → 2019年12月
        const result = computeGaps(
            stat([
                ['2013年01月', 1],
                ['2020年01月', 1],
                [`${nowY}年${String(nowM).padStart(2, '0')}月`, 1],
            ]),
        );
        expect(result!.gapOngoing).toBe(false);
        expect(result!.longestGapMonths).toBe(blankMonths([2013, 1], [2020, 1]));
    });

    it('沉默占比取整（不含尾部）', () => {
        const result = computeGaps(
            stat([
                ['2013年01月', 1],
                ['2013年04月', 1],
            ]),
        );
        // 跨 4 个月（2013-01~04），活跃 2，沉默 2 → 50%（silentMonths 只算首末之间）
        expect(result!.silentPercent).toBe(50);
    });

    it('活跃月不足 2 个返回 null', () => {
        expect(computeGaps(stat([['2013年01月', 1]]))).toBeNull();
        expect(computeGaps(stat([]))).toBeNull();
    });

    it('内容覆盖至当前月且连续时最长断档为 0', () => {
        const entries: [string, number][] = [];
        for (let m = 1; m <= nowM; m++) {
            entries.push([`${nowY}年${String(m).padStart(2, '0')}月`, 1]);
        }
        const result = computeGaps(stat(entries));
        expect(result!.longestGapMonths).toBe(0);
        expect(result!.gapOngoing).toBe(false);
    });

    it('高峰月与活跃年数', () => {
        const result = computeGaps(
            stat([
                ['2013年01月', 5],
                ['2013年02月', 2],
                ['2016年11月', 9],
            ]),
        );
        expect(result!.peakMonth).toEqual({ month: '2016年11月', count: 9 });
        expect(result!.activeYearCount).toBe(2);
        expect(result!.emptyYears).toEqual(['2014年', '2015年']);
    });
});
