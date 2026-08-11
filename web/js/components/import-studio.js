/** Unified spreadsheet import mapping and reusable template UI. */
window.ImportStudio = (() => {
    const cache = new Map();
    const fieldLabels = {
        id_col: '学号', name_col: '姓名', class_col: '班级', score_col: '最终分数',
        raw_score_col: '未截断原始分', deduction_col: '已有总扣分', addition_col: '已有总加分',
        sports_col: '体育成绩', course_count_col: '课程门数', course_start_col: '第一门课程', course_end_col: '最后一门课程'
    };
    const fieldsByType = {
        gpa_raw: ['id_col','name_col','class_col','course_count_col','course_start_col','course_end_col'],
        gpa: ['id_col','name_col','class_col','score_col','sports_col'],
        moral: ['id_col','name_col','class_col','score_col'],
        moral_existing: ['id_col','name_col','class_col','raw_score_col','score_col','deduction_col','addition_col'],
        moral_item: ['id_col','name_col','class_col','score_col'],
        quality: ['id_col','name_col','class_col','score_col']
    };

    async function analyze(path, moduleType, refresh=false) {
        const key = moduleType + '|' + path;
        if (!refresh && cache.has(key)) return cache.get(key);
        const result = await eel.analyze_import_file(path, moduleType)();
        if (!result?.success) throw new Error(result?.error || '无法分析文件');
        cache.set(key, result);
        return result;
    }

    function confidenceMeta(sheet) {
        if (sheet.missing_fields?.length) return ['需配置', 'danger'];
        if ((sheet.confidence_score || 0) >= .72) return ['高置信度', 'good'];
        return ['建议确认', 'warn'];
    }

    function selectOptions(headers, selected, allowEmpty=true) {
        let html = allowEmpty ? '<option value="">不使用 / 自动匹配</option>' : '';
        headers.forEach((header, index) => {
            html += `<option value="${index}" ${selected === index ? 'selected' : ''}>${index + 1}. ${escapeHtml(header || `未命名列 ${index + 1}`)}</option>`;
        });
        return html;
    }

    async function open({path, moduleType, title, onConfirm, preferredSheets=[]}) {
        showToast('正在扫描表格结构…', 'info');
        let analysis;
        try { analysis = await analyze(path, moduleType); }
        catch (error) { showToast(error.message, 'error'); return; }
        const fields = fieldsByType[moduleType] || [];
        let validTotal = 0;
        const sheetsHtml = analysis.sheets.map((sheet, sheetIndex) => {
            validTotal += sheet.valid_rows || 0;
            const [confidenceText, tone] = confidenceMeta(sheet);
            const mapping = sheet.suggested_mapping || {};
            const enabledByDefault = preferredSheets.length ? preferredSheets.includes(sheet.name) : sheet.recommended;
            const issues = sheet.issues || {};
            const issueCount = (issues.duplicates||0) + (issues.invalid_scores||0) + (issues.out_of_range_scores||0);
            const issueRows = (sheet.issue_details || []).map((issue, issueIndex) => `
                <tr><td>${issue.excel_row}</td><td>${escapeHtml(issue.identity || '未识别学生')}</td>
                <td>${escapeHtml(issue.value === '' ? '空值' : String(issue.value))}</td><td>${escapeHtml(issue.message)}</td>
                <td><select class="select-input import-issue-action" data-sheet-index="${sheetIndex}" data-excel-row="${issue.excel_row}" data-issue-index="${issueIndex}"><option value="keep">保留原值</option><option value="exclude">排除该行</option><option value="replace">替换分数</option></select></td>
                <td><input class="input import-issue-value" data-sheet-index="${sheetIndex}" data-excel-row="${issue.excel_row}" type="number" step="0.01" placeholder="新分数" disabled></td></tr>`).join('');
            const fieldHtml = fields.map(field => `
                <label class="import-field">
                    <span>${fieldLabels[field] || field}</span>
                    <select class="select-input import-map-select" data-sheet-index="${sheetIndex}" data-field="${field}">
                        ${selectOptions(sheet.headers, mapping[field], field !== 'name_col')}
                    </select>
                </label>`).join('');
            const preview = (sheet.sample_rows || []).slice(0, 4).map(row =>
                `<tr>${row.map(value => `<td>${escapeHtml(String(value ?? ''))}</td>`).join('')}</tr>`
            ).join('');
            return `<section class="import-sheet-card ${enabledByDefault ? 'is-recommended' : ''}">
                <header>
                    <label class="import-sheet-toggle"><input type="checkbox" class="import-sheet-enabled" data-sheet-index="${sheetIndex}" ${enabledByDefault ? 'checked' : ''}><span>${escapeHtml(sheet.name)}</span></label>
                    <div class="import-sheet-meta"><span class="import-confidence ${tone}">${confidenceText}</span>${issueCount ? `<span class="import-confidence danger">${issueCount} 项异常</span>` : ''}<span>${sheet.valid_rows || 0} 条候选数据</span></div>
                </header>
                ${sheet.template_applied ? `<p class="import-template-hit">已应用模板：${escapeHtml(sheet.template_applied)}</p>` : ''}
                ${issueCount ? `<p class="import-issue-line">重复 ${issues.duplicates||0} · 无效分数 ${issues.invalid_scores||0} · 超范围 ${issues.out_of_range_scores||0}</p>` : ''}
                ${issueRows ? `<details class="import-issues" open><summary>处理具体异常（${issueCount}）</summary><div><table><thead><tr><th>Excel 行</th><th>学生</th><th>原始值</th><th>原因</th><th>处理方式</th><th>替换值</th></tr></thead><tbody>${issueRows}</tbody></table></div></details>` : ''}
                <div class="import-field-grid">${fieldHtml}</div>
                <details class="import-preview"><summary>查看原表预览</summary><div><table><thead><tr>${sheet.headers.map(h=>`<th>${escapeHtml(h||'—')}</th>`).join('')}</tr></thead><tbody>${preview}</tbody></table></div></details>
            </section>`;
        }).join('');
        const fileName = path.split(/[\\/]/).pop();
        showModal(title || '数据导入工作台', `
            <div class="import-studio">
                <div class="import-studio-hero"><div><span class="import-kicker">IMPORT STUDIO</span><h3>${escapeHtml(fileName)}</h3><p>自动识别只是建议，最终映射由你决定。</p></div><div class="import-health"><strong>${validTotal}</strong><span>候选行</span></div></div>
                <div class="import-sheet-list">${sheetsHtml || '<div class="import-empty">没有找到可读取的工作表</div>'}</div>
                <div class="import-template-save"><label><input type="checkbox" id="import-save-template"> 将本次映射保存为模板</label><input id="import-template-name" class="input" placeholder="例如：2026 教务成绩表" disabled></div>
            </div>`,
            `<button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button><button class="btn btn-primary btn-sm" id="import-confirm-btn">确认映射</button>`);
        document.getElementById('modal-overlay')?.classList.add('import-studio-overlay');
        setTimeout(() => {
            const saveCheck = document.getElementById('import-save-template');
            const nameInput = document.getElementById('import-template-name');
            saveCheck?.addEventListener('change', () => nameInput.disabled = !saveCheck.checked);
            document.querySelectorAll('.import-issue-action').forEach(select => select.addEventListener('change', () => {
                const input = document.querySelector(`.import-issue-value[data-sheet-index="${select.dataset.sheetIndex}"][data-excel-row="${select.dataset.excelRow}"]`);
                if (input) input.disabled = select.value !== 'replace';
            }));
            document.getElementById('import-confirm-btn')?.addEventListener('click', async () => {
                const mappings = {};
                analysis.sheets.forEach((sheet, index) => {
                    const enabled = document.querySelector(`.import-sheet-enabled[data-sheet-index="${index}"]`)?.checked || false;
                    const mapping = {enabled, header_row: sheet.header_row};
                    document.querySelectorAll(`.import-map-select[data-sheet-index="${index}"]`).forEach(select => {
                        mapping[select.dataset.field] = select.value === '' ? null : Number(select.value);
                    });
                    mapping.row_actions = {};
                    document.querySelectorAll(`.import-issue-action[data-sheet-index="${index}"]`).forEach(select => {
                        const action = select.value;
                        const row = select.dataset.excelRow;
                        if (action === 'keep') return;
                        const valueInput = document.querySelector(`.import-issue-value[data-sheet-index="${index}"][data-excel-row="${row}"]`);
                        if (action === 'replace' && (valueInput?.value === '' || !Number.isFinite(Number(valueInput.value)))) return;
                        mapping.row_actions[row] = action === 'exclude' ? {action:'exclude'} : {action:'replace', value:Number(valueInput.value)};
                    });
                    mappings[sheet.name] = mapping;
                });
                if (!Object.values(mappings).some(m => m.enabled)) { showToast('请至少启用一个工作表', 'warning'); return; }
                if (saveCheck?.checked) {
                    const templateName = nameInput?.value?.trim() || `${fileName} 映射`;
                    const templateMappings = Object.fromEntries(Object.entries(mappings).map(([sheetName, mapping]) => {
                        const reusable = {...mapping};
                        delete reusable.row_actions;
                        return [sheetName, reusable];
                    }));
                    const saved = await eel.save_import_template(templateName, moduleType, analysis.fingerprint, templateMappings)();
                    if (!saved?.success) { showToast(saved?.error || '模板保存失败', 'error'); return; }
                }
                closeModal();
                onConfirm?.(mappings, analysis);
            });
        }, 50);
    }

    return {analyze, open};
})();
