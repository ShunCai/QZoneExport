<script setup lang="ts">
import { computed } from 'vue';
import { NTag, NCollapse, NCollapseItem } from 'naive-ui';
import { formatTime } from '../data/format';
import { heShe } from '../data/pronoun';
import { usePrivacy } from '../composables/usePrivacy';
import { maskName, plainName } from '../data/mask';
import { formatNickname } from '../data/richText';
import type { OwnerTargetInteraction, InteractionEntry, InteractionCategory } from '../data/owner-target';
const { hidden: hideSensitive } = usePrivacy();
import MessageItem from './items/MessageItem.vue';
import ArticleItem from './items/ArticleItem.vue';
import BoardItem from './items/BoardItem.vue';

const props = defineProps<{
    data: OwnerTargetInteraction;
    showEntries?: boolean;
    showTrend?: boolean;
    /** 事件总数（用于互动明细页标题行展示），不传则不显示 */
    totalEvents?: number;
    /**
     * other = 查看他人空间备份（我 ↔ 空间主人）
     * self  = 本人备份 + 指定好友（好友 ↔ 我，统计口径反转）
     * guest = 他人空间备份 + 指定第三人（那个人 ↔ 空间主人）
     */
    mode?: 'other' | 'self' | 'guest';
    /** 被查看空间主人的性别（user.sex，1男 2女），用于把他人空间文案里的「TA」自动替换成他/她 */
    targetSex?: number | string;
    /** 当前被选中的核心指标卡片 key（由父组件根据筛选状态回传），用于点亮卡片形成「点卡片=选中」闭环 */
    activeStat?: 'boards' | 'comments' | 'replies' | 'likes' | null;
    /**
     * 区块开关（缺省即 true，向后兼容）。
     * 摘要条上位后，互动页的「统计详情」只保留「初见与重逢」与「互动频率趋势」，
     * 其余区块（4 指标 / 访问 / 时间轴）与摘要重复，可关。
     */
    parts?: Partial<{ head: boolean; stats: boolean; visits: boolean; timeline: boolean; entries: boolean; trend: boolean }>;
}>();

/** 卡片点击统一向上 emit，由父组件决定行为：
 *  - 在互动明细页内点击 → 父就地设置筛选（不跳页）
 *  - 在首页概览点击 → 父跳转到互动明细页/对应模块页并携带参数 */
const emit = defineEmits<{
    /** 核心指标卡片点击：携带动作类别（与统计同源）+ 方向，互动明细页据此精确筛选 */
    statClick: [payload: { category: InteractionCategory; dir: 'me' | 'ta' }];
    /** 访问卡片点击：携带目标模块页与浏览者 UIN */
    visitClick: [payload: { module: string; visitorUin: string }];
}>();

const d = computed(() => props.data);
/** 区块开关：未显式关闭的一律显示 */
function showPart(name: 'head' | 'stats' | 'visits' | 'timeline' | 'entries' | 'trend'): boolean {
    return props.parts?.[name] ?? true;
}
/** 独立卡模式（parts 显式传入）→ 内层折叠默认展开：外层已说明是什么，再收一层要点两次 */
const autoExpandCollapses = computed(() => props.parts !== undefined);
const isSelf = computed(() => props.mode === 'self');
/**
 * guest：看的是「空间里的某位访客 ↔ 空间主人」。
 * 此时主体（owner）是那位访客，客体（target）仍是空间主人——文案里的「对方」指访客，
 * 「他/她」指主人，与 self 模式的主客关系一致（都是 owner=对方、target=本人视角那一侧）。
 */
const isGuest = computed(() => props.mode === 'guest');
/** 主体是否为主人视角之外的「对方」：self 与 guest 都是 */
const subjectIsOther = computed(() => isSelf.value || isGuest.value);
/** 他人空间：按空间主人性别取代词（他/她），性别未知回退「TA」 */
const t = computed(() => heShe(props.targetSex));

/** 4 个核心指标标签：本人备份模式下主语互换（对方/我） */
const statLabels = computed(() => (subjectIsOther.value
    ? { boards: '对方留言', comments: '对方评论', replies: isSelf.value ? '我回应' : `${t.value}回应`, likes: '对方点赞' }
    : { boards: '我留言', comments: '我评论', replies: `${t.value}回应`, likes: '我点赞' }));
const statTitles = computed(() => {
    if (isSelf.value) {
        return {
            boards: '对方（好友）在你留言板留下的留言数',
            comments: '对方（好友）评论你的说说/日志数',
            replies: '你回复对方（好友）的留言/评论次数',
            likes: '对方（好友）点赞你的内容数',
        };
    }
    if (isGuest.value) {
        return {
            boards: `对方在${t.value}留言板留下的留言数`,
            comments: `对方评论${t.value}的说说/日志数`,
            replies: `${t.value}回复对方的留言/评论次数`,
            likes: `对方点赞${t.value}的说说数`,
        };
    }
    return {
        boards: `我在${t.value}留言板留下的留言数`,
        comments: `我评论${t.value}的说说/日志数`,
        replies: `${t.value}回复我的留言/评论次数`,
        likes: `我点赞${t.value}的说说数`,
    };
});

/** 标题与副标题：随模式切换主语 */
const titleText = computed(() => {
    if (isSelf.value) return '🤝 你与好友的互动';
    if (isGuest.value) return `🤝 对方与${t.value}的互动`;
    return `🤝 我与${t.value}的互动`;
});
const headerSub = computed(() => {
    const masked = hideSensitive.value;
    // 昵称里的 [em] 表情 token 与正文同一套转换；脱敏态先剥 token 再打码
    const nameHtml = (raw: unknown): string => {
        const plain = plainName(String(raw ?? ''));
        return formatNickname(masked ? maskName(plain) : plain);
    };
    const owner = nameHtml(d.value.ownerName);
    const target = nameHtml(d.value.targetName);
    if (isSelf.value) return `在你的空间里，${owner}（好友）与 你 的往来`;
    if (isGuest.value) return `在 ${target} 的空间里，${owner} 与${t.value}的往来`;
    return `在 ${target} 的空间里，我（${owner}）与${t.value}的往来`;
});

/** 我访问区：本人备份下变为「对方浏览过你的」 */
const visitsHeadText = computed(() => {
    if (isSelf.value) return '对方浏览过你的';
    if (isGuest.value) return `对方浏览过${t.value}的`;
    return `我浏览过${t.value}的`;
});
const visitsEmptyText = computed(() => {
    if (isSelf.value) {
        return '这份备份未捕捉到好友浏览你空间具体条目的记录（需各模块开启「最近访问」采集，且抓取时会话追踪到了好友）。';
    }
    const who = isGuest.value ? '对方' : '我';
    return `这份备份未捕捉到${who}浏览${t.value}空间具体条目的记录（需各模块开启「最近访问」采集，且抓取时会话追踪到了${who}）。`;
});

/** 双向交流 / 无记录空态：随模式切换主语 */
const conversationsTitle = computed(() => {
    if (isSelf.value) return '双方均有互动的会话数：好友参与且你回应过的内容线程';
    if (isGuest.value) return `双方均有互动的会话数：对方参与且${t.value}回应过的内容线程`;
    return `双方均有互动的会话数：我参与且${t.value}回应过我的内容线程`;
});

/** 回应率：分子分母随模式反转；分母为 0（无留言且无评论）时显示「—」 */
const rateText = computed(() => {
    const r = d.value.responseRate;
    if (r === null || r === undefined) return '—';
    return Math.round(r * 1000) / 10 + '%';
});
const rateTitle = computed(() => {
    if (isSelf.value) return '你回复好友的次数 ÷（好友给你的留言数 + 评论数）。点赞为单向行为，不计入分母。';
    const who = isGuest.value ? '对方' : '我';
    return `${t.value}回复${who}的次数 ÷（${who}给${t.value}的留言数 + 评论数）。点赞为单向行为，不计入分母。`;
});

const entriesEmptyText = computed(() => {
    if (isSelf.value) return '这份备份里没有捕捉到你与该好友的双向互动记录。';
    if (isGuest.value) return `这份备份里没有捕捉到对方与${t.value}的双向互动记录。`;
    return `这份备份里没有捕捉到我与${t.value}的双向互动记录。`;
});

/** 互动频率趋势里的最大月互动量（用于柱长比例） */
const maxMonthly = computed(() =>
    Math.max(1, ...d.value.monthly.map((m) => m.count)),
);

/** 时间轴填充百分比（有首末时间时按比例，否则默认60%） */
const tlFillPercent = computed(() => {
    const first = d.value.firstTime;
    const last = d.value.lastTime;
    if (!first || !last || first === 0 || last === 0) return 60;
    // 都有值时，用固定 75% 表示"从首次到最近的时间跨度已覆盖"
    return 75;
});

function pct(count: number): number {
    return Math.round((count / maxMonthly.value) * 1000) / 10;
}

function fmtDate(time: number | null): string {
    if (time === null || time === undefined || time === 0) return '—';
    return formatTime(time).slice(0, 10);
}

/** 首/末互动条目（带类型，用于按 type 分派渲染组件）；同一互动时 last 置空避免重复展示 */
const firstEntryItem = computed(() => d.value.firstEntry);
const lastEntryItem = computed(() =>
    d.value.lastEntry && d.value.lastEntry !== d.value.firstEntry ? d.value.lastEntry : null,
);
/** 是否有可展示的互动条目（首/末至少其一） */
const hasEntries = computed(() => !!(firstEntryItem.value || lastEntryItem.value));

/** 互动类型 → 中文标签 */
function kindLabel(type: string): string {
    if (type === 'message') return '说说';
    if (type === 'board') return '留言';
    if (type === 'blog') return '日志';
    if (type === 'share') return '分享';
    if (type === 'video') return '视频';
    if (type === 'photo') return '相片';
    if (type === 'album') return '相册';
    return type;
}

/** 紧凑卡片标题：用于 message/board/blog 之外的类型（点赞事件无专属 item 组件） */
function entryTitle(entry: InteractionEntry | null): string {
    if (!entry) return '';
    const it = entry.item || {};
    switch (entry.type) {
        case 'message': return (it.content || '').slice(0, 40) || '说说';
        case 'blog': return it.title || '日志';
        case 'board': return (it.content || '').slice(0, 40) || '留言';
        case 'share': return (it.content || it.title || '').slice(0, 40) || '分享';
        case 'video': return it.name || it.title || '视频';
        case 'photo': return it.name || it.desc || '相片';
        case 'album': return it.name || '相册';
        default: return '';
    }
}

/** 「我访问」按模块展示的单元格（始终展示全部 4 类，含 0） */
const VISIT_TYPES = [
    { key: 'message' as const, label: '说说' },
    { key: 'blog' as const, label: '日志' },
    { key: 'album' as const, label: '相册' },
    { key: 'share' as const, label: '分享' },
];
const visitCells = computed(() =>
    VISIT_TYPES.map((t) => ({ ...t, count: d.value.myVisitBreakdown[t.key] })),
);

/**
 * 核心指标卡片点击：emit 给父组件，由父决定就地筛选或跳转到互动明细页。
 * 映射固定为 (category, dir)，两种模式下语义一致（myBoards/myComments/myLikes 恒为 dir='me'，
 * taReplies 恒为 dir='ta'，与 computeOwnerTargetInteraction 的打标逻辑对齐，故不随 mode 翻转）：
 *   - 留言(board) / 评论(comment) / 点赞(like) → dir 'me'
 *   - 回应(reply) → dir 'ta'
 * 父组件按 (category, dir) 精确筛选，保证「点卡片 == 筛出的条数」与卡片数字同源。
 */
function onStatClick(statKey: 'boards' | 'comments' | 'replies' | 'likes'): void {
    const map: Record<string, { category: InteractionCategory; dir: 'me' | 'ta' }> = {
        boards:  { category: 'board', dir: 'me' },
        comments: { category: 'comment', dir: 'me' },
        replies: { category: 'reply', dir: 'ta' },
        likes:   { category: 'like', dir: 'me' },
    };
    emit('statClick', map[statKey]);
}

/** 访问卡片点击：emit 给父组件，由父跳转到对应模块页并携带浏览者 UIN */
function onVisitClick(moduleKey: 'message' | 'blog' | 'album' | 'share'): void {
    const routeMap: Record<string, string> = {
        message: 'messages',
        blog: 'blogs',
        album: 'albums',
        share: 'shares',
    };
    emit('visitClick', { module: routeMap[moduleKey] || 'home', visitorUin: d.value.ownerUin });
}
</script>

<template>
    <div class="oti-card">
        <div class="oti-head" v-if="showPart('head')">
            <span class="oti-title">{{ titleText }}</span>
            <span class="oti-sub" v-html="headerSub"></span>
            <span v-if="totalEvents != null" class="oti-total-badge">共 {{ totalEvents.toLocaleString() }} 条互动事件</span>
        </div>

        <!-- 核心指标：4 个动作维度（可点击跳转明细） -->
        <div class="oti-stats" v-if="showPart('stats')">
            <div class="oti-stat oti-stat-me oti-clickable" :class="{ 'oti-stat-active': activeStat === 'boards' }" :title="statTitles.boards" @click="onStatClick('boards')">
                <div class="oti-stat-value">{{ d.myBoards.toLocaleString() }}</div>
                <div class="oti-stat-label">{{ statLabels.boards }}</div>
            </div>
            <div class="oti-stat oti-stat-me oti-clickable" :class="{ 'oti-stat-active': activeStat === 'comments' }" :title="statTitles.comments" @click="onStatClick('comments')">
                <div class="oti-stat-value">{{ d.myComments.toLocaleString() }}</div>
                <div class="oti-stat-label">{{ statLabels.comments }}</div>
            </div>
            <div class="oti-stat oti-stat-ta oti-clickable" :class="{ 'oti-stat-active': activeStat === 'replies' }" :title="statTitles.replies" @click="onStatClick('replies')">
                <div class="oti-stat-value">{{ d.taReplies.toLocaleString() }}</div>
                <div class="oti-stat-label">{{ statLabels.replies }}</div>
            </div>
            <div class="oti-stat oti-stat-me oti-clickable" :class="{ 'oti-stat-active': activeStat === 'likes' }" :title="statTitles.likes" @click="onStatClick('likes')">
                <div class="oti-stat-value">{{ d.myLikes.toLocaleString() }}</div>
                <div class="oti-stat-label">{{ statLabels.likes }}</div>
            </div>
        </div>

        <!-- 我访问 TA 的各模块条目（数据来自各条目自身的浏览者名单 custom_visitor.list；4 个模块全部展示，含 0） -->
        <div class="oti-visits" v-if="showPart('visits') && d.enabled">
            <div class="oti-visits-head">
                <span>{{ visitsHeadText }}</span>
                <span class="oti-visits-total">共 {{ d.myVisits.toLocaleString() }} 条</span>
            </div>
            <div class="oti-visits-grid">
                <div
                    v-for="c in visitCells"
                    :key="c.key"
                    class="oti-visit oti-clickable"
                    :class="{ 'oti-visit-zero': c.count === 0 }"
                    :title="`查看浏览过的${c.label}列表`"
                    @click="onVisitClick(c.key)"
                >
                    <div class="oti-visit-value">{{ c.count.toLocaleString() }}</div>
                    <div class="oti-visit-label">{{ c.label }}</div>
                </div>
            </div>
            <div v-if="d.myVisits === 0" class="oti-visits-empty">
                {{ visitsEmptyText }}
            </div>
        </div>

        <!-- 双向交流概览：时间线风格 —— 轨道在上，首末节点在下，指标浮标居中 -->
        <div class="oti-summary" v-if="showPart('timeline')">
            <!-- 行1：时间轴 + 指标浮标（PC端横排，移动端纵排） -->
            <div class="tl-row-main">
                <div class="tl-node-dot tl-dot-first" />
                <div class="tl-track-wrap">
                    <div class="tl-track">
                        <div class="tl-track-fill" :style="{ width: tlFillPercent + '%' }" />
                    </div>
                    <div class="tl-badges">
                        <span class="tl-badge tl-badge-conv" :title="conversationsTitle">
                            <b>{{ d.conversations.toLocaleString() }}</b> 会话数
                        </span>
                        <span class="tl-badge tl-badge-rate" :title="rateTitle">
                            <b>{{ rateText }}</b> 回应率
                        </span>
                        <span class="tl-badge tl-badge-total" title="双方全部互动事件总数">
                            <b>{{ d.totalInteractions.toLocaleString() }}</b> 互动量
                        </span>
                    </div>
                </div>
                <div class="tl-node-dot tl-dot-last" />
            </div>
            <!-- 行2：首末时间节点（PC端左右分布，移动端全宽并排） -->
            <div class="tl-row-times">
                <div class="tl-time-card tl-time-first">
                    <span class="time-card-label">首次互动</span>
                    <span class="time-card-value">{{ fmtDate(d.firstTime) }}</span>
                </div>
                <div class="tl-time-card tl-time-last">
                    <span class="time-card-label">最近互动</span>
                    <span class="time-card-value">{{ fmtDate(d.lastTime) }}</span>
                </div>
            </div>
        </div>

        <!-- 初见与重逢：统一点赞最多面板风格（左边色条+背景+NCollapse默认收起） -->
        <div v-if="showEntries && showPart('entries') && hasEntries" class="oti-panel oti-panel-first">
            <n-collapse :default-expanded-names="autoExpandCollapses ? ['first-last'] : []">
                <n-collapse-item name="first-last">
                    <template #header>
                        <span class="panel-title">初见与重逢</span>
                        <span class="panel-note">我们最初的相遇与最近的问候</span>
                    </template>
            <div class="oti-entry" v-if="firstEntryItem">
                <div class="oti-entry-head">
                    <span class="oti-entry-badge first">首次互动</span>
                    <span class="oti-entry-time">{{ formatTime(firstEntryItem.time) }}</span>
                    <n-tag size="small" :bordered="false" type="info">{{ kindLabel(firstEntryItem.type) }}</n-tag>
                </div>
                <div class="oti-entry-body">
                    <message-item v-if="firstEntryItem.type === 'message'" :item="firstEntryItem.item" />
                    <article-item v-else-if="firstEntryItem.type === 'blog'" :item="firstEntryItem.item" config-key="Blogs" />
                    <board-item v-else-if="firstEntryItem.type === 'board'" :item="firstEntryItem.item" />
                    <div v-else class="oti-like-entry">
                        <span class="oti-like-entry-title">{{ entryTitle(firstEntryItem) }}</span>
                    </div>
                </div>
            </div>

            <div class="oti-entry" v-if="lastEntryItem">
                <div class="oti-entry-head">
                    <span class="oti-entry-badge last">最近互动</span>
                    <span class="oti-entry-time">{{ formatTime(lastEntryItem.time) }}</span>
                    <n-tag size="small" :bordered="false" type="warning">{{ kindLabel(lastEntryItem.type) }}</n-tag>
                </div>
                <div class="oti-entry-body">
                    <message-item v-if="lastEntryItem.type === 'message'" :item="lastEntryItem.item" />
                    <article-item v-else-if="lastEntryItem.type === 'blog'" :item="lastEntryItem.item" config-key="Blogs" />
                    <board-item v-else-if="lastEntryItem.type === 'board'" :item="lastEntryItem.item" />
                    <div v-else class="oti-like-entry">
                        <span class="oti-like-entry-title">{{ entryTitle(lastEntryItem) }}</span>
                    </div>
                </div>
            </div>
                </n-collapse-item>
            </n-collapse>
        </div>
        <n-empty v-else-if="showEntries" :description="entriesEmptyText" class="oti-entries-empty" />

        <!-- 互动频率趋势：统一点赞最多面板风格（左边色条+背景+NCollapse默认收起） -->
        <div class="oti-panel oti-panel-trend" v-if="showTrend && showPart('trend') && d.monthly.length > 0">
            <n-collapse :default-expanded-names="autoExpandCollapses ? ['trend'] : []">
                <n-collapse-item name="trend">
                    <template #header>
                        <span class="panel-title">互动频率趋势</span>
                        <span class="panel-note">共 {{ d.monthly.length }} 个月有互动</span>
                    </template>
            <div class="oti-trend-list">
                <div
                    v-for="m in d.monthly"
                    :key="m.key"
                    class="oti-trend-row"
                    :title="`${m.label}：${m.count} 次互动`"
                >
                    <span class="oti-trend-label">{{ m.label }}</span>
                    <div class="oti-trend-track">
                        <div class="oti-trend-fill" :style="{ width: pct(m.count) + '%' }" />
                    </div>
                    <span class="oti-trend-count">{{ m.count }}</span>
                </div>
            </div>
                </n-collapse-item>
            </n-collapse>
        </div>
    </div>
</template>

<style scoped>
.oti-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    padding: 14px 16px 16px;
    margin-bottom: 20px;
    box-sizing: border-box;
}
.oti-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}
.oti-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}
.oti-sub {
    font-size: 11px;
    color: var(--text-muted);
}
.oti-total-badge {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: #3370ff;
    background: var(--bg-tint-blue);
    padding: 2px 10px;
    border-radius: 10px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

/* 4 个动作维度 */
.oti-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 12px;
}
.oti-stat {
    text-align: center;
    padding: 10px 6px;
    border-radius: 6px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-card);
    transition: box-shadow 0.15s, transform 0.15s;
}
.oti-stat-me {
    background: var(--bg-tint-blue);
    border-color: var(--border-light);
}
.oti-stat-ta {
    background: var(--bg-tint-green);
    border-color: var(--border-light);
}
/** 可点击卡片：鼠标手型 + hover 发光上浮 */
.oti-clickable {
    cursor: pointer;
}
.oti-clickable:hover {
    box-shadow: 0 2px 10px rgba(51, 112, 255, 0.12);
    transform: translateY(-1px);
}
/** 被选中卡片：蓝色描边 + 光环，与下拉筛选联动，一眼看出「哪张卡片在驱动当前筛选」 */
.oti-stat-active {
    border-color: #3370ff;
    box-shadow: 0 0 0 2px rgba(51, 112, 255, 0.32);
    background: var(--bg-tint-blue);
}
.oti-stat-active .oti-stat-value {
    color: #2860e0;
}
.oti-stat-value {
    font-size: 20px;
    font-weight: 600;
    color: #3370ff;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
    line-height: 1.2;
}
.oti-stat-ta .oti-stat-value {
    color: #2080f0;
}
.oti-stat-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
}

/* 我访问 TA 的各模块条目 */
.oti-visits {
    padding: 12px 14px;
    background: var(--bg-tint-purple);
    border: 1px solid #efe8fb;
    border-radius: 8px;
    margin-bottom: 12px;
}
.oti-visits-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}
.oti-visits-head > span:first-child {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
}
.oti-visits-total {
    font-size: 12px;
    color: #8b5cf6;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.oti-visits-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}
.oti-visit {
    text-align: center;
    padding: 8px 4px;
    border-radius: 6px;
    background: var(--bg-primary);
    border: 1px solid #f0ebfa;
}
.oti-visit-zero {
    background: var(--bg-primary);
    border-color: var(--border-light);
}
.oti-visit-value {
    font-size: 18px;
    font-weight: 600;
    color: #8b5cf6;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
}
.oti-visit-zero .oti-visit-value {
    color: var(--text-subtle);
}
.oti-visit-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
}
.oti-visits-empty {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-subtle);
    line-height: 1.5;
}

/* 双向交流概览：时间线风格 —— 两行布局（上行轨道+浮标，下行首末节点） */
.oti-summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 18px;
    background: var(--bg-toolbar);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    margin-bottom: 12px;
}

/* ===== 行1：轨道 + 指标浮标 ===== */
.tl-row-main {
    display: flex;
    align-items: center;
    gap: 0;
}
/* 两端圆点标记 */
.tl-node-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.tl-dot-first { background: #1a4d99; }
.tl-dot-last { background: #993C1D; }

/* 中间轨道区域 */
.tl-track-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 4px;
}
.tl-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-toolbar);
    overflow: hidden;
}
.tl-track-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #85B7EB, #378ADD);
    transition: width 0.5s ease;
}

/* 指标浮标：完整文字标签（值 + 单位） */
.tl-badges {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
}
.tl-badge {
    font-size: 12px;
    font-weight: 400;
    padding: 3px 12px;
    border-radius: 12px;
    white-space: nowrap;
    border: 1px solid;
    line-height: 1.4;
}
.tl-badge b {
    font-weight: 600;
}
.tl-badge-conv {
    color: #185FA5;
    background: var(--bg-tint-blue);
    border-color: #b5d4f4;
}
.tl-badge-rate {
    color: #854F0B;
    background: var(--bg-tint-yellow);
    border-color: #efc775;
}
.tl-badge-total {
    color: var(--text-secondary);
    background: var(--bg-toolbar);
    border-color: var(--border-toolbar);
}

/* ===== 行2：首末时间节点卡片（PC端左右分布） ===== */
.tl-row-times {
    display: flex;
    justify-content: space-between;
    gap: 16px;
}
.tl-time-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid;
    flex: 1;
    max-width: 220px;
}
.time-card-label {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.time-card-value {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
}
.tl-time-first {
    background: var(--bg-tint-green);
    border-color: #d3e5fd;
}
.tl-time-first .time-card-value { color: #1a4d99; }
.tl-time-last {
    background: var(--bg-tint-red);
    border-color: #f0cbb5;
    justify-content: flex-end; /* 文字靠右，视觉上对应右端点 */
}
.tl-time-last .time-card-value { color: #993C1D; }
.tl-time-last .time-card-label { order: 1; }
.tl-time-last .time-card-value { order: 0; }

/* === 初见与重逢 / 互动频率趋势：统一点赞最多面板风格 === */
.oti-panel {
    margin-bottom: 12px;
    padding: 8px 16px;
    border-left: 3px solid #3370ff;
    border-radius: 2px;
}
.oti-panel-first {
    background: var(--bg-tint-blue);
}
.oti-panel-trend {
    background: var(--bg-tint-green);
    border-left-color: #2080f0;
}
.panel-title {
    font-size: 15px;
    font-weight: 600;
}
.panel-note {
    margin-left: 10px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-muted);
}

/* 互动频率趋势 */
.oti-trend-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.oti-trend-row {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 36px;
    align-items: center;
    gap: 10px;
}
.oti-trend-label {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.oti-trend-track {
    height: 12px;
    border-radius: 3px;
    background: var(--bg-toolbar);
    overflow: hidden;
    min-width: 0;
}
.oti-trend-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #3370ffdd 0%, #3370ff 100%);
    transition: width 0.4s;
    min-width: 2px;
}
.oti-trend-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.oti-empty {
    padding: 18px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--bg-toolbar);
    border: 1px dashed var(--border-hover);
    border-radius: 4px;
}

.oti-like-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-toolbar);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}
.oti-like-entry-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.oti-entry {
    background: var(--bg-toolbar);
    border: 1px solid var(--border-card);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
}
.oti-entry:last-child {
    margin-bottom: 0;
}
.oti-entry-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}
.oti-entry-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 10px;
    color: #fff;
}
.oti-entry-badge.first {
    background: #2080f0;
}
.oti-entry-badge.last {
    background: #f0a020;
}
.oti-entry-time {
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.oti-entry-body {
    font-size: 13px;
    line-height: 1.6;
}
.oti-entry-body :deep(.qm-card),
.oti-entry-body :deep(.media-card),
.oti-entry-body :deep(.article-item) {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 4px;
}
.oti-entries-empty {
    margin-top: 14px;
}

/* 移动端：4 → 2 列，时间线纵向堆叠 */
@media (max-width: 580px) {
    .oti-stats {
        grid-template-columns: repeat(2, 1fr);
    }
    /* 时间线：轨道保持横排，首末节点全宽并排 */
    .oti-summary {
        gap: 10px;
        padding: 12px 14px;
    }
    .tl-row-main {
        gap: 0;
    }
    .tl-node-dot {
        width: 8px;
        height: 8px;
    }
    .tl-badges {
        gap: 6px;
    }
    .tl-badge {
        font-size: 11px;
        padding: 2px 8px;
    }
    /* 首末节点：移动端并排等分，紧凑化 */
    .tl-row-times {
        gap: 10px;
    }
    .tl-time-card {
        max-width: none;
        flex: 1;
        padding: 6px 10px;
    }
    .time-card-label {
        font-size: 11px;
    }
    .time-card-value {
        font-size: 12px;
    }
    .trend-row {
        grid-template-columns: 72px minmax(0, 1fr) 32px;
    }
}
</style>
