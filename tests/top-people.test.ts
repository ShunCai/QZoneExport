// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { collectPersonEvents, computeTopPeople, type PersonEvent } from '../viewer/src/data/top-people';
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
