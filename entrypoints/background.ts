import '../core/shared/polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { registerKeepAlive, startKeepAlive, stopKeepAlive, KEEPALIVE_ALARM } from '../core/ext/keepalive';
import { BG_MSG, DLEvent } from '../core/shared/messages';
import { bytesToBase64 } from '../core/shared/utils';
import { loadConfig, saveConfig } from '../core/shared/config';
import { COMMON_DEFAULTS } from '../core/shared/backup-options';
import { buildRefererRule, buildHttpsUpgradeRule } from '../core/downloader/dnr-auto';
import { TaskQueue } from '../core/downloader/task-queue';
import { BackupDb } from '../core/store/backup-db';

/* ==================== 浏览器下载「强制重命名」预登记表 ====================
 * 背景：chrome.downloads.download({ filename }) 只是「建议名」，会被响应头
 *       Content-Disposition 覆盖；而 chrome.downloads.onDeterminingFilename 事件里的
 *       item.filename 只是 basename（目录已被剥掉）。
 * 方案：发起下载「之前」先把 url → 目标相对路径 登记到 dlPresetNames，钩子里优先取这里的值
 *       suggest 出去。Chrome 限制「每个扩展只能注册一个 onDeterminingFilename 监听器」，
 *       因此只在此处注册一个，直接消费本表的登记值（原 legacy/background.js 的逻辑已并入此处）。
 */
interface DLPresetItem { id?: number; url?: string; finalUrl?: string }

class DLPresetNames {
    /** url → 相对路径（下载发起前写入，钩子命中后即删） */
    private byUrl = new Map<string, string>();
    /** downloadId → 相对路径（download() 回调返回后写入，作为兜底） */
    private byId = new Map<number, string>();
    /** 防止异常场景下无限增长 */
    private static readonly MAX = 3000;

    /** 去掉查询串，用于匹配经 ?save=1&d=1 或 302 重定向后失配的下载地址 */
    private static stripQuery(u?: string): string {
        if (!u) return '';
        const q = u.indexOf('?');
        return q > 0 ? u.slice(0, q) : u;
    }

    /** 把文件名规整成 chrome.downloads 可接受的相对路径（禁止绝对路径/回溯/首尾非法字符） */
    static normalize(name: string): string {
        const parts = String(name || '')
            .replace(/\\/g, '/')
            .split('/')
            // 控制字符（\u0000-\u001f）为有意清洗项，禁用该规则
            // eslint-disable-next-line no-control-regex
            .map((seg) => seg.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+$/, '_').replace(/[. ]+$/, '').trim())
            .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..');
        return parts.join('/');
    }

    remember(url: string, filename: string): void {
        const safe = DLPresetNames.normalize(filename);
        if (!url || !safe) return;
        if (this.byUrl.size >= DLPresetNames.MAX) {
            const oldest = this.byUrl.keys().next();
            if (!oldest.done) this.byUrl.delete(oldest.value);
        }
        // 同时以「原始 URL」与「去查询串 URL」双键登记：下载经 ?save=1&d=1 或 302 重定向后，
        // onDeterminingFilename 拿到的 item.url 可能是最终地址（无查询串/域名不同），单键会失配
        // → 回落到 Content-Disposition 的 basename → 文件落到备份根目录（#4）。
        this.byUrl.set(url, safe);
        const base = DLPresetNames.stripQuery(url);
        if (base && base !== url) this.byUrl.set(base, safe);
    }

    rememberId(id: number, filename: string): void {
        const safe = DLPresetNames.normalize(filename);
        if (!(id > 0) || !safe) return;
        if (this.byId.size >= DLPresetNames.MAX) {
            const oldest = this.byId.keys().next();
            if (!oldest.done) this.byId.delete(oldest.value);
        }
        this.byId.set(id, safe);
    }

    /** 钩子调用：取出并清除登记（同一次下载只用一次） */
    take(item: DLPresetItem): string | undefined {
        const id = Number(item && item.id);
        if (id > 0 && this.byId.has(id)) {
            const v = this.byId.get(id);
            this.byId.delete(id);
            if (item.url) this.byUrl.delete(item.url);
            return v;
        }
        const candidates = [item && item.url, item && item.finalUrl].filter(Boolean) as string[];
        for (const raw of candidates) {
            for (const key of [raw, DLPresetNames.stripQuery(raw)]) {
                if (key && this.byUrl.has(key)) {
                    const v = this.byUrl.get(key)!;
                    // 删除所有等价键，避免残留导致本次 preset 被重复消费
                    this.byUrl.delete(key);
                    if (raw !== key) this.byUrl.delete(raw);
                    const sq = DLPresetNames.stripQuery(raw);
                    if (sq !== raw) this.byUrl.delete(sq);
                    return v;
                }
            }
        }
        return undefined;
    }

    forget(id: number, url?: string): void {
        if (id > 0) this.byId.delete(id);
        if (url) {
            this.byUrl.delete(url);
            const base = DLPresetNames.stripQuery(url);
            if (base && base !== url) this.byUrl.delete(base);
        }
    }
}

const dlPresetNames: DLPresetNames = new DLPresetNames();

/** 经 background Service Worker 探测 MIME（无 CORS 限制），超时返回空串 */
async function getMimeType(url: string, timeout?: number): Promise<string> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeout) {
        timer = setTimeout(() => controller.abort(), timeout);
    }
    try {
        const response = await fetch(url, { method: 'GET', credentials: 'include', signal: controller.signal });
        const contentType = response.headers.get('content-type') || '';
        // 仅需要响应头，取消响应体的下载
        controller.abort();
        clearTimeout(timer);
        return contentType;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

/** 备份开始时注册 Referer/CORS/https 升级规则（来源：默认配置 + 用户配置 + 运行中自动发现的域名） */
async function registerDnrRules(): Promise<void> {
    if (!chrome.declarativeNetRequest) return;
    const sync = await chrome.storage.sync.get(['Common']);
    const userUrls: string[] = (sync.Common as any)?.refererUrls || [];
    const urls = [...new Set(userUrls)];

    const addRules: chrome.declarativeNetRequest.Rule[] = [];
    urls.forEach((url, idx) => {
        if (!url) return;
        // 域名锚点匹配 `||url^`，与自动注册路径(buildRefererRule)对齐，
        // 避免裸子串匹配误伤仿冒/无关域名（如 evilgtimg.com、gtimg.com.evil.com）。
        const urlFilter = `||${url}^`;
        addRules.push({
            id: idx + 1,
            priority: idx + 1,
            action: {
                type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                requestHeaders: [{ header: 'Referer', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: 'https://user.qzone.qq.com/' }],
            },
            condition: { urlFilter, resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType] },
        });
    });
    // 助手直写目录时的媒体跨域放行
    addRules.push({
        id: 1000,
        priority: 1,
        action: {
            type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
            responseHeaders: [{ header: 'Access-Control-Allow-Origin', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: '*' }],
        },
        condition: {
            initiatorDomains: ['qzone.qq.com'],
            excludedRequestDomains: ['qzone.qq.com'],
            resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType, 'media' as chrome.declarativeNetRequest.ResourceType],
        },
    });
    // 直写目录媒体下载：老 CDN 常 302 到 http，升级后触发「HTTPS→HTTP 不安全重定向」被浏览器拦截。
    // 在 DNR 层把助手在 qzone 页发起的站外 http xhrequest 整体升 https（含 302 Location 那一跳）。
    addRules.push(buildHttpsUpgradeRule());
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules,
    });
}

/** 备份结束后移除所有动态规则 */
async function removeDnrRules(): Promise<void> {
    if (!chrome.declarativeNetRequest) return;
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (existing.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
        });
    }
}

/**
 * 为某 host 增量注册一条 Referer 规则（不移除既有规则）。
 * 不限制域名：只要是助手请求下载过的 host（http/https）一律接受；同 host 已注册则跳过（去重）。
 * 同时把该 host 持久化进 sync.Common.refererUrls，使下次备份 registerDnrRules 自动覆盖，
 * 避免「本次自动注册、下次仍踩坑」。
 * @returns added 是否新增了 DNR 规则；persisted 是否写入了 refererUrls
 */
async function addDnrHostRule(host: string): Promise<{ added: boolean; persisted: boolean }> {
    if (!chrome.declarativeNetRequest) return { added: false, persisted: false };
    if (!host) return { added: false, persisted: false };
    const urlFilter = `||${host}^`;
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    // 去重：避免重复注册同一 host 导致 updateDynamicRules 抛重复 id
    if (existing.some((r) => r.condition?.urlFilter === urlFilter)) {
        return { added: false, persisted: await persistRefererHost(host) };
    }
    // id 使用高位区间（>=5000）自增，避开既有 referer 规则(1..N) 与全局 CORS 规则(1000)，避免冲突
    const hostRuleIds = existing.map((r) => r.id).filter((id) => id >= 5000);
    const nextId = (hostRuleIds.length ? Math.max(...hostRuleIds) : 5000) + 1;
    const rule = buildRefererRule(host, nextId);
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    const persisted = await persistRefererHost(host);
    return { added: true, persisted };
}

/** 把自动发现的 host 追加进 refererUrls 并落盘（合并默认，避免覆盖已有配置） */
async function persistRefererHost(host: string): Promise<boolean> {
    const sync = await chrome.storage.sync.get(['Common']);
    const common: any = sync.Common || {};
    const base: string[] = Array.isArray(common.refererUrls) ? [...common.refererUrls] : [...(COMMON_DEFAULTS.refererUrls as string[])];
    if (base.includes(host)) return false;
    common.refererUrls = [...base, host];
    await chrome.storage.sync.set({ Common: common });
    return true;
}

export default defineBackground(() => {
    // 旧版逻辑已在顶层导入时注册完成

    /* ================= 扩展 Action 显隐策略 =================
     * 不再在 background 用 chrome.action.disable() + declarativeContent.ShowAction 控制图标显隐。
     * 原因：
     *  1) MV3 Service Worker 生命周期下，chrome.action.disable() 全局禁用 + declarativeContent.ShowAction
     *     重新启用的组合不可靠——SW 重启后图标可能长期停留在 disabled 状态，导致在 QQ 空间页点击图标
     *     也不弹 popup（仅图标高亮），且无法自动恢复；
     *  2) popup 自身已具备「非 QQ 空间 / 未登录」的引导提示（notQzone / notLoggedIn 状态，
     *     对应「请先在浏览器中打开并登录 QQ 空间…」），完全覆盖「请在 QQ 空间使用」的需求，
     *     无需在 background 重复 gating，且不必依赖脆弱的 URL 正则匹配。
     * 因此：图标常驻可点，点击即打开 popup，由 popup 内部判断当前页并给出对应提示。
     */

    // ================= Firefox：右键扩展图标菜单加入「打开配置页面」 =================
    // Chrome 的 action 右键菜单默认自带「选项」入口（配了 options_ui 即出现），无需处理；
    // Firefox 默认没有，但支持 menus.ContextType='action'，可在「右键扩展图标」的菜单里加自定义项，
    // 点击后 chrome.runtime.openOptionsPage() 打开配置页，实现双端一致的「右键图标 → 打开设置」。
    if (import.meta.env.FIREFOX && chrome.contextMenus) {
        try {
            chrome.contextMenus.removeAll(() => {
                chrome.contextMenus.create({ id: 'qze-open-options', title: '打开配置页面', contexts: ['action'] });
                chrome.contextMenus.onClicked.addListener((info) => {
                    if (info.menuItemId === 'qze-open-options') {
                        try { chrome.runtime.openOptionsPage(); } catch { /* ignore */ }
                    }
                });
            });
        } catch {
            // Firefox 个别环境不支持 contextMenus 时静默降级，不影响其它功能
        }
    }

    /**
     * 迁移遗留备份历史（chrome.storage.local 遗留单键 'Backedup' → 分键 'backup:uin:module'）。
     * chrome.storage.local 是扩展作用域、跨 content/background/options 共享，故无需经 background 代理。
     * 关键顺序：先迁移（拆成多键）、成功后再删除旧键；绝不直接删旧键而不迁移。
     */
    const migrateLegacyBackup = async (): Promise<void> => {
        try {
            const backupDb = new BackupDb();
            const migrated = await backupDb.migrateFromLegacy();
            if (migrated.length) console.info(`[background] 已迁移 ${migrated.length} 个QQ的遗留备份历史到 storage.local 分键`);
        } catch (e) {
            // 不在此处兜底删除旧键：migrateFromLegacy 只在成功路径末尾删除。
            // 若迁移抛错却仍删键，等于在「最不该删」的情况下永久丢失用户历史数据。
            // 保留旧键，下次启动自愈重试即可。
            console.warn('[background] 遗留备份历史迁移失败，已保留旧键待下次启动重试（不影响新备份）', e);
        }
    };

    /* ================= 安装/更新统一处理 =================
     * 合并为一个 onInstalled 监听器（避免多监听器异步竞态），执行顺序：
     *   1) 升级到 3.0（previousVersion 不以 '3.0' 开头，即 1.x/2.x 旧版）→ 先清空旧配置
     *   2) 清空后/首次安装 → 确保归一化默认配置落盘。registerDnrRules 等直读 sync 的路径依赖它，
     *      否则 refererUrls 等默认域名规则不注册 → 媒体下载 403。
     *   3) 迁移 legacy 备份历史（Backedup → 分键）
     *   4) 首次安装打开欢迎页
     */
    try {
        chrome.runtime.onInstalled.addListener((details) => {
            console.info('QQ空间导出助手安装中...', details);
            void (async () => {
                // 1) 升级清空旧配置：仅「3.0 之前」的版本（1.x/2.x）；3.0 及之后（含 3.0.x）不清，避免小版本升级误清
                if (
                    details.reason === chrome.runtime.OnInstalledReason.UPDATE &&
                    !String(details.previousVersion ?? '').startsWith('3.0')
                ) {
                    await chrome.storage.sync.clear();
                    console.info('[background] 升级到 3.0，已清空旧版配置');
                }
                // 2) 确保默认配置落盘（仅当 sync 缺 downloadType 才写，不覆盖既有配置）
                try {
                    const sync = await chrome.storage.sync.get(['Common']);
                    const Common = sync.Common as Record<string, any> | undefined;
                    if (!(Common && Common.downloadType != null)) {
                        await saveConfig(await loadConfig());
                        console.info('[background] 已初始化/补全默认配置到 storage.sync（原因：sync 缺失 downloadType）');
                    }
                } catch (e) {
                    console.error('[background] 初始化默认配置失败', e);
                }
                // 3) 迁移 legacy 备份历史
                await migrateLegacyBackup();
                // 4) 首次安装打开欢迎页
                if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
                    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
                }
            })();
        });
    } catch (_) { /* ignore */ }

    /* ================= 浏览器下载「强制重命名」钩子 =================
     * Chrome 限制每个扩展只能注册一个 onDeterminingFilename 监听器，统一在此消费 dlPresetNames。
     */
    try {
        if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
            chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
                try {
                    const preset = dlPresetNames.take(item);
                    if (preset) {
                        suggest({ filename: preset });
                        if (preset.startsWith('QQ空间备份') && preset.endsWith('.zip')) {
                            chrome.storage.session.set({ QZoneDownloadId: item.id });
                        }
                        return true;
                    }
                } catch (e) {
                    console.error('[BG-Browser] 读取下载重命名预登记表失败', e);
                }
                // 未命中预登记表：不调用 suggest（返回 false），让 chrome.downloads.download({filename})
                // 传入的相对路径直接生效，避免被 Content-Disposition 的 basename 覆盖导致丢掉子目录
                return false;
            });
        }
    } catch (_) { /* ignore */ }

    /* ================= Browser 下载进度监控 & 操作转发 =================
     * 问题：content 脚本直接监听不到 chrome.downloads.onChanged（权限仅 background 有）
     * 方案：background 全局监听 onCreated / onChanged，只要能在 _trackedDLs 命中、或能 chrome.downloads.search
     *       命中且 url/filename 命中媒体域之一，
     *       就通过 chrome.tabs.sendMessage 广播给 qzone 页的 content 脚本 → DownloadManager 更新 DM 任务状态。
     * 之前 bug：_trackedDLs 没人写入（_tryRegisterDL 定义了却没人调），加上早期 delta 没有 filename.current
     *       导致 _isLikelyMediaDL 判 false，整条进度被吞 → DM 永远卡在 in_progress。现在改成三级命中 +
     *       chrome.downloads.search 兜底取全量字段，避免只靠 delta.filename/url 判断。
     */
    // downloadId → { tabId?, taskId? }：避免对非助手发起的下载（如用户手动下载）也广播，减少噪声
    const _trackedDLs = new Map<number, { tabId?: number; taskId?: string; startedAt: number; _lastBytes?: number; _lastTotal?: number }>();

    // 进度轮询状态（仅在有跟踪中的下载时运行，空闲即停）
    const _dlPollState: { timer: ReturnType<typeof setInterval> | null } = { timer: null };

    // 已缓存的 qzone 标签页 id：避免每次 delta 都 chrome.tabs.query（重操作）造成 IPC 风暴
    const _qzoneTabIds: number[] = [];
    let _qzoneTabsExpiry = 0;
    const _QZONE_TAB_TTL = 3000;
    const _refreshQzoneTabs = async (): Promise<void> => {
        try {
            const tabs = await chrome.tabs.query({ url: '*://*.qzone.qq.com/*' });
            _qzoneTabIds.length = 0;
            for (const t of tabs) if (t.id != null) _qzoneTabIds.push(t.id);
        } catch (_) { /* ignore */ }
        _qzoneTabsExpiry = Date.now() + _QZONE_TAB_TTL;
    };
    const _sendToQzoneTabs = async (msg: any): Promise<void> => {
        if (Date.now() > _qzoneTabsExpiry) await _refreshQzoneTabs();
        for (const id of _qzoneTabIds) {
            try { await chrome.tabs.sendMessage(id, msg); } catch (_) { /* ignore */ }
        }
    };
    // 标签页增删时立即失效缓存，下次发送即重建
    if (chrome.tabs?.onRemoved) chrome.tabs.onRemoved.addListener(() => { _qzoneTabsExpiry = 0; });
    if (chrome.tabs?.onCreated) chrome.tabs.onCreated.addListener(() => { _qzoneTabsExpiry = 0; });

    // 进度广播合并：每个 downloadId 在 _DL_FLUSH_MS 窗口内只保留最新一帧，
    // 每窗口仅向各 qzone 标签页发送一条批量消息，避免 N 个并发下载高频 onChanged
    // 触发海量 chrome.tabs.sendMessage（IPC 风暴 → SW/主线程过载 → 面板进度滞后）
    const _dlCoalesce = new Map<number, any>();
    let _dlFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const _DL_FLUSH_MS = 200;
    const _broadcastDL = (payload: any): void => {
        if (!payload || typeof payload.downloadId !== 'number') return;
        const prev = _dlCoalesce.get(payload.downloadId);
        if (prev) {
            // 增量合并而非整帧覆盖：chrome.downloads.onChanged 的 delta 是「只包含变化字段」的，
            // 同一 200ms 合并窗口内后到的帧往往只有 bytesReceived。若直接 set 覆盖，
            // 先到帧携带的 state/filename/url/totalBytes/error 会被静默丢弃，
            // DM 侧就收不到状态迁移（进行中/失败），进而速度、进度、Top3 全部失真。
            for (const k of Object.keys(payload)) {
                const v = payload[k];
                if (v !== undefined) prev[k] = v;
            }
        } else {
            _dlCoalesce.set(payload.downloadId, { ...payload });
        }
        if (_dlFlushTimer) return;
        _dlFlushTimer = setTimeout(() => {
            _dlFlushTimer = null;
            if (_dlCoalesce.size === 0) return;
            const batch = Array.from(_dlCoalesce.values());
            _dlCoalesce.clear();
            void _sendToQzoneTabs({ from: 'background', type: DLEvent.PROGRESS_BATCH, items: batch });
        }, _DL_FLUSH_MS);
    };

    const _isLikelyMediaDL = (filename?: string, url?: string) => {
        const hay = ((filename || '') + ' ' + (url || '')).toLowerCase();
        return /(qpic\.|qzone\.|qqvideo\.|myqcloud\.com|gtimg\.cn)/.test(hay) || /\.(jpg|jpeg|png|gif|webp|bmp|mp4|m4v|mov|wmv|avi|mp3|m4a|wav|flac|m3u8|ts)$/i.test(hay);
    };

    /** chrome.downloads.search 兜底：如果命中了我们发起过的下载也拿全量字段（filename/url） */
    const _searchFullDL = async (id: number): Promise<{ filename?: string; url?: string; fileSize?: number } | null> => {
        try {
            if (!chrome.downloads || !chrome.downloads.search) return null;
            const list: any[] = await new Promise((resolve) => {
                try {
                    // 关键性能修复：此前用空查询 {} 会返回 Chrome 下载历史中的【全部】条目，
                    // 而本函数在每次 downloads.onCreated / onChanged 时都会被调用。
                    // 若此前备份被中断、残留数千条 interrupted 下载，浏览器启动时会重新触发这些
                    // onCreated，每条都触发一次全量扫描 → IPC/CPU 风暴 → 整个浏览器卡死
                    // （扩展 IndexedDB 此刻为 0，与本问题无关）。
                    // 改为按 id 精确过滤，只取当前这一条，杜绝全量扫描。
                    // 注：运行时 Chrome 支持 { id } 单值过滤；旧 @types/chrome 类型不认，故 as any。
                    chrome.downloads.search({ id } as any, (r: any) => resolve(Array.isArray(r) ? r : []));
                } catch (_) { resolve([]); }
            });
            const it = list && list.find((x: any) => Number(x && x.id) === Number(id));
            if (!it) return null;
            return { filename: it.filename, url: it.url, fileSize: typeof it.fileSize === 'number' ? it.fileSize : undefined };
        } catch (_) { return null; }
    };

    /** 两级命中：_trackedDLs（新） → 媒体域文件名/URL；兜底再查 chrome.downloads.search 全量字段。
     *  返回值 { track, full }：full 是 chrome.downloads.search 兜底抓到的完整字段（若命中则回写 Broadcast 的 url/filename）
     */
    const _shouldTrack = async (id: number, filenameHint?: string, urlHint?: string): Promise<{ track: boolean; full: any }> => {
        if (_trackedDLs.has(id)) return { track: true, full: null };
        if (_isLikelyMediaDL(filenameHint, urlHint)) return { track: true, full: null };
        // 最后再查一次 chrome.downloads.search（可能 delta 早期只有 bytesReceived，没 filename/url，导致前面都判空）
        const full = await _searchFullDL(id);
        if (full && (_isLikelyMediaDL(full.filename, full.url) || _isLikelyMediaDL(filenameHint, urlHint))) {
            return { track: true, full };
        }
        return { track: false, full };
    };

    try {
        chrome.downloads && chrome.downloads.onCreated && chrome.downloads.onCreated.addListener(async (item) => {
            const id = Number(item && item.id);
            if (!(id > 0)) return;
            const filename = (item && item.filename) || '';
            const url = (item && item.url) || '';
            const { track, full } = await _shouldTrack(id, filename, url);
            if (!track) return;
            const finalName = filename || (full && full.filename) || '';
            const finalUrl = url || (full && full.url) || '';
            const rec = _trackedDLs.get(id);
            // eslint-disable-next-line no-console
            console.log('[BG-Browser] onCreated id=' + id + ' filename=' + finalName.slice(0, 80) + ' url=' + String(finalUrl).slice(0, 120));
            const payload: any = {
                from: 'background',
                type: DLEvent.CREATED,
                downloadId: id,
                taskId: rec && rec.taskId,
                filename: finalName,
                url: finalUrl,
                totalBytes: (full && typeof full.fileSize === 'number' && full.fileSize > 0) ? full.fileSize
                    : ((item && typeof item.fileSize === 'number' && item.fileSize > 0) ? item.fileSize : undefined),
                mime: (item && item.mime) || undefined,
            };
            void _sendToQzoneTabs(payload);
        });
    } catch (_) { /* ignore */ }

    try {
        chrome.downloads && chrome.downloads.onChanged && chrome.downloads.onChanged.addListener(async (delta) => {
            // 兼容 @types/chrome 老版本（0.1.32）和新版本：部分属性是 number（bytesReceived），
            // 部分属性是 { current, previous }（state/filename/url/…），统一取 _cur()
            const _cur = (v: any) => (v && typeof v === 'object' && 'current' in v) ? (v as any).current : v;
            const id = typeof delta.id === 'number' ? delta.id : Number(_cur((delta as any).id));
            if (!(id > 0)) return;
            const filename = _cur((delta as any).filename) as string | undefined;
            const url = _cur((delta as any).url) as string | undefined;
            const { track, full } = await _shouldTrack(id, filename, url);
            if (!track) return;
            const rec = _trackedDLs.get(id);
            const finalName = filename || (full && full.filename) || undefined;
            const finalUrl = url || (full && full.url) || undefined;
            const bytesReceived = _cur((delta as any).bytesReceived);
            const rawTotal = _cur((delta as any).totalBytes);
            const totalBytes = (rawTotal != null && Number(rawTotal) > 0) ? Number(rawTotal)
                : ((full && typeof full.fileSize === 'number' && full.fileSize > 0) ? full.fileSize : undefined);
            // eslint-disable-next-line no-console
            console.log('[BG-Browser] onChanged id=' + id + ' state=' + _cur((delta as any).state) + ' bytes=' + bytesReceived + '/' + totalBytes + ' filename=' + (finalName || '').slice(0, 60));
            const payload: any = {
                downloadId: id,
                taskId: rec && rec.taskId,
                bytesReceived,
                totalBytes,
                canResume: _cur((delta as any).canResume),
                endTime: _cur((delta as any).endTime),
                paused: _cur((delta as any).paused),
                filename: finalName,
                url: finalUrl,
            };
            const st = _cur((delta as any).state);
            if (st) {
                payload.state = st;
            }
            const err = _cur((delta as any).error);
            if (err) {
                payload.error = String(err);
            }
            _broadcastDL(payload);
            if (st && (st === 'complete' || st === 'interrupted')) {
                // 完成/失败后 30s 清理 map（防止无限增长）
                setTimeout(() => {
                    _trackedDLs.delete(id);
                    // 没有正在跟踪的下载时停掉轮询定时器，避免空转
                    if (_trackedDLs.size === 0 && _dlPollState.timer) {
                        clearInterval(_dlPollState.timer);
                        _dlPollState.timer = null;
                    }
                }, 30_000);
            }
        });
    } catch (_) { /* 某些环境（测试/火狐）可能没有权限，吞 */ }

    const _tryRegisterDL = (id: number, tabId?: number, taskId?: string) => {
        if (!id || id <= 0) return;
        _trackedDLs.set(id, { tabId, taskId, startedAt: Date.now() });
        _startDlPoll();
    };

    /**
     * 进度轮询：Chrome 的 downloads.onChanged 不会为 bytesReceived 变化触发
     * （官方文档：除 bytesReceived / estimatedEndTime 外的属性变化才触发该事件）。
     * 因此仅依赖 onChanged 永远收不到「已下载字节数」增量，导致浏览器下载器的
     * downloadedBytes 恒为 0 → 速度永远算不出（界面显示 ⬇ 0 B/s，媒体页签逐文件「剩余 -」），
     * 进度条也只能在 complete 瞬间从 0 跳到 100%。
     * 这里周期性 query 当前 in_progress 的下载（仅活跃集合，非全量历史，开销可控），
     * 把 bytesReceived / totalBytes 增量广播给 content 脚本的 DM，使速度/ETA/进度条正常。
     */
    const _startDlPoll = (): void => {
        if (_dlPollState.timer) return;
        _dlPollState.timer = setInterval(async () => {
            try {
                if (_trackedDLs.size === 0) return;
                const list: any[] = await new Promise((resolve) => {
                    try {
                        // 仅查「进行中」下载（活跃集合，体量远小于整段下载历史），
                        // 规避此前 {} 全量扫描引发的卡死；state 过滤由 Chrome 端完成。
                        chrome.downloads.search({ state: 'in_progress' } as any, (r: any) => resolve(Array.isArray(r) ? r : []));
                    } catch { resolve([]); }
                });
                for (const it of list) {
                    const id = Number(it && it.id);
                    if (!(id > 0) || !_trackedDLs.has(id)) continue;
                    const bytes = Number(it.bytesReceived) || 0;
                    const total = Number(it.fileSize || it.totalBytes || 0) || 0;
                    const rec = _trackedDLs.get(id)!;
                    // 仅在有变化时广播，配合 _broadcastDL 的 200ms 合并，避免刷屏
                    if (rec._lastBytes === bytes && rec._lastTotal === total) continue;
                    rec._lastBytes = bytes;
                    rec._lastTotal = total;
                    _broadcastDL({ downloadId: id, taskId: rec.taskId, bytesReceived: bytes, totalBytes: total, filename: it.filename });
                }
            } catch { /* ignore */ }
        }, 400);
    };

    // P3：备份保活alarm监听（备份期间由引擎 startKeepAlive/stopKeepAlive 控制）
    registerKeepAlive();

    // ===== 启动自愈（卫生清理 + 防保活 alarm 残留）=====
    // 目的：
    //  1) 清理可能残留的保活 alarm（否则 SW 每 30s 被唤醒、永不休眠，长期拖累浏览器）；
    //  2) 清理 v1 遗留的巨型 storage.local 键 Backedup（可达 100MB+）；
    //  3) 兜底清掉 IndexedDB 累积的下载任务（常规由打开 QQ 空间时的 clearStaleTasks 处理，
    //     这里做一遍保险，避免从不打开 QQ 空间时 store 永不被清理）。
    // 注意：本函数不是「浏览器卡死」的首要修复点——卡死的首要根因在 background.ts 的
    // 下载事件监听中对 chrome.downloads.search 的全量扫描（见 _searchFullDL 的修复）。
    // 这里用 session 标记防止被 30s 保活 alarm 唤醒后重复触发清理。
    const selfHeal = async (): Promise<void> => {
        try {
            // 1) 清理可能残留的保活 alarm（否则 SW 每 30s 被唤醒，永不休眠、反复重建监听）
            await chrome.alarms.clear(KEEPALIVE_ALARM);

            // 2) 迁移遗留 storage.local 巨型 Backedup 键 → 分键 'backup:uin:module'（先迁后删，避免老用户历史丢失）
            await migrateLegacyBackup();

            // 3) 清理 IndexedDB 累积的下载任务（仅 tasks store，避免下次启动卡死）
            //    每个浏览器会话仅执行一次（session 存储跨 SW 重启保留，浏览器重启清空）
            const flag = await chrome.storage.session.get(['__qze_selfheal_done__']);
            if (flag.__qze_selfheal_done__) return;
            await chrome.storage.session.set({ __qze_selfheal_done__: Date.now() });

            const q = new TaskQueue('__selfheal__');
            try {
                const n = await q.clearAllGlobal();
                console.info(`[background] 启动自愈：已清理 ${n} 条残留下载任务`);
            } catch (e) {
                // 仅清 tasks store；任何失败都【不能】删除整个 IndexedDB——
                // 否则会误清空 STORE_CHECKPOINT / STORE_STAGING（断点续传数据）与 STORE_TASKS（任务队列）。
                console.warn('[background] 启动自愈 clearAllGlobal 失败（跳过任务清理，不删整库）', e);
            }
        } catch (e) {
            console.error('[background] 启动自愈失败', e);
        }
    };
    void selfHeal();

    /**
     * Disk（直写目录）媒体下载的 background 代理通道。
     * content script 在 qzone.qq.com（HTTPS）下 fetch 时，若媒体地址 302 落到 http
     * （如 r.photo.store.qq.com → http://photocq.photo.store.qq.com），会触发 Mixed Content
     * 拦截；DNR 的 http→https 升级规则对此无效（Chrome 在 DNR 重写前就拦了主动的 http 重定向）。
     * background 持 host_permissions ['<all_urls>']，不受 Mixed Content/CORS 约束，可自由跟随
     * http 302，因此由 background 拉取字节、经 port 回传，content 写入 DiskFS。
     * 注意：background 无页面上下文、浏览器不会自动带 Referer，而 photo.store.qq.com 等相册 CDN
     * 需要 Referer 鉴权；Referer 是 forbidden header、JS fetch 手写会被丢弃，故在 onMessage 内
     * 借 addDnrHostRule 注册 DNR modifyHeaders 规则在网络层注入（覆盖 302 两跳）。
     * 协议（port name = BG_MSG.DISK_FETCH_PROXY）：
     *   content → {type:'start', url, method?}
     *   background → {type:'meta', status, statusText, contentLength}
     *              → 若干 {type:'chunk', data:base64}（每块 base64 字符串，分块、内存恒定）
     *              → {type:'done'} | {type:'error', message}
     * 分块直写：content 每收到一块 base64 即解码 append 落盘，不重建 ReadableStream（绕过上一版
     * 「重建流+pipeTo」竞态导致的 0 字节）、也不一次性 base64 整文件（避免大图内存爆 / 单消息上限）。
     * 关键：分块以「base64 字符串」而非 Uint8Array 回传——实测本环境下 port 的 Uint8Array 结构化克隆
     * 会丢数据（content 收空→“代理返回空数据”），base64 字符串通道稳定可靠。
     */

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== BG_MSG.DISK_FETCH_PROXY) return;
        const send = (m: unknown): void => { try { port.postMessage(m as any); } catch { /* 端口已断开，忽略 */ } };
        port.onMessage.addListener(async (msg: any) => {
            if (!msg || msg.type !== 'start') return;
            const url = String(msg.url || '');
            if (!/^https?:\/\//i.test(url)) {
                send({ type: 'error', message: '非法的代理 URL' });
                return;
            }
            // —— 关键修复：代理 fetch 运行在 background（无页面上下文），浏览器不会自动带 Referer；
            // 而 r.photo.store.qq.com 等相册 CDN 需要 Referer 鉴权，否则返回 403/空响应。
            // Referer 是 forbidden header，JS fetch 手写会被 Chrome 静默丢弃（之前的写法根本没生效），
            // 故必须借 DNR modifyHeaders 规则在「网络层」注入——与直连下载的 Referer 规则同一机制（已验证对 qpic.cn 等有效）。
            // 注：302 落点（如 photocq.photo.store.qq.com）与初始 host 同属 photo.store.qq.com，
            // 注册「父域」规则(||photo.store.qq.com^)即可同时覆盖两跳；DNR 对每次（含重定向）请求都生效。
            let host = '';
            try { host = new URL(url).hostname; } catch { /* ignore */ }
            if (host) {
                try {
                    const parent = host.includes('.') ? host.split('.').slice(1).join('.') : host;
                    await addDnrHostRule(parent);
                } catch { /* DNR 不可用（如测试环境）时忽略，回退为无 Referer 请求 */ }
            }
            try {
                const resp = await fetch(url, {
                    method: String(msg.method || 'GET'),
                    redirect: 'follow',
                    // Referer 由上方 addDnrHostRule 注册的 DNR 规则在网络层注入（见上方注释）。
                    // 不携带 credentials：DNR 注入 ACAO:* 不带 ACAC，credentials 会与 * 冲突导致 Failed to fetch。
                });
                const status = resp.status;
                const statusText = resp.statusText || '';
                const contentLength = Number(resp.headers.get('content-length')) || 0;
                const ok = status >= 200 && status < 300;
                send({ type: 'meta', status, statusText, contentLength });
                if (!ok) {
                    send({ type: 'done' });
                    return;
                }
                // 分块读、分块回传：每块经 base64 编码成字符串再 postMessage（见下方注释），
                // 不传递 Uint8Array（实测本环境下结构化克隆会丢/损二进制，导致 content 收空数据）。
                // 单条 port 消息原始字节上限 1MB，避免超大消息被截断/触发上限；内存恒定、大文件无上限。
                if (!resp.body) {
                    send({ type: 'done' });
                    return;
                }
                const reader = resp.body.getReader();
                let totalBytes = 0;
                const MAX_RAW = 1 * 1024 * 1024; // 单条消息原始字节上限（base64 后约 +33%）
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value && value.byteLength) {
                        totalBytes += value.byteLength;
                        for (let off = 0; off < value.byteLength; off += MAX_RAW) {
                            const piece = value.subarray(off, Math.min(off + MAX_RAW, value.byteLength));
                            send({ type: 'chunk', data: bytesToBase64(piece) });
                        }
                    }
                }
                send({ type: 'done' });
            } catch (e) {
                send({ type: 'error', message: (e as Error)?.message || String(e) });
            }
        });
    });

    // P3：新引擎的保活开关消息
    // 必须显式 sendResponse：旧背景页监听器对未识别类型也会 return true，
    // 若无人回复，内容脚本侧 sendMessage 的 Promise 会一直 pending
    /**
     * 腾讯地图 API 代理：MV3 的 content script fetch 按页面 origin 算 CORS，
     * apis.map.qq.com 不带 ACAO 必然 Failed to fetch；background 有 <all_urls> 特权可直连。
     * 白名单只放腾讯地图域名，避免变成开放代理。
     */
    chrome.runtime.onMessage.addListener((request: any, _sender, sendResponse) => {
        if (!request || request.type !== 'lbs_proxy') {
            return;
        }
        const url = String(request.url || '');
        if (!/^https:\/\/(apis\.map\.qq\.com|geo\.datav\.aliyun\.com)\//.test(url)) {
            sendResponse({ ok: false, error: '仅允许代理腾讯地图 API' });
            return;
        }
        fetch(url)
            .then(async (res) => ({ ok: res.ok, status: res.status, text: await res.text() }))
            .then((data) => sendResponse(data))
            .catch((e: unknown) => sendResponse({ ok: false, error: (e as Error).message || String(e) }));
        return true; // 异步 sendResponse
    });

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        // Firefox 兼容：MDN 明确「勿把 async 函数传给 onMessage」——async 监听器返回的 Promise 会被当作
        // 响应，覆盖内部 sendResponse（Chrome 忽略 Promise 用 sendResponse，故仅 Firefox 中招）。
        // 症状：content 侧 sendMessage 收到 undefined → 如「预检文件已下载却报测试失败」「Browser 媒体下载失败」。
        // 修复：改非 async 外层——content 消息 return true 保持通道 + IIFE 内原逻辑照常 sendResponse；
        // 非 content 消息 return（不响应），不干扰其他 onMessage 监听器。
        if (!request || request.from !== 'content') {
            return;
        }
        void (async () => {
        // ===== 原 async 监听器函数体（缩进保持原样以最小化 diff）=====
        if (request.type === BG_MSG.KEEPALIVE_START) {
            return new Promise<void>((resolve) => {
                startKeepAlive()
                    .then(() => { sendResponse({ ok: true }); resolve(); })
                    .catch((error) => { sendResponse({ ok: false, message: String(error) }); resolve(); });
            });
        }
        if (request.type === BG_MSG.KEEPALIVE_STOP) {
            return new Promise<void>((resolve) => {
                stopKeepAlive()
                    .then(() => { sendResponse({ ok: true }); resolve(); })
                    .catch((error) => { sendResponse({ ok: false, message: String(error) }); resolve(); });
            });
        }
        // 公告 + 预设：content script 无法直接 fetch 扩展资源，委托 background 读取
        if (request.type === 'fetchAnnouncements') {
            return new Promise<void>((resolve) => {
                fetch(chrome.runtime.getURL('remote-config.json'))
                    .then((res) => res.ok ? res.json() : {} as Record<string, unknown>)
                    .then((json: Record<string, unknown>) => {
                        // 顺便缓存 presets（供 options 页和采集器读取）
                        if (json.presets) {
                            chrome.storage.local.set({ QZoneExport_Presets: json.presets });
                        }
                        sendResponse({ ok: true, data: json.announcements || [] });
                        resolve();
                    })
                    .catch(() => { sendResponse({ ok: false, data: [] }); resolve(); });
            });
        }
        // DNR 按需注册：备份开始时注册 Referer/CORS 规则，结束后移除
        if (request.type === BG_MSG.DNR_START) {
            return new Promise<void>((resolve) => {
                registerDnrRules()
                    .then(() => { sendResponse({ ok: true }); resolve(); })
                    .catch((e: unknown) => { sendResponse({ ok: false, message: String(e) }); resolve(); });
            });
        }
        // Disk 模式下载失败时，content 请求为某 host 增量注册一条 Referer 规则
        // （不限制域名：助手请求下载过的任意 http(s) host 都接受；不移除既有规则）
        if (request.type === BG_MSG.DNR_ADD_HOST) {
            return new Promise<void>((resolve) => {
                addDnrHostRule(String((request as any).host || ''))
                    .then((res) => { sendResponse({ ok: true, ...res }); resolve(); })
                    .catch((e: unknown) => { sendResponse({ ok: false, message: String(e), added: false, persisted: false }); resolve(); });
            });
        }
        if (request.type === 'dnr_stop') {
            return new Promise<void>((resolve) => {
                removeDnrRules()
                    .then(() => { sendResponse({ ok: true }); resolve(); })
                    .catch((e: unknown) => { sendResponse({ ok: false, message: String(e) }); resolve(); });
            });
        }

        // Content script 的 Aria2 RPC 调用代理到 background：
        // content script 在 qzone.qq.com（HTTPS）下 fetch HTTP 非 localhost 地址
        // 会被 Mixed Content 拦截。background 有 host_permissions ['<all_urls>']，
        // 可无限制发起任意协议请求，不受同源/Mixed Content 约束。
        if (request.type === 'aria2_rpc') {
            return new Promise<void>((resolve) => {
                const { host, body } = request;
                if (!host || !body) {
                    sendResponse({ ok: false, error: '缺少 host 或 body' });
                    resolve();
                    return;
                }
                fetch(host, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: typeof body === 'string' ? body : JSON.stringify(body),
                })
                    .then(async (res) => {
                        const text = await res.text();
                        let json: any;
                        try { json = JSON.parse(text); } catch { json = null; }
                        sendResponse({ ok: res.ok, status: res.status, data: json, text: !json ? text : undefined });
                        resolve();
                    })
                    .catch((e: unknown) => {
                        sendResponse({ ok: false, error: (e as Error).message || String(e) });
                        resolve();
                    });
            });
        }

        /**
         * content script 自定义配置按钮：content script 本身没有 chrome.tabs 权限，
         * 委托 background 打开 options.html 并跳到指定 tab（#Common 等）。
         * params: { from: 'content', type: 'content_open_options', hash?: string }
         */
        if (request.type === BG_MSG.CONTENT_OPEN_OPTIONS) {
            try {
                const hash = typeof request.hash === 'string' && request.hash ? request.hash : '';
                const tabUrl = chrome.runtime.getURL('options.html' + (hash.startsWith('#') ? hash : ('#' + hash)));
                chrome.tabs.create({ url: tabUrl }, () => {
                    // tabs.create 在有 chrome.tabs 权限时基本不会抛，但回调里仍要兜底
                    if ((chrome.runtime as any).lastError) {
                        try { chrome.runtime.openOptionsPage(); } catch { /* ignore */ }
                    }
                });
                sendResponse({ ok: true });
            } catch (e) {
                try { chrome.runtime.openOptionsPage(); } catch { /* ignore */ }
                sendResponse({ ok: false, message: String(e) });
            }
            return true;
        }

        /**
         * content script 跳转外部链接：content script 自身没有 chrome.tabs 权限，
         * 且直接 window.open 在第三方页面（如 QQ 空间）易被 CSP / 弹窗策略拦截，
         * 因此统一委托 background 用 chrome.tabs.create 打开。
         * params: { from: 'content', type: 'content_open_url', url: string }
         */
        if (request.type === BG_MSG.CONTENT_OPEN_URL) {
            try {
                const url: unknown = request.url;
                if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
                    sendResponse({ ok: false, message: '非法的外部链接' });
                    return false;
                }
                chrome.tabs.create({ url }, () => {
                    if ((chrome.runtime as any).lastError) {
                        // 极少数情况（如 incognito 限制）创建失败，回退到 options 页
                        try { chrome.runtime.openOptionsPage(); } catch { /* ignore */ }
                    }
                });
                sendResponse({ ok: true });
            } catch (e) {
                sendResponse({ ok: false, message: String(e) });
            }
            return true;
        }

        /**
         * content script 向当前标签页的旧 content.js 发 port 消息（popup / hint 共用 subject）。
         * MV3 content script 没有 chrome.tabs 权限直接 connect 自己，
         * 统一经由 background 创建 chrome.tabs.connect(sender.tab.id) 并转发给 port。
         * params: { from:'content', type:'content_port_message', subject:string, extra?:object }
         */
        if (request.type === BG_MSG.CONTENT_PORT_MESSAGE) {
            // 注意：监听器是 async 函数，不能再用「return true + 异步 sendResponse」的写法。
            // MV3 下 async 监听器返回的 Promise 一旦同步部分结束即 resolve，Chrome 会立即关闭消息通道，
            // 导致后续（引擎异步响应）的 sendResponse 失效、对端收到 undefined。
            // 这里改为返回一个 Promise，并在真正 sendResponse 后才 resolve，以保活通道直到响应就绪。
            return new Promise<void>((resolve) => {
                const tabId = _sender.tab?.id;
                if (!tabId) {
                    sendResponse({ ok: false, message: '找不到发送方标签页' });
                    resolve();
                    return;
                }
                const subject: unknown = request.subject;
                if (typeof subject !== 'string' || !subject) {
                    sendResponse({ ok: false, message: 'subject 参数缺失' });
                    resolve();
                    return;
                }
                const extra: Record<string, unknown> =
                    request.extra && typeof request.extra === 'object' ? (request.extra as Record<string, unknown>) : {};
                try {
                    const port = chrome.tabs.connect(tabId, { name: 'popup' });
                    let settled = false;
                    // 与 popup/messaging.ts 保持相同的 10s 超时
                    const timer = setTimeout(() => {
                        if (!settled) {
                            settled = true;
                            try { port.disconnect(); } catch { /* ignore */ }
                            sendResponse({ ok: false, message: `port 消息「${subject}」超时` });
                            resolve();
                        }
                    }, 10000);
                    port.onMessage.addListener((resp: any) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        console.log('[QZ-DIAG] bg bridge got response for', subject, 'ok=', resp?.ok, Array.isArray(resp) ? `array(${resp.length})` : '');
                        try { port.disconnect(); } catch { /* ignore */ }
                        sendResponse({ ok: true, data: resp });
                        resolve();
                    });
                    port.onDisconnect.addListener(() => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            console.error('[QZ-DIAG] bg bridge disconnect for', subject, chrome.runtime.lastError?.message || '');
                            sendResponse({ ok: false, message: `port 消息「${subject}」连接断开` });
                            resolve();
                        }
                    });
                    port.postMessage({ from: 'popup', subject, ...extra });
                } catch (e) {
                    sendResponse({ ok: false, message: String(e) });
                    resolve();
                }
            });
        }

        /**
         * content script 跨域代理：访问 url.cn 之类的第三方页面（CORS + Mixed Content 都会拦）。
         * Service Worker 的 fetch 不受浏览器页面 CORS / 混合内容策略限制，
         * 直接在后台读 HTML 文本并回传给内容脚本，内容脚本再在自己线程里解析真实链接。
         *
         * params: { from: 'content', type: 'urlcn_fetch_html', url: string }
         * return: { ok: true, data: htmlText } | { ok: false, message: string, httpStatus?: number }
         */
        if (request.type === 'urlcn_fetch_html') {
            return new Promise<void>((resolve) => {
                const url: unknown = request.url;
                if (typeof url !== 'string' || !url) {
                    sendResponse({ ok: false, message: 'url 参数缺失或类型错误' });
                    resolve();
                    return;
                }
                try {
                    // url.cn 要求 UA 像浏览器，不然可能返回异常页；另外不附带任何 credential 避免 cookies 混淆
                    fetch(url, {
                        method: 'GET',
                        headers: {
                            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        },
                        credentials: 'omit',
                        redirect: 'follow',
                    })
                        .then(async (res) => {
                            if (!res.ok) {
                                const bodyText = await res.text().catch(() => '');
                                sendResponse({
                                    ok: false,
                                    message: `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}`,
                                    httpStatus: res.status,
                                    data: bodyText || undefined,
                                });
                                resolve();
                                return;
                            }
                            const buffer = await res.arrayBuffer();
                            // url.cn 返回内容固定 utf-8，这里按 content-type + 硬兜底处理
                            const ct = res.headers.get('content-type') || '';
                            const m = /charset=([\w-]+)/i.exec(ct);
                            const charset = m ? m[1] : 'utf-8';
                            let text: string;
                            try {
                                text = new TextDecoder(charset).decode(buffer);
                            } catch {
                                text = new TextDecoder('utf-8').decode(buffer);
                            }
                            sendResponse({ ok: true, data: text });
                            resolve();
                        })
                        .catch((e) => { sendResponse({ ok: false, message: String(e) }); resolve(); });
                } catch (e) {
                    sendResponse({ ok: false, message: String(e) });
                    resolve();
                }
            });
        }

        /* ==================== Browser 下载发起（content 没有 chrome.downloads 权限） ====================
         *  消息：{ from: 'content', type: 'download_browser', downloadThread, task: { url, filename } }
         */
        if (request.type === BG_MSG.DOWNLOAD_BROWSER) {
            const req = request as Record<string, unknown>;
            // 兼容两种格式：{ task: {url, filename} }（预检）和 { url, filename }（BrowserDriver）
            const task = (req.task as Record<string, string> | undefined) || req;
            const url = String(task.url || '');
            const rawName = typeof task.filename === 'string' ? task.filename : '';
            // 归一化成 chrome.downloads 允许的相对路径（绝对路径 / .. / 非法字符会让整次下载直接报错）
            const filename = DLPresetNames.normalize(rawName) || undefined;
            if (!url) { sendResponse({ ok: false, message: '缺少 url' }); return false; }
            try {
                // 关键：必须在 download() 之前登记，因为 onDeterminingFilename 可能早于
                // download() 的回调返回 downloadId（此时只能靠 url 命中）
                if (filename) dlPresetNames.remember(url, filename);
                const downloadId = await chrome.downloads.download({ url, filename, conflictAction: 'overwrite', saveAs: false });
                if (downloadId > 0) {
                    if (filename) dlPresetNames.rememberId(downloadId, filename);
                    // 登记到进度跟踪表，避免 onChanged 进度被 _shouldTrack 吞掉
                    _tryRegisterDL(downloadId, _sender?.tab?.id, typeof req.taskId === 'string' ? req.taskId : undefined);
                }
                sendResponse({ ok: true, downloadId });
            } catch (e) {
                dlPresetNames.forget(0, url);
                sendResponse({ ok: false, message: String((e as Error)?.message || e) });
            }
            return true;
        }

        /* ==================== Browser 下载操作转发（content 没有 chrome.downloads 权限） ====================
         *  消息：{ from: 'content', type: 'download_pause'|'download_cancel'|'download_resume', downloadId: number }
         *  返回：{ ok: true, err?: string }
         */
        if (request.type === BG_MSG.DOWNLOAD_PAUSE) {
            const id = Number((request as any).downloadId);
            if (id > 0) {
                try {
                    await chrome.downloads.pause(id);
                    sendResponse({ ok: true });
                } catch (e) { sendResponse({ ok: false, err: String((e as chrome.runtime.LastError)?.message || e) }); }
            } else { sendResponse({ ok: false, err: 'invalid downloadId' }); }
            return true;
        }
        if (request.type === BG_MSG.DOWNLOAD_CANCEL) {
            const id = Number((request as any).downloadId);
            if (id > 0) {
                try {
                    await chrome.downloads.cancel(id);
                    sendResponse({ ok: true });
                } catch (e) { sendResponse({ ok: false, err: String((e as chrome.runtime.LastError)?.message || e) }); }
            } else { sendResponse({ ok: false, err: 'invalid downloadId' }); }
            return true;
        }
        if (request.type === BG_MSG.DOWNLOAD_RESUME) {
            const id = Number((request as any).downloadId);
            if (id > 0) {
                try {
                    await chrome.downloads.resume(id);
                    sendResponse({ ok: true });
                } catch (e) { sendResponse({ ok: false, err: String((e as chrome.runtime.LastError)?.message || e) }); }
            } else { sendResponse({ ok: false, err: 'invalid downloadId' }); }
            return true;
        }

        /* ==================== qzone-hint.content.ts 用的消息桥接 ====================
         * 完全复用 popup 与旧 content.js 的通信协议：
         *   chrome.tabs.connect(tabId, {name:'popup'}) + postMessage({ from:'popup', subject, ... })
         * 这样旧 content.js 不需要改一行代码就能正确处理消息，100% 兼容现有备份引擎。
         */

        /** 向 content 询问 Owner/Target Uin 数据（判断是否主人模式 & 范围文案） */
        if (request.type === BG_MSG.CONTENT_INIT_UIN) {
            return new Promise<void>((resolve) => {
                const tabId = _sender.tab?.id;
                if (!tabId) { sendResponse({ ok: false, message: '找不到标签页' }); resolve(); return; }
                try {
                    const port = chrome.tabs.connect(tabId, { name: 'popup' });
                    let settled = false;
                    const timer = setTimeout(() => {
                        if (!settled) { settled = true; try { port.disconnect(); } catch { /* ignore */ } sendResponse({ ok: false, message: '内容脚本超时' }); resolve(); }
                    }, 8000);
                    port.onMessage.addListener((resp: any) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        try { port.disconnect(); } catch { /* ignore */ }
                        // initUin 的返回包：resp 是 {Owner, Target} 或直接包一层 data
                        if (resp && resp.Owner) sendResponse({ ok: true, data: resp });
                        else if (resp && resp.data && resp.data.Owner) sendResponse({ ok: true, data: resp.data });
                        else sendResponse({ ok: true, data: resp });
                        resolve();
                    });
                    port.onDisconnect.addListener(() => {
                        if (!settled) { settled = true; clearTimeout(timer); sendResponse({ ok: false, message: '连接断开' }); resolve(); }
                    });
                    port.postMessage({ from: 'popup', subject: 'initUin' });
                } catch (e) {
                    sendResponse({ ok: false, message: String(e) });
                    resolve();
                }
            });
        }

        /** 一键开始备份：content 触发 → background 转发给旧 content.js，走与 popup 点按钮完全相同的流程 */
        if (request.type === BG_MSG.CONTENT_START_BACKUP) {
            return new Promise<void>((resolve) => {
                const tabId = _sender.tab?.id;
                if (!tabId) { sendResponse({ ok: false, message: '找不到标签页' }); resolve(); return; }
                try {
                    const port = chrome.tabs.connect(tabId, { name: 'popup' });
                    let settled = false;
                    const timer = setTimeout(() => {
                        if (!settled) { settled = true; try { port.disconnect(); } catch { /* ignore */ } sendResponse({ ok: false, message: '备份启动超时（请手动点扩展图标）' }); resolve(); }
                    }, 12000);
                    port.onMessage.addListener((resp: any) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        try { port.disconnect(); } catch { /* ignore */ }
                        // popup 的 startBackup 通常返回 { ok: true } 或 { ok:false, message }，也可能没有包（直接打开面板）
                        if (resp && typeof resp === 'object' && typeof resp.ok === 'boolean') sendResponse(resp);
                        else sendResponse({ ok: true, data: resp });
                        resolve();
                    });
                    port.onDisconnect.addListener(() => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            // onDisconnect 不代表失败：有些旧版本 content.js 处理完就直接断端口
                            // 这里统一返回 ok:true 让卡片关闭（若真失败，backup-panel 自身会提示）
                            sendResponse({ ok: true, message: '备份流程已触发（请查看进度面板）' });
                            resolve();
                        }
                    });
                    port.postMessage({
                        from: 'popup',
                        subject: 'startBackup',
                        exportType: Array.isArray(request.exportType) ? request.exportType : [],
                        albums: Array.isArray(request.albums) ? request.albums : [],
                    });
                } catch (e) {
                    sendResponse({ ok: false, message: String(e) });
                    resolve();
                }
            });
        }

        /* ==================== MIME 类型探测（content 无 CORS 限制，委托 background fetch） ====================
         *  消息：{ from: 'content', type: 'getMimeType', url: string, timeout?: number }
         *  返回：后缀字符串（如 'jpg'），失败返回 ''
         */
        if (request.type === BG_MSG.GET_MIME_TYPE) {
            const mimeUrl = (request as any).url;
            const mimeTimeout = (request as any).timeout;
            if (typeof mimeUrl !== 'string' || !mimeUrl) { sendResponse(''); return false; }
            try {
                const suffix = await getMimeType(mimeUrl, typeof mimeTimeout === 'number' ? mimeTimeout : undefined);
                sendResponse(suffix || '');
            } catch (e) {
                console.error('文件识别异常，将默认不使用文件后缀！', e);
                sendResponse('');
            }
            return true;
        }

        return;
        })();
        return true;
    });

    /* ===== Firefox 文案/查看器落盘通道（形态 B：content 数据 → background blob → downloads.download 直写） =====
     * DownloadsBackend（core/fs/downloads-writer.ts）经 onConnect('qze-write') 提交写文件请求。
     * 走 onConnect 而非 onMessage：主 onMessage 监听器是 async，会压制其他监听器的异步响应。
     * data 支持 string（文本）或 ArrayBuffer/Uint8Array（二进制，结构化克隆跨上下文）。
     * filename 相对默认下载目录、支持子目录（Firefox 已探针实测自动创建），落盘到
     * 下载目录/QQ空间备份_<uin>/<path>，内存=单文件。
     */
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'qze-write') return;
        port.onMessage.addListener((msg: any) => {
            if (!msg || msg.cmd !== 'write_file') return;
            const path = typeof msg.path === 'string' && msg.path ? msg.path : '';
            const data = msg.data;
            if (!path || (typeof data !== 'string' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data))) {
                try { port.postMessage({ ok: false, error: '无效的 write_file 参数' }); } catch { /* ignore */ }
                return;
            }
            (async () => {
                let bytes: Uint8Array;
                if (typeof data === 'string') {
                    bytes = new TextEncoder().encode(data);
                } else if (data instanceof ArrayBuffer) {
                    bytes = new Uint8Array(data);
                } else {
                    bytes = new Uint8Array(
                        (data as ArrayBufferView).buffer,
                        (data as ArrayBufferView).byteOffset,
                        (data as ArrayBufferView).byteLength,
                    );
                }
                // slice 转成精确范围 ArrayBuffer（BlobPart 要求 ArrayBuffer，不接受 ArrayBufferLike/SharedArrayBuffer）
                const blob = new Blob(
                    [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
                    { type: 'application/octet-stream' },
                );
                const url = URL.createObjectURL(blob);
                try {
                    const id = await chrome.downloads.download({
                        url, filename: path, conflictAction: 'overwrite', saveAs: false,
                    });
                    // 轮询 search 等 complete/interrupted（与探针 dlsub 同法）
                    const state = await new Promise<string>((resolve) => {
                        const t0 = Date.now();
                        const timer = setInterval(async () => {
                            const items = await chrome.downloads.search({ id }).catch(() => []);
                            const it = items && items[0];
                            if (!it) { clearInterval(timer); resolve('missing'); return; }
                            if (it.state === 'complete' || it.state === 'interrupted' || Date.now() - t0 > 30000) {
                                clearInterval(timer);
                                resolve(it.state);
                            }
                        }, 300);
                    });
                    if (state === 'complete') return { ok: true };
                    return { ok: false, error: '下载未完成: ' + state + ' (' + path + ')' };
                } finally {
                    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
                }
            })().then((r) => { try { port.postMessage(r); } catch { /* ignore */ } })
              .catch((e: unknown) => {
                try { port.postMessage({ ok: false, error: String(e && ((e as Error).stack || (e as Error).message) || e) }); } catch { /* ignore */ }
            });
        });
    });
});
