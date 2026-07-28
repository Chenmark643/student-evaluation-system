(function () {
    const KEY = 'evaluation_current_major_v1';
    function get() { return (localStorage.getItem(KEY) || '').trim(); }
    function refresh() {
        document.querySelectorAll('[data-major-scope-label]').forEach(el => {
            el.textContent = get() || '未设置专业';
            el.title = get() ? `当前仅处理和导出：${get()}` : '设置你负责的专业';
        });
        document.querySelectorAll('[data-cloud-major]').forEach(el => {
            el.textContent = get() || '尚未设置';
        });
        document.body.classList.toggle('major-scope-unset', !get());
        if (typeof window.moralRefreshReadySummary === 'function') {
            window.moralRefreshReadySummary('continue');
            window.moralRefreshReadySummary('fresh');
        }
    }
    function open() {
        const value = get().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        showModal('专业分类', `<div class="major-scope-dialog">
            <div class="major-scope-hero"><span class="major-scope-icon">专</span><div><strong>设置你负责的专业</strong><p>设置一次后，绩点、德育、素拓与综测只导出该专业。混合专业源文件也会自动隔离。</p></div></div>
            <label class="major-scope-field">专业名称<input id="major-scope-input" class="input" value="${value}" placeholder="例如：顿河信" autocomplete="off"></label>
            <div class="major-scope-suggestions"><span>常用：</span>${['顿河交','顿河土','顿河信','国电'].map(x => `<button type="button" onclick="document.getElementById('major-scope-input').value='${x}'">${x}</button>`).join('')}</div>
            <p class="major-scope-note">专业名称会与班级前缀自动匹配，例如“顿河信”可匹配“顿河信251”。也支持输入以后新增的专业名称。</p></div>`,
            `<button class="btn btn-ghost" onclick="MajorScope.clear()">清除设置</button><button class="btn btn-primary" onclick="MajorScope.save()">保存并应用</button>`);
        setTimeout(() => document.getElementById('major-scope-input')?.focus(), 50);
    }
    function save() {
        const value = (document.getElementById('major-scope-input')?.value || '').trim();
        if (!value) { showToast('请输入专业名称', 'warning'); return; }
        localStorage.setItem(KEY, value); closeModal(); refresh(); showToast(`当前专业已设为：${value}`, 'success');
    }
    function clear() { localStorage.removeItem(KEY); closeModal(); refresh(); showToast('已清除专业范围', 'info'); }
    function requireForExport() {
        if (get()) return true;
        open(); showToast('请先设置你负责的专业', 'warning'); return false;
    }
    window.MajorScope = { get, refresh, open, save, clear, requireForExport };
    document.addEventListener('DOMContentLoaded', refresh);
})();
