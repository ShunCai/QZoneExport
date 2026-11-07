<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import {
    NConfigProvider,
    NLayout,
    NLayoutSider,
    NMenu,
    NSpin,
    zhCN,
    dateZhCN,
    darkTheme,
    type MenuOption,
} from 'naive-ui';
import { blueThemeOverrides } from '../../core/shared/naive-theme';
import { useTheme } from './composables/useTheme';
import ThemeToggle from './components/ThemeToggle.vue';
import { loadData, assetUrl } from './data/sources';
import { initBackupConfig } from './data/backupConfig';
import { initFriendRemarks } from './data/friendNames';
import { avatarUrl, avatarFallbackUrl } from './data/content';
import { usePrivacy } from './composables/usePrivacy';
import PrivacyToggle from './components/PrivacyToggle.vue';
import HomeProfileDialog from './components/home/HomeProfileDialog.vue';
import { useProfileDialog } from './composables/useProfileDialog';
import { formatNickname } from './data/richText';
import { onMediaError } from './data/mediaFallback';
import { loadModuleCounts } from './data/counts';
import { routeName, navigate } from './router';
import HomePage from './pages/HomePage.vue';
import MemoriesPage from './pages/MemoriesPage.vue';
import InteractionPage from './pages/InteractionPage.vue';
import MessagesPage from './pages/MessagesPage.vue';
import ArticlesPage from './pages/ArticlesPage.vue';
import AlbumsPage from './pages/AlbumsPage.vue';
import VideosPage from './pages/VideosPage.vue';
import BoardsPage from './pages/BoardsPage.vue';
import FriendsPage from './pages/FriendsPage.vue';
import FavoritesPage from './pages/FavoritesPage.vue';
import SharesPage from './pages/SharesPage.vue';
import VisitorsPage from './pages/VisitorsPage.vue';
import MapPage from './pages/MapPage.vue';
import TimelinePage from './pages/TimelinePage.vue';
import UserAvatar from './components/UserAvatar.vue';
import { heShe } from './data/pronoun';

/** 用户信息（Common/json/user.js），同时给出各模块的条目数 */
interface UserInfo {
    uin?: number | string;
    nickname?: string;
    spacename?: string;
    avatar?: string;
    desc?: string;
    [key: string]: any;
}

const loading = ref(true);
const user = ref<UserInfo | null>(null);
/** 各模块实时条数（打开时现算，不再取自备份时的 user.js）；未算出前导航只显标签 */
const counts = ref<Record<string, number> | null>(null);

const { isDark } = useTheme();
/** 启动时加载一次备份配置（含 hasUserLink），供渲染层按配置决定是否生成用户链接 */
initBackupConfig();
// 好友备注表：全站取名统一「备注 > 昵称」，启动时预热一次，渲染层可同步查询
void initFriendRemarks();

/**
 * 侧边栏条目：key 与路由名一致；count 为实时计数的字段名；group 为分组标题。
 * 分组语义：空间（内容）/ 关系（好友访客）/ 足迹（互动地图）——替换原先的平铺列表。
 */
const MENUS = [
    { key: 'home', label: '概览', group: '空间' },
    { key: 'timeline', label: '动态', group: '空间' },
    { key: 'messages', label: '说说', count: 'messages', group: '空间' },
    { key: 'albums', label: '相册', count: 'photos', group: '空间' },
    { key: 'videos', label: '视频', count: 'videos', group: '空间' },
    { key: 'blogs', label: '日志', count: 'blogs', group: '空间' },
    { key: 'boards', label: '留言', count: 'boards', group: '空间' },
    { key: 'favorites', label: '收藏', count: 'favorites', group: '空间' },
    { key: 'shares', label: '分享', count: 'shares', group: '空间' },
    { key: 'diaries', label: '日记', count: 'diaries', group: '空间' },
    { key: 'friends', label: '好友', count: 'friends', group: '关系' },
    { key: 'visitors', label: '访客', count: 'visitors', group: '关系' },
    { key: 'interaction', label: '互动', group: '足迹' },
    { key: 'map', label: '地图', group: '足迹' },
] as const;

/** 查看他人空间备份时，这些模块不属于对方空间内容，左侧菜单与完整性统计统一排除 */
const OTHER_SPACE_EXCLUDED = ['diaries', 'friends', 'favorites'];

/** 是否正在查看「他人空间的备份」（Owner ≠ Target）。此时日记/好友/收藏不属对方空间，须隐藏 */
const isOtherSpace = computed(() => {
    const u = user.value;
    if (!u) return false;
    const owner = u.ownerUin;
    const target = u.uin;
    return owner !== undefined && owner !== null && owner !== '' && String(owner) !== String(target);
});

const menuOptions = computed<MenuOption[]>(() => {
    const base = MENUS.filter((m) => {
        // 「互动」统一显示：本人备份需先输入好友 QQ 再统计；他人空间备份自动统计
        if (OTHER_SPACE_EXCLUDED.includes(m.key)) return !isOtherSpace.value;
        return true;
    });

    /** 行渲染：圆点 + 名称 + 右对齐数量（数量为 0 不显示，与旧行为一致） */
    const renderRow = (item: (typeof MENUS)[number]): ReturnType<typeof h> => {
        // 「互动」按当前查看对象动态命名：本人空间（Owner===Target）→ 与TA相关；
        // 他人空间备份 → 与我相关。「个人动态」同理（我的动态 / 他(她)的动态）。
        let label: string = item.label;
        const total = 'count' in item ? Number(counts.value?.[item.count] ?? 0) : 0;
        const count = 'count' in item && total > 0 ? total.toLocaleString() : '';
        // 相册显示的是照片总数，悬浮提示说明已排除说说和日志相册
        const tip = item.key === 'albums' ? '相册照片总数（不包含「说说和日志相册」）' : undefined;
        const row = h('span', { class: 'nav-row', title: tip }, [
            h('span', { class: 'nav-label' }, label),
            count ? h('span', { class: 'nav-count' }, count) : null,
        ]);
        return tip ? h('span', { title: tip, class: 'nav-row-wrap' }, row) : row;
    };

    /** 分组：保持首次出现的顺序；被排除模块所在组若为空则整组隐藏 */
    const groups: { name: string; items: MenuOption[] }[] = [];
    for (const item of base) {
        const total = 'count' in item ? Number(counts.value?.[item.count] ?? 0) : 0;
        void total;
        let group = groups.find((g) => g.name === item.group);
        if (!group) {
            group = { name: item.group, items: [] };
            groups.push(group);
        }
        group.items.push({
            key: item.key,
            label: () => renderRow(item),
        });
    }
    // naive 的分组必须是 type:'group' + children——把子项写成平级兄弟，
    // 组不会真正形成（组标题 DOM 缺失、且「组名」本身变成可点击的普通菜单项）
    return groups
        .filter((g) => g.items.length > 0)
        .map((g) => ({
            type: 'group' as const,
            key: `group-${g.name}`,
            label: g.name,
            children: g.items,
        }));
});

/** 菜单项渲染：交给各行自己的 render（nav-row）；带 tip 的项包一层原生 title */
function renderLabel(option: MenuOption): ReturnType<typeof h> | string {
    const label = typeof option.label === 'function' ? option.label() : option.label ?? '';
    const tip = (option as { tip?: string }).tip;
    return tip ? h('span', { title: tip }, label) : label;
}

/** 全局隐私开关：控制侧栏昵称/QQ 号、空间资料各字段、互动页 Top5 的 QQ 号（开关按钮见 PrivacyToggle.vue） */
const { hidden: hideSensitive } = usePrivacy();

/**
 * 侧栏展示名（HTML）：昵称里可能内嵌 `[em]e258151[/em]` 表情 token，
 * 与正文/访客列表同一套转换，避免这里直出一串 token。
 */
const ownerNameHtml = computed(() => {
    if (hideSensitive.value) return '●●●';
    const label = user.value?.nickname || user.value?.spacename || 'QQ空间备份';
    return formatNickname(String(label));
});
const { open: profileOpen, openProfile, closeProfile } = useProfileDialog();

const avatarSrc = computed(() => {
    if (!user.value?.uin) return assetUrl(user.value?.avatar);
    if (_avatarError.value) return avatarFallbackUrl(user.value.uin);
    return avatarUrl(user.value.uin);
});
const _avatarError = ref(false);

/*
 * 移动端 / 平板适配
 * 窄屏下侧边栏改为“收起到 0 宽”+箭头拉手，开展时悬浮在内容之上（而不是把正文挤成一条）；
 * 选完菜单自动收起，否则在手机上会一直挡着内容。
 */
const NARROW_QUERY = '(max-width: 768px)';
const narrow = ref(false);
const collapsed = ref(false);
let media: MediaQueryList | undefined;

function applyNarrow(matches: boolean): void {
    narrow.value = matches;
    collapsed.value = matches;
}

function onMediaChange(event: MediaQueryListEvent): void {
    applyNarrow(event.matches);
}

/** 窄屏下点完菜单就收起侧边栏 */
function onMenuSelect(key: string): void {
    navigate(key);
    if (narrow.value) collapsed.value = true;
}

onMounted(async () => {
    media = window.matchMedia(NARROW_QUERY);
    applyNarrow(media.matches);
    media.addEventListener('change', onMediaChange);
    user.value = await loadData<UserInfo>('user');
    loading.value = false;
    // 页面标题优先用空间名称（spacename），其次昵称，都没有则兜底为默认文案
    document.title = (user.value?.spacename?.trim()
        || user.value?.nickname?.trim()
        || 'QQ空间备份 - 查看器');
    // 实时统计各模块条数（后台进行，不阻塞首屏）；算完导航与主页概览自动填上数字
    loadModuleCounts()
        .then((result) => { counts.value = result; })
        .catch((error) => console.warn('统计模块条数失败', error));
});

onUnmounted(() => {
    media?.removeEventListener('change', onMediaChange);
});

/** 全局图片/视频加载失败兜底：capture 阶段拦截所有 error 事件 */
function handleMediaErrorCapture(event: Event): void {
    onMediaError(event);
}
onMounted(() => {
    document.addEventListener('error', handleMediaErrorCapture, true);
});
onUnmounted(() => {
    document.removeEventListener('error', handleMediaErrorCapture, true);
});
</script>

<template>
    <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme="isDark ? darkTheme : null" :theme-overrides="blueThemeOverrides">
        <!-- 右下角主题切换按钮（避开同侧菜单 FAB，移动端不挡标题） -->
        <theme-toggle class="theme-float" />
        <home-profile-dialog :open="profileOpen" :user="user" @close="closeProfile" />
        <n-layout has-sider class="shell">
            <n-layout-sider
                bordered
                :width="200"
                :native-scrollbar="false"
                collapse-mode="width"
                :collapsed-width="0"
                :collapsed="collapsed"
                :show-trigger="false"
                :position="narrow ? 'absolute' : 'static'"
                content-style="padding: 14px 0; display: flex; flex-direction: column; height: 100%;"
                @update:collapsed="(value: boolean) => (collapsed = value)"
            >
                <div class="profile">
                    <!-- 全局隐私开关：与空间资料、互动页共用同一个组件，图标风格一致 -->
                    <privacy-toggle class="profile-privacy" @click.stop />
                    <div
                        class="profile-open"
                        role="button"
                        tabindex="0"
                        title="查看空间资料"
                        @click="openProfile"
                        @keydown.enter="openProfile"
                        @keydown.space.prevent="openProfile"
                    >
                        <img
                            v-if="avatarSrc"
                            class="avatar"
                            :class="{ 'privacy-blur': hideSensitive }"
                            :src="avatarSrc"
                            alt="头像"
                            @error="() => { if (!_avatarError) _avatarError = true; }"
                        />
                        <user-avatar v-else :uin="user?.uin" :size="64" :link="false" :class="{ 'privacy-blur': hideSensitive }" />
                        <div class="name" v-html="ownerNameHtml"></div>
                        <div class="uin">{{ hideSensitive ? '●●●●●●' : user?.uin }}</div>
                        <span v-if="!loading && user" class="badge-row">
                            <span class="space-badge" :class="isOtherSpace ? 'space-badge-other' : 'space-badge-self'">
                                {{ isOtherSpace ? heShe(user?.sex) + '的空间' : '我的空间' }}
                            </span>
                            <!-- 资料卡藏在整张头像卡的点击里，太隐蔽；在徽标旁给一个明确的信息入口 -->
                            <button
                                type="button"
                                class="profile-info"
                                title="查看空间资料"
                                aria-label="查看空间资料"
                                @click.stop="openProfile"
                            >
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 11v5" />
                                    <path d="M12 8h.01" />
                                </svg>
                            </button>
                        </span>
                    </div>
                </div>
                <div class="sider-scroll">
                    <n-menu
                        :value="routeName"
                        :options="menuOptions"
                        :indent="8"
                        :render-label="renderLabel"
                        @update:value="onMenuSelect"
                    />
                </div>
                <!-- 品牌信息 -->
                <div class="brand">
                    <a href="https://github.com/ShunCai/QZoneExport" target="_blank" rel="noreferrer">
                        QQ空间导出助手
                    </a>
                    <div class="brand-note">备份查看器</div>
                </div>
            </n-layout-sider>

            <!-- 窄屏侧边栏的开关按钮（始终可见，开/关切换） -->
            <button
                v-if="narrow"
                class="sidebar-fab"
                :title="collapsed ? '展开菜单' : '关闭菜单'"
                @click="collapsed = !collapsed"
            >{{ collapsed ? '☰' : '✕' }}</button>

            <n-layout class="main" content-style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                <div v-if="loading" class="loading">
                    <n-spin size="large" />
                </div>
                <template v-else>
                    <home-page v-if="routeName === 'home'" :user="user" :counts="counts" />
                    <memories-page v-else-if="routeName === 'memories'" />
                    <interaction-page v-else-if="routeName === 'interaction'" :user="user" />
                    <timeline-page v-else-if="routeName === 'timeline'" />
                    <messages-page v-else-if="routeName === 'messages'" />
                    <articles-page
                        v-else-if="routeName === 'blogs'"
                        source="blogs"
                        title="日志"
                        config-key="Blogs"
                    />
                    <articles-page
                        v-else-if="routeName === 'diaries'"
                        source="diaries"
                        title="日记"
                        config-key="Diaries"
                    />
                    <albums-page v-else-if="routeName === 'albums'" />
                    <videos-page v-else-if="routeName === 'videos'" />
                    <boards-page v-else-if="routeName === 'boards'" />
                    <friends-page v-else-if="routeName === 'friends'" />
                    <favorites-page v-else-if="routeName === 'favorites'" />
                    <shares-page v-else-if="routeName === 'shares'" />
                    <visitors-page v-else-if="routeName === 'visitors'" />
                    <map-page v-else-if="routeName === 'map'" />
                    <home-page v-else :user="user" :counts="counts" />
                </template>
            </n-layout>
        </n-layout>
    </n-config-provider>
</template>

<style scoped>
/* PC 端主题切换浮动按钮：固定在左上角 */
.theme-float {
    position: fixed;
    top: 14px;
    left: 14px;
    right: auto;
    z-index: 1000;
}
/* 100dvh 让手机浏览器的地址栏收放不会把底部内容顶出可视区 */
.shell {
    height: 100vh;
    height: 100dvh;
    min-width: 0;
    max-width: 100vw;
    overflow-x: hidden;
}
.main {
    min-width: 0;
    max-width: 100%;
    overflow-x: hidden;
    /*
     * Naive UI 的 n-layout 会写内联 --n-color:#fff，把内容区刷成纯白；
     * 而卡片也是白色（--bg-primary），两者贴在一起就没有层次。
     * 设计稿 home-v2.html 里内容画布是 --bg-page 浅灰、卡片才是白色，
     * 这里把画布改回浅灰，卡片自然浮起来（暗色模式同样生效）。
     */
    background: var(--bg-page);
}
.main :deep(.n-layout-scroll-container) {
    background: transparent;
}
.profile {
    position: relative; /* 承载右上角的隐私开关 */
    padding: 4px 18px 14px;
    text-align: center;
}
.profile-open {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.profile-open:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 10px;
}
/* 只负责定位，按钮外观统一由 PrivacyToggle 提供 */
.profile-privacy {
    position: absolute;
    top: 2px;
    right: 8px;
    width: 22px;
    height: 22px;
}
.profile-privacy :deep(svg) {
    width: 13px;
    height: 13px;
}
.avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
}
.name {
    margin-top: 6px;
    font-weight: 600;
    color: var(--accent);
}
.uin {
    color: var(--text-muted);
    font-size: 12px;
}
/* 空间类型标识：别人的空间 / 自己的空间 */
.badge-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 6px;
}
.profile-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
}
.profile-info:hover,
.profile-info:focus-visible {
    color: var(--accent);
    background: var(--bg-chat);
    outline: none;
}
.space-badge {
    display: inline-block;
    padding: 1px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 10px;
    line-height: 1.6;
}
.space-badge-other {
    color: var(--accent);
    background: var(--bg-chat);
    border: 1px solid var(--border-chat);
}
.space-badge-self {
    color: var(--accent);
    background: var(--bg-chat);
    border: 1px solid var(--border-chat);
}
.loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}
/* 菜单滚动区：撑满头像卡与品牌区之间的剩余高度，内容多时不被裁掉 */
.sider-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    /* naive sider 自带滚动条，这里只收窄视觉 */
    scrollbar-width: thin;
}

/* 品牌区靠底（侧边条为纵向 flex，margin-top:auto 把它推到底部） */
.brand {
    margin-top: auto;
    padding: 12px 18px 4px;
    text-align: center;
    border-top: 1px solid var(--border-light);
}
.brand a {
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
}
.brand-note {
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-subtle);
}

/* 窄屏：侧边栏悬浮在正文之上，收起后只留自定义浮动按钮 */
@media (max-width: 768px) {
    .profile {
        padding: 4px 12px 10px;
    }
    /* 移动端：主题切换按钮回到右下角（重置 PC 的 left 避免继承后拉伸/偏移；与同侧 sidebar-fab 错开，避免重叠） */
    .theme-float {
        top: auto;
        bottom: 20px;
        right: 72px;
        left: auto;
    }
}
/* 自定义侧边栏展开按钮：大、醒目、固定在右下角（不挡标题） */
.sidebar-fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 20px;
    line-height: 44px;
    text-align: center;
    box-shadow: 0 3px 12px var(--shadow-lg);
    cursor: pointer;
    transition: background 0.2s;
}
.sidebar-fab:active {
    background: var(--accent-pressed);
}


</style>
