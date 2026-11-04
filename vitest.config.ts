import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    // 组件测试（@vue/test-utils）需要编译 .vue；
    // 需要 DOM 的用例在文件头加 // @vitest-environment happy-dom
    plugins: [vue()],
    test: {
        // P2起核心域层单测放入 tests/ 目录
        include: ['tests/**/*.test.ts'],
        passWithNoTests: true,
    },
});
