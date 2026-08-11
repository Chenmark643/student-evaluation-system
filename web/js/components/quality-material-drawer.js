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
    function setThresholds(rows) { state.thresholds = rows || []; renderThresholdSummary(); renderSelectedRule(); renderCapPreview(); }
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
            <section class="quality-threshold-panel"><div class="quality-threshold-head"><b>本学期加分上限</b><button class="btn btn-ghost btn-sm" onclick="qualityImportShowThresholds()">管理上限</button></div><div id="quality-threshold-summary" class="quality-threshold-summary"></div></section>
            <div class="quality-preset-search"><input id="quality-preset-search" class="input" placeholder="搜索比赛、证书、志愿服务…" autocomplete="off"></div>
            <div id="quality-preset-results" class="quality-preset-results"></div>
            <div id="qmd-selected-rule" class="quality-selected-rule empty"><span>尚未选择规则</span><small>项目名称由你填写；规则只带出类别、等级、分数和上限组。</small></div>
            <div class="quality-score-grid">
              <div class="wide"><label>项目名称</label><input id="qmd-name" class="input" style="width:100%" placeholder="填写实际项目名称，如：中俄青年文化节"></div>
              <div><label>类别</label><select id="qmd-category" class="select-input" style="width:100%">${categoryOptions()}</select></div>
              <div><label>等级 / 认定方式</label><input id="qmd-grade" class="input" style="width:100%" placeholder="如：校级一等奖"></div>
              <div><label>基础分</label><input id="qmd-base" class="input" type="number" min="0" step="0.1" value="0" style="width:100%"></div>
              <div><label>次数 / 项数</label><input id="qmd-count" class="input" type="number" min="1" step="1" value="1" style="width:100%"></div>
              <div id="qmd-contribution-field" class="wide" hidden><label>贡献认定</label><select id="qmd-contribution" class="select-input" style="width:100%"><option value="1">主要完成人 100%</option></select><small id="qmd-contribution-note" class="quality-field-note"></small></div>
              <div class="quality-switch-row"><span>保留手工分值<br><small>超范围只提醒</small></span><input id="qmd-manual" type="checkbox" checked></div>
            </div>
            <div id="quality-cap-preview" class="quality-cap-preview"></div>
            <div id="quality-warning-area"></div>
            <div class="quality-drawer-actions"><button class="btn btn-ghost btn-sm" id="qmd-save-template">保存模板</button><button class="btn btn-primary" id="qmd-add">确认加入该学生</button></div>
          </div><div class="quality-drawer-existing" id="material-scoring-list"></div>`;
        bind(); filterPresets(''); renderThresholdSummary(); renderSelectedRule(); renderCapPreview(); renderWarnings(); renderExisting();
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
        box.innerHTML = rows.map(p => `<button class="quality-preset-option ${state.selected?.id===p.id?'selected':''}" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.primary_category||p.category)} · ${esc(p.grade)}</small></span><em>+${Number(p.score).toFixed(Number(p.score)%1?1:0)}</em></button>`).join('') || '<p style="font-size:10px;color:var(--text-muted);padding:8px;">没有匹配规则，可直接在下方自定义。</p>';
        box.querySelectorAll('button').forEach(btn => btn.onclick = () => selectPreset(btn.dataset.id));
    }
    function selectPreset(id) { state.selected = state.presets.find(p => p.id === id) || null; if (!state.selected) return; applyForm({ category:state.selected.category, grade:state.selected.grade, baseScore:state.selected.score, count:1, contributionFactor:1 }); configureContribution(); renderSelectedRule(); filterPresets(state.query); renderWarnings(); }
    function readForm() { return { name:value('qmd-name'), category:value('qmd-category'), grade:value('qmd-grade'), baseScore:Number(value('qmd-base'))||0, count:Math.max(1,Number(value('qmd-count'))||1), contributionFactor:Number(value('qmd-contribution'))||1, officialPresetId:state.selected?.id||null }; }
    function value(id) { return document.getElementById(id)?.value || ''; }
    function applyForm(row) { if(row.officialPresetId)state.selected=state.presets.find(p=>p.id===row.officialPresetId)||state.selected; const map={name:'qmd-name',category:'qmd-category',grade:'qmd-grade',baseScore:'qmd-base',count:'qmd-count',contributionFactor:'qmd-contribution'}; Object.entries(map).forEach(([key,id])=>{const el=document.getElementById(id);if(el&&row[key]!=null)el.value=row[key];}); configureContribution(row.contributionFactor); renderSelectedRule(); renderCapPreview(); }
    function scorePreview() { const row=readForm(), baseTotal=row.baseScore*row.count, contributed=baseTotal*row.contributionFactor; return { ...row, baseTotal, contributed, final:contributed }; }
    function configureContribution(preferred) { const field=document.getElementById('qmd-contribution-field'),select=document.getElementById('qmd-contribution'),note=document.getElementById('qmd-contribution-note');if(!field||!select)return;const policy=state.selected?.contribution_policy||'none';field.hidden=policy==='none';if(policy==='academic_90'){select.innerHTML='<option value="1">项目负责人 100%</option><option value="0.9">其余参加人 90%</option>';if(note)note.textContent='学术科技与创新创业多人项目按细则执行。';}else if(policy==='manual'){select.innerHTML='<option value="1">主要完成人 / 无法区分贡献 100%</option><option value="0.9">参加人（人工认定）90%</option><option value="0.8">参加人（人工认定）80%</option><option value="0.7">参加人（人工认定）70%</option>';if(note)note.textContent='文体集体项目没有固定折扣，请按实际贡献人工认定。';}else{select.innerHTML='<option value="1">按规则满额计分 100%</option>';if(note)note.textContent='';}const value=String(preferred??1);select.value=[...select.options].some(o=>o.value===value)?value:'1';}
    function renderSelectedRule(){const box=document.getElementById('qmd-selected-rule');if(!box)return;if(!state.selected){box.className='quality-selected-rule empty';box.innerHTML='<span>尚未选择规则</span><small>项目名称由你填写；规则只带出类别、等级、分数和上限组。</small>';return;}const cap=state.thresholds.find(t=>(t.categories||[]).includes(state.selected.category));box.className='quality-selected-rule';box.innerHTML=`<div><small>${esc(state.selected.primary_category||state.selected.category)}</small><strong>${esc(state.selected.name)}</strong></div><em>+${Number(state.selected.score).toFixed(Number(state.selected.score)%1?1:0)}</em><p>${cap?`上限组：${esc(cap.name)} · ${cap.mode==='max_item'?'同组只取最高':'累计封顶'} ${Number(cap.max).toFixed(1)} 分`:'该类别没有统一上限'}</p>`;}
    function renderThresholdSummary() {
        const box=document.getElementById('quality-threshold-summary'); if(!box)return;
        if(!state.thresholds.length){box.innerHTML='<span class="quality-threshold-empty">尚未加载上限，请点击“管理上限”检查</span>';return;}
        box.innerHTML=state.thresholds.map(th=>{
            const scores=state.activities.filter(a=>(th.categories||[]).includes(a.category)).map(a=>Number(a.score)||0);
            const used=(th.mode||'sum')==='max_item'?(scores.length?Math.max(...scores):0):scores.reduce((sum,n)=>sum+n,0);
            const capped=Math.min(used,Number(th.max)||0), full=used>=(Number(th.max)||0);
            return `<span class="quality-threshold-chip ${full?'full':''}" title="${esc((th.categories||[]).join('、'))}"><b>${esc(th.name)}</b><em>${capped.toFixed(1)} / ${Number(th.max).toFixed(1)}</em><small>${(th.mode||'sum')==='max_item'?'取最高':'累计封顶'}</small></span>`;
        }).join('');
    }
    function renderCapPreview() {
        const box=document.getElementById('quality-cap-preview'); if(!box)return; const p=scorePreview();
        const threshold=state.thresholds.find(t=>(t.categories||[]).includes(p.category)); const scores=state.activities.filter(a=>(threshold?.categories||[]).includes(a.category)).map(a=>Number(a.score)||0);const raw=scores.reduce((n,score)=>n+score,0);
        let added=p.final, capText='该类别没有统一上限，本次按材料认定值全额计入。';
        if(threshold){const max=Number(threshold.max)||0;const before=threshold.mode==='max_item'?Math.min(scores.length?Math.max(...scores):0,max):Math.min(raw,max);const after=threshold.mode==='max_item'?Math.min(Math.max(scores.length?Math.max(...scores):0,p.final),max):Math.min(raw+p.final,max);added=Math.max(0,after-before);capText=`所在上限组：${threshold.name}｜${threshold.mode==='max_item'?'同组只取最高':'累计封顶'} ${max.toFixed(1)} 分｜已计入 ${before.toFixed(1)}，本次有效 +${added.toFixed(2)}，组内结果 ${after.toFixed(2)}`; }
        box.innerHTML=`<div class="quality-formula">${p.baseScore.toFixed(2)} × ${p.count}次 × ${(p.contributionFactor*100).toFixed(0)}% = <strong>${p.final.toFixed(2)} 分</strong></div><div class="quality-cap-line">${esc(capText)}</div>`;
    }
    function duplicateCheck(row) {
        const name=norm(row.name||row.activity), category=norm(row.category), grade=norm(row.grade);
        const presetId=String(row.officialPresetId||row.official_preset_id||''), ruleLabel=norm(row.ruleLabel||row.rule_label||state.selected?.name);
        const score=Number(row.final??row.score??((Number(row.baseScore)||0)*(Number(row.count)||1)*(Number(row.contributionFactor)||1)));
        const exact=[], possible=[];
        state.activities.forEach(a=>{const exactName=!!name&&norm(a.activity)===name;const sameName=exactName||(!!name&&typeof window.qualityAreProjectNamesSimilar==='function'&&window.qualityAreProjectNamesSimilar(a.activity,row.name||row.activity));const sameRule=(!!presetId&&String(a.official_preset_id||'')===presetId)||(!!ruleLabel&&norm(a.rule_label)===ruleLabel);if(!sameName&&!sameRule)return;const sameDetails=exactName&&norm(a.category)===category&&norm(a.grade)===grade&&Number(a.score)===score;(sameDetails?exact:possible).push(a);});
        return {level:exact.length?'exact':possible.length?'possible':'none',exact,possible,matches:exact.concat(possible)};
    }
    function duplicateWarning(row) { return duplicateCheck(row).level!=='none'; }
    function duplicateItemText(item) { return `${item.activity||'未命名项目'} · ${item.category||'未分类'}${item.grade?` · ${item.grade}`:''} · +${Number(item.score||0).toFixed(2)}分`; }
    function renderWarnings() { const box=document.getElementById('quality-warning-area');if(!box)return;const row=scorePreview(),duplicate=duplicateCheck(row);let html=''; if(duplicate.level!=='none'){const item=duplicate.matches[0],relation=typeof window.qualityDuplicateRelationText==='function'?window.qualityDuplicateRelationText(item,{activity:row.name}):'项目名称或所选规则相近';html+=`<div class="quality-duplicate-warning ${duplicate.level}"><b>${duplicate.level==='exact'?'发现确定重复项':'发现疑似重复项'}</b><span>已有：${esc(duplicateItemText(item))}${duplicate.matches.length>1?`（另有 ${duplicate.matches.length-1} 项）`:''}</span><small>${duplicate.level==='exact'?'名称、类别、等级和分数均相同，提交时请选择保留方式。':`${esc(relation)}，提交时可全部保留或删去其中一条。`}</small></div>`;} const range=state.selected?.score_range;if(range&&(row.baseScore<range[0]||row.baseScore>range[1]))html+=`<div class="quality-range-warning">当前基础分超出细则建议范围 ${range[0]}–${range[1]} 分。不会拦截，请确认材料依据。</div>`;box.innerHTML=html; }
    async function saveAsUserTemplate() { const row=readForm();if(!row.name||!row.category){showToast('请先填写项目名称和类别','warning');return;}try{await eel.save_activity_mapping(row.name,row.category,row.grade,row.baseScore)();showToast('已保存为个人常用模板','success');}catch(e){showToast('模板保存失败: '+e,'error');} }
    async function confirmAdd() { const p=scorePreview();if(!p.name||!p.category||p.final<=0){showToast('请补全项目、类别和有效分数','warning');return;} const duplicate=duplicateCheck(p); const entry={ activity:p.name,category:p.category,grade:p.grade,score:Number(p.final.toFixed(4)),base_score:p.baseScore,count:p.count,contribution:p.contributionFactor,official_preset_id:p.officialPresetId,rule_label:state.selected?.name||'',cap_group:state.selected?.cap_group||null }; if(duplicate.level!=='none'){const decision=await window.qualityAskDuplicateResolution({studentName:state.student?.name||'',existingItem:duplicate.matches[0],incomingItem:entry});if(decision==='keep_existing'){showToast('已保留原记录，本次加分未加入','info');return;}if(decision==='replace'){const index=state.activities.indexOf(duplicate.matches[0]);if(index>=0)state.options.onRemove?.(index);}} state.options.onAdd?.(entry); clearDraft(); state.selected=null; render(); }
    function renderExisting() { const box=document.getElementById('material-scoring-list');if(!box)return; if(!state.activities.length){box.innerHTML='<p style="font-size:10px;color:var(--text-muted);text-align:center;padding:10px;">该学生还没有加分项</p>';return;} box.innerHTML=`<div style="font-size:10px;font-weight:700;margin-bottom:6px;">已确认 ${state.activities.length} 项</div><table class="data-table"><tbody>${state.activities.map((a,i)=>`<tr><td>${esc(a.activity)}</td><td>${Number(a.score||0).toFixed(2)}</td><td><button class="btn btn-ghost btn-sm" data-remove="${i}">×</button></td></tr>`).join('')}</tbody></table>`;box.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>state.options.onRemove?.(Number(btn.dataset.remove))); }
    const api = { mount,setStudents,setStudent,setFiles,setThresholds,open,close,getDraft,clearDraft,renderThresholdSummary,renderCapPreview,renderSelectedRule,filterPresets,saveDraft,restoreDraft,saveAsUserTemplate,duplicateWarning,duplicateCheck };
    window.QualityMaterialDrawer = api;
})();
