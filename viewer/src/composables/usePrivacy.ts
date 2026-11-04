import { ref } from 'vue';

/**
 * 全局隐私开关（隐藏敏感身份信息）
 *
 * 控制范围：侧栏昵称与 QQ 号、空间资料各字段值、互动页 Top5 的 QQ 号。
 * 用模块级单例让所有组件共享同一状态——分散成多个开关容易出现「这里关了那里还露着」。
 *
 * 存储沿用旧键 `qze_space_profile_private`（原空间资料面板的局部开关）做迁移，
 * 老用户之前的设置不会丢。
 */
const STORAGE_KEY = 'qze_hide_sensitive';
const LEGACY_KEY = 'qze_space_profile_private';

const hidden = ref(false);
let initialized = false;

function init(): void {
    if (initialized) return;
    initialized = true;
    try {
        hidden.value = localStorage.getItem(STORAGE_KEY) === '1' || localStorage.getItem(LEGACY_KEY) === '1';
    } catch {
        // file:// 或极端隐私模式下 localStorage 可能受限，忽略即可（保持默认显示）
    }
}

export function usePrivacy(): { hidden: typeof hidden; toggle: () => void } {
    init();

    function toggle(): void {
        hidden.value = !hidden.value;
        try {
            if (hidden.value) localStorage.setItem(STORAGE_KEY, '1');
            else localStorage.removeItem(STORAGE_KEY);
        } catch {
            // 存不下就只在本次会话生效
        }
    }

    return { hidden, toggle };
}
