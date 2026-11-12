import { heartBeat } from '../../qzone-api/clients';
import type { QzoneContext } from '../../qzone-api/context';
import { Requester, serializeParams, type RetryConfig } from '../../qzone-api/request';
import { Logger } from '../../shared/logger';
import { classifyError } from '../../shared/errors';
import { TIMING } from '../../shared/constants';
import { getGlobal, getWindow } from '../../shared/env';
import { sleep, formatDateValue } from '../../shared/utils';
import { parseDate } from '../../shared/format';
import { DEFAULT_INCREMENT_TIME } from '../increment';
import { acceptCrossWorldMessage, CW_MESSAGE, newNonce } from '../../shared/cross-world';
import { BackupDb, type BackupHistoryStore, type ModuleBackupRow } from '../../store/backup-db';
import { CheckpointStore, type BackupCheckpoint } from '../checkpoint';
import { EventBus, type ProgressEvent } from '../events';
import { PageLedger, makeBatchId } from '../reliability';
import { Pipeline, type CollectContext, type ModuleCollector, type PipelineState } from '../pipeline';
import { BlogsCollector } from './blogs';
import { BoardsCollector } from './boards';
import { DiariesCollector } from './diaries';
import { FavoritesCollector } from './favorites';
import { FriendsCollector } from './friends';
import { AvatarTaskRegistry, clearUnwrapImageUrlCache } from './helpers';
import { MODULES } from '../../shared/backup-options';
import { resolveConfig } from './resolve';
import { MessagesCollector } from './messages';
import { PhotosCollector, type AlbumItem } from './photos';
import { SharesCollector } from './shares';
import { VideosCollector } from './videos';
import { VisitorsCollector } from './visitors';
import type { CollectorEnv, MediaTask, QzoneBackupConfig } from './types';

/**
 * 备份引擎（P3 接线层）
 * 把 10 个模块采集器接入 pipeline：统一构造运行环境、按勾选顺序编排、
 * 断点续传由 CheckpointStore 承载，产物写出与媒体下载委托给宿主环境实现
 */

/** 模块采集顺序（与旧版 content.js OperatorType 序列一致） */
export const MODULE_ORDER = [
    'Messages',
    'Blogs',
    'Diaries',
    'Photos',
    'Videos',
    'Boards',
    'Friends',
    'Favorites',
    'Shares',
    'Visitors',
] as const;

export type ModuleName = (typeof MODULE_ORDER)[number];

// 一致性兜底：MODULE_ORDER（执行顺序）必须与 backup-options.MODULES（模块集合）完全对应，
// 新增模块时若只改了一处，这里会在启动/构建期抛出，避免两处列表悄悄不同步
{
    const moduleValues = MODULES.map((m) => m.value);
    const orderValues = MODULE_ORDER as readonly string[];
    if (
        orderValues.length !== moduleValues.length ||
        !orderValues.every((v) => moduleValues.includes(v)) ||
        !moduleValues.every((v) => orderValues.includes(v))
    ) {
        throw new Error('MODULE_ORDER 与 backup-options.MODULES 不一致，请同步更新两处模块列表');
    }
}

/** 宿主环境需提供的能力（内容脚本实现：文件写入、媒体下载、后缀探测） */
export interface BackupHost {
    /** 写数据文件：window.<global> = <data> */
    writeJsonToJs(global: string, data: unknown, path: string): Promise<void>;
    /** 写文本文件 */
    writeText(text: string, path: string): Promise<void>;
    /** 写二进制文件（如好友 Excel .xlsx） */
    writeFile(data: Uint8Array | Blob, path: string): Promise<void>;
    /** 登记媒体下载任务 */
    addMediaTask(task: MediaTask): void;
    /** URL后缀探测（经SW请求MIME识别，失败返回空串） */
    detectSuffix(url: string): Promise<string>;
    /** 备份期间保活（可选） */
    startKeepAlive?(): Promise<void>;
    stopKeepAlive?(): Promise<void>;
    /** MarkDown 导出（可选；exportType === 'MarkDown' 时由采集器触发） */
    exportMarkdown?(module: string, items: unknown): Promise<void>;
}

export interface BackupEngineOptions {
    ctx: QzoneContext;
    config: QzoneBackupConfig;
    /** 本次勾选的模块 */
    modules: ModuleName[];
    /** 宿主能力 */
    host: BackupHost;
    /** 请求器重试配置 */
    retry: RetryConfig;
    /** 用户勾选的相册（为空表示备份全部相册） */
    selectedAlbums?: AlbumItem[];
    /** 备份目标昵称（收藏模块写入 custom_name） */
    targetNickname?: string;
    /** 可注入的存储（测试用） */
    checkpointStore?: CheckpointStore;
    /** 页级可靠性账本（默认 new PageLedger()，持久化在 chrome.storage.local） */
    ledger?: PageLedger;
    /**
     * 备份历史存储。chrome.storage.local 是扩展作用域、跨 content / background / Options 共享，
     * 故 content script 直接传入 new BackupDb() 即可，Options 页面读到的也是同一份。
     */
    backupDb?: BackupHistoryStore;
    /** 可注入的等待实现（测试免等待） */
    sleepFn?: (ms: number) => Promise<void>;
    /** 可注入的fetch（测试用） */
    fetchFn?: typeof fetch;
    /** 腾讯地图 API 代理（MV3 下 content script 直连 apis.map.qq.com 会被 CORS 拦截） */
    lbsProxy?: (url: string) => Promise<string>;
    /** 可注入的日志器（测试用；不传则引擎自建） */
    logger?: Logger;
}

/** 各模块本次采集到的条目数（供首页统计使用，键名与旧版 userInfo 的统计字段一致） */
export interface BackupCounts {
    messages: number;
    blogs: number;
    diaries: number;
    photos: number;
    videos: number;
    boards: number;
    favorites: number;
    shares: number;
    friends: number;
    visitors: number;
}

/** 引擎运行结果 */
export interface BackupResult {
    state: PipelineState;
    counts: BackupCounts;
    /** 本次备份的带坐标足迹点（供查看器导出按市补齐区县地图） */
    footprintPoints?: Array<{ posX: number; posY: number }>;
}

/** 产物为数组时取数组，否则空数组 */
function asArray(data: unknown): any[] {
    return Array.isArray(data) ? data : [];
}

/** 产物为「{ items } 对象」时取 items（留言/访客） */
function itemsOf(data: unknown): any[] {
    const items = (data as { items?: unknown } | null | undefined)?.items;
    return Array.isArray(items) ? items : [];
}

export class BackupEngine {
    readonly events = new EventBus();
    /** 分级日志器（贯穿整轮备份，可在结束后导出写入备份目录） */
    readonly logger: Logger;
    private readonly checkpointStore: CheckpointStore;
    /** 页级可靠性账本（持久化在 chrome.storage.local，供断点补偿/采集明细读取） */
    readonly ledger: PageLedger;
    private readonly backupDb: BackupHistoryStore;
    private readonly requester: Requester;
    private pipeline?: Pipeline;
    /** 写模块产物时顺带收集的带坐标足迹点（供区县地图导出） */
    private districtPoints: Array<{ posX: number; posY: number }> = [];
    /** 最近一次 run/prepare 构建的采集环境（手动重试重采复用，避免重建 host/requester） */
    private env?: CollectorEnv;
    /** 最近一次 run/prepare 构建的采集器列表（手动重试重采复用同一批实例） */
    private collectors?: ModuleCollector[];
    /** 本轮错误按分类计数（备份结束时汇总到日志） */
    private readonly errorTally: Record<string, number> = {};
    /** 心跳定时器（备份期间保持会话不失效） */
    private heartBeatTimer?: ReturnType<typeof setInterval>;
    /** 各模块采集条目数（由产物写出时统计） */
    private readonly counts: BackupCounts = {
        messages: 0,
        blogs: 0,
        diaries: 0,
        photos: 0,
        videos: 0,
        boards: 0,
        favorites: 0,
        shares: 0,
        friends: 0,
        visitors: 0,
    };
    /** 跨隔离世界日志桥接：v3 引擎运行在独立的 content script 隔离世界，
     *  无法直接访问 window.QZoneDownloadManager（旧版 DM 在另一个隔离世界）。
     *  通过 window.postMessage 向 DM 世界请求日志，按 reqId 配对回包。 */
    private readonly dmLogWaiters = new Map<number, { nonce: number; resolve: (text: string) => void }>();
    private dmLogReqSeq = 0;
    private readonly dmLogBridgeHandler = (ev: MessageEvent) => {
        try {
            // 来源校验：仅接受本窗口（排除 iframe / 其它 frame）且类型合法的消息
            const data = acceptCrossWorldMessage<{
                type: string;
                reqId?: number;
                nonce?: number;
                text?: string;
            }>(ev, [CW_MESSAGE.LOG_RESPONSE]);
            if (!data) return;
            const entry = this.dmLogWaiters.get(data.reqId as number);
            if (entry && entry.nonce === data.nonce) {
                this.dmLogWaiters.delete(data.reqId as number);
                entry.resolve(typeof data.text === 'string' ? data.text : '');
            }
        } catch (_) { /* ignore */ }
    };

    constructor(private readonly options: BackupEngineOptions) {
        this.checkpointStore = options.checkpointStore || new CheckpointStore();
        this.ledger = options.ledger || new PageLedger();
        this.backupDb = options.backupDb || new BackupDb();
        this.logger = options.logger || new Logger();
        this.requester = new Requester({
            config: () => options.retry,
            fetchFn: options.fetchFn,
            sleepFn: options.sleepFn,
            events: {
                onRetry: (info) => {
                    // F7: 保留业务码，避免 classifyError 退化为 unknown（文案变更时仍可靠归类）
                    const err = new Error(info.message);
                    if (info.code !== undefined) (err as { code?: number }).code = info.code;
                    const cls = classifyError(err);
                    // 诊断：把在途并发数与接口标识带出，用于区分「单循环重试」与「大量并发各自重试」
                    const inflight = info.inFlight !== undefined ? '，并发=' + info.inFlight : '';
                    const apilabel = info.api ? '，接口=' + info.api : '';
                    this.logger.warn('接口失败待重试（剩 ' + info.remain + ' 次，' + cls.category + inflight + apilabel + '）', info.message);
                    this.events.emit({
                        type: 'request-retry',
                        message: info.message,
                        remain: info.remain,
                        retryAt: info.retryAt,
                        category: cls.category,
                        inFlight: info.inFlight,
                        api: info.api,
                    });
                },
                onRecover: () => this.events.emit({ type: 'request-recover' }),
                onGiveUp: (info) => {
                    // 日志与计数统一由下方 module-error 订阅处理，这里只发事件
                    const giveUp = info as { api?: string };
                    const err = new Error(info.message);
                    if (info.code !== undefined) (err as { code?: number }).code = info.code;
                    const cls = classifyError(err);
                    this.events.emit({ type: 'module-error', module: '*', error: info.message, category: cls.category, api: giveUp.api });
                },
            },
        });
        // 集中处理生命周期事件：模块状态转换、重试、暂停/恢复/取消/完成，统一记录结构化日志
        this.events.on((event) => {
            const uin = this.options.ctx.targetUin;
            switch (event.type) {
                case 'module-start':
                    this.logger.info(`模块启动 | uin=${uin} | module=${event.module}`);
                    break;
                case 'module-complete':
                    this.logger.info(`模块完成 | uin=${uin} | module=${event.module}`);
                    break;
                case 'module-error': {
                    const category = event.category || classifyError(new Error(event.error)).category;
                    this.recordError(category);
                    const where = event.module === '*' ? '接口重试耗尽' : '模块【' + event.module + '】采集异常';
                    // 分类兜底为 unknown 时不再标注（避免“重试耗尽（unknown）”这类无信息提示），接口标识与真实原因单独带上
                    const catPart = category === 'unknown' ? '' : '（' + category + '）';
                    const apiPart = event.api ? ' | 接口=' + event.api : '';
                    this.logger.error(`异常捕获 | uin=${uin} | ${where}${catPart}${apiPart}`, event.error);
                    break;
                }
                case 'request-retry':
                    this.logger.warn(`接口重试 | uin=${uin} | 剩余=${event.remain}${event.inFlight !== undefined ? ' | 并发=' + event.inFlight : ''}${event.api ? ' | 接口=' + event.api : ''} | reason=${event.message}`);
                    break;
                case 'paused':
                    this.logger.warn(`备份暂停 | uin=${uin} | 状态=paused`);
                    break;
                case 'resumed':
                    this.logger.info(`备份恢复 | uin=${uin} | 状态=resumed`);
                    break;
                case 'cancelled':
                    this.logger.warn(`备份取消 | uin=${uin} | 状态=cancelled（断点保留）`);
                    break;
                case 'completed':
                    this.logger.info(`备份完成 | uin=${uin} | 状态=completed（所有模块已落盘）`);
                    break;
                default:
                    break;
            }
        });
        // 注册跨隔离世界日志桥接监听（与 download-manager.js 的 qz_dm_log_request/response 配对）
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('message', this.dmLogBridgeHandler as EventListener);
        }
    }

    /** 是否存在未完成的备份断点（供UI提示「是否从中断处继续」） */
    async getPendingCheckpoint(): Promise<BackupCheckpoint | undefined> {
        return this.checkpointStore.getPending(this.options.ctx.targetUin);
    }

    /** 丢弃断点（用户选择重新开始） */
    async discardCheckpoint(): Promise<void> {
        await this.checkpointStore.discard(this.options.ctx.targetUin);
    }

    getState(): PipelineState {
        return this.pipeline?.getState() || 'idle';
    }

    pause(): void {
        this.pipeline?.pause();
    }

    resume(): void {
        this.pipeline?.resume();
    }

    cancel(): void {
        this.pipeline?.cancel();
    }

    /**
     * 构建采集环境与采集器（含 LastTime 增量时间覆盖），结果缓存到实例字段，
     * 供 run() 与手动重试 retryFailedPages() 复用，避免重复重建 host/requester。
     */
    private async prepare(): Promise<void> {
        const resolvedConfig = resolveConfig(this.options.config);
        // 增量备份（LastTime）前，把 IncrementTime 覆盖为「上次备份时间戳」。
        // 否则 isPreBackupPos 会一直拿兜底时间（2005-06-06）比对，永远触发不了停止条件 → 每次全量翻页。
        // 对应旧版 common.js 读 Backedup 记录覆盖 IncrementTime 的行为。
        // 仅对 LastTime 模式生效；Custom 用用户自填时间，Full 不依赖此值。
        for (const module of this.options.modules) {
            const mcfg = (resolvedConfig as Record<string, any>)[module];
            if (!mcfg) continue;
            // H-4a 修复：LastTime/Custom 模式依赖 IncrementTime 比对停止位置。
            // 若格式非法，parseDate(...).getTime() 得 NaN，增量停止判定整体失效（无限翻页或全量）。
            // 此处校验，非法则兜底默认增量时间并告警。
            if ((mcfg.IncrementType === 'LastTime' || mcfg.IncrementType === 'Custom') && mcfg.IncrementTime) {
                const t = parseDate(mcfg.IncrementTime).getTime();
                if (!Number.isFinite(t)) {
                    this.logger.warn(
                        `[增量] 模块 ${module} 的 IncrementTime「${mcfg.IncrementTime}」格式非法，已兜底为默认增量时间 ${DEFAULT_INCREMENT_TIME}`,
                    );
                    mcfg.IncrementTime = DEFAULT_INCREMENT_TIME;
                }
            }
            if (mcfg.IncrementType === 'LastTime') {
                const row = await this.backupDb.getRow(this.options.ctx.targetUin, module);
                if (row) {
                    mcfg.IncrementTime = formatDateValue(new Date(row.time), 'yyyy-MM-dd hh:mm:ss');
                } else {
                    // H-3 修复：LastTime 模式但无备份历史 → IncrementTime 维持兜底(2005-06-06) → 退化为全量，
                    // 此前无任何提示，用户误以为在做增量。显式告警（日志面板可见）。
                    this.logger.warn(
                        `[增量] 模块 ${module} 设为 LastTime 增量，但找不到上次备份记录，将退化为全量备份（时间兜底 2005-06-06）`,
                    );
                }
            }
        }
        this.env = this.createEnv(resolvedConfig);
        this.collectors = this.createCollectors(this.env);
    }

    /**
     * 断点补偿（手动重试）：仅对 ledger 中 failed/missing 页重采，完成后重新合并/导出。
     * 必须在一次 run()/prepare() 之后调用（复用其 env 与采集器实例）。
     * 不传 modules 则对全部已勾选模块重试；传则只重试指定模块。
     */
    async retryFailedPages(modules?: string[]): Promise<void> {
        if (!this.collectors || !this.env) {
            throw new Error('尚未执行过备份，无法重试失败页（请先运行一次备份）');
        }
        const ctx = this.options.ctx;
        const batchId = makeBatchId();
        const targets = modules && modules.length
            ? this.collectors.filter((c) => modules.includes(c.module))
            : this.collectors;
        const uin = ctx.targetUin;
        // M-1 性能优化：单次预加载全部 ledger 缓存，避免后续 listFailedUnder 逐模块重复全量读（大号数百相册场景）
        await this.ledger.preloadAll(String(uin));
        this.logger.info(`开始断点补偿 retryFailedPages | uin=${uin} | 模块=${targets.map((t) => t.module).join(', ')}`);
        for (const collector of targets) {
            // 仅对确有失败页的模块补偿：避免「只有 Videos 失败却把 Photos 全部点赞重抓」这类整模块空跑。
            // 这也是自动续传重新卡死的根因——续传逐模块调用 retryFailedPages，会无条件重采整模块社会化数据（点赞/评论/访客）。
            if (!(await this.moduleHasFailures(String(uin), collector.module))) {
                this.logger.info(`模块 ${collector.module} 无失败页，跳过断点补偿`);
                continue;
            }
            if (!collector.retryFailedPages) {
                this.logger.warn(`模块 ${collector.module} 未实现 retryFailedPages，跳过`);
                continue;
            }
            // 单独包裹：让日志/进度带上当前模块标记，并保证 currentReport 在重试期间生效
            this.currentModule = collector.module;
            this.logger.setModule(collector.module);
            // 手动重试是「重新采集」，必须先把该模块从上一轮结束的 done 态拉回 active，
            // 否则面板进度条会停留在「已完成」而采集明细/日志仍在推进（进度状态不一致）。
            this.events.emit({ type: 'module-start', module: collector.module });
            const cctx: CollectContext = {
                uin,
                ledger: this.ledger,
                batchId,
                retryMode: true,
                report: async (progress: Omit<ProgressEvent, 'module'> & { completed?: boolean }) => {
                    this.events.emit({
                        type: 'progress',
                        data: { module: collector.module, phase: progress.phase, done: progress.done, total: progress.total, failed: progress.failed, label: progress.label, subject: progress.subject },
                    });
                },
                tick: () => Promise.resolve(),
            };
            try {
                await collector.retryFailedPages(cctx);
                this.events.emit({ type: 'module-complete', module: collector.module });
            } catch (error: any) {
                this.events.emit({ type: 'module-error', module: collector.module, error: error?.message || String(error) });
            } finally {
                this.currentModule = undefined;
                this.logger.setModule(undefined);
            }
        }
        // 手动重试是「增量修账」，不是新一轮全量：绝不能 pruneOtherBatches（会删掉整个旧账本，含已成功页）。
        // 直接全量统计本模块残留 failed/missing/dead（跨 batch，不按 batchId 过滤）。
        let failed = 0;
        let missing = 0;
        let dead = 0;
        for (const collector of this.collectors) {
            const pages = await this.ledger.list(String(uin), collector.module);
            for (const p of pages) {
                if (p.state === 'failed') failed++;
                else if (p.state === 'missing') missing++;
                else if (p.state === 'dead') dead++;
            }
        }
        this.events.emit({ type: 'reliability-summary', data: { uin, batchId, failed, missing, dead } });
        this.logger.info(`断点补偿完成 | uin=${uin} | 残留 failed=${failed} missing=${missing} dead=${dead}`);
    }

    /**
     * 模块是否存在 failed/missing/dead 页（用于断点补偿前快速跳过无失败的模块，
     * 避免「仅 Videos 失败却把 Photos 全部点赞重抓」的整模块空跑与重新卡死）。
     */
    private async moduleHasFailures(uin: string, module: string): Promise<boolean> {
        if (!this.ledger) return false;
        // 用 listFailedUnder：Photos 的真实记录在 composite 子键 `Photos:<albumId>` 下，
        // 直接 list(uin,'Photos') 取不到，会导致 Photos 永远被判「无失败」而被跳过。
        const failures = await this.ledger.listFailedUnder(uin, module);
        // L-2 修复：仅 failed/missing 算「有可补偿失败」。dead 是重试次数耗尽的终态，
        // 不应再触发补偿——否则「只有 dead 页的模块」会被判「有失败」而进入 retryFailedPages，
        // Photos 内部又因排除 dead 后 failedAlbumIds 为空而回退整模块全量重采，与 dead 语义冲突。
        return failures.some((f) => f.state === 'failed' || f.state === 'missing');
    }

    /**
     * 运行备份（仅采集与模块数据文件）
     * 「其它信息」（用户个人档 user.js、助手配置 config.js、首页 index.html、
     * 查看器静态资源拷贝）与媒体下载、打包下载由调用方负责，分工与旧版一致
     * @param resumeFrom 传入未完成断点则续传，不传为全新备份
     */
    async run(resumeFrom?: BackupCheckpoint): Promise<BackupResult> {
        const { ctx, host } = this.options;
        // 构建采集环境与采集器（含 LastTime 增量时间覆盖），结果缓存到实例供手动重试复用
        await this.prepare();

        this.pipeline = new Pipeline({
            uin: ctx.targetUin,
            collectors: this.collectors!,
            checkpointStore: this.checkpointStore,
            ledger: this.ledger,
            events: this.events,
        });

        const mode = resumeFrom ? '断点续传' : '全新备份';
        this.logger.info(
            `启动备份 run() | uin=${ctx.targetUin} | 模式=${mode} | ` +
            `模块数=${this.options.modules.length}（${this.options.modules.join(', ')}）`
        );

        if (!resumeFrom) {
            // 全新备份：清空上一轮残留的页账本，避免「非断点续传」时采集明细/断点补偿混入旧 batch 记录。
            // 续传需保留账本（旧 batch 的 failed/missing 用于精确补偿），故仅全新备份清空。
            await this.ledger.clearUin(String(ctx.targetUin));
        }

        await host.startKeepAlive?.();
        this.startHeartBeat();
        try {
            const state = await this.pipeline.run(resumeFrom);
            if (state === 'completed') {
                // 备份完成后落地本次备份历史（供下次增量比对）
                await this.saveBackupHistory();
            }
            this.logger.info(
                `备份结束 | uin=${ctx.targetUin} | 状态=${state} | ` +
                `采集计数=${JSON.stringify(this.counts)}`
            );
            // 错误按分类汇总，再将日志导出写入备份目录（写失败不影响备份主体）
            this.logErrorSummary();
            await this.writeLog(host);
            return { state, counts: { ...this.counts }, footprintPoints: this.districtPoints };
        } finally {
            this.stopHeartBeat();
            // 资源清理：停止保活心跳、释放 url.cn 解析缓存、移除跨世界日志桥接监听
            try {
                await host.stopKeepAlive?.();
            } catch (e) {
                this.logger.warn('停止保活心跳异常', e);
            }
            clearUnwrapImageUrlCache();
            if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
                window.removeEventListener('message', this.dmLogBridgeHandler as EventListener);
            }
            this.logger.info(`资源清理完成 | uin=${ctx.targetUin}（已停止心跳/清理解析缓存/移除日志桥接监听）`);
        }
    }

    /** 记录一次错误分类（供结尾汇总） */
    private recordError(category: string): void {
        this.errorTally[category] = (this.errorTally[category] || 0) + 1;
    }

    /** 把本轮错误分类汇总写入日志（无错误也记一行，便于确认） */
    private logErrorSummary(): void {
        const parts = Object.keys(this.errorTally).map((k) => k + ' ' + this.errorTally[k] + ' 处');
        if (parts.length === 0) {
            this.logger.info('本次备份无接口错误');
        } else {
            this.logger.warn('本次备份错误汇总：' + parts.join('、'));
        }
    }

    /** 把本轮日志导出为文本写入备份目录（Common/backup.log）
     *  为了让「备份面板日志Tab」「backup.log 文件」「控制台」三者内容一致，
     *  这里把两份日志合并写入同一个 backup.log：
     *    §1 收集引擎日志（接口请求、翻页、错误汇总，来自 this.logger）
     *    §2 DownloadManager 日志（任务登记/去重/进度/浏览器事件推送/重试/取消，来自 window.QZoneDownloadManager）
     */
    private async writeLog(host: BackupHost): Promise<void> {
        try {
            const engineLog = String(this.logger.export() || '');
            const dmLog = await this.fetchDownloadManagerLog();
            const now = new Date();
            const pad = (n: number, w = 2) => String(n).padStart(w, '0');
            const header = `# QZoneExport Backup Log\n` +
                `# GeneratedAt: ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}\n` +
                `# Sections: 1=CollectorEngine  2=DownloadManager\n\n`;
            const section1 = `========== 1 / 2 : Collector Engine Logs ==========\n${engineLog}\n\n`;
            const section2 = `========== 2 / 2 : DownloadManager Logs (媒体任务登记/进度/浏览器事件/Aria2) ==========\n${dmLog}\n`;
            await host.writeText(header + section1 + section2, 'Common/backup.log');
        } catch (error) {
            // 日志本身写失败不能反过来影响备份结果
            this.logger.warn('写入备份日志失败', error);
        }
    }

    /** 尝试从 DownloadManager 拉取日志（文本格式），写入 backup.log 的 §2。
     *  兼容两种场景：
     *   1) 同隔离世界可直接访问 window.QZoneDownloadManager（旧版引擎 / 同世界运行）；
     *   2) v3 引擎与 DM 运行在不同 content script 隔离世界，需经 window.postMessage
     *      跨世界请求 DM 回发日志（见 download-manager.js 的 qz_dm_log_request/response）。
     *  任何失败都回退为一行提示，保证 backup.log 永远有 §2。
     */
    private async fetchDownloadManagerLog(): Promise<string> {
        try {
            const w = (getWindow() ?? getGlobal()) as any;
            const dm = w && w.QZoneDownloadManager;
            if (dm && typeof dm.exportLogs === 'function') {
                return String(dm.exportLogs('txt', { level: 'ALL' }) || '');
            }
            if (dm && typeof dm.logs === 'function') {
                const arr: any[] = dm.logs() || [];
                return arr.map((l: any) => {
                    const d = new Date(l.ts || Date.now());
                    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
                    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
                    return `[${ts}] [${l.level || 'INFO'}] ${l.message || l.msg || ''}`;
                }).join('\n');
            }
            // 跨隔离世界请求 DM 日志（带超时，避免备份结束时 DM 已卸载导致永久 pending）
            if (typeof window !== 'undefined' && typeof window.postMessage === 'function') {
                const reqId = ++this.dmLogReqSeq;
                const nonce = newNonce();
                const text = await new Promise<string>((resolve) => {
                    const timer = setTimeout(() => {
                        this.dmLogWaiters.delete(reqId);
                        resolve('');
                    }, 1500);
                    this.dmLogWaiters.set(reqId, { nonce, resolve });
                    // 携带随机 nonce，由 DM 回包带回校验，防止伪造回包
                    window.postMessage({ type: CW_MESSAGE.LOG_REQUEST, reqId, nonce }, '*');
                });
                if (text) return text;
            }
        } catch (_) { /* ignore */ }
        return '(DownloadManager 日志暂不可用：备份结束时未能从 window.QZoneDownloadManager 获取日志)';
    }

    /** 构造采集器运行环境 */
    private createEnv(config: QzoneBackupConfig): CollectorEnv {
        const { ctx, host, sleepFn } = this.options;
        const wait = sleepFn || sleep;
        // 失败计数：按 phase 累计（不重置，保证 UI 行始终能看到累计值）
        const failedByPhase = new Map<string, number>();
        // 两次 report 之间的临时累加（fail 在 report 前调用，先存这里，report 时归入对应 phase）
        let pendingFail = 0;
        // report/tick 在 pipeline 逐模块运行时由 setModuleContext 替换为当前模块的实现
        const env: CollectorEnv = {
            ctx,
            config,
            requester: this.requester,
            lbsProxy: this.options.lbsProxy,
            logger: this.logger,
            tick: () => this.currentTick(),
            report: (phase, done, total, failed, label, subject) => {
                // 把两次 report 之间累积的 fail 归入当前 phase
                if (pendingFail > 0) {
                    failedByPhase.set(phase, (failedByPhase.get(phase) || 0) + pendingFail);
                }
                pendingFail = 0;
                // 上报累计值（不重置 Map，后续 report 仍能看到）
                const totalFailed = failedByPhase.get(phase) || 0;
                return this.currentReport(phase, done, total, totalFailed || undefined, label, subject);
            },
            fail: (count) => { pendingFail += (count || 1); },
            getOldData: (module) => this.getOldData(module),
            addMediaTask: (task) => host.addMediaTask(task),
            // 复读去重：登记媒体前先查已下载集合，已落盘的文件不再重复下载
            getDownloadedUrls: () => this.checkpointStore.getDownloadedUrls(ctx.targetUin),
            detectSuffix: (url) => host.detectSuffix(url),
            writeJsonToJs: async (global, data, path) => {
                // 模块产物同时落 staging，备份完成时搬迁为备份历史（供下次增量比对）
                if (this.currentModule) {
                    await this.checkpointStore.saveStaging(ctx.targetUin, this.currentModule, data);
                    this.recordCount(this.currentModule, data);
                }
                // 顺带收集带坐标的足迹点（说说 lbs + 相片 lbs），供收尾按市补齐区县地图。
                // 注意：不能在编排层读 window——writeJsonToJs 只写备份文件，不注入页面全局
                if (global === 'messages' && Array.isArray(data)) {
                    for (const item of data) {
                        const x = Number(item?.lbs?.pos_x);
                        const y = Number(item?.lbs?.pos_y);
                        if (Number.isFinite(x) && Number.isFinite(y)) {
                            this.districtPoints.push({ posX: x, posY: y });
                        }
                    }
                } else if (global === 'albums' && Array.isArray(data)) {
                    for (const album of data) {
                        for (const photo of (album?.photoList || []) as Record<string, any>[]) {
                            const l = photo?.custom_lbs || photo?.lbs || photo?.shootGeo;
                            const x = Number(l?.pos_x);
                            const y = Number(l?.pos_y);
                            if (Number.isFinite(x) && Number.isFinite(y)) {
                                this.districtPoints.push({ posX: x, posY: y });
                            }
                        }
                    }
                }
                await host.writeJsonToJs(global, data, path);
            },
            writeText: (text, path) => host.writeText(text, path),
            writeFile: (data, path) => host.writeFile(data, path),
            exportMarkdown: host.exportMarkdown
                ? (module, items) => host.exportMarkdown!(module, items)
                : undefined,
            loadStaging: (module) => this.checkpointStore.loadStaging(ctx.targetUin, module),
            saveStaging: (module, data) => this.checkpointStore.saveStaging(ctx.targetUin, module, data),
            sleep: wait,
        };
        return env;
    }

    /** 当前模块的 tick（由 collect 包装时设置） */
    private currentTick: () => Promise<void> = async () => {};
    /** 当前模块的进度上报（由 collect 包装时设置） */
    private currentReport: (phase: string, done: number, total: number, failed?: number, label?: string, subject?: { done: number; total: number }) => Promise<void> = async () => {};
    /** 当前正在采集的模块名（产物落 staging 时用） */
    private currentModule?: string;

    /**
     * 按勾选与固定顺序创建采集器，并包装 tick/report 到 pipeline 上下文
     */
    private createCollectors(env: CollectorEnv): ModuleCollector[] {
        const { modules, selectedAlbums, targetNickname } = this.options;
        const avatars = new AvatarTaskRegistry(env);
        const factories: Record<ModuleName, () => ModuleCollector> = {
            Messages: () => new MessagesCollector(env, avatars),
            Blogs: () => new BlogsCollector(env, avatars),
            Diaries: () => new DiariesCollector(env, avatars),
            Boards: () => new BoardsCollector(env, avatars),
            Friends: () => new FriendsCollector(env, avatars),
            Favorites: () => new FavoritesCollector(env, targetNickname, avatars),
            Shares: () => new SharesCollector(env, avatars),
            Visitors: () => new VisitorsCollector(env, avatars),
            Photos: () => new PhotosCollector(env, selectedAlbums || [], avatars),
            Videos: () => new VideosCollector(env),
        };

        const selected = MODULE_ORDER.filter((module) => modules.includes(module));
        return selected.map((module) => {
            const collector = factories[module]();
            // 包装：把 pipeline 提供的 tick/report 绑定到 env（采集器只依赖 env）
            return {
                module: collector.module,
                collect: async (ctx) => {
                    this.currentModule = collector.module;
                    this.currentTick = ctx.tick;
                    this.currentReport = (phase, done, total, failed, label, subject) => ctx.report({ phase, done, total, failed, label, subject });
                    // 让日志带上当前模块标记，导出时能看清每条日志属于哪个模块
                    this.logger.setModule(collector.module);
                    this.logger.info('模块开始采集');
                    try {
                        await collector.collect(ctx);
                        this.logger.info('模块采集完成');
                    } finally {
                        this.currentModule = undefined;
                        this.currentTick = async () => {};
                        this.currentReport = async () => {};
                        this.logger.setModule(undefined);
                    }
                },
                // 断点补偿（手动重试）：仅对 ledger 中 failed/missing 页重采，复用同一套 currentModule/report 绑定
                retryFailedPages: collector.retryFailedPages
                    ? async (ctx) => {
                        // 自动续传：仅当本模块确有失败页才补偿，避免整模块重抓（如仅 Videos 失败却重抓 Photos 全部点赞）。
                        // 用 listFailedUnder：Photos 记录在 composite 子键 `Photos:<albumId>` 下，list() 取不到。
                        // L-2：仅 failed/missing 算可补偿，dead（终态）不算，避免「只有 dead 页」也触发补偿/回退全量。
                        const hasFail = ctx.ledger
                            ? (await ctx.ledger.listFailedUnder(String(ctx.uin), collector.module))
                                .some((f) => f.state === 'failed' || f.state === 'missing')
                            : false;
                        if (!hasFail) {
                            return;
                        }
                        this.currentModule = collector.module;
                        this.currentTick = ctx.tick;
                        this.currentReport = (phase, done, total, failed, label, subject) => ctx.report({ phase, done, total, failed, label, subject });
                        this.logger.setModule(collector.module);
                        this.logger.info('模块开始重试：仅重新采集之前失败或丢失的页');
                        try {
                            await collector.retryFailedPages!(ctx);
                            this.logger.info('模块断点补偿完成');
                        } finally {
                            this.currentModule = undefined;
                            this.currentTick = async () => {};
                            this.currentReport = async () => {};
                            this.logger.setModule(undefined);
                        }
                    }
                    : undefined,
            };
        });
    }

    /** 记录模块采集条目数（相册累加各相册的相片数，留言/访客取 items） */
    private recordCount(module: string, data: unknown): void {
        switch (module) {
            case 'Messages':
                this.counts.messages = asArray(data).length;
                break;
            case 'Blogs':
                this.counts.blogs = asArray(data).length;
                break;
            case 'Diaries':
                this.counts.diaries = asArray(data).length;
                break;
            case 'Videos':
                this.counts.videos = asArray(data).length;
                break;
            case 'Favorites':
                this.counts.favorites = asArray(data).length;
                break;
            case 'Shares':
                this.counts.shares = asArray(data).length;
                break;
            case 'Friends':
                this.counts.friends = asArray(data).length;
                break;
            case 'Boards':
                this.counts.boards = itemsOf(data).length;
                break;
            case 'Visitors':
                this.counts.visitors = itemsOf(data).length;
                break;
            case 'Photos':
                // 相册产物为相册数组，首页统计的是相片总数
                this.counts.photos = asArray(data).reduce(
                    (total: number, album: any) => total + ((album && album.photoList && album.photoList.length) || 0),
                    0,
                );
                break;
            default:
                break;
        }
    }

    /**
     * 读取模块上次备份数据（按模块粒度）。
     *
     * 这里刻意**不做「一次全量读所有模块」的缓存**：备份历史实际由 background（扩展 origin）
     * 持有，读写要跨进程传输；全量读会把该QQ号所有模块的完整数据一次性搬过来（可达数百 MB），
     * 而每个模块只需要自己那一行。
     */
    private async getOldData<T>(module: string): Promise<T | undefined> {
        const row = await this.backupDb.getRow(this.options.ctx.targetUin, module);
        return row?.data as T | undefined;
    }

    /**
     * 保存本次备份历史（结构与旧版 Backedup[uin] 一致）
     * 数据取自各模块写出的产物，这里仅更新时间戳；模块数据由采集器落盘时同步写入staging，
     * 完成时统一搬迁，避免大对象长期驻留内存
     */
    private async saveBackupHistory(): Promise<void> {
        const uin = this.options.ctx.targetUin;
        const now = Date.now();
        let saved = 0;
        for (const module of this.options.modules) {
            const data = await this.checkpointStore.loadStaging(uin, module);
            if (data === undefined) {
                this.logger.warn('模块 ' + module + ' 的暂存数据缺失，本次不更新其备份历史');
                continue;
            }
            const row: ModuleBackupRow = { module, data, time: now };
            try {
                // 逐模块写入：合并到已有行的动作由存储实现在本地完成，
                // 避免把该QQ号所有模块的完整数据一起跨进程搬运
                await this.backupDb.putRow(uin, row);
                saved++;
            } catch (e) {
                this.logger.error('写入模块 ' + module + ' 的备份历史失败', e as Error);
            }
        }
        this.logger.info('备份历史已更新 | uin=' + uin + ' | 模块数=' + saved + '/' + this.options.modules.length);
    }

    /** 备份期间保持心跳，避免会话短时间内失效（移植自 common.js keepHeartBeat） */
    private startHeartBeat(): void {
        this.stopHeartBeat();
        const fetchFn = this.options.fetchFn || fetch;
        this.heartBeatTimer = setInterval(
            () => {
                const call = heartBeat(this.options.ctx);
                const query = serializeParams(call.params);
                const url = query ? call.url + (call.url.indexOf('?') === -1 ? '?' : '&') + query : call.url;
                // 心跳仅为保活：直接 fetch、不走请求器的重试/事件链，
                // 否则 nologin 等临时失败会触发 request-retry 事件、把错误弹给用户。失败只记日志，下个周期自然重试
                void Promise.resolve(fetchFn(url, { method: 'GET', credentials: 'include' }))
                    .catch((error) => this.logger.warn('心跳请求异常', error));
            },
            TIMING.HEARTBEAT_INTERVAL,
        );
    }

    private stopHeartBeat(): void {
        if (this.heartBeatTimer) {
            clearInterval(this.heartBeatTimer);
            this.heartBeatTimer = undefined;
        }
    }
}
