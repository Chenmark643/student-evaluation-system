/**
 * Module B: Moral Education Score UI (德育分计算) — v2.3
 *
 * - Roster import & class/student selection (like Module C)
 * - Multi-file per category with preview & column mapping
 * - Manual score input for ALL data-less fields
 * - Column selection for export
 * - Grade/major export filter
 */

let moralReviewScores = {};
let moralManualScores = {};  // Extended manual scores: {sid: {field: value}}
let moralUndoStack = [];     // Undo stack: [{sid, field, oldVal, newVal}]
let moralFileLists = {};
let moralPreviewCache = {};
let moralRoster = {};       // {sid: {name, class}}
let moralCurrentSid = '';
let moralCurrentClass = '';
let moralSelectedColumns = null;  // null = all columns

const MANUAL_FIELDS = ['晚寝负责人', '青年大学习', '通报批评', '违纪情况'];
const DEFAULT_MORAL_HEADERS = [
    '学号', '姓名',
    '基础分', '评议分', '晚寝负责人',
    '早晚自习出勤', '课堂出勤', '出勤总',
    '宿舍卫生', '教室卫生', '卫生总',
    '团课出勤', '青年大学习', '通报批评', '违纪情况',
    '德育分',
];
let ALL_MORAL_HEADERS = [...DEFAULT_MORAL_HEADERS];  // mutable — user can add custom columns
let moralCustomFields = {};  // {sid: {customFieldName: value}} — arbitrary custom columns

async function renderModuleMoral() {
    document.getElementById('module-title').textContent = '德育分计算';
    const container = document.getElementById('module-container');
    container.innerHTML = `
        <div class="module-section">
            <h2><span class="step-badge">1</span> 导入花名册（学分绩点文件）</h2>
            <div class="file-picker-row">
                <input id="moral-roster-file" class="file-path" readonly
                       placeholder="选择学分绩点.xlsx 作为花名册...">
                <button class="btn btn-secondary" onclick="pickFile('moral-roster-file','选择学分绩点文件',[['Excel文件','*.xlsx']])">
                    浏览
                </button>
                <button class="btn btn-teal btn-sm" onclick="moralImportRoster()">导入</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-warning);" onclick="moralDebugRoster()" title="查看花名册加载结果">🔍 诊断</button>
            </div>
            <div id="moral-roster-status" style="margin-top:6px;font-size:11px;color:var(--text-muted);"></div>
        </div>

        <div class="module-section">
            <h2><span class="step-badge">2</span> 数据源文件（每类可多选）</h2>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
                选择文件后可点击「映射」查看表格结构，选择正确的列对应关系
            </p>
            ${_fileCategory('moral-absence', '早晚自习出勤（旷课扣分）', '旷课统计表')}
            ${_fileCategory('moral-class-absence', '课堂出勤（旷课扣分）', '课堂旷课统计')}
            ${_fileCategory('moral-dormitory', '宿舍卫生（加分）', '宿舍卫生表')}
            ${_fileCategory('moral-classroom', '教室卫生（加分）', '教室卫生表')}
            ${_fileCategory('moral-orgclass', '团课出勤（扣分）', '团课旷课统计')}
        </div>

        <div class="module-section" id="moral-manual-section" style="display:none;">
            <h2><span class="step-badge">3</span> 手动录入分数</h2>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
                搜索学生（可跨班级），录入无数据支撑的分数项
            </p>
            <div class="form-row" style="margin-bottom:8px;flex-wrap:wrap;">
                <div class="form-group"><label>🔍 搜索学生</label>
                    <input id="moral-student-search" class="input" style="width:200px;"
                           placeholder="输入学号或姓名..." oninput="moralSearchStudent()"></div>
                <div class="form-group"><label>班级</label>
                    <select id="moral-class-sel" class="select-input" style="width:140px;" onchange="moralOnClass()">
                        <option value="">-- 全部 --</option></select></div>
                <div class="form-group"><label>学生</label>
                    <select id="moral-student-sel" class="select-input" style="width:160px;" onchange="moralOnStudent()">
                        <option value="">-- 学生 --</option></select></div>
            </div>
            <div id="moral-manual-fields" class="form-row" style="flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            </div>
            <div class="form-row" style="flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                <div class="form-group"><label>自定义字段</label>
                    <input id="moral-custom-field" class="input" style="width:90px;" placeholder="字段名"></div>
                <div class="form-group"><label>值</label>
                    <input id="moral-custom-value" class="input" type="number" style="width:70px;" placeholder="0" step="0.5"></div>
                <button class="btn btn-primary btn-sm" style="align-self:flex-end;" onclick="moralAddManual()">+ 保存</button>
            </div>
            <div id="moral-manual-list" style="max-height:150px;overflow-y:auto;font-size:12px;color:var(--text-muted);">
                尚未录入手动分数
            </div>
        </div>

        <div class="module-section">
            <h2><span class="step-badge">4</span> 导出设置</h2>
            <div class="file-picker-row">
                <input id="moral-output-dir" class="file-path" readonly placeholder="选择输出目录...">
                <button class="btn btn-secondary" onclick="pickDirectory('moral-output-dir','选择输出目录')">浏览</button>
            </div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:11px;color:var(--text-muted);">导出列选择:</span>
            </div>
            <div id="moral-column-select" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;"></div>
            <button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="moralAddCustomColumn()">+ 添加自定义列</button>
            <div id="moral-grade-filter" style="margin-top:8px;"></div>
        </div>

        <div id="moral-progress-area"></div>

        <div class="actions-row">
            <button class="btn btn-ghost btn-sm" onclick="moralAskAI()">🤖 AI助手</button>
            <button class="btn btn-ghost" onclick="resetModuleMoral()">重置</button>
            <button class="btn btn-primary" id="moral-process-btn" onclick="processMoral()">开始计算</button>
        </div>
        <div id="moral-result-area"></div>
    `;

    moralRenderColumnSelector();
    moralRenderManualList();

    // Restore file lists if we have them in memory
    for (const catId of Object.keys(moralFileLists)) {
        moralRenderFileList(catId);
    }
}

function _fileCategory(id, label, placeholder) {
    return `
        <div style="margin-bottom:8px;">
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${label}</label>
            <div id="${id}-list" style="margin-bottom:4px;"></div>
            <button class="btn btn-ghost btn-sm" onclick="moralAddFile('${id}','${label.replace(/'/g,"\\'")}')">
                + 添加文件
            </button>
        </div>`;
}

// ============================================================
// Roster Import (like Module C)
// ============================================================
async function moralImportRoster() {
    const path = document.getElementById('moral-roster-file').value.trim();
    if (!path) { showToast('请先选择学分绩点文件', 'warning'); return; }

    try {
        const result = await eel.read_roster_for_quality(path)();
        if (result && Object.keys(result).length > 0) {
            moralRoster = result;
            const classes = new Set();
            for (const [sid, info] of Object.entries(result)) {
                classes.add(info.class);
            }
            const sortedClasses = [...classes].sort();
            const sel = document.getElementById('moral-class-sel');
            sel.innerHTML = '<option value="">-- 班级 --</option>';
            sortedClasses.forEach(cls => {
                const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o);
            });
            document.getElementById('moral-manual-section').style.display = 'block';
            moralRenderManualFields();  // Populate dynamic fields
            document.getElementById('moral-roster-status').textContent =
                `已导入 ${Object.keys(result).length} 名学生, ${sortedClasses.length} 个班级`;

            // Render grade filter for export
            renderGradeFilter('moral-grade-filter', sortedClasses, moralSetGradeFilter);

            showToast('花名册导入成功', 'success');
        }
    } catch(e) {
        showToast('导入失败: ' + e, 'error');
    }
}

let moralExportGradeFilter = 'all';
function moralSetGradeFilter(grade) {
    moralExportGradeFilter = grade;
}

function moralOnClass() {
    moralCurrentClass = document.getElementById('moral-class-sel').value;
    moralCurrentSid = '';
    const sel = document.getElementById('moral-student-sel');
    sel.innerHTML = '<option value="">-- 学生 --</option>';
    const searchTerm = (document.getElementById('moral-student-search')?.value || '').trim().toLowerCase();
    for (const [sid, info] of Object.entries(moralRoster)) {
        if (moralCurrentClass && info.class !== moralCurrentClass) continue;
        if (searchTerm && !sid.includes(searchTerm) && !info.name.toLowerCase().includes(searchTerm)) continue;
        const o = document.createElement('option'); o.value = sid;
        o.textContent = `${info.name} (${sid}) [${info.class}]`; sel.appendChild(o);
    }
    moralRenderCurrent();
}

function moralSearchStudent() {
    const searchTerm = (document.getElementById('moral-student-search')?.value || '').trim();
    const sel = document.getElementById('moral-student-sel');
    sel.innerHTML = '<option value="">-- 学生 --</option>';
    const classSel = document.getElementById('moral-class-sel');
    // Set class to "all" when searching
    if (searchTerm && classSel) classSel.value = '';
    moralCurrentClass = classSel?.value || '';

    const lowerSearch = searchTerm.toLowerCase();
    for (const [sid, info] of Object.entries(moralRoster)) {
        if (moralCurrentClass && info.class !== moralCurrentClass) continue;
        if (lowerSearch && !sid.includes(lowerSearch) && !info.name.toLowerCase().includes(lowerSearch)) continue;
        const o = document.createElement('option'); o.value = sid;
        o.textContent = `${info.name} (${sid}) [${info.class}]`; sel.appendChild(o);
    }
}

// Dynamically render manual entry fields based on current headers
function moralRenderManualFields() {
    const container = document.getElementById('moral-manual-fields');
    if (!container) return;

    // Get fields that should be manually editable (exclude auto-calculated and structural)
    const autoFields = ['学号', '姓名', '基础分', '出勤总', '卫生总', '德育分',
                        '早晚自习出勤', '课堂出勤', '宿舍卫生', '教室卫生', '团课出勤'];
    const manualFields = ALL_MORAL_HEADERS.filter(h => !autoFields.includes(h));

    container.innerHTML = manualFields.map(h => `
        <div class="form-group"><label>${escapeHtml(h)}</label>
            <input id="moral-input-${h.replace(/[^a-zA-Z0-9一-鿿]/g,'_')}"
                   class="input moral-manual-input" type="number"
                   style="width:70px;" placeholder="0" step="0.5"
                   data-field="${escapeHtml(h)}"></div>
    `).join('');
}

function moralOnStudent() {
    moralCurrentSid = document.getElementById('moral-student-sel').value;
    moralRenderCurrent();
}

function moralRenderCurrent() {
    if (!moralCurrentSid) return;
    const manual = moralManualScores[moralCurrentSid] || {};
    // Dynamic fields
    document.querySelectorAll('.moral-manual-input').forEach(inp => {
        const field = inp.dataset.field;
        if (field === '评议分') {
            inp.value = moralReviewScores[moralCurrentSid] || '';
        } else {
            inp.value = manual[field] || '';
        }
    });
}

function moralUndo() {
    if (moralUndoStack.length === 0) { showToast('没有可撤销的操作', 'info'); return; }
    const action = moralUndoStack.pop();
    if (action.field === '评议分') {
        if (action.oldVal !== 0) moralReviewScores[action.sid] = action.oldVal;
        else delete moralReviewScores[action.sid];
    } else {
        if (!moralManualScores[action.sid]) moralManualScores[action.sid] = {};
        if (action.oldVal !== 0) moralManualScores[action.sid][action.field] = action.oldVal;
        else delete moralManualScores[action.sid][action.field];
    }
    moralRenderManualList();
    moralRenderCurrent();
    showToast(`已撤销：${action.field}=${action.oldVal}`, 'info');
}
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z' && typeof inWorkspace !== 'undefined' && inWorkspace && typeof currentModule !== 'undefined' && currentModule === 'moral') {
        if (moralUndoStack.length > 0) { e.preventDefault(); moralUndo(); }
    }
});

function moralAddManual() {
    if (!moralCurrentSid) { showToast('请选择学生', 'warning'); return; }

    if (!moralManualScores[moralCurrentSid]) moralManualScores[moralCurrentSid] = {};
    const m = moralManualScores[moralCurrentSid];

    // Read all dynamic fields
    document.querySelectorAll('.moral-manual-input').forEach(inp => {
        const field = inp.dataset.field;
        const oldVal = field === '评议分' ? (moralReviewScores[moralCurrentSid] || 0) : (m[field] || 0);
        const val = parseFloat(inp.value) || 0;
        if (oldVal !== val) moralUndoStack.push({ sid: moralCurrentSid, field, oldVal, newVal: val });
        if (field === '评议分') {
            if (val !== 0) moralReviewScores[moralCurrentSid] = val;
            else delete moralReviewScores[moralCurrentSid];
        } else {
            if (val !== 0) m[field] = val;
            else delete m[field];
        }
    });

    // Custom field
    const customField = document.getElementById('moral-custom-field').value.trim();
    const customValue = parseFloat(document.getElementById('moral-custom-value').value) || 0;
    if (customField && customValue !== 0) {
        m[customField] = customValue;
        if (!ALL_MORAL_HEADERS.includes(customField)) {
            const idx = ALL_MORAL_HEADERS.indexOf('德育分');
            ALL_MORAL_HEADERS.splice(idx >= 0 ? idx : ALL_MORAL_HEADERS.length, 0, customField);
            if (moralSelectedColumns && !moralSelectedColumns.includes(customField)) {
                moralSelectedColumns.splice(idx >= 0 ? idx : moralSelectedColumns.length, 0, customField);
            }
            moralRenderColumnSelector();
            moralRenderManualFields();  // Refresh fields to include new custom column
        }
    } else if (customField && customValue === 0) {
        delete m[customField];
    }

    if (Object.keys(m).length === 0) delete moralManualScores[moralCurrentSid];

    document.getElementById('moral-custom-field').value = '';
    document.getElementById('moral-custom-value').value = '';

    moralRenderManualList();
    moralRenderCurrent();
    showToast('已保存', 'success');
}

function moralRenderManualList() {
    const el = document.getElementById('moral-manual-list');
    if (!el) return;
    const allEntries = [];
    for (const [sid, fields] of Object.entries(moralManualScores)) {
        for (const [field, val] of Object.entries(fields)) {
            if (val !== 0) allEntries.push({sid, field, val});
        }
    }
    for (const [sid, val] of Object.entries(moralReviewScores)) {
        if (val !== 0) allEntries.push({sid, field: '评议分', val});
    }
    if (allEntries.length === 0) {
        el.innerHTML = '<span style="color:var(--text-muted);">尚未录入手动分数</span>';
        return;
    }
    el.innerHTML = allEntries.map(({sid, field, val}) => {
        const info = moralRoster[sid] || {};
        const safeField = field.replace(/'/g, "\\'");
        const safeSid = sid.replace(/'/g, "\\'");
        return `<div class="file-list-item" style="padding:2px 8px;">
            <span>${escapeHtml(sid)} ${escapeHtml(info.name||'')}: <strong>${escapeHtml(field)}=${val}</strong></span>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-error);padding:0 4px;"
                    onclick="moralDeleteManual('${safeSid}','${safeField}')">✕</button>
        </div>`;
    }).join('');
}

function moralDeleteManual(sid, field) {
    if (field === '评议分') {
        delete moralReviewScores[sid];
    } else if (moralManualScores[sid]) {
        delete moralManualScores[sid][field];
        if (Object.keys(moralManualScores[sid]).length === 0) delete moralManualScores[sid];
    }
    moralRenderManualList();
}

// ============================================================
// Column Selection for Export
// ============================================================
function moralRenderColumnSelector() {
    const container = document.getElementById('moral-column-select');
    if (!container) return;

    // Default: all selected
    if (moralSelectedColumns === null) {
        moralSelectedColumns = [...ALL_MORAL_HEADERS];
    }

    container.innerHTML = ALL_MORAL_HEADERS.map(h => {
        const checked = moralSelectedColumns.includes(h);
        return `<span class="grade-filter-chip ${checked ? 'active' : ''}"
                    style="cursor:pointer;" onclick="moralToggleColumn('${h.replace(/'/g,"\\'")}')">${escapeHtml(h)}</span>`;
    }).join('');
}

function moralAddCustomColumn() {
    const name = prompt('输入新列表头名称：', '');
    if (!name || !name.trim()) return;
    const h = name.trim();
    if (ALL_MORAL_HEADERS.includes(h)) { showToast('该列已存在', 'warning'); return; }
    // Insert before 德育分
    const idx = ALL_MORAL_HEADERS.indexOf('德育分');
    ALL_MORAL_HEADERS.splice(idx >= 0 ? idx : ALL_MORAL_HEADERS.length, 0, h);
    if (moralSelectedColumns === null) moralSelectedColumns = [...ALL_MORAL_HEADERS];
    else if (!moralSelectedColumns.includes(h)) {
        moralSelectedColumns.splice(idx >= 0 ? idx : moralSelectedColumns.length, 0, h);
    }
    moralRenderColumnSelector();
    moralRenderManualFields();  // Sync manual entry fields
}

function moralToggleColumn(header) {
    const idx = moralSelectedColumns.indexOf(header);
    if (idx >= 0) {
        moralSelectedColumns.splice(idx, 1);
    } else {
        // Re-insert at original ALL_MORAL_HEADERS position to preserve order
        moralSelectedColumns = ALL_MORAL_HEADERS.filter(h => moralSelectedColumns.includes(h) || h === header);
    }
    moralRenderColumnSelector();
    moralRenderManualFields();  // Sync — new column appears in manual entry immediately
}

// ============================================================
// File Management
// ============================================================
function moralAddFile(catId, title) {
    if (!moralFileLists[catId]) moralFileLists[catId] = [];
    eel.select_files([['Excel文件', '*.xls *.xlsx']], title)(paths => {
        if (paths && paths.length > 0) {
            for (const p of paths) {
                if (!moralFileLists[catId].includes(p)) {
                    moralFileLists[catId].push(p);
                }
            }
            moralRenderFileList(catId);
        }
    });
}

function moralRenderFileList(catId) {
    const list = document.getElementById(catId + '-list');
    if (!list) return;
    const files = moralFileLists[catId] || [];
    if (files.length === 0) {
        list.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">未选择</span>';
        return;
    }
    list.innerHTML = files.map((f, i) => `
        <div class="file-list-item" style="padding:2px 8px;margin:2px 0;">
            <span style="flex:1;font-size:11px;">${escapeHtml(f.split(/[\\/]/).pop())}</span>
            <button class="btn btn-ghost btn-sm" style="color:var(--accent-secondary);padding:0 4px;"
                    onclick="moralPreviewFile('${f.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}','${catId}')">👁 映射</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-warning);padding:0 4px;"
                    onclick="moralDebugFile('${f.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')" title="查看解析结果">🔍 诊断</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-error);padding:0 4px;"
                    onclick="moralRemoveFile('${catId}',${i})">✕</button>
        </div>`).join('');
}

function moralRemoveFile(catId, idx) {
    if (moralFileLists[catId]) {
        moralFileLists[catId].splice(idx, 1);
        moralRenderFileList(catId);
    }
}

// ============================================================
// Interactive File Preview with Column Mapping
// ============================================================
let moralColumnMappings = {};
let moralPreviewCatId = '';

async function moralPreviewFile(filepath, catId) {
    showToast('正在加载文件预览...', 'info');
    moralPreviewCatId = catId;
    try {
        const result = await eel.preview_moral_file(filepath)();
        if (result.error) { showToast(result.error, 'error'); return; }

        if (!moralColumnMappings[catId]) moralColumnMappings[catId] = {};
        if (!moralColumnMappings[catId][filepath]) moralColumnMappings[catId][filepath] = {};

        let html = '';
        for (const [sn, info] of Object.entries(result)) {
            const headers = info.headers || [];
            const samples = info.sample_rows || [];
            const mapping = moralColumnMappings[moralPreviewCatId][filepath][sn] || {};

            const colOptions = (selectedIdx) => {
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
                        <select class="select-input moral-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="id_col">
                            ${colOptions(mapping.id_col)}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">姓名列</label>
                        <select class="select-input moral-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="name_col">
                            ${colOptions(mapping.name_col)}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">班级列</label>
                        <select class="select-input moral-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="class_col">
                            ${colOptions(mapping.class_col)}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:130px;">
                        <label style="font-size:10px;">分数/扣分列</label>
                        <select class="select-input moral-col-map" style="width:100%;font-size:11px;"
                                data-file="${escapeHtml(filepath).replace(/"/g,'&quot;')}"
                                data-sheet="${escapeHtml(sn)}" data-field="score_col">
                            ${colOptions(mapping.score_col)}
                        </select>
                    </div>
                </div>

                <p style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">数据预览（前5行）：</p>`;

            if (samples.length > 0) {
                html += `<div style="overflow-x:auto;max-width:100%;"><table class="data-table" style="font-size:10px;"><thead><tr>
                    ${headers.map(h => `<th>${escapeHtml(h||'')}</th>`).join('')}</tr></thead><tbody>`;
                for (const row of samples) {
                    html += `<tr>${row.map(c => `<td>${escapeHtml(c||'')}</td>`).join('')}</tr>`;
                }
                html += `</tbody></table></div>`;
            }
            html += `</div>`;
        }

        showModal('📊 列映射 — ' + escapeHtml(filepath.split(/[\\/]/).pop()),
            `<div style="max-height:55vh;overflow-y:auto;">${html}</div>
             <p style="font-size:10px;color:var(--text-muted);margin-top:8px;">
                💡 选择每列对应的数据类型。留空则由系统自动识别。</p>`,
            `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button>
             <button class="btn btn-primary btn-sm" onclick="moralSaveColumnMapping('${filepath.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">确认映射</button>`);

        setTimeout(() => {
            document.querySelectorAll('.moral-col-map').forEach(sel => {
                sel.addEventListener('change', function() {
                    const file = this.dataset.file;
                    const sheet = this.dataset.sheet;
                    const field = this.dataset.field;
                    if (!moralColumnMappings[moralPreviewCatId]) moralColumnMappings[moralPreviewCatId] = {};
                    if (!moralColumnMappings[moralPreviewCatId][file]) moralColumnMappings[moralPreviewCatId][file] = {};
                    if (!moralColumnMappings[moralPreviewCatId][file][sheet]) moralColumnMappings[moralPreviewCatId][file][sheet] = {};
                    moralColumnMappings[moralPreviewCatId][file][sheet][field] = this.value ? parseInt(this.value) : null;
                });
            });
        }, 100);

        moralPreviewCache[filepath] = result;
    } catch(e) {
        showToast('预览失败: ' + e, 'error');
    }
}

function moralSaveColumnMapping(filepath) {
    closeModal();
    showToast('列映射已保存', 'success');
}

// ============================================================
// Process
// ============================================================
async function processMoral() {
    const rosterPath = document.getElementById('moral-roster-file').value.trim();
    const outputDir = document.getElementById('moral-output-dir').value.trim();
    if (!rosterPath) { showToast('请选择花名册文件', 'warning'); return; }
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }

    const btn = document.getElementById('moral-process-btn');
    btn.disabled = true; btn.classList.add('processing'); btn.textContent = '处理中...';
    const progress = createProgressBar('moral-progress-area');
    const onP = (e) => progress.update(e.detail.percent, e.detail.message);
    window.addEventListener('progress-update', onP);

    try {
        const result = await eel.run_module_b(
            rosterPath,
            moralFileLists['moral-absence'] || [],
            moralFileLists['moral-class-absence'] || [],
            moralFileLists['moral-dormitory'] || [],
            moralFileLists['moral-classroom'] || [],
            moralFileLists['moral-orgclass'] || [],
            moralReviewScores,
            outputDir,
            mergeMoralColumnMappings(),
            moralManualScores,           // NEW: manual scores
            moralSelectedColumns,        // NEW: column selection
            moralExportGradeFilter       // NEW: grade filter
        )();
        if (result.success) {
            document.getElementById('moral-result-area').innerHTML = `
                <div class="result-card">
                    <div class="result-stat"><div class="stat-value">${result.student_count}</div><div class="stat-label">学生总数</div></div>
                    <div class="result-stat"><div class="stat-value">${result.class_count}</div><div class="stat-label">班级数量</div></div>
                    <div class="result-actions">
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output.replace(/\\/g,'\\\\')}')()">📂 打开文件</button>
                    </div>
                </div>`;
            showOutputDialog(true, `成功处理 ${result.student_count} 名学生`, [result.output]);
        } else {
            showOutputDialog(false, result.error || '处理失败');
        }
    } catch (e) {
        showOutputDialog(false, '处理出错: ' + e);
    } finally {
        btn.disabled = false; btn.classList.remove('processing'); btn.textContent = '开始计算';
        window.removeEventListener('progress-update', onP);
    }
}

function moralAskAI() {
    const rosterPath = document.getElementById('moral-roster-file')?.value || '';
    let ctx = `德育分计算模块\n花名册: ${rosterPath || '未选择'}\n`;
    const cats = {
        'moral-absence': '早晚自习出勤', 'moral-class-absence': '课堂出勤',
        'moral-dormitory': '宿舍卫生', 'moral-classroom': '教室卫生',
        'moral-orgclass': '团课出勤'
    };
    for (const [catId, label] of Object.entries(cats)) {
        const files = moralFileLists[catId] || [];
        if (files.length > 0) ctx += `${label}: ${files.length} 个文件\n`;
    }
    ctx += `评议分录入: ${Object.keys(moralReviewScores).filter(k => moralReviewScores[k] !== 0).length} 条\n`;
    ctx += `手动录入: ${Object.keys(moralManualScores).length} 名学生\n`;
    ctx += `导出列: ${(moralSelectedColumns||ALL_MORAL_HEADERS).join(', ')}\n`;
    ctx += `请根据以上信息提供德育分匹配建议。`;
    aiPanelOpen(ctx);
}

function mergeMoralColumnMappings() {
    const merged = {};
    for (const [catId, catMappings] of Object.entries(moralColumnMappings)) {
        for (const [fp, sheets] of Object.entries(catMappings)) {
            if (!merged[fp]) merged[fp] = {};
            Object.assign(merged[fp], sheets);
        }
    }
    return merged;
}

async function moralDebugRoster() {
    const fp = document.getElementById('moral-roster-file').value.trim();
    if (!fp) { showToast('请先选择花名册文件', 'warning'); return; }
    showToast('正在诊断花名册...', 'info');
    try {
        const r = await eel.debug_roster_file(fp)();
        if (!r || !r.success) {
            showToast('诊断失败: ' + (r?.error || '未知'), 'error');
            return;
        }
        let html = `<p style="color:var(--color-success);">✅ 提取到 <strong>${r.student_count}</strong> 名学生，<strong>${r.class_count}</strong> 个班级</p>`;
        html += `<p style="font-size:11px;color:var(--text-muted);">班级列表: ${(r.classes||[]).map(c=>escapeHtml(c)).join('、')}</p>`;
        html += `<table class="data-table" style="font-size:11px;margin-top:8px;"><thead><tr><th>#</th><th>学号</th><th>姓名</th><th>班级</th></tr></thead><tbody>`;
        (r.samples||[]).forEach((s,i)=>{html+=`<tr><td>${i+1}</td><td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.class)}</td></tr>`;});
        html += `</tbody></table>`;
        if (r.student_count > 20) html += `<p style="font-size:10px;color:var(--text-muted);">仅显示前20条</p>`;
        showModal('🔍 花名册诊断', html, `<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
    } catch (e) { showToast('诊断出错: ' + e, 'error'); }
}

async function moralDebugFile(fp) {
    showToast('正在诊断文件...', 'info');
    try {
        const r = await eel.debug_moral_file(fp)();
        if (!r || !r.success) {
            showToast('诊断失败: ' + (r?.error || '未知'), 'error');
            return;
        }
        let html = `<div style="font-size:12px;line-height:1.8;">`;
        for (const sh of (r.sheets || [])) {
            html += `<h4 style="color:var(--accent-primary);">📋 ${escapeHtml(sh.name)} — ${sh.format}</h4>`;
            html += `<p style="font-size:10px;color:var(--text-muted);">${sh.row_count} 行 | 检测: 学号=${sh.detected?.has_student_id} 班级=${sh.detected?.has_class} 课程=${sh.detected?.has_course} 学时=${sh.detected?.has_hours} 扣分=${sh.detected?.has_deduction}</p>`;
            html += `<table class="data-table" style="font-size:10px;"><thead><tr><th>#</th>`;
            const maxCols = Math.max(...(sh.first_rows||[]).map(r=>r.length), 1);
            for (let c=0;c<maxCols;c++) html += `<th>列${c}</th>`;
            html += `</tr></thead><tbody>`;
            (sh.first_rows||[]).forEach((row, ri) => {
                html += `<tr><td>${ri+1}</td>`;
                for (let c=0;c<maxCols;c++) html += `<td style="max-width:120px;overflow:hidden;">${escapeHtml(row[c]||'')}</td>`;
                html += `</tr>`;
            });
            html += `</tbody></table>`;
        }
        html += `</div>`;
        showModal('🔍 文件诊断 — ' + escapeHtml(fp.split(/[\\/]/).pop()), html,
            `<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
    } catch (e) {
        showToast('诊断出错: ' + e, 'error');
    }
}

function resetModuleMoral() {
    for (const k of Object.keys(moralFileLists)) delete moralFileLists[k];
    moralReviewScores = {};
    moralManualScores = {};
    moralUndoStack = [];
    moralPreviewCache = {};
    moralRoster = {};
    moralCurrentSid = '';
    moralCurrentClass = '';
    moralSelectedColumns = null;
    moralExportGradeFilter = 'all';
    ['moral-roster-file','moral-output-dir'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('has-file'); }
    });
    document.getElementById('moral-progress-area').innerHTML = '';
    document.getElementById('moral-result-area').innerHTML = '';
    renderModuleMoral();
}
