// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { scanEmoji, topEmojis } from '../viewer/src/data/emojiStats';
import { clockOf, collectNightDialogs, isLateNight } from '../viewer/src/data/nightCompanions';

describe('最常用的表情统计', () => {
    it('累加 [em] 次数，同一编号合并', () => {
        const counts = new Map<string, number>();
        scanEmoji('好[em]e120[/em]笑[em]e120[/em]', counts);
        scanEmoji('[em]e106[/em]', counts);
        expect(counts.get('120')).toBe(2);
        expect(counts.get('106')).toBe(1);
    });

    it('空值/无表情不抛错', () => {
        const counts = new Map<string, number>();
        scanEmoji('', counts);
        scanEmoji(null, counts);
        scanEmoji('普通文字', counts);
        expect(counts.size).toBe(0);
    });

    it('按次数降序，同次数按编号稳定排序', () => {
        const counts = new Map<string, number>([['120', 3], ['106', 3], ['105', 5]]);
        expect(topEmojis(counts, 3).map((r) => r.id)).toEqual(['105', '106', '120']);
    });

    it('limit 生效', () => {
        const counts = new Map<string, number>([['1', 5], ['2', 4], ['3', 3]]);
        expect(topEmojis(counts, 2)).toHaveLength(2);
        expect(topEmojis(counts, 0)).toEqual([]);
    });
});

describe('深夜对话（有来有往）', () => {
    /** 构造一个指定小时的时间戳（毫秒） */
    const at = (hour: number, minute = 0): number => new Date(2024, 4, 16, hour, minute).getTime();
    const sec = (hour: number, minute = 0): number => Math.floor(at(hour, minute) / 1000);
    const ME = '1001';

    it('只有 0–5 点算深夜（5 点算早）', () => {
        expect(isLateNight(at(0))).toBe(true);
        expect(isLateNight(at(4, 59))).toBe(true);
        expect(isLateNight(at(5))).toBe(false);
        expect(isLateNight(at(23))).toBe(false);
        expect(isLateNight(0)).toBe(false);
    });

    it('同一线程双方都在深夜发言 → 记一次对话', () => {
        const messages = [{
            tid: 'm1',
            content: 'x',
            custom_comments: [
                { uin: 2001, name: '夜猫子', postTime: sec(2, 10) },
                { uin: ME, name: '我', postTime: sec(2, 40) },
            ],
        }];
        const rows = collectNightDialogs({ messages, boards: [] }, ME, new Set([ME]), 5);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ uin: '2001', count: 1 });
        expect(clockOf(rows[0]!.latest)).toBe('02:40');
    });

    it('只有对方深夜、我没在深夜参与 → 不算（那只是深夜来访）', () => {
        const messages = [{
            tid: 'm2',
            content: 'x',
            custom_comments: [
                { uin: 2001, name: '夜猫子', postTime: sec(3) },
                { uin: ME, name: '我', postTime: sec(15) }, // 我白天才回
            ],
        }];
        expect(collectNightDialogs({ messages, boards: [] }, ME, new Set([ME]), 5)).toEqual([]);
    });

    it('同一线程多轮也只算一次对话，多条线程累加', () => {
        const messages = [
            {
                tid: 'a',
                content: 'x',
                custom_comments: [
                    { uin: 2001, name: '夜猫子', postTime: sec(1) },
                    { uin: ME, name: '我', postTime: sec(1, 30) },
                    { uin: 2001, name: '夜猫子', postTime: sec(2) },
                ],
            },
            {
                tid: 'b',
                content: 'y',
                custom_comments: [
                    { uin: 2001, name: '夜猫子', postTime: sec(3) },
                    { uin: ME, name: '我', postTime: sec(4) },
                ],
            },
        ];
        const rows = collectNightDialogs({ messages, boards: [] }, ME, new Set([ME]), 5);
        expect(rows[0]).toMatchObject({ uin: '2001', count: 2 });
    });

    it('留言线程同样适用；排除名单生效', () => {
        const boards = [
            {
                uin: 2004, nickname: '留言的人', pubtime: sec(3, 30),
                replyList: [{ uin: ME, nickname: '我', time: sec(3, 50) }],
            },
            {
                uin: 1009, nickname: '被排除的人', pubtime: sec(2),
                replyList: [{ uin: ME, nickname: '我', time: sec(2, 30) }],
            },
        ];
        const rows = collectNightDialogs({ messages: [], boards }, ME, new Set([ME, '1009']), 5);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ uin: '2004', name: '留言的人', count: 1 });
    });

    it('空输入返回空数组；limit 生效', () => {
        expect(collectNightDialogs({ messages: [], boards: [] }, ME, new Set())).toEqual([]);
        const messages = [
            { tid: 'c', content: 'x', custom_comments: [{ uin: 3001, name: 'A', postTime: sec(1) }, { uin: ME, postTime: sec(1, 10) }] },
            { tid: 'd', content: 'y', custom_comments: [{ uin: 3002, name: 'B', postTime: sec(1) }, { uin: ME, postTime: sec(1, 20) }] },
        ];
        expect(collectNightDialogs({ messages, boards: [] }, ME, new Set([ME]), 1)).toHaveLength(1);
    });
});

describe('好友备注优先', () => {
    it('有备注用备注，没备注保留原名；空表原样返回', async () => {
        const { preferRemarks } = await import('../viewer/src/data/friendNames');
        const rows = [{ uin: '2001', name: '夜猫子', count: 2 }, { uin: '2002', name: '偶尔', count: 1 }];
        const remarks = new Map([['2001', '老同学']]);
        expect(preferRemarks(rows, remarks)).toEqual([
            { uin: '2001', name: '老同学', count: 2 },
            { uin: '2002', name: '偶尔', count: 1 },
        ]);
        expect(preferRemarks(rows, new Map())).toBe(rows);
    });
});
