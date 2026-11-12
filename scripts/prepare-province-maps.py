#!/usr/bin/env python3
"""
准备「下钻到区县」的市级地图数据（自用 / 不随发布包分发）。

背景：扩展内置了全国市级地图（`china-cities.js`，477 要素，含省 → 市两级），
点省即可进入省级视图。若想继续点市、看到区县边界，还需要每个市自己的 GeoJSON：

    https://geo.datav.aliyun.com/areas_v3/bound/<市 adcode>_full.json

本脚本按「全国市级索引」批量下载这些文件，转成查看器可直接加载的 UMD 脚本：

    Common/vendor/maps/provinces/<市 adcode>.js

放进备份目录后，查看器在省级视图点市时会自动加载并切换到区县视图（无需改代码）。

用法：
    # 下载全部有下级的市（约 330 个，合计 20-30 MB，耗时几分钟）
    python3 scripts/prepare-province-maps.py --backup-dir "<备份目录>"

    # 只补某个省下面的市（例如广东 440000）
    python3 scripts/prepare-province-maps.py --province 440000 --backup-dir "<备份目录>"

    # 只生成到扩展产物（不写备份目录）
    python3 scripts/prepare-province-maps.py

    # 只写备份目录、不碰扩展产物（推荐：自用数据不应进发布包）
    python3 scripts/prepare-province-maps.py --backup-dir "<备份目录>" --no-public

其它：
  - 已存在的 <adcode>.js 会跳过，可反复执行做增量补齐
  - DataV 对区县没有下一级文件（404），脚本自动跳过
  - 数据来源：阿里云 DataV.GeoAtlas（高德开放平台，版本 2021.5），文件不附审图号、
    页面声明仅供学习交流；**请勿把生成的数据随公开发行包分发**
"""
import argparse
import concurrent.futures
import io
import json
import os
import urllib.request

CITY_INDEX = 'viewer/map-vendor/maps/china-cities.js'  # 内置全国市级地图（本地索引）
SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json'
OUT_DIR = 'public/viewer/Common/vendor/maps/provinces'

UMD = (
    '/* 市级地图 {adcode} · 阿里云 DataV.GeoAtlas（不附审图号，仅供个人学习研究） */\n'
    "(function(root,factory){if(typeof define==='function'&&define.amd){define(['exports','echarts'],factory);}"
    "else if(typeof exports==='object'&&typeof exports.nodeName!=='string'){factory(exports,require('echarts'));}"
    "else{factory({},root.echarts);}}"
    "(this,function(exports,echarts){if(echarts&&echarts.registerMap){echarts.registerMap('{adcode}',{geojson});}}));\n"
)


def load_index() -> list[dict]:
    """从内置 china-cities.js 里取全国市级要素（含 adcode / name / parent）"""
    with io.open(CITY_INDEX, encoding='utf-8') as f:
        text = f.read()
    # 文件格式：...var data=<geojson>;...echarts.registerMap('china-cities',data);...
    # geojson 是平衡的 JSON 对象，从 "var data=" 后的第一个 '{' 开始配对括号
    marker = "var data="
    start = text.index(marker) + len(marker)
    while start < len(text) and text[start] != '{':
        start += 1
    depth = 0
    end = None
    for i in range(start, len(text)):
        ch = text[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise SystemExit('无法解析 ' + CITY_INDEX)
    data = json.loads(text[start:end])
    items = []
    for feature in data.get('features', []):
        props = feature.get('properties') or {}
        adcode = props.get('adcode')
        parent = (props.get('parent') or {}).get('adcode')
        level = props.get('level')
        if not adcode or not parent or level not in ('city', 'district'):
            continue
        items.append({
            'adcode': str(adcode),
            'name': props.get('name') or '',
            'parent': str(parent),
            'level': level,
            'children': int(props.get('childrenNum') or 0),
        })
    return items


def fetch(adcode: str) -> tuple[str, dict | None, str]:
    url = SOURCE.format(adcode=adcode)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'qzone-export/prepare-maps'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
        data = json.loads(raw)
        features = data.get('features') or []
        return adcode, (data if features else None), '' if features else '无下级要素'
    except Exception as error:  # 404 / 超时都按「无下级」处理
        return adcode, None, str(error)[:60]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--backup-dir', help='同时写入该备份目录的 Common/vendor/maps/provinces/')
    parser.add_argument('--province', help='只处理该省下的市（省 adcode，如 440000）')
    parser.add_argument('--concurrency', type=int, default=6)
    parser.add_argument('--no-public', action='store_true', help='不写 public/viewer 产物，只写 --backup-dir')
    args = parser.parse_args()

    index = load_index()
    targets = [item for item in index if item['children'] > 0]
    if args.province:
        targets = [item for item in targets if item['parent'] == args.province]
    print('待处理市级区域:', len(targets), '（有下级才下载）')

    out_dirs = [] if args.no_public else [OUT_DIR]
    if args.backup_dir:
        out_dirs.append(os.path.join(args.backup_dir, 'Common/vendor/maps/provinces'))
    if not out_dirs:
        raise SystemExit('未指定输出：请给 --backup-dir，或去掉 --no-public 生成到扩展产物')
    for directory in out_dirs:
        os.makedirs(directory, exist_ok=True)

    pending = [
        item for item in targets
        if not all(os.path.exists(os.path.join(d, item['adcode'] + '.js')) for d in out_dirs)
    ]
    print('已完成跳过:', len(targets) - len(pending), '| 待下载:', len(pending))

    written = 0
    total_bytes = 0

    def work(item: dict) -> tuple[dict, dict | None, str]:
        adcode, data, reason = fetch(item['adcode'])
        return item, data, reason

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        for item, data, reason in pool.map(work, pending):
            if not data:
                print('跳过', item['adcode'], item['name'], '—', reason)
                continue
            geojson = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
            # 不用 str.format：UMD 模板里含大量 JS 花括号
            script = UMD.replace('{adcode}', item['adcode']).replace('{geojson}', geojson)
            for directory in out_dirs:
                with io.open(os.path.join(directory, item['adcode'] + '.js'), 'w', encoding='utf-8', newline='') as f:
                    f.write(script)
            written += 1
            total_bytes += len(script)
            print('已生成', item['adcode'], item['name'], '%.0f KB' % (len(script) / 1024))

    print('完成：写入 %d 个文件，共 %.1f MB' % (written, total_bytes / 1024 / 1024))
    print('查看器用法：把生成的 .js 放在备份目录 Common/vendor/maps/provinces/ 下，')
    print('进入省级视图后点市，即可切到区县视图；返回按钮可逐级退回。')


if __name__ == '__main__':
    main()
