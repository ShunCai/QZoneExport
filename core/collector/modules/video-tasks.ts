import { hashString, normalizeForDedup, toHttps } from '../../shared/utils';
import { isNewItem, type IncrementItem } from '../increment';
import type { MediaTaskRegistry } from './helpers';
import type { CollectorEnv } from './types';

/**
 * 视频下载任务共享逻辑
 * 移植自 src/js/modules/videos.js（被说说/相册/收藏等模块复用）
 */

/** 视频对象（接口原始字段 + custom_* 回写字段） */
export interface VideoLike extends IncrementItem {
    url?: string;
    url1?: string;
    url2?: string;
    url3?: string;
    /** 原视频地址（MP4）：qq空间下发于相片/说说的详情接口，列表接口无此字段 */
    download_url?: string;
    pre?: string;
    preview_img?: string;
    play_url?: string;
    video_url?: string;
    video_id?: string;
    source_type?: string;
    rt_url?: string;
    custom_url?: string;
    custom_filename?: string;
    custom_filepath?: string;
    custom_pre_url?: string;
    custom_pre_filename?: string;
    custom_pre_filepath?: string;
    [key: string]: any;
}

/**
 * 是否腾讯视频（判断不严谨，与旧版一致）
 * 移植自 videos.js isTencentVideo（L647-663）
 */
export function isTencentVideo(video: VideoLike): boolean {
    const url2 = video.url2 || '';
    const url3 = video.url3 || '';
    if (!url2 || url3.indexOf('.mp4') > -1) {
        // 如果URL都没有值，或者地址含有.mp4，肯定是空间视频？
        return false;
    }
    if (!url2 || url3.indexOf('.m3u8') > -1) {
        // 如果URL都没有值，或者地址含有.m3u8，肯定是空间视频？
        return false;
    }
    if (url3.indexOf('tencentvideo') > -1) {
        // 该判断不严谨，但是不知道怎么判断的好
        return true;
    }
    return false;
}

/**
 * 是否外部视频（判断不严谨，与旧版一致）
 * 移植自 videos.js isExternalVideo（L669-680）
 */
export function isExternalVideo(video: VideoLike): boolean {
    const url3 = video.url3 || '';
    if (isTencentVideo(video)) {
        return true;
    }
    if (url3.indexOf('.swf') > -1) {
        // Flash地址肯定是外部视频？
        return true;
    }
    return false;
}

/**
 * 由TS片段相对地址补全完整地址
 * 移植自 videos.js applyTsUrl（L348-360）
 */
export function applyTsUrl(targetURL: string, baseURL: string): string {
    if (targetURL.indexOf('http') === 0) {
        return toHttps(targetURL);
    } else if (targetURL[0] === '/') {
        const domain = baseURL.split('/');
        return domain[0] + '//' + domain[2] + targetURL;
    } else {
        const domain = baseURL.split('/');
        domain.pop();
        return domain.join('/') + '/' + targetURL;
    }
}

/**
 * 从M3U8内容提取TS片段地址清单
 * 移植自 videos.js getUrlTsFileUrls（L330-345）
 */
export function getM3u8TsUrls(m3u8Url: string, m3u8Str: string): string[] {
    if (!m3u8Url.includes('.m3u8')) {
        return [];
    }
    const tsUrls: string[] = [];
    m3u8Str.split('\n').forEach((str) => {
        if (/^[^#]/.test(str)) {
            tsUrls.push(applyTsUrl(str, m3u8Url));
        }
    });
    return tsUrls;
}

/**
 * 根据视频地址提取文件名
 * 移植自 api.js Videos.getFileName（L4119-4127）
 */
export function getVideoFileName(link: string): string {
    // 去参：剔除防盗链 token/key 查询参数与片段，同一视频不同 token 总得同名
    const dedupLink = normalizeForDedup(link);
    try {
        const url = new URL(link);
        if (link.includes('.mp4') || link.includes('.m3u8') || link.includes('.ts')) {
            const parts = url.pathname.split('/');
            // pathname 已不含查询参数；兜底哈希也用去参地址
            return parts[parts.length - 1] || hashString(dedupLink) + '.mp4';
        }
    } catch {
        // URL异常时走哈希命名
    }
    // 无法从地址提取名时，用去参后URL哈希作文件名，同一视频（不同防盗链token）总得同名
    return hashString(dedupLink) + '.mp4';
}

/**
 * 登记M3U8的TS片段下载任务（下载M3U8文件与TS文件，便于外部合并成MP4）
 * 移植自 videos.js addDownloadTsTask（L304-324）
 */
export async function addDownloadTsTasks(
    env: CollectorEnv,
    registry: MediaTaskRegistry,
    m3u8Url: string,
    folder: string,
    source: unknown,
): Promise<void> {
    if (!m3u8Url.includes('.m3u8')) {
        return;
    }
    try {
        // 请求M3U8文件内容，获取TS文件清单
        const content = await env.requester.get(m3u8Url);
        for (const url of getM3u8TsUrls(m3u8Url, content)) {
            registry.newTask(url, folder, getVideoFileName(url), source);
        }
    } catch (error) {
        env.logger.error('获取M3U8文件内容异常 | ' + m3u8Url, error instanceof Error ? error.message : String(error));
    }
}

/**
 * 给视频文件名追加去歧义后缀（方案 A：仅对重名追加，不改动既有文件名）。
 *
 * 背景：`buildVideoFileName` 在 RenameType='Name'/'Time' 时以「视频标题」命名，
 * 而 `filenameValidate` 只替换非法字符、不做唯一化（且会把 `视频:A`/`视频/A`/`视频 A`
 * 一并归并为 `视频_A`，进一步放大碰撞）。同名视频会得到同一个文件名，
 * 进而撞同一个任务 id（下载管理器按 `module::dir::name` 去重，**不含 URL**）→
 * 被 upsert 合并成一个任务，只保留最后一个 URL，其余视频（本体 + 预览图）根本不下载。
 * （与「224 个视频只下 85 张预览」同机制，只是入口从预览 URL 归一化换成了标题重复。）
 *
 * 策略：仅当批内检测到重名时才给第 2 个及之后的视频追加短哈希后缀，第一个保持原名。
 * 这样绝大多数文件名不变（不引发全量重下），只消解真实碰撞。
 * 后缀取自「视频身份」（去参 URL，剔除防盗链 token），同一视频稳定得到同一后缀。
 */
function disambiguateFileName(filename: string, video: VideoLike, used: Set<string>): string {
    if (!used.has(filename)) {
        used.add(filename);
        return filename;
    }
    const identity = video.custom_url || video.url || video.video_url || video.url3 || video.vid || '';
    const suffix = hashString(normalizeForDedup(identity)).slice(0, 6);
    const dot = filename.lastIndexOf('.');
    const unique = dot > 0 ? `${filename.slice(0, dot)}_${suffix}${filename.slice(dot)}` : `${filename}_${suffix}`;
    used.add(unique);
    return unique;
}

/**
 * 登记视频（预览图+视频本体）下载任务
 * 移植自 videos.js addDownloadTasks（L231-298），module 为 'Videos' 时启用
 * Videos 模块按 buildVideoFileName 命名（Default=URL哈希/Name=标题/Time=标题_时间），
 * 其余模块（说说/相册/收藏）落到 <module_dir>/images。
 * 注：序号命名逻辑已下线，Name/Time 以标题为名可能撞名，故 Videos 分支统一过批内去重（仅重名追加短哈希）。
 */
export async function addVideoTasks(
    env: CollectorEnv,
    registry: MediaTaskRegistry,
    videos: VideoLike[] | undefined,
    moduleDir: string,
    source?: unknown,
    options?: {
        /** Videos 模块专用：视频文件名，返回undefined时用URL哈希 */
        videoFileName?: (video: VideoLike) => string;
        /** Videos 模块专用：分类子目录 */
        categoryPath?: (video: VideoLike) => string;
        /** 是否跳过已备份条目（Videos 模块为true） */
        skipOldItems?: boolean;
    },
): Promise<void> {
    if (!videos || registry.isQzoneUrl()) {
        // QQ空间外链不添加下载任务
        return;
    }
    // 批内已用文件名集合（配合 disambiguateFileName 消解同名视频碰撞）
    const usedNames = new Set<string>();
    for (let idx = 0; idx < videos.length; idx++) {
        const video = videos[idx]!;

        if (options?.skipOldItems && !isNewItem(video)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 解析视频本体地址（用于命名与下载），提前到预览之前，使预览图文件名绑定「视频身份」
        // 优先 download_url（原视频 MP4），缺失时回落 url / video_url / url3（转码播放档）
        video.custom_url = video.download_url || video.url || video.video_url || video.url3;

        // 计算视频文件名基准（不含后缀）：作为「预览图」与「视频本体」的共同基准，保证二者一一对应。
        // —— 关键修复：预览图文件名不再由「预览 URL 哈希」生成。
        //    原方案 preview 文件名 = hash(normalizeForDedup(previewUrl))，而 normalizeForDedup 会剔除 query
        //    （尺寸/防盗链 token），导致不同视频的预览 URL 归一化后撞同一文件名；下载管理器按
        //    module+dir+name 对任务去重，撞名后仅保留最后一个 URL 的一个下载任务
        //    → 既少下（如 224 个视频只下 85 张预览）又互相覆盖（视频A显示视频B的预览图 / 串位）。
        //    改为以「视频身份」作基准：每张视频一份独立预览图，彻底杜绝跨视频碰撞。
        let videoBase: string;
        if (options?.videoFileName) {
            // Videos 模块：按 buildVideoFileName 的命名规则（Default=URL哈希 / Name=标题 / Time=标题_时间）。
            // 注意：序号命名逻辑已下线，Name/Time 以「视频标题」为名，标题重复会撞名（历史代码注释曾误标
            // 其为「唯一」），故此处统一过一遍批内去重，仅对重名者追加短哈希后缀。
            video.custom_filename = disambiguateFileName(options.videoFileName(video), video, usedNames);
            videoBase = video.custom_filename.replace(/\.mp4$/, '');
        } else {
            // 其它模块（说说/相册/收藏）：以视频地址去参哈希作基准（唯一）；
            // 兜底串联其它身份字段，避免空地址导致多视频撞同一基准名
            const identity =
                video.custom_url || video.uniKey || video.vid || video.pre || video.url1 || video.preview_img || '';
            videoBase = hashString(normalizeForDedup(identity));
            video.custom_filename = videoBase + '.mp4';
        }

        // 添加视频预览图下载任务（预览图直接写死后缀，文件名 = 视频基准 + .jpeg，与视频一一对应）
        // 绕过断点去重：预览图可能与其他模块的图片 URL 相同（如用户将同一张图用作相册照片和视频封面），
        // 但视频预览图必须独立命名（每个视频一份），即使 URL 相同也应下载，避免跨模块断点误杀。
        video.custom_pre_url = video.pre || video.url1 || video.preview_img;
        if (video.custom_pre_url) {
            video.custom_pre_filename = videoBase + '.jpeg';
            video.custom_pre_filepath = moduleDir + '/' + video.custom_pre_filename;
            registry.newPreviewTask(video.custom_pre_url, moduleDir, video.custom_pre_filename, video);
        }

        // 如果是外部视频，跳过不下载
        if (video.play_url) {
            continue;
        }

        // 添加视频下载任务（视频/相片/收藏/说说）
        if (!video.custom_url || isExternalVideo(video)) {
            // 外部视频跳过不下载
            continue;
        }

        // 文件路径与存放文件夹
        const categoryPath = options?.categoryPath ? options.categoryPath(video) : '';
        let folder = moduleDir;
        if (options?.videoFileName) {
            // Videos 模块：按分类目录存放
            folder = categoryPath ? 'Videos/' + categoryPath : 'Videos';
        }
        // custom_filepath 用最终的 folder（即实际下载目录），而非原始 moduleDir
        video.custom_filepath = folder + '/' + video.custom_filename;

        if (video.custom_url.includes('.m3u8')) {
            // 合并产物是 MPEG-TS 流，文件名后缀用 .ts（技术上正确；原 .mp4 指向实际不存在的合并文件）
            video.custom_filename = video.custom_filename.replace(/\.mp4$/, '.ts');
            video.custom_filepath = folder + '/' + video.custom_filename;
            if (env.config.Common.downloadType === 'Disk') {
                // 助手直写目录模式：注册单个 M3U8 复合任务，
                // 由 DiskDriver 自动拉取分片列表、按需下载/续传、按序合并为完整视频文件
                registry.newTask(video.custom_url, folder, video.custom_filename, source || video);
            } else {
                // 其它模式无合并能力，退化为下载 M3U8 清单与逐分片，由用户自行合并
                registry.newTask(video.custom_url, folder, video.custom_filename.replace(/\.ts$/, '.m3u8'), source || video);
                await addDownloadTsTasks(env, registry, video.custom_url, folder, source || video);
            }
        } else {
            // 添加常规的MP4文件的下载任务
            registry.newTask(video.custom_url, folder, video.custom_filename, source || video);
        }
    }
}
