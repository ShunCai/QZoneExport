<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { loadItems, type DataKey } from '../../data/sources';
import { thatYearToday } from '../../data/thatYearToday';
import { resolvePhotoTime } from '../../data/media';
import { formatTime } from '../../data/format';
import { summaryOf, plainText } from '../../data/summary';
import { navigate } from '../../router';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent } from '../../data/mask';

const { hidden: hideSensitive } = usePrivacy();

interface Memory {
    year: string;
    label: string;
    text: string;
    route: string;
    query?: Record<string, string>;
}

const MODULES: {
    key: DataKey;
    label: string;
    route: string;
    timeOf: (item: Record<string, any>) => any;
}[] = [
    { key: 'messages', label: '说说', route: 'messages', timeOf: (i) => i.created_time || i.custom_create_time },
    { key: 'blogs', label: '日志', route: 'blogs', timeOf: (i) => i.pubtime || i.pubTime },
    { key: 'diaries', label: '日记', route: 'diaries', timeOf: (i) => i.pubtime || i.pubTime },
    { key: 'boards', label: '留言', route: 'boards', timeOf: (i) => i.pubtime },
    { key: 'shares', label: '分享', route: 'shares', timeOf: (i) => i.shareTime },
    { key: 'favorites', label: '收藏', route: 'favorites', timeOf: (i) => i.create_time },
    { key: 'videos', label: '视频', route: 'videos', timeOf: (i) => i.uploadtime || i.uploadTime },
];

const items = ref<Memory[]>([]);
const total = ref(0);
const loading = ref(true);

const todayLabel = computed(() => {
    const now = new Date();
    return `${now.getMonth() + 1} 月 ${now.getDate()} 日`;
});

/** 卡片只列最近 5 条，完整条目卡在 #/memories */
const noteText = computed(() => (total.value > 0 ? `${todayLabel.value} · 共 ${total.value} 条` : todayLabel.value));

/** 相册名：没名字时别在卡片上写「无内容」 */
function albumNameOf(album: Record<string, any>): string {
    const name = plainText(album?.name || album?.title || '');
    if (!name) return '未命名相册';
    return name.length > 20 ? name.slice(0, 20) + '…' : name;
}

onMounted(async () => {
    const memories: Memory[] = [];
    for (const module of MODULES) {
        const list = await loadItems<Record<string, any>>(module.key);
        for (const group of thatYearToday(list, module.timeOf)) {
            for (const item of group.items) {
                memories.push({
                    year: group.year,
                    label: module.label,
                    // 摘要口径与榜单/完整清单页共用（留言正文在 htmlContent，不在 content）
                    text: summaryOf(module.key, item, 42),
                    route: module.route,
                });
            }
        }
    }

    const albums = await loadItems<Record<string, any>>('albums');
    for (const album of albums) {
        const photos = (album.photoList || []) as Record<string, any>[];
        for (const group of thatYearToday(photos, (photo) => resolvePhotoTime(photo, 'upload'))) {
            const time = formatTime(resolvePhotoTime(group.items[0], 'upload'));
            memories.push({
                year: group.year,
                label: '相片',
                text: `「${albumNameOf(album)}」${group.items.length} 张 · ${time.slice(0, 10)}`,
                route: 'albums',
                query: album.id ? { id: String(album.id) } : undefined,
            });
        }
    }

    items.value = memories
        .sort((a, b) => Number(b.year) - Number(a.year))
        .slice(0, 5);
    total.value = memories.length;
    loading.value = false;
});

function open(memory: Memory): void {
    navigate(memory.route, memory.query);
}
</script>

<template>
    <div class="home-card">
        <div class="card-title">
            <span>那年今日</span>
            <span class="note">{{ noteText }}</span>
        </div>
        <div v-if="items.length" class="list">
            <button
                v-for="(item, i) in items"
                :key="`${item.year}-${i}`"
                type="button"
                class="row"
                @click="open(item)"
            >
                <span class="year">{{ item.year }}</span>
                <span class="body">
                    <span class="label">{{ item.label }}</span>
                    <span class="text">{{ hideSensitive ? maskContent(item.text) : item.text }}</span>
                </span>
            </button>
        </div>
        <p v-else class="empty">{{ loading ? '正在统计…' : '今天没有往年记录' }}</p>
        <button type="button" class="card-more" @click="navigate('memories', { type: 'thatYear', from: 'home' })">
            查看更多 →
        </button>
    </div>
</template>

<style scoped>
.home-card {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    padding: 20px;
    min-width: 0;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.home-card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.card-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
}
.card-title .note {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}
/* 与右侧「回忆之最」同高：行按可用高度均分，避免底部留出一块空白 */
.list {
    /* 回忆组三张卡都是固定 5 条清单：行按可用高度均分，三卡行基线才能对齐 */
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.row {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 0;
    border: none;
    border-bottom: 1px solid var(--border-light);
    background: transparent;
    text-align: left;
    cursor: pointer;
}
.row:last-child {
    border-bottom: none;
}
.row:hover .text {
    color: var(--accent-pressed);
}
.year {
    flex: 0 0 44px;
    font-size: 13px;
    color: var(--accent);
}
.body {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.label {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--text-muted);
}
.text {
    min-width: 0;
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.card-more {
    align-self: flex-start;
    margin-top: 12px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.card-more:hover {
    color: var(--accent-pressed);
}
.empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
