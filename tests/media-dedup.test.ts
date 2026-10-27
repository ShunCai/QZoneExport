import { describe, it, expect, vi } from 'vitest';
import { normalizeForDedup, getFileSuffixByUrl, hashString, makeDownloadUrl } from '../core/shared/utils';
import { getVideoFileName, addVideoTasks, type VideoLike } from '../core/collector/modules/video-tasks';
import { MediaTaskRegistry } from '../core/collector/modules/helpers';
import { buildVideoFileName } from '../core/collector/modules/videos';

// 模拟 QQ 空间视频 CDN 地址（带防盗链 token/key 查询参数）
const VIDEO_BASE =
    'https://photovideo.photo.qq.com/1074_0b535fgxuqya24afdyldnntdf2iepl2qaoka.f20.mp4';
const VIDEO_TOK1 = VIDEO_BASE + '?dis_k=AAAA&dis_t=111&vuin=999';
const VIDEO_TOK2 = VIDEO_BASE + '?dis_k=BBBB&dis_t=222&vuin=888';
const VIDEO_OTHER = 'https://photovideo.photo.qq.com/9999_zzzzzzzzzzzzzzzzzzzz.f20.mp4?dis_k=AAAA';

describe('normalizeForDedup', () => {
    it('剔除查询参数与片段，仅保留 origin+pathname', () => {
        expect(normalizeForDedup(VIDEO_TOK1)).toBe(VIDEO_BASE);
        expect(normalizeForDedup(VIDEO_BASE + '#t=10')).toBe(VIDEO_BASE);
    });
    it('协议相对地址退化去参', () => {
        expect(normalizeForDedup('//photovideo.photo.qq.com/x/y.mp4?dis_k=1')).toBe(
            '//photovideo.photo.qq.com/x/y.mp4',
        );
    });
    it('同一视频不同 token 归一化后相同', () => {
        expect(normalizeForDedup(VIDEO_TOK1)).toBe(normalizeForDedup(VIDEO_TOK2));
    });
});

describe('视频文件名去重（方案A：仅视频去参）', () => {
    it('getVideoFileName：同一视频不同 token → 相同文件名', () => {
        expect(getVideoFileName(VIDEO_TOK1)).toBe(getVideoFileName(VIDEO_TOK2));
    });
    it('getVideoFileName：路径能提取文件名时直接用路径末段（无 token）', () => {
        expect(getVideoFileName(VIDEO_TOK1)).toBe('1074_0b535fgxuqya24afdyldnntdf2iepl2qaoka.f20.mp4');
    });
    it('buildVideoFileName：链接指纹=去参哈希，同一视频不同 token → 相同文件名（支持去重）', () => {
        const f1 = buildVideoFileName({ custom_url: VIDEO_TOK1 } as any);
        const f2 = buildVideoFileName({ custom_url: VIDEO_TOK2 } as any);
        // 链接指纹（Default）对去参后的 URL 做哈希：同一视频（仅防盗链 token 不同）总得同名，
        // 使下载管理器按 module+dir+name 去重时能识别为同一文件，避免重复下载/串位。
        expect(f1).toBe(f2);
    });
    it('不同视频 → 不同文件名', () => {
        const a = buildVideoFileName({ custom_url: VIDEO_TOK1 } as any);
        const b = buildVideoFileName({ custom_url: VIDEO_OTHER } as any);
        expect(a).not.toBe(b);
    });
    // 注：预览图文件名已不再由「预览 URL 哈希」生成（见文件末尾 addVideoTasks 测试）。
    // normalizeForDedup(previewUrl) 仍会把仅 query 不同的预览 URL 归一化到同一 key，
    // 但预览图文件名现绑定「视频身份」，故不同视频即便预览 URL 撞名也得到不同文件名（修复串位/少下）。
});

describe('图片（方案A：保持完整地址，不去参）', () => {
    it('normalizeForDedup 仅用于视频路径，图片 hash 仍基于完整 URL', () => {
        const imgTok1 = 'https://b.qpic.cn/photo/abc.jpg?k=1&t=2';
        const imgTok2 = 'https://b.qpic.cn/photo/abc.jpg?k=9&t=8';
        // 图片未经 normalizeForDedup，两个不同 token 应得到不同哈希（保持现状，避免误合并）
        expect(hashString(imgTok1)).not.toBe(hashString(imgTok2));
    });
});

describe('getFileSuffixByUrl 改进（剔除 # 片段）', () => {
    it('含 # 片段无 ? 时仍能提取后缀', () => {
        expect(getFileSuffixByUrl('https://x/a.mp4#t=5')).toBe('.mp4');
    });
    it('含 ? 查询参数时提取后缀', () => {
        expect(getFileSuffixByUrl('https://x/a.mp4?dis_k=1')).toBe('.mp4');
    });
    it('? 与 # 同时存在时取更靠前的切点', () => {
        expect(getFileSuffixByUrl('https://x/a.mp4?x=1#frag')).toBe('.mp4');
    });
    it('无扩展名时回退默认值', () => {
        expect(getFileSuffixByUrl('https://x/noext?k=1', '.jpg')).toBe('.jpg');
    });
});

describe('视频预览图文件名绑定视频身份（修复串位/少下载）', () => {
    function fakeEnv() {
        const tasks: any[] = [];
        return {
            tasks,
            config: {
                Common: { downloadType: 'Browser' },
                Videos: { fileStructureType: '' },
            },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            addMediaTask: (t: any) => {
                tasks.push(t);
            },
        } as any;
    }

    it('不同视频的预览 URL 仅 query 不同时，预览图文件名必须不同（且不串位）', async () => {
        const env = fakeEnv();
        const registry = new MediaTaskRegistry(env, 'Videos');
        const v1 = {
            url: 'https://photovideo.photo.qq.com/1074_aaaa.mp4',
            pre: 'https://cover.qpic.cn/abc.jpg?w=320&dis_k=1',
        } as VideoLike;
        const v2 = {
            url: 'https://photovideo.photo.qq.com/1074_bbbb.mp4',
            pre: 'https://cover.qpic.cn/abc.jpg?w=640&dis_k=2',
        } as VideoLike;
        // 触发原 bug 的前提：两个预览 URL 归一化后撞同一 key
        expect(normalizeForDedup(v1.pre!)).toBe(normalizeForDedup(v2.pre!));

        await addVideoTasks(env, registry, [v1, v2], 'Videos/images', undefined, {
            videoFileName: (v) => buildVideoFileName(v as any),
        });

        // 修复后：不同视频即便预览 URL 撞名，也得到不同预览文件名
        expect(v1.custom_pre_filename).not.toBe(v2.custom_pre_filename);
        // 预览图与视频本体共用同一基准名（仅后缀不同），一一对应
        expect(v1.custom_pre_filename).toBe(v1.custom_filename!.replace(/\.mp4$/, '.jpeg'));
        expect(v2.custom_pre_filename).toBe(v2.custom_filename!.replace(/\.mp4$/, '.jpeg'));
        // 两张预览图都应登记下载任务（不再被去重折叠成一张）
        const previewTasks = env.tasks.filter((t: any) => t.name.endsWith('.jpeg'));
        expect(previewTasks.length).toBe(2);
    });

    it('若仍用预览 URL 哈希命名（旧逻辑）会撞名——反例说明修复必要性', () => {
        const oldStyle = (pre: string) => hashString(normalizeForDedup(pre)) + '.jpeg';
        expect(oldStyle('https://cover.qpic.cn/abc.jpg?w=320&dis_k=1')).toBe(
            oldStyle('https://cover.qpic.cn/abc.jpg?w=640&dis_k=2'),
        );
    });
});

describe('同名视频去歧义（方案 A：仅重名追加短哈希后缀）', () => {
    function makeEnv() {
        const tasks: any[] = [];
        return {
            tasks,
            config: { Common: { downloadType: 'Browser' }, Videos: { fileStructureType: '' } },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            addMediaTask: (t: any) => {
                tasks.push(t);
            },
        } as any;
    }

    it('RenameType=Name 下同名视频：第 2 个起追加后缀，两个视频都登记（防静默丢视频）', async () => {
        const env = makeEnv();
        const registry = new MediaTaskRegistry(env, 'Videos');
        // 三个同名视频（不同 URL）：文件名原本全是「我的视频.mp4」
        const mk = (id: string) => ({
            name: '我的视频',
            url: `https://photovideo.photo.qq.com/1074_${id}.mp4`,
            pre: 'https://cover.qpic.cn/same.jpg',
        }) as VideoLike;
        const [v1, v2, v3] = [mk('aaaa'), mk('bbbb'), mk('cccc')];

        await addVideoTasks(env, registry, [v1, v2, v3], 'Videos/images', undefined, {
            videoFileName: (v) => buildVideoFileName(v as any, 'Name'),
        });

        // 第一个保持原名（不引发既有备份文件名变动 / 全量重下）
        expect(v1.custom_filename).toBe('我的视频.mp4');
        // 第 2、3 个追加短哈希后缀，且互不撞名
        expect(v2.custom_filename).toMatch(/^我的视频_[0-9a-z]{6}\.mp4$/);
        expect(v3.custom_filename).toMatch(/^我的视频_[0-9a-z]{6}\.mp4$/);
        expect(new Set([v1.custom_filename, v2.custom_filename, v3.custom_filename]).size).toBe(3);
        // 预览图与视频本体仍一一对应
        expect(v2.custom_pre_filename).toBe(v2.custom_filename!.replace(/\.mp4$/, '.jpeg'));
        // 三个视频本体 + 三张预览图全部登记（修复前同名会被 upsert 折叠，只剩 1 个）
        expect(env.tasks.filter((t: any) => t.name.endsWith('.mp4')).length).toBe(3);
        expect(env.tasks.filter((t: any) => t.name.endsWith('.jpeg')).length).toBe(3);
    });

    it('不同标题不受影响，不追加后缀（方案 A 只动重名者）', async () => {
        const env = makeEnv();
        const registry = new MediaTaskRegistry(env, 'Videos');
        const a = { name: '视频A', url: 'https://photovideo.photo.qq.com/1074_aaaa.mp4' } as VideoLike;
        const b = { name: '视频B', url: 'https://photovideo.photo.qq.com/1074_bbbb.mp4' } as VideoLike;
        await addVideoTasks(env, registry, [a, b], 'Videos/images', undefined, {
            videoFileName: (v) => buildVideoFileName(v as any, 'Name'),
        });
        expect(a.custom_filename).toBe('视频A.mp4');
        expect(b.custom_filename).toBe('视频B.mp4');
    });

    it('filenameValidate 归并后的碰撞（视频:A / 视频/A / 视频 A）也必须去歧义', async () => {
        const env = makeEnv();
        const registry = new MediaTaskRegistry(env, 'Videos');
        const mk = (n: string, id: string) => ({
            name: n,
            url: `https://photovideo.photo.qq.com/1074_${id}.mp4`,
        }) as VideoLike;
        const [a, b, c] = [mk('视频:A', 'aaaa'), mk('视频/A', 'bbbb'), mk('视频 A', 'cccc')];
        await addVideoTasks(env, registry, [a, b, c], 'Videos/images', undefined, {
            videoFileName: (v) => buildVideoFileName(v as any, 'Name'),
        });
        // 三者经 filenameValidate 都会归并成 视频_A.mp4 → 必须靠去歧义分开
        expect(new Set([a.custom_filename, b.custom_filename, c.custom_filename]).size).toBe(3);
    });
});

describe('断点去重键去 token（跨会话续传不重复下载）', () => {
    it('同一视频不同 token：先以下载(token1)写入去重集，再用 token2 续传检查应判「已下载」跳过', async () => {
        const dir = 'Messages/images';
        // 模拟「上一轮备份」已下载 token1 的同一视频，去重集写入【去参后】的键
        const keyTok1 = dir + '\u0000' + normalizeForDedup(makeDownloadUrl(VIDEO_TOK1, true));
        const downloaded = new Set([keyTok1]);
        const env = {
            config: { Common: { downloadType: 'Browser', mediaMode: 'Browser' }, Videos: {} },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            getDownloadedUrls: async () => downloaded,
            addMediaTask: vi.fn(),
        } as any;
        const registry = new MediaTaskRegistry(env, 'Messages');
        const name = getVideoFileName(VIDEO_TOK2); // 续传时拿到的 URL 是 token2
        // 续传检查：用 token2 的下载地址查去重集
        await (registry as any).newTask(makeDownloadUrl(VIDEO_TOK2, true), dir, name, undefined, false);
        // token 不同但去参后指向同一资源 → 应判为已下载，不再登记下载任务（不重复下载）
        expect(env.addMediaTask).not.toHaveBeenCalled();
    });

    it('不同视频（路径不同）即使 token 相同也不误判为已下载', async () => {
        const dir = 'Messages/images';
        const keyOther = dir + '\u0000' + normalizeForDedup(makeDownloadUrl(VIDEO_OTHER, true));
        const downloaded = new Set([keyOther]);
        const env = {
            config: { Common: { downloadType: 'Browser', mediaMode: 'Browser' }, Videos: {} },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            getDownloadedUrls: async () => downloaded,
            addMediaTask: vi.fn(),
        } as any;
        const registry = new MediaTaskRegistry(env, 'Messages');
        const name = getVideoFileName(VIDEO_TOK1);
        await (registry as any).newTask(makeDownloadUrl(VIDEO_TOK1, true), dir, name, undefined, false);
        // 路径不同 → 不同资源 → 应登记下载任务
        expect(env.addMediaTask).toHaveBeenCalledTimes(1);
    });
});
