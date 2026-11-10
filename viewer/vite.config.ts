import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 拷贝地图依赖到产物的 vendor/
 *
 * 足迹地图用 ECharts + 现成的地图数据（旧统计页用的同一份）。这些文件不进主 bundle：
 * 1. 一共约 2MB，而大多数人不会打开足迹页，应该用到才加载；
 * 2. file:// 下不能用动态 import()，只能临时插入 \u003cscript\u003e 加载，因此必须是独立文件；
 * 3. 地图数据是 UMD 包，依赖全局 echarts（故 echarts 用 dist 的 UMD 版而非 npm 入口）。
 */
function copyMapVendor(): Plugin {
    // 统一产物布局：查看器资源一律落在 Common/ 下。
    // 备份目录（index.html 在根）与扩展包内 viewer/ 都按 ./Common/... 引用，
    // 不再需要运行时双路径回退，也不会在备份目录根多出 vendor/、images/ 副本。
    const files: [string, string][] = [
        ['../node_modules/echarts/dist/echarts.min.js', 'Common/vendor/echarts.min.js'],
        ['../viewer/map-vendor/coordtransform.min.js', 'Common/vendor/coordtransform.min.js'],
        ['../viewer/map-vendor/maps/config.js', 'Common/vendor/maps/config.js'],
        ['../viewer/map-vendor/maps/world.js', 'Common/vendor/maps/world.js'],
        ['../viewer/map-vendor/maps/china.js', 'Common/vendor/maps/china.js'],
        ['../viewer/map-vendor/images/favicon.ico', 'Common/images/favicon.ico'],
        ['../viewer/map-vendor/images/media_missing.png', 'Common/images/media_missing.png'],
        ['../viewer/map-vendor/images/no_cover.gif', 'Common/images/no_cover.gif'],
    ];
    return {
        name: 'viewer-copy-map-vendor',
        apply: 'build',
        // 构建前仅清理上一次的 Vite 产物（不能用 emptyOutDir，否则会删除同目录下的旧版页面资源）
        buildStart() {
            const out = fileURLToPath(new URL('../public/viewer', import.meta.url));
            // 清理上一次产物（含旧版落在根目录的 index.js/index.css，避免与新布局 Common/js、Common/css 并存）
            for (const f of ['index.html', 'index.js', 'index.css', 'Common/js/index.js', 'Common/css/index.css']) {
                try { rmSync(join(out, f)); } catch { /* 不存在则忽略 */ }
            }
            // 清掉旧布局遗留的根级 vendor/、images/（都是本次构建可再生的静态资源）
            for (const d of ['vendor', 'images']) {
                try { rmSync(join(out, d), { recursive: true }); } catch { /* 不存在则忽略 */ }
            }
        },
        // 写完产物再拷，避开 emptyOutDir 清理
        closeBundle() {
            const outDir = fileURLToPath(new URL('../public/viewer/', import.meta.url));
            for (const [from, to] of files) {
                const target = outDir + to;
                mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
                copyFileSync(fileURLToPath(new URL(from, import.meta.url)), target);
            }
        },
    };
}

/**
 * 让产物能被 file:// 直接打开
 *
 * Vite 默认注入 `<script type="module" crossorigin>` 与带 crossorigin 的样式表，
 * 而 file:// 页面的源是 null：模块脚本与带 crossorigin 的资源都会被 CORS 拦截，
 * 双击打开即白屏。故构建成传统 IIFE 脚本，并去掉 type="module" 与 crossorigin。
 *
 * 【重要】仅 production 构建时启用（apply: 'build'），否则 dev 模式下 <script type="module" src="/src/main.ts">
 * 会被错误替换为 <script defer ...>，导致 main.ts 内的 import 语句无法解析，整个页面完全空白不渲染。
 */
function fileProtocolHtml(): Plugin {
    return {
        name: 'viewer-file-protocol-html',
        apply: 'build',
        enforce: 'post',
        transformIndexHtml(html) {
            return html
                .replace(/\s+type="module"/g, ' defer')
                .replace(/\s+crossorigin/g, '');
        },
    };
}

/**
 * 备份查看器（P5）构建配置
 *
 * 产物写入 public/viewer/，由 WXT 的 publicDir（public）原样打进扩展，备份时再拷进备份包的
 * viewer/ 目录。因此有两条硬约束：
 * 1. base 必须为相对路径：备份包是 file:// 打开的，绝对路径会指向磁盘根目录；
 * 2. 产物文件名固定不带 hash：备份时按固定清单拷贝文件（public/js/config.js 的 ExportFiles），
 *    带 hash 的名字每次构建都变，清单无法写死。
 *
 * 另：查看器必须完全离线可用，故不允许任何 CDN 外链，静态资源一律内联或随产物拷贝。
 */
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [vue(), fileProtocolHtml(), copyMapVendor()],
    build: {
        outDir: fileURLToPath(new URL('../public/viewer', import.meta.url)),
        emptyOutDir: false,
        // 小资源内联进 JS/CSS，减少需要拷贝的文件数（图标已全部用内联 SVG）
        assetsInlineLimit: 1024 * 512,
        // 模块预加载会注入 <link rel="modulepreload">，file:// 下无意义且带 crossorigin
        modulePreload: false,
        // 显式把样式输出为单个 Common/css/index.css：否则样式会被内联进 JS，
        // 而备份时的拷贝清单（site.ts 的 VIEWER_FILES）是写死的，产物文件必须确定
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                // IIFE：file:// 下不能用模块脚本（见上方插件说明）
                format: 'iife',
                // 脚本与样式归入 Common/js、Common/css，与数据/依赖同一命名空间；首页按 ./Common/js|css 引用
                entryFileNames: 'Common/js/index.js',
                assetFileNames: 'Common/css/index.[ext]',
                inlineDynamicImports: true,
            },
        },
    },
});
