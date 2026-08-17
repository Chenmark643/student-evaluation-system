/**
 * Module D: Comprehensive Evaluation UI (综合测评计算) — v2.3
 *
 * Interactive column mapping for all three input files (like Module B).
 * Supports grade/major filter, sports mode selection, output dialog.
 */

let compColumnMappings = {};  // {filepath: {sheet: {id_col, name_col, class_col, score_col}}}
let compGradeFilter = 'all';
let comprehensiveLastOutputs = { main: '', ranking: '' };

function renderModuleComprehensive() {
    document.getElementById('module-title').textContent = '综合测评计算';
    const c = document.getElementById('module-container');
    c.innerHTML = `
        <div class="comp-workspace">
            <section class="comp-hero">
                <div class="comp-hero-copy">
                    <span class="comp-kicker">SEMESTER EVALUATION LEDGER</span>
                    <h2>把三份上游结果，汇成一份可复核的综合测评</h2>
                    <p>依次核对绩点、德育与素拓来源，确认体育成绩口径后，一次生成综测总表与排名表。</p>
                </div>
                <div class="comp-ledger-mark" aria-label="综测计算组成">
                    <small>计算主线</small><strong>绩点 · 德育 · 素拓</strong><span>两份结果表</span>
                </div>
            </section>

            <section class="comp-panel comp-source-panel">
                <header><div><span>STEP 01 · SOURCE FILES</span><h3>核对三份上游结果</h3></div><p>每份文件都需要完成检查与列映射</p></header>
                <div class="comp-file-grid">
                    ${_compFileMapped('comp-gpa', '01', '学分绩点表', '学分绩点.xlsx', '用于学业成绩权重')}
                    ${_compFileMapped('comp-moral', '02', '德育分表', '德育分.xlsx', '用于德育成绩权重')}
                    ${_compFileMapped('comp-quality', '03', '素拓分表', '素拓分.xlsx', '作为素质拓展加分')}
                </div>
            </section>

            <div class="comp-settings-grid">
                <section class="comp-panel comp-output-panel">
                    <header><div><span>STEP 02 · OUTPUT</span><h3>设置保存位置</h3></div><p>生成综测表与排名表</p></header>
                    <label class="comp-field-label" for="comp-output-dir">输出目录</label>
                    <div class="file-picker-row comp-dir-row">
                        <input id="comp-output-dir" class="file-path" readonly placeholder="选择保存两份结果表的文件夹">
                        <button type="button" class="btn btn-secondary" onclick="pickDirectory('comp-output-dir','选择输出目录')">浏览</button>
                    </div>
                    <div id="comp-grade-filter" class="comp-grade-filter"></div>
                    <div class="comp-deliverables"><span><b>I</b>综测总表</span><span><b>II</b>综测排名表</span></div>
                </section>

                <section class="comp-panel comp-sports-panel">
                    <header><div><span>STEP 03 · SCORING RULE</span><h3>确认体育成绩口径</h3></div><p>默认按年级自动检测</p></header>
                    <div class="comp-sports-options" role="radiogroup" aria-label="体育成绩设置">
                        ${_compSportsOption('auto', '自动检测', '逐个年级判断是否存在体育成绩', true)}
                        ${_compSportsOption('all', '全部有体育', '所有年级使用含体育公式')}
                        ${_compSportsOption('none', '全部无体育', '所有年级使用无体育公式')}
                        ${_compSportsOption('custom', '指定年级', '仅指定年级计入体育成绩')}
                    </div>
                    <div id="comp-custom-grades" class="comp-custom-grades" hidden>
                        <label for="comp-sports-grades">有体育成绩的年级</label>
                        <input id="comp-sports-grades" class="input" placeholder="例如：24, 25">
                    </div>
                </section>
            </div>

            <section class="comp-formula-band" aria-label="综合测评计算公式">
                <div><span>有体育</span><strong>绩点 × 0.6 ＋ 德育 × 0.3 ＋ 体育 × 0.1 ＋ 素拓</strong></div>
                <i></i>
                <div><span>无体育</span><strong>绩点 × 0.7 ＋ 德育 × 0.3 ＋ 素拓</strong></div>
            </section>

            <div id="comp-progress-area"></div>
            <div class="comp-actionbar">
                <div><span>READY TO CALCULATE</span><strong>检查三份来源和保存位置后开始生成</strong></div>
                <div><button type="button" class="btn btn-ghost" onclick="resetModuleComp()">重置本页</button><button type="button" class="btn btn-primary" id="comp-process-btn" onclick="processComp()">生成综测与排名表 →</button></div>
            </div>
            <div id="comp-result-area"></div>
        </div>
    `;
    const finishedMoral = CompletionCelebration.state().moral?.detail || '';
    if (finishedMoral && CompletionCelebration.state().moral?.done) {
        const input = document.getElementById('comp-moral-file');
        if (input) { input.value = finishedMoral; input.classList.add('has-file'); }
        const status = document.getElementById('comp-moral-mapping-status');
        if (status) status.textContent = '已带入上传的德育分成品，请点击“检查与映射”确认';
    }
}

function _compFileMapped(id, number, label, placeholder, description) {
    return `<article class="comp-file-card">
        <div class="comp-file-number">${number}</div>
        <div class="comp-file-copy"><small>SOURCE WORKBOOK</small><h4>${label}</h4><p>${description}</p></div>
        <input id="${id}-file" class="file-path" readonly aria-label="${label}文件路径" placeholder="${placeholder}...">
        <div class="comp-file-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick="pickFile('${id}-file','选择${label}',[['Excel文件','*.xlsx']])">选择文件</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="compOpenImportStudio('${id}')">检查与映射</button>
        </div>
        <div id="${id}-mapping-status" class="comp-mapping-status">等待选择文件</div>
    </article>`;
}

function _compSportsOption(value, title, description, checked = false) {
    return `<label><input type="radio" name="comp-sports-mode" value="${value}" ${checked ? 'checked' : ''} onchange="compSportsMode()"><span><strong>${title}</strong><small>${description}</small></span></label>`;
}

async function compOpenImportStudio(fileId) {
    const filepath = document.getElementById(fileId + '-file')?.value?.trim();
    if (!filepath) { showToast('请先选择文件', 'warning'); return; }
    const typeMap = {'comp-gpa':'gpa','comp-moral':'moral','comp-quality':'quality'};
    const labelMap = {'comp-gpa':'学分绩点','comp-moral':'德育分','comp-quality':'素拓分'};
    await ImportStudio.open({
        path: filepath,
        moduleType: typeMap[fileId],
        title: `${labelMap[fileId]} · 导入工作台`,
        onConfirm: (mappings, analysis) => {
            compColumnMappings[filepath] = mappings;
            const enabled = Object.values(mappings).filter(m => m.enabled).length;
            const rows = analysis.sheets.filter((_,i)=>Object.values(mappings)[i]?.enabled).reduce((n,s)=>n+(s.valid_rows||0),0);
            const status = document.getElementById(fileId + '-mapping-status');
            if (status) status.innerHTML = `<span class="import-file-health"><strong>✓ 已配置</strong><span>${enabled} 个工作表 · ${rows} 条候选数据</span></span>`;
        }
    });
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
    const custom = document.getElementById('comp-custom-grades');
    custom.hidden = mode !== 'custom';
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
    comprehensiveLastOutputs = { main: '', ranking: '' };
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

function openComprehensiveOutput(kind) {
    const path = comprehensiveLastOutputs[kind];
    if (path) eel.open_file_explorer(path)();
}

// ============================================================
// Process
// ============================================================
async function processComp() {
    if (!MajorScope.requireForExport()) return;
    const gpaFile = document.getElementById('comp-gpa-file').value.trim();
    const moralFile = document.getElementById('comp-moral-file').value.trim();
    const qualityFile = document.getElementById('comp-quality-file').value.trim();
    const outputDir = document.getElementById('comp-output-dir').value.trim();
    if (!gpaFile || !moralFile || !qualityFile) { showToast('请选择所有三个文件', 'warning'); return; }
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }
    const unconfigured = [gpaFile, moralFile, qualityFile].filter(path => !compColumnMappings[path]);
    if (unconfigured.length) {
        showToast('请先对三个源文件执行“检查与映射”', 'warning');
        return;
    }

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
            hasSports, sportsPrograms, colMappings, compGradeFilter, MajorScope.get()
        )();
        if (result.success) {
            comprehensiveLastOutputs = { main: result.output1, ranking: result.output2 };
            document.getElementById('comp-result-area').innerHTML = `
                <section class="comp-result-card">
                    <div class="comp-result-seal">完成</div>
                    <div class="comp-result-copy"><span>SEMESTER RESULT · 已生成</span><h3>${result.student_count} 名学生已完成综合测评</h3><p>${result.class_count} 个班级 · ${result.program_count} 个专业组 · 共生成两份结果表</p></div>
                    <div class="comp-result-stats"><span><b>${result.student_count}</b>学生</span><span><b>${result.class_count}</b>班级</span><span><b>${result.program_count}</b>专业组</span></div>
                    <div class="comp-result-actions">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openComprehensiveOutput('main')">打开综测表</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openComprehensiveOutput('ranking')">打开排名表</button>
                        <button type="button" data-cloud-sync-id="comprehensive-main" class="btn btn-primary btn-sm" onclick="CloudSync.request('comprehensive-main')">同步综测云表</button>
                        <button type="button" data-cloud-sync-id="comprehensive-ranking" class="btn btn-primary btn-sm" onclick="CloudSync.request('comprehensive-ranking')">同步综测排名</button>
                    </div>
                </section>`;
            CompletionCelebration.mark('comprehensive', result.output1);
            showOutputDialog(true, `成功计算 ${result.student_count} 名学生的综测成绩`,
                [result.output1, result.output2]);
        } else { showOutputDialog(false, result.error || '处理失败'); }
    } catch(e) { showOutputDialog(false, '处理出错: ' + e); }
    finally {
        btn.disabled = false; btn.classList.remove('processing'); btn.textContent = '生成综测与排名表 →';
        window.removeEventListener('progress-update', onP);
    }
}
