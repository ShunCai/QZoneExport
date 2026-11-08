<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSelect } from 'naive-ui';
import { loadList } from '../data/sources';
import { favoriteReason, favoriteTypeLabel } from '../data/content';
import ListPage from '../components/ListPage.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import FavoriteItem from '../components/items/FavoriteItem.vue';

/**
 * 收藏列表（数据来自 Favorites/json/favorites.js）
 * 单条收藏的渲染在 items/FavoriteItem.vue，与个人中心的那年今日共用同一套。
 */
const loading = ref(true);
const list = ref<Record<string, any>[]>([]);

onMounted(async () => {
    list.value = await loadList('favorites');
    loading.value = false;
});

/** 类型筛选：收藏的内容类型比较杂，按类型筛一下才找得到东西 */
const type = ref('');
const typeOptions = computed(() => {
    const names = new Set<string>();
    for (const item of list.value) {
        names.add(favoriteTypeLabel(item));
    }
    return [{ label: '全部类型', value: '' }]
        .concat([...names].sort().map((name) => ({ label: name, value: name })));
});
/** 用 computed 而非模板内联函数，否则每次渲染都是新函数、会不断重置页码 */
const typeFilter = computed(() => (item: Record<string, any>) => (
    !type.value || favoriteTypeLabel(item) === type.value
));
</script>

<template>
    <list-page
        title="收藏"
        :pref-key="'favorites'"
        :items="list"
        :loading="loading"
        empty-hint="暂无收藏内容（本次备份可能未包含收藏模块）"
        :time-of="(item) => item.custom_create_time || item.create_time"
        :filter="typeFilter"
        sort-label="收藏时间"
        :text-of="(item) => [item.title, item.abstract, item.desp, favoriteReason(item)].filter(Boolean).join(' ')"
    >
        <!-- 那年今日（按收藏时间算） -->
        <template #lead>
        </template>

        <template #toolbar>
            <div class="toolbar-group">
                <span class="toolbar-label">类型</span>
                <n-select v-model:value="type" :options="typeOptions" style="width: 130px;" />
            </div>
        </template>

        <template #default="{ items }">
            <favorite-item v-for="(item, index) in items" :key="item.id || index" :item="item" />
        </template>
    <template #after-toolbar>
            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.custom_create_time || item.create_time"
            >
                <template #item="{ item }">
                    <favorite-item :item="item" />
                </template>
            </that-year-today>
    </template>
    </list-page>
</template>
