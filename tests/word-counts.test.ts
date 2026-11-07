// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { countChars, sumChars } from '../viewer/src/data/wordCounts';

/**
 * 字数口径：先按展示口径剥掉 UBB / HTML / 实体，再去掉所有空白后按字符计数。
 * 真实数据里留言在 htmlContent、说说在 content、分享在 desc —— 取字段的活交给
 * summary.rawBodyOf，这里只验证「剥干净 + 只数字」。
 */
describe('正文字数统计', () => {
    it('剥掉 HTML 标签与实体后计数', () => {
        expect(countChars('<p>你好</p>')).toBe(2);
        // 实体整体剔除（计数只需要长度，不做实体还原），空格不计 → 'ab'
        expect(countChars('a &amp; b')).toBe(2);
        expect(countChars('<a class="lightgallery" href="x.gif"><img src="x.gif"></a>')).toBe(0);
    });

    it('剥掉表情 token，表情不计入字数', () => {
        expect(countChars('[em]e258151[/em]勤奋')).toBe(2);
        expect(countChars('好[em]e117[/em]')).toBe(1);
    });

    it('空白与换行不计入', () => {
        expect(countChars('你 好\n啊')).toBe(3);
        expect(countChars('   ')).toBe(0);
    });

    it('空值/非字符串安全返回 0', () => {
        expect(countChars('')).toBe(0);
        expect(countChars(null)).toBe(0);
        expect(countChars(undefined)).toBe(0);
        expect(countChars(123)).toBe(3);
    });

    it('按模块汇总，字段口径与摘要一致（留言取 htmlContent）', () => {
        const boards = [
            { content: '', htmlContent: '<div>今天立冬</div>', ubbContent: '今天立冬' },
            { content: '', htmlContent: '', ubbContent: '早安' },
        ];
        const row = sumChars('boards', boards);
        // 第二条 htmlContent 为空 → 回退 ubbContent，不能被算成 0 字
        expect(row).toMatchObject({ key: 'boards', label: '留言', chars: 6 });
    });

    it('空列表汇总为 0', () => {
        expect(sumChars('messages', [])).toEqual({ key: 'messages', label: '说说', chars: 0 });
    });

    it('日志/日记正文在 html，标题不计入', () => {
        // 用 summary.rawBodyOf 会把 title 排在前面，只数到标题（线上曾因此把 4.1 万字算成 282 字）
        const blogs = [{ title: '一个很长很长很长的标题', html: '<p>正文</p>' }];
        expect(sumChars('blogs', blogs).chars).toBe(2);
        const diaries = [{ title: '标题', html: '<div>日记正文</div>', content: '这段不该被取到' }];
        expect(sumChars('diaries', diaries).chars).toBe(4);
    });
});
