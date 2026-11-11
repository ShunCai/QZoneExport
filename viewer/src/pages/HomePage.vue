<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import HomeInteractionCard from '../components/home/HomeInteractionCard.vue';
import HomeWordComposition from '../components/home/HomeWordComposition.vue';
import HomeRecentInteractions from '../components/home/HomeRecentInteractions.vue';
import HomeEmojiStrip from '../components/home/HomeEmojiStrip.vue';
import HomeWordCloud from '../components/home/HomeWordCloud.vue';
import HomeLocationCard from '../components/home/HomeLocationCard.vue';
import HomeGapCard from '../components/home/HomeGapCard.vue';
import HomeCareCard from '../components/home/HomeCareCard.vue';
import HomeNightCard from '../components/home/HomeNightCard.vue';
import HomeHero from '../components/home/HomeHero.vue';
import { isOtherSpace as checkOtherSpace, OTHER_SPACE_EXCLUDED_MODULES } from '../data/space';
import HomeComposition from '../components/home/HomeComposition.vue';
import HomePeopleTop from '../components/home/HomePeopleTop.vue';
import HomeBrandBar from '../components/home/HomeBrandBar.vue';
import HomeTopMemories from '../components/home/HomeTopMemories.vue';
import HomeShareCardDialog from '../components/home/HomeShareCardDialog.vue';
import HomeYearChart from '../components/home/HomeYearChart.vue';
import HomeTimelineStrip from '../components/home/HomeTimelineStrip.vue';
import HomeMonthBars from '../components/home/HomeMonthBars.vue';
import HomeThatYearToday from '../components/home/HomeThatYearToday.vue';
import HomeListCard from '../components/home/HomeListCard.vue';
import { navigate } from '../router';
import {
    loadYearStats,
    loadTimeRange,
    loadInteractionStats,
    loadMediaStats,
    loadMonthlyStats,
    loadModuleCounts,
    type TimeRange,
    type InteractionStats,
    type MediaStats,
    type MonthlyStat,
    type ModuleYearStat,
} from '../data/counts';
import { formatTime } from '../data/format';
import { loadOwnerTargetInteraction, type OwnerTargetInteraction as OwnerTargetInteractionData } from '../data/owner-target';
import { loadWordCounts, type WordCounts } from '../data/wordCounts';
import { loadRecentInteractions, type RecentInteraction } from '../data/recentInteractions';
import { loadEmojiStats, type EmojiCount } from '../data/emojiStats';
import { loadWordCloud, type WordCloudResult } from '../data/wordCloud';
import { loadCityStats, type CityRow } from '../data/cityStats';
import { computeGaps, loadTopLocations, type TopLocation } from '../data/counts';
import { loadNightDialogs, type NightDialog } from '../data/nightCompanions';
import { buildSpaceProfileRows } from '../data/spaceProfile';
import { loadInteractionSelection, type CareFriend, type TopPerson } from '../data/top-people';
import { loadCoverPhotos, type CoverPhoto } from '../data/covers';
import { loadHomeMemories, type TopMemory } from '../data/home';
import { loadHomeRankings, type HomeRankings } from '../data/rankings';

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

const emit = defineEmits<{ searchWord: [word: string] }>();

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

/** 是否查看他人空间备份（Owner ≠ Target），与左侧菜单、动态筛选共用 data/space.ts */
const isOtherSpace = computed(() => checkOtherSpace(props.user));

const cards = computed(() => {
    const list = isOtherSpace.value
        ? CARDS.filter((c) => !OTHER_SPACE_EXCLUDED_MODULES.includes(c.key))
        : CARDS;
    return list.map((item) => ({
        ...item,
        /* 双保险：优先父组件传的 counts，若为空（异步延迟/异常）则取 HomePage 自己 onMounted 算的 localCounts */
        total: Number((props.counts ?? localCounts.value)?.[item.field] ?? 0),
    }));
});


/** 本地独立计算的模块条数（与父组件的 counts prop 并行加载，避免父组件异步延迟导致模块统计/内容构成看起来"不见了"） */
const localCounts = ref<Record<string, number> | null>(null);


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

// 月度热力图
const monthly = ref<MonthlyStat>({ months: new Map(), firstMonth: '', lastMonth: '' });


// 我与 TA 的互动（仅查看他人空间备份时非空）
const ownerTarget = ref<OwnerTargetInteractionData | null>(null);
const ownerLoading = ref(false);
/** 文字量构成（按模块字数）与最近互动流：两张新卡的数据，随 user 变化一起重算 */
const wordCounts = ref<WordCounts | null>(null);
/** 加载态单独标记：卡片始终挂载，数据未到时显示「正在统计…」而不是整卡缺席或假空态 */
const wordLoading = ref(false);
const recentInteractions = ref<RecentInteraction[]>([]);
/** 最近互动的加载态：与「互动速览」共用第一格，未就绪时不能显示成假空态 */
const recentLoading = ref(false);
/** 最常用表情（横条）与深夜陪我的人（替代原「深夜动态」卡） */
const emojiTop = ref<EmojiCount[]>([]);
/** 表情横条同样先出结构：数据未到时显示加载占位，不整条缺席 */
const emojiLoading = ref(false);
/** 最常用的词：分词较重（30 万字 ~0.5s），空闲时再算，不挡首屏 */
const wordCloud = ref<WordCloudResult>({ docCount: 0, wordCount: 0, rows: [] });
const wordCloudLoading = ref(false);
/** 常驻地点（原始地名：深圳 / 茂名市高州市 / 深圳市宝安区…各自计次） */
const topLocations = ref<TopLocation[]>([]);
const locationLoading = ref(false);
/** 常驻城市（用内置全国市级地图按坐标归属算，不依赖腾讯 Key） */
const cityRows = ref<CityRow[]>([]);
const cityLoading = ref(false);
/** 断档统计：直接由已加载的月度聚合推导，零额外成本 */
const gapStats = computed(() => computeGaps(monthly.value));
const emojiTotal = ref(0);

// 空间资料：主流程只显示签名，完整字段进全局弹层
const profileRows = computed(() => buildSpaceProfileRows(props.user));
const signature = computed(() => profileRows.value.find((row) => row.label === '个性签名')?.value || '');

// 互动 Top5 / Hero 九宫格封面
const people = ref<TopPerson[]>([]);
/** 人榜（互动最多 / 在意的人）的加载态 */
const peopleLoading = ref(false);
/** 特别关心好友（本人空间才有；他人空间备份没有好友列表，恒为空） */
const carePeople = ref<CareFriend[]>([]);
/** 深夜对话（同一线程双方都在 0–5 点发过言）：他人空间里对象只有主人一个，故只用于本人空间 */
const nightDialogs = ref<NightDialog[]>([]);
const nightLoading = ref(false);
const coverPhotos = ref<CoverPhoto[]>([]);
const topMemories = ref<TopMemory[]>([]);
/** 回忆组（回忆之最 / 最初的记忆 / 深夜动态 / 最多点赞 / 最多评论）共用 */
const memoriesLoading = ref(true);
const rankings = ref<HomeRankings>({ night: [], first: [], likes: [], comments: [] });
const shareOpen = ref(false);
/** 分享卡的「回忆故事」素材：全部来自概览已有聚合，隐私模式由卡片内部处理 */
const shareExtras = computed(() => {
    const first = rankings.value.first[0];
    const measure: Record<string, string> = { 相片: '张', 日志: '篇', 留言: '条', 说说: '条', 分享: '条', 视频: '个' };
    // 最热闹的一年：yearStats 是「按模块」的年份分布（label=模块名，年份在 years map 里），
    // 直接取 label 会把模块名当年份——必须把所有模块的 years 累加后再取峰值
    const yearTotals = new Map<string, number>();
    for (const stat of yearStats.value) {
        for (const [year, n] of stat.years) {
            yearTotals.set(year, (yearTotals.get(year) ?? 0) + n);
        }
    }
    const peak = [...yearTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
        words: wordCounts.value?.total ?? 0,
        emojiTotal: emojiTotal.value,
        messages: Number(localCounts.value?.messages ?? 0),
        visitors: Number(localCounts.value?.visitors ?? 0),
        firstRecord: first && first.meta
            ? { label: first.label, measure: measure[first.label] ?? '条', date: first.meta }
            : undefined,
        peakYear: peak ? { year: peak[0], count: peak[1] } : undefined,
    };
});

function formatWan(n: number): string {
    return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万' : n.toLocaleString();
}

/** 人榜与特别关心共用一次全站聚合（loadInteractionSelection 内部已经算好两份名单） */
function loadPeople(u: Record<string, any> | null): void {
    peopleLoading.value = true;
    void loadInteractionSelection(u)
        .then((selection) => {
            people.value = selection.top;
            carePeople.value = selection.care;
        })
        .catch(() => {
            people.value = [];
            carePeople.value = [];
        })
        .finally(() => {
            peopleLoading.value = false;
        });
}

async function loadMemories(): Promise<void> {
    memoriesLoading.value = true;
    try {
        const data = await loadHomeMemories();
        topMemories.value = data.top;
    } catch {
        topMemories.value = [];
    }
    try {
        rankings.value = await loadHomeRankings();
    } catch {
        rankings.value = { night: [], first: [], likes: [], comments: [] };
    } finally {
        memoriesLoading.value = false;
    }
}

function onModuleSelect(key: string): void {
    navigate(key as any);
}

function onPersonSelect(uin: string): void {
    if (!uin) return;
    // 统一参数：qq = 对面那个人。本人空间看「我与 qq」，他人空间看「TA 与 qq」，
    // 语义由互动页按空间类型自行解释，不再按空间换参数名。
    navigate('interaction', { qq: uin });
}

function onOpenInteraction(): void {
    navigate('interaction');
}

/** 深夜对话卡「查看更多」→ 回忆清单的深夜面板（看具体是哪些内容） */
function onOpenNight(): void {
    navigate('memories', { type: 'night', from: 'home' });
}


/** 互动概览卡片：核心指标点击 → 跳转互动明细页并携带筛选参数（category + dir） */
/**
 * 概览互动卡里点某个动作 → 进互动页对应明细。
 * 他人空间要带 view=me：不指定查看对象的话，互动页会停在「选看谁」的入口态。
 */
function onStatCardClick(p: { category: string; dir: 'me' | 'ta' }): void {
    const q: Record<string, string> = {};
    if (p.category) q.category = p.category;
    if (p.dir) q.dir = p.dir;
    if (isOtherSpace.value) q.view = 'me';
    navigate('interaction', q);
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

/** 峰值年份（用于标题旁注） */
const peakYearLabel = computed(() => {
    const peak = [...yearChart.value].sort((a, b) => b.total - a.total)[0];
    return peak ? `${peak.year} · ${peak.total.toLocaleString()} 条` : '';
});

/** 时间里程碑：初识 / 最活跃 / 最近（按年份，不编造月份） */
const milestones = computed(() => {
    const sorted = [...yearChart.value].sort((a, b) => Number(a.year) - Number(b.year));
    const peak = [...yearChart.value].sort((a, b) => b.total - a.total)[0];
    return {
        first: sorted[0]?.year || '',
        peak: peak?.year || '',
        last: sorted[sorted.length - 1]?.year || '',
    };
});

/** 峰值年 Top3（年柱组件用来标 ★ / 高亮） */
const peakYears = computed(() => [...yearChart.value]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((item) => item.year));



/**
 * 月份分布：把「年 × 月」压成 12 个月份合计
 *
 * 首页只需要回答「你更常在几月发东西」，完整的年 × 月热力图收在本区块的折叠里，
 * 否则一张 15 行表会把首屏撑得又高又空。
 */
const monthBars = computed(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    for (const [key, count] of monthly.value.months) {
        const matched = /(\d{1,2})月$/.exec(key);
        const month = matched ? Number(matched[1]) : 0;
        if (month >= 1 && month <= 12) totals[month - 1] += count;
    }
    return totals.map((total, index) => ({ month: index + 1, total }));
});

/** 最活跃的月份（用于卡片旁注） */
const peakMonthLabel = computed(() => {
    const top = [...monthBars.value].sort((a, b) => b.total - a.total)[0];
    return top && top.total > 0 ? `${top.month} 月 · ${top.total.toLocaleString()} 条` : '';
});



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

    void loadCoverPhotos().then((rows) => { coverPhotos.value = rows; }).catch(() => { coverPhotos.value = []; });
    void loadMemories();
    loadingExtra.value = false;

    // 空闲时统计最常用的词：分词要几百毫秒，不抢首屏
    wordCloudLoading.value = true;
    const idle = (window as any).requestIdleCallback || ((fn: () => void) => window.setTimeout(fn, 200));
    idle(() => {
        loadWordCloud(12)
            .then((data) => { wordCloud.value = data; })
            .catch(() => { wordCloud.value = { docCount: 0, wordCount: 0, rows: [] }; })
            .finally(() => { wordCloudLoading.value = false; });

        // 常驻城市：懒加载全国市级地图（3.7MB）再按坐标归属，同样放空闲时做
        cityLoading.value = true;
        loadCityStats(5)
            .then((rows) => { cityRows.value = rows; })
            .catch(() => { cityRows.value = []; })
            .finally(() => { cityLoading.value = false; });

        // 常驻地点：与词条同一批空闲计算
        locationLoading.value = true;
        loadTopLocations(5)
            .then((locations) => {
                topLocations.value = locations;
            })
            .catch(() => {
                topLocations.value = [];
            })
            .finally(() => {
                locationLoading.value = false;
            });
    });
});

// 我与 TA 的互动看板：仅当备份属于「他人空间」（Owner ≠ Target）时才计算并展示。
// immediate 覆盖挂载前 user 已就绪的情况；后续 user 变化（如切换备份）也会重新计算。
watch(
    () => props.user,
    (u) => {
        if (!u) {
            ownerTarget.value = null;
            people.value = [];
            carePeople.value = [];
            nightDialogs.value = [];
            wordCounts.value = null;
            wordLoading.value = false;
            recentInteractions.value = [];
            emojiTop.value = [];
            emojiTotal.value = 0;
            emojiLoading.value = false;
            recentLoading.value = false;
            nightLoading.value = false;
            ownerLoading.value = false;
            peopleLoading.value = false;
            return;
        }
        loadPeople(u);
        ownerLoading.value = true;
        loadOwnerTargetInteraction(u)
            .then((stat) => {
                ownerTarget.value = stat;
            })
            .finally(() => {
                ownerLoading.value = false;
            });
        // 版式上「构成」与「互动」各要两张卡：字数构成两种空间都有，
        // 最近互动只在本人空间露脸（他人空间那一格换成「互动速览」）
        wordLoading.value = true;
        loadWordCounts()
            .then((wc) => { wordCounts.value = wc; })
            .catch(() => { wordCounts.value = null; })
            .finally(() => { wordLoading.value = false; });
        recentLoading.value = true;
        loadRecentInteractions(u)
            .then((rows) => { recentInteractions.value = rows; })
            .catch(() => { recentInteractions.value = []; })
            .finally(() => { recentLoading.value = false; });
        emojiLoading.value = true;
        loadEmojiStats()
            .then((s2) => { emojiTop.value = s2.rows; emojiTotal.value = s2.total; })
            .catch(() => { emojiTop.value = []; })
            .finally(() => { emojiLoading.value = false; });
        nightLoading.value = true;
        loadNightDialogs(u)
            .then((rows) => { nightDialogs.value = rows; })
            .catch(() => { nightDialogs.value = []; })
            .finally(() => { nightLoading.value = false; });
    },
    { immediate: true },
);
</script>

<template>
    <div class="page-body home-page">
        <div v-if="!user" class="page-alert">
            没有读到备份数据。请确认本页面位于备份目录的根目录文件夹内，且未把它单独移动到别处。
        </div>

        <template v-else>
            <home-hero
                :user="user"
                :time-range="timeRange"
                :total-items="totalItems"
                :media="media"
                :signature="signature"
                :cover-photos="coverPhotos"
                :likes="interaction.totalLikes"
                :comments="interaction.totalComments"
                :views="interaction.totalViews"
                :stats-loading="loadingExtra"
                @open-share="shareOpen = true"
            />
            <home-share-card-dialog
                :open="shareOpen"
                :extras="shareExtras"
                :user="user"
                :time-range="timeRange"
                :total-items="totalItems"
                :media="media"
                :signature="signature"
                :covers="coverPhotos"
                @close="shareOpen = false"
            />

            <home-timeline-strip :items="yearChart" :peak-years="peakYears" :milestones="milestones" :loading="loadingExtra">
                <div class="home-time-grid">
                    <div class="home-card">
                        <div class="home-card-title">
                            <span>年活跃度</span>
                            <span v-if="peakYearLabel" class="note">峰值 {{ peakYearLabel }}</span>
                        </div>
                        <home-year-chart v-if="yearChart.length > 0" :items="yearChart" :max-total="maxYearTotal" :peak-years="peakYears" />
                        <p v-else-if="loadingExtra" class="home-empty">正在统计…</p>
                        <p v-else class="home-empty">暂无年度数据</p>
                    </div>

                    <div class="home-card">
                        <div class="home-card-title">
                            <span>月份分布</span>
                            <span v-if="peakMonthLabel" class="note">最活跃 {{ peakMonthLabel }}</span>
                        </div>
                        <home-month-bars v-if="monthBars.some((m) => m.total > 0)" :months="monthBars" />
                        <p v-else-if="loadingExtra" class="home-empty">正在统计…</p>
                        <p v-else class="home-empty">暂无月度数据</p>
                    </div>
                </div>
            </home-timeline-strip>

            <section class="home-section">
                <div class="home-section-head">
                    <h2>回忆</h2>
                    <span class="note">那年今日 · 最初的记忆 · 回忆之最 · 断档</span>
                </div>
                <div class="home-grid-2">
                    <home-that-year-today />
                    <!-- 「最初的记忆」本质是回忆（空间起点），放在榜单里与「回忆之最」重复 -->
                    <home-list-card title="最初的记忆" note="各模块最早的记录" :items="rankings.first" more-type="first" empty-text="暂无记录" :loading="memoriesLoading" />
                    <home-top-memories :items="topMemories" :loading="memoriesLoading" />
                    <home-gap-card :stats="gapStats" :loading="memoriesLoading" />
                </div>
            </section>

            <section class="home-section">
                <div class="home-section-head">
                    <h2>榜单</h2>
                    <span class="note">时段 · 最多点赞 · 最多评论 · 常驻地点</span>
                </div>
                <div class="home-grid-2">
                    <home-list-card title="深夜动态" note="凌晨 0–5 点" :items="rankings.night" more-type="night" empty-text="暂无深夜动态" :loading="memoriesLoading" />
                    <home-list-card title="最多点赞" note="按赞数排序" :items="rankings.likes" more-type="likes" empty-text="暂无数据" :loading="memoriesLoading" />
                    <home-list-card title="最多评论" note="按评论数排序" :items="rankings.comments" more-type="comments" empty-text="暂无数据" :loading="memoriesLoading" />
                    <home-location-card
                        :rows="topLocations"
                        :city-rows="cityRows"
                        :loading="locationLoading"
                        :city-loading="cityLoading"
                    />
                </div>
            </section>

            <section class="home-section">
                <div class="home-section-head">
                    <h2>构成</h2>
                    <span class="note">按条数 · 按字数</span>
                </div>
                <div class="home-grid-2">
                    <home-composition :cards="cards" :total="totalItems" :loading="loadingExtra" @select="onModuleSelect" />
                    <home-word-composition
                        :rows="wordCounts?.rows ?? []"
                        :total="wordCounts?.total ?? 0"
                        :loading="wordLoading"
                        @select="onModuleSelect"
                    />
                </div>
                <home-emoji-strip :rows="emojiTop" :total="emojiTotal" :loading="emojiLoading" />
                <home-word-cloud
                    :data="wordCloud"
                    :loading="wordCloudLoading"
                    @search="(word: string) => emit('searchWord', word)"
                />
            </section>

            <section class="home-section">
                <div class="home-section-head">
                    <h2>互动</h2>
                    <span class="note">最近 · 在意的人 · 互动最多 · 深夜对话</span>
                </div>
                <div class="home-grid-2">
                    <home-interaction-card
                        v-if="ownerTarget"
                        :data="ownerTarget"
                        :target-sex="(props.user as any)?.sex"
                        @open="navigate('interaction', { view: 'me' })"
                        @open-others="navigate('interaction')"
                        @stat="onStatCardClick"
                    />
                    <home-recent-interactions v-else :items="recentInteractions" :loading="recentLoading || ownerLoading" @open="navigate('interaction')" />
                    <home-people-top :people="people" :loading="peopleLoading" @select="onPersonSelect" @open-all="onOpenInteraction" />
                    <!-- 特别关心独立成卡：只有本人空间有好友列表，他人空间不会渲染 -->
                    <home-care-card
                        v-if="carePeople.length || peopleLoading"
                        :care="carePeople"
                        :loading="peopleLoading"
                        @select="onPersonSelect"
                        @open-all="onOpenInteraction"
                    />
                    <!-- 深夜对话：只算「双方都在 0–5 点发过言」的线程 -->
                    <home-night-card
                        v-if="!isOtherSpace && (nightDialogs.length || nightLoading)"
                        :people="nightDialogs"
                        :loading="nightLoading"
                        @select="onPersonSelect"
                        @open-all="onOpenNight"
                    />
                </div>
            </section>


            <home-brand-bar />
        </template>
    </div>
</template>

<style scoped>
.page-alert {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--bg-tint-yellow);
    border: 1px solid #ffe58f;
    border-radius: 6px;
    color: #ad6800;
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

/* ========== P1: 月度热力图（月份为行、年份为列，列宽用 fr 自适应填满容器） ========== */
.heatmap {
    /* 已在 monthly-panel 外壳统一处理 margin，这里避免双重底部间距 */
    margin-bottom: 0;
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

/* ===== 空间概览 V2（第一批结构） ===== */
.home-section {
    margin-bottom: 32px;
}
/* 三组分区：不用编号，标题降级为「眉题 + 细线」，让卡片本身成为主角 */
.home-section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-card);
}
.home-section-head h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
}
.home-section-head .note {
    font-size: 11px;
    color: var(--text-muted);
}
/* 两栏一律均分：1.25:0.75 这种比例在卡片场景里只会让窄的一侧显得被挤扁 */
.home-time-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
}
.home-card {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.home-card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.home-card-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 500;
}
.home-card-title .note {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
}
.home-empty {
    margin: 0;
    padding: 6px 0 2px;
    font-size: 12px;
    color: var(--text-muted);
}
.home-card .heatmap {
    overflow-x: auto;
}
/* 里程碑并入区块标题行：既省掉卡片底部的一行，也避免左侧卡片留下大片空白 */
.interaction-line {
    display: flex;
    align-items: baseline;
    gap: 5px;
    flex-wrap: wrap;
    margin: -2px 0 14px;
    font-size: 12px;
    color: var(--text-secondary);
}

.interaction-line .sep {
    color: var(--border-dashed);
}
.interaction-line .info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1px solid var(--border-card);
    border-radius: 50%;
    font-size: 11px;
    line-height: 1;
    color: var(--text-muted);
    margin-left: 4px;
    cursor: help;
    vertical-align: middle;
}
/*
 * 分组栅格：列数必须**固定**，不能写 auto-fit ——
 * 内容区 1008px 时 auto-fit(minmax(360px)) 能塞 4 列，
 * 宽屏下互动组就从 2×2 变成 1×4 了（用户实测踩到）。
 */
.home-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* 卡片等高（默认 stretch）；内容少的卡内部自行吸收多余高度 */
    gap: 20px;
}
.home-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
}
@media (max-width: 1024px) {
    /* 注意是 minmax(0, 1fr)：写成 1fr 时 auto 最小值会被卡片里的
       nowrap 长文本撑到 600px+，回忆之页的卡片就会横向溢出、右边框看不见 */
    .home-time-grid,
    .home-grid-2,
    .home-grid-3 {
        grid-template-columns: minmax(0, 1fr);
    }
}

</style>