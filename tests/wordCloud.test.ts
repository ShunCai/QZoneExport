import { describe, expect, it } from 'vitest';
import { cleanText, countWords, isMeaningfulWord, selfCommentTexts, splitWords } from '../viewer/src/data/wordCloud';

describe('cleanText', () => {
    it('剥掉表情 token，不留 e402 这类残渣', () => {
        expect(cleanText('今天好开心[em]e402[/em][em]e141[/em]')).toBe('今天好开心');
    });

    it('剥掉 HTML 标签与实体', () => {
        expect(cleanText('<p>第一段</p><br/>第二段&nbsp;结束')).toBe('第一段 第二段 结束');
    });

    it('剥掉 UBB 图片块与链接', () => {
        expect(cleanText('[img=1,2]http://a.com/x.jpg[/img]看图 https://b.com/y 结束')).toBe('看图 结束');
    });

    it('压掉多余空白', () => {
        expect(cleanText('  多个   空格\n\n换行  ')).toBe('多个 空格 换行');
    });
});

describe('isMeaningfulWord', () => {
    it('单字、纯数字、纯英文都不算词', () => {
        expect(isMeaningfulWord('我')).toBe(false);
        expect(isMeaningfulWord('2024')).toBe(false);
        expect(isMeaningfulWord('abc')).toBe(false);
    });

    it('停用词被拦下', () => {
        expect(isMeaningfulWord('我们')).toBe(false);
        expect(isMeaningfulWord('就是')).toBe(false);
    });

    it('实词保留', () => {
        expect(isMeaningfulWord('高考')).toBe(true);
        expect(isMeaningfulWord('动物园')).toBe(true);
    });
});

describe('splitWords', () => {
    it('中文按词切开，过滤掉虚词与单字', () => {
        const words = splitWords('今天我们去动物园看熊猫，很开心');
        expect(words).not.toBeNull();
        expect(words).toContain('动物');
        expect(words).toContain('熊猫');
        expect(words).not.toContain('我们');
    });

    it('空文本返回空数组', () => {
        expect(splitWords('   ')).toEqual([]);
    });
});

describe('countWords', () => {
    it('按文档频率计数：同一条里重复多次只算 1 票', () => {
        const result = countWords(['高考 高考 高考 加油', '高考 结束了', '动物园 很好玩']);
        const gaokao = result.rows.find((row) => row.word === '高考');
        expect(gaokao?.docs).toBe(2);
        expect(result.docCount).toBe(3);
    });

    it('结果按出现条数降序（票数相同再按字典序）', () => {
        // 注意用不共享子串的词：分词会把「动物园」切出「动物」，造成意外并列
        const result = countWords(['高考 加油', '高考 结束了', '熊猫很好玩']);
        expect(result.rows[0]?.word).toBe('高考');
        expect(result.rows[0]?.docs).toBe(2);
        // 并列时按字典序稳定输出，避免每次渲染顺序抖动
        const tied = countWords(['熊猫', '动物']);
        const names = tied.rows.map((row) => row.word);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh')));
    });

    it('limit 截断但 wordCount 仍是全量去重数', () => {
        const result = countWords(['熊猫 动物 高考 毕业 同学'], 2);
        expect(result.rows.length).toBe(2);
        expect(result.wordCount).toBeGreaterThan(2);
    });

    it('清洗后没有有效词的内容不计入 docCount', () => {
        const result = countWords(['[em]e402[/em][em]e141[/em]', '有内容的一句话']);
        expect(result.docCount).toBe(1);
    });

    it('空输入返回空结果', () => {
        expect(countWords([])).toEqual({ docCount: 0, wordCount: 0, rows: [] });
    });
});

describe('selfCommentTexts', () => {
    const item = {
        comments: [
            { poster: { uin: 111, name: '我' }, content: '今天高考加油' },
            { poster: { uin: 222, name: '别人' }, content: '别人的话' },
            { content: '没有 uin 的评论' },
            { poster: { uin: 111 }, content: '   ' },
            {
                poster: { uin: 222 },
                content: '别人的父评论',
                replyList: [
                    { uin: 111, content: '我的回复' },
                    { uin: 222, content: '对方回复' },
                ],
            },
        ],
    };

    it('只收本人发的评论与回复，跳过别人的和空内容', () => {
        expect(selfCommentTexts(item, '111')).toEqual(['今天高考加油', '我的回复']);
    });

    it('uin 字符串与数字都能对上', () => {
        expect(selfCommentTexts(item, '111')).toEqual(selfCommentTexts({ ...item, comments: item.comments }, '111'));
        expect(selfCommentTexts({ comments: [{ poster: { uin: '111' }, content: '字符串 uin' }] }, '111'))
            .toEqual(['字符串 uin']);
    });

    it('没有「我」的 uin 时返回空数组', () => {
        expect(selfCommentTexts(item, '')).toEqual([]);
    });
});
