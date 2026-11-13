// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Requester } from '../core/qzone-api/request';
import { Logger } from '../core/shared/logger';
import type { CollectorEnv, QzoneBackupConfig } from '../core/collector/modules/types';
import type { CollectContext } from '../core/collector/pipeline';
import { PhotosCollector } from '../core/collector/modules/photos';
import { isGetNextPage } from '../core/collector/modules/helpers';
import { imageList } from '../core/qzone-api/clients';

const OLD = '2023-01-01 00:00:00';
const BACKUP = '2024-06-01 00:00:00';
const NEW = '2024-10-01 00:00:00';

// 模拟"全局=上次之后、相册继承全局"解析后的配置（采集器直接读 env.config，不走 resolveConfig）
function makePhotosConfig(): QzoneBackupConfig {
    const seconds = { min: 0, max: 0 };
    return {
        Common: { mediaMode: 'Download', downloadType: 'Browser', isAutoFileSuffix: false, AvatarHost: -1 },
        Photos: {
            exportType: 'HTML',
            pageSize: 3000,
            randomSeconds: seconds,
            Comments: { isGet: false, pageSize: 100, randomSeconds: seconds },
            Images: {
                pageSize: 90,
                listType: 'List',
                randomSeconds: seconds,
                Comments: { isGet: false, pageSize: 100, randomSeconds: seconds },
                exifType: 'raw',
                Info: { isGet: false, pageSize: 200, randomSeconds: seconds },
                isGetVideo: false,
                isGetPreview: false,
                fileStructureType: 'File',
                RenameType: 'Default',
            },
            // 关键：继承关闭、显式上次之后 + 上次备份时间（模拟引擎覆盖后的结果）
            IncrementInherit: false,
            IncrementType: 'LastTime',
            IncrementTime: BACKUP,
            IncrementField: 'uploadTime',
            Like: { isGet: false, randomSeconds: seconds },
            Visitor: { isGet: false, pageSize: 24, randomSeconds: seconds },
        },
    } as unknown as QzoneBackupConfig;
}

function makeEnv(
    responses: Array<{ match: string; body: string }>,
    config: QzoneBackupConfig,
    oldData: Record<string, unknown>,
) {
    const fetchFn = (async (url: string) => {
        const hit = responses.find((item) => url.includes(item.match));
        const body = hit ? hit.body : '{"code":0,"data":{}}';
        return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }) as unknown as typeof fetch;

    let lastStaging: unknown = undefined;
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
        report: async () => {},
        fail: () => {},
        getOldData: async (module) => oldData[module] as any,
        addMediaTask: () => {},
        detectSuffix: async () => '.jpg',
        writeJsonToJs: async () => {},
        writeText: async () => {},
        writeFile: async () => {},
        loadStaging: async () => undefined,
        saveStaging: async (_mod, data) => {
            lastStaging = data;
        },
        sleep: async () => {},
    };
    return { env, getLastStaging: () => lastStaging as any };
}

const fakeCtx = { uin: 1001, report: async () => {}, tick: async () => {} } as unknown as CollectContext;

describe('相册/相片增量备份实证', () => {
    it('上次备份后：旧相片保留、仅新相片被合并（相片内容增量生效）', async () => {
        const config = makePhotosConfig();
        // 已备份的相册：含 2 张旧相片（均早于备份时间）
        const savedAlbums = [
            {
                id: 1,
                name: 'A',
                photoList: [
                    { id: 101, uploadTime: OLD },
                    { id: 102, uploadTime: OLD },
                ],
            },
        ];
        const albumListBody = JSON.stringify({
            code: 0,
            data: { albumsInUser: 1, albumList: [{ id: 1, name: 'A', total: 3, lastuploadtime: OLD }] },
        });
        // 当前相册相片：2 张旧 + 1 张新（晚于备份时间）
        const imageListBody = JSON.stringify({
            code: 0,
            data: {
                totalInAlbum: 3,
                photoList: [
                    { id: 101, uploadTime: OLD },
                    { id: 102, uploadTime: OLD },
                    { id: 103, uploadTime: NEW },
                ],
            },
        });

        const { env, getLastStaging } = makeEnv(
            [
                { match: 'fcg_list_album_v3', body: albumListBody },
                { match: 'cgi_list_photo', body: imageListBody },
            ],
            config,
            { Photos: savedAlbums },
        );

        await new PhotosCollector(env).collect(fakeCtx);

        const albums = getLastStaging();
        expect(Array.isArray(albums)).toBe(true);
        const album = (albums as any[])[0];
        expect(album).toBeTruthy();
        const ids = album.photoList.map((p: any) => p.id).sort();
        // 增量合并：旧相片(101,102)保留 + 新相片(103)加入 = 3 张，而非仅新相片
        expect(ids).toEqual([101, 102, 103]);
        expect(album.photoList.find((p: any) => p.id === 103)).toBeTruthy();
        expect(album.photoList.find((p: any) => p.id === 101)).toBeTruthy();
    });

    it('相册列表分页停止：Photos 增量字段(uploadTime)不适用于相册对象 → 永远不提前停止（已知缺陷）', () => {
        // 模拟 resolveConfig 注入的 Photos 配置：IncrementField=uploadTime（给相片用）
        const cfg = { IncrementType: 'LastTime', IncrementTime: BACKUP, IncrementField: 'uploadTime' } as any;
        // 相册对象只有 lastuploadtime / createtime，没有 uploadTime
        const oldAlbums = [{ id: 1, lastuploadtime: OLD }] as any;
        const pageItems = [{ id: 1, lastuploadtime: OLD }] as any;
        // 期望：有历史且本页已到增量位置时应停止；实际因字段错配返回 true（继续全量枚举）
        const shouldStop = !isGetNextPage(oldAlbums, pageItems, cfg);
        expect(shouldStop).toBe(false); // 当前缺陷：未提前停止
    });

    it('回归：相册改名（ID 相同）视为同一相册，仅同步新名、不重下、无双相册输出', async () => {
        const config = makePhotosConfig();
        // 真实备份历史状态：album.id 为字符串、isNewItem 未打标（首次全量/迁移后常见）
        const savedAlbums = [
            {
                id: '1',
                name: 'A',
                photoList: [
                    { id: 101, uploadTime: OLD },
                    { id: 102, uploadTime: OLD },
                ],
            },
        ];
        // 接口实时返回：同一 albumId，但相册改名 name='B'
        const albumListBody = JSON.stringify({
            code: 0,
            data: { albumsInUser: 1, albumList: [{ id: '1', name: 'B', total: 3, lastuploadtime: OLD }] },
        });
        const imageListBody = JSON.stringify({
            code: 0,
            data: {
                totalInAlbum: 3,
                photoList: [
                    { id: 101, uploadTime: OLD },
                    { id: 102, uploadTime: OLD },
                    { id: 103, uploadTime: NEW },
                ],
            },
        });

        const { env, getLastStaging } = makeEnv(
            [
                { match: 'fcg_list_album_v3', body: albumListBody },
                { match: 'cgi_list_photo', body: imageListBody },
            ],
            config,
            { Photos: savedAlbums },
        );

        await new PhotosCollector(env).collect(fakeCtx);

        const albums = getLastStaging() as any[];
        expect(Array.isArray(albums)).toBe(true);
        // 改名（ID 相同）视为同一相册：只输出一个相册，无双相册
        expect(albums).toHaveLength(1);
        const album = albums[0];
        // 名称已同步为最新名 'B'
        expect(album.name).toBe('B');
        const ids = album.photoList.map((p: any) => p.id).sort();
        // 旧相片(101,102) 保留 + 新相片(103) 加入
        expect(ids).toEqual([101, 102, 103]);
        // 旧相片标记为「非新」→ 不重下；新相片标记为「新」→ 下载
        expect(album.photoList.find((p: any) => p.id === 101).isNewItem).toBe(false);
        expect(album.photoList.find((p: any) => p.id === 102).isNewItem).toBe(false);
        expect(album.photoList.find((p: any) => p.id === 103).isNewItem).toBe(true);
    });
});

describe('imageList 首页只取 1 张（缩小 cgi_list_photo 脏数据命中面）', () => {
    it('传 pageNum=1 时只影响本页条数，pageStart 与 URL 不变', () => {
        const cfg = makePhotosConfig();
        const ctx = { gtk: 1, targetUin: 2, ownerUin: 3, route: 102, token: 'tk' } as any;
        const first = imageList(ctx, cfg, 'album1', 0, 1);
        expect(first.url).toContain('cgi_list_photo');
        expect(first.params.pageNum).toBe(1);
        expect(first.params.pageStart).toBe(0);
        expect(first.params.topicId).toBe('album1');
        // 其它调用不传 pageNum 时仍按配置（90）并按页偏移
        const normal = imageList(ctx, cfg, 'album1', 2);
        expect(normal.params.pageNum).toBe(cfg.Photos.Images.pageSize);
        expect(normal.params.pageStart).toBe(2 * cfg.Photos.Images.pageSize);
    });
});
