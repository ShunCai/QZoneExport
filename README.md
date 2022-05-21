# QQ空间导出助手

> QQ空间导出助手，用于备份QQ空间的说说、日志、私密日记、相册、视频、留言板、QQ好友、收藏夹、分享、访客为文件，便于迁移与保存。

## 简介

落叶随风，青春，稍纵即逝，QQ空间，一个承载了很多人的青春的地方。

或许，是遗憾，毕竟，谁的青春没留遗憾呢，[《曾经沧海无限感慨，唯愿往事随风》](https://user.qzone.qq.com/20050606/blog/1559786793)。
[![我是往事随风。你好，我是轻舞飞扬。](https://s1.ax1x.com/2020/05/16/YcekPP.gif)](https://v.qq.com/x/page/f08719wqfd0.html)

或许，是害怕，曾经的青春变得不可控，毕竟，新浪博客相册、网易相册、腾讯微博等相继停运，无不意味着，互联网产品都有着自己的生命周期。

于是，萌生了备份QQ空间的念头，也在互联网上找到一些工具与脚本，要么操作复杂、要么备份类型单一，于是乎，简单易用全类型备份的QQ空间导出助手诞生了。

# 功能清单
1. 支持备份QQ空间文字说说、图文说说、语音说说、长说说，以及评论、点赞、最近访问
2. 支持备份QQ空间文字日志、图文日志、模板日志，以及评论、点赞、最近访问
3. 支持备份QQ空间文字私密日记、图文私密日记，以及评论、点赞、最近访问
4. 支持备份QQ空间相册/相片，以及相册/相片的评论、相册/相片的点赞、相册的最近访问
5. 支持备份QQ空间视频，以及评论、点赞、最近访问
6. 支持备份QQ空间留言板寄语与留言、以及留言回复
7. 支持备份QQ好友、含好友成立时间、单向好友检测、空间访问权限检测、特别关心的好友等
8. 支持备份QQ空间分享内容，以及评论、点赞、最近访问
9. 支持备份QQ空间收藏夹内容
10. 支持备份QQ空间访客，仅支持备份谁访问了我，非全部备份，备份内容的多少，看是不是黄钻

# 视频教程
去[bilibili查看](https://www.bilibili.com/video/BV16r4y1x7hP?zw)
> 非原创，来源于助手用户[阿博特-安稳](https://space.bilibili.com/36411485)投稿

## 安装
#### 在线安装
- [Chrome浏览器](https://chrome.google.com/webstore/detail/aofadimegphfgllgjblddapiaojbglhf)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/djfalpkpjgpkfnkfmnegbalnicdoljcn)
- [360极速浏览器](https://ext.chrome.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh)
- [360安全浏览器](https://ext.se.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh)
- 其他[Chromium内核浏览器](https://baidu.lvshuncai.com/?q=Q2hyb21pdW3lhoXmoLjmtY/op4jlmag=)请移步->[离线安装](#离线安装)。

#### 离线安装
1. [下载助手源码Zip包](https://github.com/ShunCai/QZoneExport/releases/latest)
2. 解压源码Zip包
3. 打开**浏览器扩展管理**
4. 打开**开发者模式**
5. 点击**加载已解压的扩展程序**按钮
6. 选择源码包(ZIP)的解压文件夹
7. 安装完成
8. 更多问题点击[这里](https://baidu.lvshuncai.com/?q=Q2hyb21lIOWuieijhSDnprvnur/lronoo4Ug5omp5bGVIENSWA==)

#### 版本要求
- Chromium内核版本70以上
- 理论上基于Chromium内核版本的浏览器均可正常使用
   - [Edge浏览器](https://www.microsoft.com/zh-cn/edge)
   - [Chrome浏览器](https://www.google.cn/chrome/)
   - [360极速浏览器](http://browser.360.cn/ee)
   - [360安全浏览器](https://browser.360.cn/)
- [点击这里查看当前浏览器内核版本](https://liulanmi.com/labs/core.html)

## 使用说明
1. 如若首次使用，**建议先使用小号进行备份**，熟悉流程后，再使用大号进行备份，避免浪费不必要的时间。
2. 先进行助手安装，更多详情请移步[在线安装](#在线安装)或[离线安装](#离线安装)
3. 安装完成后，**可以先根据**个人情况进行助手的配置，更多详情请移步[配置说明](#配置说明)
4. 接下来，请先**登录QQ空间**，**登录QQ空间**，**登录QQ空间**
5. 然后，**进入需要备份的QQ空间**、**进入需要备份的QQ空间**、**进入需要备份的QQ空间**，若只备份自己的QQ空间，该步骤*可跳过*

   > 拜托，别再问我怎么备份QQ好友的空间内容了
6. 备份前，**刷新备份的QQ空间页面**使助手的配置**生效**，如果是保存配置后再打开的QQ空间页面，该步骤*可跳过*
7. 在需要备份的QQ空间页面，插件栏点击插件图标进行备份，如果点击图标无反映请移步[这里](#点击助手图标无反应)
   [![75EXvj.png](https://s4.ax1x.com/2022/01/23/75EXvj.png)](https://imgtu.com/i/75EXvj)
8. 选择要备份的QQ空间内容，建议全部备份，点击**开始备份**
   [![7TIqG8.png](https://s4.ax1x.com/2022/01/24/7TIqG8.png)](https://imgtu.com/i/7TIqG8)
9. 助手将开始收集QQ空间的数据，**请耐心等待数据收集完成**
   [![75eUC8.png](https://s4.ax1x.com/2022/01/23/75eUC8.png)](https://imgtu.com/i/75eUC8)
10. QQ空间数据采集完成后，助手自行添加[多媒体文件](#多媒体文件)的下载任务到[文件下载工具](#文件下载工具)
   [![75mZrj.png](https://s4.ax1x.com/2022/01/23/75mZrj.png)](https://imgtu.com/i/75mZrj)
11. **如若不涉及文案内容的下载，助手的备份任务到此已完成**，剩下的请耐心等待[文件下载工具](#文件下载工具)把[多媒体文件](#多媒体文件)的下载任务完成，然后[查看备份内容](#查看备份内容)即可，更多内容移步[打包下载](#打包下载)
12. **如若涉及文案内容的下载**，[文件下载工具](#文件下载工具)的下载任务添加完成后，备份界面下方将出现**打包下载**按钮，更多内容移步[打包下载](#打包下载)
      [![75mbes.png](https://s4.ax1x.com/2022/01/23/75mbes.png)](https://imgtu.com/i/75mbes)
11. 点击**打包下载**按钮时，助手自动打包[文案内容](#文案内容)到[备份压缩包](#备份压缩包)并下载
      [![75nAFx.png](https://s4.ax1x.com/2022/01/23/75nAFx.png)](https://imgtu.com/i/75nAFx)
12. [备份压缩包](#备份压缩包)下载完成后，点击**查看备份**按钮查看[备份压缩包](#备份压缩包)，点击**查看备份**按钮无法查看时，可自行打开[文案内容下载文件夹](#文案内容下载文件夹)查看
      [![75neSO.png](https://s4.ax1x.com/2022/01/23/75neSO.png)](https://imgtu.com/i/75neSO)
13. 解压压缩包，建议解压时，选择解压到当前文件夹，而不是解压到**QQ空间备份_QQ号**，这样的话，当文件下载工具为浏览器下载时，则无需进行额外的[备份文件夹合并](#备份文件夹合并)，解压的动作就是合并的过程。
14. 再进行[文案内容备份文件夹](#文案内容备份文件夹)与[多媒体文件备份文件夹](#多媒体文件备份文件夹)的合并，详情移步[备份文件夹合并](#备份文件夹合并)
15. 合并完成后，根据备份类型的不同，自行[查看备份内容](#查看备份内容)
      [![7T4kxH.png](https://s4.ax1x.com/2022/01/24/7T4kxH.png)](https://imgtu.com/i/7T4kxH)
16. 完整备份文件夹结构，如果结构不对，表示合并错误，比如会导致备份内容无法查看配图
   ``` folder QQ空间备份_QQ号
   ├─Albums         // 相册模块文件夹
   │  ├─Images      // 主要放相册的预览图，来源于[多媒体文件备份文件夹]
   │  ├─js          // 助手展示内容专用，来源于[文案内容备份文件夹]
   │  ├─json        // 助手展示内容专用，来源于[文案内容备份文件夹]
   │  └─其它        // 相册分类文件夹，来源于[多媒体文件备份文件夹]
   │      ├─相册A   // 相册文件夹，相册的相片就放这里面，来源于[多媒体文件备份文件夹]
   ├─Blogs      // 日志模块文件夹
   │  ├─Images  // 配图，来源于[多媒体文件备份文件夹]
   │  ├─js      // 助手展示内容专用，来源于[文案内容备份文件夹]
   │  └─json    // 助手展示内容专用，来源于[文案内容备份文件夹]
   ├─Boards     // 留言模块文件夹，子文件夹可参考日志模块文件夹       
   ├─Common     // 助手专用
   │  ├─css     // 助手展示内容专用，来源于[文案内容备份文件夹]
   │  ├─Images  // 其它配图，来源于[多媒体文件备份文件夹]
   │  ├─js      // 助手展示内容专用，来源于[文案内容备份文件夹]
   │  └─json    // 助手展示内容专用，来源于[文案内容备份文件夹]
   ├─Diaries    // 私密日记模块文件夹，子文夹件可参考日志模块文件夹
   ├─Favorites  // 收藏夹模块文件夹，子文件夹可参考日志模块文件夹
   ├─Friends    // QQ好友模块文件夹，子文件夹可参考日志模块文件夹
   ├─Messages   // 说说模块文件夹，子文件夹可参考日志模块文件夹
   ├─Shares     // 分享模块文件夹，子文件夹可参考日志模块文件夹
   ├─Videos     // 视频模块文件夹，子文件夹可参考日志模块文件夹与相册模块文件夹
   └─Visitors   // 访客模块文件夹，子文件夹可参考日志模块文件夹
   ```
15. 最后，你可以把[完整备份文件夹](#完整备份文件夹)复制或移动到其它地方进行再次备份、比如说U盘、网盘、或者电脑的其它位置、甚至部署到服务器，比如[备份预览](#备份预览)就是基于备份内容部署到服务器的
16. [更多说明点击这里](https://lvshuncai.com/archives/qzone-export.html)

## 常见问题   
是否可以破解加密空间，加密相册等等
- 不会，有会的，麻烦私聊我，准备膜拜大佬。
--- 
是否会导致QQ空间账号被冻结
- 一般情况下不会，但如果助手采集速度过快时，偶尔会造成QQ空间短暂的冻结，如造成相册访问空白等。
- 过段时间会自动解冻，如若介意，请勿使用，否则，后果自负。
- 如遇冻结，建议上调相应模块的数据采集时间
---
是否会导致QQ空间账号被封号
- 理论上不会，但不承诺一定不会封号
- 至少目前为止，本人没有遭遇封号
- 曾有用户反馈遭遇封号，如若介意，请勿使用，否则，后果自负。
---
是否会导致个人隐私的泄露
- 助手承诺不泄露个人隐私，第三方修改版除外
- 如因个人原因导致备份文件丢失与泄露，本助手概不负责。
- 更多详情请访问[隐私政策](https://github.com/ShunCai/QZoneExport/wiki/Privacy-Policy)

助手是否安全，是否会泄露个人隐私
- 安全，如果开源都不安全，那我也不知道怎么才算安全了
- 官方版保证安全，第三方修改版除外。
- 更多详情请访问[隐私政策](https://github.com/ShunCai/QZoneExport/wiki/Privacy-Policy)

> 更多问题请访问：[常见问题](https://lvshuncai.com/archives/qzone-export.html#常见问题)

## 配置说明
1. 浏览器插件栏右键助手图标，选择【选项】菜单后，将进入助手配置页   
[![75Fc4g.png](https://s4.ax1x.com/2022/01/23/75Fc4g.png)](https://imgtu.com/i/75Fc4g)
3. 【注意事项】：助手更新配置后，需要点击下方配置页的保存按钮
4. 【注意事项】：保存后，需要刷新QQ空间页面才能使最新的配置在备份页面生效。
5. 更多配置说明请访问：[配置说明](https://lvshuncai.com/archives/qzone-export.html#配置说明)


## 预览
[在线预览](https://demo.lvshuncai.com/qzone-export/index.html)

## 依赖
- [Blob.js](https://note.youdao.com/)
- [Bootstrap](https://github.com/twbs/bootstrap)
- [Filer](https://github.com/filerjs/filer)
- [FileSaver.js](https://github.com/eligrey/FileSaver.js)
- [JQuery](https://github.com/jquery/jquery)
- [Jszip](https://raw.github.com/Stuk/jszip)
- [Lodash](https://github.com/lodash/lodash)
- Ponyfill
- Popper
- [Sheetjs](https://github.com/sheetjs/sheetjs)
- [Template.js](https://github.com/yanhaijing/template.js)
- [Thunder-link.js](https://open.thunderurl.com/)
- [Turndown](https://github.com/domchristie/turndown)
- [lightGallery](https://github.com/sachinchoolur/lightGallery)

## 喝杯饮料
![赞赏码-微信](https://s1.ax1x.com/2020/05/16/YcePUI.png)
![付款码-QQ](https://s1.ax1x.com/2020/05/16/Ycei5t.png)
![付款码-支付宝](https://s1.ax1x.com/2020/05/16/YceCVA.png)

## 交流群
QQ群：959828088

## 注意
- 本项目只做个人学习研究之用
- 本助手开源免费，请勿倒卖或从第三方购买
- 本助手基于[QQ空间官方网站](https://qzone.qq.com/index.html)备份个人空间数据
- 使用本助手即同意助手收集QQ空间网站的Cookie信息，用于获取QQ空间数据。
- 本助手仅使用Cookie获取QQ空间数据，不传输任何数据到后台服务器，仅保存到浏览器客户端
- 更多请查看[隐私政策](https://github.com/ShunCai/QZoneExport/wiki/Privacy-Policy)
