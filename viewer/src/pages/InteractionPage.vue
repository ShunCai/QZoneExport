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
import { loadInteractionSelection, type CareFriend, type TopPerson } from '../data/top-people';
import { usePrivacy } from '../composables/usePrivacy';
import { maskName, plainName } from '../data/mask';
import { formatNickname } from '../data/richText';
import { summaryOf } from '../data/summary';
import PrivacyToggle from '../components/PrivacyToggle.vue';
import OwnerTargetInteraction from '../components/OwnerTargetInteraction.vue';
import MessageItem from '../components/items/MessageItem.vue';
import ArticleItem from '../components/items/ArticleItem.vue';
import BoardItem from '../components/items/BoardItem.vue';
import UserAvatar from '../components/UserAvatar.vue';

const props = defineProps<{
    user: Record<string, any> | null;
}>();

/** 入口态的「互动最多的人」：全站聚合，点击直接带入好友 QQ 号，省去手输 */
const topPeople = ref<TopPerson[]>([]);
/**
 * 「特别关心」好友（来自好友列表，与互动量无关）。
 * 单独成组而不是混进 TOP5：关心是「我在意谁」，互动是「谁留痕多」，
 * 实测关心好友常排在全站几十名开外，加长榜单也进不来。
 */
const careFriends = ref<CareFriend[]>([]);
/** 超出上限未列出的关心好友数 */
const careHidden = ref(0);
/** 关心好友的 uin 全集：TOP5 里若正好是关心好友，挂个「关心」标签 */
const careUins = ref<Set<string>>(new Set());
function chooseFriend(p: { uin: string }): void {
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
/** 他人空间无数据时的说明：主语跟随空间主人的性别（他/她） */
const emptyText = computed(() => (isGuestView.value
    ? `未找到${t.value}与这个人的互动记录，可能对方从未在${t.value}空间留下评论、留言或点赞。`
    : `未找到你与${t.value}的互动记录。`));

/** 好友信息条里的名字（HTML）：处理 [em] token 与脱敏 */
const friendNameHtml = computed(() => {
    const plain = plainName(String(data.value?.ownerName || confirmedFriend.value || ''));
    return formatNickname(hideSensitive.value ? maskName(plain) : plain);
});

/** 展示名（HTML）：昵称里可能内嵌 `[em]` 表情 token，与正文同一套转换 */
function nameHtml(name: unknown, uin: unknown): string {
    const label = hideSensitive.value
        ? maskName(plainName(String(name ?? ''))) || String(uin ?? '')
        : (name || uin || '未署名');
    return formatNickname(String(label));
}

/** 关心好友行提示：分数为 0 时说明对方确实没留下痕迹，而不是数据缺失 */
function careTooltip(c: CareFriend): string {
    if (!c.score) return '未在你的空间留下评论或点赞';
    return `赞 ${c.likes} · 评论 ${c.comments}`;
}
// user 由 App.vue 异步加载，用 immediate watch 覆盖挂载前后两种情况
watch(() => props.user, async (u) => {
    const selection = await loadInteractionSelection(u);
    topPeople.value = selection.top;
    careFriends.value = selection.care;
    careHidden.value = selection.careHidden;
    careUins.value = selection.careUins;
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

/**
 * 他人空间的「查看对象」：
 * - null   → 入口态（还没选）
 * - 'me'   → 我 ↔ TA（备份操作者与空间主人）
 * - 其他串  → 该 QQ ↔ TA（空间里的某位访客与空间主人）
 *
 * 数据层只认 (owner, target) 一对，所以「TA 与某人」就是把 owner 传成那个人的 uin、
 * target 仍是空间主人 —— computeOwnerTargetInteraction 本来就是任意一对，无需改聚合逻辑。
 */
const otherPick = ref<string | null>(null);
const guestInput = ref('');
const guestError = ref('');

const inEntry = computed(() => (isSelfMode.value ? !confirmedFriend.value : !otherPick.value));
/** 是否在看「TA 与某人」（而非「我与 TA」） */
const isGuestView = computed(() => !isSelfMode.value && !!otherPick.value && otherPick.value !== 'me');
/** 主面板模式：他人空间下再分 other / guest */
const interactionMode = computed<'self' | 'other' | 'guest'>(() => {
    if (isSelfMode.value) return 'self';
    return isGuestView.value ? 'guest' : 'other';
});

/** 他人空间：看「我 ↔ TA」 */
function pickMe(): void {
    otherPick.value = 'me';
    guestError.value = '';
    page.value = 1;
    navigate('interaction', { view: 'me' });
    reload();
}

/** 他人空间：看「TA ↔ 某人」。uin 由 TOP5 直传，或取输入框 */
function pickGuest(uin?: string): void {
    const v = String(uin ?? guestInput.value).trim();
    if (!v) { guestError.value = '请输入对方 QQ 号'; return; }
    if (!/^\d{4,15}$/.test(v)) { guestError.value = 'QQ 号应为 4–15 位数字'; return; }
    if (String(v) === String(props.user?.uin)) { guestError.value = '这是空间主人本人的 QQ 号'; return; }
    guestError.value = '';
    otherPick.value = v;
    page.value = 1;
    navigate('interaction', { qq: v });
    reload();
}

function resetPick(): void {
    otherPick.value = null;
    guestInput.value = '';
    data.value = null;
    // 清掉 ?uin / ?view，否则刷新会又跳回刚才那个人
    navigate('interaction');
}

/** 他人空间：按空间主人性别取代词（他/她），性别未知回退「TA」 */
const t = computed(() => heShe(props.user?.sex));

/** 空间主人展示名（脱敏感知）：入口态文案与结果态信息条共用 */
const ownerName = computed(() => {
    const plain = plainName(String(props.user?.nickname || props.user?.spacename || ''));
    return (hideSensitive.value ? maskName(plain) : plain) || 'TA';
});

/** 空间主人展示名（HTML）：摘要条与 guest 视图共用 */
const targetNameHtml = computed(() => {
    const raw = data.value?.targetName || props.user?.nickname || props.user?.spacename || '';
    const plain = plainName(String(raw));
    return formatNickname(hideSensitive.value ? maskName(plain) : plain);
});

/** 「TA 与某人」里那个人的名字：优先用聚合结果里抓到的昵称，加载中先显示 QQ */
const guestNameHtml = computed(() => {
    const raw = data.value?.ownerName || otherPick.value || '';
    const plain = plainName(String(raw));
    return formatNickname(hideSensitive.value ? maskName(plain) : plain);
});

/** 方向文案随模式反转：本人备份下「me=对方主动 / ta=我回应」；他人空间按空间主人性别取代词 */
function dirLabel(dir: 'me' | 'ta'): string {
    if (isSelfMode.value) return dir === 'me' ? '对方主动' : '我回应';
    // guest：主体是那位访客（对方），客体是空间主人
    if (isGuestView.value) return dir === 'me' ? '对方主动' : `${t.value}回应`;
    return dir === 'me' ? '我主动' : `${t.value}回应`;
}

const dirOptions = computed(() => [
    { value: 'all', label: '全部' },
    { value: 'me', label: dirLabel('me') },
    { value: 'ta', label: dirLabel('ta') },
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

const SUMMARY_KEY: Record<string, string> = {
    message: 'messages',
    board: 'boards',
    blog: 'blogs',
    share: 'shares',
    video: 'videos',
    photo: 'photos',
    album: 'albums',
};
const KIND_FALLBACK: Record<string, string> = { blog: '日志', board: '留言', message: '说说' };

/**
 * 紧凑行的摘要：走 summaryOf 统一口径（剥 [em]/[img] token、纯表情给「表情 × N」），
 * 不能直接 slice 原文——紧凑行会把 `[em]e402[/em]` 这类 token 直接暴露出来。
 */
function entryTitle(entry: InteractionEntry): string {
    const it = entry.item || {};
    // 注意：entry.type 是单数（message/board/blog…），summaryOf 吃的是复数 DataKey
    const key = SUMMARY_KEY[entry.type] ?? 'messages';
    const text = summaryOf(key, it, 60);
    if (text && text !== '无内容') return text;
    return it.title || it.name || KIND_FALLBACK[entry.type] || '';
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

/** 各类别条数（基于全量事件，用于筛选 chips 的数字） */
const categoryCounts = computed(() => {
    const base: Record<string, number> = { board: 0, comment: 0, reply: 0, like: 0 };
    for (const e of data.value?.events ?? []) {
        base[e.category] = (base[e.category] ?? 0) + 1;
    }
    return base;
});

/** 时间线按年月分组：长列表需要锚点，同月不再重复显示月份 */
const groupedEvents = computed(() => {
    const groups: { key: string; rows: { e: InteractionEntry; i: number }[] }[] = [];
    paged.value.forEach((e, i) => {
        const key = formatTime(e.time).slice(0, 7) || '未知时间';
        let group = groups[groups.length - 1];
        if (!group || group.key !== key) {
            group = { key, rows: [] };
            groups.push(group);
        }
        group.rows.push({ e, i });
    });
    return groups;
});

/** 就地展开的行（按当前页索引；翻页后自然失效） */
/** 「更多筛选」展开状态：展开行走正常文档流，避免悬浮小窗遮挡 */
const moreFilterOpen = ref(false);
const expandedRows = ref<Set<number>>(new Set());
function toggleRow(i: number): void {
    const next = new Set(expandedRows.value);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    expandedRows.value = next;
}
// 翻页/换筛选后收起所有展开行，避免索引错位
watch([page, filterType, filterCategory, filterDir], () => { expandedRows.value = new Set(); });

/**
 * 这条互动的「谁」：
 * - self（我与好友）      ：me=好友名 / ta=我
 * - other（我与空间主人）  ：me=我 / ta=空间主人名
 * - guest（访客与空间主人）：me=访客名 / ta=空间主人名
 * guest 口径极易写错——「我主动」在这里指的是那位访客，不是备份操作者。
 */
function whoOf(e: InteractionEntry): string {
    if (!data.value) return '';
    if (isSelfMode.value) {
        return e.dir === 'me' ? String(data.value.ownerName || '对方') : '我';
    }
    if (isGuestView.value) {
        return e.dir === 'me' ? String(data.value.ownerName || '') : String(data.value.targetName || '');
    }
    return e.dir === 'me' ? '我' : String(data.value.targetName || '');
}

/** 头像对应的 uin：我主动→owner（好友/访客），TA 回应→空间主人 */
function avatarUin(e: InteractionEntry): string {
    if (!data.value) return '';
    return String(e.dir === 'me' ? data.value.ownerUin : data.value.targetUin ?? '');
}

function whoHtml(e: InteractionEntry): string {
    const name = whoOf(e);
    // 「我」不脱敏；对方名字在隐私态打码
    if (e.dir === 'ta' && isSelfMode.value) return formatNickname('我');
    if (hideSensitive.value) {
        return formatNickname(maskName(plainName(name)) || '匿名');
    }
    return formatNickname(name);
}

function actionText(e: InteractionEntry): string {
    switch (e.category) {
        case 'comment': return '评论了说说';
        case 'reply': return '回复了';
        case 'like': return '点赞了';
        case 'board': return '留言了';
        default: return '互动了';
    }
}

/** 摘要条的人称：我发起 / TA 回应（他人空间按空间主人性别） */
function dirShort(dir: 'me' | 'ta'): string {
    if (isSelfMode.value) return dir === 'me' ? '对方主动' : '我回应';
    if (isGuestView.value) return dir === 'me' ? '对方主动' : `${t.value}回应`;
    return dir === 'me' ? '我主动' : `${t.value}回应`;
}
const spanText = computed(() => {
    const first = data.value?.firstTime ? formatTime(data.value.firstTime).slice(0, 7) : '';
    const last = data.value?.lastTime ? formatTime(data.value.lastTime).slice(0, 7) : '';
    if (!first && !last) return '';
    return first === last ? `最近 ${last}` : `${first} → ${last}`;
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
    // 他人空间：没选查看对象时停在入口态
    if (!otherPick.value) {
        data.value = null;
        loading.value = false;
        return;
    }
    const opts = otherPick.value === 'me' ? undefined : { ownerUin: otherPick.value };
    loading.value = true;
    loadOwnerTargetInteraction(props.user, opts)
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
    // ?qq=对面那个人：本人空间 → 我与他；他人空间 → TA 与他。
    // ?uin= 作为旧链接别名保留（语义同 qq）。
    const person = routeQuery.value.qq || routeQuery.value.uin || '';
    if (!isSelfMode.value) {
        if (person && /^\d{4,15}$/.test(person) && String(person) !== String(props.user?.uin)) {
            otherPick.value = person;
        } else if (routeQuery.value.view === 'me') {
            otherPick.value = 'me';
        }
    }
    // 从 URL 恢复筛选参数（统计卡片点击跳转时携带 type/dir）
    initFiltersFromQuery();
    reload();
});
watch(() => props.user, () => {
    page.value = 1;
    confirmedFriend.value = null;
    friendInput.value = '';
    otherPick.value = null;
    guestInput.value = '';
    reload();
});
/**
 * 同一页面内 hash 变化不会重新挂载组件（概览两个入口互相切换、或手动改 #/interaction?uin=），
 * 这里把查询参数同步到查看对象上。用值比对做闸门，避免我们自己 navigate 时形成循环。
 */
watch(() => routeQuery.value, (q) => {
    if (!isSelfMode.value) {
        const person = (q.qq || q.uin || '') && /^\d{4,15}$/.test(q.qq || q.uin) && String(q.qq || q.uin) !== String(props.user?.uin) ? (q.qq || q.uin) : '';
        const next = person || (q.view === 'me' ? 'me' : '');
        if (next && next !== otherPick.value) {
            otherPick.value = next;
            page.value = 1;
            reload();
        }
        return;
    }
    const qq = q.qq && /^\d{4,15}$/.test(q.qq) ? q.qq : '';
    if (qq && qq !== confirmedFriend.value) {
        friendInput.value = qq;
        confirmedFriend.value = qq;
        page.value = 1;
        reload();
    }
}, { deep: true });
// 切换筛选条件时回到第一页，避免停留在越界的页码
watch([filterType, filterCategory, filterDir], () => { page.value = 1; });
// 筛选结果变化时重放计数脉冲动画（pulseKey 改变 → span 重挂 → CSS 动画重放）
watch(filtered, () => { pulseKey.value++; });
</script>

<template>
    <div class="ip-page" :class="{ 'ip-page-centered': inEntry }">
        <!-- 本人备份：先输入待查看互动的好友 QQ 号 -->
        <div v-if="isSelfMode && !confirmedFriend" class="ip-friend-input">
            <h3 class="ip-fi-title">查看与好友的互动</h3>
            <p class="ip-fi-desc">请输入要查看互动的好友 QQ 号，确认后将统计对方在你空间留下的评论、留言、点赞等往来。</p>

            <!-- 互动最多的人：点击直接带入 QQ 号，避免「不知道该查谁」 -->
            <div v-if="topPeople.length || careFriends.length" class="ip-fi-top">
                <div class="ip-fi-top-title">
                    <span v-if="topPeople.length">互动 TOP5 <em>（点击直接查看）</em></span>
                    <span v-else>特别关心 <em>（点击直接查看）</em></span>
                    <privacy-toggle />
                </div>
                <template v-if="topPeople.length">
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
                            <span class="ip-fi-name" v-html="nameHtml(p.name, p.uin)"></span>
                            <!-- 附灰色 QQ 号：昵称可能与他人（含自己的小号）重名，仅靠昵称无法区分 -->
                            <span v-if="!hideSensitive && p.uin" class="ip-fi-uin">{{ p.uin }}</span>
                            <span v-if="careUins.has(p.uin)" class="ip-fi-tag">关心</span>
                        </span>
                        <span class="ip-fi-count">{{ p.score }} 次</span>
                    </button>
                    <div v-if="topPeople.some((p) => !p.uin)" class="ip-fi-top-hint">未署名记录缺少 QQ 号，无法直接跳转</div>
                </template>

                <!-- 特别关心：独立分组、不参与排名（不带序号），语义是「你在意谁」而非「谁最活跃」 -->
                <div v-if="careFriends.length" class="ip-fi-care" :class="{ 'ip-fi-care-alone': !topPeople.length }">
                    <div class="ip-fi-care-title">
                        <span>特别关心 <em>· {{ careFriends.length }} 位</em></span>
                    </div>
                    <button
                        v-for="c in careFriends"
                        :key="c.key"
                        type="button"
                        class="ip-fi-person ip-fi-person-care"
                        :title="careTooltip(c)"
                        @click="chooseFriend(c)"
                    >
                        <span class="ip-fi-person-main">
                            <span class="ip-fi-name" v-html="nameHtml(c.name, c.uin)"></span>
                            <span v-if="!hideSensitive" class="ip-fi-uin">{{ c.uin }}</span>
                        </span>
                        <span class="ip-fi-count">{{ c.score ? `${c.score} 次` : '暂无互动' }}</span>
                    </button>
                    <div v-if="careHidden > 0" class="ip-fi-top-hint">还有 {{ careHidden }} 位特别关心好友未列出</div>
                </div>
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

        <!-- 他人空间：先选看「谁与 TA」的互动 -->
        <div v-else-if="!isSelfMode && !otherPick" class="ip-friend-input ip-friend-input-wide">
            <h3 class="ip-fi-title">查看互动</h3>
            <p class="ip-fi-desc">
                这份备份是「{{ ownerName }}」的空间。可以看你在{{ t }}空间留下的痕迹，也可以看{{ t }}与某个人的往来。
            </p>

            <div class="ip-pick-grid">
                <button type="button" class="ip-pick-card ip-pick-primary" @click="pickMe()">
                    <span class="ip-pick-title">我 与 {{ ownerName }}</span>
                    <span class="ip-pick-desc">我在{{ t }}空间的留言、评论、点赞，以及{{ t }}对我的回应</span>
                    <span class="ip-pick-go">查看 →</span>
                </button>
                <div class="ip-pick-card">
                    <span class="ip-pick-title">{{ ownerName }} 与 某人</span>
                    <span class="ip-pick-desc">选一个人，看{{ t }}与这个人的往来</span>
                    <div class="ip-fi-row">
                        <input
                            class="ip-fi-input"
                            v-model="guestInput"
                            type="text"
                            inputmode="numeric"
                            placeholder="对方 QQ 号"
                            @keyup.enter="pickGuest()"
                        />
                        <button class="ip-fi-btn" type="button" @click="pickGuest()">查看</button>
                    </div>
                </div>
            </div>
            <div v-if="guestError" class="ip-fi-error">{{ guestError }}</div>

            <!-- TA 互动最多的人：点击直接落「TA 与 TA 的往来」 -->
            <div v-if="topPeople.length" class="ip-fi-top">
                <div class="ip-fi-top-title">
                    <span>{{ t }}互动最多的人 <em>（点击直接查看）</em></span>
                    <privacy-toggle />
                </div>
                <button
                    v-for="(p, i) in topPeople"
                    :key="p.key"
                    type="button"
                    class="ip-fi-person"
                    :disabled="!p.uin"
                    :title="personTooltip(p)"
                    @click="pickGuest(p.uin)"
                >
                    <span class="ip-fi-rank">{{ i + 1 }}</span>
                    <span class="ip-fi-person-main">
                        <span class="ip-fi-name" v-html="nameHtml(p.name, p.uin)"></span>
                        <span v-if="!hideSensitive && p.uin" class="ip-fi-uin">{{ p.uin }}</span>
                    </span>
                    <span class="ip-fi-count">{{ p.score }} 次</span>
                </button>
                <div v-if="topPeople.some((p) => !p.uin)" class="ip-fi-top-hint">未署名记录缺少 QQ 号，无法直接跳转</div>
            </div>
        </div>

        <div v-else-if="loading" class="ip-loading"><n-spin size="large" /></div>

        <n-empty
            v-else-if="!data && isSelfMode && confirmedFriend"
            description="未找到你与该好友的互动记录，可能对方未在你的空间留下评论、留言或点赞。"
            class="ip-empty"
        />
        <n-empty v-else-if="!data && !isSelfMode" :description="emptyText" class="ip-empty" />

        <div v-else-if="data" class="ip-body">
            <!-- 吸顶摘要：只有「和谁、多少、多久」，其余交给下面的时间线 -->
            <div class="ip-summary">
                <div class="ip-sum-line">
                    <span v-if="isSelfMode" class="ip-sum-who">与 <b v-html="friendNameHtml"></b> 的互动</span>
                    <span v-else-if="!isGuestView" class="ip-sum-who">与 <b v-html="targetNameHtml"></b> 的互动</span>
                    <span v-else class="ip-sum-who">
                        <b v-html="guestNameHtml"></b> 与 <b v-html="targetNameHtml"></b>
                    </span>
                    <span class="ip-sum-meta">
                        共 {{ data.totalInteractions.toLocaleString() }} 次互动<template v-if="spanText"> · {{ spanText }}</template>
                    </span>
                    <button
                        class="ip-fi-btn ip-fi-btn-sm"
                        type="button"
                        @click="isSelfMode ? (resetFriend(), reload()) : (resetPick(), reload())"
                    >
                        {{ isSelfMode ? '换个好友' : '换个对象' }}
                    </button>
                </div>
                <div class="ip-sum-stats">
                    <span>留言 <b>{{ data.myBoards.toLocaleString() }}</b></span>
                    <span>评论 <b>{{ data.myComments.toLocaleString() }}</b></span>
                    <span>{{ t }}回应 <b>{{ data.taReplies.toLocaleString() }}</b></span>
                    <span>点赞 <b>{{ data.myLikes.toLocaleString() }}</b></span>
                    <span v-if="data.myVisits > 0" class="ip-sum-quiet">我浏览过{{ t }}的 {{ data.myVisits.toLocaleString() }} 条</span>
                    <span class="ip-sum-quiet">回应率 {{ data.responseRate === null ? '—' : Math.round(data.responseRate * 1000) / 10 + '%' }}</span>
                </div>
            </div>

            <!-- 统计详情：一张外卡，里面两张小卡（与概览时间轴的嵌套方式相同）。
                 不做折叠——吸顶摘要已在最上面，这里直接展示，需要滚一点但层级最浅 -->
            <details class="ip-stats-card">
                <summary class="ip-stats-summary">
                    <span class="ip-stats-title">统计详情</span>
                    <span class="ip-stats-note">初见与重逢 · 互动频率趋势</span>
                    <span class="ip-stats-caret">▸</span>
                </summary>
                <div class="ip-stat-grid">
                    <div class="ip-mini-card">
                        <div class="ip-mini-head">
                            <span class="ip-mini-title">初见与重逢</span>
                            <span class="ip-mini-note">我们最初的相遇与最近的问候</span>
                        </div>
                        <div class="ip-mini-body">
                            <owner-target-interaction
                                :data="data"
                                :mode="interactionMode"
                                :target-sex="props.user?.sex"
                                :show-entries="true"
                                :parts="{ head: false, stats: false, visits: false, timeline: false, trend: false }"
                                :active-stat="activeStat"
                                @stat-click="applyStatFilter"
                            />
                        </div>
                    </div>
                    <div class="ip-mini-card">
                        <div class="ip-mini-head">
                            <span class="ip-mini-title">互动频率趋势</span>
                            <span class="ip-mini-note">按月互动量</span>
                        </div>
                        <div class="ip-mini-body">
                            <owner-target-interaction
                                :data="data"
                                :mode="interactionMode"
                                :target-sex="props.user?.sex"
                                :show-trend="true"
                                :parts="{ head: false, stats: false, visits: false, timeline: false, entries: false }"
                            />
                        </div>
                    </div>
                </div>
            </details>

            <!-- 筛选：类别做成 chips（带条数），结构性筛选收进「更多」 -->
            <div class="ip-filter">
                <button
                    type="button"
                    class="ip-chip"
                    :class="{ on: filterCategory === 'all' }"
                    @click="filterCategory = 'all'; page = 1"
                >
                    全部 {{ data.events.length.toLocaleString() }}
                </button>
                <button
                    v-for="opt in CATEGORY_OPTIONS.filter((o) => o.value !== 'all')"
                    :key="opt.value"
                    type="button"
                    class="ip-chip"
                    :class="{ on: filterCategory === opt.value }"
                    @click="filterCategory = opt.value as InteractionCategory; page = 1"
                >
                    {{ opt.label }} {{ categoryCounts[opt.value] ?? 0 }}
                </button>
                <button
                    type="button"
                    class="ip-chip ip-chip-more"
                    :class="{ on: moreFilterOpen || hasActiveFilter }"
                    @click="moreFilterOpen = !moreFilterOpen"
                >
                    更多筛选 ▾
                </button>
                <!-- 时间线按主体去重（同一条说说可能「评论 + 点赞」各记一次互动），故条数会小于互动次数 -->
                <span class="ip-count" :key="pulseKey">时间线 {{ filtered.length.toLocaleString() }} 条</span>
            </div>

            <div v-if="moreFilterOpen" class="ip-more-inline">
                <span class="ip-field">主体类型
                    <n-select size="small" v-model:value="filterType" :options="TYPE_OPTIONS" style="width: 150px;" />
                </span>
                <span class="ip-field">互动方向
                    <n-select size="small" v-model:value="filterDir" :options="dirOptions" style="width: 130px;" />
                </span>
                <button v-if="hasActiveFilter" class="ip-clear" type="button" @click="clearFilter">清除筛选</button>
            </div>

            <!-- 时间线：按年月分组；头像 + 谁 + 动作 + 内容摘要，点行展开完整卡片 -->
            <div class="ip-timeline">
                <template v-for="group in groupedEvents" :key="group.key">
                    <div class="ip-month"><span>{{ group.key }}</span></div>
                    <div v-for="row in group.rows" :key="row.i" class="ip-ev-wrap">
                        <button
                            type="button"
                            class="ip-ev"
                            :class="[row.e.dir, { open: expandedRows.has(row.i) }]"
                            :title="entryTitle(row.e)"
                            @click="toggleRow(row.i)"
                        >
                            <user-avatar
                                :uin="avatarUin(row.e)"
                                :size="36"
                                :link="false"
                                :class="{ 'privacy-blur': hideSensitive }"
                            />
                            <span class="ip-ev-main">
                                <span class="ip-ev-head">
                                    <b class="ip-ev-name" v-html="whoHtml(row.e)"></b>
                                    <span class="ip-ev-act">{{ actionText(row.e) }}</span>
                                    <span class="ip-ev-time">{{ formatTime(row.e.time).slice(0, 16) }}</span>
                                </span>
                                <span class="ip-ev-text" :class="{ 'privacy-blur': hideSensitive }">{{ entryTitle(row.e) }}</span>
                            </span>
                            <span class="ip-ev-caret">{{ expandedRows.has(row.i) ? '▾' : '▸' }}</span>
                        </button>
                        <div v-if="expandedRows.has(row.i)" class="ip-ev-detail" @click.stop>
                            <div class="ip-detail-bar">
                                <button type="button" class="ip-open-origin" @click="navToItem(row.e)">打开原页 →</button>
                                <button type="button" class="ip-open-origin is-quiet" @click="toggleRow(row.i)">收起</button>
                            </div>
                            <message-item v-if="row.e.type === 'message'" :item="row.e.item" />
                            <article-item v-else-if="row.e.type === 'blog'" :item="row.e.item" config-key="Blogs" />
                            <board-item v-else-if="row.e.type === 'board'" :item="row.e.item" />
                            <div v-else class="ip-compact-entry">
                                <span class="ip-compact-title">{{ entryTitle(row.e) }}</span>
                            </div>
                        </div>
                    </div>
                </template>
                <p v-if="groupedEvents.length === 0" class="ip-empty-row">没有符合条件的互动</p>
            </div>

            <div class="ip-pager" v-if="totalPages > 1">
                <n-pagination :page="page" :page-count="totalPages" @update:page="(p: number) => (page = p)" />
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
/* 他人空间入口态：两张并列卡，比本人空间的单输入卡更宽 */
.ip-friend-input-wide {
    max-width: 640px;
}
.ip-pick-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin: 2px 0 16px;
}
.ip-pick-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    box-sizing: border-box;
    border: 1px solid var(--border-separator);
    border-radius: 10px;
    background: var(--bg-toolbar);
    font: inherit;
    color: inherit;
    text-align: left;
}
button.ip-pick-card {
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}
button.ip-pick-card:hover {
    border-color: var(--accent);
    background: var(--bg-primary);
}
/* 默认项（你 与 TA）用主色描边点出来，但不用 2px 以免点进结果态时布局跳动 */
.ip-pick-primary {
    border-color: var(--accent);
    background: var(--bg-primary);
}
.ip-pick-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}
.ip-pick-desc {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary);
}
.ip-pick-go {
    margin-top: auto;
    padding-top: 4px;
    font-size: 12px;
    color: var(--accent);
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
/* 特别关心：独立分组、虚线分隔、不带序号（语义是「你在意谁」，不是「谁排第 6」） */
.ip-fi-care {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-light);
}
/* TOP5 为空（如只有关心好友、全站无互动）时不画分隔线，避免顶部凭空一条虚线 */
.ip-fi-care-alone {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
}
.ip-fi-care-title {
    margin-bottom: 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}
.ip-fi-care-title em { font-style: normal; font-weight: 400; color: var(--text-muted); }
/* 关心行没有序号占位，昵称直接对齐列表左缘 */
.ip-fi-person-care { padding-left: 4px; }
.ip-fi-tag {
    flex: none;
    padding: 0 4px;
    border: 1px solid var(--border-separator);
    border-radius: 3px;
    color: var(--text-secondary);
    font-size: 10px;
    line-height: 14px;
}
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
/* ===== 结果态改版：吸顶摘要 + 筛选 chips + 紧凑时间线 ===== */
.ip-summary {
    position: sticky;
    /* 同 .list-toolbar：要盖住 page-body 的 16px 上内边距，否则吸顶上方露缝 */
    top: -16px;
    z-index: 3;
    margin: -16px 0 12px;
    padding: 14px 16px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    box-shadow: 0 1px 3px var(--shadow-sm);
}
.ip-sum-line {
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
}
.ip-sum-who {
    font-size: 14px;
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ip-sum-who b {
    font-weight: 600;
}
.ip-sum-meta {
    flex: none;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.ip-sum-line .ip-fi-btn {
    margin-left: auto;
}
.ip-sum-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-secondary);
}
/* 每个数字给一块浅底：比一排裸文字更有「统计」的分量 */
.ip-sum-stats > span {
    padding: 4px 12px;
    border-radius: 8px;
    background: var(--bg-toolbar);
}
.ip-sum-stats b {
    margin-left: 2px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.ip-sum-quiet {
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
}

/* 筛选 chips：类别一眼看全，结构性筛选收进「更多」 */
.ip-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}
.ip-chip {
    padding: 3px 10px;
    border: 1px solid var(--border-card);
    border-radius: 999px;
    background: transparent;
    font: inherit;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
}
.ip-chip:hover {
    border-color: var(--accent);
    color: var(--text-primary);
}
.ip-chip.on {
    border-color: var(--accent);
    background: var(--bg-tint-blue);
    color: var(--accent-pressed);
}
.ip-more-filter {
    position: relative;
    font-size: 12px;
    color: var(--text-secondary);
}
.ip-more-filter summary {
    padding: 3px 10px;
    border: 1px dashed var(--border-card);
    border-radius: 999px;
    cursor: pointer;
    list-style: none;
}
.ip-more-filter summary::-webkit-details-marker {
    display: none;
}
.ip-more-filter[open] summary {
    border-style: solid;
    border-color: var(--accent);
}
.ip-more-body {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 10px;
    box-shadow: 0 4px 14px var(--shadow-md);
}
.ip-filter .ip-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

/* 时间线：月份锚点 + 头像式行 */
.ip-month {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0 4px;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.ip-month::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-light);
}
.ip-ev-wrap {
    border-bottom: 1px solid var(--border-light);
}
.ip-ev {
    position: relative;
    display: flex;
    gap: 12px;
    width: 100%;
    padding: 12px 4px 12px 14px;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
/* 左侧 3px 色条：蓝=我主动，绿=TA 回应，扫一眼就知道方向 */
.ip-ev::before {
    content: '';
    position: absolute;
    left: 0;
    top: 16px;
    bottom: 16px;
    width: 3px;
    border-radius: 2px;
    background: var(--border-light);
}
.ip-ev.me::before {
    background: var(--accent);
}
.ip-ev.ta::before {
    background: #1d9e75;
}
.ip-ev:hover,
.ip-ev.open {
    background: var(--bg-toolbar);
}
.ip-ev-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.ip-ev-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
}
.ip-ev-name {
    flex: none;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}
.ip-ev.me .ip-ev-name {
    color: var(--accent-pressed);
}
.ip-ev-act {
    flex: none;
    font-size: 11px;
    color: var(--text-muted);
}
.ip-ev-time {
    flex: none;
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}
.ip-ev-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
}
.ip-ev.open .ip-ev-text {
    white-space: normal;
}
.ip-ev-caret {
    flex: none;
    align-self: center;
    font-size: 10px;
    color: var(--text-muted);
}
.ip-ev-detail {
    padding: 2px 0 14px 62px;
}
/* 「更多筛选」展开行：正常文档流，不悬浮遮挡 */
.ip-more-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
    padding: 10px 12px;
    background: var(--bg-toolbar);
    border-radius: 10px;
}

/* 展开区的工具条：放在卡片上方，否则要滚过整张卡片才点得到 */
.ip-detail-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    padding: 2px 0 6px;
}
.ip-open-origin {
    margin-top: 0;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
}
.ip-open-origin:hover {
    text-decoration: underline;
}
.ip-open-origin.is-quiet {
    color: var(--text-muted);
}
.ip-empty-row {
    margin: 16px 0;
    font-size: 12px;
    color: var(--text-muted);
}

/* 统计详情：默认收起 */
.ip-stats {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--border-card);
}
.ip-stats > summary {
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    list-style: none;
}
.ip-stats > summary::-webkit-details-marker {
    display: none;
}
.ip-stats > summary::before {
    content: '▸ ';
    color: var(--text-muted);
}
.ip-stats[open] > summary::before {
    content: '▾ ';
}

/* 统计详情：外卡 + 两张内卡（与概览时间轴的「外卡包双卡」同族） */
.ip-stats-card {
    margin-bottom: 12px;
}
.ip-stats-summary {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 13px 16px;
    cursor: pointer;
    list-style: none;
    user-select: none;
}
.ip-stats-summary::-webkit-details-marker {
    display: none;
}
.ip-stats-summary:hover {
    background: var(--bg-toolbar);
}
.ip-stats-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}
.ip-stats-note {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--text-muted);
}
.ip-stats-caret {
    flex: none;
    font-size: 10px;
    color: var(--text-muted);
}
.ip-stats-card[open] > .ip-stats-summary {
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 12px;
}
.ip-stats-card[open] .ip-stats-caret::before {
    content: '▾';
}
.ip-stats-card:not([open]) .ip-stats-caret::before {
    content: '▸';
}
.ip-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}




</style>
