<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
    NAlert,
    NButton,
    NConfigProvider,
    NDatePicker,
    NDivider,
    NForm,
    NFormItem,
    NInput,
    NInputNumber,
    NLayout,
    NLayoutSider,
    NMenu,
    NModal,
    NDynamicInput,
    NRadio,
    NRadioGroup,
    NSelect,
    NSpace,
    NSwitch,
    zhCN,
    dateZhCN,
} from 'naive-ui';
import { blueThemeOverrides } from '../../core/shared/naive-theme';
import {
    AVATAR_HOST_OPTIONS,
    COMMON_DEFAULTS,
    MEDIA_MODE_OPTIONS,
    MESSAGES_FILTER_WORDS,
    MODULE_DEFAULTS,
    REST_SLEEP_GROUPS,
    loadConfig,
    saveConfig,
    testAria2,
} from '../../core/shared/config';
import IncrementSetting from './IncrementSetting.vue';
import { downloadTypeOptionsFor, defaultDownloadTypeFor } from '../../core/shared/backup-options';
import IntervalSetting from './IntervalSetting.vue';
import LikeSetting from './LikeSetting.vue';
import CommentsSetting from './CommentsSetting.vue';
import VisitorSetting from './VisitorSetting.vue';
import AboutPanel from './AboutPanel.vue';
import ToolsPanel from './ToolsPanel.vue';
import { SHARE_SOURCE_DEFAULTS } from '../../core/shared/shareSources';
import {
    LAUNCH_FLOW_DEFAULTS,
    readLaunchFlow,
    writeLaunchFlow,
    PIN_HINT_AUTO_STOP_THRESHOLD,
    type LaunchPopupBehavior,
} from '../../core/shared/backup-options';
import { DiskFS } from '../../core/fs/disk-fs';

/** 全局文案格式（彻底全局，各模块不再单独配置；JSON 始终导出、好友额外导出 Excel，均不在此选择） */
const GLOBAL_EXPORT_OPTIONS = [
    { label: 'HTML', value: 'HTML' },
    { label: 'MarkDown', value: 'MarkDown' },
];
/** 增量备份范围（通用默认 + 各模块可继承/覆盖） */
const INCREMENT_OPTIONS = [
    { label: '全部数据', value: 'Full' },
    { label: '上次之后', value: 'LastTime' },
    { label: '指定时间', value: 'Custom' },
];
/** 视频文件名方式 */
const VIDEO_RENAME_OPTIONS = [
    { label: '链接指纹', value: 'Default' },
    { label: '视频标题/上传时间', value: 'Name' },
    { label: '视频标题_上传时间', value: 'Time' },
];
/** 视频归类方式 */
const STRUCTURE_OPTIONS = [
    { label: '默认', value: 'File' },
    { label: '年份', value: 'Year' },
    { label: '月份', value: 'Month' },
    { label: '日期', value: 'Date' },
];
/** 好友分组排序 */
const FRIENDS_SORT_OPTIONS = [
    { label: 'QQ排序', value: 'QQ' },
    { label: '助手排序', value: 'default' },
];
/** 相片归纳方式 */
const PHOTO_STRUCTURE_OPTIONS = [
    { label: '相册', value: 'File' },
    { label: '年份', value: 'Year' },
    { label: '月份', value: 'Month' },
    { label: '日期', value: 'Date' },
];
/** 相片文件名方式（分组单选，不含序号前缀；Default=链接指纹=URL哈希） */
const PHOTO_RENAME_OPTIONS = [
    {
        type: 'group', label: '相片名', key: 'pr-name',
        children: [
            { label: '相片名', value: 'Name' },
            { label: '相片名_链接指纹', value: 'Default' },
        ],
    },
    {
        type: 'group', label: '智能合成', key: 'pr-smart',
        children: [
            { label: '相片名_拍摄/上传时间', value: 'Time' },
            { label: '相片名_拍摄/上传时间_拍摄/上传地点', value: 'Time_Lbs1' },
            { label: '相片名_上传/拍摄时间_上传/拍摄地点', value: 'Time_Lbs2' },
        ],
    },
    {
        type: 'group', label: '智能汇总', key: 'pr-all',
        children: [
            { label: '相片名_上传时间_上传地点_拍摄时间_拍摄地点', value: 'ALL' },
        ],
    },
    {
        type: 'group', label: '固定时间', key: 'pr-fix',
        children: [
            { label: '相片名_上传时间', value: 'UploadTime' },
            { label: '相片名_拍摄时间', value: 'ShootTime' },
        ],
    },
    {
        type: 'group', label: '拍摄时间', key: 'pr-shoot',
        children: [
            { label: '相片名_拍摄时间_拍摄地点', value: 'ShootTime_ShootLbs' },
            { label: '相片名_拍摄时间_拍摄/上传地点', value: 'ShootTime_Lbs1' },
            { label: '相片名_拍摄时间_上传/拍摄地点', value: 'ShootTime_Lbs2' },
        ],
    },
    {
        type: 'group', label: '上传时间', key: 'pr-upload',
        children: [
            { label: '相片名_上传时间_上传地点', value: 'UploadTime_UploadLbs' },
            { label: '相片名_上传时间_上传/拍摄地点', value: 'UploadTime_Lbs1' },
            { label: '相片名_上传时间_拍摄/上传地点', value: 'UploadTime_Lbs2' },
        ],
    },
];
/** 相片列表类型 */
const PHOTO_LIST_TYPE_OPTIONS = [
    { label: '默认列表', value: 'Default' },
    { label: '详情列表', value: 'Detail' },
];
/** 相片质量 */
const PHOTO_EXIF_OPTIONS = [
    { label: '原图', value: 'raw' },
    { label: '高清', value: 'original' },
    { label: '一般', value: 'normal' },
];

/** 左侧导航：公共已实现，其余模块后续增量迁移 */
const MENU_OPTIONS = [
    { label: '公共', key: 'Common' },
    { label: '说说', key: 'Messages' },
    { label: '日志', key: 'Blogs' },
    { label: '日记', key: 'Diaries' },
    { label: '相册', key: 'Photos' },
    { label: '视频', key: 'Videos' },
    { label: '留言', key: 'Boards' },
    { label: '好友', key: 'Friends' },
    { label: '收藏', key: 'Favorites' },
    { label: '分享', key: 'Shares' },
    { label: '访客', key: 'Visitors' },
    // 用户要求：Firefox 下隐藏工具菜单
    ...(import.meta.env.FIREFOX ? [] : [{ label: '工具', key: 'Tools' }]),
    { label: '关于', key: 'About' },
];

/** 响应式：检测移动端（宽度 < 768px） */
const isMobile = ref(window.innerWidth < 768);
window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768;
});
/** 移动端表单 label 置于顶部，宽度自适应 */
const formLabelPlacement = computed<'left' | 'top'>(() => isMobile.value ? 'top' : 'left');
const formLabelWidth = computed<string | number | undefined>(() => isMobile.value ? undefined : 120);

const activeTab = ref('Common');
const loading = ref(true);
const saving = ref(false);
const saveStatus = reactive<{ show: boolean; type: 'success' | 'error'; msg: string }>({
    show: false,
    type: 'success',
    msg: '',
});

/** 完整配置对象（含全部模块），Common 表单直接绑定 config.Common */
const config = reactive<Record<string, any>>({ Common: { ...COMMON_DEFAULTS } });

const dt = computed(() => config.Common.downloadType);
/** 文案导出是否写入本地目录：由运行环境能力决定（支持 File System Access API 才直写目录，否则回退 ZIP），用户无需手动选择 */
const isDirectory = computed(() => DiskFS.isSupported());
/** 媒体是否需要下载（为否则内容直接引用QQ空间外链，无任何下载行为） */
const isDownloadMedia = computed(() => config.Common.mediaMode !== 'Link');
/** 媒体是否由助手直写用户选定目录 */
const isDiskDownload = computed(() => isDownloadMedia.value && dt.value === 'Disk');
/** 媒体是否交给外部下载器（产物不在备份目录内） */
const isExternalDownloader = computed(() => isDownloadMedia.value && dt.value !== 'Disk');

/** 下载方式的行内说明（仅陈述文件去向，需知晓的取舍与后果由下方区块提示承担） */
const downloaderHint = computed(() => (isDiskDownload.value
    ? '由助手写入备份目录，与文案同目录，可直接浏览'
    : '文件由所选下载器保存到它自己的目录'));

/** 已开启刷新微信坐标但未配置腾讯地图 Key（此时开关不生效，需提醒） */
const needMapKey = computed(() => (
    !!(config.Messages?.refreshWeChatLbs || config.Messages?.refreshAllLbs) && !config.Dev?.Maps?.TxKey
));

// 分享来源识别规则编辑器：弹窗内改副本，确定后才回写到配置
const showSourceEditor = ref(false);
const sourceDraft = ref<{ name: string; regulars: string }[]>([]);
const sourceCount = computed(() => (config.Shares?.SourceType || []).length);

/** 打开编辑器：regulars 历史上允许为数组，展开为多条同名规则以便逐条编辑 */
function openSourceEditor(): void {
    const list: { name: string; regulars: string }[] = [];
    for (const item of config.Shares?.SourceType || []) {
        const regulars = Array.isArray(item.regulars) ? item.regulars : [item.regulars];
        for (const reg of regulars) {
            list.push({ name: item.name || '', regulars: reg || '' });
        }
    }
    sourceDraft.value = list;
    showSourceEditor.value = true;
}

/** 确定：丢弃名称或规则为空的行，保留原有顺序（匹配按顺序命中第一条） */
function applySourceEditor(): void {
    config.Shares.SourceType = sourceDraft.value
        .filter((item) => item.name.trim() && item.regulars.trim())
        .map((item) => ({ name: item.name.trim(), regulars: item.regulars.trim() }));
    showSourceEditor.value = false;
}

/** 恢复默认：仅重置弹窗内的副本，仍需点确定才生效 */
function resetSourceDraft(): void {
    sourceDraft.value = SHARE_SOURCE_DEFAULTS.map((item) => ({ ...item }));
}

// 说说屏蔽词编辑器：与分享来源一致的弹窗维护方式
const showKeywordEditor = ref(false);
const keywordDraft = ref<string[]>([]);
const keywordCount = computed(() => (Array.isArray(config.Messages?.FilterKeyWords) ? config.Messages.FilterKeyWords.length : 0));

function openKeywordEditor(): void {
    const words = config.Messages?.FilterKeyWords;
    keywordDraft.value = Array.isArray(words) ? [...words] : [];
    showKeywordEditor.value = true;
}

/** 确定：去空、去重后回写 */
function applyKeywordEditor(): void {
    const words = keywordDraft.value.map((word) => (word || '').trim()).filter(Boolean);
    config.Messages.FilterKeyWords = Array.from(new Set(words));
    showKeywordEditor.value = false;
}

function resetKeywordDraft(): void {
    keywordDraft.value = [...MESSAGES_FILTER_WORDS];
}

/** “助手直写目录”需要目录句柄，仅当文案也写入本地目录时可选；
 * Firefox 形态 B 直写目录不可用，选项集直接过滤掉 Disk */
const downloadTypeOptions = computed(() => downloadTypeOptionsFor(import.meta.env.FIREFOX).map((opt) => (
    opt.value === 'Disk' ? { ...opt, disabled: !isDirectory.value } : opt
)));

// Firefox 形态 B：直写目录(Disk)不可用。用 watch 归一化而非一次性判断——
// 初始 COMMON_DEFAULTS、onMounted 异步 loadConfig 深合并（重装后 storage 空会兜底回 Disk）、
// 重置设置等任何来源写入 Disk 都会被改回 Browser，避免下拉显示空/选中无效项。
if (import.meta.env.FIREFOX) {
    watch(
        () => config.Common.downloadType,
        (v) => { if (v === 'Disk') config.Common.downloadType = 'Browser'; },
        { immediate: true },
    );
}

// 下载器联动：各配置块的显示条件
const showFileSuffix = computed(() => isDownloadMedia.value);
const showDownloadThread = computed(() => isDownloadMedia.value);
const showDownloadSleep = computed(() => isDownloadMedia.value && ['Browser', 'Aria2', 'Disk'].includes(dt.value));
const showReferer = computed(() => isDownloadMedia.value && ['Browser', 'Disk'].includes(dt.value));
const showAria2 = computed(() => isDownloadMedia.value && dt.value === 'Aria2');

// 在不支持直写目录的环境（输出回退为 ZIP）下，“助手直写目录”拿不到目录句柄，回落为浏览器下载器
watch(isDirectory, (directory) => {
    if (!directory && config.Common.downloadType === 'Disk') {
        config.Common.downloadType = 'Browser';
    }
});

// 追加引用来源编辑器：与分享来源、屏蔽词一致的弹窗维护方式
const showRefererEditor = ref(false);
const refererDraft = ref<string[]>([]);
const refererCount = computed(() => (Array.isArray(config.Common.refererUrls) ? config.Common.refererUrls.length : 0));

function openRefererEditor(): void {
    const urls = config.Common.refererUrls;
    refererDraft.value = Array.isArray(urls) ? [...urls] : [];
    showRefererEditor.value = true;
}

/** 确定：去空、去重后回写 */
function applyRefererEditor(): void {
    const urls = refererDraft.value.map((url) => (url || '').trim()).filter(Boolean);
    config.Common.refererUrls = Array.from(new Set(urls));
    showRefererEditor.value = false;
}

function resetRefererDraft(): void {
    refererDraft.value = [...COMMON_DEFAULTS.refererUrls];
}

/** 当前 tab 标题（统一由菜单项生成，不在各 tab 内重复写） */
const currentTitle = computed(() => {
    const label = MENU_OPTIONS.find((item) => item.key === activeTab.value)?.label || '';
    return showSaveBar.value ? label + '设置' : label;
});

/** 工具、关于不涉及配置项，不显示保存区 */
const showSaveBar = computed(() => activeTab.value !== 'About' && activeTab.value !== 'Tools');

/** 上次保存（或初始读取）时的配置快照，用于判定是否有未保存的改动 */
const savedSnapshot = ref('');
const dirty = computed(() => !loading.value && JSON.stringify(config) !== savedSnapshot.value);

/** 保存成功的提示自动消失，避免一直留在底部、切到其它 tab 后看着像刚保存过 */
let statusTimer = 0;
function showSaveStatus(type: 'success' | 'error', msg: string): void {
    window.clearTimeout(statusTimer);
    saveStatus.type = type;
    saveStatus.msg = msg;
    saveStatus.show = true;
    if (type === 'success') {
        statusTimer = window.setTimeout(() => {
            saveStatus.show = false;
        }, 3000);
    }
}

function hideSaveStatus(): void {
    window.clearTimeout(statusTimer);
    saveStatus.show = false;
}

async function onSave(): Promise<void> {
    saving.value = true;
    hideSaveStatus();
    try {
        // 语音说说已下线：开关只读，顺手把老配置里遗留的 true 归零，避免配置与实际行为不一致
        config.Messages.GetVoice = false;
        // 必填校验：腾讯地图 Key（开启「刷新微信坐标」时必须有）
        if (needMapKey.value) {
            showSaveStatus('error', '请填写腾讯地图 Key：开启「刷新微信坐标」或「刷新普通说说地点」后必须提供，否则无法刷新。可在腾讯位置服务控制台申请。');
            saving.value = false;
            return;
        }
        // Aria2 协议下载器：RPC 与下载目录必填 + 保存前自动测试连接
        if (dt.value === 'Aria2') {
            const aria2 = config.Common.Aria2 || { rpc: '', dir: '' };
            const rpc = (aria2.rpc || '').trim();
            if (!rpc) {
                showSaveStatus('error', '请填写 Aria2 RPC 地址（如 http://localhost:6800/jsonrpc）。');
                saving.value = false;
                return;
            }
            const dir = (aria2.dir || '').trim();
            if (!dir) {
                showSaveStatus('error', '请填写 Aria2 下载目录（绝对路径）：第三方客户端（如 Motrix）留空会报错，且留空时文件实际位置不可控。');
                saving.value = false;
                return;
            }
            // 连接测试失败直接禁止保存（不再提供「仍然保存」绕过），确保写入的是可用配置
            const r = await testAria2(rpc, aria2.token);
            if (!r.ok) {
                showSaveStatus('error', r.message);
                saving.value = false;
                return;
            }
        }
        await doSave();
    } catch (error) {
        showSaveStatus('error', '保存失败：' + ((error as Error).message || '未知错误'));
    } finally {
        saving.value = false;
    }
}

/** 真正执行写入 */
async function doSave(): Promise<void> {
    await saveConfig(config);
    savedSnapshot.value = JSON.stringify(config);
    showSaveStatus('success', '设置已保存，已打开的 QQ 空间备份页面需刷新后才能生效');
}


/** 一键开启/关闭所有模块的点赞/评论/访客采集（已改为「通用默认」统一控制，见上方通用默认区块） */

/**
 * 增量备份（已改为「通用默认」统一控制，见上方通用默认区块；
 * 各模块在自身页签里关闭「继承公共」即可单独配置 IncrementType / IncrementTime）。
 * 好友模块 Friends 同样继承通用默认增量配置：IncrementType!=='Full' 时做增量处理
 * （按 QQ 号比对上次备份识别已删除好友，并跳过对既有好友的互动信息重抓）；
 * 已删除好友识别始终运行，与是否增量模式无关。
 */

/* ==================== 弹窗行为配置 ==================== */
/** 当前选中的弹窗行为（与 chrome.storage.local 的 LaunchFlow 保持一致） */
const launchBehavior = ref<LaunchPopupBehavior>(LAUNCH_FLOW_DEFAULTS.behavior);
const pinHintDismissCount = ref<number>(0);
const launchSaving = ref(false);

async function loadLaunchBehavior(): Promise<void> {
    const lf = await readLaunchFlow();
    launchBehavior.value = lf.behavior;
    pinHintDismissCount.value = lf.pinHintDismissCount;
}

async function onLaunchBehaviorChange(next: LaunchPopupBehavior): Promise<void> {
    launchSaving.value = true;
    try {
        // 切回「每次访问弹」时清掉上次 optOut 勾选记忆，否则备份确认弹窗会沿用旧痕把复选框恢复成勾选态
        await writeLaunchFlow(next === 'ask_on_first_visit'
            ? { behavior: next, lastOptOutCheckbox: false }
            : { behavior: next });
        launchBehavior.value = next;
        hideSaveStatus();
        showSaveStatus('success', '弹窗行为已保存，下次访问QQ空间时生效');
    } finally {
        launchSaving.value = false;
    }
}

async function onResetLaunchBehavior(): Promise<void> {
    const ok = window.confirm('确定要将「弹窗行为」重置为默认吗？\n（重新启用首次访问时的备份确认弹窗）');
    if (!ok) return;
    launchSaving.value = true;
    try {
        await chrome.storage.local.remove(['QZoneExport_LaunchFlow_v1']);
        // 写完后重新加载显示
        await loadLaunchBehavior();
        hideSaveStatus();
        showSaveStatus('success', '已重置为默认：首次访问QQ空间时自动显示备份确认弹窗');
    } finally {
        launchSaving.value = false;
    }
}

// 卡片式选择器：当 launchBehavior 被模板赋值变化时自动持久化
// （等价于原 radio 组的 @update:value 回调，只是现在卡片点击直接赋值，所以用 watch 桥接）
let __launchWritingGuard = false;
watch(launchBehavior, (next, prev) => {
    if (__launchWritingGuard) return;
    if (!next || next === prev) return;
    __launchWritingGuard = true;
    onLaunchBehaviorChange(next)
        .catch(() => { /* ignore，已内部吞错 */ })
        .finally(() => { __launchWritingGuard = false; });
});

const LAUNCH_BEHAVIOR_OPTIONS: Array<{
    label: string;
    value: LaunchPopupBehavior;
    desc: string;
    icon: string;
    recommend?: boolean;
}> = [
    {
        label: '每次访问弹「一键备份确认」',
        value: 'ask_on_first_visit',
        desc: '打开QQ空间时在页面中央弹出卡片，可一键启动备份；关闭后下次访问继续提示，避免遗漏备份',
        icon: '🟢',
        recommend: true,
    },
    {
        label: '关闭备份弹窗，只提示「固定图标」',
        value: 'show_pin_hint_only',
        desc: '不再弹备份确认卡片，改为提示如何把扩展固定到浏览器工具栏；固定引导累计关闭 3 次后自动升级为「永不自动弹窗」',
        icon: '📌',
    },
    {
        label: '完全静默，手动点击工具栏图标',
        value: 'never_auto_popup',
        desc: '最高的不打扰级别：助手永不主动弹出任何引导卡片/确认框，所有备份操作必须由您主动点击浏览器工具栏上的扩展图标启动',
        icon: '🔕',
    },
];

async function onReset(): Promise<void> {
    const ok = window.confirm('确定要重置所有设置为默认值吗？\n此操作不可撤销，重置后需点「保存设置」生效。');
    if (!ok) {
        return;
    }
    // 重建默认配置（与 loadConfig 的深合并逻辑一致）
    const fresh: Record<string, any> = { Common: { ...COMMON_DEFAULTS } };
    // Firefox 形态 B：直写目录(Disk)不可用，重置后的下载方式默认浏览器下载器（Chrome 下该函数返回 'Disk' 与默认一致）
    fresh.Common.downloadType = defaultDownloadTypeFor(import.meta.env.FIREFOX);
    fresh.Common.Aria2 = { ...COMMON_DEFAULTS.Aria2 };
    for (const name of Object.keys(MODULE_DEFAULTS)) {
        fresh[name] = JSON.parse(JSON.stringify(MODULE_DEFAULTS[name]));
    }
    fresh.Shares.SourceType = SHARE_SOURCE_DEFAULTS.map((item) => ({ ...item }));
    // 替换当前配置（保持响应式）
    Object.keys(config).forEach((k) => delete config[k]);
    Object.assign(config, fresh);
    hideSaveStatus();
    showSaveStatus('success', '已重置为默认值，请点「保存设置」确认写入');
}

onMounted(async () => {
    // 支持 options.html#Photos 这样直达指定 tab（供 popup、其它页面跳转使用）
    const hash = decodeURIComponent(location.hash.replace('#', ''));
    if (hash && MENU_OPTIONS.some((item) => item.key === hash)) {
        activeTab.value = hash;
    }
    try {
        const loaded = await loadConfig();
        Object.assign(config, loaded);
        savedSnapshot.value = JSON.stringify(config);
    } catch (error) {
        showSaveStatus('error', '读取配置失败：' + ((error as Error).message || '未知错误'));
    } finally {
        loading.value = false;
    }
    // 读取弹窗行为（与模块配置独立存储，不影响 dirty 标记和保存流程）
    loadLaunchBehavior().catch(() => { /* ignore */ });
    // 改了没保存就关页/刷新时给一道拦截（本页不做自动保存，改动完全靠手动提交）
    window.addEventListener('beforeunload', (event) => {
        if (!dirty.value) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    });
});

// 切 tab 时清掉上一个 tab 的保存提示，避免让人误以为当前 tab 刚保存过
watch(activeTab, () => {
    hideSaveStatus();
});

// 一旦又有改动，“已保存”的提示就不再成立
watch(dirty, (value) => {
    if (value) {
        hideSaveStatus();
    }
});

// tab 切换同步到地址栏，便于刷新后停留在同一页（用 replace 避免堆积历史）
watch(activeTab, (tab) => {
    history.replaceState(null, '', '#' + tab);
});
</script>

<template>
    <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="blueThemeOverrides">
        <n-layout :has-sider="!isMobile" style="height: 100vh;">
            <n-layout-sider v-if="!isMobile" bordered :width="180" content-style="padding: 12px 0;">
                <div class="brand">QQ空间导出助手</div>
                <n-menu v-model:value="activeTab" :options="MENU_OPTIONS" :indent="18" />
            </n-layout-sider>

            <!-- 移动端顶部标签导航 -->
            <div v-if="isMobile" class="mobile-nav">
                <div class="mobile-brand">QQ空间导出助手</div>
                <div class="mobile-nav-scroll">
                    <div
                        v-for="item in MENU_OPTIONS"
                        :key="item.key"
                        class="mobile-nav-item"
                        :class="{ active: activeTab === item.key }"
                        @click="activeTab = item.key"
                    >{{ item.label }}</div>
                </div>
            </div>

            <!-- 内容区分三段：标题、可滚动正文、保存区。
                 标题与保存区放在滚动区之外，而不是用 sticky——后者会因滚动容器自身的内边距
                 让内容从吸顶/吸底元素的边缘穿出来 -->
            <n-layout content-style="display: flex; flex-direction: column; height: 100vh; overflow: hidden;">
                <div v-if="loading" class="page-body">正在读取设置...</div>

                <template v-else>
                    <div class="page-head">{{ currentTitle }}</div>

                    <div class="page-body">
                        <!-- 公共设置 -->
                        <div v-show="activeTab === 'Common'">
                            <!-- 全局设置：文案格式 / 空间链接 是全局统一项，无继承/覆盖概念，单独成区避免与「通用默认」混淆 -->
                            <n-divider title-placement="left">全局设置</n-divider>
                            <n-alert type="warning" :show-icon="true" class="block-alert">
                                以下为全局统一设置，所有模块都按此执行，无法在各模块页签中单独修改。
                            </n-alert>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <n-form-item label="导出文案格式">
                                    <n-select v-model:value="config.Common.exportType" :options="GLOBAL_EXPORT_OPTIONS" style="width: 160px;" />
                                    <span class="hint">HTML 查看器 / MarkDown 文件；全局统一，所有模块均按此导出，不可单独修改</span>
                                </n-form-item>
                                <n-form-item label="空间用户链接">
                                    <n-switch v-model:value="config.Common.hasUserLink" />
                                    <span class="hint">生成内容中是否包含其他空间用户的链接（MarkDown 导出与查看器生效）；全局统一</span>
                                </n-form-item>
                                <n-form-item label="明细采集并发">
                                    <n-input-number v-model:value="config.Common.itemDetailConcurrency" :min="1" :max="30" style="width: 160px;" />
                                    <span class="hint">采集每条内容的评论/点赞/访客时的最大并发请求数；请求易限流的大号可下调（如 3），求快可上调（默认 20）；全局统一</span>
                                </n-form-item>
                            </n-form>

                            <n-divider title-placement="left">通用默认</n-divider>
                            <n-alert type="info" :show-icon="true" class="block-alert">
                                以下为各模块默认采用的设置；每个模块可在各自页签里关闭对应开关，单独覆盖其中某一项。
                            </n-alert>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <n-form-item label="增量备份范围">
                                    <n-select v-model:value="config.Common.Increment.IncrementType" :options="INCREMENT_OPTIONS" style="width: 160px;" />
                                    <span class="hint">全部数据 / 上次之后 / 指定时间；各模块默认采用此处设置</span>
                                </n-form-item>
                                <n-form-item v-if="config.Common.Increment.IncrementType === 'Custom'" label="增量起始时间">
                                    <n-date-picker v-model:formatted-value="config.Common.Increment.IncrementTime" value-format="yyyy-MM-dd HH:mm:ss" type="datetime" style="width: 220px;" />
                                    <span class="hint">仅采集该时间之后发布的内容</span>
                                </n-form-item>

                                <n-form-item label="获取全部评论">
                                    <n-switch v-model:value="config.Common.Comments.isGet" />
                                    <span class="hint">开启后拉取全部评论；部分模块（说说/日志/日记/分享）列表自带少量首页评论，关闭时仍可能保留</span>
                                </n-form-item>
                                <n-form-item v-if="config.Common.Comments.isGet" label="评论每页数量">
                                    <n-input-number v-model:value="config.Common.Comments.pageSize" :min="1" :max="100" style="width: 160px;" />
                                </n-form-item>
                                <interval-setting v-if="config.Common.Comments.isGet" :seconds="config.Common.Comments.randomSeconds" label="评论请求间隔" />

                                <n-form-item v-if="config.Common.exportType !== 'MarkDown'" label="获取全部点赞">
                                    <n-switch v-model:value="config.Common.Like.isGet" />
                                    <span class="hint">仅备份类型为 HTML 时写入</span>
                                </n-form-item>
                                <interval-setting v-if="config.Common.Like.isGet && config.Common.exportType !== 'MarkDown'" :seconds="config.Common.Like.randomSeconds" label="点赞请求间隔" />

                                <n-form-item v-if="config.Common.exportType !== 'MarkDown'" label="获取内容访客">
                                    <n-switch v-model:value="config.Common.Visitor.isGet" />
                                    <span class="hint">嵌入各内容条目的访客记录（区别于「访客」模块的空间访客列表），仅 HTML 时写入</span>
                                </n-form-item>
                                <n-form-item v-if="config.Common.Visitor.isGet && config.Common.exportType !== 'MarkDown'" label="内容访客每页">
                                    <n-input-number v-model:value="config.Common.Visitor.pageSize" :min="1" style="width: 160px;" />
                                </n-form-item>
                                <interval-setting v-if="config.Common.Visitor.isGet && config.Common.exportType !== 'MarkDown'" :seconds="config.Common.Visitor.randomSeconds" label="内容访客间隔" />

                            </n-form>

                            <n-divider title-placement="left">媒体下载</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <!-- 文案打包方式选项已废弃：产出方式由运行环境能力决定（支持直写目录则直写、否则回退 ZIP），用户无需手动选择 -->
                                <n-form-item label="媒体处理方式">
                                    <n-select
                                        v-model:value="config.Common.mediaMode"
                                        :options="MEDIA_MODE_OPTIONS"
                                        style="width: 200px;"
                                    />
                                    <span class="hint">图片/视频的处理方式：下载到本地可离线查看，外链仅临时预览</span>
                                </n-form-item>
                                <n-alert v-if="!isDownloadMedia" type="warning" :show-icon="true" class="block-alert">
                                    不会下载任何媒体文件，备份内容只是引用 QQ 空间的在线地址：一旦空间注销、相册权限变更或腾讯回收链接，已备份内容里的图片与视频将全部无法查看且无法补救。仅建议临时预览使用，长期存档请选「下载到本地」。
                                </n-alert>
                                <n-form-item v-if="isDownloadMedia" label="媒体下载方式">
                                    <n-select
                                        v-model:value="config.Common.downloadType"
                                        :options="downloadTypeOptions"
                                        style="width: 200px;"
                                    />
                                    <span class="hint">{{ downloaderHint }}</span>
                                </n-form-item>
                                <n-alert
                                    v-if="isDiskDownload"
                                    type="info"
                                    :show-icon="true"
                                    class="block-alert"
                                >
                                    助手直写目录：媒体由助手逐个请求并写入备份目录（与文案同目录、一步到位），无需手动合并；按需在「追加引用来源」中配置域名以绕过防盗链。媒体数量极大、需要更高下载并行时，可改用 Aria2协议下载器（改用后媒体落在 Aria2 目录，需自行合并回备份目录）。
                                </n-alert>
                                <n-alert
                                    v-if="isDirectory && isExternalDownloader"
                                    type="warning"
                                    :show-icon="true"
                                    class="block-alert"
                                >
                                    文案写入你选定的目录，但媒体文件由外部下载器保存在它自己的目录，备份完需自行把媒体文件合并回备份目录，否则查看备份内容时，文案（如说说）中的图片/视频将无法显示。希望一步到位请选「助手直写目录」。
                                </n-alert>
                                <n-alert
                                    v-if="isDownloadMedia && dt === 'Browser'"
                                    type="warning"
                                    :show-icon="true"
                                    class="block-alert"
                                >
                                    请关闭浏览器设置中的「下载前询问每个文件的保存位置」，否则备份时每个文件都会弹出保存对话框，需逐个手动确认。Chrome 路径：设置 → 下载内容 → 关闭「下载前询问每个文件的保存位置」。
                                </n-alert>

                                <n-form-item v-if="showFileSuffix" label="图片类型识别">
                                    <n-switch v-model:value="config.Common.isAutoFileSuffix" />
                                    <span class="hint">自动识别说说、日志、日记、留言、收藏图片的后缀名，将延长备份时间</span>
                                </n-form-item>
                                <n-form-item v-if="showFileSuffix && config.Common.isAutoFileSuffix" label="类型识别超时">
                                    <n-input-number v-model:value="config.Common.autoFileSuffixTimeOut" :min="1" style="width: 160px;" />
                                    <span class="hint">识别超时秒数，超时则文件无后缀名</span>
                                </n-form-item>
                                <n-form-item v-if="showFileSuffix && config.Common.isAutoFileSuffix" label="类型识别并发">
                                    <n-input-number v-model:value="config.Common.suffixProbeConcurrency" :min="1" :max="50" style="width: 160px;" />
                                    <span class="hint">识别图片/视频后缀时的最大并发请求数；只读文件头不下载正文，CDN 限流宽松，可设得比条目明细并发高（默认 10）</span>
                                </n-form-item>

                                <n-form-item v-if="showDownloadThread" label="文件下载并发">
                                    <n-input-number v-model:value="config.Common.downloadThread" :min="1" style="width: 160px;" />
                                    <span class="hint">同时添加的任务数（不同下载器并发上限不同，请按需填写）</span>
                                </n-form-item>
                                <n-form-item v-if="showDownloadSleep" label="文件下载间隔">
                                    <n-input-number v-model:value="config.Common.downloadSleep" :min="0" style="width: 160px;" />
                                    <span class="hint">每批下载任务之间的间隔秒数；用第三方 Aria2协议下载器（如 Motrix/Motrix Next 等）且相片较多时建议设大</span>
                                </n-form-item>

                                <n-form-item v-if="showReferer" label="追加引用来源">
                                    <n-button size="small" @click="openRefererEditor">管理引用来源</n-button>
                                    <span class="hint">已配置 {{ refererCount }} 个域名；命中这些域名的请求会自动带上引用来源，绕过防盗链。下载因缺少引用来源失败时，助手会自动把该域名加入此列表并重试一次</span>
                                </n-form-item>

                                <template v-if="showAria2">
                                    <n-form-item label="Aria2 RPC" required>
                                        <n-input v-model:value="config.Common.Aria2.rpc" style="max-width: 320px;" placeholder="http://localhost:6800/jsonrpc" />
                                        <span class="hint">RPC 地址形如 <code>http://localhost:&lt;端口&gt;/jsonrpc</code>。常见客户端默认端口：Aria2 <b>6800</b> / Motrix <b>16800</b> / Motrix Next <b>29148</b>（以上均为各客户端默认值，请按实际填写）。点「保存设置」时会自动测试连接。</span>
                                    </n-form-item>
                                    <n-form-item label="Aria2 令牌">
                                        <n-input v-model:value="config.Common.Aria2.token" type="password" show-password-on="click" style="max-width: 320px;" placeholder="RPC 密钥（可空）" />
                                    </n-form-item>
                                    <n-form-item label="Aria2 下载目录" required>
                                        <n-input v-model:value="config.Common.Aria2.dir" style="max-width: 320px;" placeholder="请填写绝对路径，如 D:/下载/Aria2" />
                                        <span class="hint">必填。Aria2 下载文件存放的根目录（绝对路径），支持 <code>/</code> 或 <code>\</code> 分隔。<b>第三方客户端（如 Motrix）留空会报错</b>，原生 Aria2 留空则落在其自身默认目录；统一填写绝对路径后可保证文件都存放到你指定的位置。备份完需自行把该目录下的媒体文件合并回备份目录。</span>
                                    </n-form-item>
                                </template>

                                <n-form-item label="头像下载地址">
                                    <n-select
                                        v-model:value="config.Common.AvatarHost"
                                        :options="AVATAR_HOST_OPTIONS"
                                        style="width: 200px;"
                                    />
                                    <span class="hint">避免头像服务器故障导致无法下载，-1 为不指定</span>
                                </n-form-item>

                            </n-form>

                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <n-divider title-placement="left">请求重试</n-divider>
                                <n-form-item label="列表重试次数">
                                    <n-input-number v-model:value="config.Common.listRetryCount" :min="0" style="width: 160px;" />
                                    <span class="hint">超时/异常时的重试次数，达到后采集失败</span>
                                </n-form-item>
                                <n-form-item label="列表重试间隔">
                                    <n-input-number v-model:value="config.Common.listRetrySleep" :min="1" style="width: 160px;" />
                                    <span class="hint">每次重试的间隔秒数</span>
                                </n-form-item>
                                <n-form-item label="网络请求超时">
                                    <n-input-number v-model:value="config.Common.requestTimeout" :min="0" style="width: 160px;" />
                                    <span class="hint">单次网络请求超时秒数，超时后走重试；0 表示不限时</span>
                                </n-form-item>
                                <n-divider title-placement="left">限流退避</n-divider>
                                <n-form-item label="稍候重试请求">
                                    <n-select
                                        v-model:value="config.Common.RestSleepUrls"
                                        multiple
                                        :options="REST_SLEEP_GROUPS"
                                        :max-tag-count="4"
                                        style="max-width: 480px;"
                                    />
                                    <span class="hint">配置的请求才使用「稍候重试间隔」，一般无需配置</span>
                                </n-form-item>
                                <n-form-item label="稍候重试次数">
                                    <n-input-number v-model:value="config.Common.waitCount" :min="0" style="width: 160px;" />
                                    <span class="hint">空间返回「使用人数过多」时的重试次数，超过后该次采集失败并忽略</span>
                                </n-form-item>
                                <n-form-item label="稍候重试间隔">
                                    <n-input-number v-model:value="config.Common.waitTime" :min="1" style="width: 160px;" />
                                    <span class="hint">空间返回「使用人数过多」时的重试间隔秒数</span>
                                </n-form-item>
                            </n-form>

                            <n-divider title-placement="left">🪟 弹窗行为</n-divider>
                            <div class="launch-head">
                                <div class="launch-title">访问 QQ 空间时，助手希望怎么提醒您？</div>
                                <div class="launch-subtitle">根据您的使用习惯，选择最不打扰、又不会忘记备份的策略</div>
                            </div>
                            <div class="launch-cards">
                                <label
                                    v-for="opt in LAUNCH_BEHAVIOR_OPTIONS"
                                    :key="opt.value"
                                    class="launch-card-item"
                                    :class="{ active: launchBehavior === opt.value, disabled: launchSaving, recommend: !!opt.recommend }"
                                    @click="() => !launchSaving && (launchBehavior = opt.value)"
                                >
                                    <div class="launch-icon">{{ opt.icon }}</div>
                                    <div class="launch-main">
                                        <div class="launch-top">
                                            <div class="launch-label">{{ opt.label }}</div>
                                            <span v-if="opt.recommend" class="launch-badge-recommend">推荐</span>
                                        </div>
                                        <div class="launch-desc">{{ opt.desc }}</div>
                                    </div>
                                    <div class="launch-radio" @click.stop>
                                        <n-radio
                                            :value="launchBehavior"
                                            :checked-value="opt.value"
                                            :disabled="launchSaving"
                                            @update:checked="(checked) => checked && (launchBehavior = opt.value)"
                                        />
                                    </div>
                                </label>
                            </div>

                            <div class="launch-footer">
                                <span v-if="pinHintDismissCount > 0" class="launch-hint">
                                    📌 固定图标引导已关闭 {{ pinHintDismissCount }} 次
                                    <template v-if="launchBehavior === 'show_pin_hint_only'">
                                        ，再关 {{ Math.max(0, PIN_HINT_AUTO_STOP_THRESHOLD - pinHintDismissCount) }} 次将自动永久关闭所有弹窗
                                    </template>
                                </span>
                                <n-button
                                    size="small"
                                    type="default"
                                    :loading="launchSaving"
                                    @click="onResetLaunchBehavior"
                                >
                                    重置为默认行为
                                </n-button>
                            </div>
                        </div>

                        <!-- 说说 -->
                        <div v-show="activeTab === 'Messages'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Messages" />
                                <interval-setting :seconds="config.Messages.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Messages.pageSize" :min="20" :max="40" style="width: 160px;" />
                                </n-form-item>

                                <n-form-item label="刷新微信坐标">
                                    <n-switch v-model:value="config.Messages.refreshWeChatLbs" />
                                    <span class="hint">微信朋友圈同步到空间的说说：坐标是手机 GPS，会转成火星坐标并反查地点</span>
                                </n-form-item>
                                <n-form-item label="普通说说地点">
                                    <n-switch v-model:value="config.Messages.refreshAllLbs" />
                                    <span class="hint">其它说说也按坐标反查地点；坐标本身已是火星坐标，不再转换，只更新地点名</span>
                                </n-form-item>
                                <n-form-item v-if="config.Messages.refreshWeChatLbs || config.Messages.refreshAllLbs" label="腾讯地图 Key" required>
                                    <div class="map-key-box">
                                        <n-input v-model:value="config.Dev.Maps.TxKey" type="password" show-password-on="click" placeholder="用于坐标转换与坐标转描述" />
                                        <span v-if="needMapKey" class="hint warn-hint">必填。未填写时不会刷新，请到<a href="https://lbs.qq.com/" target="_blank">腾讯位置服务控制台</a>申请</span>
                                        <span v-else class="hint">仅用于本项刷新，不会用于其它用途</span>
                                        <span class="hint">配额：逆地址解析与坐标转换各 6,000 次/日（个人开发者，同一账号所有 Key 共享），超限当天会失败并跳过；微信说说每条要转坐标 + 反查共 2 次调用，普通说说只反查 1 次；每条间隔 0.15 秒，全量 3000 条含网络往返约需 20–30 分钟</span>
                                        <span class="hint warn-hint">会改地点名：反查结果会覆盖原有地点名，同一地点在腾讯侧改名后备份里也会跟着变（如「A 小区」→「B 广场」）；已有备份不会回填</span>
                                    </div>
                                </n-form-item>
                                <n-form-item label="语音说说">
                                    <!-- 功能已下线：只保留条目让用户知道它存在，开关恒为关闭且不可操作 -->
                                    <n-switch :value="false" disabled />
                                    <span class="hint">QQ 空间已下线语音说说功能，历史数据也无法正常下载；该开关仅作说明，始终保持关闭</span>
                                </n-form-item>
                                <n-form-item label="屏蔽关键词">
                                    <n-switch v-model:value="config.Messages.isFilterKeyword" />
                                    <span class="hint">命中关键词的说说不备份（支持 && 组合）</span>
                                </n-form-item>
                                <n-form-item v-if="config.Messages.isFilterKeyword" label="屏蔽词">
                                    <n-button size="small" @click="openKeywordEditor">管理屏蔽词</n-button>
                                    <span class="hint">已配置 {{ keywordCount }} 条；单个关键词内可用 A&amp;&amp;B 表示两者同时命中才屏蔽，如：免费&amp;&amp;包邮</span>
                                </n-form-item>
                            </n-form>
                            <n-divider title-placement="left">评论</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <comments-setting :comments="config.Messages.Comments" :min="10" :max="20" />
                            </n-form>
                            <n-divider title-placement="left">其他</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <like-setting :like="config.Messages.Like" />
                                <visitor-setting :visitor="config.Messages.Visitor" />
                            </n-form>
                        </div>

                        <!-- 日志 -->
                        <div v-show="activeTab === 'Blogs'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Blogs" />
                                <interval-setting :seconds="config.Blogs.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Blogs.pageSize" :min="1" style="width: 160px;" />
                                </n-form-item>
                            </n-form>
                            <n-divider title-placement="left">评论</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <comments-setting :comments="config.Blogs.Comments" />
                            </n-form>
                            <n-divider title-placement="left">其他</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <like-setting :like="config.Blogs.Like" />
                                <visitor-setting :visitor="config.Blogs.Visitor" />
                            </n-form>
                        </div>

                        <!-- 日记 -->
                        <div v-show="activeTab === 'Diaries'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Diaries" />
                                <interval-setting :seconds="config.Diaries.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Diaries.pageSize" :min="1" style="width: 160px;" />
                                </n-form-item>
                            </n-form>
                            <n-divider title-placement="left">评论</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <comments-setting :comments="config.Diaries.Comments" />
                            </n-form>
                            <n-divider title-placement="left">其他</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <like-setting :like="config.Diaries.Like" />
                                <visitor-setting :visitor="config.Diaries.Visitor" />
                            </n-form>
                        </div>

                        <!-- 留言 -->
                        <div v-show="activeTab === 'Boards'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Boards" />
                                <interval-setting :seconds="config.Boards.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Boards.pageSize" :min="10" :max="20" style="width: 160px;" />
                                </n-form-item>
                            </n-form>
                        </div>

                        <!-- 收藏 -->
                        <div v-show="activeTab === 'Favorites'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Favorites" />
                                <interval-setting :seconds="config.Favorites.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Favorites.pageSize" :min="20" :max="40" style="width: 160px;" />
                                </n-form-item>
                            </n-form>
                        </div>

                        <!-- 访客 -->
                        <div v-show="activeTab === 'Visitors'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Visitors" />
                                <interval-setting :seconds="config.Visitors.randomSeconds" label="列表间隔" />
                            </n-form>
                        </div>

                        <!-- 视频 -->
                        <div v-show="activeTab === 'Videos'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Videos" />
                                <interval-setting :seconds="config.Videos.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Videos.pageSize" :min="1" style="width: 160px;" />
                                </n-form-item>
                                <n-form-item label="归类方式">
                                    <n-select v-model:value="config.Videos.fileStructureType" :options="STRUCTURE_OPTIONS" style="width: 160px;" />
                                    <span class="hint">视频文件的归类存放方式</span>
                                </n-form-item>
                                <n-form-item label="文件名方式">
                                    <n-select v-model:value="config.Videos.RenameType" :options="VIDEO_RENAME_OPTIONS" style="width: 200px;" />
                                    <span class="hint">链接指纹=按视频地址哈希的稳定命名（支持去重）</span>
                                </n-form-item>
                            </n-form>
                            <n-divider title-placement="left">评论与点赞</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <comments-setting :comments="config.Videos.Comments" />
                                <like-setting :like="config.Videos.Like" note="且仅支持关联说说的视频" />
                            </n-form>
                        </div>

                        <!-- 好友 -->
                        <div v-show="activeTab === 'Friends'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <interval-setting :seconds="config.Friends.randomSeconds" label="查询间隔" />
                                <n-form-item label="分组排序">
                                    <n-select v-model:value="config.Friends.SortType" :options="FRIENDS_SORT_OPTIONS" style="width: 160px;" />
                                    <span class="hint">QQ 排序：沿用 QQ 的分组顺序；助手排序：按字母排序</span>
                                </n-form-item>
                                <n-form-item label="互动信息">
                                    <n-switch v-model:value="config.Friends.Interactive" />
                                    <span class="hint">好友添加时间、是否单向好友、亲密度、共同好友与群组；数据来自QQ空间而非QQ，仅供参考</span>
                                </n-form-item>
                                <n-form-item label="空间权限">
                                    <n-switch v-model:value="config.Friends.ZoneAccess" />
                                    <span class="hint">判断是否对好友空间有访问权限</span>
                                </n-form-item>
                                <n-form-item label="特别关心">
                                    <n-switch v-model:value="config.Friends.SpecialCare" />
                                    <span class="hint">获取自己特别关心了哪些好友</span>
                                </n-form-item>
                            </n-form>
                        </div>

                        <!-- 分享 -->
                        <div v-show="activeTab === 'Shares'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Shares" />
                                <interval-setting :seconds="config.Shares.randomSeconds" label="列表间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Shares.pageSize" :min="10" :max="100" style="width: 160px;" />
                                </n-form-item>
                                <interval-setting :seconds="config.Shares.Info.randomSeconds" label="内容间隔" />
                            </n-form>
                            <n-divider title-placement="left">评论</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <comments-setting :comments="config.Shares.Comments" :min="10" :max="20" />
                            </n-form>
                            <n-divider title-placement="left">其他</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <like-setting :like="config.Shares.Like" />
                                <visitor-setting :visitor="config.Shares.Visitor" />
                                <n-form-item label="分享来源">
                                    <n-button size="small" @click="openSourceEditor">管理来源规则</n-button>
                                    <span class="hint">已配置 {{ sourceCount }} 条；用于把分享链接识别为来源名称（如 QQ 音乐、哔哩哔哩）</span>
                                </n-form-item>
                            </n-form>
                        </div>

                        <!-- 相册 -->
                        <div v-show="activeTab === 'Photos'">
                            <n-divider title-placement="left">基础</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <increment-setting :module="config.Photos" />
                                <like-setting :like="config.Photos.Like" />
                            </n-form>
                            <n-divider title-placement="left">相册配置</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <interval-setting :seconds="config.Photos.randomSeconds" label="查询间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Photos.pageSize" :min="10" :max="3000" style="width: 160px;" />
                                </n-form-item>
                                <comments-setting :comments="config.Photos.Comments" />
                                <visitor-setting :visitor="config.Photos.Visitor" />
                            </n-form>
                            <n-divider title-placement="left">相片配置</n-divider>
                            <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth" :show-feedback="false">
                                <n-form-item label="归类方式">
                                    <n-select v-model:value="config.Photos.Images.fileStructureType" :options="PHOTO_STRUCTURE_OPTIONS" style="width: 160px;" />
                                    <span class="hint">基于相册的相片文件归类存放方式</span>
                                </n-form-item>
                                <n-form-item label="文件名方式">
                                    <n-select v-model:value="config.Photos.Images.RenameType" :options="PHOTO_RENAME_OPTIONS" style="max-width: 460px;" />
                                    <span class="hint">链接指纹=按相片地址哈希的稳定命名（支持去重）</span>
                                </n-form-item>
                                <n-form-item label="列表类型">
                                    <n-select v-model:value="config.Photos.Images.listType" :options="PHOTO_LIST_TYPE_OPTIONS" style="width: 160px;" />
                                    <span class="hint">详情列表无每页上限，且已含详情与视频信息</span>
                                </n-form-item>
                                <interval-setting :seconds="config.Photos.Images.randomSeconds" label="查询间隔" />
                                <n-form-item label="每页条数">
                                    <n-input-number v-model:value="config.Photos.Images.pageSize" :min="10" :max="90" style="width: 160px;" />
                                </n-form-item>
                                <n-form-item label="相片质量">
                                    <n-select v-model:value="config.Photos.Images.exifType" :options="PHOTO_EXIF_OPTIONS" style="width: 160px;" />
                                    <span class="hint">默认原图（含 Exif），原图不存取高清</span>
                                </n-form-item>
                                <n-form-item label="相片详情">
                                    <n-switch v-model:value="config.Photos.Images.Info.isGet" />
                                    <span class="hint">获取关联视频/原图/免权限地址/上传地点等</span>
                                </n-form-item>
                                <template v-if="config.Photos.Images.Info.isGet">
                                    <interval-setting :seconds="config.Photos.Images.Info.randomSeconds" label="详情间隔" />
                                    <n-form-item label="详情条目">
                                        <n-input-number v-model:value="config.Photos.Images.Info.pageSize" :min="10" :max="1000" style="width: 160px;" />
                                    </n-form-item>
                                </template>
                                <n-form-item label="相片视频">
                                    <n-switch v-model:value="config.Photos.Images.isGetVideo" />
                                    <span class="hint">不获取相片详情时，可单独控制是否下载相片关联的视频</span>
                                </n-form-item>
                                <n-form-item label="相片预览">
                                    <n-switch v-model:value="config.Photos.Images.isGetPreview" />
                                    <span class="hint">下载缩略图用于列表展示</span>
                                </n-form-item>
                                <comments-setting :comments="config.Photos.Images.Comments" />
                            </n-form>
                        </div>

                        <!-- 工具 -->
                        <div v-show="activeTab === 'Tools'">
                            <tools-panel />
                        </div>

                        <!-- 关于 -->
                        <div v-show="activeTab === 'About'">
                            <about-panel />
                        </div>
                    </div>

                    <div v-if="showSaveBar" class="page-foot">
                        <n-button type="primary" :loading="saving" @click="onSave">保存设置</n-button>
                        <n-button quaternary type="error" @click="onReset">重置设置</n-button>
                        <span
                            v-if="saveStatus.show"
                            class="hint"
                            :class="saveStatus.type === 'success' ? 'ok-hint' : 'error-hint'"
                        >{{ saveStatus.msg }}</span>
                        <span v-else-if="dirty" class="hint warn-hint">有未保存的改动</span>
                    </div>
                </template>
            </n-layout>
        </n-layout>

        <!-- 分享来源识别规则编辑器 -->
        <n-modal
            v-model:show="showSourceEditor"
            preset="card"
            title="分享来源规则"
            style="width: 760px;"
        >
            <n-alert type="info" :show-icon="true" class="block-alert">
                分享链接会自上而下逐条匹配，命中第一条即取其来源名称，因此<b>越具体的规则请排在越前面</b>
                （如 zone.qq.com/secret 必须在 qzone.qq.com 之前）。规则按正则匹配，常见写法直接填域名片段。
            </n-alert>
            <div class="source-editor">
                <n-dynamic-input
                    v-model:value="sourceDraft"
                    :on-create="() => ({ name: '', regulars: '' })"
                >
                    <template #default="{ value }">
                        <div class="source-row">
                            <n-input v-model:value="value.name" placeholder="来源名称，如：QQ音乐" />
                            <n-input v-model:value="value.regulars" placeholder="匹配规则，如：y.qq.com" />
                        </div>
                    </template>
                </n-dynamic-input>
            </div>
            <template #footer>
                <div class="modal-footer">
                    <span class="hint">名称或规则为空的行保存时会被丢弃；确定后仍需点页面下方的「保存设置」</span>
                    <n-button size="small" @click="resetSourceDraft">恢复默认</n-button>
                    <n-button size="small" @click="showSourceEditor = false">取消</n-button>
                    <n-button size="small" type="primary" @click="applySourceEditor">确定</n-button>
                </div>
            </template>
        </n-modal>
        <!-- 说说屏蔽词编辑器 -->
        <n-modal
            v-model:show="showKeywordEditor"
            preset="card"
            title="说说屏蔽词"
            style="width: 560px;"
        >
            <n-alert type="info" :show-icon="true" class="block-alert">
                说说内容命中任一关键词即不备份；单个关键词内可用 <b>A&amp;&amp;B</b> 表示两者同时出现才屏蔽，如：免费&amp;&amp;包邮。
            </n-alert>
            <div class="source-editor">
                <n-dynamic-input
                    v-model:value="keywordDraft"
                    placeholder="关键词，如：促销 或 现货&amp;&amp;送礼"
                    :on-create="() => ''"
                />
            </div>
            <template #footer>
                <div class="modal-footer">
                    <span class="hint">空行与重复词保存时会自动清理；确定后仍需点页面下方的「保存设置」</span>
                    <n-button size="small" @click="resetKeywordDraft">恢复默认</n-button>
                    <n-button size="small" @click="showKeywordEditor = false">取消</n-button>
                    <n-button size="small" type="primary" @click="applyKeywordEditor">确定</n-button>
                </div>
            </template>
        </n-modal>
        <!-- 追加引用来源编辑器 -->
        <n-modal
            v-model:show="showRefererEditor"
            preset="card"
            title="追加引用来源"
            style="width: 560px;"
        >
            <n-alert type="info" :show-icon="true" class="block-alert">
                下载地址命中这里的域名时，请求会自动带上引用来源，用于绕过部分
                CDN 的防盗链（常见于视频）。填写域名片段即可，如 <b>gtimg.com</b>。
                助手直写目录模式下，若某文件因缺少引用来源（403/401）下载失败，会自动把该域名加入此列表并注册规则后重试一次（仅一次，避免死循环），无需手动添加。
            </n-alert>
            <div class="source-editor">
                <n-dynamic-input
                    v-model:value="refererDraft"
                    placeholder="域名片段，如：gtimg.com"
                    :on-create="() => ''"
                />
            </div>
            <template #footer>
                <div class="modal-footer">
                    <span class="hint">空行与重复项保存时会自动清理；确定后仍需点页面下方的「保存设置」</span>
                    <n-button size="small" @click="resetRefererDraft">恢复默认</n-button>
                    <n-button size="small" @click="showRefererEditor = false">取消</n-button>
                    <n-button size="small" type="primary" @click="applyRefererEditor">确定</n-button>
                </div>
            </template>
        </n-modal>
    </n-config-provider>
</template>

<style scoped>
.brand {
    font-weight: bold;
    padding: 4px 18px 12px;
    color: #2080f0;
}
/* tab 标题样式见 .page-head；各 tab 不再各写一份标题 */
/* 首个分组标题紧跟正文区顶部，不留过大空白 */
:deep(.n-divider:first-child) {
    margin-top: 0;
}
/* 大项次标题：把分割线改造为带左侧色条的区块标题，与配置项明确区分；
   并跟随吸顶（负边距 + 白底撑满宽度，避免滚动内容从两侧与上方露出） */
:deep(.n-divider:not(.n-divider--vertical)) {
    position: sticky;
    top: 0;
    z-index: 8;
    margin: 22px -28px 16px;
    padding: 10px 28px;
    height: auto;
    background: #fff;
}
:deep(.n-divider .n-divider__line) {
    display: none;
}
/* 紧跟 tab 标题的首个分组标题不留过大空白 */
h3 + :deep(.n-divider) {
    margin-top: 4px;
}
:deep(.n-divider .n-divider__title) {
    display: block;
    width: 100%;
    margin: 0;
    padding: 8px 12px;
    box-sizing: border-box;
    background: #f4f7f6;
    border-left: 3px solid #2080f0;
    border-radius: 2px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
}
/* 配置项间距（已关闭校验占位，需手动给间距） */
:deep(.n-form-item) {
    margin-bottom: 16px;
}
.ml {
    margin-left: 10px;
}
.tip-alert {
    margin: 4px 0 14px;
    max-width: 620px;
}
/* 内容区标题：固定在滚动区上方 */
.page-head {
    flex: none;
    padding: 14px 28px 12px;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid #efeff5;
}
/* 可滚动的正文区（不留上内边距：否则内容会从吸顶的分组标题上方穿过） */
.page-body {
    flex: 1;
    overflow: auto;
    padding: 0 28px 20px;
}
/* 保存区：固定在底部，模块配置项再多也看得到按钮（本页不自动保存）。
   按钮靠左而非居中：居中时提示文字也参与居中，保存后提示一出现会把按钮挤走 */
.page-foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 28px;
    background: #fff;
    border-top: 1px solid #efeff5;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
/* 来源规则编辑器：条数较多，限高内滚动 */
.source-editor {
    max-height: 46vh;
    overflow: auto;
    padding-right: 6px;
}
.source-row {
    display: flex;
    gap: 10px;
    width: 100%;
}
.modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
}
/* 坐标刷新：Key 与多条说明竖排，说明不再挤成一行 */
.map-key-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 560px;
}
.map-key-box .hint {
    margin-left: 0;
}

.modal-footer .hint {
    flex: 1;
    margin-left: 0;
}

/* 移动端顶部导航 */
.mobile-nav {
    flex: none;
    background: #fff;
    border-bottom: 1px solid #efeff5;
}
.mobile-brand {
    font-weight: bold;
    padding: 10px 16px 6px;
    color: #2080f0;
    font-size: 16px;
}
.mobile-nav-scroll {
    display: flex;
    overflow-x: auto;
    padding: 0 8px 6px;
    gap: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}
.mobile-nav-scroll::-webkit-scrollbar {
    display: none;
}
.mobile-nav-item {
    flex: none;
    padding: 6px 14px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    color: #666;
    transition: background 0.2s, color 0.2s;
}
.mobile-nav-item.active {
    background: #f0fff4;
    color: #2080f0;
    font-weight: 600;
}

/* 移动端适配 */
@media (max-width: 767px) {
    .page-head {
        padding: 10px 16px 8px;
        font-size: 16px;
    }
    .page-body {
        padding: 0 16px 16px;
    }
    .page-foot {
        padding: 10px 16px;
        gap: 8px;
    }
    .page-foot .n-button {
        flex: 1;
    }
    /* 分组标题吸顶改为不吸顶，避免在移动端因滚动容器抖动 */
    :deep(.n-divider:not(.n-divider--vertical)) {
        position: static;
        margin: 16px -16px 12px;
        padding: 8px 16px;
    }
    :deep(.n-divider .n-divider__title) {
        font-size: 14px;
        padding: 6px 10px;
    }
    /* 配置项间距在移动端稍紧凑 */
    :deep(.n-form-item) {
        margin-bottom: 14px;
    }
    /* 所有控件在移动端自适应宽度 */
    :deep(.n-form-item .n-form-item-blank),
    :deep(.n-form-item .n-form-item-label) {
        width: 100% !important;
    }
    :deep(.n-select),
    :deep(.n-input),
    :deep(.n-input-number) {
        max-width: 100% !important;
    }
    /* 弹窗在移动端占 90% 宽度 */
    :deep(.n-modal) {
        width: 90vw !important;
        max-width: 90vw !important;
    }
    /* 提示文字在移动端换行更友好 */
    .hint {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.5;
    }
    /* 保存区文字换行 */
    .page-foot .hint {
        flex: 1;
    }
    /* 编辑器内输入框全宽 */
    .source-row {
        flex-direction: column;
    }
    .source-row .n-input {
        width: 100%;
    }
    .modal-footer {
        flex-wrap: wrap;
    }
    .modal-footer .hint {
        width: 100%;
        margin-bottom: 8px;
    }
    .modal-footer .n-button {
        flex: 1;
    }
    .tip-alert {
        max-width: 100%;
    }
}

/* ===== 弹窗行为（卡片式三选一） ===== */
.launch-head {
    margin: 6px 4px 12px;
}
.launch-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 2px;
}
.launch-subtitle {
    font-size: 12px;
    color: #6b7280;
}
.launch-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.launch-card-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.18s ease;
}
.launch-card-item:hover:not(.disabled) {
    border-color: #93c5fd;
    background: #f0f6ff;
}
.launch-card-item.active {
    border-color: #1d6fd4;
    background: #f0f6ff;
    box-shadow: 0 0 0 2px rgba(29, 111, 212, 0.12);
}
.launch-card-item.active.recommend {
    background: linear-gradient(180deg, #f0f6ff 0%, #ecfdf5 100%);
}
.launch-card-item.disabled {
    opacity: 0.55;
    cursor: not-allowed;
}
.launch-icon {
    font-size: 22px;
    line-height: 1.1;
    flex: none;
    margin-top: 2px;
}
.launch-main {
    flex: 1 1 auto;
    min-width: 0;
}
.launch-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
}
.launch-label {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    line-height: 1.35;
}
.launch-badge-recommend {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: 999px;
    background: #1d6fd4;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.6;
    flex: none;
}
.launch-desc {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.6;
}
.launch-radio {
    flex: none;
    padding-top: 2px;
}
.launch-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 18px;
    flex-wrap: wrap;
}
.launch-hint {
    font-size: 12px;
    color: #92400e;
    background: #fffbeb;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #fde68a;
}
</style>
