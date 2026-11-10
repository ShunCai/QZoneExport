<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import {
    NAlert,
    NButton,
    NCheckbox,
    NCheckboxGroup,
    NDataTable,
    NModal,
    NSelect,
    NSpace,
    NTabPane,
    NTabs,
    NTag,
    type DataTableColumns,
} from 'naive-ui';
import { BackupDb, countBackupData } from '../../core/store/backup-db';
import type { ModuleMeta, BackedupMeta } from '../../core/store/backup-db';
import { compareBackups, mergeBackups } from '../../core/export/merge-backup';
import { createDirectoryHandleFs } from '../../core/export/backup-fs';

/**
 * 工具面板（由旧 src/html/tools.html 迁移而来）
 *
 * v3.2 存储架构变更：
 *  不再从 chrome.storage.local 读写巨型 Backedup 对象（含完整 data 数组），
 *  改为按 uin::module 分键写入 chrome.storage.local（BackupDb 封装）：
 *  - 表格展示读 getMeta()（仅 module / time / count，不含 data）
 *  - 增删改操作通过 getRows() / setRows() / removeRows() 操作 storage.local 分键
 *  chrome.storage.local 扩展作用域共享，Options 与 content script 读写同一份。
 */

const activeTool = ref('backedup');

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

interface BackedupItem {
    module: string;
    data: any;
    time: number;
}

const backedup = ref<Record<string, BackedupItem[]>>({});
const backedupMeta = ref<BackedupMeta>({});
const targetUin = ref<string>('');
const checkedModules = ref<string[]>([]);
const loading = ref(false);
const status = ref({ show: false, type: 'success' as 'success' | 'error' | 'warning' | 'info', msg: '' });

const showAlbumManager = ref(false);
const albumRows = ref<any[]>([]);

const uinOptions = computed(() => Object.keys(backedupMeta.value).map((uin) => ({ label: uin, value: uin })));
const currentItems = computed<BackedupItem[]>(() => backedup.value[targetUin.value] || []);
const currentMeta = computed<ModuleMeta[]>(() => backedupMeta.value[targetUin.value] || []);

const db = new BackupDb();

function tip(type: 'success' | 'error' | 'warning' | 'info', msg: string): void {
    status.value = { show: true, type, msg };
}

function countOf(item: BackedupItem): number {
    // 兼容数组与遗留对象形态（{list,total}/{items,total}/{total}），
    // 否则刷新后对象形态的模块计数会归零而留言板/访客反而正常。
    return countBackupData(item.data);
}

function formatTime(time: number): string {
    if (!time) return '-';
    const date = new Date(time);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function loadBackedup(): Promise<void> {
    loading.value = true;
    try {
        backedupMeta.value = await db.getMeta();
        const uins = Object.keys(backedupMeta.value);
        // 当前选中的 QQ 仍有效则保持；否则优先用「上次选中的 QQ」（导入别的 QQ 后重载不会回退旧 QQ），
        // 都没有才退回第一个 QQ。这样导入的数据刷新/重载后仍能正确展示。
        if (!uins.includes(targetUin.value)) {
            const lastUin = await db.getLastUin();
            targetUin.value = (lastUin && uins.includes(lastUin)) ? lastUin : (uins[0] || '');
        }
        // 加载当前 UIN 的完整行数据以填充表格（backedupMeta 仅供下拉选择）。
        // 始终从 storage 重新读取，不使用内存缓存——否则「刷新」只返回陈旧内存数据，
        // 与持久化结果不一致。
        if (targetUin.value) {
            await loadFullData(targetUin.value);
        }
        checkedModules.value = [];
    } catch (error) {
        tip('error', '读取已备份数据失败：' + ((error as Error).message || '未知错误'));
    } finally {
        loading.value = false;
    }
}

async function loadFullData(uin: string): Promise<BackedupItem[]> {
    // 每次都从 storage 读取，不缓存：保证「刷新」与切换 QQ 都反映真实持久化结果，
    // 避免导入后内存脏数据在刷新时被当成正确结果展示。
    const rows = await db.getRows(uin);
    backedup.value[uin] = rows as BackedupItem[];
    return backedup.value[uin];
}

/**
 * 持久化指定 QQ 的行数据。
 * 必须显式接受 uin：导入流程会写入「与当前 targetUin 不同」的 QQ，若沿用 targetUin.value，
 * 在 targetUin 尚未切换（或切换触发的 watch 尚未完成）时会写错对象。
 */
async function persist(uin: string = targetUin.value): Promise<void> {
    const items = backedup.value[uin];
    if (!items) return;
    const rows = items.map(({ module, data, time }) => ({ module, data, time }));
    await db.setRows(uin, rows);
    const metaList = rows.map(r => ({
        module: r.module,
        time: r.time,
        count: countBackupData(r.data),
    }));
    backedupMeta.value[uin] = metaList;
}

const columns: DataTableColumns<BackedupItem> = [
    { type: 'selection' },
    { title: '模块', key: 'module', render: (row) => MODULE_LABELS[row.module] || row.module },
    { title: '已备份数量', key: 'total', render: (row) => countOf(row) },
    { title: '上次备份时间', key: 'time', render: (row) => formatTime(row.time) },
    {
        title: '更多',
        key: 'operate',
        render: (row) => (row.module !== 'Photos' ? '' : h(
            NButton,
            { size: 'tiny', onClick: () => openAlbumManager(row) },
            { default: () => '管理相册' },
        )),
    },
];

function openAlbumManager(row: BackedupItem): void {
    // 相册数据可能为数组，也可能为遗留对象形态（{items}|{list}）；统一提取相册数组
    const d = row.data as any;
    albumRows.value = Array.isArray(d) ? d
        : (d && Array.isArray(d.items) ? d.items
            : (d && Array.isArray(d.list) ? d.list : []));
    showAlbumManager.value = true;
}

const albumColumns: DataTableColumns<any> = [
    { title: '相册名称', key: 'name' },
    { title: '相片数量', key: 'count', render: (row) => (row.photoList?.length || 0) },
    {
        title: '操作',
        key: 'operate',
        render: (row) => h(
            NButton,
            { size: 'tiny', type: 'error', quaternary: true, onClick: () => removeAlbum(row) },
            { default: () => '删除' },
        ),
    },
];

async function removeAlbum(album: any): Promise<void> {
    await loadFullData(targetUin.value);
    const items = backedup.value[targetUin.value] || [];
    const photos = items.find((item) => item.module === 'Photos');
    if (!photos || !Array.isArray(photos.data)) return;
    photos.data = photos.data.filter((item: any) => item.id !== album.id);
    albumRows.value = photos.data;
    await persist();
    tip('success', '已删除该相册的备份记录，下次备份将重新采集该相册');
}

function onExport(): void {
    if (!targetUin.value) {
        tip('warning', '没有可导出的备份数据');
        return;
    }
    const payload = { Backedup: { [targetUin.value]: currentItems.value } };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '助手备份数据_' + targetUin.value + '.json';
    link.click();
    URL.revokeObjectURL(url);
    tip('success', '已导出 ' + targetUin.value + ' 的备份数据');
}

async function onImport(): Promise<void> {
    if (!(window as any).showOpenFilePicker) {
        tip('error', '当前浏览器不支持文件选择，需要 Chromium 86+');
        return;
    }
    let imported: any;
    try {
        const [handle] = await (window as any).showOpenFilePicker({
            types: [{ description: '助手备份数据', accept: { 'application/json': ['.qzbackedup', '.json'] } }],
            excludeAcceptAllOption: true,
        });
        const file = await handle.getFile();
        imported = JSON.parse(await file.text());
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            tip('error', '读取备份数据文件失败：' + ((error as Error).message || '未知错误'));
        }
        return;
    }
    if (!imported || !Object.prototype.hasOwnProperty.call(imported, 'Backedup')) {
        tip('error', '导入的不是助手备份数据文件');
        return;
    }
    const isOtherUin = !Object.prototype.hasOwnProperty.call(imported.Backedup, targetUin.value);
    if (isOtherUin && !confirm('导入的备份数据不属于当前 QQ 号，确定导入吗？将按文件中的 QQ 号全量覆盖。')) return;
    const uin = isOtherUin ? Object.keys(imported.Backedup)[0] : targetUin.value;
    if (!uin) { tip('error', '导入文件中没有可用的备份数据'); return; }
    const modules = isOtherUin ? [] : [...checkedModules.value];
    if (!confirm(modules.length === 0 ? '确认全量导入？' : '确认导入选中的 ' + modules.length + ' 个模块？')) return;

    const newItems: BackedupItem[] = imported.Backedup[uin] || [];
    await loadFullData(uin);
    let oldItems = [...(backedup.value[uin] || [])];
    if (modules.length === 0) {
        // 全量导入：整体覆盖。无需先 removeRows——setRows 会在一次原子写入后清理掉
        // 本次不再包含的旧模块行；先删再写反而会制造「storage 为空」的中间窗口，
        // 期间任何并发读（如 targetUin 变更触发的回读）都会读到空数据并覆盖内存状态。
        oldItems = newItems;
    } else {
        for (const moduleName of modules) {
            const source = newItems.find((item) => item.module === moduleName);
            if (!source) continue;
            const index = oldItems.findIndex((item) => item.module === moduleName);
            if (index === -1) oldItems.push(source);
            else oldItems[index] = source;
        }
    }
    backedup.value[uin] = oldItems;
    // 顺序很重要：先把数据落盘，再切换 targetUin。
    // 切换 targetUin 会触发 watch 异步回读 storage 并覆盖 backedup[uin]；若在落盘前切换，
    // 回读可能发生在 setRows 完成之前，读到旧的/空的数据把刚导入的内存结果冲掉。
    await persist(uin);
    await db.saveLastUin(uin);
    targetUin.value = uin;
    await loadBackedup();
    checkedModules.value = [];
    tip('success', '导入完成');
}

async function onDelete(): Promise<void> {
    if (!targetUin.value) return;
    const modules = [...checkedModules.value];
    if (!confirm(modules.length === 0
        ? '确认删除 ' + targetUin.value + ' 的全部备份记录？删除后下次备份将重新全量采集。'
        : '确认删除选中的 ' + modules.length + ' 个模块的备份记录？')) return;

    await loadFullData(targetUin.value);
    if (modules.length === 0) {
        await db.removeRows(targetUin.value);
        delete backedup.value[targetUin.value];
        delete backedupMeta.value[targetUin.value];
    } else {
        backedup.value[targetUin.value] = (backedup.value[targetUin.value] || [])
            .filter((item) => !modules.includes(item.module));
        await persist();
    }
    const uins = Object.keys(backedupMeta.value);
    if (!uins.includes(targetUin.value)) targetUin.value = uins[0] || '';
    checkedModules.value = [];
    tip('success', '已删除所选备份记录');
}

/** 切换目标 QQ 时自动加载该 QQ 的完整行数据；加载期间展示 loading 反馈，
 *  避免大账号数据拉取耗时久时表格长时间空白、造成卡顿/无响应的错觉 */
watch(targetUin, async (uin) => {
    if (!uin) return;
    loading.value = true;
    try {
        await loadFullData(uin);
    } catch (error) {
        tip('error', '读取已备份数据失败：' + ((error as Error).message || '未知错误'));
    } finally {
        loading.value = false;
    }
});

// 初始化加载
loadBackedup();

// ------------------------- 本地相册 -------------------------

/** 常见视频扩展名，用于区分相片与视频 */
const VIDEO_TYPES = ['wmv', 'avi', 'mpeg', 'rm', 'rmvb', 'flv', 'mp4', '3gp', 'mkv', 'f4v', 'm4v'];
/** Albums 下非相册分类的保留目录 */
const RESERVED_DIRS = ['images', 'json', 'js'];

const rootHandle = ref<any>(null);
const albumsHandle = ref<any>(null);
/** 本次扫描到的本地相册（生成时写入备份） */
const localAlbums = ref<any[]>([]);
const scanning = ref(false);
const generating = ref(false);
const albumTip = ref('先选择已备份的 QQ 空间备份文件夹，再点击生成本地相册');

/** 相册行：每个相册目录一行，并标出本次生成带来的变化 */
interface AlbumRow {
    key: string;
    /** 本地目录 = 你自己放进去的；QQ空间 = 备份时采集的 */
    source: string;
    state: string;
    className: string;
    name: string;
    /** 相册目录名（完整路径为 Albums/分类/目录名） */
    folder: string;
    total: number;
    note: string;
}

const albumRowsView = ref<AlbumRow[]>([]);

/**
 * 是否还有待写入的变化（新增、待移除、待清理的重复记录）
 * 用于将主色指向当前真正该做的那一步：无变化时不应再引导去点生成
 */
const hasPendingChanges = computed(() => albumRowsView.value.some(
    (row) => row.state === '新增' || row.state === '将移除' || !!row.note,
));

/** 变化项排前面，方便确认本次生成的影响 */
const STATE_ORDER: Record<string, number> = { '新增': 0, '将移除': 1, '已有': 2, '空间备份': 3 };
const STATE_TAG_TYPE: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
    '新增': 'success', '将移除': 'warning', '已有': 'default', '空间备份': 'info',
};

const albumRowColumns: DataTableColumns<AlbumRow> = [
    {
        title: '状态',
        key: 'state',
        width: 100,
        render: (row) => h(
            NTag,
            { size: 'small', bordered: false, type: STATE_TAG_TYPE[row.state] || 'default' },
            { default: () => row.state },
        ),
    },
    { title: '来源', key: 'source', width: 100 },
    { title: '相册分类', key: 'className' },
    { title: '相册名称', key: 'name' },
    { title: '相册目录', key: 'folder' },
    { title: '文件数量', key: 'total', width: 100 },
    { title: '说明', key: 'note' },
];

function isVideoFile(name: string): boolean {
    const index = name.lastIndexOf('.');
    if (index === -1) {
        return false;
    }
    return VIDEO_TYPES.includes(name.substring(index + 1).toLowerCase());
}

async function getSubDir(handle: any, name: string): Promise<any> {
    try {
        return await handle.getDirectoryHandle(name);
    } catch {
        return null;
    }
}

/** 检查备份根目录下是否存在某个文件（查看器主体现直接落在根目录，如 index.html） */
async function getRootFile(handle: any, name: string): Promise<any> {
    try {
        return await handle.getFileHandle(name);
    } catch {
        return null;
    }
}

/** 递归收集相册目录下的所有文件 */
async function collectFiles(dirHandle: any, parentPath: string): Promise<any[]> {
    const files: any[] = [];
    const currentPath = parentPath + '/' + dirHandle.name;
    for await (const handle of dirHandle.values()) {
        if (handle.kind === 'file') {
            files.push({ name: handle.name, path: currentPath + '/' + handle.name });
        } else if (handle.kind === 'directory') {
            files.push(...await collectFiles(handle, currentPath));
        }
    }
    return files;
}

/**
 * 把一个本地目录转为相册对象
 * 字段命名与采集产生的相册保持一致，以便相册页能直接渲染
 */
function toAlbum(className: string, albumName: string, files: any[]): any {
    const albumId = crypto.randomUUID();
    const classId = crypto.randomUUID();
    const photoList = files.map((file) => {
        const isVideo = isVideoFile(file.name);
        const picKey = crypto.randomUUID();
        const photo: any = {
            isLocal: true,
            albumId,
            albumClassId: classId,
            albumClassName: className,
            topicId: classId,
            topicName: className,
            name: file.name,
            desc: file.path,
            pre: file.path,
            custom_pre_filepath: file.path,
            raw: file.path,
            custom_filepath: file.path,
            url: file.path,
            custom_url: file.path,
            is_video: isVideo,
            picKey,
            uniKey: picKey,
        };
        if (isVideo) {
            photo.video_info = { vid: picKey, video_url: file.path };
        }
        return photo;
    });

    const album: any = {
        isLocal: true,
        id: albumId,
        name: albumName,
        desc: albumName,
        classid: classId,
        className,
        photoList,
        total: photoList.length,
    };
    // 取第一张非视频文件做相册封面（全是视频时不设封面）
    const cover = photoList.find((photo) => !photo.is_video);
    if (cover) {
        album.custom_filepath = '../' + cover.custom_filepath;
    }
    return album;
}

/** 与 api.js 的 filenameValidate 一致：备份时相册目录名会做非法字符替换 */
function filenameValidate(name: string): string {
    return String(name || '').replace(/'|#|~|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g, '_');
}

/** 读取备份里已有的相册数据（Albums/json/albums.js） */
async function readExistingAlbums(albumsDir: any): Promise<any[]> {
    try {
        const jsonDir = await getSubDir(albumsDir, 'json');
        if (!jsonDir) {
            return [];
        }
        const handle = await jsonDir.getFileHandle('albums.js');
        const text = await (await handle.getFile()).text();
        const parsed = JSON.parse(text.replace('window.albums = ', ''));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('读取已有相册数据失败', error);
        return [];
    }
}

/**
 * 反推一条相册记录占用的备份目录（分类/目录名）
 * 相片里存的是它在备份里的实际路径 Albums/分类/相册/文件名，直接取中间两段最准，
 * 不受相册命名方式、相片命名方式影响；取不到路径时才按命名规则兜底。
 */
function albumDirKeys(album: any): { keys: string[]; exact: boolean } {
    const keys = new Set<string>();
    for (const photo of album.photoList || []) {
        const path = String(photo.custom_filepath || photo.custom_pre_filepath || photo.desc || '');
        const parts = path.split('/');
        if (parts.length >= 4 && parts[0] === 'Albums') {
            keys.add(parts[1] + '/' + parts[2]);
        }
    }
    if (keys.size > 0) {
        return { keys: [...keys], exact: true };
    }
    return { keys: [filenameValidate(album.className) + '/' + filenameValidate(album.name)], exact: false };
}

/** 相册记录的目录索引：精确路径优先，无路径的记录退为按名称模糊匹配 */
interface DirIndex {
    exact: Map<string, any>;
    loose: { className: string; folder: string; album: any }[];
}

function indexAlbumDirs(albums: any[]): DirIndex {
    const index: DirIndex = { exact: new Map(), loose: [] };
    for (const album of albums) {
        const { keys, exact } = albumDirKeys(album);
        for (const key of keys) {
            if (exact) {
                if (!index.exact.has(key)) {
                    index.exact.set(key, album);
                }
                continue;
            }
            const [className = '', folder = ''] = key.split('/');
            index.loose.push({ className, folder, album });
        }
    }
    return index;
}

/** 查目录对应的相册记录（相册序号命名时目录名带序号前缀，仅模糊项参与后缀匹配） */
function findAlbumByDir(index: DirIndex, className: string, dirName: string): any {
    const hit = index.exact.get(className + '/' + dirName);
    if (hit) {
        return hit;
    }
    const loose = index.loose.find((item) => item.className === className
        && (item.folder === dirName || dirName.endsWith('_' + item.folder)));
    return loose ? loose.album : null;
}

/** 根据行状态汇总提示文案 */
function buildAlbumTip(rows: AlbumRow[]): string {
    const count = (state: string) => rows.filter((row) => row.state === state).length;
    const added = count('新增');
    const removed = count('将移除');
    const kept = count('已有');
    const space = count('空间备份');
    const duplicated = rows.filter((row) => row.state === '空间备份' && row.note).length;
    const parts: string[] = [];
    if (added > 0 || removed > 0) {
        parts.push('新增 ' + added + ' 个、将移除 ' + removed + ' 个、已有 ' + kept + ' 个');
    } else if (kept > 0) {
        parts.push('本地相册无变化（已有 ' + kept + ' 个）');
    } else if (space > 0) {
        parts.push('没有读到本地相册');
    } else {
        // 一个相册目录都没读到：多半是还没把本地相册放进来（与媒体处理方式无关，外链模式同样支持）
        return '还没发现本地相册目录：请先把你的相册按「Albums/分类名/相册名/」放好（媒体处理方式不影响本功能，外链模式同样支持），再重新选择备份文件夹扫描。';
    }
    if (space > 0) {
        parts.push(space + ' 个空间相册不会被改动');
    }
    if (duplicated > 0) {
        parts.push('可清掉 ' + duplicated + ' 条重复的本地记录');
    }
    return parts.join('，') + (added > 0 || removed > 0 || duplicated > 0 ? '，点击生成写入备份' : '');
}

/** 选择备份文件夹并扫描本地相册 */
async function onSelectFolder(): Promise<void> {
    if (!(window as any).showDirectoryPicker) {
        albumTip.value = '当前浏览器不支持目录选择，需要 Chromium 86+';
        return;
    }
    let folder: any;
    try {
        folder = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            albumTip.value = '选择目录失败：' + ((error as Error).message || '未知错误');
        }
        return;
    }

    rootHandle.value = folder;
    localAlbums.value = [];
    albumRowsView.value = [];
    albumsHandle.value = null;
    scanning.value = true;
    albumTip.value = '正在读取本地相册...';

    try {
        const albumsDir = await getSubDir(folder, 'Albums');
        if (!albumsDir) {
            albumTip.value = '所选目录下没有 Albums 文件夹，请选择 QQ 空间备份文件夹';
            return;
        }
        albumsHandle.value = albumsDir;

        // 已有相册数据（上次生成会回写到这里）：用于区分空间采集的相册与上次生成的本地相册
        const existing = await readExistingAlbums(albumsDir);
        const spaceIndex = indexAlbumDirs(existing.filter((item) => !item.isLocal));
        const prevLocal = existing.filter((item) => item.isLocal);
        const prevLocalIndex = indexAlbumDirs(prevLocal);

        // Albums 下除保留目录外的子目录视为分类，分类下的子目录视为相册
        const albums: any[] = [];
        const rows: AlbumRow[] = [];
        /** 已被目录对上号的本地记录，剩下的就是本次会被清掉的 */
        const matchedLocal = new Set<any>();
        for await (const classHandle of albumsDir.values()) {
            if (classHandle.kind !== 'directory' || RESERVED_DIRS.includes(classHandle.name.toLowerCase())) {
                continue;
            }
            for await (const albumHandle of classHandle.values()) {
                if (albumHandle.kind !== 'directory') {
                    continue;
                }
                const key = classHandle.name + '/' + albumHandle.name;
                const localRecord = findAlbumByDir(prevLocalIndex, classHandle.name, albumHandle.name);
                if (localRecord) {
                    matchedLocal.add(localRecord);
                }
                const spaceAlbum = findAlbumByDir(spaceIndex, classHandle.name, albumHandle.name);
                if (spaceAlbum) {
                    // 空间采集的相册目录不能再当本地相册加一遍，否则相册页会重复出现
                    rows.push({
                        key,
                        source: 'QQ空间',
                        state: '空间备份',
                        className: classHandle.name,
                        name: spaceAlbum.name || albumHandle.name,
                        folder: albumHandle.name,
                        total: spaceAlbum.total || (spaceAlbum.photoList?.length || 0),
                        note: localRecord ? '历史生成把它重复当成了本地相册，生成后会清掉重复记录' : '',
                    });
                    continue;
                }
                const files = await collectFiles(albumHandle, 'Albums/' + classHandle.name);
                albums.push(toAlbum(classHandle.name, albumHandle.name, files));
                rows.push({
                    key,
                    source: '本地目录',
                    state: localRecord ? '已有' : '新增',
                    className: classHandle.name,
                    name: albumHandle.name,
                    folder: albumHandle.name,
                    total: files.length,
                    note: localRecord ? '' : '本次生成后才会出现在相册页',
                });
            }
        }
        // 上次生成过、但目录已不存在的本地相册，本次生成后会从相册页移除
        for (const item of prevLocal) {
            if (matchedLocal.has(item)) {
                continue;
            }
            const folder = String(albumDirKeys(item).keys[0] || '').split('/')[1] || item.desc || item.name;
            rows.push({
                key: 'removed:' + item.className + '/' + folder,
                source: '本地目录',
                state: '将移除',
                className: item.className,
                name: item.desc || item.name,
                folder,
                total: item.photoList?.length || 0,
                note: '目录已不存在，生成后从相册页移除',
            });
        }
        rows.sort((a, b) => ((STATE_ORDER[a.state] ?? 0) - (STATE_ORDER[b.state] ?? 0))
            || (b.note ? 1 : 0) - (a.note ? 1 : 0)
            || (a.className + '/' + a.folder).localeCompare(b.className + '/' + b.folder));

        localAlbums.value = albums;
        albumRowsView.value = rows;
        albumTip.value = buildAlbumTip(rows);
    } catch (error) {
        albumTip.value = '读取本地相册异常：' + ((error as Error).message || '未知错误');
    } finally {
        scanning.value = false;
    }
}

async function writeFile(handle: any, contents: string): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
}

// ------------------------- 备份升级 -------------------------

/**
 * 升级项
 *
 * 备份目录是一次性写出去的快照，不会随助手升级而变；而助手会持续演进
 * （查看器换代、备份包结构调整……）。故这里把“把旧备份带到新版”抽成一组可追加的
 * 升级项：以后新增迁移逻辑（如数据文件改名、目录重排）只需往 UPGRADES 里加一条，
 * 不用再动 UI。
 */
interface BackupUpgrade {
    title: string;
    /** 执行升级，返回一句结果描述 */
    apply: (root: any) => Promise<string>;
}

/**
 * 需要写入备份目录的查看器文件
 * from: 扩展包内的源路径（viewer 构建产物在扩展的 viewer/ 目录下）
 * to: 备份包内的目标路径（首页在备份根目录，脚本/样式在 Common/js、Common/css，地图依赖与占位图在 Common 下）
 */
const VIEWER_FILES = [
    { from: 'viewer/index.html', to: 'index.html' },
    { from: 'viewer/Common/js/index.js', to: 'Common/js/index.js' },
    { from: 'viewer/Common/css/index.css', to: 'Common/css/index.css' },
    { from: 'viewer/Common/images/no_cover.gif', to: 'Common/images/no_cover.gif' },
    { from: 'viewer/Common/images/media_missing.png', to: 'Common/images/media_missing.png' },
    { from: 'viewer/Common/vendor/echarts.min.js', to: 'Common/vendor/echarts.min.js' },
    { from: 'viewer/Common/vendor/coordtransform.min.js', to: 'Common/vendor/coordtransform.min.js' },
    { from: 'viewer/Common/vendor/maps/config.js', to: 'Common/vendor/maps/config.js' },
    { from: 'viewer/Common/vendor/maps/china.js', to: 'Common/vendor/maps/china.js' },
    { from: 'viewer/Common/vendor/maps/world.js', to: 'Common/vendor/maps/world.js' },
    { from: 'viewer/Common/vendor/maps/china-cities.js', to: 'Common/vendor/maps/china-cities.js' },
];

const UPGRADES: BackupUpgrade[] = [
    {
        title: '查看器与地图依赖',
        apply: async (root) => {
            for (const { from, to } of VIEWER_FILES) {
                await copyExtensionFile(root, from, to);
            }
            // 旧版把地图依赖放在备份根目录的 vendor/，现已迁到 Common/vendor/，删掉旧的避免冗余
            try {
                await root.removeEntry('vendor', { recursive: true });
            } catch {
                // 没有旧 vendor 目录则忽略
            }
            // 旧版把 index.js/index.css 放在备份根目录，现已迁到 Common/js、Common/css，删掉旧的避免冗余
            for (const old of ['index.js', 'index.css']) {
                try {
                    await root.removeEntry(old);
                } catch {
                    // 没有旧文件则忽略
                }
            }
            return `已写入 ${VIEWER_FILES.length} 个文件（查看器主体及 Common 依赖）`;
        },
    },
];

const upgrading = ref(false);
const upgradeTip = ref('选中备份根目录（包含 Common、Messages 等子目录的那一层）');
const upgradeResults = ref<{ title: string; text: string; ok: boolean }[]>([]);

/** 逐层取（或建）目录 */
async function ensureDir(root: any, segments: string[]): Promise<any> {
    let handle = root;
    for (const name of segments) {
        handle = await handle.getDirectoryHandle(name, { create: true });
    }
    return handle;
}

/** 把扩展内的文件写到备份目录（二进制原样写入） */
async function copyExtensionFile(root: any, sourcePath: string, targetPath: string): Promise<void> {
    const response = await fetch(chrome.runtime.getURL(sourcePath));
    if (!response.ok) {
        throw new Error(sourcePath + ' 读取失败');
    }
    const blob = await response.blob();
    const segments = targetPath.split('/');
    const fileName = segments.pop() as string;
    const dir = await ensureDir(root, segments);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

/** 选备份目录，逐项执行升级 */
async function onUpgradeBackup(): Promise<void> {
    if (!(window as any).showDirectoryPicker) {
        upgradeTip.value = '当前浏览器不支持目录选择，需要 Chromium 86+';
        return;
    }
    let root: any;
    try {
        root = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            upgradeTip.value = '选择目录失败：' + ((error as Error).message || '未知错误');
        }
        return;
    }

    upgrading.value = true;
    upgradeResults.value = [];
    try {
        // 防误操：确认选的确实是备份根目录，避免往任意文件夹里写东西
        // 新版备份结构：数据在 Common/ 子目录，查看器主体（index.html 等）直接落在根目录
        const hasCommon = await getSubDir(root, 'Common');
        const hasRootViewer = await getRootFile(root, 'index.html');
        if (!hasCommon && !hasRootViewer) {
            upgradeTip.value = '这不像备份根目录（没找到 Common 子目录或根目录的查看器文件），请选上一层再试';
            return;
        }

        for (const upgrade of UPGRADES) {
            upgradeTip.value = '正在升级：' + upgrade.title + '...';
            try {
                const text = await upgrade.apply(root);
                upgradeResults.value.push({ title: upgrade.title, text, ok: true });
            } catch (error) {
                // 单项失败不中断其它升级项
                upgradeResults.value.push({
                    title: upgrade.title,
                    text: (error as Error).message || '未知错误',
                    ok: false,
                });
                console.error('升级备份异常：' + upgrade.title, error);
            }
        }
        const failed = upgradeResults.value.filter((item) => !item.ok).length;
        upgradeTip.value = failed === 0
            ? '升级完成，重新打开备份里的 index.html 即可（建议 Ctrl+F5 强刷）'
            : `升级结束，其中 ${failed} 项失败，详见下方`;
    } catch (error) {
        upgradeTip.value = '升级失败：' + ((error as Error).message || '未知错误');
        console.error('升级备份异常', error);
    } finally {
        upgrading.value = false;
    }
}

/** 把本地相册写入备份：更新 albums.js（查看器直接读它，无需再生成静态首页） */
async function onGenerateAlbums(): Promise<void> {
    if (!albumsHandle.value) {
        return;
    }
    generating.value = true;
    albumTip.value = '本地相册生成中...';
    try {
        const jsonDir = await getSubDir(albumsHandle.value, 'json');
        if (!jsonDir) {
            albumTip.value = 'Albums/json 目录不存在，无法写入相册数据';
            return;
        }
        const jsonHandle = await jsonDir.getFileHandle('albums.js');
        const text = await (await jsonHandle.getFile()).text();
        const parsed = JSON.parse(text.replace('window.albums = ', ''));

        // 丢弃上一次添加的本地相册，仅保留空间采集的相册，再合并本次结果
        const albums = (Array.isArray(parsed) ? parsed : []).filter((item: any) => !item.isLocal);
        albums.push(...localAlbums.value);

        // 查看器直接读取 albums.js 展示相册，只需回写该数据文件
        await writeFile(jsonHandle, 'window.albums = ' + JSON.stringify(albums));

        // 已写入后：新增变为已有、待移除与重复记录都已不在相册数据里
        albumRowsView.value = albumRowsView.value
            .filter((row) => row.state !== '将移除')
            .map((row) => ({ ...row, state: row.state === '新增' ? '已有' : row.state, note: '' }));
        albumTip.value = '生成完成，当前本地相册 ' + localAlbums.value.length + ' 个，重新打开备份的相册页即可查看';
    } catch (error) {
        console.error('生成本地相册异常', error);
        albumTip.value = '生成失败：' + ((error as Error).message || '未知错误')
            + '；若备份页面正在浏览器中打开，请先关闭后重试';
    } finally {
        generating.value = false;
    }
}

// ------------------------- 合并备份 -------------------------
const oldHandle = ref<any>(null);
const newHandle = ref<any>(null);
const oldDirName = ref('');
const newDirName = ref('');
const mergeTip = ref('左侧选「旧备份」（被提取方），右侧选「新备份」（接收方，将被写入）');
const diffs = ref<any[]>([]);
const comparing = ref(false);
const merging = ref(false);
const mergeLog = ref('');
const mergeProgressText = ref('');

// 比较/合并的模块范围：默认全选（向后兼容整体比较/合并）；
// 大号备份可只勾选特定模块，媒体补齐仅扫描所选模块目录，显著降低内存占用、避免卡死
const ALL_MERGE_MODULES = Object.keys(MODULE_LABELS);
const mergeModules = ref<string[]>([...ALL_MERGE_MODULES]);
const mergeModuleOptions = computed<{ label: string; value: string }[]>(() =>
    ALL_MERGE_MODULES.map((m) => ({ label: MODULE_LABELS[m] || m, value: m })),
);

/** 全选：勾选全部模块（等价于整体比较/合并） */
function selectAllMergeModules(): void {
    mergeModules.value = [...ALL_MERGE_MODULES];
}

/** 全不选：清空勾选 */
function clearMergeModules(): void {
    mergeModules.value = [];
}

/** 合并前警告弹层：强制用户先备份/导出当前备份，再确认执行合并，避免误覆盖 */
const showMergeWarning = ref(false);
const mergeAck = ref(false);

async function pickMergeDir(): Promise<any> {
    if (!(window as any).showDirectoryPicker) {
        mergeTip.value = '当前浏览器不支持目录选择，需要 Chromium 86+';
        return null;
    }
    try {
        return await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
        if ((e as Error).name !== 'AbortError') mergeTip.value = '选择目录失败：' + ((e as Error).message || '未知错误');
        return null;
    }
}

async function validBackupRoot(root: any): Promise<boolean> {
    const hasCommon = await getSubDir(root, 'Common');
    const hasRootViewer = await getRootFile(root, 'index.html');
    return !!(hasCommon || hasRootViewer);
}

async function onSelectOld(): Promise<void> {
    const h = await pickMergeDir();
    if (h) { oldHandle.value = h; oldDirName.value = h.name; mergeTip.value = ''; diffs.value = []; }
}
async function onSelectNew(): Promise<void> {
    const h = await pickMergeDir();
    if (h) { newHandle.value = h; newDirName.value = h.name; mergeTip.value = ''; diffs.value = []; }
}

async function onCompare(): Promise<void> {
    if (!oldHandle.value || !newHandle.value) { mergeTip.value = '请先选择旧备份与新备份两个目录'; return; }
    if (oldHandle.value === newHandle.value) { mergeTip.value = '旧备份与新备份不能是同一个目录'; return; }
    if (!(await validBackupRoot(oldHandle.value))) { mergeTip.value = '左侧目录不像备份根目录（找不到 Common 或 index.html）'; return; }
    if (!(await validBackupRoot(newHandle.value))) { mergeTip.value = '右侧目录不像备份根目录（找不到 Common 或 index.html）'; return; }
    if (mergeModules.value.length === 0) { mergeTip.value = '请至少勾选一个模块进行比较'; return; }
    comparing.value = true;
    diffs.value = [];
    mergeProgressText.value = '比较中...';
    try {
        const oldFs = createDirectoryHandleFs(oldHandle.value);
        const newFs = createDirectoryHandleFs(newHandle.value);
        diffs.value = await compareBackups(oldFs, newFs, (info) => {
            mergeProgressText.value = `比较中：${MODULE_LABELS[info.module] || info.module || ''} (${info.done}/${info.total})`;
        }, mergeModules.value);
        diffModuleFilter.value = 'all';
        const onlyOldTotal = diffs.value.reduce((s: number, d: any) => s + d.onlyOldItems.length, 0);
        const childTotal = diffs.value.reduce((s: number, d: any) => s + d.sharedItems.reduce((x: number, y: any) => x + y.addedChildren, 0), 0);
        const photoTotal = diffs.value.reduce((s: number, d: any) => s + d.sharedItems.reduce((x: number, y: any) => x + (y.addedPhotos || 0), 0), 0);
        mergeTip.value = `比较完成：旧备份独有 ${onlyOldTotal} 条主体；共有主体在旧备份相比新备份新增了评论/点赞/浏览等子项 ${childTotal} 条、新增相片 ${photoTotal} 张（均为相同主体下旧备份多出的此类数据）。点「开始合并」写入新备份。`;
    } catch (e) {
        mergeTip.value = '比较失败：' + ((e as Error).message || '未知错误');
    } finally {
        comparing.value = false;
        mergeProgressText.value = '';
    }
}

/** 点击「开始合并」：先弹警告，确认并勾选知悉后才真正执行合并 */
function onMergeClick(): void {
    if (!oldHandle.value || !newHandle.value) return;
    mergeAck.value = false;
    showMergeWarning.value = true;
}

/** 警告弹层「确认继续合并」：关闭弹层并真正执行合并 */
async function onMergeConfirm(): Promise<void> {
    showMergeWarning.value = false;
    await doMerge();
}

/** 真正执行合并（写入新备份），与 UI 解耦便于复用 */
async function doMerge(): Promise<void> {
    if (!oldHandle.value || !newHandle.value) return;
    if (mergeModules.value.length === 0) { mergeTip.value = '请至少勾选一个模块进行合并'; return; }
    merging.value = true;
    mergeLog.value = '';
    try {
        const oldFs = createDirectoryHandleFs(oldHandle.value);
        const newFs = createDirectoryHandleFs(newHandle.value);
        const { log } = await mergeBackups(oldFs, newFs, {
            onProgress: (info) => {
                const label = info.phase === 'media' ? '补齐媒体' : info.phase === 'compare' ? '比较' : '合并';
                mergeProgressText.value = `${label}：${MODULE_LABELS[info.module] || info.module || ''} (${info.done}/${info.total})`;
            },
            modules: mergeModules.value,
        });
        mergeLog.value = log;
        mergeTip.value = '合并完成，重新打开新备份的 index.html 即可查看（建议 Ctrl+F5 强刷）';
    } catch (e) {
        mergeTip.value = '合并失败：' + ((e as Error).message || '未知错误');
    } finally {
        merging.value = false;
        mergeProgressText.value = '';
    }
}

// ------------------------- 合并差异表格视图 -------------------------
interface DiffPhoto {
    key: string;
    name: string;
    likes: number;
    comments: number;
    visitors: number;
}

interface DiffRow {
    module: string;
    moduleLabel: string;
    subjectId: string;
    subjectTitle: string;
    /** 维度：相册差异 or 相片差异（同一相册可同时存在两种行） */
    kind: 'album' | 'photo';
    type: 'onlyOld' | 'shared';
    comments: number;
    likes: number;
    views: number;
    /** 相册级独有主体自带的相片数（整条并入时一并带入） */
    photoCount?: number;
    /** 相片差异行：所属相册名（弹窗标头用） */
    albumTitle?: string;
    /** 相片差异行：逐张相片明细 */
    photoItems?: DiffPhoto[];
    /** 该主体自带的评论/点赞/浏览明细（弹窗逐条展示用） */
    commentItems?: any[];
    likeItems?: any[];
    visitorItems?: any[];
}

/** 把 compareBackups 的结果拍平成「一行一个差异主体」的表格数据
 * （相册模块会拆出「相册差异」与「相片差异」两类行，相片行标明所属相册） */
const diffRows = computed<DiffRow[]>(() => {
    const rows: DiffRow[] = [];
    for (const d of diffs.value) {
        if (!d.existsOld) continue;
        const label = MODULE_LABELS[d.module] || d.module;
        for (const it of d.onlyOldItems) {
            rows.push({
                module: d.module,
                moduleLabel: label,
                subjectId: it.id,
                subjectTitle: it.title || it.id,
                kind: 'album',
                type: 'onlyOld',
                comments: it.comments,
                likes: it.likes,
                views: it.views,
                photoCount: it.photoCount,
                commentItems: it.commentItems,
                likeItems: it.likeItems,
                visitorItems: it.visitorItems,
            });
        }
        for (const it of d.sharedItems) {
            // 相册级：共有主体下新增的评论/点赞/浏览等子项
            if (it.addedChildren > 0) {
                rows.push({
                    module: d.module,
                    moduleLabel: label,
                    subjectId: it.id,
                    subjectTitle: it.title || it.id,
                    kind: 'album',
                    type: 'shared',
                    comments: it.addedComments,
                    likes: it.addedLikes,
                    views: it.addedVisitors,
                    commentItems: it.addedCommentItems,
                    likeItems: it.addedLikeItems,
                    visitorItems: it.addedVisitorItems,
                });
            }
            // 相片级：共有相册里旧备份多出的相片（单列一行，标明所属相册）
            if (it.addedPhotoItems && it.addedPhotoItems.length > 0) {
                const items = it.addedPhotoItems;
                rows.push({
                    module: d.module,
                    moduleLabel: label,
                    subjectId: it.id,
                    subjectTitle: it.title || it.id,
                    kind: 'photo',
                    type: 'shared',
                    comments: items.reduce((s, p) => s + p.comments, 0),
                    likes: items.reduce((s, p) => s + p.likes, 0),
                    views: items.reduce((s, p) => s + p.visitors, 0),
                    albumTitle: it.title || it.id,
                    photoItems: items,
                });
            }
        }
    }
    return rows;
});

const showDiffDetail = ref(false);
const selectedDiff = ref<DiffRow | null>(null);
function openDiffDetail(row: DiffRow): void {
    selectedDiff.value = row;
    showDiffDetail.value = true;
}

/** 整行点击：naive-ui 2.44.1 的 n-data-table 不提供 row-click 事件，
 *  必须通过 rowProps 返回带 onClick 的对象来实现整行点击打开明细。 */
function diffRowProps(row: DiffRow) {
    return {
        style: 'cursor: pointer',
        onClick: () => openDiffDetail(row),
    };
}

/** 单条评论的展示文案：内容 + 作者 + 时间 */
function fmtComment(c: any): string {
    if (!c) return '';
    const content = c.content ?? c.msgContent ?? '';
    const who = c.user?.name ?? c.user?.uin ?? c.uin ?? '';
    const time = c.createTime ?? c.postTime ?? '';
    const text = [who ? `【${who}】` : '', content, time ? ` (${time})` : ''].join('').trim();
    return text || String(c);
}
/** 单条点赞的展示文案：点赞者 */
function fmtLike(l: any): string {
    if (!l) return '';
    const fuin = l.fuin ?? l.uin ?? '';
    return fuin ? `用户 ${fuin} 点赞` : (l.content ?? String(l));
}
/** 单条访客/浏览的展示文案：访客 + 时间 */
function fmtVisitor(v: any): string {
    if (!v) return '';
    const uin = v.uin ?? '';
    const time = v.visitTime ?? v.time ?? '';
    return [uin ? `访客 ${uin}` : '访客', time ? ` (${time})` : ''].join('');
}

/** 差异明细弹窗：把选中行的评论/点赞/浏览明细整理成「可按类型分组的段落」 */
const DETAIL_CAP = 100;
const detailSections = computed<{ title: string; items: string[]; more: number }[]>(() => {
    const d = selectedDiff.value;
    if (!d) return [];
    const out: { title: string; items: string[]; more: number }[] = [];
    const push = (title: string, raw: any[] | undefined, fmt: (x: any) => string) => {
        const arr = raw || [];
        if (!arr.length) return;
        const capped = arr.length > DETAIL_CAP;
        out.push({
            title: `${title}（${arr.length} 条）`,
            items: (capped ? arr.slice(0, DETAIL_CAP) : arr).map(fmt),
            more: capped ? arr.length - DETAIL_CAP : 0,
        });
    };
    if (d.type === 'onlyOld') {
        push('评论', d.commentItems, fmtComment);
        push('点赞', d.likeItems, fmtLike);
        push('浏览', d.visitorItems, fmtVisitor);
    } else {
        push('新增评论', d.commentItems, fmtComment);
        push('新增点赞', d.likeItems, fmtLike);
        push('新增浏览', d.visitorItems, fmtVisitor);
    }
    return out;
});

const diffColumns: DataTableColumns<DiffRow> = [
    {
        title: '模块',
        key: 'moduleLabel',
        width: 90,
        render: (row) => row.moduleLabel,
    },
    {
        title: '主体',
        key: 'subjectTitle',
        render: (row) => {
            const children: any[] = [];
            // 「相册 / 相片」维度标签仅相册模块有意义，其它模块（说说/日志…）不显示
            if (row.module === 'Photos') {
                children.push(h(NTag,
                    { size: 'small', bordered: false, type: row.kind === 'photo' ? 'success' : 'default' },
                    { default: () => (row.kind === 'photo' ? '相片' : '相册') }));
                children.push(' ');
            }
            children.push(h(NTag,
                { size: 'small', bordered: false, type: row.type === 'onlyOld' ? 'info' : 'warning' },
                { default: () => (row.type === 'onlyOld' ? '独有' : '新增子项') }));
            children.push(' ');
            children.push(row.subjectTitle);
            return h('span', null, children);
        },
    },
    { title: '评论', key: 'comments', width: 80, align: 'right', render: (row) => cellLink(row, row.comments) },
    { title: '点赞', key: 'likes', width: 80, align: 'right', render: (row) => cellLink(row, row.likes) },
    { title: '浏览', key: 'views', width: 80, align: 'right', render: (row) => cellLink(row, row.views) },
];

/** 合并差异表格的分页配置（客户端分页，差异量通常不大） */
const diffPagination = {
    pageSize: 20,
    showSizePicker: true,
    pageSizes: [10, 20, 50],
    showQuickJumper: true,
};

/** 合并差异表格的筛选：按模块过滤（选项取自实际有差异的模块） */
const diffModuleFilter = ref<string>('all');
const diffModuleOptions = computed<{ label: string; value: string }[]>(() => {
    const opts = [{ label: '全部模块', value: 'all' }];
    const seen = new Set<string>();
    for (const d of diffs.value) {
        if (!d.existsOld || seen.has(d.module)) continue;
        seen.add(d.module);
        opts.push({ label: MODULE_LABELS[d.module] || d.module, value: d.module });
    }
    return opts;
});
const filteredDiffRows = computed<DiffRow[]>(() => {
    if (diffModuleFilter.value === 'all') return diffRows.value;
    return diffRows.value.filter((r) => r.module === diffModuleFilter.value);
});

/** 评论/点赞/浏览列：数量可点击，单独打开该行差异明细（数量为 0 时不提供链接） */
function cellLink(row: DiffRow, n: number) {
    if (!n) return h('span', null, '0');
    return h('a', {
        style: 'cursor:pointer;color:#2080f0;text-decoration:underline',
        onClick: (e: MouseEvent) => { e.stopPropagation(); openDiffDetail(row); },
    }, String(n));
}
</script>

<template>
    <n-tabs v-model:value="activeTool" type="line" animated>
        <n-tab-pane name="backedup" tab="增量备份管理">
            <n-alert type="info" :show-icon="true" class="block-alert">
                这里管理的是「增量备份」的<b>记录</b>（每个模块已备份到哪些内容），<b>不是备份出来的文件</b>；
                删除记录后，下次备份该模块会<b>重新全量采集</b>（耗时可能很长），请谨慎操作。
            </n-alert>

            <div class="toolbar">
                <span class="label">目标 QQ</span>
                <n-select
                    v-model:value="targetUin"
                    :options="uinOptions"
                    :disabled="uinOptions.length === 0"
                    placeholder="暂无备份记录"
                    style="width: 200px;"
                />
                <n-button size="small" type="primary" secondary @click="onImport">导入</n-button>
                <n-button size="small" secondary :disabled="!targetUin" @click="onExport">导出</n-button>
                <n-button size="small" type="error" :disabled="!targetUin" @click="onDelete">删除</n-button>
                <n-button size="small" secondary @click="loadBackedup">刷新</n-button>
            </div>
            <p class="hint block-hint">
                不勾选模块时，导入/删除针对该 QQ 的全部模块；勾选后仅处理选中的模块。
            </p>

            <n-alert v-if="status.show" :type="status.type" :show-icon="true" class="block-alert">
                {{ status.msg }}
            </n-alert>

            <n-alert v-if="loading && targetUin" type="info" :show-icon="true" class="block-alert">
                正在加载 QQ {{ targetUin }} 的备份记录…
            </n-alert>

            <n-data-table
                v-model:checked-row-keys="checkedModules"
                :columns="columns"
                :data="currentItems"
                :row-key="(row) => row.module"
                :loading="loading"
                :bordered="false"
                size="small"
            />
        </n-tab-pane>

        <n-tab-pane name="localAlbum" tab="本地相册管理">
            <n-alert type="info" :show-icon="true" class="block-alert">
                把你自己的图片/视频目录归入已备份的相册页一起浏览：先把目录放到备份的
                <b>Albums/分类名/相册名/</b> 下，再在此选择备份文件夹并生成。仅适用备份类型为 HTML。
                备份时采集的相册目录会自动识别并跳过，不会重复添加。
            </n-alert>
            <div class="toolbar">
                <n-button
                    size="small"
                    :type="rootHandle && hasPendingChanges ? 'default' : 'primary'"
                    :secondary="!!rootHandle && hasPendingChanges"
                    :loading="scanning"
                    @click="onSelectFolder"
                >选择备份文件夹</n-button>
                <n-button
                    size="small"
                    :type="hasPendingChanges ? 'primary' : 'default'"
                    :secondary="!hasPendingChanges"
                    :disabled="!albumsHandle"
                    :loading="generating"
                    @click="onGenerateAlbums"
                >生成本地相册</n-button>
                <span class="hint">{{ albumTip }}</span>
            </div>
            <p v-if="albumRowsView.length > 0" class="hint block-hint">
                状态按备份里的 <b>Albums/json/albums.js</b> 比对得出（上次生成会回写到该文件）：
                <b>新增</b> / <b>将移除</b> 是本次生成带来的变化，<b>已有</b> 是上次已生成的本地相册，
                <b>空间备份</b> 是备份时从 QQ 空间采集的相册（不会被本功能改动）。
            </p>
            <n-data-table
                v-if="albumRowsView.length > 0"
                :columns="albumRowColumns"
                :data="albumRowsView"
                :row-key="(row) => row.key"
                :bordered="false"
                size="small"
                :max-height="320"
            />
        </n-tab-pane>

        <n-tab-pane name="upgrade" tab="升级已有备份">
            <n-alert type="info" :show-icon="true" class="block-alert">
                备份目录是备份当时写出的快照，不会随助手升级而变。如果你不想重跑一次备份
                （不想再动网络、担心风控，或备份包很大），可以在这里选中旧备份目录，
                把它就地带到当前版本：目前会更新查看器及足迹地图依赖，以后备份包结构变动时
                的数据迁移也会加到这里。<b>只改动升级所需的文件，不删你的备份数据与媒体。</b>
            </n-alert>
            <div class="toolbar">
                <n-button size="small" type="primary" :loading="upgrading" @click="onUpgradeBackup">
                    选备份目录并升级
                </n-button>
                <span class="hint">{{ upgradeTip }}</span>
            </div>
            <div v-if="upgradeResults.length > 0" class="upgrade-results">
                <div v-for="(item, index) in upgradeResults" :key="index" class="upgrade-item">
                    <n-tag size="small" :bordered="false" :type="item.ok ? 'success' : 'error'">
                        {{ item.ok ? '已升级' : '失败' }}
                    </n-tag>
                    <span class="upgrade-title">{{ item.title }}</span>
                    <span class="hint">{{ item.text }}</span>
                </div>
            </div>
        </n-tab-pane>

        <n-tab-pane name="merge" tab="增量合并备份">
            <n-alert type="info" :show-icon="true" class="block-alert">
                把「旧备份」里新备份没有的内容增量合并进「新备份」，等价于补课式增量备份。
                左侧选<b>旧备份</b>（被提取方），右侧选<b>新备份</b>（接收方，会被写入）。
                <b>旧备份不会被改动</b>，所有合并结果写入新备份。
            </n-alert>
            <div class="toolbar">
                <n-button size="small" type="primary" :loading="comparing" @click="onSelectOld">① 选旧备份（左）</n-button>
                <span class="hint">{{ oldDirName || '未选择' }}</span>
                <n-button size="small" type="primary" :loading="comparing" @click="onSelectNew">② 选新备份（右）</n-button>
                <span class="hint">{{ newDirName || '未选择' }}</span>
            </div>
            <div class="toolbar" style="margin-top:8px;">
                <span class="label">比较/合并模块</span>
                <n-checkbox-group v-model:value="mergeModules">
                    <n-space :size="[8, 4]">
                        <n-checkbox v-for="m in mergeModuleOptions" :key="m.value" :value="m.value">{{ m.label }}</n-checkbox>
                    </n-space>
                </n-checkbox-group>
                <n-button size="tiny" tertiary @click="selectAllMergeModules">全选</n-button>
                <n-button size="tiny" tertiary @click="clearMergeModules">全不选</n-button>
            </div>
            <p class="hint block-hint">
                默认全选（等价于原先的整体比较/合并）。备份数量较大时，建议<b>只勾选需要比较/合并的特定模块</b>，
                可显著降低内存占用、避免卡死——媒体补齐仅扫描所选模块目录与共享图目录，不再枚举整个备份树。
            </p>
            <div class="toolbar" style="margin-top:8px;">
                <n-button
                    size="small"
                    type="primary"
                    :disabled="!oldHandle || !newHandle || comparing || merging"
                    :loading="comparing"
                    @click="onCompare"
                >开始比较</n-button>
                <n-button
                    size="small"
                    type="error"
                    :disabled="diffs.length === 0 || merging || comparing"
                    :loading="merging"
                    @click="onMergeClick"
                >开始合并</n-button>
                <span class="hint">{{ mergeTip }}</span>
            </div>
            <p v-if="mergeProgressText" class="hint block-hint">{{ mergeProgressText }}</p>

            <div v-if="diffRows.length > 0" class="merge-diff">
                <div class="toolbar" style="margin-bottom: 8px;">
                    <span class="label">按模块筛选</span>
                    <n-select
                        v-model:value="diffModuleFilter"
                        :options="diffModuleOptions"
                        size="small"
                        style="width: 180px;"
                    />
                </div>
                <n-data-table
                    :columns="diffColumns"
                    :data="filteredDiffRows"
                    :row-key="(row) => row.module + '|' + row.subjectId + '|' + row.kind + '|' + row.type"
                    :bordered="false"
                    size="small"
                    :max-height="360"
                    :pagination="diffPagination"
                    :row-props="diffRowProps"
                />
                <p class="hint block-hint">
                    「<b>相册</b>」行=相册维度的差异；「<b>相片</b>」行=同一相册下旧备份多出的相片（已标明所属相册）。
                    「<b>独有</b>」= 仅旧备份有、合并时整条并入新备份；「<b>新增子项</b>」= 新旧共有的主体下，
                    旧备份相比新备份多出的评论/点赞/浏览等子项或相片。点击任意一行、或点击某行的
                    <b>评论/点赞/浏览</b> 数量，均可查看该模块/主体的差异明细。
                </p>
            </div>

            <n-alert v-if="mergeLog" type="success" :show-icon="true" class="block-alert" style="margin-top:12px;white-space:pre-wrap;">
                {{ mergeLog }}
            </n-alert>
        </n-tab-pane>
    </n-tabs>

    <n-modal
        v-model:show="showAlbumManager"
        preset="card"
        title="相册备份记录"
        style="width: 640px;"
    >
        <p class="hint block-hint">删除某个相册的记录后，下次备份会重新采集该相册的全部相片。</p>
        <div class="album-table">
            <n-data-table
                :columns="albumColumns"
                :data="albumRows"
                :row-key="(row) => row.id"
                :bordered="false"
                size="small"
            />
        </div>
    </n-modal>

    <!-- 合并前警告：提醒先备份/导出当前备份，勾选知悉后才允许继续 -->
    <n-modal
        v-model:show="showMergeWarning"
        preset="card"
        title="合并前请先备份当前数据"
        style="width: 560px; max-width: 92vw;"
        :bordered="false"
        :closable="false"
        :mask-closable="false"
        :close-on-esc="false"
    >
        <div class="merge-warn">
            <p>
                合并会把「旧备份」里<b>新备份没有</b>的内容增量写入<b>新备份（右侧接收方）</b>。
                <b>旧备份不会被改动</b>，但新备份目录将被修改。
            </p>
            <n-alert type="warning" :show-icon="true" class="merge-warn-box">
                <template #header>操作风险</template>
                合并会改写新备份的目录结构与媒体文件。若新旧备份存在同名或冲突内容，原内容可能被覆盖；
                一旦写入，原内容无法自动还原。请务必在操作前留好退路。
            </n-alert>
            <p class="merge-warn-tip">
                <b>强烈建议：</b>合并前先对<b>新备份</b>目录做一次<b>完整副本备份</b>（直接复制整个文件夹），
                或在「增量备份管理」页导出当前备份数据（JSON），以便出现问题时可以回退到合并前的状态。
            </p>
            <n-checkbox v-model:checked="mergeAck" class="merge-warn-check">
                我已复制或导出当前备份（新备份），已知悉上述风险
            </n-checkbox>
        </div>
        <template #footer>
            <div class="merge-warn-footer">
                <n-button size="small" @click="showMergeWarning = false">取消</n-button>
                <n-button size="small" type="error" :disabled="!mergeAck" :loading="merging" @click="onMergeConfirm">
                    确认继续合并
                </n-button>
            </div>
        </template>
    </n-modal>

    <!-- 差异明细弹窗：点击表格某一行查看该模块/主体的差异说明 -->
    <n-modal
        v-model:show="showDiffDetail"
        preset="card"
        title="差异明细"
        style="width: 520px; max-width: 92vw;"
        :bordered="false"
    >
        <template v-if="selectedDiff">
            <p class="hint block-hint"><b>模块：</b>{{ selectedDiff.moduleLabel }}</p>
            <p class="hint block-hint">
                <b>主体：</b>{{ selectedDiff.subjectTitle }}
                <n-tag
                    size="small"
                    :bordered="false"
                    :type="selectedDiff.kind === 'photo' ? 'success' : (selectedDiff.type === 'onlyOld' ? 'info' : 'warning')"
                    style="margin-left: 6px;"
                >{{ selectedDiff.kind === 'photo' ? '相片差异' : (selectedDiff.type === 'onlyOld' ? '旧备份独有' : '共有主体新增子项') }}</n-tag>
            </p>

            <!-- 相片差异：展示同一相册下旧备份多出的逐张相片 -->
            <template v-if="selectedDiff.kind === 'photo'">
                <p class="hint block-hint"><b>所属相册：</b>{{ selectedDiff.albumTitle }}</p>
                <p class="hint block-hint">
                    该相册在旧备份相比新备份多出了以下
                    <b>{{ selectedDiff.photoItems ? selectedDiff.photoItems.length : 0 }} 张</b>相片（按相片 Key 去重）：
                </p>
                <ul class="hint block-hint" style="margin-top: 4px;">
                    <li v-for="(p, i) in (selectedDiff.photoItems || [])" :key="i">
                        {{ p.name }}（赞 {{ p.likes }} / 评论 {{ p.comments }} / 浏览 {{ p.visitors }}）
                    </li>
                </ul>
            </template>

            <template v-else>
                <template v-if="selectedDiff.type === 'onlyOld'">
                    <p class="hint block-hint">
                        该主体仅存在于旧备份，合并时会<b>整条并入新备份</b>（含
                        {{ selectedDiff.comments }} 条评论、{{ selectedDiff.likes }} 条点赞、{{ selectedDiff.views }} 条浏览<span v-if="selectedDiff.photoCount">、{{ selectedDiff.photoCount }} 张相片</span>）。
                        以下是该主体自带的明细：
                    </p>
                </template>
                <template v-else>
                    <p class="hint block-hint">
                        该主体在新旧备份中共有。相同主体下，<b>旧备份相比新备份</b>新增了以下子项明细：
                    </p>
                </template>

                <template v-for="(sec, si) in detailSections" :key="si">
                    <p class="hint block-hint" style="margin-top: 8px;"><b>{{ sec.title }}</b></p>
                    <ul class="hint block-hint diff-list">
                        <li v-for="(t, i) in sec.items" :key="i">{{ t }}</li>
                        <li v-if="sec.more > 0" class="diff-more">…（另有 {{ sec.more }} 条未列出）</li>
                    </ul>
                </template>
                <p v-if="detailSections.length === 0" class="hint block-hint">（无评论/点赞/浏览明细）</p>
            </template>
        </template>
    </n-modal>
</template>

<style scoped>
.upgrade-results {
    margin-bottom: 6px;
}
.upgrade-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
}
.upgrade-title {
    font-size: 13px;
}
.toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}
.label {
    color: #666;
}
.album-table {
    max-height: 50vh;
    overflow: auto;
}
.merge-warn p {
    margin: 0 0 10px;
    line-height: 1.7;
    color: #334155;
}
.merge-warn-box {
    margin-bottom: 12px;
}
.merge-warn-tip {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 6px;
    padding: 8px 10px;
}
.merge-warn-check {
    margin-top: 4px;
}
.merge-warn-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.diff-list {
    max-height: 220px;
    overflow-y: auto;
    margin: 4px 0 0;
    padding-left: 20px;
}
.diff-more {
    color: #999;
    list-style: none;
    margin-left: -20px;
}
</style>
