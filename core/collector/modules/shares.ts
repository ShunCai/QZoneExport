import { shareComments, shareList, shareVisitors } from '../../qzone-api/clients';
import { toDate, toJson, unionItems } from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CommentRecord, LikeRecord, PhotoVisitorSummary } from './models';
import type { CollectContext, ModuleCollector } from '../pipeline';
import {
    AvatarTaskRegistry,
    buildOldItemFilter,
    collectItemVisitors,
    collectLikes,
    forEachNewItemBatch,
    hasNextPage,
    isGetNextPage,
    MediaTaskRegistry,
    randomSleep,
    recordSimplePage,
    writeModuleOutputs,
} from './helpers';
import { isGetLike, isGetVisitor, type CollectorEnv, type SharesConfig } from './types';
import { LIMITS } from '../../shared/constants';
import { runPool } from '../../downloader/pool';

/**
 * 分享采集器
 * 移植自 src/js/modules/shares.js 的 API.Shares.export 全流程（HTML渲染除外）
 * 分享列表接口返回的是HTML页面，需解析DOM提取条目（原 API.Shares.convert）
 */

/** 分享来源 */
export interface ShareSource {
    title: string;
    desc: string;
    url: string;
    from: { url: string; name: string };
    count: number;
    images: Array<{ url?: string }>;
}

/** 分享条目 */
export interface ShareItem extends IncrementItem {
    id: string;
    uin?: number;
    nickname?: string;
    type?: string | number;
    desc?: string;
    source?: ShareSource;
    shareTime?: number;
    likes?: LikeRecord[];
    likeTotal?: number;
    uniKey?: string;
    comments?: CommentRecord[];
    commentTotal?: number;
    custom_visitor?: PhotoVisitorSummary;
    [key: string]: unknown;
}

/** 分享模块下载相对目录 */
const MODULE_DIR = 'Shares/images';

/** 分享来源站点名（移植自 api.js Shares.getSourceType L4505-4528） */
export function getShareSourceType(cfg: SharesConfig, url?: string, defaultName?: string): string {
    if (!url) {
        return defaultName || '';
    }
    for (const sourceType of cfg.SourceType || []) {
        const regulars = sourceType.regulars;
        if (Array.isArray(regulars)) {
            for (const reg of regulars) {
                if (url.match(new RegExp(reg))) {
                    return sourceType.name;
                }
            }
        } else if (url.match(new RegExp(regulars))) {
            return sourceType.name;
        }
    }
    if ('undefined' === defaultName) {
        // 特殊处理undefined字符串
        return '网页';
    }
    return defaultName || '';
}

/** 分享列表页解析结果 */
export interface ShareData {
    list: ShareItem[];
    total: number;
}

/**
 * 解析分享列表HTML页面
 * 移植自 api.js Shares.convert（L4550-4659），用 DOMParser 替代 jQuery
 */
export function convertShares(html: string, cfg: SharesConfig): ShareData {
    const shareData: ShareData = { list: [], total: 0 };
    if (!html) {
        return shareData;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 总数
    const totalEl = doc.querySelector('#app_mod > div.wrap > div.aside.col_lar.bg3 > div.mod_info.bg > div.mod_conts > p');
    shareData.total = Number((totalEl?.textContent || '').replace('条分享', '')) || 0;

    const shares = doc.querySelectorAll('#shares > li');
    for (const li of shares) {
        const infoDiv = li.querySelector('div.mod_info.bbor3.__item_main__');
        if (!infoDiv) {
            continue;
        }

        // 分享条目自带的脚本中含 shareInfos.push({...})，提取对象字面量后解析
        // MV3不使用eval，与旧版加固后的做法一致
        let infoJson: any = undefined;
        for (const script of li.querySelectorAll('script')) {
            const text = script.textContent || '';
            if (text.indexOf('shareInfos.push') > -1) {
                const match = /[\s\S]+shareInfos.push\((\{[\s\S]+\})\);[\s\S]+/.exec(text);
                try {
                    infoJson = (match && toJson<any>(match[1]!)) || undefined;
                } catch (error) {
                    // convertShares 是纯 HTML 解析函数（无 env），这条解析失败保留 console
                    console.warn('解析分享信息失败，已跳过该分享', error);
                    infoJson = undefined;
                }
                break;
            }
        }

        // 分享显示区
        const contentDiv = infoDiv.querySelector('div.mod_conts._share_desc_cont');
        if (!contentDiv) {
            continue;
        }
        // 分享审核中的跳过
        const tempDesc = contentDiv.querySelector('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming');
        const isReviewing = tempDesc?.textContent === '此条分享正在审核中';
        if (!infoJson || !infoJson.ugcPlatform || infoJson.ugcPlatform === '' || isReviewing) {
            continue;
        }

        // 标题与URL
        const targetLink = contentDiv.querySelector('div.mod_details.lbor > div.mod_brief > h5 > strong > a.c_tx._share_title');
        const title = targetLink?.innerHTML || '';
        let url = targetLink?.getAttribute('href') || '#';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://user.qzone.qq.com/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/' + url;
        }
        // 描述
        const descEl = contentDiv.querySelector('div.mod_details.lbor > div.mod_brief > p:not(.mod_music):not(.c_tx3.comming)');
        const desc = descEl?.innerHTML || '';
        // 分享次数
        const shareCount = contentDiv.querySelector('div.mod_details.lbor > div.mod_brief > p > span.share_count');
        const count = Number(shareCount?.textContent || 0) || 0;
        // 分享来源
        const fromLink = contentDiv.querySelector('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming > a.c_tx3.mgrm');
        const fromUrl = fromLink?.getAttribute('href') || '#';
        const fromName = getShareSourceType(cfg, fromUrl, fromLink?.textContent || '');

        // 配图（左图右文的图 + 相册/相片的图）
        const images: Array<{ url?: string }> = [];
        for (const img of contentDiv.querySelectorAll('div.mod_details.lbor > div.layout_s img')) {
            images.push({ url: img.getAttribute('src') || img.getAttribute('data-src') || undefined });
        }
        for (const img of contentDiv.querySelectorAll('div.mod_details.lbor > div.mod_brief > div.mod_list > ul > li img')) {
            images.push({ url: img.getAttribute('src') || img.getAttribute('data-src') || undefined });
        }

        // 分享时间
        const shareTimeEl = contentDiv.querySelector('div.c_tx3.mod_scraps > span:nth-child(1)');
        const shareTimeText = shareTimeEl?.textContent || '1970-01-01';

        const poster = infoJson.poster || {};
        const item: ShareItem = {
            id: infoJson.id,
            uin: poster.uin,
            nickname: poster.nickname || '',
            type: infoJson.type || '',
            desc: infoJson.memo || '',
            source: { title, desc, url, from: { url: fromUrl, name: fromName }, count, images },
            shareTime: toDate(shareTimeText).getTime() / 1000,
            likes: [],
            likeTotal: 0,
            uniKey: '00' + poster.uin + '00' + infoJson.id,
            comments: [],
            commentTotal: 0,
        };

        // 评论数
        const commentCount = contentDiv.querySelector('#' + li.id + '_commentCount');
        item.commentTotal = Number(commentCount?.textContent || 0) || 0;
        // 点赞数
        const likeTotalEl = contentDiv.querySelector('div.c_tx3.mod_scraps > span.mgrs.like_count.right > span > a:nth-child(3)');
        const likeMatch = /赞\((\d)\)/.exec(likeTotalEl?.textContent || '');
        item.likeTotal = Number(likeMatch?.[1] || 0) || 0;

        shareData.list.push(item);
    }
    return shareData;
}

export class SharesCollector implements ModuleCollector {
    readonly module = 'Shares';

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const items = await env.loadStaging<ShareItem[]>(this.module);
        if (!items || items.length === 0) {
            env.logger.warn('分享 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('分享续传恢复：从 staging 加载 ' + items.length + ' 条');
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Shares',
            globalName: 'shares',
            data: items,
            jsonJsPath: 'Shares/json/shares.js',
            jsonFilePath: 'Shares/json/shares.json',
        });
        if (env.config.Shares.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Shares', items);
        }
        await env.report('export', 1, 1);
    }

    async collect(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Shares;
        const registry = new MediaTaskRegistry(env, this.module);

        // 上次备份数据
        const oldItems = (await env.getOldData<ShareItem[]>(this.module)) || [];
        // 全量备份忽略旧数据，所有条目都重新采集明细；仅增量/上次/自定义才按旧数据过滤
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);

        // 获取所有分享列表（接口页码从1开始）
        // 统一续传：从 staging 恢复已采集部分并从断点页继续（不再从首页重拉）
        const stagedShares = (await env.loadStaging<ShareItem[]>(this.module)) || [];
        let items: ShareItem[] = stagedShares.length > 0 ? stagedShares : [];
        let total = 0;
        let page = stagedShares.length > 0 ? Math.ceil(stagedShares.length / cfg.pageSize) + 1 : 1;
        // 进入列表循环前先预置主体阶段为「采集中(indeterminate)」，避免第一页明细处理期间
        // st.subject['list'] 尚未写入导致 computeSubjectProgress 回落旧 sum 公式（已 done=total 的
        // 明细 phase 累加算出 100%），第一页真实 total 上报后掉回真实百分比造成的进度条倒退。
        await env.report('list', 0, -1, undefined, undefined, { done: 0, total: -1 });
        for (;;) {
            await env.tick();
            let newItems: ShareItem[];
            try {
                const call = shareList(env.ctx, env.config, page);
                const html = await env.requester.get(call.url, call.params);
                const shareInfo = convertShares(html, cfg);
                newItems = shareInfo.list;
                total = total || shareInfo.total || 0;
                items = unionItems(items, newItems);
                await env.report('list', items.length, total || -1, undefined, undefined, { done: items.length, total: total || -1 });
                // 分享页码从 1 开始，账本统一按 0-based 记
                await recordSimplePage(ctx, this.module, page - 1, newItems.length, total, cfg.pageSize);

                // 逐页穿插处理详情（只处理新条目）
                const actuallyNew = newItems.filter(isNewFilter);
                await this.addSourceMediaToTasks(actuallyNew, registry);
                await this.collectComments(actuallyNew);
                await this.addCommentMediaToTasks(actuallyNew, registry);

                if (isGetLike(cfg)) {
                    env.logger.info(`[明细并发] 分享点赞 | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await runPool(actuallyNew, async (item) => {
                        if (item.likes !== undefined) return;
                        await collectLikes(env, item, cfg.Like, this.avatars);
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                }
                if (isGetVisitor(cfg)) {
                    env.logger.info(`[明细并发] 分享访客 | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await runPool(actuallyNew, async (item) => {
                        if (item.custom_visitor !== undefined) return;
                        item.custom_visitor = await collectItemVisitors(env, cfg.Visitor, (idx) =>
                            shareVisitors(env.ctx, env.config, item.id, idx),
                        );
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                }

                await env.saveStaging(this.module, items);

                if (!isGetNextPage(oldItems, newItems, cfg)) {
                    break;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                env.logger.error(`获取分享列表异常 | page=${page}`, msg);
                await recordSimplePage(ctx, this.module, page - 1, 0, total, cfg.pageSize, true, msg);
                env.fail();
            }
            page++;
            if (!hasNextPage(page - 1, cfg.pageSize, total, items)) {
                break;
            }
            await randomSleep(env, cfg.randomSeconds);
        }

        // 合并、过滤上次备份数据
        items = unionBackedUpItems(cfg, oldItems, items);

        // 导出数据文件
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Shares',
            globalName: 'shares',
            data: items,
            jsonJsPath: 'Shares/json/shares.js',
            jsonFilePath: 'Shares/json/shares.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Shares', items);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 获取所有分享的评论（移植自 shares.js getItemAllCommentList/getItemsAllCommentList L111-206）
     */
    private async collectComments(items: ShareItem[]): Promise<void> {
        const env = this.env;
        const commentsCfg = env.config.Shares.Comments;
        if (!commentsCfg.isGet) {
            return;
        }
        for (let i = 0; i < items.length; i++) {
            const item = items[i]!;
            if (!isNewItem(item)) {
                // 已备份数据计为已成功处理
                continue;
            }
            // 清空原有的评论列表重新分页获取
            item.comments = [];
            const total = item.commentTotal || 0;
            let pageIndex = 0;
            for (;;) {
                await env.tick();
                try {
                    const call = shareComments(env.ctx, env.config, item.id, pageIndex);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn(`获取单条分享的全部评论列表异常 | id=${item.id} | page=${pageIndex + 1} | code=${res.code}`, res.msg || '');
                    }
                    const data = res.data || {};
                    item.commentTotal = item.commentTotal || data.total || 0;
                    const comments: CommentRecord[] = data.comments || [];
                    // 处理发表时间（接口返回中文相对时间文本）
                    for (const comment of comments) {
                        comment.postTime = toDate(comment.postTime as string).getTime() / 1000;
                        comment.replies = comment.replies || [];
                        // 登记评论用户头像下载
                        if (this.avatars && comment.user?.uin) {
                            this.avatars.download({ uin: comment.user.uin });
                        }
                        for (const reply of comment.replies) {
                            reply.postTime = toDate(reply.postTime as string).getTime() / 1000;
                            // 登记回复用户头像下载
                            if (this.avatars && reply.user?.uin) {
                                this.avatars.download({ uin: reply.user.uin });
                            }
                        }
                    }
                    item.comments = unionItems(item.comments, comments);
                } catch (error) {
                    env.logger.error(`获取分享评论列表异常 | id=${item.id} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                    env.fail();
                }
                pageIndex++;
                if (!hasNextPage(pageIndex, commentsCfg.pageSize, total, item.comments!)) {
                    break;
                }
                await randomSleep(env, commentsCfg.randomSeconds);
            }
            await env.report('comments', i + 1, items.length);
        }
    }

    /**
     * 添加多媒体下载任务（移植自 shares.js addMediaToTasks L372-410）
     */
    private async addSourceMediaToTasks(items: ShareItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        let done = 0;
        await env.report('media', 0, items.length);
        for (const item of items) {
            if (!isNewItem(item)) {
                done++;
                await env.report('media', done, items.length);
                continue;
            }

            // 来源配图（网页、音乐等）
            for (const image of item.source?.images || []) {
                await registry.add(image as any, image.url, MODULE_DIR, item);
            }

            // 下载分享正文里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
            await registry.addEmoticons([item.content, item.custom_content, item.title], item);

            done++;
            await env.report('media', done, items.length);
        }
    }

    /**
     * 添加评论及回复配图的下载任务（须在评论采集之后调用）
     */
    private async addCommentMediaToTasks(items: ShareItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        let done = 0;
        await env.report('media', 0, items.length);
        for (const item of items) {
            if (!isNewItem(item)) {
                done++;
                await env.report('media', done, items.length);
                continue;
            }

            for (const comment of item.comments || []) {
                comment.pic = comment.pic || [];
                for (const pic of comment.pic) {
                    pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                    await registry.add(pic, pic.custom_url as string, MODULE_DIR, item);
                }
                // 评论正文里的 QQ 表情（与 MD/查看器对评论内容的表情转换一致）
                await registry.addEmoticons([comment.content, comment.msgContent], item);
                comment.replies = comment.replies || [];
                for (const reply of comment.replies) {
                    reply.pic = reply.pic || [];
                    for (const pic of reply.pic) {
                        pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                        await registry.add(pic, pic.custom_url as string, MODULE_DIR, item);
                    }
                    // 评论回复里的 QQ 表情
                    await registry.addEmoticons([reply.content, reply.msgContent], item);
                }
            }

            done++;
            await env.report('media', done, items.length);
        }
    }
}
