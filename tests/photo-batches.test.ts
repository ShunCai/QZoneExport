import { describe, expect, it } from 'vitest';
import { groupPhotoBatches, photoBatchId } from '../viewer/src/data/photoBatches';

type P = { name: string; uploadTime: string; batchId?: string | number };
const p = (name: string, time: string, batchId?: string | number): P => ({ name, uploadTime: time, batchId });
const timeOf = (photo: P): string => photo.uploadTime;
const names = (groups: P[][]): string[][] => groups.map((g) => g.map((x) => x.name));

describe('photoBatchId', () => {
    it('把 0 / 空 / 字符串化的 null 视为无批次', () => {
        expect(photoBatchId({ batchId: '1676693425097' })).toBe('1676693425097');
        expect(photoBatchId({ batchId: 0 })).toBe('');
        expect(photoBatchId({ batchId: '0' })).toBe('');
        expect(photoBatchId({ batchId: '' })).toBe('');
        expect(photoBatchId({})).toBe('');
        expect(photoBatchId({ batchId: 'null' })).toBe('');
    });
});

describe('groupPhotoBatches', () => {
    it('无 batchId 时沿用 1 小时窗口（按批首时间）', () => {
        const photos = [
            p('a', '2020-01-01 10:00:00'),
            p('b', '2020-01-01 10:30:00'),
            p('c', '2020-01-01 11:01:00'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['a', 'b'], ['c']]);
    });

    it('不同 batchId 即使时间挨着也不合并', () => {
        const photos = [
            p('a', '2020-01-01 10:00:00', 'B1'),
            p('b', '2020-01-01 10:01:00', 'B2'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['a'], ['b']]);
    });

    it('同一 batchId 超过 1 小时仍归为一批', () => {
        const photos = [
            p('a', '2020-01-01 10:00:00', 'B1'),
            p('b', '2020-01-01 13:20:00', 'B1'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['a', 'b']]);
    });

    it('batchId 为 0 的相片退回时间窗口，且不与有效批次混合', () => {
        const photos = [
            p('a', '2020-01-01 10:00:00', '0'),
            p('b', '2020-01-01 10:10:00', '0'),
            p('c', '2020-01-01 10:20:00', 'B1'),
            p('d', '2020-01-01 10:21:00', 'B1'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['a', 'b'], ['c', 'd']]);
    });

    it('同一 id 被复用跨年时按 maxSpanMs 拆开', () => {
        const photos = [
            p('a', '2012-01-01 10:00:00', 'SAME'),
            p('b', '2020-01-01 10:00:00', 'SAME'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf, { maxSpanMs: 24 * 3600 * 1000 }))).toEqual([['a'], ['b']]);
    });

    it('同一 batchId 的相片在时间上交错也归到一组，结果按首张时间排序', () => {
        const photos = [
            p('a2', '2020-01-01 10:30:00', 'A'),
            p('b1', '2020-01-01 10:05:00', 'B'),
            p('a1', '2020-01-01 10:00:00', 'A'),
            p('b2', '2020-01-01 10:10:00', 'B'),
        ];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['a1', 'a2'], ['b1', 'b2']]);
    });

    it('忽略时间为空/非法的相片', () => {
        const photos = [p('bad', ''), p('ok', '2020-01-01 10:00:00', 'B1')];
        expect(names(groupPhotoBatches(photos, timeOf))).toEqual([['ok']]);
    });
});
