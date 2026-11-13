/**
 * JSON/JSONP 解析工具
 * 移值自 api.js，从 core/shared/utils.ts 拆分。
 */

import JSON5 from 'json5';
import { jsonrepair } from 'jsonrepair';

/** JSONP 剥壳并解析 JSON */
export function toJson<T = any>(json: string, jsonpKey?: RegExp): T {
    json = json.trim();

    if (jsonpKey && json.match(jsonpKey)) {
        json = json.replace(jsonpKey, '');
        if (json.endsWith(';')) json = json.substring(0, json.length - 1).trim();
        if (json.endsWith(')')) json = json.substring(0, json.length - 1).trim();
    } else {
        const callbackMatch = /^[^({]{0,50}?callback\s*\(/i.exec(json);
        if (callbackMatch) {
            json = json.substring(callbackMatch.index + callbackMatch[0].length);
            if (json.endsWith(';')) json = json.substring(0, json.length - 1).trim();
            if (json.endsWith(')')) json = json.substring(0, json.length - 1).trim();
        }
    }

    try {
        return JSON.parse(json);
    } catch {
        try {
            return JSON.parse(json.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
        } catch (retryError) {
            try {
                return JSON5.parse<T>(json);
            } catch {
                // 最后一级兜底：QQ 相册 cgi_list_photo 等接口会返回「字符串未闭合 / 裸换行 /
                // 脏转义」的 JSONP，JSON5 也救不了（它只放宽对象字面量语法）。jsonrepair 专门
                // 修这类脏 JSON，实测可保住整本 photoList；仅在前三级都失败时启用，正常数据零开销。
                try {
                    return JSON.parse(jsonrepair(json)) as T;
                } catch (repairError) {
                    // 仍以原始（第二级）错误抛出，便于日志定位；修复失败原因挂在 cause 上
                    (retryError as Error & { cause?: unknown }).cause = repairError;
                    throw retryError;
                }
            }
        }
    }
}
