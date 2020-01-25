console.info('JS注入完成');

function initExportBtn() {
    // 创建相册按钮
    let newAlbumBtn = document.getElementById('js-oper-createAlbum');
    if (!newAlbumBtn) {
        return
    }
    newAlbumBtn = newAlbumBtn.parentNode
    // 创建相册按钮后添加助手导出
    let exportBtn = document.createElement('div')
    exportBtn.className = 'photo-op-item'
    exportBtn.innerHTML = '<a class="c-tx2 bg3 bor gb-btn-nor">助手导出</a>'
    newAlbumBtn.parentNode.insertBefore(exportBtn, newAlbumBtn.nextSibling)
}
window.addEventListener('load', initExportBtn(), false);