import { blogReadCount, diaryComments, diaryInfo, diaryList, diaryVisitors } from '../../qzone-api/clients';
import { sortBy, toJson, unionItems } from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import { processBlogDetail } from './blog-html';
import type { BlogItem } from './blogs';
import { getBlogUniKey } from './blogs';
import {
    addCommentEmotionTasks,
    AvatarTaskRegistry,
    buildOldItemFilter,
    collectItemVisitors,
    collectLikes,
    collectPagedList,
    hasNextPage,
    MediaTaskRegistry,
    randomSleep,
    writeModuleOutputs,
    shouldCollectLikes,
    shouldCollectVisitors,
} from './helpers';
import { isGetLike, isGetVisitor, type CollectorEnv } from './types';
import { LIMITS } from '../../shared/constants';
import { runPool } from '../../downloader/pool';

/**
 * 日记（私密日志）采集器
 * 移植自 src/js/modules/diaries.js 的 API.Diaries.export 全流程（HTML渲染除外）
 * 结构与日志基本一致：列表字段为 total_num/titlelist，详情不处理模板日志
 */
export class DiariesCollector implements ModuleCollector {
    readonly module = 'Diaries';
    private static readonly PHASE_ORDER = ['list', 'contents', 'comments', 'likes', 'visitors', 'export'];

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const items = await env.loadStaging<BlogItem[]>(this.module);
        if (!items || items.length === 0) {
            env.logger.warn('日记 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('日记续传恢复：从 staging 加载 ' + items.length + ' 条');
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Diaries',
            globalName: 'diaries',
            data: items,
            jsonJsPath: 'Diaries/json/diaries.js',
            jsonFilePath: 'Diaries/json/diaries.json',
        });
        if (env.config.Diaries.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Diaries', items);
        }
        await env.report('export', 1, 1);
    }

    async collect(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Diaries;
        const registry = new MediaTaskRegistry(env, this.module);
        const cpPhase = _ctx.checkpoint?.phase || '';

        // ======== 逐页内联：列表枚举即主体进度，每页收完后立即处理该页明细 ========
        let items: BlogItem[];
        // 统一续传：list 是否完成以「是否仍在 list 阶段」判断，不依赖 PHASE_ORDER 比对
        // （避免 ORDER 不完整或 report 了不在 ORDER 的 phase 时 isPhaseDone 误判 list 未完 → 整段重拉）
        const listDone = cpPhase !== '' && cpPhase !== 'list';
        if (listDone) {
            items = (await env.loadStaging<BlogItem[]>(this.module)) || [];
            env.logger.info('日记续传：list 已完成，从 staging 恢复 ' + items.length + ' 条');

            // 续传恢复：对全量 items 重跑明细（skip guard 防重复）
            await this.collectContents(items, registry);
            await env.saveStaging(this.module, items);
            await this.collectComments(items, registry);
            await env.saveStaging(this.module, items);
        } else {
            items = await this.runCollection(_ctx, false);
        }

        // ======== 续传恢复：点赞 / 访问（skip guard 防重复） ========
        if (listDone) {
            const hasLike = isGetLike(cfg);
            const hasVisitor = isGetVisitor(cfg);
            if (hasLike) {
                await runPool(items, async (item) => {
                    if (!shouldCollectLikes(item)) return;
                    await collectLikes(env, item, cfg.Like, this.avatars);
                }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
            }
            if (hasVisitor) {
                await runPool(items, async (item) => {
                    if (!shouldCollectVisitors(item)) return;
                    item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                        diaryVisitors(env.ctx, env.config, String(item.blogid), idx),
                    );
                }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                await this.collectReadCounts(items);
            }
        } else {
            if (isGetVisitor(cfg)) {
                await this.collectReadCounts(items);
            }
        }

        // 导出数据文件
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Diaries',
            globalName: 'diaries',
            data: items,
            jsonJsPath: 'Diaries/json/diaries.js',
            jsonFilePath: 'Diaries/json/diaries.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Diaries', items);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 列表采集（含页级可靠性记账 + 运行内补偿）。
     * compensateOnly=true 时跳过正常枚举，只重采 ledger 中 failed/missing 页（手动重试用）。
     * 返回完整条目（staging 已采页 + 本次/补偿采集页）。
     */
    private async collectList(ctx: CollectContext, compensateOnly: boolean): Promise<BlogItem[]> {
        const env = this.env;
        const cfg = env.config.Diaries;
        const registry = new MediaTaskRegistry(env, this.module);
        const oldItems = (await env.getOldData<BlogItem[]>(this.module)) || [];
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);
        const hasLike = isGetLike(cfg);
        const hasVisitor = isGetVisitor(cfg);
        const staged = (await env.loadStaging<BlogItem[]>(this.module)) || [];
        const startPage = staged.length > 0 ? Math.ceil(staged.length / cfg.pageSize) : 0;
        if (!compensateOnly && startPage > 0) {
            env.logger.info('日记续传：list 未完成，从第 ' + startPage + ' 页继续');
        }
        return collectPagedList<BlogItem>({
            env,
            moduleCfg: cfg,
            oldItems,
            phase: 'list',
            startPage: compensateOnly ? 0 : startPage,
            initialItems: staged.length > 0 ? staged : undefined,
            afterPage: async (allItems, pageIndex, pageItems, pageOffset) => {
                // pageItems 已是本页精确子集（helpers 按 pageMap 槽位给出），不再用 slice(pi*pageSize) 反推
                const actuallyNew = pageItems.filter(isNewFilter);
                if (actuallyNew.length > 0) {
                    // 全文：传累计 allItems + 本页真实偏移区间 [pageOffset, pageOffset+pageItems.length)，
                    // 使 contents 进度与 list 同口径（累计条目数），且仅处理本页（不再 slice 到尾部放大）。
                    await this.collectContents(allItems, registry, pageOffset, pageOffset + pageItems.length);
                    await env.saveStaging(this.module, allItems);
                    // 评论（仅本页）
                    await this.collectComments(actuallyNew, registry);
                    if (hasLike) {
                        env.logger.info(`[明细并发] 日记点赞 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                        await runPool(actuallyNew, async (item) => {
                            if (!shouldCollectLikes(item)) return;
                            await collectLikes(env, item, cfg.Like, this.avatars);
                        }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                    }
                    if (hasVisitor) {
                        env.logger.info(`[明细并发] 日记访客 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                        await runPool(actuallyNew, async (item) => {
                            if (!shouldCollectVisitors(item)) return;
                            item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                                diaryVisitors(env.ctx, env.config, String(item.blogid), idx),
                            );
                        }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                    }
                    // 每页明细完成后保存 staging
                    await env.saveStaging(this.module, allItems);
                }
            },
            fetchPage: async (pageIndex) => {
                const call = diaryList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn('获取单页的日记列表异常 | code=' + res.code, res.msg || '');
                }
                const data = res.data || {};
                return { items: data.titlelist || [], total: data.total_num || 0 };
            },
            // 无 ledger 时跳过页级记账（测试环境 ctx 未注入 ledger 时 recordPage 不应崩溃）
            reliability: ctx.ledger ? { ledger: ctx.ledger, uin: String(ctx.uin), module: this.module, batchId: ctx.batchId } : undefined,
            compensateOnly,
        });
    }

    /** 列表采集 + 合并/排序/落盘（runCollection 的统一后处理；retry 复用） */
    private async runCollection(ctx: CollectContext, compensateOnly: boolean): Promise<BlogItem[]> {
        const env = this.env;
        const cfg = env.config.Diaries;
        const oldItems = (await env.getOldData<BlogItem[]>(this.module)) || [];
        let items = await this.collectList(ctx, compensateOnly);
        items = unionBackedUpItems(cfg, oldItems, items);
        items = sortBy(items, cfg.IncrementField, true);
        await env.saveStaging(this.module, items);
        return items;
    }

    /** 断点补偿：仅重采 ledger 中 failed/missing 页，完成后重新合并/导出 */
    async retryFailedPages(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Diaries;
        const items = await this.runCollection(ctx, true);
        if (isGetVisitor(cfg)) {
            await this.collectReadCounts(items);
        }
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Diaries',
            globalName: 'diaries',
            data: items,
            jsonJsPath: 'Diaries/json/diaries.js',
            jsonFilePath: 'Diaries/json/diaries.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Diaries', items);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 获取所有日记的内容（移植自 diaries.js getAllContents L52-115）
     */
    private async collectContents(items: BlogItem[], registry: MediaTaskRegistry, startIndex: number = 0, endIndex?: number): Promise<void> {
        const env = this.env;
        const cfg = env.config.Diaries;
        const end = endIndex ?? items.length;
        let done = startIndex;
        // 仅处理 [startIndex, end) 区间（本页），避免补偿时 slice 到尾部导致的放大重处理
        for (let index = startIndex; index < end; index++) {
            let item = items[index]!;
            if (!isNewItem(item)) {
                done++;
            } else {
                await env.tick();
                try {
                    const bid = item.blogid ?? item.blogId;
                    const call = diaryInfo(env.ctx, bid!);
                    const detailHtml = await env.requester.get(call.url, call.params, { charset: call.charset });

                    const result = await processBlogDetail(env, registry, item, detailHtml, 'Diaries/images', cfg.exportType, false);
                    if (result.detailItem) {
                        item = Object.assign(item, result.detailItem);
                    }
                    item.html = result.html;
                    item.custom_title = item.title;
                    item.custom_html = result.customHtml;
                    item.uniKey = getBlogUniKey(env.ctx.targetUin, (item.blogid ?? item.blogId)!);

                    // 下载日记正文里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
                    await registry.addEmoticons([item.content, item.custom_content, item.custom_html], item);

                    items[index] = item;
                } catch (error) {
                    env.logger.error(`获取日记内容异常 | 日志#${item.blogid ?? item.blogId}`, error instanceof Error ? error.message : String(error));
                    env.fail();
                }
                done++;
            }
            // 带 subject 上报：done/total 用累计条目数（与 list 同口径），
            // 使「获取正文」阶段进度能被主体对齐逻辑计入（min(list,contents)）。
            await env.report('contents', done, items.length, undefined, undefined, { done, total: items.length });
            // 每 5 条保存一次 staging（中途中断时已处理的条目不会丢失）
            if (done % 5 === 0) {
                await env.saveStaging(this.module, items);
            }
            if (isNewItem(item)) {
                await randomSleep(env, cfg.Info?.randomSeconds ?? cfg.randomSeconds);
            }
        }
    }

    /**
     * 获取所有日记的评论（移植自 diaries.js getItemsAllCommentList/getItemAllCommentList L208-304）
     */
    private async collectComments(items: BlogItem[], registry: MediaTaskRegistry, startIndex: number = 0): Promise<void> {
        const env = this.env;
        const commentsCfg = env.config.Diaries.Comments;
        if (!commentsCfg.isGet) {
            return;
        }
        let done = startIndex;
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i]!;
            if (!isNewItem(item)) {
                done++;
            } else {
                done++;
                item.comments = item.comments || [];
                // 预防日记无评论
                if ((item.replynum || 0) > item.comments.length) {
                    item.comments = [];
                    const total = item.replynum || 0;
                    let pageIndex = 0;
                    for (;;) {
                        await env.tick();
                        try {
                            const call = diaryComments(env.ctx, env.config, item.blogid!, pageIndex);
                            const text = await env.requester.get(call.url, call.params);
                            const res = toJson<any>(text, /^_Callback\(/);
                            if (res.code && res.code != 0) {
                                env.logger.warn(`获取单条日记的单页评论列表异常 | 日志#${item.blogid} | page=${pageIndex + 1} | code=${res.code}`, res.msg || '');
                            }
                            const data = res.data || {};
                            item.comments = unionItems(item.comments, data.comments || []);
                        } catch (error) {
                            env.logger.error(`获取日记评论列表异常 | 日志#${item.blogid} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                        }
                        pageIndex++;
                        if (!hasNextPage(pageIndex, commentsCfg.pageSize, total, item.comments!)) {
                            break;
                        }
                        await randomSleep(env, commentsCfg.randomSeconds);
                    }
                }
            }
            // 评论/评论回复文本里的 QQ 表情（与 MD/查看器对评论内容的表情转换一致）
            await addCommentEmotionTasks(registry, item.comments, item);
            // 登记评论用户头像下载
            if (this.avatars) {
                for (const comment of item.comments || []) {
                    if (comment.user?.uin) this.avatars.download({ uin: comment.user.uin });
                }
            }
            await env.report('comments', done, items.length);
        }
    }

    /**
     * 获取日记阅读数（移植自 diaries.js getAllReadCount L475-515）
     */
    private async collectReadCounts(items: BlogItem[]): Promise<void> {
        const env = this.env;
        try {
            for (let i = 0; i < items.length; i += 10) {
                const list = items.slice(i, i + 10);
                await env.tick();
                // 兼容 blogid / blogId 两种字段名；个别条目（草稿、特殊类型）可能缺 id，
                // 必须跳过，否则 blogIds.join('_') 会产生 "undefined" 触发接口“日志参数错误”。
                const batch: Array<{ id: number | string; item: BlogItem }> = [];
                let stopped = false;
                for (const item of list) {
                    if (!isNewItem(item)) {
                        // 列表由新到旧，遍历到旧项后均为旧数据
                        stopped = true;
                        break;
                    }
                    const id = item.blogId ?? item.blogid;
                    if (id === undefined) continue;
                    batch.push({ id, item });
                }
                if (batch.length > 0) {
                    const call = blogReadCount(
                        env.ctx,
                        batch.map((b) => b.id),
                    );
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn('获取日记阅读数异常 | code=' + res.code, res.msg || '');
                    }
                    const readList: any[] = (res.data || {}).itemList || [];
                    const idMaps = new Map<string, any>();
                    for (const read of readList) {
                        idMaps.set(String(read.id), read);
                    }
                    for (const { id, item } of batch) {
                        const read = idMaps.get(String(id));
                        if (read && item.custom_visitor) {
                            item.custom_visitor.viewCount = read.read || item.custom_visitor.viewCount;
                        }
                    }
                }
                if (stopped) {
                    break;
                }
            }
        } catch (error) {
            env.logger.error('获取日记阅读数异常', error instanceof Error ? error.message : String(error));
        }
    }
}
