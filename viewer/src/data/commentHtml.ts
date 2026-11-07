import { avatarUrl, commentReplies, commentUser } from './content';
import { formatTime } from './format';
import { escapeHtml, formatNickname, formatText } from './richText';
import { maskedUserLabel, plainName } from './mask';
import { displayName } from './friendNames';

/**
 * 大图查看器评论面板的条目 HTML（PhotoSwipe 的 DOM 里只能塞字符串，不能用 Vue 组件）。
 *
 * 结构与列表页 CommentList.vue 对齐——左边头像列、右边名字/时间/正文，回复再嵌一层：
 * 之前是一条「头像+名字+时间」挤在同一行、正文又回到最左边，头像浮在外面，
 * 主评论和回复混成一片，看不出谁回谁。
 *
 * 昵称、正文都来自他人输入，故一律经 escapeHtml / formatText 转义后再拼接。
 */

/** 头像占位用的首字：昵称里的 `[em]…[/em]` 与标签要先剥掉，否则首字会取成「[」 */
function initialOf(label: string): string {
    const chars = Array.from(plainName(label).trim());
    return chars[0] || '?';
}

/**
 * 头像单元格：底层永远有一枚「首字」圆片，网络头像加载成功才盖上去。
 * 备份查看器常在离线 / file:// 下打开，头像外链多半取不到——那时露出首字圆片，
 * 比一个空白灰点或塌掉的布局有信息量。
 */
function avatarHtml(uin: string | undefined, label: string, hidden: boolean): string {
    const letter = `<span class="pswp-comment-avatar-letter">${escapeHtml(initialOf(label))}</span>`;
    const src = avatarUrl(uin);
    if (!src) {
        return `<span class="pswp-comment-avatar-cell">${letter}</span>`;
    }
    const blur = hidden ? ' privacy-blur' : '';
    return `<span class="pswp-comment-avatar-cell">${letter}`
        + `<img class="pswp-comment-avatar${blur}" src="${escapeHtml(src)}" alt="" `
        + 'onerror="this.style.display=\'none\'" /></span>';
}

/**
 * 单条评论（或回复）的 HTML。
 * @param isReply 回复不再递归展开自己的回复，避免深层嵌套把 300px 面板挤爆
 */
function commentEntryHtml(comment: Record<string, any>, hidden: boolean, isReply: boolean): string {
    const user = commentUser(comment);
    // 备注 > 昵称 > QQ（与列表页评论区同口径）
    const label = hidden ? maskedUserLabel(user) : displayName(user.uin, user.name);
    // 各模块回复的时间字段不一致：说说用 postTime/create_time，留言用 time/pubtime
    const time = formatTime(comment.postTime || comment.create_time || comment.time || comment.pubtime);

    // 回复的取名字段与评论一致；正文口径与 CommentList.vue 相同（只看 content）
    const body = formatText(comment.content || '');
    const replies = isReply ? [] : commentReplies(comment);
    const repliesHtml = replies.length > 0
        ? `<div class="pswp-comment-replies">${replies
            .map((reply) => commentEntryHtml(reply, hidden, true))
            .join('')}</div>`
        : '';

    return `<div class="pswp-comment${isReply ? ' pswp-comment-reply' : ''}">`
        + avatarHtml(String(user.uin ?? ''), label, hidden)
        + '<div class="pswp-comment-main">'
        + '<div class="pswp-comment-head">'
        // 昵称与正文同一套转换：昵称里的 [em]e258151[/em] 要变成表情图，不能原样输出
        + `<span class="pswp-comment-name">${formatNickname(label)}</span>`
        + `<span class="pswp-comment-time">${escapeHtml(time)}</span>`
        + '</div>'
        + `<div class="pswp-comment-text">${body}</div>`
        + repliesHtml
        + '</div></div>';
}

/** 整批评论（含各自的一层回复）的 HTML */
export function commentEntriesHtml(list: Record<string, any>[], hidden: boolean): string {
    return `<div class="pswp-comments-list">${list
        .map((comment) => commentEntryHtml(comment, hidden, false))
        .join('')}</div>`;
}
