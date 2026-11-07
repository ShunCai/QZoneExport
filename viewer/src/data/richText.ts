/**
 * 内容富文本化
 *
 * 备份数据里存的是空间接口的原始文本，表情、@、话题都还是 token 形态
 * （`[em]e123[/em]`、`@{uin:123,nick:张三}`、`#话题#`），旧页面是在渲染时才转换的
 * （见 src/export/js/common.js 的 formatContent / formatEmoticon / formatMention /
 * formatTopic / formatEmoticonPath），查看器必须实现同一套转换，否则用户看到的是原始 token。
 *
 * 处理顺序固定为：转义 → 话题 → 表情 → @ → 微信表情 → 裸链接。
 * 转义必须最先做（token 本身是纯文本，转义后再替换才不会把生成的标签也转义掉）。
 */
import { assetUrl } from './sources';
import { MEDIA_MISSING } from './mediaFallback';

/** QQ 表情的在线地址（本地没下载到时兜底；用 https 避免混合内容拦截） */
const QQ_EMOTICON_URL = 'https://qzonestyle.gtimg.cn/qzone/em/e{id}.gif';
/**
 * 微信表情的「历史在线地址」锚点——仅用于识别旧 V2 备份里的表情外链，从不发起网络请求。
 * V2 把微信表情以 <img src="https://cdn.jsdelivr.net/gh/ShunCai/QZoneExport@dev/public/img/emoji/<id>.png">
 * 写入备份；V3 在生成查看器时已把同名图片随备份导出到本地 Common/images/<id>.png，
 * 故 formatWxEmoji 只负责把这段历史外链「改写」为本地路径，运行时绝不访问 jsdelivr，完全离线可用。
 * 该常量的值必须与历史外链前缀逐字一致，才能被正确匹配改写；删除或改写都会导致旧备份表情回退到在线引用。
 */
const WX_EMOJI_HOST = 'https://cdn.jsdelivr.net/gh/ShunCai/QZoneExport@dev/public/img/emoji/';

/** HTML 转义（与旧页 API.Utils.escHTML 等价） */
export function escapeHtml(text: string): string {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 表情图片标签：三级兜底（本地 → 在线 → 占位图）
 *  - 本地：备份里已下载的 Common/images/e{id}.gif（下载模式）；
 *  - 在线：QQ 表情在线地址（外链模式/本地缺失时，联网可取）；
 *  - 占位图：以上两者都失败（如离线且未下载）时显示 media_missing，避免破图。
 * 通过 onerror 逐级回退：先切在线，再切占位图（占位图随备份导出，必存在）。
 */
function emoticonImg(local: string, remote: string, alt: string): string {
    const localUrl = assetUrl(local);
    const missingUrl = MEDIA_MISSING;
    const onerror = `if(!this.d1){this.d1=1;this.src='${remote}';}`
        + `else if(!this.d2){this.d2=1;this.src='${missingUrl}';}`;
    return `<img class="emoticon" src="${localUrl}" alt="${escapeHtml(alt)}" onerror="${onerror}" />`;
}

/**
 * 话题高亮（不跳转，仅用超链接色区分）
 * 规则：# 后直到下一个 # 或空白（含换行）为止视为一个话题，
 * 如 `想在#QQ空间 找下…。#高考 #高考加油# 测试` → `#QQ空间`、`#高考`、`#高考加油`
 * （收尾的 # 与 `# 测试` 这类 # 后即空白的均不属于话题，保留为普通字符）。
 */
function formatTopic(html: string): string {
    return html.replace(/#([^#\s]+)/g, (_match, topic) => (
        `<span class="topic">#${topic}</span>`
    ));
}

/** [em]e123[/em] → QQ 表情图片 */
function formatEmoticon(html: string): string {
    return html.replace(/\[em\]e(\d+)\[\/em\]/gi, (_match, id) => emoticonImg(
        `Common/images/e${id}.gif`,
        QQ_EMOTICON_URL.replace('{id}', id),
        `[表情${id}]`,
    ));
}

/**
 * @{uin:123,nick:张三} → 空间主页链接（受 hasUserLink 门控，关闭时仅显示 @昵称）
 *
 * 【顺序约束】必须在 formatEmoticon **之前**执行。昵称里会内嵌 `[em]e258151[/em]`
 * （QQ 空间把表情直接存进昵称），若先转表情，生成的 `<img ... onerror="...if(){...}">`
 * 里的 `}` 会被本函数 `nick:([^}]*?)` 当成 token 结尾而提前收尾，
 * 结果 `</a>` 落进 onerror 属性值里 → 浏览器把后续内容整段吞进一个未闭合的 `<a>`，
 * 表现为「评论作者名被包成链接、面板撑出横向滚动条」。故顺序为：@ → 表情。
 */
function formatMention(html: string): string {
    return html.replace(
        /@\{uin:([^}]*?),nick:([^}]*?)(?:,who:[^}]*?)?(?:,auto:[^}]*?)?\}/g,
        (_match, uin, name) => {
            // uin 只可能是数字：剔掉异常字符（引号等）再拼进属性。
            // 不能在这里再 escapeHtml 一次——调用方 formatText 已整体转义过，会变成 &amp;quot;
            const id = String(uin ?? '').replace(/[^0-9]/g, '');
            return hasUserLink.value && id
                ? `<a href="https://user.qzone.qq.com/${id}" target="_blank" rel="noreferrer">@${name}</a>`
                : `@${name}`;
        },
    );
}

import { hasUserLink } from './backupConfig';

/**
 * 微信表情：内容里可能直接带着采集时下载源的地址，替换为备份内的本地文件
 * 注意这里的地址出现在已转义的文本中，故 & 可能已成 &amp;，用宽松匹配。
 */
function formatWxEmoji(html: string): string {
    const pattern = new RegExp(WX_EMOJI_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^"\'\\s<>]{1,20})\\.png', 'g');
    return html.replace(pattern, (_match, id: string) => {
        // 历史外链中的空格可能被编码为 %20（如 Let%20Down.png），还原为本地文件名
        let name = id;
        try {
            name = decodeURIComponent(id);
        } catch {
            /* 编码异常时保留原始 id，不阻断其它表情改写 */
        }
        return assetUrl(`Common/images/${name}.png`) || _match;
    });
}

/** 裸链接转为可点击（避开已经在标签属性里的地址） */
function linkify(html: string): string {
    return html.replace(/(^|[\s(])(https?:\/\/[^\s<"']+)/g, (_match, prefix, url) => (
        `${prefix}<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`
    ));
}

/** 把一段原始文本转为可展示的 HTML */
export function formatText(text?: string | null): string {
    if (!text) {
        return '';
    }
    let html = escapeHtml(text);
    html = formatTopic(html);
    // 先 @ 后表情：@ 的昵称里可能带 [em]，见 formatMention 上的顺序说明
    html = formatMention(html);
    html = formatEmoticon(html);
    html = formatWxEmoji(html);
    html = linkify(html);
    return html;
}

/**
 * 本身已是 HTML 的内容（如日志摘要、留言正文）
 *
 * 不能走 formatText：转义会把原有标签变成可见文本。此处只做 token 转换，
 * 并刻意不做话题与裸链接处理——两者会误伤标签属性里的 # 与地址。
 */
export function formatHtmlContent(html?: string | null): string {
    if (!html) {
        return '';
    }
    let out = String(html);
    // 与 formatText 同一顺序约束：@ 先于表情
    out = formatMention(out);
    out = formatEmoticon(out);
    out = formatWxEmoji(out);
    return out;
}

/**
 * 昵称 / 备注的渲染
 *
 * QQ 空间会把表情直接存进昵称，原始值形如 `[em]e258151[/em]勤奋＋脚踏实地[em]e258158[/em]`。
 * 之前只有访客与好友列表走了转换，评论、说说作者名等直接输出原文 → 同一条评论里
 * 「@某人」显示成表情图、作者名却是一串 token。这里统一成与正文同一套转换。
 *
 * 展示名可能来自脱敏（已是纯文本）或原始数据，两种情况都安全：先转义再识别 token。
 */
export function formatNickname(name?: string | null): string {
    return formatText(name);
}

/**
 * 取出 HTML 里的可读文字
 * 用 DOMParser 而不是 innerHTML：前者解析出的文档是惰性的（不加载图片、不执行脚本），
 * 同时会把 &nbsp; 这类实体还原成字符，避免后续再转义时出现 &amp;nbsp;。
 */
function htmlToText(html: string): string {
    const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?>/gi, ' '), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * 一行摘要的富文本（那年今日等列表用）
 *
 * 各模块的摘要字段形态不一：说说是带 token 的纯文本，留言则已是 HTML。统一先压成
 * 纯文字再走 token 转换，不然说说会直接显示成 [em]e402[/em]。
 */
export function formatSummary(text?: string | null): string {
    if (!text) {
        return '';
    }
    return formatText(htmlToText(text));
}

/**
 * 说说正文
 *
 * 空间把说说正文拆成了 conlist（type 0=@某人、1=链接、2=文本），旧页面优先按它拼装，
 * 这样 @ 与链接才有正确的显示文字；没有 conlist 时退回纯文本字段。
 */
export function formatMessageContent(item: Record<string, any>): string {
    const conlist = item.conlist;
    if (!Array.isArray(conlist) || conlist.length === 0) {
        return formatText(item.content || item.custom_content);
    }
    const parts: string[] = [];
    for (const info of conlist) {
        switch (info.type) {
            case 0:
                // @某人：昵称在 con/nick 上，uin 单独给出
                parts.push(hasUserLink.value
                    ? `<a href="https://user.qzone.qq.com/${info.uin}" target="_blank" rel="noreferrer">`
                        + `@${escapeHtml(info.con || info.nick || info.uin)}</a>`
                    : `@${escapeHtml(info.con || info.nick || info.uin)}`);
                break;
            case 1: {
                const url = escapeHtml(info.url || '');
                parts.push(`<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(info.text || info.url || '')}</a>`);
                break;
            }
            default:
                if (info.con) {
                    parts.push(formatText(info.con));
                }
                break;
        }
    }
    return parts.join('').trim();
}
