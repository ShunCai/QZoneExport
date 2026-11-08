import { describe, expect, it } from 'vitest';
import { cityKeyOf } from '../viewer/src/data/counts';

describe('cityKeyOf', () => {
    it('市辖区归并到市', () => {
        expect(cityKeyOf('深圳市宝安区')).toBe('深圳');
        expect(cityKeyOf('深圳市南山区')).toBe('深圳');
        expect(cityKeyOf('北京市朝阳区')).toBe('北京');
    });

    it('裸城市名原样返回（与带区的归并为同一个键）', () => {
        expect(cityKeyOf('深圳')).toBe('深圳');
        expect(cityKeyOf('北京')).toBe('北京');
    });

    it('带省前缀的先剥省再取市', () => {
        expect(cityKeyOf('广东省深圳市南山区')).toBe('深圳');
        expect(cityKeyOf('广东省茂名市高州市')).toBe('茂名');
    });

    it('自治区与特别行政区前缀也能剥', () => {
        expect(cityKeyOf('广西壮族自治区南宁市青秀区')).toBe('南宁');
        expect(cityKeyOf('香港特别行政区')).toBe('香港');
    });

    it('无市字样的地点原样返回', () => {
        expect(cityKeyOf('纽约')).toBe('纽约');
        expect(cityKeyOf('世界那么大，还是高州好。')).toBe('世界那么大，还是高州好。');
    });

    it('空串返回空', () => {
        expect(cityKeyOf('')).toBe('');
        expect(cityKeyOf('   ')).toBe('');
    });
});
