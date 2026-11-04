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
export function maskName(name: string | undefined | null): string {
    const s = String(name ?? '').trim();
    if (!s) return '';
    const chars = Array.from(s);
    if (chars.length === 1) return chars[0]!;
    if (chars.length === 2) return chars[0] + '*';
    return chars[0] + '*'.repeat(Math.min(3, chars.length - 2)) + chars[chars.length - 1];
}
