/**
 * 查看器展示偏好存储
 *
 * 背景：原本「展示方式」（showType/viewType）写在备份配置的 QZone_Config 里，
 * 但配置是单向传播的——Options 改了只影响"下次备份"，已导出的旧备份看不了变化；
 * 且用户想在"看这个备份"时随时切列表/摘要/瀑布流，不该回设置页重备。
 * 故展示偏好移入查看器侧，按模块记忆在 localStorage。
 *
 * 存储语义：查看器是 file:// 静态站，Chrome 下 file:// 以目录为 origin，
 * 每个备份文件夹天然拥有独立 localStorage → "记住这份备份、刷新不丢、不跨备份共享"。
 * localStorage 不可用时（个别浏览器对 file:// 的限制）静默降级为内存态，不影响功能。
 */

export type ShowType = '0' | '1'; // 表格 / 列表
export type ViewType = '0' | '1'; // 列表 / 摘要（仅日志）
/** 相册列表视图：分类视图 / 普通视图 */
export type AlbumView = 'category' | 'plain';
/** 列表排序方向 */
export type SortDir = 'desc' | 'asc';

export interface ModuleDisplayPref {
    showType?: ShowType;
    viewType?: ViewType;
    paginate?: boolean;
    /** 相册列表视图（category=分类视图、plain=普通视图） */
    albumView?: AlbumView;
    /** 相册排序方式（与 ALBUM_SORTS 的 value 对应，如 custom） */
    albumSort?: string;
    /** 列表排序字段（各模块 sorts 的 value；空串=默认首个字段） */
    sortField?: string;
    /** 列表排序方向 */
    sortDir?: SortDir;
    /** 列表每页条数；0 / 未设置为「用页面自己的默认值」 */
    pageSize?: number;
    /** 条目密度：true=紧凑（卡片内边距/行高收紧） */
    compact?: boolean;
    /** 布局三态：paged=分页 / plain=不分页（单列滚动加载）/ flow=瀑布流；''=未设置 */
    layout?: string;
}

/** viewer 侧硬编码默认值（对应已锁定设计：showType=列表、viewType=摘要、paginate=分页） */
export const DEFAULT_PREFS: Required<ModuleDisplayPref> = {
    showType: '1',
    viewType: '1',
    paginate: true,
    albumView: 'category',
    albumSort: 'custom',
    sortField: '',
    sortDir: 'desc',
    // 0 表示没设置过：ListPage 会退回各页自己的 pageSize prop
    pageSize: 0,
    compact: false,
    layout: '',
};

const STORE_KEY = 'qzone_viewer_display_prefs';

type Store = Record<string, ModuleDisplayPref> & { _globalApply?: boolean };

function readStore(): Store {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
    } catch {
        return {};
    }
}

function writeStore(store: Store): void {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
        /* localStorage 不可用：静默降级为本次会话内存态 */
    }
}

/** 取某模块的合并偏好（无记录时用默认值兜底） */
export function getModulePref(key: string): Required<ModuleDisplayPref> {
    const saved = readStore()[key] || {};
    return {
        showType: (saved.showType as ShowType) ?? DEFAULT_PREFS.showType,
        viewType: (saved.viewType as ViewType) ?? DEFAULT_PREFS.viewType,
        paginate: saved.paginate ?? DEFAULT_PREFS.paginate,
        albumView: (saved.albumView as AlbumView) ?? DEFAULT_PREFS.albumView,
        albumSort: saved.albumSort ?? DEFAULT_PREFS.albumSort,
        sortField: saved.sortField ?? DEFAULT_PREFS.sortField,
        sortDir: (saved.sortDir as SortDir) ?? DEFAULT_PREFS.sortDir,
        pageSize: saved.pageSize ?? DEFAULT_PREFS.pageSize,
        compact: saved.compact ?? DEFAULT_PREFS.compact,
        layout: saved.layout ?? DEFAULT_PREFS.layout,
    };
}

/** 局部更新某模块偏好并持久化 */
export function savePref(key: string, patch: Partial<ModuleDisplayPref>): void {
    const store = readStore();
    store[key] = { ...(store[key] || {}), ...patch };
    writeStore(store);
}
