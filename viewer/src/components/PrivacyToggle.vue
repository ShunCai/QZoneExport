<script setup lang="ts">
import { usePrivacy } from '../composables/usePrivacy';

/**
 * 隐私开关按钮（唯一的图标来源）
 *
 * 三处入口共用：侧栏头像卡片、空间资料面板标题旁、互动页 Top5 标题行。
 * 图标/尺寸/hover/aria 全部收敛在这里，避免各处 emoji 与 SVG 混用导致观感不一致。
 * 状态来自 usePrivacy 的模块级单例，任意一处点击，其余入口同步。
 */
const { hidden, toggle } = usePrivacy();
</script>

<template>
    <button
        type="button"
        class="privacy-toggle"
        :aria-label="hidden ? '显示隐私信息（含昵称与 QQ 号）' : '隐藏隐私信息（含昵称与 QQ 号）'"
        :title="hidden ? '显示隐私信息（含昵称与 QQ 号）' : '隐藏隐私信息（含昵称与 QQ 号）'"
        @click="toggle"
    >
        <svg
            v-if="!hidden"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
        <svg
            v-else
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    </button>
</template>

<style scoped>
.privacy-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-light, var(--border-card));
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.privacy-toggle:hover {
    background: var(--bg-toolbar, transparent);
    color: var(--accent, #2080f0);
    border-color: var(--accent, #2080f0);
}
</style>
