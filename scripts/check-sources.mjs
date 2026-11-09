#!/usr/bin/env node
/**
 * Firefox（AMO）源码包发布前校验
 *
 * 背景：WXT 默认只排除 node_modules / .output / 测试文件，项目根下的本地资料目录
 * （resources/、design/、docs/ 等）会被整包打进 sources.zip。这些目录里可能有
 * 设计稿、营销物料、历史发布包乃至签名密钥，一旦随源码包上传就不再受控。
 *
 * 本脚本在 `npm run zip:firefox` 之后自动执行，做三件事：
 *   1. 体积上限：压缩后超过 MAX_COMPRESSED_MB 视为异常膨胀
 *   2. 敏感/无关文件：resources/、design/、docs/ 与 *.pem / *.key / *.p12 / *.crx / *.zip / *.log
 *      以及文件名含 key/secret/token/credential 的条目，命中即失败
 *   3. 必需内容：package.json、wxt.config.ts、core/、entrypoints/、viewer/ 至少各有一条，
 *      防止排除规则写过头把源码也排掉
 *
 * 只依赖 Node 内置模块（自行解析 zip 中央目录），不引入新依赖。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const OUT_DIR = '.output';
/** 正常约 2.5 MB；超过 10 MB 基本可以确定混入了本地资料 */
const MAX_COMPRESSED_MB = 10;

const FORBIDDEN_PATTERNS = [
    { test: (n) => n.startsWith('resources/'), why: '本地资料目录（素材/发布物料/密钥可能在其中）' },
    { test: (n) => n.startsWith('design/'), why: '本地设计稿' },
    { test: (n) => n.startsWith('docs/'), why: '本地文档' },
    { test: (n) => /\.(pem|key|p12|pfx|crt|cer)$/i.test(n), why: '证书 / 私钥' },
    { test: (n) => /\.(crx)$/i.test(n), why: '打包好的扩展包' },
    { test: (n) => /\.(log)$/i.test(n), why: '构建日志' },
    { test: (n) => /(^|\/)[^/]*\.zip$/i.test(n), why: '历史发布 zip' },
    { test: (n) => /(key|secret|token|credential)/i.test(basename(n)), why: '文件名疑似凭据' },
];

const REQUIRED_PREFIXES = ['package.json', 'wxt.config.ts', 'core/', 'entrypoints/', 'viewer/'];

/** 解析 zip 中央目录，返回 [{ name, compressed, uncompressed }] */
function readZipEntries(buf) {
    const EOCD = 0x06054b50;
    let eocd = -1;
    const minStart = Math.max(0, buf.length - 22 - 0xffff);
    for (let i = buf.length - 22; i >= minStart; i--) {
        if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 zip 文件（未找到中央目录）');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const entries = [];
    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 中央目录损坏');
        const compressed = buf.readUInt32LE(p + 20);
        const uncompressed = buf.readUInt32LE(p + 24);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
        entries.push({ name, compressed, uncompressed });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

function findSourcesZip() {
    if (!existsSync(OUT_DIR)) return null;
    const candidates = readdirSync(OUT_DIR)
        .filter((f) => f.endsWith('-sources.zip'))
        .map((f) => ({ file: join(OUT_DIR, f), mtime: statSync(join(OUT_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
    return candidates[0]?.file ?? null;
}

function main() {
    // 支持显式传入 zip 路径（自测/CI 用），默认取 .output 下最新的 *-sources.zip
    const zipPath = process.argv[2] ?? findSourcesZip();
    if (!zipPath) {
        console.log('[check-sources] 未找到 *-sources.zip（该目标浏览器不生成源码包），跳过');
        return;
    }
    const entries = readZipEntries(readFileSync(zipPath));
    const compressedMb = statSync(zipPath).size / 1024 / 1024;
    const uncompressedMb = entries.reduce((s, e) => s + e.uncompressed, 0) / 1024 / 1024;

    const problems = [];
    if (compressedMb > MAX_COMPRESSED_MB) {
        problems.push(`体积异常：压缩后 ${compressedMb.toFixed(2)} MB，超过上限 ${MAX_COMPRESSED_MB} MB`);
    }
    for (const e of entries) {
        for (const rule of FORBIDDEN_PATTERNS) {
            if (rule.test(e.name)) {
                problems.push(`不该打包的文件：${e.name}（${rule.why}）`);
                break;
            }
        }
    }
    for (const prefix of REQUIRED_PREFIXES) {
        const hit = entries.some((e) => e.name === prefix || e.name.startsWith(prefix));
        if (!hit) problems.push(`缺少必需内容：${prefix}（排除规则可能写过头）`);
    }

    console.log(`[check-sources] ${zipPath}`);
    console.log(`[check-sources] 条目 ${entries.length}｜压缩 ${compressedMb.toFixed(2)} MB｜解压 ${uncompressedMb.toFixed(2)} MB`);

    if (problems.length > 0) {
        console.error('\n[check-sources] 校验未通过：');
        for (const p of problems.slice(0, 30)) console.error('  ✗ ' + p);
        if (problems.length > 30) console.error(`  … 另有 ${problems.length - 30} 项`);
        console.error('\n请检查 wxt.config.ts 的 zip.excludeSources 配置后再打包。');
        process.exit(1);
    }
    console.log('[check-sources] 校验通过 ✓');
}

main();
