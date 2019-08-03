# QQ空间导出助手

> QQ空间导出助手，用于备份QQ空间的说说、相册、视频、日志、留言板为文件，供永久保存

## 简介

互联网产品都有着自己的生命周期，新浪博客相册，网易相册，QQ账号注销等等，于是写了这个基于Chrome的QQ空间导出助手的谷歌扩展，用于备份QQ空间的日志、说说、相册、留言板为文件，供永久保存。

## 安装
#### 源码安装
- 下载源码
- 打开[谷歌扩展](chrome://extensions/)
- 勾选开发者模式
- 点击[加载已解压的扩展程序]按钮
- 选择QZoneExport/src文件夹

#### Google
- [QQ空间导出助手](https://atom.io/)


## 使用
- 登录QQ空间  
  支持空间URL：https://user.qzone.qq.com/QQ号  
  不支持空间URL：https://QQ号.qzone.qq.com
- 右上角点击插件图标  
 ![](https://i.loli.net/2019/08/04/Td5hUAfcvH14Yik.png)
- 勾选备份内容
- 点击开始备份
- 等待备份完成   
![](https://i.loli.net/2019/08/04/wiIQYvGEsR38Z12.png)
- 点击下载备份  
![](https://i.loli.net/2019/08/04/LSoxmFJAf4Ms9NZ.png)
- 下载并保存  
![](https://i.loli.net/2019/08/04/NIkosuxiRKLHlFB.png)
- 推荐使用 [Atom](https://atom.io/) Markdown编辑器查看.md备份内容
- 备份目录结构如下    
    ├─好友  
    │  └─QQ好友.xlsx  
    ├─日志  
    │  ├─images  
    │  │  └─图片名称  
    │  └─分类名称  
    │      └─日志标题.md  
    ├─留言板  
    │  └─留言板.md  
    ├─相册  
    │  └─分类名称  
    │      └─相册名称  
    │          └─相片名称  
    ├─私密日记  
    │  ├─images  
    │  │  └─图片名称  
    │  └─日志标题.md  
    ├─视频  
    │  └─视频链接.downlist  
    └─说说  
    │   ├─2019年.md  
    │   └─images  
    │       └─图片名称  
    ├─说明.md  

## 备份内容预览
### 说说
![](https://s2.ax1x.com/2019/08/04/eySxun.png)
### 日志
![](https://s2.ax1x.com/2019/08/04/eySjjs.png)
### 留言板
![](https://i.loli.net/2019/08/04/3oj4emPFhC29iAQ.png)
### 好友
![](https://i.loli.net/2019/08/04/AhQB1PeGfTFl3N2.png)



## 配置
- 右键点击插件图标
- 弹出菜单选择【选项】  
- 配置页面可配置备份方式和选项
![](https://i.loli.net/2019/08/04/XcqReS1sHInlCMN.png)
- 推荐使用默认配置，遇到QQ冻结时，可调整查询间隔
- 无法更改的配置表示尚未支持


## TO-DO
- [x] 普通日志导出
- [x] 私密日记导出
- [x] 普通说说导出
- [x] QQ好友导出
- [x] 普通相册导出
- [x] 留言板导出
- [x] 优化插件UI
- [x] 原图相册导出
- [x] 视频导出
- [ ] JSON导出