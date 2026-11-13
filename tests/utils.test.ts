import { describe, expect, it } from 'vitest';
import {
    calcGtk,
    filenameValidate,
    formatDate,
    getCookieValue,
    parseDate,
    toJson,
    toParams,
    toUrl,
    unionItems,
} from '../core/shared/utils';
import {
    extractGtk,
    extractOwnerUin,
    extractQzoneToken,
    extractTargetUin,
    initContext,
} from '../core/qzone-api/context';

describe('toJson JSONP剥壳', () => {
    it('解析普通JSON', () => {
        expect(toJson('{"code":0}')).toEqual({ code: 0 });
    });

    it('解析指定JSONP前缀', () => {
        expect(toJson('_Callback({"code":0,"data":[1]});', /^_Callback\(/)).toEqual({ code: 0, data: [1] });
    });

    it('解析通用Callback前缀', () => {
        expect(toJson('shine0_Callback({"a":1})')).toEqual({ a: 1 });
    });

    it('非法反斜杠转义后重试成功（原eval兜底场景）', () => {
        // 文案中含单个反斜杠 \Q，JSON.parse 首次失败
        expect(toJson('{"content":"a\\Qb"}')).toEqual({ content: 'a\\Qb' });
    });

    it('JSON5 兜底：正则转义修不了、但 JSON5 能解析的 JS 对象字面量', () => {
        // 无引号 key + 单引号字符串 + 尾随逗号：JSON.parse 与正则重试都失败，靠 JSON5 兑付
        expect(toJson("{a: 1, b: '率', c: [1, 2,],}")).toEqual({ a: 1, b: '率', c: [1, 2] });
    });

    it('彻底非法时抛出异常', () => {
        expect(() => toJson('<html>oops</html>')).toThrow();
    });

    it('jsonrepair 兜底：相册接口未闭合字符串 + 字符串内裸换行', () => {
        // 复刻 shine0_Callback 的脏响应：desc 值缺闭合引号、内含裸换行，
        // JSON.parse / 反斜杠修复 / JSON5 都失败，只有最后一级能保住后续字段
        const dirty = 'shine0_Callback({"code":0,"data":{"photoList":['
            + '{"desc":"第一行\n第二行,\n         "forum":0,"id":7}]}});';
        const res = toJson<any>(dirty, /^shine0_Callback\(/);
        expect(res.code).toBe(0);
        expect(res.data.photoList).toHaveLength(1);
        expect(res.data.photoList[0].id).toBe(7);
        expect(res.data.photoList[0].forum).toBe(0);
        expect(res.data.photoList[0].desc).toContain('第一行');
    });
});

describe('URL工具', () => {
    it('toParams解析查询参数', () => {
        expect(toParams('https://x.com/a?b=1&c=hello')).toEqual({ b: '1', c: 'hello' });
    });

    it('toUrl拼接参数', () => {
        expect(toUrl('https://x.com/a', { b: 1, c: 'x' })).toBe('https://x.com/a?b=1&c=x');
        expect(toUrl('https://x.com/a?z=0', { b: 1 })).toBe('https://x.com/a?z=0&b=1');
    });
});

describe('文件名与格式化', () => {
    it('filenameValidate替换特殊符号', () => {
        expect(filenameValidate('a/b\\c:d*e?f"g<h>i|j k')).toBe('a_b_c_d_e_f_g_h_i_j_k');
    });

    // prefixNumber 已随序号命名功能移除，保留测试便于后续参考
    // it('prefixNumber补零', () => {
    //     expect(prefixNumber(5, 3)).toBe('005');
    //     expect(prefixNumber(123, 3)).toBe('123');
    // });

    it('formatDate格式化秒级时间戳', () => {
        // 2020-01-02 03:04:05 UTC+8 的秒级时间戳（本地时区运行环境为+8）
        const time = Math.floor(new Date(2020, 0, 2, 3, 4, 5).getTime() / 1000);
        expect(formatDate(time)).toBe('2020-01-02 03:04:05');
        expect(formatDate('原样返回')).toBe('原样返回');
    });

    it('parseDate兼容秒级时间戳与字符串', () => {
        const sec = Math.floor(new Date(2020, 0, 2).getTime() / 1000);
        expect(parseDate(sec).getFullYear()).toBe(2020);
        expect(parseDate('2020-01-02 00:00:00').getFullYear()).toBe(2020);
    });

    it('parseDate 毫秒级时间戳（>1e12）不被误判为秒', () => {
        const ms = new Date(2050, 6, 15).getTime(); // > 1e12
        expect(parseDate(ms).getFullYear()).toBe(2050);
    });

    it('parseDate 1970年附近的秒级时间戳', () => {
        expect(parseDate(0).getFullYear()).toBe(1970);
        expect(parseDate(86400).getDate()).toBe(2); // 1970-01-02
    });

    it('toParams 无值key与空值参数', () => {
        expect(toParams('http://x.com/?a&b=1')).toEqual({ a: '', b: '1' });
        expect(toParams('http://x.com/?key=')).toEqual({ key: '' });
        expect(toParams('http://x.com/?a=1&b=2')).toEqual({ a: '1', b: '2' });
    });

    it('unionItems合并', () => {
        expect(unionItems([1], [2, 3])).toEqual([1, 2, 3]);
        expect(unionItems(undefined, [2])).toEqual([2]);
    });
});

describe('鉴权上下文', () => {
    const cookie = 'uin=o0123456789; p_skey=ABCdef; skey=@xyz';

    it('calcGtk与旧版算法一致', () => {
        // 旧算法：hash=5381; hash += (hash<<5)+charCode
        let hash = 5381;
        for (const ch of 'ABCdef') {
            hash += (hash << 5) + ch.charCodeAt(0);
        }
        expect(calcGtk('ABCdef')).toBe(hash & 2147483647);
    });

    it('getCookieValue提取cookie项', () => {
        expect(getCookieValue(cookie, 'p_skey')).toBe('ABCdef');
        expect(getCookieValue(cookie, 'uin')).toBe('o0123456789');
        expect(getCookieValue(cookie, 'none')).toBeUndefined();
    });

    it('extractOwnerUin剥离前缀o0', () => {
        expect(extractOwnerUin(cookie)).toBe(123456789);
    });

    it('extractTargetUin从URL提取', () => {
        expect(extractTargetUin('https://user.qzone.qq.com/123456789/main')).toBe(123456789);
        expect(extractTargetUin('https://qzone.qq.com/')).toBeUndefined();
    });

    it('extractGtk qzone域使用p_skey', () => {
        expect(extractGtk({ href: 'https://user.qzone.qq.com/1', cookie })).toBe(calcGtk('ABCdef'));
    });

    it('extractQzoneToken从script提取', () => {
        const scripts = ['var a=1;', 'window.g_qzonetoken = (function(){ return "abc123token";})();'];
        expect(extractQzoneToken(scripts)).toBe('abc123token');
    });

    it('initContext组装完整上下文', () => {
        const ctx = initContext({
            href: 'https://user.qzone.qq.com/987654321',
            cookie,
            scriptTexts: () => ['window.g_qzonetoken=(function(){return "tk";})();'],
        });
        expect(ctx).toBeDefined();
        expect(ctx!.ownerUin).toBe(123456789);
        expect(ctx!.targetUin).toBe(987654321);
        expect(ctx!.token).toBe('tk');
    });
});
