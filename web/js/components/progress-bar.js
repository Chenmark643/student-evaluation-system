/**
 * Progress bar component
 * Creates an animated progress bar with percentage and status message.
 */

function createProgressBar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const html = `
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" style="width:0%"></div>
            </div>
            <div class="progress-text">
                <span class="progress-status">就绪</span>
                <span class="progress-pct">0%</span>
            </div>
        </div>
    `;
    container.innerHTML = html;

    return {
        update(percent, message) {
            const fill = container.querySelector('.progress-fill');
            const status = container.querySelector('.progress-status');
            const pct = container.querySelector('.progress-pct');
            if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            if (status) status.textContent = message || '';
            if (pct) pct.textContent = `${Math.round(percent)}%`;
        },
        done(message) {
            this.update(100, message || '完成');
        },
        reset() {
            this.update(0, '就绪');
        },
        hide() {
            container.innerHTML = '';
        },
        show() {
            if (!container.querySelector('.progress-container')) {
                container.innerHTML = html;
            }
        }
    };
}
