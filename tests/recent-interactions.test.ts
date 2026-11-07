// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { actionOf, pickRecentInteractions } from '../viewer/src/data/recentInteractions';

/**
 * 最近互动流：评论 / 回复 / 留言按时间倒序取最近 N 条。
 * 点赞没有时间戳，因此不在这条流里（loadRecentInteractions 的注释与卡片文案都写明了）。
 */
const messages = [
    {
        tid: 'm1',
        content: '今天立冬',
        custom_comments: [
            { uin: 2001, name: '配角ゝ', postTime: 1700000300 },
            {
                uin: 2002,
                name: '黑狗小白',
                postTime: 1700000100,
                replies: [{ uin: 2003, name: '月魂', content: '我也觉得', postTime: 1700000400 }],
            },
        ],
    },
    {
        tid: 'm2',
        content: '第二条说说',
        custom_comments: [
            // 自己评论自己：必须被 exclude 过滤掉
            { uin: 1001, name: '我', postTime: 1700000900 },
            // 没有时间：无法排序，丢弃
            { uin: 2004, name: '无时间', content: 'x' },
        ],
    },
];
const boards = [
    { tid: 'b1', uin: 2005, nickname: '老同学', pubtime: 1700000200, htmlContent: '<div>来踩踩</div>' },
];

describe('最近互动流', () => {
    const rows = pickRecentInteractions({ messages, boards }, new Set(['1001']), 5);

    it('按时间倒序，评论/回复/留言混排', () => {
        expect(rows.map((r) => r.uin)).toEqual(['2003', '2001', '2005', '2002']);
        expect(rows.map((r) => r.kind)).toEqual(['reply', 'comment', 'board', 'comment']);
    });

    it('排除自己，且无时间的记录不参与排序', () => {
        expect(rows.some((r) => r.uin === '1001')).toBe(false);
        expect(rows.some((r) => r.name === '无时间')).toBe(false);
    });

    it('评论/回复的摘要用这条互动自己的内容', () => {
        const reply = rows.find((r) => r.kind === 'reply')!;
        expect(reply.snippet).toBe('我也觉得');
        // 2001 这条评论没有 content → 退到所在说说摘要
        const comment = rows.find((r) => r.uin === '2001')!;
        expect(comment.snippet).toContain('今天立冬');
        const board = rows.find((r) => r.kind === 'board')!;
        expect(board.snippet).toContain('来踩踩');
        expect(board.name).toBe('老同学');
    });

    it('提及 token 转成 @昵称，不能把 @{uin:...} 原样显示', () => {
        const withMention = [{
            tid: 'm3',
            content: '主楼',
            custom_comments: [{
                uin: 2006,
                name: '某人',
                content: '回复',
                postTime: 1700000500,
                replies: [{ uin: 2007, name: '甲', content: '@{uin:1001,nick:吕顺才,who:1,auto:1} 你说得对', postTime: 1700000600 }],
            }],
        }];
        const out = pickRecentInteractions({ messages: withMention, boards: [] }, new Set(['1001']), 3);
        expect(out[0]!.snippet).toBe('@吕顺才 你说得对');
        expect(out[0]!.snippet).not.toContain('@{uin');
    });

    it('limit 生效；空输入返回空数组', () => {
        expect(pickRecentInteractions({ messages, boards }, new Set(), 2)).toHaveLength(2);
        expect(pickRecentInteractions({ messages: [], boards: [] }, new Set())).toEqual([]);
    });

    it('动作文案覆盖三种类型', () => {
        expect(actionOf('comment')).toBe('评论');
        expect(actionOf('reply')).toBe('回复');
        expect(actionOf('board')).toBe('留言');
    });
});
