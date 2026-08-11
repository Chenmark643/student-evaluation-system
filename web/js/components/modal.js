/**
 * Modal dialog system
 */

function showModal(title, bodyHtml, footerHtml = '') {
    const overlay = document.getElementById('modal-overlay');
    const materialViewer = document.getElementById('material-viewer-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    overlay.classList.toggle(
        'modal-over-material-viewer',
        !!materialViewer && !materialViewer.classList.contains('hidden')
    );
    overlay.classList.remove('hidden');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay.classList.contains('modal-locked')) return;
    const wasOverMaterialViewer = overlay.classList.contains('modal-over-material-viewer');
    overlay.classList.add('hidden');
    overlay.classList.remove('import-studio-overlay');
    overlay.classList.remove('modal-over-material-viewer');
    if (wasOverMaterialViewer && typeof qualityImportRefreshAfterThreshold === 'function') {
        qualityImportRefreshAfterThreshold();
    }
}

// Click overlay to close
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
});
