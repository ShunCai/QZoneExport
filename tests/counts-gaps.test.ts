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
/** 从 (年,月) 到今天的总月数（computeGaps 的跨度口径：含首尾、含尾部断档） */
function spanFrom(y: number, m: number): number {
    return (nowY - y) * 12 + (nowM - m) + 1;
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
        // 跨度 = 首条内容 → 今天（尾部断档计入），不再只到末条内容
        const span = spanFrom(2013, 1);
        expect(result!.totalMonths).toBe(span);
        expect(result!.activeMonths).toBe(4);
        expect(result!.silentMonths).toBe(span - 4);
        expect(result!.longestGapMonths).toBe(blankMonths([2017, 1], [nowY, nowM]));
        expect(result!.gapStart).toBe('2017年02月');
        expect(result!.gapEnd).toBe(`${nowY}年${nowM}月`);
        expect(result!.gapOngoing).toBe(true);
        // Top3：尾部第一，中间「2013年3月→2016年10月」第二
        expect(result!.topGaps[0]!.ongoing).toBe(true);
        expect(result!.topGaps[1]!.months).toBe(blankMonths([2013, 2], [2016, 11]));
        expect(result!.totalGaps).toBeGreaterThanOrEqual(result!.topGaps.length);
        // 尾部断档跨过的年份也算空白年份
        expect(result!.emptyYears).toContain('2014年');
        expect(result!.emptyYears).toContain('2015年');
        expect(result!.emptyYears).toContain(`${nowY}年`);
        expect(result!.emptyYears).not.toContain('2013年');
    });

    it('首月不是 1 月时，断档区间的年月不能偏移（回归）', () => {
        // 首个内容月是 2010年10月：索引零点是 10 月，不是 1 月。
        // 曾用 floor(idx/12) 还原，导致区间整体偏移 9 个月（把 2024年9月显示成 2023年12月）。
        const result = computeGaps(
            stat([
                ['2010年10月', 1],
                ['2010年11月', 1],
                ['2016年12月', 1],
            ]),
        );
        // 中间断档：2010年11月 之后到 2016年12月 之前 = 2010年12月 ~ 2016年11月（72 个月）
        expect(result!.topGaps.some((g) => g.start === '2010年12月' && g.end === '2016年11月' && g.months === 72)).toBe(true);
        // 不能出现偏移后的错误年月
        expect(result!.topGaps.some((g) => g.start === '2010年3月' || g.end === '2016年2月')).toBe(false);
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

    it('沉默占比按「首条 → 今天」口径计算', () => {
        const result = computeGaps(
            stat([
                ['2013年01月', 1],
                ['2013年04月', 1],
            ]),
        );
        const span = spanFrom(2013, 1);
        expect(result!.totalMonths).toBe(span);
        expect(result!.silentMonths).toBe(span - 2);
        expect(result!.silentPercent).toBe(Math.round(((span - 2) / span) * 100));
        expect(result!.emptyYears).toContain(`${nowY}年`);
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
        expect(result!.emptyYears).toContain('2014年');
        expect(result!.emptyYears).toContain('2015年');
        expect(result!.emptyYears).toContain(`${nowY}年`);
    });
});
