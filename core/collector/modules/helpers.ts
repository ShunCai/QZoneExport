import { isExtensionEnv } from '../../shared/env';
import { LIMITS, TIMING } from '../../shared/constants';
import { BG_MSG } from '../../shared/messages';
import { likeList } from '../../qzone-api/clients';
import type { ApiCall } from '../../qzone-api/clients';
import {
    extractRealUrlFromUrlCnHtml,
    getFileSuffixByUrl,
    hashString,
    isUrlCnShortlink,
    makeDownloadUrl,
    normalizeForDedup,
    randomSeconds,
    toHttp,
    toHttps,
    toJson,
} from '../../shared/utils';
import { isFullBackup, isCustom, isLast, isPreBackupPos, type IncrementConfig, type IncrementItem } from '../increment';
import { DL_DOWNLOADED_SEP } from '../checkpoint';
import { Compensator, FailureDetector, deriveExpectedCount, DEFAULT_MAX_RETRY, type PageLedger } from '../reliability';
import type { CollectContext } from '../pipeline';
import type { CollectorEnv, ModuleBaseConfig, RandomSeconds } from './types';

/**
 * 采集器公共助手（翻页/点赞/单项访客/媒体任务登记/断点续传）
 * 移植自 src/js/modules/common.js 与 content.js 的同名逻辑，行为保持一致
 */

/**
 * 断点续传：判断某阶段是否已完成（在当前断点阶段之前）
 * @param phase 要判断的阶段
 * @param checkpointPhase 断点记录的中断阶段（即“从这个阶段开始继续”）
 * @param order 模块的阶段顺序表
 */
export function isPhaseDone(phase: string, checkpointPhase: string, order: string[]): boolean {
    const idx = order.indexOf(phase);
    const cpIdx = order.indexOf(checkpointPhase);
    if (idx === -1 || cpIdx === -1) {
        return false;
    }
    return idx < cpIdx;
}

/** 页间随机等待（移植自 callNextPage 的 randomSeconds 语义） */
export async function randomSleep(env: CollectorEnv, rs: RandomSeconds): Promise<void> {
    await env.sleep(randomSeconds(rs.min, rs.max) * 1000);
}

/** 是否存在下一页（移植自 common.js hasNextPage L1228-1230） */
export function hasNextPage(pageIndex: number, pageSize: number, total: number, items: unknown[]): boolean {
    return items.length < total && pageIndex * pageSize < total;
}

/**
 * 页映射完整性：找出缺槽位，以及「槽位存在但内容为空」的中间页。
 * 空槽位等同于缺口（曾导致空页被当成成功、数据静默少一页）；
 * 末页允许为空——接口常以空 msglist 表示结束，不能误报。
 */
export function findPageGaps(pageMap: Map<number, unknown[]>): number[] {
    const present = [...pageMap.keys()].sort((a, b) => a - b);
    const maxPi = present.length ? present[present.length - 1]! : -1;
    const gaps: number[] = [];
    for (let g = 0; g <= maxPi; g++) {
        if (!pageMap.has(g) || (g < maxPi && (pageMap.get(g) ?? []).length === 0)) gaps.push(g);
    }
    return gaps;
}

/**
 * 增量语义下是否继续获取下一页（移植自 common.js isGetNextPage L1430-1447）
 * @param oldItems 上次备份数据
 * @param pageItems 新页条目
 */
export function isGetNextPage(
    oldItems: IncrementItem[] | undefined,
    pageItems: IncrementItem[],
    moduleCfg: IncrementConfig,
): boolean {
    if (isFullBackup(moduleCfg)) {
        // 全量备份继续获取下一页，是否到末页由 hasNextPage 判断
        return true;
    }
    if (isCustom(moduleCfg)) {
        // 自定义备份需判断是否已备份到指定时间的位置
        return !isPreBackupPos(pageItems, moduleCfg);
    }
    if (isLast(moduleCfg)) {
        // 上次备份需判断是否达到上次备份的位置
        if (!oldItems || oldItems.length === 0) {
            return true;
        }
        return !isPreBackupPos(pageItems, moduleCfg);
    }
    return true;
}

/** 列表翻页选项 */
export interface PagedListOptions<T> {
    env: CollectorEnv;
    /** 模块配置（分页/增量/延迟） */
    moduleCfg: ModuleBaseConfig;
    /** 上次备份数据（增量停止条件用） */
    oldItems?: IncrementItem[];
    /** 进度上报阶段名 */
    phase: string;
    /**
     * 拉取单页
     * @returns items 该页条目；total 总数（接口返回，未知传-1沿用已知值）
     */
    fetchPage(pageIndex: number): Promise<{ items: T[]; total: number }>;
    /** 断点续传：从第 N 页开始继续（前面的页数据由 initialItems 提供） */
    startPage?: number;
    /** 断点续传：前 N 页已采集的数据 */
    initialItems?: T[];
    /**
     * 每页完成后的回调。
     * @param allItems 当前累计全部条目（用于 saveStaging 落全量）
     * @param pageIndex 本页页码
     * @param pageItems 本页精确条目子集（由 pageMap 按页码槽位给出，不再由调用方用 slice(pi*pageSize) 反推，
     *                  彻底避免「补偿失败页时 slice 取到该页起全部尾部条目」的放大问题）
     * @param pageOffset 本页首条在 allItems 中的真实累计偏移（含之前各页实际条数，含空洞），供进度口径使用
     */
    afterPage?: (allItems: T[], pageIndex: number, pageItems: T[], pageOffset: number) => Promise<void>;
    /** 页级可靠性：传入则开启每页记账 + 运行内补偿（失败/丢失页仅重采） */
    reliability?: { ledger: PageLedger; uin: string; module: string; batchId: string };
    /** 仅补偿模式：跳过正常枚举，只重采 ledger 中 failed/missing 页（手动重试用） */
    compensateOnly?: boolean;
}

/**
 * 通用列表翻页循环
 * 等价于旧版 nextPage 递归 + callNextPage（common.js L1241-1253）：
 * - 单页失败时记录后跳过继续下一页（与旧版一致）
 * - 增量位置命中或超过总数时停止
 * - 页间随机等待，且在页边界响应暂停/取消（env.tick）
 */
export async function collectPagedList<T extends IncrementItem>(options: PagedListOptions<T>): Promise<T[]> {
    const { env, moduleCfg, oldItems, phase, fetchPage, startPage, initialItems, afterPage, reliability, compensateOnly } = options;
    const pageSize = moduleCfg.pageSize;
    const MAX_RETRY = DEFAULT_MAX_RETRY;
    // 以 pageMap 累加：补偿重采时按页码槽位替换，避免重复追加；reconstruct 保持页码升序
    const pageMap = new Map<number, T[]>();
    const getItems = (): T[] => {
        const out: T[] = [];
        for (const k of [...pageMap.keys()].sort((a, b) => a - b)) {
            const v = pageMap.get(k);
            if (v) out.push(...v);
        }
        return out;
    };
    // 精确本页条目（按页码槽位，绝不反推切片）
    const pageItemsOf = (pi: number): T[] => pageMap.get(pi) ?? [];
    // 本页首条在 allItems 中的真实累计偏移（之前各页实际条数之和，含空洞）
    const offsetBefore = (pi: number): number => {
        let off = 0;
        for (const k of [...pageMap.keys()].sort((a, b) => a - b)) {
            if (k < pi) off += (pageMap.get(k) ?? []).length;
        }
        return off;
    };
    // 续传恢复：initialItems 为已完成的整页，按 pageSize 切回 pageMap（staging 只存完整页）
    if (initialItems) {
        let p = 0;
        for (let i = 0; i < initialItems.length; i += pageSize) {
            const chunk = initialItems.slice(i, i + pageSize);
            // 防御：非末页却不足一整页，说明 staging 续传数据存在截断/空洞（槽位≠真实页号隐患）
            if (chunk.length < pageSize && i + pageSize < initialItems.length) {
                env.logger.warn(`[续传恢复] 第 ${p} 页仅 ${chunk.length} 条（不足 pageSize=${pageSize}），疑似 staging 截断/空洞，可能触发槽位错位`);
            }
            pageMap.set(p++, chunk);
        }
        env.logger.info(`[续传恢复] 已从 staging 恢复 ${p} 页，共 ${initialItems.length} 条`);
    }
    let total = 0;
    let pageIndex = startPage || 0;

    const recordPage = async (pi: number, hadError: boolean, lastError: string | undefined, actual: number, retryCount: number): Promise<void> => {
        if (!reliability) return;
        const expected = deriveExpectedCount(total, pi, pageSize);
        const state = FailureDetector.classify({ hadError, lastError, actual, expected, retryCount, maxRetry: MAX_RETRY });
        await reliability.ledger.record(reliability.uin, reliability.module, {
            uin: reliability.uin,
            module: reliability.module,
            pageIndex: pi,
            batchId: reliability.batchId,
            fetchedAt: Date.now(),
            state,
            itemCount: actual,
            expectedCount: expected,
            retryCount,
            lastError,
        });
    };

    // 拉取单页并记账；成功返回 true，失败（已记 failed）返回 false 且本页不追加（留给补偿重采）
    const runOnePage = async (pi: number): Promise<boolean> => {
        await env.tick();
        try {
            const page = await fetchPage(pi);
            const pageItems = page.items || [];
            if (page.total > 0) total = page.total;
            // 非末页却返回空页：接口抖动时不能写空数组占位，否则该页数据静默丢失、
            // 且页映射完整性检查也看不出来。抛错让其进 failed，交给运行内/手动补偿重采。
            // total 未知(=0) 时不判，避免 total 缺失/虚高时误伤合法末页。
            if (pageItems.length === 0 && total > 0 && getItems().length < total) {
                throw new Error(`非末页返回空页 | page=${pi} | 已采=${getItems().length} | total=${total}`);
            }
            pageMap.set(pi, pageItems);
            await recordPage(pi, false, undefined, pageItems.length, 0);
            if (afterPage) {
                const pg = pageItemsOf(pi);
                const off = offsetBefore(pi);
                env.logger.info(`[afterPage] 正常翻页 | page=${pi} | 本页条目=${pg.length} | 偏移=${off} | 累计=${getItems().length}`);
                await afterPage(getItems(), pi, pg, off);
            }
            return true;
        } catch (error) {
            env.logger.error('获取列表分页异常 | page=' + pi, error instanceof Error ? error.message : String(error));
            env.fail(1);
            await recordPage(pi, true, error instanceof Error ? error.message : String(error), 0, 0);
            return false;
        }
    };

    if (!compensateOnly) {
        // 进入列表循环前先预置主体阶段为「采集中(indeterminate)」，避免第一页处理期间
        // st.subject[phase] 尚未写入导致 computeSubjectProgress 回退到 sum 公式（明细已 20/20 累加算出 100%），
        // 第一页真实 total 上报后又掉回真实百分比造成的进度条倒退。Photos 模块已用此范式规避。
        await env.report(phase, 0, -1, undefined, undefined, { done: 0, total: -1 });

        // 首页 + 后续页；异常页跳过推进（已记入 ledger.failed），与旧版行为一致但可补偿。
        // 连续失败保护：接口持续不可用时，若一味翻完所有分页（可能上千页）会表现为「永不终止」，
        // 且向 ledger 灌入海量 failed 记录。连续失败达阈值即判定接口已挂，中止本模块后续分页
        // （已采集部分保留，失败页已落 ledger 可稍后重试）。触发条件为「连续」失败，故偶发抖动
        // （失败页之间夹着成功页）不会误中止，只有持续宕机才触发。
        const MAX_CONSECUTIVE_PAGE_FAILURES = DEFAULT_MAX_RETRY;
        let consecutiveFailures = 0;
        for (;;) {
            await env.tick();
            const ok = await runOnePage(pageIndex);
            if (ok) {
                consecutiveFailures = 0;
                const pageItems = pageMap.get(pageIndex) || [];
                // 列表枚举 + 当页明细处理均完成后，再上报主体进度（done=已枚举主体数）
                await env.report(phase, getItems().length, total || -1, undefined, undefined, { done: getItems().length, total: total || -1 });
                const cont = isGetNextPage(oldItems, pageItems, moduleCfg);
                if (!cont) {
                    // 已达增量备份位置，不再继续
                    break;
                }
            } else {
                consecutiveFailures++;
                env.logger.warn(
                    `采集分页失败（连续第 ${consecutiveFailures}/${MAX_CONSECUTIVE_PAGE_FAILURES} 次）` +
                    ` | module=${reliability?.module ?? '?'} | page=${pageIndex}`,
                );
                if (consecutiveFailures >= MAX_CONSECUTIVE_PAGE_FAILURES) {
                    env.logger.error(
                        `连续 ${consecutiveFailures} 页采集失败，判定数据请求不可用，中止本模块后续分页` +
                        `（已采集部分保留，失败页可稍后重试）`,
                    );
                    break;
                }
            }
            pageIndex++;
            if (!hasNextPage(pageIndex, pageSize, total, getItems())) {
                break;
            }
            await randomSleep(env, moduleCfg.randomSeconds);
        }
    }

    // H-2 缓解：接口未返回总数(total 未知)时，deriveExpectedCount 返回 0 → FailureDetector 跳过 missing 判定，
    // 末页截断会被静默判为 success（数据丢失「永不报警、永不补偿」）。此处显式告警，至少让风险可见。
    // 注：无 total 无法精确判定截断（需依赖接口返回 total 才能校验），故仅告警、不误报 failed。
    if (!compensateOnly && total <= 0 && getItems().length > 0) {
        env.logger.warn(
            `[完整性] 模块 ${reliability?.module ?? '?'} 接口未返回总数(total 未知)，` +
                `已采集 ${getItems().length} 条但无法校验是否截断，可能存在数据丢失风险（建议核对空间页面实际条数）`,
        );
    }

    // 运行内补偿：仅对 failed/missing 页重采（compensateOnly 模式则只跑这段，用于手动重试）
    if (reliability) {
        if (!compensateOnly) {
            await env.report(phase, getItems().length, total || -1, undefined, undefined, { done: getItems().length, total: total || -1 });
        }
        await Compensator.compensate<T>({
            ledger: reliability.ledger,
            uin: reliability.uin,
            module: reliability.module,
            batchId: reliability.batchId,
            // 手动重试（compensateOnly）匹配全部旧 batch 的失败/丢失页，并重采后 stamp 成当前重试 run 的 batchId；
            // 正常运行内补偿只匹配本 run 的 batchId。
            matchBatchId: compensateOnly ? '*' : reliability.batchId,
            recordBatchId: reliability.batchId,
            // 手动重试下调退避上限，避免高 retryCount 页休眠长达数十秒
            backoffCap: compensateOnly ? 5000 : undefined,
            pageSize,
            fetchPage,
            applyPage: (pi, items) => pageMap.set(pi, items),
            rebuild: getItems,
            afterPage: async (all, pi) => {
                if (afterPage) {
                    const pg = pageItemsOf(pi);
                    const off = offsetBefore(pi);
                    // 关键诊断：补偿单页时本页条目应≈pageSize，若≈本页起的全部尾部条目说明切片放大仍未修复
                    env.logger.info(`[afterPage] 运行内补偿 | page=${pi} | 本页条目=${pg.length} | 偏移=${off} | 累计=${all.length}`);
                    await afterPage(all, pi, pg, off);
                }
            },
            sleep: (ms) => env.sleep(ms),
        });
    }

    // ④ 诊断：页映射完整性（缺口即「失败且未补偿」的页，曾导致 slice 反推取到错误尾部）
    {
        const present = [...pageMap.keys()].sort((a, b) => a - b);
        const gaps = findPageGaps(pageMap);
        if (gaps.length) {
            env.logger.warn(`[页映射完整性] 共 ${present.length} 页，缺口/空槽位=${gaps.length}（${gaps.slice(0, 20).join(',')}${gaps.length > 20 ? '…' : ''}），缺口页将在运行内/手动补偿重采`);
        } else {
            env.logger.info(`[页映射完整性] 共 ${present.length} 页，无缺口`);
        }
    }

    return getItems();
}

/** 可采集点赞的条目 */
export interface LikeableItem extends IncrementItem {
    uniKey?: string;
    likes?: any[];
    likeTotal?: number;
}

/**
 * 获取单条目的全部点赞记录（begin_uin 游标翻页）
 * 移植自 common.js getModulesLikeList（L1300-1336）
 */
export async function collectLikes(
    env: CollectorEnv,
    item: LikeableItem,
    likeCfg: { isGet: boolean; randomSeconds: RandomSeconds },
    avatars?: AvatarTaskRegistry,
): Promise<void> {
    item.likes = item.likes || [];
    if (!likeCfg.isGet || !item.uniKey) {
        return;
    }
    let nextUin = 0;
    let hasNext = true;
    // get_like_list_app 的 is_dolike=1 表示「当前操作者(ownerUin)已点赞」，但其 like_uin_info
    // 不包含操作者本人（对本空间、对他人都一样）。需手动把「我」补进点赞名单并计入总数，
    // 否则互动页「我给TA点赞」统计永远拿不到自己那一条。
    let isDolike = false;
    while (hasNext) {
        await env.tick();
        try {
            const call = likeList(env.ctx, item.uniKey, nextUin);
            const text = await env.requester.get(call.url, call.params);
            const res = toJson<any>(text, /^_Callback\(/);
            if (res.code && res.code != 0) {
                env.logger.warn(`获取模块点赞记录异常 | uniKey=${item.uniKey} | code=${res.code}`, res.msg || '');
            }
            const data = res.data || {};
            if (data.is_dolike === 1) isDolike = true;
            const likeUins: any[] = data.like_uin_info || [];
            if (likeUins.length === 0) {
                hasNext = false;
            } else {
                item.likes = item.likes.concat(likeUins);
                nextUin = item.likes[item.likes.length - 1]['fuin'];
                // 登记点赞用户头像下载（全局去重）
                if (avatars) {
                    for (const u of likeUins) {
                        const uin = u.fuin || u.uin;
                        if (uin) avatars.download({ uin: Number(uin) });
                    }
                }
                // 请求一页成功后等待随机秒数再请求下一页
                await randomSleep(env, likeCfg.randomSeconds);
            }
        } catch (error) {
            hasNext = false;
            env.fail(1);
            env.logger.error(`获取点赞数据异常 | uniKey=${item.uniKey}`, error instanceof Error ? error.message : String(error));
        }
    }
    // is_dolike 时把「我」补进点赞名单（按 uin 去重后再加），点赞总数随 likes.length 自然 +1
    if (isDolike && env.ctx && env.ctx.ownerUin) {
        const me = env.ctx.ownerUin;
        const meStr = String(me);
        const already = item.likes.some((l) => String(l.fuin ?? l.uin) === meStr);
        if (!already) {
            // fuin/uin 都写，供互动统计「我给TA点赞」（owner-target 按 like.uin === ownerUin 判定）。
            // 采集端暂无操作者昵称（context 只含 uin），展示名用「本人」
            item.likes.push({ fuin: me, uin: me, nick: '本人', if_qq_friend: 1 });
        }
    }
    item.likeTotal = item.likes.length;
}

/** 单条目最近访问信息 */
export interface ItemVisitor {
    viewCount: number;
    totalNum: number;
    list: any[];
}

/**
 * 获取单条目的全部最近访问（分页）
 * 移植自各模块 getItemAllVisitorsList（如 messages.js L970-1012）
 * @param buildCall 构造某页的访客接口调用（各模块 appid 不同）
 */
export async function collectItemVisitors(
    env: CollectorEnv,
    visitorCfg: { pageSize: number; randomSeconds: RandomSeconds },
    buildCall: (pageIndex: number) => ApiCall,
    avatars?: AvatarTaskRegistry,
): Promise<ItemVisitor> {
    const visitor: ItemVisitor = { viewCount: 0, totalNum: 0, list: [] };
    let pageIndex = 0;
    for (;;) {
        await env.tick();
        try {
            const call = buildCall(pageIndex);
            const text = await env.requester.get(call.url, call.params);
            const res = toJson<any>(text, /^_Callback\(/);
            if (res.code && res.code != 0) {
                env.logger.warn(`获取单条目最近访问异常 | page=${pageIndex + 1} | code=${res.code}`, res.msg || '');
            }
            const data = res.data || {};
            visitor.viewCount = data.viewCount || 0;
            visitor.totalNum = data.totalNum || 0;
            const pageList = data.list || [];
            visitor.list = visitor.list.concat(pageList);
            // 登记访客头像下载（全局去重）
            if (avatars) {
                for (const v of pageList) {
                    const uin = v.uin || v.fuin;
                    if (uin) avatars.download({ uin: Number(uin) });
                }
            }
        } catch (error) {
            env.fail(1);
            env.logger.error(`获取最近访问列表异常 | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
        }
        pageIndex++;
        if (!hasNextPage(pageIndex, visitorCfg.pageSize, visitor.totalNum, visitor.list)) {
            break;
        }
        await randomSleep(env, visitorCfg.randomSeconds);
    }
    return visitor;
}

/** 可登记媒体下载的对象（登记后回写本地文件信息字段） */
export interface MediaOwner {
    custom_url?: string;
    custom_filename?: string;
    custom_filepath?: string;
    custom_mimeType?: string;
    [key: string]: unknown;
}

/**
 * 从引用该媒体的对象里提取所属内容关联信息（P2 特性，粗粒度覆盖常见字段）
 * 精细化提取各模块专属字段留到 P3 再做。猜不到就给 undefined，DM 展示时就不显示。
 */
export function extractOwnerInfo(
    item: MediaOwner,
    dir: string,
    source?: unknown,
): { thumbUrl?: string } {
    const obj = (typeof item === 'object' && item) || (typeof source === 'object' && (source as MediaOwner)) || null;
    if (!obj) return {};

    // thumbUrl：优先拿缩略图（small_url / thumburl / thumbnailUrl 等），仅用于下载条目预览图。
    // 注：原 ownerId / ownerTitle（所属内容摘要，如「这条图属于哪条说说/哪个相册」）已不再提取，
    // 封装任务时不再将来源内容关联到任务（见 newTask）。
    const thumbUrl = pickString(
        obj,
        'small_url', 'thumburl', 'thumbnail', 'thumbnailUrl', 'previewUrl', 'pic_small', 'smallpic',
    ) || undefined;

    return { thumbUrl };
}

/** 从对象中依次尝试读取多个 key，返回第一个非空字符串；找不到返回 undefined */
function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const k of keys) {
        const v = (obj as any)[k];
        if (typeof v === 'string' && v.trim().length > 0) return v;
        if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
    }
    return undefined;
}

/**
 * 模块媒体任务登记器
 * 等价于旧版 API.Utils.addDownloadTasks + FILE_URLS 去重（content.js L1648-1675）：
 * - 文件名用URL确定性哈希（同一URL总得同名，支撑直写盘跨备份去重）
 * - 同一URL只登记一次下载任务，但每个引用对象都会回写 custom_* 字段
 */
/**
 * 表情图片基础地址（与查看器 viewer/src/data/richText.ts 的 QQ_EMOTICON_URL 保持一致）
 * 内容里的 [em]e123[/em] 会被解析为 e123.gif 并下载到 Common/images/e123.gif，
 * 查看器按固定路径引用，故文件名必须是确定的 e{id}.gif（不走 URL 哈希）。
 */
const EMOTICON_BASE = 'https://qzonestyle.gtimg.cn/qzone/em/';
/** 内容里的 QQ 表情占位符：[em]e123[/em] → 表情 id 123 */
const EMOTICON_RE = /\[em\]e(\d+)\[\/em\]/gi;
/** 跨模块全局去重：表情地址固定（e{id}.gif），整个备份只下载一次到 Common/images */
const _emoticonSeen = new Map<string, string>();
/** 跨 registry 的后缀探测缓存：避免同一 URL 在多模块间重复发起 MIME 探测 */
const _suffixCache = new Map<string, string>();
/** 进行中的后缀探测：相同 URL 并发登记时共享同一探测 Promise，避免重复打 CDN */
const _suffixInflight = new Map<string, Promise<string>>();

/**
 * 解析媒体文件后缀，保证「类型探测 / 文件命名 / 引用地址」三者一致（修复 #2）。
 * - 开启自动探测（isAutoFileSuffix）时，以 MIME 探测到的真实类型为准：浏览器/下载器
 *   常因 URL 末段是 .gif 而实际为 PNG/JPEG 误判，导致扩展名与真实类型不一致；
 * - 关闭自动探测时，直接用 URL 扩展名；
 * - 两者都为空时兜底 .jpeg，避免出现「无扩展名」的文件（引用地址与磁盘文件名一致才是关键）。
 * 同一 URL 只探测一次（_suffixCache），多模块复用。
 */
export async function resolveMediaSuffix(url: string, env: CollectorEnv): Promise<string> {
    const cached = _suffixCache.get(url);
    if (cached !== undefined) return cached;
    const inflight = _suffixInflight.get(url);
    if (inflight) return inflight;
    const promise = (async () => {
        let suffix = '';
        if (env.config.Common.isAutoFileSuffix) {
            // 自动探测优先以 MIME 真实类型为准；探测失败（空）再退回 URL 扩展名，
            // 避免「落盘无扩展名 / 扩展名与实际类型不一致」问题（#2）。
            suffix = await env.detectSuffix(url);
        }
        if (!suffix) {
            suffix = getFileSuffixByUrl(url);
        }
        if (!suffix) {
            suffix = '.jpeg';
        }
        _suffixCache.set(url, suffix);
        return suffix;
    })();
    _suffixInflight.set(url, promise);
    try {
        return await promise;
    } finally {
        _suffixInflight.delete(url);
    }
}

export class MediaTaskRegistry {
    /** URL → 文件名（同 URL 在各目录得到同一确定文件名） */
    private readonly urlToName = new Map<string, string>();
    /** 已登记下载任务的 (dir,url) 键集合（模块内/目录级去重闸门，避免同模块跨目录被漏下） */
    private readonly registered = new Set<string>();
    /** 已下载 URL 集合（懒加载 + 缓存，避免每条媒体都查 IndexedDB） */
    private downloadedPromise?: Promise<Set<string>>;
    /** 本轮登记中「已下载跳过」的媒体计数（替换逐条刷屏日志，改为末尾汇总一行） */
    private skippedCount = 0;
    /** 本轮实际新登记的媒体计数 */
    private registeredCount = 0;

    constructor(
        private readonly env: CollectorEnv,
        private readonly module: string,
    ) {}

    /**
     * 登记媒体下载任务并回写对象的本地文件信息
     * @param item 引用该媒体的对象（回写 custom_url/custom_filename/custom_filepath）
     * @param url 媒体地址
     * @param dir 相对备份根的目录（如 Messages/images）
     * @param source 来源条目
     * @param suffix 指定后缀（如 .mp3/.jpeg），不传时按URL自动识别
     */
    /**
     * 登记媒体下载任务并回写对象的本地文件信息
     * @param item 引用该媒体的对象（回写 custom_url/custom_filename/custom_filepath，同时从中提取所属内容摘要 ownerId/ownerTitle）
     * @param url 媒体地址
     * @param dir 相对备份根的目录（如 Messages/images）
     * @param source 来源条目（与 item 一般相同）
     * @param suffix 指定后缀（如 .mp3/.jpeg），不传时按URL自动识别
     */
    async add(item: MediaOwner, url: string | undefined, dir: string, source?: unknown, suffix?: string): Promise<void> {
        if (!url) {
            return;
        }
        url = toHttp(url);
        // 2026-08：处理 url.cn 图片短链 / 腾讯代理链的异步解包（备份时把能还原的都还原成最终图地址）
        if (isUrlCnShortlink(url)) {
            const resolved = await unwrapImageUrl(url, this.env);
            if (isUrlCnShortlink(resolved)) {
                // 解析失败：降级返回原短链，无法直接下载，跳过避免无效任务
                this.env.logger.warn('url.cn 短链解析失败，跳过下载任务', { original: url, resolved });
                return;
            }
            url = resolved;
        }
        item.custom_url = url;
        if (this.isQzoneUrl()) {
            // 媒体策略为外链引用，不下载
            return;
        }
        // === 2026-08：提取「所属内容」关联信息（供下载管理 Tab 展示：这张图属于哪条说说/哪个相册） ===
        const ownerInfo = extractOwnerInfo(item, dir, source);
        let filename = this.urlToName.get(url);
        if (!filename) {
            // 用URL的确定性哈希作文件名，同一URL总得同名（图片保持完整地址；视频去参见 video-tasks/videos）
            filename = hashString(url);
            if (suffix) {
                filename = filename + suffix;
                item.custom_mimeType = suffix;
            } else {
                const autoSuffix = await resolveMediaSuffix(url, this.env);
                filename = filename + autoSuffix;
                item.custom_mimeType = autoSuffix;
            }
            this.urlToName.set(url, filename);
        }
        item.custom_filename = filename;
        item.custom_filepath = dir + '/' + filename;
        // 下载任务闸门按 (目录,URL) 去重：同模块内同一 URL 出现在不同目录（如视频封面与视频本体）
        // 也分别登记，避免跨目录被合并漏下；而同一目录内同 URL 只下一遍（filename 已稳定）。
        const fileKey = dir + DL_DOWNLOADED_SEP + url;
        if (!this.registered.has(fileKey)) {
            // 先占位再登记：并发登记（addMediaToTasks 已 runPool 化）时，
            // 相同 (dir,url) 若在 await newTask 之后再 add，会出现两个并发调用都 has=false
            // 而重复登记；先 add 占位即可保证后续调用命中闸门跳过。
            this.registered.add(fileKey);
            // newTask 用完整地址（含 token），下载不受影响
            await this.newTask(url, dir, filename, source, false, ownerInfo);
        }
    }

    /**
     * 扫描文本里的 QQ 表情占位符 [em]e123[/em]，把对应表情图片下载到 Common/images/e123.gif。
     * 查看器（viewer/src/data/richText.ts）渲染时按固定路径 Common/images/e{id}.gif 引用，
     * 故文件名必须用确定的 e{id}.gif（不走 URL 哈希），且跨模块只下载一次。
     * 修复「内容区表情占位符未被解析下载」的问题（此前该能力在 v3 重构时丢失）。
     */
    async addEmoticons(texts: Array<unknown>, source?: unknown): Promise<void> {
        if (this.isQzoneUrl()) {
            return; // 外链模式不下载表情
        }
        const ids = new Set<string>();
        for (const t of texts) {
            if (typeof t !== 'string' || !t) continue;
            EMOTICON_RE.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = EMOTICON_RE.exec(t)) !== null) {
                ids.add(m[1]!);
            }
        }
        if (ids.size === 0) return;
        for (const id of ids) {
            const name = 'e' + id + '.gif';
            const url = EMOTICON_BASE + name;
            if (_emoticonSeen.has(url)) continue; // 跨模块全局去重，整个备份只下载一次
            _emoticonSeen.set(url, name);
            await this.newTask(url, 'Common/images', name, source, false);
        }
    }

    /**
     * 直接登记下载任务（不做URL去重回写，供视频/头像等特殊场景使用）
     * 等价于旧版 API.Utils.newDownloadTask（content.js L1685-1710）
     *
     * 已在「本轮或上一轮备份」中成功下载过的 URL 会被跳过（断点去重），
     * 文件已在磁盘上，跳过可避免重复下载；仍回写 custom_* 字段供查看器引用。
     */
    async newTask(
        url: string,
        dir: string,
        name: string,
        source?: unknown,
        makeOrg?: boolean,
        ownerInfo?: { thumbUrl?: string },
        /** 跳过断点去重：允许重复下载（视频预览图等需要独立文件名的场景） */
        bypassDownloadedCheck?: boolean,
    ): Promise<void> {
        if (!url) {
            return;
        }
        const downloadUrl = makeOrg ? url : makeDownloadUrl(url, true);
        // 断点去重：该 URL 此前已下载落盘，则不再登记下载任务。
        // 用下载地址（带 save=1&d=1）做键，与 markDownloaded 存储的键保持一致。
        // 视频预览图等场景需要独立文件名（每个视频一份），即使 URL 相同也应下载，避免跨模块误杀。
        if (!bypassDownloadedCheck && (await this.isAlreadyDownloaded(downloadUrl, dir))) {
            // 断点续传/重采时，已下载媒体在此被大量命中；逐条打日志会刷屏拖垮 UI，
            // 改为计数，由调用方在 addMediaToTasks 末尾用 flushDownloadSummary 汇总一行。
            this.skippedCount++;
            return;
        }
        // 视频存在有效期，MP4/M3U8任务前置尽早下载
        const prioritized = !!name && (name.indexOf('mp4') > -1 || name.indexOf('m3u8') > -1);
        // 封装任务时不再关联来源内容（ownerId/ownerTitle）：下载条目只展示所属模块，
        // 所属内容的文本关联不再绑定到任务。仅保留 thumbUrl 用于条目预览图。
        this.env.addMediaTask({
            module: this.module,
            url: downloadUrl,
            dir,
            name,
            source,
            prioritized,
            thumbUrl: ownerInfo?.thumbUrl,
        });
        this.registeredCount++;
    }

    /**
     * 汇总本轮媒体登记结果（已下载跳过 / 新登记），替换逐条「跳过重复下载」刷屏日志。
     * 在 addMediaToTasks / addCommentMediaToTasks 末尾各调用一次；调用后计数清零。
     */
    flushDownloadSummary(label: string): void {
        const skipped = this.skippedCount;
        const registered = this.registeredCount;
        this.skippedCount = 0;
        this.registeredCount = 0;
        if (skipped > 0 || registered > 0) {
            this.env.logger?.info?.(`${label}：已下载跳过 ${skipped} 个（不重复下载），新登记 ${registered} 个`);
        }
    }

    /**
     * 登记「预览图」下载任务（视频预览/相片预览/相册封面等）。
     *
     * 预览图按模块独立存放（如 Messages/images、Albums/images、Videos/images 各自一份），
     * 同一视频/相片可能出现在多个模块，每个模块都需要自己的预览图副本供本模块查看器使用，
     * 因此预览图必须绕过断点去重（isAlreadyDownloaded），无论 URL 是否已被其它模块下载过。
     * 原图/视频本体等仍走 newTask 默认去重，避免重复落盘。
     */
    async newPreviewTask(
        url: string,
        dir: string,
        name: string,
        source?: unknown,
        ownerInfo?: { thumbUrl?: string },
    ): Promise<void> {
        await this.newTask(url, dir, name, source, false, ownerInfo, true);
    }

    /** 媒体策略是否为外链引用（不下载） */
    isQzoneUrl(): boolean {
        return this.env.config.Common.mediaMode === 'Link' || this.env.config.Common.downloadType === 'QZone';
    }

    /**
     * 判断某 URL 是否已在「本轮或上一轮备份」的【同一目录】中下载完成。
     * 通过 env.getDownloadedUrls 读取断点集合（目录级键 `dir<SEP>url`，未提供则视为未下载）；
     * 集合一次读取后缓存，避免每条媒体都打 IndexedDB。
     *
     * 目录级判定是「模块级去重」的核心：相册/说说已下载过的图片，收藏模块引用同一
     * URL 时，因目录不同（如 Favorites/images）不会被误判为已下载，从而能独立下载
     * 自己的副本；而同一目录内的重复 URL 仍会被跳过（续传去重）。
     */
    private async isAlreadyDownloaded(url: string, dir: string): Promise<boolean> {
        if (!this.env.getDownloadedUrls) {
            return false;
        }
        try {
            if (!this.downloadedPromise) {
                this.downloadedPromise = this.env.getDownloadedUrls();
            }
            const set = await this.downloadedPromise;
            // 去重键须与「写入侧」(checkpoint.markDownloaded) 一致地剥离防盗链 token/key 等查询参数：
            // QQ 视频/图片地址常把 dis_k/dis_t/rf/vuin 等 token 放在 query 中、每次会话都不同，
            // 若直接用含 token 的 downloadUrl 做键，跨会话(token 变化)会判为「未下载」而重复下载。
            // 视频文件名生成（video-tasks/videos）已用 normalizeForDedup 去参，这里同步去参以保持一致。
            // 注意：仅用于去重键，绝不改动实际下载地址（task.url 仍保留 token 以免 403）。
            return set.has(dir + DL_DOWNLOADED_SEP + normalizeForDedup(url));
        } catch {
            // 读取失败时不阻塞下载，按未下载处理
            return false;
        }
    }
}

/**
 * url.cn 短链解析的轻量并发控制 + 结果缓存（模块级单例）。
 *
 * 背景：说说/相册中常出现 `url.cn/xxx` 短链，需访问一次页面抽取真实图片地址。
 * 问题：旧实现每条短链都「串行 + 无缓存」地请求，同一图片被多处引用时会重复请求，
 * 且数千条短链会瞬间打满 background 代理。这里：
 *   1) 用 Map 缓存「短链 → 解析 Promise」，相同短链只解析一次（含失败降级结果也缓存）；
 *   2) 用信号量限制并发请求数（UNWRAP_CONCURRENCY），避免压垮 background SW。
 */
const UNWRAP_CONCURRENCY = LIMITS.UNWRAP_URL_CONCURRENCY;
const URL_CN_CACHE_SIZE = LIMITS.URL_CN_CACHE_SIZE;
const urlCnCache = new Map<string, Promise<string>>();
let urlCnActive = 0;
const urlCnQueue: Array<() => void> = [];

function urlCnAcquire(): Promise<void> {
    if (urlCnActive < UNWRAP_CONCURRENCY) {
        urlCnActive++;
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => urlCnQueue.push(resolve));
}

function urlCnRelease(): void {
    urlCnActive--;
    const next = urlCnQueue.shift();
    if (next) {
        urlCnActive++;
        next();
    }
}

/** url.cn 解析的底层实现（不含缓存/并发控制，详见 unwrapImageUrl） */
async function unwrapImageUrlInner(url: string, env: CollectorEnv): Promise<string> {
    const original = url;
    try {
        env.logger.info?.('unwrapImageUrl: 解析 url.cn 短链', original);
        // 强制 https：内容脚本运行在 HTTPS 页面下，Mixed Content 会直接拦截 http 请求
        const httpsUrl = toHttps(original);

        // ===== 方式 1：优先经由 background Service Worker 代理（最稳，无 CORS） =====
        let html: string | undefined;
        if (isExtensionEnv()) {
            try {
                const resp: any = await chrome.runtime.sendMessage({
                    from: 'content',
                    type: BG_MSG.URL_CN_FETCH_HTML,
                    url: httpsUrl,
                });
                if (resp && resp.ok && typeof resp.data === 'string' && resp.data.length > 0) {
                    const fetchedHtml: string = resp.data;
                    html = fetchedHtml;
                    env.logger.info?.('unwrapImageUrl: background 代理 url.cn 成功', {
                        length: fetchedHtml.length,
                    });
                } else {
                    env.logger.warn?.('unwrapImageUrl: background 代理 url.cn 失败，退回本地 fetch', {
                        url: original,
                        message: resp?.message || 'unknown',
                    });
                }
            } catch (rtErr) {
                env.logger.warn?.('unwrapImageUrl: runtime.sendMessage 异常，退回本地 fetch', {
                    url: original,
                    error: (rtErr as Error).message || String(rtErr),
                });
            }
        }

        // ===== 方式 2：环境允许时用 requester.get 兜底（测试环境 / 未启用代理时） =====
        if (!html) {
            // url.cn 的页面是静态提示页，编码 UTF-8；不设置 charset 会走自动探测（含 UTF-8），这里写死更稳
            html = await env.requester.get(httpsUrl, undefined, { charset: 'utf-8' });
        }

        const real = extractRealUrlFromUrlCnHtml(html);
        if (real) {
            // 真实地址也强制 https：避免解出来的仍是 http://xxx.qpic.cn/... 再被 Mixed Content 拦
            const normalized = toHttp(real);
            const safe = toHttps(normalized);
            env.logger.info?.('unwrapImageUrl: url.cn 解包成功', { from: original, to: safe });
            return safe;
        }
        env.logger.warn?.('unwrapImageUrl: url.cn 返回内容中未找到真实链接', original);
    } catch (error) {
        env.logger.warn?.('unwrapImageUrl: url.cn 解析失败，降级为原地址', {
            url: original,
            error: (error as Error).message || String(error),
        });
    }
    return original;
}

/**
 * 异步解包 URL：把 url.cn 短链访问一次，取其 HTML 里的 <p class="link"> 真实图片地址返回。
 *
 * 流程（针对 CORS/Mixed Content 做了明确处理）：
 *   1) 目标不是 url.cn 短链 → 直接返回原字符串
 *   2) 先把协议升级到 https://，避免运行在 https 页面下时被 Mixed Content 拦截
 *   3) 【首选】通过 chrome.runtime.sendMessage({ type: 'urlcn_fetch_html' }) 把 GET 请求委托给
 *      background Service Worker：SW 里的 fetch 没有 CORS / Origin 限制，直接把 HTML 文本返回给内容脚本
 *   4) 【兜底】如果没有 chrome.runtime（测试环境 / 非扩展上下文），就退回到 env.requester.get 直接访问
 *   5) 用 extractRealUrlFromUrlCnHtml 提取真实 URL，真实地址也强制 https 归一化
 *   6) 失败则打日志并返回原 URL（确保后续下载链路不被阻断）
 *
 * 与 MediaTaskRegistry 解耦：avatar/视频/M3U8 等任何模块若遇到 url.cn 都可直接调用此函数。
 * 性能：相同短链只解析一次（缓存），且并发请求受信号量限制。
 */
export function unwrapImageUrl(url: string, env: CollectorEnv): Promise<string> {
    if (!url || !isUrlCnShortlink(url)) {
        return Promise.resolve(url);
    }
    const cached = urlCnCache.get(url);
    if (cached) {
        return cached;
    }
    const task = (async () => {
        try {
            await urlCnAcquire();
            return await unwrapImageUrlInner(url, env);
        } finally {
            urlCnRelease();
        }
    })();
    // 失败时同样缓存结果（降级为原地址），避免反复重试打爆网络
    urlCnCache.set(url, task);
    // 超出上限时按插入顺序淘汰最旧条目，避免模块级缓存长期运行无限增长
    if (urlCnCache.size > URL_CN_CACHE_SIZE) {
        const oldest = urlCnCache.keys().next().value;
        if (oldest !== undefined) {
            urlCnCache.delete(oldest);
        }
    }
    return task;
}

/** 清空 url.cn 解析缓存（一轮备份结束后由引擎调用，避免跨备份残留） */
export function clearUnwrapImageUrlCache(): void {
    urlCnCache.clear();
}

/** 含评论列表的条目 */
export interface CommentedItem extends IncrementItem {
    custom_comments?: any[];
}

/** 可下载头像的用户 */
export interface AvatarUser {
    uin?: number;
    avatar?: string;
    custom_avatar?: string;
    [key: string]: unknown;
}

/**
 * QQ空间用户头像下载登记器（跨模块共享，接线层创建单例）
 * 移植自 common.js downloadUserAvatar/downloadUserAvatars（L1342-1375）：
 * 任务归 Friends 模块，下到 Common/images/<uin>，同一头像只登记一次
 */
/**
 * 统一写出模块产物：查看器读取的 json/*.js、可选的 JSON 汇总文件、可选的 MarkDown 导出。
 * 消除各采集器 collect / restore 中重复的「三段式」导出代码。
 */
export interface WriteModuleOutputsOptions {
    /** 配置键 / MarkDown 模块名（如 'Messages'、'Photos'） */
    module: string;
    /** 写入的 JS 全局变量名（如 'messages'、'albums'、'boardInfo'） */
    globalName: string;
    /** 导出的数据 */
    data: unknown;
    /** json/*.js 产物路径（如 'Messages/json/messages.js'） */
    jsonJsPath: string;
    /** JSON 汇总文件路径（如 'Messages/json/messages.json'） */
    jsonFilePath: string;
    /** 是否额外导出 MarkDown（仅 Messages 等支持的模块开启） */
    markdown?: boolean;
}

export async function writeModuleOutputs(env: CollectorEnv, options: WriteModuleOutputsOptions): Promise<void> {
    const cfg = (env.config as unknown as Record<string, { exportType?: string }>)[options.module];
    // MarkDown 模式下不生成查看器专用的 window.xxx= json/*.js（HTML 查看器整体跳过），
    // 仅保留 module.json 汇总与对应 MarkDown 导出；HTML 模式照旧写 json/*.js 供查看器读取
    const isMarkdownMode = cfg?.exportType === 'MarkDown';
    if (!isMarkdownMode) {
        await env.writeJsonToJs(options.globalName, options.data, options.jsonJsPath);
    }
    // module.json 汇总文件始终产出（不再依赖 exportType，与 HTML/MarkDown 解耦，等价于旧版 JSON 格式常驻）
    await env.writeText(JSON.stringify(options.data), options.jsonFilePath);
    if (isMarkdownMode && options.markdown && env.exportMarkdown) {
        await env.exportMarkdown(options.module, options.data);
    }
}

export class AvatarTaskRegistry {
    /** 头像URL → 本地路径（全局去重，对应旧版 QZone.Common.FILE_URLS） */
    private readonly fileUrls = new Map<string, string>();
    private readonly registry: MediaTaskRegistry;

    constructor(private readonly env: CollectorEnv) {
        this.registry = new MediaTaskRegistry(env, 'Friends');
    }

    /** 获取用户头像在线地址（移植自 api.js getUserLogoUrl L2283-2293） */
    getUserLogoUrl(uin: number): string {
        const avatarHost = this.env.config.Common.AvatarHost ?? 0;
        let host: string | number = '';
        if (avatarHost >= 0) {
            host = avatarHost == 0 ? uin % 4 : avatarHost;
        }
        return `https://qlogo${host}.store.qq.com/qzone/${uin}/${uin}/100`;
    }

    /** 获取用户头像本地地址（移植自 api.js getUserLogoLocalUrl L2298-2304） */
    getUserLogoLocalUrl(uin: number): string {
        if (this.registry.isQzoneUrl()) {
            // 外链模式直接用在线地址
            return this.getUserLogoUrl(uin);
        }
        return 'Common/images/' + uin;
    }

    /** 登记单个用户的头像下载任务并回写地址字段 */
    download(user: AvatarUser): void {
        if (this.registry.isQzoneUrl() || !user || !user.uin) {
            // QQ空间外链不下载
            return;
        }
        const avatarUrl = this.getUserLogoUrl(user.uin);
        if (this.fileUrls.has(avatarUrl)) {
            // 添加过下载任务则跳过
            user.avatar = avatarUrl;
            user.custom_avatar = this.getUserLogoLocalUrl(user.uin);
            return;
        }
        // 头像地址不追加下载参数（makeOrg）
        this.registry.newTask(avatarUrl, 'Common/images', String(user.uin), user, true);
        user.avatar = avatarUrl;
        user.custom_avatar = this.getUserLogoLocalUrl(user.uin);
        this.fileUrls.set(avatarUrl, user.custom_avatar);
    }

    /** 批量登记用户头像下载任务 */
    downloadAll(users: AvatarUser[] | undefined): void {
        if (this.registry.isQzoneUrl() || !users) {
            return;
        }
        for (const user of users) {
            this.download(user);
        }
    }
}

/**
 * 登记评论及回复的配图下载任务
 * 移植自 common.js addCommentImageDownloadTasks 语义（评论 pic 的 hd_url||b_url）
 */
export async function addCommentImageTasks(
    registry: MediaTaskRegistry,
    item: CommentedItem,
    dir: string,
    avatars?: AvatarTaskRegistry,
): Promise<void> {
    const comments = item.custom_comments || [];
    for (const comment of comments) {
        for (const image of comment.pic || []) {
            await registry.add(image, image.hd_url || image.b_url, dir, item);
        }
        // 评论文本里的 QQ 表情（[em]eXXX[/em]）
        await registry.addEmoticons([comment.content, comment.msgContent], item);
        // 登记评论用户头像下载
        if (avatars && comment.user?.uin) {
            avatars.download({ uin: comment.user.uin });
        }
        for (const reply of comment.list_3 || []) {
            for (const image of reply.pic || []) {
                await registry.add(image, image.hd_url || image.b_url, dir, item);
            }
            // 回复文本里的 QQ 表情
            await registry.addEmoticons([reply.content, reply.msgContent], item);
            // 登记回复用户头像下载
            if (avatars && reply.user?.uin) {
                avatars.download({ uin: reply.user.uin });
            }
        }
    }
}

/**
 * 登记评论及回复文本里的 QQ 表情下载任务（不含配图）。
 * 供把评论存在 `comments`（而非 `custom_comments`）的模块（分享/日志/日记/视频）使用；
 * 与 addCommentImageTasks 对 custom_comments 的表情处理互补。回复兼容 replies/list_3/replyList。
 */
export async function addCommentEmotionTasks(
    registry: MediaTaskRegistry,
    comments: Array<Record<string, any>> | undefined,
    source?: unknown,
): Promise<void> {
    if (!Array.isArray(comments)) return;
    for (const comment of comments) {
        await registry.addEmoticons([comment?.content, comment?.msgContent], source);
        const replies = Array.isArray(comment?.replies) ? comment.replies
            : Array.isArray(comment?.list_3) ? comment.list_3
            : Array.isArray(comment?.replyList) ? comment.replyList : [];
        for (const reply of replies) {
            await registry.addEmoticons([reply?.content, reply?.msgContent], source);
        }
    }
}

/**
 * 分批并发处理新条目（移植自各模块点赞/访客采集的 _.chunk(items, 10) 批量模式）
 * 列表由新到旧，遇到旧条目即停止（后续均为已备份数据）；每批完成后暂停半秒
 * @param phase 上报进度的阶段名（传了才逐批上报，否则UI上的数字会一直不动）
 * @returns 实际处理的条目数
 */
export async function forEachNewItemBatch<T extends IncrementItem>(
    env: CollectorEnv,
    items: T[],
    batchSize: number,
    handler: (item: T) => Promise<void>,
    phase?: string,
): Promise<number> {
    let count = 0;
    for (let i = 0; i < items.length; i += batchSize) {
        await env.tick();
        const batch = items.slice(i, i + batchSize);
        const tasks: Promise<void>[] = [];
        let stopped = false;
        for (const item of batch) {
            if (item.isNewItem === false) {
                // 列表由新到旧，遍历到旧项后均为旧数据，计为已成功处理
                stopped = true;
                break;
            }
            count++;
            tasks.push(handler(item));
        }
        await Promise.all(tasks);
        if (phase) {
            // 采集层改造：批处理进度（likes/visitors/comments 等按主体批处理）自动附主体进度；
            // 相片级 phase（photo-*）不是主体对齐，排除，避免污染主体分母。
            const attachSubject = !phase.startsWith('photo-');
            await env.report(phase, count, items.length, undefined, undefined, attachSubject ? { done: count, total: items.length } : undefined);
        }
        if (stopped) {
            break;
        }
        // 每一批次完成后暂停半秒
        await env.sleep(TIMING.BATCH_INTERVAL);
    }
    return count;
}
/**
 * 逐页内联辅助：根据旧备份数据构造「是否为新条目」的过滤器。
 * 逐页内联时 afterPage 在 unionBackedUpItems 之前运行，isNewItem 尚未设置，
 * 需要提前判断哪些条目录自旧备份、不应重复请求评论/点赞/访问等 API。
 * 使用常见 ID 字段（tid/blogId/blogid/vid/id）匹配，覆盖所有模块。
 */
export function buildOldItemFilter<T extends IncrementItem>(oldItems: T[] | undefined): (item: T) => boolean {
    if (!oldItems || oldItems.length === 0) return () => true;
    const oldKeys = new Set(oldItems.map(o => {
        const it = o as any;
        return String(it.tid ?? it.blogId ?? it.blogid ?? it.vid ?? it.shuoshuoid ?? it.id ?? '');
    }).filter(k => k !== ''));
    return (item) => {
        const it = item as any;
        const key = String(it.tid ?? it.blogId ?? it.blogid ?? it.vid ?? it.shuoshuoid ?? it.id ?? '');
        return !oldKeys.has(key) || key === '';
    };
}


/**
 * 给不走 collectPagedList 的模块补页级记账（Boards / Shares / Visitors）。
 *
 * 这几个模块有自己的翻页循环（对象产物 / HTML 分页 / 服务端 totalPage），无法直接复用
 * collectPagedList，但采集明细的清单与「按模块筛选」下拉都依赖 ledger 的页记录——
 * 不记账就既看不到清单行、也选不到该模块。此函数只写账本，不碰数据流/进度。
 *
 * @param total    接口返回的总条目数；未知传 0
 * @param pageSize 每页条数；服务端分页（如访客）传 0 → expected=0（不判 missing，避免误报）
 */
export async function recordSimplePage(
    ctx: CollectContext,
    module: string,
    pageIndex: number,
    actual: number,
    total: number,
    pageSize: number,
    hadError = false,
    error?: string,
): Promise<void> {
    const ledger = ctx.ledger;
    if (!ledger) return;
    const expected = pageSize > 0 ? deriveExpectedCount(total, pageIndex, pageSize) : 0;
    const state = FailureDetector.classify({
        hadError, lastError: error, actual, expected,
        retryCount: 0, maxRetry: DEFAULT_MAX_RETRY,
    });
    await ledger.record(String(ctx.uin), module, {
        uin: String(ctx.uin), module, pageIndex,
        batchId: ctx.batchId, fetchedAt: Date.now(),
        state, itemCount: actual, expectedCount: expected,
        retryCount: 0, lastError: error,
    });
}
