#!/usr/bin/env python3
"""
准备乡镇/街道级地图数据（自用，需要你自己的天地图 Key）。

【Key 安全】脚本只从下面三处之一读取 Key，不落盘、不写日志、不打印含 Key 的 URL：
  1) 环境变量 TIANDITU_KEY / TIANDITU_TK（只对当前终端窗口有效）
  2) --key-file 指向的文件（推荐：文件放在项目外）
  3) --key 参数（会留在命令历史，不推荐）

【怎么运行（Windows，无需 bash）】
  PowerShell（推荐）：
      cd E:\\Projects\\Licfe\\GitHub\\QZoneExport
      $env:TIANDITU_KEY = "你的key"
      python scripts\\prepare-town-maps.py --probe 440103

  命令提示符（cmd）：
      cd /d E:\\Projects\\Licfe\\GitHub\\QZoneExport
      set TIANDITU_KEY=你的key
      python scripts\\prepare-town-maps.py --probe 440103

  或者完全不设环境变量、也不写进历史（推荐）：
      :: 一次性把 key 存到用户目录下的文件
      echo 你的key> "%USERPROFILE%\\.qze-tianditu-key"
      python scripts\\prepare-town-maps.py --probe 440103 --key-file "%USERPROFILE%\\.qze-tianditu-key"

  如果 python 命令不存在，试试 py（Windows 的 Python 启动器）：
      py scripts\\prepare-town-maps.py --probe 440103

流程分两步，先探测再批量：
  1) --probe 440103：只打印接口原始返回（不写文件），确认有没有 boundary、是 WKT 还是坐标数组
  2) 拿到结构后再补批量：--districts 440103,440104 --backup-dir "<备份目录>"

说明：
  - 天地图行政区划服务：https://api.tianditu.gov.cn/v2/administrative
  - 个人 Key 约 1 万次/日；建议只拉自己打卡涉及的那几个区县
  - 数据为 CGCS2000/WGS84，QQ 点位是 GCJ02，绘制时需注意偏移
  - 生成文件放备份目录 Common/vendor/maps/provinces/<乡镇adcode>.js，
    查看器进入区县视图后点乡镇即可继续下钻
  - 当前只实现探测与字段校验；批量写入要等确认 boundary 形态后再补，避免写错格式
"""
import argparse
import io
import json
import os
import urllib.parse
import urllib.request

API = 'https://api.tianditu.gov.cn/v2/administrative'


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
            '  1) PowerShell: $env:TIANDITU_KEY = "你的key"（只对当前窗口有效）\n'
            '  2) cmd:        set TIANDITU_KEY=你的key\n'
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
            '排查顺序：\n'
            '  1. key 类型：服务端接口（api.tianditu.gov.cn）必须用控制台里「服务器端」类型的 key，\n'
            '     「浏览器端」key 只能给网页 JS 用，直接调服务端接口会 403\n'
            '  2. key 是否带了引号或空格：set TIANDITU_KEY="xxx" 会把引号算进值里，\n'
            '     正确写法不带引号：set TIANDITU_KEY=xxx（天地图 key 通常 32 位）\n'
            '  3. 服务器端 key 的 IP 白名单：留空 = 不限制；若填了，必须包含本机出口 IP\n'
            '  4. 应用是否勾选了「行政区划」相关服务权限\n'
            '  （key 长度已在上方打印，可据此判断是否被引号污染）'
            % (error.code, body)
        )
    except urllib.error.URLError as error:
        raise SystemExit('网络错误：%s（检查代理/防火墙）' % error.reason)


def probe(keyword: str, key: str) -> None:
    data = request_admin(keyword, key, 1)
    print('status:', data.get('status'), '| msg:', data.get('msg'))
    text = json.dumps(data, ensure_ascii=False, indent=2)
    print(text[:4000])
    print('…' if len(text) > 4000 else '')
    print('提示：确认 data / boundary 字段形态后，把结构（不含 key）贴回来，即可补完批量写入。')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', help='探测某个区县（名称或 adcode），只打印不写文件')
    parser.add_argument('--districts', help='逗号分隔的区县 adcode，批量拉下级乡镇（需先确认边界格式）')
    parser.add_argument('--backup-dir', help='写入该备份目录的 Common/vendor/maps/provinces/')
    parser.add_argument('--key', help='天地图 Key（会留在命令历史，不推荐）')
    parser.add_argument('--key-file', help='从文件读 Key（推荐，文件放项目外）')
    args = parser.parse_args()

    key = get_key(args.key, args.key_file)
    # 只打印长度，绝不打印 key 本身；天地图 key 通常 32 位，明显偏长说明被引号/空格污染
    print('Key 长度:', len(key), '（正常 32 位）')

    if args.probe:
        probe(args.probe, key)
        return

    if args.districts:
        codes = [c.strip() for c in args.districts.split(',') if c.strip()]
        print('待处理区县:', len(codes))
        for code in codes:
            data = request_admin(code, key, 1)
            children = data.get('data') or []
            print(code, '下级数量:', len(children))
            for child in children[:3]:
                print('  ', {k: type(v).__name__ for k, v in (child or {}).items()})
        print('\n以上是字段结构。等确认 boundary 形态后补批量转换（当前不写文件）。')
        return

    parser.print_help()


if __name__ == '__main__':
    main()
