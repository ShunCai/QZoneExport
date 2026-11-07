// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { formatNickname, formatText, formatHtmlContent } from '../viewer/src/data/richText';

/**
 * 昵称里带表情的 @ 提及
 *
 * 真实数据（QQ空间备份_1053703509 / tid 553dce3e7f9c6855d7df0400）：
 *   @{uin:951783523,nick:[em]e258151[/em]勤奋＋脚踏实地[em]e258158[/em],who:1,auto:1}哈哈
 *
 * 表情转换生成的 `<img ... onerror="if(!this.d1){this.d1=1;...}">` 里带 `}`，
 * 而 @ 提及的 `nick:([^}]*?)` 会把它当成 token 结尾 → `</a>` 落进 onerror 属性值，
 * 浏览器把后续内容整段吞进未闭合的 `<a>`（评论作者名被包成链接、面板撑出横向滚动条）。
 * 修复方式：@ 先于表情。
 */
describe('@提及与表情的转换顺序', () => {
    const raw = '@{uin:951783523,nick:[em]e258151[/em]勤奋＋脚踏实地[em]e258158[/em],who:1,auto:1}哈哈';

    it('结构不被破坏：标签必须成对，且 </a> 不能落进属性值', () => {
        const html = formatText(raw);
        expect(html).not.toMatch(/onerror="[^"]*<\/a>/);
        const open = (html.match(/<a\b/g) || []).length;
        const close = (html.match(/<\/a>/g) || []).length;
        expect(open).toBe(close);
    });

    it('解析后的 DOM 只有一层锚点，表情在锚点内且后面还有正文', () => {
        const doc = new DOMParser().parseFromString(`<div>${formatText(raw)}</div>`, 'text/html');
        const anchors = doc.querySelectorAll('a');
        expect(anchors).toHaveLength(1);
        expect(anchors[0]!.getAttribute('href')).toContain('951783523');
        expect(anchors[0]!.textContent).toContain('勤奋＋脚踏实地');
        expect(anchors[0]!.querySelectorAll('img.emoticon').length).toBe(2);
        // 锚点之外必须有「哈哈」，说明没有被吞进属性里
        expect(doc.body.textContent).toContain('哈哈');
    });

    it('留言正文走同一条流水线，顺序一致', () => {
        const html = formatHtmlContent(raw);
        expect(html).not.toMatch(/onerror="[^"]*<\/a>/);
        expect((html.match(/<a\b/g) || []).length).toBe((html.match(/<\/a>/g) || []).length);
    });

    it('uin 里的异常字符不会截断属性（只保留数字）', () => {
        const html = formatText('@{uin:12"onmouseover="alert(1),nick:张三}hi');
        expect(html).not.toContain('onmouseover');
        const href = /href="([^"]*)"/.exec(html)?.[1] || '';
        // 只保留数字：引号等异常字符被剔除，属性不会被截断
        expect(href.startsWith('https://user.qzone.qq.com/')).toBe(true);
        expect(href.slice('https://user.qzone.qq.com/'.length)).toMatch(/^\d+$/);
        expect(html).toContain('@张三');
    });
});

describe('昵称渲染（formatNickname）', () => {
    it('昵称里的表情 token 转成表情图，不再输出 [em]', () => {
        const html = formatNickname('[em]e258151[/em]勤奋＋脚踏实地[em]e258158[/em]');
        expect(html).not.toContain('[em]');
        expect(html.match(/class="emoticon"/g)).toHaveLength(2);
        expect(html).toContain('勤奋＋脚踏实地');
        expect(html).toContain('e258151.gif');
    });

    it('纯文本昵称原样输出（转义后）', () => {
        expect(formatNickname('配角ゝ')).toBe('配角ゝ');
        expect(formatNickname('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    });

    it('空值给空字符串，不抛错', () => {
        expect(formatNickname('')).toBe('');
        expect(formatNickname(null)).toBe('');
        expect(formatNickname(undefined)).toBe('');
    });
});
