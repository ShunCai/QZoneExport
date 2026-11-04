<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { NSelect, NTag, NEmpty, NPagination, NSpin } from 'naive-ui';
import { formatTime } from '../data/format';
import {
    loadOwnerTargetInteraction,
    type OwnerTargetInteraction as OwnerTargetInteractionData,
    type InteractionEntry,
    type InteractionCategory,
} from '../data/owner-target';
import { navigate, openInNewTab, routeQuery } from '../router';
import { heShe } from '../data/pronoun';
import { loadTopPeople, type TopPerson } from '../data/top-people';
import { usePrivacy } from '../composables/usePrivacy';
import { maskName } from '../data/mask';
import PrivacyToggle from '../components/PrivacyToggle.vue';
import OwnerTargetInteraction from '../components/OwnerTargetInteraction.vue';
import MessageItem from '../components/items/MessageItem.vue';
import ArticleItem from '../components/items/ArticleItem.vue';
import BoardItem from '../components/items/BoardItem.vue';

const props = defineProps<{
    user: Record<string, any> | null;
}>();

/** 入口态的「互动最多的人」：全站聚合，点击直接带入好友 QQ 号，省去手输 */
const topPeople = ref<TopPerson[]>([]);
function chooseFriend(p: TopPerson): void {
    if (!p.uin) return;
    friendInput.value = p.uin;
    confirmFriend();
}
/** 隐私开关与其它入口共用同一状态：关闭后 Top5 不显示 QQ 号（按钮本身见 PrivacyToggle.vue） */
const { hidden: hideSensitive } = usePrivacy();

/** Top5 行悬浮提示：赞 / 评论参与排名，访客只作附注 */
function personTooltip(p: TopPerson): string {
    const parts = [`赞 ${p.likes}`, `评论 ${p.comments}`];
    if (p.visits) parts.push(`另访问 ${p.visits} 条内容`);
    return parts.join(' · ');
}
// user 由 App.vue 异步加载，用 immediate watch 覆盖挂载前后两种情况
watch(() => props.user, async (u) => {
    topPeople.value = u ? await loadTopPeople(u) : [];
}, { immediate: true });

/**
 * 是否为「本人备份」（Owner === Target，即备份的是自己的空间）。
 * 他人空间备份：自动以「我(备份者) ↔ TA(空间主人)」统计互动；
 * 本人备份：需先输入好友 QQ，再以「好友(owner) ↔ 我(target)」反转统计。
 */
const isSelfMode = computed(() => {
    const u = props.user;
    if (!u) return false;
    const owner = u.ownerUin;
    const target = u.uin;
    const other = owner !== undefined && owner !== null && owner !== '' && String(owner) !== String(target);
    return !other;
});

/** 本人备份：待查看互动的好友 QQ（确认后才会统计） */
const friendInput = ref('');
const confirmedFriend = ref<string | null>(null);
const friendError = ref('');

function confirmFriend(): void {
    const v = friendInput.value.trim();
    if (!v) { friendError.value = '请输入好友 QQ 号'; return; }
    if (!/^\d{4,15}$/.test(v)) { friendError.value = 'QQ 号应为 4–15 位数字'; return; }
    friendError.value = '';
    confirmedFriend.value = v;
    page.value = 1;
    // 持久化到 URL，刷新不丢
    navigate('interaction', { qq: v });
    reload();
}

function resetFriend(): void {
    confirmedFriend.value = null;
    friendInput.value = '';
    data.value = null;
}

/** 他人空间：按空间主人性别取代词（他/她），性别未知回退「TA」 */
const t = computed(() => heShe(props.user?.sex));

/** 方向文案随模式反转：本人备份下「me=对方主动 / ta=我回应」；他人空间按空间主人性别取代词 */
function dirLabel(dir: 'me' | 'ta'): string {
    if (isSelfMode.value) return dir === 'me' ? '对方主动' : '我回应';
    return dir === 'me' ? '我主动' : `${t.value}回应`;
}

const dirOptions = computed(() => [
    { value: 'all', label: '全部' },
    { value: 'me', label: isSelfMode.value ? '对方主动' : '我主动' },
    { value: 'ta', label: isSelfMode.value ? '我回应' : `${t.value}回应` },
]);


const data = ref<OwnerTargetInteractionData | null>(null);
const loading = ref(true);

const TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: '全部类型' },
    { value: 'message', label: '说说' },
    { value: 'blog', label: '日志' },
    { value: 'board', label: '留言' },
    { value: 'album', label: '相册' },
    { value: 'photo', label: '相片' },
    { value: 'share', label: '分享' },
    { value: 'video', label: '视频' },
];

/** 动作类别：与统计卡片一一对应，点击卡片按此精确筛选 */
const CATEGORY_OPTIONS: { value: InteractionCategory | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'board', label: '留言' },
    { value: 'comment', label: '评论' },
    { value: 'reply', label: '回应' },
    { value: 'like', label: '点赞' },
];

const filterType = ref('all');
const filterDir = ref<'all' | 'me' | 'ta'>('all');
const filterCategory = ref<InteractionCategory | 'all'>('all');
const page = ref(1);
const PAGE_SIZE = 50;

/**
 * 当前筛选是否对应某张核心指标卡片（用于点亮卡片、形成「点卡片=选中」的视觉闭环）。
 * 与 onStatClick 的 (category, dir) 映射严格互逆——手动把下拉配成该组合也会点亮对应卡片，
 * 点「全部」则自动熄灭，保证卡片高亮与真实筛选状态永远一致。
 */
const activeStat = computed<null | 'boards' | 'comments' | 'replies' | 'likes'>(() => {
    const c = filterCategory.value;
    const d = filterDir.value;
    if (c === 'board' && d === 'me') return 'boards';
    if (c === 'comment' && d === 'me') return 'comments';
    if (c === 'reply' && d === 'ta') return 'replies';
    if (c === 'like' && d === 'me') return 'likes';
    return null;
});

/** 是否有任意筛选生效（用于显示「清除筛选」按钮） */
const hasActiveFilter = computed(() =>
    filterType.value !== 'all' || filterCategory.value !== 'all' || filterDir.value !== 'all',
);

/** 工具栏 DOM 引用：点击卡片后平滑滚动到此，把视线从顶部卡片带到筛选结果 */
const toolbarRef = ref<HTMLElement | null>(null);
/** 计数脉冲 key：变化时重挂 span 以重放 CSS 动画，吸引注意 */
const pulseKey = ref(0);

function scrollToResults(): void {
    toolbarRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearFilter(): void {
    filterType.value = 'all';
    filterCategory.value = 'all';
    filterDir.value = 'all';
    page.value = 1;
}

/** 从 URL 恢复筛选参数（统计卡片点击跳转时携带 category/dir） */
function initFiltersFromQuery(): void {
    const q = routeQuery.value;
    if (q.type && TYPE_OPTIONS.some((o) => o.value === q.type)) {
        filterType.value = q.type;
    }
    if (q.category && CATEGORY_OPTIONS.some((o) => o.value === q.category)) {
        filterCategory.value = q.category as InteractionCategory;
    }
    if (q.dir === 'me' || q.dir === 'ta') {
        filterDir.value = q.dir;
    }
}

/**
 * 概览面板核心指标卡片点击：按 (category, dir) 精确筛选互动明细（不跳页）。
 * 卡片的语义是「某一动作类别 + 某一方向」，因此同时锁定 category 与 dir，并复位 type——
 * 避免只传 dir 时混入无关类型（如「TA评论」混入点赞），也避免前一次 type 残留（issue 1）。
 * category 与明细列表同源（均来自 events 的 category 字段），保证「点卡片 == 筛出的条数」。
 */
function applyStatFilter(payload: { category: InteractionCategory; dir: 'me' | 'ta' }): void {
    filterCategory.value = payload.category;
    filterDir.value = payload.dir;
    filterType.value = 'all';
    page.value = 1;
    // 点击卡片后把视线从顶部卡片带到下方筛选结果与计数（解决「静默筛选像没反应」）
    nextTick(scrollToResults);
}

/** 概览面板访问卡片点击：新标签页打开对应模块页并携带浏览者 UIN（不覆盖当前互动页） */
function onVisitCardClick(payload: { module: string; visitorUin: string }): void {
    openInNewTab(payload.module, { visitor: payload.visitorUin });
}

function kindLabel(type: string): string {
    const map: Record<string, string> = {
        message: '说说', board: '留言', blog: '日志',
        share: '分享', video: '视频', photo: '相片', album: '相册',
    };
    return map[type] || type;
}

/** 紧凑标题：与 OwnerTargetInteraction 的 entryTitle 保持一致 */
function entryTitle(entry: InteractionEntry): string {
    const it = entry.item || {};
    switch (entry.type) {
        case 'message': return (it.content || '').slice(0, 60) || '说说';
        case 'blog': return it.title || '日志';
        case 'board': return (it.content || '').slice(0, 60) || '留言';
        case 'share': return (it.content || it.title || '').slice(0, 60) || '分享';
        case 'video': return it.name || it.title || '视频';
        case 'photo': return it.name || it.desc || '相片';
        case 'album': return it.name || '相册';
        default: return '';
    }
}

/** 点击条目跳转到对应模块页面，携带来源信息用于返回 */
function navToItem(entry: InteractionEntry): void {
    const it = entry.item || {};
    const backParams: Record<string, string> = { from: 'interaction' };
    if (confirmedFriend.value) backParams.qq = confirmedFriend.value;

    switch (entry.type) {
        case 'message':
            navigate('messages', { ...backParams, id: String(it.tid ?? '') });
            break;
        case 'blog':
            navigate('blogs', { ...backParams, id: String(it.blogid ?? it.blogId ?? it.id ?? '') });
            break;
        case 'board':
            navigate('boards', { ...backParams, id: String(it.tid ?? it.id ?? '') });
            break;
        case 'album':
        case 'photo':
            navigate('albums', backParams);
            break;
        case 'share':
            navigate('shares', { ...backParams, id: String(it.id ?? it.shareId ?? '') });
            break;
        case 'video':
            navigate('videos', backParams);
            break;
    }
}

/** 从条目中提取稳定的主体标识，用于去重 */
function itemDedupKey(entry: InteractionEntry): string {
    const it = entry.item || {};
    const id = it.tid ?? it.id ?? it.blogid ?? it.blogId ?? it.shareId
        ?? it.lloc ?? it.vid ?? it.hash ?? it.pubtime ?? it.uploadtime
        ?? it.msgid ?? '';
    return entry.type + ':' + id;
}

const filtered = computed(() => {
    if (!data.value) return [];
    const items = data.value.events.filter((e) => {
        if (filterType.value !== 'all' && e.type !== filterType.value) return false;
        if (filterCategory.value !== 'all' && e.category !== filterCategory.value) return false;
        if (filterDir.value !== 'all' && e.dir !== filterDir.value) return false;
        return true;
    });
    // 按主体去重：同一条博客/说说等可能在列表中因评论+点赞出现多次
    const seen = new Set<string>();
    return items.filter((e) => {
        const key = itemDedupKey(e);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const paged = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE;
    return filtered.value.slice(start, start + PAGE_SIZE);
});

function reload(): void {
    if (!props.user) {
        data.value = null;
        loading.value = false;
        return;
    }
    // 本人备份：需先指定好友 QQ，未指定时不加载（呈现输入表单）
    if (isSelfMode.value) {
        if (!confirmedFriend.value) {
            data.value = null;
            loading.value = false;
            return;
        }
        loading.value = true;
        loadOwnerTargetInteraction(props.user, { ownerUin: confirmedFriend.value })
            .then((stat) => { data.value = stat; if (hasActiveFilter.value) nextTick(scrollToResults); })
            .catch(() => { data.value = null; })
            .finally(() => { loading.value = false; });
        return;
    }
    // 他人空间备份：现有逻辑，自动以「我(备份者) ↔ TA(空间主人)」统计
    loading.value = true;
    loadOwnerTargetInteraction(props.user)
        .then((stat) => { data.value = stat; if (hasActiveFilter.value) nextTick(scrollToResults); })
        .catch(() => { data.value = null; })
        .finally(() => { loading.value = false; });
}

onMounted(() => {
    // 从 URL 恢复上次输入的好友 QQ（刷新不丢）
    const qqParam = routeQuery.value.qq;
    if (qqParam && /^\d{4,15}$/.test(qqParam) && isSelfMode.value) {
        friendInput.value = qqParam;
        confirmedFriend.value = qqParam;
    }
    // 从 URL 恢复筛选参数（统计卡片点击跳转时携带 type/dir）
    initFiltersFromQuery();
    reload();
});
watch(() => props.user, () => { page.value = 1; confirmedFriend.value = null; friendInput.value = ''; reload(); });
// 切换筛选条件时回到第一页，避免停留在越界的页码
watch([filterType, filterCategory, filterDir], () => { page.value = 1; });
// 筛选结果变化时重放计数脉冲动画（pulseKey 改变 → span 重挂 → CSS 动画重放）
watch(filtered, () => { pulseKey.value++; });
</script>

<template>
    <div class="ip-page" :class="{ 'ip-page-centered': isSelfMode && !confirmedFriend }">
        <!-- 本人备份：先输入待查看互动的好友 QQ 号 -->
        <div v-if="isSelfMode && !confirmedFriend" class="ip-friend-input">
            <h3 class="ip-fi-title">查看与好友的互动</h3>
            <p class="ip-fi-desc">请输入要查看互动的好友 QQ 号，确认后将统计对方在你空间留下的评论、留言、点赞等往来。</p>

            <!-- 互动最多的人：点击直接带入 QQ 号，避免「不知道该查谁」 -->
            <div v-if="topPeople.length" class="ip-fi-top">
                <div class="ip-fi-top-title">
                    <span>互动 TOP5 <em>（点击直接查看）</em></span>
                    <privacy-toggle />
                </div>
                <button
                    v-for="(p, i) in topPeople"
                    :key="p.key"
                    type="button"
                    class="ip-fi-person"
                    :disabled="!p.uin"
                    :title="personTooltip(p)"
                    @click="chooseFriend(p)"
                >
                    <span class="ip-fi-rank">{{ i + 1 }}</span>
                    <span class="ip-fi-person-main">
                        <!-- 隐私模式下昵称脱敏而非全隐：TOP5 要能点选，全盖掉只剩次数就没法用 -->
                        <span class="ip-fi-name">{{ hideSensitive ? maskName(p.name || p.uin || '未署名') : (p.name || p.uin || '未署名') }}</span>
                        <!-- 附灰色 QQ 号：昵称可能与他人（含自己的小号）重名，仅靠昵称无法区分 -->
                        <span v-if="!hideSensitive && p.uin" class="ip-fi-uin">{{ p.uin }}</span>
                    </span>
                    <span class="ip-fi-count">{{ p.score }} 次</span>
                </button>
                <div v-if="topPeople.some((p) => !p.uin)" class="ip-fi-top-hint">未署名记录缺少 QQ 号，无法直接跳转</div>
            </div>

            <div class="ip-fi-row">
                <input
                    class="ip-fi-input"
                    v-model="friendInput"
                    type="text"
                    inputmode="numeric"
                    placeholder="好友 QQ 号"
                    @keyup.enter="confirmFriend"
                />
                <button class="ip-fi-btn" type="button" @click="confirmFriend">确认</button>
            </div>
            <div v-if="friendError" class="ip-fi-error">{{ friendError }}</div>
        </div>

        <div v-else-if="loading" class="ip-loading"><n-spin size="large" /></div>

        <n-empty
            v-else-if="!data && isSelfMode && confirmedFriend"
            description="未找到你与该好友的互动记录，可能对方未在你的空间留下评论、留言或点赞。"
            class="ip-empty"
        />
        <n-empty
            v-else-if="!data && !isSelfMode"
            description="该备份不是他人空间备份，没有互动明细。"
            class="ip-empty"
        />

        <div v-else-if="data" class="ip-body">
            <!-- 本人备份：显示当前好友 + 可切换 -->
            <div v-if="isSelfMode && confirmedFriend" class="ip-friend-bar">
                <span>正在查看与 <b>{{ data.ownerName || confirmedFriend }}</b> 的互动</span>
                <button class="ip-fi-btn ip-fi-btn-sm" type="button" @click="resetFriend(); reload();">换个好友</button>
            </div>

            <!-- 主面板：概览卡片（含核心指标 / 初见与重逢 / 趋势），事件总数显示在标题行 -->
            <owner-target-interaction
                :data="data"
                :mode="isSelfMode ? 'self' : 'other'"
                :target-sex="props.user?.sex"
                :show-entries="true"
                :show-trend="true"
                :total-events="data.events.length"
                :active-stat="activeStat"
                @stat-click="applyStatFilter"
                @visit-click="onVisitCardClick"
            />

            <!-- 筛选 + 时间线：三个正交维度，按「主体类型 / 互动类型 / 互动方向」重排 -->
            <div class="ip-toolbar" ref="toolbarRef">
                <span class="ip-field">主体类型
                    <n-select v-model:value="filterType" :options="TYPE_OPTIONS" style="width: 110px;" />
                </span>
                <span class="ip-field">互动类型
                    <n-select v-model:value="filterCategory" :options="CATEGORY_OPTIONS" style="width: 130px;" />
                </span>
                <span class="ip-field">互动方向
                    <n-select v-model:value="filterDir" :options="dirOptions" style="width: 120px;" />
                </span>
                <span class="ip-count" :key="pulseKey">筛选后 {{ filtered.length }} 条</span>
                <button v-if="hasActiveFilter" class="ip-clear" type="button" @click="clearFilter">清除筛选</button>
            </div>

            <div class="ip-timeline">
                <div v-for="(e, i) in paged" :key="i" class="ip-event" :class="e.dir" @click="navToItem(e)">
                    <div class="ip-event-head">
                        <n-tag size="small" :bordered="false" :type="e.dir === 'me' ? 'info' : 'success'">
                            {{ kindLabel(e.type) }}
                        </n-tag>
                        <span class="ip-dir" :class="e.dir">{{ dirLabel(e.dir) }}</span>
                        <span class="ip-time">{{ formatTime(e.time) }}</span>
                    </div>
                    <div class="ip-event-body">
                        <message-item v-if="e.type === 'message'" :item="e.item" />
                        <article-item v-else-if="e.type === 'blog'" :item="e.item" config-key="Blogs" />
                        <board-item v-else-if="e.type === 'board'" :item="e.item" />
                        <div v-else class="ip-compact-entry">
                            <span class="ip-compact-title">{{ entryTitle(e) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ip-pager" v-if="totalPages > 1">
                <n-pagination
                    :page="page"
                    :page-count="totalPages"
                    @update:page="(p: number) => (page = p)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.ip-page {
    height: 100%;
    overflow-y: auto;
    padding: 18px 20px 28px;
    box-sizing: border-box;
}
/* 本人备份未确认好友时：输入卡片居中 */
.ip-page-centered {
    display: flex;
    flex-direction: column; /* 主轴垂直，配合子元素的 margin:auto 做上下居中 */
    overflow-y: auto;
}
.ip-empty {
    padding: 60px 0;
}
/* 本人备份：好友 QQ 输入卡片 */
.ip-friend-input {
    max-width: 460px;
    /* auto 外边距：空间够时上下+左右都居中；内容超高时 auto 退化为 0，从顶部开始且可滚动，不会裁掉顶部 */
    margin: auto;
    padding: 22px 24px 24px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.ip-fi-title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
}
.ip-fi-desc {
    margin: 0 0 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
}
/* 入口态 Top5：紧凑列表，不做卡片堆叠，避免盖住下方的 QQ 号输入框 */
.ip-fi-top {
    margin: 0 0 16px;
    padding: 10px 12px;
    background: var(--bg-toolbar);
    border-radius: 8px;
}
.ip-fi-top-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}
.ip-fi-top-title em { font-style: normal; font-weight: 400; color: var(--text-muted); }
.ip-fi-person {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
}
.ip-fi-person:hover:not(:disabled) { background: var(--bg-tint-blue, #eef3ff); }
.ip-fi-person:disabled { cursor: default; opacity: 0.6; }
.ip-fi-rank {
    flex: none;
    width: 18px;
    height: 18px;
    line-height: 18px;
    border-radius: 50%;
    background: var(--bg-tint-blue, #eef3ff);
    color: #3370ff;
    font-size: 11px;
    text-align: center;
}
.ip-fi-person-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
}
.ip-fi-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip-fi-uin { flex: none; font-size: 11px; color: var(--text-muted); }
.ip-fi-count { flex: none; font-size: 12px; color: var(--text-muted); }
.ip-fi-top-hint { margin-top: 6px; font-size: 11px; color: var(--text-muted); }
.ip-fi-row {
    display: flex;
    gap: 10px;
}
.ip-fi-input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-primary);
    border: 1px solid var(--border-separator);
    border-radius: 6px;
    outline: none;
    transition: border-color 0.15s;
}
.ip-fi-input:focus {
    border-color: #3370ff;
}
.ip-fi-btn {
    flex: none;
    padding: 8px 18px;
    font-size: 14px;
    color: #fff;
    background: #3370ff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
}
.ip-fi-btn:hover {
    background: #2860e0;
}
.ip-fi-btn-sm {
    padding: 4px 12px;
    font-size: 12px;
}
.ip-fi-error {
    margin-top: 10px;
    font-size: 12px;
    color: #d03050;
}
.ip-loading {
    display: flex;
    justify-content: center;
    padding: 80px 0;
}
/* 本人备份：已确认好友后的顶部信息条 */
.ip-friend-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    padding: 8px 14px;
    background: var(--bg-tint-blue);
    border: 1px solid #d6e4ff;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
}
.ip-friend-bar b {
    color: #3370ff;
}
.ip-body {
    width: 100%;
}
.ip-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin: 16px 0 12px;
    padding: 10px 12px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-card);
    border-radius: 6px;
}
.ip-field {
    font-size: 13px;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.ip-count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
    animation: countPulse 0.6s ease;
}
.ip-clear {
    flex: none;
    padding: 3px 10px;
    font-size: 12px;
    color: #3370ff;
    background: var(--bg-tint-blue);
    border: 1px solid #b5d4f4;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
}
.ip-clear:hover {
    background: #d6e4ff;
}
@keyframes countPulse {
    0% { color: var(--text-muted); transform: scale(1); }
    40% { color: #3370ff; transform: scale(1.12); font-weight: 600; }
    100% { color: var(--text-muted); transform: scale(1); }
}
.ip-timeline {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ip-event {
    padding: 10px 12px;
    border: 1px solid var(--border-card);
    border-left-width: 3px;
    border-radius: 6px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: box-shadow 0.15s, transform 0.15s;
}
.ip-event:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transform: translateX(2px);
}
.ip-event.me {
    border-left-color: #3370ff;
}
.ip-event.ta {
    border-left-color: #2080f0;
}
.ip-event-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}
.ip-dir {
    font-size: 12px;
    font-weight: 600;
}
.ip-dir.me {
    color: #3370ff;
}
.ip-dir.ta {
    color: #2080f0;
}
.ip-time {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.ip-event-body {
    font-size: 13px;
    line-height: 1.6;
}
.ip-event-body :deep(.qm-card),
.ip-event-body :deep(.media-card),
.ip-event-body :deep(.article-item) {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 4px;
}
.ip-compact-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-toolbar);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}
.ip-compact-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ip-pager {
    display: flex;
    justify-content: center;
    margin-top: 16px;
}
</style>
