/**
 * 基于 File System Access API 的 BackupFs 实现。
 *
 * 浏览器侧（Options 工具页）用：用户通过 showDirectoryPicker 选中的备份根目录
 * （FileSystemDirectoryHandle）即可构造。仅操作该目录，不会触碰其它位置。
 */

import type { BackupFs } from './merge-backup';

type DirHandle = FileSystemDirectoryHandle;

/** 解析相对路径（/ 分隔）取目录句柄；create=true 时逐级创建 */
async function resolveDir(root: DirHandle, segments: string[], create: boolean): Promise<DirHandle | null> {
    let handle: DirHandle = root;
    for (const seg of segments) {
        try {
            handle = await handle.getDirectoryHandle(seg, { create });
        } catch (e) {
            // 读取模式（create=false）下目录不存在属于正常「路径不存在」，返回 null 让上层按缺失处理；
            // 若一路冒泡会触发 File System Access API 的 NotFoundError（"比较失败/合并失败"）。
            // 创建模式下的失败才是真实错误，原样上抛。
            if (create) throw e;
            return null;
        }
    }
    return handle;
}

/** 解析到文件所在的目录句柄 + 文件名 */
async function resolveFile(
    root: DirHandle,
    relPath: string,
    create: boolean,
): Promise<{ dir: DirHandle; name: string } | null> {
    const parts = relPath.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) return null;
    const name = parts.pop() as string;
    const dir = await resolveDir(root, parts, create);
    if (!dir) return null;
    return { dir, name };
}

/** 解析 window.x=... / var x=... 包裹的 js 文本为对象 */
function parseJsText(text: string): unknown {
    const trimmed = text.trim().replace(/;\s*$/, '');
    try {
        return JSON.parse(trimmed);
    } catch {
        /* 继续去前缀 */
    }
    // 去掉 `window.xxx = ` / `var x = ` / `let x = ` / `const x = ` 等前缀。
    // 支持点访问（window.Messages=）、方括号访问（window["Messages"]= / window['Messages']=，
    // 部分 JS 压缩器会把点访问改写成方括号形式）以及多层混合（window.A.B["C"]=）。
    const m = trimmed.match(
      /^\s*(?:(?:window|var|let|const)\s+)?[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[\s*['"][^'"]+['"]\s*\])*\s*=\s*([[{][\s\S]*)$/,
    );
    if (m) {
        // 截掉数据字面量（[ 或 { 起）之后的非 JSON 残留：旧版/压缩器可能在 ]; 后追加标记文本
        // （实测有文件以 `];backedup` 结尾），不清理会令 JSON.parse 失败。
        const body = m[1]!.trim().replace(/[^\]}]*$/, '');
        try {
            return JSON.parse(body);
        } catch {
            /* 继续 */
        }
    }
    // 兜底：取第一个 [ 或 { 之后的内容，同样截掉尾部非 JSON 残留
    const idx = Math.min(
        trimmed.indexOf('[') >= 0 ? trimmed.indexOf('[') : Infinity,
        trimmed.indexOf('{') >= 0 ? trimmed.indexOf('{') : Infinity,
    );
    if (isFinite(idx)) {
        const body = trimmed.slice(idx).trim().replace(/[^\]}]*$/, '');
        try {
            return JSON.parse(body);
        } catch {
            /* 继续 */
        }
    }
    throw new Error('无法解析数据文件内容');
}

async function readTextSafe(dir: DirHandle, name: string): Promise<string | null> {
    try {
        const fileHandle = await dir.getFileHandle(name);
        const file = await fileHandle.getFile();
        return await file.text();
    } catch {
        return null;
    }
}

async function writeTextFile(root: DirHandle, relPath: string, text: string): Promise<void> {
    const resolved = await resolveFile(root, relPath, true);
    if (!resolved) throw new Error('非法路径：' + relPath);
    const fileHandle = await resolved.dir.getFileHandle(resolved.name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
}

export function createDirectoryHandleFs(root: DirHandle): BackupFs {
    return {
        async readJson(relPath: string): Promise<unknown | null> {
            // 优先读 .json（结构化汇总文件）；.json 缺失（目录不存在或文件不存在）时
            // 回退同目录 .js 兄弟文件。兼容 V2 及更早版本只导出 window.xxx=... 的 .js、
            // 不产出 .json 的备份，否则旧备份缺失 .json → readJson 返回 null →
            // 整个模块被静默跳过、无法比较/合并。
            let resolved = await resolveFile(root, relPath, false);
            let text = resolved ? await readTextSafe(resolved.dir, resolved.name) : null;
            if ((!resolved || text == null) && relPath.endsWith('.json')) {
                const jsPath = relPath.replace(/\.json$/, '.js');
                resolved = await resolveFile(root, jsPath, false);
                text = resolved ? await readTextSafe(resolved.dir, resolved.name) : null;
            }
            if (!resolved || text == null) return null;
            return parseJsText(text);
        },

        async writeJson(relPath: string, data: unknown): Promise<void> {
            const text = JSON.stringify(data);
            if (relPath.endsWith('.js')) {
                const name = relPath.split('/').pop()!.replace(/\.js$/, '');
                await writeTextFile(root, relPath, `window.${name} = ${text};`);
            } else {
                await writeTextFile(root, relPath, text);
            }
        },
        async writeJs(relPath: string, globalName: string, data: unknown): Promise<void> {
            // .js 数据文件的变量名不能按文件名猜：留言为 boardInfo、访客为 visitorInfo
            // （查看器 DATA_SOURCES 按此读取），写错变量名会导致查看器读到空数据。
            const text = JSON.stringify(data);
            await writeTextFile(root, relPath, `window.${globalName} = ${text};`);
        },

        async exists(relPath: string): Promise<boolean> {
            const resolved = await resolveFile(root, relPath, false);
            if (!resolved) return false;
            try {
                await resolved.dir.getFileHandle(resolved.name);
                return true;
            } catch {
                return false;
            }
        },

        async readBinary(relPath: string): Promise<Uint8Array | null> {
            const resolved = await resolveFile(root, relPath, false);
            if (!resolved) return null;
            try {
                const fileHandle = await resolved.dir.getFileHandle(resolved.name);
                const file = await fileHandle.getFile();
                const buf = await file.arrayBuffer();
                return new Uint8Array(buf);
            } catch {
                return null;
            }
        },

        async writeBinary(relPath: string, data: Uint8Array): Promise<void> {
            const resolved = await resolveFile(root, relPath, true);
            if (!resolved) throw new Error('非法路径：' + relPath);
            const fileHandle = await resolved.dir.getFileHandle(resolved.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data as any);
            await writable.close();
        },

        async listFiles(): Promise<string[]> {
            const out: string[] = [];
            async function walk(dir: DirHandle, prefix: string): Promise<void> {
                for await (const [name, handle] of (dir as any).entries()) {
                    const path = prefix ? prefix + '/' + name : name;
                    if (handle.kind === 'directory') {
                        await walk(handle as DirHandle, path);
                    } else {
                        out.push(path);
                    }
                }
            }
            await walk(root, '');
            return out;
        },

        async listDir(relDir: string): Promise<string[]> {
            const segs = relDir.split('/').filter((p) => p.length > 0);
            const base = await resolveDir(root, segs, false);
            if (!base) return [];
            const prefix = segs.join('/');
            const out: string[] = [];
            async function walk(dir: DirHandle, pPrefix: string): Promise<void> {
                for await (const [name, handle] of (dir as any).entries()) {
                    const path = pPrefix ? pPrefix + '/' + name : name;
                    if (handle.kind === 'directory') {
                        await walk(handle as DirHandle, path);
                    } else {
                        out.push(path);
                    }
                }
            }
            await walk(base, prefix);
            return out;
        },
    };
}
