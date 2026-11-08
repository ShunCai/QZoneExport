<template>
    <footer class="brand-bar">
        <p class="brand-wish">落叶随风，青春，稍纵即逝。</p>
        <p class="brand-note">把 QQ 空间的青春，备份成一本随时能翻开的书。</p>
    </footer>
</template>

<style scoped>
/* 侧栏底部已有品牌信息，概览底部只留两句寄语，不重复署名。
   第一行抒情（衬线），第二行产品理念（更小、无衬线），靠字号/字体分层而不是降透明度，
   两行都用 --text-secondary(#666, 5.7:1) 保住 WCAG AA。 */
.brand-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 32px;
    padding: 18px 0 6px;
    border-top: 1px solid var(--border-light);
    text-align: center;
}
.brand-wish,
.brand-note {
    margin: 0;
    color: var(--text-secondary);
}
.brand-wish {
    font-family: Georgia, "Songti SC", "SimSun", serif;
    font-size: 13px;
    letter-spacing: 0.06em;
}
.brand-note {
    font-size: 12px;
    letter-spacing: 0.02em;
    line-height: 1.6;
}
</style>
