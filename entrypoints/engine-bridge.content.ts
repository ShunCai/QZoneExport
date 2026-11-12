import '../core/shared/polyfill';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { initContext } from '../core/qzone-api/context';
import { albumList, diaryList } from '../core/qzone-api/clients';
import { serializeParams } from '../core/qzone-api/request';
import { BG_MSG } from '../core/shared/messages';
import { loadConfig as loadCoreConfig } from '../core/shared/config';
import { Logger } from '../core/shared/logger';
import { DEFAULT_DOWNLOAD_TYPE, defaultDownloadTypeFor } from '../core/shared/backup-options';
import { toJson } from '../core/shared/utils';
import { CheckpointStore } from '../core/collector/checkpoint';
import { PageLedger, DetailManager } from '../core/collector/reliability';
import {
    BackupEngine,
    type BackupHost,
    type ModuleName,
} from '../core/collector/modules/engine';
import type { MediaTask, QzoneBackupConfig } from '../core/collector/modules/types';
import { Requester, type RetryConfig } from '../core/qzone-api/request';
import { BackupDb, type ModuleBackupRow } from '../core/store/backup-db';
import { DiskFS } from '../core/fs/disk-fs';
import { FileWriter } from '../core/fs/writer';
import { DownloadsBackend } from '../core/fs/downloads-writer';
import { autoFileSuffix } from '../core/net/suffix';
import { installDownloadManager, type DownloadManager } from '../core/downloader/manager';
import { exportModuleMarkdown, resetMarkdownRootIndex } from '../core/export/markdown';
import { exportOthers, type UserInfo, type ViewerDistrictInput, type ViewerExportResult } from '../core/export/site';
import { fetchTargetUserInfo, mergeTargetUserInfo } from '../core/export/user-info';

/**
 * 腾讯地图 / DataV 的 background 代理：content script（qzone 页面上下文）直连
 * apis.map.qq.com / geo.datav.aliyun.com 会被 CORS 拦（Failed to fetch），
 * background 有 <all_urls> 特权可直连。collector 与查看器导出共用。
 */
const lbsProxyFetchText = (url: string): Promise<string> => new Promise<string>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'lbs_proxy', url }, (res: any) => {
        if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
        }
        if (!res || !res.ok) {
            reject(new Error(res?.error || `lbs_proxy HTTP ${res?.status ?? '?'}`));
            return;
        }
        resolve(res.text);
    });
});

// content script 通过 window 上的全局变量与注入面板/引擎通信，补充索引签名以合法访问
declare global {
    interface Window {
        [key: string]: unknown;
    }
}

/* ===== 全局共享状态 ===== */

const sharedDisk = new DiskFS();
// 形态 B（Firefox）：无 File System Access + 任何上下文无 SW 流式（探针实锤），
// 文案/查看器经 downloads.download 直写下载目录（下载目录/QQ空间备份_<uin>/），内存=单文件。
// 仅 Firefox 装配 Downloads 后端；Chrome 走 DiskFS 直写盘（ZipCollector 已下线，见 writer.ts）。
const isFirefox = import.meta.env.FIREFOX;
const downloadsBackend: DownloadsBackend | null = isFirefox
    ? new DownloadsBackend({
        // 文案/查看器落盘进度并入媒体进度面板（写文件 N/M），用户拍板
        onProgress: (done, total) => {
            try { ensureDm().setMetaWriteProgress(done, total); } catch { /* 进度上报失败不影响写盘 */ }
        },
    })
    : null;
const sharedWriter = new FileWriter(sharedDisk, '', downloadsBackend || undefined);
let sharedDm: DownloadManager | null = null;
const sharedCheckpointStore = new CheckpointStore();
/**
 * 页级可靠性账本（跨模块/跨备份共享，持久化在 chrome.storage.local）。
 * 与 sharedCheckpointStore 同生命周期：每次 start() 都创建新 BackupEngine，但 ledger 复用同一实例，
 * 确保「采集明细」Tab 与手动重试能读到任意一轮备份留下的失败/丢失页记录。
 */
const sharedLedger = new PageLedger();
/**
 * 备份历史存储。
 * chrome.storage.local 是扩展作用域、跨 content / background / Options 共享——
 * content script 直接读写，Options 页也能读到同一份，无需经 background 代理。
 */
const sharedBackupDb = new BackupDb();
let aria2Configured = false;
let qzoneConfig: Record<string, unknown> = {};

/**
 * 备份编排层结构化日志：写入 DownloadManager 日志环形缓冲（与媒体任务登记/进度同源，
 * 随引擎在备份结束时一并落盘到 Common/backup.log §2），保证「入口编排」与「下载执行」
 * 的日志在同一文件内、且带 uin 任务标识。DM 不可用时静默降级（避免阻塞备份主流程）。
 */
function logBackup(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', uin: number | string, msg: string): void {
    try {
        const dm = sharedDm as unknown as { log?: (lvl: string, m: string) => void } | null;
        dm?.log?.(level, `[BackupOrchestrator] uin=${uin} ${msg}`);
    } catch { /* 日志失败不影响备份 */ }
}

function ensureDm(): DownloadManager {
    if (!sharedDm) {
        sharedDm = installDownloadManager({
            writer: sharedWriter,
            onTaskComplete: (url: string, dir?: string) => {
                const eng = window['__QZ_ENGINE__'] as
                    | Record<string, (entries: Array<{ url: string; dir?: string }>) => Promise<unknown>>
                    | undefined;
                if (eng?.markDownloaded) void eng.markDownloaded([{ url, dir: dir || '' }]).catch(() => {});
            },
        });
    }
    return sharedDm;
}

/**
 * 采集引擎日志器：在 Logger 自带环形缓冲 + console 镜像之外，把每条日志桥接到
 * DownloadManager 日志缓冲（dm.log），使备份进度面板的「日志」Tab 能直接看到采集报错
 * （如「获取日志阅读数异常」），而不必去浏览器控制台翻找。DM 不可用时静默降级。
 */
function makeEngineLogger(uin: number | string): Logger {
    return new Logger({
        mirror: true,
        onRecord: (entry) => {
            try {
                const dm = ensureDm() as unknown as { log?: (lvl: string, m: string, extra?: unknown) => void } | null;
                const mod = entry.module ? `[${entry.module}] ` : '';
                dm?.log?.(entry.level, `${mod}${entry.message}`, entry.detail && entry.detail.length ? entry.detail : undefined);
            } catch {
                /* 日志桥接失败不影响备份主流程 */
            }
        },
    });
}

function getTargetUin(): number {
    const ctx = initContext(readEnv());
    return ctx?.targetUin || 0;
}

function readEnv(): { href: string; cookie: string; scriptTexts: () => string[] } {
    return {
        href: location.href,
        cookie: document.cookie,
        scriptTexts: () => Array.from(document.querySelectorAll('script')).map((s) => s.textContent || ''),
    };
}

/** 触发浏览器下载一个 Blob（用于任务清单等文件落盘） */
function downloadBlob(blob: Blob, filename: string): void {
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch { /* ignore */ } }, 1000);
    } catch (e) { console.error('触发文件下载失败', filename, e); }
}

/* ===== 配置文件读取 ===== */

/**
 * 读取助手配置（Task 1-A：config.ts 为唯一来源，不再依赖公共内容脚本注入的
 * window.Default_Config / window.QZone_Config 全局变量）。
 * core/shared/config.loadConfig 会读 chrome.storage.sync 并合并默认值，
 * 同时处理历史配置归一化（如 File→Browser）。为兼容引擎内部直接读取 window.QZone_Config，
 * 仍回写该全局变量。
 */
async function loadConfig(): Promise<Record<string, unknown>> {
    try {
        const merged = (await loadCoreConfig()) as Record<string, unknown>;
        window['QZone_Config'] = merged;
        qzoneConfig = merged;
        return merged;
    } catch {
        return window['QZone_Config'] as Record<string, unknown> || {};
    }
}

/* ===== 下载器预检 ===== */

/**
 * 经 background service worker 代理发起 Aria2 JSON-RPC 调用（与多媒体任务 Aria2Driver.call 同源）。
 * content script 运行在 qzone.qq.com(HTTPS) 下，直接 fetch 非 localhost 的 HTTP 地址会被
 * Mixed Content 拦截；background 持有 host_permissions ['<all_urls>']，可无限制发起请求。
 * 若 SW 休眠导致 sendMessage 失败，回退直连（仅对 localhost 有效，非本地地址仍会被拦截，属预期）。
 */
async function callAria2Rpc(
    host: string,
    method: string,
    params: unknown[],
): Promise<{ result?: unknown; error?: { message?: string } } | null> {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'qzone-export-precheck', method, params });
    try {
        const resp = (await chrome.runtime.sendMessage({
            from: 'content',
            type: 'aria2_rpc',
            host,
            body,
        })) as { ok: boolean; status?: number; data?: { result?: unknown; error?: { message?: string } }; error?: string } | undefined;
        if (!resp || !resp.ok) {
            throw new Error(resp?.error || `Aria2 RPC HTTP ${resp?.status ?? 'unknown'}`);
        }
        return resp.data ?? null;
    } catch (e) {
        const msg = (e as Error).message || '';
        if (msg.includes('Could not establish connection') || msg.includes('Extension context invalidated')) {
            const res = await fetch(host, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!res.ok) throw new Error(`Aria2 RPC HTTP ${res.status}`, { cause: e });
            const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
            return json ?? null;
        }
        throw e;
    }
}

interface PrecheckResult {
    ok: boolean;
    /** 单条合并后的提示文案（成功/失败均只此一条，失败会带上具体原因） */
    message: string;
}

/**
 * 下载器预检。返回结构化结果而非就地发通知：
 * 调用方据此发「单条」提示，避免成功/失败各出现多条重复通知。
 */
async function preCheckDownloader(): Promise<PrecheckResult> {
    const cfg = (qzoneConfig.Common || {}) as Record<string, unknown>;
    // 配置缺失时按默认下载方式兜底；Firefox 下直写目录(Disk)不可用，默认浏览器下载器
    const rawType = String(cfg.downloadType || defaultDownloadTypeFor(isFirefox));
    // Firefox 形态 B：直写目录不可用 → 归一化为浏览器下载器
    const downloadType = isFirefox && rawType === 'Disk' ? 'Browser' : rawType;
    const mediaMode = String(cfg.mediaMode || '');

    if (mediaMode === 'Link' || downloadType === 'Disk') return { ok: true, message: '下载器预检通过：当前模式无需下载器' };

    const aria2TestUrl = 'https://user.qzone.qq.com/favicon.ico';
    // 浏览器预检统一使用 QQ 空间网站 favicon（与 Aria2 一致）
    const browserTestUrl = 'https://user.qzone.qq.com/favicon.ico';

    if (downloadType === 'Aria2') {
        const aria2 = (cfg.Aria2 || {}) as Record<string, unknown>;
        const rpc = String(aria2.rpc || 'http://localhost:6800/jsonrpc');
        const token = typeof aria2.token === 'string' ? aria2.token : '';
        // 携带配置下载目录：预检直接写入用户配置的 Aria2 下载目录（即「根目录」），不拼接子路径，
        // 这样才能真实校验该目录是否可写（Motrix Next 等严格按传入 dir 建任务的下载器尤其依赖此）。
        // 未配置 dir 时不传该字段，交由 Aria2 使用其默认下载目录。
        const baseDir = typeof aria2.dir === 'string' && aria2.dir ? aria2.dir.replace(/\/+$/, '') : '';
        const options: Record<string, unknown> = {};
        if (baseDir) options.dir = baseDir;
        // 与多媒体任务一致注入 referer/UA/cookie，确保 Motrix Next 等「严格按传入参数建任务」
        // 的下载器在预检阶段也按真实任务的方式工作。
        options.referer = 'https://user.qzone.qq.com/';
        let ua = '';
        try { ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''; } catch { /* noop */ }
        if (ua) options['user-agent'] = ua;
        let ck = '';
        try { ck = document?.cookie || ''; } catch { /* noop */ }
        if (ck) options['cookie'] = ck;
        const headers: string[] = [];
        if (ua) headers.push(`User-Agent: ${ua}`);
        headers.push('Referer: https://user.qzone.qq.com/');
        if (ck) headers.push(`Cookie: ${ck}`);
        options.header = headers;

        const params: unknown[] = [];
        if (token) params.push('token:' + token);
        // aria2.addUri 的 URI 参数必须是字符串数组，不能直接传字符串，否则报
        // "The parameter at 0 has wrong type"。token 已作为首个参数前缀（若有）。
        params.push([aria2TestUrl], options);
        try {
            // 经 background(SW) 代理发起，避免 content script(HTTPS) 直连非本地 Aria2 被
            // Mixed Content 拦截而永远连不通（参照多媒体任务的 Aria2Driver.call 实现）。
            const data = await callAria2Rpc(rpc, 'aria2.addUri', params);
            if (data && data.result) {
                const removeParams = token ? ['token:' + token, data.result] : [data.result];
                try { await callAria2Rpc(rpc, 'aria2.remove', removeParams); } catch { /* ignore */ }
                return { ok: true, message: '下载器预检通过：Aria2 连接正常，开始备份…' };
            }
            const errMsg = (data && data.error && data.error.message) || JSON.stringify((data && data.error) || data);
            return { ok: false, message: '下载器预检未通过：Aria2 返回错误：' + errMsg };
        } catch (e) {
            return { ok: false, message: '下载器预检未通过：无法连接 Aria2（' + rpc + '）—— ' + String(e) };
        }
    }

    if (downloadType === 'Browser') {
        const task = { url: browserTestUrl, filename: '预检_若弹保存框请关闭下载前询问.ico' };
        const result: { ok: boolean; downloadId?: number; message?: string } | null = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ from: 'content', type: BG_MSG.DOWNLOAD_BROWSER, task }, (resp: Record<string, unknown> | undefined) => {
                resolve((resp && typeof resp === 'object') ? resp as { ok: boolean; downloadId?: number } : null);
            });
            setTimeout(() => resolve(null), 10000);
        });
        const dlId = result?.ok ? result.downloadId : 0;
        if (dlId && dlId > 0) {
            try { chrome.downloads.cancel(dlId); chrome.downloads.erase({ id: dlId }); } catch { /* ignore */ }
            return { ok: true, message: '下载器预检通过：浏览器下载器正常，开始备份…' };
        }
        return { ok: false, message: '下载器预检未通过：浏览器下载器测试失败' + (result?.message ? '：' + result.message : '') };
    }

    return { ok: true, message: '下载器预检通过' };
}

/* ===== 备份编排 ===== */

async function runBackup(
    exportTypes: string[],
    albumSelect: unknown[],
    setStage: (text: string, status?: string) => void,
    panel: Record<string, (...args: unknown[]) => unknown>,
): Promise<void> {
    const engine = window['__QZ_ENGINE__'] as {
        available(): boolean;
        pending(config: unknown): Promise<unknown>;
        start(opts: Record<string, unknown>): Promise<{ state: string; counts: Record<string, number>; footprintPoints?: Array<{ posX: number; posY: number }> }>;
    } | undefined;
    const targetUin = getTargetUin();
    // 重置 MarkDown 根 index.md 累加态：确保本次备份的根索引只含本备份实际导出的模块
    resetMarkdownRootIndex();
    // 启动阶段补齐目标用户资料，供 MarkDown 根 index 开篇说明 / HTML 模式 user.js 使用
    await ensureTargetProfile();
    if (!engine || !engine.available()) {
        logBackup('ERROR', targetUin, '采集引擎不可用（未获取到登录态），备份中止');
        if (panel.error) panel.error('采集引擎不可用，请刷新页面后重试');
        return;
    }
    logBackup('INFO', targetUin, `备份入口 | 模块=${exportTypes.join(', ')} | 待备份相册=${albumSelect.length} 个 | 引擎可用`);

    chrome.runtime.sendMessage({ from: 'content', type: BG_MSG.DNR_START }).catch(() => {});

    // 进度事件转发
    const onProgress = (event: Event) => {
        if (panel.dispatch) panel.dispatch((event as CustomEvent).detail || {});
    };
    window.addEventListener('qz-backup-progress', onProgress);

    try {
        // 断点检查
        const config = qzoneConfig;
        let pending: unknown;
        try {
            pending = await engine.pending((config.Common || {}) as unknown);
        } catch (e) {
            console.error('[engine-bridge] 引擎预检失败，降级为全量备份：', e);
            logBackup('WARN', targetUin, '引擎预检失败，降级为全量备份：' + ((e as Error)?.message || String(e)));
            pending = undefined;
        }
        let resume = false;
        if (pending) {
            const p = pending as { startedAt?: number };
            const time = new Date((p.startedAt || 0)).toLocaleString();
            logBackup('INFO', targetUin, `断点续传判定 | 存在未完成备份（startedAt=${time}）| 等待用户选择`);
            resume = (await panel.confirm?.('检测到 ' + time + ' 有一次未完成的备份，是否从中断处继续？\n选择「取消」将重新开始备份。')) as boolean || false;
            logBackup('INFO', targetUin, `断点续传判定 | 用户选择=${resume ? '恢复' : '全新备份'}`);
        } else {
            logBackup('INFO', targetUin, '断点续传判定 | 无未完成备份 | 模式=全新备份');
        }

        logBackup('INFO', targetUin, `启动引擎 run() | modules=${exportTypes.join(', ')} | resume=${resume}`);
        const result = await engine.start({
            modules: exportTypes,
            config: config,
            albums: albumSelect,
            targetNickname: (window['QZone_Common_Target'] as Record<string, unknown> | undefined)?.['nickname'],
            retry: (config.Common || {}) as unknown,
            resume,
        });
        logBackup('INFO', targetUin, `引擎 run() 返回 | state=${result.state} | 采集计数=${JSON.stringify(result.counts)}`);

        if (result.state === 'cancelled') {
            logBackup('WARN', targetUin, '备份已取消，断点已保留');
            setStage('备份已取消，断点已保留，下次备份可从中断处继续。');
            return;
        }

        // 其它信息导出
        // 进入「整理备份文件」收尾阶段：下载虽已 100%，但生成查看器 / 合并外部文件
        // 尚需时间。标记 finalizing 让总进度压在 99%、主状态行持续显示整理提示，
        // 待 complete() 才放行到 100%（避免「100% 却还在整理」的矛盾）。
        if (typeof (panel as Record<string, unknown>).beginFinalize === 'function') {
            (panel as unknown as { beginFinalize: (t: string) => void }).beginFinalize('内容采集完成，正在整理备份文件…');
        } else {
            setStage('内容采集完成，正在整理备份文件…');
        }
        const api = window['__QZ_BACKUP_API__'] as Record<string, (...args: unknown[]) => unknown> | undefined;
        let viewer: ViewerExportResult | undefined;
        // MarkDown 文案格式不生成 HTML 备份查看器（index.html 与 Common/ 查看器资源均不需要）
        const isMarkdownExport = String(((qzoneConfig.Common || {}) as Record<string, unknown>).exportType || 'HTML') === 'MarkDown';
        if (isMarkdownExport) {
            logBackup('INFO', targetUin, '导出格式为 MarkDown，跳过 HTML 备份查看器生成');
        } else if (api?.exportOthers) {
            // target/owner 已在备份启动阶段（ensureTargetProfile）补齐真实资料
            const target = (window['QZone_Common_Target'] || {}) as Record<string, unknown>;
            const owner = (window['QZone_Common_Owner'] || {}) as Record<string, unknown>;
            const userInfo = { ...target, ...result.counts, isOwner: target.uin === owner.uin, ownerUin: owner.uin || target.uin };
            // 恢复 V2「备份完成后把增量 JSON 同步导出」行为：读取刚落盘的增量备份行
            const backupRows = await sharedBackupDb.getRows(targetUin);
            // 足迹点由 engine 在写模块产物时收集（见 engine.ts writeJsonToJs 拦截）——
            // 不能在这里读 window.messages：writeJsonToJs 只写备份文件，从不注入页面全局
            viewer = (await api.exportOthers(userInfo, qzoneConfig, backupRows, targetUin, {
                points: result.footprintPoints || [],
                fetchText: lbsProxyFetchText,
            })) as ViewerExportResult | undefined;
        } else {
            console.error('备份收尾异常：exportOthers 接口不可用，备份查看器未生成');
            logBackup('ERROR', targetUin, '备份收尾异常：exportOthers 接口不可用，备份查看器未生成');
        }

        const usingDiskExport = sharedDisk.isEnabled();
        // 形态 B（Firefox）：等文案/查看器落盘队列排空，确保全部文件已写入下载目录再提示完成
        if (downloadsBackend && downloadsBackend.pendingCount > 0) {
            logBackup('INFO', targetUin, `收尾 | 等待 ${downloadsBackend.pendingCount} 个文案文件落盘…`);
            await downloadsBackend.flush();
        }
        const commonCfg = (qzoneConfig.Common || {}) as Record<string, unknown>;
        const mediaDownloader = String(commonCfg.downloadType || DEFAULT_DOWNLOAD_TYPE);
        // 外链模式（mediaMode=Link）媒体不下载、内容直接引用QQ空间外链，不存在需要合并的本地文件
        const mediaLinkMode = String(commonCfg.mediaMode || '') === 'Link';
        // 目录导出且媒体由外部下载器（浏览器/aria2）拉取时，才需要把外部文件合并回备份目录
        const needMerge = usingDiskExport && mediaDownloader !== 'Disk' && !mediaLinkMode;
        logBackup('INFO', targetUin, `收尾阶段 | 导出方式=${usingDiskExport ? 'directory' : 'downloads'} | 媒体下载器=${mediaDownloader} | 外链模式=${mediaLinkMode} | 需合并外部文件=${needMerge}`);
        panel.complete?.({
            mode: usingDiskExport ? 'directory' : 'downloads',
            downloadsMode: !!downloadsBackend,
            needMerge,
            mediaLinkMode,
        });
        // 备份完成后清空 IndexedDB 中的下载任务记录（STORE_TASKS）。
        // 若不清，多次备份累积数万条 tasks 会让 IndexedDB 膨胀到数百 MB，
        // 导致下次浏览器启动时 LevelDB 初始化阻塞，整个浏览器卡死。
        void ensureDm().clearStaleTasks();
        // complete() 会隐藏阶段提示，故查看器告警必须在其之后再 setStage 才可见
        if (viewer && !viewer.ok) {
            console.error('备份查看器生成失败', viewer.missingRequired);
            logBackup('ERROR', targetUin, `备份查看器生成失败 | 缺少=${viewer.missingRequired.join('、')}`);
            setStage(
                '备份数据已保存，但备份查看器生成失败（缺少 ' + viewer.missingRequired.join('、') +
                '）。可在「设置 - 工具 - 升级备份查看器」中选择本次备份目录补齐。',
                '查看器生成失败',
            );
        } else if (viewer?.usedFallbackIndex) {
            logBackup('WARN', targetUin, '备份查看器使用了兜底首页版本');
            setStage('备份完成。查看器首页使用了兜底版本，功能不受影响。', '备份完成');
        }
        logBackup('INFO', targetUin, '备份完成（含查看器/外部下载器收尾）');
        chrome.notifications?.create?.('', {
            type: 'basic', iconUrl: chrome.runtime.getURL('img/icon.png'),
            title: 'QQ空间导出助手', message: '备份完成！',
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('备份异常', error);
        logBackup('ERROR', targetUin, '备份异常 | ' + msg);
        if (panel.error) panel.error(msg);
    } finally {
        window.removeEventListener('qz-backup-progress', onProgress);
        chrome.runtime.sendMessage({ from: 'content', type: BG_MSG.DNR_STOP }).catch(() => {});
        logBackup('DEBUG', targetUin, '资源清理完成 | 移除进度监听/DNR 已停止');
    }
}

/* ===== 宿主能力 (BackupHost) ===== */

async function createHost(targetUin: number): Promise<BackupHost> {
    sharedWriter.setRootFolderName('QQ空间备份_' + targetUin);
    const dm = ensureDm();
    dm.setUin(targetUin);
    // 注意：媒体清单的恢复 / 清空【不在此处执行】。
    // createHost 会被 pending() 预检以 resume=false 触发，若在此 clear 会在用户尚未选择
    // 「恢复」前就把整个 tasks store 清空，导致后续 restoreManifestFromQueue 读空库、
    // 续传媒体清单永远恢复不出来、已下载媒体（含说说第一页）被重登记重下。
    // 恢复 / 清空改由 __QZ_ENGINE__.start() 在用户做出续传/全新决策之后、engine.run 注册
    // 采集任务之前执行（见下方 start 处理器）。
    // 从配置注入并发上限与提交间隔（对应 Options.downloadThread / downloadSleep，
    // 旧版 _.chunk 分批并行语义；TS 化重构时丢失，这里重新接线）
    const commonCfg = (qzoneConfig.Common || {}) as Record<string, unknown>;
    dm.setConcurrencyLimit(Number(commonCfg.downloadThread) || 10);
    dm.setSubmitIntervalMs((Number(commonCfg.downloadSleep) || 0) * 1000);
    // 文案落盘并发与媒体共享 downloadThread（用户拍板）
    downloadsBackend?.setConcurrency(Number(commonCfg.downloadThread) || 10);
    const globalTarget = window as unknown as Record<string, unknown>;
    return {
        async writeJsonToJs(global, data, path) {
            await sharedWriter.writeJsonToJs(global as string, data, path as string);
        },
        async writeText(text, path) {
            await sharedWriter.writeText(text as string, path as string);
        },
        async writeFile(data, path) {
            await sharedWriter.writeFile(data as Uint8Array | Blob, path as string);
        },
        addMediaTask(task: MediaTask) {
            try {
                if (dm && typeof dm.upsert === 'function') {
                    const cfg = (globalTarget['QZone_Config'] || {}) as Record<string, Record<string, unknown>>;
                    const rawDt = String((cfg.Common && cfg.Common.downloadType) || DEFAULT_DOWNLOAD_TYPE);
                    // Firefox 下直写目录(Disk)不可用 → 归一化为 browser
                    const dt = isFirefox && rawDt === 'Disk' ? 'Browser' : rawDt;
                    const trackerType: 'browser' | 'disk' | 'aria2' =
                        dt === 'Aria2' ? 'aria2' : dt === 'Disk' ? 'disk' : 'browser';
                    if (trackerType === 'aria2' && !aria2Configured) {
                        const a = cfg.Common?.Aria2 as Record<string, string> | undefined;
                        if (a?.rpc) { dm.configureAria2({ host: a.rpc, token: a.token, dir: a.dir }); aria2Configured = true; }
                    }
                    const liveTask = dm.upsert({
                        module: task.module, url: task.url, dir: task.dir, name: task.name,
                        state: 'pending', ownerId: task.ownerId, ownerTitle: task.ownerTitle,
                        thumbUrl: task.thumbUrl, trackerType, _src: 'engine-bridge',
                        // 视频任务(prioritized)提升优先级，使并发槽释放时优先插队下载，避免直链排队过期
                        priority: task.prioritized ? 1 : 0,
                    });
                    if (liveTask?.id && typeof dm.submitTask === 'function') {
                        void Promise.resolve().then(() => dm.submitTask(liveTask.id)).catch((e) => {
                            dm.log?.('WARN', `[engine-bridge] 提交下载失败 dmId=${liveTask.id} err=${(e as Error)?.message || e}`);
                        });
                    }
                }
            } catch (e) { console.warn('[engine-bridge] addMediaTask 失败', e); }
        },
        async detectSuffix(url) {
            try {
                const common = (qzoneConfig.Common || {}) as Record<string, unknown>;
                const timeoutSec = Number(common.autoFileSuffixTimeOut);
                const timeoutMs = (Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : 5) * 1000;
                return (await autoFileSuffix(url, true, timeoutMs)) || '';
            }
            catch (error) { console.warn('识别文件后缀异常', url, error); return ''; }
        },
        async startKeepAlive() { sendKeepAlive(BG_MSG.KEEPALIVE_START); },
        async stopKeepAlive() { sendKeepAlive(BG_MSG.KEEPALIVE_STOP); },
        async exportMarkdown(module, items) {
            const common = (qzoneConfig.Common || {}) as Record<string, unknown>;
            const target = (window['QZone_Common_Target'] || {}) as Record<string, unknown>;
            const spaceNameVal = target.spacename ?? target.spaceName;
            await exportModuleMarkdown(module as string, items, sharedWriter, {
                // 外链模式（mediaMode=Link）媒体不下载、引用在线地址；否则引用下载到本地的文件
                isQzoneUrl: String(common.mediaMode) === 'Link' || String(common.downloadType) === 'QZone',
                hasUserLink: common.hasUserLink !== false,
                nickname: typeof target.nickname === 'string' ? target.nickname : undefined,
                spaceName: typeof spaceNameVal === 'string' ? spaceNameVal : undefined,
                desc: typeof target.desc === 'string' ? target.desc : undefined,
                signature: typeof target.signature === 'string' ? target.signature : undefined,
                uin: (target.uin as number | string | undefined) ?? undefined,
                exportTime: new Date(),
                // 透传原始 user.js 档案，供根 index.md 的「空间资料」小节使用
                profile: target,
            });
        },
    };
}

function sendKeepAlive(type: typeof BG_MSG.KEEPALIVE_START | typeof BG_MSG.KEEPALIVE_STOP): void {
    try {
        void Promise.resolve(chrome.runtime.sendMessage({ from: 'content', type })).catch((error) => {
            console.warn('保活消息发送异常', type, error);
        });
    } catch (error) {
        console.warn('保活消息发送异常', type, error);
    }
}

/**
 * 补齐目标用户真实资料（昵称/空间名/头像/简介）并合并回 window.QZone_Common_Target/Owner。
 * 在每次备份启动阶段调用一次，使 MarkDown 根 index 开篇说明与 HTML 模式 user.js 都能拿到空间主人信息
 * （v3 重构后 QZone_Common_Target 在页面环境中是空壳，不补齐则昵称/空间名/简介全丢失）。
 */
async function ensureTargetProfile(): Promise<void> {
    try {
        const target = (window['QZone_Common_Target'] || {}) as Record<string, unknown>;
        const owner = (window['QZone_Common_Owner'] || {}) as Record<string, unknown>;
        const ctx = initContext(readEnv());
        if (!ctx) return;
        const requester = new Requester({ config: () => (qzoneConfig.Common || {}) as RetryConfig });
        const fetched = await fetchTargetUserInfo(ctx, requester);
        mergeTargetUserInfo(target, owner, fetched, { targetUin: ctx.targetUin, ownerUin: ctx.ownerUin });
        logBackup('INFO', ctx.targetUin, `用户资料补齐 | spaceName=${String(fetched.spaceName || '')} | desc=${String(fetched.desc || '')} | nickname=${String(fetched.nickname || '')}`);
    } catch (e) {
        console.error('[QZ-DIAG] 补齐用户资料失败，回退使用页面空壳', e);
        logBackup('WARN', getTargetUin(), '用户资料补齐失败，将使用页面空壳数据 | ' + (e instanceof Error ? e.message : String(e)));
    }
}

/* ===== 入口 ===== */

export default defineContentScript({
    matches: ['https://*.qzone.qq.com/*'],
    main() {
        if (location.href.indexOf('qzone.qq.com') === -1 || location.protocol === 'filesystem:') return;
        console.log('[QZ-DIAG] engine-bridge main() start', location.href.slice(0, 70));

        const globalTarget = window as unknown as Record<string, unknown>;
        ensureDm();

        /* ===== __QZ_BACKUP_API__ ===== */
        globalTarget['__QZ_BACKUP_API__'] = {
            async selectRoot(): Promise<string> {
                const handle = await sharedDisk.selectRoot();
                (globalThis as Record<string, unknown>)['__QZ_DISK_FS__'] = sharedDisk;
                ensureDm();
                return handle?.name || '';
            },
            isDiskMode(): boolean { return sharedDisk.isEnabled(); },
            getRootName(): string { return sharedWriter.getRootFolderName(); },
            async exportOthers(
                userInfo: unknown,
                config: unknown,
                backupRows?: unknown,
                uin?: unknown,
                district?: { points: Array<{ posX: number; posY: number }>; fetchText: (url: string) => Promise<string> },
            ): Promise<ViewerExportResult> {
                ensureDm();
                // 查看器生成失败不抛异常，结果回传给编排层决定如何提示
                return exportOthers(
                    sharedWriter,
                    userInfo as Record<string, unknown> as UserInfo,
                    config as Record<string, unknown>,
                    console,
                    backupRows as ModuleBackupRow[] | undefined,
                    uin as number | string | undefined,
                    district as ViewerDistrictInput | undefined,
                );
            },
            getWriter(): FileWriter { return sharedWriter; },
            getDownloadManager(): DownloadManager { return ensureDm(); },
        };

        /* ===== __QZ_ENGINE__ ===== */
        let currentEngine: BackupEngine | undefined;
        globalTarget['__QZ_ENGINE__'] = {
            available(): boolean { return !!initContext(readEnv()); },
            async pending(retry: RetryConfig) {
                const engine = await createEngine({ modules: [], config: globalTarget['QZone_Config'] as QzoneBackupConfig, retry });
                return engine?.getPendingCheckpoint();
            },
            async start(options: Record<string, unknown>) {
                await mergePresets(options.config as Record<string, Record<string, unknown>>);
                const engine = await createEngine(options as Record<string, unknown> & { retry: RetryConfig });
                if (!engine) {
                    logBackup('ERROR', initContext(readEnv())?.targetUin ?? 'unknown', '无法初始化备份引擎：未获取到登录态');
                    throw new Error('无法初始化备份引擎：未获取到登录态');
                }
                const uin = initContext(readEnv())?.targetUin ?? 'unknown';
                currentEngine = engine;
                logBackup('INFO', uin, `创建备份引擎 | modules=${(options.modules as string[] || []).join(', ')} | 相册=${((options.albums as unknown[]) || []).length} 个`);
                engine.events.on((event) => {
                    window.dispatchEvent(new CustomEvent('qz-backup-progress', { detail: event }));
                });
                let resume = Boolean(options.resume);
                // 媒体任务清单恢复 / 清空：必须在【用户决策之后、engine.run 注册采集任务之前】执行。
                // 严禁放到 createHost：pending() 预检会以 resume=false 触发 createHost 并误清 tasks，
                // 导致这里读空库、续传清单恢复不出来；已下载媒体（含说说第一页）被重登记重下。
                const dm = ensureDm();
                if (resume) {
                    // 续传：先恢复完整媒体清单（含已下载/失败），使媒体页签立即显示全量；
                    // 与采集器 restore() 重注册的任务按 id 去重，不会重复/覆盖。必须 await 确保先于 run。
                    const restored = await dm.restoreManifestFromQueue()
                        .then(() => true)
                        .catch((e) => {
                            dm.log?.('ERROR', '[engine-bridge] 续传恢复媒体清单失败，退化为全新备份：' + ((e as Error)?.message || String(e)));
                            return false;
                        });
                    if (!restored) {
                        // H-5 修复：清单恢复失败 → 无法续传，退化为全新备份（后续统一清残留 + 丢弃断点），
                        // 避免「假装续传成功却无媒体清单」导致媒体缺失且用户无感知。
                        resume = false;
                    }
                }
                if (!resume) {
                    // 全新备份（或续传退化）：清理上次备份残留的下载任务记录（STORE_TASKS）。
                    // await 确保清除先于本次备份注册新任务，避免残留任务混入。
                    await dm.clearStaleTasks().catch((e) => {
                        dm.log?.('ERROR', '[engine-bridge] 清空旧媒体任务清单失败：' + ((e as Error)?.message || String(e)));
                    });
                }
                const resumeFrom = resume ? await engine.getPendingCheckpoint() : undefined;
                if (resume && resumeFrom) {
                    logBackup('INFO', uin, `恢复断点 | 从上次未完成备份继续（checkpoint 已加载）`);
                } else if (resume) {
                    logBackup('WARN', uin, '请求恢复断点但未找到有效 checkpoint，将执行全新备份');
                }
                if (!resume) {
                    logBackup('INFO', uin, '丢弃上次断点，执行全新备份');
                    await engine.discardCheckpoint();
                }
                return await engine.run(resumeFrom);
            },
            pause: () => currentEngine?.pause(),
            resume: () => currentEngine?.resume(),
            cancel: () => currentEngine?.cancel(),
            state: () => currentEngine?.getState() || 'idle',
            async getDownloadedUrls(): Promise<string[]> {
                const ctx = initContext(readEnv()); if (!ctx) return [];
                return [...(await sharedCheckpointStore.getDownloadedUrls(ctx.targetUin))];
            },
            async markDownloaded(entries: Array<{ url: string; dir?: string }>): Promise<void> {
                const ctx = initContext(readEnv()); if (!ctx || entries.length === 0) return;
                await sharedCheckpointStore.markDownloadedBatch(ctx.targetUin, entries);
            },
            async getAlbumList(): Promise<unknown[]> {
                const ctx = initContext(readEnv()); if (!ctx) return [];
                // 确认弹窗可能早于 loadConfig 触发，这里确保配置分组（Photos.pageSize）已就绪
                let cfg = (globalTarget['QZone_Config'] || {}) as any;
                if (!cfg.Photos) cfg = await loadConfig();
                const call = albumList(ctx, cfg, 0);
                const qs = serializeParams(call.params);
                const res = await fetch(call.url + '?' + qs, { credentials: 'include' });
                const text = await res.text();
                const json = toJson<{ code: number; message?: string; data?: { classList?: Array<{ id: string; name: string }>; albumList?: unknown[] } }>(text, /^shine0_Callback\(/);
                // 失败时不再静默返回空清单，抛错让 UI 能区分"没有相册"与"拉取失败"
                if (json.code !== 0) throw new Error(`获取相册列表失败(code=${json.code})：${json.message || '未知错误'}`);
                if (!json.data) return [];
                const classMap: Record<string, string> = {};
                for (const c of json.data.classList || []) classMap[c.id] = c.name;
                const list = json.data.albumList || [];
                for (const album of list as Record<string, unknown>[]) album.className = classMap[String(album.classid)] || '其他';
                return list;
            },
            async probeDiaries(): Promise<unknown> {
                const ctx = initContext(readEnv()); if (!ctx) return { code: -1 };
                const call = diaryList(ctx, (globalTarget['QZone_Config'] || {}) as any, 0);
                const qs = serializeParams(call.params);
                const res = await fetch(call.url + '?' + qs, { credentials: 'include' });
                return toJson(await res.text(), /^_Callback\(/);
            },
            /**
             * 断点补偿（手动重试）：仅重采 ledger 中 failed/missing 页。
             * 必须在一次 start() 产生的引擎实例（currentEngine）仍存活时调用，
             * 复用其 env 与采集器实例；uin 仅用于日志，实际取引擎自身上下文。
             * 不传 module 则对全部已勾选模块重试；传则只重试指定模块。
             */
            async retryFailedPages(uin?: number, module?: string): Promise<void> {
                if (!currentEngine) {
                    throw new Error('备份引擎尚未初始化，无法重试失败页（请先运行一次备份）');
                }
                logBackup('INFO', uin ?? 'unknown', `手动重试失败页 | module=${module || '全部'}`);
                await currentEngine.retryFailedPages(module ? [module] : undefined);
            },
            /**
             * 采集明细聚合器（供备份面板「📑 采集明细」Tab 读取页级账本）。
             * 实时反映任意一轮备份留下的 failed/missing/dead 页记录（账本持久化在 chrome.storage.local）。
             */
            getDetailMgr(): DetailManager {
                const getUin = () => initContext(readEnv())?.targetUin;
                return new DetailManager(sharedLedger, getUin);
            },
        };

        async function mergePresets(config: Record<string, Record<string, unknown>>): Promise<void> {
            try {
                const stored = await chrome.storage.local.get(['QZoneExport_Presets']);
                const presets = stored.QZoneExport_Presets as Record<string, unknown[]> | undefined;
                if (!presets) return;
                if (presets.filterKeywords?.length && config.Messages) {
                    const user = Array.isArray(config.Messages.FilterKeyWords) ? config.Messages.FilterKeyWords as string[] : [];
                    config.Messages.FilterKeyWords = [...new Set([...(presets.filterKeywords as string[]), ...user])];
                }
                if (presets.shareSources?.length && config.Shares) {
                    const user = Array.isArray(config.Shares.SourceType) ? config.Shares.SourceType as Array<{ name: string; regulars: string }> : [];
                    const existing = new Set(user.map((s) => s.regulars));
                    const extra = (presets.shareSources as Array<{ name: string; regulars: string }>).filter((s) => !existing.has(s.regulars));
                    if (extra.length) config.Shares.SourceType = [...user, ...extra];
                }
            } catch { /* ignore */ }
        }

        async function createEngine(options: Record<string, unknown> & { retry: RetryConfig }): Promise<BackupEngine | undefined> {
            const ctx = initContext(readEnv()); if (!ctx) return undefined;
            const host = await createHost(ctx.targetUin);
            return new BackupEngine({
                ctx, config: options.config as QzoneBackupConfig,
                modules: (options.modules || []) as ModuleName[],
                host, retry: options.retry,
                checkpointStore: sharedCheckpointStore,
                ledger: sharedLedger,
                selectedAlbums: options.albums as any,
                targetNickname: options.targetNickname as string | undefined,
                // 采集引擎日志桥接到 DownloadManager，使「日志」Tab 可见采集报错（不再只有控制台可见）
                logger: makeEngineLogger(ctx.targetUin),
                // 腾讯地图/DataV 拉取统一走 background 代理（content 直连会被 CORS 拦）
                lbsProxy: lbsProxyFetchText,
                // 必须走 background 代理：content script 的 IndexedDB 属于 QQ空间页面 origin，
                // 直接写会导致 Options 页面（扩展 origin）的「增量备份」表格永远读不到数据
                backupDb: sharedBackupDb,
            });
        }

        /* ===== 初始化配置 + Popup 消息监听（取代旧 content.js 编排层） ===== */

        loadConfig().then(() => {
            // 旧 content.js 中的 OperatorType.INIT 等价物：初始化 g_tk / token / uin
            const qzCfg = (window['QZone_Config'] || {}) as Record<string, Record<string, unknown>>;
            const configJs = (window as Record<string, unknown>);
            // 如果旧 config.js 已加载并暴露了 initGtk/getQZoneToken/initUin，则调用它们
            // 否则从现有全局数据中读取（新引擎自己从 context/cookie 推断）
        });

        chrome.runtime.onConnect.addListener((port) => {
            if (port.name !== 'popup') return;
            port.onMessage.addListener((request) => {
                const req = request as { subject?: string; exportType?: string[]; albums?: unknown[]; isOwner?: boolean };
                switch (req.subject) {
                    case 'startBackup': {
                        const exportTypes = req.exportType || [];
                        const albums = req.albums || [];
                        loadConfig().then(() => {
                            const panel = window['__QZ_BACKUP_PANEL__'] as Record<string, (...args: unknown[]) => unknown> | undefined;
                            if (!panel) { console.error('进度面板不可用'); return; }
                            // totalModules 在此刻（用户勾选完模块点击开始）即固定，
                            // 面板据此渲染「X/Y 模块」，避免随备份推进递增（见 #7）
                            panel.open?.({ mode: sharedDisk.isEnabled() ? 'directory' : 'downloads', downloadsMode: !!downloadsBackend, totalModules: exportTypes.length, selectedModules: exportTypes, isOtherSpace: req.isOwner === false });
                            try { if (window['__QZ_BACKUP_PANEL__DM_ATTACH__']) (window['__QZ_BACKUP_PANEL__DM_ATTACH__'] as () => void)(); } catch { /* ignore */ }

                            // 接面板动作：重试失败下载（修复按钮无响应问题；打包下载已随 Zip 功能下线）
                            const panelWithAction = panel as unknown as { onAction?: (cb: (action: string) => void) => void };
                            panelWithAction.onAction?.((action) => {
                                const dm = ensureDm();
                                if (action === 'retry-downloads') {
                                    if (dm && typeof dm.retryFailed === 'function') void dm.retryFailed();
                                }
                            });

                            const runOrchestration = async () => {
                                const setStage = (text: string, status?: string) => panel.setStage?.(text, status);
                                // 预检下载器：结果合并为「单条」提示。
                                // 失败 → panel.error（P0 红色、不自动消失，比原先 5 秒即逝的 P2 明显）；
                                // 成功 → 单条「预检通过」提示。不再重复追加「下载器预检未通过」造成两条。
                                const pre = await preCheckDownloader();
                                if (!pre.ok) { panel.error?.(pre.message); return; }
                                panel.setStage?.(pre.message, '预检通过');
                                // 产出方式由运行环境能力决定（用户无需手动选择）：
                                // 支持 File System Access API → 直写本地目录；否则（Firefox）经 Downloads 直写下载目录。
                                // 因此只有环境支持时才在开始前弹目录选择。
                                const useDirectory = DiskFS.isSupported();
                                if (useDirectory) {
                                    await panel.waitForDirectory?.(async () => {
                                        const api = window['__QZ_BACKUP_API__'] as Record<string, () => Promise<string>> | undefined;
                                        return api?.selectRoot ? await api.selectRoot() : '';
                                    });
                                }
                                // 正式运行备份
                                window['QZone_Common_Target'] = window['QZone_Common_Target'] || {};
                                window['QZone_Common_Owner'] = window['QZone_Common_Owner'] || {};
                                await runBackup(exportTypes, albums, setStage, panel);
                            };
                            void runOrchestration().catch((e) => console.error('编排异常', e));
                        });
                        port.postMessage(exportTypes);
                        break;
                    }
                    case 'initUin': {
                        const ctx = initContext(readEnv());
                        port.postMessage(ctx ? { Owner: { uin: ctx.ownerUin }, Target: { uin: ctx.targetUin } } : {});
                        break;
                    }
                    case 'initDiaries': {
                        (async () => {
                            try {
                                const engine = window['__QZ_ENGINE__'] as Record<string, () => Promise<unknown>> | undefined;
                                const ctxReady = !!initContext(readEnv());
                                console.log('[QZ-DIAG] initDiaries: engine?', !!engine, 'ctxReady?', ctxReady);
                                if (!engine?.probeDiaries || !ctxReady) {
                                    // 引擎或登录态未就绪——回可重试错误，让确认弹窗退避重试
                                    // 同时带 code:-1 兼容旧探测逻辑（按 code !== -1 判定就绪）
                                    port.postMessage({ code: -1, error: '采集引擎尚未就绪，请刷新空间页面后重试' });
                                    return;
                                }
                                const data = await engine.probeDiaries();
                                console.log('[QZ-DIAG] initDiaries result:', JSON.stringify(data).slice(0, 200));
                                port.postMessage(data);
                            } catch (e) {
                                console.error('[QZ-DIAG] initDiaries error', e);
                                port.postMessage({ error: e instanceof Error ? e.message : String(e) });
                            }
                        })();
                        break;
                    }
                    case 'getAlbumList': {
                        (async () => {
                            try {
                                const engine = window['__QZ_ENGINE__'] as Record<string, () => Promise<unknown[]>> | undefined;
                                const ctxReady = !!initContext(readEnv());
                                console.log('[QZ-DIAG] getAlbumList: engine?', !!engine, 'ctxReady?', ctxReady);
                                if (!engine?.getAlbumList || !ctxReady) {
                                    // 引擎或登录态未就绪——回可重试错误，让确认弹窗退避重试
                                    port.postMessage({ error: '采集引擎尚未就绪，请刷新空间页面后重试' });
                                    return;
                                }
                                const data = await engine.getAlbumList();
                                console.log('[QZ-DIAG] getAlbumList result:', Array.isArray(data) ? `array(${data.length})` : JSON.stringify(data).slice(0, 200));
                                port.postMessage(data);
                            } catch (e) {
                                // 回传错误而非空数组，避免"拉取失败"被界面误显示为"没有相册"
                                console.error('[QZ-DIAG] 获取相册列表失败', e);
                                port.postMessage({ error: e instanceof Error ? e.message : String(e) });
                            }
                        })();
                        break;
                    }
                    case 'initConfig': {
                        loadConfig().then((cfg) => port.postMessage(cfg)).catch(() => port.postMessage({}));
                        break;
                    }
                    default: break;
                }
            });
        });
    },
});
