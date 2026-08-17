/** Annual GPA and comprehensive ranking workspace. */

const annualState = {
    mode: 'gpa',
    year: '',
    outputDir: '',
    gpa: { first: '', second: '' },
    comprehensive: { first: '', second: '' },
    outputs: [],
};

function annualDefaultYear() {
    const taskName = (() => {
        try {
            const tasks = JSON.parse(localStorage.getItem('eval_measurement_tasks_v1') || '[]');
            const active = localStorage.getItem('eval_active_measurement_task');
            return tasks.find(item => item.id === active)?.name || '';
        } catch (_) { return ''; }
    })();
    const found = taskName.match(/20\d{2}\s*[-—至]\s*20\d{2}/);
    if (found) return found[0].replace(/[—至\s]/g, '-').replace(/-+/g, '-');
    const now = new Date();
    const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}-${start + 1}`;
}

function annualCaptureForm() {
    const first = document.getElementById('annual-first-file');
    const second = document.getElementById('annual-second-file');
    if (first) annualState[annualState.mode].first = first.value.trim();
    if (second) annualState[annualState.mode].second = second.value.trim();
    const year = document.getElementById('annual-year');
    const output = document.getElementById('annual-output-dir');
    if (year) annualState.year = year.value.trim();
    if (output) annualState.outputDir = output.value.trim();
}

function renderModuleAnnual() {
    if (!annualState.year) annualState.year = annualDefaultYear();
    const isGpa = annualState.mode === 'gpa';
    const files = annualState[annualState.mode];
    const scoreName = isGpa ? '学分绩点' : '综合测评';
    const formula = isGpa
        ? '优先使用两学期总学分加权；旧表缺少总学分时自动改用两学期均值。'
        : '同一学生的两个学期综合测评取均值，再分别计算班级与专业年级排名。';
    document.getElementById('module-title').textContent = '学年排名汇总';
    document.getElementById('module-container').innerHTML = `
        <div class="annual-workspace">
            <section class="annual-hero">
                <div class="annual-hero-copy">
                    <span class="annual-kicker">ACADEMIC YEAR LEDGER</span>
                    <h2>把两个学期，合成一份可信的学年排名</h2>
                    <p>上传第一、第二学期的结果表，自动完成学生匹配、学年成绩合并、同分并列与百分比计算。</p>
                </div>
                <div class="annual-ledger-mark" aria-hidden="true"><span>${annualState.year.split('-')[0] || '20'}</span><i></i><span>${annualState.year.split('-')[1] || '21'}</span></div>
            </section>

            <div class="annual-mode-switch" role="tablist" aria-label="学年汇总类型">
                <button class="${isGpa ? 'active' : ''}" onclick="switchAnnualMode('gpa')"><small>01</small><span>学年绩点</span><em>生成班级与专业排名</em></button>
                <button class="${!isGpa ? 'active' : ''}" onclick="switchAnnualMode('comprehensive')"><small>02</small><span>学年综测</span><em>生成班级与专业排名</em></button>
            </div>

            <section class="annual-panel">
                <header><div><span>STEP 01 · SOURCE FILES</span><h3>选择两学期${scoreName}表</h3></div><p>建议上传本软件导出的“${isGpa ? '学分绩点.xlsx' : '综测.xlsx'}”</p></header>
                <div class="annual-file-pair">
                    ${annualFileCard('first', '第一学期', '秋季学期', files.first)}
                    <div class="annual-join" aria-hidden="true"><i></i><span>合并</span><i></i></div>
                    ${annualFileCard('second', '第二学期', '春季学期', files.second)}
                </div>
                <div class="annual-formula-note"><b>计算口径</b><span>${formula}</span></div>
            </section>

            <section class="annual-panel annual-output-panel">
                <header><div><span>STEP 02 · OUTPUT</span><h3>设置学年与保存位置</h3></div><p>一次生成两份 Excel 表格</p></header>
                <div class="annual-output-grid">
                    <label><span>学年（可修改）</span><input id="annual-year" class="input" value="${escapeHtml(annualState.year)}" placeholder="2024-2025" aria-describedby="annual-year-hint"><small id="annual-year-hint" class="annual-year-hint">请填写连续学年，例如 2024-2025</small></label>
                    <label class="annual-dir-field"><span>输出目录</span><div><input id="annual-output-dir" class="file-path ${annualState.outputDir ? 'has-file' : ''}" readonly value="${escapeHtml(annualState.outputDir)}" placeholder="选择保存表格的文件夹"><button class="btn btn-secondary" onclick="pickDirectory('annual-output-dir','选择学年排名输出目录')">浏览</button></div></label>
                </div>
                <div class="annual-major-scope">
                    <div><span>导出专业限制</span><strong data-major-scope-label>${escapeHtml(MajorScope.get() || '未设置专业')}</strong><small>仅保留班级名前缀严格匹配的学生；匹配人数为 0 时停止导出。</small></div>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="MajorScope.open()">设置专业</button>
                </div>
                <div class="annual-deliverables">
                    <span><b>A</b>${scoreName}班级排名百分比</span>
                    <span><b>B</b>${scoreName}专业排名百分比</span>
                    <button id="annual-process-btn" class="btn btn-primary" onclick="processAnnualRanking()">生成两份学年表格 →</button>
                </div>
            </section>
            <div id="annual-progress-area"></div>
            <div id="annual-result-area"></div>
        </div>`;
}

function annualFileCard(key, title, subtitle, path) {
    const filename = path ? path.split(/[\\/]/).pop() : '';
    return `<article class="annual-file-card ${path ? 'ready' : ''}">
        <div class="annual-file-number">${key === 'first' ? 'I' : 'II'}</div>
        <div><small>${subtitle}</small><h4>${title}</h4><p>${filename ? escapeHtml(filename) : '尚未选择 Excel 文件'}</p></div>
        <button class="btn btn-secondary btn-sm" onclick="pickAnnualFile('${key}')">${path ? '重新选择' : '选择文件'}</button>
    </article>`;
}

function switchAnnualMode(mode) {
    annualCaptureForm();
    annualState.mode = mode === 'comprehensive' ? 'comprehensive' : 'gpa';
    annualState.outputs = [];
    renderModuleAnnual();
}

async function pickAnnualFile(key) {
    annualCaptureForm();
    const label = key === 'first' ? '第一学期' : '第二学期';
    const score = annualState.mode === 'gpa' ? '学分绩点' : '综测';
    const path = await eel.select_file([['Excel 文件', '*.xlsx']], `选择${label}${score}表`)();
    if (!path) return;
    annualState[annualState.mode][key] = path;
    renderModuleAnnual();
}

async function processAnnualRanking() {
    annualCaptureForm();
    if (!MajorScope.requireForExport()) return;
    const files = annualState[annualState.mode];
    if (!files.first || !files.second) { showToast('请分别选择第一学期和第二学期文件', 'warning'); return; }
    if (files.first === files.second) { showToast('两个学期不能选择同一个文件', 'warning'); return; }
    const yearMatch = annualState.year.match(/^(20\d{2})-(20\d{2})$/);
    if (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1) { showToast('请填写连续学年，例如 2024-2025', 'warning'); return; }
    if (!annualState.outputDir) { showToast('请选择输出目录', 'warning'); return; }

    const button = document.getElementById('annual-process-btn');
    button.disabled = true;
    button.textContent = '正在核对两个学期…';
    const progress = createProgressBar('annual-progress-area');
    progress.update(8, '正在读取两个学期...');
    const onProgress = event => progress.update(event.detail.percent, event.detail.message);
    window.addEventListener('progress-update', onProgress);
    try {
        const method = annualState.mode === 'gpa' ? eel.run_annual_gpa : eel.run_annual_comprehensive;
        const result = await method(files.first, files.second, annualState.outputDir, annualState.year, MajorScope.get())();
        if (!result?.success) throw new Error(result?.error || '学年排名生成失败');
        progress.done('两份学年表格已生成');
        annualState.outputs = [result.output1, result.output2];
        renderAnnualResult(result);
        CompletionCelebration.mark('annual', result.output1);
        showOutputDialog(true, `已汇总 ${result.student_count} 名学生，生成班级与专业排名表`, annualState.outputs);
    } catch (error) {
        progress.update(100, '处理未完成');
        showOutputDialog(false, error?.message || String(error));
    } finally {
        button.disabled = false;
        button.textContent = '生成两份学年表格 →';
        window.removeEventListener('progress-update', onProgress);
    }
}

function renderAnnualResult(result) {
    const fallback = Number(result.mean_fallback_count || 0);
    const missing = Number(result.first_only_count || 0) + Number(result.second_only_count || 0);
    document.getElementById('annual-result-area').innerHTML = `
        <section class="annual-result-card">
            <div class="annual-result-seal">完成</div>
            <div class="annual-result-copy"><span>${escapeHtml(result.academic_year || '本学年')} · 汇总完成</span><h3>${result.student_count} 名学生已完成学年排名</h3><p>${result.class_count} 个班级 · ${result.program_count} 个专业年级组${fallback ? ` · ${fallback} 人因旧表缺少总学分使用均值` : ''}${missing ? ` · ${missing} 人仅有一个学期数据` : ''}</p></div>
            <div class="annual-result-actions"><button class="btn btn-secondary" onclick="openAnnualOutput(0)">打开班级排名表</button><button class="btn btn-primary" onclick="openAnnualOutput(1)">打开专业排名表</button></div>
        </section>`;
}

function openAnnualOutput(index) {
    const path = annualState.outputs[index];
    if (path) eel.open_file_explorer(path)();
}
