/** Shared Kdocs synchronization flow for every generated workbook. */
const CloudSync = (() => {
    const active = new Set();
    const links = {};
    let pending = null;

    function specs() {
        return [
            { id: 'gpa-main', key: 'college-gpa-main-v1', label: '学分绩点学院总表', shortLabel: '学分绩点表', module: 'gpa', output: () => typeof gpaLastOutputs === 'undefined' ? '' : gpaLastOutputs.main },
            { id: 'gpa-ranking', key: 'college-gpa-ranking-v1', label: '学分绩点排名学院总表', shortLabel: '绩点排名表', module: 'gpa', output: () => typeof gpaLastOutputs === 'undefined' ? '' : gpaLastOutputs.ranking },
            { id: 'moral-main', key: 'college-moral-main-v1', label: '德育学院总表', shortLabel: '德育分表', module: 'moral', output: () => typeof moralLastOutput === 'undefined' ? '' : moralLastOutput, outputs: () => typeof moralCloudOutputs === 'undefined' ? [] : [...moralCloudOutputs] },
            { id: 'quality-main', key: 'college-quality-main-v1', label: '素拓学院总表', shortLabel: '素拓分表', module: 'quality', output: () => typeof qualityLastOutput === 'undefined' ? '' : qualityLastOutput },
            { id: 'comprehensive-main', key: 'college-comprehensive-main-v1', label: '综测学院总表', shortLabel: '综测表', module: 'comprehensive', output: () => typeof comprehensiveLastOutputs === 'undefined' ? '' : comprehensiveLastOutputs.main },
            { id: 'comprehensive-ranking', key: 'college-comprehensive-ranking-v1', label: '综测排名学院总表', shortLabel: '综测排名表', module: 'comprehensive', output: () => typeof comprehensiveLastOutputs === 'undefined' ? '' : comprehensiveLastOutputs.ranking },
        ];
    }

    function find(id) {
        const base = specs().find(item => item.id === id);
        if (!base) return null;
        const paths = (base.outputs ? base.outputs() : [base.output()]).filter(Boolean);
        const fallback = base.output() || '';
        if (!paths.length && fallback) paths.push(fallback);
        return { ...base, path: paths[paths.length - 1] || '', paths };
    }

    function fileName(path) {
        return String(path || '').split(/[\\/]/).pop() || '';
    }

    function wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    function setButtons(id, busy) {
        document.querySelectorAll(`[data-cloud-sync-id="${id}"], [data-cloud-reorder-id="${id}"]`).forEach(button => {
            if (!button.dataset.idleText) button.dataset.idleText = button.textContent;
            button.disabled = busy;
            button.textContent = busy ? '正在处理…' : button.dataset.idleText;
        });
    }

    function showError(message) {
        const detail = String(message || '金山文档接口暂时不可用');
        let summary = '同步没有完成，请稍后重试。已写入的班级会在下次同步时继续处理。';
        if (/rangeData|超过限制|limit/i.test(detail)) summary = '云端批量限制触发，请确认正在使用最新版软件。';
        else if (/400006|登录|鉴权|token|auth/i.test(detail)) summary = '金山文档授权已失效，请重新登录后继续。';
        else if (/timeout|超时|network|网络/i.test(detail)) summary = '网络响应超时。重试会从云端现有状态继续。';
        showModal('云表同步需要处理', `<div class="kdocs-success-card"><span>未完成</span><h3>${escapeHtml(summary)}</h3><p>本地 Excel 不受影响，也不会删除其他专业工作表。</p><details class="kdocs-error-detail"><summary>查看技术详情</summary><pre>${escapeHtml(detail)}</pre></details></div>`, '<button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="closeModal();switchModule(\'cloud\')">打开同步中心</button>');
    }

    function choose(mode) {
        if (!pending) return;
        if (mode === 'current' && !pending.binding?.bound) return;
        pending.mode = mode;
        document.querySelectorAll('.kdocs-target-choice').forEach(card => {
            card.classList.toggle('is-selected', card.dataset.mode === mode);
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = card.dataset.mode === mode;
        });
        const existing = document.getElementById('kdocs-existing-link-row');
        if (existing) existing.hidden = mode !== 'existing';
        const button = document.getElementById('kdocs-confirm-sync');
        if (button) button.textContent = mode === 'new' ? '确认新建并同步' : mode === 'existing' ? '确认绑定并同步' : '确认更新此云表';
    }

    function showTargetConfirm(spec, binding) {
        const defaultMode = binding?.bound ? 'current' : 'new';
        pending = { spec, binding: binding || {}, mode: defaultMode };
        const currentName = binding?.name || binding?.link_url || '尚未绑定云表';
        const sourceFiles = spec.sourceFiles || [fileName(spec.path)];
        const sourceSummary = sourceFiles.length > 1 ? `${sourceFiles.length} 份德育结果` : sourceFiles[0];
        const sourceDetail = sourceFiles.length > 1 ? sourceFiles.join('、') : spec.path;
        showModal(`确认${spec.shortLabel}同步目标`, `
            <div class="kdocs-target-confirm">
                <section class="kdocs-transfer-summary">
                    <span>${sourceFiles.length > 1 ? '本次汇总材料' : '本次同步文件'}</span>
                    <strong>${escapeHtml(sourceSummary)}</strong>
                    <small title="${escapeHtml(sourceDetail)}">${escapeHtml(sourceDetail)}</small>
                </section>
                <p class="kdocs-target-prompt">请选择这份本地表格要同步到哪里：</p>
                <div class="kdocs-target-options">
                    <label class="kdocs-target-choice ${defaultMode === 'current' ? 'is-selected' : ''} ${binding?.bound ? '' : 'is-disabled'}" data-mode="current" onclick="CloudSync.choose('current')">
                        <input type="radio" name="kdocs-target" ${defaultMode === 'current' ? 'checked' : ''} ${binding?.bound ? '' : 'disabled'}>
                        <span><b>更新当前云表</b><small>${escapeHtml(currentName)}</small></span><em>推荐</em>
                    </label>
                    <label class="kdocs-target-choice" data-mode="existing" onclick="CloudSync.choose('existing')">
                        <input type="radio" name="kdocs-target"><span><b>使用已有表格链接</b><small>粘贴同事发来的学院共享表链接</small></span>
                    </label>
                    <label class="kdocs-target-choice ${defaultMode === 'new' ? 'is-selected' : ''}" data-mode="new" onclick="CloudSync.choose('new')">
                        <input type="radio" name="kdocs-target" ${defaultMode === 'new' ? 'checked' : ''}><span><b>新建一份云表</b><small>按本地模板原样上传，并设为以后默认目标</small></span>
                    </label>
                </div>
                <div id="kdocs-existing-link-row" class="kdocs-existing-link-row" hidden>
                    <label>金山文档链接<input id="kdocs-existing-link" class="input" placeholder="https://www.kdocs.cn/l/..."></label>
                </div>
                <p class="kdocs-target-note">${spec.id === 'moral-main' ? `系统已把 A/B 结果整理成 ${Number(spec.classCount) || 0} 个班级工作表${spec.skipped?.length ? `，并排除 ${spec.skipped.length} 个非班级辅助表` : ''}；` : ''}更新或绑定已有云表时，只合并当前文件中的可见工作表；其他专业工作表会保留。新建不会删除原来的云表。</p>
            </div>`, `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button id="kdocs-confirm-sync" class="btn btn-primary" onclick="CloudSync.confirm()">${defaultMode === 'new' ? '确认新建并同步' : '确认更新此云表'}</button>`);
    }

    async function request(specOrId) {
        const spec = typeof specOrId === 'string' ? find(specOrId) : specOrId;
        if (!spec?.path) {
            showToast('请先生成本地表格', 'warning');
            return;
        }
        if (active.has(spec.id)) {
            showToast('这张云表正在同步，请等待当前任务完成', 'warning');
            return;
        }
        const status = await eel.kdocs_auth_status()();
        if (!status?.authenticated) {
            showModal('连接金山文档', '<div class="kdocs-connect-card"><div class="kdocs-cloud-mark">W</div><div><strong>登录后选择同步目标</strong><p>连接账号后，可更新当前云表、绑定已有链接或新建云表。</p></div></div>', '<button class="btn btn-ghost" onclick="closeModal()">暂不连接</button><button class="btn btn-primary" onclick="closeModal();switchModule(\'cloud\')">前往登录页面</button>');
            return;
        }
        if (spec.id === 'moral-main') {
            const prepared = await eel.prepare_moral_cloud_bundle(spec.paths || [spec.path])();
            if (!prepared?.success || !prepared?.output) {
                showToast(prepared?.error || '德育结果汇总失败，请检查本地文件', 'error');
                return;
            }
            spec.path = prepared.output;
            spec.sourceFiles = (spec.paths || []).map(fileName);
            spec.classCount = prepared.class_count || 0;
            spec.skipped = prepared.skipped || [];
        }
        const binding = await eel.kdocs_get_binding(spec.key)();
        showTargetConfirm(spec, binding);
    }

    function showProgress(spec, operation = 'sync') {
        const reordering = operation === 'reorder';
        showModal(reordering ? `正在整理${spec.shortLabel}` : `正在同步${spec.shortLabel}`, `
            <div class="kdocs-sync-progress" aria-live="polite">
                <header><div><span>${reordering ? '学院云表顺序整理' : '学院云表同步'}</span><h3 id="kdocs-progress-stage">正在排队</h3><p id="kdocs-progress-detail">${reordering ? '准备读取全部工作表' : '准备连接金山文档'}</p></div><strong id="kdocs-progress-percent">0%</strong></header>
                <div class="kdocs-progress-track"><span id="kdocs-progress-fill" style="width:0%"></span></div>
                <div class="kdocs-progress-meta"><span id="kdocs-progress-sheet">正在准备工作表列表</span><span id="kdocs-progress-count"></span></div>
                <ol class="kdocs-progress-steps"><li id="kdocs-progress-step-connect"><b>1</b><span>连接并读取云表</span></li><li id="kdocs-progress-step-write"><b>2</b><span>更新数据与格式</span></li><li id="kdocs-progress-step-verify"><b>3</b><span>回读校验并完成</span></li></ol>
                <p class="kdocs-progress-note">${reordering ? '只调整工作表标签顺序，不会修改单元格内容。' : '同步会在后台继续，请保持软件打开。其他专业工作表不会被删除。'}</p>
            </div>`, `<button class="btn btn-secondary" disabled>${reordering ? '整理进行中…' : '同步进行中…'}</button>`);
        document.getElementById('modal-overlay')?.classList.add('modal-locked');
    }

    function updateProgress(progress, id) {
        const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
        const setText = (elementId, value) => { const element = document.getElementById(elementId); if (element) element.textContent = value; };
        setText('kdocs-progress-percent', `${Math.round(percent)}%`);
        setText('kdocs-progress-stage', progress?.stage || '正在同步');
        setText('kdocs-progress-detail', progress?.detail || '请稍候');
        const fill = document.getElementById('kdocs-progress-fill');
        if (fill) fill.style.width = `${percent}%`;
        const index = Number(progress?.sheet_index) || 0;
        const total = Number(progress?.sheet_total) || 0;
        setText('kdocs-progress-sheet', progress?.current_sheet ? `当前工作表：${progress.current_sheet}` : '正在准备工作表列表');
        setText('kdocs-progress-count', total ? `${index}/${total} 个工作表` : '');
        document.getElementById('kdocs-progress-step-connect')?.classList.toggle('is-done', percent >= 14);
        document.getElementById('kdocs-progress-step-write')?.classList.toggle('is-active', percent >= 14 && percent < 92);
        document.getElementById('kdocs-progress-step-write')?.classList.toggle('is-done', percent >= 92);
        document.getElementById('kdocs-progress-step-verify')?.classList.toggle('is-active', percent >= 92 && percent < 100);
        document.getElementById('kdocs-progress-step-verify')?.classList.toggle('is-done', percent >= 100 && progress?.status === 'success');
        const row = document.getElementById(`cloud-sync-${id}`);
        if (row) {
            row.classList.add('is-syncing');
            const state = row.querySelector('.cloud-sync-state small');
            if (state) state.textContent = `${Math.round(percent)}% · ${progress?.stage || '正在同步'}`;
        }
    }

    async function runJob(spec, forceCreate) {
        const started = await eel.kdocs_start_sync_workbook(spec.path, spec.key, !!forceCreate)();
        if (!started?.success || !started?.job_id) return { success: false, error: started?.error || '无法启动云表同步任务' };
        showProgress(spec);
        while (true) {
            const progress = await eel.kdocs_get_sync_progress(started.job_id)();
            if (!progress?.success) return { success: false, error: progress?.error || '无法读取同步进度' };
            updateProgress(progress, spec.id);
            if (progress.done) return progress.result || { success: false, error: '同步任务没有返回结果' };
            await wait(500);
        }
    }

    async function confirm() {
        if (!pending) return;
        const { spec, mode } = pending;
        if (mode === 'existing') {
            const link = (document.getElementById('kdocs-existing-link')?.value || '').trim();
            if (!link) { showToast('请粘贴已有的金山文档链接', 'warning'); return; }
            const bound = await eel.kdocs_bind_workbook(spec.key, link)();
            if (!bound?.success) { showToast(bound?.error || '绑定云表失败', 'error'); return; }
        }
        pending = null;
        closeModal();
        active.add(spec.id);
        setButtons(spec.id, true);
        showToast(`正在同步${spec.shortLabel}，请勿关闭软件`, 'info');
        try {
            const result = await runJob(spec, mode === 'new');
            if (!result?.success) {
                if (result?.needs_login) {
                    showModal('金山文档登录已失效', '<div class="kdocs-connect-card"><div class="kdocs-cloud-mark">W</div><div><strong>需要重新授权</strong><p>本机凭据已过期或当前账号无权访问目标云表。</p></div></div>', '<button class="btn btn-primary" onclick="closeModal();switchModule(\'cloud\')">前往登录页面</button>');
                } else showError(result?.error || '同步失败');
                return;
            }
            links[spec.id] = result.link_url || '';
            const detail = result.created ? '已按本地 Excel 的模板、公式和样式新建云表。' : `已更新所选云表${Number.isFinite(result.changed_cells) ? `，变更 ${result.changed_cells} 个单元格` : ''}。`;
            showModal(`${spec.shortLabel}已同步`, `<div class="kdocs-success-card"><span>同步完成</span><h3>${escapeHtml(result.name || spec.shortLabel)}</h3><p>${escapeHtml(detail)}</p><div class="kdocs-link-preview">${escapeHtml(result.link_url || '')}</div>${(result.created_sheets || []).length ? `<small>新增工作表：${escapeHtml(result.created_sheets.join('、'))}</small>` : ''}</div>`, `<button class="btn btn-ghost" onclick="CloudSync.copyLink('${spec.id}')">复制链接</button><button class="btn btn-primary" onclick="CloudSync.openLink('${spec.id}')">打开金山文档</button>`);
            showToast(result.created ? '金山云表创建成功' : '金山云表更新成功', 'success');
        } catch (error) {
            showError(error);
        } finally {
            document.getElementById('modal-overlay')?.classList.remove('modal-locked');
            active.delete(spec.id);
            setButtons(spec.id, false);
            if (document.getElementById('cloud-sync-list') && typeof refreshCloudWorkspace === 'function') refreshCloudWorkspace();
        }
    }

    async function reorder(id) {
        const spec = find(id);
        if (!spec) return;
        if (active.has(spec.id)) {
            showToast('这张云表正在处理，请等待当前任务完成', 'warning');
            return;
        }
        const binding = await eel.kdocs_get_binding(spec.key)();
        if (!binding?.bound) {
            showToast('请先绑定这类学院云表', 'warning');
            return;
        }
        showModal(`重新整理${spec.shortLabel}`, `<div class="kdocs-success-card"><span>自动排序</span><h3>${escapeHtml(binding.name || spec.shortLabel)}</h3><p>将按“专业 → 年级 → 班级”重新排列全部工作表。只移动标签位置，不修改表内数据。</p></div>`, `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="CloudSync.confirmReorder('${spec.id}')">开始整理</button>`);
    }

    async function confirmReorder(id) {
        const spec = find(id);
        if (!spec) return;
        closeModal();
        active.add(spec.id);
        setButtons(spec.id, true);
        try {
            const started = await eel.kdocs_start_reorder_workbook(spec.key)();
            if (!started?.success || !started?.job_id) throw new Error(started?.error || '无法启动顺序整理任务');
            showProgress(spec, 'reorder');
            let result = null;
            while (true) {
                const progress = await eel.kdocs_get_sync_progress(started.job_id)();
                if (!progress?.success) throw new Error(progress?.error || '无法读取整理进度');
                updateProgress(progress, spec.id);
                if (progress.done) {
                    result = progress.result || { success: false, error: '整理任务没有返回结果' };
                    break;
                }
                await wait(500);
            }
            if (!result?.success) {
                if (result?.needs_login) showToast('金山文档登录已失效，请重新登录', 'error');
                else showError(result?.error || '工作表顺序整理失败');
                return;
            }
            links[spec.id] = result.link_url || '';
            showModal(`${spec.shortLabel}顺序已整理`, `<div class="kdocs-success-card"><span>整理完成</span><h3>已检查 ${Number(result.sheet_count) || 0} 张工作表</h3><p>移动 ${Number(result.moved_sheets) || 0} 次，并已回读确认最终顺序。</p></div>`, `<button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="CloudSync.openLink('${spec.id}')">打开金山文档</button>`);
            showToast('工作表顺序已经整理完成', 'success');
        } catch (error) {
            showError(error);
        } finally {
            document.getElementById('modal-overlay')?.classList.remove('modal-locked');
            active.delete(spec.id);
            setButtons(spec.id, false);
            if (document.getElementById('cloud-sync-list') && typeof refreshCloudWorkspace === 'function') refreshCloudWorkspace();
        }
    }

    async function openLink(id) {
        const link = links[id];
        if (!link) { showToast('还没有可打开的云表链接', 'warning'); return; }
        const result = await eel.open_web_link(link)();
        if (!result?.success) showToast(result?.error || '无法打开链接', 'error');
    }

    async function copyLink(id) {
        const link = links[id];
        if (!link) { showToast('还没有可复制的云表链接', 'warning'); return; }
        try { await navigator.clipboard.writeText(link); showToast('金山文档链接已复制', 'success'); }
        catch (_) { showToast('复制失败，请手动选择上方链接', 'warning'); }
    }

    return { specs, find, request, choose, confirm, reorder, confirmReorder, openLink, copyLink };
})();
