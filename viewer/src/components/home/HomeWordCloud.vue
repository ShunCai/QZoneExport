<script setup lang="ts">
import { usePrivacy } from '../../composables/usePrivacy';
import { maskContent } from '../../data/mask';
import type { WordCloudResult } from '../../data/wordCloud';

/**
 * 最常用的词（横向条，与「最常用的表情」成对）
 *
 * 口径是「出现在多少条内容里」（文档频率），不是总次数——一篇长日志重复 100 次
 * 某个词不该霸榜。点击某个词直接打开全局搜索，与搜索面板形成闭环。
 */
const props = defineProps<{
    data: WordCloudResult;
    loading?: boolean;
}>();
const emit = defineEmits<{ search: [word: string] }>();

const { hidden: hideSensitive } = usePrivacy();

/** 悬浮说明：把口径、不含项、计数方式、过滤规则一次讲清，省得在正文里堆一段话 */
const HELP_TEXT = [
    '统计范围：说说、日志、日记、留言、分享的正文，以及你自己发的评论与回复',
    '不含：标题、别人的评论、昵称、相片描述',
    '计数：按「出现过的内容条数」算，同一条里重复只算 1 次，不是总次数',
    '过滤：单字词、纯数字、纯英文词与常见虚词',
].join('\n');

/** 隐私模式下词语也要打码，否则等于把内容摘要漏出去 */
function labelOf(word: string): string {
    return hideSensitive.value ? maskContent(word) : word;
}
</script>

<template>
    <div v-if="props.loading || props.data.rows.length" class="word-strip">
        <div class="strip-head">
            <!-- strip-head 是 column 布局：标题与 i 必须包成一行容器，否则 i 会独占一行 -->
            <div class="strip-title-row">
                <span class="strip-title">最常用的词</span>
                <span class="strip-help" :title="HELP_TEXT" aria-label="统计口径说明">i</span>
            </div>
            <span class="strip-note">
                {{ props.loading
                    ? '正在统计…'
                    : `共 ${props.data.docCount.toLocaleString()} 条内容 · 点击可按词搜索` }}
            </span>
        </div>
        <div class="strip-body">
            <span v-if="props.loading" class="strip-empty">正在统计…</span>
            <button
                v-for="row in props.data.rows"
                :key="row.word"
                type="button"
                class="word-chip"
                :title="`${row.word}：出现在 ${row.docs} 条内容里`"
                @click="emit('search', row.word)"
            >
                <span class="word">{{ labelOf(row.word) }}</span>
                <span class="count">{{ row.docs }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
/* 标题行：让圆圈 i 紧跟标题，而不是被 column 布局排成单独一行 */
.strip-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* 口径说明入口：小小的圆圈 i，悬浮看完整规则 */
.strip-help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1px solid var(--border);
    border-radius: 50%;
    font-size: 10px;
    line-height: 1;
    color: var(--text-secondary);
    cursor: help;
    flex: none;
}

.word-strip {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 4px;
    padding: 14px 20px;
    background: var(--bg-primary);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    box-shadow: 0 1px 3px var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
}
.word-strip:hover {
    border-color: var(--border-hover);
    box-shadow: 0 3px 10px var(--shadow-md);
}
.strip-head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.strip-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}
.strip-note {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
.strip-body {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.strip-empty {
    padding: 12px 0;
    font-size: 12px;
    color: var(--text-secondary);
}
/* 词条：主词 + 出现条数，点击即按该词搜索 */
.word-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 4px 9px;
    border: 1px solid var(--border-light);
    border-radius: 999px;
    background: var(--bg-toolbar);
    font: inherit;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}
.word-chip:hover {
    border-color: var(--accent);
    background: var(--bg-tint-blue);
}
.word {
    font-size: 13px;
    color: var(--text-primary);
}
.count {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}
</style>
