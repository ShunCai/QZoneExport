// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FriendItem from '../viewer/src/components/items/FriendItem.vue';
import { usePrivacy } from '../viewer/src/composables/usePrivacy';

/** 好友卡片的脱敏用例（usePrivacy 是模块级单例，每条用例后复位） */
const item = { uin: 1129136924, remark: '吕顺才', nick: '阿才', groupName: '同学' };

function setHidden(value: boolean): void {
    const { hidden, toggle } = usePrivacy();
    if (hidden.value !== value) toggle();
}

describe('好友卡片隐私脱敏', () => {
    afterEach(() => setHidden(false));

    it('隐私态：备注/昵称半脱敏、QQ 号打码、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(FriendItem, { props: { item } });
        const text = wrapper.text();

        // 主名显示的是备注 → 吕*才；昵称副行 → 阿*
        expect(text).toContain('吕*才');
        expect(text).not.toContain('吕顺才');
        expect(text).toContain('阿*');
        // QQ 号：保留前 3 后 2，原号不得出现
        expect(text).toContain('112*****24');
        expect(text).not.toContain('1129136924');
        // 头像图片按 uin 取，隐私态必须模糊
        expect(wrapper.find('.privacy-blur').exists()).toBe(true);

        wrapper.unmount();
    });

    it('非隐私态：显示原文、头像不模糊', () => {
        setHidden(false);
        const wrapper = mount(FriendItem, { props: { item } });
        const text = wrapper.text();

        expect(text).toContain('吕顺才');
        expect(text).toContain('1129136924');
        expect(wrapper.find('.privacy-blur').exists()).toBe(false);

        wrapper.unmount();
    });
});
