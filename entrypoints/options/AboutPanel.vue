<script setup lang="ts">
import { NDivider } from 'naive-ui';

/**
 * 关于面板（由旧 src/html/about.html 迁移而来）
 * 旧页用 base64 内嵌的商店图标改为文字链接，其余内容（免责声明、安装/反馈渠道、
 * 交流群、赞赏码、公众号）保持一致。
 */

/** 安装渠道：仅官方与各商店，避免用户从第三方来源安装 */
const INSTALL_LINKS = [
    { label: 'GitHub', url: 'https://github.com/ShunCai/QZoneExport' },
    { label: 'Chrome 应用商店', url: 'https://chrome.google.com/webstore/detail/aofadimegphfgllgjblddapiaojbglhf' },
    { label: 'Edge 加载项', url: 'https://microsoftedge.microsoft.com/addons/detail/djfalpkpjgpkfnkfmnegbalnicdoljcn' },
    { label: '360 应用市场', url: 'https://ext.chrome.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh' },
    { label: 'Firefox 扩展商店', url: 'https://addons.mozilla.org/zh-CN/firefox/addon/qzone-export/' },
];

/** 反馈渠道 */
const FEEDBACK_LINKS = [
    { label: 'GitHub Issues', url: 'https://github.com/ShunCai/QZoneExport/issues/new' },
    { label: 'Chrome 商店评价', url: 'https://chrome.google.com/webstore/detail/qq%E7%A9%BA%E9%97%B4%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/aofadimegphfgllgjblddapiaojbglhf' },
    { label: 'Edge 加载项评价', url: 'https://microsoftedge.microsoft.com/addons/detail/djfalpkpjgpkfnkfmnegbalnicdoljcn' },
];

/** 赞赏码（本地图片，加载失败不影响功能） */
const REWARD_IMAGES = [
    { title: '微信', src: '/img/about/reward-wechat.png' },
    { title: '支付宝', src: '/img/about/reward-alipay.png' },
];
</script>

<template>
    <div>
        <div class="intro">
            <a href="https://github.com/ShunCai/QZoneExport" target="_blank" rel="noreferrer">
                <img class="logo" src="/img/icon.png" alt="QQ空间导出助手" title="助手官网" />
            </a>
            <div class="intro-text">
                <p>落叶随风，青春，稍纵即逝，QQ 空间，一个承载了很多人的青春的地方。</p>
                <p>本助手旨在为大家实现分享生活，留住青春，建议先完成左侧的助手配置后再使用 ^_^</p>
                <p class="danger">
                    本助手开源免费，且承诺不收集与贩卖任何个人信息，仅基于浏览器收集 QQ 空间数据到本地，
                    不传输数据到远程服务器！如使用助手导致封号等，本助手概不负责。
                </p>
                <p class="muted">
                    更多详情请查看
                    <a href="https://www.lvshuncai.com/archives/qzone-export-privacy-policy.html" target="_blank" rel="noreferrer">隐私政策</a>
                    与
                    <a href="https://www.lvshuncai.com/archives/qzone-export-issue.html" target="_blank" rel="noreferrer">常见问题</a>
                </p>
            </div>
        </div>

        <n-divider title-placement="left">项目地址</n-divider>
        <div class="row">
            <span class="row-label">官方地址</span>
            <a href="https://lvshuncai.com" target="_blank" rel="noreferrer">lvshuncai.com</a>
        </div>
        <div class="row">
            <span class="row-label">安装地址</span>
            <span class="links">
                <a v-for="item in INSTALL_LINKS" :key="item.url" :href="item.url" target="_blank" rel="noreferrer">
                    {{ item.label }}
                </a>
            </span>
        </div>
        <div class="row">
            <span class="row-label">问题反馈</span>
            <span class="links">
                <a v-for="item in FEEDBACK_LINKS" :key="item.url" :href="item.url" target="_blank" rel="noreferrer">
                    {{ item.label }}
                </a>
            </span>
        </div>
        <p class="hint block-hint">
            以上为助手的官方与商店地址，其它 Chromium 内核浏览器请下载离线包安装；
            <b>从任何第三方地址安装，后果自负</b>。
        </p>

        <n-divider title-placement="left">数据来源</n-divider>
        <p class="hint block-hint">
            足迹地图底图来自
            <a href="https://datav.aliyun.com/portal/school/atlas/area_selector" target="_blank" rel="noreferrer">阿里云 DataV.GeoAtlas</a>
            （数据源自高德开放平台，版本 2021.5），随备份离线内置（含南海诸岛要素），点地图省份可查看下级市。
            该数据文件不附审图号，页面声明「仅供学习交流使用」；
            <b>公开使用含地图的截图或衍生产品前</b>，请对照
            <a href="http://bzdt.ch.mnr.gov.cn/" target="_blank" rel="noreferrer">自然资源部标准地图服务</a>
            核对国界、台湾与南海诸岛等要素。
        </p>

        <n-divider title-placement="left">沟通交流</n-divider>
        <div class="images">
            <figure>
                <span class="qr-hover">
                    <img class="about-qr-thumb" src="/img/about/qq-group.png" alt="QQ交流群" title="QQ交流群" />
                    <img class="about-qr-full" src="/img/about/qq-group.png" alt="QQ交流群" title="QQ交流群" />
                </span>
                <figcaption>QQ 交流群：959828088</figcaption>
            </figure>
            <figure>
                <span class="qr-hover">
                    <img class="about-qr-thumb" src="/img/about/wechat-official.png" alt="公众号" title="芷炫博客" />
                    <img class="about-qr-full" src="/img/about/wechat-official.png" alt="公众号" title="芷炫博客" />
                </span>
                <figcaption>公众号「芷炫博客」</figcaption>
            </figure>
        </div>
        <p class="hint block-hint">
            QQ 群是问题的快速反应渠道，也可用于防丢失；
            <a
                href="https://qm.qq.com/cgi-bin/qm/qr?k=_yyc1JPJJGq_eUnz3vPQm1pHVMQMmpLG&jump_from=webapi"
                target="_blank"
                rel="noreferrer"
            >一键加群</a>。
            公众号未正式运营，可用于防丢失；不建议私信联系（处理不及时），有问题请走上方反馈渠道或 QQ 群。
        </p>

        <n-divider title-placement="left">赞赏支持</n-divider>
        <p class="hint block-hint">
            助手开源免费，<b>请勿从第三方购买及倒卖</b>，赞或不赞，助手就在这里 ^_^
        </p>
        <div class="images">
            <figure v-for="item in REWARD_IMAGES" :key="item.title">
                <span class="qr-hover">
                    <img class="about-qr-thumb" :src="item.src" :alt="item.title" :title="item.title" />
                    <img class="about-qr-full" :src="item.src" :alt="item.title" :title="item.title" />
                </span>
                <figcaption>{{ item.title }}赞赏码</figcaption>
            </figure>
        </div>
    </div>
</template>

<style scoped>
.intro {
    display: flex;
    gap: 18px;
    align-items: flex-start;
}
.logo {
    width: 96px;
    height: 96px;
}
.intro-text p {
    margin: 0 0 8px;
    line-height: 1.7;
}
.danger {
    color: #d03050;
}
.muted {
    color: #999;
}
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}
.row-label {
    display: inline-block;
    width: 84px;
    color: #666;
}
.links {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}
.images {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}
.images img {
    object-fit: contain;
}
.qr-hover { position: relative; display: inline-flex; }
.about-qr-thumb {
    width: 220px; height: 220px;
    border-radius: 6px; background: #fff; cursor: zoom-in;
}
.about-qr-full {
    position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: auto; height: auto; max-width: 90vw; max-height: 90vh; object-fit: contain;
    border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, .22);
    display: none; z-index: 99999; pointer-events: none;
}
.qr-hover:hover .about-qr-full { display: block; }
figure {
    margin: 0;
    text-align: center;
}
figcaption {
    margin-top: 6px;
    font-size: 12px;
    color: #999;
}
</style>
