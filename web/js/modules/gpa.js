/**
 * Module A: GPA Calculation UI (学分绩点计算)
 * Supports batch selection of multiple raw grade files.
 */

let gpaSelectedFiles = [];
let gpaColumnMappings = {};
let gpaImportHealth = {};
let gpaAuditWorkspace = null;
let gpaLastOutputs = { main: '', ranking: '' };
let gpaCloudLinks = { main: '', ranking: '' };
const gpaKdocsSyncing = new Set();

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
                <button class="btn btn-ghost btn-sm" onclick="autoAnalyzeGPAFiles()">
                    重新检查全部
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
        autoAnalyzeGPAFiles();
    }
}

function clearGPABatch() {
    gpaSelectedFiles = [];
    gpaColumnMappings = {};
    gpaImportHealth = {};
    renderGPAFileList();
}

function removeGPAFile(index) {
    const removed = gpaSelectedFiles.splice(index, 1)[0];
    delete gpaColumnMappings[removed];
    delete gpaImportHealth[removed];
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
        const health = gpaImportHealth[path];
        const healthHtml = !health ? '<span>等待检查</span>' : health.missing > 0
            ? `<span style="color:var(--color-error);">缺少 ${health.missing} 个关键字段</span>`
            : `<strong>✓ ${health.rows} 条候选数据</strong><span class="gpa-course-review-state ${health.courseReviewed?'done':''}">${health.courseReviewed?'课程已审核':'课程待审核'}</span>`;
        html += `
            <div class="file-list-item">
                <span class="file-num" style="width:28px;color:var(--text-muted);text-align:center;">${i + 1}</span>
                <span class="file-path" style="flex:1;font-size:12px;" title="${escapeHtml(path)}"><span>${escapeHtml(fileName)}</span><span class="import-file-health">${healthHtml}</span></span>
                <button class="btn btn-ghost btn-sm" onclick="configureGPAFile(${i})">配置</button>
                <button class="btn btn-teal btn-sm" onclick="openGpaAuditPage(${i})">进入班级审核</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-error);"
                        onclick="removeGPAFile(${i})">✕</button>
            </div>`;
    });
    container.innerHTML = html;
}

function _gpaMappingsFromAnalysis(analysis) {
    const mappings = {};
    let hasEnabled = false;
    analysis.sheets.forEach((sheet, index) => {
        const enabled = !!sheet.recommended;
        hasEnabled = hasEnabled || enabled;
        mappings[sheet.name] = {...sheet.suggested_mapping,...gpaLoadSavedRange(sheet), header_row:sheet.header_row, enabled};
    });
    if (!hasEnabled && analysis.sheets[0]) mappings[analysis.sheets[0].name].enabled = true;
    return mappings;
}

function gpaRangeKey(sheet){return `${sheet.name}|${(sheet.headers||[]).slice(0,20).join('|')}`;}
function gpaLoadSavedRange(sheet){try{return JSON.parse(localStorage.getItem('gpa-course-ranges-v1')||'{}')[gpaRangeKey(sheet)]||{};}catch(_){return {};}}
function gpaSaveRange(job){try{const all=JSON.parse(localStorage.getItem('gpa-course-ranges-v1')||'{}');all[gpaRangeKey({name:job.sheetName,headers:job.result.headers})]={course_start_col:job.mapping.course_start_col,course_end_col:job.mapping.course_end_col};localStorage.setItem('gpa-course-ranges-v1',JSON.stringify(all));}catch(_){} }

async function analyzeGPAFile(path) {
    try {
        const analysis = await ImportStudio.analyze(path, 'gpa_raw', true);
        gpaColumnMappings[path] = _gpaMappingsFromAnalysis(analysis);
        const enabledSheets = analysis.sheets.filter(sheet => gpaColumnMappings[path][sheet.name]?.enabled);
        gpaImportHealth[path] = {
            rows: enabledSheets.reduce((sum, sheet) => sum + (sheet.valid_rows || 0), 0),
            missing: enabledSheets.reduce((sum, sheet) => sum + (sheet.missing_fields?.length || 0), 0),
            courseReviewed: enabledSheets.every(sheet => Array.isArray(gpaColumnMappings[path][sheet.name]?.course_definitions))
        };
    } catch (error) {
        gpaImportHealth[path] = {rows:0, missing:1, error:error.message};
    }
}

async function autoAnalyzeGPAFiles() {
    if (!gpaSelectedFiles.length) return;
    showToast(`正在检查 ${gpaSelectedFiles.length} 个成绩文件…`, 'info');
    await Promise.all(gpaSelectedFiles.map(analyzeGPAFile));
    renderGPAFileList();
}

async function configureGPAFile(index) {
    const path = gpaSelectedFiles[index];
    if (!path) return;
    await ImportStudio.open({
        path, moduleType:'gpa_raw', title:'学分绩点 · 原始成绩映射',
        onConfirm:(mappings, analysis) => {
            gpaColumnMappings[path] = mappings;
            const enabled = analysis.sheets.filter(sheet => mappings[sheet.name]?.enabled);
            gpaImportHealth[path] = {
                rows:enabled.reduce((sum,sheet)=>sum+(sheet.valid_rows||0),0),
                missing:enabled.reduce((sum,sheet)=>sum+(sheet.missing_fields?.length||0),0),
                courseReviewed:enabled.every(sheet=>Array.isArray(mappings[sheet.name]?.course_definitions))
            };
            renderGPAFileList();
        }
    });
}

async function openGpaAuditPage(index) {
    const path=gpaSelectedFiles[index];
    const fileMappings=gpaColumnMappings[path]||{};
    // 审核页必须展示检测到的全部成绩工作表；enabled 只控制最终导出。
    const entries=Object.entries(fileMappings).filter(([,m])=>m && m.name_col!==null && m.id_col!==null);
    if(!entries.length){showToast('请先完成基础字段配置','warning');return;}
    const container=document.getElementById('module-container');
    container.innerHTML='<div class="gpa-review-loading"><span></span><h2>正在按班级整理成绩单</h2><p>识别每名学生的课程组合、总学分与异常情况…</p></div>';
    const jobs=[];
    for(const [sheetName,mapping] of entries){
        const result=await eel.analyze_gpa_course_structure(path,{...mapping,sheet_name:sheetName})();
        if(!result?.success){showToast(`${sheetName}：${result?.error||'分析失败'}`,'error');continue;}
        const savedByCol=new Map((mapping.course_definitions||[]).map(c=>[c.score_col,c]));
        result.courses=result.courses.map(c=>{const old=savedByCol.get(c.score_col);return old?.credit_source==='手动确认'?{...c,...old}:c;});
        for(const cls of result.classes||[])for(const group of cls.groups||[])for(const student of group.students||[]){
            for(const detail of student.course_details||[]){const definition=result.courses.find(c=>c.score_col===detail.score_col);if(definition){detail.name=definition.name;detail.credit=Number(definition.credit||0);}}
            student.total_credits=Math.round((student.course_details||[]).reduce((sum,c)=>sum+Number(c.credit||0),0)*100)/100;
        }
        jobs.push({sheetName,mapping,result});
    }
    if(!jobs.length){renderModuleGPA();return;}
    gpaAuditWorkspace={index,path,jobs};
    renderGpaAuditPage();
}

function renderGpaAuditPage() {
    const w=gpaAuditWorkspace;if(!w)return;
    const allClasses=w.jobs.flatMap((job,ji)=>(job.result.classes||[]).map(cls=>({...cls,jobIndex:ji,sheetName:job.sheetName})));
    const students=allClasses.reduce((n,c)=>n+c.student_count,0), abnormal=allClasses.reduce((n,c)=>n+c.abnormal_count,0);
    const fileName=w.path.split(/[\\/]/).pop();
    const coursePanels=w.jobs.map((job,ji)=>{const headers=job.result.headers||[];const declared=job.result.typical_course_count||0;const selected=job.result.courses.filter(c=>c.enabled!==false).length;const options=headers.map((h,i)=>`<option value="${i}">${i+1}. ${escapeHtml(h||'(空白列)')}</option>`).join('');return `<details class="gpa-source-catalog" ${selected!==declared?'open':''}><summary><div><span>课程学分设置</span><strong>${escapeHtml(job.sheetName)}</strong></div><b class="${selected!==declared?'warn':''}">${selected} 门课程${declared&&selected!==declared?` · 原表多数为${declared}门`:''}</b></summary><div class="gpa-course-boundary"><div><b>课程范围校正</b><small>自动识别不对时，直接指定第一门和最后一门。</small></div><label>第一门<select class="input" id="gpa-start-${ji}">${options}</select></label><label>最后一门<select class="input" id="gpa-end-${ji}">${options}</select></label><button class="btn btn-teal btn-sm" onclick="gpaApplyCourseRange(${ji})">重新识别</button></div><div class="gpa-source-course-grid">${job.result.courses.map((c,ci)=>`<label class="gpa-source-course ${c.enabled===false?'disabled':''} ${Number(c.credit||0)>4||Number(c.credit||0)<=0?'danger':''}"><input type="checkbox" ${c.enabled!==false?'checked':''} onchange="gpaAuditEdit(${ji},${ci},'enabled',this.checked)"><span><input class="input" value="${escapeHtml(c.name)}" onchange="gpaAuditEdit(${ji},${ci},'name',this.value)"><small>${escapeHtml(c.credit_source||'待确认')} · ${c.enrolled_count}/${c.total_students}人修读</small></span><div><input class="input" type="number" min="0.1" max="10" step="0.5" value="${Number(c.credit||0)}" onchange="gpaAuditEdit(${ji},${ci},'credit',Number(this.value))"><em>学分</em></div></label>`).join('')}</div></details>`}).join('');
    const classCards=allClasses.map((cls,ci)=>gpaAuditClassCard(cls,ci)).join('');
    document.getElementById('module-container').innerHTML=`<div class="gpa-review-page">
      <header class="gpa-review-top"><button class="btn btn-ghost" onclick="gpaAuditBack()">← 返回绩点页面</button><div><span>成绩单课程审核</span><h2>${escapeHtml(fileName)}</h2></div><div class="gpa-review-kpis"><b>${allClasses.length}<small>班级</small></b><b>${students}<small>学生</small></b><b class="${abnormal?'warn':''}">${abnormal}<small>需关注</small></b></div><button class="btn btn-primary" onclick="saveGpaAuditPage()">确认全部审核</button></header>
      <section class="gpa-review-instruction"><b>操作顺序</b><span>① 先展开课程学分设置，确认名称与学分</span><span>② 再逐班展开学生审核单</span><span>③ 异常学生默认展开，普通学生按相同课程组合折叠</span></section>
      <div class="gpa-review-body"><aside><h3>课程与学分</h3><p>这里修改的是成绩单中的课程定义。</p>${coursePanels}</aside><main><div class="gpa-class-heading"><div><span>CLASS REVIEW</span><h2>按班级审核学生课程</h2></div><small>点击班级展开审核单</small></div>${classCards}</main></div>
    </div>`;
    document.getElementById('module-title').textContent='学分绩点 · 班级课程审核';
    w.jobs.forEach((job,ji)=>{const start=document.getElementById(`gpa-start-${ji}`),end=document.getElementById(`gpa-end-${ji}`);if(start)start.value=job.result.course_start_col;if(end)end.value=job.result.course_end_col;});
}

async function gpaApplyCourseRange(jobIndex){
    const w=gpaAuditWorkspace,job=w?.jobs?.[jobIndex];if(!job)return;
    const start=Number(document.getElementById(`gpa-start-${jobIndex}`)?.value),end=Number(document.getElementById(`gpa-end-${jobIndex}`)?.value);
    if(!Number.isInteger(start)||!Number.isInteger(end)||end<start){showToast('最后一门课程不能位于第一门之前','warning');return;}
    job.mapping.course_start_col=start;job.mapping.course_end_col=end;
    showToast(`正在按你指定的第 ${start+1}–${end+1} 列重新识别`,'info');
    const result=await eel.analyze_gpa_course_structure(w.path,{...job.mapping,sheet_name:job.sheetName})();
    if(!result?.success){showToast(result?.error||'重新识别失败','error');return;}
    job.result=result;gpaSaveRange(job);renderGpaAuditPage();showToast(`已重新识别 ${result.courses.length} 门课程，并记住此类表格的范围`,'success');
}

function gpaAuditClassCard(cls,index){
    const groups=(cls.groups||[]).map((group,gi)=>{
        const abnormal=group.students.some(s=>s.is_abnormal);
        const names=group.students.map(s=>escapeHtml(s.name)).join('、');
        const common=group.students.length>1;
        const courses=group.courses.filter(c=>c.enabled!==false).map(c=>`<span class="gpa-course-pill ${c.retake?'retake':''}"><b>${escapeHtml(c.name)}</b><em>${c.credit}学分</em></span>`).join('');
        if(common&&!abnormal)return `<details class="gpa-student-group"><summary><div><b>${group.students.length} 名学生课程相同</b><span>${names}</span></div><strong>${group.courses.length}门 · ${group.students[0]?.total_credits||0}学分</strong></summary><div class="gpa-common-courses">${courses}</div></details>`;
        return group.students.map(s=>`<details class="gpa-student-review ${s.is_abnormal?'abnormal':''}" ${s.is_abnormal?'open':''}><summary><div><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.id||'无学号')}</span></div><strong>${s.total_credits} <small>总学分</small></strong><em>${s.course_details.filter(c=>c.enabled!==false).length}门课程</em><i>${s.is_abnormal?'需要确认':'正常'}</i></summary>${s.flags?.length?`<div class="gpa-student-alerts">${s.flags.map(f=>`<span>! ${escapeHtml(f)}</span>`).join('')}</div>`:''}${gpaStudentDifference(s)}<div class="gpa-student-course-list">${s.course_details.filter(c=>c.enabled!==false).map(c=>`<div class="${s.extra_courses?.includes(c.name)?'course-extra':''}"><span>${escapeHtml(c.name)}${s.extra_courses?.includes(c.name)?'<em>个人多修</em>':''}${c.retake?'<em>重修</em>':''}</span><b>${c.credit} 学分</b><small>成绩 ${c.score}</small></div>`).join('')}</div></details>`).join('');
    }).join('');
    return `<details class="gpa-class-audit-card" ${index===0||cls.abnormal_count?'open':''}><summary><div><span>班级审核单</span><h3>${escapeHtml(cls.name)}</h3></div><section><b>${cls.student_count}<small>学生</small></b><b>${cls.typical_count}<small>常规组合</small></b><b class="${cls.abnormal_count?'warn':''}">${cls.abnormal_count}<small>异常</small></b></section><i>⌄</i></summary><div class="gpa-class-audit-body">${groups||'<div class="empty-state">没有识别到学生课程</div>'}</div></details>`;
}

function gpaStudentDifference(student){
    const extra=student.extra_courses||[], missing=student.missing_courses||[];
    if(!extra.length&&!missing.length&&!student.possible_transfer&&student.difference===0)return '';
    return `<section class="gpa-difference-panel"><header><b>与本班多数同学的具体差异</b><span>只影响该同学，不会改动全班</span></header>
      ${extra.length?`<div class="extra"><strong>＋ 多修 ${extra.length} 门</strong><p>${extra.map(escapeHtml).join('、')}</p></div>`:''}
      ${missing.length?`<div class="missing"><strong>－ 少修 ${missing.length} 门</strong><p>${missing.map(escapeHtml).join('、')}</p></div>`:''}
      ${student.possible_transfer?'<div class="transfer"><strong>↪ 可能转专业/留级</strong><p>学号入学年级与当前班级年级不一致，请核对身份。</p></div>':''}
      ${student.difference!==null&&student.difference!==0?`<div class="count"><strong>表内课程门数冲突</strong><p>原表填写 ${student.declared_count} 门，实际识别 ${student.detected_count} 门。</p></div>`:''}
      <footer><button class="btn btn-teal btn-sm" onclick="gpaResolveStudent(this,'keep')">按该生实际课程保留</button><button class="btn btn-ghost btn-sm" onclick="gpaResolveStudent(this,'ignore')">已人工核对，忽略提示</button><small>若课程或学分本身错误，请在左侧“课程与学分”中修改。</small></footer></section>`;
}

function gpaResolveStudent(button,action){
    const card=button.closest('.gpa-student-review');if(!card)return;
    card.classList.add('resolved');card.removeAttribute('open');
    const badge=card.querySelector('summary i');if(badge)badge.textContent=action==='keep'?'按个人课程保留':'已忽略';
    showToast(action==='keep'?'已保留该生的实际课程组合':'已标记为人工核对','success');
}

function gpaAuditEdit(jobIndex,courseIndex,field,value){
    const job=gpaAuditWorkspace?.jobs[jobIndex],course=job?.result?.courses?.[courseIndex];if(!course)return;
    course[field]=value;if(field==='credit')course.credit_source='手动确认';
    // Recalculate visible student totals and flags from the edited course definition.
    for(const cls of job.result.classes||[])for(const group of cls.groups||[])for(const student of group.students||[]){
        for(const detail of student.course_details||[])if(detail.score_col===course.score_col||detail.name===course.name){if(field==='credit')detail.credit=value;if(field==='name')detail.name=value;if(field==='enabled')detail.enabled=value;}
        student.total_credits=Math.round((student.course_details||[]).filter(c=>c.enabled!==false).reduce((sum,c)=>sum+Number(c.credit||0),0)*100)/100;
    }
}
function saveGpaAuditPage(){const w=gpaAuditWorkspace;if(!w)return;for(const job of w.jobs){const enabled=job.result.courses.filter(c=>c.enabled!==false);if(enabled.some(c=>!c.name||!(c.credit>0)||c.credit>10)){showToast(`${job.sheetName} 存在未填写或异常学分，请先确认`,'warning');return;}job.mapping.course_definitions=job.result.courses.map(c=>({...c,credit_source:'手动确认'}));}if(!gpaImportHealth[w.path])gpaImportHealth[w.path]={rows:0,missing:0};gpaImportHealth[w.path].courseReviewed=w.jobs.every(j=>Array.isArray(j.mapping.course_definitions));showToast(`已完成 ${w.jobs.length} 个工作表、${w.jobs.flatMap(j=>j.result.classes||[]).length} 个班级的课程审核`,'success');gpaAuditBack();}
function gpaAuditBack(){gpaAuditWorkspace=null;renderModuleGPA();renderGPAFileList();document.getElementById('module-title').textContent='学分绩点计算';}

async function reviewGpaCourses(index, requestedSheet='') {
    const path = gpaSelectedFiles[index];
    const fileMappings = gpaColumnMappings[path] || {};
    const enabledEntries = Object.entries(fileMappings).filter(([,value]) => value?.enabled);
    if (!requestedSheet && enabledEntries.length > 1) {
        const fileName=path.split(/[\\/]/).pop();
        showModal('按班级审核课程', `<div class="gpa-class-workbench"><aside><div class="gpa-class-file"><span>当前成绩文件</span><strong>${escapeHtml(fileName)}</strong><small>${enabledEntries.length} 个班级工作表</small></div><div class="gpa-sheet-review-list">${enabledEntries.map(([name,m],n)=>`<button onclick="closeModal();reviewGpaCourses(${index},'${name.replace(/'/g,"\\'")}')"><i>${String(n+1).padStart(2,'0')}</i><span><strong>${escapeHtml(name)}</strong><small>${Array.isArray(m.course_definitions)?`已确认 ${m.course_definitions.filter(c=>c.enabled).length} 门课程`:'等待确认课程与学分'}</small></span><b class="${Array.isArray(m.course_definitions)?'done':''}">${Array.isArray(m.course_definitions)?'✓':'→'}</b></button>`).join('')}</div></aside><main class="gpa-class-guide"><span>CLASS BY CLASS</span><h2>一个班级，一个班级地核对</h2><p>从左侧选择班级。右侧只会显示这个班的课程、学分和学生差异，不再把所有班级混在一起。</p><ol><li><b>1</b>确认课程名称</li><li><b>2</b>确认每门课学分（通常 1–4）</li><li><b>3</b>检查转专业、重修和少修学生</li></ol></main></div>`, `<button class="btn btn-ghost" onclick="closeModal()">关闭</button>`);
        document.getElementById('modal-overlay')?.classList.add('import-studio-overlay');
        return;
    }
    const entry = requestedSheet ? enabledEntries.find(([name])=>name===requestedSheet) : enabledEntries[0];
    if (!entry) { showToast('请先完成基础字段配置', 'warning'); return; }
    const [sheetName, baseMapping] = entry;
    const result = await eel.analyze_gpa_course_structure(path, {...baseMapping, sheet_name:sheetName})();
    if (!result?.success) { showToast(result?.error || '课程分析失败', 'error'); return; }
    const saved = baseMapping.course_definitions || [];
    const savedByCol = new Map(saved.map(c => [c.score_col, c]));
    const courses = result.courses.map(c => {
        const previous=savedByCol.get(c.score_col);
        return previous?.credit_source==='手动确认' ? {...c,...previous} : c;
    });
    const unusual = result.students.filter(s => s.deviation_from_typical !== 0 || (s.difference !== null && s.difference !== 0));
    const rows = courses.map((c,i) => `<tr>
        <td><input type="checkbox" class="gpa-course-enabled" data-i="${i}" ${c.enabled!==false?'checked':''}></td>
        <td><input class="input gpa-course-name" data-i="${i}" value="${escapeHtml(c.name)}"></td>
        <td><div class="gpa-credit-editor"><input class="input gpa-course-credit ${Number(c.credit||0)>4?'suspicious':''}" data-i="${i}" type="number" min="0.1" max="10" step="0.5" value="${Number(c.credit||0)}"><small>${escapeHtml(c.credit_source||'已手动确认')}</small></div></td>
        <td>${c.score_col+1}${c.value_col!==null?` / 换算列 ${c.value_col+1}`:''}</td>
        <td>${c.enrolled_count}/${c.total_students}${c.enrolled_count<c.total_students?'<em>个别修读</em>':''}${c.retake?'<em>重修·默认最新</em>':''}</td>
        <td><label><input type="checkbox" class="gpa-course-pe" data-i="${i}" ${c.is_pe?'checked':''}> 体育</label></td></tr>`).join('');
    const unusualRows = unusual.map(s => `<tr><td>${escapeHtml(s.class_name)}</td><td>${escapeHtml(s.name)}</td><td>${s.declared_count??'—'}</td><td>${s.detected_count}</td><td class="${s.difference===0?'':'warn'}">${s.difference===null?'—':(s.difference>0?'+':'')+s.difference}</td><td>${s.deviation_from_typical>0?'多修':s.deviation_from_typical<0?'少修':'门数不一致'}</td></tr>`).join('');
    showModal('课程与个人修读审核', `<div class="gpa-course-audit">
        <div class="gpa-audit-hero"><div><span>当前班级 · COURSE AUDIT</span><h3>${escapeHtml(sheetName)}</h3><p>${escapeHtml(path.split(/[\\/]/).pop())} · 典型 ${result.typical_course_count} 门 · ${result.student_count} 名学生</p></div><strong>${courses.filter(c=>c.enabled!==false).length}<small>本班课程</small></strong></div>
        <div class="gpa-credit-notice"><b>学分只允许合理数值</b><span>系统不会再拿学生成绩当学分。0 或大于 4 的学分会醒目标记，必须由你确认后才能保存。</span></div>
        <div class="gpa-audit-toolbar"><button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.gpa-course-enabled').forEach(x=>x.checked=true)">全选</button><button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.gpa-course-enabled').forEach(x=>x.checked=false)">全不选</button><span>全班只有少数人修读的课程默认保留，计算时按每个人实际成绩决定。</span></div>
        <div class="gpa-course-table-wrap"><table class="data-table"><thead><tr><th>计入</th><th>课程</th><th>学分</th><th>源列</th><th>修读人数</th><th>类型</th></tr></thead><tbody>${rows}</tbody></table></div>
        <details class="gpa-student-differences" ${unusual.length?'open':''}><summary>个人课程门数差异（${unusual.length}人）</summary><div><table class="data-table"><thead><tr><th>班级</th><th>姓名</th><th>原表门数</th><th>识别门数</th><th>差异</th><th>说明</th></tr></thead><tbody>${unusualRows||'<tr><td colspan="6">所有学生课程门数一致</td></tr>'}</tbody></table></div></details>
    </div>`, `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="gpa-course-save">确认课程与学分</button>`);
    document.getElementById('modal-overlay')?.classList.add('import-studio-overlay');
    document.getElementById('gpa-course-save').onclick = () => {
        courses.forEach((course,i) => {
            course.enabled = document.querySelector(`.gpa-course-enabled[data-i="${i}"]`).checked;
            course.name = document.querySelector(`.gpa-course-name[data-i="${i}"]`).value.trim();
            course.credit = Number(document.querySelector(`.gpa-course-credit[data-i="${i}"]`).value);
            course.credit_source = '手动确认';
            course.is_pe = document.querySelector(`.gpa-course-pe[data-i="${i}"]`).checked;
        });
        if (!courses.some(c=>c.enabled)) { showToast('至少保留一门课程', 'warning'); return; }
        if (courses.some(c=>c.enabled && (!(c.credit>0) || c.credit>10 || !c.name))) { showToast('已选课程必须填写名称和 0.1–10 之间的学分', 'warning'); return; }
        if (courses.some(c=>c.enabled && c.credit>4) && !confirm('存在大于4学分的课程。通常课程学分在1–4之间，确认这些学分确实正确吗？')) return;
        baseMapping.course_definitions = courses;
        gpaImportHealth[path].courseReviewed = enabledEntries.every(([,m])=>Array.isArray(m.course_definitions));
        closeModal(); renderGPAFileList(); showToast(`已确认 ${sheetName} 的 ${courses.filter(c=>c.enabled).length} 门课程`, 'success');
        if (enabledEntries.length>1) setTimeout(()=>reviewGpaCourses(index),120);
    };
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
    gpaColumnMappings = {};
    gpaImportHealth = {};
    document.getElementById('gpa-output-dir').value = '';
    document.getElementById('gpa-output-dir').classList.remove('has-file');
    document.getElementById('gpa-progress-area').innerHTML = '';
    document.getElementById('gpa-result-area').innerHTML = '';
    document.getElementById('gpa-preview-area').innerHTML = '';
    gpaLastOutputs = { main: '', ranking: '' };
    renderGPAFileList();
}

function gpaCloudSpec(kind) {
    return kind === 'ranking'
        ? { path: gpaLastOutputs.ranking, key: 'college-gpa-ranking-v1', label: '专业排名表' }
        : { path: gpaLastOutputs.main, key: 'college-gpa-main-v1', label: '学分绩点表' };
}

function showGpaKdocsError(message) {
    const detail = String(message || '金山文档接口暂时不可用');
    let summary = '同步没有完成，请稍后重试。已写入的班级会在下次同步时继续处理。';
    if (/rangeData|超过限制|limit/i.test(detail)) summary = '云端批量限制触发。新版会自动按每批 100 条拆分，请确认正在使用最新版。';
    else if (/400006|登录|鉴权|token|auth/i.test(detail)) summary = '金山文档授权已失效，请重新登录后继续。';
    else if (/timeout|超时|network|网络/i.test(detail)) summary = '网络响应超时。云端已完成的班级会保留，重试将从现有状态继续。';
    showModal('云表同步需要处理', `<div class="kdocs-success-card"><span>未完成</span><h3>${escapeHtml(summary)}</h3><p>本地 Excel 不受影响，也不会删除其他专业工作表。</p><details class="kdocs-error-detail"><summary>查看技术详情</summary><pre>${escapeHtml(detail)}</pre></details></div>`, '<button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="closeModal();switchModule(\'cloud\')">打开同步中心</button>');
}

function gpaKdocsWait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function showGpaKdocsProgress(spec) {
    showModal(`正在同步${spec.label}`, `
        <div class="kdocs-sync-progress" aria-live="polite">
            <header><div><span>学院云表同步</span><h3 id="kdocs-progress-stage">正在排队</h3><p id="kdocs-progress-detail">准备连接金山文档</p></div><strong id="kdocs-progress-percent">0%</strong></header>
            <div class="kdocs-progress-track"><span id="kdocs-progress-fill" style="width:0%"></span></div>
            <div class="kdocs-progress-meta"><span id="kdocs-progress-sheet">正在准备班级列表</span><span id="kdocs-progress-count"></span></div>
            <ol class="kdocs-progress-steps">
                <li id="kdocs-progress-step-connect"><b>1</b><span>连接并读取云表</span></li>
                <li id="kdocs-progress-step-write"><b>2</b><span>更新班级数据与格式</span></li>
                <li id="kdocs-progress-step-verify"><b>3</b><span>回读校验并完成</span></li>
            </ol>
            <p class="kdocs-progress-note">同步会在后台继续，请保持软件打开。其他专业工作表不会被删除。</p>
        </div>`, '<button class="btn btn-secondary" disabled>同步进行中…</button>');
    document.getElementById('modal-overlay')?.classList.add('modal-locked');
}

function updateGpaKdocsProgress(progress, kind) {
    const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setText('kdocs-progress-percent', `${Math.round(percent)}%`);
    setText('kdocs-progress-stage', progress?.stage || '正在同步');
    setText('kdocs-progress-detail', progress?.detail || '请稍候');
    const fill = document.getElementById('kdocs-progress-fill');
    if (fill) fill.style.width = `${percent}%`;
    const index = Number(progress?.sheet_index) || 0;
    const total = Number(progress?.sheet_total) || 0;
    setText('kdocs-progress-sheet', progress?.current_sheet ? `当前班级：${progress.current_sheet}` : '正在准备班级列表');
    setText('kdocs-progress-count', total ? `${index}/${total} 个工作表` : '');
    document.getElementById('kdocs-progress-step-connect')?.classList.toggle('is-done', percent >= 14);
    document.getElementById('kdocs-progress-step-write')?.classList.toggle('is-active', percent >= 14 && percent < 92);
    document.getElementById('kdocs-progress-step-write')?.classList.toggle('is-done', percent >= 92);
    document.getElementById('kdocs-progress-step-verify')?.classList.toggle('is-active', percent >= 92 && percent < 100);
    document.getElementById('kdocs-progress-step-verify')?.classList.toggle('is-done', percent >= 100 && progress?.status === 'success');

    const cloudRow = document.getElementById(`cloud-sync-${kind}`);
    if (cloudRow) {
        cloudRow.classList.add('is-syncing');
        const state = cloudRow.querySelector('.cloud-sync-state small');
        if (state) state.textContent = `${Math.round(percent)}% · ${progress?.stage || '正在同步'}`;
    }
}

async function runGpaKdocsSyncJob(spec, kind) {
    const started = await eel.kdocs_start_sync_workbook(spec.path, spec.key)();
    if (!started?.success || !started?.job_id) {
        return { success: false, error: started?.error || '无法启动云表同步任务' };
    }
    showGpaKdocsProgress(spec);
    while (true) {
        const progress = await eel.kdocs_get_sync_progress(started.job_id)();
        if (!progress?.success) return { success: false, error: progress?.error || '无法读取同步进度' };
        updateGpaKdocsProgress(progress, kind);
        if (progress.done) return progress.result || { success: false, error: '同步任务没有返回结果' };
        await gpaKdocsWait(500);
    }
}

async function connectKdocsAndSync(kind) {
    closeModal();
    showToast('请在浏览器中完成 WPS 登录，软件会自动继续', 'info');
    const result = await eel.kdocs_login()();
    if (!result?.success) {
        showToast(result?.error || '金山文档登录未完成', 'error');
        return;
    }
    showToast('金山文档连接成功', 'success');
    await syncGpaToKdocs(kind);
}

async function bindGpaKdocs(kind) {
    const spec = gpaCloudSpec(kind);
    const link = (document.getElementById('gpa-kdocs-bind-link')?.value || '').trim();
    if (!link) { showToast('请粘贴学院共享表链接', 'warning'); return; }
    const result = await eel.kdocs_bind_workbook(spec.key, link)();
    if (!result?.success) {
        showToast(result?.error || '绑定云表失败', 'error');
        return;
    }
    gpaCloudLinks[kind] = result.link_url || link;
    closeModal();
    showToast('已绑定学院共享表，正在同步当前专业', 'success');
    await syncGpaToKdocs(kind, true);
}

function showGpaKdocsFirstPublish(kind) {
    const spec = gpaCloudSpec(kind);
    showModal(`设置${spec.label}云表`, `
        <div class="kdocs-first-publish">
            <section><strong>我是第一个负责人</strong><p>用当前软件生成的 Excel 原样创建学院云表，之后把链接发给其他专业负责人。</p><button class="btn btn-primary" onclick="closeModal();syncGpaToKdocs('${kind}',true)">创建新的学院云表</button></section>
            <section><strong>学院已经有共享表</strong><p>粘贴第一个负责人发来的链接，当前专业会写入同一份云表。</p><input id="gpa-kdocs-bind-link" class="input" placeholder="https://www.kdocs.cn/l/..."><button class="btn btn-secondary" onclick="bindGpaKdocs('${kind}')">绑定并同步当前专业</button></section>
        </div>`, `<button class="btn btn-ghost" onclick="closeModal()">取消</button>`);
}

async function syncGpaToKdocs(kind, allowCreate = false) {
    return CloudSync.request(kind === 'ranking' ? 'gpa-ranking' : 'gpa-main');
    const spec = gpaCloudSpec(kind);
    if (!spec.path) {
        showToast('请先生成本地表格', 'warning');
        return;
    }
    const status = await eel.kdocs_auth_status()();
    if (!status?.authenticated) {
        showModal('连接金山文档', `
            <div class="kdocs-connect-card">
                <div class="kdocs-cloud-mark">W</div>
                <div><strong>登录后发布到金山文档</strong><p>首次发布会原样上传软件生成的 Excel；以后同步会更新同一个链接。</p></div>
            </div>`,
            `<button class="btn btn-ghost" onclick="closeModal()">暂不连接</button><button class="btn btn-primary" onclick="closeModal();switchModule('cloud')">前往登录页面</button>`);
        return;
    }
    const binding = await eel.kdocs_get_binding(spec.key)();
    if (!binding?.bound && !allowCreate) {
        showGpaKdocsFirstPublish(kind);
        return;
    }
    if (gpaKdocsSyncing.has(kind)) {
        showToast('这个云表正在同步，请等待当前任务完成', 'warning');
        return;
    }
    gpaKdocsSyncing.add(kind);

    const button = document.getElementById(`gpa-kdocs-${kind}`);
    if (button) { button.disabled = true; button.textContent = '正在同步…'; }
    showToast(`正在同步${spec.label}，请勿关闭软件`, 'info');
    try {
        const result = await runGpaKdocsSyncJob(spec, kind);
        if (!result?.success) {
            if (result?.needs_login) {
                showModal('金山文档登录已失效', '<div class="kdocs-connect-card"><div class="kdocs-cloud-mark">W</div><div><strong>需要重新授权</strong><p>本机凭据已过期或当前账号无权访问目标学院云表。</p></div></div>', '<button class="btn btn-primary" onclick="closeModal();switchModule(\'cloud\')">前往登录页面</button>');
            } else {
                showGpaKdocsError(result?.error || '同步失败');
            }
            return;
        }
        gpaCloudLinks[kind] = result.link_url || '';
        const detail = result.created
            ? '已原样创建云表格，模板、公式和样式来自本次软件输出。'
            : `已更新同一个云表格${Number.isFinite(result.changed_cells) ? `，变更 ${result.changed_cells} 个单元格` : ''}。`;
        showModal(`${spec.label}已同步`, `
            <div class="kdocs-success-card">
                <span>同步完成</span><h3>${escapeHtml(result.name || spec.label)}</h3>
                <p>${escapeHtml(detail)}</p>
                <div class="kdocs-link-preview">${escapeHtml(result.link_url || '')}</div>
                ${(result.created_sheets || []).length ? `<small>新增专业工作表：${escapeHtml(result.created_sheets.join('、'))}</small>` : ''}
            </div>`,
            `<button class="btn btn-ghost" onclick="copyGpaKdocsLink('${kind}')">复制链接</button><button class="btn btn-primary" onclick="openGpaKdocsLink('${kind}')">打开金山文档</button>`);
        showToast(result.created ? '金山云表格创建成功' : '金山云表格更新成功', 'success');
    } catch (error) {
        showGpaKdocsError(error);
    } finally {
        document.getElementById('modal-overlay')?.classList.remove('modal-locked');
        gpaKdocsSyncing.delete(kind);
        if (button) { button.disabled = false; button.textContent = kind === 'ranking' ? '☁ 同步排名云表' : '☁ 同步绩点云表'; }
    }
}

async function openGpaKdocsLink(kind) {
    const link = gpaCloudLinks[kind];
    if (!link) { showToast('还没有可打开的云表链接', 'warning'); return; }
    const result = await eel.open_web_link(link)();
    if (!result?.success) showToast(result?.error || '无法打开链接', 'error');
}

async function copyGpaKdocsLink(kind) {
    const link = gpaCloudLinks[kind];
    if (!link) { showToast('还没有可复制的云表链接', 'warning'); return; }
    try {
        await navigator.clipboard.writeText(link);
        showToast('金山文档链接已复制', 'success');
    } catch (_) {
        showToast('复制失败，请在上方手动选择链接', 'warning');
    }
}

async function processGPA() {
    if (!MajorScope.requireForExport()) return;
    const outputDir = document.getElementById('gpa-output-dir').value.trim();

    if (gpaSelectedFiles.length === 0) {
        showToast('请至少选择一个成绩文件', 'warning'); return;
    }
    if (!outputDir) { showToast('请选择输出目录', 'warning'); return; }
    const invalidFiles = gpaSelectedFiles.filter(path => !gpaColumnMappings[path] || (gpaImportHealth[path]?.missing || 0) > 0 || !gpaImportHealth[path]?.courseReviewed);
    if (invalidFiles.length) {
        showToast(`有 ${invalidFiles.length} 个文件尚未完成字段与课程学分审核`, 'warning');
        return;
    }

    const btn = document.getElementById('gpa-process-btn');
    btn.disabled = true;
    btn.classList.add('processing');
    btn.textContent = `处理 ${gpaSelectedFiles.length} 个文件中...`;

    const progress = createProgressBar('gpa-progress-area');
    progress.update(0, '正在启动...');

    const onProgress = (e) => progress.update(e.detail.percent, e.detail.message);
    window.addEventListener('progress-update', onProgress);

    try {
        const result = await eel.run_module_a_batch(gpaSelectedFiles, outputDir, gpaColumnMappings, MajorScope.get())();
        progress.done('计算完成！');

        if (result.success) {
            gpaLastOutputs = { main: result.output1, ranking: result.output2 };
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
                        <button id="gpa-kdocs-main" data-cloud-sync-id="gpa-main" class="btn btn-primary btn-sm" onclick="syncGpaToKdocs('main')">
                            ☁ 同步绩点云表
                        </button>
                        <button id="gpa-kdocs-ranking" data-cloud-sync-id="gpa-ranking" class="btn btn-primary btn-sm" onclick="syncGpaToKdocs('ranking')">
                            ☁ 同步排名云表
                        </button>
                    </div>
                </div>`;
            CompletionCelebration.mark('gpa', result.output1);
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
