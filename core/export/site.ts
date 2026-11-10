/**
 * 站点/其它信息导出（v3 TypeScript 版，替代旧 common.js exportUserToJson /
 * exportUserToHtml / exportConfigToJson 与 config.js 的查看器资源清单）
 *
 * 自洽实现，不依赖 QZone.Common.Target / QZone.Common.Owner 旧全局对象。
 * 数据来源：
 *   - userInfo：由编排层（engine-bridge）从页面或 userInfos API 抓取后传入
 *   - config：由编排层从 QzoneBackupConfig 构造后传入
 *
 * 产物：
 *   - index.html             （查看器首页，必须位于备份根目录）
 *   - Common/js/index.js     （查看器脚本，由首页按 ./Common/js/index.js 加载）
 *   - Common/css/index.css   （查看器样式，由首页按 ./Common/css/index.css 加载）
 *   - Common/json/user.js   （个人档，window.userInfo = {...}）
 *   - Common/json/user.json （个人档纯 JSON 副本，便于二次处理/跨平台解析）
 *   - Common/json/config.js （助手配置，window.QZone_Config = {...}）
 *   - Common/json/助手备份数据_<uin>.json （增量备份数据，纯 JSON：{ Backedup: { [uin]: rows } }）
 *   - Common/vendor/*       （足迹地图依赖）
 *   - Common/images/*       （占位图、站点图标、微信表情）
 *
 * 为什么查看器首页必须在备份根目录：查看器构建产物用相对路径加载数据
 * （'./Common/json/user.js'、'./Messages/json/messages.js' 等，见 viewer/src/data/sources.ts
 * 的 DATA_BASE = './'），首页自身必须与 Common/、Messages/ 等数据目录同级，
 * 放进子目录会导致全部数据请求 404。而脚本/样式放在 Common/js、Common/css 下，
 * 与数据、依赖同属 Common 命名空间，首页用 ./Common/js|css 引用即可，不影响数据路径。
 * 此布局与「工具-升级备份查看器」（entrypoints/options/ToolsPanel.vue 的 VIEWER_FILES）保持一致。
 */

import type { FileWriter } from '../fs/writer';
import { exportChinaCitiesMap } from './province-maps';
import type { ModuleBackupRow } from '../store/backup-db';

/** 个人档信息（必填字段最小化，多余字段原样透传） */
export interface UserInfo {
    uin: number;
    ownerUin?: number;
    nickname?: string;
    avatar?: string;
    spaceName?: string;
    desc?: string;
    [key: string]: unknown;
}

/** 助手配置（写入 config.js，供查看器读取展示方式） */
export interface AssistantConfig {
    [key: string]: unknown;
}

/** 导出过程的日志出口（与 core/shared/logger 的 Logger 结构兼容，测试可传 undefined） */
export interface ExportLogger {
    info?(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
    error?(...args: unknown[]): void;
}

interface ViewerFile {
    /** 扩展包内的源路径（web_accessible_resource） */
    original: string;
    /** 备份包内的目标路径（相对备份根） */
    target: string;
    /** 缺失即导致查看器无法打开 */
    required?: boolean;
}

/**
 * 微信表情图片清单（与 viewer/src/data/richText.ts 的 formatWxEmoji 对应）
 * V2 通过 jsdelivr 在线引用本项目仓库的 public/img/emoji/，V3 改为随查看器一并导出到
 * 备份的 Common/images/，彻底脱离外部 CDN，保证离线也能查看微信表情。
 * 源即扩展内 web_accessible_resource：public/img/emoji/*.png → img/emoji/*.png
 * （wxt.config.ts 的 web_accessible_resources 已含 'img/*'）。
 */
const WX_EMOJI_NAMES = [
    '2_02', '2_04', '2_05', '2_06', '2_07', '2_09', '2_10', '2_11', '2_12', '2_14',
    '2_15', '2_16', '2_17', '666', 'Addoil', 'Boring', 'Broken', 'Cold', 'Duh',
    'Fireworks', 'Flushed', 'Gift', 'Happy', 'Hurt', 'KeepFighting', 'Let Down',
    'LetMeSee', 'Lol', 'NoProb', 'Party', 'Shocked!', 'Sick', 'Sigh', 'Slap',
    'smiley_17b', 'smiley_39b', 'smiley_83b', 'Social', 'Sweat', 'Terror',
    'Watermelon', 'Worship', 'Wow!', 'Yellowdog',
];
const WX_EMOJI_FILES: ViewerFile[] = WX_EMOJI_NAMES.map((name) => ({
    original: `img/emoji/${name}.png`,
    target: `Common/images/${name}.png`,
}));

/** 查看器资源清单（对应旧 config.js 的 ExportFiles） */
const VIEWER_FILES: ViewerFile[] = [
    // 查看器首页：必须落在备份根目录；脚本与样式归入 Common/js、Common/css
    { original: 'viewer/index.html', target: 'index.html', required: true },
    { original: 'viewer/Common/js/index.js', target: 'Common/js/index.js', required: true },
    { original: 'viewer/Common/css/index.css', target: 'Common/css/index.css', required: true },
    // 足迹地图依赖：查看器按 './Common/vendor/' 动态加载，缺失只影响地图页
    // 注意：扩展包内查看器资源已统一到 Common/ 下（见 viewer/vite.config.ts 的 copyMapVendor）
    { original: 'viewer/Common/vendor/echarts.min.js', target: 'Common/vendor/echarts.min.js' },
    { original: 'viewer/Common/vendor/coordtransform.min.js', target: 'Common/vendor/coordtransform.min.js' },
    { original: 'viewer/Common/vendor/maps/config.js', target: 'Common/vendor/maps/config.js' },
    { original: 'viewer/Common/vendor/maps/china.js', target: 'Common/vendor/maps/china.js' },
    { original: 'viewer/Common/vendor/maps/world.js', target: 'Common/vendor/maps/world.js' },
    // 全国市级地图：点省看下级市用（约 3.7MB，随扩展内置，备份时本地复制）
    { original: 'viewer/Common/vendor/maps/china-cities.js', target: 'Common/vendor/maps/china-cities.js' },
    // 占位图与图标：查看器按 'Common/images/' 引用
    { original: 'viewer/Common/images/favicon.ico', target: 'Common/images/favicon.ico' },
    { original: 'viewer/Common/images/no_cover.gif', target: 'Common/images/no_cover.gif' },
    { original: 'viewer/Common/images/media_missing.png', target: 'Common/images/media_missing.png' },
    // 微信表情：随查看器一并导出到 Common/images/，脱离 jsdelivr 外部 CDN（详见 WX_EMOJI_FILES）
    ...WX_EMOJI_FILES,
];

/** 查看器缺失即不可用的关键文件（供外部校验/提示复用） */
export const REQUIRED_VIEWER_FILES: readonly string[] = VIEWER_FILES.filter((f) => f.required).map((f) => f.target);

/** 查看器生成结果 */
export interface ViewerExportResult {
    /** 关键文件是否齐备（即查看器可打开） */
    ok: boolean;
    /** 成功写入的目标路径 */
    written: string[];
    /** 校验后仍缺失的关键文件 */
    missingRequired: string[];
    /** 缺失的可选文件（地图依赖/占位图等，不影响打开） */
    missingOptional: string[];
    /** 实际执行的生成轮次（1 表示一次成功，>1 表示触发过重试） */
    attempts: number;
    /** 是否启用了兜底 index.html */
    usedFallbackIndex: boolean;
}

/** 导出个人档 JSON（Common/json/user.js + Common/json/user.json） */
export async function exportUserProfile(writer: FileWriter, userInfo: UserInfo): Promise<void> {
    await writer.createFolder('Common/json');
    await writer.writeJsonToJs('userInfo', userInfo, 'Common/json/user.js');
    await writer.writeJson(userInfo, 'Common/json/user.json');
}

/** 导出助手配置（Common/json/config.js） */
export async function exportAssistantConfig(writer: FileWriter, config: AssistantConfig): Promise<void> {
    await writer.createFolder('Common/json');
    await writer.writeJsonToJs('QZone_Config', config, 'Common/json/config.js');
}

/**
 * 增量备份 JSON 写盘顺序（复刻 V2 的 MODULE_NAME_LIST）。
 * 精简副本以避免 site.ts 引入重型采集器依赖图；core/collector/modules/engine.ts 的
 * MODULE_ORDER 有一致性兜底断言，确保两者同步变更。
 */
const BACKUP_MODULE_ORDER = [
    'Messages', 'Blogs', 'Diaries', 'Photos', 'Videos',
    'Boards', 'Friends', 'Favorites', 'Shares', 'Visitors',
] as const;

/**
 * 导出增量备份 JSON（复刻 V2 的 API.Common.exportBackupItemsToJson）。
 * 产物：Common/json/助手备份数据_<uin>.json，纯 JSON（非 writeJsonToJs 的 window.xxx= 形式），
 * 内容为 { Backedup: { [uin]: rows } }，仅含当前 uin，按 BACKUP_MODULE_ORDER 排序。
 * 经 FileWriter 双后端自动分流——目录模式真落盘、ZIP 模式进内存归档，无需额外配置分支。
 */
export async function exportBackupHistory(
    writer: FileWriter,
    rows: ModuleBackupRow[],
    uin: number | string,
): Promise<void> {
    if (!rows || rows.length === 0) return;
    const order = new Map<string, number>();
    BACKUP_MODULE_ORDER.forEach((m, i) => order.set(m, i));
    const sorted = [...rows].sort((a, b) => {
        const ia = order.get(a.module) ?? Number.MAX_SAFE_INTEGER;
        const ib = order.get(b.module) ?? Number.MAX_SAFE_INTEGER;
        return ia - ib;
    });
    await writer.createFolder('Common/json');
    const payload = { Backedup: { [String(uin)]: sorted } };
    await writer.writeText(JSON.stringify(payload), `Common/json/助手备份数据_${uin}.json`);
}

/** 当前是否处于可读取扩展资源的环境（测试/Node 下为否） */
function getExtensionRuntime(): { getURL(path: string): string } | null {
    const chromeAny = (globalThis as any).chrome;
    if (chromeAny?.runtime?.getURL) {
        return chromeAny.runtime;
    }
    const browserAny = (globalThis as any).browser;
    if (browserAny?.runtime?.getURL) {
        return browserAny.runtime;
    }
    return null;
}

/**
 * 兜底首页：仅在真实 index.html 拷贝失败时写入。
 * 契约与构建产物一致（按 ./Common/js/index.js 与 ./Common/css/index.css 加载），
 * 因此只要这两个文件在位，查看器仍可正常启动。
 */
async function writeFallbackIndexHtml(writer: FileWriter, userInfo: UserInfo): Promise<void> {
    const title = String(userInfo.nickname || userInfo.uin || 'QQ空间备份').replace(/[<>&]/g, '');
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QQ空间备份 - ${title}</title>
<link rel="icon" href="Common/images/favicon.ico">
<link rel="stylesheet" href="./Common/css/index.css">
</head>
<body>
<div id="app"></div>
<script src="./Common/js/index.js"></script>
</body>
</html>`;
    await writer.writeText(html, 'index.html');
}

/**
 * 拷贝查看器静态资源（从扩展 web_accessible_resource 读取后写入备份目录）
 * @param only 仅生成这些目标路径（用于失败重试），不传则生成全量
 */
export async function exportViewerAssets(
    writer: FileWriter,
    logger?: ExportLogger,
    only?: readonly string[],
): Promise<{ written: string[]; failed: Array<{ target: string; reason: string }> }> {
    const written: string[] = [];
    const failed: Array<{ target: string; reason: string }> = [];

    const runtime = getExtensionRuntime();
    if (!runtime) {
        // 非扩展环境（单元测试）跳过，不视为错误
        return { written, failed };
    }

    const targets = only && only.length > 0
        ? VIEWER_FILES.filter((f) => only.includes(f.target))
        : VIEWER_FILES;

    for (const file of targets) {
        try {
            const resp = await fetch(runtime.getURL(file.original));
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status);
            }
            const buf = await resp.arrayBuffer();
            if (buf.byteLength === 0) {
                throw new Error('资源为空');
            }
            await writer.writeFile(new Uint8Array(buf), file.target);
            written.push(file.target);
        } catch (error) {
            const reason = (error as Error)?.message || String(error);
            failed.push({ target: file.target, reason });
            // 单个资源失败不阻断其余资源，但必须留痕——此前这里是静默 catch，
            // 导致查看器整体缺失也毫无线索
            logger?.warn?.('查看器资源写入失败', { source: file.original, target: file.target, reason });
        }
    }
    return { written, failed };
}

/** 校验查看器产物是否真的落地，返回缺失的目标路径 */
export async function findMissingViewerFiles(writer: FileWriter): Promise<string[]> {
    const missing: string[] = [];
    for (const file of VIEWER_FILES) {
        try {
            if (!(await writer.exists(file.target))) {
                missing.push(file.target);
            }
        } catch {
            // 存在性判断本身失败时按缺失处理，交由重试兜底
            missing.push(file.target);
        }
    }
    return missing;
}

/**
 * 生成查看器并校验，缺失则重试一次，仍缺 index.html 时写入兜底首页。
 * 无论成败都返回结果供编排层提示用户，不抛异常打断备份收尾。
 */
export async function exportViewerWithVerify(
    writer: FileWriter,
    userInfo: UserInfo,
    logger?: ExportLogger,
): Promise<ViewerExportResult> {
    let attempts = 1;
    let usedFallbackIndex = false;

    const first = await exportViewerAssets(writer, logger);
    const written = [...first.written];

    // 状态检查：以「文件确实存在且非空」为准，而非以写入调用未抛异常为准
    let missing = await findMissingViewerFiles(writer);

    if (missing.length > 0) {
        attempts = 2;
        logger?.error?.('备份查看器未生成完整，正在重新生成', { missing });
        const retry = await exportViewerAssets(writer, logger, missing);
        written.push(...retry.written);
        missing = await findMissingViewerFiles(writer);
    }

    // 兜底：Common/js/index.js 与 Common/css/index.css 在位但首页拷贝不到时，用等价的手写首页补齐
    if (missing.includes('index.html') && !missing.includes('Common/js/index.js')) {
        try {
            await writeFallbackIndexHtml(writer, userInfo);
            usedFallbackIndex = true;
            logger?.warn?.('已使用兜底首页替代查看器 index.html');
            missing = await findMissingViewerFiles(writer);
        } catch (error) {
            logger?.error?.('兜底首页写入失败', { reason: (error as Error)?.message || String(error) });
        }
    }

    const missingRequired = missing.filter((p) => REQUIRED_VIEWER_FILES.includes(p));
    const missingOptional = missing.filter((p) => !REQUIRED_VIEWER_FILES.includes(p));

    if (missingRequired.length > 0) {
        logger?.error?.('备份查看器生成失败，备份数据已保存但查看器不可用', { missingRequired });
    } else if (missingOptional.length > 0) {
        logger?.warn?.('查看器可选资源缺失（不影响打开，地图页可能不可用）', { missingOptional });
    } else {
        logger?.info?.('备份查看器已生成', { count: written.length, attempts });
    }

    // 查看器可打开时，顺带补齐「全国市级地图」（足迹地图点省看下级市用）。
    // 单个文件约 3.9 MB，查看器按 parent.adcode 切片出省级视图；失败只影响下钻，不阻断备份。
    if (missingRequired.length === 0) {
        try {
            const cityMap = await exportChinaCitiesMap(writer, logger);
            if (cityMap.mode === 'failed') {
                logger?.warn?.('全国市级地图不可用，足迹地图将只支持省级视图', { reason: cityMap.reason });
            }
        } catch (error) {
            logger?.warn?.('全国市级地图导出异常（不影响查看器）', {
                reason: (error as Error)?.message || String(error),
            });
        }
    }

    return {
        ok: missingRequired.length === 0,
        written,
        missingRequired,
        missingOptional,
        attempts,
        usedFallbackIndex,
    };
}

/**
 * 一次性导出「其它信息」（用户档 + 配置 + 增量备份 JSON + 查看器）
 * 查看器生成失败不抛异常，通过返回值上报，避免影响已采集数据的收尾
 *
 * @param backupRows 增量备份行（由编排层从 BackupDb.getRows 读取后传入）；缺省则不写增量 JSON
 * @param uin        目标 QQ 号，用于增量 JSON 文件名与 payload 键
 */
export async function exportOthers(
    writer: FileWriter,
    userInfo: UserInfo,
    config: AssistantConfig,
    logger?: ExportLogger,
    backupRows?: ModuleBackupRow[],
    uin?: number | string,
): Promise<ViewerExportResult> {
    await exportUserProfile(writer, userInfo);
    await exportAssistantConfig(writer, config);
    if (backupRows && backupRows.length > 0 && uin != null) {
        await exportBackupHistory(writer, backupRows, uin);
    }
    return exportViewerWithVerify(writer, userInfo, logger);
}
