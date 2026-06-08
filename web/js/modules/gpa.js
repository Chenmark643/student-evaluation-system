/**
 * Module A: GPA Calculation UI (学分绩点计算)
 * Supports batch selection of multiple raw grade files.
 */

let gpaSelectedFiles = [];

function renderModuleGPA() {
    const container = document.getElementById('module-container');
    container.innerHTML = `
        <div class="module-section">
            <h2><span class="step-badge">1</span> 批量选择原始成绩文件</h2>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
                支持同时选择多个 .xls / .xlsx 文件（例如不同专业、不同年级的成绩表），程序会自动合并处理。
            </p>
            <div class="file-picker-row" style="margin-bottom:8px;">
                <button class="btn btn-secondary" onclick="batchPickGPAFiles()">
                    + 批量选择文件
                </button>
                <button class="btn btn-ghost btn-sm" onclick="clearGPABatch()" style="color:var(--color-error);">
                    清空列表
                </button>
            </div>
            <div id="gpa-file-list" style="max-height:200px;overflow-y:auto;">
                <p style="color:var(--text-muted);font-size:13px;">未选择文件</p>
            </div>
        </div>

        <div class="module-section">
            <h2><span class="step-badge">2</span> 选择输出目录</h2>
            <div class="file-picker-row">
                <input id="gpa-output-dir" class="file-path" readonly
                       placeholder="选择输出目录...">
                <button class="btn btn-secondary" onclick="pickDirectory('gpa-output-dir', '选择输出目录')">
                    浏览
                </button>
            </div>
        </div>

        <div class="module-section">
            <h2><span class="step-badge">3</span> 处理选项</h2>
            <div class="options-row">
                <label class="toggle-label">
                    <input type="checkbox" id="gpa-exclude-pe" checked>
                    体育课不计入学分绩点
                </label>
                <label class="toggle-label">
                    <input type="checkbox" id="gpa-auto-rank" checked>
                    自动生成专业排名
                </label>
            </div>
        </div>

        <div id="gpa-progress-area"></div>

        <div class="actions-row">
            <button class="btn btn-ghost btn-sm" onclick="gpaAskAI()">🤖 AI助手</button>
            <button class="btn btn-ghost" onclick="resetModuleGPA()">重置</button>
            <button class="btn btn-primary" id="gpa-process-btn" onclick="processGPA()">
                开始计算
            </button>
        </div>

        <div id="gpa-result-area"></div>
        <div id="gpa-preview-area" class="preview-wrapper" style="margin-top:16px;"></div>
    `;

    document.getElementById('module-title').textContent = '学分绩点计算';
}

async function batchPickGPAFiles() {
    const paths = await eel.select_files(
        [['Excel 文件', '*.xls *.xlsx']],
        '批量选择原始成绩文件'
    )();
    if (paths && paths.length > 0) {
        // Merge with existing
        const existing = new Set(gpaSelectedFiles);
        for (const p of paths) {
            if (!existing.has(p)) {
                gpaSelectedFiles.push(p);
                existing.add(p);
            }
        }
        renderGPAFileList();
    }
}

function clearGPABatch() {
    gpaSelectedFiles = [];
    renderGPAFileList();
}

function removeGPAFile(index) {
    gpaSelectedFiles.splice(index, 1);
    renderGPAFileList();
}

function renderGPAFileList() {
    const container = document.getElementById('gpa-file-list');
    if (!container) return;

    if (gpaSelectedFiles.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">未选择文件</p>';
        return;
    }

    let html = `<p style="font-size:12px;color:var(--accent-secondary);margin-bottom:8px;">
        已选择 <strong>${gpaSelectedFiles.length}</strong> 个文件:</p>`;
    gpaSelectedFiles.forEach((path, i) => {
        const fileName = path.split(/[\\/]/).pop();
        html += `
            <div class="file-list-item">
                <span class="file-num" style="width:28px;color:var(--text-muted);text-align:center;">${i + 1}</span>
                <span class="file-path" style="flex:1;font-size:12px;" title="${escapeHtml(path)}">${escapeHtml(fileName)}</span>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-error);"
                        onclick="removeGPAFile(${i})">✕</button>
            </div>`;
    });
    container.innerHTML = html;
}

function gpaAskAI() {
    const outputDir = document.getElementById('gpa-output-dir')?.value || '';
    let ctx = `学分绩点计算模块\n`;
    ctx += `已选文件: ${gpaSelectedFiles.length} 个\n输出目录: ${outputDir || '未选择'}\n`;
    ctx += `请根据以上信息提供学分绩点计算建议。`;
    aiPanelOpen(ctx);
}

function resetModuleGPA() {
    gpaSelectedFiles = [];
    document.getElementById('gpa-output-dir').value = '';
    document.getElementById('gpa-output-dir').classList.remove('has-file');
    document.getElementById('gpa-progress-area').innerHTML = '';
    document.getElementById('gpa-result-area').innerHTML = '';
    document.getElementById('gpa-preview-area').innerHTML = '';
    renderGPAFileList();
}

async function processGPA() {
    const outputDir = document.getElementById('gpa-output-dir').value.trim();

    if (gpaSelectedFiles.length === 0) {
        showToast('请至少选择一个成绩文件', 'warning'); return;
    }
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }

    const btn = document.getElementById('gpa-process-btn');
    btn.disabled = true;
    btn.classList.add('processing');
    btn.textContent = `处理 ${gpaSelectedFiles.length} 个文件中...`;

    const progress = createProgressBar('gpa-progress-area');
    progress.update(0, '正在启动...');

    const onProgress = (e) => progress.update(e.detail.percent, e.detail.message);
    window.addEventListener('progress-update', onProgress);

    try {
        const result = await eel.run_module_a_batch(gpaSelectedFiles, outputDir)();
        progress.done('计算完成！');

        if (result.success) {
            document.getElementById('gpa-result-area').innerHTML = `
                <div class="result-card">
                    <div class="result-stat">
                        <div class="stat-value">${result.file_count}</div>
                        <div class="stat-label">处理文件数</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-value">${result.student_count}</div>
                        <div class="stat-label">学生总数</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-value">${result.class_count}</div>
                        <div class="stat-label">班级数量</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-value">${result.program_count}</div>
                        <div class="stat-label">专业组数</div>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output1.replace(/\\/g,'\\\\')}')()">
                            📂 打开绩点表
                        </button>
                        <button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${result.output2.replace(/\\/g,'\\\\')}')()">
                            📂 打开排名表
                        </button>
                    </div>
                </div>`;
            showOutputDialog(true, `成功处理 ${result.file_count} 个文件, ${result.student_count} 名学生`,
                [result.output1, result.output2]);
        } else {
            showOutputDialog(false, result.error || '处理失败');
        }
    } catch (err) {
        showOutputDialog(false, '处理出错: ' + err);
    } finally {
        btn.disabled = false;
        btn.classList.remove('processing');
        btn.textContent = '开始计算';
        window.removeEventListener('progress-update', onProgress);
    }
}
