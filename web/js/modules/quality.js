/**
 * Module C: Quality Development Score UI (素质拓展分计算)
 *
 * Three modes: auto (自动计算), manual (辅助人工), import (材料导入)
 * v9.2: max_item threshold mode, PDF in-app preview, progress save/restore
 */

let qualityRoster = {};
let qualityClassOrder = [];
let qualityData = {};
let qualityCurrentSid = '';
let qualityCurrentClass = '';
let qualityThresholds = [];
let qualityMode = localStorage.getItem('quality_preferred_mode') || 'import';
let qualitySemiParsed = null;
let qualityLastOutput = '';

// V10: Batch bonus state
let qualityBatchTargets = new Set();
let qualityBatchSearchTerm = '';
let qualityBatchClassFilter = '';

// V9.0: Material Import state
let qualityImportTree = null;
let qualityImportBaseDir = '';
let qualityImportZipPaths = [];
let qualityImportSelectedClass = '';
let qualityImportSelectedStudent = '';
let qualityImportProgress = {};
let qualityImportExpanded = {};
let qualityViewerStudent = null;
let qualityImportRosterMap = {};

const QUALITY_DEFAULT_THRESHOLD_NAMES = new Set([
    '比赛志愿服务每学期上限', '学院活动参与每学期上限', '寒暑假社会实践上限',
    '技能培训与证书上限', '学生干部任职取最高', '新生班主任助理取最高',
]);
const QUALITY_FALLBACK_THRESHOLDS = [
    {name:'比赛志愿服务每学期上限',max:2,categories:['比赛志愿服务类'],mode:'sum'},
    {name:'学院活动参与每学期上限',max:1,categories:['学院活动参与类'],mode:'sum'},
    {name:'寒暑假社会实践上限',max:2,categories:['寒暑假实践类'],mode:'sum'},
    {name:'技能培训与证书上限',max:3,categories:['技能证书类','技能培训'],mode:'sum'},
    {name:'学生干部任职取最高',max:3,categories:['学生工作类','学生工作','班委测评','组织测评'],mode:'max_item'},
    {name:'新生班主任助理取最高',max:2,categories:['班主任助理类'],mode:'max_item'},
];

async function qualityLoadThresholds() {
    try {
        const rows = await eel.get_all_thresholds()();
        if (Array.isArray(rows) && rows.length) return rows;
    } catch(e) { console.error('加载素拓上限失败，使用内置规则', e); }
    return QUALITY_FALLBACK_THRESHOLDS.map(row => ({...row, categories:[...row.categories]}));
}

// ============================================================
// Render
// ============================================================
async function renderModuleQuality() {
    document.getElementById('module-title').textContent = '素质拓展分计算';
    const c = document.getElementById('module-container');
    c.innerHTML = `
        <div class="quality-workspace-head">
            <div><p>素质拓展工作台</p><h2>${qualityMode==='import'?'材料导入与加分':qualityMode==='auto'?'快速录入加分':'表格辅助汇总'}</h2><span>${qualityMode==='import'?'整理学生材料、逐项核验并完成加分':'选择适合当前工作的处理方式'}</span></div>
            <div class="quality-mode-switch" role="tablist" aria-label="素拓处理模式">
                <button class="${qualityMode==='import'?'active':''}" onclick="qualitySwitchMode('import')" role="tab" aria-selected="${qualityMode==='import'}"><b>材料导入</b><small>最常使用</small></button>
                <button class="${qualityMode==='auto'?'active':''}" onclick="qualitySwitchMode('auto')" role="tab" aria-selected="${qualityMode==='auto'}"><b>快速录入</b><small>逐人加分</small></button>
                <button class="${qualityMode==='manual'?'active':''}" onclick="qualitySwitchMode('manual')" role="tab" aria-selected="${qualityMode==='manual'}"><b>表格汇总</b><small>半成品表</small></button>
            </div>
        </div>
        <div class="module-section quality-roster-card">
            <div class="quality-section-title"><span>01</span><div><h2>导入学生名单</h2><p>使用学分绩点表建立班级与学生对应关系</p></div></div>
            <div class="file-picker-row">
                <input id="quality-roster-file" class="file-path" readonly placeholder="选择学分绩点.xlsx 导入班级和学生...">
                <button class="btn btn-secondary" onclick="pickFile('quality-roster-file','选择学分绩点文件',[['Excel文件','*.xlsx']])">浏览</button>
                <button class="btn btn-teal btn-sm" onclick="qualityImportRoster()">导入</button>
            </div>
            <div id="quality-roster-status" style="margin-top:6px;font-size:11px;color:var(--text-muted);"></div>
        </div>

        ${qualityMode==='auto'?`
        <div class="module-section" id="quality-entry-section" style="display:none;">
            <h2><span class="step-badge">2</span> 录入加分项目</h2>
            <div class="form-row" style="margin-bottom:12px;flex-wrap:wrap;">
                <div class="form-group"><label>班级</label><select id="quality-class-sel" class="select-input" style="width:140px;" onchange="qualityOnClass()"><option value="">-- 班级 --</option></select></div>
                <div class="form-group"><label>学生</label><select id="quality-student-sel" class="select-input" style="width:160px;" onchange="qualityOnStudent()"><option value="">-- 学生 --</option></select></div>
                <div class="form-group"><label>加分项目</label><input id="quality-activity" class="input" style="width:180px;" placeholder="输入名称" list="quality-datalist"><datalist id="quality-datalist"></datalist></div>
                <div class="form-group"><label>类别</label><select id="quality-cat" class="select-input" style="width:120px;" onchange="qualityOnCat()"></select></div>
                <div class="form-group"><label>等级</label><select id="quality-grade" class="select-input" style="width:110px;"></select></div>
                <div class="form-group"><label>分数</label><input id="quality-score" class="input" type="number" style="width:70px;" placeholder="0" step="0.5" min="0"></div>
                <button class="btn btn-primary btn-sm" style="align-self:flex-end;" onclick="qualityAdd()">+ 添加</button>
            </div>
            <div class="module-section" style="background:var(--bg-tertiary);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <h3 style="font-size:12px;">阈值设置（分数上限）</h3>
                    <button class="btn btn-ghost btn-sm" onclick="qualityAddThreshold()" title="添加自定义上限">+ 添加上限</button>
                </div>
                <div id="quality-thresholds-container" class="form-row" style="flex-wrap:wrap;gap:8px;"></div>
            </div>
            <div id="quality-current-view" style="margin-top:12px;font-size:12px;color:var(--text-muted);">请先选择班级和学生</div>
        </div>
        `: qualityMode==='import'?`
        <div class="module-section quality-import-hero" id="quality-import-step2">
            <div class="quality-section-title"><span>02</span><div><h2>导入班级材料</h2><p>选择各班提交的 ZIP，系统自动识别班级和学生并归档</p></div><em>高频</em></div>
            <div class="file-picker-row" style="margin-bottom:8px;">
                <input id="quality-import-zip-display" class="file-path" readonly placeholder="选择班级压缩包(.zip)... 可多选">
                <button class="btn btn-secondary" onclick="qualityImportPickZips()">📁 浏览选择</button>
                <button class="btn btn-teal btn-sm" id="quality-import-unzip-btn" onclick="qualityImportStartUnzip()">🚀 开始智能解压</button>
            </div>
            <div id="quality-import-zip-list" style="font-size:10px;color:var(--text-muted);margin-bottom:8px;"></div>
            <div class="file-picker-row" style="margin-bottom:8px;">
                <input id="quality-import-output-dir" class="file-path" readonly placeholder="选择解压输出目录（或已有文件夹）...">
                <button class="btn btn-secondary" onclick="pickDirectory('quality-import-output-dir','选择解压目标文件夹')">📂 输出目录</button>
                <button class="btn btn-teal btn-sm" onclick="qualityImportOpenFolder()" title="直接导入已整理好的文件夹">📥 导入已有文件夹</button>
            </div>
            <div id="quality-import-status" style="margin-top:8px;font-size:11px;color:var(--text-muted);"></div>
        </div>
        <div class="module-section" id="quality-import-tree-section" style="display:none;">
            <h2><span class="step-badge">3</span> 材料管理</h2>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <div style="font-size:11px;color:var(--text-muted);" id="quality-import-summary"></div>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-ghost btn-sm" onclick="qualityImportCollapseAll()">📂 折叠</button>
                    <button class="btn btn-ghost btn-sm" onclick="qualityImportExpandAll()">📂 展开</button>
                </div>
            </div>
            <div style="background:var(--bg-tertiary);border-radius:4px;height:6px;margin-bottom:12px;overflow:hidden;">
                <div id="quality-import-progress-bar" style="height:100%;width:0%;background:var(--color-success);border-radius:4px;transition:width 0.3s;"></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-muted);" id="quality-import-progress-text">0/0 已完成</span>
                <span style="font-size:10px;color:var(--text-muted);">⬜待处理 🔄处理中 ✅已完成</span>
            </div>
            <div id="quality-import-tree" class="import-tree-container" style="max-height:50vh;overflow-y:auto;">
                <p style="color:var(--text-muted);text-align:center;padding:20px;">请先解压材料</p>
            </div>
        </div>
        <div class="module-section" style="background:var(--bg-tertiary);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;">选中操作:</span>
            <span id="quality-import-selected-label" style="font-size:11px;color:var(--text-muted);">未选中</span>
            <button class="btn btn-teal btn-sm" id="quality-import-view-btn" onclick="qualityImportOpenViewer()" disabled>📄 查看并加分</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-add-student-btn" onclick="qualityImportAddStudent()">➕ 添加学生</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-add-btn" onclick="qualityImportAddFiles()" disabled>➕ 添加文件</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-rename-btn" onclick="qualityImportRename()" disabled>✏️ 重命名</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-delete-btn" onclick="qualityImportDelete()" disabled>🗑️ 删除</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-done-btn" onclick="qualityImportMarkDone()" disabled>✅ 完成</button>
            <button class="btn btn-ghost btn-sm" id="quality-import-pending-btn" onclick="qualityImportMarkPending()" disabled>⬜ 待办</button>
        </div>
        <div class="module-section" id="quality-batch-section" style="display:none;">
            <h2>📋 批量加分</h2>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">选择一个已有加分项目，搜索并多选目标学生，预览后一键批量同步（沿用现有上限规则校验）。</p>
            <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:10px;margin-bottom:12px;">
                <div style="font-size:11px;font-weight:600;margin-bottom:6px;">① 选择/填写加分项目</div>
                <div class="form-row" style="flex-wrap:wrap;gap:8px;">
                    <div class="form-group"><label>加分项目</label><input id="qb-activity" class="input" style="width:200px;" placeholder="输入名称或从列表选择" list="qb-datalist" oninput="qualityBatchOnActivityInput()"><datalist id="qb-datalist"></datalist></div>
                    <div class="form-group"><label>类别</label><select id="qb-cat" class="select-input" style="width:120px;" onchange="qualityBatchOnCat()"></select></div>
                    <div class="form-group"><label>等级</label><select id="qb-grade" class="select-input" style="width:100px;"></select></div>
                    <div class="form-group"><label>分数</label><input id="qb-score" class="input" type="number" style="width:70px;" placeholder="0" step="0.5" min="0"></div>
                </div>
                <div id="qb-cap-hint" class="quality-batch-cap-hint" style="margin-top:8px;font-size:10px;color:var(--text-muted);">选择项目或类别后显示适用上限</div>
            </div>
            <div style="display:flex;gap:12px;margin-bottom:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:11px;font-weight:600;margin-bottom:6px;">② 搜索并多选学生</div>
                    <div class="form-row" style="margin-bottom:6px;gap:8px;flex-wrap:wrap;">
                        <div class="form-group"><label>班级筛选</label><select id="qb-class-filter" class="select-input" style="width:130px;" onchange="qualityBatchFilterClass()"><option value="">全部班级</option></select></div>
                        <div class="form-group"><label>搜索</label><input id="qb-search" class="input" style="width:160px;" placeholder="姓名/学号..." oninput="qualityBatchSearch()"></div>
                        <button class="btn btn-ghost btn-sm" style="align-self:flex-end;font-size:10px;" onclick="qualityBatchSelectAllVisible()">全选可见</button>
                        <button class="btn btn-ghost btn-sm" style="align-self:flex-end;font-size:10px;" onclick="qualityBatchClearSelection()">清空选择</button>
                    </div>
                    <div id="qb-student-list" style="max-height:40vh;overflow-y:auto;background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:8px;">
                        <p style="color:var(--text-muted);text-align:center;padding:12px;">请先导入花名册</p>
                    </div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:4px;" id="qb-selection-count">已选择 0 名学生</div>
                </div>
                <div style="flex:1;min-width:0;background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:10px;">
                    <div style="font-size:11px;font-weight:600;margin-bottom:6px;">③ 预览并确认</div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:10px;color:var(--text-muted);">设置项目和选择学生后刷新</span>
                        <div style="display:flex;gap:4px;">
                            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;" onclick="qualityBatchDeselectDups()">去重</button>
                            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;" onclick="qualityBatchRefreshPreview()">刷新预览</button>
                        </div>
                    </div>
                    <div id="qb-preview" style="max-height:35vh;overflow-y:auto;font-size:11px;">
                        <p style="color:var(--text-muted);text-align:center;padding:12px;">设置加分项目并选择学生后点击刷新预览</p>
                    </div>
                    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="qb-execute-btn" onclick="qualityBatchExecute()" disabled>📋 批量添加 (+0 人)</button>
                </div>
            </div>
        </div>
        `:`
        <div class="module-section" id="quality-manual-section">
            <h2><span class="step-badge">2</span> 导入半成品素拓表</h2>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">💡 选择已填好加分的素拓Excel文件（缺汇总），系统自动识别加分列并计算总分。</p>
            <div class="file-picker-row" style="margin-bottom:12px;">
                <input id="quality-semi-file" class="file-path" readonly placeholder="选择半成品素拓表(.xlsx)...">
                <button class="btn btn-secondary" onclick="pickFile('quality-semi-file','选择素拓表',[['Excel文件','*.xlsx']])">浏览</button>
                <button class="btn btn-teal btn-sm" onclick="qualityManualParse()">🔍 解析汇总</button>
            </div>
            <div id="quality-manual-status" style="font-size:11px;color:var(--text-muted);margin-bottom:8px;"></div>
            <div id="quality-manual-preview" style="max-height:400px;overflow-y:auto;"></div>
        </div>
        `}

        <div class="module-section">
            <h2><span class="step-badge">${qualityMode==='import'?'4':'3'}</span> 输出目录</h2>
            <div class="file-picker-row">
                <input id="quality-output-dir" class="file-path" readonly placeholder="选择输出目录...">
                <button class="btn btn-secondary" onclick="pickDirectory('quality-output-dir','选择输出目录')">浏览</button>
            </div>
        </div>

        <div class="actions-row" style="margin-top:16px;">
            ${qualityMode==='auto' || qualityMode==='import'?`
            <button class="btn btn-ghost" onclick="qualityManageMappings()">管理加分项目</button>
            <button class="btn btn-ghost btn-sm" onclick="qualityManageCategories()">管理类别</button>
            `:''}
            ${qualityMode==='import'?`
            <button class="btn btn-ghost btn-sm" onclick="qualityImportSaveScoreProgress()" title="保存加分进度为JSON">💾 保存进度</button>
            <button class="btn btn-ghost btn-sm" onclick="qualityImportRestoreProgress()" title="从JSON恢复加分进度">📥 恢复进度</button>
            `:''}
            <button class="btn btn-ghost" onclick="resetModuleQuality()">重置</button>
            <button class="btn btn-primary" id="quality-export-btn" onclick="qualityExport()">导出素拓分数</button>
        </div>
        <div id="quality-result-area"></div>
    `;

    // Load data based on mode
    if (qualityMode === 'auto') {
        try {
            const cats = await eel.get_quality_categories()();
            const sel = document.getElementById('quality-cat');
            if (sel) cats.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o); });
            const mappings = await eel.load_activity_mappings_json()();
            const dl = document.getElementById('quality-datalist');
            if (dl) for (const name of Object.keys(mappings)) { const o = document.createElement('option'); o.value = name; dl.appendChild(o); }
        } catch(e) { console.error(e); }
        qualityThresholds = await qualityLoadThresholds();
        qualityRenderThresholds();
    } else if (qualityMode === 'import') {
        qualityThresholds = await qualityLoadThresholds();
        if (qualityImportBaseDir) { document.getElementById('quality-import-output-dir').value = qualityImportBaseDir; }
        if (Object.keys(qualityRoster).length > 0) {
            const s = document.getElementById('quality-roster-status');
            if (s) s.textContent = `已导入 ${Object.keys(qualityRoster).length} 名学生, ${qualityClassOrder.length} 个班级`;
        }
        if (qualityImportTree) { qualityImportRenderTree(); const ts = document.getElementById('quality-import-tree-section'); if (ts) ts.style.display = 'block'; }
        qualityImportUpdateButtons();
        // Show batch section and init
        const bs = document.getElementById('quality-batch-section'); if (bs) bs.style.display = 'block';
        await qualityBatchInitUI(); qualityBatchRenderStudentList();
    } else {
        if (Object.keys(qualityRoster).length > 0) {
            setTimeout(() => {
                const s = document.getElementById('quality-manual-section'); if (s) s.style.display = 'block';
                const st = document.getElementById('quality-roster-status'); if (st) st.textContent = `已导入 ${Object.keys(qualityRoster).length} 名学生, ${qualityClassOrder.length} 个班级`;
                if (qualitySemiParsed) qualityManualRenderPreview(qualitySemiParsed);
            }, 50);
        }
    }
}

// ============================================================
// Roster Import
// ============================================================
async function qualityImportRoster() {
    const path = document.getElementById('quality-roster-file').value.trim();
    if (!path) { showToast('请先选择学分绩点文件', 'warning'); return; }
    try {
        const result = await eel.read_roster_for_quality(path)();
        if (result && Object.keys(result).length > 0) {
            qualityRoster = result;
            const classes = new Set();
            for (const [sid, info] of Object.entries(result)) { classes.add(info.class); if (!qualityData[sid]) qualityData[sid] = []; }
            qualityClassOrder = [...classes].sort();
            if (qualityMode === 'auto') {
                const sel = document.getElementById('quality-class-sel');
                if (sel) { sel.innerHTML = '<option value="">-- 班级 --</option>'; qualityClassOrder.forEach(cls => { const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o); }); }
            }
            const secId = qualityMode==='auto'?'quality-entry-section':qualityMode==='import'?'quality-import-step2':'quality-manual-section';
            const sec = document.getElementById(secId); if (sec) sec.style.display = 'block';
            document.getElementById('quality-roster-status').textContent = `已导入 ${Object.keys(result).length} 名学生, ${qualityClassOrder.length} 个班级`;
            if (qualityMode === 'manual') qualityManualRenderList();
            if (qualityMode === 'import' && qualityImportTree) { const ts = document.getElementById('quality-import-tree-section'); if (ts) ts.style.display = 'block'; }
            if (qualityMode === 'import') { const bs = document.getElementById('quality-batch-section'); if (bs) bs.style.display = 'block'; qualityBatchTargets = new Set(); await qualityBatchInitUI(); qualityBatchRenderStudentList(); }
            showToast('花名册导入成功', 'success');
        }
    } catch(e) { showToast('导入失败: ' + e, 'error'); }
}

function qualityOnClass() {
    qualityCurrentClass = document.getElementById('quality-class-sel').value;
    qualityCurrentSid = '';
    const sel = document.getElementById('quality-student-sel');
    sel.innerHTML = '<option value="">-- 学生 --</option>';
    if (qualityCurrentClass) {
        for (const [sid, info] of Object.entries(qualityRoster)) {
            if (info.class === qualityCurrentClass) { const o = document.createElement('option'); o.value = sid; o.textContent = `${info.name} (${sid})`; sel.appendChild(o); }
        }
    }
    qualityRenderCurrent();
}

function qualityOnStudent() { qualityCurrentSid = document.getElementById('quality-student-sel').value; qualityRenderCurrent(); }

async function qualityOnCat() {
    const cat = document.getElementById('quality-cat').value;
    const sel = document.getElementById('quality-grade'); sel.innerHTML = '<option value="">-- 等级 --</option>';
    if (cat) { try { const grades = await eel.get_quality_grades(cat)(); grades.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); }); } catch(e) {} }
    const activity = document.getElementById('quality-activity').value.trim();
    if (activity) {
        try { const sug = await eel.get_activity_suggestions(activity)(); if (sug && sug.category === cat && sug.default_score) { document.getElementById('quality-score').value = sug.default_score; if (sug.default_grade) setTimeout(() => { document.getElementById('quality-grade').value = sug.default_grade; }, 50); } } catch(e) {}
    }
}

function qualityAdd() {
    if (!qualityCurrentSid) { showToast('请选择学生', 'warning'); return; }
    const activity = document.getElementById('quality-activity').value.trim();
    const category = document.getElementById('quality-cat').value;
    const grade = document.getElementById('quality-grade').value;
    const score = parseFloat(document.getElementById('quality-score').value) || 0;
    if (!activity) { showToast('请输入项目名称', 'warning'); return; }
    if (!category) { showToast('请选择类别', 'warning'); return; }
    if (score <= 0) { showToast('请输入有效分数', 'warning'); return; }
    // Duplicate check
    const existing = qualityData[qualityCurrentSid] || [];
    const isDup = existing.some(a => a.activity === activity && a.category === category && (a.grade||'') === grade && a.score === score);
    if (isDup) { showToast('⚠️ 该学生已有相同的加分项，请勿重复添加', 'warning'); return; }

    if (!qualityData[qualityCurrentSid]) qualityData[qualityCurrentSid] = [];
    qualityData[qualityCurrentSid].push({ activity, category, grade, score });
    eel.save_activity_mapping(activity, category, grade, score)();
    const dl = document.getElementById('quality-datalist');
    if (dl && ![...dl.options].some(o => o.value === activity)) { const o = document.createElement('option'); o.value = activity; dl.appendChild(o); }
    document.getElementById('quality-activity').value = ''; document.getElementById('quality-score').value = '';
    qualityRenderCurrent();
}

// ============================================================
// Helper: apply thresholds (used by render functions)
// ============================================================
function _qualityApplyThresholds(catTotals, activities) {
    let totalDeduction = 0, capNotes = [];
    for (const th of qualityThresholds) {
        const thCats = th.categories || [];
        const rawSum = thCats.reduce((s, c) => s + (catTotals[c] || 0), 0);
        const thMode = th.mode || 'sum';
        let effCap = th.max;
        if (thMode === 'max_item') {
            const scores = (activities||[]).filter(a => thCats.includes(a.category)).map(a => a.score);
            effCap = scores.length > 0 ? Math.min(Math.max(...scores), th.max) : th.max;
        }
        if (rawSum > effCap) { totalDeduction += (rawSum - effCap); capNotes.push(`${escapeHtml(th.name)}: ${rawSum}→${effCap}${thMode==='max_item'?'(取最高)':''}`); }
    }
    return { totalDeduction, capNotes };
}

// ============================================================
// Thresholds UI
// ============================================================
function qualityRenderThresholds() {
    const container = document.getElementById('quality-thresholds-container');
    if (!container) return;
    if (qualityThresholds.length === 0) { container.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">暂无阈值设置</span>'; return; }
    container.innerHTML = qualityThresholds.map((th, i) => {
        const isDefault = QUALITY_DEFAULT_THRESHOLD_NAMES.has(th.name);
        const catsDisplay = (th.categories || []).join(', ');
        const mode = th.mode || 'sum';
        const modeLabel = mode === 'max_item' ? '🏆取最高' : 'Σ求和';
        const modeColor = mode === 'max_item' ? 'var(--color-warning)' : 'var(--text-muted)';
        return `<div class="form-group" style="position:relative;padding:6px 8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);">
            <label style="font-size:11px;font-weight:600;">${escapeHtml(th.name)}</label>
            <div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap;">
                <span style="font-size:10px;color:var(--text-muted);">上限:</span>
                <input class="input" type="number" style="width:60px;font-size:11px;" value="${th.max}" onchange="qualityUpdateThreshold(${i}, this.value)" step="1" min="0">
                <span style="font-size:10px;color:${modeColor};margin-left:4px;">${modeLabel}</span>
                <span style="font-size:10px;color:var(--text-muted);margin-left:4px;">适用:</span>
                <span style="font-size:10px;color:var(--accent-secondary);">${escapeHtml(catsDisplay)}</span>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-error);padding:0 4px;margin-left:auto;" onclick="qualityRemoveThreshold('${escapeHtml(th.name).replace(/'/g,"\\'")}')" ${isDefault?'disabled title="默认阈值不可删除"':''}>✕</button>
            </div></div>`;
    }).join('');
}

function qualityUpdateThreshold(idx, value) { const val = parseFloat(value) || 0; if (idx >= 0 && idx < qualityThresholds.length) qualityThresholds[idx].max = val; qualityRenderCurrent(); }

async function qualityRemoveThreshold(name) { if (QUALITY_DEFAULT_THRESHOLD_NAMES.has(name)) return; try { qualityThresholds = await eel.remove_custom_threshold_category(name)(); } catch(e) {} qualityRenderThresholds(); qualityRenderCurrent(); }

async function qualityAddThreshold() {
    let allCats = ['文艺活动类','体育类','A类竞赛','B类竞赛','C类竞赛','D类竞赛','学术论文','非学术文章','专利软著','学生工作','荣誉称号','社会实践','技能培训','其他加分'];
    try { const cats = await eel.get_quality_categories()(); if (cats && cats.length > 0) allCats = cats; } catch(e) {}
    let html = `<div>
        <div class="form-group" style="margin-bottom:8px;"><label style="font-size:12px;">上限名称</label><input id="qth-new-name" class="input" style="width:100%;" placeholder="如：国家级证书上限"></div>
        <div class="form-group" style="margin-bottom:8px;"><label style="font-size:12px;">计算模式</label>
            <select id="qth-new-mode" class="select-input" style="width:100%;font-size:11px;"><option value="sum">Σ 求和后封顶</option><option value="max_item">🏆 取最高分（如优秀3+良好2→上限=3）</option></select></div>
        <div class="form-group" style="margin-bottom:8px;"><label style="font-size:12px;">绝对上限</label><input id="qth-new-max" class="input" type="number" style="width:100px;" value="30" step="1" min="0"></div>
        <div class="form-group"><label style="font-size:12px;">适用类别（多选）</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">`;
    for (const cat of allCats) html += `<label style="font-size:11px;display:flex;align-items:center;gap:3px;"><input type="checkbox" value="${cat}" class="qth-cat-cb"> ${cat}</label>`;
    html += `</div></div></div>`;
    showModal('添加上限规则', html, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button> <button class="btn btn-primary btn-sm" onclick="qualityConfirmAddThreshold()">添加</button>`);
}

async function qualityConfirmAddThreshold() {
    const name = document.getElementById('qth-new-name').value.trim();
    const mode = document.getElementById('qth-new-mode')?.value || 'sum';
    const maxScore = parseFloat(document.getElementById('qth-new-max').value) || 0;
    const cats = [...document.querySelectorAll('.qth-cat-cb:checked')].map(cb => cb.value);
    if (!name) { showToast('请输入上限名称', 'warning'); return; }
    if (cats.length === 0) { showToast('请至少选择一个适用类别', 'warning'); return; }
    if (maxScore <= 0) { showToast('请输入有效的分数上限', 'warning'); return; }
    try { qualityThresholds = await eel.add_custom_threshold_category(name, maxScore, cats, mode)(); closeModal(); qualityRenderThresholds(); qualityRenderCurrent(); showToast(`已添加「${name}」上限 ${maxScore} 分 (${mode==='max_item'?'取最高':'求和封顶'})`, 'success'); } catch(e) { showToast('添加失败: '+e, 'error'); }
}

// ============================================================
// Current Student View (auto mode)
// ============================================================
function qualityRenderCurrent() {
    const el = document.getElementById('quality-current-view');
    if (!qualityCurrentSid) { el.innerHTML = '<p style="color:var(--text-muted);">请先选择班级和学生</p>'; return; }
    const info = qualityRoster[qualityCurrentSid];
    const activities = qualityData[qualityCurrentSid] || [];
    if (activities.length === 0) { el.innerHTML = `<p style="color:var(--text-muted);">${escapeHtml(info.name)} (${qualityCurrentSid}) — 暂无加分项目</p>`; return; }
    let catTotals = {}; activities.forEach(a => { catTotals[a.category] = (catTotals[a.category] || 0) + a.score; });
    const { totalDeduction, capNotes } = _qualityApplyThresholds(catTotals, activities);
    const rawTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const total = Math.max(0, rawTotal - totalDeduction);
    let rows = activities.map((a, i) => `<tr><td>${i+1}</td><td>${escapeHtml(a.activity)}</td><td>${escapeHtml(a.category)}</td><td>${escapeHtml(a.grade||'')}</td><td>${a.score}</td><td><button class="btn btn-ghost btn-sm" style="color:var(--color-error);" onclick="qualityData['${qualityCurrentSid}'].splice(${i},1);qualityRenderCurrent();">✕</button></td></tr>`).join('');
    let capHtml = capNotes.length > 0 ? capNotes.map(n => `<br><span style="color:var(--color-warning);">⚠ ${n}</span>`).join('') : '';
    el.innerHTML = `<div class="module-section"><h3 style="font-size:12px;">${escapeHtml(info.name)} (${qualityCurrentSid}) — ${escapeHtml(info.class)}</h3><table class="data-table"><thead><tr><th>#</th><th>项目</th><th>类别</th><th>等级</th><th>加分</th><th></th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:6px;color:var(--accent-secondary);font-weight:600;">拓展分: ${total.toFixed(1)}${capHtml}</p></div>`;
}

// ============================================================
// Export
// ============================================================
async function qualityExport() {
    if (Object.keys(qualityData).every(k => !qualityData[k] || qualityData[k].length === 0)) { showToast('没有可导出的数据', 'warning'); return; }
    const outputDir = document.getElementById('quality-output-dir').value.trim();
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }
    const outPath = outputDir + '/素拓分.xlsx';
    const thDict = {}; qualityThresholds.forEach(th => { thDict[th.name] = {max: th.max, categories: th.categories, mode: th.mode || 'sum'}; });
    try {
        if (!MajorScope.requireForExport()) return;
        const result = await eel.export_quality_with_roster(qualityRoster, qualityData, outPath, thDict, MajorScope.get())();
        if (result.success) {
            qualityLastOutput = result.output;
            document.getElementById('quality-result-area').innerHTML = `<div class="result-card"><div class="result-stat"><div class="stat-value">${result.student_count}</div><div class="stat-label">学生</div></div><div class="result-stat"><div class="stat-value">${result.class_count}</div><div class="stat-label">班级</div></div><div class="result-actions"><button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output.replace(/\\/g,'\\\\')}')()">📂 打开文件</button><button data-cloud-sync-id="quality-main" class="btn btn-primary btn-sm" onclick="CloudSync.request('quality-main')">☁ 同步素拓云表</button></div></div>`;
            CompletionCelebration.mark('quality', result.output);
            showOutputDialog(true, `成功导出 ${result.student_count} 名学生的素拓分数`, [result.output]);
        } else { showOutputDialog(false, result.error || '导出失败'); }
    } catch(e) { showOutputDialog(false, '处理出错: ' + e); }
}

// ============================================================
// Activity Mappings Management
// ============================================================
async function qualityManageMappings() {
    let mappings = {}; try { mappings = await eel.load_activity_mappings_json()(); } catch(e) {}
    const entries = Object.entries(mappings);
    const catOpts = ['文艺活动类','体育类','A类竞赛','B类竞赛','C类竞赛','D类竞赛','学术论文','非学术文章','专利软著','学生工作','荣誉称号','社会实践','技能培训','其他加分'];
    let rows = entries.map(([name, info]) => {
        const safe = escapeHtml(name).replace(/[^a-zA-Z0-9一-鿿]/g,'_');
        return `<tr><td><input class="input" style="width:180px;font-size:11px;" value="${escapeHtml(name)}" data-old="${escapeHtml(name)}" id="qm-name-${safe}"></td>
            <td><select class="select-input" style="width:110px;font-size:11px;" id="qm-cat-${safe}">${catOpts.map(c => `<option value="${c}" ${info.category===c?'selected':''}>${c}</option>`).join('')}</select></td>
            <td><input class="input" style="width:80px;font-size:11px;" value="${escapeHtml(info.default_grade||'')}" id="qm-grade-${safe}"></td>
            <td><input class="input" type="number" style="width:60px;font-size:11px;" value="${info.default_score||0}" id="qm-score-${safe}"></td>
            <td><button class="btn btn-ghost btn-sm" style="color:var(--color-error);" onclick="qualityDeleteMapping('${escapeHtml(name).replace(/'/g,"\\'")}')">删除</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;">暂无保存的加分项目</td></tr>';
    showModal('管理加分项目', `<div style="max-height:55vh;overflow-y:auto;"><table class="data-table"><thead><tr><th>名称</th><th>类别</th><th>默认等级</th><th>默认分数</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <div style="margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);"><strong style="font-size:12px;">+ 添加新项目</strong>
        <div class="form-row" style="margin-top:4px;gap:8px;"><input id="qm-new-name" class="input" style="width:160px;font-size:11px;" placeholder="项目名称">
        <select id="qm-new-cat" class="select-input" style="width:110px;font-size:11px;">${catOpts.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        <input id="qm-new-grade" class="input" style="width:80px;font-size:11px;" placeholder="等级"><input id="qm-new-score" class="input" type="number" style="width:60px;font-size:11px;" placeholder="分数" step="0.5">
        <button class="btn btn-teal btn-sm" onclick="qualityAddNewMapping()">添加</button></div></div>`,
        `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button> <button class="btn btn-primary btn-sm" onclick="qualitySaveMappings()">保存修改</button>`);
}

async function qualityAddNewMapping() {
    const name = document.getElementById('qm-new-name').value.trim(), cat = document.getElementById('qm-new-cat').value, grade = document.getElementById('qm-new-grade').value.trim(), score = parseFloat(document.getElementById('qm-new-score').value) || 0;
    if (!name) { showToast('请输入项目名称', 'warning'); return; }
    if (score <= 0) { showToast('请输入有效分数', 'warning'); return; }
    try { await eel.add_new_activity_mapping(name, cat, grade, score)(); showToast('添加成功', 'success'); qualityManageMappings(); } catch(e) { showToast('添加失败: '+e, 'error'); }
}

async function qualitySaveMappings() {
    let mappings = {}; try { mappings = await eel.load_activity_mappings_json()(); } catch(e) {}
    const newMappings = {};
    const inputs = document.querySelectorAll('#modal-body input[data-old]');
    for (const inp of inputs) {
        const oldName = inp.dataset.old, newName = inp.value.trim();
        if (!newName) continue;
        const safeId = oldName.replace(/[^a-zA-Z0-9一-鿿]/g, '_');
        newMappings[newName] = { category: document.getElementById('qm-cat-' + safeId)?.value || '', default_grade: document.getElementById('qm-grade-' + safeId)?.value || '', default_score: parseFloat(document.getElementById('qm-score-' + safeId)?.value) || 0, last_used: '' };
    }
    try { await eel.save_all_activity_mappings(newMappings)(); showToast('保存成功', 'success'); closeModal(); const dl = document.getElementById('quality-datalist'); if (dl) { dl.innerHTML = ''; for (const name of Object.keys(newMappings)) { const o = document.createElement('option'); o.value = name; dl.appendChild(o); } } } catch(e) { showToast('保存失败: '+e, 'error'); }
}

async function qualityDeleteMapping(name) { if (!confirm(`确定删除「${name}」吗？`)) return; try { await eel.delete_activity_mapping(name)(); showToast('已删除', 'success'); qualityManageMappings(); } catch(e) { showToast('删除失败: '+e, 'error'); } }

function qualityAskAI() {
    if (!qualityCurrentSid) { showToast('请先选择学生', 'warning'); return; }
    const info = qualityRoster[qualityCurrentSid], activities = qualityData[qualityCurrentSid] || [];
    let ctx = `当前学生: ${info?.name} (${qualityCurrentSid}), 班级: ${info?.class}\n已有加分项目:\n`;
    activities.forEach((a, i) => { ctx += `${i+1}. ${a.activity} | ${a.category} | ${a.grade||''} | 加分:${a.score}\n`; });
    ctx += `\n阈值: ${JSON.stringify(qualityThresholds)}\n请根据以上信息提供素拓加分建议。`;
    aiPanelOpen(ctx);
}

async function qualityManageCategories() { let cats = []; try { cats = await eel.get_quality_categories()(); } catch(e) {} const defCats = ['文艺活动类','体育类','A类竞赛','B类竞赛','C类竞赛','D类竞赛','学术论文','非学术文章','专利软著','学生工作','荣誉称号','社会实践','技能培训','其他加分']; showModal('管理加分类别', `<div style="max-height:50vh;overflow-y:auto;"><table class="data-table"><thead><tr><th>类别</th><th>类型</th><th></th></tr></thead><tbody>${cats.map(c => `<tr><td>${escapeHtml(c)}</td><td>${defCats.includes(c)?'系统默认':'自定义'}</td><td>${defCats.includes(c)?'':`<button class="btn btn-ghost btn-sm" style="color:var(--color-error);" onclick="qualityDeleteCategory('${escapeHtml(c).replace(/'/g,"\\'")}')">删除</button>`}</td></tr>`).join('')}</tbody></table></div><div style="margin-top:8px;display:flex;gap:8px;"><input id="qcat-new-name" class="input" style="flex:1;font-size:11px;" placeholder="新类别名称"><button class="btn btn-teal btn-sm" onclick="qualityAddCategory()">添加</button></div>`, `<button class="btn btn-primary btn-sm" onclick="closeModal();qualitySyncCategories();">关闭</button>`); }

async function qualityAddCategory() { const name = document.getElementById('qcat-new-name').value.trim(); if (!name) { showToast('请输入类别名称', 'warning'); return; } try { await eel.add_quality_category(name)(); showToast(`已添加「${name}」`, 'success'); qualitySyncCategories(); qualityManageCategories(); } catch(e) { showToast('添加失败: '+e, 'error'); } }

async function qualityDeleteCategory(name) { if (!confirm(`确定删除「${name}」吗？`)) return; try { await eel.remove_quality_category(name)(); showToast('已删除', 'success'); qualitySyncCategories(); qualityManageCategories(); } catch(e) { showToast('删除失败: '+e, 'error'); } }

async function qualitySyncCategories() { try { const cats = await eel.get_quality_categories()(); const sel = document.getElementById('quality-cat'); if (sel) { const cur = sel.value; sel.innerHTML = ''; cats.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o); }); if (cats.includes(cur)) sel.value = cur; } const mappings = await eel.load_activity_mappings_json()(); const dl = document.getElementById('quality-datalist'); if (dl) { dl.innerHTML = ''; for (const name of Object.keys(mappings)) { const o = document.createElement('option'); o.value = name; dl.appendChild(o); } } } catch(e) { console.error(e); } }

// ============================================================
// Mode Switch
// ============================================================
function qualitySwitchMode(mode) {
    if (mode !== qualityMode) { for (const sid of Object.keys(qualityData)) { qualityData[sid] = (qualityData[sid] || []).filter(a => !a._manual); if (!qualityData[sid] || qualityData[sid].length === 0) delete qualityData[sid]; } qualitySemiParsed = null; }
    qualityMode = mode; localStorage.setItem('quality_preferred_mode', mode); renderModuleQuality();
    setTimeout(() => {
        if (Object.keys(qualityRoster).length > 0) {
            const secId = mode==='auto'?'quality-entry-section':mode==='import'?'quality-import-step2':'quality-manual-section';
            const sec = document.getElementById(secId); if (sec) sec.style.display = 'block';
            const st = document.getElementById('quality-roster-status'); if (st) st.textContent = `已导入 ${Object.keys(qualityRoster).length} 名学生, ${qualityClassOrder.length} 个班级`;
            if (mode === 'auto') { const sel = document.getElementById('quality-class-sel'); if (sel) qualityClassOrder.forEach(cls => { if (![...sel.options].some(o => o.value===cls)) { const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o); } }); qualityRenderThresholds(); }
        }
        if (mode === 'import') { if (qualityImportTree) { qualityImportRenderTree(); const ts = document.getElementById('quality-import-tree-section'); if (ts) ts.style.display = 'block'; } if (qualityImportBaseDir) { const el = document.getElementById('quality-import-output-dir'); if (el) el.value = qualityImportBaseDir; } qualityImportUpdateButtons(); }
        if (mode === 'manual' && qualitySemiParsed) { const st = document.getElementById('quality-manual-status'); if (st) st.innerHTML = `<span style="color:var(--color-success);">✅ 已加载 ${qualitySemiParsed.student_count} 名学生</span>`; qualityManualRenderPreview(qualitySemiParsed); }
    }, 100);
}

// ============================================================
// Manual Mode (辅助人工)
// ============================================================
function qualityManualRenderList() { /* no-op: roster already shown */ }

async function qualityManualParse() {
    const fp = document.getElementById('quality-semi-file').value.trim();
    if (!fp) { showToast('请先选择半成品素拓表', 'warning'); return; }
    const statusEl = document.getElementById('quality-manual-status'); statusEl.textContent = '正在解析...';
    try {
        const result = await eel.parse_semi_quality_file(fp, qualityRoster)();
        if (!result || !result.success) { statusEl.innerHTML = `<span style="color:var(--color-error);">❌ ${result?.error||'解析失败'}</span>`; return; }
        qualitySemiParsed = result;
        statusEl.innerHTML = `<span style="color:var(--color-success);">✅ 识别到 <strong>${result.student_count}</strong> 名学生，<strong>${result.score_columns.length}</strong> 个加分列：${result.score_columns.map(c => escapeHtml(c)).join('、')}</span>`;
        for (const s of result.students) {
            if (!qualityData[s.id]) qualityData[s.id] = [];
            qualityData[s.id] = qualityData[s.id].filter(a => !a._manual);
            for (const item of (s.items || [])) qualityData[s.id].push({ activity: item.name, category: '综合', grade: '', score: item.score, _manual: true });
            qualityData[s.id].push({ activity: '素拓总分', category: '汇总', grade: '', score: s.total, _manual: true, _is_total: true });
        }
        qualityManualRenderPreview(result); showToast(`解析完成：${result.student_count} 名学生`, 'success');
    } catch(e) { statusEl.innerHTML = `<span style="color:var(--color-error);">❌ 解析出错: ${e}</span>`; }
}

function qualityManualRenderPreview(result) {
    const el = document.getElementById('quality-manual-preview'); if (!el) return;
    const students = result.students || [];
    if (students.length === 0) { el.innerHTML = '<p style="color:var(--text-muted);">暂无数据</p>'; return; }
    const showItems = students.some(s => (s.items || []).length > 1);
    let html = `<table class="data-table striped-table" style="font-size:11px;"><thead><tr><th>#</th><th>学号</th><th>姓名</th><th>班级</th>${showItems?'<th>加分明细</th>':''}<th>素拓总分</th></tr></thead><tbody>`;
    students.forEach((s, i) => { const itemsStr = (s.items || []).map(it => `${escapeHtml(it.name)}:${it.score}`).join('<br>'); html += `<tr><td>${i+1}</td><td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.class)}</td>${showItems?`<td style="font-size:10px;">${itemsStr||'—'}</td>`:''}<td style="font-weight:700;color:var(--accent-primary);">${s.total}</td></tr>`; });
    html += `</tbody></table><p style="font-size:10px;color:var(--text-muted);margin-top:4px;">💡 检查无误后点击「导出素拓分数」</p>`; el.innerHTML = html;
}

function resetModuleQuality() { qualityRoster = {}; qualityClassOrder = []; qualityData = {}; qualityCurrentSid = ''; qualityCurrentClass = ''; qualityMode = 'auto'; qualityImportTree = null; qualityImportBaseDir = ''; qualityImportZipPaths = []; qualityImportSelectedClass = ''; qualityImportSelectedStudent = ''; qualityImportProgress = {}; qualityImportExpanded = {}; qualityViewerStudent = null; qualityImportRosterMap = {}; qualitySemiParsed = null; qualityLastOutput = ''; renderModuleQuality(); }

// ============================================================
// Import Mode: Zip Pick & Unzip
// ============================================================
async function qualityImportPickZips() {
    try {
        const files = await eel.select_files([['压缩包','*.zip;*.rar;*.7z'],['ZIP','*.zip'],['所有','*.*']], '选择班级压缩包')();
        if (files && files.length > 0) { qualityImportZipPaths = files; const d = document.getElementById('quality-import-zip-display'); if (d) d.value = `${files.length} 个文件已选择`; const l = document.getElementById('quality-import-zip-list'); if (l) l.innerHTML = files.map(f => `📎 ${escapeHtml(f.split(/[/\\\\]/).pop())}`).join('<br>'); showToast(`已选择 ${files.length} 个ZIP`, 'info'); }
    } catch(e) { console.error(e); }
}

async function qualityImportStartUnzip() {
    if (qualityImportZipPaths.length === 0) { showToast('请先选择ZIP压缩包', 'warning'); return; }
    const outputDir = document.getElementById('quality-import-output-dir').value.trim();
    if (!outputDir) { showToast('请先选择输出目录', 'warning'); return; }
    const statusEl = document.getElementById('quality-import-status'), btn = document.getElementById('quality-import-unzip-btn');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent-primary);">⏳ 正在智能解压识别中...</span>';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 解压中...'; }
    try {
        const result = await eel.smart_unzip_materials(qualityImportZipPaths, outputDir)();
        if (!result || !result.success) { if (statusEl) statusEl.innerHTML = `<span style="color:var(--color-error);">❌ ${result?.errors?.join('; ')||'解压失败'}</span>`; if (btn) { btn.disabled = false; btn.textContent = '🚀 开始智能解压'; } return; }
        qualityImportTree = result; qualityImportBaseDir = outputDir;
        try { qualityImportProgress = _qualityImportNormalizeProgressKeys(await eel.load_material_progress(outputDir)() || {}); } catch(e) { qualityImportProgress = {}; }
        if (result.classes) result.classes.forEach(cls => { qualityImportExpanded[cls.name] = true; });
        const ts = document.getElementById('quality-import-tree-section'); if (ts) ts.style.display = 'block';
        qualityImportRenderTree(); qualityImportUpdateProgressBar();
        let msg = `✅ 解压完成！识别到 <strong>${result.total_students}</strong> 名学生，<strong>${result.total_files}</strong> 个文件`;
        if (result.errors && result.errors.length > 0) msg += `<br><span style="color:var(--color-warning);">⚠ ${result.errors.join('; ')}</span>`;
        if (statusEl) statusEl.innerHTML = msg; if (btn) { btn.disabled = false; btn.textContent = '🔄 重新解压'; }
        _qualityImportRestoreData(); if (Object.keys(qualityRoster).length > 0) qualityImportMatchRoster();
        showToast(`解压完成：${result.total_students} 名学生`, 'success');
    } catch(e) { if (statusEl) statusEl.innerHTML = `<span style="color:var(--color-error);">❌ 解压出错: ${e}</span>`; if (btn) { btn.disabled = false; btn.textContent = '🚀 开始智能解压'; } showToast('解压失败: '+e, 'error'); }
}

// ============================================================
// Import Mode: Tree Rendering
// ============================================================
function qualityImportRenderTree() {
    const container = document.getElementById('quality-import-tree');
    if (!container || !qualityImportTree || !qualityImportTree.classes) return;
    let html = '';
    qualityImportTree.classes.forEach(cls => {
        const isExpanded = qualityImportExpanded[cls.name] !== false;
        const students = cls.students || [];
        const doneCount = students.filter(s => { const files = _qualityImportGetAllFiles(s); return files.length > 0 && files.every(f => qualityImportProgress[f.key] === 'done'); }).length;
        const clsPct = students.length > 0 ? Math.round(doneCount / students.length * 100) : 0;
        html += `<div class="import-tree-class"><div class="import-tree-item import-tree-class-header" onclick="qualityImportToggleClass('${escapeHtml(cls.name).replace(/'/g,"\\'")}')"><span class="import-tree-arrow">${isExpanded?'▼':'▶'}</span><span style="margin-right:6px;">📁</span><span style="flex:1;font-weight:600;">${escapeHtml(cls.name)}</span><span style="font-size:10px;color:var(--text-muted);">${students.length}人</span><span style="margin-left:8px;font-size:10px;color:var(--color-success);">${doneCount}/${students.length}</span><div style="width:60px;height:4px;background:var(--bg-tertiary);border-radius:2px;margin-left:6px;overflow:hidden;"><div style="height:100%;width:${clsPct}%;background:var(--color-success);border-radius:2px;"></div></div></div>`;
        if (isExpanded) {
            html += `<div class="import-tree-students">`;
            students.forEach(s => {
                const isStudentExpanded = qualityImportExpanded[s.key] !== false;
                const scoreCount = (qualityData[s.id||s.key] || []).length;
                const allFiles = _qualityImportGetAllFiles(s);
                const fileDoneCount = allFiles.filter(f => qualityImportProgress[f.key] === 'done').length;
                const allDone = allFiles.length > 0 && fileDoneCount === allFiles.length;
                const hasProgress = fileDoneCount > 0;
                const safeKey = escapeHtml(s.key).replace(/'/g,"\\'");
                const isMatched = !!qualityImportRosterMap[s.key];
                const rosterId = qualityImportRosterMap[s.key] || '', rosterInfo = rosterId ? qualityRoster[rosterId] : null;
                const displayName = rosterInfo ? rosterInfo.name : s.name, displayId = rosterId || s.id;
                html += `<div class="import-tree-student"><div class="import-tree-item ${allDone?'done':hasProgress?'processing':'pending'}" onclick="qualityImportToggleStudent('${safeKey}')" data-student-key="${escapeHtml(s.key)}"><span class="import-tree-arrow">${isStudentExpanded?'▼':'▶'}</span><span class="status-dot ${allDone?'done':hasProgress?'processing':'pending'}"></span><span style="margin-right:4px;">${isMatched?'🔗':'👤'}</span><span style="flex:1;">${escapeHtml(displayName)} ${displayId?`<span style="font-size:10px;color:var(--text-muted);">(${escapeHtml(displayId)})</span>`:''}</span>${!isMatched?`<button class="btn btn-ghost btn-sm" style="font-size:9px;padding:1px 4px;color:var(--color-warning);" onclick="event.stopPropagation();qualityImportManualMatch('${safeKey}')">⚠️匹配</button>`:''}<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">📎${s.file_count}</span>${scoreCount>0?`<span style="font-size:10px;color:var(--accent-primary);margin-left:4px;">⭐${scoreCount}项</span>`:''}<span style="font-size:10px;color:${allDone?'var(--color-success)':'var(--text-muted)'};margin-left:4px;">${fileDoneCount}/${allFiles.length}</span></div>`;
                if (isStudentExpanded) {
                    html += `<div class="import-tree-files"><div style="display:flex;gap:4px;margin-bottom:4px;padding:2px 8px;"><button class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 6px;" onclick="event.stopPropagation();_qualityImportSetSelected('${escapeHtml(cls.name).replace(/'/g,"\\'")}','${safeKey}');qualityImportOpenViewer();">📄 查看并加分</button><button class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 6px;" onclick="event.stopPropagation();qualityImportMarkAllFiles('${safeKey}','done')">✅ 全部完成</button><button class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 6px;" onclick="event.stopPropagation();qualityImportMarkAllFiles('${safeKey}','pending')">🔄 重置</button></div>${_qualityImportRenderFileTree(s.file_tree||[],s.key,cls.name)}</div>`;
                }
                html += `</div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    container.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:20px;">无数据</p>';
    qualityImportUpdateProgressBar();
}

function _qualityImportGetAllFiles(studentData) {
    const result = [];
    function walk(nodes, prefix) {
        (nodes || []).forEach(n => {
            // Normalize path to forward slashes
            const fp = (n.path || n.name).replace(/\\/g, '/');
            const fkey = studentData.key + '::' + fp;
            if (n.type === 'file') result.push({key: fkey, name: n.name, path: fp, ext: n.ext});
            if (n.children) walk(n.children, fp + '/');
        });
    }
    walk(studentData.file_tree || [], ''); return result;
}

// Normalize all progress keys to use forward slashes (migration from old backslash paths)
function _qualityImportNormalizeProgressKeys(progress) {
    const normalized = {};
    for (const [key, value] of Object.entries(progress || {})) {
        normalized[key.replace(/\\/g, '/')] = value;
    }
    return normalized;
}

function _qualityImportRenderFileTree(nodes, studentKey, className, depth) {
    depth = depth || 0;
    if (!nodes || nodes.length === 0) return '<p style="font-size:10px;color:var(--text-muted);padding:4px 20px;">（空）</p>';
    let html = '';
    nodes.forEach(n => {
        // Normalize path to forward slashes (Windows os.path.relpath → backslashes)
        const fp = (n.path || n.name).replace(/\\/g, '/');
        // Try both slash variants for backward compatibility with old progress data
        const fkey = studentKey + '::' + fp;
        const fkeyBS = studentKey + '::' + (n.path || n.name);  // original (may have backslashes)
        const status = qualityImportProgress[fkey] || qualityImportProgress[fkeyBS] || 'pending';
        const isFileDone = status === 'done';
        // Escape for JS string safety inside onclick: backslashes first, then HTML entities, then single quotes
        const safeFp = escapeHtml(fp).replace(/\\/g,'\\\\').replace(/'/g,"\\'"), safeKey = escapeHtml(studentKey).replace(/\\/g,'\\\\').replace(/'/g,"\\'"), indent = depth * 16 + 24;
        if (n.type === 'dir') { html += `<div class="import-tree-item" style="padding-left:${indent}px;font-size:11px;"><span style="margin-right:4px;">📁</span><span style="flex:1;color:var(--text-secondary);">${escapeHtml(n.name)}</span></div>`; if (n.children) html += _qualityImportRenderFileTree(n.children, studentKey, className, depth + 1); }
        else { const isImg = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(n.name), isPdf = /\.pdf$/i.test(n.name), icon = isImg?'🖼️':isPdf?'📕':'📎'; html += `<div class="import-tree-item import-tree-file ${isFileDone?'done':''}" style="padding-left:${indent}px;font-size:11px;${isFileDone?'opacity:0.5;':''}"><span style="margin-right:4px;">${icon}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isFileDone?'text-decoration:line-through;':''}" title="${escapeHtml(n.name)}">${escapeHtml(n.name)}</span><button class="btn btn-ghost btn-sm" style="font-size:9px;padding:1px 5px;color:var(--color-success);" onclick="event.stopPropagation();qualityImportMarkFile('${safeKey}','${safeFp}','${isFileDone?'pending':'done'}')" title="${isFileDone?'标为未审':'标为已审核'}">${isFileDone?'↩':'✅'}</button></div>`; }
    });
    return html;
}

function qualityImportToggleStudent(studentKey) { qualityImportExpanded[studentKey] = !qualityImportExpanded[studentKey]; qualityImportRenderTree(); }
function qualityImportToggleClass(clsName) { qualityImportExpanded[clsName] = !qualityImportExpanded[clsName]; qualityImportRenderTree(); }

function qualityImportMarkFile(studentKey, filePath, status) {
    const fkey = (studentKey + '::' + filePath).replace(/\\/g, '/'); qualityImportProgress[fkey] = status; qualityImportSaveProgress();
    let allDone = true;
    if (qualityImportTree && qualityImportTree.classes) { for (const cls of qualityImportTree.classes) { for (const s of cls.students) { if (s.key === studentKey) { const files = _qualityImportGetAllFiles(s); allDone = files.every(f => qualityImportProgress[f.key] === 'done'); break; } } } }
    if (allDone) qualityImportProgress[studentKey] = 'done'; else if (status === 'done') qualityImportProgress[studentKey] = 'processing';
    qualityImportRenderTree();
}

function qualityImportMarkAllFiles(studentKey, status) {
    if (qualityImportTree && qualityImportTree.classes) { for (const cls of qualityImportTree.classes) { for (const s of cls.students) { if (s.key === studentKey) { const files = _qualityImportGetAllFiles(s); files.forEach(f => { qualityImportProgress[f.key] = status; }); qualityImportProgress[studentKey] = status === 'done' ? 'done' : 'pending'; break; } } } }
    qualityImportSaveProgress(); qualityImportRenderTree();
}

function _qualityImportSetSelected(clsName, studentKey) { qualityImportSelectedClass = clsName; qualityImportSelectedStudent = studentKey; qualityImportExpanded[studentKey] = true; qualityImportUpdateButtons(); }

function qualityImportUpdateButtons() {
    const has = !!(qualityImportSelectedStudent && qualityImportSelectedClass);
    ['quality-import-add-btn','quality-import-rename-btn','quality-import-delete-btn','quality-import-view-btn','quality-import-done-btn','quality-import-pending-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !has; });
    document.getElementById('quality-import-selected-label').textContent = has ? `已选中: ${qualityImportSelectedStudent}` : '点击学生展开查看文件';
}

// ============================================================
// Import Mode: Material Viewer
// ============================================================
async function qualityImportOpenViewer() {
    if (!qualityImportSelectedStudent || !qualityImportSelectedClass) { showToast('请先在树形列表中选择学生', 'warning'); return; }
    let studentData = null, studentFiles = [];
    if (qualityImportTree && qualityImportTree.classes) { for (const cls of qualityImportTree.classes) { if (cls.name === qualityImportSelectedClass) { for (const s of cls.students) { if (s.key === qualityImportSelectedStudent) { studentData = s; studentFiles = s.files || []; break; } } } } }
    if (!studentData) { showToast('找不到学生数据', 'error'); return; }
    qualityViewerStudent = studentData;
    const basePath = qualityImportBaseDir + '/' + qualityImportSelectedClass + '/' + studentData.dir_name;
    const overlay = document.getElementById('material-viewer-overlay');
    document.getElementById('material-viewer-title').textContent = `📄 ${studentData.name} ${studentData.id?'('+studentData.id+')':''} — ${qualityImportSelectedClass}`;
    const status = qualityImportProgress[studentData.key] || 'pending';
    document.getElementById('material-viewer-status').textContent = status === 'done' ? '✅ 已完成' : status === 'processing' ? '🔄 处理中' : '⬜ 待处理';
    const fileListEl = document.getElementById('material-file-list');
    if (studentFiles.length === 0) { fileListEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;font-size:11px;">无文件</p>'; }
    else {
        const renderItem = (f, icon) => {
            // Safely escape for JS string inside HTML onclick attribute
            const sf = escapeHtml(f).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            const sp = escapeHtml(basePath).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return `<div class="material-file-item" onclick="qualityImportPreviewFile('${sf}','${sp}')" data-filename="${escapeHtml(f)}"><span>${icon}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;">${escapeHtml(f)}</span></div>`;
        };
        let html = '';
        const imgs = studentFiles.filter(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f)), pdfs = studentFiles.filter(f => /\.pdf$/i.test(f)), others = studentFiles.filter(f => !/\.(jpg|jpeg|png|gif|bmp|webp|pdf)$/i.test(f));
        if (imgs.length) html += `<div style="font-size:10px;color:var(--text-muted);padding:4px 8px;font-weight:600;">🖼️ 图片 (${imgs.length})</div>` + imgs.map(f => renderItem(f, '🖼️')).join('');
        if (pdfs.length) html += `<div style="font-size:10px;color:var(--text-muted);padding:4px 8px;font-weight:600;">📕 PDF (${pdfs.length})</div>` + pdfs.map(f => renderItem(f, '📕')).join('');
        if (others.length) html += `<div style="font-size:10px;color:var(--text-muted);padding:4px 8px;font-weight:600;">📎 其他 (${others.length})</div>` + others.map(f => renderItem(f, '📎')).join('');
        fileListEl.innerHTML = html;
    }
    document.getElementById('material-file-preview').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">👈 选择左侧文件查看</p>';
    let cats = [];
    try { cats = await eel.get_quality_categories()() || []; } catch(e) {}
    const sid = qualityImportRosterMap[studentData.key] || studentData.id || studentData.key;
    const students = [];
    for (const cls of (qualityImportTree?.classes || [])) {
        for (const student of (cls.students || [])) {
            const studentSid = qualityImportRosterMap[student.key] || student.id || student.key;
            students.push({
                key: student.key, id: student.id, name: student.name, className: cls.name,
                fileCount: (student.files || []).length,
                scoreCount: (qualityData[studentSid] || []).length,
                status: qualityImportProgress[student.key] || 'pending',
            });
        }
    }
    await QualityMaterialDrawer.mount({
        root: document.getElementById('quality-score-drawer'), categories: cats,
        onStudentChange: qualityImportOpenStudentFromDrawer,
        onAdd: qualityImportAddDrawerScore,
        onRemove: qualityImportRemoveDrawerScore,
    });
    QualityMaterialDrawer.setStudents(students, studentData.key);
    QualityMaterialDrawer.setThresholds(qualityThresholds);
    QualityMaterialDrawer.setStudent(studentData, qualityData[sid] || []);
    QualityMaterialDrawer.setFiles(studentFiles);
    QualityMaterialDrawer.open();
    overlay.classList.remove('hidden');
}

function qualityImportOpenStudentFromDrawer(studentKey) {
    for (const cls of (qualityImportTree?.classes || [])) {
        const student = (cls.students || []).find(s => s.key === studentKey);
        if (student) {
            qualityImportSelectedClass = cls.name;
            qualityImportSelectedStudent = student.key;
            qualityImportOpenViewer();
            return;
        }
    }
}

function qualityImportAddDrawerScore(entry) {
    const sd = qualityViewerStudent; if (!sd) return;
    const sid = qualityImportRosterMap[sd.key] || sd.id || sd.key;
    if (!qualityData[sid]) qualityData[sid] = [];
    qualityData[sid].push(entry);
    eel.save_activity_mapping(entry.activity, entry.category, entry.grade, entry.base_score)();
    _qualityImportAutoSave(); qualityImportRenderTree();
    showToast(`已添加：${entry.activity} +${Number(entry.score).toFixed(2)}分`, 'success');
}

function qualityImportRemoveDrawerScore(index) {
    const sd = qualityViewerStudent; if (!sd) return;
    const sid = qualityImportRosterMap[sd.key] || sd.id || sd.key;
    if (qualityData[sid]) qualityData[sid].splice(index, 1);
    QualityMaterialDrawer.setStudent(sd, qualityData[sid] || []);
    _qualityImportAutoSave(); qualityImportRenderTree();
}

function qualityImportCompleteCurrentFromDrawer() {
    const current = qualityViewerStudent; if (!current) return;
    qualityImportMarkAllFiles(current.key, 'done');
    const all = [];
    for (const cls of (qualityImportTree?.classes || [])) for (const student of (cls.students || [])) all.push({cls, student});
    const currentIndex = all.findIndex(row => row.student.key === current.key);
    const ordered = all.slice(currentIndex + 1).concat(all.slice(0, currentIndex + 1));
    const next = ordered.find(row => (qualityImportProgress[row.student.key] || 'pending') !== 'done');
    if (next) {
        qualityImportSelectedClass = next.cls.name; qualityImportSelectedStudent = next.student.key;
        qualityImportOpenViewer(); showToast('已完成，继续审核下一名学生', 'success');
    } else {
        closeMaterialViewer(); showToast('本批学生材料已全部审核完成', 'success');
    }
}

function closeMaterialViewer() { QualityMaterialDrawer.close(); document.getElementById('material-viewer-overlay').classList.add('hidden'); qualityViewerStudent = null; if (qualityImportTree) { qualityImportRenderTree(); qualityImportUpdateProgressBar(); } }

function qualityImportRenderThresholdMini() {
    const el = document.getElementById('mv-thresholds-mini'); if (!el) return;
    if (!qualityThresholds || qualityThresholds.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = qualityThresholds.map(th => { const cats = (th.categories||[]).join('/'); const modeIcon = (th.mode||'sum')==='max_item'?'🏆':'Σ'; return `<span style="display:inline-block;margin-right:8px;background:var(--bg-primary);padding:2px 6px;border-radius:4px;">${modeIcon} ${escapeHtml(th.name)} ≤${th.max} (${escapeHtml(cats)})</span>`; }).join('');
}

async function qualityImportShowThresholds() {
    let allCats = ['文艺活动类','体育类','A类竞赛','B类竞赛','C类竞赛','D类竞赛','学术论文','非学术文章','专利软著','学生工作','荣誉称号','社会实践','技能培训','其他加分'];
    try { const cats = await eel.get_quality_categories()(); if (cats && cats.length) allCats = cats; } catch(e) {}
    let html = `<div style="max-height:50vh;overflow-y:auto;"><table class="data-table" style="font-size:11px;"><thead><tr><th>名称</th><th>上限</th><th>模式</th><th>适用类别</th><th></th></tr></thead><tbody>`;
    qualityThresholds.forEach((th, i) => { const isDefault = QUALITY_DEFAULT_THRESHOLD_NAMES.has(th.name), mode = th.mode || 'sum'; html += `<tr><td>${escapeHtml(th.name)}</td><td><input class="input" type="number" style="width:60px;font-size:11px;" value="${th.max}" onchange="qualityImportUpdateThreshold(${i},this.value)" step="1" min="0"></td><td style="font-size:10px;color:${mode==='max_item'?'var(--color-warning)':'var(--text-muted)'};">${mode==='max_item'?'🏆取最高':'Σ求和'}</td><td style="font-size:10px;">${escapeHtml((th.categories||[]).join(', '))}</td><td>${isDefault?'':`<button class="btn btn-ghost btn-sm" style="color:var(--color-error);font-size:10px;" onclick="qualityImportDeleteThreshold(${i})">删除</button>`}</td></tr>`; });
    html += `</tbody></table></div><div style="margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);"><strong style="font-size:11px;">+ 添加上限</strong><div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;"><div style="display:flex;gap:6px;align-items:center;"><input id="mvth-new-name" class="input" style="width:120px;font-size:11px;" placeholder="名称"><input id="mvth-new-max" class="input" type="number" style="width:60px;font-size:11px;" value="30" step="1" min="0"><select id="mvth-new-mode" class="select-input" style="width:120px;font-size:10px;"><option value="sum">Σ 求和封顶</option><option value="max_item">🏆 取最高分</option></select><button class="btn btn-teal btn-sm" onclick="qualityImportConfirmAddThreshold()">添加</button></div><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><span style="font-size:10px;">适用:</span>`;
    for (const cat of allCats) html += `<label style="font-size:10px;display:flex;align-items:center;gap:2px;"><input type="checkbox" value="${cat}" class="mvth-cat-cb"> ${cat}</label>`;
    html += `</div></div></div>`;
    showModal('⚠️ 加分上限管理', html, `<button class="btn btn-primary btn-sm" onclick="closeModal();qualityImportRefreshAfterThreshold()">关闭</button>`);
}

function qualityImportUpdateThreshold(idx, value) { const v = parseFloat(value) || 0; if (idx >= 0 && idx < qualityThresholds.length) qualityThresholds[idx].max = v; }
async function qualityImportDeleteThreshold(idx) { if (idx<0||idx>=qualityThresholds.length) return; const th = qualityThresholds[idx]; if (QUALITY_DEFAULT_THRESHOLD_NAMES.has(th.name)) { showToast('默认阈值不可删除','warning'); return; } try { qualityThresholds = await eel.remove_custom_threshold_category(th.name)(); showToast('已删除','success'); qualityImportShowThresholds(); } catch(e) { showToast('删除失败: '+e,'error'); } }
async function qualityImportConfirmAddThreshold() { const name = document.getElementById('mvth-new-name').value.trim(), mode = document.getElementById('mvth-new-mode')?.value||'sum', maxScore = parseFloat(document.getElementById('mvth-new-max').value)||0, cats = [...document.querySelectorAll('.mvth-cat-cb:checked')].map(cb=>cb.value); if(!name){showToast('请输入名称','warning');return;} if(cats.length===0){showToast('请选择适用类别','warning');return;} if(maxScore<=0){showToast('请输入有效上限','warning');return;} try{qualityThresholds=await eel.add_custom_threshold_category(name,maxScore,cats,mode)();showToast(`已添加(${mode==='max_item'?'取最高':'求和封顶'})`,'success');qualityImportShowThresholds();}catch(e){showToast('添加失败: '+e,'error');} }
function qualityImportRefreshAfterThreshold() { QualityMaterialDrawer.setThresholds(qualityThresholds); qualityBatchRenderCapHint(); }

async function qualityImportOnActivityInput() { const a = document.getElementById('mv-activity').value.trim(); if(!a)return; try{const s=await eel.get_activity_suggestions(a)();if(s&&s.category){document.getElementById('mv-cat').value=s.category;qualityImportOnViewerCat();setTimeout(()=>{if(s.default_grade)document.getElementById('mv-grade').value=s.default_grade;if(s.default_score)document.getElementById('mv-score').value=s.default_score;},100);}}catch(e){} }

function qualityImportRenderViewerScores() {
    const el = document.getElementById('material-scoring-list'); if(!el)return;
    const sd = qualityViewerStudent; if(!sd)return;
    const sid = qualityImportRosterMap[sd.key] || sd.id || sd.key;
    const activities = qualityData[sid] || [];
    if(activities.length===0){el.innerHTML='<p style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">暂无加分项</p>';return;}
    let catTotals = {}; activities.forEach(a=>{catTotals[a.category]=(catTotals[a.category]||0)+a.score;});
    const {totalDeduction, capNotes} = _qualityApplyThresholds(catTotals, activities);
    const rawTotal = Object.values(catTotals).reduce((a,b)=>a+b,0), total = Math.max(0, rawTotal - totalDeduction);
    const safeSid = sid.replace(/'/g,"\\'");
    el.innerHTML = `<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">已添加 <strong>${activities.length}</strong> 项，拓展分: <strong style="color:var(--accent-primary);font-size:13px;">${total.toFixed(1)}</strong>${capNotes.length>0?'<br><span style="color:var(--color-warning);">⚠ '+capNotes.join('; ')+'(已达上限)</span>':''}</div><table class="data-table" style="font-size:10px;"><thead><tr><th>项目</th><th>类别</th><th>等级</th><th>加分</th><th></th></tr></thead><tbody>${activities.map((a,i)=>`<tr><td>${escapeHtml(a.activity)}</td><td>${escapeHtml(a.category)}</td><td>${escapeHtml(a.grade||'')}</td><td>${a.score}</td><td><button class="btn btn-ghost btn-sm" style="color:var(--color-error);font-size:10px;" onclick="qualityImportRemoveScore('${safeSid}',${i})">✕</button></td></tr>`).join('')}</tbody></table>`;
}

async function qualityImportOnViewerCat() { const cat = document.getElementById('mv-cat').value, sel = document.getElementById('mv-grade'); sel.innerHTML='<option value="">-- 选择等级 --</option>'; if(cat){try{const grades=await eel.get_quality_grades(cat)();grades.forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=g;sel.appendChild(o);});}catch(e){}} }

async function qualityImportAddScore() { const sd=qualityViewerStudent; if(!sd)return; const activity=document.getElementById('mv-activity').value.trim(),category=document.getElementById('mv-cat').value,grade=document.getElementById('mv-grade').value,score=parseFloat(document.getElementById('mv-score').value)||0; if(!activity){showToast('请输入项目名称','warning');return;} if(!category){showToast('请选择类别','warning');return;} if(score<=0){showToast('请输入有效分数','warning');return;} const sid=qualityImportRosterMap[sd.key]||sd.id||sd.key; const existing=(qualityData[sid]||[]); if(existing.some(a=>a.activity===activity&&a.category===category&&(a.grade||'')===grade&&a.score===score)){showToast('⚠️ 该学生已有相同的加分项，请勿重复添加','warning');return;} if(!qualityData[sid])qualityData[sid]=[]; qualityData[sid].push({activity,category,grade,score}); eel.save_activity_mapping(activity,category,grade,score)(); document.getElementById('mv-activity').value='';document.getElementById('mv-score').value='';qualityImportRenderViewerScores();_qualityImportAutoSave();showToast('已添加: '+activity+' +'+score+'分','success'); }
function qualityImportRemoveScore(sid,index){if(qualityData[sid]){qualityData[sid].splice(index,1);if(qualityData[sid].length===0)delete qualityData[sid];}qualityImportRenderViewerScores();_qualityImportAutoSave();}

async function _qualityImportAutoSave(){if(!qualityImportBaseDir)return;try{await eel.save_quality_data_snapshot(qualityImportBaseDir,qualityData)();}catch(e){console.error(e);}}
function qualityRepairDrawerDuplicatePairs(activities){
    const rows=Array.isArray(activities)?activities.slice():[];
    for(let i=0;i<rows.length-1;i++){
        const original=rows[i],shadow=rows[i+1];
        const same=original&&shadow&&original.activity===shadow.activity&&original.category===shadow.category&&(original.grade||'')===(shadow.grade||'')&&Number(original.score)===Number(shadow.score)&&(original.official_preset_id||null)===(shadow.official_preset_id||null);
        const generatedPair=same&&Object.prototype.hasOwnProperty.call(original,'base_score')&&!Object.prototype.hasOwnProperty.call(shadow,'base_score');
        if(generatedPair){rows.splice(i+1,1);}
    }
    return rows;
}
async function _qualityImportRestoreData(){if(!qualityImportBaseDir)return 0;try{const saved=await eel.load_quality_data_snapshot(qualityImportBaseDir)();let repaired=false;if(saved&&Object.keys(saved).length>0){for(const[sid,acts]of Object.entries(saved)){const clean=qualityRepairDrawerDuplicatePairs(acts);if(clean.length!==(acts||[]).length)repaired=true;if(!qualityData[sid])qualityData[sid]=[];if(qualityData[sid].length===0)qualityData[sid]=clean;}if(repaired)await _qualityImportAutoSave();return Object.keys(saved).length;}}catch(e){console.error(e);}return 0;}

// V9.2: Manual save/restore (user-visible JSON)
async function qualityImportSaveScoreProgress(){
    const cleanData={};let totalItems=0;for(const[sid,acts]of Object.entries(qualityData)){const filtered=(acts||[]).filter(a=>!a._is_total);if(filtered.length>0){cleanData[sid]=filtered;totalItems+=filtered.length;}}
    if(totalItems===0){showToast('没有可保存的加分数据','warning');return;}
    const dir=document.getElementById('quality-import-output-dir').value.trim();if(!dir){showToast('请先选择输出目录','warning');return;}
    try{const path=dir+'/素拓加分进度.json';const result=await eel.save_quality_progress_to_file(path,cleanData)();if(result.success)showToast(`✅ 进度已保存: ${result.student_count} 名学生, ${result.total_items} 条加分 → 素拓加分进度.json`,'success');else showToast('保存失败: '+result.error,'error');}catch(e){showToast('保存失败: '+e,'error');}
}
async function qualityImportRestoreProgress(){
    try{const path=await eel.select_file([['JSON文件','*.json'],['所有文件','*.*']],'选择加分进度JSON文件')();if(!path)return;
    const result=await eel.load_quality_progress_from_file(path)();if(!result.success){showToast('恢复失败: '+result.error,'error');return;}
    let merged=0;for(const[sid,acts]of Object.entries(result.data)){if(!qualityData[sid])qualityData[sid]=[];const existing=new Set(qualityData[sid].map(a=>`${a.activity}|${a.score}`));for(const act of(acts||[])){const key=`${act.activity}|${act.score}`;if(!existing.has(key)){qualityData[sid].push(act);merged++;}}}
    await _qualityImportAutoSave();if(qualityViewerStudent){const sid=qualityImportRosterMap[qualityViewerStudent.key]||qualityViewerStudent.id||qualityViewerStudent.key;QualityMaterialDrawer.setStudent(qualityViewerStudent,qualityData[sid]||[]);QualityMaterialDrawer.setThresholds(qualityThresholds);}qualityImportRenderTree();showToast(`✅ 进度已恢复: ${result.student_count} 名学生, ${result.total_items} 条加分 (新增 ${merged} 条)`,'success');}catch(e){showToast('恢复失败: '+e,'error');}
}

// ============================================================
// Import Mode: File Preview (in-app PDF/image/text)
// ============================================================
async function qualityImportPreviewFile(filename, basePath) {
    const previewEl = document.getElementById('material-file-preview'); if (!previewEl) return;
    // Normalize path separators: file-picker may return backslashes on Windows
    const filePath = (basePath + '/' + filename).replace(/\\/g, '/');
    previewEl.innerHTML = '<p style="color:var(--text-muted);">⏳ 加载中...</p>';
    try {
        const result = await eel.read_material_file(filePath)();
        if (!result || !result.success) { previewEl.innerHTML = `<p style="color:var(--color-error);">❌ ${result?.error||'无法读取文件'}</p>`; return; }
        const sizeStr = result.size ? (result.size > 1024*1024 ? (result.size/1024/1024).toFixed(1)+' MB' : (result.size/1024).toFixed(0)+' KB') : '';
        const infoBar = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:10px;color:var(--text-muted);"><span>📄 ${escapeHtml(result.filename)} ${sizeStr?'('+sizeStr+')':''}</span><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;" onclick="eel.open_file_externally('${filePath.replace(/\\/g,'\\\\')}')()" title="在外部程序中打开">🔗 外部打开</button></div>`;
        if (result.type === 'image') { previewEl.innerHTML = infoBar + `<div style="text-align:center;"><img src="${result.data}" style="max-width:100%;max-height:55vh;object-fit:contain;border-radius:4px;" onerror="this.parentElement.innerHTML='<p style=\\'color:var(--color-error);\\'>图片加载失败</p>'"></div>`; }
        else if (result.type === 'pdf') { previewEl.innerHTML = infoBar + `<embed src="${result.data}" type="application/pdf" width="100%" height="500px" style="border:1px solid var(--border-color);border-radius:4px;background:#fff;"></embed><p style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:center;">💡 如PDF无法显示，请点击右上角「外部打开」</p>`; }
        else if (result.type === 'text') { previewEl.innerHTML = infoBar + `<pre style="max-height:55vh;overflow:auto;background:var(--bg-tertiary);padding:12px;border-radius:4px;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all;border:1px solid var(--border-color);">${escapeHtml(result.data)}</pre>`; }
        else { previewEl.innerHTML = `<div style="text-align:center;padding:40px;"><p style="font-size:48px;">📎</p><p>${escapeHtml(result.filename)}</p><p style="font-size:10px;color:var(--text-muted);">${sizeStr}</p><p style="font-size:11px;color:var(--text-muted);">此文件类型不支持预览</p><button class="btn btn-teal btn-sm" style="margin-top:8px;" onclick="eel.open_file_externally('${filePath.replace(/\\/g,'\\\\')}')()">🔗 用默认程序打开</button></div>`; }
    } catch(e) { previewEl.innerHTML = `<p style="color:var(--color-error);">加载失败: ${e}</p>`; }
}

// ============================================================
// Import Mode: File Operations (Add/Rename/Delete)
// ============================================================
async function qualityImportAddFiles() { if(!qualityImportSelectedStudent||!qualityImportSelectedClass){showToast('请先选择学生','warning');return;} const studentDir=qualityImportSelectedClass+'/'+(qualityImportTree?.classes?.find(c=>c.name===qualityImportSelectedClass)?.students?.find(s=>s.key===qualityImportSelectedStudent)?.dir_name||qualityImportSelectedStudent); try{const result=await eel.add_files_to_student(qualityImportBaseDir,studentDir)();if(result&&result.success&&result.added_files.length>0){showToast(`已添加 ${result.added_files.length} 个文件`,'success');const treeResult=await eel.get_material_directory_tree(qualityImportBaseDir)();if(treeResult&&treeResult.success){qualityImportTree=treeResult;qualityImportRenderTree();}}else if(result&&!result.success&&result.error!=='未选择文件'){showToast(result.error||'添加失败','error');}}catch(e){showToast('添加失败: '+e,'error');} }

async function qualityImportRename() { if(!qualityImportSelectedStudent&&!qualityImportSelectedClass){showToast('请先选择班级或学生','warning');return;} let relPath,itemType,currentName; if(qualityImportSelectedStudent){const cls=qualityImportTree?.classes?.find(c=>c.name===qualityImportSelectedClass);const stu=cls?.students?.find(s=>s.key===qualityImportSelectedStudent);if(!stu)return;relPath=qualityImportSelectedClass+'/'+stu.dir_name;itemType='student';currentName=stu.name;}else{relPath=qualityImportSelectedClass;itemType='class';currentName=qualityImportSelectedClass;} const newName=prompt(`重命名「${currentName}」为:`,currentName);if(!newName||newName===currentName)return; try{const result=await eel.rename_material_item(qualityImportBaseDir,relPath,newName,itemType)();if(result&&result.success){showToast(`已重命名为「${result.new_name}」`,'success');const treeResult=await eel.get_material_directory_tree(qualityImportBaseDir)();if(treeResult&&treeResult.success){qualityImportTree=treeResult;qualityImportSelectedClass='';qualityImportSelectedStudent='';qualityImportRenderTree();qualityImportUpdateButtons();}}else{showToast(result?.error||'重命名失败','error');}}catch(e){showToast('重命名失败: '+e,'error');} }

async function qualityImportDelete() { if(!qualityImportSelectedStudent&&!qualityImportSelectedClass){showToast('请先选择班级或学生','warning');return;} let relPath,itemName; if(qualityImportSelectedStudent){const cls=qualityImportTree?.classes?.find(c=>c.name===qualityImportSelectedClass);const stu=cls?.students?.find(s=>s.key===qualityImportSelectedStudent);if(!stu)return;relPath=qualityImportSelectedClass+'/'+stu.dir_name;itemName=stu.name;}else{relPath=qualityImportSelectedClass;itemName=qualityImportSelectedClass;} if(!confirm(`确定删除「${itemName}」吗？此操作不可撤销！`))return; try{const result=await eel.delete_material_item(qualityImportBaseDir,relPath)();if(result&&result.success){showToast(`已删除「${itemName}」`,'success');if(qualityImportSelectedStudent){delete qualityImportProgress[qualityImportSelectedStudent];qualityImportSaveProgress();}qualityImportSelectedClass='';qualityImportSelectedStudent='';const treeResult=await eel.get_material_directory_tree(qualityImportBaseDir)();if(treeResult&&treeResult.success){qualityImportTree=treeResult;qualityImportRenderTree();}qualityImportUpdateButtons();qualityImportUpdateProgressBar();}else{showToast(result?.error||'删除失败','error');}}catch(e){showToast('删除失败: '+e,'error');} }
function qualityImportMarkDone(){if(!qualityImportSelectedStudent)return;qualityImportMarkAllFiles(qualityImportSelectedStudent,'done');qualityImportSelectedStudent='';qualityImportSelectedClass='';qualityImportUpdateButtons();showToast('已标记全部文件为完成 ✅','success');}
function qualityImportMarkPending(){if(!qualityImportSelectedStudent)return;qualityImportProgress[qualityImportSelectedStudent]='pending';qualityImportSaveProgress();qualityImportRenderTree();qualityImportUpdateProgressBar();const statusEl=document.getElementById('material-viewer-status');if(statusEl)statusEl.textContent='⬜ 待处理';showToast('已标为待处理 ⬜','info');}

// V9.3: Manually add a student (for those without ZIP upload)
async function qualityImportAddStudent() {
    if (!qualityImportBaseDir) { showToast('请先选择输出目录或解压材料', 'warning'); return; }
    // Collect existing class names from tree
    let existingClasses = [];
    if (qualityImportTree && qualityImportTree.classes) {
        existingClasses = qualityImportTree.classes.map(c => c.name);
    }
    let html = `<div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:12px;">班级</label>
        <input id="qas-new-class" class="input" style="width:100%;" placeholder="输入班级名（如：顿河交241）" list="qas-class-list">
        <datalist id="qas-class-list">${existingClasses.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
    </div>
    <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:12px;">学生姓名</label>
        <input id="qas-new-name" class="input" style="width:100%;" placeholder="如：张三">
    </div>
    <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:12px;">学号（可选，用于匹配花名册）</label>
        <input id="qas-new-id" class="input" style="width:100%;" placeholder="如：241001">
    </div>
    <p style="font-size:10px;color:var(--text-muted);">💡 添加后可选中该学生，点击「📄 查看并加分」录入分数</p>`;
    showModal('➕ 手动添加学生', html,
        `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button>
         <button class="btn btn-primary btn-sm" onclick="qualityImportConfirmAddStudent()">添加</button>`);
}

async function qualityImportConfirmAddStudent() {
    const className = document.getElementById('qas-new-class').value.trim();
    const studentName = document.getElementById('qas-new-name').value.trim();
    const studentId = document.getElementById('qas-new-id').value.trim();
    if (!className) { showToast('请输入班级名', 'warning'); return; }
    if (!studentName) { showToast('请输入学生姓名', 'warning'); return; }
    try {
        const result = await eel.add_student_manually(qualityImportBaseDir, className, studentName, studentId)();
        if (!result || !result.success) { showToast(result?.error || '添加失败', 'error'); return; }
        closeModal();
        // Refresh tree
        const treeResult = await eel.get_material_directory_tree(qualityImportBaseDir)();
        if (treeResult && treeResult.success) {
            qualityImportTree = treeResult;
            qualityImportRenderTree();
            // Auto-expand the class
            qualityImportExpanded[className] = true;
            qualityImportRenderTree();
            // Auto-select the new student
            const skey = result.key;
            qualityImportSelectedClass = className;
            qualityImportSelectedStudent = skey;
            qualityImportExpanded[skey] = true;
            qualityImportRenderTree();
            qualityImportUpdateButtons();
            // Auto-open viewer so user can add scores immediately
            setTimeout(() => qualityImportOpenViewer(), 200);
        }
        // Auto-match with roster
        if (Object.keys(qualityRoster).length > 0) qualityImportMatchRoster();
        showToast(`已添加学生「${studentName}」到「${className}」`, 'success');
    } catch(e) { showToast('添加失败: ' + e, 'error'); }
}

// ============================================================
// Import Mode: Progress Persistence
// ============================================================
async function qualityImportSaveProgress(){if(!qualityImportBaseDir)return;try{await eel.save_material_progress(qualityImportBaseDir,qualityImportProgress)();}catch(e){console.error(e);}}

function qualityImportUpdateProgressBar() {
    if(!qualityImportTree||!qualityImportTree.classes)return;
    let totalFiles=0,doneFiles=0,totalStudents=0,doneStudents=0;
    qualityImportTree.classes.forEach(cls=>{cls.students.forEach(s=>{totalStudents++;const files=_qualityImportGetAllFiles(s);totalFiles+=files.length;const sDone=files.filter(f=>qualityImportProgress[f.key]==='done').length;doneFiles+=sDone;if(files.length>0&&sDone===files.length)doneStudents++;});});
    const studentPct=totalStudents>0?Math.round(doneStudents/totalStudents*100):0,filePct=totalFiles>0?Math.round(doneFiles/totalFiles*100):0;
    const bar=document.getElementById('quality-import-progress-bar');if(bar)bar.style.width=studentPct+'%';
    const text=document.getElementById('quality-import-progress-text');if(text)text.textContent=`${doneStudents}/${totalStudents} 人完成，${doneFiles}/${totalFiles} 个文件已审 (${filePct}%)`;
    const summary=document.getElementById('quality-import-summary');if(summary)summary.textContent=`共 ${qualityImportTree.classes.length} 个班级，${totalStudents} 名学生，${totalFiles} 个文件`;
}

function qualityImportExpandAll(){if(qualityImportTree&&qualityImportTree.classes){qualityImportTree.classes.forEach(cls=>{qualityImportExpanded[cls.name]=true;});}qualityImportRenderTree();}
function qualityImportCollapseAll(){if(qualityImportTree&&qualityImportTree.classes){qualityImportTree.classes.forEach(cls=>{qualityImportExpanded[cls.name]=false;});}qualityImportRenderTree();}

// ============================================================
// Import Mode: Roster Matching
// ============================================================
function qualityImportMatchRoster() {
    if(!qualityImportTree||!qualityImportTree.classes)return;qualityImportRosterMap={};
    const nameToId={};for(const[sid,info]of Object.entries(qualityRoster)){const n=(info.name||'').trim();if(n)nameToId[n]=sid;}
    let matched=0;qualityImportTree.classes.forEach(cls=>{cls.students.forEach(s=>{if(s.name&&nameToId[s.name]){qualityImportRosterMap[s.key]=nameToId[s.name];matched++;}else if(s.id&&qualityRoster[s.id]){qualityImportRosterMap[s.key]=s.id;matched++;}else if(s.name){for(const[sid,info]of Object.entries(qualityRoster)){const rname=(info.name||'').trim();if(rname&&s.name&&(rname.includes(s.name)||s.name.includes(rname))){qualityImportRosterMap[s.key]=sid;matched++;break;}}}});});
    for(const[treeKey,rosterId]of Object.entries(qualityImportRosterMap)){if(qualityData[treeKey]&&treeKey!==rosterId){if(!qualityData[rosterId])qualityData[rosterId]=[];qualityData[rosterId]=qualityData[rosterId].concat(qualityData[treeKey]);delete qualityData[treeKey];}}
    qualityImportRenderTree();const total=qualityImportTree.classes.reduce((a,c)=>a+c.students.length,0);showToast(`姓名匹配: ${matched}/${total}`,matched===total?'success':'warning');
}

function qualityImportManualMatch(treeKey){if(!qualityRoster||Object.keys(qualityRoster).length===0){showToast('请先导入花名册','warning');return;}let studentName=treeKey;if(qualityImportTree){for(const cls of qualityImportTree.classes){for(const s of cls.students){if(s.key===treeKey){studentName=s.name;break;}}}}const classes={};for(const[sid,info]of Object.entries(qualityRoster)){const cls=info.class||'其他';if(!classes[cls])classes[cls]=[];classes[cls].push({id:sid,name:info.name});}let opts='<option value="">-- 选择学生 --</option>';for(const[cls,students]of Object.entries(classes).sort()){opts+=`<optgroup label="${escapeHtml(cls)}">`;students.forEach(s=>{const sel=qualityImportRosterMap[treeKey]===s.id?'selected':'';opts+=`<option value="${escapeHtml(s.id)}" ${sel}>${escapeHtml(s.name)} (${escapeHtml(s.id)})</option>`;});opts+='</optgroup>';}showModal(`匹配学生: ${escapeHtml(studentName)}`,`<div class="form-group"><label>选择花名册中对应的学生</label><select id="qm-match-select" class="select-input" style="width:100%;">${opts}</select></div><p style="font-size:10px;color:var(--text-muted);">当前目录名: ${escapeHtml(treeKey)}</p>`,`<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button> <button class="btn btn-primary btn-sm" onclick="qualityImportConfirmMatch('${escapeHtml(treeKey).replace(/'/g,"\\'")}')">确认匹配</button>`);}

function qualityImportConfirmMatch(treeKey){const sel=document.getElementById('qm-match-select'),rosterId=sel?sel.value:'';if(rosterId){qualityImportRosterMap[treeKey]=rosterId;if(qualityData[treeKey]&&!qualityData[rosterId]){qualityData[rosterId]=qualityData[treeKey];delete qualityData[treeKey];}showToast('匹配成功','success');}else{delete qualityImportRosterMap[treeKey];showToast('已取消匹配','info');}closeModal();qualityImportRenderTree();}

// ============================================================
// Import Mode: Open Existing Folder
// ============================================================
async function qualityImportOpenFolder(){
    try{const dir=await eel.select_directory('选择已整理的班级材料文件夹')();if(!dir)return;
    const result=await eel.smart_scan_directory(dir)();if(!result||!result.success){showToast(result?.error||'读取失败','error');return;}
    qualityImportTree=result;qualityImportBaseDir=dir;
    try{qualityImportProgress=_qualityImportNormalizeProgressKeys(await eel.load_material_progress(dir)()||{});}catch(e){qualityImportProgress={};}
    if(result.classes)result.classes.forEach(cls=>{qualityImportExpanded[cls.name]=true;});
    document.getElementById('quality-import-output-dir').value=dir;
    document.getElementById('quality-import-status').innerHTML=`<span style="color:var(--color-success);">✅ 已加载: ${result.total_students} 名学生, ${result.total_files} 个文件</span>`;
    const ts=document.getElementById('quality-import-tree-section');if(ts)ts.style.display='block';
    const restored=await _qualityImportRestoreData();if(Object.keys(qualityRoster).length>0)qualityImportMatchRoster();
    qualityImportRenderTree();qualityImportUpdateProgressBar();showToast(`已加载: ${result.classes.length} 个班级`+(restored>0?`，恢复 ${restored} 人评分数据`:''),'success');
    }catch(e){showToast('加载失败: '+e,'error');}
}

// ============================================================
// Batch Bonus (批量加分)
// ============================================================

async function qualityBatchInitUI() {
    const classSel = document.getElementById('qb-class-filter');
    if (classSel) {
        classSel.innerHTML = '<option value="">全部班级</option>';
        qualityClassOrder.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            option.selected = cls === qualityBatchClassFilter;
            classSel.appendChild(option);
        });
    }
    try {
        const [categories, mappings] = await Promise.all([
            eel.get_quality_categories()(),
            eel.load_activity_mappings_json()(),
        ]);
        const categorySel = document.getElementById('qb-cat');
        const datalist = document.getElementById('qb-datalist');
        const categoryNames = new Set(categories || []);
        Object.values(mappings || {}).forEach(mapping => {
            if (mapping && mapping.category) categoryNames.add(mapping.category);
        });
        qualityThresholds.forEach(threshold => {
            (threshold.categories || []).forEach(category => categoryNames.add(category));
        });
        if (categorySel) {
            const current = categorySel.value;
            categorySel.innerHTML = '<option value="">-- 类别 --</option>';
            categoryNames.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySel.appendChild(option);
            });
            if ([...categorySel.options].some(option => option.value === current)) categorySel.value = current;
        }
        if (datalist) {
            datalist.innerHTML = '';
            Object.keys(mappings || {}).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error('批量加分选项加载失败', error);
    }
    qualityBatchRenderCapHint();
}

function qualityBatchRenderCapHint() {
    const target = document.getElementById('qb-cap-hint');
    const category = document.getElementById('qb-cat')?.value || '';
    if (!target) return;
    if (!category) {
        target.textContent = '选择项目或类别后显示适用上限';
        return;
    }
    const rules = qualityThresholds.filter(th => {
        const thCats = th.categories || [];
        return thCats.includes(category);
    });
    if (!rules.length) {
        target.textContent = `“${category}”暂无上限规则`;
        return;
    }
    target.innerHTML = rules.map(th => {
        const isMaxItem = th.mode === 'max_item';
        return isMaxItem
            ? `🏆 ${escapeHtml(th.name)}：本组多项只取最高，最高 ${th.max} 分`
            : `Σ ${escapeHtml(th.name)}：本组累计最高 ${th.max} 分`;
    }).join('<br>');
}

function qualityBatchRenderStudentList() {
    const container = document.getElementById('qb-student-list');
    if (!container) return;
    if (Object.keys(qualityRoster).length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">请先导入花名册</p>';
        return;
    }
    const term = (qualityBatchSearchTerm || '').toLowerCase();
    const classFilter = qualityBatchClassFilter || '';
    const grouped = {};
    for (const [sid, info] of Object.entries(qualityRoster)) {
        if (classFilter && info.class !== classFilter) continue;
        if (term && !info.name.toLowerCase().includes(term) && !sid.toLowerCase().includes(term)) continue;
        if (!grouped[info.class]) grouped[info.class] = [];
        grouped[info.class].push({ sid, name: info.name });
    }
    const sortedClasses = Object.keys(grouped).sort();
    let html = '';
    let totalVisible = 0;
    if (sortedClasses.length === 0) {
        html = '<p style="color:var(--text-muted);text-align:center;padding:12px;">无匹配学生</p>';
    } else {
        sortedClasses.forEach(cls => {
            const students = grouped[cls];
            totalVisible += students.length;
            const allSelected = students.every(s => qualityBatchTargets.has(s.sid));
            const someSelected = students.some(s => qualityBatchTargets.has(s.sid));
            const selectedCount = students.filter(s => qualityBatchTargets.has(s.sid)).length;
            html += '<div style="margin-bottom:2px;">';
            html += '<div style="display:flex;align-items:center;padding:4px 8px;background:var(--bg-secondary);border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;" onclick="qualityBatchToggleClass(\'' + escapeHtml(cls).replace(/'/g,"\\'") + '\')">';
            html += '<span style="margin-right:6px;">' + (allSelected ? '☑' : someSelected ? '◐' : '☐') + '</span>';
            html += '<span>' + escapeHtml(cls) + '</span>';
            html += '<span style="margin-left:auto;font-size:10px;color:var(--text-muted);">' + selectedCount + '/' + students.length + '</span>';
            html += '</div>';
            students.forEach(s => {
                html += '<div style="display:flex;align-items:center;padding:3px 8px 3px 28px;cursor:pointer;font-size:11px;' + (qualityBatchTargets.has(s.sid) ? 'background:var(--accent-primary-muted);border-radius:4px;' : '') + '" onclick="qualityBatchToggleStudent(\'' + s.sid.replace(/'/g,"\\'") + '\')">';
                html += '<span style="margin-right:6px;">' + (qualityBatchTargets.has(s.sid) ? '☑' : '☐') + '</span>';
                html += '<span>' + escapeHtml(s.name) + '</span>';
                html += '<span style="margin-left:auto;font-size:9px;color:var(--text-muted);">' + escapeHtml(s.sid) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        });
    }
    container.innerHTML = html;
    document.getElementById('qb-selection-count').textContent = '已选择 ' + qualityBatchTargets.size + ' 名学生 (可见 ' + totalVisible + ')';
}

function qualityBatchToggleStudent(sid) {
    if (qualityBatchTargets.has(sid)) { qualityBatchTargets.delete(sid); }
    else { qualityBatchTargets.add(sid); }
    qualityBatchRenderStudentList();
}

function qualityBatchToggleClass(cls) {
    const term = (qualityBatchSearchTerm || '').toLowerCase();
    const students = [];
    for (const [sid, info] of Object.entries(qualityRoster)) {
        if (info.class !== cls) continue;
        if (term && !info.name.toLowerCase().includes(term) && !sid.toLowerCase().includes(term)) continue;
        students.push(sid);
    }
    if (students.length === 0) return;
    const allSelected = students.every(s => qualityBatchTargets.has(s));
    if (allSelected) { students.forEach(s => qualityBatchTargets.delete(s)); }
    else { students.forEach(s => qualityBatchTargets.add(s)); }
    qualityBatchRenderStudentList();
}

function qualityBatchSearch() {
    qualityBatchSearchTerm = document.getElementById('qb-search') ? document.getElementById('qb-search').value : '';
    qualityBatchRenderStudentList();
}

function qualityBatchFilterClass() {
    qualityBatchClassFilter = document.getElementById('qb-class-filter') ? document.getElementById('qb-class-filter').value : '';
    qualityBatchRenderStudentList();
}

function qualityBatchSelectAllVisible() {
    const term = (qualityBatchSearchTerm || '').toLowerCase();
    const classFilter = qualityBatchClassFilter || '';
    for (const [sid, info] of Object.entries(qualityRoster)) {
        if (classFilter && info.class !== classFilter) continue;
        if (term && !info.name.toLowerCase().includes(term) && !sid.toLowerCase().includes(term)) continue;
        qualityBatchTargets.add(sid);
    }
    qualityBatchRenderStudentList();
}

function qualityBatchClearSelection() {
    qualityBatchTargets = new Set();
    qualityBatchRenderStudentList();
}

async function qualityBatchOnActivityInput() {
    const a = document.getElementById('qb-activity').value.trim();
    if (!a) { qualityBatchRenderCapHint(); return; }
    try {
        const s = await eel.get_activity_suggestions(a)();
        if (s && s.category) {
            document.getElementById('qb-cat').value = s.category;
            await qualityBatchOnCat();
            if (s.default_grade) document.getElementById('qb-grade').value = s.default_grade;
            if (s.default_score !== undefined && s.default_score !== null) document.getElementById('qb-score').value = s.default_score;
        }
    } catch(e) {}
    qualityBatchRenderCapHint();
}

async function qualityBatchOnCat() {
    const cat = document.getElementById('qb-cat').value;
    const sel = document.getElementById('qb-grade');
    sel.innerHTML = '<option value="">-- 等级 --</option>';
    if (cat) {
        try {
            const grades = await eel.get_quality_grades(cat)();
            grades.forEach(function(g) { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); });
        } catch(e) {}
    }
    qualityBatchRenderCapHint();
}

function qualityBatchGatherInput() {
    const activityEl = document.getElementById('qb-activity');
    const catEl = document.getElementById('qb-cat');
    const gradeEl = document.getElementById('qb-grade');
    const scoreEl = document.getElementById('qb-score');
    const activity = activityEl ? activityEl.value.trim() : '';
    const category = catEl ? catEl.value : '';
    const grade = gradeEl ? gradeEl.value : '';
    const score = scoreEl ? (parseFloat(scoreEl.value) || 0) : 0;
    if (!activity) { showToast('请输入加分项目名称', 'warning'); return null; }
    if (!category) { showToast('请选择类别', 'warning'); return null; }
    if (score <= 0) { showToast('请输入有效分数', 'warning'); return null; }
    return { activity: activity, category: category, grade: grade, score: score };
}

function qualityBatchRefreshPreview() {
    const input = qualityBatchGatherInput();
    const container = document.getElementById('qb-preview');
    const btn = document.getElementById('qb-execute-btn');
    if (!container) return;

    if (!input || qualityBatchTargets.size === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">设置加分项目并选择学生后点击刷新预览</p>';
        if (btn) { btn.disabled = true; btn.textContent = '📋 批量添加 (+0 人)'; }
        return;
    }

    let willAdd = 0, dupCount = 0, cappedCount = 0;
    const previewRows = [];

    qualityBatchTargets.forEach(function(sid) {
        const info = qualityRoster[sid];
        if (!info) return;
        const existing = qualityData[sid] || [];

        const isDup = existing.some(function(a) {
            return a.activity === input.activity &&
                a.category === input.category &&
                (a.grade || '') === input.grade &&
                a.score === input.score;
        });

        if (isDup) {
            dupCount++;
            previewRows.push({ sid: sid, name: info.name, cls: info.class, existingItems: existing.length, willAdd: false, dup: true, capped: false, capNote: '', newTotal: null });
            return;
        }

        const simulated = existing.concat([{ activity: input.activity, category: input.category, grade: input.grade, score: input.score }]);
        const catTotals = {};
        simulated.forEach(function(a) { catTotals[a.category] = (catTotals[a.category] || 0) + a.score; });
        const thResult = _qualityApplyThresholds(catTotals, simulated);
        const totalDeduction = thResult.totalDeduction;
        const capNotes = thResult.capNotes;
        const rawTotal = Object.values(catTotals).reduce(function(a, b) { return a + b; }, 0);
        const newTotal = Math.max(0, rawTotal - totalDeduction);
        const isCapped = totalDeduction > 0;

        if (isCapped) cappedCount++;
        willAdd++;
        previewRows.push({ sid: sid, name: info.name, cls: info.class, existingItems: existing.length, willAdd: true, dup: false, capped: isCapped, capNote: capNotes.join('; '), newTotal: newTotal });
    });

    let html = '';
    if (previewRows.length === 0) {
        html = '<p style="color:var(--text-muted);text-align:center;padding:12px;">无数据</p>';
    } else {
        html += '<div style="margin-bottom:6px;font-size:10px;display:flex;gap:12px;flex-wrap:wrap;">';
        html += '<span style="color:var(--color-success);">✅ 将添加: <strong>' + willAdd + '</strong> 人</span>';
        if (dupCount > 0) html += '<span style="color:var(--text-muted);">⏭️ 跳过(重复): <strong>' + dupCount + '</strong> 人</span>';
        if (cappedCount > 0) html += '<span style="color:var(--color-warning);">⚠️ 触及上限: <strong>' + cappedCount + '</strong> 人</span>';
        html += '</div>';
        html += '<table class="data-table" style="font-size:10px;"><thead><tr><th>姓名</th><th>班级</th><th>已有</th><th>操作</th><th>新总分</th><th>备注</th></tr></thead><tbody>';
        previewRows.forEach(function(r) {
            const opIcon = r.dup ? '⏭️' : r.capped ? '⚠️' : '✅';
            const opText = r.dup ? '跳过(重复)' : r.capped ? '加(触上限)' : '添加';
            const opColor = r.dup ? 'var(--text-muted)' : r.capped ? 'var(--color-warning)' : 'var(--color-success)';
            const totalDisplay = r.newTotal !== null ? r.newTotal.toFixed(1) : '—';
            const remark = r.dup ? '已有相同加分项' : (r.capNote || '');
            html += '<tr>';
            html += '<td>' + escapeHtml(r.name) + '</td>';
            html += '<td>' + escapeHtml(r.cls) + '</td>';
            html += '<td>' + r.existingItems + '项</td>';
            html += '<td style="color:' + opColor + ';">' + opIcon + ' ' + opText + '</td>';
            html += '<td style="font-weight:600;">' + totalDisplay + '</td>';
            html += '<td style="font-size:9px;color:var(--text-muted);">' + escapeHtml(remark) + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
    }

    container.innerHTML = html;
    if (btn) {
        btn.disabled = willAdd === 0;
        btn.textContent = '📋 批量添加 (+' + willAdd + ' 人)' + (dupCount > 0 ? ', 跳过 ' + dupCount : '');
    }
}

async function qualityBatchExecute() {
    const input = qualityBatchGatherInput();
    if (!input) return;
    if (qualityBatchTargets.size === 0) { showToast('请先选择目标学生', 'warning'); return; }

    let added = 0, skipped = 0;
    qualityBatchTargets.forEach(function(sid) {
        const existing = qualityData[sid] || [];
        const isDup = existing.some(function(a) {
            return a.activity === input.activity &&
                a.category === input.category &&
                (a.grade || '') === input.grade &&
                a.score === input.score;
        });
        if (isDup) { skipped++; return; }

        if (!qualityData[sid]) qualityData[sid] = [];
        qualityData[sid].push({ activity: input.activity, category: input.category, grade: input.grade, score: input.score });
        added++;
    });

    eel.save_activity_mapping(input.activity, input.category, input.grade, input.score)();

    let msg = '批量加分完成: 添加 ' + added + ' 人';
    if (skipped > 0) msg += ', 跳过 ' + skipped + ' 人 (重复)';
    showToast(msg, added > 0 ? 'success' : 'info');

    qualityBatchTargets = new Set();
    qualityBatchRenderStudentList();
    qualityBatchRefreshPreview();
    document.getElementById('qb-activity').value = '';
    document.getElementById('qb-score').value = '';
    document.getElementById('qb-grade').innerHTML = '<option value="">-- 等级 --</option>';
}

function qualityBatchDeselectDups() {
    const input = qualityBatchGatherInput();
    if (!input) return;
    let removed = 0;
    qualityBatchTargets.forEach(function(sid) {
        const existing = qualityData[sid] || [];
        const isDup = existing.some(function(a) {
            return a.activity === input.activity &&
                a.category === input.category &&
                (a.grade || '') === input.grade &&
                a.score === input.score;
        });
        if (isDup) { qualityBatchTargets.delete(sid); removed++; }
    });
    qualityBatchRenderStudentList();
    qualityBatchRefreshPreview();
    if (removed > 0) showToast('已取消选择 ' + removed + ' 名已有重复项的学生', 'info');
    else showToast('没有重复学生', 'info');
}
