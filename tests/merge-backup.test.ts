import { describe, it, expect } from 'vitest';
import {
    compareBackups,
    mergeBackups,
    type BackupFs,
} from '../core/export/merge-backup';

/** 内存 FS：json 直接存对象、二进制存 Uint8Array，聚焦逻辑不模拟文本解析 */
class MemFs implements BackupFs {
    json = new Map<string, unknown>();
    files = new Map<string, Uint8Array>();

    async readJson(p: string): Promise<unknown | null> {
        return this.json.get(p) ?? null;
    }
    async writeJson(p: string, data: unknown): Promise<void> {
        this.json.set(p, data);
    }
    async writeJs(p: string, _globalName: string, data: unknown): Promise<void> {
        this.json.set(p, data);
    }
    async exists(p: string): Promise<boolean> {
        return this.files.has(p) || this.json.has(p);
    }
    async readBinary(p: string): Promise<Uint8Array | null> {
        return this.files.get(p) ?? null;
    }
    async writeBinary(p: string, data: Uint8Array): Promise<void> {
        this.files.set(p, data);
    }
    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }
    async listDir(relDir: string): Promise<string[]> {
        const prefix = relDir.endsWith('/') ? relDir : relDir + '/';
        return [...this.files.keys()].filter((p) => p.startsWith(prefix));
    }
}

const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('合并备份引擎', () => {
    it('Friends 合并：旧有新无的好友打 deleted 标记，共有好友清除标记', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        const friendsJson = 'Friends/json/friends.json';
        const friendsJs = 'Friends/json/friends.js';
        const oldFriends = { total: 2, items: [
            { uin: 111, nick: '还在的', deleted: true },  // 上次合并打的标记，本次名单里还在 → 应清除
            { uin: 222, nick: '被删的' },                  // 本次全量名单没有 → 打 deleted
        ] };
        const newFriends = { total: 2, items: [
            { uin: 111, nick: '还在的' },
            { uin: 333, nick: '新好友' },
        ] };
        await oldFs.writeJson(friendsJson, oldFriends);
        await oldFs.writeJson(friendsJs, oldFriends);
        await newFs.writeJson(friendsJson, newFriends);
        await newFs.writeJson(friendsJs, newFriends);

        const { modules } = await mergeBackups(oldFs, newFs, { modules: ['Friends'] });
        const m = modules.find((x) => x.module === 'Friends')!;
        expect(m.addedItems).toBe(1); // 仅 222 并入
        const merged = newFs.json.get(friendsJson) as any;
        expect(merged.total).toBe(3);
        const byUin = new Map<number, any>(merged.items.map((x: any) => [Number(x.uin), x]));
        expect(byUin.get(222).deleted).toBe(true);   // 旧有新无 → 已删除
        expect(byUin.get(111).deleted).toBe(false);  // 本次名单还在 → 清除标记
        expect(byUin.get(333).deleted).toBeUndefined();
    });

    it('仅旧有主体整体并入新备份', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [
            { tid: 'A', content: 'a' },
            { tid: 'B', content: 'b' },
            { tid: 'C', content: 'c' },
        ]);
        newFs.json.set('Messages/json/messages.json', [{ tid: 'A', content: 'a' }]);

        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Messages')!;
        expect(m.addedItems).toBe(2); // B、C 并入
        expect(m.addedChildRecords).toBe(0);
        const merged = newFs.json.get('Messages/json/messages.json') as any[];
        expect(merged.map((x) => x.tid).sort()).toEqual(['A', 'B', 'C']);
    });

    it('共有主体增量合并子项并去重', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [
            { tid: 'A', likes: [{ fuin: 1 }, { fuin: 2 }], custom_comments: [{ content: 'old-c', user: { uin: 5 } }] },
            { tid: 'B', likes: [{ fuin: 3 }] },
        ]);
        newFs.json.set('Messages/json/messages.json', [
            { tid: 'A', likes: [{ fuin: 1 }], custom_comments: [] },
            { tid: 'B', likes: [] },
        ]);

        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Messages')!;
        expect(m.addedItems).toBe(0);
        expect(m.addedChildRecords).toBe(3); // A:fuin2 + A:old-c + B:fuin3

        const merged = newFs.json.get('Messages/json/messages.json') as any[];
        const a = merged.find((x) => x.tid === 'A');
        expect(a.likes.length).toBe(2);
        expect(a.custom_comments.length).toBe(1);
        const b = merged.find((x) => x.tid === 'B');
        expect(b.likes.length).toBe(1);
    });

    it('访客（对象型子项）增量合并并去重', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [
            { tid: 'A', custom_visitor: { viewCount: 1, totalNum: 2, list: [{ uin: 1, visitTime: 100 }, { uin: 2, visitTime: 200 }] } },
        ]);
        newFs.json.set('Messages/json/messages.json', [
            { tid: 'A', custom_visitor: { viewCount: 1, totalNum: 1, list: [{ uin: 1, visitTime: 100 }] } },
        ]);
        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Messages')!;
        expect(m.addedChildRecords).toBe(1);
        const a = (newFs.json.get('Messages/json/messages.json') as any[])[0];
        expect(a.custom_visitor.list.length).toBe(2);
        expect(a.custom_visitor.totalNum).toBe(2);
    });

    it('对象型模块（Boards {items}）正确合并', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Boards/json/boards.json', { items: [{ uin: 1 }, { uin: 2 }], total: 2 });
        newFs.json.set('Boards/json/boards.json', { items: [{ uin: 1 }], total: 1 });

        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Boards')!;
        expect(m.addedItems).toBe(1);
        const merged = newFs.json.get('Boards/json/boards.json') as any;
        expect(merged.items.length).toBe(2);
        expect(merged.total).toBe(2);
    });

    it('整模块独有（新备份无该模块）整体并入', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Albums/json/albums.json', [{ albumId: 'al1' }, { albumId: 'al2' }]);

        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Photos')!;
        expect(m.wholeModuleMerged).toBe(true);
        expect(m.addedItems).toBe(2);
        expect(newFs.json.has('Albums/json/albums.json')).toBe(true);
    });

    it('媒体文件由旧备份补齐到新备份', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);
        newFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);
        oldFs.files.set('Common/images/p1.png', enc('PNGDATA'));
        oldFs.files.set('Messages/images/p2.jpg', enc('JPGDATA'));
        newFs.files.set('Common/images/p1.png', enc('PNGDATA')); // 已存在，不重复拷

        const { modules } = await mergeBackups(oldFs, newFs);
        expect(newFs.files.has('Messages/images/p2.jpg')).toBe(true);
        expect(newFs.files.has('Common/images/p1.png')).toBe(true);
        // 无媒体变化的模块不计拷贝
        expect(modules.find((x) => x.module === 'Messages')!.mediaCopied).toBe(0);
    });

    it('dryRun 不落盘', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A' }, { tid: 'B' }]);
        newFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);

        const before = JSON.stringify(newFs.json.get('Messages/json/messages.json'));
        await mergeBackups(oldFs, newFs, { dryRun: true });
        expect(JSON.stringify(newFs.json.get('Messages/json/messages.json'))).toBe(before);
    });

    it('比较阶段不修改输入数据', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        const newData = [{ tid: 'A', likes: [{ fuin: 1 }], custom_comments: [] }];
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A', likes: [{ fuin: 1 }, { fuin: 2 }] }]);
        newFs.json.set('Messages/json/messages.json', JSON.parse(JSON.stringify(newData)));

        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Messages')!;
        expect(m.sharedItems.length).toBe(1);
        expect(m.sharedItems[0]!.addedLikes).toBe(1);
        // newFs 原数据未被改动
        expect(JSON.stringify(newFs.json.get('Messages/json/messages.json'))).toBe(JSON.stringify(newData));
    });

    it('相册按 id 匹配，相同相册不误报为独有', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 旧备份：两个相册，a1 带 1 条相册评论、a2 无子项
        oldFs.json.set('Albums/json/albums.json', [
            { id: 'a1', name: '旅行', photoList: [{ picKey: 'p1' }], comments: [{ content: 'c1' }] },
            { id: 'a2', name: '家庭', photoList: [{ picKey: 'p2' }] },
        ]);
        // 新备份：同样两个相册，但 a1 还没有那条评论（其余结构一致）
        newFs.json.set('Albums/json/albums.json', [
            { id: 'a1', name: '旅行', photoList: [{ picKey: 'p1' }] },
            { id: 'a2', name: '家庭', photoList: [{ picKey: 'p2' }] },
        ]);

        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Photos')!;
        // 不应再把相册误报为「旧备份独有」（相片子项结构相同也不应误算为相册数）
        expect(m.onlyOldItems.length).toBe(0);
        // a1 匹配成功，且正确识别出新增的 1 条相册评论
        expect(m.sharedItems.length).toBe(1);
        expect(m.sharedItems[0]!.id).toBe('a1');
        expect(m.sharedItems[0]!.addedComments).toBe(1);
        expect(m.sharedItems[0]!.addedLikes).toBe(0);
        expect(m.sharedItems[0]!.addedVisitors).toBe(0);
    });

    it('比较阶段应携带新增评论/点赞/浏览的实际数组（供弹窗逐条展示）', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 旧备份：1 条评论(c1)、2 个点赞(fuin 1/2)、1 个访客(uin 7)
        // 新备份：已有 1 个点赞(fuin 1)、1 个访客(uin 7) → 旧比新多：1 条评论、1 个点赞(fuin 2)
        oldFs.json.set('Messages/json/messages.json', [
            {
                tid: 'A',
                custom_comments: [{ content: 'c1', user: { uin: 5 } }],
                likes: [{ fuin: 1 }, { fuin: 2 }],
                custom_visitor: { list: [{ uin: 7, visitTime: 1 }] },
            },
        ]);
        newFs.json.set('Messages/json/messages.json', [
            {
                tid: 'A',
                custom_comments: [],
                likes: [{ fuin: 1 }],
                custom_visitor: { list: [{ uin: 7, visitTime: 1 }] },
            },
        ]);
        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Messages')!;
        expect(m.sharedItems.length).toBe(1);
        const s = m.sharedItems[0]!;
        expect(s.addedCommentItems!.length).toBe(1);
        expect(s.addedCommentItems![0]!.content).toBe('c1');
        expect(s.addedLikeItems!.length).toBe(1);
        expect(s.addedLikeItems![0]!.fuin).toBe(2);
        // uin7 两边都有 → 不应出现在新增访客里
        expect(s.addedVisitorItems).toBeUndefined();
    });

    it('整模块独有时 onlyOldItems 携带全部评论/点赞/浏览数组', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [
            { tid: 'A', custom_comments: [{ content: 'only' }], likes: [{ fuin: 3 }] },
        ]);
        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Messages')!;
        expect(m.wholeModuleOnlyOld).toBe(true);
        expect(m.onlyOldItems[0]!.commentItems!.length).toBe(1);
        expect(m.onlyOldItems[0]!.commentItems![0]!.content).toBe('only');
        expect(m.onlyOldItems[0]!.likeItems!.length).toBe(1);
        expect(m.onlyOldItems[0]!.likeItems![0]!.fuin).toBe(3);
    });

    it('整模块独有时差异行携带该主体的评论/点赞/浏览数', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Albums/json/albums.json', [
            {
                id: 'a1', name: '旅行',
                comments: [{ content: 'c1' }],
                likes: [{ fuin: 9 }],
                custom_visitor: { list: [{ uin: 7, visitTime: 1 }] },
            },
        ]);
        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Photos')!;
        expect(m.wholeModuleOnlyOld).toBe(true);
        expect(m.onlyOldItems.length).toBe(1);
        expect(m.onlyOldItems[0]!.comments).toBe(1);
        expect(m.onlyOldItems[0]!.likes).toBe(1);
        expect(m.onlyOldItems[0]!.views).toBe(1);
    });

    it('共有相册里旧备份多出的相片应被识别为相片差异', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 旧备份 a1 有 p1、p2（p2 带 1 个赞）；新备份 a1 只有 p1
        oldFs.json.set('Albums/json/albums.json', [
            {
                id: 'a1', name: '旅行',
                photoList: [
                    { picKey: 'p1', name: '海边' },
                    { picKey: 'p2', name: '山顶', likes: [{ fuin: 1 }] },
                ],
            },
        ]);
        newFs.json.set('Albums/json/albums.json', [
            { id: 'a1', name: '旅行', photoList: [{ picKey: 'p1', name: '海边' }] },
        ]);

        const diffs = await compareBackups(oldFs, newFs);
        const m = diffs.find((d) => d.module === 'Photos')!;
        // 相册应正确匹配，不误报为独有
        expect(m.onlyOldItems.length).toBe(0);
        expect(m.sharedItems.length).toBe(1);
        const s = m.sharedItems[0]!;
        // 相册级无评论/点赞/浏览新增，但有 1 张新增相片
        expect(s.addedChildren).toBe(0);
        expect(s.addedPhotos).toBe(1);
        expect(s.addedPhotoItems!.length).toBe(1);
        expect(s.addedPhotoItems![0]!.key).toBe('p2');
        expect(s.addedPhotoItems![0]!.name).toBe('山顶');
        expect(s.addedPhotoItems![0]!.likes).toBe(1);
    });

    it('合并时共有相册的新增相片应被并入', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Albums/json/albums.json', [
            { id: 'a1', name: '旅行', photoList: [{ picKey: 'p1' }, { picKey: 'p2' }] },
        ]);
        newFs.json.set('Albums/json/albums.json', [
            { id: 'a1', name: '旅行', photoList: [{ picKey: 'p1' }] },
        ]);

        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Photos')!;
        // 主体无新增（a1 共有），仅相片新增 1 张（不计入 addedChildRecords）
        expect(m.addedItems).toBe(0);
        expect(m.addedChildRecords).toBe(0);
        expect(m.addedPhotos).toBe(1);
        const merged = newFs.json.get('Albums/json/albums.json') as any[];
        expect(merged[0]!.photoList.length).toBe(2);
        expect(merged[0]!.photoList.map((p: any) => p.picKey).sort()).toEqual(['p1', 'p2']);
    });

    it('仅比较指定模块，未选模块不产生差异行', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A' }, { tid: 'B' }]);
        oldFs.json.set('Albums/json/albums.json', [{ id: 'a1' }, { id: 'a2' }]);

        const diffs = await compareBackups(oldFs, newFs, undefined, ['Messages']);
        expect(diffs.length).toBe(1);
        expect(diffs[0]!.module).toBe('Messages');
    });

    it('合并只处理所选模块，媒体补齐仅覆盖所选模块目录', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A' }, { tid: 'B' }]);
        newFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);
        // 旧备份有 Albums 数据 + 媒体；新备份无 Albums
        oldFs.json.set('Albums/json/albums.json', [{ id: 'a1' }]);
        oldFs.files.set('Messages/images/p2.jpg', enc('JPG'));
        oldFs.files.set('Albums/images/p3.jpg', enc('ALB'));
        oldFs.files.set('Common/images/p1.png', enc('PNG'));
        newFs.files.set('Common/images/p1.png', enc('PNG')); // 已存在，不重复拷

        const { modules } = await mergeBackups(oldFs, newFs, { modules: ['Messages'] });
        // 只处理 Messages 一个模块
        expect(modules.length).toBe(1);
        expect(modules[0]!.module).toBe('Messages');
        expect(modules[0]!.addedItems).toBe(1);
        // 未选模块 Albums 不被合并
        expect(newFs.json.has('Albums/json/albums.json')).toBe(false);
        // 所选模块媒体被补齐，未选模块媒体不补齐
        expect(newFs.files.has('Messages/images/p2.jpg')).toBe(true);
        expect(newFs.files.has('Albums/images/p3.jpg')).toBe(false);
        // 共享图目录始终扫描，但已存在不覆盖
        expect(newFs.files.has('Common/images/p1.png')).toBe(true);
    });

    it('Boards 留言按 id 匹配（同一 uin 的多条留言不误并）', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 同一留言人 uin=10001 留了两条不同留言（id 不同）
        oldFs.json.set('Boards/json/boards.json', {
            items: [
                { id: 'b1', uin: 10001, content: '第一条' },
                { id: 'b2', uin: 10001, content: '第二条' },
                { id: 'b3', uin: 10002, content: '别人的' },
            ],
            total: 3,
        });
        newFs.json.set('Boards/json/boards.json', {
            items: [{ id: 'b1', uin: 10001, content: '第一条' }],
            total: 1,
        });
        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Boards')!;
        // b2、b3 作为独立主体并入（而非把 uin=10001 的当同一条）
        expect(m.addedItems).toBe(2);
        const merged = newFs.json.get('Boards/json/boards.json') as any;
        expect(merged.items.map((x: any) => x.id).sort()).toEqual(['b1', 'b2', 'b3']);
        expect(merged.total).toBe(3);
    });

    it('访客合并保留接口报告的总数/浏览数（不压成本地明细数）', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 旧备份 totalNum/viewCount 更大（更晚的快照）；新备份只有部分明细
        oldFs.json.set('Messages/json/messages.json', [{
            tid: 'A',
            custom_visitor: { viewCount: 100, totalNum: 90, list: [{ uin: 1, visitTime: 100 }, { uin: 2, visitTime: 200 }] },
        }]);
        newFs.json.set('Messages/json/messages.json', [{
            tid: 'A',
            custom_visitor: { viewCount: 50, totalNum: 40, list: [{ uin: 1, visitTime: 100 }] },
        }]);
        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Messages')!;
        expect(m.addedChildRecords).toBe(1); // uin2 并入
        const a = (newFs.json.get('Messages/json/messages.json') as any[])[0];
        expect(a.custom_visitor.list.length).toBe(2);
        // totalNum / viewCount 取较大值，不被压成 list.length
        expect(a.custom_visitor.totalNum).toBe(90);
        expect(a.custom_visitor.viewCount).toBe(100);
    });

    it('评论去重优先用评论 ID（tid），同主体内不同评论不误并', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        // 同主体 A：新备份有 tid=c1 的评论；旧备份有 c1、c2
        oldFs.json.set('Messages/json/messages.json', [{
            tid: 'A',
            custom_comments: [
                { tid: 'c1', content: '评论1', user: { uin: 5 } },
                { tid: 'c2', content: '评论2', user: { uin: 6 } },
            ],
        }]);
        newFs.json.set('Messages/json/messages.json', [{
            tid: 'A',
            custom_comments: [{ tid: 'c1', content: '评论1', user: { uin: 5 } }],
        }]);
        const { modules } = await mergeBackups(oldFs, newFs);
        const m = modules.find((x) => x.module === 'Messages')!;
        expect(m.addedChildRecords).toBe(1); // 只有 c2 新增
        const a = (newFs.json.get('Messages/json/messages.json') as any[])[0];
        expect(a.custom_comments.length).toBe(2);
        expect(a.custom_comments.map((c: any) => c.tid).sort()).toEqual(['c1', 'c2']);
    });

    it('媒体补齐不拷贝 json 目录下的文件（路径段匹配）', async () => {
        const oldFs = new MemFs();
        const newFs = new MemFs();
        oldFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);
        newFs.json.set('Messages/json/messages.json', [{ tid: 'A' }]);
        // 模拟一个混在 json 目录下的媒体扩展名文件（异常情况，应被排除）
        oldFs.files.set('Messages/json/messages.jpg', enc('JPG'));
        const { modules } = await mergeBackups(oldFs, newFs);
        expect(newFs.files.has('Messages/json/messages.jpg')).toBe(false);
    });
});
