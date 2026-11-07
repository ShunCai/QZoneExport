// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
    countMedia,
    plainText,
    rawBodyOf,
    snippet,
    summaryOf,
} from '../viewer/src/data/summary';

/**
 * 用例里的字段结构照抄真实备份（QQ空间备份_1053703509）：
 * 留言 content 恒为空串，正文在 htmlContent/ubbContent；表情在这两处分别表现为 gif 与 [em]。
 */
describe('留言只有表情/图片时的摘要', () => {
    const emojiBoard = {
        content: '',
        htmlContent: '<a class="lightgallery" href="Boards/images/1vi7cwl9ty9.gif"><img src="Boards/images/1vi7cwl9ty9.gif" data-idx="0"></a><wbr>',
        ubbContent: '[em]e163[/em]',
    };

    it('纯表情不留「无内容」：按 UBB 认出是表情而不是图片', () => {
        expect(rawBodyOf('boards', emojiBoard)).toContain('lightgallery');
        expect(summaryOf('boards', emojiBoard)).toBe('表情 × 1');
    });

    it('多个表情给出数量', () => {
        const two = {
            content: '',
            htmlContent: '',
            ubbContent: '[em]e108[/em][em]e108[/em]',
        };
        expect(summaryOf('boards', two)).toBe('表情 × 2');
    });

    it('纯图片（[img] UBB 或带尺寸的 <img>）报图片数', () => {
        const ubbImg = { content: '', htmlContent: '', ubbContent: '[img,150,140]http://qzonestyle.gtimg.cn/qzone/em/recommendedImages/022.png[/img]' };
        // [img] 在 UBB 里是图片语法，即使 URL 在 qzone/em 路径下也不算表情
        expect(summaryOf('boards', ubbImg)).toBe('图片 × 1');
        const htmlImg = { content: '', htmlContent: '<img src="Boards/images/a.png" width="150" height="140">' };
        expect(summaryOf('boards', htmlImg)).toBe('图片 × 1');
    });

    it('表情与图片混排时都报出来', () => {
        const mixed = { content: '', htmlContent: '', ubbContent: '[em]e163[/em][img,150,140]http://x/a.png[/img]' };
        expect(summaryOf('boards', mixed)).toBe('表情 × 1 · 图片 × 1');
    });

    it('有文字时正常显示文字，不掺媒体计数', () => {
        const withText = {
            content: '',
            htmlContent: '生日快乐[em]e168[/em]<br>要开心',
            ubbContent: '生日快乐[em]e168[/em]\n要开心',
        };
        expect(summaryOf('boards', withText)).toBe('生日快乐 要开心');
    });

    it('content 为空串必须让位给后面的字段（不能靠 ?? 短路）', () => {
        const item = { content: '', htmlContent: '有正文的留言' };
        expect(rawBodyOf('boards', item)).toBe('有正文的留言');
        expect(summaryOf('boards', item)).toBe('有正文的留言');
    });
});

describe('说说摘要的优先级', () => {
    it('无正文但转发 → 显示转发对象，而不是表情数量', () => {
        const item = { content: '[em]e163[/em]', rt_uinname: '小明' };
        expect(summaryOf('messages', item)).toBe('转发：小明');
    });

    it('纯表情且非转发 → 表情数量', () => {
        expect(summaryOf('messages', { content: '[em]e117[/em][em]e117[/em]' })).toBe('表情 × 2');
    });

    it('新版大表情（e400308）同样识别', () => {
        expect(summaryOf('messages', { content: '[em]e400308[/em]' })).toBe('表情 × 1');
    });

    it('有正文时表情被剥掉，正文保留', () => {
        const item = { content: '我想要cho厘子[em]e400308[/em]you\n[em]e400197[/em]' };
        expect(summaryOf('messages', item)).toBe('我想要cho厘子 you');
    });

    it('无正文无表情时退到图片数、视频动态、无内容', () => {
        expect(summaryOf('messages', { content: '', pic: [{}, {}] })).toBe('图片 × 2');
        expect(summaryOf('messages', { content: '', custom_videos: [{}] })).toBe('视频动态');
        expect(summaryOf('messages', { content: '' })).toBe('无内容');
    });

    it('长文本按 max 截断并加省略号', () => {
        expect(summaryOf('messages', { content: '一二三四五六七八九十' }, 4)).toBe('一二三四…');
    });
});

describe('其它模块的字段口径', () => {
    it('分享没有正文时用被分享对象的标题（音乐名 / 视频标题）', () => {
        const music = {
            desc: '', content: '', type: '18',
            source: { title: '卡路里(《西虹市首富》电影插曲)', desc: '', url: 'https://y.qq.com/...' },
        };
        expect(summaryOf('shares', music)).toBe('卡路里(《西虹市首富》电影插曲)');
        const video = { desc: '', source: { title: '英雄本色2018 王凯马天宇还原张国荣经典', desc: '周凯（王凯 饰）参与走私' } };
        expect(summaryOf('shares', video, 10)).toBe('英雄本色2018 王…');
        // 标题为空才退到 source.desc
        expect(summaryOf('shares', { desc: '', source: { title: '', desc: '郑源' } })).toBe('郑源');
    });

    it('转发对象昵称里的表情码也要清掉', () => {
        expect(summaryOf('messages', { content: '', rt_uinname: '琪琪[em]e328139[/em]' })).toBe('转发：琪琪');
        // 昵称整体就是表情时没有可读名字，退到媒体/无内容
        expect(summaryOf('messages', { content: '', rt_uinname: '[em]e327774[/em]' })).toBe('无内容');
    });

    it('视频没有标题时显示「视频动态」而不是无内容', () => {
        const video = { name: '', title: '', desc: '' };
        expect(summaryOf('videos', video)).toBe('视频动态');
        expect(summaryOf('videos', { desc: '小灵芝说田里面的是草' })).toBe('小灵芝说田里面的是草');
    });

    it('分享正文在 desc，不在 content', () => {
        expect(summaryOf('shares', { content: '', desc: '转发了一条视频' })).toBe('转发了一条视频');
    });

    it('相片没有正文，固定显示「相片」', () => {
        expect(summaryOf('photos', { name: '1234567.jpg', custom_url: 'http://x/y.jpg' })).toBe('相片');
    });
});

describe('纯文本化与媒体计数', () => {
    it('剥掉 BBCode 签名标签与 HTML 实体', () => {
        const sig = '[url=http://1053703509.qzone.qq.com/][ft=#ff0000,,楷体_GB2312][I]十指、如何能紧扣？[/I][/ft][/url]';
        expect(plainText(sig)).toBe('十指、如何能紧扣？');
        expect(plainText('a &amp; b&nbsp;c')).toBe('a & b c');
    });

    it('表情图片（qzone/em 路径）在 HTML 里也算表情', () => {
        expect(countMedia('<img src="http://qzonestyle.gtimg.cn/qzone/em/e117.gif">')).toEqual({ emoji: 1, image: 0 });
    });

    it('snippet 对外仍兼容：纯文本优先，空值给「无内容」', () => {
        expect(snippet('普通文本')).toBe('普通文本');
        expect(snippet('')).toBe('无内容');
        expect(snippet(null)).toBe('无内容');
    });
});
