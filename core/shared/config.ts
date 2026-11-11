/**
 * options 页配置基础设施（P6-2）
 * 读写与内容脚本共享的 chrome.storage.sync（QZone_Config 结构），并复刻旧 options.js
 * 的保存副作用：declarativeNetRequest 动态规则重建、下载状态栏 UI 控制。
 *
 * 说明：加载时用 get(null) 取回完整已存配置（老用户已有全部模块设置），仅在缺失时
 * 用默认值兜底；保存时整体写回，因此即使当前 UI 只覆盖部分模块也不会丢失其它模块设置。
 *
 * 注意：本模块被 background 入口与 options 入口共同引用，因此置于 core/shared 下，
 * 避免 WXT 多入口隔离导致 background 无法解析 entrypoints/options 私有目录内的模块。
 */

import { SHARE_SOURCE_DEFAULTS } from './shareSources';
import { toPlain } from './plain';
// 公共默认值与三组下拉选项已下沉到 core/shared/backup-options（配置页/弹窗/popup/background
// 共用单一来源，防止默认值与文案在多处漂移），这里仅做 re-export，不改动现有 import 来源。
import {
    COMMON_DEFAULTS,
    DEFAULT_DOWNLOAD_TYPE,
    DOWNLOAD_TYPE_OPTIONS,
    MEDIA_MODE_OPTIONS,
} from './backup-options';
// 默认增量时间下沉到采集域（与 INCREMENT_FIELD_BY_MODULE 同处），避免 backup-options/config 循环依赖
import { DEFAULT_INCREMENT_TIME } from '../collector/increment';

export { COMMON_DEFAULTS, DOWNLOAD_TYPE_OPTIONS, MEDIA_MODE_OPTIONS, DEFAULT_INCREMENT_TIME };

/** 头像下载地址选项 */
export const AVATAR_HOST_OPTIONS = [
    { label: '不指定（-1）', value: -1 },
    { label: '默认算法（0）', value: 0 },
    { label: '固定地址 1', value: 1 },
    { label: '固定地址 2', value: 2 },
    { label: '固定地址 3', value: 3 },
    { label: '固定地址 4', value: 4 },
];

/** 稍候重试接口分组选项（值为 REST_URLS 的键） */
export const REST_SLEEP_GROUPS = [
    {
        type: 'group',
        label: '说说相关',
        key: 'g-msg',
        children: [
            { label: '说说列表', value: 'MESSAGES_LIST_URL' },
            { label: '说说全文', value: 'MESSAGES_DETAIL_URL' },
            { label: '更多图片', value: 'MESSAGES_IMAGES_URL' },
            { label: '语音详情', value: 'MESSAGES_VOICE_INFO_URL' },
        ],
    },
    {
        type: 'group',
        label: '日志相关',
        key: 'g-blog',
        children: [
            { label: '日志列表', value: 'BLOGS_LIST_URL' },
            { label: '日志全文', value: 'BLOGS_INFO_URL' },
            { label: '日记列表', value: 'DIARY_LIST_URL' },
            { label: '日记全文', value: 'DIARY_INFO_URL' },
        ],
    },
    {
        type: 'group',
        label: '相册相关',
        key: 'g-photo',
        children: [
            { label: '相册列表', value: 'ALBUM_LIST_URL' },
            { label: '相片列表', value: 'IMAGES_LIST_URL' },
            { label: '相片详情', value: 'IMAGES_INFO_URL' },
        ],
    },
    {
        type: 'group',
        label: '好友相关',
        key: 'g-friend',
        children: [
            { label: '无序好友', value: 'FRIENDS_LIST_URL' },
            { label: '有序好友', value: 'FRIENDS_SORT_LIST_URL' },
            { label: '互动信息', value: 'FRIENDSHIP_INFO_URL' },
            { label: '特别关心', value: 'SPECIAL_CARE_LIST_URL' },
        ],
    },
    {
        type: 'group',
        label: '评论相关',
        key: 'g-comment',
        children: [
            { label: '说说/视频评论', value: 'MESSAGES_VIDEOS_COMMONTS_URL' },
            { label: '日志/日记评论', value: 'BLOGS_COMMENTS_URL' },
            { label: '相册/相片评论', value: 'ALBUM_PHOTOS_COMMENTS_URL' },
            { label: '分享评论', value: 'SHARE_COMMENTS_URL' },
        ],
    },
    {
        type: 'group',
        label: '访客相关',
        key: 'g-visitor',
        children: [
            { label: '日志阅读', value: 'BLOGS_READ_COUNT_URL' },
            { label: '说说/日志浏览', value: 'VISITOR_SINGLE_LIST_URL' },
            { label: '相册浏览', value: 'VISITOR_SIMPLE_LIST_URL' },
            { label: '空间访客', value: 'VISITOR_MORE_LIST_URL' },
        ],
    },
    {
        type: 'group',
        label: '其它',
        key: 'g-other',
        children: [
            { label: '留言列表', value: 'BOARD_LIST_URL' },
            { label: '视频列表', value: 'VIDEO_LIST_URL' },
            { label: '收藏列表', value: 'FAVORITE_LIST_URL' },
            { label: '分享列表', value: 'SHARE_LIST_URL' },
            { label: '点赞列表', value: 'LIKE_LIST_URL' },
        ],
    },
];

/** 默认增量时间（定义见 ../collector/increment，这里 re-export） */

/** 说说默认屏蔽词（与 config.js 对齐） */
export const MESSAGES_FILTER_WORDS = [
    '促销', '下单', '抢购', '抢购价', '特价', '秒杀', '秒杀价', '包邮', '免费', '爽肤水',
    '唇膏', '面膜', '现货&&送礼', '优惠', '广受好评', '预购从速', '福利', '不计成本',
    '售完即止', '清货', '清货价', '清仓', '清仓价', '低价', '低价出售', '数量有限',
    '先到先得', '洗面奶', '眼霜', '免费领取', '0元抢购',
];

/** 各内容模块默认值（仅含 UI 绑定字段，深合并到已存配置，避免新用户绑定路径缺失） */
export const MODULE_DEFAULTS: Record<string, any> = {
    Messages: {
pageSize: 20, randomSeconds: { min: 1, max: 2 },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        isFilterKeyword: false, FilterKeyWords: MESSAGES_FILTER_WORDS,
        refreshWeChatLbs: false, refreshAllLbs: false, GetVoice: false,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Comments: { inherit: true, isGet: true, pageSize: 20, randomSeconds: { min: 1, max: 2 } },
        Visitor: { inherit: true, isGet: false, pageSize: 24, randomSeconds: { min: 1, max: 2 } },
    },
    Blogs: {
pageSize: 15,
        randomSeconds: { min: 1, max: 2 },
        Info: { randomSeconds: { min: 1, max: 2 } },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Comments: { inherit: true, isGet: true, pageSize: 50, randomSeconds: { min: 1, max: 2 } },
        Visitor: { inherit: true, isGet: false, pageSize: 24, randomSeconds: { min: 1, max: 2 } },
    },
    Diaries: {
pageSize: 15,
        randomSeconds: { min: 1, max: 2 },
        Info: { randomSeconds: { min: 1, max: 2 } },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Comments: { inherit: true, isGet: true, pageSize: 50, randomSeconds: { min: 1, max: 2 } },
        Visitor: { inherit: true, isGet: false, pageSize: 24, randomSeconds: { min: 1, max: 2 } },
    },
    Boards: {
pageSize: 20, randomSeconds: { min: 1, max: 2 },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
    },
    Favorites: {
pageSize: 30, randomSeconds: { min: 1, max: 2 },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
    },
    Visitors: {
randomSeconds: { min: 1, max: 2 },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
    },
    Videos: {
fileStructureType: 'File', RenameType: 'Default',
        randomSeconds: { min: 1, max: 2 }, pageSize: 20,
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Comments: { inherit: true, isGet: false, pageSize: 20, randomSeconds: { min: 1, max: 2 } },
    },
    Friends: {
randomSeconds: { min: 1, max: 2 },
        Interactive: true, ZoneAccess: true, SpecialCare: true,
        SortType: 'QQ',
    },
    // 注：Shares.SourceType 不列入默认（列表庞大），避免新用户保存时写入空数组覆盖内容脚本默认
    Shares: {
pageSize: 10, randomSeconds: { min: 1, max: 2 },
        Info: { randomSeconds: { min: 1, max: 2 } },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Comments: { inherit: true, isGet: true, pageSize: 20, randomSeconds: { min: 1, max: 2 } },
        Visitor: { inherit: true, isGet: false, pageSize: 24, randomSeconds: { min: 1, max: 2 } },
    },
    // 腾讯地图 Key 仅服务于说说的「刷新微信坐标」，UI 已并入该开关下方；
    // 存储结构仍保留 Dev.Maps，因为内容脚本（api.js 的 getLbsInfo / toTxLbs）读的就是该路径
    Dev: {
        Maps: { TxKey: '' },
    },
    Photos: {
pageSize: 3000, randomSeconds: { min: 1, max: 2 },
        Comments: { inherit: true, isGet: false, pageSize: 100, randomSeconds: { min: 2, max: 3 } },
        Images: {
            pageSize: 90, listType: 'Detail', randomSeconds: { min: 2, max: 4 },
            Comments: { inherit: true, isGet: false, pageSize: 100, randomSeconds: { min: 2, max: 3 } },
            exifType: 'raw',
            Info: { isGet: true, pageSize: 200, randomSeconds: { min: 1, max: 2 } },
            isGetVideo: true, isGetPreview: false,
            fileStructureType: 'File', RenameType: 'Default',
        },
        IncrementInherit: true, IncrementType: 'Full', IncrementTime: DEFAULT_INCREMENT_TIME,
        Like: { inherit: true, isGet: false, randomSeconds: { min: 1, max: 2 } },
        Visitor: { inherit: true, isGet: false, pageSize: 24, randomSeconds: { min: 1, max: 2 } },
    },
};

/**
 * 归一化为字符串数组
 * refererUrls / RestSleepUrls / FilterKeyWords 在 UI 与保存逻辑里都按数组处理，但历史
 * 配置可能被存成换行分隔的字符串或带数字键的对象，不归一化会在渲染时直接抛错（如
 * refererUrls.join is not a function），导致整个设置页白屏。
 */
function toStringArray(value: any): string[] {
    let list: any[] = [];
    if (Array.isArray(value)) {
        list = value;
    } else if (typeof value === 'string') {
        list = value.split(/[\r\n]+/);
    } else if (value && typeof value === 'object') {
        list = Object.values(value);
    }
    return list
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
}

/** 归一化配置中的字符串数组字段，遇到异常结构时留下日志便于追溯来源 */
function normalizeStringArray(owner: Record<string, any>, key: string, path: string): void {
    if (!Array.isArray(owner[key])) {
        console.warn('配置项 ' + path + ' 不是数组，已归一化：', owner[key]);
    }
    owner[key] = toStringArray(owner[key]);
}

/** 深合并：把默认值补到目标缺失的键（不覆盖已有值），返回新对象 */
function deepDefaults(target: any, defaults: any): any {
    const out = Object.assign({}, defaults, target);
    for (const key of Object.keys(defaults)) {
        const dv = defaults[key];
        if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
            out[key] = deepDefaults(target && target[key], dv);
        }
    }
    return out;
}

/** 从 chrome.storage.sync 读取完整配置（缺失项用默认兜底） */
export async function loadConfig(): Promise<Record<string, any>> {
    const stored = await chrome.storage.sync.get(null);
    const config: Record<string, any> = stored || {};
    // File（助手内部）下载模式已淘汰，历史配置归一化为新的默认下载方式（助手直写目录）
    config.Common = Object.assign({}, COMMON_DEFAULTS, config.Common || {});
    config.Common.Aria2 = Object.assign({}, COMMON_DEFAULTS.Aria2, config.Common.Aria2 || {});
    if (config.Common.downloadType === 'File') {
        config.Common.downloadType = DEFAULT_DOWNLOAD_TYPE;
    }
    // 旧版本用 downloadType='QZone' 表达「不下载媒体、内容引用外链」，现已抽为独立的
    // mediaMode，读取时一并归一化，否则下载器下拉框会因取不到该选项而显示为空
    if (config.Common.downloadType === 'QZone') {
        config.Common.mediaMode = 'Link';
        config.Common.downloadType = DEFAULT_DOWNLOAD_TYPE;
    }
    // 迅雷下载器（Thunder / Thunder_Clipboard / Thunder_Link）已下线，历史配置回落为默认下载方式
    if (config.Common.downloadType?.startsWith('Thunder')) {
        config.Common.downloadType = DEFAULT_DOWNLOAD_TYPE;
    }
    normalizeStringArray(config.Common, 'refererUrls', 'Common.refererUrls');
    normalizeStringArray(config.Common, 'RestSleepUrls', 'Common.RestSleepUrls');
    // 各内容模块深合并默认值，确保 UI 绑定路径存在
    for (const name of Object.keys(MODULE_DEFAULTS)) {
        config[name] = deepDefaults(config[name], MODULE_DEFAULTS[name]);
    }
    normalizeStringArray(config.Messages, 'FilterKeyWords', 'Messages.FilterKeyWords');
    // 语音说说已下线：设置页那个开关已改为只读，这里再把老配置里遗留的 true 归零，
    // 保证从任何入口读到的都是关闭态（采集端遇到 true 也只是白跑一次已失效的接口）
    config.Messages.GetVoice = false;
    // 「特殊分组」已废弃：它只是把查看器里的筛选条件搬到设置页，采集端从未读取过。
    // 老配置里可能还留着这个字段，统一删掉，避免以后有人误以为它还生效
    delete (config.Friends as Record<string, any>).SpecialGroup;
    // 分享来源识别规则：存储中缺失或为空时回退到默认列表。
    // 不能让空列表被保存回去，否则内容脚本读到空数组后默认值不再生效，分享来源将全部识别不出来
    if (!Array.isArray(config.Shares.SourceType) || config.Shares.SourceType.length === 0) {
        config.Shares.SourceType = SHARE_SOURCE_DEFAULTS.map((item) => ({ ...item }));
    }
    return config;
}


/** 保存配置到 chrome.storage.sync 并执行副作用 */
export async function saveConfig(config: Record<string, any>): Promise<void> {
    // 必须先转普通数据：UI 传过来的是 Vue 响应式对象，直接 set 会把数组存成
    // { "0": ... } 这样的对象（详见 plain.ts），内容脚本与 UI 重新读取时会报错
    const plain = toPlain<Record<string, any>>(config);
    await chrome.storage.sync.set(plain);
}

/** 测试 Aria2 连接（JSON-RPC aria2.getVersion） */
export async function testAria2(rpc: string, token?: string): Promise<{ ok: boolean; message: string }> {
    try {
        const params: unknown[] = [];
        if (token) {
            params.push('token:' + token);
        }
        const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'aria2.getVersion', id: Date.now(), params }),
        });
        const data = await res.json();
        if (data && data.result) {
            return { ok: true, message: 'Aria2 连接成功，版本 ' + data.result.version };
        }
        const errMsg = (data && data.error && data.error.message) || JSON.stringify(data && data.error || data);
        return { ok: false, message: 'Aria2 返回错误（可能是密钥不正确）：' + errMsg };
    } catch (error) {
        const msg = (error as Error).message || '';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            return { ok: false, message: '无法连接到 Aria2协议下载器。请确认：1) 已启动 Aria2协议下载器；2) RPC 地址正确（默认 http://localhost:6800/jsonrpc）；3) 未被防火墙拦截' };
        }
        return { ok: false, message: 'Aria2协议下载器连接出错：' + msg };
    }
}
