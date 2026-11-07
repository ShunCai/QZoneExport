/**
 * 昵称脱敏（隐私模式用）
 *
 * 规则：保留首尾字符，中间以 * 代替（最多 3 个，避免长名变成一长串星号）。
 * - 单字：原样返回（无从隐藏，且变了就无法辨识）
 * - 两字：首字 + *
 * - 更长：首字 + *** + 尾字
 *
 * 为什么列表里用脱敏而不是全隐：互动 TOP5 的作用是「点谁」，
 * 全部盖掉后只剩次数，列表就失去意义；脱敏既能分享截图时保护对方，又保留辨识度。
 * 按 code point 处理，避免 emoji / 生僻字被 surrogate pair 截断。
 */
/**
 * QQ 号打码（隐私模式）
 *
 * 保留前 3 后 2（不足 6 位时保留前 1 后 1），中间用 * 填充且至少 2 个。
 * 保留头尾是为了让列表里不同的人仍可区分——全星号就没法对着看了。
 * 例：1129136924 → 112*****24
 */
export function maskUin(uin: string | number | null | undefined): string {
    const s = String(uin ?? '').trim();
    if (!s) return '';
    if (s.length <= 2) return '*'.repeat(s.length);
    const keepHead = s.length >= 6 ? 3 : 1;
    const keepTail = s.length >= 6 ? 2 : 1;
    const stars = Math.max(2, s.length - keepHead - keepTail);
    return s.slice(0, keepHead) + '*'.repeat(stars) + s.slice(-keepTail);
}

/**
 * 取纯文字名（脱敏前先过一遍）
 *
 * 昵称里可能混着 QQ 表情 token 与 HTML 标签。maskName 按字符取首尾，
 * 若不先清掉这些标记，`[em]e100[/em]张三` 会被切成 `[***三`（首字符成了 `[`，真正的姓被吃掉）。
 *
 * 这里直接正则剥离，不复用 formatSummary —— 后者是「token → 表情 <img> → DOMParser 剥标签」，
 * 对脱敏来说绕了一圈，还有解析开销。
 */
export function plainName(raw: string | undefined | null): string {
    return String(raw ?? '')
        .replace(/\[em\]e\d+\[\/em\]/gi, '')
        .replace(/<[^>]*>/g, '')
        // 直接删除而非替换成空格：它是排版产物，留着会把两字名切成三字、影响首尾取字
        .replace(/&nbsp;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 名单 / 评论区统一的展示名脱敏出口。
 *
 * 各组件模板里普遍写 `user.name || user.uin`——若只脱敏 name，
 * 没昵称的人会直接露出完整 QQ 号。这里把兜底分支一并打码。
 */
export function maskedUserLabel(user: { uin?: string | number; name?: string } | null | undefined): string {
    const name = maskName(plainName(String(user?.name ?? '')));
    return name || maskUin(String(user?.uin ?? ''));
}

export function maskName(name: string | undefined | null): string {
    const s = String(name ?? '').trim();
    if (!s) return '';
    const chars = Array.from(s);
    if (chars.length === 1) return chars[0]!;
    if (chars.length === 2) return chars[0] + '*';
    return chars[0] + '*'.repeat(Math.min(3, chars.length - 2)) + chars[chars.length - 1];
}

/**
 * 隐私模式下的**内容摘要**打码
 *
 * 昵称/QQ 号打码还不够：概览卡片里的摘要（留言、说说正文、日志标题）本身就是私密内容，
 * 截图分享就会直接泄漏。
 *
 * 用**固定个数**的圆点而不是按原文长度变化：长度变化会让人一眼看出「这行原文更长」，
 * 既不整齐、也等于泄露了长度信息——统一占位反而更像真实的脱敏处理。
 */
export function maskContent(text: string | undefined | null): string {
    const t = String(text ?? '').trim();
    if (!t) return '';
    return '●'.repeat(6);
}
