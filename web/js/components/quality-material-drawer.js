/** Focused scoring drawer for quality-development material review. */
(function () {
    const state = {
        root: null, options: {}, presets: [], thresholds: [], student: null, activities: [], files: [],
        selected: null, query: '', draftsByStudent: {}, students: [], activeKey: '', categories: [],
    };
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const norm = value => String(value || '').trim().toLowerCase().replace(/[\s·・_—-]+/g, '');

    async function mount(options) {
        state.options = options || {};
        state.root = options.root || document.getElementById('quality-score-drawer');
        state.categories = options.categories || [];
        if (!state.presets.length) {
            try { state.presets = await eel.get_official_quality_presets()() || []; } catch (_) { state.presets = []; }
        }
        render();
        return api;
    }
    function setStudents(students, activeKey) { state.students = students || []; state.activeKey = activeKey || ''; renderStudentRail(); }
    function setStudent(student, activities) {
        saveDraft(); state.student = student || null; state.activeKey = student?.key || student?.id || '';
        state.activities = activities || []; state.selected = null; state.query = ''; render(); restoreDraft(); renderStudentRail();
    }
    function setFiles(files) { state.files = files || []; }
    function setThresholds(rows) { state.thresholds = rows || []; renderCapPreview(); }
    function open() { state.root?.classList.add('open'); }
    function close() { saveDraft(); state.root?.classList.remove('open'); }
    function getDraft() { return readForm(); }
    function clearDraft() { if (state.student) delete state.draftsByStudent[state.activeKey]; }
    function saveDraft() { if (state.student && state.root) state.draftsByStudent[state.activeKey] = readForm(); }
    function restoreDraft() { const row = state.draftsByStudent[state.activeKey]; if (row) applyForm(row); }

    function renderStudentRail() {
        const rail = document.getElementById('quality-student-rail'); if (!rail) return;
        const done = state.students.filter(s => s.status === 'done').length;
        rail.innerHTML = `<div class="quality-student-rail-head"><strong>学生材料</strong><small>${done}/${state.students.length}</small></div>` + state.students.map(s => {
            const key = s.key || s.id || '', active = key === state.activeKey;
            return `<button class="quality-student-item ${active?'active':''}" data-key="${esc(key)}"><span class="quality-student-avatar">${esc((s.name||'?').slice(-1))}</span><span class="quality-student-copy"><b>${esc(s.name||key)}</b><small>${esc(s.id||'')} · ${s.fileCount||0} 份材料</small></span><span class="quality-student-state">${s.status==='done'?'已完成':s.scoreCount?`${s.scoreCount}项`:'待审核'}</span></button>`;
        }).join('');
        rail.querySelectorAll('.quality-student-item').forEach(btn => btn.onclick = () => { saveDraft(); state.options.onStudentChange?.(btn.dataset.key); });
    }

    function render() {
        if (!state.root) return;
        state.root.innerHTML = `<div class="quality-drawer-inner">
            <p class="quality-drawer-kicker">SCORING WORKBENCH</p><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 class="quality-drawer-title">加分判定</h3><div style="display:flex;gap:4px;"><button class="btn btn-ghost btn-sm" onclick="qualityImportShowThresholds()">查看上限</button><button class="btn btn-ghost btn-sm" onclick="qualityImportCompleteCurrentFromDrawer()">完成并继续</button></div></div>
            <p class="quality-drawer-sub">先选常用规则，再按材料实际情况调整。所有建议均可修改。</p>
            <div class="quality-preset-search"><input id="quality-preset-search" class="input" placeholder="搜索比赛、证书、志愿服务…" autocomplete="off"></div>
            <div id="quality-preset-results" class="quality-preset-results"></div>
            <div class="quality-score-grid">
              <div class="wide"><label>项目名称</label><input id="qmd-name" class="input" style="width:100%" placeholder="也可以直接自定义"></div>
              <div><label>类别</label><select id="qmd-category" class="select-input" style="width:100%">${categoryOptions()}</select></div>
              <div><label>等级 / 认定方式</label><input id="qmd-grade" class="input" style="width:100%" placeholder="如：校级一等奖"></div>
              <div><label>基础分</label><input id="qmd-base" class="input" type="number" min="0" step="0.1" value="0" style="width:100%"></div>
              <div><label>次数 / 项数</label><input id="qmd-count" class="input" type="number" min="1" step="1" value="1" style="width:100%"></div>
              <div><label>贡献系数</label><select id="qmd-contribution" class="select-input" style="width:100%"><option value="1">主要完成人 100%</option><option value="0.9">参加人 90%</option><option value="0.8">自定 80%</option><option value="0.7">自定 70%</option></select></div>
              <div class="quality-switch-row"><span>与专业或俄语相关<br><small>按细则双倍</small></span><input id="qmd-related" type="checkbox"></div>
              <div class="quality-switch-row"><span>保留手工分值<br><small>超范围只提醒</small></span><input id="qmd-manual" type="checkbox" checked></div>
            </div>
            <div id="quality-cap-preview" class="quality-cap-preview"></div>
            <div id="quality-warning-area"></div>
            <div class="quality-drawer-actions"><button class="btn btn-ghost btn-sm" id="qmd-save-template">保存模板</button><button class="btn btn-primary" id="qmd-add">确认加入该学生</button></div>
          </div><div class="quality-drawer-existing" id="material-scoring-list"></div>`;
        bind(); filterPresets(''); renderCapPreview(); renderExisting();
    }
    function categoryOptions() {
        const cats = state.categories.length ? state.categories : [...new Set(state.presets.map(p => p.category))];
        return `<option value="">选择类别</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }
    function bind() {
        const search = document.getElementById('quality-preset-search');
        search.oninput = () => filterPresets(search.value);
        state.root.querySelectorAll('input,select').forEach(el => { if (el.id !== 'quality-preset-search') el.addEventListener('input', () => { saveDraft(); renderCapPreview(); renderWarnings(); }); });
        document.getElementById('qmd-add').onclick = confirmAdd;
        document.getElementById('qmd-save-template').onclick = saveAsUserTemplate;
    }
    function filterPresets(query) {
        state.query = query || ''; const needle = norm(query);
        const rows = state.presets.filter(p => !needle || norm([p.name,p.category,p.grade,...(p.tags||[])].join(' ')).includes(needle)).slice(0, needle?18:8);
        const box = document.getElementById('quality-preset-results'); if (!box) return;
        box.innerHTML = rows.map(p => `<button class="quality-preset-option ${state.selected?.id===p.id?'selected':''}" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.category)} · ${esc(p.grade)}</small></span><em>+${Number(p.score).toFixed(Number(p.score)%1?1:0)}</em></button>`).join('') || '<p style="font-size:10px;color:var(--text-muted);padding:8px;">没有匹配规则，可直接在下方自定义。</p>';
        box.querySelectorAll('button').forEach(btn => btn.onclick = () => selectPreset(btn.dataset.id));
    }
    function selectPreset(id) { state.selected = state.presets.find(p => p.id === id) || null; if (!state.selected) return; applyForm({ name:state.selected.name, category:state.selected.category, grade:state.selected.grade, baseScore:state.selected.score, count:1, contributionFactor:1, relatedMultiplier:false }); filterPresets(state.query); renderWarnings(); }
    function readForm() { return { name:value('qmd-name'), category:value('qmd-category'), grade:value('qmd-grade'), baseScore:Number(value('qmd-base'))||0, count:Math.max(1,Number(value('qmd-count'))||1), contributionFactor:Number(value('qmd-contribution'))||1, relatedMultiplier:!!document.getElementById('qmd-related')?.checked, officialPresetId:state.selected?.id||null }; }
    function value(id) { return document.getElementById(id)?.value || ''; }
    function applyForm(row) { const map={name:'qmd-name',category:'qmd-category',grade:'qmd-grade',baseScore:'qmd-base',count:'qmd-count',contributionFactor:'qmd-contribution'}; Object.entries(map).forEach(([key,id])=>{const el=document.getElementById(id);if(el&&row[key]!=null)el.value=row[key];}); const related=document.getElementById('qmd-related'); if(related)related.checked=!!row.relatedMultiplier; renderCapPreview(); }
    function scorePreview() { const row=readForm(), baseTotal=row.baseScore*row.count, contributed=baseTotal*row.contributionFactor; return { ...row, baseTotal, contributed, final:contributed*(row.relatedMultiplier?2:1) }; }
    function renderCapPreview() {
        const box=document.getElementById('quality-cap-preview'); if(!box)return; const p=scorePreview();
        const threshold=state.thresholds.find(t=>(t.categories||[]).includes(p.category)); const current=state.activities.filter(a=>(threshold?.categories||[]).includes(a.category)).reduce((n,a)=>n+(Number(a.score)||0),0);
        let effective=p.final, capText='该类别没有统一封顶，可按材料认定。';
        if(threshold){ effective=threshold.mode==='max_item'?Math.min(Math.max(current,p.final),threshold.max):Math.min(current+p.final,threshold.max); capText=`${threshold.name}：当前 ${current.toFixed(1)} + 本次 ${p.final.toFixed(2)}，计入后有效 ${effective.toFixed(2)} / ${threshold.max}`; }
        box.innerHTML=`<div class="quality-formula">${p.baseScore.toFixed(2)} × ${p.count}次 × ${(p.contributionFactor*100).toFixed(0)}% × ${p.relatedMultiplier?'2':'1'} = <strong>${p.final.toFixed(2)} 分</strong></div><div class="quality-cap-line">${esc(capText)}</div>`;
    }
    function duplicateWarning(row) { const n=norm(row.name); return state.activities.some(a => (row.officialPresetId && a.official_preset_id===row.officialPresetId) || (n && norm(a.activity)===n)); }
    function renderWarnings() { const box=document.getElementById('quality-warning-area');if(!box)return;const row=readForm();let html=''; if(duplicateWarning(row))html+='<div class="quality-duplicate-warning">发现该学生已有同名或同规则项目。细则建议同一项目只取最高值；你仍可确认后继续添加。</div>'; const range=state.selected?.score_range;if(range&&(row.baseScore<range[0]||row.baseScore>range[1]))html+=`<div class="quality-range-warning">当前基础分超出细则建议范围 ${range[0]}–${range[1]} 分。不会拦截，请确认材料依据。</div>`;box.innerHTML=html; }
    async function saveAsUserTemplate() { const row=readForm();if(!row.name||!row.category){showToast('请先填写项目名称和类别','warning');return;}try{await eel.save_activity_mapping(row.name,row.category,row.grade,row.baseScore)();showToast('已保存为个人常用模板','success');}catch(e){showToast('模板保存失败: '+e,'error');} }
    function confirmAdd() { const p=scorePreview();if(!p.name||!p.category||p.final<=0){showToast('请补全项目、类别和有效分数','warning');return;} const duplicate=duplicateWarning(p); if(duplicate&&!confirm('已有相同项目。是否仍然继续添加？'))return; state.options.onAdd?.({ activity:p.name,category:p.category,grade:p.grade,score:Number(p.final.toFixed(4)),base_score:p.baseScore,count:p.count,contribution:p.contributionFactor,related_multiplier:p.relatedMultiplier?2:1,official_preset_id:p.officialPresetId }); clearDraft(); state.selected=null; state.activities.push({activity:p.name,category:p.category,grade:p.grade,score:p.final,official_preset_id:p.officialPresetId}); render(); }
    function renderExisting() { const box=document.getElementById('material-scoring-list');if(!box)return; if(!state.activities.length){box.innerHTML='<p style="font-size:10px;color:var(--text-muted);text-align:center;padding:10px;">该学生还没有加分项</p>';return;} box.innerHTML=`<div style="font-size:10px;font-weight:700;margin-bottom:6px;">已确认 ${state.activities.length} 项</div><table class="data-table"><tbody>${state.activities.map((a,i)=>`<tr><td>${esc(a.activity)}</td><td>${Number(a.score||0).toFixed(2)}</td><td><button class="btn btn-ghost btn-sm" data-remove="${i}">×</button></td></tr>`).join('')}</tbody></table>`;box.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>state.options.onRemove?.(Number(btn.dataset.remove))); }
    const api = { mount,setStudents,setStudent,setFiles,setThresholds,open,close,getDraft,clearDraft,renderCapPreview,filterPresets,saveDraft,restoreDraft,saveAsUserTemplate,duplicateWarning };
    window.QualityMaterialDrawer = api;
})();
