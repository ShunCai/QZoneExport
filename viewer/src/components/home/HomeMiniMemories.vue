<script setup lang="ts">
interface MiniMemoryItem {
    label: string;
    text: string;
    color: string;
}

defineProps<{ items: MiniMemoryItem[] }>();
</script>

<template>
    <div v-if="items.length" class="mini-grid">
        <div v-for="item in items" :key="item.label" class="mini">
            <span class="tag" :style="{ background: item.color }" />
            <div class="t">{{ item.label }}</div>
            <div class="x">{{ item.text }}</div>
        </div>
    </div>
</template>

<style scoped>
.mini-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
}
.mini {
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    padding: 16px 18px;
    min-width: 0;
}
.tag {
    display: block;
    width: 100%;
    height: 3px;
    border-radius: 2px;
    margin-bottom: 12px;
}
.t {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}
.x {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
@media (max-width: 860px) {
    .mini-grid {
        grid-template-columns: 1fr;
    }
}
</style>
