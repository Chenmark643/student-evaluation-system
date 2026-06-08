/**
 * Module D: Comprehensive Evaluation UI (综合测评计算) — v2.3
 *
 * Interactive column mapping for all three input files (like Module B).
 * Supports grade/major filter, sports mode selection, output dialog.
 */

let compColumnMappings = {};  // {filepath: {sheet: {id_col, name_col, class_col, score_col}}}
let compGradeFilter = 'all';

function renderModuleComprehensive() {
    document.getElementById('module-title').textContent = '综合测评计算';
    const c = document.getElementById('module-container');
    c.innerHTML = `
        <div class="module-section">
            <h2><span class="step-badge">1</span> 选择上游输出文件并配置列映射</h2>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
                每个文件选择后可点击「映射」按钮预览表格结构并指定列对应关系
            </p>
            ${_compFileMapped('comp-gpa', '📊 学分绩点表', '学分绩点.xlsx')}
            ${_compFileMapped('comp-moral', '📋 德育分表', '德育分.xlsx')}
            ${_compFileMapped('comp-quality', '⭐ 素拓分表', '素拓分.xlsx')}
        </div>

        <div class="module-section">
            <h2><span class="step-badge">2</span> 输出目录</h2>
            <div class="file-picker-row">
                <input id="comp-output-dir" class="file-path" readonly placeholder="选择输出目录...">
                <button class="btn btn-secondary" onclick="pickDirectory('comp-output-dir','选择输出目录')">浏览</button>
            </div>
            <div id="comp-grade-filter" style="margin-top:8px;"></div>
        </div>

        <div class="module-section">
            <h2><span class="step-badge">3</span> 体育成绩设置</h2>
            <div class="options-row" style="flex-direction:column;align-items:flex-start;gap:12px;">
                <label class="toggle-label">
                    <input type="radio" name="comp-sports-mode" value="auto" checked onchange="compSportsMode()">
                    自动检测 — 程序自动判断每个年级是否有体育成绩
                </label>
                <label class="toggle-label">
                    <input type="radio" name="comp-sports-mode" value="all" onchange="compSportsMode()">
                    全部有体育 — 所有年级使用有体育公式
                </label>
                <label class="toggle-label">
                    <input type="radio" name="comp-sports-mode" value="none" onchange="compSportsMode()">
                    全部无体育 — 所有年级使用无体育公式
                </label>
                <label class="toggle-label">
                    <input type="radio" name="comp-sports-mode" value="custom" onchange="compSportsMode()">
                    自定义 — 指定有体育的年级
                </label>
            </div>
            <div id="comp-custom-grades" style="display:none;margin-top:8px;">
                <input id="comp-sports-grades" class="input" style="width:300px;"
                       placeholder="输入年级，逗号分隔，如: 24,25（表示24级和25级有体育）">
            </div>
            <div style="margin-top:12px;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary);">
                <p><strong>有体育:</strong> 综测 = 绩点×0.6 + 德育×0.3 + 体育×0.1 + 素拓</p>
                <p><strong>无体育:</strong> 综测 = 绩点×0.7 + 德育×0.3 + 素拓</p>
            </div>
        </div>

        <div id="comp-progress-area"></div>
        <div class="actions-row">
            <button class="btn btn-ghost btn-sm" onclick="compAskAI()">🤖 AI助手</button>
            <button class="btn btn-ghost" onclick="resetModuleComp()">重置</button>
            <button class="btn btn-primary" id="comp-process-btn" onclick="processComp()">开始计算</button>
        </div>
        <div id="comp-result-area"></div>
    `;
}

function _compFileMapped(id, label, placeholder) {
    return `<div style="margin-bottom:8px;">
        <div class="file-picker-row" style="margin-bottom:4px;">
            <span style="font-size:12px;color:var(--text-secondary);min-width:100px;">${label}</span>
            <input id="${id}-file" class="file-path" readonly placeholder="${placeholder}...">
            <button class="btn btn-secondary btn-sm" onclick="pickFile('${id}-file','选择${label.replace(/📊|📋|⭐/,'')}',[['Excel文件','*.xlsx']])">浏览</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--accent-secondary);"
                    onclick="compPreviewFile('${id}')">👁 映射</button>
        </div>
        <div id="${id}-mapping-status" style="font-size:10px;color:var(--text-muted);margin-left:112px;"></div>
    </div>`;
}

// ============================================================
// Column Mapping Preview
// ============================================================
async function compPreviewFile(fileId) {
    const fileInput = document.getElementById(fileId + '-file');
    const filepath = fileInput?.value?.trim();
    if (!filepath) { showToast('请先选择文件', 'warning'); return; }

    showToast('正在加载文件预览...', 'info');
    try {
        const result = await eel.preview_moral_file(filepath)();
        if (result.error) { showToast(result.error, 'error'); return; }

        if (!compColumnMappings[filepath]) compColumnMappings[filepath] = {};

        let html = '';
        for (const [sn, info] of Object.entries(result)) {
            const headers = info.headers || [];
            const samples = info.sample_rows || [];
            const mapping = compColumnMappings[filepath][sn] || {};

            const colOptions = (selectedIdx, extraLabel = '') => {
                let opts = '<option value="">-- 自动识别 --</option>';
                headers.forEach((h, i) => {
                    const label = h || `列${i}`;
                    opts += `<option value="${i}" ${selectedIdx == i ? 'selected' : ''}>[${i}] ${escapeHtml(label)}</option>`;
                });
                return opts;
            };

            html += `<div style="margin-bottom:16px;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);">
                <h4 style="font-size:13px;color:var(--accent-secondary);margin-bottom:8px;">📋 ${escapeHtml(sn)}</h4>

                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">学号列</label>
                        <select class="select-input comp-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="id_col">
                            ${colOptions(mapping.id_col)}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">姓名列</label>
                        <select class="select-input comp-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="name_col">
                            ${colOptions(mapping.name_col)}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">班级列</label>
                        <select class="select-input comp-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="class_col">
                            ${colOptions(mapping.class_col, '（如无班级列可留空）')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">分数列</label>
                        <select class="select-input comp-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="score_col">
                            ${colOptions(mapping.score_col, '（通常为最后一列）')}
                        </select>
                    </div>
                </div>

                <p style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">数据预览（前5行）：</p>`;

            if (samples.length > 0) {
                html += `<div style="overflow-x:auto;max-width:100%;"><table class="data-table" style="font-size:10px;"><thead><tr>
                    ${headers.map(h => `<th>${escapeHtml(h||'')}</th>`).join('')}</tr></thead><tbody>`;
                for (const row of samples) {
                    html += `<tr>${row.map(cell => `<td>${escapeHtml(cell||'')}</td>`).join('')}</tr>`;
                }
                html += `</tbody></table></div>`;
            }
            html += `</div>`;
        }

        // Determine file type label
        const labels = {'comp-gpa': '学分绩点', 'comp-moral': '德育分', 'comp-quality': '素拓分'};
        const typeLabel = labels[fileId] || '文件';

        showModal(`📊 列映射 — ${typeLabel} — ${escapeHtml(filepath.split(/[\\/]/).pop())}`,
            `<div style="max-height:55vh;overflow-y:auto;">${html}</div>
             <p style="font-size:10px;color:var(--text-muted);margin-top:8px;">
                💡 <strong>${typeLabel}</strong>：指定每列对应的数据类型。分数列通常是最后一列。</p>`,
            `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button>
             <button class="btn btn-primary btn-sm" onclick="compSaveColumnMapping('${filepath.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}','${fileId}')">确认映射</button>`);

        setTimeout(() => {
            document.querySelectorAll('.comp-col-map').forEach(sel => {
                sel.addEventListener('change', function() {
                    const file = this.dataset.file;
                    const sheet = this.dataset.sheet;
                    const field = this.dataset.field;
                    if (!compColumnMappings[file]) compColumnMappings[file] = {};
                    if (!compColumnMappings[file][sheet]) compColumnMappings[file][sheet] = {};
                    compColumnMappings[file][sheet][field] = this.value ? parseInt(this.value) : null;
                });
            });
        }, 100);
    } catch(e) {
        showToast('预览失败: ' + e, 'error');
    }
}

function compSaveColumnMapping(filepath, fileId) {
    closeModal();
    const mapping = compColumnMappings[filepath] || {};
    const sheetCount = Object.keys(mapping).length;
    const statusEl = document.getElementById(fileId + '-mapping-status');
    if (statusEl) statusEl.textContent = `✅ 已映射 ${sheetCount} 个工作表`;
    showToast(`列映射已保存 (${sheetCount} 个工作表)`, 'success');
}

// ============================================================
// Sports Mode
// ============================================================
function compSportsMode() {
    const mode = document.querySelector('input[name="comp-sports-mode"]:checked').value;
    document.getElementById('comp-custom-grades').style.display = mode === 'custom' ? 'block' : 'none';
}

// ============================================================
// AI
// ============================================================
function compAskAI() {
    const gpaFile = document.getElementById('comp-gpa-file')?.value || '';
    const moralFile = document.getElementById('comp-moral-file')?.value || '';
    const qualityFile = document.getElementById('comp-quality-file')?.value || '';
    const mode = document.querySelector('input[name="comp-sports-mode"]:checked')?.value || 'auto';
    let ctx = `综合测评计算模块\n`;
    ctx += `绩点表: ${gpaFile || '未选择'}\n德育表: ${moralFile || '未选择'}\n素拓表: ${qualityFile || '未选择'}\n`;
    ctx += `体育模式: ${mode}\n`;
    const gpaMapping = gpaFile ? (compColumnMappings[gpaFile] ? '已配置' : '未配置') : '-';
    const moralMapping = moralFile ? (compColumnMappings[moralFile] ? '已配置' : '未配置') : '-';
    const qualityMapping = qualityFile ? (compColumnMappings[qualityFile] ? '已配置' : '未配置') : '-';
    ctx += `列映射: 绩点${gpaMapping}, 德育${moralMapping}, 素拓${qualityMapping}\n`;
    ctx += `请根据以上信息提供综测计算建议。`;
    aiPanelOpen(ctx);
}

// ============================================================
// Reset
// ============================================================
function resetModuleComp() {
    compColumnMappings = {};
    compGradeFilter = 'all';
    ['comp-gpa','comp-moral','comp-quality'].forEach(id => {
        const el = document.getElementById(id+'-file');
        if (el) { el.value = ''; el.classList.remove('has-file'); }
        const st = document.getElementById(id+'-mapping-status');
        if (st) st.textContent = '';
    });
    document.getElementById('comp-output-dir').value = '';
    document.getElementById('comp-output-dir').classList.remove('has-file');
    document.getElementById('comp-progress-area').innerHTML = '';
    document.getElementById('comp-result-area').innerHTML = '';
    const gf = document.getElementById('comp-grade-filter');
    if (gf) gf.innerHTML = '';
}

// ============================================================
// Process
// ============================================================
async function processComp() {
    const gpaFile = document.getElementById('comp-gpa-file').value.trim();
    const moralFile = document.getElementById('comp-moral-file').value.trim();
    const qualityFile = document.getElementById('comp-quality-file').value.trim();
    const outputDir = document.getElementById('comp-output-dir').value.trim();
    if (!gpaFile || !moralFile || !qualityFile) { showToast('请选择所有三个文件', 'warning'); return; }
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }

    const mode = document.querySelector('input[name="comp-sports-mode"]:checked').value;
    let hasSports = false, sportsPrograms = [];
    if (mode === 'all') { hasSports = true; }
    else if (mode === 'none') { hasSports = false; }
    else if (mode === 'auto') { hasSports = true; sportsPrograms = []; }
    else if (mode === 'custom') {
        hasSports = true;
        const raw = document.getElementById('comp-sports-grades').value.trim();
        sportsPrograms = raw ? raw.split(/[,，\s]+/).filter(Boolean) : [];
    }

    // Build column mappings dict: {filepath: {sheet: {...}}}
    const colMappings = {};
    for (const fp of [gpaFile, moralFile, qualityFile]) {
        if (compColumnMappings[fp]) {
            colMappings[fp] = compColumnMappings[fp];
        }
    }

    const btn = document.getElementById('comp-process-btn');
    btn.disabled = true; btn.classList.add('processing'); btn.textContent = '处理中...';
    const progress = createProgressBar('comp-progress-area');
    const onP = (e) => progress.update(e.detail.percent, e.detail.message);
    window.addEventListener('progress-update', onP);

    try {
        const result = await eel.run_module_d(
            gpaFile, moralFile, qualityFile, outputDir,
            hasSports, sportsPrograms, colMappings, compGradeFilter
        )();
        if (result.success) {
            document.getElementById('comp-result-area').innerHTML = `
                <div class="result-card">
                    <div class="result-stat"><div class="stat-value">${result.student_count}</div><div class="stat-label">学生</div></div>
                    <div class="result-stat"><div class="stat-value">${result.class_count}</div><div class="stat-label">班级</div></div>
                    <div class="result-stat"><div class="stat-value">${result.program_count}</div><div class="stat-label">专业组</div></div>
                    <div class="result-actions">
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output1.replace(/\\/g,'\\\\')}')()">📂 综测表</button>
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output2.replace(/\\/g,'\\\\')}')()">📂 排名表</button>
                    </div>
                </div>`;
            showOutputDialog(true, `成功计算 ${result.student_count} 名学生的综测成绩`,
                [result.output1, result.output2]);
        } else { showOutputDialog(false, result.error || '处理失败'); }
    } catch(e) { showOutputDialog(false, '处理出错: ' + e); }
    finally {
        btn.disabled = false; btn.classList.remove('processing'); btn.textContent = '开始计算';
        window.removeEventListener('progress-update', onP);
    }
}
