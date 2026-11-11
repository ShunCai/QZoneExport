import { describe, expect, it } from 'vitest';
import { isOtherSpace, OTHER_SPACE_EXCLUDED_MODULES } from '../viewer/src/data/space';

describe('isOtherSpace', () => {
    it('ownerUin 与 uin 相同是本人备份', () => {
        expect(isOtherSpace({ uin: 1129136924, ownerUin: 1129136924 })).toBe(false);
        expect(isOtherSpace({ uin: '1129136924', ownerUin: 1129136924 })).toBe(false);
    });

    it('ownerUin 与 uin 不同是他人空间', () => {
        expect(isOtherSpace({ uin: 1053703509, ownerUin: 1129136924 })).toBe(true);
    });

    it('缺 ownerUin / uin / 无数据时按本人备份处理', () => {
        expect(isOtherSpace({ uin: 1053703509 })).toBe(false);
        expect(isOtherSpace({ ownerUin: 1129136924 })).toBe(false);
        expect(isOtherSpace({ uin: '', ownerUin: 1129136924 })).toBe(false);
        expect(isOtherSpace(null)).toBe(false);
        expect(isOtherSpace(undefined)).toBe(false);
    });
});

describe('OTHER_SPACE_EXCLUDED_MODULES', () => {
    it('包含日记、好友、收藏，且不含动态页可见的其它模块', () => {
        expect([...OTHER_SPACE_EXCLUDED_MODULES].sort()).toEqual(['diaries', 'favorites', 'friends']);
        for (const key of ['messages', 'blogs', 'photos', 'boards', 'shares']) {
            expect(OTHER_SPACE_EXCLUDED_MODULES).not.toContain(key);
        }
    });
});
