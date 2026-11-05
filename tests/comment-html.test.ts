// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { commentEntriesHtml } from '../viewer/src/data/commentHtml';

/** 大图查看器评论面板（HTML 字符串）的构造逻辑 */
const comments = [
    {
        uin: 1129136924,
        name: '吕顺才',
        content: '主评论',
        postTime: 1700000000,
        // 采集端说说回复存的字段是 list_3
        list_3: [
            { uin: 10001, name: '小王', content: '这是一条回复', time: 1700000100 },
        ],
    },
    {
        uin: 10002,
        name: '<script>alert(1)</script>',
        content: '<img src=x onerror=alert(1)>',
    },
];

describe('大图评论面板：头像与回复', () => {
    it('每条评论都有头像', () => {
        const html = commentEntriesHtml(comments, false);
        expect(html).toMatch(/<img[^>]+class="pswp-comment-avatar"/);
        // 两个主评论各一个头像 + 一个回复头像
        expect(html.match(/pswp-comment-avatar/g)).toHaveLength(3);
    });

    it('一层回复被渲染，且回复也有头像与时间', () => {
        const html = commentEntriesHtml(comments, false);
        expect(html).toContain('pswp-comment-replies');
        expect(html).toContain('pswp-comment-reply');
        expect(html).toContain('这是一条回复');
        expect(html).toContain('小王');
    });

    it('无 uin 时给空占位，不输出坏图', () => {
        const html = commentEntriesHtml([{ name: '匿名', content: 'x' }], false);
        expect(html).toContain('pswp-comment-avatar--empty');
        expect(html).not.toMatch(/<img[^>]+src=""/);
    });

    it('回复不再递归展开自己的回复（避免深层嵌套撑爆面板）', () => {
        const html = commentEntriesHtml([{
            name: 'A', content: 'x',
            list_3: [{ name: 'B', content: 'y', replies: [{ name: 'C', content: 'z' }] }],
        }], false);
        expect(html).toContain('y');
        expect(html).not.toContain('z');
    });
});

describe('大图评论面板：隐私态与安全', () => {
    it('隐私态：主评论与回复的名字都脱敏、头像模糊', () => {
        const html = commentEntriesHtml(comments, true);
        expect(html).toContain('吕*才');
        expect(html).not.toContain('吕顺才');
        expect(html).toContain('小*');
        expect(html).not.toContain('小王');
        // 主评论 2 个 + 回复 1 个头像都带模糊
        expect(html.match(/privacy-blur/g)).toHaveLength(3);
    });

    it('昵称与正文来自他人输入，必须被转义', () => {
        const html = commentEntriesHtml(comments, false);
        // 原始标签不得出现；转义后的文本里保留 onerror=... 是正常的（只是字符，不是属性）
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
});
