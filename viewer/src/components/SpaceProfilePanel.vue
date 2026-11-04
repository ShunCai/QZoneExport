<script setup lang="ts">
import { computed } from 'vue';
import { buildSpaceProfileRows } from '../data/spaceProfile';
import { usePrivacy } from '../composables/usePrivacy';
import PrivacyToggle from './PrivacyToggle.vue';

const props = defineProps<{
    /** 个人档原始对象（Common/json/user.js 的 window.userInfo），字段缺失时整段不渲染 */
    user: Record<string, any> | null;
}>();

/** 空间资料渲染行；空数组时不渲染面板 */
const rows = computed(() => buildSpaceProfileRows(props.user));

// 隐私模式改为全局状态：这里的眼睛同时控制侧栏昵称/QQ 号、互动页 Top5 的 QQ 号
const { hidden, toggle } = usePrivacy();
</script>

<template>
    <div v-if="rows.length" class="space-profile">
        <div class="section-title-sm">
            <span class="sp-icon">👤</span> 空间资料
            <privacy-toggle />
        </div>
        <dl class="profile-grid">
            <template v-for="row in rows" :key="row.label">
                <div
                    class="profile-item"
                    :class="{ 'profile-item-wide': row.label === '个性签名' }"
                >
                    <dt class="profile-label">{{ row.label }}</dt>
                    <dd class="profile-value" :class="{ masked: hidden }">
                        {{ hidden ? '•••••' : row.value }}
                    </dd>
                </div>
            </template>
        </dl>
    </div>
</template>

<style scoped>
.space-profile {
    margin-bottom: 20px;
}
.section-title-sm {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 10px;
}
.sp-icon {
    font-size: 15px;
}
/* 两列网格：每格 = 标签(小字灰) + 值(主色)；个性签名跨整行 */
.profile-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 18px;
    margin: 0;
    padding: 14px 18px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    box-sizing: border-box;
}
.profile-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
}
.profile-item-wide {
    grid-column: 1 / -1;
}
.profile-label {
    flex: none;
    font-size: 12px;
    color: var(--text-muted);
    /* 固定宽度，让多行的「值」左对齐 */
    min-width: 48px;
}
.profile-value {
    margin: 0;
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
    word-break: break-word;
}
/* 隐私模式：值以掩码呈现，且不可选中复制 */
.profile-value.masked {
    color: var(--text-muted);
    letter-spacing: 2px;
    user-select: none;
}

/* 平板及以下：单列，避免两列挤压 */
@media (max-width: 780px) {
    .profile-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px 0;
    }
}
/* 手机：标签与值上下排布更紧凑 */
@media (max-width: 580px) {
    .profile-grid {
        padding: 12px 14px;
    }
    .profile-item {
        flex-direction: column;
        gap: 1px;
    }
    .profile-label {
        min-width: 0;
    }
}
</style>
