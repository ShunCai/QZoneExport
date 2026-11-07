// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
    CARE_LIMIT,
    collectCareFriends,
    collectPersonEvents,
    computeTopPeople,
    rankPeople,
    splitCareSelection,
    type PersonEvent,
    type TopPerson,
} from '../viewer/src/data/top-people';
import { maskName } from '../viewer/src/data/mask';

describe('互动最密切的人（互动页 TOP5）', () => {
    const item = {
        likes: [{ fuin: 2001, nick: 'A' }],
        custom_comments: [
            { uin: 2002, name: 'B', replies: [{ uin: 2001, name: 'A' }] },
        ],
        custom_visitor: { list: [{ uin: 2003, name: 'C' }] },
    };

    it('收集点赞 / 评论 / 评论回复 / 访客四类人', () => {
        const events = collectPersonEvents([item]);
        expect(events).toHaveLength(4);
        expect(events.map((e) => e.kind)).toEqual(['like', 'comment', 'comment', 'visit']);
        expect(events.map((e) => String(e.uin))).toEqual(['2001', '2002', '2001', '2003']);
    });

    it('按「赞 + 评论」排名、同分稳定；纯浏览者不进榜', () => {
        const rows = computeTopPeople(collectPersonEvents([item]), new Set(['1001']));
        // C 只出现在访客名单里（score=0），不参与排名
        expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
        expect(rows[0]).toMatchObject({ uin: '2001', score: 2, likes: 1, comments: 1, visits: 0 });
        expect(rows[1]).toMatchObject({ uin: '2002', score: 1, comments: 1 });
    });

    it('访客计入附注但不影响分数（数据源是采样名单，不能与事件计数等权）', () => {
        const events: PersonEvent[] = [
            { uin: 3001, name: '既赞也逛', kind: 'like' },
            { uin: 3001, name: '既赞也逛', kind: 'visit' },
            { uin: 3001, name: '既赞也逛', kind: 'visit' },
            { uin: 3002, name: '只浏览', kind: 'visit' },
        ];
        const rows = computeTopPeople(events, new Set());
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ uin: '3001', score: 1, likes: 1, visits: 2 });
    });

    it('排除空间主人与备份操作者', () => {
        const events: PersonEvent[] = [
            { uin: 1001, name: '我', kind: 'like' },
            { uin: 1002, name: '操作者', kind: 'like' },
            { uin: 2001, name: 'A', kind: 'comment' },
        ];
        const rows = computeTopPeople(events, new Set(['1001', '1002']));
        expect(rows).toHaveLength(1);
        expect(rows[0]!.uin).toBe('2001');
    });

    it('无 uin 的匿名记录按名字归并，且标记为不可跳转', () => {
        const events: PersonEvent[] = [
            { name: '匿名', kind: 'like' },
            { name: '匿名', kind: 'comment' },
            { uin: 2001, name: 'A', kind: 'visit' },
        ];
        const rows = computeTopPeople(events, new Set());
        // 匿名者 score=2 入榜；2001 只访问过（score=0）被过滤
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ name: '匿名', score: 2, uin: '' });
    });

    it('limit 生效，空事件返回空数组', () => {
        expect(computeTopPeople(collectPersonEvents([item]), new Set(), 2)).toHaveLength(2);
        expect(computeTopPeople([], new Set())).toEqual([]);
    });

    it('rankPeople 不截断：排在几十名的关心好友也能查到分数', () => {
        const events: PersonEvent[] = [];
        for (let i = 0; i < 12; i++) {
            events.push({ uin: 5000 + i, name: `第${i}`, kind: 'like' });
        }
        events.push({ uin: 9001, name: '关心的人', kind: 'comment' });
        const all = rankPeople(events, new Set());
        expect(all).toHaveLength(13);
        // TOP5 里没有他，但全量排名里有，能补贴分数
        expect(computeTopPeople(events, new Set())).not.toContainEqual(expect.objectContaining({ uin: '9001' }));
        expect(all.find((r) => r.uin === '9001')).toMatchObject({ score: 1, comments: 1 });
    });
});

describe('特别关心好友（互动页入口态）', () => {
    const ranked: TopPerson[] = [
        { key: 'u:2001', uin: '2001', name: '互动王', score: 99, likes: 90, comments: 9, visits: 1 },
        { key: 'u:2002', uin: '2002', name: '第二名', score: 50, likes: 40, comments: 10, visits: 0 },
    ];

    it('只挑 care 好友，排除本人与空间主人，备注优先于昵称', () => {
        const friends = [
            { uin: 2002, nick: '第二名', remark: '老同学备注', care: true },
            { uin: 3001, nick: '没关心', care: false },
            { uin: 4001, nick: '别人', care: true },
            { uin: 1001, nick: '我自己', care: true, isMe: true },
            { uin: 3002, nick: '空间主人', care: true },
        ];
        const rows = collectCareFriends(friends, ranked, new Set(['1001', '3002']));
        expect(rows.map((r) => r.uin)).toEqual(['2002', '4001']);
        // 备注才是用户认得出的名字
        expect(rows[0]!.name).toBe('老同学备注');
        // 在榜的关心好友带上互动分，不在榜的记 0
        expect(rows[0]).toMatchObject({ score: 50, likes: 40, comments: 10 });
        expect(rows[1]).toMatchObject({ score: 0, name: '别人' });
    });

    it('按互动分降序、同分按拼音名稳定排序，重复 uin 只留一条', () => {
        const friends = [
            { uin: 5002, nick: '乙', care: true },
            { uin: 5001, nick: '丙', care: true },
            { uin: 5002, nick: '乙', care: true },
            { uin: 5003, nick: '甲', care: true },
        ];
        const rows = collectCareFriends(friends, [], new Set());
        // 同分（均 0）时按中文拼音：丙 bing < 甲 jia < 乙 yi，而不是 Unicode 码位序
        expect(rows.map((r) => r.uin)).toEqual(['5001', '5003', '5002']);
    });

    it('缺字段、无 uin、非数组输入都不炸', () => {
        expect(collectCareFriends([], [], new Set())).toEqual([]);
        expect(collectCareFriends(null as any, [], new Set())).toEqual([]);
        expect(collectCareFriends([{ care: true, nick: '无号' }], [], new Set())).toEqual([]);
    });

    it('已进 TOP5 的关心好友不重复出现在关心组，但保留 careUins 供挂标签', () => {
        const allCare = [
            { key: 'u:2001', uin: '2001', name: '互动王', score: 99, likes: 90, comments: 9 },
            { key: 'u:4001', uin: '4001', name: '只是关心', score: 2, likes: 2, comments: 0 },
        ];
        const { care, careHidden } = splitCareSelection(allCare, new Set(['2001']));
        expect(care.map((r) => r.uin)).toEqual(['4001']);
        expect(careHidden).toBe(0);
    });

    it('关心人数超上限时截断并给出未列出数量', () => {
        const allCare = Array.from({ length: 11 }, (_, i) => ({
            key: `u:${6000 + i}`, uin: String(6000 + i), name: `好友${i}`, score: 11 - i, likes: 0, comments: 0,
        }));
        const { care, careHidden } = splitCareSelection(allCare, new Set(), CARE_LIMIT);
        expect(care).toHaveLength(CARE_LIMIT);
        expect(careHidden).toBe(3);
        // 截断保留的是分数最高的一批（collectCareFriends 已排好序）
        expect(care[0]!.uin).toBe('6000');
    });
});

describe('昵称脱敏（隐私模式）', () => {
    it('保留首尾字符，中间用 * 代替（最多 3 个）', () => {
        expect(maskName('吕顺才')).toBe('吕*才');
        expect(maskName('双手合十、『祈祷』十指紧扣ゝ')).toBe('双***ゝ');
        expect(maskName('张三')).toBe('张*');
        // 单字无从隐藏，变了反而无法辨识
        expect(maskName('李')).toBe('李');
    });

    it('空值返回空串；emoji 不被 surrogate pair 截断', () => {
        expect(maskName('')).toBe('');
        expect(maskName(null)).toBe('');
        expect(maskName(undefined)).toBe('');
        expect(maskName('   ')).toBe('');
        const masked = maskName('🙂🙃🙂');
        expect(Array.from(masked)).toHaveLength(3);
        expect(masked.startsWith('🙂')).toBe(true);
        expect(masked.endsWith('🙂')).toBe(true);
    });
});
