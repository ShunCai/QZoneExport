import {
    albumComments,
    albumList,
    albumVisitors,
    imageComments,
    imageInfo,
    imageList,
} from '../../qzone-api/clients';
import {
    filenameValidate,
    formatDate,
    hashString,
    parseDate,
    sortBy,
    toJson,
    trimDownloadUrl,
    unionItems,
} from '../../shared/utils';
import { isFullBackup, isNewItem, unionBackedUpItems, type IncrementItem } from '../increment';
import { deriveExpectedCount, FailureDetector, Compensator, DEFAULT_MAX_RETRY, type PageLedger } from '../reliability';
import type { CollectContext, ModuleCollector } from '../pipeline';
import {
    AvatarTaskRegistry,
    collectItemVisitors,
    collectLikes,
    collectPagedList,
    forEachNewItemBatch,
    hasNextPage,
    isGetNextPage,
    MediaTaskRegistry,
    randomSleep,
    resolveMediaSuffix,
    writeModuleOutputs,
} from './helpers';
import { getFileStructureFolderPath } from './videos';
import { isGetLike, isGetVisitor, type CollectorEnv, type PhotosConfig } from './types';
import type { CommentRecord, LikeRecord, PhotoLocation, PhotoVisitorSummary, VideoInfo } from './models';

/**
 * 相册采集器
 * 移植自 src/js/modules/photos.js 的 API.Photos.export 全流程（HTML渲染除外）
 * 三层结构：相册列表 → 相册评论/点赞/访客 → 相片列表（List分页 或 Detail递归）→ 相片详情/评论/点赞
 */

/** 相片条目 */
export interface PhotoItem extends IncrementItem {
    picKey?: string;
    lloc?: string;
    sloc?: string;
    batchId?: string;
    name?: string;
    url?: string;
    pre?: string;
    raw?: string;
    raw_upload?: number;
    origin?: string;
    origin_url?: string;
    origin_upload?: number;
    downloadUrl?: string;
    phototype?: number;
    is_video?: boolean;
    video_info?: VideoInfo;
    uploadtime?: number | string;
    uploadTime?: number | string;
    rawshoottime?: number | string;
    shootTime?: number | string;
    lbs?: PhotoLocation;
    shootGeo?: PhotoLocation;
    cmtTotal?: number;
    comments?: CommentRecord[];
    albumId?: number | string;
    albumClassId?: number;
    albumClassName?: string;
    uniKey?: string;
    likes?: LikeRecord[];
    likeTotal?: number;
    custom_url?: string;
    custom_filename?: string;
    custom_filepath?: string;
    custom_pre_filename?: string;
    custom_pre_filepath?: string;
    [key: string]: unknown;
}

/** 相册条目 */
export interface AlbumItem extends IncrementItem {
    id: number | string;
    name?: string;
    desc?: string;
    classid?: number;
    className?: string;
    /** 分类顺序：该分类在接口 classList 中的下标（即 QQ 空间「分类管理」里人工排定的分类顺序）。
     *  仅按 classid 无法还原真实分类顺序（用户可拖拽重排），故采集时落盘此序号供查看器据此排序。 */
    classSort?: number;
    createtime?: number;
    modifytime?: number;
    lastuploadtime?: number;
    order?: number;
    total?: number;
    viewtype?: number;
    allowAccess?: number;
    comment?: number;
    pre?: string;
    url?: string;
    photoList?: PhotoItem[];
    comments?: CommentRecord[];
    uniKey?: string;
    likes?: LikeRecord[];
    likeTotal?: number;
    custom_url?: string;
    custom_filename?: string;
    custom_filepath?: string;
    custom_visitor?: PhotoVisitorSummary;
    /** 断点续传标记：该相册的相片列表是否已采集完成 */
    _photosDone?: boolean;
    [key: string]: unknown;
}

/** 相册点赞Key（移植自 api.js Photos.getUniKey L3637-3639） */
export function getAlbumUniKey(targetUin: number, albumId: number | string): string {
    return `http://user.qzone.qq.com/${targetUin}/photo/${albumId}`;
}

/** 相片Key（移植自 api.js Photos.getImageKey L3668-3670） */
export function getImageKey(photo: PhotoItem): string {
    return (photo.picKey || photo.lloc || photo.sloc)!;
}

/** 相片点赞Key（移植自 api.js Photos.getPhotoUniKey L3645-3647） */
export function getPhotoUniKey(targetUin: number, photo: PhotoItem): string {
    const loc = photo.lloc || photo.sloc;
    return (
        `http://user.qzone.qq.com/${targetUin}/photo/${photo.albumId}/${loc}^||^` +
        `http://user.qzone.qq.com/${targetUin}/batchphoto/${photo.albumId}/${photo.batchId}^||^1`
    );
}

/** 相片后缀（移植自 api.js Photos.getPhotoSuffix L3948-3970） */
export function getPhotoSuffix(photo: PhotoItem): string {
    switch (photo.phototype) {
        case 2:
            return '.gif';
        case 3:
            return '.png';
        case 4:
            return '.bmp';
        case 1:
        case 5:
        default:
            return '.jpeg';
    }
}

/** 相片下载地址（移植自 api.js Photos.getDownloadUrl L3898-3921） */
export function getDownloadUrl(photo: PhotoItem, type?: string): string {
    // 原图 / 高清图 / 普通图
    const rawUrl = photo.raw_upload === 1 && photo.raw;
    const originUrl = (photo.origin_upload === 1 && photo.origin_url) || photo.origin;
    const normalUrl = photo.downloadUrl || photo.url;
    let url: string | undefined | false;
    switch (type) {
        case 'raw':
            // 原图，原图不存在取高清，高清不存在取普通
            url = rawUrl || originUrl || normalUrl;
            break;
        case 'original':
            // 高清，高清不存在取普通
            url = originUrl || normalUrl;
            break;
        default:
            url = normalUrl;
            break;
    }
    return trimDownloadUrl((url as string) || '');
}

/** 导出类型是否为文件夹/文件（移植自 photos.js isFile L1358-1360） */
export function isPhotoFileExport(exportType: string): boolean {
    return exportType === 'Folder' || exportType === 'File';
}

/**
 * 相册文件夹路径（移植自 photos.js getAlbumFolderPath L1715-1731）
 * @param total 相册总数（序号命名时补零位数用）
 */
export function getAlbumFolderPath(album: AlbumItem, total: number, cfg: PhotosConfig, classMap: Record<number, string>): string {
    // 相册分类
    album.className = album.className || classMap[album.classid!] || '其他';
    const albumClass = filenameValidate(album.className);
    const albumName = filenameValidate(album.name || '');

    return 'Albums/' + albumClass + '/' + albumName;
}

/**
 * 相片文件名（移植自 photos.js getImageFileName L1782-1897）
 * 文件名方式见 PHOTO_RENAME_OPTIONS；不再拼接序号前缀，基础名为相片名。
 */
export function getImageFileName(photo: PhotoItem, cfg: PhotosConfig): string {
    const fileNames = [filenameValidate(photo.name || '')];

    // 上传时间与上传地点
    const uploadTime = (photo.uploadtime || photo.uploadTime) && parseDate((photo.uploadtime || photo.uploadTime)!).getTime();
    const uploadLbs = photo.lbs && photo.lbs.idname && photo.lbs;

    // 拍摄时间与拍摄地点
    const shootTime = (photo.rawshoottime || photo.shootTime) && parseDate((photo.rawshoottime || photo.shootTime)!).getTime();
    const shootGeo = photo.shootGeo && photo.shootGeo.idname && photo.shootGeo;

    const renameType = cfg.Images.RenameType;
    const fmt = (time: number) => formatDate(time / 1000, 'yyyyMMdd_hhmmss');

    if (renameType === 'Default') {
        // 相片名_链接指纹(URL哈希)：同一相片总得同名以支持去重
        let downloadUrl: string;
        try {
            downloadUrl = getDownloadUrl(photo, cfg.Images.exifType);
        } catch {
            downloadUrl = photo.url || photo.custom_url || photo.name || '';
        }
        fileNames.push(hashString(downloadUrl));
    } else if (renameType === 'Time') {
        // 相片名_拍摄/上传时间
        fileNames.push(fmt((shootTime || uploadTime) as number));
    } else if (renameType === 'Time_Lbs1') {
        // 相片名_拍摄/上传时间_拍摄/上传地点
        fileNames.push(fmt((shootTime || uploadTime) as number));
        const customLbs = shootGeo || uploadLbs || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    } else if (renameType === 'Time_Lbs2') {
        // 相片名_拍摄/上传时间_上传/拍摄地点
        fileNames.push(fmt((shootTime || uploadTime) as number));
        const customLbs = uploadLbs || shootGeo || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    } else if (renameType === 'ALL') {
        // 相片名_上传时间_上传地点_拍摄时间_拍摄地点
        if (uploadTime) {
            fileNames.push(fmt(uploadTime as number));
        }
        if (uploadLbs) {
            fileNames.push(uploadLbs.idname || uploadLbs.name || '');
        }
        if (shootTime) {
            fileNames.push(fmt(shootTime as number));
        }
        if (shootGeo) {
            fileNames.push(shootGeo.idname || shootGeo.name || '');
        }
    } else if (renameType === 'UploadTime') {
        fileNames.push(fmt(uploadTime as number));
    } else if (renameType === 'ShootTime') {
        fileNames.push(fmt(shootTime as number));
    } else if (renameType === 'ShootTime_ShootLbs') {
        if (shootTime) {
            fileNames.push(fmt(shootTime as number));
        }
        if (shootGeo) {
            fileNames.push(shootGeo.idname || shootGeo.name || '');
        }
    } else if (renameType === 'ShootTime_Lbs1') {
        if (shootTime) {
            fileNames.push(fmt(shootTime as number));
        }
        const customLbs = shootGeo || uploadLbs || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    } else if (renameType === 'ShootTime_Lbs2') {
        if (shootTime) {
            fileNames.push(fmt(shootTime as number));
        }
        const customLbs = uploadLbs || shootGeo || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    } else if (renameType === 'UploadTime_UploadLbs') {
        if (uploadTime) {
            fileNames.push(fmt(uploadTime as number));
        }
        if (uploadLbs) {
            fileNames.push(uploadLbs.idname || uploadLbs.name || '');
        }
    } else if (renameType === 'UploadTime_Lbs1') {
        if (uploadTime) {
            fileNames.push(fmt(uploadTime as number));
        }
        const customLbs = uploadLbs || shootGeo || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    } else if (renameType === 'UploadTime_Lbs2') {
        if (uploadTime) {
            fileNames.push(fmt(uploadTime as number));
        }
        const customLbs = shootGeo || uploadLbs || undefined;
        if (customLbs) {
            fileNames.push(customLbs.idname || customLbs.name || '');
        }
    }
    photo.custom_filename = fileNames.join('_');
    return photo.custom_filename;
}

/**
 * 相册整理：保持接口返回顺序（请求已固定 sortOrder=自定义），仅按分类顺序(classSort)稳定重排，
 * 并根据索引重置序号。相册的展示排序由查看器负责，采集端不再二次按创建/上传时间重排。
 */
export function sortAlbums(albums: AlbumItem[]): void {
    // 分类排序：仅当数据带 classSort（当前版采集落盘，反映接口 classList 顺序）时按它重排；
    // 无 classSort 的历史/旧版备份完整保留采集时的数组顺序（V2 数据本就按分类排好，不额外打乱）
    if (albums.some((a) => a.classSort != null)) {
        albums.sort((a, b) => a.classSort! - b.classSort!);
    }
    // 根据索引位置重置排序号，避免相册order字段为0
    for (let idx = 0; idx < albums.length; idx++) {
        albums[idx]!.order = idx;
    }
}

export class PhotosCollector implements ModuleCollector {
    readonly module = 'Photos';

    /** 相册分类映射（接口 classList 返回） */
    private classMap: Record<number, string> = {};
    /** 相册分类顺序：classid → 在 classList 中的下标（反映用户人工排定的分类顺序） */
    private classOrderMap: Record<number, number> = {};
    /** 上次备份的相册列表 */
    private oldAlbums: AlbumItem[] = [];

    constructor(
        private readonly env: CollectorEnv,
        /** 用户勾选的相册（popup传入，为空表示备份全部相册） */
        private readonly selectedAlbums: AlbumItem[] = [],
        private readonly avatars?: AvatarTaskRegistry,
    ) {}

    async restore(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const albums = await env.loadStaging<AlbumItem[]>(this.module);
        if (!albums || albums.length === 0) {
            env.logger.warn('相册 staging 丢失，回退全量采集');
            return this.collect(_ctx);
        }
        // 续传恢复：相册数据已从 staging 恢复，主体进度直接置 100%（仅重新导出产物）
        await env.report('albums', albums.length, albums.length, undefined, undefined, { done: albums.length, total: albums.length });
        env.logger.info('相册续传恢复：从 staging 加载 ' + albums.length + ' 个相册');
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Photos',
            globalName: 'albums',
            data: albums,
            jsonJsPath: 'Albums/json/albums.js',
            jsonFilePath: 'Albums/json/albums.json',
        });
        await env.report('export', 1, 1);
    }

    /** 相册是否为新备份（移植自 photos.js isNewAlbum L1392-1406） */
    private isNewAlbum(albumId: number | string): boolean {
        if (isFullBackup(this.env.config.Photos)) {
            return true;
        }
        if (this.oldAlbums.length === 0) {
            // 没有已备份数据的当作新数据处理
            return true;
        }
        // 用户可指定相册备份，非全量时不能直接用IncrementTime判断
        const album = this.oldAlbums.find((item) => item.id === albumId);
        if (!album) {
            return true;
        }
        return isNewItem(album);
    }

    /** 相片是否为新备份（移植自 photos.js isNewItem L1413-1425） */
    private isNewPhoto(albumId: number | string, photo: PhotoItem): boolean {
        if (isFullBackup(this.env.config.Photos)) {
            return true;
        }
        const album = this.oldAlbums.find((item) => item.id === albumId);
        if (!album) {
            return true;
        }
        // 已备份相册按条目增量标记判断
        return isNewItem(photo);
    }

    async collect(_ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const registry = new MediaTaskRegistry(env, this.module);

        // 上次备份的相册（含 photoList）
        // 历史数据可能因旧版迁移/损坏而非常规数组（对象或字符串），
        // 必须显式规整为数组，否则下面 .find/.length 会抛 “xxx is not a function”
        const oldAlbumsRaw = await env.getOldData<AlbumItem[]>(this.module);
        this.oldAlbums = Array.isArray(oldAlbumsRaw) ? oldAlbumsRaw : [];
        if (oldAlbumsRaw !== undefined && !Array.isArray(oldAlbumsRaw)) {
            env.logger.warn('Photos 历史备份数据非常规数组，已按空数据处理（全量重采）', {
                actualType: typeof oldAlbumsRaw,
            });
        }

        // 页级可靠性账本（跨相册/相片分页统一记账；落 chrome.storage.local）。
        // 与其它采集器一致：ledger 缺失（如单测/非 pipeline 调用）时传 undefined，
        // 由 collectPagedList 及内部 record 的 if(!reliability) 兜底，避免把带 undefined.ledger 的空对象传下去
        const reliability = _ctx.ledger
            ? { ledger: _ctx.ledger, uin: String(_ctx.uin), batchId: _ctx.batchId }
            : undefined;

        // 初始化相册列表（用户勾选 or 全部相册；增量时合并未变更的历史相册）
        const albums = await this.initAlbums(reliability);

        // 断点续传：从 staging 恢复已采集的相册相片列表，跳过已完成的相册
        const cpPhase = _ctx.checkpoint?.phase || '';
        if (cpPhase) {
            const staged = await env.loadStaging<AlbumItem[]>(this.module);
            if (staged && staged.length > 0) {
                const stagedMap = new Map(staged.map((a) => [a.id, a]));
                for (const album of albums) {
                    const stagedAlbum = stagedMap.get(album.id);
                    if (stagedAlbum && stagedAlbum.photoList && stagedAlbum.photoList.length > 0) {
                        album.photoList = stagedAlbum.photoList;
                    }
                }
                env.logger.info('相册续传：从 staging 恢复了部分相册的相片列表');
            }
        }

        // 相册级流水线：以「单个相册」为主体依次进行。
        // 每个相册的处理顺序：①相册自身评论 → ②相册点赞 → ③相册访问 → ④相片列表 →
        // ⑤相片详情 → ⑥回填相册信息 → ⑦登记下载任务 → ⑧相片评论 → ⑨相片点赞 → ⑩相片评论配图任务。
        // 全部收完才切换到下一个相册，进度严格跟随「相册数量」单调前进；
        // 不再「先批量收完所有相册的评论/点赞/访问、再统一拉相片列表」，避免主体进度长期为 0 后突跳。
        // 登记任务即刻触发下载，因此第一个相册跑完就能开始下载，不必等所有相册采集完。
        await env.report('media', 0, albums.length);
        // 相册主体进度：每处理完一个相册（评论/点赞/访问 + 相片列表+详情+下载任务+相片评论+相片点赞）才 +1，
        // 进度跟随「相册数量」推进，绝不在相册列表枚举完、或相片赞未收完时到 100%。
        await env.report('albums', 0, albums.length, undefined, undefined, { done: 0, total: albums.length });
        // 初始化相册级各阶段进度显示（逐相册内联采集，每个相册处理时各自 +1）
        if (isGetLike(cfg)) {
            await env.report('album-likes', 0, albums.length);
        }
        if (isGetVisitor(cfg)) {
            await env.report('album-visitors', 0, albums.length);
        }
        for (let index = 0; index < albums.length; index++) {
            const album = albums[index]!;
            // —— 相册自身评论/点赞/访问（主体第一环，必须在相片列表之前）——
            await this.collectAlbumComments(album, index, albums.length);
            if (isGetLike(cfg)) {
                await this.collectAlbumLikes(album, index, albums.length);
            }
            if (isGetVisitor(cfg)) {
                await this.collectAlbumVisitors(album, index, albums.length);
            }
            // 相片列表（Detail 详情递归 或 List 分页）
            await this.collectAlbumPhotoList(album, albums, reliability);
            // 相片详情（会重建相片对象，必须先于下载任务登记）
            await this.collectAlbumImageInfos(album);
            // 刷新相片的相册、分类信息（详情重建后需要重新回填）
            this.refreshAlbumPhotoInfo(album);
            // 登记该相册的下载任务（相册预览图 + 相册评论配图 + 相片本体）
            await this.addAlbumDownloadTasks(album, albums, registry);
            // 相片评论（依赖相片详情，且评论配图下载任务依赖评论数据）
            await this.collectImageComments(album.photoList || []);
            // 相片点赞Key（点赞采集前置）
            for (const photo of (album.photoList || [])) {
                photo.uniKey = getPhotoUniKey(env.ctx.targetUin, photo);
            }
            // 获取相片赞记录（跟随相册：相册主体进度 +1 前必须收完，否则「相册采完即 100%、相片赞还在跑」）
            if (isGetLike(cfg)) {
                await forEachNewItemBatch(env, album.photoList || [], 10, (photo) => collectLikes(env, photo, cfg.Like), 'photo-likes');
            }
            // 添加相片评论配图的下载任务（依赖上一步的评论数据）
            await this.addPhotoCommentImageTasks([album], registry);
            await env.report('media', index + 1, albums.length);
            // 相册主体进度：该相册「评论/点赞/访问 + 相片列表+详情+下载任务+相片评论+相片点赞」全部收完才 +1，
            // 进度跟随「相册数量」推进，点赞未完成时绝不到 100%。
            await env.report('albums', index + 1, albums.length, undefined, album.name, { done: index + 1, total: albums.length });
        }

        // 导出数据文件（查看器读取 Albums/json/albums.js）
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Photos',
            globalName: 'albums',
            data: albums,
            jsonJsPath: 'Albums/json/albums.js',
            jsonFilePath: 'Albums/json/albums.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 初始化相册列表（移植自 photos.js initAlbums L1430-1484）
     */
    private async initAlbums(reliability?: { ledger: PageLedger; uin: string; batchId: string }): Promise<AlbumItem[]> {
        const env = this.env;
        const cfg = env.config.Photos;
        const albums: AlbumItem[] = [];

        // 始终走最新相册列表接口（collectAlbumList 会保留 classid 并落盘 classSort，
        // 供查看器按分类顺序还原）；勾选备份时再按选中 id 过滤。
        const allAlbums = await this.collectAlbumList(reliability);
        if (this.selectedAlbums.length === 0) {
            // 用户没有选择时，默认获取所有相册列表
            albums.push(...allAlbums);
        } else {
            // 用户选择了备份指定的相册：用选中 id 从最新列表里筛，避免用弹窗传入的（无 classSort）
            const selectedIds = new Set(this.selectedAlbums.map((a) => String(a.id)));
            albums.push(...allAlbums.filter((a) => selectedIds.has(String(a.id))));
        }

        // 处理增量相册
        if (!isFullBackup(cfg)) {
            const oldAlbums = this.oldAlbums;
            // 需要拷贝的属性
            const attrs = ['desc', 'createtime', 'modifytime', 'lastuploadtime', 'order', 'total', 'viewtype', 'className', 'classSort'];
            // 全量标记：与 MV2 initBackedUpData（modules/common.js L1088-1097）一致，
            // 先把「所有历史相册及其相片」标记为「已备份/非新」。
            // 原 MV3 仅在「id=== 命中 且 相册名相同」时才给相册打标、且从没给相片打标；
            // 一旦匹配走不通（改名被 continue、历史缺 photoList 等）旧相册 isNewItem 停在 undefined →
            // isNewItem() 对 undefined 返回 true → isNewAlbum 误判为「新」→
            // collectImagesByPage 里 if(!isNewAlbum) 守卫跳过 unionBackedUpItems 相片合并 →
            // 旧相片永不被置 false → 全部重新下载（本仓库此前相册增量失效的根因）。
            // 无条件全量标记后，无论下方精确匹配是否成功，isNewAlbum/isNewPhoto 都能正确识别旧数据。
            for (const oldAlbum of oldAlbums) {
                oldAlbum.isNewItem = false;
                if (oldAlbum.photoList) {
                    for (const photo of oldAlbum.photoList) {
                        photo.isNewItem = false;
                    }
                }
            }
            for (let i = albums.length - 1; i >= 0; i--) {
                const newAlbum = albums[i]!;
                const oldAlbum = oldAlbums.find((item) => item.id === newAlbum.id);
                if (!oldAlbum) {
                    continue;
                }
                if (newAlbum.name != oldAlbum.name) {
                    // 相册改名：相册 ID 相同即视为同一相册（不重新备份），仅同步最新名称。
                    // 下方属性同步 attrs 不含 name，故在此单独更新；随后走 splice 用旧相册
                    // （含 isNewItem=false 标记）代替新相册，消除新旧名双相册输出。
                    oldAlbum.name = newAlbum.name;
                }
                // 拷贝新相册的部分属性到旧相册，并从最新列表中移除（保留旧对象引用以维持标记）
                for (const attr of attrs) {
                    oldAlbum[attr] = newAlbum[attr];
                }
                albums.splice(i, 1);
            }
            // 合并历史相册（均已标记 isNewItem=false）
            albums.push(...oldAlbums);
        }

        // 重新排序并添加点赞Key
        sortAlbums(albums);
        for (const album of albums) {
            album.uniKey = getAlbumUniKey(env.ctx.targetUin, album.id);
        }
        return albums;
    }

    /**
     * 获取所有的相册列表（移植自 photos.js getAllAlbumList L278-328）
     */
    private async collectAlbumList(reliability?: { ledger: PageLedger; uin: string; batchId: string }): Promise<AlbumItem[]> {
        const env = this.env;
        const cfg = env.config.Photos;
        // 先建立相册主体进度（未知总数 → 采集中），避免「相册列表拉完即到 100%」后随相片采集回退/卡住。
        // 相册列表枚举本身不再驱动进度条（见下方 'album-list' 上报，仅作阶段提示），真正的主体进度
        // 在 collect() 主循环里「每处理完一个相册（相片列表+详情+下载任务）才 +1」。
        await env.report('albums', 0, -1, undefined, undefined, { done: 0, total: -1 });
        const albums = await collectPagedList<AlbumItem>({
            env,
            moduleCfg: cfg,
            oldItems: this.oldAlbums,
            phase: 'album-list',
            fetchPage: async (pageIndex) => {
                const call = albumList(env.ctx, env.config, pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^shine0_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn('获取单页的相册列表异常 | code=' + res.code, res.msg || '');
                }
                const data = res.data || {};
                // 更新相册分类信息（每次拉取都含 classList，含补偿重采）；
                // 记录每个分类在 classList 中的下标作为其排序序号（用户可人工拖拽重排分类，故不能依赖 classid 数值）
                for (const classItem of data.classList || []) {
                    this.classMap[classItem.id] = classItem.name;
                    this.classOrderMap[classItem.id] = (data.classList || []).indexOf(classItem);
                }
                return { items: data.albumList || [], total: data.albumsInUser || 0 };
            },
            afterPage: async (allItems) => {
                // 相册列表枚举仅作阶段提示（'album-list'），不再作为主体进度源；
                // 主体进度 'albums' 由 collect() 主循环按相片采集推进（避免列表拉完即 100%）。
                await env.report('album-list', 0, -1);
                await env.report('album-list', allItems.length, -1);
            },
            reliability: reliability
                ? { ledger: reliability.ledger, uin: reliability.uin, module: this.module, batchId: reliability.batchId }
                : undefined,
        });

        // 更新相册类别并初始化相片列表
        for (const album of albums) {
            album.className = this.classMap[album.classid!] || '其他';
            // 落到每个相册的分类顺序（供查看器据此还原分类排列；无 classid 时顺序视为在最后）
            album.classSort = album.classid != null
                ? (this.classOrderMap[album.classid] ?? Number.MAX_SAFE_INTEGER)
                : Number.MAX_SAFE_INTEGER;
            album.photoList = album.photoList || [];
        }
        sortAlbums(albums);
        return albums;
    }

    /**
     * 获取所有相册的评论（移植自 photos.js getAllAlbumsComments/getAlbumAllComments L603-688）
     */
    /**
     * 获取单个相册的评论列表（相册级评论，跟随单个相册主体进行）。
     * 在相片列表之前采集，确保「单专辑为主体」的进度模型：评论/点赞/访问与相片一并按相册推进，
     * 进度严格跟随相册数量，不再因「先批量收完所有相册评论」而长期为 0 后突跳。
     * @param index 当前相册在全部相册中的下标（用于 album-comments 阶段进度上报）
     * @param total 全部相册数量
     */
    private async collectAlbumComments(album: AlbumItem, index: number, total: number): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const commentsCfg = cfg.Comments;
        if (!commentsCfg.isGet || isPhotoFileExport(cfg.exportType)) {
            return;
        }
        if (!this.isNewAlbum(album.id)) {
            // 已备份数据计为已成功处理
            await env.report('album-comments', index + 1, total, undefined, album.name);
            return;
        }
        if (album.comment === 0 || album.allowAccess === 0) {
            // 没评论或无权限时无操作，计为已成功处理
            await env.report('album-comments', index + 1, total, undefined, album.name);
            return;
        }
        // 清空相册原有的评论
        album.comments = [];
        let pageIndex = 0;
        for (;;) {
            await env.tick();
            try {
                const call = albumComments(env.ctx, env.config, String(album.id), pageIndex);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn(`获取单个相册的所有评论异常 | 相册#${album.id} | code=${res.code}`, res.msg || '');
                }
                const data = res.data || {};
                const comments: CommentRecord[] = data.comments || [];
                album.comments = unionItems(album.comments, comments);
                if (!isGetNextPage(this.oldAlbums, comments, { ...cfg, ...commentsCfg } as any)) {
                    break;
                }
            } catch (error) {
                const name = album.name ? '(' + album.name + ')' : '';
                env.logger.error(`获取单个相册的评论列表异常 | 相册#${album.id}${name} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
            }
            pageIndex++;
            if (!hasNextPage(pageIndex, commentsCfg.pageSize, album.comment || 0, album.comments!)) {
                break;
            }
            await randomSleep(env, commentsCfg.randomSeconds);
        }
        await env.report('album-comments', index + 1, total, undefined, album.name, { done: index + 1, total });
    }

    /**
     * 获取单个相册的赞记录（相册级点赞，跟随单个相册主体进行）。
     * 在相片列表之前采集，与相册评论、相片并列按相册推进。
     */
    private async collectAlbumLikes(album: AlbumItem, index: number, total: number): Promise<void> {
        const env = this.env;
        if (!this.isNewAlbum(album.id)) {
            await env.report('album-likes', index + 1, total, undefined, album.name);
            return;
        }
        await collectLikes(env, album, env.config.Photos.Like, this.avatars);
        await env.report('album-likes', index + 1, total, undefined, album.name, { done: index + 1, total });
    }

    /**
     * 获取单个相册的最近访问（相册级访问，跟随单个相册主体进行）。
     * 在相片列表之前采集，与相册评论、相片并列按相册推进。
     */
    private async collectAlbumVisitors(album: AlbumItem, index: number, total: number): Promise<void> {
        const env = this.env;
        if (!this.isNewAlbum(album.id)) {
            await env.report('album-visitors', index + 1, total, undefined, album.name);
            return;
        }
        await env.tick();
        album.custom_visitor = await collectItemVisitors(env, env.config.Photos.Visitor, (pageIndex) =>
            albumVisitors(env.ctx, env.config, String(album.id), pageIndex),
        );
        await env.report('album-visitors', index + 1, total, undefined, album.name, { done: index + 1, total });
    }

    /**
     * 获取单个相册的相片列表（移植自 photos.js getAllAlbumImageListByListType L589-596）
     * @param albums 全部相册（仅用于落 staging，保持整体快照）
     */
    private async collectAlbumPhotoList(
        album: AlbumItem,
        albums: AlbumItem[],
        reliability?: { ledger: PageLedger; uin: string; batchId: string },
        compensateOnly = false,
        /** 手动重试时的起始游标（ledger.cursor），Detail 模式精确续采失败批次用 */
        startCursor?: string,
    ): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const isDetail = cfg.Images.listType === 'Detail';
        if (this.selectedAlbums.length > 0 && !this.selectedAlbums.some((item) => item.id === album.id)) {
            // 不是用户选中的相册，暂不处理
            return;
        }
        if (album.allowAccess === 0) {
            // 没权限的跳过不获取
            env.logger.warn(`无权限访问该相册 | 相册#${album.id}`);
            return;
        }
        // 断点续传：已完成的相册跳过（_photosDone 标记区分“完成”与“部分采集”）
        // 手动重试（compensateOnly）模式则强制重采（失败页已在 ledger 标记）
        if (album._photosDone && !compensateOnly) {
            return;
        }
        const oldPhotos = this.oldAlbums.find((item) => item.id === album.id)?.photoList || [];
        // 页级断点回调：每页完成后更新 album.photoList 并落 staging
        const onPage = async (partialPhotos: PhotoItem[]) => {
            album.photoList = partialPhotos;
            await env.saveStaging(this.module, albums);
        };
        // 续传：部分采集的相册从已有 photoList 继续
        const startPage = (album.photoList && album.photoList.length > 0)
            ? Math.ceil(album.photoList.length / cfg.Images.pageSize)
            : 0;
        const photos = isDetail
            ? await this.collectImagesByDetail(album, oldPhotos, onPage, startPage > 0 ? album.photoList : undefined, reliability, compensateOnly, startCursor)
            : await this.collectImagesByPage(album, oldPhotos, onPage, startPage, album.photoList || [], reliability, compensateOnly);
        album.photoList = photos || [];
        album._photosDone = true;
        // 每个相册完成后落 staging（相册级断点）
        await env.saveStaging(this.module, albums);
    }

    /**
     * 分页方式获取单个相册的相片列表（移植自 photos.js getAlbumImageAllList L376-436）
     * @param onPage 每页完成后的回调（页级断点用）
     */
    private async collectImagesByPage(
        album: AlbumItem,
        oldPhotos: PhotoItem[],
        onPage?: (photos: PhotoItem[]) => Promise<void>,
        startPage?: number,
        initialPhotos?: PhotoItem[],
        reliability?: { ledger: PageLedger; uin: string; batchId: string },
        compensateOnly = false,
    ): Promise<PhotoItem[]> {
        const env = this.env;
        const cfg = env.config.Photos;
        const pageSize = cfg.Images.pageSize;
        // 相片分页按「相册」子命名空间记账，避免与相册列表页（module='Photos'）冲突
        const moduleId = this.module + ':' + String(album.id);
        const MAX_RETRY = DEFAULT_MAX_RETRY;
        let photos: PhotoItem[] = initialPhotos ? [...initialPhotos] : [];
        let total = 0;
        let pageIndex = startPage || 0;

        // 页级记账：成功/失败/丢失均记录到 ledger，供运行内补偿与手动重试
        const record = async (pi: number, hadError: boolean, errMsg: string | undefined, actual: number, retryCount: number): Promise<void> => {
            if (!reliability) return;
            const expected = deriveExpectedCount(total, pi, pageSize);
            const state = FailureDetector.classify({ hadError, lastError: errMsg, actual, expected, retryCount, maxRetry: MAX_RETRY });
            await reliability.ledger.record(reliability.uin, moduleId, {
                uin: reliability.uin,
                module: moduleId,
                pageIndex: pi,
                batchId: reliability.batchId,
                fetchedAt: Date.now(),
                state,
                itemCount: actual,
                expectedCount: expected,
                retryCount,
                lastError: errMsg,
                title: album.name,
            });
        };

        if (!compensateOnly) {
            for (;;) {
                await env.tick();
                let pageItems: PhotoItem[];
                let hadError = false;
                let errMsg: string | undefined;
                try {
                    const call = imageList(env.ctx, env.config, String(album.id), pageIndex);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^shine0_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn(`获取单个相册的指定页相片列表异常 | 相册#${album.id} | code=${res.code}`, res.msg || '');
                    }
                    const data = res.data || {};
                    total = data.totalInAlbum || total || 0;
                    // 合并相册信息（预览图与封面图地址）
                    if (data.topic) {
                        album.pre = data.topic.pre || album.pre;
                        album.url = data.topic.url || album.url;
                    }
                    pageItems = data.photoList || [];
                    // 设置增量比较字段（uploadtime → uploadTime）
                    setUploadTimeField(pageItems);
                    photos = unionItems(photos, pageItems);
                    await env.report('photos', photos.length, total || -1, undefined, album.name);
                    // 页级断点：每页完成后保存进度
                    if (onPage) {
                        await onPage(photos);
                    }
                    await record(pageIndex, false, undefined, pageItems.length, 0);
                    if (!isGetNextPage(oldPhotos, pageItems, cfg)) {
                        break;
                    }
                } catch (error) {
                    env.logger.error(`获取相册相片列表异常 | 相册#${album.id} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                    hadError = true;
                    errMsg = error instanceof Error ? error.message : String(error);
                    await record(pageIndex, true, errMsg, 0, 0);
                }
                pageIndex++;
                if (!hasNextPage(pageIndex, pageSize, total, photos)) {
                    break;
                }
                await randomSleep(env, cfg.Images.randomSeconds);
            }
        }

        // 运行内补偿：仅重采 failed/missing 相片页（按 picKey 合并入 photos，避免分页对齐错位）
        // compensateOnly 模式则只跑这段（手动重试用）
        if (reliability) {
            await Compensator.compensate<PhotoItem>({
                ledger: reliability.ledger,
                uin: reliability.uin,
                module: moduleId,
                batchId: reliability.batchId,
                pageSize,
                fetchPage: async (pi) => {
                    const call = imageList(env.ctx, env.config, String(album.id), pi);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^shine0_Callback\(/);
                    const data = res.data || {};
                    return { items: (data.photoList || []) as PhotoItem[], total: data.totalInAlbum || 0 };
                },
                // 相片以 picKey 去重，用 union 合并而非按页码切片，规避 unionItems 导致的不对齐
                applyPage: (_pi, items) => {
                    photos = unionItems(photos, items);
                    setUploadTimeField(items);
                },
                rebuild: () => photos,
                afterPage: async (all) => {
                    if (onPage) await onPage(all);
                },
                sleep: (ms) => env.sleep(ms),
            });
        }

        if (!this.isNewAlbum(album.id)) {
            // 已备份相册：合并、过滤历史数据并按上传时间倒序
            photos = unionBackedUpItems(cfg, oldPhotos, photos);
            photos = sortBy(photos, cfg.IncrementField, true);
        }
        return photos;
    }

    /**
     * 详情递归方式获取单个相册的相片列表（移植自 photos.js getAlbumImageAllListByDetail L442-538）
     */
    /**
     * 详情递归方式获取单个相册的相片列表（移植自 photos.js getAlbumImageAllList Detail 分支）
     * @param onPage 每批完成后的回调（页级断点用）
     * @param initialPhotos 续传时已采集的部分相片（从 staging 恢复）
     */
    private async collectImagesByDetail(
        album: AlbumItem,
        oldPhotos: PhotoItem[],
        onPage?: (photos: PhotoItem[]) => Promise<void>,
        initialPhotos?: PhotoItem[],
        reliability?: { ledger: PageLedger; uin: string; batchId: string },
        compensateOnly = false,
        /** 手动重试时的起始游标（来自 ledger.cursor，精确续采失败批次）；缺省则回退「最后一张已采集相片」 */
        startCursor?: string,
    ): Promise<PhotoItem[]> {
        const env = this.env;
        const cfg = env.config.Photos;
        // 详情递归模式按 picKey 翻页，无法用页码切片定位失败页，故按「批次序号」记账。
        // 方案 A：失败批次运行内重试 MAX_RETRY 次（吸收偶发抖动），全败才 break 断链。
        // 方案 B：失败时把请求的 picKey 记为 cursor，手动重试从 cursor 精确续采失败批次。
        const moduleId = this.module + ':' + String(album.id);
        const MAX_RETRY = DEFAULT_MAX_RETRY;
        const record = async (pi: number, hadError: boolean, errMsg: string | undefined, actual: number, retryCount: number, cursor?: string): Promise<void> => {
            if (!reliability) return;
            const expected = deriveExpectedCount(0, pi, 1); // 详情模式无法预知总数，expected=0 → 仅异常检测
            const state = FailureDetector.classify({ hadError, lastError: errMsg, actual, expected, retryCount, maxRetry: MAX_RETRY });
            await reliability.ledger.record(reliability.uin, moduleId, {
                uin: reliability.uin,
                module: moduleId,
                pageIndex: pi,
                batchId: reliability.batchId,
                fetchedAt: Date.now(),
                state,
                itemCount: actual,
                expectedCount: expected,
                retryCount,
                lastError: errMsg,
                title: album.name,
                cursor,
            });
        };

        let photos: PhotoItem[] = initialPhotos ? [...initialPhotos] : [];
        let picKey: string;

        if (startCursor) {
            // 方案 B：手动重试从 ledger.cursor（失败游标）精确续采失败批次，
            // 无需依赖「最后一张已采集相片」（多数情况二者相同，但显式游标更健壮、可诊断）。
            picKey = startCursor;
            env.logger.info('相册[' + album.id + ']续传：从失败游标 ' + startCursor + ' 处继续');
        } else if (photos.length > 0) {
            // 续传：从已有相片的最后一张继续递归
            picKey = getImageKey(photos[photos.length - 1]!);
            env.logger.info('相册[' + album.id + ']续传：从已有 ' + photos.length + ' 张相片处继续');
        } else {
            // 先取相册第一页的相片列表，再以第一张相片递归详情列表
            let firstPagePhotos: PhotoItem[] = [];
            try {
                const call = imageList(env.ctx, env.config, String(album.id), 0);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^shine0_Callback\(/);
                const data = res.data || {};
                if (data.topic) {
                    album.pre = data.topic.pre || album.pre;
                    album.url = data.topic.url || album.url;
                }
                firstPagePhotos = data.photoList || [];
            } catch (error) {
                env.logger.error(`获取相册首页相片列表异常 | 相册#${album.id}`, error instanceof Error ? error.message : String(error));
            }
            if (firstPagePhotos.length === 0) {
                await record(0, false, undefined, 0, 0);
                return [];
            }
            picKey = getImageKey(firstPagePhotos[0]!);
        }

        let pageIndex = 0;
        for (;;) {
            await env.tick();
            let pageItems: PhotoItem[] = [];
            let isLast = false;
            let total: number;
            let success = false;
            let lastErr: unknown;
            // 方案 A：运行内重试——失败批次对同一 picKey 重试 MAX_RETRY 次（带间隔），
            // 吸收偶发网络抖动/接口超时，避免一次抖动就断链导致「失败批 + 后续所有批次」全丢。
            for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
                try {
                    const call = imageInfo(env.ctx, env.config, String(album.id), picKey);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn('获取所有相片的详情异常 | code=' + res.code, res.msg || '');
                    }
                    const data = res.data || {};
                    pageItems = data.photos || [];
                    isLast = data.last === 1;
                    total = data.picTotal || -1;
                    // 设置增量比较字段
                    setUploadTimeField(pageItems);
                    // 按相片Key去重合并
                    photos = unionByImageKey(photos, pageItems);
                    await env.report('photos', photos.length, total, undefined, album.name);
                    // 页级断点：每批完成后保存进度
                    if (onPage) {
                        await onPage(photos);
                    }
                    await record(pageIndex, false, undefined, pageItems.length, attempt);
                    success = true;
                    break;
                } catch (error) {
                    lastErr = error;
                    if (attempt < MAX_RETRY) {
                        env.logger.warn(
                            `获取相片详情失败（第 ${attempt + 1}/${MAX_RETRY} 次重试） | 相册=${album.id} | picKey=${picKey}`,
                            error,
                        );
                        await randomSleep(env, cfg.Images.Info.randomSeconds);
                    }
                }
            }
            if (!success) {
                // 方案 B：重试耗尽仍失败——记 failed（retryCount=0，保留可重试性，不死 dead），
                // 并把请求的 picKey 记为 cursor，供手动重试从该游标精确续采；随后断链 break。
                env.logger.error(`获取相片详情异常（重试耗尽） | 相册#${album.id} | picKey=${picKey}`, lastErr instanceof Error ? lastErr.message : String(lastErr));
                await record(pageIndex, true, lastErr instanceof Error ? lastErr.message : String(lastErr), 0, 0, picKey);
                break;
            }
            if (!isGetNextPage(oldPhotos, pageItems, cfg) || isLast || pageItems.length === 0) {
                break;
            }
            // 以本页最后一张相片继续递归
            picKey = getImageKey(pageItems[pageItems.length - 1]!);
            await randomSleep(env, cfg.Images.Info.randomSeconds);
            pageIndex++;
        }

        if (!this.isNewAlbum(album.id)) {
            photos = unionBackedUpItems(cfg, oldPhotos, photos);
            photos = sortBy(photos, cfg.IncrementField, true);
        }
        return photos;
    }

    /**
     * 断点补偿（手动重试）：仅对 ledger 中 failed/missing 的相册列表页与相片页重采，
     * 重采后补全相册详情/下载任务/评论/赞并重新导出。
     */
    async retryFailedPages(ctx: CollectContext): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const reliability = { ledger: ctx.ledger, uin: String(ctx.uin), batchId: ctx.batchId };
        // 从 staging 恢复已采集的相册（含相片列表），仅对失败页补偿，不整段重拉
        const albums = await env.loadStaging<AlbumItem[]>(this.module);
        if (!albums || albums.length === 0) {
            env.logger.warn('相册 staging 丢失，无法重试失败页');
            return;
        }
        this.oldAlbums = (await env.getOldData<AlbumItem[]>(this.module)) || [];

        // 精确补偿：只重采「有失败相片页的相册」，跳过已完成相册，避免整模块重抓所有相片的点赞/评论。
        // ledger 的 Photos 记录在 composite 子键 `Photos:<albumId>` 下，用 listFailedUnder 前缀查一次性取出失败相册 ID。
        // 仅把 failed/missing（可重试）算入；dead 为终态、不再补偿该相册。
        const failedRecs = ctx.ledger ? await ctx.ledger.listFailedUnder(String(ctx.uin), this.module) : [];
        const failedAlbumIds = new Set(
            failedRecs
                .filter((r) => r.state === 'failed' || r.state === 'missing')
                .map((r) => decodeURIComponent(r.module).split(':')[1])
                .filter((id): id is string => Boolean(id)),
        );
        // 方案 B：Detail 模式失败批次的游标（ledger.cursor）。albumId -> 失败游标 picKey，
        // 供手动重试从该游标精确续采失败批次（而非依赖「最后一张已采集相片」）。
        // 多批次失败时取最早记录（listFailedUnder 已按写入序，首个即最早）。
        const failedAlbumCursors = new Map<string, string>();
        for (const r of failedRecs) {
            if (r.state !== 'failed' && r.state !== 'missing') continue;
            if (!r.cursor) continue;
            const id = decodeURIComponent(r.module).split(':')[1];
            if (!id) continue;
            if (!failedAlbumCursors.has(id)) failedAlbumCursors.set(id, r.cursor);
        }
        // ledger 异常/查不到失败时回退全量（保留原行为），否则只处理失败相册
        const targetAlbums = failedAlbumIds.size > 0
            ? albums.filter((a) => failedAlbumIds.has(String(a.id)))
            : albums;

        await env.report('albums', 0, targetAlbums.length, undefined, undefined, { done: 0, total: targetAlbums.length });
        for (let index = 0; index < targetAlbums.length; index++) {
            const album = targetAlbums[index]!;
            // 跳过无权限 / 非选中相册
            if (album.allowAccess === 0) continue;
            if (this.selectedAlbums.length > 0 && !this.selectedAlbums.some((item) => item.id === album.id)) continue;
            // 仅补偿相片页（列表/详情），跳过已完成守卫；Detail 模式带失败游标精确续采
            await this.collectAlbumPhotoList(album, albums, reliability, true, failedAlbumCursors.get(String(album.id)));
            // 补全该相册的详情/下载任务/评论/赞（与 collect 主循环一致，skip guard 防重复）
            await this.collectAlbumImageInfos(album);
            this.refreshAlbumPhotoInfo(album);
            const registry = new MediaTaskRegistry(env, this.module);
            await this.addAlbumDownloadTasks(album, albums, registry);
            await this.collectImageComments(album.photoList || []);
            for (const photo of (album.photoList || [])) {
                photo.uniKey = getPhotoUniKey(env.ctx.targetUin, photo);
            }
            if (isGetLike(cfg)) {
                await forEachNewItemBatch(env, album.photoList || [], 10, (photo) => collectLikes(env, photo, cfg.Like), 'photo-likes');
            }
            await this.addPhotoCommentImageTasks([album], registry);
            await env.report('albums', index + 1, targetAlbums.length, undefined, album.name, { done: index + 1, total: targetAlbums.length });
        }

        // 重新导出数据文件（查看器读取 Albums/json/albums.js）
        await env.report('export', 0, 1);
        await writeModuleOutputs(env, {
            module: 'Photos',
            globalName: 'albums',
            data: albums,
            jsonJsPath: 'Albums/json/albums.js',
            jsonFilePath: 'Albums/json/albums.json',
            markdown: true,
        });
        await env.report('export', 1, 1);
    }

    /**
     * 获取单个相册所有相片的详情（移植自 photos.js getAllImagesInfos L82-202）
     */
    private async collectAlbumImageInfos(album: AlbumItem): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        if (cfg.Images.listType === 'Detail') {
            // 列表类型为详情列表时无需再额外获取详情：
            // 该模式下相片列表本身即由浮层接口 cgi_floatview_photo_list_v2 递归翻页取得，
            // 条目已是完整的详情结构（含 video_info.download_url 原视频地址）
            return;
        }
        if (!cfg.Images.Info.isGet && !cfg.Images.isGetVideo) {
            // 无需获取详情也无需获取视频
            return;
        }
        const photos = album.photoList || [];
        // 相片Key → 相片
        const picKeyMaps = new Map<string, PhotoItem>();
        for (const photo of photos) {
            picKeyMaps.set(getImageKey(photo), photo);
        }
        // 已获取过详情的相片
        const picInfoCache = new Set<string>();

        let done = 0;
        for (const [picKey, photo] of picKeyMaps) {
            done++;
            if (!this.isNewPhoto(album.id, photo)) {
                // 已备份数据跳过不处理
                continue;
            }
            // 勾选获取详情时需要获取；未勾选但勾选了获取视频时，相片为视频才获取
            const isGetImageInfo = (photo.is_video && cfg.Images.isGetVideo) || cfg.Images.Info.isGet;
            if (!isGetImageInfo) {
                continue;
            }
            if (picInfoCache.has(picKey)) {
                // 获取过详情，跳过
                continue;
            }
            await env.tick();
            try {
                const call = imageInfo(env.ctx, env.config, String(album.id), picKey);
                const text = await env.requester.get(call.url, call.params);
                const res = toJson<any>(text, /^_Callback\(/);
                if (res.code && res.code != 0) {
                    env.logger.warn('获取所有相片的详情异常 | code=' + res.code, res.msg || '');
                }
                const infoPhotos: PhotoItem[] = (res.data || {}).photos || [];
                for (const infoPhoto of infoPhotos) {
                    if (!infoPhoto || !infoPhoto.picKey) {
                        env.logger.warn(`无法获取到图片详情，将使用列表默认值 | 相册#${album.id} | 相片#${photo.picKey || getImageKey(photo)}`);
                        continue;
                    }
                    // 将详情与列表的相片进行匹配
                    const targetPhoto = picKeyMaps.get(infoPhoto.picKey);
                    if (!targetPhoto) {
                        env.logger.warn(`相片详情与列表的相片进行匹配异常 | 相册#${album.id} | 相片#${infoPhoto.picKey || getImageKey(infoPhoto)}`);
                        continue;
                    }
                    // 清空源属性后拷贝覆盖（与旧版一致）
                    for (const key of Object.keys(targetPhoto)) {
                        delete targetPhoto[key];
                    }
                    Object.assign(targetPhoto, infoPhoto);
                    picInfoCache.add(getImageKey(targetPhoto));
                }
            } catch (error) {
                env.logger.error(`获取相片详情异常 | 相册#${album.id} | 相片#${photo.picKey || getImageKey(photo)}`, error instanceof Error ? error.message : String(error));
            }
            await env.report('photo-infos', done, picKeyMaps.size);
            // 请求一页成功后等待指定秒数后再请求下一页
            await randomSleep(env, cfg.Images.Info.randomSeconds);
        }
    }

    /**
     * 刷新单个相册内相片的相册、分类信息（移植自 photos.js refreshPhotoAlbumInfo L220-230）
     * 必须在 collectAlbumImageInfos 之后调用：取详情会先清空相片对象的全部字段。
     */
    private refreshAlbumPhotoInfo(album: AlbumItem): void {
        for (const photo of album.photoList || []) {
            photo.albumId = album.id;
            photo.albumClassId = album.classid;
            photo.albumClassName = album.className || this.classMap[album.classid!] || '其他';
            // 上传时间字段兼容
            if (!photo.uploadTime && photo.uploadtime) {
                photo.uploadTime = photo.uploadtime;
            }
        }
    }

    /**
     * 获取所有相片的评论（移植自 photos.js getAllImagesComments/getImageAllComments L695-785）
     */
    private async collectImageComments(photos: PhotoItem[]): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const commentsCfg = cfg.Images.Comments;
        if (!commentsCfg.isGet || isPhotoFileExport(cfg.exportType)) {
            return;
        }
        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index]!;
            if (photo.cmtTotal === 0) {
                // 没评论时跳过
                continue;
            }
            if (!this.isNewPhoto(photo.albumId!, photo)) {
                // 已备份数据跳过不处理
                continue;
            }
            // 清空相片原有的评论
            photo.comments = [];
            let pageIndex = 0;
            for (;;) {
                await env.tick();
                try {
                    const call = imageComments(env.ctx, env.config, String(photo.albumId), photo.lloc!, pageIndex);
                    const text = await env.requester.get(call.url, call.params);
                    const res = toJson<any>(text, /^_Callback\(/);
                    if (res.code && res.code != 0) {
                        env.logger.warn(`获取单张相片的所有评论异常 | 相片#${photo.picKey || getImageKey(photo)} | code=${res.code}`, res.msg || '');
                    }
                    const comments: CommentRecord[] = (res.data || {}).comments || [];
                    photo.comments = unionItems(photo.comments, comments);
                    if (!isGetNextPage(this.oldAlbums, comments, { ...cfg, ...commentsCfg } as any)) {
                        break;
                    }
                } catch (error) {
                    env.logger.error(`获取单张相片的评论列表异常 | 相片#${photo.picKey || getImageKey(photo)} | page=${pageIndex + 1}`, error instanceof Error ? error.message : String(error));
                }
                pageIndex++;
                if (!hasNextPage(pageIndex, commentsCfg.pageSize, photo.cmtTotal || 0, photo.comments!)) {
                    break;
                }
                await randomSleep(env, commentsCfg.randomSeconds);
            }
            await env.report('photo-comments', index + 1, photos.length);
        }
    }

    /**
     * 添加相册与相片下载任务（移植自 photos.js addAlbumsDownloadTasks L792-971）
     */
    private async addAlbumDownloadTasks(album: AlbumItem, albums: AlbumItem[], registry: MediaTaskRegistry): Promise<void> {
        const env = this.env;
        const cfg = env.config.Photos;
        const photos = album.photoList || [];

        // 新备份数据才添加预览图与评论图下载任务
        if (this.isNewAlbum(album.id)) {
            await this.addPreviewTask(album, 'Albums/images', registry);
            await this.addCommentImageTasks(album, 'Albums/images', registry);
        }

        // 相册文件夹
        const albumFolder = getAlbumFolderPath(album, albums.length, cfg, this.classMap);

        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index]!;
            if (!this.isNewPhoto(album.id, photo)) {
                // 已备份数据跳过不处理
                continue;
            }

            // 下载存放的文件夹（按文件夹结构类型分类）
            const categoryPath = getFileStructureFolderPath(
                parseDate(((photo.rawshoottime || photo.shootTime) || (photo.uploadtime || photo.uploadTime))!).getTime(),
                cfg.Images.fileStructureType,
            );
            const downloadFolder = categoryPath ? albumFolder + '/' + categoryPath : albumFolder;

            if (registry.isQzoneUrl()) {
                // QQ空间外链导出时不添加下载任务，但仍需按清晰度确定地址
                try {
                    photo.custom_url = getDownloadUrl(photo, cfg.Images.exifType);
                } catch (error) {
                    env.logger.error('添加下载任务异常', error instanceof Error ? error.message : String(error));
                }
            } else if (photo.is_video && photo.video_info) {
                // 相片为视频：预览图与视频共用一个文件名
                const filename = getImageFileName(photo, cfg);
                photo.custom_url = getDownloadUrl(photo, cfg.Images.exifType);

                // 下载视频预览图
                photo.custom_pre_filename = filename + getPhotoSuffix(photo);
                photo.custom_pre_filepath = albumFolder + '/images/' + photo.custom_pre_filename;
                registry.newPreviewTask(photo.custom_url, albumFolder + '/images', photo.custom_pre_filename, photo);

                // 下载视频
                photo.custom_filename = filename + '.mp4';
                // 优先取 download_url（浮层接口下发的原视频 MP4）；
                // 未获取相片详情或接口未下发时回落 video_url（转码播放档，可能为 M3U8）
                const videoUrl = photo.video_info.download_url || photo.video_info.video_url!;
                registry.newTask(videoUrl, downloadFolder, photo.custom_filename, photo);
                photo.custom_filepath = downloadFolder + '/' + photo.custom_filename;
            } else {
                // 根据配置的清晰度匹配图片
                photo.custom_url = getDownloadUrl(photo, cfg.Images.exifType);

                // 文件名称
                photo.custom_filename = getImageFileName(photo, cfg) + getPhotoSuffix(photo);
                registry.newTask(photo.custom_url, downloadFolder, photo.custom_filename, photo);
                photo.custom_filepath = downloadFolder + '/' + photo.custom_filename;

                // 预览图默认使用原图
                photo.custom_pre_filepath = photo.custom_filepath;
                if (cfg.Images.isGetPreview && photo.pre) {
                    // 需要单独获取预览图（photo.pre 存在才登记，否则 custom_pre_filepath 回退为原图，
                    // 避免查看器按预览路径取到一个不存在的文件）
                    photo.custom_pre_filepath = albumFolder + '/images/' + photo.custom_filename;
                    registry.newPreviewTask(photo.pre, albumFolder + '/images', photo.custom_filename, photo);
                }
            }

            // 相片描述/名称里的 QQ 表情（[em]e123[/em] → Common/images/e123.gif）
            // 相片描述常含表情（如「[em]e100[/em]海边留影」），下载后查看器/MD 才能离线看
            await registry.addEmoticons([photo.desc, photo.name], photo);
        }
    }

    /**
     * 添加相片评论配图的下载任务（须在相片评论采集之后调用）
     */
    private async addPhotoCommentImageTasks(albums: AlbumItem[], registry: MediaTaskRegistry): Promise<void> {
        const cfg = this.env.config.Photos;
        if (isPhotoFileExport(cfg.exportType)) {
            // 相片导出类型为文件时不处理评论的配图
            return;
        }
        for (const album of albums) {
            const albumFolder = getAlbumFolderPath(album, albums.length, cfg, this.classMap);
            for (const photo of album.photoList || []) {
                if (!this.isNewPhoto(album.id, photo)) {
                    // 已备份数据跳过不处理
                    continue;
                }
                await this.addCommentImageTasks(photo, albumFolder + '/images', registry);
            }
        }
    }

    /**
     * 添加相册预览图的下载任务（移植自 photos.js addPreviewDownloadTasks L815-829）
     */
    private async addPreviewTask(album: AlbumItem, dir: string, registry: MediaTaskRegistry): Promise<void> {
        if (registry.isQzoneUrl()) {
            // QQ空间外链导出时不需要添加下载任务
            return;
        }
        album.custom_url = album.custom_url || album.url || album.pre;
        if (!album.custom_url) {
            return;
        }
        // 用URL哈希作文件名，同一URL总得同名以支持去重；后缀用统一解析（修复 #2）
        album.custom_filename = hashString(album.custom_url) + (await resolveMediaSuffix(album.custom_url, this.env));
        album.custom_filepath = dir + '/' + album.custom_filename;
        registry.newPreviewTask(album.custom_url, dir, album.custom_filename, album);
    }

    /**
     * 添加评论配图的下载任务（移植自 photos.js addCommentDownloadTasks L835-858）
     */
    private async addCommentImageTasks(
        item: AlbumItem | PhotoItem,
        dir: string,
        registry: MediaTaskRegistry,
    ): Promise<void> {
        const env = this.env;
        item.comments = item.comments || [];
        for (const comment of item.comments) {
            for (const image of comment.pic || []) {
                image.custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                if (registry.isQzoneUrl()) {
                    // QQ空间外链导出时不需要添加下载任务
                    continue;
                }
                const suffix = await resolveMediaSuffix(image.custom_url as string, env);
                image.custom_filename = hashString(image.custom_url as string) + suffix;
                image.custom_filepath = dir + '/' + image.custom_filename;
                registry.newTask(image.custom_url as string, dir, image.custom_filename as string, item);
            }
            // 登记评论及回复的用户头像下载
            if (this.avatars && comment.user?.uin) {
                this.avatars.download({ uin: comment.user.uin });
            }
            for (const reply of comment.list_3 || []) {
                if (this.avatars && reply.user?.uin) {
                    this.avatars.download({ uin: reply.user.uin });
                }
            }
        }
    }
}

/**
 * 设置增量比较字段（移植自 common.js setCompareFiledInfo 对 uploadtime→uploadTime 的调用）
 */
function setUploadTimeField(photos: PhotoItem[]): void {
    for (const photo of photos) {
        if (photo.uploadtime === undefined || photo.uploadTime !== undefined) {
            continue;
        }
        photo.uploadTime = Math.floor(parseDate(photo.uploadtime).getTime() / 1000);
    }
}

/** 按相片Key去重合并（移植自 photos.js 中 _.unionBy(..., getImageKey) 的用法） */
function unionByImageKey(target: PhotoItem[], source: PhotoItem[]): PhotoItem[] {
    const keys = new Set(target.map((photo) => getImageKey(photo)));
    const merged = target.slice();
    for (const photo of source) {
        const key = getImageKey(photo);
        if (keys.has(key)) {
            continue;
        }
        keys.add(key);
        merged.push(photo);
    }
    return merged;
}
