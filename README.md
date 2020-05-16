# QQ空间导出助手

> QQ空间导出助手，用于备份QQ空间的说说、日志、私密日记、相册、视频、留言板、QQ好友、收藏夹为文件，便于迁移与保存。

## 简介

落叶随风，青春，稍纵即逝，QQ空间，一个承载了很多人的青春的地方。

然而，新浪博客相册宣布停止运营，网易相册关闭，QQ账号支持注销等等，无不意味着，互联网产品都有着自己的生命周期，但生命周期到了尽头，记录着我们的青春的数据怎么办？

数据，还是掌握到自己手里的好，QQ空间导出助手，可以导出备份QQ空间的日志、私密日志、说说、相册、留言板、QQ好友、视频、收藏夹为文件，便于永久保存与迁移。

## 前言
作为一个QQ空间曾经的重度用户，QQ空间是一个承载了我整个青春的地方，在看到QQ空间官方文章[《曾经沧海无限感慨，唯愿往事随风》](https://user.qzone.qq.com/20050606/blog/1559786793)之后，萌生了备份QQ空间的念头，在互联网的巨浪上逛了一遍后，找到了一些工具，要么收费，要么操作复杂（如Python版），要么备份类型单一、再加上想研究下Chrome扩展开发、于是乎，免费、简单、全类型备份的Chrome扩展【QQ空间导出助手】诞生了。

[![我是往事随风。你好，我是轻舞飞扬。](https://s1.ax1x.com/2020/05/16/YcekPP.gif)](https://v.qq.com/x/page/f08719wqfd0.html)

## 安装
#### 在线安装
- [Chrome浏览器](https://chrome.google.com/webstore/detail/aofadimegphfgllgjblddapiaojbglhf)

- [360极速浏览器](https://ext.chrome.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh)

- [360安全浏览器](https://ext.se.360.cn/webstore/detail/dboplopmhoafmbcbmcecapkmcodhcegh)

- 其他Chromium内核浏览器请移步->[离线安装](#离线安装)。

#### 离线安装
- [下载ZIP包](https://github.com/ShunCai/QZoneExport/releases/latest)
- 解压ZIP包
- 打开[扩展中心](chrome://extensions)
- 勾选开发者模式
- 点击[加载已解压的扩展程序]按钮
- 选择ZIP包解压文件夹

## 使用
- 登录QQ空间  
- 插件栏点击插件图标  
- 勾选备份内容  
- 点击【开始备份】
- 等待备份完成  
- 点击【打包下载】  
- 等待下载完成  
- 推荐使用 [Typora](https://www.typora.io/)或 [Atom](https://atom.io/) 等Markdown编辑器查看.md备份内容


## 配置
- 插件栏右键插件图标
- 弹出菜单选择【选项】  
- 根据个人情况设置配置项
- 点击保存
- 刷新QQ空间页面
- 详细配置项请查看助手选项页
- **推荐配置**
    - 空间数据多：【文件下载工具】使用浏览器，其他保持默认
    - 空间数据少：【文件下载工具】使用助手内部，其他保持默认

## 预览
- 首页
[![QQ空间备份-首页](https://s1.ax1x.com/2020/05/16/YcZPpT.png)](https://imgchr.com/i/YcZPpT)
- 说说
[![QQ空间备份-说说](https://s1.ax1x.com/2020/05/16/YcVx7n.png)](https://imgchr.com/i/YcVx7n)
- 日志
[![QQ空间备份-日志详情](https://s1.ax1x.com/2020/05/16/YcZ9hV.png)](https://imgchr.com/i/YcZ9hV)
- 相册列表
[![QQ空间备份-相册](https://s1.ax1x.com/2020/05/16/YcZkX4.png)](https://imgchr.com/i/YcZkX4)
- 相片列表
[![QQ空间备份-相片列表](https://s1.ax1x.com/2020/05/16/YcZi1U.png)](https://imgchr.com/i/YcZi1U)
- 相片详情
[![QQ空间备份-相片详情](https://s1.ax1x.com/2020/05/16/YcZFcF.png)](https://imgchr.com/i/YcZFcF)
- 留言板
[![QQ空间备份-留言板](https://s1.ax1x.com/2020/05/16/YcZSkq.png)](https://imgchr.com/i/YcZSkq)
- 收藏夹
[![QQ空间备份-收藏夹](https://s1.ax1x.com/2020/05/16/YcZpt0.png)](https://imgchr.com/i/YcZpt0)

## 常见问题    
- 助手是否安全
    - 安全，所有操作均模拟浏览器操作，所有数据仅在浏览器客户端操作，不传输任何数据到后台服务器。


- 获取数据时，多次尝试后，仍无法获取
    - 建议下调【每页条数】或上调【查询间隔】


- 备份空间时，导致浏览器崩溃
    - 空间2G以下的可以使用助手下载，如果仍崩溃，请调整下载工具为【迅雷下载】或【浏览器下载】
    - 空间2G以上的请调整下载工具为【迅雷下载】或【浏览器下载】


- 点击打包下载无反应
    - QQ空间数据量过大时，且使用助手内部方式下载文件的，不支持打包下载
    - 建议在助手选项中调整文件下载工具为浏览器或迅雷X


- 已安装迅雷X，无法正常唤醒迅雷下载
    - 请确认正确安装迅雷X的正式版，不保证第三方版本可用
    - 请确保管家类软件没有优化且关闭迅雷基础服务，如360、腾讯管家等
    - 第三方版本或无法正常唤起的迅雷版本，可选择剪切板板方式唤起，仅支持迅雷X


- 是否支持导出他人空间数据
    - 支持，但是无法导出私密日记、QQ好友、收藏夹等无权限访问的数据。
    - 导出他人数据时，建议告知他人，且勿用于非法用途，否则后果自负。
    - **不支持导出无权限数据**


- 下载后，备份的ZIP在哪
    - 下载完成后，点击【查看备份】按钮打开备份文件夹


- 图片为什么会下载失败
    - 助手方式下载方式：网络原因或Chrome不信任安全证书导致的，可在【下载管理】进行预览并信任证书重新下载
    - 点击【下载管理】按钮，点击【预览】预览文件地址，正常预览的可点击【重试】继续下载
    - 多次重试仍下载失败的，建议点击【迅雷下载】或【浏览器下载】


- 指定清晰度为原图，似乎下载的并不是原图
    - 请先确认QQ空间本身下载图片是否为原图
    - 清晰度逻辑：清晰度选择原图，原图不存在时，取高清大图，以此类推
    - 下载工具为助手时，暂不支持下载含Exif信息的原图，迅雷X与浏览器支持


- 视频下载的视频链接存在有效期吗
    - 存在，请尽快下载，具体有效时间未知


- 视频下载链接文件无法唤起迅雷下载
    - 该文件仅适用于老版的迅雷，已被淘汰，可通过人工拷贝链接到迅雷新建批量下载任务

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

## 喝杯饮料
[![赞赏码-微信](https://s1.ax1x.com/2020/05/16/YcePUI.png)](https://imgchr.com/i/YcePUI)
[![付款码-QQ](https://s1.ax1x.com/2020/05/16/Ycei5t.png)](https://imgchr.com/i/Ycei5t)
[![付款码-支付宝](https://s1.ax1x.com/2020/05/16/YceCVA.png)](https://imgchr.com/i/YceCVA)

## 注意
- 本项目只做个人学习研究之用，不得用于商业用途
- 本助手开源免费，请勿倒卖或从第三方购买
- 本助手基于[QQ空间官方网站](https://qzone.qq.com/index.html)备份个人空间数据
- 使用本助手即同意助手收集QQ空间网站的Cookie信息，用于获取QQ空间数据。
- 本助手仅使用Cookie获取QQ空间数据，不传输任何数据到后台服务器，仅保存到浏览器客户端

## TO-DO
- [ ] 支持增量备份
- [ ] 说说HTML支持查看大图
- [ ] 相册HTML支持显示评论
- [ ] 视频HTML支持显示评论
- [ ] 支持备份赞
- [ ] ~~支持RTF导出~~
- [ ] ~~支持高级自定义导出~~