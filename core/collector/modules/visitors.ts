import { visitorList } from '../../qzone-api/clients';
import { toJson, unionItems } from '../../shared/utils';
import { isNewItem, isPreBackupPos, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import { AvatarTaskRegistry, MediaTaskRegistry, randomSleep, recordSimplePage, writeModuleOutputs } from './helpers';
import type { CollectorEnv } from './types';
import type { VisitorRecord } from './models';

/**
 * 访客采集器
 * 移植自 src/js/modules/visitors.js 的 API.Visitors.export 全流程（HTML渲染除外）
 * 翻页依据接口返回的 totalPage（非条目数），主人/访客身份的总数字段不同
 */

/** 访客条目 */
export interface VisitorItem extends IncrementItem {
    uin?: number;
    name?: string;
    time?: number;
    shuoshuoes?: VisitorRecord[];
    blogs?: VisitorRecord[];
    photoes?: VisitorRecord[];
    shares?: VisitorRecord[];
    uins?: number[];
    [key: string]: unknown;
}

/** 访客模块数据（与旧版 QZone.Visitors.Data 结构一致） */
export interface VisitorInfo {
    items: VisitorItem[];
    total: number;
    totalPage: number;
    /** 续传用：下一页页码（每完成一页原子落盘，恢复时从此页继续） */
    nextPage?: number;
}

/** 访客模块下载相对目录 */
const MODULE_DIR = 'Visitors/images';

export class VisitorsCollector implements ModuleCollector {
    readonly module = 'Visitors';

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const visitorInfo = await env.loadStaging<VisitorInfo>(this.module);
        if (!visitorInfo) {
            env.logger.warn('访客 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('访客续传恢复：从 staging 加载 ' + (visitorInfo.items || []).length + ' 条');
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Visitors',
            globalName: 'visitorInfo',
            data: visitorInfo,
            jsonJsPath: 'Visitors/json/visitors.js',
            jsonFilePath: 'Visitors/json/visitors.json',
        });
        if (env.config.Visitors.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Visitors', visitorInfo);
        }
        await env.report('export', 1, 1);
    }

    async collect(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Visitors;
        const registry = new MediaTaskRegistry(env, this.module);

        // 上次备份数据（对象结构）
        const oldInfo = await env.getOldData<VisitorInfo>(this.module);
        const oldItems = oldInfo?.items || [];

        // 统一续传：从 staging 恢复已采集部分并从断点页继续（不再从首页重拉）
        const stagedVisitors = (await env.loadStaging<VisitorInfo>(this.module)) || null;
        const visitorInfo: VisitorInfo = (stagedVisitors && stagedVisitors.items && stagedVisitors.items.length > 0)
            ? { items: stagedVisitors.items, total: stagedVisitors.total || 0, totalPage: stagedVisitors.totalPage || 0, nextPage: stagedVisitors.nextPage }
            : { items: [], total: 0, totalPage: 0 };

        // 访客接口按 page 翻页（每页大小由服务端决定，不在 config），原子落盘：
        // 每完成一页即把「下一页页码」写入 staging，续传时从 nextPage 继续，不再从首页重拉。
        let page = (visitorInfo.nextPage && visitorInfo.nextPage >= 1) ? visitorInfo.nextPage : 1;
        // 进入列表循环前先预置主体阶段为「采集中(indeterminate)」，避免第一页明细处理期间
        // st.subject['list'] 尚未写入导致 computeSubjectProgress 回落旧 sum 公式（已 done=total 的
        // 明细 phase 累加算出 100%），第一页真实 total 上报后掉回真实百分比造成的进度条倒退。
        await env.report('list', 0, -1, undefined, undefined, { done: 0, total: -1 });
        for (;;) {
            await env.tick();
            try {
                const call = visitorList(env.ctx, page);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/) || {};
                if (res.code && res.code != 0) {
                    env.logger.warn(`获取单页的访客列表异常 | page=${page} | code=${res.code}`, res.msg || '');
                }
                const data = res.data || {};
                const items: VisitorItem[] = data.items || [];
                if (data.Ishost === 0) {
                    // 访客身份：总数在 modvisitcount 中，且仅一页
                    visitorInfo.total = visitorInfo.total || (data.modvisitcount && data.modvisitcount[0]?.totalcount) || 0;
                    visitorInfo.totalPage = visitorInfo.totalPage || 1;
                } else {
                    // 主人身份
                    visitorInfo.total = visitorInfo.total || data.totalcount || 0;
                    visitorInfo.totalPage = visitorInfo.totalPage || data.totalpage || 0;
                }
                visitorInfo.items = unionItems(visitorInfo.items, items);
                await env.report('list', visitorInfo.items.length, visitorInfo.total || -1, undefined, undefined, { done: visitorInfo.items.length, total: visitorInfo.total || -1 });
                // 访客由服务端按 totalPage 分页、每页条数不定 → total/pageSize 传 0（期望未知，不误报 missing）
                await recordSimplePage(ctx, this.module, page - 1, items.length, 0, 0);
                // 每页落盘 staging，供断点续传恢复（nextPage 记录「下一页页码」，续传从此继续）
                visitorInfo.nextPage = page + 1;
                await env.saveStaging(this.module, visitorInfo);

                if (oldItems.length > 0 && isPreBackupPos(items, cfg as any)) {
                    // 备份到已备份过的数据时停止获取，适用于增量备份
                    break;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                env.logger.error(`获取访客列表异常 | page=${page}`, msg);
                await recordSimplePage(ctx, this.module, page - 1, 0, 0, 0, true, msg);
                env.fail();
            }
            if (page >= visitorInfo.totalPage) {
                // 最后一页停止获取（失败页也按页码判断，与旧版一致）
                break;
            }
            page++;
            await randomSleep(env, cfg.randomSeconds);
        }

        // 合并、过滤上次备份数据
        visitorInfo.items = unionBackedUpItems(cfg as any, oldItems, visitorInfo.items);

        // 添加多媒体下载任务
        await this.addMediaToTasks(visitorInfo, registry);

        // 导出数据文件
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Visitors',
            globalName: 'visitorInfo',
            data: visitorInfo,
            jsonJsPath: 'Visitors/json/visitors.js',
            jsonFilePath: 'Visitors/json/visitors.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Visitors', visitorInfo);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 添加访客访问内容的配图下载任务
     * 移植自 visitors.js addMediaToTasks/addDownloadImagesTasks（L131-149、L389-429）
     */
    private async addMediaToTasks(visitorInfo: VisitorInfo, registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        const items = visitorInfo.items || [];
        for (const item of items) {
            if (!isNewItem(item)) {
                // 已备份数据计为已成功处理
                continue;
            }
            // 说说配图
            item.shuoshuoes = item.shuoshuoes || [];
            for (const message of item.shuoshuoes) {
                if (!message.imgsrc) {
                    continue;
                }
                await registry.add(message, message.imgsrc as string, MODULE_DIR, item);
            }

            // 日志配图（接口暂无）
            item.blogs = item.blogs || [];

            // 相册配图
            item.photoes = item.photoes || [];
            for (const photo of item.photoes) {
                if (!photo.imgsrc) {
                    continue;
                }
                await registry.add(photo, photo.imgsrc as string, MODULE_DIR, item);
            }

            // 分享配图
            item.shares = item.shares || [];
            for (const share of item.shares) {
                if (!share.imgsrc) {
                    continue;
                }
                await registry.add(share, share.imgsrc as string, MODULE_DIR, item);
            }
        }
        await env.report('media', items.length, items.length, undefined, undefined, { done: items.length, total: items.length });
    }
}
