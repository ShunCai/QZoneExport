import { videoComments, videoList } from '../../qzone-api/clients';
import {
    filenameValidate,
    formatDate,
    hashString,
    normalizeForDedup,
    parseDate,
    sortBy,
    toJson,
    unionItems,
} from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import { addCommentEmotionTasks, buildOldItemFilter, collectLikes, collectPagedList, forEachNewItemBatch, hasNextPage, isGetNextPage, MediaTaskRegistry, randomSleep, shouldCollectLikes, writeModuleOutputs } from './helpers';
import { addVideoTasks, type VideoLike } from './video-tasks';
import { isGetLike, type CollectorEnv } from './types';
import type { CommentRecord, LikeRecord } from './models';
import { LIMITS } from '../../shared/constants';
import { runPool } from '../../downloader/pool';

/**
 * 视频采集器
 * 移植自 src/js/modules/videos.js 的 API.Videos.export 全流程（HTML渲染除外）
 */

/** 视频条目 */
export interface VideoItem extends VideoLike, IncrementItem {
    vid?: string;
    shuoshuoid?: string;
    title?: string;
    name?: string;
    uploadtime?: number | string;
    uploadTime?: number | string;
    comments?: CommentRecord[];
    cmtTotal?: number;
    uniKey?: string;
    likes?: LikeRecord[];
    likeTotal?: number;
}

/** 视频模块下载相对目录（非Videos模块引用时用） */
const MODULE_DIR = 'Videos/images';

/** 说说点赞Key（视频挂在说说下时复用，移植自 api.js Messages.getUniKey L3167-3169） */
function getMessageUniKey(targetUin: number, tid: string): string {
    return `http://user.qzone.qq.com/${targetUin}/mood/${tid}`;
}

/** 导出类型是否为文件/链接（移植自 videos.js isFile L685-687） */
export function isVideoFileExport(exportType: string): boolean {
    return exportType === 'File' || exportType === 'Link';
}

/**
 * 按文件夹结构类型生成分类目录
 * 移植自 api.js Common.getFileStructureFolderPath（L2071-2090）
 */
export function getFileStructureFolderPath(dateTime: number, fileStructureType?: string): string {
    switch (fileStructureType) {
        case 'Year':
            // 年份/文件
            return formatDate(dateTime / 1000, 'yyyy年');
        case 'Month':
            // 年份/月份/文件
            return formatDate(dateTime / 1000, 'yyyy年/MM月');
        case 'Date':
            // 年份/月份/日期/文件
            return formatDate(dateTime / 1000, 'yyyy年/MM月/dd日');
        default:
            return '';
    }
}

/**
 * 视频文件名（移植自 videos.js getVideoFileName L761-785）
 * @param renameType Videos.RenameType：Default=链接指纹(URL哈希) / Name=视频标题 / Time=视频标题_上传时间
 */
export function buildVideoFileName(video: VideoItem, renameType?: string): string {
    const dateTime = parseDate((video.uploadtime || video.uploadTime) as number | string).getTime();
    let filename: string;
    if (renameType === 'Name') {
        filename = filenameValidate(video.name || formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
    } else if (renameType === 'Time') {
        filename = video.name
            ? filenameValidate(video.name + '_' + formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'))
            : filenameValidate(formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
    } else {
        // Default 及未知：链接指纹=URL哈希（去参，同一视频总得同名以支持去重；去参避免防盗链 token 导致每次地址不同）
        filename = filenameValidate(hashString(normalizeForDedup(video.custom_url || '')));
    }
    filename = filename.endsWith('.mp4') ? filename : filename + '.mp4';
    return filenameValidate(filename);
}

export class VideosCollector implements ModuleCollector {
    readonly module = 'Videos';

    constructor(private readonly env: CollectorEnv) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const videos = await env.loadStaging<VideoItem[]>(this.module);
        if (!videos || videos.length === 0) {
            env.logger.warn('视频 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('视频续传恢复：从 staging 加载 ' + videos.length + ' 条');
        const cfg = env.config.Videos;
        // 重新注册视频下载任务（刷新后内存任务清单已清空）
        const registry = new MediaTaskRegistry(env, this.module);
        await addVideoTasks(env, registry, videos, MODULE_DIR, undefined, {
            videoFileName: (video) => buildVideoFileName(video as VideoItem, cfg.RenameType),
            categoryPath: (video) =>
                getFileStructureFolderPath(
                    parseDate(((video as VideoItem).uploadtime || (video as VideoItem).uploadTime) as number | string).getTime(),
                    cfg.fileStructureType,
                ),
            skipOldItems: false,
        });
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Videos',
            globalName: 'videos',
            data: videos,
            jsonJsPath: 'Videos/json/videos.js',
            jsonFilePath: 'Videos/json/videos.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    async collect(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Videos;
        const videos = await this.runCollection(_ctx, false);

        // 导出数据文件
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Videos',
            globalName: 'videos',
            data: videos,
            jsonJsPath: 'Videos/json/videos.js',
            jsonFilePath: 'Videos/json/videos.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 列表采集（含页级可靠性记账 + 运行内补偿）。
     * compensateOnly=true 时跳过正常枚举，只重采 ledger 中 failed/missing 页（手动重试用）。
     * 返回完整条目（staging 已采页 + 本次/补偿采集页）。
     */
    private async collectList(ctx: CollectContext, compensateOnly: boolean): Promise<VideoItem[]> {
        const env = this.env;
        const cfg = env.config.Videos;
        const registry = new MediaTaskRegistry(env, this.module);
        const oldItems = (await env.getOldData<VideoItem[]>(this.module)) || [];
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);
        const stagedVideos = (await env.loadStaging<VideoItem[]>(this.module)) || [];
        const startPage = stagedVideos.length > 0 ? Math.ceil(stagedVideos.length / cfg.pageSize) : 0;
        return collectPagedList<VideoItem>({
            env,
            moduleCfg: cfg,
            oldItems,
            phase: 'list',
            startPage: compensateOnly ? 0 : startPage,
            initialItems: stagedVideos.length > 0 ? stagedVideos : undefined,
            afterPage: async (allItems, pageIndex, pageItems, pageOffset) => {
                // pageItems 已是本页精确子集（helpers 按 pageMap 槽位给出），不再用 slice(pi*pageSize) 反推
                if (pageItems.length === 0) return;
                // 当前页新条目（旧视频不重复请求评论/赞，也不重复登记下载）
                const actuallyNew = pageItems.filter(isNewFilter);
                // 评论（逐条处理）
                for (const video of actuallyNew) {
                    if (!video.shuoshuoid) continue;
                    video.cmtTotal = 0;
                    video.comments = [];
                    let ci = 0;
                    for (;;) {
                        await env.tick();
                        try {
                            const ccall = videoComments(env.ctx, env.config, video.shuoshuoid, ci);
                            const ctext = await env.requester.get(ccall.url, ccall.params);
                            const cres = toJson<any>(ctext, /^_Callback\(/);
                            if (cres.code && cres.code != 0) env.logger.warn('获取视频评论异常：', cres);
                            const cdata = cres.data || {};
                            video.comments = unionItems(video.comments, cdata.comments || []);
                            video.cmtTotal = cdata.total || video.cmtTotal;
                            if (cdata.hasnext === 0) break;
                        } catch (error) {
                            env.logger.error(`获取视频评论异常 | 视频#${video.shuoshuoid} | page=${ci + 1}`, error instanceof Error ? error.message : String(error));
                            break;
                        }
                        ci++;
                        if (!hasNextPage(ci, cfg.Comments.pageSize ?? 10, video.cmtTotal || 0, video.comments || [])) break;
                        await randomSleep(env, cfg.Comments.randomSeconds);
                    }
                    // 评论/评论回复文本里的 QQ 表情（与 MD/查看器对评论内容的表情转换一致）
                    await addCommentEmotionTasks(registry, video.comments, video);
                }
                // 点赞（限流并发）
                if (isGetLike(cfg)) {
                    env.logger.info(`[明细并发] 视频点赞 | page=${pageIndex} | 待处理=${actuallyNew.length} | 上限=${(env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY}`);
                    await runPool(actuallyNew, async (video) => {
                        if (!shouldCollectLikes(video)) return;
                        await collectLikes(env, video, cfg.Like);
                    }, { concurrency: (env.config.Common as any)?.itemDetailConcurrency ?? LIMITS.ITEM_DETAIL_CONCURRENCY });
                }
                // 视频下载任务：序号逻辑已下线，文件名不再依赖全局排序，
                // 故随每页内联登记，列表收完前即可开始下载（逐页交叉）。
                await addVideoTasks(env, registry, actuallyNew, MODULE_DIR, undefined, {
                    videoFileName: (video) => buildVideoFileName(video as VideoItem, cfg.RenameType),
                    categoryPath: (video) =>
                        getFileStructureFolderPath(
                            parseDate(((video as VideoItem).uploadtime || (video as VideoItem).uploadTime) as number | string).getTime(),
                            cfg.fileStructureType,
                        ),
                    skipOldItems: true,
                });
                // 每页落盘 staging，供断点续传恢复（视频列表主体）
                await env.saveStaging(this.module, allItems);
            },
            fetchPage: async (pageIndex) => {
                const call = videoList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^shine0_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn('获取一页的视频列表异常：', res);
                }
                const data = res.data || {};
                const list: VideoItem[] = data.Videos || [];
                for (const item of list) {
                    // 视频挂在说说下时用说说的点赞Key，否则用vid
                    item.uniKey = item.shuoshuoid ? getMessageUniKey(env.ctx.targetUin, item.shuoshuoid) : item.vid;
                }
                return { items: list, total: data.total || 0 };
            },
            // 无 ledger 时跳过页级记账（测试环境 ctx 未注入 ledger 时 recordPage 不应崩溃）
            reliability: ctx.ledger ? { ledger: ctx.ledger, uin: String(ctx.uin), module: this.module, batchId: ctx.batchId } : undefined,
            compensateOnly,
        });
    }

    /** 列表采集 + 合并/排序/落盘（runCollection 的统一后处理；retry 复用） */
    private async runCollection(ctx: CollectContext, compensateOnly: boolean): Promise<VideoItem[]> {
        const env = this.env;
        const cfg = env.config.Videos;
        const oldItems = (await env.getOldData<VideoItem[]>(this.module)) || [];
        let videos = await this.collectList(ctx, compensateOnly);
        videos = unionBackedUpItems(cfg, oldItems, videos);
        videos = sortBy(videos, cfg.IncrementField, true);
        await env.saveStaging(this.module, videos);
        return videos;
    }

    /** 断点补偿：仅重采 ledger 中 failed/missing 页，完成后重新合并/导出 */
    async retryFailedPages(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Videos;
        const videos = await this.runCollection(ctx, true);
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Videos',
            globalName: 'videos',
            data: videos,
            jsonJsPath: 'Videos/json/videos.js',
            jsonFilePath: 'Videos/json/videos.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 获取视频的所有评论（移植自 videos.js getAllComments L139-221）
     */
    private async collectComments(videos: VideoItem[], oldItems: VideoItem[]): Promise<void> {
        const env = this.env;
        const cfg = env.config.Videos;
        const commentsCfg = cfg.Comments;
        // 视频备份为文件/链接时不获取评论
        if (!commentsCfg.isGet || isVideoFileExport(cfg.exportType)) {
            return;
        }
        for (let index = 0; index < videos.length; index++) {
            const video = videos[index]!;
            if (!isNewItem(video)) {
                // 已备份数据计为已成功处理
                continue;
            }
            video.cmtTotal = 0;
            video.comments = [];
            if (!video.shuoshuoid) {
                // 说说ID为空时跳过不获取
                continue;
            }
            let pageIndex = 0;
            for (;;) {
                await env.tick();
                try {
                    const call = videoComments(env.ctx, env.config, video.shuoshuoid, pageIndex);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn('获取视频评论异常：', res);
                    }
                    const data = res.data || {};
                    const comments: CommentRecord[] = data.comments || [];
                    // 添加评论数到视频
                    video.cmtTotal = data.total || video.cmtTotal || 0;
                    video.comments = unionItems(video.comments, comments);
                    if (!isGetNextPage(oldItems, comments, { ...cfg, ...commentsCfg } as any)) {
                        break;
                    }
                } catch (error) {
                    env.logger.error(`获取视频评论列表异常 | 视频#${video.shuoshuoid} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                    env.fail();
                }
                pageIndex++;
                if (!hasNextPage(pageIndex, commentsCfg.pageSize, video.cmtTotal || 0, video.comments!)) {
                    break;
                }
                await randomSleep(env, commentsCfg.randomSeconds);
            }
            await env.report('comments', index + 1, videos.length, undefined, undefined, { done: index + 1, total: videos.length });
        }
    }
}
