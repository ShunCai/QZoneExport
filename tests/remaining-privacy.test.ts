// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MessageItem from '../viewer/src/components/items/MessageItem.vue';
import ShareItem from '../viewer/src/components/items/ShareItem.vue';
import { maskedUserLabel } from '../viewer/src/data/mask';
import { usePrivacy } from '../viewer/src/composables/usePrivacy';

/** 最后一批散点：说说作者 / 转发原作者 / 分享作者 / 大图评论人的脱敏 */
function setHidden(value: boolean): void {
    const { hidden, toggle } = usePrivacy();
    if (hidden.value !== value) toggle();
}

const ownerUin = 1129136924;
const ownerName = '吕顺才';

describe('说说 / 分享作者脱敏', () => {
    afterEach(() => setHidden(false));

    const message = {
        uin: ownerUin,
        nickname: ownerName,
        content: '这是说说正文',
        created_time: 1700000000,
        rt_tid: 'rt-1',
        rt_uin: 10001,
        rt_uinname: '小王',
        rt_con: { content: '这是转发的内容' },
    };

    const share = {
        uin: ownerUin,
        nickname: ownerName,
        desc: '这是分享描述',
        custom_create_time: 1700000000,
    };

    it('说说：作者与转发原作者都脱敏、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(MessageItem, { props: { item: message } });
        const text = wrapper.text();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        // 转发原作者「小王」→ 小*
        expect(text).toContain('小*');
        expect(text).not.toContain('小王');
        expect(wrapper.findAll('.privacy-blur').length).toBeGreaterThanOrEqual(1);
        // 正文不是人名，不应被误改
        expect(text).toContain('这是说说正文');

        wrapper.unmount();
    });

    it('分享：作者脱敏、头像模糊', () => {
        setHidden(true);
        const wrapper = mount(ShareItem, { props: { item: share } });
        const text = wrapper.text();

        expect(text).toContain('吕*才');
        expect(text).not.toContain(ownerName);
        expect(wrapper.findAll('.privacy-blur').length).toBeGreaterThanOrEqual(1);

        wrapper.unmount();
    });

    it('非隐私态：显示原文且不模糊', () => {
        setHidden(false);
        const msgWrapper = mount(MessageItem, { props: { item: message } });
        expect(msgWrapper.text()).toContain(ownerName);
        expect(msgWrapper.text()).toContain('小王');
        expect(msgWrapper.findAll('.privacy-blur')).toHaveLength(0);
        msgWrapper.unmount();

        const shareWrapper = mount(ShareItem, { props: { item: share } });
        expect(shareWrapper.text()).toContain(ownerName);
        expect(shareWrapper.findAll('.privacy-blur')).toHaveLength(0);
        shareWrapper.unmount();
    });
});

describe('大图评论面板（MediaGrid 字符串拼接）用的统一出口', () => {
    it('有昵称时脱敏昵称；无昵称时打码 QQ，不露出原号', () => {
        expect(maskedUserLabel({ uin: ownerUin, name: ownerName })).toBe('吕*才');
        expect(maskedUserLabel({ uin: '10001' })).toBe('1***1');
        expect(maskedUserLabel({ uin: ownerUin })).not.toContain(String(ownerUin));
    });
});
