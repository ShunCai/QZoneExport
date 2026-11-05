import { describe, expect, it } from 'vitest';
import { maskName, maskUin, plainName } from '../viewer/src/data/mask';

describe('QQ 号打码', () => {
    it('常规 9–10 位：保留前 3 后 2，中间补齐星号', () => {
        expect(maskUin('1129136924')).toBe('112*****24');
        expect(maskUin(123456789)).toBe('123****89');
        // 数字与字符串按同一规则处理
        expect(maskUin('123456789')).toBe(maskUin(123456789));
    });

    it('短号不至于「打码后等于没打」', () => {
        // 5 位：保留前 1 后 1，中间至少 2 星
        expect(maskUin('12345')).toBe('1***5');
        // 6 位起走前 3 后 2
        expect(maskUin('123456')).toBe('123**56');
        expect(maskUin('12')).toBe('**');
        expect(maskUin('1')).toBe('*');
    });

    it('空值返回空串', () => {
        expect(maskUin('')).toBe('');
        expect(maskUin(null)).toBe('');
        expect(maskUin(undefined)).toBe('');
        expect(maskUin('   ')).toBe('');
    });

    it('打码后仍保留可区分的前缀与后缀', () => {
        expect(maskUin('1129136924')).not.toBe(maskUin('1129136999'));
    });
});

describe('昵称脱敏与表情 token 的组合', () => {
    /** 与页面里一致的组合：plainName（剥 token / 标签）→ maskName */
    const masked = (raw: string) => maskName(plainName(raw));

    it('带表情 token 的名字先剥成纯文本再脱敏，不会切出乱码', () => {
        // 反例：直接对原串脱敏会得到 "[***三"（首字符成了 "["，真正的姓被吃掉）
        expect(maskName('[em]e100[/em]张三')).toBe('[***三');
        expect(masked('[em]e100[/em]张三')).toBe('张*');
        expect(masked('[em]e100[/em]张三')).not.toContain('[');
    });

    it('HTML 标签与 &nbsp; 也会被清掉', () => {
        expect(masked('张<b>三</b>')).toBe('张*');
        expect(masked('张&nbsp;三')).toBe('张*');
    });

    it('纯文本名字与直接 maskName 结果一致', () => {
        expect(masked('吕顺才')).toBe(maskName('吕顺才'));
        expect(masked('吕顺才')).toBe('吕*才');
    });
});
