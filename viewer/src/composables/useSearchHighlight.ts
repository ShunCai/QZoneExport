/**
 * 详情页命中词高亮
 *
 * 从全局搜索点进详情后，除了把命中的评论滚进视野，命中的**词**本身也该标出来。
 *
 * 用 CSS Custom Highlight API 而不是往 DOM 里插 `<mark>`：
 * 正文是 `v-html` 渲染的富文本，字符串替换会打穿标签、把属性值也换掉；
 * 高亮 API 只对文本节点注册 Range，完全不动 DOM 结构。
 */
import { nextTick, onBeforeUnmount, watch } from 'vue';
import { routeQuery } from '../router';

const HIGHLIGHT_NAME = 'search-hit';

/** 环境是否支持自定义高亮（Chrome 105+；不支持就静默跳过，不影响功能） */
function supported(): boolean {
    return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof (globalThis as any).Highlight === 'function';
}

/** 清掉本页注册的高亮 */
export function clearSearchHighlight(): void {
    if (supported()) {
        (CSS as any).highlights.delete(HIGHLIGHT_NAME);
    }
}

/** 在根节点内的所有文本节点里找关键词，组装 Range 并注册 */
function applySearchHighlight(root: Element | null, word: string): void {
    if (!supported()) {
        return;
    }
    clearSearchHighlight();
    const needle = word.trim().toLowerCase();
    if (!root || !needle) {
        return;
    }
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
        const text = node.textContent ?? '';
        const lower = text.toLowerCase();
        let at = lower.indexOf(needle);
        while (at >= 0) {
            const range = new Range();
            range.setStart(node, at);
            range.setEnd(node, at + needle.length);
            ranges.push(range);
            at = lower.indexOf(needle, at + needle.length);
        }
        node = walker.nextNode();
    }
    if (ranges.length > 0) {
        const HighlightCtor = (globalThis as any).Highlight;
        (CSS as any).highlights.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
    }
}

/**
 * 给当前详情页挂上命中词高亮
 *
 * 关键词来自 URL 的 `?q=`。详情内容（尤其评论、图片）是异步渲染的，
 * 单次扫描可能什么都还没画出来——这里做短轮询补扫：
 * 前 1 秒每 200ms 扫一次（内容陆续出现，反复 clear+set），之后停在最后一次结果。
 */
export function useSearchHighlight(): void {
    let timer: number | null = null;

    const refresh = (): void => {
        void nextTick().then(() => {
            clearSearchHighlight();
            if (timer !== null) {
                window.clearInterval(timer);
                timer = null;
            }
            let tries = 0;
            timer = window.setInterval(() => {
                tries += 1;
                const word = routeQuery.value.q ?? '';
                if (!word.trim()) {
                    if (timer !== null) {
                        window.clearInterval(timer);
                        timer = null;
                    }
                    return;
                }
                applySearchHighlight(document.querySelector('.page-body'), word);
                if (tries >= 8) {
                    if (timer !== null) {
                        window.clearInterval(timer);
                        timer = null;
                    }
                }
            }, 200);
        });
    };
    // 监听整个 query 而不是只看 q：列表点击条目进详情时 q 不变，但视图切了，必须重扫
    watch(() => routeQuery.value, refresh, { immediate: true });
    onBeforeUnmount(() => {
        if (timer !== null) {
            window.clearInterval(timer);
            timer = null;
        }
        clearSearchHighlight();
    });
}
