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
import { avatarUrl, avatarFallbackUrl } from './data/content';
import { usePrivacy } from './composables/usePrivacy';
import PrivacyToggle from './components/PrivacyToggle.vue';
import { onMediaError } from './data/mediaFallback';
import { loadModuleCounts } from './data/counts';
import { routeName, navigate } from './router';
import HomePage from './pages/HomePage.vue';
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

/** 侧边栏条目：key 与路由名一致；count 为实时计数的字段名 */
const MENUS = [
    { key: 'home', label: '空间概览' },
    { key: 'timeline', label: '个人动态' },
    // 「互动」为动态命名（本人空间→与TA相关 / 他人空间→与我相关），实际文案在 menuOptions 中按 isOtherSpace 生成
    { key: 'interaction', label: '互动' },
    { key: 'map', label: '足迹地图' },
    { key: 'messages', label: '说说', count: 'messages' },
    { key: 'blogs', label: '日志', count: 'blogs' },
    { key: 'diaries', label: '日记', count: 'diaries' },
    { key: 'albums', label: '相册', count: 'photos' },
    { key: 'videos', label: '视频', count: 'videos' },
    { key: 'boards', label: '留言', count: 'boards' },
    { key: 'friends', label: '好友', count: 'friends' },
    { key: 'favorites', label: '收藏', count: 'favorites' },
    { key: 'shares', label: '分享', count: 'shares' },
    { key: 'visitors', label: '访客', count: 'visitors' },
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

const menuOptions = computed(() => {
    const base = MENUS.filter((m) => {
        // 「互动」统一显示：本人备份需先输入好友 QQ 再统计；他人空间备份自动统计
        if (OTHER_SPACE_EXCLUDED.includes(m.key)) return !isOtherSpace.value;
        return true;
    });
    return base.map((item) => {
        // 实时计数未就绪时先不显数字（后台算完再填），避免启动阶段拖慢
        const total = 'count' in item ? Number(counts.value?.[item.count] ?? 0) : 0;
        const suffix = 'count' in item && total > 0 ? `（${total}）` : '';
        // 「互动」按当前查看对象动态命名：本人空间（Owner===Target）→ 与TA相关；
        // 他人空间备份 → 与我相关。与 isOtherSpace 联动，切换查看对象时实时更新。
        let label: string = item.label;
        if (item.key === 'interaction') {
            label = isOtherSpace.value ? '与我相关' : '与TA相关';
        }
        // 「个人动态」按查看对象动态命名：本人空间→我的动态；他人空间→他/她的动态（按目标性别）
        if (item.key === 'timeline') {
            label = isOtherSpace.value ? heShe(user.value?.sex) + '的动态' : '我的动态';
        }
        // 相册菜单显示的是「照片总数」，悬浮提示说明已排除说说和日志相册
        const tip = item.key === 'albums'
            ? '相册照片总数（不包含「说说和日志相册」）'
            : undefined;
        return { key: item.key, label: label + suffix, tip };
    });
});

/** 菜单项渲染：带 tip 的项用 span 包一层原生 title，其余原样渲染 */
function renderLabel(option: MenuOption): ReturnType<typeof h> | string {
    const tip = (option as { tip?: string }).tip;
    const label = typeof option.label === 'function' ? option.label() : option.label ?? '';
    return tip ? h('span', { title: tip }, label) : label;
}

/** 全局隐私开关：控制侧栏昵称/QQ 号、空间资料各字段、互动页 Top5 的 QQ 号（开关按钮见 PrivacyToggle.vue） */
const { hidden: hideSensitive } = usePrivacy();

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
                    <privacy-toggle class="profile-privacy" />
                    <img
                        v-if="avatarSrc"
                        class="avatar"
                        :class="{ 'privacy-blur': hideSensitive }"
                        :src="avatarSrc"
                        alt="头像"
                        @error="() => { if (!_avatarError) _avatarError = true; }"
                    />
                    <user-avatar v-else :uin="user?.uin" :size="64" :link="false" :class="{ 'privacy-blur': hideSensitive }" />
                    <div class="name">{{ hideSensitive ? '●●●' : (user?.nickname || user?.spacename || 'QQ空间备份') }}</div>
                    <div class="uin">{{ hideSensitive ? '●●●●●●' : user?.uin }}</div>
                    <span v-if="!loading && user" class="space-badge" :class="isOtherSpace ? 'space-badge-other' : 'space-badge-self'">
                        {{ isOtherSpace ? heShe(user?.sex) + '的空间' : '本人备份' }}
                    </span>
                </div>
                <n-menu
                    :value="routeName"
                    :options="menuOptions"
                    :indent="18"
                    :render-label="renderLabel"
                    @update:value="onMenuSelect"
                />
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
}
.profile {
    position: relative; /* 承载右上角的隐私开关 */
    padding: 4px 18px 14px;
    text-align: center;
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
/* 空间类型标识：他人空间 / 本人备份 */
.space-badge {
    display: inline-block;
    margin-top: 6px;
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
