// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import UserList from '../viewer/src/components/UserList.vue';
import CommentList from '../viewer/src/components/CommentList.vue';
import { usePrivacy } from '../viewer/src/composables/usePrivacy';

/** 点赞/最近访问名单弹窗 + 评论/回复列表的脱敏用例 */
function setHidden(value: boolean): void {
    const { hidden, toggle } = usePrivacy();
    if (hidden.value !== value) toggle();
}

const ownerUin = 1129136924;
const ownerName = '吕顺才';

describe('点赞 / 最近访问名单（UserList）', () => {
    afterEach(() => setHidden(false));

    const users = [
        { uin: ownerUin, name: ownerName, isFriend: true },
        // 没昵称时模板会退回直接显示 QQ 号，这个兜底分支也必须打码
        { uin: 10001, isFriend: false },
    ];

    it('隐私态：昵称脱敏、QQ 打码（含无昵称的兜底行）、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(UserList, { props: { users } });
        const text = wrapper.text();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        expect(text).toContain('112*****24');
        expect(text).not.toContain(String(ownerUin));
        // 无昵称行：10001 → 1***1，原号不得出现
        expect(text).toContain('1***1');
        expect(text).not.toContain('10001');
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(2);

        wrapper.unmount();
    });

    it('非隐私态：显示原文且不模糊', () => {
        setHidden(false);
        const wrapper = mount(UserList, { props: { users } });
        const text = wrapper.text();

        expect(text).toContain(ownerName);
        expect(text).toContain(String(ownerUin));
        expect(text).toContain('10001');
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(0);

        wrapper.unmount();
    });
});

describe('评论 / 回复列表（CommentList）', () => {
    afterEach(() => setHidden(false));

    const comments = [
        {
            uin: ownerUin,
            name: ownerName,
            content: '这是一条评论',
            replies: [{ uin: 10001, name: '小王', content: '这是一条回复' }],
        },
    ];
    const userOf = (c: Record<string, any>) => ({ uin: c.uin, name: c.name });
    const repliesOf = (c: Record<string, any>) => c.replies || [];

    it('隐私态：评论人与回复人都脱敏、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(CommentList, {
            props: { comments, userOf, repliesOf },
        });
        const text = wrapper.text();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        expect(text).toContain('小*');
        expect(text).not.toContain('小王');
        // 评论头像 + 回复头像
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(2);
        // 正文不是人名，不应被误改
        expect(text).toContain('这是一条评论');

        wrapper.unmount();
    });

    it('非隐私态：显示原文且不模糊', () => {
        setHidden(false);
        const wrapper = mount(CommentList, {
            props: { comments, userOf, repliesOf },
        });
        const text = wrapper.text();

        expect(text).toContain(ownerName);
        expect(text).toContain('小王');
        expect(wrapper.findAll('.privacy-blur')).toHaveLength(0);

        wrapper.unmount();
    });
});
