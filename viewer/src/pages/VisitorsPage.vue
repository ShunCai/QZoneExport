<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { loadData } from '../data/sources';
import ListPage from '../components/ListPage.vue';
import ThatYearToday from '../components/ThatYearToday.vue';
import VisitorItem from '../components/items/VisitorItem.vue';

/**
 * 访客列表（数据来自 Visitors/json/visitors.js，挂载为 visitorInfo）
 * 每条访客记录带着他访问过的说说/日志/相册/分享，以及当天同样访问过这些内容的其他访客（uins）；
 * 单条记录的渲染在 items/VisitorItem.vue，与个人中心的那年今日共用同一套。
 */
const loading = ref(true);
const list = ref<Record<string, any>[]>([]);

onMounted(async () => {
    const data = await loadData<{ items?: Record<string, any>[] }>('visitors');
    list.value = Array.isArray(data?.items) ? data.items : [];
    loading.value = false;
});
</script>

<template>
    <list-page
        title="访客"
        :pref-key="'visitors'"
        :items="list"
        :loading="loading"
        empty-hint="暂无访客记录（本次备份可能未包含访客模块）"
        unit="位"
        :page-size="30"
        sort-label="访问时间"
        :time-of="(item) => item.time"
        :text-of="(item) => [item.name, item.uin].filter(Boolean).join(' ')"
    >
        <!-- 那年今日（按访问时间算） -->
        <template #lead>
        </template>

        <template #default="{ items }">
            <visitor-item
                v-for="(item, index) in items"
                :key="(item.uin || '') + '-' + index"
                :item="item"
            />
        </template>
    <template #after-toolbar>
            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.time"
            >
                <template #item="{ item }">
                    <visitor-item :item="item" />
                </template>
            </that-year-today>
    </template>
    </list-page>
</template>
