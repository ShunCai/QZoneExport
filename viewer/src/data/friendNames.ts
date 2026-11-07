/**
 * 好友备注（remark）优先 —— 全站统一的取名口径
 *
 * 记录里带的是对方**自己的昵称**，但「我给他起的备注」才是空间主人一眼认得出的名字。
 * 好友列表（Friends 模块）里有 remark 字段，凡是能按 uin 对上人的地方都优先用它。
 *
 * 两个入口：
 * - `friendRemarks()`：异步拿全表，供数据层聚合（最近互动 / 深夜 / 榜单）await 使用；
 * - `remarkOf()`：同步查缓存，供渲染层（列表、评论、昵称）直接调用——
 *   前提是应用启动时调过一次 `initFriendRemarks()`，否则缓存为空、退回原名（不会报错）。
 *
 * 注意：不少好友的备注就等于昵称（采集时原样带过来），此时取谁都一样，不影响结果。
 */
import { loadList } from './sources';

let cache = new Map<string, string>();
let pending: Promise<void> | null = null;

/** 启动时调一次：加载好友备注表（失败静默，退化为「只用昵称」） */
export function initFriendRemarks(): Promise<void> {
    if (!pending) {
        pending = loadList('friends')
            .then((friends) => {
                const map = new Map<string, string>();
                for (const friend of friends) {
                    const uin = friend?.uin === undefined || friend?.uin === null ? '' : String(friend.uin);
                    const remark = String(friend?.remark ?? '').trim();
                    if (uin && remark) {
                        map.set(uin, remark);
                    }
                }
                cache = map;
            })
            .catch(() => {
                cache = new Map();
            });
    }
    return pending;
}

/** 数据层用：确保备注表已加载再取 */
export async function friendRemarks(): Promise<Map<string, string>> {
    await initFriendRemarks();
    return cache;
}

/** 渲染层用：同步查备注，查不到返回空串（调用方回退原名） */
export function remarkOf(uin: string | number | null | undefined): string {
    const key = uin === undefined || uin === null ? '' : String(uin);
    return key ? (cache.get(key) ?? '') : '';
}

/**
 * 展示名：备注 > 原昵称 > uin
 * 全是同步的，可直接在模板/计算属性里用。
 */
export function displayName(
    uin: string | number | null | undefined,
    name: string | null | undefined,
): string {
    return remarkOf(uin) || String(name ?? '').trim() || (uin === undefined || uin === null ? '' : String(uin));
}

/** 把一批「带 uin + name 的行」的名字换成备注（有备注才换），返回新数组 */
export function preferRemarks<T extends { uin: string; name: string }>(
    rows: T[],
    remarks: Map<string, string>,
): T[] {
    if (remarks.size === 0) return rows;
    return rows.map((row) => {
        const remark = remarks.get(row.uin);
        return remark ? { ...row, name: remark } : row;
    });
}
