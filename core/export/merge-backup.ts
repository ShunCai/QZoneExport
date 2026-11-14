/**
 * 合并备份引擎（纯逻辑，不依赖浏览器 API）
 *
 * 场景：用户手上有同一 QQ 号的两份完整备份（不同时间点 / 不同采集范围），
 * 想把「旧备份」里新备份没有的内容增量合并进「新备份」，等价于补课式增量备份。
 *
 * 设计要点：
 *  - 抽象 BackupFs 接口：读取 / 写回 json(.js/.json)、读二进制媒体、列文件、判断存在。
 *    浏览器侧由 DirectoryHandleFs 实现（File System Access API），单测用内存 FS mock。
 *  - 模块规则表 MODULE_RULES：每个模块的目录、json 文件名、主体 ID 候选字段、数组取值方式
 *    （Messages 等顶层就是数组；Boards/Visitors 是 {items:[...]} 对象）。
 *  - 比较：旧备份独有主体、共有主体在旧备份相比新备份新增的子项（点赞/评论/访客）；
 *    相册模块额外按相片 Key 比对相片列表，找出共有相册里旧备份多出的相片。
 *  - 合并：旧备份独有主体整条追加；共有主体按子项去重增量合并；回写 json(.js/.json)；
 *    媒体文件由旧备份补齐到新备份（旧有新版无则拷）。
 *  - 去重 key 兼容多种形态（fuin / uin+visitTime / content+user / 兜底 JSON 串）。
 */

/* ============================ 抽象文件系统 ============================ */

export interface BackupFs {
    /** 读取 json 数据（自动识别 .json 与 window.x=... 的 .js 两种产物） */
    readJson(relPath: string): Promise<unknown | null>;
    /** 写回 json 数据（实现按扩展名决定写 .json 文本或 .js 包裹） */
    writeJson(relPath: string, data: unknown): Promise<void>;
    /** 写回 .js 数据文件：显式指定全局变量名（留言 boardInfo / 访客 visitorInfo 不能按文件名猜） */
    writeJs(relPath: string, globalName: string, data: unknown): Promise<void>;
    /** 文件是否存在 */
    exists(relPath: string): Promise<boolean>;
    /** 读取二进制媒体（不存在返回 null） */
    readBinary(relPath: string): Promise<Uint8Array | null>;
    /** 写入二进制媒体 */
    writeBinary(relPath: string, data: Uint8Array): Promise<void>;
    /** 递归列出所有相对路径（目录分隔统一为 /） */
    listFiles(): Promise<string[]>;
    /** 递归列出某子目录下的相对路径（相对备份根，分隔统一为 /）；目录不存在返回空数组 */
    listDir(relDir: string): Promise<string[]>;
}

/* ============================ 模块规则表 ============================ */

/** 模块英文名 → 中文名（用于合并/比较结果的中文提示） */
const MODULE_LABELS: Record<string, string> = {
    Messages: '说说',
    Blogs: '日志',
    Diaries: '日记',
    Photos: '相册',
    Videos: '视频',
    Boards: '留言',
    Friends: '好友',
    Favorites: '收藏',
    Shares: '分享',
    Visitors: '访客',
};

/** 取模块中文名（未知模块回退英文原名） */
function moduleLabel(module: string): string {
    return MODULE_LABELS[module] || module;
}

export interface ModuleRule {
    /** 模块名（展示用） */
    module: string;
    /** 数据所在目录（注意 Photos 产物落在 Albums 目录） */
    dir: string;
    /** json 文件名（如 messages.json；对应 globalName 为该文件名去扩展名） */
    jsonFile: string;
    /** 主体 ID 候选字段（按顺序取第一个非空） */
    idFields: string[];
    /** 写回 .js 时的全局变量名——与查看器 DATA_SOURCES 一致（Boards→boardInfo、Visitors→visitorInfo，不能按文件名猜） */
    globalName: string;
}

/**
 * 全模块规则。json 路径统一为 `<dir>/json/<jsonFile>`（与采集器 writeModuleOutputs 一致）。
 * 顶层结构：数组型（Messages/Blogs/Diaries/Shares/Photos/Videos/Favorites/Friends）
 * 或对象型（Boards/Visitors 为 {items:[...], total, ...}）。
 */
export const MODULE_RULES: ModuleRule[] = [
    { module: 'Messages', globalName: 'messages', dir: 'Messages', jsonFile: 'messages.json', idFields: ['tid'] },
    { module: 'Blogs', globalName: 'blogs', dir: 'Blogs', jsonFile: 'blogs.json', idFields: ['blogId', 'blogid'] },
    { module: 'Diaries', globalName: 'diaries', dir: 'Diaries', jsonFile: 'diaries.json', idFields: ['blogId', 'blogid'] },
    { module: 'Shares', globalName: 'shares', dir: 'Shares', jsonFile: 'shares.json', idFields: ['id', 'shuoshuoid'] },
    // 注意：相册主体（AlbumItem）的主键字段是 id（不是 albumId），albumId 是相片上的字段。
    // 若只写 ['albumId','albumid']，extractId 会永远取不到主键而退回 JSON 兜底，
    // 导致新旧备份里「同一个相册」永远匹配不上、被误报成「旧备份独有的相册」。
    { module: 'Photos', globalName: 'albums', dir: 'Albums', jsonFile: 'albums.json', idFields: ['id', 'albumId', 'albumid'] },
    { module: 'Videos', globalName: 'videos', dir: 'Videos', jsonFile: 'videos.json', idFields: ['vid'] },
    { module: 'Favorites', globalName: 'favorites', dir: 'Favorites', jsonFile: 'favorites.json', idFields: ['id'] },
    { module: 'Friends', globalName: 'friends', dir: 'Friends', jsonFile: 'friends.json', idFields: ['uin'] },
    { module: 'Boards', globalName: 'boardInfo', dir: 'Boards', jsonFile: 'boards.json', idFields: ['id', 'uin'] },
    { module: 'Visitors', globalName: 'visitorInfo', dir: 'Visitors', jsonFile: 'visitors.json', idFields: ['uin', 'id'] },
];

/**
 * 按模块名过滤规则表。modules 为空/未传 → 全模块（向后兼容）；
 * 传入具体模块名 → 仅返回命中的规则（忽略未知名）。
 */
export function resolveRules(modules?: string[]): ModuleRule[] {
    if (!modules || modules.length === 0) return MODULE_RULES;
    const set = new Set(modules);
    return MODULE_RULES.filter((r) => set.has(r.module));
}

/**
 * 媒体补齐要扫描的目录：所选模块各自的数据目录（媒体落在其子树下，如 Messages/、Albums/、Videos/）
 * 外加始终包含的共享图目录 Common/images/。大号场景下只扫这些目录，避免 listFiles 枚举整棵树爆内存。
 */
export function mediaDirs(modules?: string[]): string[] {
    const dirs = resolveRules(modules).map((r) => r.dir);
    if (!dirs.includes('Common/images')) dirs.push('Common/images');
    return dirs;
}

/* ============================ 工具函数 ============================ */

/** 取模块数据里的主体数组（兼容数组型与 {items:[...]} 对象型） */
function itemsOf(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}

/** 取主体展示标题（用于差异清单） */
function titleOf(item: any): string {
    if (!item || typeof item !== 'object') return '';
    const text = String(
        item.content ?? item.title ?? item.name ?? item.albumname ?? item.nickname ?? item.nick ?? item.custom_content ?? '',
    ).trim();
    if (text) return text.slice(0, 40);
    // 转发说说没有自己的正文（content 是转发者的评语，常为空）——
    // 显示被转发的原说说内容才有辨识度（rt_con 是 {conlist, content} 对象或字符串），
    // 来源主人作附注；都没有再退「转发的说说」，别把 tid 摆出来
    if (item.rt_tid) {
        const from = String(item.rt_uinname || item.rt_uin || '').trim();
        const rawOriginal = item.rt_con && typeof item.rt_con === 'object'
            ? String(item.rt_con.content ?? '')
            : String(item.rt_con ?? '');
        const original = rawOriginal.replace(/\s+/g, ' ').trim();
        if (original) {
            return `转发 ${from || '好友'} 的说说：${original.slice(0, 26)}${original.length > 26 ? '…' : ''}`;
        }
        if (from) return `转发的说说（来自 ${from}）`;
    }
    return '';
}

/** 主体唯一标识：优先用指定 ID 字段，否则整条 JSON（整条去重，避免错并） */
function extractId(item: any, idFields: string[]): string {
    for (const f of idFields) {
        const v = item?.[f];
        if (v != null && v !== '') return String(v);
    }
    try {
        return 'j:' + JSON.stringify(item).slice(0, 240);
    } catch {
        return 'j:' + String(item);
    }
}

/** 子项去重 key：兼容点赞(fuin) / 访客(uin+visitTime) / 评论(ID或content+user+time) / 兜底 JSON。
 *  注意：评论 ID（id/tid）可能在不同主体下重复，但去重 Set 始终在「单个主体内」新建，
 *  故不会跨主体误判；无 ID 时回退内容指纹，避免同主体内同内容误并。 */
function childKey(el: any): string {
    if (el == null || typeof el !== 'object') return '';
    const fuin = el.fuin;
    if (typeof fuin === 'number') return 'fuin:' + fuin;
    const u = el.user?.uin ?? el.uin;
    if (typeof u === 'number') {
        const t = el.visitTime ?? el.time;
        return 'u:' + u + (t != null ? ':' + t : '');
    }
    const id = el.id ?? el.tid ?? el.vid ?? el.videoid;
    if (id != null) return 'id:' + id;
    const content = el.content ?? el.msgContent ?? '';
    const ct = el.createTime ?? el.postTime ?? '';
    const cu = el.user?.uin ?? el.uin ?? '';
    if (content || ct || cu) return 'c:' + cu + '|' + content + '|' + ct;
    try {
        return 'j:' + JSON.stringify(el).slice(0, 240);
    } catch {
        return 'j:' + String(el);
    }
}

const COMMENT_FIELDS = ['custom_comments', 'commentlist', 'commentList', 'comments', 'replies', 'replys', 'list_3'];

/**
 * 把旧主体的子项增量合并进新主体（原地修改 newItem）。
 * 返回增量拆分：social=评论/点赞/浏览等子项新增数；photos=相片新增数
 * （两者分开计数，使合并日志的口径与比较阶段一致：比较阶段 addedChildren 也不含相片）。
 */
function mergeChildArrays(oldItem: any, newItem: any): { social: number; photos: number } {
    let social = 0;
    let photos = 0;
    // 访客是对象 {viewCount,totalNum,list}
    if (oldItem.custom_visitor || newItem.custom_visitor) {
        const oldV: any = oldItem.custom_visitor || {};
        const newV: any = newItem.custom_visitor || {};
        const oldList: any[] = Array.isArray(oldV.list) ? oldV.list : [];
        const newList: any[] = Array.isArray(newV.list) ? newV.list : [];
        const seen = new Set(newList.map(childKey));
        const toAdd = oldList.filter((e) => !seen.has(childKey(e)));
        if (toAdd.length) {
            newItem.custom_visitor = newItem.custom_visitor || { viewCount: 0, totalNum: 0, list: [] };
            newItem.custom_visitor.list = [...newList, ...toAdd];
            // 总数/浏览数取「新旧备份中接口报告的较大值」，且不低于合并后的明细条数，
            // 避免合并后 totalNum 被压成本地明细数、viewCount 丢失
            const mergedCount = newItem.custom_visitor.list.length;
            newItem.custom_visitor.totalNum = Math.max(
                Number(oldV.totalNum) || 0,
                Number(newV.totalNum) || 0,
                mergedCount,
            );
            newItem.custom_visitor.viewCount = Math.max(
                Number(oldV.viewCount) || 0,
                Number(newV.viewCount) || 0,
                newItem.custom_visitor.totalNum,
            );
            social += toAdd.length;
        }
    }
    // 数组型子项（点赞 / 评论 / 回复）
    for (const field of COMMENT_FIELDS) {
        const oldArr: any[] = oldItem[field];
        if (!Array.isArray(oldArr)) continue;
        const base: any[] = Array.isArray(newItem[field]) ? newItem[field] : [];
        const seen = new Set(base.map(childKey));
        const toAdd = oldArr.filter((e) => !seen.has(childKey(e)));
        if (toAdd.length) {
            newItem[field] = [...base, ...toAdd];
            social += toAdd.length;
        }
    }
    // 点赞（字段名为 likes）
    const oldLikes: any[] = oldItem.likes;
    if (Array.isArray(oldLikes)) {
        const base: any[] = Array.isArray(newItem.likes) ? newItem.likes : [];
        const seen = new Set(base.map(childKey));
        const toAdd = oldLikes.filter((e) => !seen.has(childKey(e)));
        if (toAdd.length) {
            newItem.likes = [...base, ...toAdd];
            social += toAdd.length;
        }
    }
    // 相片列表（仅相册模块有，按相片 Key 去重合并；旧备份多出的相片并入新备份）
    const oldPhotos: any[] = oldItem.photoList;
    if (Array.isArray(oldPhotos)) {
        const base: any[] = Array.isArray(newItem.photoList) ? newItem.photoList : [];
        const seen = new Set(base.map(photoKeyOf));
        const toAdd = oldPhotos.filter((p) => !seen.has(photoKeyOf(p)));
        if (toAdd.length) {
            newItem.photoList = [...base, ...toAdd];
            photos += toAdd.length;
        }
    }
    return { social, photos };
}

/** 纯计算：旧主体的子项里，新主体没有的有哪些（返回实际新增的评论/点赞/浏览数组，供弹窗逐条展示） */
function diffChildren(oldItem: any, newItem: any): { comments: any[]; likes: any[]; visitors: any[] } {
    const comments: any[] = [];
    const likes: any[] = [];
    const visitors: any[] = [];
    // 访客（custom_visitor.list）
    if (oldItem?.custom_visitor?.list?.length || newItem?.custom_visitor?.list?.length) {
        const seen = new Set((newItem?.custom_visitor?.list || []).map(childKey));
        for (const e of (oldItem?.custom_visitor?.list || [])) {
            if (!seen.has(childKey(e))) visitors.push(e);
        }
    }
    // 评论 / 回复（COMMENT_FIELDS 多个字段）
    for (const f of COMMENT_FIELDS) {
        const oldArr: any[] = oldItem?.[f];
        if (!Array.isArray(oldArr)) continue;
        const base: any[] = Array.isArray(newItem?.[f]) ? (newItem[f] as any[]) : [];
        const seen = new Set(base.map(childKey));
        for (const e of oldArr) {
            if (!seen.has(childKey(e))) comments.push(e);
        }
    }
    // 点赞（likes）
    const oldLikes: any[] = oldItem?.likes;
    if (Array.isArray(oldLikes)) {
        const base: any[] = Array.isArray(newItem?.likes) ? (newItem.likes as any[]) : [];
        const seen = new Set(base.map(childKey));
        for (const e of oldLikes) {
            if (!seen.has(childKey(e))) likes.push(e);
        }
    }
    return { comments, likes, visitors };
}

/** 相片去重 Key：优先 picKey / lloc / sloc（与采集器 getImageKey 一致） */
function photoKeyOf(p: any): string {
    const k = p?.picKey ?? p?.lloc ?? p?.sloc;
    if (k != null && k !== '') return String(k);
    try {
        return 'j:' + JSON.stringify(p).slice(0, 200);
    } catch {
        return 'j:' + String(p);
    }
}

/** 相片展示名 */
function photoNameOf(p: any): string {
    return String(p?.name ?? p?.custom_filename ?? p?.lloc ?? p?.picKey ?? '相片').slice(0, 60);
}

/** 相片自带的社会化计数（赞 / 评论 / 浏览） */
function photoSocial(p: any): { likes: number; comments: number; visitors: number } {
    const likes = Array.isArray(p?.likes) ? p.likes.length : typeof p?.likeTotal === 'number' ? p.likeTotal : 0;
    let comments = 0;
    for (const f of COMMENT_FIELDS) {
        if (Array.isArray(p?.[f])) comments += (p[f] as any[]).length;
    }
    if (typeof p?.cmtTotal === 'number') comments += p.cmtTotal;
    const visitors = p?.custom_visitor?.totalNum ?? p?.custom_visitor?.list?.length ?? 0;
    return { likes, comments, visitors };
}

/**
 * 比较同一相册新旧备份的相片列表，返回旧备份有、新备份没有的相片（按相片 Key 去重）。
 * 只用于 Photos 模块（只有 AlbumItem 带 photoList）。
 */
function diffPhotos(oldAlbum: any, newAlbum: any): AddedPhoto[] {
    const newPhotos = Array.isArray(newAlbum?.photoList) ? (newAlbum.photoList as any[]) : [];
    const seen = new Set(newPhotos.map(photoKeyOf));
    const out: AddedPhoto[] = [];
    for (const p of Array.isArray(oldAlbum?.photoList) ? (oldAlbum.photoList as any[]) : []) {
        const k = photoKeyOf(p);
        if (seen.has(k)) continue;
        const s = photoSocial(p);
        out.push({ key: k, name: photoNameOf(p), likes: s.likes, comments: s.comments, visitors: s.visitors });
    }
    return out;
}

/* ============================ 类型定义 ============================ */

export interface CompareItemDiff {
    id: string;
    title: string;
    /** 旧备份中该主体自带的评论数（整条并入新备份时即为全部新增） */
    comments: number;
    /** 旧备份中该主体自带的点赞数（整条并入新备份时即为全部新增） */
    likes: number;
    /** 旧备份中该主体自带的浏览/访客数（整条并入新备份时即为全部新增） */
    views: number;
    /** 相册模块：该相册自带的相片数（整条并入新备份时一并带入） */
    photoCount?: number;
    /** 该主体自带的全部评论（整条并入时一并带入，供弹窗逐条展示） */
    commentItems?: any[];
    /** 该主体自带的全部点赞 */
    likeItems?: any[];
    /** 该主体自带的全部访客/浏览 */
    visitorItems?: any[];
}

/** 相片级差异明细（相册模块内，旧备份相比新备份多出的相片） */
export interface AddedPhoto {
    /** 相片去重 Key（picKey / lloc / sloc） */
    key: string;
    /** 相片展示名（用于差异清单） */
    name: string;
    /** 该相片自带的赞数 */
    likes: number;
    /** 该相片自带的评论数 */
    comments: number;
    /** 该相片自带的浏览/访客数 */
    visitors: number;
}

export interface CompareSharedDiff {
    id: string;
    title: string;
    addedLikes: number;
    addedComments: number;
    addedVisitors: number;
    addedChildren: number;
    /** 相册模块：旧备份相比新备份多出的相片数（按相片 Key 去重） */
    addedPhotos?: number;
    /** 相册模块：多出的相片明细（用于弹窗逐张展示） */
    addedPhotoItems?: AddedPhoto[];
    /** 旧备份相比新备份多出的评论（实际数组，供弹窗逐条展示） */
    addedCommentItems?: any[];
    /** 旧备份相比新备份多出的点赞 */
    addedLikeItems?: any[];
    /** 旧备份相比新备份多出的访客/浏览 */
    addedVisitorItems?: any[];
}

export interface CompareModuleDiff {
    module: string;
    existsOld: boolean;
    existsNew: boolean;
    /** 旧备份独有、整体并入新备份的主体（模块级差异用） */
    onlyOldItems: CompareItemDiff[];
    /** 两边都有、子项有增量的主体 */
    sharedItems: CompareSharedDiff[];
    /** 仅旧备份有该模块（新备份完全没有）→ 整模块并入 */
    wholeModuleOnlyOld: boolean;
}

export interface MergeModuleResult {
    module: string;
    oldCount: number;
    newCount: number;
    /** 仅旧有主体并入数 */
    addedItems: number;
    /** 共有主体里增量合并的子项数（评论/点赞/浏览等，不含相片） */
    addedChildRecords: number;
    /** 共有主体里增量合并的相片数（仅相册模块，单独计数） */
    addedPhotos: number;
    /** 本模块媒体文件补齐数 */
    mediaCopied: number;
    /** 是否发生整模块并入（新备份原本无该模块） */
    wholeModuleMerged: boolean;
}

export interface ProgressInfo {
    phase: 'compare' | 'merge' | 'media';
    module: string;
    done: number;
    total: number;
}

export interface MergeOptions {
    /** 是否执行写入（false 仅计算差异，不落盘） */
    dryRun?: boolean;
    /** 进度回调 */
    onProgress?: (info: ProgressInfo) => void;
    /** 仅比较/合并指定模块（大号备份可只勾选特定模块，显著降低内存占用、避免卡死）；空/未传=全模块 */
    modules?: string[];
}

/* ============================ 比较 ============================ */

export async function compareBackups(
    oldFs: BackupFs,
    newFs: BackupFs,
    onProgress?: (info: ProgressInfo) => void,
    modules?: string[],
): Promise<CompareModuleDiff[]> {
    const result: CompareModuleDiff[] = [];
    const rules = resolveRules(modules);
    const total = rules.length;
    for (let i = 0; i < total; i++) {
        const rule = rules[i]!;
        onProgress?.({ phase: 'compare', module: rule.module, done: i, total });
        result.push(await compareModule(oldFs, newFs, rule));
    }
    onProgress?.({ phase: 'compare', module: '', done: total, total });
    return result;
}

async function compareModule(oldFs: BackupFs, newFs: BackupFs, rule: ModuleRule): Promise<CompareModuleDiff> {
    const path = `${rule.dir}/json/${rule.jsonFile}`;
    const oldRaw = await oldFs.readJson(path);
    const newRaw = await newFs.readJson(path);
    const diff: CompareModuleDiff = {
        module: rule.module,
        existsOld: oldRaw != null,
        existsNew: newRaw != null,
        onlyOldItems: [],
        sharedItems: [],
        wholeModuleOnlyOld: false,
    };
    if (oldRaw == null) return diff;
    const oldItems = itemsOf(oldRaw);
    if (newRaw == null) {
        // 新备份完全没有该模块 → 整模块并入
        diff.wholeModuleOnlyOld = true;
        diff.onlyOldItems = oldItems.map((it) => {
            const dc = diffChildren(it, {});
            return {
                id: extractId(it, rule.idFields),
                title: titleOf(it),
                comments: dc.comments.length,
                likes: dc.likes.length,
                views: dc.visitors.length,
                commentItems: dc.comments,
                likeItems: dc.likes,
                visitorItems: dc.visitors,
                photoCount: Array.isArray(it.photoList) ? it.photoList.length : undefined,
            };
        });
        return diff;
    }
    const newItems = itemsOf(newRaw);
    const mapNew = new Map(newItems.map((it) => [extractId(it, rule.idFields), it] as const));
    for (const o of oldItems) {
        const id = extractId(o, rule.idFields);
        const n = mapNew.get(id);
        if (!n) {
            const dc = diffChildren(o, {});
            diff.onlyOldItems.push({
                id,
                title: titleOf(o),
                comments: dc.comments.length,
                likes: dc.likes.length,
                views: dc.visitors.length,
                commentItems: dc.comments,
                likeItems: dc.likes,
                visitorItems: dc.visitors,
                photoCount: Array.isArray(o.photoList) ? o.photoList.length : undefined,
            });
        } else {
            const dc = diffChildren(o, n);
            // 相册模块：额外比较相片列表，找出旧备份多出的相片
            const addedPhotos = rule.module === 'Photos' ? diffPhotos(o, n) : [];
            if (dc.comments.length + dc.likes.length + dc.visitors.length > 0 || addedPhotos.length > 0) {
                diff.sharedItems.push({
                    id,
                    title: titleOf(o),
                    addedLikes: dc.likes.length,
                    addedComments: dc.comments.length,
                    addedVisitors: dc.visitors.length,
                    addedChildren: dc.comments.length + dc.likes.length + dc.visitors.length,
                    addedCommentItems: dc.comments.length ? dc.comments : undefined,
                    addedLikeItems: dc.likes.length ? dc.likes : undefined,
                    addedVisitorItems: dc.visitors.length ? dc.visitors : undefined,
                    addedPhotos: addedPhotos.length || undefined,
                    addedPhotoItems: addedPhotos.length ? addedPhotos : undefined,
                });
            }
        }
    }
    return diff;
}

/* ============================ 合并 ============================ */

export async function mergeBackups(
    oldFs: BackupFs,
    newFs: BackupFs,
    options: MergeOptions = {},
): Promise<{ modules: MergeModuleResult[]; log: string }> {
    const { dryRun = false, onProgress, modules: optModules } = options;
    const rules = resolveRules(optModules);
    const modules: MergeModuleResult[] = [];
    const logLines: string[] = [];
    const total = rules.length;

    for (let i = 0; i < total; i++) {
        const rule = rules[i]!;
        onProgress?.({ phase: 'merge', module: rule.module, done: i, total });
        const res = await mergeModule(oldFs, newFs, rule, dryRun);
        modules.push(res);
        if (res.addedItems > 0 || res.addedChildRecords > 0 || res.addedPhotos > 0 || res.wholeModuleMerged) {
            const parts: string[] = [];
            if (res.wholeModuleMerged) parts.push(`整模块并入 ${res.addedItems} 条`);
            else if (res.addedItems > 0) parts.push(`并入主体 ${res.addedItems} 条`);
            if (res.addedChildRecords > 0) parts.push(`增量子项 ${res.addedChildRecords} 条`);
            if (res.addedPhotos > 0) parts.push(`新增相片 ${res.addedPhotos} 张`);
            logLines.push(`【${moduleLabel(rule.module)}】${parts.join('，')}`);
        }
    }

    // 媒体补齐：旧备份有、新备份没有的媒体文件，拷过去（旧→新）。
    // 只扫描所选模块的数据目录 + 共享图目录，避免大号整体 listFiles 枚举整棵树爆内存。
    onProgress?.({ phase: 'media', module: '媒体补齐', done: 0, total: 1 });
    const mediaCopied = dryRun ? 0 : await copyMissingMedia(oldFs, newFs, mediaDirs(optModules));
    onProgress?.({ phase: 'media', module: '媒体补齐', done: 1, total: 1 });

    const totalAddedItems = modules.reduce((s, m) => s + m.addedItems, 0);
    const totalAddedChildren = modules.reduce((s, m) => s + m.addedChildRecords, 0);
    const totalAddedPhotos = modules.reduce((s, m) => s + m.addedPhotos, 0);
    logLines.unshift(
        `合并完成（以下合计为本次勾选的 ${rules.length} 个模块）：并入主体 ${totalAddedItems} 条，增量子项 ${totalAddedChildren} 条，新增相片 ${totalAddedPhotos} 张，补齐媒体 ${mediaCopied} 个。`,
    );
    return { modules, log: logLines.join('\n') };
}

async function mergeModule(
    oldFs: BackupFs,
    newFs: BackupFs,
    rule: ModuleRule,
    dryRun: boolean,
): Promise<MergeModuleResult> {
    const res: MergeModuleResult = {
        module: rule.module,
        oldCount: 0,
        newCount: 0,
        addedItems: 0,
        addedChildRecords: 0,
        addedPhotos: 0,
        mediaCopied: 0,
        wholeModuleMerged: false,
    };
    const jsonPath = `${rule.dir}/json/${rule.jsonFile}`;
    const jsPath = jsonPath.replace(/\.json$/, '.js');
    const oldRaw = await oldFs.readJson(jsonPath);
    const newRaw = await newFs.readJson(jsonPath);
    if (oldRaw == null) return res;

    res.oldCount = itemsOf(oldRaw).length;

    // 新备份完全没有该模块：整份并入（主体 + 媒体）
    if (newRaw == null) {
        res.wholeModuleMerged = true;
        res.addedItems = itemsOf(oldRaw).length;
        res.newCount = res.addedItems;
        if (!dryRun) {
            await newFs.writeJson(jsonPath, oldRaw);
            await newFs.writeJs(jsPath, rule.globalName, oldRaw);
        }
        return res;
    }

    const oldItems = itemsOf(oldRaw);
    const newItems = itemsOf(newRaw);
    const mapNew = new Map(newItems.map((it) => [extractId(it, rule.idFields), it] as const));
    const mergedItems = [...newItems];

    for (const o of oldItems) {
        const id = extractId(o, rule.idFields);
        const n = mapNew.get(id);
        if (!n) {
            // 仅旧有主体：整体并入。
            // Friends 是全量好友快照：旧备份有、新备份（本次全量名单）没有 → 该好友在此期间被删除，
            // 打上 deleted 标记（查看器好友页的「已删好友」筛选与卡片「已删除」标签都读 item.deleted）。
            mergedItems.push(rule.module === 'Friends' ? { ...o, deleted: true } : o);
            res.addedItems++;
        } else {
            // 共有主体：增量合并子项（social=评论/点赞/浏览；photos=相片，单独计数）。
            // Friends 的 deleted 标记按新快照显式清除：人还在本次名单里就不是「已删除」。
            // 必须无条件清（合并产物会被写回备份，下一轮合并时旧条目会带着上次的 deleted:true 进来）。
            if (rule.module === 'Friends') {
                (n as Record<string, any>).deleted = false;
            }
            const r = mergeChildArrays(o, n);
            res.addedChildRecords += r.social;
            res.addedPhotos += r.photos;
        }
    }

    res.newCount = mergedItems.length;

    if (!dryRun) {
        const merged = Array.isArray(newRaw) ? mergedItems : { ...newRaw, items: mergedItems };
        // 更新对象型模块的 total 字段
        if (merged && typeof merged === 'object' && 'total' in (merged as any)) {
            (merged as any).total = mergedItems.length;
        }
        await newFs.writeJson(jsonPath, merged);
        await newFs.writeJs(jsPath, rule.globalName, merged);
    }
    return res;
}

/* ============================ 媒体补齐 ============================ */

const MEDIA_EXT = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico',
    'mp4', 'webm', 'mov', 'avi', 'm4v', '3gp', 'mkv',
    'mp3', 'wav', 'm4a', 'amr', 'ogg',
]);

/** 排除目录段：查看器自身代码与数据索引，不随媒体补齐覆盖（数据由合并逻辑写回）。
 *  按「路径段」匹配，任意层级的 json/js/css/vendor 目录都会被排除（如 Messages/json/）。 */
const EXCLUDE_DIR_SEGMENTS = ['json', 'js', 'css', 'vendor'];

function isMediaFile(relPath: string): boolean {
    const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
    return MEDIA_EXT.has(ext);
}

function isExcludedPath(relPath: string): boolean {
    const segments = relPath.split('/');
    // 顶层 Common/js、Common/css、Common/vendor 是查看器代码，同样排除
    if (segments[0] === 'Common' && segments[1] && ['js', 'css', 'vendor'].includes(segments[1])) {
        return true;
    }
    return segments.some((seg) => EXCLUDE_DIR_SEGMENTS.includes(seg));
}

/**
 * 把旧备份里「新备份没有」的媒体文件拷贝过去（旧→新）。
 * 只扫描给定目录（所选模块的数据目录 + Common/images），避免大号整体 listFiles 枚举整棵树爆内存。
 * 已存在于新备份的文件不覆盖（避免用旧备份的损坏/残缺文件覆盖新备份的完好文件）。
 * 返回拷贝数量。
 */
async function copyMissingMedia(oldFs: BackupFs, newFs: BackupFs, dirs: string[]): Promise<number> {
    let copied = 0;
    for (const dir of dirs) {
        const files = await oldFs.listDir(dir);
        for (const f of files) {
            if (!isMediaFile(f)) continue;
            if (isExcludedPath(f)) continue;
            // 已存在则跳过（不覆盖）
            if (await newFs.exists(f)) continue;
            const data = await oldFs.readBinary(f);
            if (data == null) continue;
            await newFs.writeBinary(f, data);
            copied++;
        }
    }
    return copied;
}
