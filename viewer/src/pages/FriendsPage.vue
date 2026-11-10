<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NInput, NRadioButton, NRadioGroup, NSelect, NSpin, NTag, type DataTableColumns } from 'naive-ui';
import { loadList } from '../data/sources';
import { getModulePref, savePref, type ShowType } from '../data/displayPrefs';
import { formatTime, timeValue } from '../data/format';
import { formatSummary } from '../data/richText';
import { usePrivacy } from '../composables/usePrivacy';
import { maskName, maskUin, plainName } from '../data/mask';
import { collectInteractiveUsers, hasInteractiveSource, type InteractiveUser } from '../data/interactive';
import {
    friendCommonCount,
    friendDisplayName,
    friendNick,
} from '../data/content';
import ThatYearToday from '../components/ThatYearToday.vue';
import FriendItem from '../components/items/FriendItem.vue';
import UserAvatar from '../components/UserAvatar.vue';
import UserLink from '../components/UserLink.vue';

/**
 * 好友列表（数据来自 Friends/json/friends.js）
 * 字段与旧表格页一致（src/export/js/friends.js）：备注、分组、特别关心、访问权限、
 * 好友关系、相识时间、亲密度、共同好友/群组
 */
const loading = ref(true);
const list = ref<Record<string, any>[]>([]);
const keyword = ref('');
/** QQ 分组筛选：'' = 全部；其余为分组名（'未分组' 也算一个分组） */
const qqGroup = ref('');
/**
 * 数据源：好友 / 空间过客。
 * 过客不是好友的子集（他们压根不在 friends 列表里），所以是「换一批人看」，
 * 而不是可以和其他条件叠加的筛选条件——之前挤在「特殊分组」下拉里，选中就静默禁用 QQ 分组，
 * 现在单独拎出来当数据源切换。
 */
const dataset = ref<'friends' | 'passerby'>('friends');
/** 条件筛选：多选、按 AND 叠加（如「特别关心」+「十年老友」） */
const specialKeys = ref<string[]>([]);
/** '0' 表格 · '1' 列表（好友为卡片视图，列表即卡片流） */
const showType = ref<ShowType>('1');
const sortField = ref(getModulePref('friends').sortField || 'default');
const sortDir = ref<'desc' | 'asc'>(getModulePref('friends').sortDir);

// 展示方式（表格/列表）变更后按模块持久化
watch(showType, (value) => savePref('friends', { showType: value }));
// 排序字段/方向变更后持久化（与其他列表一致的排序记忆）
watch(sortField, (value) => savePref('friends', { sortField: value }));
watch(sortDir, (value) => savePref('friends', { sortDir: value }));

const SORT_FIELD_OPTIONS = [
    { label: '默认', value: 'default' },
    { label: '相识时间', value: 'time' },
    { label: '亲密度', value: 'intimacy' },
    { label: '共同好友', value: 'common' },
];
const SORT_DIR_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
];

/**
 * 好友昵称与备注
 * 昵称就是 nick（不是 name，旧页的表格页同样取该字段），备注就是 remark；
 * 两列各显各自的真实值、不互相回退，否则看不出谁有备注、谁只有昵称。
 * 两者都可能带表情 token，需富文本转换后才能看。（取值实现在 data/content.ts）
 */
function remarkOf(row: Record<string, any>): string {
    return row.remark || '';
}

/** 隐私开关：好友列表是「人多、逐个打码不现实」的地方，所以整列表直接脱敏 */
const { hidden: hideSensitive } = usePrivacy();

/**
 * 隐私态的展示名：先把名字剥成纯文本再按字符脱敏。
 * 名字里可能带 [em]e100[/em] 表情 token，直接按原串切会把 [em] 当字符、切出乱码。
 */
function maskedNameText(raw: string | null | undefined): string {
    // 先剥掉表情 token / HTML 标签再按字符脱敏（否则 [em] 会被当成字符切开）
    return maskName(plainName(raw));
}

/**
 * 共同群组脱敏：群名常含学校/公司/班级，逐个脱敏后再拼接
 * （整串一次性脱敏会被首尾规则吃掉中间，多个群名只剩一个）。
 */
function maskedCommonGroups(row: Record<string, any>): string {
    return commonGroupNames(row)
        .split('，')
        .filter(Boolean)
        .map((name) => maskName(name))
        .join('，');
}

onMounted(async () => {
    list.value = await loadList('friends');
    showType.value = getModulePref('friends').showType;
    loading.value = false;
    // 互动用户要扫全部模块，量可能大，放到好友渲染之后再算，不阻塞首屏
    try {
        interactiveSourceOk.value = await hasInteractiveSource();
        const users = await collectInteractiveUsers();
        const friendUins = new Set(list.value.map((item) => String(item.uin)));
        interactiveUins.value = new Set(users.map((user) => user.uin));
        // 空间过客：在互动用户里、但不是好友（他们不在 friends 列表里，单独保存）
        passerby.value = users.filter((user) => !friendUins.has(user.uin));
    } catch (error) {
        console.warn('收集互动用户失败', error);
    }
});

/**
 * 互动用户（uin 集合）与空间过客
 * null 表示尚未算完，此时互动/潜水/过客三个分组暂不可选
 */
const interactiveUins = ref<Set<string> | null>(null);
const passerby = ref<InteractiveUser[]>([]);

/**
 * 是否备份了任何可提供互动线索的模块。
 * 全缺失时「互动好友 / 潜水好友」的判定没有意义（所有人都会被算成潜水），
 * 此时把这两个选项置灰并注明原因，而不是显示一个看似正常的 0。
 */
const interactiveSourceOk = ref(true);

/**
 * 筛选条件（不是「分组」，是谓词）
 *
 * 旧页把这些做成了列表页的特殊分组，查看器里也沿用了「特殊分组」下拉——但它们的本质是
 * 条件判断，做成单选下拉就只能一次挑一个，「特别关心 + 十年老友」这种组合无从表达。
 * 这里改成一组可叠加的条件（AND），并按语义分行摆放，计数实时联动。
 */
const YEAR_MS = 365 * 24 * 3600 * 1000;
interface ConditionGroup {
    label: string;
    items: { value: string; label: string }[];
}
const CONDITION_GROUPS: ConditionGroup[] = [
    {
        label: '关系',
        items: [
            { value: 'care', label: '特别关心' },
            { value: 'oneway', label: '单向好友' },
            { value: 'deleted', label: '已删好友' },
            { value: 'access', label: '无权访问' },
        ],
    },
    {
        label: '时间',
        items: [
            { value: 'new', label: '新的好友' },
            { value: 'year5', label: '五年好友' },
            { value: 'year10', label: '十年老友' },
            { value: 'year20', label: '廿年旧友' },
            { value: 'first', label: '首个好友' },
            { value: 'latest', label: '最新好友' },
        ],
    },
    {
        label: '互动',
        items: [
            { value: 'intimacy', label: '互动好友' },
            { value: 'diving', label: '潜水好友' },
        ],
    },
    {
        label: '资料',
        items: [
            { value: 'remark', label: '有备注' },
            { value: 'noremark', label: '无备注' },
        ],
    },
];
const ALL_CONDITIONS = CONDITION_GROUPS.flatMap((group) => group.items);

/** 首个/最新好友靠相识时间的极值识别，不统计相识时间为 0 的 */
const extremes = computed(() => {
    let first: Record<string, any> | null = null;
    let latest: Record<string, any> | null = null;
    for (const item of list.value) {
        const time = timeValue(item.addFriendTime);
        if (!time) {
            continue;
        }
        if (!first || time < timeValue(first.addFriendTime)) {
            first = item;
        }
        if (!latest || time > timeValue(latest.addFriendTime)) {
            latest = item;
        }
    }
    return { first, latest };
});

function matchSpecial(key: string, item: Record<string, any>): boolean {
    const time = timeValue(item.addFriendTime);
    switch (key) {
        case 'care':
            return !!item.care;
        case 'access':
            return item.access === false || item.access === 0;
        case 'oneway':
            // 接口用 2 表示单向，早期数据里也出现过 0
            return item.isFriend === 2 || item.isFriend === 0;
        case 'deleted':
            return !!item.deleted;
        case 'new':
            return !!time && Date.now() - time <= 30 * 24 * 3600 * 1000;
        case 'year5':
            return !!time && Date.now() - time >= 5 * YEAR_MS;
        case 'year10':
            return !!time && Date.now() - time >= 10 * YEAR_MS;
        case 'year20':
            return !!time && Date.now() - time >= 20 * YEAR_MS;
        case 'first':
            return !!extremes.value.first && extremes.value.first === item;
        case 'latest':
            return !!extremes.value.latest && extremes.value.latest === item;
        case 'intimacy':
            // 是好友且在互动用户里
            return !!interactiveUins.value && interactiveUins.value.has(String(item.uin));
        case 'diving':
            // 是好友但从不在互动用户里（互动数据未算完时不归入，避免误判）
            return !!interactiveUins.value && !interactiveUins.value.has(String(item.uin));
        case 'remark':
            return !!String(item.remark || '').trim();
        case 'noremark':
            return !String(item.remark || '').trim();
        default:
            return true;
    }
}

/**
 * 当前 QQ 分组筛选后的好友集合（条件计数的基准盘）。
 * 条件计数在它之上再叠关键词与其它已选条件，于是括号里的数字才是「再选上这个还能剩几个」。
 */
const qqGroupScope = computed(() => (
    qqGroup.value
        ? list.value.filter((item) => (item.groupName || '未分组') === qqGroup.value)
        : list.value
));

/** QQ 分组选项（带计数，按人数降序；分组是好友的稳定属性，口径不随条件筛选变化） */
const qqGroupOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const item of list.value) {
        const name = item.groupName || '未分组';
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [
        { label: `全部好友（${list.value.length}）`, value: '' },
        ...[...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([name, total]) => ({ label: `${name}（${total}）`, value: name })),
    ];
});

/** 依赖互动数据的条件：源数据缺失时无法判定 */
const INTERACTIVE_DEPENDENT = new Set(['intimacy', 'diving']);

/** 是否正在看「空间过客」：此时数据源不是好友列表 */
const isPasserby = computed(() => dataset.value === 'passerby');

/**
 * 过客不是好友的子集，切过去时 QQ 分组与好友条件既无意义也不该继续保留选中值
 * （否则下拉被禁用却仍显示着「PHP（2）」，等于自相矛盾）。
 */
watch(isPasserby, (value) => {
    if (value) {
        qqGroup.value = '';
        specialKeys.value = [];
    }
});

/** 选中「空间过客」时展示的是非好友的互动用户，其余情况都是好友列表 */
const baseList = computed<Record<string, any>[]>(() => (
    isPasserby.value ? (passerby.value as Record<string, any>[]) : list.value
));

function matchKeyword(item: Record<string, any>): boolean {
    const word = keyword.value.trim().toLowerCase();
    if (!word) {
        return true;
    }
    return [item.name, item.remark, item.uin]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(word);
}

/**
 * 一条好友是否通过「QQ 分组 + 关键词 + 条件」。
 * extraKey 用于算单个条件的计数：先套用其它已选条件，再单独判断它。
 */
function passFilters(item: Record<string, any>, extraKey?: string): boolean {
    if (qqGroup.value && (item.groupName || '未分组') !== qqGroup.value) {
        return false;
    }
    for (const key of specialKeys.value) {
        if (key !== extraKey && !matchSpecial(key, item)) {
            return false;
        }
    }
    if (extraKey && !matchSpecial(extraKey, item)) {
        return false;
    }
    return matchKeyword(item);
}

/** 各条件的实时计数：在已有其它条件的基础上，再选它还能筛出多少人 */
const conditionCounts = computed(() => {
    const counts = new Map<string, number>();
    const scope = qqGroupScope.value.filter(matchKeyword);
    for (const condition of ALL_CONDITIONS) {
        counts.set(condition.value, scope.filter((row) => passFilters(row, condition.value)).length);
    }
    return counts;
});

/** 条件是否不可用（互动数据未算完 / 未备份） */
function conditionDisabled(key: string): boolean {
    if (!INTERACTIVE_DEPENDENT.has(key)) {
        return false;
    }
    return !interactiveSourceOk.value || interactiveUins.value === null;
}

/** 条件是否展示：有命中、已选中、或因数据缺失需要留个说明 */
function conditionVisible(key: string): boolean {
    return conditionDisabled(key) || specialKeys.value.includes(key) || (conditionCounts.value.get(key) || 0) > 0;
}

function conditionLabel(key: string): string {
    return ALL_CONDITIONS.find((item) => item.value === key)?.label || key;
}

function conditionHint(key: string): string {
    if (!INTERACTIVE_DEPENDENT.has(key)) {
        return '';
    }
    if (!interactiveSourceOk.value) {
        return '未备份互动数据，无法判断';
    }
    if (interactiveUins.value === null) {
        return '正在统计互动用户…';
    }
    return '';
}

function toggleCondition(key: string): void {
    if (conditionDisabled(key)) {
        return;
    }
    specialKeys.value = specialKeys.value.includes(key)
        ? specialKeys.value.filter((item) => item !== key)
        : [...specialKeys.value, key];
}

function clearAllFilters(): void {
    specialKeys.value = [];
    qqGroup.value = '';
    keyword.value = '';
}

const filtered = computed(() => baseList.value.filter((item) => (
    isPasserby.value ? matchKeyword(item) : passFilters(item)
)));
/** 默认不排：备份里的顺序跟 QQ 分组一致，直接重排反而找不到人 */
const sorted = computed(() => {
    if (sortField.value === 'default') {
        return filtered.value;
    }
    const valueOf = (item: Record<string, any>): number => {
        if (sortField.value === 'intimacy') {
            return Number(item.intimacyScore || 0);
        }
        if (sortField.value === 'common') {
            return friendCommonCount(item);
        }
        return timeValue(item.addFriendTime);
    };
    return [...filtered.value].sort((a, b) => {
        const diff = valueOf(a) - valueOf(b);
        return sortDir.value === 'desc' ? -diff : diff;
    });
});

/** 列表视图分块渲染：435 位全量铺出来是 7 千多节点，上千好友会明显卡；表格视图自带分页不受影响 */
const CARD_CHUNK = 300;
const cardRendered = ref(CARD_CHUNK);
const visibleCards = computed(() => sorted.value.slice(0, cardRendered.value));
const cardsHasMore = computed(() => showType.value !== '0' && sorted.value.length > visibleCards.value.length);

function loadMoreCards(): void {
    cardRendered.value = Math.min(sorted.value.length, cardRendered.value + CARD_CHUNK);
}

// 筛选/排序/切换视图后回到第一块，避免停在上一轮的深度上
watch([keyword, qqGroup, specialKeys, sortField, sortDir, showType, dataset], () => {
    cardRendered.value = CARD_CHUNK;
});

/** 是否单向好友：isFriend 为 0/false 时表示对方已不是好友 */
function friendState(row: Record<string, any>): string {
    // 空间过客本就不是好友（无 isFriend 字段），单独标出，不能默认当成互为好友
    if (isPasserby.value) {
        return '非好友';
    }
    if (row.deleted) {
        return '已删除';
    }
    return row.isFriend === 0 || row.isFriend === false ? '单向好友' : '互为好友';
}

/*
 * 共同好友数取 friendCommonCount（data/content.ts）：
 * common.friend 存的是好友对象数组（见 api.js 的 getCommonFriend），展示的是个数，
 * 直接把数组交给表格会渲染成 [object Object]。
 */

/**
 * 共同群组名称
 * common.group 的元素是 { name } 对象（旧页 getCommonGroup 同样取 name），
 * 但旧版会把该字段回写成字符串数组，所以两种形态都要兼容。
 */
function commonGroupNames(row: Record<string, any>): string {
    const groups = row.common?.group;
    if (!Array.isArray(groups)) {
        return groups ? String(groups) : '';
    }
    return groups
        .map((item) => (item && typeof item === 'object' ? item.name || item.groupName || '' : item))
        .filter(Boolean)
        .join('，');
}

/**
 * 列定义用 computed：render 里依赖 hideSensitive，常量数组不会跟着开关刷新。
 * 隐私态下昵称/备注半脱敏（保留首尾）、QQ 号打码、头像模糊。
 */
const columns = computed<DataTableColumns<Record<string, any>>>(() => {
    const masked = hideSensitive.value;
    return [
        {
            title: '',
            key: 'avatar',
            width: 52,
            // 头像图片本身就是按 uin 取的，模糊掉才不至于一眼认出是谁
            render: (row) => h(UserAvatar, {
                uin: row.uin, size: 32, link: false,
                class: masked ? 'privacy-blur' : '',
            }),
        },
        {
            title: 'QQ',
            key: 'uin',
            width: 110,
            render: (row) => h(UserLink, { uin: row.uin }, {
                default: () => (masked ? maskUin(row.uin) : String(row.uin)),
            }),
        },
        {
            title: '昵称',
            key: 'nick',
            ellipsis: { tooltip: true },
            // 昵称里可能带表情 token，需富文本渲染；隐私态改为纯文本脱敏
            render: (row) => (masked
                ? h('span', maskedNameText(friendNick(row)))
                : h('span', { innerHTML: formatSummary(friendNick(row)) })),
        },
        {
            title: '备注',
            key: 'remark',
            ellipsis: { tooltip: true },
            render: (row) => (masked
                ? h('span', maskedNameText(remarkOf(row)))
                : h('span', { innerHTML: formatSummary(remarkOf(row)) })),
        },
    { title: '分组', key: 'groupName', width: 120, render: (row) => row.groupName || '未分组' },
    {
        title: '特别关心',
        key: 'care',
        width: 90,
        align: 'center',
        render: (row) => (row.care ? h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => '关心' }) : ''),
    },
    {
        title: '好友关系',
        key: 'isFriend',
        width: 100,
        align: 'center',
        render: (row) => friendState(row),
    },
    {
        title: '相识时间',
        key: 'addFriendTime',
        width: 170,
        render: (row) => formatTime(row.addFriendTime),
    },
    {
        title: '亲密度',
        key: 'intimacyScore',
        width: 90,
        align: 'center',
        sorter: (a, b) => Number(a.intimacyScore || 0) - Number(b.intimacyScore || 0),
        render: (row) => row.intimacyScore || 0,
    },
    {
        title: '访问权限',
        key: 'access',
        width: 90,
        align: 'center',
        render: (row) => {
            if (row.access === false) return h(NTag, { size: 'small', type: 'error', bordered: false }, { default: () => '无权限' });
            if (row.access === true) return h(NTag, { size: 'small', type: 'success', bordered: false }, { default: () => '可访问' });
            return '—'; // 未开启权限探测或无该字段
        },
    },
    {
        title: '共同好友',
        key: 'commonFriend',
        width: 100,
        align: 'center',
        sorter: (a, b) => friendCommonCount(a) - friendCommonCount(b),
        render: (row) => friendCommonCount(row),
    },
        {
            title: '共同群组',
            key: 'commonGroup',
            ellipsis: { tooltip: true },
            // 群名里常有学校/公司/班级，隐私态逐项脱敏
            render: (row) => (masked ? maskedCommonGroups(row) : commonGroupNames(row)),
        },
    ];
});
</script>

<template>
    <div class="page-head">
        好友
        <span v-if="!loading && list.length > 0" class="head-count">
            <template v-if="isPasserby">
                共 {{ passerby.length }} 位空间过客{{ filtered.length !== passerby.length ? `，筛选出 ${filtered.length} 位` : '' }}
            </template>
            <template v-else>
                共 {{ list.length }} 位{{ filtered.length !== list.length ? `，筛选出 ${filtered.length} 位` : '' }}
            </template>
        </span>
    </div>

    <div class="page-body">
        <div v-if="loading" class="loading">
            <n-spin size="large" />
        </div>

        <n-empty
            v-else-if="list.length === 0"
            description="暂无好友数据（本次备份可能未包含好友模块）"
            size="large"
            class="friends-empty"
        />

        <template v-else>
            <!-- 那年今日（按相识时间算）；本页不走 ListPage，故直接放在工具栏之前 -->

            <!-- 工具栏按职能分区：【视图】【数据源】【分组】在左，【排序+搜索】靠右 -->
            <div class="list-toolbar">
                <div class="toolbar-group">
                    <n-radio-group v-model:value="showType">
                        <n-radio-button value="1">列表</n-radio-button>
                        <n-radio-button value="0">表格</n-radio-button>
                    </n-radio-group>
                </div>
                <!-- 过客不是好友子集：换数据源看，而不是当条件叠加 -->
                <div v-if="passerby.length > 0" class="toolbar-group">
                    <n-radio-group v-model:value="dataset">
                        <n-radio-button value="friends">好友</n-radio-button>
                        <n-radio-button value="passerby">空间过客（{{ passerby.length }}）</n-radio-button>
                    </n-radio-group>
                </div>
                <div class="toolbar-group">
                    <span class="toolbar-label">QQ 分组</span>
                    <n-select size="small"
                        v-model:value="qqGroup"
                        :options="qqGroupOptions"
                        :disabled="isPasserby"
                        style="width: 160px;"
                    />
                </div>
                <div class="toolbar-group to-right">
                    <span class="toolbar-label">排序</span>
                    <n-select size="small" v-model:value="sortField" :options="SORT_FIELD_OPTIONS" style="width: 140px;" />
                    <n-select size="small" v-model:value="sortDir" :options="SORT_DIR_OPTIONS" :disabled="sortField === 'default'" style="width: 90px;" />
                    <n-input size="small" v-model:value="keyword" placeholder="搜索昵称、备注或 QQ" clearable style="width: 220px;" />
                </div>
            </div>

            <!--
                条件筛选：多选、按 AND 叠加（「特别关心」+「十年老友」…）。
                计数口径 = 在其它已选条件 / QQ 分组 / 关键词之上，再选它还能剩多少人。
            -->
            <div v-if="!isPasserby" class="filter-bar">
                <div v-for="group in CONDITION_GROUPS" :key="group.label" class="filter-row">
                    <span class="filter-group-label">{{ group.label }}</span>
                    <button
                        v-for="item in group.items"
                        :key="item.value"
                        v-show="conditionVisible(item.value)"
                        type="button"
                        class="filter-chip"
                        :class="{ on: specialKeys.includes(item.value) }"
                        :disabled="conditionDisabled(item.value)"
                        :title="conditionHint(item.value)"
                        @click="toggleCondition(item.value)"
                    >
                        {{ item.label }}
                        <span v-if="!conditionDisabled(item.value)" class="chip-num">{{ conditionCounts.get(item.value) || 0 }}</span>
                        <span v-else class="chip-num">{{ conditionHint(item.value) }}</span>
                    </button>
                </div>
                <div class="filter-summary">
                    <span v-if="specialKeys.length">
                        已选 {{ specialKeys.length }} 个条件（同时满足）· 筛出 {{ sorted.length }} 位
                    </span>
                    <span v-else>可多选叠加，例如「特别关心」+「十年老友」</span>
                    <button v-if="specialKeys.length || qqGroup || keyword" type="button" class="filter-clear" @click="clearAllFilters">清空</button>
                </div>
            </div>

            <that-year-today
                :items="list"
                :time-of="(item: Record<string, any>) => item.addFriendTime"
            >
                <template #item="{ item }">
                    <friend-item :item="item" />
                </template>
            </that-year-today>

            <div v-if="sorted.length === 0" class="filter-empty">
                <span>{{ isPasserby ? '没有匹配的空间过客' : '没有同时满足这些条件的好友' }}</span>
                <n-button size="small" @click="clearAllFilters">清空筛选</n-button>
            </div>
            <n-data-table
                v-else-if="showType === '0'"
                :columns="columns"
                :data="sorted"
                :row-key="(row) => row.uin"
                :bordered="false"
                :pagination="{ pageSize: 50 }"
                size="small"
            />
            <template v-else>
                <div class="cards">
                    <div v-for="item in visibleCards" :key="item.uin" class="friend-cell">
                        <friend-item :item="item" />
                    </div>
                </div>
                <div v-if="cardsHasMore" class="cards-more">
                    <span class="cards-more-text">
                        已显示 {{ visibleCards.length }} / {{ sorted.length }} 位
                    </span>
                    <n-button size="small" @click="loadMoreCards">加载更多</n-button>
                </div>
            </template>
        </template>
    </div>
</template>

<style scoped>
/* 条件筛选条：多选叠加（AND），一行一组语义，计数实时联动 */
.filter-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 2px 0 12px;
    padding: 10px 12px;
    border: 1px solid var(--border-light, #e8ebf0);
    border-radius: 8px;
    background: var(--bg-toolbar, #f7f8fa);
}
.filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.filter-group-label {
    flex: 0 0 auto;
    min-width: 26px;
    font-size: 11px;
    color: var(--text-secondary, #666);
}
.filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 999px;
    background: var(--bg-primary, #fff);
    font-size: 12px;
    color: var(--text-secondary, #555);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.filter-chip:hover:not(:disabled) {
    border-color: #7c6bc4;
    color: #7c6bc4;
}
/* 选中态与榜单页筛选同色系（#7c6bc4），一眼能看出哪些条件在生效 */
.filter-chip.on {
    border-color: #7c6bc4;
    background: rgba(124, 107, 196, 0.12);
    color: #7c6bc4;
    font-weight: 600;
}
.filter-chip:disabled {
    cursor: not-allowed;
    border-style: dashed;
    opacity: 0.55;
}
.chip-num {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    opacity: 0.72;
}
.filter-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
    padding-top: 6px;
    border-top: 1px dashed var(--border-light, #e8ebf0);
    font-size: 12px;
    color: var(--text-secondary, #666);
}
.filter-clear {
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 12px;
    color: #7c6bc4;
    cursor: pointer;
}
.filter-clear:hover {
    text-decoration: underline;
}
.filter-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 0;
    font-size: 13px;
    color: var(--text-secondary, #666);
}
/* 列表视图：多列卡片，比表格更紧凑也更像空间的好友列表 */
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
}
/* 分块加载提示与按钮 */
.cards-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 0 24px;
}
.cards-more-text {
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
/* 单个好友卡片的样式已随渲染一起进了 items/FriendItem.vue */
.friend-cell {
    min-width: 0;
}
.head-count {
    margin-left: 10px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-muted);
}
.loading {
    display: flex;
    justify-content: center;
    padding: 40px 0;
}
/* 模块无数据：占满滚动区剩余高度，上下左右居中 */
.friends-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
</style>
