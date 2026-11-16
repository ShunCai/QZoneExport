import { blogComments, blogInfo, blogList, blogReadCount, blogVisitors } from '../../qzone-api/clients';
import { hashString, toHttp, toJson, unionItems } from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import { getBlogLabel, processBlogDetail } from './blog-html';
import {
    addCommentEmotionTasks,
    AvatarTaskRegistry,
    buildOldItemFilter,
    collectItemVisitors,
    collectLikes,
    collectPagedList,
    forEachNewItemBatch,
    hasNextPage,
    MediaTaskRegistry,
    randomSleep,
    resolveMediaSuffix,
    writeModuleOutputs,
    shouldCollectLikes,
    shouldCollectVisitors,
} from './helpers';
import { isGetLike, isGetVisitor, type CollectorEnv } from './types';
import { LIMITS } from '../../shared/constants';
import { runPool } from '../../downloader/pool';

/**
 * 日志采集器
 * 移植自 src/js/modules/blogs.js 的 API.Blogs.export 全流程（HTML渲染除外）
 */

/** 日志条目 */
export interface BlogItem extends IncrementItem {
    blogId?: number | string;
    blogid?: number | string;
    title?: string;
    pubTime?: string;
    pubtime?: number;
    replynum?: number;
    comments?: any[];
    img?: any[];
    html?: string;
    custom_title?: string;
    custom_html?: string;
    custom_visitor?: { viewCount: number; totalNum: number; list: any[] };
    uniKey?: string;
    likes?: any[];
    likeTotal?: number;
    [key: string]: any;
}

/** 日志模块下载相对目录 */
const MODULE_DIR = 'Blogs/images';

/** 日志点赞Key（移植自 api.js Blogs.getUniKey L2594-2596） */
export function getBlogUniKey(targetUin: number, blogid: number | string): string {
    return `http://user.qzone.qq.com/${targetUin}/blog/${blogid}`;
}

/**
 * 日志自定义排序（置顶排前，同是置顶最新发表在前，非置顶最新发表在前）
 * 移植自 blogs.js sort（L702-723）
 */
export function sortBlogs(items: BlogItem[]): BlogItem[] {
    const compare = (obj1: BlogItem, obj2: BlogItem): number => {
        const isTop1 = getBlogLabel(obj1).indexOf('置顶') > -1;
        const isTop2 = getBlogLabel(obj2).indexOf('置顶') > -1;
        const time1 = obj1.pubTime ? new Date(obj1.pubTime).getTime() : obj1.pubtime!;
        const time2 = obj2.pubTime ? new Date(obj2.pubTime).getTime() : obj2.pubtime!;
        const res = time1 > time2 ? 1 : -1;
        if (isTop1 !== isTop2) {
            if (isTop1) {
                return -1;
            } else if (isTop2) {
                return 1;
            }
        }
        if (isTop1 && !isTop2) {
            return res;
        } else {
            return -res;
        }
    };
    return items.sort(compare);
}

export class BlogsCollector implements ModuleCollector {
    readonly module = 'Blogs';
    private static readonly PHASE_ORDER = ['list', 'contents', 'comments', 'likes', 'visitors', 'export'];

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const items = await env.loadStaging<BlogItem[]>(this.module);
        if (!items || items.length === 0) {
            env.logger.warn('日志 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('日志续传恢复：从 staging 加载 ' + items.length + ' 条');
        const registry = new MediaTaskRegistry(env, this.module);
        await this.handleListImages(items, registry);
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Blogs',
            globalName: 'blogs',
            data: items,
            jsonJsPath: 'Blogs/json/blogs.js',
            jsonFilePath: 'Blogs/json/blogs.json',
        });
        if (env.config.Blogs.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Blogs', items);
        }
        await env.report('export', 1, 1);
    }

    async collect(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Blogs;
        const registry = new MediaTaskRegistry(env, this.module);
        const cpPhase = _ctx.checkpoint?.phase || '';

        // ======== 逐页内联：列表枚举即主体进度，每页收完后立即处理该页明细 ========
        let items: BlogItem[];
        // 统一续传：list 是否完成以「是否仍在 list 阶段」判断，不依赖 PHASE_ORDER 比对
        const listDone = cpPhase !== '' && cpPhase !== 'list';
        if (listDone) {
            items = (await env.loadStaging<BlogItem[]>(this.module)) || [];
            env.logger.info('日志续传：list 已完成，从 staging 恢复 ' + items.length + ' 条');

            // 续传恢复：对全量 items 重跑明细（skip guard 防重复处理已完成条目）
            await this.handleListImages(items, registry);
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
                        blogVisitors(env.ctx, env.config, String(item.blogid), idx),
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
            module: 'Blogs',
            globalName: 'blogs',
            data: items,
            jsonJsPath: 'Blogs/json/blogs.js',
            jsonFilePath: 'Blogs/json/blogs.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Blogs', items);
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
        const cfg = env.config.Blogs;
        const registry = new MediaTaskRegistry(env, this.module);
        const oldItems = (await env.getOldData<BlogItem[]>(this.module)) || [];
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);
        const hasLike = isGetLike(cfg);
        const hasVisitor = isGetVisitor(cfg);
        const staged = (await env.loadStaging<BlogItem[]>(this.module)) || [];
        const startPage = staged.length > 0 ? Math.ceil(staged.length / cfg.pageSize) : 0;
        if (!compensateOnly && startPage > 0) {
            env.logger.info('日志续传：list 未完成，从第 ' + startPage + ' 页继续');
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

                // 摘要图片下载
                await this.handleListImages(actuallyNew, registry);
                // 全文（详情页解析，只处理新条目；内部 saveStaging 会覆盖为子集，处理完立即恢复）
                // 传累计 allItems + 本页真实偏移区间 [pageOffset, pageOffset+pageItems.length)，
                // 使 contents 进度与 list 同口径（累计条目数），且仅处理本页（不再 slice 到尾部放大）。
                await this.collectContents(allItems, registry, pageOffset, pageOffset + pageItems.length);
                await env.saveStaging(this.module, allItems);
                // 评论
                await this.collectComments(actuallyNew, registry);
                // 点赞（限流并发）
                if (hasLike) {
                    env.logger.info(`[明细并发] 日志点赞 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await runPool(actuallyNew, async (item) => {
                        if (!shouldCollectLikes(item)) return;
                        await collectLikes(env, item, cfg.Like, this.avatars);
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                }
                // 访问量（限流并发）
                if (hasVisitor) {
                    env.logger.info(`[明细并发] 日志访客 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await runPool(actuallyNew, async (item) => {
                        if (!shouldCollectVisitors(item)) return;
                        item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                            blogVisitors(env.ctx, env.config, String(item.blogid), idx),
                        );
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                }
                // 每页明细完成后保存 staging
                await env.saveStaging(this.module, allItems);
            },
            fetchPage: async (pageIndex) => {
                const call = blogList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn('获取日志列表异常 | code=' + res.code, res.msg || '');
                }
                const data = res.data || {};
                return { items: data.list || [], total: data.totalNum || 0 };
            },
            // 无 ledger 时跳过页级记账（测试环境 ctx 未注入 ledger 时 recordPage 不应崩溃）
            reliability: ctx.ledger ? { ledger: ctx.ledger, uin: String(ctx.uin), module: this.module, batchId: ctx.batchId } : undefined,
            compensateOnly,
        });
    }

    /** 列表采集 + 合并/排序/落盘（runCollection 的统一后处理；retry 复用） */
    private async runCollection(ctx: CollectContext, compensateOnly: boolean): Promise<BlogItem[]> {
        const env = this.env;
        const cfg = env.config.Blogs;
        const oldItems = (await env.getOldData<BlogItem[]>(this.module)) || [];
        let items = await this.collectList(ctx, compensateOnly);
        items = unionBackedUpItems(cfg, oldItems, items);
        items = sortBlogs(items);
        await env.saveStaging(this.module, items);
        return items;
    }

    /** 断点补偿：仅重采 ledger 中 failed/missing 页，完成后重新合并/导出 */
    async retryFailedPages(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Blogs;
        const items = await this.runCollection(ctx, true);
        if (isGetVisitor(cfg)) {
            await this.collectReadCounts(items);
        }
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Blogs',
            globalName: 'blogs',
            data: items,
            jsonJsPath: 'Blogs/json/blogs.js',
            jsonFilePath: 'Blogs/json/blogs.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Blogs', items);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 处理日志列表的摘要图片（移植自 blogs.js handerListImages L524-550）
     */
    private async handleListImages(items: BlogItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        if (env.config.Blogs.exportType !== 'HTML' || registry.isQzoneUrl()) {
            // 非HTML备份、QQ空间外链，无需处理列表图片（摘要统一采集，不再按 viewType 门控）
            return;
        }
        // 列表由新到旧：先截取「新项」前缀，等价于原「遍历到首个旧项即 break」的语义（旧项都在尾部）。
        const newItems: BlogItem[] = [];
        for (const item of items) {
            if (!isNewItem(item)) break;
            newItems.push(item);
        }
        // 并发登记摘要图片：耗时在 resolveMediaSuffix 的 MIME 探测，串行逐张叠加。
        const concurrency = (env.config.Common as any)?.suffixProbeConcurrency ?? LIMITS.SUFFIX_PROBE_CONCURRENCY;
        await runPool(newItems, async (item) => {
            for (const image of item.img || []) {
                // 图片地址
                const url = toHttp(image.url);

                // 添加下载任务
                const uid = hashString(url);
                const suffix = await resolveMediaSuffix(url, env);
                const customFilename = uid + suffix;
                registry.newTask(url, MODULE_DIR, customFilename, item);

                // 备份的显示地址（统一为根相对路径，与 custom_filepath 约定一致）
                image.custom_url = MODULE_DIR + '/' + customFilename;
            }
        }, { concurrency });
    }

    /**
     * 获取所有日志的内容（移植自 blogs.js getAllContents L54-126）
     */
    private async collectContents(items: BlogItem[], registry: MediaTaskRegistry, startIndex: number = 0, endIndex?: number): Promise<void> {
        const env = this.env;
        const cfg = env.config.Blogs;
        const end = endIndex ?? items.length;
        let done = startIndex;
        // 仅处理 [startIndex, end) 区间（本页），避免补偿时 slice 到尾部导致的放大重处理
        for (let index = startIndex; index < end; index++) {
            let item = items[index]!;
            // 断点续传：已有正文的条目跳过（staging 恢复的已处理项）
            if (item.custom_html) {
                done++;
                continue;
            }
            if (!isNewItem(item)) {
                // 已备份数据计为已成功处理
                done++;
            } else {
                await env.tick();
                try {
                const call = blogInfo(env.ctx, item.blogId ?? item.blogid!);
                // 详情页为 GBK 系编码，按接口声明的 charset 解码，否则标题与正文全乱码
                const detailHtml = await env.requester.get(call.url, call.params, { charset: call.charset });

                // 解析详情页（详情数据/正文/图片/视频）
                const result = await processBlogDetail(env, registry, item, detailHtml, MODULE_DIR, cfg.exportType, true);
                if (result.detailItem) {
                    item = Object.assign(item, result.detailItem);
                }
                item.html = result.html;
                // 更改自定义标题
                item.custom_title = item.title;
                // 添加自定义HTML
                item.custom_html = result.customHtml;
                // 添加点赞Key
                item.uniKey = getBlogUniKey(env.ctx.targetUin, item.blogid ?? item.blogId!);

                // 下载日志正文里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
                await registry.addEmoticons([item.content, item.custom_content, item.custom_html], item);

                items[index] = item;
            } catch (error) {
                env.logger.error(`获取日志内容异常 | 日志#${item.blogid}`, error instanceof Error ? error.message : String(error));
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
            // 等待一下再请求
            if (isNewItem(item)) {
                await randomSleep(env, cfg.Info?.randomSeconds ?? cfg.randomSeconds);
            }
        }
    }

    /**
     * 获取所有日志的评论（移植自 blogs.js getItemsAllCommentList/getItemAllCommentList L222-318）
     */
    private async collectComments(items: BlogItem[], registry: MediaTaskRegistry, startIndex: number = 0): Promise<void> {
        const env = this.env;
        const commentsCfg = env.config.Blogs.Comments;
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
                // 预防日志无评论
                item.comments = item.comments || [];
                if ((item.replynum || 0) > item.comments.length) {
                    // 当前列表比评论总数小的时候才需要获取全部评论
                    item.comments = [];
                    const total = item.replynum || 0;
                    let pageIndex = 0;
                    for (;;) {
                        await env.tick();
                        try {
                            const call = blogComments(env.ctx, env.config, item.blogid!, pageIndex);
                            const text = await env.requester.get(call.url, call.params);
                            const res = toJson<any>(text, /^_Callback\(/);
                            if (res.code && res.code != 0) {
                                env.logger.warn(`获取单条日志的单页评论列表异常 | 日志#${item.blogid} | page=${pageIndex + 1} | code=${res.code}`, res.msg || '');
                            }
                            const data = res.data || {};
                            item.comments = unionItems(item.comments, data.comments || []);
                        } catch (error) {
                            env.logger.error(`获取日志评论列表异常 | 日志#${item.blogid} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
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
     * 获取日志阅读数（移植自 blogs.js getAllReadCount L893-934）
     */
    private async collectReadCounts(items: BlogItem[]): Promise<void> {
        const env = this.env;
        try {
            // 分批请求，每批10条
            for (let i = 0; i < items.length; i += 10) {
                const list = items.slice(i, i + 10);
                await env.tick();

                // 日志ID数组（遍历到旧项即停止，后续均为已备份数据）
                // 兼容 blogid / blogId 两种字段名；个别条目（草稿、特殊类型）可能缺 id，
                // 必须跳过，否则 blogIds.join('_') 会产生 "undefined" 触发接口“日志参数错误”。
                const batch: Array<{ id: number | string; item: BlogItem }> = [];
                let stopped = false;
                for (const item of list) {
                    if (!isNewItem(item)) {
                        stopped = true;
                        break;
                    }
                    const id = item.blogId ?? item.blogid;
                    if (id === undefined) continue;
                    batch.push({ id, item });
                }
                if (batch.length > 0) {
                    // 单独获取日志的阅读数
                    const call = blogReadCount(
                        env.ctx,
                        batch.map((b) => b.id),
                    );
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn('获取日志阅读数异常 | code=' + res.code, res.msg || '');
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
                await env.report('visitors', items.length, items.length);
            }
        } catch (error) {
            env.logger.error('获取日志阅读数异常', error instanceof Error ? error.message : String(error));
        }
    }
}
