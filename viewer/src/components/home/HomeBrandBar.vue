<template>
    <footer class="brand-bar">
        <span class="brand-wish">落叶随风，青春，稍纵即逝。</span>
    </footer>
</template>

<style scoped>
/* 侧栏底部已有品牌信息，概览底部只留一句寄语，不重复署名 */
.brand-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 32px;
    padding: 18px 0 6px;
    border-top: 1px solid var(--border-light);
}
.brand-wish {
    font-family: Georgia, "Songti SC", "SimSun", serif;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
}
</style>
