import { ref } from 'vue';

/**
 * 空间资料弹层的全局开关。
 * 侧栏资料卡、首页 Hero 的「资料 ›」共用同一个弹层，避免两处各挂一个实例。
 */
const open = ref(false);

export function useProfileDialog(): {
    open: typeof open;
    openProfile: () => void;
    closeProfile: () => void;
} {
    return {
        open,
        openProfile: () => { open.value = true; },
        closeProfile: () => { open.value = false; },
    };
}
