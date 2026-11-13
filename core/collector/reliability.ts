/**
 * 分页采集数据可靠性保障（reliability）
 *
 * 解决「按页采集时单页失败/数据丢失无法感知与补偿、只能整体重新备份」的问题：
 *   ① 页级状态追踪 + 唯一标识（pageIndex / batchId / fetchedAt）
 *   ② 失败 / 数据丢失检测（异常捕获 + 条数对账）
 *   ③ 断点补偿：仅对 failed/missing 页重采，避免全量重备
 *   ④ 进度持久化（PageLedger 落 chrome.storage.local，跨子域/换页/重启可读）
 *   ⑤ 重试策略（指数退避 + 最大重试）+ 告警计数
 *
 * 与 R3 的 staging 续传互补不冲突：
 *   - staging 解决「从哪一页开始」（模块级起点）
 *   - PageLedger 解决「哪一页失败/丢了，只补那一页」（页级粒度）
 *
 * 存储设计（v3 修订，消除写放大 + 避免 get(null) 全量读）：
 *   - 单页键：`ledger:<uin>:<encodeURIComponent(module)>~<pageIndex>` → 单条 PageRecord
 *     （每记一页只写 O(1) 字节，不再整份 map 重写 → 写放大从 O(N²) 降到 O(N)）
 *   - 模块索引：`modules:ledger:<uin>` → string[]（该 uin 下所有有记录的模块名，原始名）
 *     `listModules` 只读这一小键，不再 `area.get(null)` 全量枚举 storage（此前每次明细渲染都全量读）
 *   - 冷加载（cache 未命中）时 `load` 才 `get(null)` 一次并按前缀过滤、写入缓存；后续读取走缓存。
 */

import { defaultArea, type KvArea } from '../store/backup-db';

/** 单页采集状态 */
export type PageState = 'fetching' | 'success' | 'failed' | 'missing' | 'dead';

/** 单页采集记录 */
export interface PageRecord {
    uin: string;
    module: string;
    /** 页码（从 0 开始） */
    pageIndex: number;
    /**
     * 本次备份运行标识；新运行 = 新 batch。
     * 正常运行补偿只匹配当前 batch 的失败页；手动重试（UI「重试失败页」）传 `'*'` 匹配
     * 该模块**所有**未达上限的失败/丢失页（失败页可能记录在上一轮备份的 batchId 下）。
     */
    batchId: string;
    /** 采集时间戳（毫秒） */
    fetchedAt: number;
    state: PageState;
    /** 实际采集条数 */
    itemCount: number;
    /** 期望条数（由 total + pageSize 推导；无法推导时为 0，仅作参考） */
    expectedCount: number;
    /** 已重试次数 */
    retryCount: number;
    /** 最近一次错误信息 */
    lastError?: string;
    /**
     * 展示用名称（可选）：复合键模块（如相册 `Photos:<albumId>`）记录时带上可读名，
     * 供「采集明细」渲染「相册：{相册名}」而非原始 ID 键；旧记录无此字段则回退到模块键。
     */
    title?: string;
    /**
     * 失败游标（可选）：Detail 递归模式（按 picKey 翻页）失败时记录当时请求的 picKey，
     * 供手动重试精确定位失败批次（从该游标续采，而非重扫已成功批次）。
     * 分页模式用 pageIndex 定位即可，不填此字段。
     */
    cursor?: string;
}

/** 最大重试次数（失败/丢失页超过此数仍失败则记为 dead，不再自动重试） */
export const DEFAULT_MAX_RETRY = 5;

/** 生成一次备份运行的唯一标识 */
export function makeBatchId(): string {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * 由 total + pageIndex + pageSize 推导「本页期望条数」。
 * 非末页恒为 pageSize；末页为 total - pageIndex*pageSize。
 * total 未知（<=0）时返回 0：调用方据此只更新期望，避免误报。
 */
export function deriveExpectedCount(total: number, pageIndex: number, pageSize: number): number {
    if (!total || total <= 0) return 0;
    const remaining = total - pageIndex * pageSize;
    if (remaining <= 0) return 0;
    return Math.min(pageSize, remaining);
}

/** 失败 / 数据丢失判定（纯函数，便于测试） */
export const FailureDetector = {
    /**
     * 判定单页状态。
     * @param hadError fetchPage 是否抛错
     * @param lastError 错误信息（hadError 时填充）
     * @param actual 实际采集条数
     * @param expected 期望条数（deriveExpectedCount 结果；0 表示未知 → 不判 missing）
     * @param retryCount 已重试次数
     * @param maxRetry 最大重试次数
     */
    classify(opts: {
        hadError: boolean;
        lastError?: string;
        actual: number;
        expected: number;
        retryCount: number;
        maxRetry: number;
    }): PageState {
        const { hadError, lastError, actual, expected, retryCount, maxRetry } = opts;
        if (hadError) {
            return retryCount >= maxRetry ? 'dead' : 'failed';
        }
        // expected>0 且实际少于期望 → 数据丢失（接口返回了截断的页）
        if (expected > 0 && actual < expected) {
            return retryCount >= maxRetry ? 'dead' : 'missing';
        }
        return 'success';
    },
};

/** 指数退避延迟（毫秒）：base=2s，上限 cap（默认 60s），附 0~2s 抖动 */
export function backoffDelay(retryCount: number, cap = 60000): number {
    const base = 2000;
    const raw = Math.min(cap, base * Math.pow(2, retryCount));
    const jitter = Math.floor(Math.random() * 2000);
    return raw + jitter;
}

/** 补偿结果计数 */
export interface CompensateResult {
    compensated: number;
    dead: number;
    /** 本批次仍残留、仍可重试的 failed/missing 页数（dead 为终态、不计入），供 UI 汇总 */
    remaining: number;
}

/**
 * 通用补偿器：仅对 failed/missing 且 retryCount<maxRetry 的页，
 * 用 fetchPage 重新拉取，写入累加器（applyPage），再走 afterPage 落到 staging/媒体任务。
 *
 * 调用方需提供累加器操作闭包（applyPage / rebuild），从而兼容：
 *   - collectPagedList 的 pageMap 累加器
 *   - 手写 for 循环的 items/albumMap 累加器
 *
 * 关键参数：
 *   - `batchId`：当前运行标识（正常 run 的 batchId / 手动重试 run 的 batchId），用于 `recordBatchId` 默认值
 *   - `matchBatchId`：匹配哪些 batch 的失败/丢失页；默认 = batchId；手动重试传 `'*'` 匹配全部旧 batch
 *   - `recordBatchId`：重采后 stamp 到记录的 batchId；默认 = batchId；手动重试传重试 run 的 batchId（覆盖旧 batch，
 *     否则 stamp 旧 batch 会被随后 pruneOtherBatches 误删）
 *   - `backoffCap`：退避延迟上限；手动重试可下调，避免对高 retryCount 页休眠长达数十秒
 */
export const Compensator = {
    async compensate<T>(opts: {
        ledger: PageLedger;
        uin: string;
        module: string;
        batchId: string;
        pageSize: number;
        maxRetry?: number;
        /** 匹配哪些 batch 的失败/丢失页：默认 = batchId；手动重试传 '*' 匹配全部旧 batch */
        matchBatchId?: string;
        /** 重采后 stamp 到记录的 batchId（默认 = batchId；手动重试传重试 run 的 batchId，覆盖旧 batch） */
        recordBatchId?: string;
        /** 退避延迟上限（毫秒），手动重试可下调以避免每页休眠过长 */
        backoffCap?: number;
        fetchPage: (pageIndex: number) => Promise<{ items: T[]; total: number }>;
        /** 把重采到的页写入累加器对应槽位（替换/追加，由调用方决定语义） */
        applyPage: (pageIndex: number, items: T[]) => void;
        /** 由累加器重建完整 items（afterPage 期望接收全量数组） */
        rebuild: () => T[];
        /** afterPage：合并 / 落盘 / 登记媒体任务（与正常采集一致） */
        afterPage: (allItems: T[], pageIndex: number) => Promise<void>;
        /** 等待（注入 env.sleep，测试可免等待） */
        sleep: (ms: number) => Promise<void>;
    }): Promise<CompensateResult> {
        const {
            ledger, uin, module, batchId, pageSize,
            maxRetry = DEFAULT_MAX_RETRY,
            matchBatchId = batchId,
            recordBatchId = batchId,
            backoffCap,
            fetchPage, applyPage, rebuild, afterPage, sleep,
        } = opts;
        // 仅对匹配 batch（默认当前、手动重试为 '*'）下 failed/missing 且未达上限的页重采
        const pending = await ledger.listFailed(uin, module, matchBatchId, maxRetry);
        let compensated = 0;
        let dead = 0;
        for (const rec of pending) {
            const delay = backoffDelay(rec.retryCount, backoffCap);
            await sleep(delay);
            const nextRetry = rec.retryCount + 1;
            try {
                const page = await fetchPage(rec.pageIndex);
                const actual = page.items.length;
                // 重采时接口若没带 total（total=0），deriveExpectedCount 返回 0 会让
                // FailureDetector 跳过 missing 判定，把空页误判成 success（失败页消失但数据仍缺）。
                // 用首次采集记录的期望条数 / pageSize 兜底。
                const expected = deriveExpectedCount(page.total, rec.pageIndex, pageSize)
                    || rec.expectedCount || pageSize;
                const state = FailureDetector.classify({
                    hadError: false,
                    actual,
                    expected,
                    retryCount: nextRetry,
                    maxRetry,
                });
                await ledger.record(uin, module, {
                    ...rec,
                    batchId: recordBatchId,
                    fetchedAt: Date.now(),
                    state,
                    itemCount: actual,
                    expectedCount: expected,
                    retryCount: nextRetry,
                });
                if (state === 'success') {
                    // 关键：仅在重采结果完整（success）时才用重采数据覆盖累加器槽位并重建媒体任务/映射。
                    // 死页（接口实际返回条数恒小于期望，如视频模块第一页 15/20）重采永远判 missing/dead；
                    // 此前 applyPage 无条件执行，会用「无 custom_* 映射的原始数据」覆盖首次采集已登记下载
                    // 并回写映射的槽位 → 媒体文件已下载但备份 JSON 映射丢失（查看器找不到文件）。
                    applyPage(rec.pageIndex, page.items);
                    compensated++;
                    await afterPage(rebuild(), rec.pageIndex);
                } else {
                    dead++;
                }
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                const state: PageState = nextRetry >= maxRetry ? 'dead' : 'failed';
                await ledger.record(uin, module, {
                    ...rec,
                    batchId: recordBatchId,
                    fetchedAt: Date.now(),
                    state,
                    itemCount: rec.itemCount,
                    retryCount: nextRetry,
                    lastError: errMsg,
                });
                if (state === 'dead') dead++;
            }
        }
        const remaining = (await ledger.listFailed(uin, module, matchBatchId, maxRetry + 1)).length;
        return { compensated, dead, remaining };
    },
};

/**
 * 页级采集账本（持久化在 chrome.storage.local，复用 R3 已迁好的 KvArea 后端）。
 * 键：单页 `ledger:<uin>:<encodeURIComponent(module)>~<pageIndex>` + 模块索引 `modules:ledger:<uin>`。
 */
export class PageLedger {
    private readonly cache = new Map<string, Record<number, PageRecord>>();
    /** 已 preloadAll 过的 uin（避免每次明细渲染/重试都 get(null) 拉取完整 backup data） */
    private readonly preloadedUins = new Set<string>();

    constructor(
        private readonly area: KvArea = defaultArea(),
        private readonly namespace = 'ledger',
    ) {}

    // ------------------------- 键构造 -------------------------
    /** 单页键：module 经 encodeURIComponent，避免 `Photos:album` 与 `Photos` 前缀歧义 */
    private pageKey(uin: string, module: string, pageIndex: number): string {
        return `${this.namespace}:${uin}:${encodeURIComponent(module)}~${pageIndex}`;
    }
    private pagePrefix(uin: string, module: string): string {
        return `${this.namespace}:${uin}:${encodeURIComponent(module)}~`;
    }
    /** 模块索引键（存该 uin 下所有有记录的模块名，原始名） */
    private modulesKey(uin: string): string {
        return `modules:${this.namespace}:${uin}`;
    }
    /**
     * 页键索引键（存该 uin 下所有单页键的完整列表）。
     * chrome.storage.local 无法按前缀删除，而 get(null) 会把同区里 backup:<uin>:<module>
     * 的完整备份数据（albums.json 等，可达数 MB）拉进内存造成卡顿——故维护此索引，
     * 让 load/preloadAll/clearUin 都用「读索引 → 精确 get/remove」替代 get(null)。
     */
    private keysKey(uin: string): string {
        return `${this.namespace}:keys:${uin}`;
    }
    /** 内存缓存键（不落盘，避免与单页键前缀冲突） */
    private mapKey(uin: string, module: string): string {
        return `map:${this.namespace}:${uin}:${module}`;
    }

    private async readModulesIndex(uin: string): Promise<string[] | undefined> {
        const key = this.modulesKey(uin);
        const raw = (await this.area.get(key)) as Record<string, unknown> | undefined;
        const val = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
        return Array.isArray(val) ? (val as string[]) : undefined;
    }

    private async readPageKeys(uin: string): Promise<string[]> {
        const key = this.keysKey(uin);
        const raw = (await this.area.get(key)) as Record<string, unknown> | undefined;
        const val = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
        return Array.isArray(val) ? (val as string[]) : [];
    }

    private async ensurePageKeyIndexed(uin: string, pageKey: string): Promise<void> {
        const keys = await this.readPageKeys(uin);
        if (!keys.includes(pageKey)) {
            await this.area.set({ [this.keysKey(uin)]: [...keys, pageKey] });
        }
    }

    /** 从页键索引移除若干页键（clear/prune 时同步维护） */
    private async removePageKeysFromIndex(uin: string, removed: string[]): Promise<void> {
        if (!removed.length) return;
        const keys = await this.readPageKeys(uin);
        const removedSet = new Set(removed);
        const next = keys.filter((k) => !removedSet.has(k));
        await this.area.set({ [this.keysKey(uin)]: next });
    }

    private async ensureModuleIndexed(uin: string, module: string): Promise<void> {
        const idx = await this.readModulesIndex(uin);
        if (!idx || !idx.includes(module)) {
            await this.area.set({ [this.modulesKey(uin)]: idx ? [...idx, module] : [module] });
        }
    }

    private async removeModuleFromIndex(uin: string, module: string): Promise<void> {
        const idx = await this.readModulesIndex(uin);
        if (idx && idx.includes(module)) {
            await this.area.set({ [this.modulesKey(uin)]: idx.filter((m) => m !== module) });
        }
    }

    private async load(uin: string, module: string): Promise<Record<number, PageRecord>> {
        const key = this.mapKey(uin, module);
        let map = this.cache.get(key);
        if (!map) {
            map = {};
            // 用页键索引精确 get 本模块页键，避免 get(null) 拉取同区里 backup 完整数据（数 MB）。
            const keys = await this.readPageKeys(uin);
            const pfx = this.pagePrefix(uin, module);
            const targetKeys = keys.filter((k) => k.startsWith(pfx));
            if (targetKeys.length) {
                const res = await this.area.get(targetKeys);
                for (const k of targetKeys) {
                    const pi = Number(k.slice(pfx.length));
                    if (!Number.isFinite(pi)) continue;
                    const rec = res[k];
                    if (rec && typeof rec === 'object') map[pi] = rec as PageRecord;
                }
            }
            this.cache.set(key, map);
        }
        return map;
    }

    /**
     * 预加载某 uin 下全部模块的页记录到内存缓存（按页键索引精确 get，不 get(null)）。
     * 幂等 + 缓存标记：已预加载过的 uin 直接跳过，避免每次明细渲染/重试都重复读全量 storage。
     */
    async preloadAll(uin: string): Promise<void> {
        if (this.preloadedUins.has(uin)) return;
        const keys = await this.readPageKeys(uin);
        const head = `${this.namespace}:${uin}:`;
        if (keys.length) {
            const res = await this.area.get(keys);
            for (const k of keys) {
                if (!k.startsWith(head)) continue;
                const rest = k.slice(head.length);
                const tilde = rest.indexOf('~');
                if (tilde < 0) continue;
                const encModule = rest.slice(0, tilde);
                const module = decodeURIComponent(encModule);
                const pi = Number(rest.slice(tilde + 1));
                if (!Number.isFinite(pi)) continue;
                const rec = res[k];
                if (!rec || typeof rec !== 'object') continue;
                const mapKey = this.mapKey(uin, module);
                let map = this.cache.get(mapKey);
                if (!map) {
                    map = {};
                    this.cache.set(mapKey, map);
                }
                map[pi] = rec as PageRecord;
            }
        }
        this.preloadedUins.add(uin);
    }

    /** 记录 / 覆盖单页状态（自动写盘：仅写该页单键 + 维护模块索引 + 页键索引，不再整份 map 重写） */
    async record(uin: string, module: string, rec: PageRecord): Promise<void> {
        const map = await this.load(uin, module);
        map[rec.pageIndex] = rec;
        this.cache.set(this.mapKey(uin, module), map);
        // 单页 O(1) 写
        const pageKey = this.pageKey(uin, module, rec.pageIndex);
        await this.area.set({ [pageKey]: rec });
        // 仅当模块首次出现时才写模块索引（幂等）
        await this.ensureModuleIndexed(uin, module);
        // 维护页键索引（幂等）
        await this.ensurePageKeyIndexed(uin, pageKey);
    }

    /** 读取单页记录 */
    async get(uin: string, module: string, pageIndex: number): Promise<PageRecord | undefined> {
        const map = await this.load(uin, module);
        return map[pageIndex];
    }

    /** 读取模块全部页记录（按页码升序） */
    async list(uin: string, module: string): Promise<PageRecord[]> {
        const map = await this.load(uin, module);
        return Object.values(map).sort((a, b) => a.pageIndex - b.pageIndex);
    }

    /** 枚举某 uin 下全部有记录的模块名（只读模块索引小键，不再 get(null) 全量枚举 storage） */
    async listModules(uin: string): Promise<string[]> {
        const idx = await this.readModulesIndex(uin);
        return idx ? [...idx] : [];
    }

    /**
     * 查询某顶层模块下所有失败页，包含 composite 子键（如 `Photos:<albumId>`）。
     *
     * 背景：Photos 的 ledger 记录以 `Photos:<albumId>` 为 module 键（相册粒度），
     * 而采集器顶层 module 为 `Photos`。直接用 `list(uin,'Photos')` 取不到任何记录，
     * 导致「模块是否有失败」判断与「精确补偿定位失败相册」都失效。
     *
     * 本方法复用 preloadAll 的索引缓存（不再 get(null)），按 `module~`（自身）与 `module%3A`
     * （子键前缀，即 `module:` 经 encode）两种前缀过滤，覆盖 self + 全部 composite 子键，
     * 避免逐子模块 `list` 触发 N 次全量读（大号相册数百个时尤为关键）。
     *
     * @returns 所有 failed/missing/dead 页（含 terminal 的 dead，供「模块是否有失败」布尔判断；
     *          调用方如需只取可重试页，自行按 state 过滤）。
     */
    async listFailedUnder(uin: string, module: string): Promise<PageRecord[]> {
        // preloadAll 有缓存标记（preloadedUins），幂等：本 uin 未加载才用页键索引精确读，
        // 否则直接走缓存；彻底消除 get(null) 拉取完整 backup data 的卡顿。
        await this.preloadAll(uin);
        const prefix = `map:${this.namespace}:${uin}:`;
        const out: PageRecord[] = [];
        for (const [mapKey, map] of this.cache) {
            if (!mapKey.startsWith(prefix)) continue;
            const m = mapKey.slice(prefix.length);
            if (m !== module && !m.startsWith(module + ':')) continue;
            for (const pi of Object.keys(map)) {
                const r = map[+pi];
                if (r && (r.state === 'failed' || r.state === 'missing' || r.state === 'dead')) out.push(r);
            }
        }
        return out;
    }

    /**
     * 待补偿页（failed/missing 且未达最大重试）。
     * @param batchId 匹配的运行标识；默认 = 仅当前 batch；传 '*' 表示忽略 batch，匹配该模块所有未达上限的失败/丢失页
     *               （用于手动重试：失败页可能记录在上一轮备份的 batchId 下）。
     */
    async listFailed(uin: string, module: string, batchId?: string, maxRetry = DEFAULT_MAX_RETRY): Promise<PageRecord[]> {
        const all = await this.list(uin, module);
        const match = batchId === undefined || batchId === '*' ? () => true : (r: PageRecord) => r.batchId === batchId;
        return all
            .filter((r) => match(r) && (r.state === 'failed' || r.state === 'missing'))
            .filter((r) => r.retryCount < maxRetry)
            .sort((a, b) => a.pageIndex - b.pageIndex);
    }

    /**
     * 仅保留当前 batch 的页记录，清掉旧 batch（新一轮备份开始时调用，正常 run 用，不可用于手动重试）。
     * 死页（dead）是重试次数耗尽的终态，代表「该页数据永久无法取回」，跨 batch 保留：
     * 采集完成后仍留在采集明细里供用户核对，不随旧 batch 清理而删除。
     */
    async pruneOtherBatches(uin: string, module: string, batchId: string): Promise<void> {
        const map = await this.load(uin, module);
        let changed = false;
        const toRemove: string[] = [];
        for (const k of Object.keys(map)) {
            const rec = map[+k];
            if (!rec) continue;
            // 死页为终态，跨 batch 保留，不清理（其余旧 batch 的 failed/missing/success 仍照常清掉）
            if (rec.batchId !== batchId && rec.state !== 'dead') {
                toRemove.push(this.pageKey(uin, module, +k));
                delete map[+k];
                changed = true;
            }
        }
        if (changed) {
            if (toRemove.length) {
                await this.area.remove(toRemove);
                await this.removePageKeysFromIndex(uin, toRemove);
            }
            // 模块已无记录则从索引移除
            if (Object.keys(map).length === 0) await this.removeModuleFromIndex(uin, module);
        }
    }

    /** 清空模块账本 */
    async clear(uin: string, module: string): Promise<void> {
        const keys = await this.readPageKeys(uin);
        const pfx = this.pagePrefix(uin, module);
        const toRemove = keys.filter((k) => k.startsWith(pfx));
        if (toRemove.length) {
            await this.area.remove(toRemove);
            await this.removePageKeysFromIndex(uin, toRemove);
        }
        this.cache.delete(this.mapKey(uin, module));
        await this.removeModuleFromIndex(uin, module);
    }

    /**
     * 清空某 uin 的全部页账本（含单页键、模块索引、页键索引与内存缓存）。
     * 全新备份开始时调用，彻底移除上一轮 run 的残留记录，
     * 避免「非断点续传」时采集明细/断点补偿混入旧 batch 记录。
     * 续传（resumeFrom）与手动重试不可调用（需保留旧 batch 的 failed/missing 以精确补偿）。
     */
    async clearUin(uin: string): Promise<void> {
        // 用页键索引精确删，不 get(null)——get(null) 会把同区 backup:<uin>:<module>
        // 的完整备份数据（数 MB）拉进内存，造成启动卡顿。
        const keys = await this.readPageKeys(uin);
        const toRemove = [...keys, this.modulesKey(uin), this.keysKey(uin)];
        if (toRemove.length) await this.area.remove(toRemove);
        this.preloadedUins.delete(uin);
        // 清内存缓存中该 uin 的桶
        const cacheHead = `map:${this.namespace}:${uin}:`;
        for (const k of [...this.cache.keys()]) {
            if (k.startsWith(cacheHead)) this.cache.delete(k);
        }
    }
}

/**
 * 「采集明细」聚合器（供备份面板读取页级账本）。
 * 与 PageLedger 分离：PageLedger 负责「写」（采集器记账），DetailManager 负责「读」（UI 聚合），
 * 二者通过共享的 PageLedger 实例（bridge 的 sharedLedger）连接，UI 只读不写。
 */
export class DetailManager {
    constructor(
        private readonly ledger: PageLedger,
        /** 取当前目标 uin（bridge 注入：initContext(readEnv())?.targetUin） */
        private readonly getUin: () => string | number | undefined,
    ) {}

    private uinStr(): string | undefined {
        const u = this.getUin();
        return u === undefined ? undefined : String(u);
    }

    /** 全部页记录（按 module + pageIndex 升序），跨所有有记录的模块 */
    async pagesSorted(): Promise<PageRecord[]> {
        const uin = this.uinStr();
        if (uin === undefined) return [];
        // M-1 性能优化：单次全量预加载所有模块 ledger 缓存，替代原先逐模块 list → 逐模块 load → 数百次 get(null)
        // （大号 Photos 相册数百个时尤为关键，正是此前「浏览器启动卡死」同类隐蔽成本）。
        await this.ledger.preloadAll(uin);
        const modules = await this.ledger.listModules(uin);
        const all: PageRecord[] = [];
        for (const m of modules) {
            const recs = await this.ledger.list(uin, m); // 预加载后走缓存，不再触发 get(null)
            all.push(...recs);
        }
        all.sort((a, b) => (a.module || '').localeCompare(b.module || '') || a.pageIndex - b.pageIndex);
        return all;
    }
}
