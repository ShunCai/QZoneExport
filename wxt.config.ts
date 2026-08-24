import { defineConfig } from 'wxt';

/**
 * v3 全面 TS 化（Phase 8+）：
 * - 采集引擎：core/collector/modules/* (TS) — 10 个模块全部重写
 * - 下载管理：core/downloader/manager.ts (TS) — 替代旧 download-manager.js
 * - 备份编排：entrypoints/engine-bridge.content.ts (TS) — 替代旧 content.js
 * - 进度面板：entrypoints/backup-panel.content.ts (TS, Shadow DOM)
 * - 旧 JS 全局 polyfill (utils.js/config.js) 已移除，日期格式化改用 core/shared/format.ts
 * - vendor: aria2.js (纯 JSON-RPC 客户端，无 Chrome 专有依赖)
 */
export default defineConfig({
    srcDir: '.',
    entrypointsDir: 'entrypoints',
    publicDir: 'public',
    outDir: '.output',
    // 输出子目录名：固定项目名前缀并保留 {{browser}}/{{manifestVersion}} 占位，
    // 使 chrome / firefox 分别产出到不同目录，避免互相同目录覆盖。
    // （WXT 0.21 每次构建只针对单个浏览器，由 -b 选定，无法一次出双产物；
    //  双产物需分别执行 build / build:firefox。）
    outDirTemplate: 'QZoneExport-{{browser}}-mv{{manifestVersion}}',
    modules: ['@wxt-dev/module-vue'],
    manifest: (env) => ({
        name: 'QQ空间导出助手',
        description:
            '把 QQ 空间的说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客一键导出为本地文件，离线查看器随时回顾，便于迁移与永久保存',
        homepage_url: 'https://github.com/ShunCai/QZoneExport',
        // Firefox 固定 ID（AMO 签名/自托管必需）；Chrome 忽略此键。
        browser_specific_settings: {
            gecko: {
                id: 'qzone-export-firefox@lvshuncai.com',
                // AMO 自 2025-11-03 起强制要求新扩展声明数据收集/传输类型。
                // 本工具备份数据全部本地落盘（仅读取用户自己的 QQ 空间 + 写本地文件 / storage.local），
                // 不向任何第三方服务器上报，故声明 required: ["none"]（互斥，不能与其他类型并存）。
                data_collection_permissions: {
                    required: ['none'],
                },
            },
        },
        icons: {
            128: 'img/icon.png',
        },
        action: {
            default_icon: 'img/icon.png',
            default_title: 'QQ空间导出助手',
            default_popup: 'popup.html',
        },
        // 注意：options_ui / default_popup 等由对应入口自动生成并覆盖此处，
        // 若需调整（如 open_in_tab），请改入口 HTML 的 <meta name="manifest.*">
        content_scripts: [
            {
                matches: ['https://*.qzone.qq.com/*'],
                js: [
                    'vendor/aria2/aria2.js',
                ],
            },
        ],
        web_accessible_resources: [
            {
                // viewer/* 为备份查看器产物，备份时由内容脚本读取并写入备份目录，
                // 故必须对 qzone 页面可访问
                resources: ['vendor/*', 'viewer/*', 'img/*', 'remote-config.json'],
                matches: ['https://*.qzone.qq.com/*'],
            },
        ],
        permissions: [
            'activeTab',
            'alarms',
            'notifications',
            'storage',
            'unlimitedStorage',
            'downloads',
            'clipboardWrite',
            // contextMenus 仅 Firefox 需要：Chrome 的 action 右键菜单在配了 options_ui 后自带「选项」入口，
            // 无需自定义；Firefox 默认没有，故在 background.ts 里用 FIREFOX 分支自建「打开配置页面」菜单项。
            // 该权限与代码路径均仅 Firefox 生效，故从 Chrome/Edge 等非 Firefox 构建中剥离，避免触发商店权限理由审查。
            ...(env.browser === 'firefox' ? ['contextMenus'] : []),
            'declarativeNetRequest',
        ],
        host_permissions: ['<all_urls>'],
    }),
});
