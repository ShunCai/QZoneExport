import {
    lbsInfo,
    messageComments,
    messageFullContent,
    messageImageInfos,
    messageList,
    messageVisitors,
    messageVoiceInfo,
    toTxLbs,
} from '../../qzone-api/clients';
import { formatDate, getCommentCount, sortBy, toJson, unionItems } from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import {
    AvatarTaskRegistry,
    addCommentImageTasks,
    buildOldItemFilter,
    collectItemVisitors,
    collectLikes,
    collectPagedList,
    hasNextPage,
    MediaTaskRegistry,
    randomSleep,
    writeModuleOutputs,
} from './helpers';
import { addVideoTasks } from './video-tasks';
import { isGetLike, isGetVisitor, type CollectorEnv } from './types';
import type { CommentRecord, LikeRecord, MessageMediaItem, MessageVisitorSummary, PhotoLocation } from './models';
import { LIMITS } from '../../shared/constants';
import { runPool } from '../../downloader/pool';

/**
 * 说说采集器
 * 移植自 src/js/modules/messages.js 的 API.Messages.export 全流程，
 * 不含HTML渲染（Viewer SPA已替代）；进度经 env.report 上报，暂停/取消经 env.tick 响应
 */

/** 说说条目（接口原始字段 + custom_* 加工字段，形状与旧版备份数据一致） */
export interface MessageItem extends IncrementItem {
    tid: string;
    content?: string;
    conlist?: CommentRecord[];
    created_time?: number;
    has_more_con?: number;
    rt_tid?: string;
    rt_con?: unknown;
    rt_has_more_con?: number;
    commentlist?: CommentRecord[];
    commenttotal?: number;
    custom_content?: string;
    custom_comments?: CommentRecord[];
    custom_images?: MessageMediaItem[];
    custom_voices?: MessageMediaItem[];
    custom_audios?: MessageMediaItem[];
    custom_magics?: MessageMediaItem[];
    custom_videos?: MessageMediaItem[];
    custom_visitor?: MessageVisitorSummary;
    custom_create_time?: string;
    custom_lbsInfo?: unknown;
    imagetotal?: number;
    pictotal?: number;
    pic?: MessageMediaItem[];
    voice?: MessageMediaItem[];
    voicetotal?: number;
    audio?: MessageMediaItem[];
    audiototal?: number;
    magic?: MessageMediaItem[];
    magictotal?: number;
    video?: MessageMediaItem[];
    videototal?: number;
    lbs?: PhotoLocation;
    uniKey?: string;
    likes?: LikeRecord[];
    likeTotal?: number;
    [key: string]: unknown;
}

/** 说说模块下载相对目录 */
const MODULE_DIR = 'Messages/images';

/** 说说点赞Key（移植自 api.js Messages.getUniKey L3167-3169） */
function getUniKey(targetUin: number, tid: string): string {
    return `http://user.qzone.qq.com/${targetUin}/mood/${tid}`;
}

/**
 * 判断详情/转发是否还有更多内容（接口可能返回数字 1、字符串 "1" 或布尔 true）
 * 不能只用 === 1，否则会漏掉长说说导致正文保持截断
 */
function hasMoreCon(value: unknown): boolean {
    return value === 1 || value === true || value === '1';
}

/**
 * 转换接口数据（移植自 messages.js convert L801-855）
 */
export function convertMessages(items: MessageItem[], targetUin: number): MessageItem[] {
    items = items || [];
    for (const item of items) {
        // 内容
        item.custom_content = item.content;
        item.conlist = item.conlist || [];

        // 评论
        item.commenttotal = getCommentCount(item);
        item.custom_comments = item.commentlist || [];

        // 配图
        item.imagetotal = item.pictotal || 0;
        item.custom_images = item.pic || [];

        // 语音
        item.voicetotal = item.voicetotal || 0;
        item.custom_voices = item.voice || [];

        // 音乐
        item.audiototal = item.audiototal || 0;
        item.custom_audios = item.audio || [];

        // 特殊动漫表情
        item.magictotal = item.magictotal || 0;
        item.custom_magics = item.magic || [];
        for (const magic of item.custom_magics) {
            const match = String(magic.url1 || '').match(/\{"\$type":"magicEmoticon","id":(\d+)\}/);
            if (match) {
                magic.custom_url = `http://qzonestyle.gtimg.cn/qzone/em/120/mb${match[1]}.jpg`;
            }
        }

        // 视频
        item.videototal = item.videototal || 0;
        item.custom_videos = item.video || [];
        for (const video of item.custom_videos) {
            // 处理异常数据的视频URL
            video.video_id = video.video_id || '';
            video.video_id = video.video_id.replace('http://v.qq.com/', '');
        }

        // 位置
        item.lbs = item.lbs || {};

        // 创建时间
        item.custom_create_time = formatDate(item.created_time as number);

        // 添加点赞Key
        item.uniKey = getUniKey(targetUin, item.tid);
    }
    return items;
}

/** 预编译屏蔽词正则，避免每条说说重复编译（按数组引用缓存） */
const filterKeyWordCache = new WeakMap<object, RegExp[][]>();

function compileFilterKeyWords(filterKeyWords: string[]): RegExp[][] {
    const cached = filterKeyWordCache.get(filterKeyWords);
    if (cached) {
        return cached;
    }
    const compiled = filterKeyWords.map(keyWord =>
        keyWord.split('&&').map(key => new RegExp(key, 'ig'))
    );
    filterKeyWordCache.set(filterKeyWords, compiled);
    return compiled;
}

/** 说说内容是否包含指定屏蔽词（移植自 messages.js isMatchFilterKey L861-878） */
export function isMatchFilterKey(content: string, filterKeyWords: string[]): boolean {
    const compiled = compileFilterKeyWords(filterKeyWords);
    for (const regexes of compiled) {
        let matchCount = 0;
        for (const regex of regexes) {
            if ((content || '').match(regex)) {
                matchCount++;
            }
        }
        if (matchCount === regexes.length) {
            return true;
        }
    }
    return false;
}

/** 过滤含屏蔽词的说说（移植自 messages.js filterKeyWords L884-907） */
export function filterKeyWords(items: MessageItem[], cfg: { isFilterKeyword: boolean; FilterKeyWords: string[] }): MessageItem[] {
    if (!cfg.isFilterKeyword || cfg.FilterKeyWords.length === 0) {
        return items;
    }
    for (let i = items.length - 1; i >= 0; i--) {
        if (isMatchFilterKey(items[i]!.custom_content || '', cfg.FilterKeyWords)) {
            items.splice(i, 1);
        }
    }
    return items;
}

/** 处理特殊坐标数据，避免地图跳转错误（移植自 messages.js dealLbs L1072-1089） */
export function dealLbs(items: MessageItem[]): void {
    for (const item of items) {
        const lbs = item.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        // 特殊坐标处理
        if (Number.parseInt(String(lbs.pos_x)) > 1000000) {
            lbs.pos_x = lbs.pos_x / 1000000;
        }
        if (Number.parseInt(String(lbs.pos_y)) > 1000000) {
            lbs.pos_y = lbs.pos_y / 1000000;
        }
        // 科学计数法处理
        lbs.pos_x = Number(Number.parseFloat(String(lbs.pos_x)).toString()) * 1;
        lbs.pos_y = Number(Number.parseFloat(String(lbs.pos_y)).toString()) * 1;
    }
}

/** 是否微信同步的说说（移植自 api.js isWeChat L3453-3455） */
function isWeChat(item: MessageItem): boolean {
    return item.t1_source === 1 && item.t1_subtype === 29;
}

export class MessagesCollector implements ModuleCollector {
    readonly module = 'Messages';

    /** 说说模块的阶段顺序（断点续传用；明细阶段已逐页内联到列表阶段） */
    private static readonly PHASE_ORDER = ['list', 'export'];

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    /**
     * 断点续传：从 staging 恢复已采集数据，只注册媒体任务 + 写导出文件，不请求网络
     */
    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const items = await env.loadStaging<MessageItem[]>(this.module);
        if (!items || items.length === 0) {
            // staging 丢失，回退全量采集
            env.logger.warn('说说 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('说说续传恢复：从 staging 加载 ' + items.length + ' 条，跳过网络请求');
        const registry = new MediaTaskRegistry(env, this.module);
        await env.report('media', 0, items.length);
        await this.addMediaToTasks(items, registry);
        await this.addCommentMediaToTasks(items, registry);
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Messages',
            globalName: 'messages',
            data: items,
            jsonJsPath: 'Messages/json/messages.js',
            jsonFilePath: 'Messages/json/messages.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    async collect(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Messages;
        const registry = new MediaTaskRegistry(env, this.module);
        const cpPhase = _ctx.checkpoint?.phase || '';

        // 上次备份数据（增量合并用）
        const oldItems = (await env.getOldData<MessageItem[]>(this.module)) || [];
        // 全量备份忽略旧数据，所有条目都重新采集明细；仅增量/上次/自定义才按旧数据过滤
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);

        // ======== 逐页内联：列表枚举即主体进度，每页收完后立即处理该页明细 ========
        let items: MessageItem[];
        // 统一续传：list 是否完成以「是否仍在 list 阶段」判断，不依赖 PHASE_ORDER 比对
        // （messages 的 PHASE_ORDER 仅含 list/export，内联采评论/访客时 report 了不在 ORDER 的 phase，
        //  旧 isPhaseDone 比对会误判 list 未完 → 整段重拉；新判据只看是否仍在 list 阶段）
        const listDone = cpPhase !== '' && cpPhase !== 'list';
        if (listDone) {
            // 断点续传：list 已完成，从 staging 恢复
            items = (await env.loadStaging<MessageItem[]>(this.module)) || [];
            env.logger.info('说说续传：list 已完成，从 staging 恢复 ' + items.length + ' 条');

            // 续传恢复：对全量 items 重跑明细（skip guard 防重复处理已完成条目）
            await this.collectFullContents(items);
            await this.collectMoreImages(items);
            await this.collectVoices(items);
            await this.addMediaToTasks(items, registry);
            await this.collectComments(items, registry);
            await this.addCommentMediaToTasks(items, registry);
            await env.saveStaging(this.module, items);
        } else {
            items = await this.runCollection(_ctx, false);
        }

        // ======== 续传恢复：点赞 / 访问（skip guard 防重复） ========
        const hasLike = isGetLike(cfg);
        const hasVisitor = isGetVisitor(cfg);
        if (listDone) {
            if (hasLike) {
                await runPool(items, async (item) => {
                    if (item.likes !== undefined) return;
                    await collectLikes(env, item, cfg.Like, this.avatars);
                }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
            }
            if (hasVisitor) {
                await runPool(items, async (item) => {
                    if (item.custom_visitor !== undefined) return;
                    item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                        messageVisitors(env.ctx, env.config, item.tid, idx),
                        this.avatars);
                }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
            }
        }

        // 处理坐标数据（依赖所有条目已采集完毕）
        await env.report('location', 0, items.length);
        dealLbs(items);
        await this.refreshWeChatLbsInfo(items);
        await env.report('location', items.length, items.length);

        // 导出数据文件（Viewer读取 json/messages.js；JSON导出额外生成汇总文件）
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Messages',
            globalName: 'messages',
            data: items,
            jsonJsPath: 'Messages/json/messages.js',
            jsonFilePath: 'Messages/json/messages.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 列表采集（含页级可靠性记账 + 运行内补偿）。
     * compensateOnly=true 时跳过正常枚举，只重采 ledger 中 failed/missing 页（手动重试用）。
     * 返回完整条目（staging 已采页 + 本次/补偿采集页）。
     */
    private async collectList(ctx: CollectContext, compensateOnly: boolean): Promise<MessageItem[]> {
        const env = this.env;
        const cfg = env.config.Messages;
        const registry = new MediaTaskRegistry(env, this.module);
        const oldItems = (await env.getOldData<MessageItem[]>(this.module)) || [];
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);
        const hasLike = isGetLike(cfg);
        const hasVisitor = isGetVisitor(cfg);
        const staged = (await env.loadStaging<MessageItem[]>(this.module)) || [];
        const startPage = staged.length > 0 ? Math.ceil(staged.length / cfg.pageSize) : 0;
        return collectPagedList<MessageItem>({
            env,
            moduleCfg: cfg,
            oldItems,
            phase: 'list',
            startPage: compensateOnly ? 0 : startPage,
            initialItems: staged.length > 0 ? staged : undefined,
            afterPage: async (allItems, pageIndex, pageItems, pageOffset) => {
                // pageItems 已是本页精确子集（helpers 按 pageMap 槽位给出），不再用 slice(pi*pageSize) 反推
                const actuallyNew = pageItems.filter(isNewFilter);
                // 诊断：分步骤计时，定位单页明细处理到底卡在哪一步（接口慢/重试 vs staging 写放大 vs 媒体登记）
                const cost: Record<string, number> = {};
                const step = async (name: string, fn: () => Promise<void>): Promise<void> => {
                    const t = Date.now();
                    await fn();
                    cost[name] = Date.now() - t;
                };
                await step('全文', () => this.collectFullContents(actuallyNew));
                await step('staging', () => env.saveStaging(this.module, allItems));
                await step('更多图', () => this.collectMoreImages(actuallyNew));
                await step('语音', () => this.collectVoices(actuallyNew));
                await step('媒体登记', () => this.addMediaToTasks(actuallyNew, registry));
                await step('评论', () => this.collectComments(actuallyNew, registry));
                await step('评论媒体', () => this.addCommentMediaToTasks(actuallyNew, registry));
                if (hasLike) {
                    // 限流并发，避免单页条目裸 Promise.all 打爆接口；诊断日志打印并发扇出数
                    env.logger.info(`[明细并发] 点赞 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await step('点赞', () => runPool(actuallyNew, async (item) => {
                        if (item.likes !== undefined) return;
                        await collectLikes(env, item, cfg.Like, this.avatars);
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY }));
                }
                if (hasVisitor) {
                    env.logger.info(`[明细并发] 访客 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await step('访客', () => runPool(actuallyNew, async (item) => {
                        if (item.custom_visitor !== undefined) return;
                        item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                            messageVisitors(env.ctx, env.config, item.tid, idx), this.avatars);
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY }));
                }
                await step('staging2', () => env.saveStaging(this.module, allItems));
                env.logger.info(
                    `[明细耗时] page=${pageIndex} | 全文=${cost['全文']}ms staging=${cost['staging']}ms 更多图=${cost['更多图']}ms ` +
                    `语音=${cost['语音']}ms 媒体登记=${cost['媒体登记']}ms 评论=${cost['评论']}ms 评论媒体=${cost['评论媒体']}ms ` +
                    `点赞=${cost['点赞'] ?? '-'}ms 访客=${cost['访客'] ?? '-'}ms staging2=${cost['staging2']}ms`,
                );
            },
            fetchPage: async (pageIndex) => {
                const call = messageList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const data = toJson<any>(text, /^_preloadCallback\(/);
                if (data.code && data.code != 0) {
                    env.logger.warn('获取单页的说说列表异常 | code=' + data.code, data.msg || '');
                }
                if (!data.msglist || data.msglist.length === 0) {
                    return { items: [], total: data.total || 0 };
                }
                return { items: convertMessages(data.msglist, env.ctx.targetUin), total: data.total || 0 };
            },
            // 无 ledger 时跳过页级记账（测试环境 ctx 未注入 ledger 时 recordPage 不应崩溃）
            reliability: ctx.ledger ? { ledger: ctx.ledger, uin: String(ctx.uin), module: this.module, batchId: ctx.batchId } : undefined,
            compensateOnly,
        });
    }

    /** 列表采集 + 合并/排序/过滤/落盘（runCollection 的统一后处理；retry 复用） */
    private async runCollection(ctx: CollectContext, compensateOnly: boolean): Promise<MessageItem[]> {
        const env = this.env;
        const cfg = env.config.Messages;
        const oldItems = (await env.getOldData<MessageItem[]>(this.module)) || [];
        let items = await this.collectList(ctx, compensateOnly);
        items = unionBackedUpItems(cfg, oldItems, items);
        items = sortBy(items, cfg.IncrementField, true);
        items = filterKeyWords(items, cfg);
        await env.saveStaging(this.module, items);
        return items;
    }

    /** 断点补偿：仅重采 ledger 中 failed/missing 页，完成后重新合并/导出 */
    async retryFailedPages(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Messages;
        const oldItems = (await env.getOldData<MessageItem[]>(this.module)) || [];
        const items = await this.runCollection(ctx, true);
        await env.report('location', 0, items.length);
        dealLbs(items);
        await this.refreshWeChatLbsInfo(items);
        await env.report('location', items.length, items.length);
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Messages',
            globalName: 'messages',
            data: items,
            jsonJsPath: 'Messages/json/messages.js',
            jsonFilePath: 'Messages/json/messages.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 获取所有说说的全文内容（移植自 messages.js getAllFullContent L155-213）
     */
    private async collectFullContents(items: MessageItem[], startIndex: number = 0): Promise<void> {
        const env = this.env;
        let done = startIndex;
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i]!;
            await env.tick();
            // 是否有全文（长说说在列表接口里会被截断，需再请求详情接口取全文）
            const hasMoreContent = hasMoreCon(item.has_more_con) || hasMoreCon(item.rt_has_more_con);
            if (hasMoreContent && isNewItem(item)) {
                try {
                    const call = messageFullContent(env.ctx, item.tid);
                    const text = await env.requester.get(call.url, call.params);
                    const data = toJson<any>(text, /^_Callback\(/);
                    if (data.code && data.code != 0) {
                        env.logger.warn(`获取所有说说的全文内容异常 | tid=${item.tid} | code=${data.code}`, data.msg || '');
                    }
                    // 自身全文（仅当确实返回正文时才覆盖，避免异常响应把正文清空）
                    if (typeof data.content === 'string') {
                        item.content = data.content;
                        item.custom_content = data.content;
                        // 已取到全文，清零标记，断点续传/增量回刷时不再重复请求
                        item.has_more_con = 0;
                    }
                    if (Array.isArray(data.conlist)) {
                        item.conlist = data.conlist;
                    }
                    // 转发全文
                    if (item.rt_tid && data.rt_con !== undefined) {
                        item.rt_con = data.rt_con;
                        item.rt_has_more_con = 0;
                    }
                } catch (error) {
                    env.logger.error(`获取说说自身全文异常 | tid=${item.tid}`, error instanceof Error ? error.message : String(error));
                    env.fail();
                }
                done++;
            } else {
                // 无全文内容或已备份数据，计为已成功处理
                done++;
            }
            await env.report('full-content', done, items.length);
            // 每 10 条保存一次 staging（中途中断时已处理的条目不会丢失）
            if (done % 10 === 0) {
                await env.saveStaging(this.module, items);
            }
        }
    }

    /**
     * 获取超9张的更多图片（移植自 messages.js getAllImages L676-742）
     */
    private async collectMoreImages(items: MessageItem[], startIndex: number = 0): Promise<void> {
        const env = this.env;
        let done = startIndex;
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i]!;
            if (!isNewItem(item)) {
                done++;
            } else {
                const images = item.custom_images || [];
                // 图片总数大于实际数时才获取更多图片
                if ((item.imagetotal || 0) > images.length) {
                    await env.tick();
                    try {
                        const call = messageImageInfos(env.ctx, item.tid);
                        const text = await env.requester.get(call.url, call.params);
                        const data = toJson<any>(text, /^_Callback\(/);
                        if (data.code && data.code != 0) {
                            env.logger.warn(`获取所有图片异常 | tid=${item.tid} | code=${data.code}`, data.msg || '');
                        }
                        const imageUrls: string[] = data.imageUrls || [];
                        for (let idx = 0; idx < imageUrls.length; idx++) {
                            const url = imageUrls[idx]!;
                            const oldImage = images[idx];
                            if (oldImage) {
                                oldImage.url1 = url;
                                oldImage.url2 = url;
                                oldImage.url3 = url;
                            } else {
                                images.push({ url1: url, url2: url, url3: url });
                            }
                        }
                    } catch (error) {
                        env.logger.error(`获取说说更多图片异常 | tid=${item.tid}`, error instanceof Error ? error.message : String(error));
                        env.fail();
                    }
                }
                done++;
            }
            await env.report('more-images', done, items.length);
        }
    }

    /**
     * 获取语音说说的实际地址（移植自 messages.js getAllVoices L748-795）
     */
    private async collectVoices(items: MessageItem[], startIndex: number = 0): Promise<void> {
        const env = this.env;
        if (!env.config.Messages.GetVoice) {
            return;
        }
        let done = startIndex;
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i]!;
            if (!isNewItem(item)) {
                done++;
                continue;
            }
            const voices = item.custom_voices || [];
            if (voices.length === 0) {
                done++;
                continue;
            }
            await env.tick();
            for (const voice of voices) {
                try {
                    const call = messageVoiceInfo(voice.url!);
                    const text = await env.requester.get(call.url, call.params);
                    const voiceInfo = toJson<any>(text, /^_Callback\(/);
                    if (voiceInfo.code < 0) {
                        env.logger.warn(`获取语音说说的实际地址异常 | tid=${item.tid} | code=${voiceInfo.code}`, voiceInfo.msg || '');
                    }
                    voice.custom_url = (voiceInfo.data || {}).url;
                } catch (error) {
                    env.logger.error(`获取说说语音失败 | tid=${item.tid}`, error instanceof Error ? error.message : String(error));
                    env.fail();
                }
            }
            done++;
            await env.report('voices', done, items.length);
        }
    }

    /**
     * 获取所有说说的评论（移植自 messages.js getItemsAllCommentList/getItemAllCommentList L220-339）
     */
    private async collectComments(items: MessageItem[], registry: MediaTaskRegistry, startIndex: number = 0): Promise<void> {
        const env = this.env;
        const commentsCfg = env.config.Messages.Comments;
        if (!commentsCfg.isGet) {
            return;
        }
        let done = startIndex;
        for (let i = startIndex; i < items.length; i++) {
            const item = items[i]!;
            if (!isNewItem(item)) {
                // 已备份数据计为已成功处理
                done++;
            } else {
                done++;
                item.custom_comments = item.custom_comments || [];
                if ((item.commenttotal || 0) > item.custom_comments.length) {
                    // 当前列表比评论总数小的时候才需要获取全部评论
                    item.custom_comments = [];
                    const total = getCommentCount(item as any);
                    let pageIndex = 0;
                    for (;;) {
                        await env.tick();
                        try {
                            const call = messageComments(env.ctx, env.config, item.tid, pageIndex);
                            const text = await env.requester.get(call.url, call.params);
                            const data = toJson<any>(text, /^_Callback\(/);
                            if (data.code && data.code != 0) {
                                env.logger.warn(`获取单条说说的单页评论列表异常 | tid=${item.tid} | page=${pageIndex + 1} | code=${data.code}`, data.msg || '');
                            }
                            const comments: CommentRecord[] = data.commentlist || (data.data && data.data.comments) || [];
                            for (const comment of comments) {
                                for (const image of comment.pic || []) {
                                    await registry.add(image, image.hd_url || image.b_url, MODULE_DIR, item);
                                }
                                for (const reply of comment.list_3 || []) {
                                    for (const image of reply.pic || []) {
                                        await registry.add(image, image.hd_url || image.b_url, MODULE_DIR, item);
                                    }
                                }
                            }
                            item.custom_comments = unionItems(item.custom_comments, comments);
                        } catch (error) {
                            env.logger.error(`获取说说评论列表异常 | tid=${item.tid} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                        }
                        pageIndex++;
                        if (!hasNextPage(pageIndex, commentsCfg.pageSize, total, item.custom_comments)) {
                            break;
                        }
                        await randomSleep(env, commentsCfg.randomSeconds);
                    }
                }
            }
            await env.report('comments', done, items.length);
        }
    }

    /**
     * 添加说说多媒体下载任务（移植自 messages.js addMediaToTasks L600-670）
     */
    private async addMediaToTasks(items: MessageItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        let done = 0;
        await env.report('media', 0, items.length);
        // 并发登记媒体：真正的耗时在 resolveMediaSuffix 的 MIME 探测（对图片 CDN 发 GET 读 content-type），
        // 串行时每条约 0.5~1s 逐条叠加；并发后整页从 20s 级压到 1~2s。
        const concurrency = (env.config.Common as any)?.suffixProbeConcurrency ?? LIMITS.SUFFIX_PROBE_CONCURRENCY;
        await runPool(items, async (item) => {
            if (isNewItem(item)) {
                // 下载说说配图（说说同时包含图片与视频时，需单独处理视频）
                for (const image of item.custom_images || []) {
                    if (image.is_video && image.video_info) {
                        // 视频（外部视频不做处理，本地视频登记下载任务）
                        await addVideoTasks(env, registry, [image.video_info], MODULE_DIR, item);
                    } else {
                        // 普通图片
                        await registry.add(image, (image.url2 || image.url1) as string, MODULE_DIR, item);
                    }
                }

                // 下载视频预览图及视频
                await addVideoTasks(env, registry, item.custom_videos || [], MODULE_DIR, item);

                // 下载音乐预览图（预览图不识别后缀，直接使用JPEG）
                for (const audio of item.custom_audios || []) {
                    await registry.add(audio, audio.image as string, MODULE_DIR, item, '.jpeg');
                }

                // 下载语音
                for (const voice of item.custom_voices || []) {
                    await registry.add(voice, voice.custom_url as string, MODULE_DIR, item, '.mp3');
                }

                // 下载趣味表情
                for (const magic of item.custom_magics || []) {
                    await registry.add(magic, magic.custom_url as string, MODULE_DIR, item, '.jpeg');
                }

                // 下载内容文本里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
                await registry.addEmoticons([item.content, item.custom_content, item.msgContent], item);
            }
            done++;
            await env.report('media', done, items.length);
        }, { concurrency });
        // 续传/重采时大量媒体已在 _downloaded 命中，逐条刷屏会拖垮 UI；
        // 改为汇总一行：已下载跳过数 + 新登记数（见 MediaTaskRegistry.flushDownloadSummary）。
        registry.flushDownloadSummary('整理图片视频');
    }

    /**
     * 添加评论及回复配图（含评论者头像）的下载任务（须在评论采集之后调用）
     */
    private async addCommentMediaToTasks(items: MessageItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        let done = 0;
        await env.report('media', 0, items.length);
        for (const item of items) {
            if (isNewItem(item)) {
                await addCommentImageTasks(registry, item, MODULE_DIR, this.avatars);
            }
            done++;
            await env.report('media', done, items.length);
        }
        registry.flushDownloadSummary('评论媒体整理');
    }

    /**
     * 刷新微信同步说说的坐标信息（移植自 messages.js refreshWeChatLbsInfo L1095-1160）
     */
    private async refreshWeChatLbsInfo(items: MessageItem[]): Promise<void> {
        const env = this.env;
        const cfg = env.config.Messages;
        if (!cfg.refreshWeChatLbs || !env.config.Dev.Maps.TxKey) {
            return;
        }
        let done = 0;
        for (const item of items) {
            if (!isNewItem(item) || item.custom_lbsInfo) {
                continue;
            }
            if (!isWeChat(item) || !item.lbs || !item.lbs.idname) {
                // 非微信来源或没有坐标信息的跳过
                continue;
            }
            await env.tick();
            try {
                const txCall = toTxLbs(env.config, item.lbs.pos_y!, item.lbs.pos_x!);
                const txRes = await env.requester.getJson<any>(txCall.url, txCall.params);
                if (txRes.status === 0) {
                    item.lbs.pos_y = txRes.locations[0].lat;
                    item.lbs.pos_x = txRes.locations[0].lng;
                }
            } catch (error) {
                env.logger.error(`转换微信GPS坐标到腾讯火星系坐标异常 | tid=${item.tid}`, error instanceof Error ? error.message : String(error));
            }
            try {
                const lbsCall = lbsInfo(env.config, item.lbs.pos_y!, item.lbs.pos_x!);
                const lbsRes = await env.requester.getJson<any>(lbsCall.url, lbsCall.params);
                if (lbsRes.status === 0) {
                    const result = lbsRes.result;
                    item.custom_lbsInfo = result;
                    const formatted = result?.formatted_addresses;
                    const recommend = formatted?.recommend;
                    if (recommend) {
                        item.lbs.idname = recommend;
                    }
                    if (result?.address) {
                        item.lbs.name = result.address;
                    }
                }
            } catch (error) {
                env.logger.error(`请求坐标信息异常 | tid=${item.tid}`, error instanceof Error ? error.message : String(error));
            }
            done++;
            await env.report('location', done, items.length);
            await env.sleep(500);
        }
    }
}
