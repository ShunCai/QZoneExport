// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PrivacyToggle from '../viewer/src/components/PrivacyToggle.vue';
import { usePrivacy } from '../viewer/src/composables/usePrivacy';

/**
 * 组件测试环境冒烟 + 隐私开关单例行为
 *
 * 这是项目第一个 .vue 组件测试：先确认 @vue/test-utils + @vitejs/plugin-vue
 * 在 vitest 下能正常编译与挂载，后续按组件逐个补「隐私态渲染」用例。
 */
describe('组件测试环境（冒烟）', () => {
    it('能 mount .vue 组件并渲染按钮', () => {
        const wrapper = mount(PrivacyToggle);
        expect(wrapper.find('button.privacy-toggle').exists()).toBe(true);
        // 睁眼 / 斜杠眼两套 SVG 二选一
        expect(wrapper.findAll('svg')).toHaveLength(1);
    });

    it('点击直接切换全局隐私状态（usePrivacy 单例）', async () => {
        const { hidden, toggle } = usePrivacy();
        const before = hidden.value;

        await mount(PrivacyToggle).find('button').trigger('click');
        expect(hidden.value).toBe(!before);

        // 复位，避免影响其它用例
        toggle();
        expect(hidden.value).toBe(before);
    });
});
