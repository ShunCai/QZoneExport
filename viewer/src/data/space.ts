import { loadData } from './sources';

/**
 * 「这份备份是谁的空间」——全站共用的判断
 *
 * 本人的备份：ownerUin === uin（或压根没有 ownerUin）。
 * 看别人空间的备份：ownerUin 是备份操作者、uin 是空间主人，两者不同。
 * 此时日记 / 好友 / 收藏是**操作者自己**的数据，不属于对方空间，任何模块列表都不该出现。
 */
export interface SpaceUser {
    uin?: number | string | null;
    ownerUin?: number | string | null;
    [key: string]: any;
}

/** 他人空间备份里要隐藏的模块（左侧菜单、动态筛选、统计条目都按这个集合过滤） */
export const OTHER_SPACE_EXCLUDED_MODULES: string[] = ['diaries', 'friends', 'favorites'];

export function isOtherSpace(user: SpaceUser | null | undefined): boolean {
    if (!user) {
        return false;
    }
    const owner = user.ownerUin;
    const target = user.uin;
    if (owner === undefined || owner === null || owner === '') {
        return false;
    }
    if (target === undefined || target === null || target === '') {
        return false;
    }
    return String(owner) !== String(target);
}

/** 页面内直接用：loadData 有缓存，重复调用不会重复注入脚本 */
export async function loadIsOtherSpace(): Promise<boolean> {
    const user = await loadData<SpaceUser>('user');
    return isOtherSpace(user);
}
