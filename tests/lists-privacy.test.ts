// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BoardItem from '../viewer/src/components/items/BoardItem.vue';
import VisitorItem from '../viewer/src/components/items/VisitorItem.vue';
import { usePrivacy } from '../viewer/src/composables/usePrivacy';

/** 留言列表 / 访客列表的脱敏用例（usePrivacy 是模块级单例，每条用例后复位） */
function setHidden(value: boolean): void {
    const { hidden, toggle } = usePrivacy();
    if (hidden.value !== value) toggle();
}

const ownerUin = 1129136924;
const ownerName = '吕顺才';

describe('留言列表隐私脱敏', () => {
    afterEach(() => setHidden(false));

    const board = {
        uin: ownerUin,
        nickname: ownerName,
        content: '这是一条留言',
        pubtime: 1700000000,
        replyList: [{ uin: 10001, name: '小王', content: '这是回复', time: 1700000100 }],
    };

    it('隐私态：作者与回复人都脱敏、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(BoardItem, { props: { item: board } });
        const text = wrapper.text();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        // 回复人「小王」两字 → 首字 + *
        expect(text).toContain('小*');
        expect(text).not.toContain('小王');
        // 作者 + 回复人两个头像
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(2);

        wrapper.unmount();
    });

    it('非隐私态：显示原文且不模糊', () => {
        setHidden(false);
        const wrapper = mount(BoardItem, { props: { item: board } });
        const text = wrapper.text();

        expect(text).toContain(ownerName);
        expect(text).toContain('小王');
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(0);

        wrapper.unmount();
    });
});

describe('访客列表隐私脱敏', () => {
    afterEach(() => setHidden(false));

    const visitor = {
        uin: ownerUin,
        name: ownerName,
        time: 1700000000,
        // 同访的其他访客
        uins: [{ uin: 10001, name: '小王', time: 1700000100 }],
        shuoshuoes: [],
        blogs: [],
        photoes: [],
        shares: [],
    };

    it('隐私态：访客名与同访都脱敏、头像模糊、title 不泄露原名', () => {
        setHidden(true);
        const wrapper = mount(VisitorItem, { props: { item: visitor } });
        const text = wrapper.text();
        const html = wrapper.html();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        expect(text).toContain('小*');
        expect(text).not.toContain('小王');
        // 主访客 + 同访头像
        expect(wrapper.findAll('.privacy-blur').length).toBeGreaterThanOrEqual(2);
        // title 是隐藏旁路：隐私态不得残留原昵称
        expect(html).not.toContain(ownerName);

        wrapper.unmount();
    });

    it('非隐私态：显示原文且不模糊', () => {
        setHidden(false);
        const wrapper = mount(VisitorItem, { props: { item: visitor } });
        const text = wrapper.text();

        expect(text).toContain(ownerName);
        expect(text).toContain('小王');
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(0);

        wrapper.unmount();
    });
});
