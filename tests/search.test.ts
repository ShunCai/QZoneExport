import { describe, expect, it } from 'vitest';
import { searchRecords, snippetOf, type SearchRecord } from '../viewer/src/data/search';

/** 造一条记录：只填搜索相关字段，其余给默认值 */
function record(partial: Partial<SearchRecord> & { module: string; body: string }): SearchRecord {
    return {
        moduleLabel: partial.module,
        kind: 'item',
        itemId: '1',
        time: 0,
        title: '',
        route: partial.module,
        query: {},
        ...partial,
        module: partial.module,
        body: partial.body,
    } as SearchRecord;
}

describe('snippetOf', () => {
    it('命中在中间时前后都加省略号，并给出片段内偏移', () => {
        const text = '前面的内容很长很长很长很长很长很长哈哈哈哈后面还有很多很多字';
        const result = snippetOf(text, '哈哈哈哈', 4);
        expect(result).not.toBeNull();
        expect(result!.snippet.startsWith('…')).toBe(true);
        expect(result!.snippet.endsWith('…')).toBe(true);
        expect(result!.snippet.slice(result!.matchStart, result!.matchStart + result!.matchLength)).toBe('哈哈哈哈');
    });

    it('命中在开头时不加前置省略号', () => {
        const result = snippetOf('哈哈哈开头就在这里', '哈哈哈', 6);
        expect(result!.snippet.startsWith('…')).toBe(false);
        expect(result!.matchStart).toBe(0);
    });

    it('命中在结尾时不加后置省略号', () => {
        const result = snippetOf('结尾就是哈哈哈', '哈哈哈', 6);
        expect(result!.snippet.endsWith('…')).toBe(false);
    });

    it('大小写不敏感，但片段保留原文大小写', () => {
        const result = snippetOf('Hello World', 'hello', 4);
        expect(result).not.toBeNull();
        expect(result!.snippet.slice(result!.matchStart, result!.matchStart + 5)).toBe('Hello');
    });

    it('空文本或空关键词返回 null', () => {
        expect(snippetOf('', 'xxx')).toBeNull();
        expect(snippetOf('xxx', '')).toBeNull();
    });

    it('未命中返回 null', () => {
        expect(snippetOf('完全无关的内容', '找不到')).toBeNull();
    });
});

describe('searchRecords', () => {
    const records: SearchRecord[] = [
        record({ module: 'messages', moduleLabel: '说说', body: '今天去了动物园看熊猫', time: 100, title: '今天去了动物园' }),
        record({ module: 'messages', moduleLabel: '说说', kind: 'comment', body: '熊猫太可爱了吧', author: '张三', context: '今天去了动物园', time: 300, itemId: '1' }),
        record({ module: 'blogs', moduleLabel: '日志', body: '写一篇关于动物园的游记', time: 200, title: '动物园游记' }),
        record({ module: 'boards', moduleLabel: '留言', kind: 'comment', body: '哈哈哈这条留言', author: '李四', context: '留言', time: 400, itemId: '9' }),
    ];

    it('空关键词返回空结果', () => {
        expect(searchRecords(records, '   ')).toEqual({ groups: [], total: 0 });
    });

    it('同时命中标题与正文，且按模块分组', () => {
        const result = searchRecords(records, '动物园');
        expect(result.total).toBe(2);
        expect(result.groups.map((g) => g.module).sort()).toEqual(['blogs', 'messages']);
    });

    it('kind=item 只返回条目，kind=comment 只返回评论', () => {
        expect(searchRecords(records, '动物园', { kind: 'item' }).total).toBe(2);
        const comments = searchRecords(records, '动物园', { kind: 'comment' });
        expect(comments.total).toBe(0);
        const panda = searchRecords(records, '熊猫', { kind: 'comment' });
        expect(panda.total).toBe(1);
        expect(panda.groups[0]!.hits[0]!.record.author).toBe('张三');
    });

    it('组按命中数降序排列', () => {
        const extra = [
            record({ module: 'messages', moduleLabel: '说说', body: '熊猫二号', time: 500 }),
            ...records,
        ];
        // messages 组共 3 条命中：新加的第 3 条 + 原条目「看熊猫」+ 原评论「熊猫太可爱了吧」
        const result = searchRecords(extra, '熊猫');
        expect(result.groups[0]!.module).toBe('messages');
        expect(result.groups[0]!.total).toBe(3);
    });

    it('组内按时间倒序', () => {
        const result = searchRecords(records, '动物园');
        const messages = result.groups.find((g) => g.module === 'messages')!;
        expect(messages.hits.length).toBeGreaterThan(0);
        const times = messages.hits.map((h) => h.record.time);
        expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it('limitPerGroup 只截断列表，total 仍是全量命中数', () => {
        const many = Array.from({ length: 5 }, (_, i) =>
            record({ module: 'blogs', moduleLabel: '日志', body: `关键词内容 ${i}`, time: i }),
        );
        const result = searchRecords(many, '关键词', { limitPerGroup: 2 });
        expect(result.total).toBe(5);
        expect(result.groups[0]!.total).toBe(5);
        expect(result.groups[0]!.hits.length).toBe(2);
    });

    it('命中在标题上时，片段来自标题', () => {
        const only = [record({ module: 'blogs', moduleLabel: '日志', title: '独一无二的标题词', body: '正文里没有那个词' })];
        const hit = searchRecords(only, '独一').groups[0]!.hits[0]!;
        expect(hit.snippet).toContain('独一');
        expect(hit.snippet).not.toContain('正文里没有');
    });
});
