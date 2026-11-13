import { describe, expect, it } from 'vitest';
import {
    deriveExpectedCount,
    FailureDetector,
    PageLedger,
    DetailManager,
    Compensator,
    makeBatchId,
    type PageRecord,
    type PageState,
} from '../core/collector/reliability';
import type { KvArea } from '../core/store/backup-db';

/** 内存版 KvArea（支持 get(null) 枚举全量），用于单测，不依赖 chrome.storage.local */
function memoryKvArea(): KvArea {
    const store: Record<string, unknown> = {};
    return {
        async get(keys) {
            if (keys === null) return { ...store };
            const result: Record<string, unknown> = {};
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) if (store[k] !== undefined) result[k] = store[k];
            return result;
        },
        async set(items) {
            Object.assign(store, items);
        },
        async remove(keys) {
            for (const k of (Array.isArray(keys) ? keys : [keys])) delete store[k];
        },
    };
}

/** 构造一条成功页记录 */
function okRec(uin: string, module: string, pageIndex: number, batchId: string, itemCount: number, expectedCount: number): PageRecord {
    return { uin, module, pageIndex, batchId, fetchedAt: Date.now(), state: 'success', itemCount, expectedCount, retryCount: 0 };
}

describe('deriveExpectedCount：由 total + pageIndex + pageSize 推导期望条数', () => {
    it('非末页恒为 pageSize', () => {
        expect(deriveExpectedCount(100, 0, 20)).toBe(20);
        expect(deriveExpectedCount(100, 3, 20)).toBe(20);
    });
    it('末页为 total - pageIndex*pageSize', () => {
        expect(deriveExpectedCount(100, 4, 20)).toBe(20); // 正好整除
        expect(deriveExpectedCount(95, 4, 20)).toBe(15);  // 80..95
    });
    it('total 未知（<=0）返回 0：调用方据此只做异常检测、不判丢失', () => {
        expect(deriveExpectedCount(0, 0, 20)).toBe(0);
        expect(deriveExpectedCount(-1, 2, 20)).toBe(0);
    });
    it('剩余 <= 0 返回 0（防止越界页误判）', () => {
        expect(deriveExpectedCount(10, 5, 20)).toBe(0);
    });
});

describe('FailureDetector.classify：失败 / 数据丢失 / 死页判定', () => {
    it('fetchPage 抛错且未达上限 → failed', () => {
        expect(FailureDetector.classify({ hadError: true, actual: 0, expected: 20, retryCount: 0, maxRetry: 5 })).toBe('failed');
    });
    it('fetchPage 抛错且已达上限 → dead', () => {
        expect(FailureDetector.classify({ hadError: true, actual: 0, expected: 20, retryCount: 5, maxRetry: 5 })).toBe('dead');
    });
    it('无异常且实采==期望 → success', () => {
        expect(FailureDetector.classify({ hadError: false, actual: 20, expected: 20, retryCount: 0, maxRetry: 5 })).toBe('success');
    });
    it('无异常但实采<期望 → missing（未达上限）', () => {
        expect(FailureDetector.classify({ hadError: false, actual: 10, expected: 20, retryCount: 0, maxRetry: 5 })).toBe('missing');
    });
    it('实采<期望且已达上限 → dead', () => {
        expect(FailureDetector.classify({ hadError: false, actual: 10, expected: 20, retryCount: 5, maxRetry: 5 })).toBe('dead');
    });
    it('期望未知（expected=0）时不判丢失，只认成功/失败', () => {
        expect(FailureDetector.classify({ hadError: false, actual: 0, expected: 0, retryCount: 0, maxRetry: 5 })).toBe('success');
    });
});

describe('PageLedger：页级记账 + 跨上下文可读', () => {
    it('record / list 按页码升序返回，listFailed 仅返回未达上限的 failed/missing', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const batchId = makeBatchId();
        await ledger.record(uin, module, okRec(uin, module, 0, batchId, 20, 20));
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0, lastError: 'boom' });
        await ledger.record(uin, module, { uin, module, pageIndex: 2, batchId, fetchedAt: Date.now(), state: 'missing', itemCount: 5, expectedCount: 20, retryCount: 1 });

        const list = await ledger.list(uin, module);
        expect(list.map((r) => r.pageIndex)).toEqual([0, 1, 2]);
        const failed = await ledger.listFailed(uin, module, batchId, 5);
        expect(failed.map((r) => r.pageIndex).sort()).toEqual([1, 2]);
    });

    it('pruneOtherBatches 清掉旧 batch，仅留当前 batch', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const oldBatch = makeBatchId();
        const newBatch = makeBatchId();
        await ledger.record(uin, module, { uin, module, pageIndex: 0, batchId: oldBatch, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0 });
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId: newBatch, fetchedAt: Date.now(), state: 'success', itemCount: 20, expectedCount: 20, retryCount: 0 });

        await ledger.pruneOtherBatches(uin, module, newBatch);
        const list = await ledger.list(uin, module);
        expect(list.map((r) => r.pageIndex)).toEqual([1]); // 旧 batch 的 0 被清掉
    });

    it('pruneOtherBatches 保留 dead（终态）记录，仅清掉其它旧 batch 记录', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const oldBatch = makeBatchId();
        const newBatch = makeBatchId();
        await ledger.record(uin, module, { uin, module, pageIndex: 0, batchId: oldBatch, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0 });
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId: oldBatch, fetchedAt: Date.now(), state: 'dead', itemCount: 0, expectedCount: 20, retryCount: 5 });
        await ledger.record(uin, module, { uin, module, pageIndex: 2, batchId: newBatch, fetchedAt: Date.now(), state: 'success', itemCount: 20, expectedCount: 20, retryCount: 0 });

        await ledger.pruneOtherBatches(uin, module, newBatch);
        const list = await ledger.list(uin, module);
        // 旧 batch 的 failed(0) 被清掉；dead(1) 为终态保留；当前 batch 的 success(2) 保留
        expect(list.map((r) => r.pageIndex).sort()).toEqual([1, 2]);
        expect(list.find((r) => r.pageIndex === 1)!.state).toBe('dead');
    });

    it('listModules 枚举 uin 下全部有记录的模块（含 Photos:<albumId> 嵌套键）', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '3003';
        await ledger.record(uin, 'Messages', okRec(uin, 'Messages', 0, makeBatchId(), 20, 20));
        await ledger.record(uin, 'Photos:abc', okRec(uin, 'Photos:abc', 0, makeBatchId(), 10, 10));
        const mods = await ledger.listModules(uin);
        expect(mods.sort()).toEqual(['Messages', 'Photos:abc']);
    });

    it('两个 PageLedger 实例共享同一 KvArea 时互相可读（跨子域/换页/重启可读）', async () => {
        const area = memoryKvArea();
        const a = new PageLedger(area);
        const b = new PageLedger(area); // 模拟换页/新实例
        const uin = '2002';
        await a.record(uin, 'Blogs', okRec(uin, 'Blogs', 0, makeBatchId(), 10, 10));
        const list = await b.list(uin, 'Blogs');
        expect(list).toHaveLength(1);
        expect(list[0]!.itemCount).toBe(10);
    });

    it('listFailedUnder 按顶层模块前缀命中 composite 子键（Photos:<albumId>），排除成功页与其他模块', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '4004';
        // Photos 下两个相册有失败页、一个成功、一个 dead
        await ledger.record(uin, 'Photos:albumA', { uin, module: 'Photos:albumA', pageIndex: 0, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 10, retryCount: 0 });
        await ledger.record(uin, 'Photos:albumB', okRec(uin, 'Photos:albumB', 0, makeBatchId(), 10, 10));
        await ledger.record(uin, 'Photos:albumC', { uin, module: 'Photos:albumC', pageIndex: 0, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'missing', itemCount: 3, expectedCount: 10, retryCount: 1 });
        await ledger.record(uin, 'Photos:albumD', { uin, module: 'Photos:albumD', pageIndex: 0, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'dead', itemCount: 0, expectedCount: 10, retryCount: 5 });
        // 其他模块也失败，但不应被 Photos 命中
        await ledger.record(uin, 'Messages', { uin, module: 'Messages', pageIndex: 0, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0 });

        const under = await ledger.listFailedUnder(uin, 'Photos');
        const modules = under.map((r) => r.module).sort();
        // 命中 albumA(failed) / albumC(missing) / albumD(dead)，排除 albumB(success) 与 Messages
        expect(modules).toEqual(['Photos:albumA', 'Photos:albumC', 'Photos:albumD']);
    });

    it('listFailedUnder 对非 composite 模块只命中自身（含失败/死页，排除成功）', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '5005';
        const module = 'Messages';
        await ledger.record(uin, module, okRec(uin, module, 0, makeBatchId(), 20, 20));
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0 });
        await ledger.record(uin, module, { uin, module, pageIndex: 2, batchId: makeBatchId(), fetchedAt: Date.now(), state: 'dead', itemCount: 0, expectedCount: 20, retryCount: 5 });
        const under = await ledger.listFailedUnder(uin, module);
        expect(under.map((r) => r.pageIndex).sort()).toEqual([1, 2]);
    });
});

describe('PageLedger.preloadAll / DetailManager.pagesSorted：大号分桶与单次全量扫描', () => {
    it('preloadAll 后 listFailedUnder 复用缓存且正确聚合 Photos:<albumId> 子键', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '9009';
        // 模拟大号：300 个相册子键 + 顶层 Videos 失败
        for (let i = 0; i < 300; i++) {
            await ledger.record(uin, `Photos:album${i}`, {
                uin,
                module: `Photos:album${i}`,
                pageIndex: 0,
                batchId: makeBatchId(),
                fetchedAt: Date.now(),
                state: i % 2 === 0 ? 'failed' : 'success',
                itemCount: 0,
                expectedCount: 10,
                retryCount: 0,
            });
        }
        await ledger.record(uin, 'Videos', {
            uin,
            module: 'Videos',
            pageIndex: 0,
            batchId: makeBatchId(),
            fetchedAt: Date.now(),
            state: 'failed',
            itemCount: 0,
            expectedCount: 5,
            retryCount: 0,
        });

        // preloadAll 后 listFailedUnder 应复用缓存（不再逐模块全量读），且结果正确
        await ledger.preloadAll(uin);
        const photoUnder = await ledger.listFailedUnder(uin, 'Photos');
        expect(photoUnder).toHaveLength(150); // 300 相册中偶数下标 150 个 failed
        const videoUnder = await ledger.listFailedUnder(uin, 'Videos');
        expect(videoUnder).toHaveLength(1);

        // pagesSorted 应一次性聚合全部（300 相册 + Videos），走缓存后总数正确
        const dm = new DetailManager(ledger, () => uin);
        const all = await dm.pagesSorted();
        expect(all).toHaveLength(301);
    });
});

describe('Compensator.compensate：仅重采 failed/missing 页', () => {
    it('只对被标记 failed/missing 的页调用 fetchPage，success 页不重采', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const batchId = makeBatchId();

        await ledger.record(uin, module, okRec(uin, module, 0, batchId, 20, 20));
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0, lastError: 'boom' });
        await ledger.record(uin, module, { uin, module, pageIndex: 2, batchId, fetchedAt: Date.now(), state: 'missing', itemCount: 5, expectedCount: 20, retryCount: 0 });

        const fetched = new Set<number>();
        const applied = new Map<number, number>();
        const data = new Map<number, number>([[0, 20], [1, 20], [2, 20]]);

        const result = await Compensator.compensate({
            ledger, uin, module, batchId, pageSize: 20, maxRetry: 5,
            fetchPage: async (pi) => { fetched.add(pi); return { items: Array.from({ length: data.get(pi) || 0 }, (_, i) => ({ i })), total: 60 }; },
            applyPage: (pi, items) => { applied.set(pi, items.length); },
            rebuild: () => [],
            afterPage: async () => {},
            sleep: async () => {},
        });

        // 仅 1、2 被重采；0（success）未重采
        expect(fetched.has(0)).toBe(false);
        expect(fetched.has(1)).toBe(true);
        expect(fetched.has(2)).toBe(true);
        expect(result.compensated).toBe(2);
        expect(result.remaining).toBe(0);

        // 重采后两页都应变为 success
        const r1 = await ledger.get(uin, module, 1);
        const r2 = await ledger.get(uin, module, 2);
        expect(r1!.state).toBe('success' as PageState);
        expect(r2!.state).toBe('success' as PageState);
        expect(applied.get(1)).toBe(20);
        expect(applied.get(2)).toBe(20);
    });

    it('死页（重采仍实采<期望）不覆盖累加器槽位，保留首次采集的带映射数据', async () => {
        // 回归：视频模块第一页接口恒返回 15/20（死页）。首次采集已登记下载并回写 custom_* 映射，
        // 运行内补偿重采仍 15 条 → 判 missing/dead → 不得用「无映射的原始数据」覆盖槽位，
        // 否则媒体文件已下载但备份 JSON 映射丢失（查看器找不到文件）。
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Videos';
        const batchId = makeBatchId();
        await ledger.record(uin, module, { uin, module, pageIndex: 0, batchId, fetchedAt: Date.now(), state: 'missing', itemCount: 15, expectedCount: 20, retryCount: 0 });

        const applied: number[] = [];
        const result = await Compensator.compensate({
            ledger, uin, module, batchId, pageSize: 20, maxRetry: 5,
            // 死页：重采仍只返回 15 条（total 恒 224 → expected 恒 20）
            fetchPage: async () => ({ items: Array.from({ length: 15 }, (_, i) => ({ i })), total: 224 }),
            applyPage: (pi) => { applied.push(pi); },
            rebuild: () => [],
            afterPage: async () => {},
            sleep: async () => {},
        });

        expect(applied).toEqual([]); // 死页重采不得覆盖槽位 → 首次 custom_* 映射保留
        expect(result.compensated).toBe(0);
        const r = await ledger.get(uin, module, 0);
        expect(r!.state).toBe('missing' as PageState); // retryCount 0+1=1 < maxRetry 5 → 仍可重试
    });

    it('fetchPage 持续失败（已达上限）的页不会被无限重试，记为 dead', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Videos';
        const batchId = makeBatchId();
        await ledger.record(uin, module, { uin, module, pageIndex: 0, batchId, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 4, lastError: 'x' });

        const result = await Compensator.compensate({
            ledger, uin, module, batchId, pageSize: 20, maxRetry: 5,
            fetchPage: async () => { throw new Error('persistent fail'); },
            applyPage: () => {},
            rebuild: () => [],
            afterPage: async () => {},
            sleep: async () => {},
        });

        expect(result.dead).toBe(1);
        expect(result.remaining).toBe(0); // dead 为终态，被 listFailed 的 failed/missing 状态过滤排除，不计入仍可重试的残留
        const r = await ledger.get(uin, module, 0);
        expect(r!.state).toBe('dead' as PageState);
        expect(r!.retryCount).toBe(5);
    });

    it('手动重试：matchBatchId="*" 匹配旧 batch 失败页，重采后 stamp 成新 batchId（不丢旧成功页）', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const oldBatch = makeBatchId();
        // 旧 run 的账本：page0 成功、page1 失败、page2 丢失
        await ledger.record(uin, module, okRec(uin, module, 0, oldBatch, 20, 20));
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId: oldBatch, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0, lastError: 'boom' });
        await ledger.record(uin, module, { uin, module, pageIndex: 2, batchId: oldBatch, fetchedAt: Date.now(), state: 'missing', itemCount: 5, expectedCount: 20, retryCount: 1 });

        const newBatch = makeBatchId();
        const fetched = new Set<number>();
        const data = new Map<number, number>([[0, 20], [1, 20], [2, 20]]);
        const result = await Compensator.compensate({
            ledger, uin, module, batchId: newBatch, pageSize: 20, maxRetry: 5,
            matchBatchId: '*', recordBatchId: newBatch,
            fetchPage: async (pi) => { fetched.add(pi); return { items: Array.from({ length: data.get(pi) || 0 }, (_, i) => ({ i })), total: 60 }; },
            applyPage: () => {},
            rebuild: () => [],
            afterPage: async () => {},
            sleep: async () => {},
        });

        // 仅 1、2 被重采；0（成功页）不重采
        expect(fetched.has(0)).toBe(false);
        expect(fetched.has(1)).toBe(true);
        expect(fetched.has(2)).toBe(true);
        expect(result.compensated).toBe(2);
        // 重采后 stamp 新 batch
        const r1 = await ledger.get(uin, module, 1);
        expect(r1!.batchId).toBe(newBatch);
        expect(r1!.state).toBe('success' as PageState);
        // 旧成功页（page0）batchId 不变、依然存在（证明手动重试路径不再清空旧账本）
        const r0 = await ledger.get(uin, module, 0);
        expect(r0!.batchId).toBe(oldBatch);
        expect(r0!.state).toBe('success' as PageState);
    });

    it('listFailed 传 "*" 忽略 batch，匹配该模块全部未达上限的失败/丢失页', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const b1 = makeBatchId();
        const b2 = makeBatchId();
        await ledger.record(uin, module, { uin, module, pageIndex: 0, batchId: b1, fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 20, retryCount: 0 });
        await ledger.record(uin, module, { uin, module, pageIndex: 1, batchId: b2, fetchedAt: Date.now(), state: 'missing', itemCount: 5, expectedCount: 20, retryCount: 1 });

        // 指定 b1 只匹配 page0
        const onlyB1 = await ledger.listFailed(uin, module, b1, 5);
        expect(onlyB1.map((r) => r.pageIndex)).toEqual([0]);
        // '*' 匹配全部（0 和 1）
        const allPending = await ledger.listFailed(uin, module, '*', 5);
        expect(allPending.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    });
});

describe('PageLedger.clearUin：全新备份清空上一轮账本', () => {
    it('清空某 uin 全部页记录、模块索引与缓存（含 composite 子键）', async () => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        await ledger.record(uin, 'Messages', { uin, module: 'Messages', pageIndex: 0, batchId: 'b1', fetchedAt: Date.now(), state: 'success', itemCount: 10, expectedCount: 10, retryCount: 0 });
        await ledger.record(uin, 'Photos:album1', { uin, module: 'Photos:album1', pageIndex: 0, batchId: 'b1', fetchedAt: Date.now(), state: 'failed', itemCount: 0, expectedCount: 0, retryCount: 0, cursor: 'pk1' });

        await ledger.clearUin(uin);

        expect(await ledger.listModules(uin)).toEqual([]);
        expect(await ledger.list(uin, 'Messages')).toEqual([]);
        expect(await ledger.list(uin, 'Photos:album1')).toEqual([]);
        expect(await ledger.get(uin, 'Messages', 0)).toBeUndefined();
    });
});

describe('Compensator：重采空页且接口无 total 时不得洗白失败页', () => {
    const setup = async (expectedCount: number) => {
        const area = memoryKvArea();
        const ledger = new PageLedger(area);
        const uin = '1001';
        const module = 'Messages';
        const batchId = makeBatchId();
        await ledger.record(uin, module, {
            uin, module, pageIndex: 1, batchId, fetchedAt: Date.now(),
            state: 'failed', itemCount: 0, expectedCount, retryCount: 0, lastError: 'boom',
        });
        return { ledger, uin, module, batchId };
    };

    it('expectedCount=20：空响应 + total=0 不记 success、不覆盖槽位，失败页保留', async () => {
        const { ledger, uin, module, batchId } = await setup(20);
        const applied: number[] = [];
        const result = await Compensator.compensate({
            ledger, uin, module, batchId, pageSize: 20, maxRetry: 5,
            fetchPage: async () => ({ items: [], total: 0 }),
            applyPage: (pi) => { applied.push(pi); },
            rebuild: () => [], afterPage: async () => {}, sleep: async () => {},
        });
        expect(applied).toEqual([]);
        expect(result.compensated).toBe(0);
        expect((await ledger.get(uin, module, 1))!.state).not.toBe('success');
        expect(result.remaining).toBeGreaterThan(0);
    });

    it('expectedCount=0（首次也没 total）：pageSize 兜底，同样不洗白', async () => {
        const { ledger, uin, module, batchId } = await setup(0);
        const applied: number[] = [];
        const result = await Compensator.compensate({
            ledger, uin, module, batchId, pageSize: 20, maxRetry: 5,
            fetchPage: async () => ({ items: [], total: 0 }),
            applyPage: (pi) => { applied.push(pi); },
            rebuild: () => [], afterPage: async () => {}, sleep: async () => {},
        });
        expect(applied).toEqual([]);
        expect(result.compensated).toBe(0);
        expect((await ledger.get(uin, module, 1))!.state).not.toBe('success');
    });
});
