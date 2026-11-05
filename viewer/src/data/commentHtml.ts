import { avatarUrl, commentReplies, commentUser } from './content';
import { formatTime } from './format';
import { escapeHtml, formatText } from './richText';
import { maskedUserLabel } from './mask';

/**
 * 大图查看器评论面板的条目 HTML（PhotoSwipe 的 DOM 里只能塞字符串，不能用 Vue 组件）。
 *
 * 与列表页 CommentList.vue 保持同样的口径：一条评论 + 它的一层回复。
 * 昵称、正文都来自他人输入，故一律经 escapeHtml / formatText 转义后再拼接。
 */

/**
 * 单条评论（或回复）的 HTML。
 * @param isReply 回复不再递归展开自己的回复，避免深层嵌套把 300px 面板挤爆
 */
function commentEntryHtml(comment: Record<string, any>, hidden: boolean, isReply: boolean): string {
    const user = commentUser(comment);
    const label = hidden ? maskedUserLabel(user) : String(user.name || user.uin || '');
    // 各模块回复的时间字段不一致：说说用 postTime/create_time，留言用 time/pubtime
    const time = formatTime(comment.postTime || comment.create_time || comment.time || comment.pubtime);

    const src = avatarUrl(user.uin);
    const blur = hidden ? ' privacy-blur' : '';
    const avatarHtml = src
        ? `<img class="pswp-comment-avatar${blur}" src="${escapeHtml(src)}" onerror="this.style.visibility='hidden'" />`
        : `<span class="pswp-comment-avatar pswp-comment-avatar--empty${blur}"></span>`;

    // 回复的取名字段与评论一致；正文口径与 CommentList.vue 相同（只看 content）
    const body = formatText(comment.content || '');
    const replies = isReply ? [] : commentReplies(comment);
    const repliesHtml = replies.length > 0
        ? `<div class="pswp-comment-replies">${replies
            .map((reply) => commentEntryHtml(reply, hidden, true))
            .join('')}</div>`
        : '';

    return `<div class="pswp-comment${isReply ? ' pswp-comment-reply' : ''}">`
        + `<div class="pswp-comment-head">${avatarHtml}`
        + `<span class="pswp-comment-name">${escapeHtml(label)}</span>`
        + `<span class="pswp-comment-time">${escapeHtml(time)}</span></div>`
        + `<div class="pswp-comment-text">${body}</div>`
        + repliesHtml
        + '</div>';
}

/** 整批评论（含各自的一层回复）的 HTML */
export function commentEntriesHtml(list: Record<string, any>[], hidden: boolean): string {
    return list.map((comment) => commentEntryHtml(comment, hidden, false)).join('');
}
