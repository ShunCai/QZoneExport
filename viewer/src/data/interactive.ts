/**
 * 全站互动用户收集
 *
 * 用于好友页的「互动好友 / 潜水好友 / 空间过客」三个特殊分组，规则与旧页
 * （src/export/js/common.js 的 API.Statistics.getAllInteractiveUsers）保持一致：
 * 把说说/日志/日记/相册/相片/视频/留言/收藏/分享/访客里出现过的评论人、回复人、点赞人、
 * 访客，以及转发/收藏来源的原作者，全部汇总去重。
 * - 互动好友：是好友，且在互动用户里
 * - 潜水好友：是好友，但从不在互动用户里
 * - 空间过客：在互动用户里，但不是好友
 */
import { loadItems, loadData } from './sources';
import { commentReplies, commentUser, itemComments } from './content';

export interface InteractiveUser {
    uin: string;
    name?: string;
}

/** 一条记录的评论人 + 回复人 */
function commentUsers(item: Record<string, any>): InteractiveUser[] {
    const users: InteractiveUser[] = [];
    for (const comment of itemComments(item)) {
        const main = commentUser(comment);
        if (main.uin) {
            users.push({ uin: String(main.uin), name: main.name });
        }
        for (const reply of commentReplies(comment)) {
            const user = commentUser(reply);
            if (user.uin) {
                users.push({ uin: String(user.uin), name: user.name });
            }
        }
    }
    return users;
}

/** 一条记录的点赞人（字段与旧页 getLikeUsers 一致） */
function likeUsers(item: Record<string, any>): InteractiveUser[] {
    return (item.likes || [])
        .map((like: Record<string, any>) => ({ uin: String(like.uin || like.fuin || ''), name: like.name || like.nick }))
        .filter((user: InteractiveUser) => user.uin);
}

/** 一条记录的访客（custom_visitor.list） */
function visitorUsers(item: Record<string, any>): InteractiveUser[] {
    return (item.custom_visitor?.list || [])
        .map((user: Record<string, any>) => ({ uin: String(user.uin || user.fuin || ''), name: user.name || user.nick }))
        .filter((user: InteractiveUser) => user.uin);
}

/** 一条记录的全部互动用户（含模块特有的转发/收藏来源） */
function itemInteractiveUsers(item: Record<string, any>, module: string): InteractiveUser[] {
    const users: InteractiveUser[] = [
        ...commentUsers(item),
        ...likeUsers(item),
        ...visitorUsers(item),
    ];
    if (module === 'Messages' && item.rt_tid && item.rt_uin) {
        // 转发说说的原主人
        users.push({ uin: String(item.rt_uin), name: item.rt_uinname });
    } else if ((module === 'Blogs' || module === 'Diaries')
        && item.orgblogid && item.orguin && item.orgblogid != item.blogid) {
        // 转发日志/日记的原主人
        users.push({ uin: String(item.orguin), name: item.orgnick });
    } else if (module === 'Favorites') {
        if (item.shuoshuo_info?.forward_flag && item.shuoshuo_info.origin_uin) {
            users.push({ uin: String(item.shuoshuo_info.origin_uin), name: item.shuoshuo_info.origin_name });
        }
        if (item.blog_info?.forward_flag && item.blog_info.origin_uin) {
            users.push({ uin: String(item.blog_info.origin_uin), name: item.blog_info.origin_name });
        }
    } else if (module === 'Visitors') {
        // 访客本人及其带出的其他访客
        // 注意：访客接口的名字字段是 name（不是 nickname），之前取错字段导致过客全部只显示 QQ 号
        if (item.uin) {
            users.push({ uin: String(item.uin), name: item.nickname || item.name });
        }
        for (const sub of item.uins || []) {
            if (sub.uin) {
                users.push({ uin: String(sub.uin), name: sub.name || sub.nick || sub.nickname });
            }
        }
    }
    return users;
}

/** 收集一批条目的互动用户 */
function collectFromItems(items: Record<string, any>[], module: string): InteractiveUser[] {
    const users: InteractiveUser[] = [];
    for (const item of items || []) {
        users.push(...itemInteractiveUsers(item, module));
    }
    return users;
}

/**
 * 收集全站互动用户（去重）
 * 涉及全部模块的数据文件，量可能较大，故由调用方在需要时再触发、并自行缓存结果。
 */
/**
 * 「互动好友 / 潜水好友」所依赖的内容模块。
 *
 * 这些模块若一个都没备份，collectInteractiveUsers 会返回空数组（而不是 null），
 * 于是所有好友都会被判成「从不互动」——那是假阴性。调用方据此给出提示，
 * 而不是假装统计成功（FriendsPage 会禁用这两个选项并注明原因）。
 */
export const INTERACTIVE_SOURCE_KEYS = [
    'messages', 'blogs', 'diaries', 'albums', 'videos', 'boards', 'favorites', 'shares', 'visitors',
] as const;

/** 是否至少备份了一个能提供互动线索的模块 */
export async function hasInteractiveSource(): Promise<boolean> {
    for (const key of INTERACTIVE_SOURCE_KEYS) {
        if ((await loadData(key)) !== null) return true;
    }
    return false;
}

export async function collectInteractiveUsers(): Promise<InteractiveUser[]> {
    const users: InteractiveUser[] = [];

    users.push(...collectFromItems(await loadItems('messages'), 'Messages'));
    users.push(...collectFromItems(await loadItems('blogs'), 'Blogs'));
    users.push(...collectFromItems(await loadItems('diaries'), 'Diaries'));

    const albums = await loadItems<Record<string, any>>('albums');
    users.push(...collectFromItems(albums, 'Albums'));
    users.push(...collectFromItems(albums.flatMap((album) => album.photoList || []), 'Photos'));

    users.push(...collectFromItems(await loadItems('videos'), 'Videos'));
    // 留言：每条留言（items）本身就是留言人，连同其回复一起当作互动；
    // 旧页把整个 boardInfo 当一条记录、items 当它的评论，故这里用同样的包装方式
    users.push(...commentUsers({ comments: await loadItems('boards') }));
    users.push(...collectFromItems(await loadItems('favorites'), 'Favorites'));
    users.push(...collectFromItems(await loadItems('shares'), 'Shares'));

    const visitors = await loadData<{ items?: Record<string, any>[] }>('visitors');
    users.push(...collectFromItems(visitors?.items || [], 'Visitors'));

    // 按 uin 去重，保留首个出现的（含名字）
    const seen = new Map<string, InteractiveUser>();
    for (const user of users) {
        if (user.uin && !seen.has(user.uin)) {
            seen.set(user.uin, user);
        }
    }
    return [...seen.values()];
}
