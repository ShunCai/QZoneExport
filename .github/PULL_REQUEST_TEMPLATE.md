## 变更说明

<!-- 一句话说清楚改了什么、为什么改；不要只写「修复 bug」 -->

## 关联 issue

<!-- Closes #123 / 相关 #456；没有则写「无」 -->

## 变更类型

- [ ] Bug 修复
- [ ] 新功能 / 统计指标
- [ ] 重构 / 性能优化
- [ ] 样式与交互调整
- [ ] 文档 / 模板 / 发布流程
- [ ] 测试

## 影响范围

<!-- 勾选涉及的浏览器与模块，便于评审时针对性验证 -->
- [ ] 扩展：Chrome / Edge 等 Chromium 内核
- [ ] 扩展：Firefox
- [ ] 采集引擎（`core/collector`）
- [ ] 媒体下载（DiskFS / DiskDriver / Aria2 / downloads API / DNR）
- [ ] 备份进度面板（`entrypoints/backup-panel`）
- [ ] 离线查看器（`viewer/`）
- [ ] 构建 / 发布（`wxt.config.ts`、`package.json`、zip）

## 自检清单

**通用**
- [ ] `npm run compile` / `npx vue-tsc --noEmit -p viewer/tsconfig.json` 通过
- [ ] 相关单测通过（改动涉及的测试文件已跑，或新增了回归用例）
- [ ] 公开文档与实际行为一致（README / Wiki / release notes / Options 文案）
- [ ] 不含用户隐私数据与凭据（备份正文、QQ 号、cookie、token）

**仅涉及扩展时**
- [ ] `wxt.config.ts` 的 `permissions` 与代码实际调用的 API 一一对应，**无冗余声明**（商店审核会逐项核对）
- [ ] 媒体请求已走 `toHttps`，且**未使用** `credentials: 'include'`（与 DNR 的 CORS 规则冲突）
- [ ] 写入 `chrome.storage` 的 Vue 响应式对象已先 `toPlain`（Proxy 会破坏序列化）
- [ ] 断点续传 / 增量备份的数据在 `chrome.storage.local` 与 IndexedDB 两侧兼容
- [ ] 已分别验证 Chrome 与 Firefox 的直写落盘路径（Firefox 为 `下载目录/QQ空间备份_<uin>/`，无 ZIP）
- [ ] 未引入新依赖；如确需引入，已说明原因与许可证

**仅涉及发布产物时**
- [ ] 构建日志无 `ENOENT`（不要用 `| tail` 截断日志）
- [ ] `zip` 已逐文件核对：条目数、关键文件（background / content scripts / html / chunks / assets）存在且非 0、manifest 版本号正确

**仅涉及查看器时**
- [ ] `file://` 直接打开备份目录的 `index.html` 可用（不依赖开发服务器）
- [ ] 亮色 / 暗色主题与隐私模式均已检查
- [ ] 大数据量下列表不卡顿（分页 / 分块渲染未被破坏）

## 验证记录

<!-- 写实际跑过的命令与结果，例如：npx vitest run tests/xxx.test.ts → 13 passed；CDP 实测截图结论 -->
