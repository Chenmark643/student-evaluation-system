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
let moralLastOutput = '';
let moralCloudOutputs = [];
let moralWorkspaceMode = 'continue';
let moralExistingSource = {path: '', mappings: {}, analysis: null};
let moralVnextItems = [];
let moralFreshItems = [];
// null means an older saved session has not made an explicit project choice yet.
// Projects that already contain data are selected automatically in that case.
let moralSelectedTemplateProjects = null;
let moralVnextOverrides = {};

const MORAL_PROJECT_TEMPLATES = [
    {key:'evaluation', code:'DY-PY-01', name:'评议分'},
    {key:'night_manager', code:'DY-WQ-01', name:'晚寝负责人'},
    {key:'self_study', code:'DY-ZX-01', name:'早晚自习出勤'},
    {key:'class_attendance', code:'DY-KT-01', name:'课堂出勤'},
    {key:'dorm_hygiene', code:'DY-SS-01', name:'宿舍卫生'},
    {key:'classroom_hygiene', code:'DY-JS-01', name:'教室卫生'},
    {key:'league_class', code:'DY-TK-01', name:'团课出勤'},
    {key:'youth_study', code:'DY-QN-01', name:'青年大学习'},
    {key:'criticism', code:'DY-TB-01', name:'通报批评'},
    {key:'discipline', code:'DY-WJ-01', name:'违纪情况'},
];

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

function moralRememberOutput(path) {
    const value = String(path || '').trim();
    if (!value) return;
    moralLastOutput = value;
    moralCloudOutputs = moralCloudOutputs.filter(existing => existing !== value);
    moralCloudOutputs.push(value);
    if (moralCloudOutputs.length > 20) moralCloudOutputs = moralCloudOutputs.slice(-20);
}

function moralWorkspaceHeader() {
    return `<section class="moral-workspace-hero moral-workspace-hero-compact">
        <div class="moral-workspace-copy">
            <span class="moral-workspace-kicker">德育分工作台</span>
            <h2>先告诉我你手上有什么材料</h2>
            <p>系统会进入合适流程。常用设置自动处理，只有发现问题时才需要人工确认。</p>
        </div>
        <button class="moral-major-button" type="button" onclick="MajorScope.open()"><span>当前专业</span><b data-major-scope-label>未设置专业</b><small>点击修改</small></button>
    </section>
    <div class="moral-material-grid" aria-label="选择现有材料">
        <button class="moral-material-card ${moralWorkspaceMode === 'continue' ? 'active' : ''}" onclick="moralChooseMaterial('continue')">
            <span class="moral-material-icon">半</span><span><b>我有部分德育表</b><small>在原表后补充团课等项目</small></span><em>${moralWorkspaceMode === 'continue' ? '当前流程' : '选择'}</em>
        </button>
        <button class="moral-material-card ${moralWorkspaceMode === 'fresh' ? 'active' : ''}" onclick="moralChooseMaterial('fresh')">
            <span class="moral-material-icon">新</span><span><b>我还没有德育表</b><small>从花名册和项目材料开始</small></span><em>${moralWorkspaceMode === 'fresh' ? '当前流程' : '选择'}</em>
        </button>
        <button class="moral-material-card" onclick="moralUseFinishedFile()">
            <span class="moral-material-icon">成</span><span><b>我已有最终德育表</b><small>检查后直接交给后续模块使用</small></span><em>选择文件</em>
        </button>
    </div><div id="moral-ready-status" class="moral-finished-status"></div>`;
}

function moralChooseMaterial(mode) {
    moralSetWorkspaceMode(mode);
    document.getElementById(`moral-route-${mode === 'fresh' ? 'fresh' : 'continue'}`)?.scrollIntoView({behavior:'smooth', block:'start'});
}

function moralPresetMarkup(mode) {
    const presets = [
        ['团课出勤','deduct'], ['早晚自习','deduct'], ['课堂出勤','deduct'],
        ['宿舍卫生','deduct'], ['教室卫生','deduct'], ['评议奖励','add'],
    ];
    return `<div class="moral-preset-panel"><div><strong>常用项目</strong><small>点击即可添加，方向以后还能修改</small></div><div class="moral-preset-list">${presets.map(([name,direction]) =>
        `<button type="button" onclick="moralAddPresetItem('${mode}','${name}','${direction}')"><b>${direction === 'add' ? '+' : '−'}</b>${name}</button>`
    ).join('')}</div></div>`;
}

function moralAddPresetItem(mode, name, direction) {
    const items = mode === 'fresh' ? moralFreshItems : moralVnextItems;
    const existing = items.find(item => item.name === name);
    if (existing) { showToast(`${name}已经添加，可继续选择文件或批量录入`, 'info'); return; }
    items.push({id:`moral-${mode}-${Date.now()}-${items.length}`, name, direction, value_mode:'auto', sources:[], manual_values:{}});
    mode === 'fresh' ? moralRenderFreshItems() : moralRenderVnextItems();
    saveAllToMemory();
    showToast(`${name}已添加，可选择文件或直接批量录入`, 'success');
}

function moralContinueMarkup() {
    const existingName = moralExistingSource.path ? moralExistingSource.path.split(/[\\/]/).pop() : '';
    return `<div class="moral-continuation-grid">
        <section class="module-section moral-vnext-section">
            <div class="moral-section-heading"><span class="step-badge">1</span><div><h2>接入已有德育</h2><p>优先映射未截断原始分；没有原始分时，可用基础分、总扣分和总加分恢复。</p></div></div>
            <div class="moral-source-well ${existingName ? 'has-source' : ''}">
                <div><span class="moral-source-label">已有德育工作簿</span><strong id="moral-existing-name">${existingName ? escapeHtml(existingName) : '尚未选择文件'}</strong><small id="moral-existing-meta">${existingName ? '映射已保存，可重新检查' : '支持 .xlsx / .xls，多工作表可单独启用'}</small></div>
                <button class="btn btn-secondary" onclick="moralPickExistingSource()">${existingName ? '检查映射' : '选择并映射'}</button>
            </div>
        </section>

        <section class="module-section moral-vnext-section moral-rule-section">
            <div class="moral-section-heading"><span class="step-badge">2</span><div><h2>计分规则</h2><p>默认使用0～115分，并保留原表中超过上限的缓冲分。</p></div></div>
            <details class="moral-advanced-config"><summary><span><b>修改计分规则</b><small>一般不需要修改</small></span><em>高级设置</em></summary><div class="moral-advanced-body">
            <div class="moral-score-settings">
                <label><span>基础分</span><input id="moral-vnext-base" class="input" type="number" step="0.01" value="115"></label>
                <label><span>最低分</span><input id="moral-vnext-min" class="input" type="number" step="0.01" value="0"></label>
                <label><span>最高分</span><input id="moral-vnext-max" class="input" type="number" step="0.01" value="115"></label>
            </div>
            <div class="moral-basis-grid">
                <label class="moral-basis-option active"><input type="radio" name="moral-continuation-basis" value="raw" checked onchange="moralUpdateBasisCards()"><span><b>保留未截断原始分</b><small>原始125，团课扣5，最终仍为115</small></span><em>推荐</em></label>
                <label class="moral-basis-option"><input type="radio" name="moral-continuation-basis" value="display" onchange="moralUpdateBasisCards()"><span><b>从当前显示分重新起算</b><small>显示115，团课扣5，最终变为110</small></span></label>
            </div></div></details>
        </section>
    </div>

    <section class="module-section moral-vnext-section">
        <div class="moral-section-heading"><span class="step-badge">3</span><div><h2>添加本次加分与扣分项目</h2><p>每个项目可以选择自己的工作表和分数列；系统会统一处理表格中的分数，并在生成前让你检查。</p></div></div>
        ${moralPresetMarkup('continue')}
        <details class="moral-advanced-config moral-custom-project"><summary><span><b>添加自定义项目</b><small>可以设置项目名称、加分还是扣分，以及表格中的分数格式</small></span><em>展开</em></summary><div class="moral-advanced-body"><div class="moral-item-composer">
            <label><span>项目名称</span><input id="moral-new-item-name" class="input" placeholder="例如：团课出勤"></label>
            <label><span>加分还是扣分</span><select id="moral-new-item-direction" class="select-input"><option value="deduct">扣分</option><option value="add">加分</option></select></label>
            <label><span>表格里的分数是</span><select id="moral-new-item-mode" class="select-input"><option value="auto">让系统自动判断（推荐）</option><option value="signed">带正负号，如 -2、+3</option><option value="amount">只填正数，如 2、3</option></select></label>
            <button class="btn btn-primary" onclick="moralAddVnextItem()">添加项目</button>
        </div></div></details>
        <div id="moral-vnext-items" class="moral-item-list"></div>
    </section>

    <section class="module-section moral-vnext-section moral-export-section">
        <div class="moral-section-heading"><span class="step-badge">4</span><div><h2>审查并写回原总计结构</h2><p>原有项目保持不动；新增扣分插在“总扣分”前，新增加分插在“总加分”前，沿用原“最终得分”列并更新公式。</p></div></div>
        <div id="moral-vnext-ready-summary" class="moral-ready-summary"></div>
        <div class="file-picker-row">
            <input id="moral-vnext-output-dir" class="file-path" readonly placeholder="选择输出目录...">
            <button class="btn btn-secondary" onclick="pickDirectory('moral-vnext-output-dir','选择德育续算输出目录')">浏览</button>
        </div>
        <div class="moral-final-actions"><div id="moral-vnext-status" class="moral-vnext-status"><span>等待已有德育和新增项目</span></div><button class="btn btn-primary" id="moral-vnext-run" onclick="moralRunVnext()">审查并生成</button></div>
        <div id="moral-vnext-result"></div>
    </section>`;
}

function moralSetWorkspaceMode(mode) {
    moralWorkspaceMode = mode === 'fresh' ? 'fresh' : 'continue';
    document.getElementById('moral-route-continue')?.toggleAttribute('hidden', moralWorkspaceMode !== 'continue');
    document.getElementById('moral-route-fresh')?.toggleAttribute('hidden', moralWorkspaceMode !== 'fresh');
    const cards = document.querySelectorAll('.moral-material-card');
    cards[0]?.classList.toggle('active', moralWorkspaceMode === 'continue');
    cards[1]?.classList.toggle('active', moralWorkspaceMode === 'fresh');
    if (cards[0]?.querySelector('em')) cards[0].querySelector('em').textContent = moralWorkspaceMode === 'continue' ? '当前流程' : '选择';
    if (cards[1]?.querySelector('em')) cards[1].querySelector('em').textContent = moralWorkspaceMode === 'fresh' ? '当前流程' : '选择';
    moralRefreshReadySummary(moralWorkspaceMode);
    saveAllToMemory();
}

function moralUpdateBasisCards() {
    document.querySelectorAll('.moral-basis-option').forEach(card => card.classList.toggle('active', Boolean(card.querySelector('input')?.checked)));
}

async function moralPickExistingSource() {
    try {
        const path = await eel.select_file([['Excel文件','*.xlsx;*.xls']], '选择已有德育文件')();
        if (!path) return;
        ImportStudio.open({path, moduleType:'moral_existing', title:'已有德育 · 工作表与续算字段映射', onConfirm:(mappings, analysis) => {
            moralExistingSource = {path, mappings, analysis, scope_classes:moralExtractScopeClasses(analysis, mappings)};
            const name = document.getElementById('moral-existing-name');
            const meta = document.getElementById('moral-existing-meta');
            const well = name?.closest('.moral-source-well');
            if (name) name.textContent = path.split(/[\\/]/).pop();
            if (meta) meta.textContent = `已启用 ${Object.values(mappings).filter(item => item.enabled).length} 个工作表 · 可重新检查`;
            well?.classList.add('has-source');
            saveAllToMemory();
        }});
    } catch (error) { showToast('已有德育导入失败：' + error, 'error'); }
}

function moralAddVnextItem() {
    const nameInput = document.getElementById('moral-new-item-name');
    const name = nameInput?.value?.trim();
    if (!name) { showToast('请填写项目名称', 'warning'); return; }
    moralVnextItems.push({
        id: `moral-item-${Date.now()}-${moralVnextItems.length}`,
        name,
        direction: document.getElementById('moral-new-item-direction')?.value || 'deduct',
        value_mode: document.getElementById('moral-new-item-mode')?.value || 'auto',
        sources: [], manual_values:{},
    });
    nameInput.value = '';
    moralRenderVnextItems();
    saveAllToMemory();
}

function moralUpdateItemDirection(itemId, mode, nextDirection) {
    const items = mode === 'fresh' ? moralFreshItems : moralVnextItems;
    const item = items.find(entry => entry.id === itemId);
    const normalized = nextDirection === 'add' ? 'add' : 'deduct';
    if (!item || item.direction === normalized) return;
    const previousLabel = item.direction === 'add' ? '加分' : '扣分';
    const nextLabel = normalized === 'add' ? '加分' : '扣分';
    item.direction = normalized;
    if (mode === 'fresh') moralRenderFreshItems();
    else moralRenderVnextItems();
    saveAllToMemory();
    showToast(`${item.name}：已从${previousLabel}改为${nextLabel}，文件、映射和批量录入均已保留`, 'success');
}

function moralUpdateItemValueMode(itemId, mode, nextMode) {
    const items = mode === 'fresh' ? moralFreshItems : moralVnextItems;
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;
    item.value_mode = ['signed','amount'].includes(nextMode) ? nextMode : 'auto';
    saveAllToMemory();
    showToast(`${item.name}的表格分数格式已更新`, 'success');
}

function moralItemStatusMarkup(item, mode) {
    const sources = item.sources || [];
    const mapped = sources.filter(moralSourceIsMapped).length;
    const manualCount = Object.keys(item.manual_values || {}).length;
    const modeLabel = item.value_mode === 'signed' ? '带正负号' : item.value_mode === 'amount' ? '只填正数' : '系统自动判断';
    return `<div class="moral-item-statusline"><span>${sources.length ? `${sources.length}个文件` : '未选文件'}</span><span>${sources.length ? `${mapped}/${sources.length}已映射` : '可只用批量录入'}</span><span>批量${manualCount}人</span></div>
        <details class="moral-item-details"><summary>查看文件与高级设置</summary><div class="moral-item-detail-body">
            <div class="moral-item-sources">${sources.length ? sources.map((source,index) => `<span title="${escapeHtml(source.path)}">${escapeHtml(source.path.split(/[\\/]/).pop())}<button onclick="${mode === 'fresh' ? 'moralMapFreshSource' : 'moralMapVnextSource'}('${item.id}',${index})">${moralSourceIsMapped(source) ? '重新映射' : '立即映射'}</button></span>`).join('') : '<em>尚未添加来源文件</em>'}</div>
            <label class="moral-value-mode"><span>表格里的分数是</span><select class="select-input" onchange="moralUpdateItemValueMode('${item.id}','${mode}',this.value)"><option value="auto" ${!['signed','amount'].includes(item.value_mode) ? 'selected' : ''}>让系统自动判断（推荐）</option><option value="signed" ${item.value_mode === 'signed' ? 'selected' : ''}>带正负号，如 -2、+3</option><option value="amount" ${item.value_mode === 'amount' ? 'selected' : ''}>只填正数，如 2、3</option></select><small>当前：${modeLabel}</small></label>
        </div></details>`;
}

function moralRefreshReadySummary(mode) {
    const fresh = mode === 'fresh';
    const items = fresh ? moralFreshConfiguredItems() : moralVnextItems;
    const sources = items.reduce((sum,item) => sum + (item.sources || []).length, 0);
    const mapped = items.reduce((sum,item) => sum + (item.sources || []).filter(moralSourceIsMapped).length, 0);
    const templateProjects = fresh ? moralSelectedTemplateKeys().length : 0;
    const visibleItemCount = fresh ? templateProjects + items.filter(item => !item.standard_template).length : items.length;
    const min = document.getElementById(fresh ? 'moral-fresh-min' : 'moral-vnext-min')?.value ?? 0;
    const max = document.getElementById(fresh ? 'moral-fresh-max' : 'moral-vnext-max')?.value ?? 115;
    const target = document.getElementById(fresh ? 'moral-fresh-ready-summary' : 'moral-vnext-ready-summary');
    if (!target) return;
    target.innerHTML = `<div><small>当前专业</small><b>${escapeHtml(MajorScope.get() || '尚未设置')}</b></div><div><small>本次计分项目</small><b>${visibleItemCount}项</b></div><div><small>材料映射</small><b>${mapped}/${sources}</b></div><div><small>分数范围</small><b>${escapeHtml(min)}～${escapeHtml(max)}</b></div><p>${fresh && !visibleItemCount ? '当前未选择计分项目，将按基础分生成；可返回上方勾选需要的项目。' : '点击生成后，系统会先审查已选项目的姓名、专业和映射问题，不会校验未选择的项目。'}</p>`;
}

function moralRenderVnextItems() {
    const container = document.getElementById('moral-vnext-items');
    if (!container) return;
    if (!moralVnextItems.length) {
        container.innerHTML = `<div class="moral-items-empty"><span>＋</span><div><b>还没有新增项目</b><small>先添加“团课出勤”等项目，再为它选择来源文件。</small></div></div>`;
        moralRefreshReadySummary('continue');
        return;
    }
    container.innerHTML = moralVnextItems.map(item => {
        const sources = item.sources || [];
        return `<article class="moral-item-card">
            <div class="moral-item-sign ${item.direction}">${item.direction === 'add' ? '+' : '−'}</div>
            <div class="moral-item-body"><div class="moral-item-title"><strong>${escapeHtml(item.name)}</strong><label class="moral-direction-editor" title="可随时修改；已有文件、映射和批量录入不会被清空"><span>加分还是扣分</span><select class="select-input" data-item-id="${escapeHtml(item.id)}" onchange="moralUpdateItemDirection(this.dataset.itemId,'continue',this.value)"><option value="deduct" ${item.direction === 'deduct' ? 'selected' : ''}>扣分</option><option value="add" ${item.direction === 'add' ? 'selected' : ''}>加分</option></select><small>数据保留</small></label></div>
            ${moralItemStatusMarkup(item,'continue')}</div>
            <div class="moral-item-actions"><button class="btn btn-secondary btn-sm" onclick="moralAttachVnextSource('${item.id}')">${sources.length ? '再选文件' : '选择文件'}</button><button class="btn btn-secondary btn-sm" onclick="moralOpenBatchEntry('${item.id}','continue')">批量录入</button><button class="btn btn-ghost btn-sm" onclick="moralRemoveVnextItem('${item.id}')">删除</button></div>
        </article>`;
    }).join('');
    moralRefreshReadySummary('continue');
}

function moralTemplateItem(projectKey, direction) {
    return moralFreshItems.find(item =>
        item.standard_template && item.template_project === projectKey && item.direction === direction);
}

function moralEnsureTemplateItem(project, direction) {
    let item = moralTemplateItem(project.key, direction);
    if (item) return item;
    item = {
        id:`moral-template-${project.key}-${direction}`,
        name:project.name,
        direction,
        value_mode:'amount',
        sources:[],
        manual_values:{},
        standard_template:true,
        template_project:project.key,
        template_code:project.code,
    };
    moralFreshItems.push(item);
    return item;
}

function moralTemplateFiles(projectKey) {
    const item = moralTemplateItem(projectKey, 'add') || moralTemplateItem(projectKey, 'deduct');
    return item?.sources || [];
}

function moralSelectedTemplateKeys() {
    if (!Array.isArray(moralSelectedTemplateProjects)) {
        moralSelectedTemplateProjects = [...new Set(moralFreshItems
            .filter(item => item.standard_template && (
                (item.sources || []).length || Object.keys(item.manual_values || {}).length
            ))
            .map(item => item.template_project)
            .filter(Boolean))];
    }
    return moralSelectedTemplateProjects;
}

function moralTemplateProjectSelected(projectKey) {
    return moralSelectedTemplateKeys().includes(projectKey);
}

function moralFreshConfiguredItems() {
    const selected = new Set(moralSelectedTemplateKeys());
    return moralFreshItems.filter(item => !item.standard_template || selected.has(item.template_project));
}

function moralSetTemplateProjectSelected(projectKey, selected, options={}) {
    const project = MORAL_PROJECT_TEMPLATES.find(entry => entry.key === projectKey);
    if (!project) return;
    const keys = new Set(moralSelectedTemplateKeys());
    selected ? keys.add(projectKey) : keys.delete(projectKey);
    moralSelectedTemplateProjects = [...keys];
    moralRenderFreshItems();
    saveAllToMemory();
    if (!options.silent) {
        const hasSavedData = moralFreshItems.some(item => item.standard_template && item.template_project === projectKey && (
            (item.sources || []).length || Object.keys(item.manual_values || {}).length
        ));
        const message = selected
            ? `已选择“${project.name}”，请上传材料或批量录入`
            : `已取消“${project.name}”${hasSavedData ? '，已有数据会保留，但不参与本次导出' : '，不会影响导出'}`;
        showToast(message, selected ? 'success' : 'info');
    }
}

function moralSelectAllTemplateProjects(selected) {
    moralSelectedTemplateProjects = selected ? MORAL_PROJECT_TEMPLATES.map(project => project.key) : [];
    moralRenderFreshItems();
    saveAllToMemory();
    showToast(selected ? '已选择全部标准项目' : '已清空标准项目选择；已有数据仍会保留', 'info');
}

function moralRenderTemplateProjects() {
    const container = document.getElementById('moral-template-projects');
    if (!container) return;
    container.innerHTML = MORAL_PROJECT_TEMPLATES.map(project => {
        const selected = moralTemplateProjectSelected(project.key);
        const files = moralTemplateFiles(project.key);
        const addItem = moralTemplateItem(project.key, 'add');
        const deductItem = moralTemplateItem(project.key, 'deduct');
        const manualAdd = Object.keys(addItem?.manual_values || {}).length;
        const manualDeduct = Object.keys(deductItem?.manual_values || {}).length;
        const rowCount = files.reduce((sum,source) => sum + Number(source.template_meta?.row_count || 0), 0);
        const duplicateCount = files.reduce((sum,source) => sum + Number(source.template_meta?.duplicate_count || 0), 0);
        const state = !selected ? 'inactive' : (files.length ? 'ready' : (manualAdd + manualDeduct ? 'manual' : 'pending'));
        const status = !selected ? '本次不计入；需要时勾选即可' : (files.length
            ? `${files.length}个文件 · ${rowCount}条记录${duplicateCount ? ` · ${duplicateCount}条自动累计` : ''}`
            : (manualAdd + manualDeduct ? `已批量录入 ${manualAdd + manualDeduct} 人` : '已选择，等待上传材料或批量录入'));
        const fileTags = files.map((source,index) => `<span title="${escapeHtml(source.path)}">
            ${escapeHtml(source.path.split(/[\\/]/).pop())}
            <button title="移除该文件" onclick="moralRemoveTemplateFile('${project.key}',${index})">×</button>
        </span>`).join('');
        return `<article class="moral-template-card ${state}">
            <div class="moral-template-card-head"><label class="moral-template-check" title="${selected ? '取消后不参与本次计分，已有数据仍保留' : '选择后才会参与本次计分'}"><input type="checkbox" ${selected ? 'checked' : ''} onchange="moralSetTemplateProjectSelected('${project.key}',this.checked)"><span>✓</span></label><span>${project.name.slice(0,1)}</span><div><strong>${escapeHtml(project.name)}</strong><small>${project.code}</small></div><em>${!selected ? '未选择' : (files.length ? '已识别' : (manualAdd + manualDeduct ? '已录入' : '待材料'))}</em></div>
            <p>${escapeHtml(status)}</p>
            ${fileTags ? `<div class="moral-template-files">${fileTags}</div>` : ''}
            <div class="moral-template-actions">
                <button class="btn btn-ghost btn-sm" ${selected ? '' : 'disabled'} onclick="moralDownloadProjectTemplate('${project.key}')">下载模板</button>
                <button class="btn btn-secondary btn-sm" ${selected ? '' : 'disabled'} onclick="moralOpenTemplateBatch('${project.key}','add')">批量加分</button>
                <button class="btn btn-secondary btn-sm" ${selected ? '' : 'disabled'} onclick="moralOpenTemplateBatch('${project.key}','deduct')">批量扣分</button>
            </div>
        </article>`;
    }).join('');
    const count = document.getElementById('moral-template-selected-count');
    if (count) count.textContent = `已选 ${moralSelectedTemplateKeys().length} / ${MORAL_PROJECT_TEMPLATES.length}`;
}

async function moralImportProjectTemplates() {
    try {
        const paths = await eel.select_files([['德育项目模板','*.xlsx']], '批量选择已填写的德育项目模板')();
        if (!paths?.length) return;
        showToast(`正在审查 ${paths.length} 个模板…`, 'info');
        const result = await eel.analyze_moral_project_templates(paths)();
        if (!result?.success) { showToast(result?.error || '模板审查失败', 'error'); return; }
        let imported = 0;
        for (const file of result.files || []) {
            if (!file.success) continue;
            const project = MORAL_PROJECT_TEMPLATES.find(entry => entry.key === file.project_key);
            if (!project) continue;
            const selected = new Set(moralSelectedTemplateKeys());
            selected.add(project.key);
            moralSelectedTemplateProjects = [...selected];
            const addItem = moralEnsureTemplateItem(project, 'add');
            const deductItem = moralEnsureTemplateItem(project, 'deduct');
            if (addItem.sources.some(source => source.path === file.path)) continue;
            const mappingBase = {
                enabled:true, header_row:Number(file.header_row ?? 3),
                id_col:null, name_col:1, class_col:0, row_actions:{},
            };
            addItem.sources.push({
                path:file.path, standard_template:true, template_meta:file,
                mappings:{[file.sheet_name]:{...mappingBase, score_col:2}},
            });
            deductItem.sources.push({
                path:file.path, standard_template:true, template_meta:file,
                mappings:{[file.sheet_name]:{...mappingBase, row_actions:{}, score_col:3}},
            });
            imported += 1;
        }
        moralRenderFreshItems();
        saveAllToMemory();
        const failures = (result.files || []).filter(file => !file.success);
        if (failures.length) {
            const rows = failures.map(file => `<tr><td>${escapeHtml(file.filename || '未知文件')}</td><td>${escapeHtml(file.error || '结构不符合模板')}</td></tr>`).join('');
            showModal('模板审查结果', `<div class="moral-template-review"><div class="moral-review-summary"><strong>${imported}</strong><span>个模板已导入</span><p>${failures.length}个文件未导入，请按提示修正后重新选择。</p></div><div class="moral-review-table"><table><thead><tr><th>文件</th><th>处理建议</th></tr></thead><tbody>${rows}</tbody></table></div></div>`,
                `<button class="btn btn-primary btn-sm" onclick="closeModal()">知道了</button>`);
        } else {
            showToast(`已识别 ${imported} 个项目模板`, 'success');
        }
    } catch (error) {
        showToast('模板导入失败：' + error, 'error');
    }
}

async function moralDownloadProjectTemplate(projectKey) {
    try {
        const outputDir = await eel.select_directory('选择模板保存目录')();
        if (!outputDir) return;
        const result = await eel.copy_moral_project_templates(projectKey, outputDir)();
        if (!result?.success) { showToast(result?.error || '模板保存失败', 'error'); return; }
        showOutputDialog(true, projectKey === 'all' ? '10份德育项目模板已保存' : '德育项目模板已保存', result.outputs || []);
    } catch (error) {
        showToast('模板保存失败：' + error, 'error');
    }
}

function moralRemoveTemplateFile(projectKey, sourceIndex) {
    ['add','deduct'].forEach(direction => {
        const item = moralTemplateItem(projectKey, direction);
        if (!item) return;
        item.sources.splice(sourceIndex, 1);
    });
    moralFreshItems = moralFreshItems.filter(item =>
        !item.standard_template || (item.sources || []).length || Object.keys(item.manual_values || {}).length);
    moralRenderFreshItems();
    saveAllToMemory();
}

function moralOpenTemplateBatch(projectKey, direction) {
    const project = MORAL_PROJECT_TEMPLATES.find(entry => entry.key === projectKey);
    if (!project) return;
    const item = moralEnsureTemplateItem(project, direction);
    moralRenderFreshItems();
    saveAllToMemory();
    moralOpenBatchEntry(item.id, 'fresh');
}

function moralAddFreshItem() {
    const nameInput = document.getElementById('moral-fresh-new-name');
    const name = nameInput?.value?.trim();
    if (!name) { showToast('请填写项目名称', 'warning'); return; }
    moralFreshItems.push({
        id:`moral-fresh-${Date.now()}-${moralFreshItems.length}`, name,
        direction:document.getElementById('moral-fresh-new-direction')?.value || 'deduct',
        value_mode:document.getElementById('moral-fresh-new-mode')?.value || 'auto', sources:[], manual_values:{},
    });
    nameInput.value = '';
    moralRenderFreshItems();
    saveAllToMemory();
}

function moralRenderFreshItems() {
    const container = document.getElementById('moral-fresh-items');
    if (!container) return;
    const customItems = moralFreshItems.filter(item => !item.standard_template);
    if (!customItems.length) {
        container.innerHTML = `<div class="moral-items-empty"><span>＋</span><div><b>还没有计分项目</b><small>添加纪检、团课、卫生、评议等任意加分或扣分项目。</small></div></div>`;
        moralRenderTemplateProjects();
        moralRefreshReadySummary('fresh');
        return;
    }
    container.innerHTML = customItems.map(item => `<article class="moral-item-card">
        <div class="moral-item-sign ${item.direction}">${item.direction === 'add' ? '+' : '−'}</div>
        <div class="moral-item-body"><div class="moral-item-title"><strong>${escapeHtml(item.name)}</strong><label class="moral-direction-editor" title="可随时修改；已有文件、映射和批量录入不会被清空"><span>加分还是扣分</span><select class="select-input" data-item-id="${escapeHtml(item.id)}" onchange="moralUpdateItemDirection(this.dataset.itemId,'fresh',this.value)"><option value="deduct" ${item.direction === 'deduct' ? 'selected' : ''}>扣分</option><option value="add" ${item.direction === 'add' ? 'selected' : ''}>加分</option></select><small>数据保留</small></label></div>
        ${moralItemStatusMarkup(item,'fresh')}</div>
        <div class="moral-item-actions"><button class="btn btn-secondary btn-sm" onclick="moralAttachFreshSource('${item.id}')">${(item.sources||[]).length ? '再选文件' : '选择文件'}</button><button class="btn btn-secondary btn-sm" onclick="moralOpenBatchEntry('${item.id}','fresh')">批量录入</button><button class="btn btn-ghost btn-sm" onclick="moralRemoveFreshItem('${item.id}')">删除</button></div>
    </article>`).join('');
    moralRenderTemplateProjects();
    moralRefreshReadySummary('fresh');
}

async function moralAttachFreshSource(itemId) {
    const item = moralFreshItems.find(entry => entry.id === itemId);
    if (!item) return;
    try {
        const paths = await eel.select_files([['Excel文件','*.xlsx;*.xls']], `选择${item.name}来源文件（可多选）`)();
        if (!paths?.length) return;
        const startIndex = item.sources.length;
        paths.forEach(path => item.sources.push({path, mappings:{}, analysis:null}));
        moralRenderFreshItems(); saveAllToMemory();
        moralMapFreshSource(itemId, startIndex);
    } catch (error) { showToast('项目文件导入失败：' + error, 'error'); }
}

function moralMapFreshSource(itemId, sourceIndex) {
    const item = moralFreshItems.find(entry => entry.id === itemId);
    const source = item?.sources?.[sourceIndex];
    if (!item || !source) return;
    const major = MajorScope.get();
    const preferredSheets = [...new Set(Object.values(moralRoster || {})
        .filter(student => !major || moralClassMatchesMajor(student.class, major))
        .map(student => student.class).filter(Boolean))];
    ImportStudio.open({path:source.path, moduleType:'moral_item', title:`${item.name} · 工作表与分数列映射`, preferredSheets, onConfirm:(mappings, analysis) => {
        source.mappings = mappings; source.analysis = analysis;
        moralRenderFreshItems(); saveAllToMemory();
        const nextIndex = item.sources.findIndex((entry,index) => index > sourceIndex && !moralSourceIsMapped(entry));
        if (nextIndex >= 0) setTimeout(() => moralMapFreshSource(itemId, nextIndex), 100);
    }});
}

function moralRemoveFreshItem(itemId) {
    moralFreshItems = moralFreshItems.filter(item => item.id !== itemId);
    moralRenderFreshItems();
    saveAllToMemory();
}

async function moralRunFresh() {
    if (!MajorScope.requireForExport()) return;
    const configuredItems = moralFreshConfiguredItems();
    const config = {
        mode:'fresh', roster_path:document.getElementById('moral-roster-file')?.value?.trim() || '',
        major_filter:MajorScope.get(),
        items:configuredItems,
        scoring:{
            base:Number(document.getElementById('moral-fresh-base')?.value ?? 80),
            min:Number(document.getElementById('moral-fresh-min')?.value ?? 0),
            max:Number(document.getElementById('moral-fresh-max')?.value ?? 115),
        },
        output_dir:document.getElementById('moral-output-dir')?.value?.trim() || '',
    };
    if (!config.roster_path) { showToast('请先选择花名册文件', 'warning'); return; }
    const missingSelectedProjects = moralSelectedTemplateKeys().filter(projectKey => !configuredItems.some(item =>
        item.standard_template && item.template_project === projectKey && (
            (item.sources || []).length || Object.keys(item.manual_values || {}).length
        )
    ));
    if (missingSelectedProjects.length) {
        const names = MORAL_PROJECT_TEMPLATES.filter(project => missingSelectedProjects.includes(project.key)).map(project => project.name);
        showToast(`已选项目尚未录入：${names.join('、')}。请补充材料，或取消勾选后再导出`, 'warning');
        return;
    }
    if (config.items.some(item => {
        const sources = item.sources || [];
        const hasManual = Object.keys(item.manual_values || {}).length > 0;
        return (!sources.length && !hasManual) || sources.some(source => !moralSourceIsMapped(source));
    })) { showToast('请为每个项目完成文件映射或批量录入；待映射文件必须先处理', 'warning'); return; }
    if (!config.output_dir) { showToast('请选择输出目录', 'warning'); return; }
    if (![config.scoring.base,config.scoring.min,config.scoring.max].every(Number.isFinite) || config.scoring.min > config.scoring.max) { showToast('请检查基础分和上下限设置', 'warning'); return; }
    const button = document.getElementById('moral-process-btn');
    if (button) { button.disabled = true; button.textContent = '正在审查…'; }
    try {
        const result = await eel.run_moral_fresh(config)();
        if (!result?.success) { showToast(result?.error || '德育计算失败', 'error'); return; }
        if (result.needs_review) { moralOpenFreshReview(result); return; }
        moralRememberOutput(result.output);
        CompletionCelebration.mark('moral', result.output);
        showOutputDialog(true, `德育分生成完成：${result.student_count} 名学生`, [result.output]);
        showToast('从零建立德育已完成', 'success');
        saveAllToMemory();
    } catch (error) { showToast('德育计算失败：' + error, 'error'); }
    finally { if (button) { button.disabled = false; button.textContent = '审查并生成'; } }
}

function moralClassMatchesMajor(className, major) {
    const normalize = value => String(value || '').replace(/[\s_\-—（）()]+/g, '').toLowerCase();
    const wanted = normalize(major);
    return !wanted || normalize(className).startsWith(wanted);
}

function moralOpenFreshReview(result) {
    const blocking = (result.issues || []).filter(issue => issue.level === 'block');
    const unmatched = blocking.filter(issue => issue.type === 'missing_roster_student' &&
        issue.item_id && Number.isInteger(Number(issue.source_index)) && issue.sheet_name && issue.excel_row);
    const unmatchedKeys = new Set(unmatched.map(issue => issue.student_key));
    const candidates = (result.students || []).filter(student => !unmatchedKeys.has(student.key));
    const rows = unmatched.map(issue => {
        const suggestedKey = issue.suggested_student_key || '';
        const suggested = (issue.suggestions || []).find(entry => entry.key === suggestedKey);
        const candidateOptions = candidates.map(student =>
            `<option value="${encodeURIComponent(student.key)}" ${student.key === suggestedKey ? 'selected' : ''}>${escapeHtml(`${student.class_name} · ${student.name}${student.student_id ? `（${student.student_id}）` : ''}`)}</option>`
        ).join('');
        const suggestionNote = suggested
            ? `<small class="moral-name-suggestion">疑似错字：建议对应 <b>${escapeHtml(suggested.name)}</b>（相差 ${Number(suggested.distance)} 个字），请人工确认</small>`
            : '<small class="moral-name-suggestion is-empty">未找到唯一的近似姓名，请手动选择</small>';
        const remapAction = issue.standard_template
            ? '<small class="moral-template-fixed-note">标准模板列已锁定，无需重新映射</small>'
            : '<button class="btn btn-secondary btn-sm" onclick="moralRemapFreshIssue(this)">重新映射文件</button>';
        return `<tr class="moral-fresh-issue-row"
            data-item-id="${escapeHtml(issue.item_id)}" data-source-index="${Number(issue.source_index)}"
            data-sheet="${encodeURIComponent(issue.sheet_name)}" data-excel-row="${Number(issue.excel_row)}">
        <td>${escapeHtml(issue.class_name || '—')}</td><td><strong>${escapeHtml(issue.student || '—')}</strong><small>${escapeHtml(issue.source || '')}</small></td>
        <td><select class="select-input moral-fresh-match"><option value="">选择正确学生…</option>${candidateOptions}</select>${suggestionNote}</td>
        <td><div class="moral-fresh-resolution-actions">
            <button class="btn btn-primary btn-sm" onclick="moralSetFreshIssueAction(this,'match')">指定对应</button>
            <button class="btn btn-ghost btn-sm moral-fresh-exclude-btn" onclick="moralSetFreshIssueAction(this,'exclude')">排除该行</button>
            ${remapAction}
        </div><small class="moral-fresh-resolution-status">${suggested ? '已预选疑似姓名，等待确认' : '尚未处理'}</small></td></tr>`;
    }).join('');
    const otherRows = blocking.filter(issue => !unmatched.includes(issue)).map(issue => `<tr>
        <td>${escapeHtml(issue.class_name || '—')}</td><td><strong>${escapeHtml(issue.student || '—')}</strong><small>${escapeHtml(issue.source || '')}</small></td>
        <td colspan="2">${escapeHtml(issue.message || '')}</td></tr>`).join('');
    showModal('从零建立德育 · 处理审查问题', `<div class="moral-review-dialog moral-fresh-review-dialog">
        <div class="moral-review-summary"><strong>${blocking.length}</strong><span>项需要处理</span>
            <p>当前仅负责 <b>${escapeHtml(MajorScope.get())}</b>。其他专业材料会自动忽略；本专业姓名不一致时，可指定正确学生、排除该行或重新映射原文件。</p></div>
        <div class="moral-review-groups"><span class="is-warning"><b>${unmatched.length}</b> 姓名待确认</span><span><b>${blocking.length - unmatched.length}</b> 其他问题</span><span class="is-success">其他专业已自动隔离</span></div>
        <div class="moral-review-table"><table><thead><tr><th>材料班级</th><th>材料学生/来源</th><th>指定花名册学生</th><th>解决措施</th></tr></thead>
            <tbody>${rows}${otherRows || ''}</tbody></table></div></div>`,
        `<button class="btn btn-ghost btn-sm" onclick="closeModal()">返回项目列表</button><button class="btn btn-secondary btn-sm moral-exclude-all-btn" onclick="moralExcludeAllFreshIssues()">一键排除全部未匹配</button><button class="btn btn-primary btn-sm" onclick="moralReviewFreshAgain()">应用处理并重新审查</button>`);
}

function moralSetFreshIssueAction(button, action) {
    const row = button.closest('.moral-fresh-issue-row');
    if (!row) return;
    const item = moralFreshItems.find(entry => entry.id === row.dataset.itemId);
    const source = item?.sources?.[Number(row.dataset.sourceIndex)];
    const sheetName = decodeURIComponent(row.dataset.sheet || '');
    const mapping = source?.mappings?.[sheetName];
    if (!mapping) { showToast('找不到该文件的映射，请选择“重新映射文件”', 'warning'); return; }
    const selectedKey = decodeURIComponent(row.querySelector('.moral-fresh-match')?.value || '');
    if (action === 'match' && !selectedKey) { showToast('请先选择正确的花名册学生', 'warning'); return; }
    mapping.row_actions ||= {};
    mapping.row_actions[String(row.dataset.excelRow)] = action === 'exclude'
        ? {action:'exclude'} : {action:'match', student_key:selectedKey};
    row.classList.add('is-resolved');
    const status = row.querySelector('.moral-fresh-resolution-status');
    if (status) status.textContent = action === 'exclude' ? '已标记：排除该材料行' : '已标记：使用指定学生';
    saveAllToMemory();
}

function moralRemapFreshIssue(button) {
    const row = button.closest('.moral-fresh-issue-row');
    if (!row) return;
    const itemId = row.dataset.itemId;
    const sourceIndex = Number(row.dataset.sourceIndex);
    closeModal();
    setTimeout(() => moralMapFreshSource(itemId, sourceIndex), 80);
}

function moralExcludeAllFreshIssues() {
    const buttons = [...document.querySelectorAll('.moral-fresh-issue-row:not(.is-resolved) .moral-fresh-exclude-btn')];
    if (!buttons.length) { showToast('没有尚未处理的未匹配学生', 'info'); return; }
    buttons.forEach(button => moralSetFreshIssueAction(button, 'exclude'));
    showToast(`已标记排除 ${buttons.length} 行，点击“应用处理并重新审查”后生效`, 'success');
}

function moralReviewFreshAgain() {
    closeModal();
    setTimeout(() => moralRunFresh(), 80);
}

async function moralAttachVnextSource(itemId) {
    const item = moralVnextItems.find(entry => entry.id === itemId);
    if (!item) return;
    try {
        const paths = await eel.select_files([['Excel文件','*.xlsx;*.xls']], `选择${item.name}来源文件（可多选）`)();
        if (!paths?.length) return;
        const startIndex = item.sources.length;
        paths.forEach(path => item.sources.push({path, mappings:{}, analysis:null}));
        moralRenderVnextItems();
        saveAllToMemory();
        moralMapVnextSource(itemId, startIndex);
    } catch (error) { showToast('项目文件导入失败：' + error, 'error'); }
}

function moralMapVnextSource(itemId, sourceIndex) {
    const item = moralVnextItems.find(entry => entry.id === itemId);
    const source = item?.sources?.[sourceIndex];
    if (!item || !source) return;
    ImportStudio.open({path:source.path, moduleType:'moral_item', title:`${item.name} · 工作表与分数列映射`, preferredSheets:moralPreferredItemSheets(), onConfirm:(mappings, analysis) => {
        source.mappings = mappings; source.analysis = analysis;
        moralRenderVnextItems(); saveAllToMemory();
        const nextIndex = item.sources.findIndex((entry,index) => index > sourceIndex && !moralSourceIsMapped(entry));
        if (nextIndex >= 0) setTimeout(() => moralMapVnextSource(itemId, nextIndex), 100);
    }});
}

function moralSourceIsMapped(source) {
    return Boolean(source?.mappings && Object.values(source.mappings).some(mapping => mapping?.enabled));
}

async function moralOpenBatchEntry(itemId, mode) {
    const items = mode === 'fresh' ? moralFreshItems : moralVnextItems;
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;
    const request = mode === 'fresh'
        ? {mode:'fresh', roster_path:document.getElementById('moral-roster-file')?.value?.trim() || '', major_filter:MajorScope.get()}
        : {mode:'continue', existing:moralExistingSource, scoring:{base:Number(document.getElementById('moral-vnext-base')?.value ?? 115)}};
    try {
        const result = await eel.list_moral_students(request)();
        if (!result?.success) { showToast(result?.error || '无法读取学生名单', 'error'); return; }
        item.manual_values ||= {};
        const rows = (result.students || []).map(student => {
            const key = student.key;
            const current = item.manual_values[key];
            return `<tr data-batch-search="${escapeHtml(`${student.class_name} ${student.student_id} ${student.name}`.toLowerCase())}">
                <td><input class="moral-batch-check" type="checkbox" data-key="${encodeURIComponent(key)}" ${current !== undefined ? 'checked' : ''}></td>
                <td>${escapeHtml(student.class_name || '—')}</td><td>${escapeHtml(student.student_id || '—')}</td><td>${escapeHtml(student.name || '—')}</td>
                <td class="moral-batch-current">${current !== undefined ? `${Number(current)} 分` : '未录入'}</td></tr>`;
        }).join('');
        showModal(`${item.name} · 批量${item.direction === 'add' ? '加分' : '扣分'}`, `<div class="moral-batch-dialog">
            <div class="moral-batch-toolbar"><label><span>查找学生</span><input id="moral-batch-search" class="input" placeholder="姓名、学号或班级"></label><label><span>每人${item.direction === 'add' ? '加' : '扣'}分</span><input id="moral-batch-value" class="input" type="number" min="0" step="0.01" placeholder="例如：5"></label></div>
            <div class="moral-batch-selectline"><label><input id="moral-batch-select-all" type="checkbox"> 选择当前筛选结果</label><span>可修改筛选词后分批录入不同分值</span></div>
            <div class="moral-review-table moral-batch-table"><table><thead><tr><th>选择</th><th>班级</th><th>学号</th><th>姓名</th><th>已录入</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>`, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button><button class="btn btn-ghost btn-sm" id="moral-batch-clear">清除所选录入</button><button class="btn btn-primary btn-sm" id="moral-batch-apply">应用到所选学生</button>`);
        setTimeout(() => {
            const search = document.getElementById('moral-batch-search');
            search?.addEventListener('input', () => {
                const term = search.value.trim().toLowerCase();
                document.querySelectorAll('.moral-batch-table tbody tr').forEach(row => row.hidden = Boolean(term) && !row.dataset.batchSearch.includes(term));
            });
            document.getElementById('moral-batch-select-all')?.addEventListener('change', event => {
                document.querySelectorAll('.moral-batch-table tbody tr:not([hidden]) .moral-batch-check').forEach(input => input.checked = event.target.checked);
            });
            document.getElementById('moral-batch-clear')?.addEventListener('click', () => {
                const selected = [...document.querySelectorAll('.moral-batch-check:checked')];
                if (!selected.length) { showToast('请先选择学生', 'warning'); return; }
                selected.forEach(input => delete item.manual_values[decodeURIComponent(input.dataset.key)]);
                closeModal(); mode === 'fresh' ? moralRenderFreshItems() : moralRenderVnextItems(); saveAllToMemory();
            });
            document.getElementById('moral-batch-apply')?.addEventListener('click', () => {
                const selected = [...document.querySelectorAll('.moral-batch-check:checked')];
                const value = Number(document.getElementById('moral-batch-value')?.value);
                if (!selected.length) { showToast('请先选择学生', 'warning'); return; }
                if (!Number.isFinite(value) || value < 0) { showToast('请输入大于或等于0的分值', 'warning'); return; }
                selected.forEach(input => item.manual_values[decodeURIComponent(input.dataset.key)] = value);
                closeModal(); mode === 'fresh' ? moralRenderFreshItems() : moralRenderVnextItems(); saveAllToMemory();
                showToast(`已为 ${selected.length} 名学生录入${value}分`, 'success');
            });
        }, 50);
    } catch (error) { showToast('读取学生名单失败：' + error, 'error'); }
}

function moralPreferredItemSheets() {
    if (Array.isArray(moralExistingSource.scope_classes) && moralExistingSource.scope_classes.length) {
        return [...moralExistingSource.scope_classes];
    }
    return moralExtractScopeClasses(moralExistingSource.analysis, moralExistingSource.mappings);
}

function moralExtractScopeClasses(analysis, mappings={}) {
    const classes = new Set();
    if (!analysis?.sheets) return [];
    analysis.sheets.forEach(sheet => {
        const mapping = mappings?.[sheet.name];
        if (!mapping?.enabled || !Number.isInteger(mapping.class_col)) return;
        (sheet.sample_rows || []).forEach(row => {
            const value = String(row[mapping.class_col] || '').trim();
            if (value) classes.add(value);
        });
    });
    return [...classes];
}

function moralRemoveVnextItem(itemId) {
    moralVnextItems = moralVnextItems.filter(item => item.id !== itemId);
    moralRenderVnextItems();
    saveAllToMemory();
}

function moralBuildVnextConfig(overrides={}) {
    const base = Number(document.getElementById('moral-vnext-base')?.value ?? 115);
    const min = Number(document.getElementById('moral-vnext-min')?.value ?? 0);
    const max = Number(document.getElementById('moral-vnext-max')?.value ?? 115);
    const continuation_basis = document.querySelector('input[name="moral-continuation-basis"]:checked')?.value || 'raw';
    return {
        mode:'continue', existing:moralExistingSource, items:moralVnextItems,
        major_filter:MajorScope.get(),
        scoring:{base,min,max,continuation_basis}, overrides,
        output_dir:document.getElementById('moral-vnext-output-dir')?.value?.trim() || '',
    };
}

async function moralRunVnext(overrides={}) {
    const config = moralBuildVnextConfig(overrides);
    if (!config.existing.path) { showToast('请先选择并映射已有德育文件', 'warning'); return; }
    if (!config.items.length || config.items.some(item => {
        const sources = item.sources || [];
        const hasManual = Object.keys(item.manual_values || {}).length > 0;
        return (!sources.length && !hasManual) || sources.some(source => !moralSourceIsMapped(source));
    })) { showToast('请为每个项目完成文件映射或批量录入；待映射文件必须先处理', 'warning'); return; }
    if (!config.output_dir) { showToast('请选择输出目录', 'warning'); return; }
    if (![config.scoring.base,config.scoring.min,config.scoring.max].every(Number.isFinite) || config.scoring.min > config.scoring.max) { showToast('请检查基础分和上下限设置', 'warning'); return; }
    const button = document.getElementById('moral-vnext-run');
    const status = document.getElementById('moral-vnext-status');
    if (button) { button.disabled = true; button.textContent = '正在审查…'; }
    if (status) status.innerHTML = '<span class="is-running">正在核对学生、正负号和续算基准…</span>';
    try {
        const result = await eel.run_moral_vnext(config)();
        if (!result?.success) { showToast(result?.error || '德育续算失败', 'error'); return; }
        if (result.needs_review) { moralOpenVnextReview(result); return; }
        moralRememberOutput(result.output);
        const summary = result.summary || {};
        if (status) status.innerHTML = `<span class="is-ready">已通过审查 · ${result.student_count} 名学生 · ${summary.warning_count || 0} 项提醒</span>`;
        const resultBox = document.getElementById('moral-vnext-result');
        if (resultBox) resultBox.innerHTML = `<div class="result-card moral-vnext-result-card"><div class="result-stat"><div class="stat-value">${result.student_count}</div><div class="stat-label">学生总数</div></div><div class="result-stat"><div class="stat-value">${result.class_count}</div><div class="stat-label">班级数量</div></div><div class="result-stat"><div class="stat-value">${summary.basis_difference_count || 0}</div><div class="stat-label">续算口径影响</div></div><div class="result-actions"><button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output.replace(/\\/g,'\\\\')}')()">打开结果</button><button data-cloud-sync-id="moral-main" class="btn btn-primary btn-sm" onclick="CloudSync.request('moral-main')">同步德育云表</button></div></div>`;
        CompletionCelebration.mark('moral', result.output);
        showOutputDialog(true, `续算完成：${result.student_count} 名学生`, [result.output]);
        saveAllToMemory();
    } catch (error) {
        showToast('德育续算失败：' + error, 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = '审查并生成'; }
    }
}

function moralOpenVnextReview(result) {
    const blocking = (result.issues || []).filter(issue => issue.level === 'block');
    const basis = document.querySelector('input[name="moral-continuation-basis"]:checked')?.value || 'raw';
    const currentMajor = MajorScope.get() || '未限定专业';
    const affected = new Map();
    blocking.forEach(issue => { if (issue.student_key) affected.set(issue.student_key, issue); });
    const studentByKey = new Map((result.students || []).map(student => [student.key, student]));
    let reusableDisplayCount = 0;
    const rows = [...affected.entries()].map(([key, issue]) => {
        const student = studentByKey.get(key) || {};
        const rawValue = student.existing_raw !== null && student.existing_raw !== undefined && Number.isFinite(Number(student.existing_raw)) ? Number(student.existing_raw) : '';
        const displayValue = student.existing_display !== null && student.existing_display !== undefined && Number.isFinite(Number(student.existing_display)) ? Number(student.existing_display) : '';
        const canReuseDisplay = rawValue === '' && displayValue !== '';
        if (canReuseDisplay) reusableDisplayCount += 1;
        return `<tr data-review-key="${encodeURIComponent(key)}"><td>${escapeHtml(issue.class_name || '—')}</td><td>${escapeHtml(issue.student || '—')}</td><td>${escapeHtml(issue.message)}</td><td><div class="moral-review-score-cell"><input class="input moral-review-raw" type="number" step="0.01" value="${rawValue}" placeholder="未截断原始分">${canReuseDisplay ? '<button class="moral-copy-display-btn" type="button" onclick="moralUseDisplayAsRaw(this)">用显示分补齐</button>' : ''}</div></td><td><input class="input moral-review-display" type="number" step="0.01" value="${displayValue}" placeholder="当前显示分"></td><td><label class="moral-review-exclude"><input type="checkbox">排除</label></td></tr>`;
    }).join('');
    const fillButton = basis === 'raw' && reusableDisplayCount
        ? `<button class="btn btn-secondary btn-sm moral-fill-raw-btn" onclick="moralFillAllRawFromDisplay()">一键用显示分补齐（${reusableDisplayCount}）</button>`
        : '';
    showModal('德育续算审查', `<div class="moral-review-dialog"><div class="moral-review-summary"><strong>${affected.size}</strong><span>名学生待处理</span><p>只审查当前所选专业；补充当前口径所需分数或明确排除后即可生成。</p></div><div class="moral-review-groups"><span class="is-success">当前专业：${escapeHtml(currentMajor)}</span><span>续算口径：${basis === 'raw' ? '保留超限缓冲' : '从显示分重新起算'}</span>${reusableDisplayCount ? `<span class="is-warning">${reusableDisplayCount} 人可直接用显示分补齐原始分</span>` : ''}</div><div class="moral-review-table"><table><thead><tr><th>班级</th><th>学生</th><th>问题</th><th>已有原始分</th><th>已有显示分</th><th>处理</th></tr></thead><tbody>${rows || '<tr><td colspan="6">请返回检查文件映射</td></tr>'}</tbody></table></div></div>`, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">返回检查</button>${fillButton}<button class="btn btn-secondary btn-sm moral-exclude-all-btn" onclick="moralExcludeAllVnextIssues()">一键排除全部</button><button class="btn btn-primary btn-sm" id="moral-review-confirm">应用处理并重新审查</button>`);
    setTimeout(() => document.getElementById('moral-review-confirm')?.addEventListener('click', () => {
        const overrides = {...moralVnextOverrides};
        let invalid = false;
        document.querySelectorAll('[data-review-key]').forEach(row => {
            const key = decodeURIComponent(row.dataset.reviewKey);
            const exclude = row.querySelector('.moral-review-exclude input')?.checked;
            const rawText = row.querySelector('.moral-review-raw')?.value;
            const displayText = row.querySelector('.moral-review-display')?.value;
            if (exclude) { overrides[key] = {exclude:true}; return; }
            const entry = {};
            if (rawText !== '') entry.raw = Number(rawText);
            if (displayText !== '') entry.display = Number(displayText);
            if ((basis === 'raw' && !Number.isFinite(entry.raw)) || (basis === 'display' && !Number.isFinite(entry.display))) invalid = true;
            overrides[key] = entry;
        });
        if (invalid) { showToast('请填写当前口径所需的分数，或明确排除学生', 'warning'); return; }
        moralVnextOverrides = overrides;
        closeModal();
        moralRunVnext(overrides);
    }), 50);
}

function moralUseDisplayAsRaw(button) {
    const row = button?.closest('[data-review-key]');
    const raw = row?.querySelector('.moral-review-raw');
    const display = row?.querySelector('.moral-review-display');
    if (!raw || !display || display.value === '' || !Number.isFinite(Number(display.value))) return;
    raw.value = display.value;
    row.classList.add('is-resolved');
    button.remove();
}

function moralFillAllRawFromDisplay() {
    let count = 0;
    document.querySelectorAll('[data-review-key]').forEach(row => {
        const raw = row.querySelector('.moral-review-raw');
        const display = row.querySelector('.moral-review-display');
        if (!raw || !display || raw.value !== '' || display.value === '' || !Number.isFinite(Number(display.value))) return;
        raw.value = display.value;
        row.classList.add('is-resolved');
        row.querySelector('.moral-copy-display-btn')?.remove();
        count += 1;
    });
    showToast(count ? `已用显示分补齐 ${count} 人的原始分，请确认后应用` : '没有可自动补齐的学生', count ? 'success' : 'warning');
}

function moralExcludeAllVnextIssues() {
    const rows = [...document.querySelectorAll('[data-review-key]')];
    rows.forEach(row => {
        const checkbox = row.querySelector('.moral-review-exclude input');
        if (checkbox) checkbox.checked = true;
        row.classList.add('is-excluded');
    });
    showToast(`已标记排除 ${rows.length} 名学生，点击“应用处理”后生效`, 'warning');
}

async function renderModuleMoral() {
    document.getElementById('module-title').textContent = '德育分计算';
    const container = document.getElementById('module-container');
    container.innerHTML = `
        ${moralWorkspaceHeader()}
        <div id="moral-route-continue" class="moral-route-panel" ${moralWorkspaceMode === 'continue' ? '' : 'hidden'}>
            ${moralContinueMarkup()}
        </div>
        <div id="moral-route-fresh" class="moral-route-panel" ${moralWorkspaceMode === 'fresh' ? '' : 'hidden'}>
        <div class="moral-route-note"><span class="moral-route-note-index">1</span><div><strong>先导入花名册</strong><p>系统只保留当前专业学生，其他专业材料会自动隔离。</p></div><button class="btn btn-secondary btn-sm" onclick="MajorScope.open()">专业：<b data-major-scope-label>未设置专业</b></button></div>
        <div class="module-section">
            <h2><span class="step-badge">1</span> 导入花名册（学分绩点文件）</h2>
            <div class="file-picker-row">
                <input id="moral-roster-file" class="file-path" readonly
                       placeholder="选择学分绩点.xlsx 作为花名册...">
                <button class="btn btn-secondary" onclick="pickFile('moral-roster-file','选择学分绩点文件',[['Excel文件','*.xlsx']])">
                    浏览
                </button>
                <button class="btn btn-teal btn-sm" onclick="moralImportRoster()">导入</button>
                <button class="btn btn-ghost btn-sm moral-diagnose-button" onclick="moralDebugRoster()" title="仅在导入失败时使用">导入有问题？</button>
            </div>
            <div id="moral-roster-status" style="margin-top:6px;font-size:11px;color:var(--text-muted);"></div>
        </div>

        <div class="module-section moral-vnext-section">
            <div class="moral-section-heading"><span class="step-badge">2</span><div><h2>按项目收集德育材料</h2><p>每个项目一份固定模板；可一次选择多个文件，系统自动识别项目、加分列和扣分列。</p></div></div>
            <div class="moral-template-toolbar">
                <div><strong>标准模板中心 · 选择本次需要的项目 <span id="moral-template-selected-count">已选 0 / 10</span></strong><small>只校验已勾选项目；未选项目不计分，也不会阻止导出</small></div>
                <div><button class="btn btn-ghost btn-sm" onclick="moralSelectAllTemplateProjects(true)">全选</button><button class="btn btn-ghost btn-sm" onclick="moralSelectAllTemplateProjects(false)">清空</button><button class="btn btn-primary btn-sm" onclick="moralImportProjectTemplates()">批量导入已填模板</button></div>
            </div>
            <div id="moral-template-projects" class="moral-template-grid"></div>
            <details class="moral-advanced-config moral-custom-project"><summary><span><b>其他项目与不规则材料</b><small>仅在10个预留项目之外使用，仍可自定义映射</small></span><em>展开</em></summary><div class="moral-advanced-body"><div class="moral-item-composer">
                <label><span>项目名称</span><input id="moral-fresh-new-name" class="input" placeholder="例如：纪检扣分"></label>
                <label><span>加分还是扣分</span><select id="moral-fresh-new-direction" class="select-input"><option value="deduct">扣分</option><option value="add">加分</option></select></label>
                <label><span>表格里的分数是</span><select id="moral-fresh-new-mode" class="select-input"><option value="auto">让系统自动判断（推荐）</option><option value="signed">带正负号，如 -2、+3</option><option value="amount">只填正数，如 2、3</option></select></label>
                <button class="btn btn-primary" onclick="moralAddFreshItem()">添加项目</button>
            </div></div></details>
            <div id="moral-fresh-items" class="moral-item-list moral-custom-item-list"></div>
        </div>

        <div class="module-section">
            <div class="moral-section-heading"><span class="step-badge">3</span><div><h2>审查并生成</h2><p>默认基础分80、范围0～115；需要时再修改。</p></div></div>
            <details class="moral-advanced-config"><summary><span><b>修改计分规则</b><small>默认基础分80，最低0，最高115</small></span><em>高级设置</em></summary><div class="moral-advanced-body"><div class="moral-score-settings" style="margin-bottom:12px;">
                <label><span>基础分</span><input id="moral-fresh-base" class="input" type="number" step="0.01" value="80"></label>
                <label><span>最低分</span><input id="moral-fresh-min" class="input" type="number" step="0.01" value="0"></label>
                <label><span>最高分</span><input id="moral-fresh-max" class="input" type="number" step="0.01" value="115"></label>
            </div></div></details>
            <div id="moral-fresh-ready-summary" class="moral-ready-summary"></div>
            <div class="file-picker-row">
                <input id="moral-output-dir" class="file-path" readonly placeholder="选择输出目录...">
                <button class="btn btn-secondary" onclick="pickDirectory('moral-output-dir','选择输出目录')">浏览</button>
            </div>
        </div>

        <div id="moral-progress-area"></div>

        <div class="actions-row">
            <button class="btn btn-ghost" onclick="resetModuleMoral()">重置</button>
            <button class="btn btn-primary" id="moral-process-btn" onclick="moralRunFresh()">审查并生成</button>
        </div>
        <div id="moral-result-area"></div>
        </div>
    `;

    moralRenderColumnSelector();
    moralRenderManualList();

    // Restore file lists if we have them in memory
    for (const catId of Object.keys(moralFileLists)) {
        moralRenderFileList(catId);
    }
    moralRenderVnextItems();
    moralRenderFreshItems();
    MajorScope.refresh();
    document.querySelectorAll('.moral-score-settings input').forEach(input => input.addEventListener('input', () => {
        moralRefreshReadySummary(input.id.includes('fresh') ? 'fresh' : 'continue');
    }));
    moralRefreshReadySummary('continue');
    moralRefreshReadySummary('fresh');
}

async function moralUseFinishedFile() {
    try {
        const path = await eel.select_file([['Excel文件','*.xlsx;*.xls']], '选择已经完成的德育分表')();
        if (!path) return;
        const status = document.getElementById('moral-ready-status');
        status.innerHTML = '<span class="moral-ready-checking">正在检查表格结构…</span>';
        const result = await eel.analyze_import_file(path, 'moral')();
        const sheets = result?.sheets || [];
        const valid = sheets.filter(s => s.recommended || ((s.valid_rows || 0) > 0 && (s.suggested_mapping?.name_col ?? -1) >= 0 && (s.suggested_mapping?.score_col ?? -1) >= 0));
        if (!result?.success || !valid.length) {
            status.innerHTML = '<span class="moral-ready-error">未识别到可用的姓名与德育最终分数，请检查文件或在下方制作。</span>';
            showToast('这份文件暂时不能作为德育分成品', 'warning'); return;
        }
        const rows = valid.reduce((sum, sheet) => sum + (sheet.valid_rows || 0), 0);
        if (!moduleMemory._filePaths) moduleMemory._filePaths = {};
        moduleMemory._filePaths.moralCompletedPath = path;
        localStorage.setItem('moral_finished_file_v1', path);
        moralRememberOutput(path);
        status.innerHTML = `<span class="moral-ready-success"><b>✓ 已接收</b>${escapeHtml(path.split(/[\\/]/).pop())} · 识别到 ${rows} 行有效数据</span>`;
        CompletionCelebration.mark('moral', path);
        saveAllToMemory();
    } catch (e) {
        document.getElementById('moral-ready-status').innerHTML = `<span class="moral-ready-error">检查失败：${escapeHtml(String(e))}</span>`;
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
    if (!MajorScope.requireForExport()) return;
    const path = document.getElementById('moral-roster-file').value.trim();
    if (!path) { showToast('请先选择学分绩点文件', 'warning'); return; }

    try {
        const result = await eel.read_roster_for_quality(path)();
        if (result && Object.keys(result).length > 0) {
            const major = MajorScope.get();
            const scopedRoster = Object.fromEntries(Object.entries(result).filter(([, info]) => moralClassMatchesMajor(info.class, major)));
            if (!Object.keys(scopedRoster).length) {
                showToast(`花名册中没有找到当前专业“${major}”的学生，请检查专业设置或班级列`, 'warning');
                return;
            }
            moralRoster = scopedRoster;
            const classes = new Set();
            for (const [sid, info] of Object.entries(scopedRoster)) {
                classes.add(info.class);
            }
            const sortedClasses = [...classes].sort();
            const sel = document.getElementById('moral-class-sel');
            // The current fresh-workflow UI no longer mounts the legacy class
            // selector. Keep it in sync when an older view provides it, but do
            // not make a successful roster import depend on that optional UI.
            if (sel) {
                sel.innerHTML = '<option value="">-- 班级 --</option>';
                sortedClasses.forEach(cls => {
                    const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o);
                });
            }
            const status = document.getElementById('moral-roster-status');
            if (status) {
                status.textContent =
                    `当前专业：${major} · 已导入 ${Object.keys(scopedRoster).length} 名学生 · ${sortedClasses.length} 个班级`;
            }
            moralRefreshReadySummary('fresh');

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
    if (!MajorScope.requireForExport()) return;
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
            moralExportGradeFilter,      // NEW: grade filter
            MajorScope.get()
        )();
        if (result.success) {
            moralRememberOutput(result.output);
            document.getElementById('moral-result-area').innerHTML = `
                <div class="result-card">
                    <div class="result-stat"><div class="stat-value">${result.student_count}</div><div class="stat-label">学生总数</div></div>
                    <div class="result-stat"><div class="stat-value">${result.class_count}</div><div class="stat-label">班级数量</div></div>
                    <div class="result-actions">
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output.replace(/\\/g,'\\\\')}')()">📂 打开文件</button>
                        <button data-cloud-sync-id="moral-main" class="btn btn-primary btn-sm" onclick="CloudSync.request('moral-main')">☁ 同步德育云表</button>
                    </div>
                </div>`;
            CompletionCelebration.mark('moral', result.output);
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
    moralFreshItems = [];
    moralSelectedTemplateProjects = [];
    moralVnextItems = [];
    moralExistingSource = {path:'', mappings:{}, analysis:null};
    ['moral-roster-file','moral-output-dir'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('has-file'); }
    });
    document.getElementById('moral-progress-area').innerHTML = '';
    document.getElementById('moral-result-area').innerHTML = '';
    renderModuleMoral();
}
