// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { Requester } from '../core/qzone-api/request';
import { Logger } from '../core/shared/logger';
import type { CollectContext } from '../core/collector/pipeline';
import type { CollectorEnv, MediaTask, QzoneBackupConfig } from '../core/collector/modules/types';
import { hasNextPage, isGetNextPage, collectPagedList, MediaTaskRegistry, collectLikes } from '../core/collector/modules/helpers';
import { MessagesCollector, convertMessages, dealLbs, filterKeyWords, isMatchFilterKey } from '../core/collector/modules/messages';
import { BoardsCollector } from '../core/collector/modules/boards';
import { FriendsCollector } from '../core/collector/modules/friends';
import { VisitorsCollector } from '../core/collector/modules/visitors';
import { convertFavorites } from '../core/collector/modules/favorites';
import { sortBlogs } from '../core/collector/modules/blogs';
import { processBlogDetail } from '../core/collector/modules/blog-html';
import { convertShares } from '../core/collector/modules/shares';
import { buildVideoFileName, getFileStructureFolderPath } from '../core/collector/modules/videos';
import { PhotosCollector, getDownloadUrl, getImageFileName, getPhotoSuffix, sortAlbums } from '../core/collector/modules/photos';
import { makeDownloadUrl, normalizeForDedup } from '../core/shared/url';
import { DL_DOWNLOADED_SEP } from '../core/collector/checkpoint';
import { PageLedger } from '../core/collector/reliability';
import type { KvArea } from '../core/store/backup-db';

/**
 * 模块采集器单测（P3）
 * 用可注入的 CollectorEnv 替换网络与文件写出，逐个校验采集流程的关键行为：
 * 翻页终止、增量跳过、数据加工、媒体任务登记、产出文件与全局变量名
 */

/** 最小可用配置（各模块 pageSize 取小值便于构造分页） */
function makeConfig(overrides: Record<string, any> = {}): QzoneBackupConfig {
    const seconds = { min: 0, max: 0 };
    const base: any = {
        Common: { mediaMode: 'Download', downloadType: 'Browser', isAutoFileSuffix: false, AvatarHost: -1 },
        Messages: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            isFilterKeyword: false,
            FilterKeyWords: [],
            refreshWeChatLbs: false,
            GetVoice: false,
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 2, randomSeconds: seconds },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'created_time',
        },
        Blogs: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            Info: { randomSeconds: seconds },
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 2, randomSeconds: seconds },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'pubTime',
        },
        Diaries: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            Info: { randomSeconds: seconds },
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 2, randomSeconds: seconds },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'pubtime',
        },
        Boards: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'pubtime',
        },
        Friends: {
            exportType: 'HTML',
            randomSeconds: seconds,
            Interactive: false,
            ZoneAccess: false,
            SpecialCare: false,
            IncrementType: 'Full',
            SortType: 'QQ',
        },
        Photos: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Images: {
                pageSize: 2,
                listType: 'List',
                randomSeconds: seconds,
                Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
                exifType: 'raw',
                Info: { isGet: false, pageSize: 2, randomSeconds: seconds },
                isGetVideo: false,
            },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'uploadTime',
        },
        Videos: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'uploadTime',
        },
        Favorites: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'create_time',
        },
        Shares: {
            exportType: 'HTML',
            pageSize: 2,
            randomSeconds: seconds,
            Info: { randomSeconds: seconds },
            Comments: { isGet: false, pageSize: 2, randomSeconds: seconds },
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 2, randomSeconds: seconds },
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'shareTime',
            SourceType: [{ name: 'QQ空间', regulars: 'qzone.qq.com' }],
        },
        Visitors: {
            exportType: 'HTML',
            randomSeconds: seconds,
            IncrementType: 'Full',
            IncrementTime: '2000-01-01 00:00:00',
            IncrementField: 'time',
        },
        Dev: { Maps: { TxKey: '' } },
    };
    // 浅合并顶层模块，便于用例只覆盖关心的字段
    for (const key of Object.keys(overrides)) {
        base[key] = { ...base[key], ...overrides[key] };
    }
    return base as QzoneBackupConfig;
}

/** 测试环境：按URL前缀返回预置响应，记录产物与媒体任务 */
function makeEnv(
    responses: Array<{ match: string; body: string | ((url: string) => string) }>,
    config = makeConfig(),
    oldData: Record<string, unknown> = {},
) {
    const files = new Map<string, { global: string; data: unknown }>();
    const texts = new Map<string, string>();
    const tasks: MediaTask[] = [];
    const progress: Array<{ phase: string; done: number; total: number }> = [];
    const requestedUrls: string[] = [];

    // 用真实 Response 构造响应（请求器需要 arrayBuffer/headers 来按编码解码）
    const fetchFn = (async (url: string) => {
        requestedUrls.push(url);
        const hit = responses.find((item) => url.includes(item.match));
        const body = hit ? (typeof hit.body === 'function' ? hit.body(url) : hit.body) : '{"code":0,"data":{}}';
        return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }) as unknown as typeof fetch;

    const env: CollectorEnv = {
        ctx: { ownerUin: 1001, targetUin: 1001, gtk: 123, token: 'tk', route: 102 },
        config,
        requester: new Requester({
            config: () => ({ listRetryCount: 0, listRetrySleep: 0, waitCount: 0, waitTime: 0, RestSleepUrls: [] }),
            fetchFn,
            sleepFn: async () => {},
        }),
        logger: new Logger({ mirror: false }),
        tick: async () => {},
        report: async (phase, done, total) => {
            progress.push({ phase, done, total });
        },
        fail: () => {},
        getOldData: async (module) => oldData[module] as any,
        addMediaTask: (task) => tasks.push(task),
        detectSuffix: async () => '.jpg',
        writeJsonToJs: async (global, data, path) => {
            files.set(path, { global, data });
        },
        writeText: async (text, path) => {
            texts.set(path, text);
        },
        writeFile: async () => {},
        loadStaging: async () => undefined,
        saveStaging: async () => {},
        sleep: async () => {},
    };
    return { env, files, texts, tasks, progress, requestedUrls };
}

/** pipeline 上下文桩（采集器只用 tick/report，二者由引擎透传） */
const fakeCtx = { uin: 1001, report: async () => {}, tick: async () => {} } as unknown as CollectContext;

describe('采集公共助手', () => {
    it('hasNextPage 同时受总数与页码约束', () => {
        expect(hasNextPage(1, 20, 100, new Array(20))).toBe(true);
        // 已取满总数
        expect(hasNextPage(5, 20, 100, new Array(100))).toBe(false);
        // 页码已越过总数
        expect(hasNextPage(6, 20, 100, new Array(50))).toBe(false);
    });

    it('isGetNextPage：全量always继续，上次备份在无历史数据时继续', () => {
        const full = { IncrementType: 'Full', IncrementTime: '2020-01-01 00:00:00', IncrementField: 'created_time' };
        expect(isGetNextPage(undefined, [], full)).toBe(true);
        const last = { IncrementType: 'LastTime', IncrementTime: '2020-01-01 00:00:00', IncrementField: 'created_time' };
        expect(isGetNextPage([], [{ created_time: 1893456000 }], last)).toBe(true);
        // 有历史数据且本页已到增量位置（条目时间早于增量时间）时停止
        expect(isGetNextPage([{ created_time: 1 }], [{ created_time: 946684800 }], last)).toBe(false);
    });

    it('collectPagedList 单页失败后跳过继续后续页（与旧版 callNextPage 一致）', async () => {
        const { env } = makeEnv([]);
        const calls: number[] = [];
        const items = await collectPagedList<any>({
            env,
            moduleCfg: env.config.Messages,
            phase: 'list',
            fetchPage: async (pageIndex) => {
                calls.push(pageIndex);
                if (pageIndex === 1) {
                    throw new Error('模拟中间页失败');
                }
                return { items: [{ id: pageIndex * 2 }, { id: pageIndex * 2 + 1 }], total: 6 };
            },
        });
        // 中间页失败后仍推进到末页，失败页的条目丢弃
        expect(calls).toEqual([0, 1, 2]);
        expect(items.map((item) => item.id)).toEqual([0, 1, 4, 5]);
    });

    it('collectLikes：is_dolike=1 时把「我」补进点赞名单并计入总数', async () => {
        // 接口返回 is_dolike=1 但 like_uin_info 不包含操作者(ownerUin=1001)；首页有 1 人，次页空即翻页结束
        let page = 0;
        const { env } = makeEnv([{
            match: 'like_list_app',
            body: () => {
                page++;
                return JSON.stringify({
                    code: 0,
                    data: page === 1
                        ? { total_number: 1, is_dolike: 1, like_uin_info: [{ fuin: 2002, nick: '别人', if_qq_friend: 1 }] }
                        : { total_number: 1, is_dolike: 1, like_uin_info: [] },
                });
            },
        }]);
        const item: any = { uniKey: 'msg1', likes: [] };
        await collectLikes(env, item, { isGet: true, randomSeconds: { min: 0, max: 0 } });
        const uins = item.likes.map((l: any) => String(l.fuin ?? l.uin));
        expect(uins).toContain('1001'); // 操作者已被补进
        expect(item.likeTotal).toBe(2);  // 总数 +1（2002 + 我）
    });

    it('首页失败且总数未知时停止翻页（hasNextPage 依赖总数）', async () => {
        const { env } = makeEnv([]);
        const calls: number[] = [];
        const items = await collectPagedList<any>({
            env,
            moduleCfg: env.config.Messages,
            phase: 'list',
            fetchPage: async (pageIndex) => {
                calls.push(pageIndex);
                throw new Error('模拟首页失败');
            },
        });
        expect(calls).toEqual([0]);
        expect(items.length).toBe(0);
    });

    it('截断页（实采<期望，被判 missing/dead）的数据仍保留在产出，不整页丢弃', async () => {
        // 内存 KvArea（与 reliability.test 同构），供 PageLedger 记账
        const store: Record<string, unknown> = {};
        const area: KvArea = {
            async get(keys) {
                if (keys === null) return { ...store };
                const result: Record<string, unknown> = {};
                for (const k of (Array.isArray(keys) ? keys : [keys])) if (store[k] !== undefined) result[k] = store[k];
                return result;
            },
            async set(items) { Object.assign(store, items); },
            async remove(keys) { for (const k of (Array.isArray(keys) ? keys : [keys])) delete store[k]; },
        };
        const ledger = new PageLedger(area);

        const { env } = makeEnv([]);
        const afterPages: number[][] = [];
        // pageSize=2（makeConfig），total=5 → 期望 page0=2 / page1=2 / page2=1；
        // page1 只回 1 条（QQ空间截断）→ 应判 missing，但这一条必须保留进产出
        const items = await collectPagedList<any>({
            env,
            moduleCfg: env.config.Messages,
            phase: 'list',
            reliability: { ledger, uin: '1001', module: 'Messages', batchId: 'b1' },
            fetchPage: async (pageIndex) => {
                if (pageIndex === 0) return { items: [{ id: 0 }, { id: 1 }], total: 5 };
                if (pageIndex === 1) return { items: [{ id: 2 }], total: 5 };
                return { items: [{ id: 3 }, { id: 4 }], total: 5 };
            },
            afterPage: async (_allItems, _pageIndex, pageItems) => {
                afterPages.push(pageItems.map((i) => i.id));
            },
        });

        // 截断页的 1 条数据必须保留在最终产出，且 afterPage 已处理（写 staging/媒体）
        expect(items.map((i) => i.id)).toEqual([0, 1, 2, 3, 4]);
        expect(afterPages).toEqual([[0, 1], [2], [3, 4]]);
        // 该页被正确记为 missing（实采1/期望2），而非「成功」或「整页丢弃」
        const rec = await ledger.get('1001', 'Messages', 1);
        expect(rec?.state).toBe('missing');
        expect(rec?.itemCount).toBe(1);
        expect(rec?.expectedCount).toBe(2);
    });

    it('collectPagedList 进入列表前先预置 list 为采集中(indeterminate)，避免第一页明细处理期间进度条倒退', async () => {
        const { env } = makeEnv([]);
        // 捕获完整上报（含第6参 subject），复现「首帧渲染时 subject['list'] 尚未写入」的场景
        const reports: Array<{ phase: string; done: number; total: number; subject?: { done: number; total: number } }> = [];
        env.report = async (phase, done, total, _failed, _label, subject) => {
            reports.push({ phase, done, total, subject });
        };
        await collectPagedList<any>({
            env,
            moduleCfg: env.config.Messages,
            phase: 'list',
            fetchPage: async (pageIndex) => {
                if (pageIndex === 0) return { items: [{ id: 1 }, { id: 2 }], total: 234 };
                return { items: [], total: 234 };
            },
        });
        // 第一条 list 上报必须是 indeterminate 预置（done=0,total=-1），
        // 保证第一页明细（done=total）处理期间 computeSubjectProgress 走 subject 分支、
        // 显示「采集中」而非回落 sum 公式算成 100%
        const firstList = reports.find((r) => r.phase === 'list');
        expect(firstList).toBeTruthy();
        expect(firstList!.subject).toEqual({ done: 0, total: -1 });
        // 首条 list 上报时 done 必须为 0（即它发生在拉取第一页之前）
        expect(firstList!.done).toBe(0);
    });

    it('MediaTaskRegistry 同URL只登记一次且文件名稳定，外链模式不登记', async () => {
        const { env, tasks } = makeEnv([]);
        const registry = new MediaTaskRegistry(env, 'Messages');
        const a: any = {};
        const b: any = {};
        await registry.add(a, 'http://qpic.cn/a.jpg', 'Messages/images', { tid: '1' });
        await registry.add(b, 'http://qpic.cn/a.jpg', 'Messages/images', { tid: '2' });
        expect(tasks.length).toBe(1);
        // 两个引用对象都拿到同一本地路径
        expect(a.custom_filename).toBe(b.custom_filename);
        expect(a.custom_filepath).toBe('Messages/images/' + a.custom_filename);
        // 下载地址追加了下载参数
        expect(tasks[0]!.url).toContain('save=1');

        // 外链模式（mediaMode=Link）不登记下载任务
        const linkEnv = makeEnv([], makeConfig({ Common: { mediaMode: 'Link' } }));
        const linkRegistry = new MediaTaskRegistry(linkEnv.env, 'Messages');
        const c: any = {};
        await linkRegistry.add(c, 'http://qpic.cn/a.jpg', 'Messages/images');
        expect(linkEnv.tasks.length).toBe(0);
        expect(c.custom_url).toBe('http://qpic.cn/a.jpg');
    });

    it('已下载 URL 在同一目录二次备份中跳过下载任务，但仍回写 local 路径', async () => {
        const { env, tasks } = makeEnv([]);
        // 模拟上一轮备份已将「该目录下的下载地址」写入断点集合（目录级键）
        const dl = makeDownloadUrl('http://qpic.cn/a.jpg', true);
        // 模拟上一轮备份已将「该目录下的下载地址」写入断点集合。
        // 注意：生产 markDownloadedBatch 存储的是 normalizeForDedup(url)（剥离 save=1&d=1 等查询参数），
        // 故此处须用去参后的键，否则读取侧 normalizeForDedup 匹配不上（H-4b 原失败根因 = 测试失 fidelity）。
        env.getDownloadedUrls = async () => new Set(['Messages/images' + DL_DOWNLOADED_SEP + normalizeForDedup(dl)]);
        const registry = new MediaTaskRegistry(env, 'Messages');
        const a: any = {};
        await registry.add(a, 'http://qpic.cn/a.jpg', 'Messages/images', { tid: '1' });
        // 同目录同 URL 不应再登记下载任务
        expect(tasks.length).toBe(0);
        // 但仍回写本地路径字段，使查看器能引用已落盘的文件
        expect(a.custom_filename).toBeTruthy();
        expect(a.custom_filepath).toBe('Messages/images/' + a.custom_filename);
    });

    it('模块级去重：其他模块目录已下载的同一 URL 不会被误杀，仍会下载本模块副本', async () => {
        const { env, tasks } = makeEnv([]);
        const dl = makeDownloadUrl('http://qpic.cn/a.jpg', true);
        // 收藏引用的图片，此前已由「说说」模块下载过（不同目录）。生产存去参键，保持一致。
        env.getDownloadedUrls = async () => new Set(['Messages/images' + DL_DOWNLOADED_SEP + normalizeForDedup(dl)]);
        const registry = new MediaTaskRegistry(env, 'Favorites');
        const a: any = {};
        await registry.add(a, 'http://qpic.cn/a.jpg', 'Favorites/images', { id: 'f1' });
        // 目录不同 → 不被跨模块去重误杀，应登记本模块下载任务
        expect(tasks.length).toBe(1);
        expect(tasks[0]!.dir).toBe('Favorites/images');
        // 回写本地路径指向本模块目录（文件会真实落盘于此）
        expect(a.custom_filepath).toBe('Favorites/images/' + a.custom_filename);
    });
});

describe('说说采集器', () => {
    it('翻页至总数并写出 messages 数据文件，登记配图任务', async () => {
        const page = (pos: number) =>
            JSON.stringify({
                code: 0,
                total: 3,
                msglist:
                    pos === 0
                        ? [
                              { tid: 't1', content: 'a', created_time: 1600000000, pic: [{ url2: 'http://qpic.cn/1.jpg' }] },
                              { tid: 't2', content: 'b', created_time: 1500000000 },
                          ]
                        : [{ tid: 't3', content: 'c', created_time: 1400000000 }],
            });
        const { env, files, tasks } = makeEnv([
            { match: 'emotion_cgi_msglist_v6', body: (url) => `_preloadCallback(${page(url.includes('pos=2') ? 2 : 0)});` },
        ]);
        await new MessagesCollector(env).collect(fakeCtx);

        const file = files.get('Messages/json/messages.js');
        expect(file?.global).toBe('messages');
        const items = file?.data as any[];
        expect(items.map((item) => item.tid)).toEqual(['t1', 't2', 't3']);
        // 时间倒序 + custom_* 加工字段
        expect(items[0]!.custom_create_time).toBeTruthy();
        expect(items[0]!.uniKey).toBe('http://user.qzone.qq.com/1001/mood/t1');
        // 配图登记为下载任务
        expect(tasks.some((task) => task.module === 'Messages' && task.dir === 'Messages/images')).toBe(true);
    });

    it('convert 生成 custom_* 字段并解析趣味表情地址', () => {
        const items = convertMessages(
            [
                {
                    tid: 't1',
                    content: 'x',
                    created_time: 1600000000,
                    pictotal: 2,
                    pic: [{ url1: 'a' }],
                    magic: [{ url1: '{"$type":"magicEmoticon","id":88}' }],
                    video: [{ video_id: 'http://v.qq.com/abc' }],
                } as any,
            ],
            1001,
        );
        const item = items[0]!;
        expect(item.imagetotal).toBe(2);
        expect(item.custom_images!.length).toBe(1);
        expect(item.custom_magics![0]!.custom_url).toBe('http://qzonestyle.gtimg.cn/qzone/em/120/mb88.jpg');
        // 视频ID去掉腾讯视频前缀
        expect(item.custom_videos![0]!.video_id).toBe('abc');
    });

    it('屏蔽词过滤支持 && 组合条件', () => {
        expect(isMatchFilterKey('现货送礼', ['现货&&送礼'])).toBe(true);
        expect(isMatchFilterKey('现货', ['现货&&送礼'])).toBe(false);
        const items = [{ custom_content: '限时促销' }, { custom_content: '日常记录' }] as any[];
        filterKeyWords(items, { isFilterKeyword: true, FilterKeyWords: ['促销'] });
        expect(items.length).toBe(1);
        expect(items[0]!.custom_content).toBe('日常记录');
    });

    it('dealLbs 处理放大百万倍的坐标', () => {
        const items = [{ lbs: { pos_x: '116397428', pos_y: '39909187' } }] as any[];
        dealLbs(items);
        expect(items[0]!.lbs.pos_x).toBeCloseTo(116.397428, 5);
        expect(items[0]!.lbs.pos_y).toBeCloseTo(39.909187, 5);
    });

    it('全特性：图片/视频/语音/表情/评论配图均回写 custom_filepath', async () => {
        const msglist = JSON.stringify({
            code: 0, total: 1,
            msglist: [{
                tid: 't1', content: 'hi', created_time: 1600000000, pictotal: 2,
                pic: [
                    { url1: 'http://qpic.cn/1.jpg', url2: 'http://qpic.cn/1.jpg' },
                    { url1: 'http://qpic.cn/2.jpg', url2: 'http://qpic.cn/2.jpg' },
                ],
                video: [{ video_id: 'vid1', url3: 'http://v.qq.com/abc.mp4' }],
                magic: [{ url1: '{"$type":"magicEmoticon","id":88}' }],
                voice: [{ url: 'http://voice.url/v.amr' }],
                cmtnum: 1, commentlist: [],
            }],
        });
        const detail = JSON.stringify({ code: 0, content: 'full', conlist: [] });
        const pics = JSON.stringify({ code: 0, imageUrls: ['http://qpic.cn/3.jpg', 'http://qpic.cn/4.jpg'] });
        const voice = JSON.stringify({ code: 0, data: { url: 'http://voice.url/real.amr' } });
        const cmt = JSON.stringify({ code: 0, commentlist: [{ pic: [{ hd_url: 'http://qpic.cn/c1.jpg', b_url: 'http://qpic.cn/c1.jpg' }] }] });
        const { env, files, tasks } = makeEnv([
            { match: 'emotion_cgi_msglist_v6', body: `_preloadCallback(${msglist});` },
            { match: 'emotion_cgi_msgdetail_v6', body: `_Callback(${detail});` },
            { match: 'emotion_cgi_get_pics_v6', body: `_Callback(${pics});` },
            { match: 'sound/GetVoice', body: `_Callback(${voice});` },
            { match: 'emotion_cgi_getcmtreply_v6', body: `_Callback(${cmt});` },
        ], makeConfig({ Messages: { GetVoice: true, Comments: { isGet: true, pageSize: 2, randomSeconds: { min: 0, max: 0 } } } }));
        await new MessagesCollector(env).collect(fakeCtx);
        const items = (files.get('Messages/json/messages.js')!.data) as any[];
        const it = items[0]!;
        expect(it.custom_images?.every((x: any) => x.custom_filepath)).toBe(true);
        expect(it.custom_videos?.[0]?.custom_filepath).toBeTruthy();
        expect(it.custom_magics?.[0]?.custom_filepath).toBeTruthy();
        expect(it.custom_voices?.[0]?.custom_filepath).toBeTruthy();
        expect(it.custom_comments?.[0]?.pic?.[0]?.custom_filepath).toBeTruthy();
        // 同时登记了下载任务（文件会被实际保存）
        expect(tasks.some((t) => t.module === 'Messages' && t.dir === 'Messages/images')).toBe(true);
    });

    it('长说说 has_more_con=1 时拉取详情获取完整全文（防 L447 回归）', async () => {
        // 列表接口对长说说截断 content/conlist 并置 has_more_con=1，但仍返回（截断的）conlist。
        // 旧代码的「conlist 非空即跳过详情拉取」会误判已就绪而漏抓全文。
        const truncatedCon = '这是前半段……';
        const msglist = JSON.stringify({
            code: 0, total: 1,
            msglist: [{
                tid: 't-long', content: truncatedCon, created_time: 1600000000,
                conlist: [{ type: 2, con: truncatedCon }], has_more_con: 1,
                cmtnum: 0, commentlist: [],
            }],
        });
        const full = '这是前半段，这是后半段，这是完整全文内容，远超列表截断长度。';
        const detail = JSON.stringify({ code: 0, content: full, conlist: [{ type: 2, con: full }] });
        const { env, files, requestedUrls } = makeEnv([
            { match: 'emotion_cgi_msglist_v6', body: `_preloadCallback(${msglist});` },
            { match: 'emotion_cgi_msgdetail_v6', body: `_Callback(${detail});` },
        ]);
        await new MessagesCollector(env).collect(fakeCtx);
        const items = (files.get('Messages/json/messages.js')!.data) as any[];
        const entry = items[0]!;
        // 关键断言：详情接口返回的完整正文必须写回 content（回归会停留在列表截断值）
        expect(entry.content).toBe(full);
        expect(entry.conlist?.[0]?.con).toBe(full);
        // custom_content 在 convertMessages（收页时）就被固定为截断值，全文拉取后必须同步刷新，
        // 否则依赖它的屏蔽词过滤只对截断文本生效
        expect(entry.custom_content).toBe(full);
        // 且详情接口必须被实际调用
        expect(requestedUrls.some((u) => u.includes('emotion_cgi_msgdetail_v6'))).toBe(true);
    });

    it('屏蔽词只出现在长说说全文后半段时也能被过滤掉（custom_content 需随全文刷新）', async () => {
        // 截断正文里没有屏蔽词，只有详情返回的完整全文后半段才有。
        // 若 custom_content 停留在截断值，filterKeyWords 会漏过滤，屏蔽词说说被导出。
        const truncated = '今天天气不错……';
        const full = '今天天气不错，顺便说一句这是促销广告内容。';
        const msglist = JSON.stringify({
            code: 0, total: 1,
            msglist: [{
                tid: 't-filter', content: truncated, created_time: 1600000000,
                conlist: [{ type: 2, con: truncated }], has_more_con: 1,
                cmtnum: 0, commentlist: [],
            }],
        });
        const detail = JSON.stringify({ code: 0, content: full, conlist: [{ type: 2, con: full }] });
        const { env, files } = makeEnv([
            { match: 'emotion_cgi_msglist_v6', body: `_preloadCallback(${msglist});` },
            { match: 'emotion_cgi_msgdetail_v6', body: `_Callback(${detail});` },
        ], makeConfig({ Messages: { isFilterKeyword: true, FilterKeyWords: ['促销'] } }));
        await new MessagesCollector(env).collect(fakeCtx);
        const items = (files.get('Messages/json/messages.js')!.data) as any[];
        expect(items.length).toBe(0);
    });

    it('全量备份（带旧数据+多页）每页媒体都回写 custom_filepath（防逐页内联回归）', async () => {
        const pageOf = (page: number, ids: string[]) => JSON.stringify({
            code: 0, total: 3,
            msglist: ids.map((id) => ({
                tid: id, content: 'c' + id, created_time: 1600000000,
                pic: [{ url1: `http://qpic.cn/${id}.jpg`, url2: `http://qpic.cn/${id}.jpg` }],
                cmtnum: 0, commentlist: [],
            })),
        });
        const { env, files, tasks } = makeEnv([
            { match: 'emotion_cgi_msglist_v6', body: (url) => {
                const pos = Number(new URLSearchParams(url.split('?')[1]).get('pos'));
                const page = Math.floor(pos / 2);
                const ids = page === 0 ? ['t1', 't2'] : ['t3'];
                return `_preloadCallback(${pageOf(page, ids)});`;
            } },
        ], makeConfig({ Messages: { IncrementType: 'Full' } }), { Messages: [{ tid: 't0old', pic: [{ url1: 'http://qpic.cn/old.jpg' }] }] });
        await new MessagesCollector(env).collect(fakeCtx);
        const items = (files.get('Messages/json/messages.js')!.data) as any[];
        expect(items.length).toBe(3);
        // 关键：全量备份即便存在旧数据，所有新条目都须登记媒体并回写本地路径
        expect(items.every((it: any) => (it.custom_images || []).every((im: any) => !!im.custom_filepath))).toBe(true);
        expect(tasks.some((t) => t.module === 'Messages')).toBe(true);
    });
});

describe('留言采集器', () => {
    it('产出 boardInfo 对象结构（含主人寄语），私密留言给出提示文案', async () => {
        const body = JSON.stringify({
            code: 0,
            data: {
                total: 2,
                authorInfo: { htmlMsg: '欢迎光临', sign: '签名' },
                commentList: [
                    { id: 1, nick: '张三', pubtime: 1600000000, htmlContent: '<div>你好</div>' },
                    { id: 2, nick: '李四', pubtime: 1500000000, secret: 1, htmlContent: '' },
                ],
            },
        });
        const { env, files } = makeEnv([{ match: 'get_msgb', body: `_Callback(${body});` }]);
        await new BoardsCollector(env).collect(fakeCtx);

        const file = files.get('Boards/json/boards.js');
        expect(file?.global).toBe('boardInfo');
        const info = file?.data as any;
        expect(info.authorInfo.message).toBe('欢迎光临');
        expect(info.items.length).toBe(2);
        // 私密留言提示
        expect(info.items[1]!.htmlContent).toBe('主人收到一条私密留言，仅彼此可见');
        // 昵称回填
        expect(info.items[0]!.nickname).toBe('张三');
    });
});

describe('好友采集器', () => {
    it('单次拉取全部好友并按分组排序号排序，写出 friends 数据文件', async () => {
        const body = JSON.stringify({
            code: 0,
            data: {
                gpnames: [
                    { gpid: 0, gpname: '我的好友' },
                    { gpid: 1, gpname: '同学' },
                ],
                items: [
                    { uin: 2002, nick: 'B', groupid: 1 },
                    { uin: 2001, nick: 'A', groupid: 0 },
                ],
            },
        });
        const { env, files, tasks } = makeEnv([{ match: 'mfriend_list', body: `_Callback(${body});` }]);
        await new FriendsCollector(env, new (await import('../core/collector/modules/helpers')).AvatarTaskRegistry(env)).collect(fakeCtx);

        const friends = files.get('Friends/json/friends.js')?.data as any[];
        expect(files.get('Friends/json/friends.js')?.global).toBe('friends');
        // 分组名与排序号回填，按 groupSortNo 升序
        expect(friends.map((friend) => friend.uin)).toEqual([2001, 2002]);
        expect(friends[0]!.groupName).toBe('我的好友');
        expect(friends[1]!.groupSortNo).toBe(2);
        // 头像下载任务归入 Common/images
        expect(tasks.every((task) => task.dir === 'Common/images')).toBe(true);
        expect(tasks.length).toBe(2);
    });

    it('增量模式下识别已删除好友', async () => {
        const body = JSON.stringify({
            code: 0,
            data: { gpnames: [{ gpid: 0, gpname: '我的好友' }], items: [{ uin: 2001, nick: 'A', groupid: 0 }] },
        });
        const config = makeConfig({ Friends: { IncrementType: 'LastTime' } });
        const { env, files } = makeEnv(
            [{ match: 'mfriend_list', body: `_Callback(${body});` }],
            config,
            { Friends: [{ uin: 2009, nick: '已删除', groupid: 0 }] },
        );
        await new FriendsCollector(env, new (await import('../core/collector/modules/helpers')).AvatarTaskRegistry(env)).collect(fakeCtx);

        const friends = files.get('Friends/json/friends.js')?.data as any[];
        const deleted = friends.find((friend) => friend.uin === 2009);
        expect(deleted?.deleted).toBe(true);
        expect(friends.find((friend) => friend.uin === 2001)?.deleted).toBe(false);
    });

    it('全量模式下也识别并保留已删除好友（A2：删除检测始终运行）', async () => {
        const body = JSON.stringify({
            code: 0,
            data: { gpnames: [{ gpid: 0, gpname: '我的好友' }], items: [{ uin: 2001, nick: 'A', groupid: 0 }] },
        });
        const config = makeConfig({ Friends: { IncrementType: 'Full' } });
        const { env, files } = makeEnv(
            [{ match: 'mfriend_list', body: `_Callback(${body});` }],
            config,
            { Friends: [{ uin: 2009, nick: '已删除', groupid: 0 }] },
        );
        await new FriendsCollector(env, new (await import('../core/collector/modules/helpers')).AvatarTaskRegistry(env)).collect(fakeCtx);

        const friends = files.get('Friends/json/friends.js')?.data as any[];
        const deleted = friends.find((friend) => friend.uin === 2009);
        expect(deleted?.deleted).toBe(true);
        expect(friends.find((friend) => friend.uin === 2001)?.deleted).toBe(false);
    });
});

describe('访客采集器', () => {
    it('按 totalPage 翻页，产出 visitorInfo 对象并登记访问内容配图', async () => {
        const makeBody = (page: number) =>
            JSON.stringify({
                code: 0,
                data: {
                    Ishost: 1,
                    totalcount: 3,
                    totalpage: 2,
                    items: [{ uin: 3000 + page, time: 1600000000, shuoshuoes: [{ imgsrc: 'http://qpic.cn/v.jpg' }] }],
                },
            });
        const { env, files, tasks } = makeEnv([
            { match: 'cgi_get_visitor_more', body: (url) => `_Callback(${makeBody(url.includes('page=2') ? 2 : 1)});` },
        ]);
        await new VisitorsCollector(env).collect(fakeCtx);

        const file = files.get('Visitors/json/visitors.js');
        expect(file?.global).toBe('visitorInfo');
        const info = file?.data as any;
        // 两页各一条
        expect(info.items.length).toBe(2);
        expect(info.totalPage).toBe(2);
        expect(tasks.some((task) => task.dir === 'Visitors/images')).toBe(true);
    });
});

describe('收藏数据转换', () => {
    it('按类型归集多媒体并把配图URL字符串转对象', () => {
        const items = convertFavorites(
            [
                {
                    type: 5,
                    abstract: '内容',
                    create_time: 1600000000,
                    img_list: ['http://qpic.cn/1.jpg'],
                    shuoshuo_info: {
                        video_list: [{ video_info: { url: 'http://v/1.mp4' } }],
                        music_list: [{ music_info: { preview_img: 'http://qpic.cn/m.jpg' } }],
                    },
                } as any,
            ],
            1001,
            '昵称',
        );
        const item = items[0]!;
        expect(item.custom_uin).toBe(1001);
        expect(item.custom_name).toBe('昵称');
        expect(item.custom_images![0]).toEqual({ url: 'http://qpic.cn/1.jpg' });
        expect(item.custom_videos!.length).toBe(1);
        expect(item.custom_audios!.length).toBe(1);
        // 处理后移除临时来源信息
        expect(item.source_info).toBeUndefined();
    });
});

describe('日志排序与视频/相册命名', () => {
    it('日志置顶优先，其余按发表时间倒序', () => {
        // effect 第4位为置顶标记（1<<4 = 16）
        const items = [
            { title: '普通旧', pubtime: 1000, effect: 0 },
            { title: '置顶', pubtime: 500, effect: 16 },
            { title: '普通新', pubtime: 2000, effect: 0 },
        ] as any[];
        const sorted = sortBlogs(items);
        expect(sorted[0]!.title).toBe('置顶');
        expect(sorted[1]!.title).toBe('普通新');
    });

    it('视频文件名按模式生成（链接指纹=URL哈希 / Name=标题）并统一 .mp4 后缀', () => {
        const video: any = { name: '生日', custom_url: 'http://v/1.mp4' };
        // Name 模式：用视频标题
        expect(buildVideoFileName(video, 'Name')).toBe('生日.mp4');
        // Default（链接指纹）：按去参 URL 哈希，与标题无关，同 URL 同名
        const noName = { custom_url: 'http://v/1.mp4' };
        const a = buildVideoFileName(noName as any);
        const b = buildVideoFileName(noName as any);
        expect(a).toBe(b);
        expect(a.endsWith('.mp4')).toBe(true);
        // 不同 URL 得到不同哈希
        const other = { custom_url: 'http://v/2.mp4' };
        expect(buildVideoFileName(other as any)).not.toBe(a);
    });

    it('文件夹结构类型生成分类目录', () => {
        const time = new Date('2020-03-05T10:00:00').getTime();
        expect(getFileStructureFolderPath(time, 'Year')).toBe('2020年');
        expect(getFileStructureFolderPath(time, 'Month')).toBe('2020年/03月');
        expect(getFileStructureFolderPath(time, 'Date')).toBe('2020年/03月/05日');
        expect(getFileStructureFolderPath(time, undefined)).toBe('');
    });

    it('相片清晰度按 exifType 回退，后缀按 phototype 映射', () => {
        const photo: any = { url: 'n', downloadUrl: 'nd', origin: 'o', raw: 'r', raw_upload: 1, origin_upload: 1, origin_url: 'ou' };
        expect(getDownloadUrl(photo, 'raw')).toBe('r');
        expect(getDownloadUrl(photo, 'original')).toBe('ou');
        expect(getDownloadUrl(photo, undefined)).toBe('nd');
        // 原图未上传时回退高清
        expect(getDownloadUrl({ ...photo, raw_upload: 0 }, 'raw')).toBe('ou');
        expect(getPhotoSuffix({ phototype: 2 })).toBe('.gif');
        expect(getPhotoSuffix({ phototype: 3 })).toBe('.png');
        expect(getPhotoSuffix({})).toBe('.jpeg');
    });

    it('相片文件名使用相片名', () => {
        const cfg = makeConfig().Photos;
        const photo: any = { name: '合影' };
        const name = getImageFileName({ ...photo }, cfg);
        expect(name).toBe('合影');
    });

    it('相册按 classSort（分类在 classList 中的顺序）排序，而非 classid 数值', () => {
        // 模拟真实场景：classid 数值序与人工排定的分类顺序（classSort）不一致
        // classList 顺序 = [106(生活), 100(最爱), 107(其他)] → classSort: 生活=0, 最爱=1, 其他=2
        const albums = [
            { id: 'e', name: '旅游相册', classid: 107, classSort: 2, order: 0 },
            { id: 'b', name: '因为一个人', classid: 100, classSort: 1, order: 1 },
            { id: 'a', name: '校友相册', classid: 107, classSort: 2, order: 2 },
            { id: 'c', name: '爱之起源', classid: 106, classSort: 0, order: 3 },
            { id: 'd', name: '广州之旅', classid: 106, classSort: 0, order: 4 },
        ] as any[];
        sortAlbums(albums);
        // 按 classSort 升序：生活(0) 在前，最爱(1) 中部，其他(2) 在后
        const order = albums.map((album) => album.classSort);
        expect(order).toEqual([0, 0, 1, 2, 2]);
        // 同分类内保持原相对顺序（爱之起源 在 广州之旅 前）
        expect(albums.slice(0, 2).map((album) => album.name)).toEqual(['爱之起源', '广州之旅']);
        // classSort 字段不被 sortAlbums 丢弃，后续导出仍可序列化
        for (const album of albums) {
            expect(album).toHaveProperty('classSort');
        }
    });

    it('相册无 classSort（历史/旧版备份）时完整保留原数组顺序', () => {
        // 模拟 V2 旧数据：只有 classid 无 classSort，数组已按分类排好（最爱→生活→其他）
        const albums = [
            { id: 'b', name: '因为一个人', classid: 100 },
            { id: 'c', name: '爱之起源', classid: 106 },
            { id: 'a', name: '校友相册', classid: 107 },
        ] as any[];
        const orderBefore = albums.map((album) => album.name);
        sortAlbums(albums);
        // 无 classSort 时不重排，保持原顺序（即使 classid 数值非升序也不打乱）
        expect(albums.map((album) => album.name)).toEqual(orderBefore);
        expect(albums.map((album) => album.classid)).toEqual([100, 106, 107]);
    });

    it('collectAlbumList 保留相册 classid 并落盘 classSort（按 classList 顺序）', async () => {
        const { env } = makeEnv([
            {
                // 真实相册列表接口：相册带 classid，classList 给出人工排定的分类顺序
                match: 'photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3',
                body: () => '_Callback({"code":0,"data":{"albumList":['
                    + '{"id":"e","name":"旅游相册","classid":107,"allowAccess":1,"total":0,"pre":"","order":0},'
                    + '{"id":"b","name":"因为一个人","classid":100,"allowAccess":1,"total":49,"pre":"","order":1},'
                    + '{"id":"c","name":"爱之起源","classid":106,"allowAccess":1,"total":3,"pre":"","order":2}'
                    + '],"albumsInUser":3,"classList":[{"id":106,"name":"生活"},{"id":100,"name":"最爱"},{"id":107,"name":"其他"}]}})',
            },
        ], makeConfig());
        const collector = new PhotosCollector(env, []);
        // 直接调用私有 collectAlbumList（跳过照片采集的环境依赖）
        const reliability = { ledger: { record: async () => {}, listFailed: async () => [], listFailedUnder: async () => [] }, uin: '1001', batchId: 'b1' };
        const albums = await (collector as any).collectAlbumList(reliability);
        // 相册保留 classid
        const byId = (id: string) => albums.find((a: any) => a.id === id);
        expect(byId('b').classid).toBe(100);
        expect(byId('b').className).toBe('最爱');
        // classSort = 分类在 classList 中的下标：生活=0, 最爱=1, 其他=2
        expect(byId('c').classSort).toBe(0);
        expect(byId('b').classSort).toBe(1);
        expect(byId('e').classSort).toBe(2);
        // 排序后分类顺序 = classSort 升序：生活(106) → 最爱(100) → 其他(107)
        expect(albums.map((a: any) => a.classSort)).toEqual([0, 1, 2]);
    });
});

describe('日志详情与分享列表的 DOM 解析', () => {
    it('日志详情：提取内嵌JSON、图片本地化并登记下载任务', async () => {
        const { env, tasks } = makeEnv([]);
        const registry = new MediaTaskRegistry(env, 'Blogs');
        const detailHtml = `
            <html><body>
            <script>var g_oBlogData = {"data":{"title":"标题","blogid":123,"replynum":2}};
            </script>
            <div id="blogDetailDiv"><p>正文</p><img src="http://qpic.cn/b.jpg" /></div>
            </body></html>`;
        const item: any = { blogid: 123 };
        const result = await processBlogDetail(env, registry, item, detailHtml, 'Blogs/images', 'HTML', true);

        // 页面内嵌JSON被解析为详情
        expect(result.detailItem!.title).toBe('标题');
        expect(result.detailItem!.replynum).toBe(2);
        // 正文图片改为本地相对路径，并包上画廊链接（新格式：原始 UTF-8 HTML 字符串，不再 base64）
        expect(result.customHtml).toContain('images/');
        expect(result.customHtml).toContain('lightgallery');
        expect(result.customHtml).not.toContain('http://qpic.cn/b.jpg');
        // 原始HTML保留远程地址
        expect(result.html).toContain('http://qpic.cn/b.jpg');
        expect(tasks.length).toBe(1);
        expect(tasks[0]!.dir).toBe('Blogs/images');
    });

    it('分享列表：从页面提取条目，跳过无 ugcPlatform 的条目', () => {
        const cfg = makeConfig().Shares;
        const html = `
        <html><body>
        <div id="app_mod"><div class="wrap"><div class="aside col_lar bg3"><div class="mod_info bg"><div class="mod_conts"><p>2条分享</p></div></div></div></div></div>
        <ul id="shares">
            <li id="s1">
                <script>
                    var shareInfos = shareInfos || [];
                    shareInfos.push({"id":"111","type":4,"memo":"分享说明","ugcPlatform":"pc","poster":{"uin":1001,"nickname":"我"}});
                    void 0;
                </script>
                <div class="mod_info bbor3 __item_main__"><div class="mod_conts _share_desc_cont">
                    <div class="mod_details lbor"><div class="mod_brief">
                        <h5><strong><a class="c_tx _share_title" href="https://qzone.qq.com/x">标题A</a></strong></h5>
                        <p>描述A</p>
                        <p class="c_tx3 comming"><a class="c_tx3 mgrm" href="https://qzone.qq.com/from">来源</a></p>
                    </div></div>
                    <div class="c_tx3 mod_scraps"><span>2020年01月01日 10:00</span></div>
                    <span id="s1_commentCount">3</span>
                </div></div>
            </li>
            <li id="s2">
                <script>
                    var shareInfos = shareInfos || [];
                    shareInfos.push({"id":"222","type":4,"ugcPlatform":"","poster":{"uin":1001}});
                    void 0;
                </script>
                <div class="mod_info bbor3 __item_main__"><div class="mod_conts _share_desc_cont"></div></div>
            </li>
        </ul>
        </body></html>`;
        const data = convertShares(html, cfg);

        expect(data.total).toBe(2);
        // 无 ugcPlatform 的条目被跳过
        expect(data.list.length).toBe(1);
        const item = data.list[0]!;
        expect(item.id).toBe('111');
        expect(item.source!.title).toBe('标题A');
        // 来源站点按规则识别
        expect(item.source!.from.name).toBe('QQ空间');
        expect(item.commentTotal).toBe(3);
        // 点赞Key 为 00+分享人QQ+00+分享ID
        expect(item.uniKey).toBe('00100100111');
        // 中文时间文本转为秒级时间戳
        expect(item.shareTime).toBeGreaterThan(1577000000);
    });
});

describe('增量跳过行为', () => {
    it('已备份条目不再请求评论与媒体（isNewItem=false 时跳过）', async () => {
        const body = JSON.stringify({
            code: 0,
            total: 1,
            msglist: [{ tid: 't1', content: 'a', created_time: 1600000000, commentlist: [], replies: 5, pic: [{ url2: 'http://qpic.cn/1.jpg' }] }],
        });
        // 上次备份含同一条说说，增量类型为上次备份
        const config = makeConfig({
            Messages: { IncrementType: 'LastTime', IncrementTime: '2021-01-01 00:00:00', Comments: { isGet: true, pageSize: 2, randomSeconds: { min: 0, max: 0 } } },
        });
        const { env, tasks, requestedUrls } = makeEnv(
            [{ match: 'emotion_cgi_msglist_v6', body: `_preloadCallback(${body});` }],
            config,
            { Messages: [{ tid: 't1', created_time: 1600000000, isNewItem: false }] },
        );
        await new MessagesCollector(env).collect(fakeCtx);

        // 旧条目不触发评论接口，也不登记媒体任务
        expect(requestedUrls.some((url) => url.includes('emotion_cgi_getcmtreply_v6'))).toBe(false);
        expect(tasks.length).toBe(0);
    });
});

describe('相片 Detail 模式：运行内重试 + 失败游标', () => {
    const detailConfig = () => makeConfig({
        Photos: {
            Images: {
                pageSize: 2,
                listType: 'Detail',
                randomSeconds: { min: 0, max: 0 },
                Comments: { isGet: false, pageSize: 2, randomSeconds: { min: 0, max: 0 } },
                exifType: 'raw',
                Info: { isGet: false, pageSize: 2, randomSeconds: { min: 0, max: 0 } },
                isGetVideo: false,
            },
        },
    });

    it('imageInfo 首次失败重试成功，不丢批次（方案 A）', async () => {
        let infoCalls = 0;
        const { env } = makeEnv([
            {
                match: 'cgi_floatview_photo_list_v2',
                body: () => {
                    infoCalls++;
                    if (infoCalls === 1) throw new Error('simulated network error');
                    return '_Callback({"code":0,"data":{"photos":[{"picKey":"p1","name":"a"},{"picKey":"p2","name":"b"}],"last":1,"picTotal":2}})';
                },
            },
        ], detailConfig());
        const collector = new PhotosCollector(env, []);
        const album: any = { id: 'album1', name: '相册1', photoList: [], allowAccess: 1 };
        const photos = await (collector as any).collectImagesByDetail(album, [], undefined, undefined, undefined, false, 'startPicKey');
        expect(photos).toHaveLength(2);
        expect(infoCalls).toBe(2); // 首次失败 + 重试成功
    });

    it('重试耗尽仍失败时记录失败游标 cursor（方案 B，state=failed 不死 dead）', async () => {
        const { env } = makeEnv([
            { match: 'cgi_floatview_photo_list_v2', body: () => { throw new Error('simulated network error'); } },
        ], detailConfig());
        const collector = new PhotosCollector(env, []);
        const recorded: any[] = [];
        const fakeLedger = { record: async (_uin: string, _module: string, rec: any) => { recorded.push(rec); } };
        const album: any = { id: 'album1', name: '相册1', photoList: [], allowAccess: 1 };
        await (collector as any).collectImagesByDetail(album, [], undefined, undefined, { ledger: fakeLedger, uin: '1001', batchId: 'b1' }, false, 'startPicKey');
        const failRec = recorded[recorded.length - 1];
        expect(failRec.state).toBe('failed'); // 运行内重试不计入 retryCount，保留可重试性
        expect(failRec.cursor).toBe('startPicKey');
    });
});
