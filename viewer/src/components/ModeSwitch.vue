<script setup lang="ts">
/**
 * 「地点 / 城市」这类轻量文字切换
 *
 * 首页常驻卡与「常驻地点」榜单面板共用：当前项蓝色加粗，另一项灰色，中间斜杠分隔，
 * 不带灰底方块（早期实现是灰底按钮组，在卡片标题里显得突兀）。
 */
export interface ModeSwitchOption {
    label: string;
    value: string;
}

defineProps<{
    modelValue: string;
    options: ModeSwitchOption[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
    <span class="mode-switch">
        <button
            v-for="option in options"
            :key="option.value"
            type="button"
            :class="{ on: modelValue === option.value }"
            @click.stop="emit('update:modelValue', option.value)"
        >{{ option.label }}</button>
    </span>
</template>

<style scoped>
.mode-switch {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
    font-size: 11px;
}
.mode-switch button {
    border: 0;
    background: transparent;
    padding: 1px 4px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    cursor: pointer;
}
.mode-switch button:hover {
    color: var(--text-primary);
}
.mode-switch button.on {
    color: var(--accent);
    font-weight: 600;
}
.mode-switch button + button::before {
    content: '/';
    margin-right: 4px;
    color: var(--border-hover, #c9d1dc);
    font-weight: 400;
}
</style>
