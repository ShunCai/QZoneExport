<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NCollapse, NCollapseItem } from 'naive-ui';
import ThatYearTodayPanel from '../components/ThatYearTodayPanel.vue';
import NightOwlPanel from '../components/NightOwlPanel.vue';
import FirstRecordsPanel from '../components/FirstRecordsPanel.vue';
import TopLocationsPanel from '../components/TopLocationsPanel.vue';
import TopLikesPanel from '../components/TopLikesPanel.vue';
import TopCommentsPanel from '../components/TopCommentsPanel.vue';
import TopViewsPanel from '../components/TopViewsPanel.vue';
import OwnerTargetInteraction from '../components/OwnerTargetInteraction.vue';
import SpaceProfilePanel from '../components/SpaceProfilePanel.vue';
import { navigate, openInNewTab } from '../router';
import {
    loadYearStats,
    loadTimeRange,
    loadInteractionStats,
    loadMediaStats,
    loadMonthlyStats,
    loadModuleCounts,
    loadModuleStatuses,
    localPathRatio,
    type TimeRange,
    type InteractionStats,
    type MediaStats,
    type MonthlyStat,
    type ModuleYearStat,
    type ModuleStatusEntry,
} from '../data/counts';
import { formatTime } from '../data/format';
import { loadOwnerTargetInteraction, type OwnerTargetInteraction as OwnerTargetInteractionData } from '../data/owner-target';

/** 条形/环形图配色池（8 色循环） */
const ringColors = ['#2080f0', '#3370ff', '#f0a020', '#e64a5e', '#7c6bc4', '#409eff', '#d4666a', '#4ca1f5'];

/** SVG stroke-dasharray 计算（保留：兼容潜在引用） */
function segmentLength(percent: number): number {
    const total = 2 * Math.PI * 45;
    return (percent / 100) * total;
}
function segmentOffset(items: { percent: number }[], idx: number): number {
    const total = 2 * Math.PI * 45;
    let offset = 0;
    for (let i = 0; i < idx; i++) {
        offset += (items[i].percent / 100) * total;
    }
    return -offset;
}

/**
 * 横向条形图填充样式
 * - 计入总条目的模块：长度按计入模块中的最大值(maxIncludedTotal)计算比例，避免好友/访客压过内容
 * - 不计入模块（好友/访客/相册容器）：固定 15% 宽灰条，仅做标识，不参与真实比例对比
 */
function barRowFillStyle(item: { total: number; excludeFromTotal?: boolean }, idx: number): Record<string, string> {
    const colorIdx = Math.min(idx, ringColors.length - 1);
    if (item.excludeFromTotal) {
        const excludedBase = maxIncludedTotal.value > 0
            ? Math.min(0.15, item.total / maxIncludedTotal.value)
            : 0.15;
        return {
            width: (excludedBase * 100).toFixed(2) + '%',
            background: 'var(--border-dashed)',
        };
    }
    const pct = maxIncludedTotal.value > 0 ? (item.total / maxIncludedTotal.value) : 0;
    return {
        width: (pct * 100).toFixed(2) + '%',
        background: `linear-gradient(90deg, ${ringColors[colorIdx]}dd 0%, ${ringColors[colorIdx]} 100%)`,
    };
}

/** 热力图颜色 */
function heatColor(count: number, max: number): string {
    if (count === 0) return 'var(--bg-toolbar)';
    const ratio = count / max;
    if (ratio < 0.2) return '#dbeafe';
    if (ratio < 0.5) return '#3b82f6';
    if (ratio < 0.8) return '#1d4ed8';
    return '#1e3a8a';
}

const props = defineProps<{
    user: Record<string, any> | null;
    counts: Record<string, number> | null;
}>();

/** 内容总量卡片 */
const CARDS = [
    { key: 'messages', label: '说说', field: 'messages', link: '#/messages', excludeFromTotal: false },
    { key: 'blogs', label: '日志', field: 'blogs', link: '#/blogs', excludeFromTotal: false },
    { key: 'diaries', label: '日记', field: 'diaries', link: '#/diaries', excludeFromTotal: false },
    { key: 'videos', label: '视频', field: 'videos', link: '#/videos', excludeFromTotal: false },
    { key: 'boards', label: '留言', field: 'boards', link: '#/boards', excludeFromTotal: false },
    { key: 'shares', label: '分享', field: 'shares', link: '#/shares', excludeFromTotal: false },
    { key: 'favorites', label: '收藏', field: 'favorites', link: '#/favorites', excludeFromTotal: false },
    { key: 'albums', label: '相册', field: 'albums', link: '#/albums', excludeFromTotal: true },
    { key: 'photos', label: '相片', field: 'photos', link: '#/albums', excludeFromTotal: false },
    { key: 'friends', label: '好友', field: 'friends', link: '#/friends', excludeFromTotal: true },
    { key: 'visitors', label: '访客', field: 'visitors', link: '#/visitors', excludeFromTotal: true },
];

/** 查看他人空间备份时，这些模块不属于对方空间内容，主页看板（内容构成/完整性）统一排除 */
const OTHER_SPACE_EXCLUDED = ['diaries', 'friends', 'favorites'];

/** 是否查看他人空间备份（Owner ≠ Target）。见 App.vue 同义判定，保持口径一致 */
const isOtherSpace = computed(() => {
    const u = props.user;
    if (!u) return false;
    const owner = u.ownerUin;
    const target = u.uin;
    return owner !== undefined && owner !== null && owner !== '' && String(owner) !== String(target);
});

const cards = computed(() => {
    const list = isOtherSpace.value
        ? CARDS.filter((c) => !OTHER_SPACE_EXCLUDED.includes(c.key))
        : CARDS;
    return list.map((item) => ({
        ...item,
        /* 双保险：优先父组件传的 counts，若为空（异步延迟/异常）则取 HomePage 自己 onMounted 算的 localCounts */
        total: Number((props.counts ?? localCounts.value)?.[item.field] ?? 0),
    }));
});


/** 本地独立计算的模块条数（与父组件的 counts prop 并行加载，避免父组件异步延迟导致模块统计/内容构成看起来"不见了"） */
const localCounts = ref<Record<string, number> | null>(null);

/** 是否所有 11 个模块的 total 都是 0（用于空态判断） */
const allCardsEmpty = computed(() => cards.value.every(c => c.total === 0));

/** 统计是否就绪：父组件的 counts prop 或本地 localCounts 至少有一方加载完成 */
const countsReady = computed(() => props.counts !== null || localCounts.value !== null);

/** ===== 新增统计 ===== */

// 总条目数（排除访客、好友、相册容器——仅统计用户创建的实际内容条目）
const totalItems = computed(() =>
    cards.value
        .filter(c => !c.excludeFromTotal)
        .reduce((sum, c) => sum + c.total, 0),
);

// 时间跨度
const timeRange = ref<TimeRange>({ earliest: '', latest: '' });

// 互动热度
const interaction = ref<InteractionStats>({ totalLikes: 0, totalComments: 0, totalViews: 0 });

// 媒体统计
const media = ref<MediaStats>({ photos: 0, videos: 0, localPhotos: 0, localVideos: 0, externalPhotos: 0, externalVideos: 0, unknownPhotos: 0, unknownVideos: 0 });

// 模块备份状态（区分「数据文件缺失」与「已备份但无内容」）；空数组表示尚未加载/旧备份
const moduleStatuses = ref<ModuleStatusEntry[]>([]);

// 月度热力图
const monthly = ref<MonthlyStat>({ months: new Map(), firstMonth: '', lastMonth: '' });


// 我与 TA 的互动（仅查看他人空间备份时非空）
const ownerTarget = ref<OwnerTargetInteractionData | null>(null);

/** 互动概览卡片：核心指标点击 → 跳转互动明细页并携带筛选参数（category + dir） */
function onStatCardClick(p: { category: string; dir: 'me' | 'ta' }): void {
    const q: Record<string, string> = {};
    if (p.category) q.category = p.category;
    if (p.dir) q.dir = p.dir;
    navigate('interaction', q);
}
/** 互动概览卡片：访问统计点击 → 新标签页打开对应模块页并携带浏览者 UIN（不覆盖当前页） */
function onVisitCardClick(p: { module: string; visitorUin: string }): void {
    openInNewTab(p.module, { visitor: p.visitorUin });
}

// 加载状态
const loadingExtra = ref(true);

/** 模块占比（内容构成横向条形柱状图使用）
 * 排序规则：计入总条目在前、不计入在后；各自组内按数量降序，不计入模块统一排后面
 */
const moduleShare = computed(() => {
    const total = totalItems.value;
    return cards.value
        .filter(c => c.total > 0)
        .map(c => ({
            ...c,
            percent: c.excludeFromTotal
                ? 0
                : total > 0
                    ? Math.round((c.total / total) * 1000) / 10
                    : 0,
        }))
        .sort((a, b) => {
            // 计入类型 = 0，不计入类型 = 1 → 0 在前，1 在后
            const groupA = a.excludeFromTotal ? 1 : 0;
            const groupB = b.excludeFromTotal ? 1 : 0;
            if (groupA !== groupB) return groupA - groupB;
            // 同组内按数量降序
            return b.total - a.total;
        });
});

/**
 * 计入总条目的模块中的最大值（用于横向条形图的 100% 基准分母，避免访客/好友压过真实内容）
 */
const maxIncludedTotal = computed(() => {
    const included = cards.value.filter(c => !c.excludeFromTotal);
    if (included.length === 0) return 1;
    return Math.max(1, ...included.map(c => c.total));
});

/**
 * 备份完整度：不再只看「total===0」，而是按数据文件是否存在区分
 * 「未备份」与「已备份但确实没有内容」。旧备份/未加载完成时沿用按 0 计数兜底。
 */
const completeness = computed(() => {
    const entries = moduleStatuses.value;
    if (entries.length === 0) {
        const zeroCards = cards.value.filter(c => c.total === 0);
        return zeroCards.length === 0
            ? { status: 'complete' as const, tone: 'ok' as const, label: '✓ 备份完整' }
            : { status: 'partial' as const, tone: 'warn' as const, label: '⚠ 部分模块未备份' };
    }
    const missing = entries.filter(e => e.status === 'missing').length;
    const empty = entries.filter(e => e.status === 'empty').length;
    if (missing > 0) return { status: 'partial' as const, tone: 'warn' as const, label: `⚠ ${missing} 个模块未备份` };
    if (empty > 0) return { status: 'complete' as const, tone: 'info' as const, label: `${empty} 个模块无内容` };
    return { status: 'complete' as const, tone: 'ok' as const, label: '✓ 备份完整' };
});

/** 模块卡片状态（按 key 索引，供卡片 tooltip 使用） */
const statusByKey = computed(() => new Map(moduleStatuses.value.map(e => [e.key, e.status])));

/** 已登记本地路径的媒体占比：口径收敛在 counts.localPathRatio，便于单测锁住；不代表文件真实存在 */
const localMediaRatio = computed(() => localPathRatio(media.value));

/** 记录里没有可用媒体路径、无法判定本地/外链的条目数 */
const unknownMedia = computed(() => media.value.unknownPhotos + media.value.unknownVideos);

/** 年活跃度 */
const yearStats = ref<ModuleYearStat[]>([]);

const years = computed(() => {
    const all = new Set<string>();
    for (const item of yearStats.value) {
        for (const year of item.years.keys()) {
            all.add(year);
        }
    }
    return [...all].sort().reverse();
});

const yearTotals = computed(() => years.value.map((year) => ({
    year,
    total: yearStats.value.reduce((sum, item) => sum + (item.years.get(year) || 0), 0),
    parts: yearStats.value
        .filter((item) => (item.years.get(year) || 0) > 0)
        .map((item) => ({ label: item.label, count: item.years.get(year) || 0 })),
})));

const maxYearTotal = computed(() => Math.max(1, ...yearTotals.value.map((item) => item.total)));
const yearChart = computed(() => [...yearTotals.value].reverse());

/**
 * 柱子高度百分比（按真实比例计算）
 * - 最小 1% 高：保证 2 条这种极小数也能看到柱子
 * - 不再使用 MIN_VISIBLE 6% 这种过高原先的 boost，否则矮柱子和高柱子比例失真
 */
function barHeightPct(total: number): number {
    if (total <= 0) return 0;
    const ratio = total / maxYearTotal.value;
    const MIN_VISIBLE = 0.01; // 1% 是最小可见高度（~3px 在 300px 容器下）
    return Math.round(Math.max(MIN_VISIBLE, ratio) * 1000) / 10;
}

/** 判断是否为峰值年份（活跃量 Top 3 的年份，柱子顶部加 ★ 高亮） */
function isPeakYear(item: { year: string; total: number }, _idx: number): boolean {
    const sorted = [...yearChart.value].sort((a, b) => b.total - a.total);
    const top3 = sorted.slice(0, 3).map(s => s.year);
    return top3.includes(item.year);
}

/** 月度热力图：月份放为行（1月~12月共12行），年份放为列（展示所有年份，不再限制） */
const monthlyGrid = computed(() => {
    if (!monthly.value.firstMonth || !monthly.value.lastMonth) return {
        years: [] as string[],
        monthRows: [] as { month: string; monthIndex: number; cells: { year: string; count: number }[] }[],
    };
    const { firstMonth, lastMonth, months } = monthly.value;
    const startYear = Number(firstMonth.slice(0, 4));
    const endYear = Number(lastMonth.slice(0, 4));

    // 展示从起始年到结束年的全部年份，不再截断
    const allYears: string[] = [];
    for (let y = startYear; y <= endYear; y++) allYears.push(String(y));

    // 12 行（1月→12月），每行单元格数量 = 年份数
    const monthRows = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const cells = allYears.map(year => {
            const monthKey = `${year}年${String(m).padStart(2, '0')}月`;
            return { year, count: months.get(monthKey) || 0 };
        });
        return {
            month: `${m}月`,
            monthIndex: m,
            cells,
        };
    });

    return { years: allYears, monthRows };
});

const monthlyMax = computed(() => {
    let max = 0;
    for (const row of monthlyGrid.value.monthRows) {
        for (const cell of row.cells) {
            if (cell.count > max) max = cell.count;
        }
    }
    return Math.max(1, max);
});


/** 概览卡片悬浮提示 */
function overviewCellTooltip(item: { key: string; label: string; total: number; excludeFromTotal?: boolean }): string {
    const tips: Record<string, string> = {
        messages: '说说（QQ空间动态）条目数',
        blogs: '日志（长篇文章）条目数',
        diaries: '日记条目数',
        videos: '视频条目数',
        boards: '留言板留言条目数',
        shares: '分享条目数（分享的内容链接/动态）',
        favorites: '收藏条目数',
        albums: '相册容器数量（不含相片）',
        photos: '所有相册中的相片总数（不包含「说说和日志相册」）',
        friends: '好友数量',
        visitors: '访客（访问记录）数量',
    };
    let result = tips[item.key] || item.label + '：' + item.total;
    // 消解「0」的歧义：区分没备份与已备份但确实没有内容
    const status = statusByKey.value.get(item.key);
    if (item.total === 0 && status === 'missing') {
        result += '\n（本次未备份该模块：数据文件不存在）';
    } else if (item.total === 0 && status === 'empty') {
        result += '\n（该模块已备份，但备份里没有内容）';
    }
    if (item.excludeFromTotal) {
        result += '\n（不计入"总条目"统计）';
    }
    return result;
}

/** 内容构成横向条形图的行悬浮提示：相片行额外说明已排除说说和日志相册 */
function barRowTooltip(item: { key: string; label: string; total: number; excludeFromTotal?: boolean; percent: number }): string {
    const base = `${item.label}：${item.total.toLocaleString()} 条${item.excludeFromTotal ? '（不计入总条目）' : ' 占比 ' + item.percent + '%'}`;
    if (item.key === 'photos') {
        return base + '\n（相片数不包含「说说和日志相册」）';
    }
    return base;
}

onMounted(async () => {
    const tasks = [
        loadYearStats((time: string | number) => formatTime(time).slice(0, 4)),
        loadTimeRange(),
        loadInteractionStats(),
        loadMediaStats(),
        loadMonthlyStats(),
        /* 独立加载模块条数：与父组件 App.vue 的 loadModuleCounts 并行，双保险避免模块统计/内容构成看起来"不见了" */
        loadModuleCounts(),
    ] as const;

    const [ys, tr, inter, med, mon, lc] = await Promise.all(tasks);
    yearStats.value = ys;
    timeRange.value = tr;
    interaction.value = inter;
    media.value = med;
    monthly.value = mon;
    /* HomePage 本地独立计算的模块条数：父组件未就绪时先用这个，避免模块统计/内容构成"空白失踪" */
    localCounts.value = lc;

    /* 模块状态依赖已算出的 counts；各数据源此时均已加载，命中 sources 缓存 */
    moduleStatuses.value = await loadModuleStatuses(lc);

    loadingExtra.value = false;
});

// 我与 TA 的互动看板：仅当备份属于「他人空间」（Owner ≠ Target）时才计算并展示。
// immediate 覆盖挂载前 user 已就绪的情况；后续 user 变化（如切换备份）也会重新计算。
watch(
    () => props.user,
    (u) => {
        if (!u) {
            ownerTarget.value = null;
            return;
        }
        loadOwnerTargetInteraction(u).then((stat) => {
            ownerTarget.value = stat;
        });
    },
    { immediate: true },
);
</script>

<template>
    <div class="page-head">
        <span class="page-title">空间概览</span>
        <!-- 备份状态徽章 -->
        <span
            v-if="counts && completeness.label"
            class="status-badge"
            :class="completeness.tone === 'ok' ? 'status-complete' : completeness.tone === 'info' ? 'status-info' : 'status-partial'"
        >{{ completeness.label }}</span>
    </div>
    <div class="page-body">
        <div v-if="!user" class="page-alert">
            没有读到备份数据。请确认本页面位于备份目录的根目录文件夹内，且未把它单独移动到别处。
        </div>

        <template v-else>
            <!-- 用户信息 -->
            <div class="intro">
                <div class="space-name">{{ user.spacename || '我的QQ空间' }}</div>
                <p v-if="user.desc" class="desc">{{ user.desc }}</p>
            </div>

            <!-- 空间资料（性别/星座/血型/地区/公司/签名等，与 Markdown 导出同源） -->
            <space-profile-panel :user="user" />

            <!-- P0: 总览条 -->
            <div class="summary-bar">
                <div class="summary-item" title="所有用户创建内容的总条目数（含说说、日志、日记、相片、视频、留言、分享、收藏，不含访客、好友和相册容器；相片数不包含「说说和日志相册」）">
                    <div class="summary-icon">📊</div>
                    <div class="summary-info">
                        <div class="summary-value">{{ totalItems.toLocaleString() }}</div>
                        <div class="summary-label">总条目</div>
                    </div>
                </div>
                <div class="summary-item" v-if="timeRange.earliest" title="最早和最晚的用户创建内容时间（不含好友相识时间和访客访问记录）">
                    <div class="summary-icon">📅</div>
                    <div class="summary-info">
                        <div class="summary-value summary-range">{{ timeRange.earliest.slice(0, 10) }}至{{ timeRange.latest.slice(0, 10) }}</div>
                        <div class="summary-label">时间跨度</div>
                    </div>
                </div>
            </div>

            <!-- P0: 内容总量（上：模块统计精简单行小卡片；下：横向条形柱状图） -->
            <div class="overview-section">
                <!-- 模块统计：精简单行小卡片，仅名称+总数；双保险加载，空态也显示提示不"消失" -->
                <div v-if="allCardsEmpty && !countsReady" class="overview-loading">📊 模块统计加载中...</div>
                <div v-else class="overview-grid">
                    <a
                        v-for="item in cards"
                        :key="item.key"
                        :href="item.link"
                        class="overview-cell"
                        :class="{ 'overview-empty': item.total === 0, 'overview-cell-excluded': item.excludeFromTotal }"
                        :title="overviewCellTooltip(item)"
                    >
                        <div class="overview-total">{{ item.total.toLocaleString() }}</div>
                        <div class="overview-label-row">
                            <span class="overview-label">{{ item.label }}</span>
                            <span v-if="item.excludeFromTotal" class="overview-excluded-tag">不计入</span>
                        </div>
                    </a>
                </div>

                <!-- 内容构成横向条形柱状图（按数量降序，不计入模块灰显+短条不参与最大基准） -->
                <!-- 空态：即使 moduleShare 为空，也显示容器，不让用户以为"不见了" -->
                <div class="bar-chart-wrapper" title="各内容类型的数量及占比（灰色模块不计入总条目统计）">
                    <div class="section-title-sm section-title-row">
                        <span>内容构成</span>
                        <span class="title-hint">
                            <template v-if="totalItems > 0">
                                共 {{ totalItems.toLocaleString() }} 条有效内容 · 横向条仅按有效内容做比例对比，灰色「不计入」条目不参与基准
                            </template>
                            <template v-else-if="countsReady">
                                暂无有效内容统计数据
                            </template>
                            <template v-else>
                                统计加载中...
                            </template>
                        </span>
                    </div>
                    <div v-if="moduleShare.length > 0" class="bar-chart-list">
                        <div
                            v-for="(item, idx) in moduleShare"
                            :key="item.key"
                            class="bar-chart-row"
                            :class="{ 'bar-row-excluded': item.excludeFromTotal }"
                            :title="barRowTooltip(item)"
                        >
                            <div class="bar-row-head">
                                <span
                                    class="bar-row-dot"
                                    :style="{ background: item.excludeFromTotal ? '#bfbfbf' : ringColors[Math.min(idx, ringColors.length - 1)] }"
                                />
                                <span class="bar-row-name">{{ item.label }}</span>
                                <span v-if="item.excludeFromTotal" class="bar-row-excluded-tag">不计入</span>
                            </div>
                            <div class="bar-row-track">
                                <div
                                    class="bar-row-fill"
                                    :style="barRowFillStyle(item, idx)"
                                />
                            </div>
                            <div class="bar-row-tail">
                                <span class="bar-row-count">{{ item.total.toLocaleString() }}</span>
                                <span class="bar-row-pct">{{ item.excludeFromTotal ? '—' : item.percent + '%' }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-else class="bar-chart-empty">
                        <template v-if="countsReady">暂无内容构成数据</template>
                        <template v-else>正在统计各模块内容数量，请稍候...</template>
                    </div>
                </div>
            </div>

            <!-- P1: 互动热度 + 媒体统计 -->
            <div class="stats-row">
                <div class="stats-card">
                    <div class="section-title-sm">🔥 互动热度</div>
                    <div class="stats-items">
                        <div class="stat-item" title="所有内容（说说、日志、日记、视频、分享、收藏、留言、相片）收到的总点赞数">
                            <div class="stat-icon stat-likes">❤</div>
                            <div class="stat-value">{{ interaction.totalLikes.toLocaleString() }}</div>
                            <div class="stat-label">总赞</div>
                        </div>
                        <div class="stat-item" title="所有内容（说说、日志、日记、视频、分享、收藏、留言、相片）收到的总评论数">
                            <div class="stat-icon stat-comments">💬</div>
                            <div class="stat-value">{{ interaction.totalComments.toLocaleString() }}</div>
                            <div class="stat-label">总评论</div>
                        </div>
                        <div class="stat-item" title="所有内容（说说、日志、日记、视频、分享、收藏、相片）的总浏览/访问量">
                            <div class="stat-icon stat-views">👁</div>
                            <div class="stat-value">{{ interaction.totalViews.toLocaleString() }}</div>
                            <div class="stat-label">总浏览</div>
                        </div>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="section-title-sm">📷 媒体资源</div>
                    <div class="stats-items">
                        <div class="stat-item" title="所有相册中的相片总数（不包含「说说和日志相册」）">
                            <div class="stat-value">{{ media.photos.toLocaleString() }}</div>
                            <div class="stat-label">相片</div>
                        </div>
                        <div class="stat-item" title="视频总数">
                            <div class="stat-value">{{ media.videos.toLocaleString() }}</div>
                            <div class="stat-label">视频</div>
                        </div>
                        <div class="stat-item" title="备份记录中已登记本地路径的媒体占比；按记录里的路径判定，不代表文件确实存在">
                            <div class="stat-value stat-highlight">{{ localMediaRatio }}%</div>
                            <div class="stat-label">本地路径</div>
                        </div>
                    </div>
                    <div class="media-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: localMediaRatio + '%' }"></div>
                        </div>
                        <span class="progress-label" title="按备份记录中的路径分类：本地相对路径 / 外链 URL / 无可用路径">本地 {{ (media.localPhotos + media.localVideos) }} / 外链 {{ (media.externalPhotos + media.externalVideos) }}<template v-if="unknownMedia > 0"> / 未记录 {{ unknownMedia }}</template></span>
                    </div>
                </div>
            </div>

            <!-- 指标口径说明：一次性消除三个最容易被误读的数字 -->
            <div class="metric-footnote">
                口径说明：总条目不含相册容器、好友与访客，相片不含「说说和日志相册」；「本地路径」按备份记录里登记的路径统计，<strong>不代表文件确实存在</strong>；总浏览不含留言与相片（接口无浏览量）。
            </div>

            <!-- 我与 TA 的互动：仅当 Owner ≠ Target（查看他人空间备份）时展示 -->
            <owner-target-interaction
                v-if="ownerTarget"
                :data="ownerTarget"
                :target-sex="(props.user as any)?.sex"
                @stat-click="onStatCardClick"
                @visit-click="onVisitCardClick"
            />
            <div v-if="ownerTarget" class="oti-more" @click="navigate('interaction')">
                查看完整互动明细 →
            </div>

            <!-- 年活跃度（8-2 044902d基线1:1恢复，确保显示正常；样式增强在CSS中叠加） -->
            <!-- 桌面端：竖向柱状图；移动端：横向进度条列表（一年一行，阅读效率更高） -->
            <template v-if="yearChart.length > 0">
                <div class="section-title">年活跃度</div>
                <!-- 桌面端（≥580px）显示 -->
                <div class="year-chart">
                    <div
                        v-for="item in yearChart"
                        :key="item.year"
                        class="year-col"
                        :class="{ 'year-col-peak': isPeakYear(item, 0) }"
                        :title="item.year + '年：共 ' + item.total + ' 条\n' + item.parts.map((p) => p.label + ' ' + p.count).join('、')"
                    >
                        <div
                            class="year-col-value"
                            :class="{ 'year-col-value-outer': (item.total / maxYearTotal * 100) < 10 }"
                        >
                            <template v-if="isPeakYear(item, 0)">★ </template>
                            {{ item.total }}
                        </div>
                        <div class="year-col-track">
                            <div
                                class="year-col-bar"
                                :style="{ height: (item.total / maxYearTotal * 100) + '%' }"
                            />
                        </div>
                        <div class="year-col-name">{{ item.year }}</div>
                    </div>
                </div>
                <!-- 移动端（<580px）显示：横向进度条列表，一年一行，阅读效率更高 -->
                <div class="year-list">
                    <div
                        v-for="(item, idx) in yearChart"
                        :key="item.year"
                        class="year-list-row"
                        :class="{ 'year-list-row-peak': isPeakYear(item, idx) }"
                        :title="item.year + '年：共 ' + item.total + ' 条\n' + item.parts.map((p) => p.label + ' ' + p.count).join('、')"
                    >
                        <span class="year-list-year">
                            <template v-if="isPeakYear(item, idx)">★</template>
                            {{ item.year }}
                        </span>
                        <div class="year-list-bar-track">
                            <div
                                class="year-list-bar"
                                :style="{ width: Math.max(item.total / maxYearTotal * 100, barHeightPct(item.total) > 0 ? 1 : 0) + '%' }"
                            />
                        </div>
                        <span class="year-list-total">{{ item.total }}</span>
                    </div>
                </div>
            </template>

            <!-- P1: 月度热力图（月份为行：1月~12月，年份为列：每一年一列；与初识空间/深夜动态同款：独立面板外壳+默认收起折叠） -->
            <template v-if="monthlyGrid.years.length > 0">
                <div class="monthly-panel">
                    <n-collapse :default-expanded-names="[]">
                        <n-collapse-item name="monthly">
                            <template #header>
                                <span class="panel-title">月活跃度</span>
                                <span class="panel-note">
                                    {{ monthlyGrid.years.length }} 年 × 12 月，单月最高 {{ monthlyMax }} 条
                                </span>
                            </template>
                            <div class="heatmap">
                                <div class="heatmap-table">
                                    <!-- 表头：第1格「月份」+ 每一年作为一列 -->
                                    <div class="heatmap-header-row">
                                        <span class="heatmap-corner-cell">月份</span>
                                        <div class="heatmap-year-header-row">
                                            <span v-for="yr in monthlyGrid.years" :key="yr" class="heatmap-year-col-label">{{ yr }}</span>
                                        </div>
                                    </div>
                                    <!-- 数据行：1月~12月，每一行的每个单元格对应该月份+该年份的条数 -->
                                    <div v-for="row in monthlyGrid.monthRows" :key="row.monthIndex" class="heatmap-month-row">
                                        <span class="heatmap-month-label-col">{{ row.month }}</span>
                                        <div class="heatmap-year-header-row">
                                            <div
                                                v-for="cell in row.cells"
                                                :key="cell.year"
                                                class="heatmap-cell"
                                                :style="{ background: heatColor(cell.count, monthlyMax), opacity: cell.count > 0 ? 1 : 0.15 }"
                                                :title="cell.year + '年 ' + row.month + '：' + cell.count + ' 条内容' + (cell.count > 0 ? '（含相片、说说、日志等）' : '')"
                                            >
                                                <span class="heatmap-count" v-if="cell.count > 0">{{ cell.count }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="heatmap-legend">
                                    <span>少</span>
                                    <span class="legend-cell" style="background:var(--bg-toolbar)"></span>
                                    <span class="legend-cell" style="background:#dbeafe"></span>
                                    <span class="legend-cell" style="background:#3b82f6"></span>
                                    <span class="legend-cell" style="background:#1e3a8a"></span>
                                    <span>多</span>
                                </div>
                            </div>
                        </n-collapse-item>
                    </n-collapse>
                </div>
            </template>

            <!-- P2: 点赞最多（独立面板，原父面板拆出，Top 5 点赞数据） -->
            <top-likes-panel />

            <!-- P3: 评论最多（独立面板，原父面板拆出，Top 5 评论数据） -->
            <top-comments-panel />

            <!-- P4: 浏览最多（独立面板，原父面板拆出，Top 5 浏览数据） -->
            <top-views-panel />

            <!-- P5: 最常访问地点 Top5（独立面板组件，与其他面板同款外壳：色条+背景+默认收起折叠） -->
            <top-locations-panel />

            <!-- 那年今日 -->
            <that-year-today-panel />

            <!-- 深夜动态 -->
            <night-owl-panel />

            <!-- 初识空间（组件内部已自带折叠面板，默认收起） -->
            <first-records-panel />
        </template>
        <!-- 页脚：固定悬浮在下方（sticky 而非 fixed，不会遮住正文末尾），结构与8-2基线一致：放在page-body内部最底部 -->
        <div class="home-footer">落叶随风，青春，稍纵即逝。</div>
    </div>
</template>

<style scoped>
/* ========== 基础布局 ========== */
.page-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-card);
    margin-bottom: 16px;
}
.page-title {
    font-size: 15px;
    font-weight: 600;
}
.status-badge {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}
.status-complete {
    background: var(--bg-tint-blue);
    color: #2080f0;
}
.status-partial {
    background: var(--bg-tint-yellow);
    color: #f0a020;
}

/* 已备份但无内容的模块：中性提示，不渲染成警告 */
.status-info {
    background: var(--bg-toolbar);
    color: var(--text-secondary);
}

/* 指标口径说明：消解总条目 / 本地路径 / 总浏览三个数字的误读 */
.metric-footnote {
    margin: -4px 0 18px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--bg-toolbar);
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-muted);
}
.metric-footnote strong {
    color: var(--text-secondary);
    font-weight: 600;
}
.oti-more {
    margin: -8px 0 20px;
    text-align: right;
    font-size: 13px;
    color: #3370ff;
    cursor: pointer;
    user-select: none;
}
.oti-more:hover {
    text-decoration: underline;
}
.page-alert {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--bg-tint-yellow);
    border: 1px solid #ffe58f;
    border-radius: 6px;
    color: #ad6800;
}
.intro { margin-bottom: 16px; }
.space-name { font-size: 16px; font-weight: 600; }
.desc { margin: 6px 0 0; color: var(--text-secondary); }

/* ========== P0: 总览条 ========== */
.summary-bar {
    display: flex;
    gap: 16px;
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--bg-tint-green) 0%, var(--bg-tint-blue) 100%);
    border-radius: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.summary-item {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 180px;
}
.summary-icon {
    font-size: 28px;
}
.summary-info {
    display: flex;
    flex-direction: column;
}
.summary-value {
    font-size: 22px;
    font-weight: 700;
    color: #2080f0;
    line-height: 1.2;
    /* 大数字等宽对齐，避免 1/4/8 跳动 */
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
}
.summary-range {
    font-size: 16px;
    /* 时间跨度中的数字也保持等宽 */
    font-variant-numeric: tabular-nums;
}
.summary-small {
    font-size: 14px;
    color: #3370ff;
}
.summary-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
}

/* ========== P0: 概览区（上下结构：上模块小卡片网格 + 下横向条形柱状图） ========== */
.overview-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 20px;
    max-width: 100%;
    min-width: 0;
    /* 之前的 overflow:hidden + flex嵌套压缩 → overview-section高度=0 → 子元素(卡片+柱状图)全部被裁掉 = "看不见"
       现在只裁横向（防横向滚动条），同时 flex:0 0 auto 不允许父 flex column 压缩高度为 0 */
    overflow-x: hidden;
    flex: 0 0 auto;
    min-height: 1px;
}

/* —— 模块统计：精简单行小卡片（无外层容器，直接平铺；仅名称+总数） —— */
.overview-grid {
    display: grid;
    grid-template-columns: repeat(11, minmax(0, 1fr));
    gap: 10px;
    min-width: 0;
    max-width: 100%;
}
.overview-cell {
    padding: 10px 12px;
    text-align: center;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 64px;
}
.overview-cell:hover {
    border-color: #2080f0;
    box-shadow: 0 3px 10px rgba(32, 128, 240, 0.12);
}
.overview-cell-excluded {
    background: var(--bg-toolbar);
}
.overview-empty {
    background: var(--bg-toolbar);
    color: var(--text-subtle);
}
.overview-empty .overview-total { color: var(--text-subtle); }

/* 模块统计：加载中提示（避免用户以为"不见了"） */
.overview-loading {
    padding: 16px;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 6px;
}

.overview-total {
    font-size: 18px;
    font-weight: 700;
    white-space: nowrap;
    color: #2080f0;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
    line-height: 1.1;
}
.overview-label-row {
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
}
.overview-label {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.overview-excluded-tag {
    font-size: 10px;
    padding: 1px 4px;
    line-height: 12px;
    border-radius: 6px;
    background: var(--bg-toolbar);
    color: var(--text-muted);
    white-space: nowrap;
    flex: none;
}

/* —— 下半部分：横向条形柱状图 —— */
.bar-chart-wrapper {
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    padding: 14px 18px 18px 18px;
    box-sizing: border-box;
}
.bar-chart-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
/* 内容构成：空态（避免用户以为"不见了"） */
.bar-chart-empty {
    padding: 28px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--bg-toolbar);
    border: 1px dashed var(--border-hover);
    border-radius: 4px;
}
.bar-chart-row {
    display: grid;
    /* 左：模块名 · 中：进度条 · 右：数值+占比 */
    grid-template-columns: 120px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 2px 0;
}
.bar-row-head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.bar-row-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
}
.bar-row-name {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.bar-row-excluded-tag {
    font-size: 10px;
    padding: 0 5px;
    line-height: 15px;
    border-radius: 7px;
    background: var(--bg-toolbar);
    color: var(--text-muted);
    white-space: nowrap;
    flex: none;
}
.bar-row-track {
    position: relative;
    height: 14px;
    border-radius: 3px;
    background: var(--bg-toolbar);
    overflow: hidden;
    min-width: 0;
}
.bar-row-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    transition: width 0.4s;
    min-width: 2px;
}
.bar-row-tail {
    display: flex;
    align-items: baseline;
    gap: 8px;
    white-space: nowrap;
    flex: none;
}
.bar-row-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    min-width: 48px;
    text-align: right;
}
.bar-row-pct {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: right;
}
/* 不计入的模块灰显 */
.bar-row-excluded .bar-row-name,
.bar-row-excluded .bar-row-count,
.bar-row-excluded .bar-row-pct {
    color: var(--text-muted);
}
.bar-row-excluded .bar-row-count {
    font-weight: 500;
}

/* —— 通用：小分区标题 —— */
.section-title-sm {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 10px;
}
.section-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.title-hint {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}

/* ========== P1: 互动 + 媒体 ========== */
.stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
}
.stats-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    padding: 14px 16px;
}
.stats-items {
    display: flex;
    gap: 16px;
}
.stat-item {
    flex: 1;
    text-align: center;
}
.stat-icon {
    font-size: 22px;
    margin-bottom: 2px;
}
.stat-likes { color: #e64a5e; }
.stat-comments { color: #3370ff; }
.stat-views { color: #4ca1f5; }
.stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    /* 统计数值统一等宽对齐 */
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
}
.stat-highlight {
    color: #2080f0;
}
.stat-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
}
.media-progress {
    margin-top: 10px;
}
.progress-bar {
    height: 6px;
    background: var(--bg-toolbar);
    border-radius: 3px;
    overflow: hidden;
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2080f0, #409eff);
    border-radius: 3px;
    transition: width 0.3s;
}
.progress-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    display: block;
}

/* ========== 年活跃度（重写：柱底对齐基线、数值用纯flex垂直排列紧贴柱顶绝不错位） ========== */
.section-title {
    margin: 20px 0 10px;
    padding: 6px 12px;
    background: var(--bg-page);
    border-left: 3px solid #2080f0;
    font-weight: 600;
    font-size: 14px;
}
/* 年活跃度：严格 1:1 复用 8-2 基线 044902d 的 CSS 布局骨架（不再做任何 layout 改动） */
/* ===== 以下为 8-2 基线的原始样式，任何 layout 级别的修改都请先对照此基线 ===== */
/* 年活跃度：纯 CSS 竖向柱状图，一年一柱，左旧右新 */
.year-chart {
    display: flex;
    align-items: stretch;
    gap: 10px;
    height: 220px;
    padding: 8px 4px 0;
    overflow-x: auto;
    /* ===== 在 page-body 的 flex column 中，给固定高度项加 flex:none 确保高度绝不被压缩 ===== */
    flex: none;
    /* ===== 与下方月度活跃度面板的间距（与 section-title 的 24px 上间距协调） ===== */
    margin-bottom: 24px;
}
.year-col {
    flex: 1 0 40px;
    min-width: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.year-col-value {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}
/* 柱子的可伸展区域：占据列内剩余高度，柱子贴底生长 */
.year-col-track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.year-col-bar {
    width: 60%;
    max-width: 36px;
    min-height: 3px;
    background: #2080f0;
    border-radius: 4px 4px 0 0;
    transition: height 0.3s;
}
.year-col:hover .year-col-bar {
    background: #1366d6;
}
.year-col-name {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
}

/* ===== 8-2 基线之上的体验增强（仅视觉层，不触碰 flex/padding/height/display 等布局骨架） ===== */
/* 1. 峰值年（Top3）：★ 标记的金色数值 + 金→绿渐变柱子 */
.year-col-peak .year-col-value {
    color: #c7961c;
    font-weight: 600;
}
.year-col-peak .year-col-bar {
    background: linear-gradient(180deg, #e6b331 0%, #c7961c 55%, #2080f0 100%);
}
.year-col-peak:hover .year-col-bar {
    background: linear-gradient(180deg, #d4a120 0%, #b08316 50%, #0b7a3e 100%);
    box-shadow: 0 -2px 12px rgba(230, 179, 49, 0.35);
}
/* 2. 极矮柱（<10%）：数值加深色轻量浅底，避免矮柱数值与背景融在一起 */
.year-col-value-outer {
    color: var(--text-secondary);
    background: var(--bg-toolbar);
    border-radius: 3px;
    padding: 1px 3px;
    font-weight: 500;
}
/* 3. 峰值年矮柱：金色优先级高于浅底 */
.year-col-peak .year-col-value-outer {
    color: #c7961c;
    background: var(--bg-tint-yellow);
}
/* 4. 普通柱子悬停阴影（不影响高度布局） */
.year-col:hover .year-col-bar {
    box-shadow: 0 -2px 8px rgba(32, 128, 240, 0.25);
}

/* ========== 年活跃度：移动端横向进度条版本（<580px 显示，≥580px 隐藏） ========== */
.year-list {
    /* 桌面端默认隐藏（用竖向柱状图） */
    display: none;
    margin-bottom: 24px;
    padding: 6px 4px 2px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    box-sizing: border-box;
}
.year-list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 28px;
    padding: 0 6px;
    border-radius: 4px;
}
.year-list-row:hover {
    background: var(--bg-toolbar);
}
/* 年份列（左）：固定宽度 54px；峰值年金色加粗 */
.year-list-year {
    flex: none;
    width: 54px;
    font-size: 13px;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.year-list-row-peak .year-list-year {
    color: #c7961c;
    font-weight: 700;
}
/* 进度条轨道（中）：flex:1 填满剩余宽度 */
.year-list-bar-track {
    flex: 1;
    min-width: 0;             /* 允许 flex 收缩 */
    height: 10px;
    background: var(--bg-toolbar);
    border-radius: 5px;
    overflow: hidden;
}
/* 进度条：左对齐生长，默认绿色渐变；峰值年金→绿渐变 */
.year-list-bar {
    height: 100%;
    min-width: 2px;           /* 极小值也要看得到 */
    background: linear-gradient(90deg, #40a9ff 0%, #2080f0 100%);
    border-radius: 5px;
    transition: width 0.3s ease;
}
.year-list-row-peak .year-list-bar {
    background: linear-gradient(90deg, #e6b331 0%, #c7961c 55%, #2080f0 100%);
}
/* 总数列（右）：固定宽度 54px 右对齐；峰值年金色加粗 */
.year-list-total {
    flex: none;
    width: 54px;
    text-align: right;
    font-size: 13px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.year-list-row-peak .year-list-total {
    color: #c7961c;
    font-weight: 700;
}

/* ========== 月度活跃度面板：与初识空间/深夜动态同款外壳（左侧色条+背景+padding） ========== */
.monthly-panel {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: var(--bg-tint-blue);        /* 浅蓝底（蓝色系未被其他面板使用，与热力图蓝色调呼应） */
    border-left: 3px solid #3370ff;
    border-radius: 2px;
}
/* 折叠项标题（加粗大字），与初识空间一致 */
.panel-title {
    font-size: 15px;
    font-weight: 600;
}
/* 折叠项副说明（小字灰色），与初识空间一致 */
.panel-note {
    font-size: 12px;
    color: var(--text-secondary);
    margin-left: 8px;
}

/* ========== P1: 月度热力图（月份为行、年份为列，列宽用 fr 自适应填满容器） ========== */
.heatmap {
    /* 已在 monthly-panel 外壳统一处理 margin，这里避免双重底部间距 */
    margin-bottom: 0;
}
.heatmap-table {
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    padding: 12px 16px;
    overflow-x: auto;
}
/* 表头行 + 每一月的数据行：使用 CSS Grid 统一对齐两列（左标签列 + 右数据列容器） */
.heatmap-header-row,
.heatmap-month-row {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 3px;
    align-items: center;
}
/* 表头行 */
.heatmap-header-row {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--bg-toolbar);
    margin-bottom: 6px;
}
/* 左上角「月份」单元格 */
.heatmap-corner-cell {
    width: 56px;
    font-size: 11px;
    color: var(--text-muted);
}
/* 数据行中每年的格：使用 Grid fr 等分 —— 不管有几年，自动撑满容器宽度 —— 因此无 6 年时不再右侧留白 */
.heatmap-year-header-row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 3px;
    min-width: 0;
}
/* 表头中每一年的列标题 */
.heatmap-year-col-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    padding: 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* 数据行：一月一行 */
.heatmap-month-row {
    padding: 4px 0;
}
/* 数据行中「1月」「2月」的左侧标签 */
.heatmap-month-label-col {
    width: 56px;
    font-size: 12px;
    color: var(--text-secondary);
}
/* 单元格：不再固定 px，通过外层 grid-auto-columns:1fr 自动等分 */
.heatmap-cell {
    aspect-ratio: 2 / 1;
    min-width: 0;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #fff;
    transition: transform 0.15s;
}
.heatmap-cell:hover {
    transform: scale(1.05);
    z-index: 1;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.heatmap-count {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.heatmap-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
    justify-content: flex-end;
    flex-wrap: wrap;
}
.heatmap-more-hint {
    margin-left: 8px;
    color: var(--text-subtle);
    font-style: italic;
}
.legend-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

/* ========== P2: 备份信息 ========== */
.backup-info {
    margin: 20px 0 0;
    padding: 14px 16px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-hover);
    border-radius: 8px;
}
.backup-info-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 10px;
    color: var(--text-primary);
}
.backup-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
}
.backup-info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.backup-info-label {
    font-size: 12px;
    color: var(--text-muted);
}
.backup-info-value {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
}

/* ========== Footer ========== */
.home-footer {
    position: sticky;
    bottom: 0;
    flex: none;
    padding: 10px 28px;
    text-align: center;
    font-size: 13px;
    color: var(--text-subtle);
    background: rgba(255, 255, 255, 0.92);
    border-top: 1px solid var(--border-light);
    backdrop-filter: blur(2px);
    z-index: 1;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

/* 暗色模式：半透明深色底，与主题协调 */
:root.dark .home-footer {
    background: rgba(30, 30, 34, 0.92);
    border-top-color: var(--border-card);
}

/* 悬浮态：不透明、贴紧容器边缘、覆盖底层元素 */
.home-footer:hover {
    background: var(--bg-primary);
    color: var(--text-muted);
    margin: 0 -28px -20px;
    padding: 10px 28px 30px;
    z-index: 10;
}

:root.dark .home-footer:hover {
    background: var(--bg-primary);
}

/* ========== 响应式断点 ========== */
/* 大屏（≤ 1440px）：11 列 → 6 列 */
@media (max-width: 1440px) {
    .overview-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
    }
}
/* 平板（≤ 1080px）：6 列 → 4 列 */
@media (max-width: 1080px) {
    .overview-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .bar-chart-row {
        grid-template-columns: 108px minmax(0, 1fr) auto;
    }
    .stats-items {
        flex-wrap: wrap;
        gap: 12px;
    }
}
/* 小平板（≤ 780px）：4 列 → 3 列，柱状图紧凑 */
@media (max-width: 780px) {
    .overview-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .bar-chart-row {
        grid-template-columns: 96px minmax(0, 1fr) auto;
        gap: 10px;
    }
    .bar-row-count {
        min-width: 42px;
        font-size: 12px;
    }
    .bar-row-pct {
        min-width: 32px;
    }
}
/* 手机（≤ 580px）：3 → 2 列，标题区紧凑化，柱状图模块名缩为 84px；年活跃度切换为横向进度条 */
@media (max-width: 580px) {
    /* 年活跃度：桌面端竖向柱状图 → 手机端横向进度条（阅读效率更高） */
    .year-chart {
        display: none !important;
    }
    .year-list {
        display: block;
    }
    .summary-bar {
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px;
    }
    .summary-item {
        min-width: auto;
    }
    .bar-chart-wrapper {
        padding: 12px;
    }
    .overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }
    .overview-cell {
        padding: 10px 8px;
        min-height: 62px;
    }
    .overview-total {
        font-size: 16px;
    }
    .bar-chart-row {
        grid-template-columns: 84px minmax(0, 1fr) auto;
        gap: 8px;
    }
    .bar-row-count {
        min-width: 40px;
        font-size: 12px;
    }
    .bar-row-pct {
        display: none;
    }
    .section-title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }
    .stats-row {
        grid-template-columns: 1fr;
    }
    .heatmap-cell {
        font-size: 10px;
    }
}
</style>