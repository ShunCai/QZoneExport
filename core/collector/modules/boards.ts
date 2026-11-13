import { boardList } from '../../qzone-api/clients';
import { hashString, parseDate, sortBy, toHttp, toJson, unionItems } from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import type { CollectContext, ModuleCollector } from '../pipeline';
import { AvatarTaskRegistry, buildOldItemFilter, hasNextPage, isGetNextPage, MediaTaskRegistry, randomSleep, recordSimplePage, resolveMediaSuffix, writeModuleOutputs } from './helpers';
import type { CollectorEnv } from './types';

/**
 * 留言采集器
 * 移植自 src/js/modules/boards.js 的 API.Boards.export 全流程（HTML渲染除外）
 * 产出为带主人寄语的对象结构：{ items, authorInfo, total }
 */

/** 留言条目 */
export interface BoardItem extends IncrementItem {
    uin?: number;
    nickname?: string;
    nick?: string;
    secret?: number;
    htmlContent?: string;
    pubtime?: number;
    replyList?: any[];
    [key: string]: any;
}

/** 留言模块数据（与旧版 QZone.Boards.Data 结构一致） */
export interface BoardInfo {
    items: BoardItem[];
    authorInfo?: { message: string; sign: string };
    total: number;
}

/** 留言人昵称（移植自 api.js Boards.getOwner L3523-3525） */
export function getBoardOwner(board: BoardItem): string {
    return board.nickname || board.nick || '神秘者';
}

export class BoardsCollector implements ModuleCollector {
    readonly module = 'Boards';

    /**
     * 已处理过内容的留言（翻页时提前处理的那批）。
     * 用 WeakSet 而非在条目上打标记，避免多余字段被写进导出的 JSON。
     * 条目引用在 unionItems / unionBackedUpItems / sortBy 中均为原地操作，引用保持不变。
     */
    private readonly handledBoards = new WeakSet<BoardItem>();

    constructor(private readonly env: CollectorEnv, private readonly avatars?: AvatarTaskRegistry) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const boardInfo = await env.loadStaging<BoardInfo>(this.module);
        if (!boardInfo) {
            env.logger.warn('留言 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        env.logger.info('留言续传恢复：从 staging 加载 ' + (boardInfo.items || []).length + ' 条');
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Boards',
            globalName: 'boardInfo',
            data: boardInfo,
            jsonJsPath: 'Boards/json/boards.js',
            jsonFilePath: 'Boards/json/boards.json',
        });
        if (env.config.Boards.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Boards', boardInfo);
        }
        await env.report('export', 1, 1);
    }

    async collect(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Boards;
        const registry = new MediaTaskRegistry(env, this.module);

        // 上次备份数据（对象结构，取items做增量）
        const oldInfo = await env.getOldData<BoardInfo>(this.module);
        const oldItems = oldInfo?.items || [];
        // 全量备份忽略旧数据，所有条目都重新采集明细；仅增量/上次/自定义才按旧数据过滤
        const isNewFilter = isFullBackup(cfg) ? () => true : buildOldItemFilter(oldItems);

        // 获取所有留言列表（含主人寄语）
        // 统一续传：从 staging 恢复已采集部分并从断点页继续（不再从首页重拉）
        const stagedBoard = (await env.loadStaging<BoardInfo>(this.module)) || null;
        const boardInfo: BoardInfo = { items: [], total: 0 };
        if (stagedBoard && stagedBoard.items && stagedBoard.items.length > 0) {
            boardInfo.items = stagedBoard.items;
            boardInfo.total = stagedBoard.total || 0;
            boardInfo.authorInfo = stagedBoard.authorInfo;
            // 已处理的留言标记，避免末尾 handleData 重处理
            for (const b of boardInfo.items) this.handledBoards.add(b);
        }
        let pageIndex = boardInfo.items.length > 0 ? Math.ceil(boardInfo.items.length / cfg.pageSize) : 0;
        // 进入列表循环前先预置主体阶段为「采集中(indeterminate)」，避免第一页明细处理期间
        // st.subject['list'] 尚未写入导致 computeSubjectProgress 回落旧 sum 公式（已 done=total 的
        // 明细 phase 累加算出 100%），第一页真实 total 上报后掉回真实百分比造成的进度条倒退。
        await env.report('list', 0, -1, undefined, undefined, { done: 0, total: -1 });
        for (;;) {
            await env.tick();
            let pageItems: BoardItem[];
            try {
                const call = boardList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn(`获取一页的留言列表异常 | page=${pageIndex + 1} | code=${res.code}`, res.msg || '');
                }
                const data = res.data || {};
                boardInfo.total = data.total || boardInfo.total || 0;
                if (data.authorInfo) {
                    // 主人寄语
                    boardInfo.authorInfo = {
                        message: data.authorInfo.htmlMsg || '',
                        sign: data.authorInfo.sign || '',
                    };
                }
                pageItems = data.commentList || [];
                boardInfo.items = unionItems(boardInfo.items, pageItems);
                await env.report('list', boardInfo.items.length, boardInfo.total || -1, undefined, undefined, { done: boardInfo.items.length, total: boardInfo.total || -1 });
                await recordSimplePage(ctx, this.module, pageIndex, pageItems.length, boardInfo.total, cfg.pageSize);
                // 本页拉完立即处理该页留言的图片（登记即开下载，与后续翻页并行；过滤旧备份条目）
                await this.handlePageItems(pageItems.filter(isNewFilter), registry);
                // 每页落盘 staging，供断点续传恢复
                await env.saveStaging(this.module, boardInfo);
                if (!isGetNextPage(oldItems, pageItems, cfg)) {
                    break;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                env.logger.error(`获取留言列表异常 | page=${pageIndex + 1}`, msg);
                await recordSimplePage(ctx, this.module, pageIndex, 0, boardInfo.total, cfg.pageSize, true, msg);
                env.fail();
            }
            pageIndex++;
            if (!hasNextPage(pageIndex, cfg.pageSize, boardInfo.total, boardInfo.items)) {
                break;
            }
            await randomSleep(env, cfg.randomSeconds);
        }

        // 合并、过滤上次备份数据，发表时间倒序
        boardInfo.items = unionBackedUpItems(cfg, oldItems, boardInfo.items);
        boardInfo.items = sortBy(boardInfo.items, cfg.IncrementField, true);
        if (oldInfo?.authorInfo && !boardInfo.authorInfo) {
            // 增量停止在首页前时保留旧的主人寄语
            boardInfo.authorInfo = oldInfo.authorInfo;
        }

        // 处理留言内容（私密留言提示 + 图片本地化）
        await this.handleData(boardInfo, registry);

        // 导出数据文件
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Boards',
            globalName: 'boardInfo',
            data: boardInfo,
            jsonJsPath: 'Boards/json/boards.js',
            jsonFilePath: 'Boards/json/boards.json',
        });
        if (cfg.exportType === 'MarkDown' && env.exportMarkdown) {
            await env.exportMarkdown('Boards', boardInfo);
        }
        await env.report('export', 1, 1);
    }

    /**
     * 每页拉完后立即处理该页留言（提前登记图片下载任务）。
     *
     * 留言的图片来自 htmlContent 里的内联 img，列表页就是全量，不依赖任何后续请求；
     * 文件名取 hashString(url)，与条目顺序、总数都无关，因此可以安全地页级处理。
     *
     * 增量模式下会跳过早于增量时间的条目：它们随后会被 unionBackedUpItems 剔除，
     * 提前处理只会白下载一批图片。跳过的条目不进 handledBoards，
     * 交由 handleData 兜底（那时 isNewItem 已被打成 false，同样会跳过），行为与改造前一致。
     */
    private async handlePageItems(items: BoardItem[], registry: MediaTaskRegistry): Promise<void> {
        const cfg = this.env.config.Boards;
        const full = isFullBackup(cfg);
        const incrementTime = full ? 0 : parseDate(cfg.IncrementTime).getTime();
        for (const board of items) {
            if (this.handledBoards.has(board)) {
                continue;
            }
            if (!full && parseDate(board[cfg.IncrementField] as number | string).getTime() < incrementTime) {
                continue;
            }
            this.handledBoards.add(board);
            await this.handleBoard(board, registry);
        }
    }

    /**
     * 处理留言数据（移植自 boards.js handerData L136-217）
     * 翻页阶段已提前处理的条目在此跳过，其余（含增量边界条目）在这里兜底。
     */
    private async handleData(boardInfo: BoardInfo, registry: MediaTaskRegistry): Promise<void> {
        for (const board of boardInfo.items) {
            if (this.handledBoards.has(board)) {
                // 翻页时已提前处理
                continue;
            }
            if (!isNewItem(board)) {
                // 已备份数据计为已成功处理
                continue;
            }
            await this.handleBoard(board, registry);
        }
    }

    /**
     * 处理单条留言的内容（私密留言提示 + 图片本地化 + 表情下载）
     */
    private async handleBoard(board: BoardItem, registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        board.uin = board.uin || 0;
        board.nickname = getBoardOwner(board);
        board.htmlContent = board.htmlContent || '';
        // 他人模式兼容私密留言
        if (board.secret == 1 && !board.htmlContent) {
            // 私密留言提示
            board.htmlContent = '主人收到一条私密留言，仅彼此可见';
            return;
        }

        // 处理留言内容中的图片
        const doc = new DOMParser().parseFromString(`<div>${board.htmlContent}</div>`, 'text/html');
        const container = doc.body.firstElementChild!;
        const images = container.querySelectorAll('img');
        for (let i = 0; i < images.length; i++) {
            const img = images[i]!;
            // 处理相对协议
            let url = img.getAttribute('orgsrc') || img.getAttribute('src');
            if (!url) {
                env.logger.warn(`留言图片 URL 为空，跳过下载 | uin=${board.uin}`);
                continue;
            }
            // 处理表情相对协议
            url = url.replace(/^\/qzone\/em/g, 'http://qzonestyle.gtimg.cn/qzone/em');
            url = toHttp(url);

            // 添加下载任务
            if (!registry.isQzoneUrl()) {
                // 非QQ空间外链：用统一的后缀解析（保证类型探测/命名/引用一致，修复 #2）
                const customFilename = hashString(url) + (await resolveMediaSuffix(url, env));

                registry.newTask(url, 'Boards/images', customFilename, board);

                // 图片离线地址（相对备份根目录）
                url = 'Boards/images/' + customFilename;
            }

            // 修改留言中的图片链接与索引
            img.setAttribute('src', url);
            img.setAttribute('data-idx', String(i));

            // 图片上层的超链接（无则补一层，用于生成画廊）
            const imageLink = img.parentElement && img.parentElement.tagName === 'A' ? img.parentElement : null;
            if (imageLink) {
                imageLink.setAttribute('href', url);
                imageLink.classList.add('lightgallery');
            } else {
                const wrapper = doc.createElement('a');
                wrapper.className = 'lightgallery';
                wrapper.setAttribute('href', url);
                img.replaceWith(wrapper);
                wrapper.appendChild(img);
            }
        }

        // 替换无协议图片地址
        board.htmlContent = container.innerHTML;

        // 下载留言文本里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
        await registry.addEmoticons([board.htmlContent], board);

        // 留言回复（replyList）里的 QQ 表情同样要下载，与 MD/查看器对回复内容的转换一致
        for (const reply of board.replyList || []) {
            await registry.addEmoticons([reply.htmlContent, reply.content, reply.msgContent], board);
        }
    }
}
