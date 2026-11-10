#!/usr/bin/env python3
"""
构建「查看器独立更新包」。

用法：python3 scripts/build-viewer-package.py
前置：先执行 npm run build:viewer 生成 public/viewer/ 产物。

【目录映射是关键】
查看器构建产物 public/viewer/ 的布局是：
    index.html / Common/js / Common/css / vendor/ / images/
但备份目录（file:// 打开 index.html）的查看器资源历来都在 Common/ 下：
    index.html / Common/js / Common/css / Common/vendor / Common/images
早期打包把 vendor/ 与 images/ 原样放在 zip 根，解压覆盖后备份目录根目录多出一份
vendor/，与 Common/vendor/ 重复，且页面脚本实际只加载 ./Common/vendor/...。
这里把这两个目录映射到 Common/ 下，保证解压到备份目录根目录后正确覆盖、不产生冗余副本。
"""
import io
import os
import zipfile

SRC = 'public/viewer'
OUT = '.output/qzone-export-3.1-viewer.zip'
NOTE = '查看器更新说明.txt'
NOTE_TEXT = """QQ空间导出助手 · 查看器独立更新包 v3.1

【怎么用】
1. 先关闭已经打开的查看器页面（备份目录里的 index.html）。
2. 把本压缩包里的全部文件，解压到备份目录的根目录
   —— 也就是你平时双击打开的 index.html 所在的那层目录。
3. 出现「覆盖同名文件」提示时选择覆盖，然后按 Ctrl+F5 强刷一次页面。

【会不会影响数据】
不会。这个包只更新查看器程序文件（index.html、Common/ 下的 js/css/vendor/images），
不会改动你的备份数据（说说、日志、相册、视频等 .js 文件与媒体文件）。

【要不要重装扩展】
不需要。查看器是离线页面，独立于浏览器扩展运行；即使不更新扩展，
覆盖后也能直接使用新界面。

【注意】
不要解压到子目录，否则路径对不上，查看器会加载不到程序文件。
"""


def map_path(rel: str) -> str:
    """产物布局已统一为 Common/，无需再映射（保留函数便于以后调整）"""
    return rel


def main() -> None:
    if not os.path.isdir(SRC):
        raise SystemExit('缺少 public/viewer/，请先执行 npm run build:viewer')
    files = []
    for base, _, names in os.walk(SRC):
        for name in names:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, SRC).replace('\\', '/')
            files.append((map_path(rel), full))
    files.sort()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for target, full in files:
            z.write(full, target)
        z.writestr(NOTE, NOTE_TEXT.encode('utf-8'))
    print('已生成', OUT)
    print('条目数', len(files) + 1)
    for target, _ in files:
        print('  ', target)


if __name__ == '__main__':
    main()
