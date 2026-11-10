#!/usr/bin/env python3
"""
天地图行政区划数据导出（实际能力：到区县为止，无乡镇/街道边界）。

【实测结论（2026-11）】
  probe 广州市 → 返回 11 个区，每个区 children=0；probe 荔湾区 → children=0。
  天地图 v2/administrative 的 children 最低只到区县，**不提供乡镇/街道边界**，
  因此本脚本不能用来做「乡镇级下钻」。乡镇边界只能走第三方付费数据（如 AreaCity 四级包）
  或高德/腾讯的行政区划接口（需自行确认边界是否返回）。

脚本保留的用途：
  - --probe：查看某行政区及其下级，确认层级与边界是否可用
  - --areas：把指定行政区的下级（到区县）导出成查看器可直接加载的 UMD 脚本

【Key 安全】脚本只从下面三处之一读取 Key，不落盘、不写日志、不打印含 Key 的 URL：
  1) 环境变量 TIANDITU_KEY / TIANDITU_TK（只对当前窗口有效）
  2) --key-file 指向的文件（推荐：文件放在项目外）
  3) --key 参数（会留在命令历史，不推荐）

【Windows 怎么跑（无需 bash）】
  命令提示符（cmd）：
      cd /d E:\\Projects\\Licfe\\GitHub\\QZoneExport
      set TIANDITU_KEY=你的key
      python scripts\\prepare-town-maps.py --probe 荔湾区

  如果 python 命令不存在，把 python 换成 py。

【接口要点（实测）】
  - keyword 必须传**行政区名称**（"荔湾区" 可以，"440103" 会返回空 district）
  - 返回 data.district[] 是匹配到的区划本身，下级在 children[] 里
  - boundary 是 WKT 字符串：MULTIPOLYGON(((lng lat, ...)))
  - gb 形如 "156440103"（前 3 位国家码 + 6 位 adcode）

用法：
  # 1) 探测：看某地有没有下级（重点看 children 是否为空）
  python scripts\\prepare-town-maps.py --probe 广州市
  python scripts\\prepare-town-maps.py --probe 荔湾区

  # 2) 批量：按名称列表拉下级，写进备份目录
  python scripts\\prepare-town-maps.py --areas 广州市,深圳市 --backup-dir "<备份目录>"

  # 3) 只写扩展产物（不写备份目录）时去掉 --backup-dir
"""
import argparse
import io
import json
import os
import re
import urllib.parse
import urllib.request

API = 'https://api.tianditu.gov.cn/v2/administrative'
OUT_DIR = 'public/viewer/Common/vendor/maps/provinces'

UMD = (
    '/* 乡镇/区县地图 {adcode} · 天地图（国家基础地理信息中心） */\n'
    "(function(root,factory){if(typeof define==='function'&&define.amd){define(['exports','echarts'],factory);}"
    "else if(typeof exports==='object'&&typeof exports.nodeName!=='string'){factory(exports,require('echarts'));}"
    "else{factory({},root.echarts);}}"
    "(this,function(exports,echarts){if(echarts&&echarts.registerMap){echarts.registerMap('{adcode}',{geojson});}}));\n"
)


def get_key(cli_key: str | None, key_file: str | None) -> str:
    key = cli_key
    if not key and key_file:
        try:
            with io.open(os.path.expanduser(key_file), encoding='utf-8') as f:
                key = f.read().strip()
        except OSError as error:
            raise SystemExit('读取 key 文件失败：' + str(error))
    key = key or os.environ.get('TIANDITU_KEY') or os.environ.get('TIANDITU_TK')
    if not key:
        raise SystemExit(
            '缺少天地图 Key，三种方式任选：\n'
            '  1) $env:TIANDITU_KEY = "你的key"（只对当前窗口有效）\n'
            '  2) set TIANDITU_KEY=你的key\n'
            '  3) 文件（推荐）: --key-file "%USERPROFILE%\\.qze-tianditu-key"'
        )
    return key.strip()


def request_admin(keyword: str, key: str, child_level: int = 1) -> dict:
    params = {
        'keyword': keyword,
        'childLevel': str(child_level),
        'extensions': 'true',
        'tk': key,
    }
    url = API + '?' + urllib.parse.urlencode(params)
    # 注意：不要把 url 打进日志（含 tk）
    req = urllib.request.Request(url, headers={'User-Agent': 'qzone-export/prepare-towns'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as error:
        body = error.read()[:400].decode('utf-8', 'replace')
        raise SystemExit(
            '天地图返回 HTTP %s：%s\n'
            '排查：key 必须是「服务器端」类型；不要带引号；IP 白名单留空。'
            % (error.code, body)
        )
    except urllib.error.URLError as error:
        raise SystemExit('网络错误：%s（检查代理/防火墙）' % error.reason)


def wkt_to_geojson(wkt: str) -> dict | None:
    """把 WKT 的 POLYGON / MULTIPOLYGON 转成 GeoJSON 几何（只处理这两种）"""
    if not wkt:
        return None
    match = re.match(r'\s*(MULTIPOLYGON|POLYGON)\s*(\(.*\))\s*$', wkt, re.I | re.S)
    if not match:
        return None
    kind = match.group(1).upper()
    body = match.group(2)
    # 先按括号层级切出 ring，再逐 ring 提取坐标对
    rings: list[list[list[float]]] = []
    depth = 0
    start = None
    for i, ch in enumerate(body):
        if ch == '(':
            depth += 1
            if depth == 3:  # 第 3 层是 ring 内部
                start = i + 1
        elif ch == ')':
            if depth == 3 and start is not None:
                rings.append(parse_ring(body[start:i]))
                start = None
            depth -= 1
    if not rings:
        return None
    if kind == 'POLYGON':
        return {'type': 'Polygon', 'coordinates': rings}
    # MultiPolygon：这里的 WKT 是「一个外环 + 若干内环」的常见形态，按单 Polygon 包一层更稳
    return {'type': 'MultiPolygon', 'coordinates': [rings]}


def parse_ring(text: str) -> list[list[float]]:
    coords = []
    for pair in text.split(','):
        parts = pair.strip().split()
        if len(parts) >= 2:
            try:
                coords.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
    return coords


def to_adcode(gb: str | None) -> str:
    if not gb:
        return ''
    digits = re.sub(r'\D', '', gb)
    return digits[-6:] if len(digits) >= 6 else ''


def collect_children(node: dict) -> list[dict]:
    """递归取所有下级（children 里可能还有 children）"""
    out: list[dict] = []
    for child in node.get('children') or []:
        out.append(child)
        out.extend(collect_children(child))
    return out


def probe(keyword: str, key: str) -> None:
    data = request_admin(keyword, key, 1)
    districts = (data.get('data') or {}).get('district') or []
    print('status:', data.get('status'), '| message:', data.get('message'), '| district:', len(districts))
    for item in districts:
        children = item.get('children') or []
        print('  %s (adcode=%s, level=%s) children=%d boundary=%s' % (
            item.get('name'), to_adcode(item.get('gb')), item.get('level'),
            len(children), '有' if item.get('boundary') else '无',
        ))
        for child in children[:5]:
            print('    -', child.get('name'), to_adcode(child.get('gb')), 'children=', len(child.get('children') or []))
    if not districts:
        print('提示：keyword 必须是行政区名称（如「荔湾区」），传 adcode 会返回空。')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', help='探测一个行政区（名称），只打印结构')
    parser.add_argument('--areas', help='逗号分隔的行政区名称，批量拉下级并写入')
    parser.add_argument('--backup-dir', help='写入该备份目录的 Common/vendor/maps/provinces/')
    parser.add_argument('--key', help='天地图 Key（会留在命令历史，不推荐）')
    parser.add_argument('--key-file', help='从文件读 Key（推荐，文件放项目外）')
    args = parser.parse_args()

    key = get_key(args.key, args.key_file)
    print('Key 长度:', len(key), '（正常 32 位）')

    if args.probe:
        probe(args.probe, key)
        return

    if not args.areas:
        parser.print_help()
        return

    names = [n.strip() for n in args.areas.split(',') if n.strip()]
    out_dirs = []
    if args.backup_dir:
        out_dirs.append(os.path.join(args.backup_dir, 'Common/vendor/maps/provinces'))
    else:
        out_dirs.append(OUT_DIR)
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)

    written = 0
    total = 0
    for name in names:
        data = request_admin(name, key, 1)
        districts = (data.get('data') or {}).get('district') or []
        if not districts:
            print('跳过（无返回）:', name)
            continue
        for node in districts:
            for child in collect_children(node):
                geometry = wkt_to_geojson(child.get('boundary') or '')
                adcode = to_adcode(child.get('gb'))
                if not geometry or not adcode:
                    continue
                geojson = {
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'properties': {
                            'name': child.get('name') or '',
                            'adcode': int(adcode) if adcode.isdigit() else adcode,
                            'parent': {'adcode': to_adcode(node.get('gb'))},
                        },
                        'geometry': geometry,
                    }],
                }
                script = UMD.replace('{adcode}', adcode).replace('{geojson}', json.dumps(geojson, ensure_ascii=False, separators=(',', ':')))
                for d in out_dirs:
                    with io.open(os.path.join(d, adcode + '.js'), 'w', encoding='utf-8', newline='') as f:
                        f.write(script)
                written += 1
                total += len(script)
                print('已生成', adcode, child.get('name'), '%.0f KB' % (len(script) / 1024))
    print('完成：写入 %d 个，共 %.1f MB' % (written, total / 1024 / 1024))
    print('把生成的 .js 放到备份目录 Common/vendor/maps/provinces/ 下，查看器进入对应层级后即可继续下钻。')


if __name__ == '__main__':
    main()
