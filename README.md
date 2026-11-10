# QQ空间导出助手（QZoneExport）

一键把 QQ 空间的说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客等数据备份为本地文件的浏览器扩展，内置**离线查看器**可直接浏览与分析。

> 当前版本 **v3.1**。支持 **Chrome / Edge 等 Chromium 内核浏览器**与 **Firefox**（Manifest V3）。

---

## ✨ 特性

- **全类型备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 好友 / 收藏 / 分享 / 访客，含评论、点赞、最近访问等关联数据。
- **离线查看器**：备份直接本地打开，含全新概览（统计卡 / 最常用的词与表情 / 常驻地点 / 断档时期）、互动关系分析、足迹地图、图片 / 视频大图画廊，以及双尺寸分享卡。
- **全局搜索**：跨模块搜索正文与评论，命中词高亮，可直达详情并定位到具体评论、相片或视频。
- **隐私模式**：昵称、QQ 号、头像与各列表内容一键部分打码，分享截图更安心。
- **多种媒体下载方式**：助手直写目录 / 浏览器下载器 / Aria2，支持并发控制与失败重试。
- **增量备份与断点续传**：跳过已备份数据、中断后可继续，适合超大空间。
- **离线也完整**：QQ 表情图片与头像一并本地化下载，不依赖在线服务器。
- **后台保活**：备份时无需守在空间页面。

---

## 🚀 快速开始

### 安装

| 渠道 | 地址 |
| --- | --- |
| Chrome 应用商店 | <https://chrome.google.com/webstore/detail/aofadimegphfgllgjblddapiaojbglhf> |
| Edge 加载项 | <https://microsoftedge.microsoft.com/addons/detail/djfalpkpjgpkfnkfmnegbalnicdoljcn> |
| 360 应用市场 | <https://ext.chrome.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh> |
| Firefox 扩展商店 | <https://addons.mozilla.org/zh-CN/firefox/addon/qzone-export/> |
| Releases（离线包） | <https://github.com/ShunCai/QZoneExport/releases> |

Firefox 现已正式支持（Manifest V3），可从 [Firefox 扩展商店（AMO）](https://addons.mozilla.org/zh-CN/firefox/addon/qzone-export/) 在线安装，或用发布页的构建产物在 `about:debugging` 中「临时加载附加组件」安装。

### 三步开始备份

1. 用支持的浏览器打开并登录 [QQ空间](https://qzone.qq.com/)（备份他人空间则打开对方主页）。
2. 在弹出的备份窗口中勾选要备份的模块，点击「开始备份」（首次按提示选择保存目录）。
3. 等待进度面板完成，打开保存目录里的 `index.html` 即可离线浏览。

> 详细配置与使用帮助见项目 [Wiki](https://github.com/ShunCai/QZoneExport/wiki)；版本说明与离线包见 GitHub [Releases](https://github.com/ShunCai/QZoneExport/releases)。

---

## 🧭 浏览器兼容性

| 维度 | Chrome / Edge（Chromium 内核） | Firefox |
| --- | --- | --- |
| 文案 / 查看器落盘 | File System Access 直写**你选择的目录** | `downloads.download` 直写**浏览器下载目录 / QQ空间备份_\<uin\>/** |
| 媒体下载方式选项 | 助手直写目录 / 浏览器下载器 / Aria2 | 浏览器下载器 / Aria2（无「助手直写目录」） |
| 默认媒体下载方式 | 助手直写目录 | 浏览器下载器 |
| 打包 ZIP | 已移除 | 已移除（文案 / 查看器直接落盘） |

> 文案落盘路径与「媒体下载方式」相互独立：
> - **Chrome / Edge**：文案始终写入你选择的目录。媒体落点由下载方式决定——「助手直写目录」落所选目录（文案与媒体同目录、一步到位）；「浏览器下载器」落浏览器下载目录；「Aria2」落 Aria2 配置目录。后两者媒体在外部目录，**需自行合并回备份目录**。
> - **Firefox**：文案恒写「下载目录 / QQ空间备份_\<uin\>/」。「浏览器下载器」下媒体与文案同根、免合并；「Aria2」下媒体在 Aria2 目录、仍需合并。

---

## 📖 用户文档

- 使用帮助 / 配置说明 / 常见问题 / 隐私政策：项目 [Wiki](https://github.com/ShunCai/QZoneExport/wiki)
- 足迹地图底图：阿里云 [DataV.GeoAtlas](https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json) 中国行政区划数据，随查看器离线内置（含南海诸岛要素）
- 版本说明与离线包：GitHub [Releases](https://github.com/ShunCai/QZoneExport/releases)

---

## 🛠 开发

面向开发者的环境、构建与测试说明。

### 环境要求

- Node.js ≥ 22（WXT 所需）
- 包管理器：npm（项目使用 `package-lock.json`）

### 安装与常用命令

```bash
npm install   # postinstall 会自动执行 wxt prepare
```

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 WXT 开发模式（热重载） |
| `npm run build` | 构建 Chrome 生产包（输出 `.output/QZoneExport-chrome-mv3`） |
| `npm run build:firefox` | 构建 Firefox 生产包（输出 `.output/QZoneExport-firefox-mv3`） |
| `npm run zip` / `npm run zip:firefox` | 构建并打包对应浏览器为可发布 zip |
| `npm run sign:firefox` | 对 Firefox 构建产物调 AMO 自签名（`web-ext sign`，需本地 AMO 凭据；仅**自建分发**用，**上架商店不需此步**） |
| `npm run build:viewer` | 仅构建查看器（输出到 `public/viewer/`） |
| `npm run dev:viewer` | 单独启动查看器开发服务器（需先生成 mock 数据） |
| `npm run compile` / `compile:viewer` | TS / 查看器类型检查 |
| `npm run test` | Vitest 单元测试 |
| `npm run lint` / `format` | ESLint / Prettier |

### 本地加载扩展

1. 执行 `npm run build`（Chrome）或 `npm run build:firefox`（Firefox）。
2. Chrome：`chrome://extensions` 开启「开发者模式」→「加载已解压的扩展程序」，选 `.output/QZoneExport-chrome-mv3`。
3. Firefox：`about:debugging` →「临时加载附加组件」，选 `.output/QZoneExport-firefox-mv3`。

### 技术栈

| 领域 | 技术 |
| --- | --- |
| 扩展框架 | [WXT](https://wxt.dev/) 0.21（MV3，TypeScript SDK 化构建） |
| 语言 | TypeScript 6（严格模式） |
| 前端 UI | Vue 3 + Naive UI + Pinia（popup / options / 查看器） |
| 备份进度面板 | 纯 TypeScript + Shadow DOM（`entrypoints/backup-panel`，非 Vue） |
| 查看器 | ECharts + PhotoSwipe |
| 存储 | `idb`（IndexedDB）+ `chrome.storage`（登录态走内容脚本，已移除 `cookies` 权限） |
| 测试 / 代码质量 | Vitest 4 + ESLint 10 + Prettier |

### 目录结构

```
QZoneExport/
├── core/            # 核心 TS 逻辑（采集 / 下载 / 导出 / 存储 / 通用工具，可单测）
├── entrypoints/     # WXT 入口（background / 内容脚本 / 进度面板 / popup / options / welcome）
├── viewer/          # 备份查看器（Vue3，独立 Vite 构建，产物打入扩展）
├── public/          # 静态资源（含 viewer 构建产物）
├── scripts/ shell/  # 辅助脚本
├── tests/           # Vitest 单元测试
├── wxt.config.ts    # WXT 构建与 manifest 配置
└── tsconfig.json
```

---

## 📄 许可与免责

**许可证**：Apache-2.0。仅供个人学习研究与数据备份之用。

**免责声明**：本项目为开源的个人学习研究工具，开源免费。请仅从官方商店、GitHub Releases 等官方渠道安装，不要从任何第三方地址购买或安装第三方打包版本。使用本项目导出个人信息（含你拥有访问权限的他人空间数据）时，请遵守相关法律法规：导出内容仅限你有权访问的部分，不得对他人隐私数据进行传播或滥用；因不正当使用导致的侵权或信息泄露，由使用者自行承担。使用第三方工具（如 Aria2）下载文件造成的风险亦由使用者自行承担。