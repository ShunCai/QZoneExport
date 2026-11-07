<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { buildSpaceProfileRows } from '../../data/spaceProfile';
import { usePrivacy } from '../../composables/usePrivacy';

const props = defineProps<{
    open: boolean;
    user: Record<string, any> | null;
}>();

const emit = defineEmits<{ close: [] }>();

const { hidden: hideSensitive } = usePrivacy();
const rows = computed(() => buildSpaceProfileRows(props.user));
const dialogRef = ref<HTMLElement | null>(null);

watch(
    () => props.open,
    async (open) => {
        if (!open) return;
        await nextTick();
        dialogRef.value?.focus();
    },
);
</script>

<template>
    <div v-if="open" class="profile-overlay" @click.self="emit('close')">
        <div
            ref="dialogRef"
            class="profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="空间资料"
            tabindex="-1"
            @keydown.esc="emit('close')"
        >
            <div class="dialog-head">
                <strong>空间资料</strong>
                <button type="button" @click="emit('close')">关闭</button>
            </div>
            <dl v-if="rows.length" class="profile-grid">
                <div v-for="row in rows" :key="row.label" :class="{ wide: row.label === '个性签名' }">
                    <dt>{{ row.label }}</dt>
                    <dd :class="{ 'privacy-blur': hideSensitive }">{{ row.value }}</dd>
                </div>
            </dl>
            <p v-else class="empty">暂无空间资料</p>
        </div>
    </div>
</template>

<style scoped>
.profile-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.28);
}
.profile-dialog {
    width: min(440px, 90vw);
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    outline: none;
    color: var(--text-primary);
}
.dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-card);
}
.dialog-head strong {
    font-size: 14px;
    font-weight: 500;
}
.dialog-head button {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
}
.dialog-head button:hover {
    color: var(--accent-pressed);
}
.profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 18px;
    margin: 0;
    padding: 18px 20px 20px;
}
.profile-grid .wide {
    grid-column: 1 / -1;
}
.profile-grid dt {
    font-size: 11px;
    color: var(--text-muted);
}
.profile-grid dd {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-word;
}
.empty {
    padding: 18px 20px 22px;
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
}
@media (max-width: 520px) {
    .profile-grid {
        grid-template-columns: 1fr;
    }
}
</style>
