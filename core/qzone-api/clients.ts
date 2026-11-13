import type { QzoneContext } from './context';
import type { ParamValue } from './request';
import { toParams } from '../shared/utils';
import { REST_URLS } from './urls';

/**
 * 域层所需的模块配置视图（对应 QZone_Config 中的分页等字段）
 */
export interface QzoneApiConfig {
    Blogs: { pageSize: number; Comments: { pageSize: number }; Visitor: { pageSize: number } };
    Diaries: { pageSize: number; Comments: { pageSize: number }; Visitor: { pageSize: number } };
    Messages: { pageSize: number; Comments: { pageSize: number }; Visitor: { pageSize: number } };
    Boards: { pageSize: number };
    Photos: {
        pageSize: number;
        Comments: { pageSize: number };
        Images: { pageSize: number; Comments: { pageSize: number }; Info: { pageSize: number } };
    };
    Videos: { pageSize: number; Comments: { pageSize: number } };
    Favorites: { pageSize: number };
    Shares: { pageSize: number; Comments: { pageSize: number }; Visitor: { pageSize: number } };
    Dev: { Maps: { TxKey: string } };
}

/** 日志列表摘要类型：固定为「摘要」('1')，采集时统一按摘要拉取，不再由配置决定 */
const SUMMARY_ABS_TYPE = '1';

/** 接口调用描述：URL + 参数（与旧版 API.Utils.get(REST_URLS.X, params) 等价） */
export interface ApiCall {
    url: string;
    params: Record<string, ParamValue>;
    /**
     * 响应编码（仅非 UTF-8 的接口需要声明）
     * fetch 恒按 UTF-8 解码响应，声明后由请求器改用对应解码器
     */
    charset?: string;
}

type Ctx = QzoneContext;
type Cfg = QzoneApiConfig;

/* ============ 公共模块（原 API.Common） ============ */

/** 获取用户信息（原 getUserInfos） */
export function userInfos(ctx: Ctx): ApiCall {
    return {
        url: REST_URLS.USER_INFO_URL,
        params: { uin: ctx.targetUin, vuin: ctx.ownerUin, fupdate: 1, rd: Math.random(), g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/** 获取点赞数目（原 getLikeInfo） */
export function likeInfo(ctx: Ctx, unikey: string): ApiCall {
    return { url: REST_URLS.LIKE_COUNT_URL, params: { fupdate: 1, unikey, g_tk: ctx.gtk } };
}

/** 获取点赞列表（原 getLikeList） */
export function likeList(ctx: Ctx, unikey: string, beginUin?: number): ApiCall {
    return {
        url: REST_URLS.LIKE_LIST_URL,
        params: {
            uin: ctx.ownerUin,
            unikey,
            begin_uin: beginUin || 0,
            query_count: 60,
            if_first_page: beginUin === 0 ? 1 : 0,
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

/** 获取用户名片（原 getUserCardInfo） */
export function userCardInfo(ctx: Ctx, uin: number): ApiCall {
    return { url: REST_URLS.USER_CARD_URL, params: { uin, fupdate: 1, rd: Math.random(), g_tk: ctx.gtk } };
}

/** 获取坐标地址信息（原 getLbsInfo） */
export function lbsInfo(cfg: Cfg, lat: number, lng: number): ApiCall {
    return { url: REST_URLS.MAP_LBS_INFO, params: { location: `${lat},${lng}`, key: cfg.Dev.Maps.TxKey } };
}

/** 坐标转换到腾讯坐标（原 toTxLbs） */
export function toTxLbs(cfg: Cfg, lat: number, lng: number, type?: string): ApiCall {
    return { url: REST_URLS.TO_TX_LBS, params: { locations: `${lat},${lng}`, type: type || '1', key: cfg.Dev.Maps.TxKey } };
}

/** 心跳保活（原 heartBeat） */
export function heartBeat(ctx: Ctx): ApiCall {
    return { url: REST_URLS.FEEDS_COUNT, params: { uin: ctx.ownerUin, rd: Math.random(), g_tk: ctx.gtk } };
}

/* ============ 日志模块（原 API.Blogs） ============ */

export function blogList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.BLOGS_LIST_URL,
        params: {
            hostUin: ctx.targetUin,
            uin: ctx.ownerUin,
            blogType: '0',
            cateName: '',
            cateHex: '',
            statYear: new Date().getFullYear(),
            reqInfo: '7',
            pos: page * cfg.Blogs.pageSize,
            num: cfg.Blogs.pageSize,
            sortType: '0',
            absType: SUMMARY_ABS_TYPE,
            source: '0',
            rand: Math.random(),
            ref: 'qzone',
            g_tk: ctx.gtk,
            verbose: '1',
            qzonetoken: ctx.token,
        },
    };
}

export function blogReadCount(ctx: Ctx, blogIds: (number | string)[]): ApiCall {
    return {
        url: REST_URLS.BLOGS_READ_COUNT_URL,
        params: {
            type: 1,
            uinList: ctx.targetUin,
            idList: blogIds.join('_'),
            r: Math.random(),
            iNotice: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            format: 'jsonp',
            ref: 'qzone',
            g_tk: ctx.gtk,
        },
    };
}

export function blogInfo(ctx: Ctx, blogid: number | string): ApiCall {
    return {
        url: REST_URLS.BLOGS_INFO_URL,
        // 该接口按 outCharset 返回 GBK 系编码，需显式声明供请求器解码
        charset: 'gb2312',
        params: {
            uin: ctx.targetUin,
            blogid,
            styledm: 'qzonestyle.gtimg.cn',
            imgdm: 'qzs.qq.com',
            bdm: 'b.qzone.qq.com',
            mode: '2',
            numperpage: '50',
            timestamp: Math.floor(Date.now() / 1000),
            dprefix: '',
            inCharset: 'gb2312',
            outCharset: 'gb2312',
            ref: 'qzone',
            page: '1',
            refererurl: 'https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&page=1&catalog=list',
        },
    };
}

export function blogComments(ctx: Ctx, cfg: Cfg, blogid: number | string, page: number): ApiCall {
    return {
        url: REST_URLS.BLOGS_COMMENTS_URL,
        params: {
            uin: ctx.ownerUin,
            num: cfg.Blogs.Comments.pageSize,
            topicId: ctx.targetUin + '_' + blogid,
            start: page * cfg.Blogs.Comments.pageSize,
            r: Math.random(),
            iNotice: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            format: 'jsonp',
            ref: 'qzone',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

/** 说说/日志等单项最近访问（原 Blogs/Diaries/Messages/Shares.getVisitors，appid区分模块） */
export function singleVisitors(ctx: Ctx, appid: number, param: string, beginNum: number, num: number): ApiCall {
    return {
        url: REST_URLS.VISITOR_SINGLE_LIST_URL,
        params: { uin: ctx.targetUin, appid, param, beginNum, num, needFriend: 1, g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

export function blogVisitors(ctx: Ctx, cfg: Cfg, targetId: string, pageIndex: number): ApiCall {
    return singleVisitors(ctx, 2, targetId, cfg.Blogs.Visitor.pageSize * pageIndex + 1, cfg.Blogs.Visitor.pageSize);
}

/* ============ 日记模块（原 API.Diaries） ============ */

export function diaryList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.DIARY_LIST_URL,
        params: {
            uin: ctx.ownerUin,
            vuin: ctx.ownerUin,
            pos: page * cfg.Diaries.pageSize,
            numperpage: cfg.Diaries.pageSize,
            pwd2sig: '',
            r: Math.random(),
            fupdate: '1',
            iNotice: '0',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            format: 'jsonp',
            ref: 'qzone',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function diaryInfo(ctx: Ctx, blogid: number | string): ApiCall {
    return {
        url: REST_URLS.DIARY_INFO_URL,
        params: {
            uin: ctx.ownerUin,
            blogid,
            pwd2sig: ctx.pwd2sig || '',
            styledm: 'qzonestyle.gtimg.cn',
            imgdm: 'qzs.qq.com',
            bdm: 'b.qzone.qq.com',
            rs: Math.random(),
            private: '1',
            ref: 'qzone',
            refererurl: 'https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&catalog=private&page=1',
        },
    };
}

export function diaryComments(ctx: Ctx, cfg: Cfg, blogid: number | string, page: number): ApiCall {
    return {
        url: REST_URLS.BLOGS_COMMENTS_URL,
        params: {
            uin: ctx.ownerUin,
            num: cfg.Diaries.Comments.pageSize,
            topicId: ctx.targetUin + '_' + blogid,
            start: page * cfg.Diaries.Comments.pageSize,
            r: Math.random(),
            iNotice: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            format: 'jsonp',
            ref: 'qzone',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function diaryVisitors(ctx: Ctx, cfg: Cfg, targetId: string, pageIndex: number): ApiCall {
    return singleVisitors(ctx, 2, targetId, cfg.Diaries.Visitor.pageSize * pageIndex + 1, cfg.Diaries.Visitor.pageSize);
}

export function diaryReadCount(ctx: Ctx, blogIds: (number | string)[]): ApiCall {
    return blogReadCount(ctx, blogIds);
}

/* ============ 好友模块（原 API.Friends） ============ */

export function friendList(ctx: Ctx): ApiCall {
    return {
        url: REST_URLS.FRIENDS_LIST_URL,
        params: { uin: ctx.ownerUin, follow_flag: 0, groupface_flag: 0, fupdate: 1, g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

export function sortFriendList(ctx: Ctx): ApiCall {
    return {
        url: REST_URLS.FRIENDS_SORT_LIST_URL,
        params: {
            res_uin: ctx.ownerUin,
            res_type: 'normal',
            format: 'jsonp',
            count_per_page: 10,
            page_index: 0,
            page_type: 0,
            mayknowuin: '',
            qqmailstat: '',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function friendshipTime(ctx: Ctx, targetUin: number): ApiCall {
    return {
        url: REST_URLS.FRIENDSHIP_INFO_URL,
        params: { activeuin: ctx.ownerUin, passiveuin: targetUin, situation: 1, isCalendar: 1, g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/** 空间访问权限探测：经个人信息接口判断（cgi_userinfo_get_all，-4009=无权访问）。
 *  原 main_page_cgi（USER_OVERVIEW_URL）概览不稳定，改用 base.qzone 的个人信息接口。 */
export function zoneAccess(ctx: Ctx, targetUin: number): ApiCall {
    return {
        url: REST_URLS.USER_INFO_URL,
        params: { uin: targetUin, vuin: ctx.ownerUin, fupdate: 1, rd: Math.random(), g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

export function specialCareList(ctx: Ctx): ApiCall {
    return {
        url: REST_URLS.SPECIAL_CARE_LIST_URL,
        params: { uin: ctx.ownerUin, do: 3, fupdate: 1, rd: Math.random(), g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/* ============ 说说模块（原 API.Messages） ============ */

export function messageList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.MESSAGES_LIST_URL,
        params: {
            uin: ctx.targetUin,
            ftype: 0,
            sort: 0,
            pos: page * cfg.Messages.pageSize,
            num: cfg.Messages.pageSize,
            replynum: 100,
            g_tk: ctx.gtk,
            callback: '_preloadCallback',
            code_version: 1,
            format: 'jsonp',
            need_private_comment: 1,
            qzonetoken: ctx.token,
        },
    };
}

export function messageFullContent(ctx: Ctx, id: string): ApiCall {
    return {
        url: REST_URLS.MESSAGES_DETAIL_URL,
        params: {
            qzonetoken: ctx.token,
            g_tk: ctx.gtk,
            tid: id,
            uin: ctx.targetUin,
            t1_source: 1,
            not_trunc_con: 1,
            hostuin: ctx.ownerUin,
            code_version: 1,
            format: 'jsonp',
            qzreferrer: 'https://user.qzone.qq.com',
        },
    };
}

export function messageImageInfos(ctx: Ctx, id: string): ApiCall {
    return {
        url: REST_URLS.MESSAGES_IMAGES_URL,
        params: { r: Math.random(), tid: id, uin: ctx.targetUin, t1_source: 1, random: Math.random(), g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/** 获取语音说说实际地址（原 getVoiceInfo，参数直接取自 voice.url 的查询串） */
export function messageVoiceInfo(voiceUrl: string): ApiCall {
    return { url: REST_URLS.MESSAGES_VOICE_INFO_URL, params: toParams(voiceUrl) };
}

export function messageComments(ctx: Ctx, cfg: Cfg, id: string, page: number): ApiCall {
    return {
        url: REST_URLS.MESSAGES_VIDEOS_COMMONTS_URL,
        params: {
            need_private_comment: 1,
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Messages.Comments.pageSize,
            num: cfg.Messages.Comments.pageSize,
            order: 0,
            topicId: ctx.targetUin + '_' + id,
            format: 'jsonp',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            ref: 'qzone',
            random: Math.random(),
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function messageVisitors(ctx: Ctx, cfg: Cfg, targetId: string, pageIndex: number): ApiCall {
    return singleVisitors(ctx, 311, targetId, cfg.Messages.Visitor.pageSize * pageIndex + 1, cfg.Messages.Visitor.pageSize);
}

/* ============ 留言模块（原 API.Boards） ============ */

export function boardList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.BOARD_LIST_URL,
        params: {
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Boards.pageSize,
            s: Math.random(),
            format: 'jsonp',
            num: cfg.Boards.pageSize,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

/* ============ 相册模块（原 API.Photos） ============ */

/** 相册接口时间戳参数（原样移植特殊生成方式） */
function photoTimestamp(): string {
    return String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9');
}

export function photoRoute(ctx: Ctx): ApiCall {
    return {
        url: REST_URLS.PHOTOS_ROUTE_URL,
        params: { UIN: ctx.targetUin, type: 'json', version: 2, json_esc: 1, g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/** 相册每页数量，配置缺失时回退到 config.js 的默认值 3000 */
const DEFAULT_ALBUM_PAGE_SIZE = 3000;

function albumPageSize(cfg: Cfg): number {
    const size = Number((cfg as { Photos?: { pageSize?: unknown } })?.Photos?.pageSize);
    return Number.isFinite(size) && size > 0 ? size : DEFAULT_ALBUM_PAGE_SIZE;
}

export function albumList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.ALBUM_LIST_URL,
        params: {
            g_tk: ctx.gtk,
            callback: 'shine0_Callback',
            t: photoTimestamp(),
            hostUin: ctx.targetUin,
            uin: ctx.ownerUin,
            appid: 4,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            source: 'qzone',
            plat: 'qzone',
            format: 'jsonp',
            notice: 0,
            filter: 1,
            handset: 4,
            needUserInfo: 1,
            idcNum: ctx.route || 102,
            mode: 2,
            sortOrder: '2',
            // 相册清单可能在配置尚未就绪时被调用（如确认弹窗抢先于 loadConfig），
            // 此处必须兜底，否则深取 cfg.Photos.pageSize 会抛 TypeError 导致清单为空
            pageStart: page * albumPageSize(cfg),
            pageNum: albumPageSize(cfg),
            callbackFun: 'shine0',
            _: Date.now(),
        },
    };
}

export function albumComments(ctx: Ctx, cfg: Cfg, albumId: string, page: number): ApiCall {
    return {
        url: REST_URLS.ALBUM_PHOTOS_COMMENTS_URL,
        params: {
            need_private_comment: 1,
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Photos.Comments.pageSize,
            num: cfg.Photos.Comments.pageSize,
            order: 1,
            topicId: albumId,
            format: 'jsonp',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            t: Date.now(),
            cmtType: 1,
            plat: 'qzone',
            source: 'qzone',
            random: Math.random(),
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function imageList(
    ctx: Ctx,
    cfg: Cfg,
    topicId: string,
    page: number,
    /** 本页条数；缺省用配置值。首页只需 topic + 第一张 picKey，传 1 可缩小脏数据命中面 */
    pageNum: number = cfg.Photos.Images.pageSize,
): ApiCall {
    return {
        url: REST_URLS.IMAGES_LIST_URL,
        params: {
            g_tk: ctx.gtk,
            callback: 'shine0_Callback',
            t: photoTimestamp(),
            mode: 0,
            idcNum: ctx.route || 102,
            hostUin: ctx.targetUin,
            topicId,
            noTopic: 0,
            uin: ctx.ownerUin,
            pageStart: page * cfg.Photos.Images.pageSize,
            pageNum,
            skipCmtCount: 0,
            singleurl: 1,
            batchId: '',
            notice: 0,
            appid: 4,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            source: 'qzone',
            plat: 'qzone',
            outstyle: 'json',
            format: 'jsonp',
            json_esc: 1,
            callbackFun: 'shine0',
            _: Date.now(),
        },
    };
}

export function imageInfo(ctx: Ctx, cfg: Cfg, topicId: string, picKey: string): ApiCall {
    return {
        url: REST_URLS.IMAGES_INFO_URL,
        params: {
            g_tk: ctx.gtk,
            t: photoTimestamp(),
            topicId,
            picKey,
            shootTime: '',
            cmtOrder: 1,
            fupdate: 1,
            plat: 'qzone',
            source: 'qzone',
            cmtNum: 10,
            likeNum: 5,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            offset: 0,
            number: 40,
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            appid: 4,
            isFirst: 1,
            sortOrder: 1,
            showMode: 1,
            need_private_comment: 1,
            prevNum: 0,
            postNum: cfg.Photos.Images.Info.pageSize || 0,
            _: Date.now(),
        },
    };
}

export function imageComments(ctx: Ctx, cfg: Cfg, albumId: string, picKey: string, page: number): ApiCall {
    return {
        url: REST_URLS.ALBUM_PHOTOS_COMMENTS_URL,
        params: {
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Photos.Images.Comments.pageSize,
            num: cfg.Photos.Images.Comments.pageSize,
            order: 1,
            topicId: albumId + '_' + picKey,
            format: 'jsonp',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            ref: 'photo',
            need_private_comment: 1,
            albumId,
            qzone: 'qzone',
            plat: 'qzone',
            random: Date.now(),
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function albumVisitors(ctx: Ctx, cfg: Cfg, targetId: string, pageIndex: number): ApiCall {
    return singleVisitors(ctx, 4, '2;' + targetId, cfg.Blogs.Visitor.pageSize * pageIndex + 1, cfg.Blogs.Visitor.pageSize);
}

export function albumSimpleVisitors(ctx: Ctx, targetId: string): ApiCall {
    return {
        url: REST_URLS.VISITOR_SIMPLE_LIST_URL,
        params: { uin: ctx.targetUin, mask: 2, mod: 2, contentid: targetId, fupdate: 1, g_tk: ctx.gtk, qzonetoken: ctx.token },
    };
}

/* ============ 视频模块（原 API.Videos） ============ */

export function videoList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.VIDEO_LIST_URL,
        params: {
            g_tk: ctx.gtk,
            callback: 'shine0_Callback',
            t: photoTimestamp(),
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            appid: 4,
            getMethod: 2,
            start: page * cfg.Videos.pageSize,
            count: cfg.Videos.pageSize,
            need_old: 0,
            getUserInfo: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            refer: 'qzone',
            source: 'qzone',
            callbackFun: 'shine0',
            _: Date.now(),
        },
    };
}

export function videoComments(ctx: Ctx, cfg: Cfg, tid: string, page: number): ApiCall {
    return {
        url: REST_URLS.MESSAGES_VIDEOS_COMMONTS_URL,
        params: {
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Videos.Comments.pageSize,
            num: cfg.Videos.Comments.pageSize,
            order: 0,
            topicId: ctx.targetUin + '_' + tid,
            format: 'jsonp',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            ref: 'qzone',
            need_private_comment: 1,
            code_version: 1,
            out_charset: 'UTF-8',
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

/* ============ 收藏模块（原 API.Favorites） ============ */

export function favoriteList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.FAVORITE_LIST_URL,
        params: {
            uin: ctx.ownerUin,
            type: 0,
            start: page * cfg.Favorites.pageSize,
            num: cfg.Favorites.pageSize,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            need_nick: 1,
            need_cnt: 0,
            need_new_user: 0,
            fupdate: 1,
            random: Math.random(),
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

/* ============ 分享模块（原 API.Shares） ============ */

export function shareList(ctx: Ctx, cfg: Cfg, page: number): ApiCall {
    return {
        url: REST_URLS.SHARE_LIST_URL,
        params: { uin: ctx.targetUin, page, num: cfg.Shares.pageSize, spaceuin: ctx.targetUin, isfriend: 0, ttype: 0 },
    };
}

export function shareComments(ctx: Ctx, cfg: Cfg, id: string, page: number): ApiCall {
    return {
        url: REST_URLS.SHARE_COMMENTS_URL,
        params: {
            fupdate: 2,
            uin: ctx.ownerUin,
            hostUin: ctx.targetUin,
            start: page * cfg.Shares.Comments.pageSize,
            num: cfg.Shares.Comments.pageSize,
            order: 1,
            topicId: ctx.targetUin + '_' + id,
            format: 'jsonp',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            ref: '',
            random: Math.random(),
            g_tk: ctx.gtk,
            qzonetoken: ctx.token,
        },
    };
}

export function shareVisitors(ctx: Ctx, cfg: Cfg, targetId: string, pageIndex: number): ApiCall {
    return singleVisitors(ctx, 202, targetId, cfg.Shares.Visitor.pageSize * pageIndex + 1, cfg.Shares.Visitor.pageSize);
}

/* ============ 访客模块（原 API.Visitors） ============ */

export function visitorList(ctx: Ctx, page: number): ApiCall {
    const isOwner = ctx.ownerUin === ctx.targetUin;
    const params: Record<string, ParamValue> = {
        uin: ctx.targetUin,
        mask: isOwner ? 7 : 2,
        g_tk: ctx.gtk,
        page,
        fupdate: 1,
        qzonetoken: ctx.token,
    };
    if (isOwner) {
        params.clear = 1;
        params.sd = Math.random();
    }
    return { url: isOwner ? REST_URLS.VISITOR_MORE_LIST_URL : REST_URLS.VISITOR_SIMPLE_LIST_URL, params };
}
