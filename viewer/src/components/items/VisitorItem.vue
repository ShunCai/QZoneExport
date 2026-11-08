<script setup lang="ts">
import { NTag } from 'naive-ui';
import { computed } from 'vue';
import { formatClock, formatTime } from '../../data/format';
import { imageUrl, visitorTitle } from '../../data/content';
import { assetUrl } from '../../data/sources';
import { formatSummary } from '../../data/richText';
import { usePrivacy } from '../../composables/usePrivacy';
import { maskName, maskUin, plainName } from '../../data/mask';
import UserAvatar from '../UserAvatar.vue';
import UserLink from '../UserLink.vue';

/**
 * 单条访客记录（含他访问过的内容，以及"当天同访的其他访客"）
 * 抽出来供访客列表页与个人中心的那年今日共用。
 */
const props = defineProps<{ item: Record<string, any> }>();

const { hidden: hideSensitive } = usePrivacy();

/** 隐私态展示名：剥掉表情 token / HTML 后脱敏；没有昵称时退回打码 QQ，而不是露出原号 */
function maskedVisitorName(user: Record<string, any> | null | undefined): string {
    return maskName(plainName(String(user?.name ?? ''))) || maskUin(String(user?.uin ?? ''));
}

/** 同访卡片的悬浮提示：隐私态只露脱敏名，不露原始昵称 */
function mateTitle(mate: Record<string, any>): string {
    if (hideSensitive.value) return maskedVisitorName(mate);
    return mate.time ? ('访问于 ' + formatTime(mate.time)) : (formatSummary(mate.name) || mate.uin || '');
}

/**
 * 过滤后的"同访好友"（只保留有有效 uin 的对象，避免空对象/字符串等异常数据混入渲染）
 */
const validMates = computed(() => {
    const list: any[] = props.item.uins || [];
    return list.filter((m: any) => {
        if (!m || typeof m !== 'object') return false;
        if (m.uin) return true;
        return !!(m.name && String(m.name).trim());
    });
});
/**
 * 被访问内容的标题
 */
function nameHtml(entry: Record<string, any>): string {
    const name = entry.name || entry.title || entry.content || '';
    return formatSummary(name) || '（无标题）';
}

/** 被访问内容的缩略图 */
function thumbOf(entry: Record<string, any>): string {
    if (!entry.imgsrc && !entry.custom_filepath && !entry.custom_url) {
        return '';
    }
    return imageUrl(entry) || imageUrl({ url: entry.imgsrc });
}

/** 相册默认封面占位图（随备份导出到 Common/images，离线可用） */
const NO_COVER = assetUrl('Common/images/no_cover.gif');

/** 相册封面：无有效封面图时用默认占位图，避免破图 */
function albumCoverOf(photo: Record<string, any>): string {
    return thumbOf(photo) || NO_COVER;
}

/** 相册访问记录的链接：从 url 提取相册 ID（格式如 /photo/V10BRLFv4RE8VS） */
function albumHref(photo: Record<string, any>): string {
    const url = photo.url || '';
    const match = /\/photo\/([^/?#]+)/.exec(url);
    const base = match ? '#/albums?id=' + match[1] : '#/albums';
    return base + (base.includes('?') ? '&' : '?') + 'from=visitors';
}

/**
 * 访客访问记录的内容链接：统一跳本地查看器而非 QQ 空间
 * - 说说：跳说说列表页（没有详情页，无法精确定位）
 * - 日志：跳日志详情页（有 blogid）
 * - 分享：跳分享列表页
 */
function entryHref(entry: Record<string, any>, type: 'message' | 'blog' | 'share'): string {
    let href: string;
    switch (type) {
        case 'message': {
            const tid = entry.tid || entry.id;
            href = tid ? '#/messages?id=' + tid : '#/messages';
            break;
        }
        case 'blog': {
            const blogId = entry.blogid || entry.blogId || entry.id;
            if (blogId) { href = '#/blogs?id=' + blogId; break; }
            const url = entry.url || '';
            const match = /\/blog\/([^/?#]+)/.exec(url) || /blogid=([^&]+)/i.exec(url);
            href = match ? '#/blogs?id=' + match[1] : '#/blogs';
            break;
        }
        case 'share': {
            const shareId = entry.id || entry.shareId;
            href = shareId ? '#/shares?id=' + shareId : '#/shares';
            break;
        }
        default:
            href = '#';
    }
    return href + (href.includes('?') ? '&' : '?') + 'from=visitors';
}
</script>

<template>
    <div class="card-item">
        <div class="item-head">
            <user-avatar :uin="props.item.uin" :size="32" :class="{ 'privacy-blur': hideSensitive }" />
            <!-- 昵称同样可能带表情 token，需富文本渲染；隐私态改为纯文本脱敏 -->
            <user-link
                v-if="props.item.uin"
                class="item-name"
                :uin="props.item.uin"
            >
                <span v-if="hideSensitive">{{ maskedVisitorName(props.item) }}</span>
                <span v-else v-html="formatSummary(props.item.name) || props.item.uin"></span>
            </user-link>
            <span v-else class="item-name">
                <span v-if="hideSensitive">{{ maskedVisitorName(props.item) }}</span>
                <span v-else v-html="formatSummary(props.item.name)"></span>
            </span>
            <n-tag size="small" :bordered="false" type="info">{{ visitorTitle(props.item) }}</n-tag>
            <span class="item-time">{{ formatTime(props.item.time) }}</span>
        </div>

        <div v-if="props.item.shuoshuoes?.length" class="visited">
            <span class="visited-label">说说</span>
            <ul class="visited-list">
                <li v-for="(shuoshuo, idx) in props.item.shuoshuoes" :key="idx">
                    <a
                        :href="entryHref(shuoshuo, 'message')"
                        class="visited-link"
                        v-html="nameHtml(shuoshuo)"
                    ></a>
                    <img
                        v-if="thumbOf(shuoshuo)"
                        class="visited-thumb"
                        :src="thumbOf(shuoshuo)"
                        loading="lazy" decoding="async"
                    />
                </li>
            </ul>
        </div>

        <div v-if="props.item.blogs?.length" class="visited">
            <span class="visited-label">日志</span>
            <ul class="visited-list">
                <li v-for="(blog, idx) in props.item.blogs" :key="idx">
                    <a
                        :href="entryHref(blog, 'blog')"
                        class="visited-link"
                        v-html="nameHtml(blog)"
                    ></a>
                </li>
            </ul>
        </div>

        <div v-if="props.item.photoes?.length" class="visited">
            <span class="visited-label">相册</span>
            <div class="visited-cards">
                <a
                    v-for="(photo, idx) in props.item.photoes"
                    :key="idx"
                    class="visited-card"
                    :href="albumHref(photo)"
                >
                    <img :src="albumCoverOf(photo)" loading="lazy" decoding="async" />
                    <span class="visited-card-name" v-html="nameHtml(photo)"></span>
                </a>
            </div>
        </div>

        <div v-if="props.item.shares?.length" class="visited">
            <span class="visited-label">分享</span>
            <ul class="visited-list">
                <li v-for="(share, idx) in props.item.shares" :key="idx">
                    <a
                        :href="entryHref(share, 'share')"
                        class="visited-link"
                        v-html="nameHtml(share)"
                    ></a>
                    <img
                        v-if="thumbOf(share)"
                        class="visited-thumb"
                        :src="thumbOf(share)"
                        loading="lazy" decoding="async"
                    />
                </li>
            </ul>
        </div>

        <!-- 当天和当前访客一起访问了相同内容的其他访客（旧页 visitors.html L169-L190） -->
        <div v-if="validMates.length" class="visited same-day">
            <span class="visited-label">同访</span>
            <div class="same-day-body">
                <div class="same-day-tip">在同一天也访问了相同内容的访客：</div>
                <div class="visited-cards">
                    <user-link
                        v-for="(mate, idx) in validMates"
                        :key="idx"
                        class="visited-card"
                        :uin="mate.uin"
                        :title="mateTitle(mate)"
                    >
                        <user-avatar :uin="mate.uin" :size="48" :link="false" :class="{ 'privacy-blur': hideSensitive }" />
                        <span class="visited-card-name">
                            <span v-if="hideSensitive">{{ maskedVisitorName(mate) || '匿名用户' }}</span>
                            <span v-else v-html="formatSummary(mate.name) || mate.uin || '匿名用户'"></span>
                        </span>
                    <span class="visited-card-time">{{ formatClock(mate.time) }}</span>
                </user-link>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.item-head {
    display: flex;
    align-items: center;
    gap: 10px;
}
.item-name {
    color: #2080f0;
    font-weight: 600;
    text-decoration: none;
}
.item-time {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 12px;
}
.visited {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    font-size: 13px;
}
/* 内容类型标签固定宽度，多类型时左侧对齐好扫读 */
.visited-label {
    flex: none;
    width: 34px;
    padding-top: 2px;
    color: var(--text-muted);
    font-size: 12px;
}
.visited-list {
    flex: 1;
    margin: 0;
    padding: 0;
    list-style: none;
}
.visited-list li {
    padding: 2px 0;
    border-bottom: 1px dashed var(--border-separator);
}
.visited-list li:last-child {
    border-bottom: none;
}
.visited-link {
    color: var(--text-secondary);
    text-decoration: none;
}
.visited-link:hover {
    color: #2080f0;
}
.visited-thumb {
    display: block;
    width: 60px;
    height: 60px;
    margin-top: 4px;
    object-fit: cover;
    border: 1px solid var(--border-light);
    border-radius: 3px;
}
.visited-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.visited-card {
    width: 92px;
    padding: 6px;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    text-align: center;
    text-decoration: none;
    color: var(--text-secondary);
}
.visited-card:hover {
    border-color: #2080f0;
}
.visited-card img {
    width: 78px;
    height: 78px;
    object-fit: cover;
    border-radius: 3px;
}
.visited-card-name {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.visited-card-time {
    display: block;
    color: var(--text-subtle);
    font-size: 11px;
}
.same-day-body {
    flex: 1;
}
.same-day-tip {
    margin-bottom: 6px;
    color: var(--text-muted);
    font-size: 12px;
}
</style>
