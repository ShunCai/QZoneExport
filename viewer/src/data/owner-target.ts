/**
 * 我(或好友)与对方空间的互动
 *
 * 两种使用场景：
 * 1) 查看他人空间备份（默认）：ownerUin = 备份操作者「我」，targetUin = 空间主人「TA」。
 *    统计「我 ↔ TA」的往来：我给 TA 留言/评论/点赞，TA 回应我。
 * 2) 查看本人备份 + 指定好友（opts.ownerUin = 好友 QQ）：ownerUin = 好友，targetUin = 自己。
 *    复用同一套计算，统计口径天然反转——原「我评论的」变成「TA 评论我的」，原「TA 回应我」
 *    变成「我回应 TA」。即把好友视作 owner、自己视作 target 重算一次。
 *
 * 备份数据本质是「targetUin（空间主人）」的空间内容，互动痕迹由 owner 角色（我或好友）
 * 的 uin 命中相应记录得到。
 */
import { commentReplies, commentUser, itemComments, likeUsers, messagePublishTime, visitorUsers } from './content';
import { loadItems } from './sources';
import { resolvePhotoTime } from './media';

export interface OwnerTargetInteraction {
    /** Owner 与 Target 是否不一致（即「查看他人空间的备份」） */
    enabled: boolean;
    ownerUin: string;
    targetUin: string;
    ownerName: string;
    targetName: string;
    /** 我给 TA 的留言数（留言板中我留的言） */
    myBoards: number;
    /** 我评论 TA 的说说/日志数 */
    myComments: number;
    /** TA 回复我的次数（留言回复 + 评论回复） */
    taReplies: number;
    /** 我赞 TA 的内容数（含说说/日志/相册/相片/分享/视频的点赞；早期版本只统计了说说） */
    myLikes: number;
    /**
     * 我浏览 TA 空间的各模块条目数（仅他人空间备份有效）。
     * 数据来自每个条目自身的浏览者名单（item.custom_visitor.list，与点赞/评论同级别）：
     * 某条目被 ownerUin 浏览过即记一次。视频不带该字段，故不计入。
     */
    myVisits: number;
    /** 我访问按模块拆分：说说 / 日志 / 相册(含相片) / 分享 */
    myVisitBreakdown: { message: number; blog: number; album: number; share: number };
    /** 共同会话数：我参与且 TA 回应过我的内容线程数（双向交流） */
    conversations: number;
    /** 互动事件总数（上述四项之和） */
    totalInteractions: number;
    /** 我主动发起的互动事件数 */
    fromMe: number;
    /** TA 回应我的互动事件数 */
    fromTa: number;
    /**
     * 回应率：TA 回复次数 ÷（我给 TA 的留言数 + 评论数）。点赞是单向行为，不计入分母。
     * 无留言且无评论（分母为 0）时为 null。本人备份模式下主语反转（你回复好友 ÷ 好友给你的留言+评论）。
     */
    responseRate: number | null;
    /** 首次互动时间（秒级时间戳） */
    firstTime: number | null;
    /** 最近互动时间（秒级时间戳） */
    lastTime: number | null;
    /**
     * 首次互动对应的真实条目（用于差异化展示）。无互动时为 null。
     * type 直接决定渲染组件：message→MessageItem / board→BoardItem / blog→ArticleItem。
     */
    firstEntry: InteractionEntry | null;
    /**
     * 最近互动对应的真实条目。无互动时为 null。结构同 firstEntry。
     */
    lastEntry: InteractionEntry | null;
    /** 互动频率趋势：按月聚合（仅含有互动的月份，升序） */
    monthly: { key: string; label: string; count: number }[];
    /** 全部互动事件（按时间倒序），供明细页时间线使用 */
    events: InteractionEntry[];
}

/** 互动动作类别：与统计卡片一一对应（留言/评论/回应/点赞），用于明细筛选与卡片数字同源 */
export type InteractionCategory = 'board' | 'comment' | 'reply' | 'like';

/** 一条互动条目：带上类型与原始数据，渲染时按 type 分派给对应组件（与那年今日/最初的记忆一致） */
export interface InteractionEntry {
    /** 互动类型，决定渲染组件；message/board/blog 复用对应 item 组件，其余类型用紧凑卡片渲染 */
    type: 'message' | 'board' | 'blog' | 'share' | 'video' | 'photo' | 'album';
    /** 互动动作类别：board=留言 / comment=评论 / reply=回应 / like=点赞，与统计卡片语义对齐 */
    category: InteractionCategory;
    /** 该互动发生时间（秒级时间戳） */
    time: number;
    /** 互动方向：me=我主动，ta=TA 回应 */
    dir: 'me' | 'ta';
    /** 原始条目数据，交给对应 item 组件渲染 */
    item: Record<string, any>;
}

const toStr = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
/**
 * 把「时间」统一成秒级时间戳。与展示层 formatTime 的约定保持一致：
 *   - 已格式化字符串日期 "yyyy-MM-dd HH:mm:ss" → 解析为秒
 *   - 数字 < 1e11 视为秒级（空间接口惯用）
 *   - 数字 >= 1e11 视为毫秒级（旧数据常见，如 2011 年的留言板 pubtime）→ ÷1000 归一为秒
 * 此前直接用 Number() 当秒，导致毫秒时间戳被当成公元 41430 年，首次/最近互动时间与
 * 时间线排序全错（真实最早的记录被挤出最小/最大之外）。归一为秒后，升序取最早即为
 * 真实首次互动，降序取最新即为最近互动。
 */
const asNum = (v: unknown): number => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'string') {
        // 形如 "2011-09-08 20:10:08" 的日期字符串
        if (/\d{4}-\d{2}-\d{2}/.test(v)) {
            const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (m) {
                const ms = new Date(+(m[1] ?? 0), +(m[2] ?? 1) - 1, +(m[3] ?? 0), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
                return Math.floor(ms / 1000);
            }
            return 0;
        }
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return n < 1e11 ? n : Math.floor(n / 1000);
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n < 1e11 ? n : Math.floor(n / 1000);
};

/** 留言板回复列表（与评论的 replies 字段命名不同，单独兼容） */
function boardReplies(board: Record<string, any>): Record<string, any>[] {
    return board?.replyList || board?.custom_comments || board?.comments || [];
}

/** 评论/回复的时间（postTime 优先，其次 create_time，留言回复还可能叫 time） */
function replyTime(r: Record<string, any>): number {
    return asNum(r.postTime ?? r.create_time ?? r.time);
}
function commentTime(c: Record<string, any>): number {
    return asNum(c.postTime ?? c.create_time ?? c.time);
}

/** 秒级时间戳 → { YYYY-MM, YYYY年MM月 } */
function monthKeyOf(timeSec: number): { key: string; label: string } {
    const d = new Date(timeSec * 1000);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${y}年${String(m).padStart(2, '0')}月` };
}

/**
 * 计算我与 TA 的互动指标（纯函数，便于测试与复用）
 * @param ownerUinRaw 备份操作者 uin（userInfo.ownerUin）
 * @param targetUinRaw 空间主人 uin（userInfo.uin）
 * @param messages 说说列表（含 inline 的 custom_comments / likes）
 * @param boards 留言板列表（boardInfo.items）
 * @param blogs 日志列表（含 custom_comments，现也统计 likes）
 * @param albums 相册列表（统计相册本身与相片 likes）
 * @param shares 分享列表
 * @param videos 视频列表
 */
export function computeOwnerTargetInteraction(
    ownerUinRaw: number | string,
    targetUinRaw: number | string,
    messages: Record<string, any>[],
    boards: Record<string, any>[],
    blogs: Record<string, any>[],
    albums: Record<string, any>[] = [],
    shares: Record<string, any>[] = [],
    videos: Record<string, any>[] = [],
): OwnerTargetInteraction {
    const ownerUin = toStr(ownerUinRaw);
    const targetUin = toStr(targetUinRaw);

    let fromMe = 0;
    let fromTa = 0;

    const ownerNames = new Set<string>();
    const targetNames = new Set<string>();
    /** 每条互动事件都带类型+原始条目，便于取首/末条目时直接拿到可渲染的数据 */
    const entries: InteractionEntry[] = [];
    const convItemKeys = new Set<string>();
    /** 去重：每个 (内容线程, 方向) 最多一条事件，避免多轮回复产生重复记录 */
    const meDedupKeys = new Set<string>();
    const taDedupKeys = new Set<string>();

    /**
     * 互动条目的「双方视图」
     *
     * 展开详情渲染的是完整卡片（说说带整个评论区），但这个页面讲的是**两个人的往来**，
     * 旁观者的评论混在里面会淹没对话本身。这里把评论/回复过滤成只剩 owner 与 target
     * 发的内容（原始条目不被修改）。
     */
    const bothSidesView = (type: InteractionEntry['type'], item: Record<string, any>): Record<string, any> => {
        if (type !== 'message' && type !== 'board') return item;
        const keep = new Set([ownerUin, targetUin].map(toStr));

        if (type === 'message') {
            // 点赞名单同样只留双方：第三方的赞不属于「我们的往来」
            const likeList = Array.isArray(item.likes) ? item.likes : [];
            const likeKept = likeList.filter((l: Record<string, any>) => keep.has(toStr(String(l.fuin ?? l.uin ?? ''))));
            const likeChanged = likeKept.length !== likeList.length;

            const list = itemComments(item);
            if (list.length === 0 && !likeChanged) return item;
            const filtered = list
                .map((comment) => {
                    const authorIn = keep.has(toStr(commentUser(comment).uin));
                    const replies = commentReplies(comment).filter((r) => keep.has(toStr(commentUser(r).uin)));
                    return { comment, authorIn, replies };
                })
                // 绝对规则：只保留双方发出的评论——第三方评论即使被 TA/我回复过也不保留
                //（早期版本用「x.authorIn || x.replies.length > 0」当对话上下文，实测会放行第三方线程）
                .filter((x) => x.authorIn)
                .map((x) => ({
                    ...x.comment,
                    // commentReplies 读 replies/list_3：统一写回 replies，回复数按过滤后算
                    replies: x.replies,
                    list_3: undefined,
                }));
            if (filtered.length === list.length && !likeChanged) return item;
            return {
                ...item,
                ...(likeChanged
                    ? {
                          likes: likeKept,
                          // 原始总赞数（likeTotal）一并删掉：likeTotal() 会回退到过滤后名单的长度，
                          // 否则条目卡上的「赞 N」仍是含第三方的全量数
                          likeTotal: undefined,
                          like_total: undefined,
                      }
                    : {}),
                ...(filtered.length !== list.length ? { custom_comments: filtered, comments: undefined } : {}),
            };
        }

        const replies = (item.replyList || []).filter((r: Record<string, any>) => keep.has(toStr(String(r.uin ?? ''))));
        if (replies.length === (item.replyList || []).length) return item;
        return { ...item, replyList: replies };
    };

    const addEntry = (
        type: InteractionEntry['type'],
        cat: InteractionCategory,
        item: Record<string, any>,
        time: number,
        dir: 'me' | 'ta',
        dedupKey?: string,
        /** 是否计入 fromMe/fromTa 方向计数；TA 单方面发帖等仅用于还原线程起点的条目可置 false */
        countDir = true,
    ): void => {
        // 去重：同一内容线程下同一个方向只记一条事件
        if (dedupKey) {
            const dk = dedupKey + '|' + dir;
            if (dir === 'me') {
                if (meDedupKeys.has(dk)) return;
                meDedupKeys.add(dk);
            } else {
                if (taDedupKeys.has(dk)) return;
                taDedupKeys.add(dk);
            }
        }
        // 始终添加条目（不再因 time<=0 跳过），保持事件数与计数器一致
        // 条目存「双方视图」：展开详情时第三方的评论/回复一律隐藏，只呈现你俩的往来
        entries.push({ type, category: cat, item: bothSidesView(type, item), time: Math.max(time, 0), dir });
        if (countDir) {
            if (dir === 'me') fromMe++;
            else fromTa++;
        }
    };

    /** 统计「我给 TA 点赞」：遍历 items 的 likes 名单，命中 ownerUin 即记一次点赞并记入互动时间线 */
    const countMyLikes = (
        items: Record<string, any>[],
        type: InteractionEntry['type'],
        timeOf: (i: Record<string, any>) => number,
        keyOf?: (i: Record<string, any>) => string,
    ): void => {
        for (const item of items || []) {
            // 点赞的去重键单独加 '#like' 后缀，避免与同一条目上的「我评论」(同线程同方向) 相互覆盖
            const dedupKey = keyOf ? keyOf(item) + '#like' : undefined;
            for (const like of likeUsers(item)) {
                if (toStr(like.uin) === ownerUin) {
                    markOwnerName(like.name);
                    addEntry(type, 'like', item, timeOf(item), 'me', dedupKey);
                }
            }
        }
    };

    const markOwnerName = (name?: string) => { if (name) ownerNames.add(name); };
    const markTargetName = (name?: string) => { if (name) targetNames.add(name); };

    // ============ 说说 ============
    for (const msg of messages) {
        const itemKey = 'msg:' + (msg.tid ?? msg.hash ?? msg.created_time);
        let iParticipated = false;
        let taRepliedToMe = false;

        for (const c of itemComments(msg)) {
            const cu = commentUser(c);
            if (toStr(cu.uin) === ownerUin) {
                markOwnerName(cu.name);
                iParticipated = true;
                addEntry('message', 'comment', msg, commentTime(c), 'me', itemKey);
            }
            // 该评论下的回复：仅当「是我发的评论」且「TA 来回复」才算 TA 回应我
            for (const r of commentReplies(c)) {
                const ru = commentUser(r);
                if (toStr(cu.uin) === ownerUin && toStr(ru.uin) === targetUin) {
                    markTargetName(ru.name);
                    taRepliedToMe = true;
                    addEntry('message', 'reply', msg, replyTime(r), 'ta', itemKey);
                }
            }
        }

        for (const like of likeUsers(msg)) {
            if (toStr(like.uin) === ownerUin) {
                markOwnerName(like.name);
                iParticipated = true;
                // 点赞去重键加 '#like' 后缀，避免与同一条说说上的「我评论」(同线程同方向) 相互覆盖
                addEntry('message', 'like', msg, asNum(messagePublishTime(msg)), 'me', itemKey + '#like');
            }
        }

        if (iParticipated && taRepliedToMe) convItemKeys.add(itemKey);
    }

    // ============ 日志 ============
    for (const blog of blogs) {
        const itemKey = 'blog:' + (blog.id ?? blog.hash ?? blog.pubtime);
        let iParticipated = false;
        let taRepliedToMe = false;

        for (const c of itemComments(blog)) {
            const cu = commentUser(c);
            if (toStr(cu.uin) === ownerUin) {
                markOwnerName(cu.name);
                iParticipated = true;
                addEntry('blog', 'comment', blog, commentTime(c), 'me', itemKey);
            }
            for (const r of commentReplies(c)) {
                const ru = commentUser(r);
                if (toStr(cu.uin) === ownerUin && toStr(ru.uin) === targetUin) {
                    markTargetName(ru.name);
                    taRepliedToMe = true;
                    addEntry('blog', 'reply', blog, replyTime(r), 'ta', itemKey);
                }
            }
        }

        if (iParticipated && taRepliedToMe) convItemKeys.add(itemKey);
    }

    // 日志的点赞（日志正文本身可被点赞，旧版漏统计）
    countMyLikes(blogs, 'blog', (b) => asNum(b.pubtime ?? b.pubTime ?? b.time), (b) => 'blog:' + (b.id ?? b.hash ?? b.pubtime));

    // ============ 留言板 ============
    // 留言板是 TA 的空间内容，但留言既可能由「我」发布，也可能由「TA 本人」发布：
    //   - 我发布、TA 回复（我 → TA → 我）：原逻辑已覆盖
    //   - TA 发布、我回复（TA → 我）：此前的逻辑完全漏统计，导致「首次互动」取不到这条线程
    // 这里对称处理两种方向，确保「TA 发帖、我回复」也计入互动（含首/末时间与共同会话）。
    for (const board of boards) {
        const itemKey = 'board:' + (board.id ?? board.pubtime);
        const authorUin = toStr(board.uin);
        const authorName = board.name ?? board.nickname;
        let meParticipated = false;
        let taParticipated = false;

        // 作者本人是「我」→ 我在这条留言板留了言（me 条目，计入我留言）
        if (authorUin === ownerUin) {
            markOwnerName(authorName);
            meParticipated = true;
            addEntry('board', 'board', board, asNum(board.pubtime ?? board.pubTime), 'me', itemKey);
        }

        // 回复：按回复者方向分别计入 me（我回复）/ ta（TA 回复）
        for (const r of boardReplies(board)) {
            const ru = commentUser(r);
            const ruUin = toStr(ru.uin);
            if (ruUin === ownerUin) {
                markOwnerName(ru.name);
                meParticipated = true;
                addEntry('board', 'board', board, replyTime(r), 'me', itemKey);
            } else if (ruUin === targetUin) {
                // TA 的回复算「TA 回应我」：仅当我也参与了该线程（我是作者或我也回复过）
                if (meParticipated) {
                    markTargetName(ru.name);
                    taParticipated = true;
                    addEntry('board', 'reply', board, replyTime(r), 'ta', itemKey);
                }
            }
        }

        // 仅当我也参与了该留言板线程（我留过言或回复过），TA 的这条发帖才算双方互动的一部分：
        // 补一条 ta 条目还原线程起点，使「首次互动」能取到最早时间（TA 发帖在先）。
        // 未参与则不计入，避免把 TA 单方面发布的留言板内容算成与我的互动而污染首/末时间与共同会话数。
        // countDir=false：TA 的发帖不是「TA 回应我」，不计入 fromTa / taReplies。
        if (meParticipated && authorUin === targetUin) {
            markTargetName(authorName);
            taParticipated = true;
            addEntry('board', 'board', board, asNum(board.pubtime ?? board.pubTime), 'ta', itemKey + '#post', false);
        }

        if (meParticipated && taParticipated) convItemKeys.add(itemKey);
    }

    // ============ 相册 / 相片（相片挂在 album.photoList 下） ============
    const photos = albums.flatMap((a) => (a.photoList || []).map((p: Record<string, any>) => ({ ...p, __album: a })));
    countMyLikes(albums, 'album', (a) => asNum(a.uploadtime ?? a.uploadTime ?? a.pubtime), (a) => 'album:' + (a.id ?? a.uploadtime));
    countMyLikes(photos, 'photo', (p) => asNum(resolvePhotoTime(p, 'upload')), (p) => 'photo:' + (p.lloc ?? p.id ?? p.uploadtime));

    // ============ 分享 ============
    // 分享的评论与回复：此前只统计了点赞，分享上的评论/回复完全不进互动面板，
    // 导致「互动最多的人」榜单（扫分享评论）与面板（不扫）口径不一致。
    for (const share of shares) {
        const itemKey = 'share:' + (share.shareId ?? share.id ?? share.custom_create_time);
        let iParticipated = false;
        let taRepliedToMe = false;

        for (const c of itemComments(share)) {
            const cu = commentUser(c);
            if (toStr(cu.uin) === ownerUin) {
                markOwnerName(cu.name);
                iParticipated = true;
                addEntry('share', 'comment', share, commentTime(c), 'me', itemKey);
            }
            for (const r of commentReplies(c)) {
                const ru = commentUser(r);
                if (toStr(cu.uin) === ownerUin && toStr(ru.uin) === targetUin) {
                    markTargetName(ru.name);
                    taRepliedToMe = true;
                    addEntry('share', 'reply', share, replyTime(r), 'ta', itemKey);
                }
            }
        }

        countMyLikes(shares, 'share', (s) => asNum(s.shareTime ?? s.custom_create_time), (s) => 'share:' + (s.shareId ?? s.id));

        if (iParticipated && taRepliedToMe) convItemKeys.add(itemKey);
    }

    // ============ 视频 ============
    countMyLikes(videos, 'video', (v) => asNum(v.uploadtime ?? v.uploadTime), (v) => 'video:' + (v.vid ?? v.id));

    // ============ 我访问（仅他人空间备份有效） ============
    // 数据来源为每条条目自身的浏览者名单（item.custom_visitor.list，与点赞/评论同一层级），
    // 而非「访客」模块。某条目被 ownerUin 浏览过即记一次「我访问」。视频不带该字段，故不计入。
    // 浏览是被动行为，只计入 myVisits 明细，不进入互动时间线 / 互动总量。
    const myVisitBreakdown = { message: 0, blog: 0, album: 0, share: 0 };
    let myVisits = 0;
    const countMyVisits = (
        items: Record<string, any>[],
        key: keyof typeof myVisitBreakdown,
    ): void => {
        for (const item of items || []) {
            for (const v of visitorUsers(item)) {
                if (toStr(v.uin) === ownerUin) {
                    markOwnerName(v.name);
                    myVisitBreakdown[key]++;
                    myVisits++;
                    break; // 同一条目被我浏览一次即可，避免重复计数
                }
            }
        }
    };
    countMyVisits(messages, 'message');
    countMyVisits(blogs, 'blog');
    countMyVisits(albums, 'album');
    countMyVisits(shares, 'share');

    // 四项动作维度改为从已去重的 events 同源聚合，确保「统计卡片数字 == 互动明细筛选条数」。
    // 原逻辑在循环里按「动作次数」累加（同一线程多轮评论/同一留言板既发帖又回复会重复计），
    // 与 events 按「线程/条目」去重的口径不一致，导致点击卡片后明细条数与卡片数字不符（issue 1–4）。
    const myBoards = entries.filter((e) => e.category === 'board' && e.dir === 'me').length;
    const myComments = entries.filter((e) => e.category === 'comment' && e.dir === 'me').length;
    const taReplies = entries.filter((e) => e.category === 'reply' && e.dir === 'ta').length;
    const myLikes = entries.filter((e) => e.category === 'like' && e.dir === 'me').length;

    const conversations = convItemKeys.size;
    const totalInteractions = myBoards + myComments + taReplies + myLikes;
    // 回应率：回应次数 ÷（可收到回复的主动互动：留言 + 评论）。点赞为单向，不计入分母。
    const activeOutreach = myBoards + myComments;
    const responseRate: number | null = activeOutreach > 0 ? taReplies / activeOutreach : null;
    const times = entries.map((e) => e.time);
    const firstTime = times.length ? Math.min(...times) : null;
    const lastTime = times.length ? Math.max(...times) : null;
    // 首/末互动条目：按时间排序后取首尾，带类型与原始数据供渲染组件调用
    const sortedEntries = [...entries].sort((a, b) => a.time - b.time);
    const firstEntry: InteractionEntry | null = sortedEntries.length ? sortedEntries[0] ?? null : null;
    const lastEntry: InteractionEntry | null = sortedEntries.length ? sortedEntries[sortedEntries.length - 1] ?? null : null;

    // 月度趋势（仅含事件月份，按时间升序）
    const monthMap = new Map<string, { key: string; label: string; count: number }>();
    for (const t of times) {
        if (t <= 0) continue;
        const { key, label } = monthKeyOf(t);
        const cur = monthMap.get(key) ?? { key, label, count: 0 };
        cur.count++;
        monthMap.set(key, cur);
    }
    const monthly = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key));

    const ownerMissing = ownerUinRaw === undefined || ownerUinRaw === null || ownerUinRaw === '';

    return {
        enabled: !ownerMissing && ownerUin !== targetUin,
        ownerUin,
        targetUin,
        ownerName: [...ownerNames][0] ?? String(ownerUin || '我'),
        targetName: [...targetNames][0] ?? String(targetUin || 'TA'),
        myBoards,
        myComments,
        taReplies,
        myLikes,
        myVisits,
        myVisitBreakdown,
        conversations,
        totalInteractions,
        fromMe,
        fromTa,
        responseRate,
        firstTime,
        lastTime,
        firstEntry,
        lastEntry,
        monthly,
        // 完整事件列表（时间倒序），明细页时间线直接使用，无需再次聚合
        events: [...sortedEntries].reverse(),
    };
}

/**
 * 异步入口：计算「我（ownerUin）↔ TA（targetUin）」的互动指标。
 *
 * - 他人空间备份（默认）：ownerUin = 备份者、targetUin = 空间主人，自动以「我 ↔ TA」统计。
 * - 本人备份（opts.ownerUin 指定好友 QQ）：ownerUin = 好友、targetUin = 自己（user.uin）。
 *   复用同一套计算，统计口径天然反转——原「我评论的」变成「TA 评论我的」。
 *
 * 未指定 ownerUin 且 owner === target 时返回 null（即他人空间判定失败，调用方据此不渲染）。
 */
export async function loadOwnerTargetInteraction(
    user: Record<string, any> | null,
    opts?: { ownerUin?: number | string },
): Promise<OwnerTargetInteraction | null> {
    if (!user) return null;
    const targetUin = user.uin;
    const ownerUin = opts?.ownerUin !== undefined ? opts.ownerUin : user.ownerUin;
    const ownerMissing = ownerUin === undefined || ownerUin === null || ownerUin === '';
    if (ownerMissing) return null;
    // owner 与 target 必须不同：一个人与自己没有「往来」可言。
    // 他人空间下 targetUin 恒为空间主人，故「看 TA 与某人」时若某人正是 TA 本人（或本人备份里
    // 指定了自己），都在此拦掉，避免算出一份自我互动的假数据。
    if (toStr(ownerUin) === toStr(targetUin)) return null;

    const [messages, boards, blogs, albums, shares, videos] = await Promise.all([
        loadItems('messages'),
        loadItems('boards'),
        loadItems('blogs'),
        loadItems('albums'),
        loadItems('shares'),
        loadItems('videos'),
    ]);
    return computeOwnerTargetInteraction(ownerUin, targetUin, messages, boards, blogs, albums, shares, videos);
}
