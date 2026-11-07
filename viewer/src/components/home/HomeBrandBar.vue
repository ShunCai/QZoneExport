<template>
    <footer class="brand-bar">
        <span class="brand-mark">Q</span>
        <span class="brand-name">QQ空间导出助手</span>
        <span class="brand-sub">QQ空间备份查看器</span>
        <a
            class="brand-link"
            href="https://github.com/ShunCai/QZoneExport"
            target="_blank"
            rel="noreferrer"
        >GitHub · 点个 Star</a>
    </footer>
</template>

<style scoped>
.brand-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 32px;
    padding: 12px 18px;
    border: 1px solid var(--border-card);
    border-radius: 12px;
    background: var(--bg-primary);
    font-size: 12px;
    color: var(--text-muted);
}
.brand-mark {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
}
.brand-name {
    font-weight: 500;
    color: var(--text-secondary);
}
.brand-link {
    margin-left: auto;
    color: var(--text-muted);
    text-decoration: none;
}
.brand-link:hover {
    color: var(--accent-pressed);
}
</style>
