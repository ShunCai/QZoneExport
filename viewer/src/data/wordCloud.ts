/**
 * 最常用的词
 *
 * 与「最常用的表情」互补：那张数符号，这张数语义。
 *
 * 三个关键取舍：
 * 1. **用原生 `Intl.Segmenter` 分词**，零依赖、不打包词典（实测 22 万字 ~300ms）；
 *    浏览器与 Node 都内置，不可用时整条不展示，不降级成二元组（二元组 Top 全是「一个/自己/还是」）。
 * 2. **口径是「文档频率」而不是「总次数」**：一篇文章里重复 100 次某个词不该霸榜，
 *    统计「有多少条内容出现过这个词」才代表「这个人常说什么」。
 * 3. **必须先剥标记**：`[em]e402[/em]`、UBB、HTML、URL 不清掉，Top 词会是 `e402` 这种垃圾。
 */
import { loadItems } from './sources';
import { bodyOf, WORD_MODULES } from './wordCounts';

export interface WordRow {
    word: string;
    /** 出现在多少条内容里（文档频率） */
    docs: number;
}

export interface WordCloudResult {
    /** 参与统计的内容条数 */
    docCount: number;
    /** 去重后的词条总数 */
    wordCount: number;
    /** Top N */
    rows: WordRow[];
}

/** 原生分词器的最小类型声明（不依赖 TS 的 ES2021 lib 配置） */
type SegmentResult = { segment: string; isWordLike?: boolean };
type SegmenterCtor = new (locale?: string, options?: { granularity?: 'word' }) => {
    segment: (input: string) => Iterable<SegmentResult>;
};
const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;

/** 参与统计时剥掉的标记：表情 token / UBB 图片与视频块 / 其余 BBCode / HTML 标签 / 实体 / URL */
const NOISE = /\[em\]e\d+\[\/em\]|\[img[^\]]*\][\s\S]*?\[\/img\]|\[video[^\]]*\][\s\S]*?\[\/video\]|\[\/?[a-zA-Z][^\]]*\]|<[^>]*>|&[a-zA-Z#0-9]+;|https?:\/\/\S+/g;

/**
 * 高频虚词
 *
 * 只拦「查了也没有信息量」的词（代词、助词、连词、泛时间词、套话），
 * 实词一概不拦——「看到/喜欢/高考」这类才是要看的。
 */
const STOP_WORDS = new Set(
    ('我们 你们 他们 她们 它们 自己 什么 这个 那个 这些 那些 这样 那样 这么 那么 怎么 怎样 '
        + '为什么 就是 还是 也是 都是 可是 但是 不是 只是 因为 所以 如果 虽然 不过 而且 或者 '
        + '然后 于是 因此 然而 其实 现在 已经 曾经 总是 一直 一起 一定 一些 一点 一样 一般 '
        + '一个 一次 一天 一年 时候 时间 地方 事情 东西 感觉 觉得 知道 不知道 认为 以为 希望 '
        + '可能 应该 需要 可以 不能 不会 没有 还有 只有 所有 每个 其他 别人 大家 这里 那里 哪里 '
        + '如何 多少 几个 两个 三个 今天 明天 昨天 后天 前天 上午 下午 晚上 早上 中午 以前 以后 '
        + '之前 之后 最近 终于 突然 居然 果然 确实 当然 也许 大概 起来 出来 下来 上来 过去 回来 '
        + '进去 出去 开始 结束 最后 第一 第二 第三 我的 你的 他的 她的 它的 我们的 你们的 他们的 '
        + '的话 而已 之类 等等 某个 某些 真是 只能 很多 的是 不知 是否 以及 并且 而是 只要 无论 '
        + '真的 或许 看来 毕竟 反正 然后 接着 于是 就要 就会 就能 就在 就是说 也就是说')
        .split(' ')
        .filter(Boolean),
);

/** 清洗文本：剥掉标记，压掉多余空白 */
export function cleanText(value: unknown): string {
    return String(value ?? '').replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
}

/** 该词是否值得计入：至少两个字、非纯数字、非纯英文短串、不在停用词表里 */
export function isMeaningfulWord(word: string): boolean {
    const value = word.trim();
    if (value.length < 2) {
        return false;
    }
    if (/^[0-9]+$/.test(value)) {
        return false;
    }
    if (/^[a-zA-Z]+$/.test(value)) {
        return false;
    }
    return !STOP_WORDS.has(value);
}

/**
 * 把一段文本切成有意义的词
 *
 * 环境不支持 `Intl.Segmenter` 时返回 null，调用方据此不展示该卡（而不是给一份垃圾结果）。
 */
export function splitWords(text: string): string[] | null {
    if (!Segmenter) {
        return null;
    }
    const cleaned = cleanText(text);
    if (!cleaned) {
        return [];
    }
    const segmenter = new Segmenter('zh', { granularity: 'word' });
    const words: string[] = [];
    for (const part of segmenter.segment(cleaned)) {
        if (part.isWordLike === false) {
            continue;
        }
        if (isMeaningfulWord(part.segment)) {
            words.push(part.segment.trim());
        }
    }
    return words;
}

/**
 * 按「文档频率」统计词频
 *
 * 同一条内容里重复出现的词只算 1 票；不同内容各算 1 票。
 * 纯函数，便于单测。
 */
export function countWords(docs: string[], limit = 12): WordCloudResult {
    const empty: WordCloudResult = { docCount: 0, wordCount: 0, rows: [] };
    if (!Segmenter) {
        return empty;
    }
    const appearances = new Map<string, number>();
    let docCount = 0;

    for (const doc of docs) {
        const words = splitWords(doc);
        if (words === null) {
            return empty;
        }
        if (words.length === 0) {
            continue;
        }
        docCount += 1;
        for (const word of new Set(words)) {
            appearances.set(word, (appearances.get(word) ?? 0) + 1);
        }
    }

    const rows = [...appearances.entries()]
        .map(([word, docs2]) => ({ word, docs: docs2 }))
        .sort((a, b) => b.docs - a.docs || a.word.localeCompare(b.word, 'zh'))
        .slice(0, Math.max(1, limit));

    return { docCount, wordCount: appearances.size, rows };
}

/**
 * 会话级缓存
 *
 * 分词要几百毫秒，同一次会话里备份内容不会变，算一次就够。
 * sessionStorage 按 origin 隔离（file:// 下即按目录），每份备份独立；关掉标签页自动清。
 */
const CACHE_KEY = 'qze_word_cloud_v1';

function readCache(): WordCloudResult | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as WordCloudResult;
        if (parsed && Array.isArray(parsed.rows)) {
            return parsed;
        }
    } catch {
        /* 缓存不可用静默跳过 */
    }
    return null;
}

function writeCache(data: WordCloudResult): void {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        /* 写不进就算了（如隐私模式配额） */
    }
}

/** 读各模块正文，统计最常用的词（优先用会话缓存） */
export async function loadWordCloud(limit = 12): Promise<WordCloudResult> {
    if (!Segmenter) {
        return { docCount: 0, wordCount: 0, rows: [] };
    }
    const cached = readCache();
    if (cached) {
        return cached;
    }
    const docs: string[] = [];
    for (const key of WORD_MODULES) {
        let items: Record<string, any>[] = [];
        try {
            items = await loadItems(key);
        } catch {
            continue;
        }
        for (const item of items) {
            const body = bodyOf(key, item);
            if (body) {
                docs.push(body);
            }
        }
    }
    const data = countWords(docs, limit);
    writeCache(data);
    return data;
}
