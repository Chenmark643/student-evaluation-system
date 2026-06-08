/**
 * V8.0 Counselor Dashboard — Full Restructure
 * Sidebar nav: 总览/年级对比/班级分析/学生管理/成绩分析/预警中心/通知工具/班会大屏/设置
 */
let cData=[],cPrevData=[],cDataFull=[],cPrevDataFull=[];
let cStarred={},cThresholds={gpa:2.0,moral:70,comp:60},cTags={};
let cThresholdsMulti={gpa:{safe:2.8,watch:2.3,alert:2.0,danger:1.5},moral:{safe:85,watch:75,alert:65,danger:50},comp:{safe:80,watch:65,alert:55,danger:40}};
let cPresets=[],cCurrentTab='overview',cCurrentPath='',cPrevPath='';
let cSearchHistory=[],cSemesters=[],cAllSemesters={};
let cSortCol=null,cSortDir=1;
let cConversations={};
let cExtraSemesters={};let cExtraData={};
let cCourseAnalysis=null;let cLastDeepAnalytics=null;
let cGradeFilePath='';let cCourseStudentMap={};
let cCurrentAnalysisSubTab='overview';
let cRenderTarget='counselor-main'; // overridden by analysis center

function escQs(s){return String(s||'').replace(/'/g,'&#39;');}
function escJs(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');}

async function showCounselorDashboard(){
    ['login-page','welcome-page','counselor-welcome-page','module-select-page','app'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    document.getElementById('counselor-page').style.display='flex';
    document.getElementById('counselor-user-label').textContent='👤 '+(sessionStorage.getItem('eval_user')||'辅导员');
    cStarred=JSON.parse(localStorage.getItem('counselor_starred')||'{}');
    cThresholds=JSON.parse(localStorage.getItem('counselor_thresholds')||'{"gpa":2,"moral":70,"comp":60}');
    cThresholdsMulti=JSON.parse(localStorage.getItem('counselor_thresholds_multi')||'{"gpa":{"safe":2.8,"watch":2.3,"alert":2,"danger":1.5},"moral":{"safe":85,"watch":75,"alert":65,"danger":50},"comp":{"safe":80,"watch":65,"alert":55,"danger":40}}');
    cPresets=JSON.parse(localStorage.getItem('counselor_presets')||'[]');
    cTags=JSON.parse(localStorage.getItem('counselor_tags')||'{}');
    cSearchHistory=JSON.parse(localStorage.getItem('counselor_search_history')||'[]');
    cSemesters=JSON.parse(localStorage.getItem('counselor_semesters')||'[]');
    cAllSemesters=JSON.parse(localStorage.getItem('counselor_all_semesters')||'{}');
    cConversations=JSON.parse(localStorage.getItem('counselor_conversations')||'{}');
    cExtraSemesters=JSON.parse(localStorage.getItem('counselor_extra_semesters')||'{}');
    cGradeFilePath=localStorage.getItem('counselor_grade_file')||'';
    cCurrentPath=localStorage.getItem('counselor_current_path')||'';
    cPrevPath=localStorage.getItem('counselor_previous_path')||'';
    renderCounselorNav();
    if(cCurrentPath)await cLoadFile('current',cCurrentPath);
    if(cPrevPath)await cLoadFile('previous',cPrevPath);
    for(const [label,path] of Object.entries(cExtraSemesters)){if(path)await cLoadExtraSemester(label,path);}
    // Restore saved filter state after data loads
    setTimeout(()=>{cRestoreFilters();cApplyFilter();},500);
}

// ==================== SIDEBAR NAV ====================
function renderCounselorNav(){
    const items=[
        {id:'notices',icon:'📧',label:'通知工具',primary:true},
        {id:'students',icon:'👤',label:'学生管理'},
        {id:'analysis',icon:'📊',label:'分析中心'},
        {id:'bigscreen',icon:'🎯',label:'班会大屏'},
        {id:'settings',icon:'⚙️',label:'设置'},
    ];
    document.getElementById('counselor-sidebar').innerHTML=items.map(it=>`
        <button class="counselor-sidebar-item ${it.id===cCurrentTab?'active':''} ${it.primary?'primary':''}" onclick="switchCounselorTab('${it.id}')">
            <span class="nav-icon">${it.icon}</span>${it.label}
        </button>`).join('');
}

function switchCounselorTab(tab){
    cCurrentTab=tab;renderCounselorNav();
    const area=document.getElementById('counselor-main');if(!area)return;
    area.style.opacity='0';
    setTimeout(()=>{
        if(tab==='analysis'){
            cRenderAnalysisCenter();
        }else{
            const fn={'students':cRenderStudents,'notices':cRenderNotices,'bigscreen':cRenderBigscreen,'settings':cRenderSettings}[tab];
            if(fn)fn();
        }
        area.style.opacity='1';
    },200);
}

function switchAnalysisSubTab(sub){
    cCurrentAnalysisSubTab=sub;
    cRenderAnalysisCenter();
}

function cRenderAnalysisCenter(){
    const area=document.getElementById('counselor-main');
    const subTabs=[
        {id:'overview',icon:'📊',label:'数据总览'},
        {id:'grade-compare',icon:'🏫',label:'年级对比'},
        {id:'class-analysis',icon:'📋',label:'班级分析'},
        {id:'course-analysis',icon:'📉',label:'成绩分析'},
        {id:'alerts',icon:'⚠️',label:'预警中心'},
    ];
    const subNav=subTabs.map(s=>`
        <button class="counselor-subtab ${s.id===cCurrentAnalysisSubTab?'active':''}" onclick="switchAnalysisSubTab('${s.id}')">
            ${s.icon} ${s.label}
        </button>`).join('');

    area.innerHTML=`<div class="counselor-subnav">${subNav}</div><div id="counselor-analysis-content"></div>`;

    const fn={
        'overview':cRenderOverview,'grade-compare':cRenderGradeCompare,
        'class-analysis':cRenderClassAnalysis,'course-analysis':cRenderCourseAnalysis,
        'alerts':cRenderAlerts
    }[cCurrentAnalysisSubTab];
    if(fn){
        cRenderTarget='counselor-analysis-content';
        fn();
        cRenderTarget='counselor-main';
    }
}

// ==================== FILE IMPORT ====================
async function cImportFile(which){
    eel.select_file([['Excel文件','*.xlsx']],'选择'+(which==='current'?'本学期':'上学期')+'综测文件')(async p=>{
        if(!p)return;
        let info={semester:'',grade:'',major:''};
        try{info=await eel.smart_detect_file_info(p)();}catch(e){}
        const defaultSem=info.semester||(which==='current'?'2025-2026-1':'2024-2025-2');
        const semesterLabel=prompt('学期标签（如：2025-2026-1）：',defaultSem);
        const label=semesterLabel||defaultSem;
        if(!cSemesters.includes(label)){cSemesters.push(label);localStorage.setItem('counselor_semesters',JSON.stringify(cSemesters));}
        if(which==='current'){cCurrentPath=p;localStorage.setItem('counselor_current_path',p);document.getElementById('counselor-file-current').value=p.split(/[\\/]/).pop();document.getElementById('counselor-file-current').title=p;cAllSemesters[label]=p;}
        else if(which==='previous'){cPrevPath=p;localStorage.setItem('counselor_previous_path',p);document.getElementById('counselor-file-previous').value=p.split(/[\\/]/).pop();document.getElementById('counselor-file-previous').title=p;cAllSemesters[label]=p;}
        else{cExtraSemesters[label]=p;localStorage.setItem('counselor_extra_semesters',JSON.stringify(cExtraSemesters));cAllSemesters[label]=p;}
        localStorage.setItem('counselor_all_semesters',JSON.stringify(cAllSemesters));
        updateSemesterUI();
        if(which==='current'||which==='previous')await cLoadFile(which,p);
        else await cLoadExtraSemester(label,p);
    });
}

function updateSemesterUI(){
    const indicator=document.getElementById('counselor-semester-indicator');
    if(indicator&&cSemesters.length>0){indicator.textContent='📅 '+cSemesters.join(' | ');indicator.style.display='inline';}
}

async function cLoadExtraSemester(label,fp){
    if(!fp)return;
    try{const r=await eel.load_counselor_data(fp)();if(r&&r.success&&Array.isArray(r.data)){cExtraData[label]=r.data;}}catch(e){}
}

async function cLoadFile(which,fp){
    if(!fp)return;
    const statusEl=document.getElementById('counselor-status-'+which);if(statusEl)statusEl.textContent='加载中...';
    try{const r=await eel.load_counselor_data(fp)();if(r&&r.success&&Array.isArray(r.data)){const count=r.data.length;if(which==='current'){cDataFull=r.data;cData=[...cDataFull];cCurrentPath=fp;}else{cPrevDataFull=r.data;cPrevData=[...cPrevDataFull];cPrevPath=fp;}cPopulateGradeFilter();switchCounselorTab(cCurrentTab);if(statusEl)statusEl.textContent='✅ '+count+'人';if(cData.length&&cPrevData.length)showToast('双文件就绪','success');}else{if(statusEl)statusEl.textContent='❌';showToast(r?.error||'读取失败','error');}}catch(e){if(statusEl)statusEl.textContent='❌';showToast('出错: '+e,'error');}
}

function cPopulateGradeFilter(){
    const all=[...cDataFull,...cPrevDataFull];
    // Extract grades
    const grades=[...new Set(all.map(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);return m?m[1]+'级':'';}).filter(Boolean))].sort();
    const sel=document.getElementById('counselor-grade-sel');
    if(sel&&grades.length>0){const cur=sel.value;sel.innerHTML='<option value="">全部年级</option>'+grades.map(g=>`<option value="${g}" ${g===cur?'selected':''}>${g}</option>`).join('');}

    // Extract majors from class names
    const majors=[...new Set(all.map(d=>{const cls=String(d.class||'');const m=cls.match(/^([^\d]+)/);return m?m[1]:'';}).filter(Boolean))].sort();
    const msel=document.getElementById('counselor-major-sel');
    if(msel&&majors.length>0){const cur=msel.value;msel.innerHTML='<option value="">全部专业</option>'+majors.map(m=>`<option value="${m}" ${m===cur?'selected':''}>${m}</option>`).join('');}

    // Populate classes based on current filters
    cPopulateClassFilter();
    updateSemesterUI();
}

function cPopulateClassFilter(){
    const sel=document.getElementById('counselor-class-sel');if(!sel)return;
    const grade=document.getElementById('counselor-grade-sel')?.value||'';
    const major=document.getElementById('counselor-major-sel')?.value||'';
    let src=[...cDataFull,...cPrevDataFull];
    if(grade){const t=grade.replace('级','');src=src.filter(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);return m&&m[1]===t;});}
    if(major){src=src.filter(d=>String(d.class||'').startsWith(major));}
    const classes=[...new Set(src.map(d=>d.class||'').filter(Boolean))].sort();
    const cur=sel.value;
    sel.innerHTML='<option value="">全部班级</option>'+classes.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function cOnMajorChange(){
    cPopulateClassFilter();
    cApplyFilter();
}

function cApplyFilter(){
    const grade=document.getElementById('counselor-grade-sel')?.value||'';
    const major=document.getElementById('counselor-major-sel')?.value||'';
    const cls=document.getElementById('counselor-class-sel')?.value||'';
    // Start from full data
    let d=[...cDataFull], pd=[...cPrevDataFull];
    // Apply grade filter
    if(grade){const t=grade.replace('级','');d=d.filter(x=>{const c=String(x.class||'');let m=c.match(/(\d{2})\d{1,2}$/);if(!m)m=c.match(/(\d{2})级/);return m&&m[1]===t;});pd=pd.filter(x=>{const c=String(x.class||'');let m=c.match(/(\d{2})\d{1,2}$/);if(!m)m=c.match(/(\d{2})级/);return m&&m[1]===t;});}
    // Apply major filter
    if(major){d=d.filter(x=>String(x.class||'').startsWith(major));pd=pd.filter(x=>String(x.class||'').startsWith(major));}
    // Apply class filter
    if(cls){d=d.filter(x=>x.class===cls);pd=pd.filter(x=>x.class===cls);}
    cData=d;cPrevData=pd;
    // Persist
    localStorage.setItem('counselor_filter_grade',grade);
    localStorage.setItem('counselor_filter_major',major);
    localStorage.setItem('counselor_filter_class',cls);
    // Direct re-render
    const area=document.getElementById('counselor-main');area.style.opacity='0';
    setTimeout(()=>{
        if(cCurrentTab==='analysis'){cRenderAnalysisCenter();}
        else if(cCurrentTab==='students')cRenderStudents();
        else if(cCurrentTab==='notices')cRenderNotices();
        else if(cCurrentTab==='bigscreen')cRenderBigscreen();
        else if(cCurrentTab==='settings')cRenderSettings();
        area.style.opacity='1';
    },150);
}

// Restore filter state on dashboard load
function cRestoreFilters(){
    const grade=localStorage.getItem('counselor_filter_grade')||'';
    const major=localStorage.getItem('counselor_filter_major')||'';
    const cls=localStorage.getItem('counselor_filter_class')||'';
    if(grade)try{document.getElementById('counselor-grade-sel').value=grade;}catch(e){}
    if(major)try{document.getElementById('counselor-major-sel').value=major;}catch(e){}
    if(cls)try{document.getElementById('counselor-class-sel').value=cls;}catch(e){}
}

// ==================== HELPERS ====================
function cStats(arr,key){const v=arr.map(d=>d[key]||0).filter(x=>x>0);return{avg:v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):'—',cnt:v.length};}
function cFmt(v,d=2){return(v||0).toFixed(d);}
function cGetAlertLevel(metric,value){const t=cThresholdsMulti[metric];if(!t)return'normal';if(value>=t.safe)return'safe';if(value>=t.watch)return'watch';if(value>=t.alert)return'alert';if(value>=t.danger)return'danger';return'critical';}
function cAlertLevelColor(level){const m={safe:'var(--color-success)',watch:'#fdcb6e',alert:'#e17055',danger:'#d63031',critical:'#b71c1c',normal:'var(--text-muted)'};return m[level]||m.normal;}
function cAlertLevelLabel(level){const m={safe:'🟢 安全',watch:'🟡 关注',alert:'🟠 预警',danger:'🔴 危险',critical:'⛔ 严重',normal:'—'};return m[level]||'—';}

function cFilteredStudents(){
    const sc=document.getElementById('counselor-search')?.value?.trim().toLowerCase()||'';
    const cf=document.getElementById('counselor-class-filter')?.value||'';
    let d=[...cData];if(sc)d=d.filter(x=>(x.id||'').includes(sc)||(x.name||'').toLowerCase().includes(sc));if(cf)d=d.filter(x=>x.class===cf);
    if(cSortCol){d.sort((a,b)=>{const va=a[cSortCol]||0;const vb=b[cSortCol]||0;return(va>vb?1:va<vb?-1:0)*cSortDir;});}
    return d;
}

// ==================== 1. OVERVIEW ====================
function cRenderOverview(){
    if(!cDataFull.length){document.getElementById(cRenderTarget).innerHTML=`
        <div class="empty-state"><div style="font-size:64px;">📂</div><h3>欢迎使用辅导员工作台 V8.0</h3><p style="margin-bottom:16px;">导入综测数据开始分析</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;"><button class="btn btn-teal" onclick="cImportFile('current')">📗 导入本学期</button><button class="btn btn-ghost" onclick="cImportFile('previous')">📕 导入上学期</button><button class="btn btn-ghost" onclick="cImportFile('extra')">📅 历史学期</button></div></div>`;return;}
    if(!cData.length){document.getElementById(cRenderTarget).innerHTML=`<div class="empty-state"><p style="font-size:48px;">🔍</p><p>当前筛选无结果</p><button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="document.getElementById('counselor-grade-sel').value='';cApplyFilter();">清除筛选</button></div>`;return;}

    const hasPrev=cPrevData.length>0;const cS=cStats(cData,'comp');const pS=hasPrev?cStats(cPrevData,'comp'):null;
    const diff=(parseFloat(cS.avg)||0)-(parseFloat(pS?.avg||cS.avg)||0);
    const starCount=Object.keys(cStarred).filter(k=>cData.some(d=>d.id===k)).length;
    const failCount=cData.filter(d=>(d.comp||0)<cThresholds.comp).length;
    const improved=hasPrev?cData.filter(d=>{const p=cPrevData.find(x=>x.id===d.id);return p&&(d.comp||0)>(p.comp||0);}).length:0;

    const classMap={};cData.forEach(d=>{const cls=d.class||'未知';if(!classMap[cls])classMap[cls]=[];classMap[cls].push(d);});
    const classRank=Object.entries(classMap).map(([cls,sts])=>({cls,count:sts.length,avg:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)})).sort((a,b)=>b.avg-a.avg);

    const alertCounts={safe:0,watch:0,alert:0,danger:0,critical:0};
    cData.forEach(d=>{alertCounts[cGetAlertLevel('comp',d.comp||0)]++;});

    document.getElementById(cRenderTarget).innerHTML=`
        <div class="counselor-cards">
            <div class="counselor-card accent-comp" onclick="switchCounselorTab('students')" style="cursor:pointer;"><div class="card-value">${cData.length}</div><div class="card-label">本学期人数</div></div>
            ${hasPrev?`<div class="counselor-card accent-gpa"><div class="card-value">${pS.avg}</div><div class="card-label">上学期均分</div></div>`:''}
            <div class="counselor-card accent-moral" style="${diff<0?'border-color:var(--color-error);':diff>0?'border-color:var(--color-success);':''}"><div class="card-value">${cS.avg}</div><div class="card-label">本学期均分 ${hasPrev?`<span style="color:${diff>=0?'var(--color-success)':'var(--color-error)'};">${diff>=0?'↑':'↓'}${Math.abs(diff).toFixed(2)}</span>`:''}</div></div>
            <div class="counselor-card accent-warn" style="cursor:pointer;" onclick="cCurrentAnalysisSubTab='alerts';switchCounselorTab('analysis')"><div class="card-value" style="color:var(--color-error);">${failCount}</div><div class="card-label">⚠️ 需关注</div></div>
            <div class="counselor-card" style="cursor:pointer;" onclick="cCurrentAnalysisSubTab='alerts';switchCounselorTab('analysis')"><div class="card-value" style="color:#fdcb6e;">⭐ ${starCount}</div><div class="card-label">已关注</div></div>
            ${hasPrev?`<div class="counselor-card accent-quality"><div class="card-value">${improved}</div><div class="card-label">进步人数</div></div>`:'<div class="counselor-card accent-quality" onclick="cCurrentAnalysisSubTab=\'course-analysis\';switchCounselorTab(\'analysis\')" style="cursor:pointer;"><div class="card-value">📉</div><div class="card-label">成绩分析</div></div>'}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">${[['safe','安全'],['watch','关注'],['alert','预警'],['danger','危险'],['critical','严重']].map(([lv,lb])=>`<span style="font-size:10px;padding:3px 8px;border-radius:20px;background:${cAlertLevelColor(lv)}22;color:${cAlertLevelColor(lv)};border:1px solid ${cAlertLevelColor(lv)}44;cursor:pointer;" onclick="cFilterByLevel('${lv}')">${lb}: ${alertCounts[lv]||0}</span>`).join('')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px;">
            <div class="module-section"><h3>🏫 班级排行</h3>${classRank.slice(0,8).map((c,i)=>`<div class="focus-item"><span style="font-weight:700;color:${i<3?['#fbbf24','#94a3b8','#fb923c'][i]:'var(--text-muted)'};">#${i+1}</span> <strong>${escapeHtml(c.cls)}</strong> <span style="margin-left:auto;">${c.count}人 均${c.avg}</span></div>`).join('')}</div>
            <div class="module-section"><h3>🏆 ${hasPrev?'进步榜':'优秀榜'} TOP10</h3><div id="counselor-top-gainers"></div></div>
        </div>
        ${hasPrev?`<div class="module-section" style="margin-top:12px;"><h3>📊 综测分布对比</h3><canvas id="chart-comp-dist"></canvas></div>`:`<div class="module-section" style="margin-top:12px;"><h3>📊 综测分布</h3><canvas id="chart-dist"></canvas></div>`}
        <div class="module-section" style="margin-top:12px;"><h3>⚠️ 预警名单</h3><div id="counselor-alert-list"></div></div>`;
    setTimeout(()=>{if(hasPrev)cRenderCompChart();else cRenderSingleChart();},200);
    cRenderTopGainers();cRenderAlertsList();
}

function cRenderSingleChart(){
    const ctx=document.getElementById('chart-dist')?.getContext('2d');if(!ctx||typeof Chart==='undefined')return;
    const comps=cData.map(d=>d.comp||0).filter(v=>v>0);const bins=[0,30,40,50,60,70,80,90,100];
    new Chart(ctx,{type:'bar',data:{labels:bins.slice(1).map((b,i)=>`${bins[i]}-${b}`),datasets:[{label:'本学期',data:bins.slice(1).map((b,i)=>comps.filter(v=>v>=bins[i]&&v<b).length),backgroundColor:'#6c5ce7',borderRadius:4}]},options:{responsive:true,plugins:{tooltip:{callbacks:{label:ctx=>ctx.raw+'人'}}}}});
}

function cRenderCompChart(){
    const ctx=document.getElementById('chart-comp-dist')?.getContext('2d');if(!ctx||typeof Chart==='undefined')return;
    const curr=cData.map(d=>d.comp||0).filter(v=>v>0);const prev=cPrevData.map(d=>d.comp||0).filter(v=>v>0);
    const bins=[0,30,40,50,60,70,80,90,100];
    new Chart(ctx,{type:'bar',data:{labels:bins.slice(1).map((b,i)=>`${bins[i]}-${b}`),datasets:[{label:'本学期',data:bins.slice(1).map((b,i)=>curr.filter(v=>v>=bins[i]&&v<b).length),backgroundColor:'#6c5ce7',borderRadius:4},{label:'上学期',data:bins.slice(1).map((b,i)=>prev.filter(v=>v>=bins[i]&&v<b).length),backgroundColor:'#a29bfe',borderRadius:4}]},options:{responsive:true,plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+ctx.raw+'人'}}}}});
}

function cRenderTopGainers(){
    const el=document.getElementById('counselor-top-gainers');if(!el)return;
    if(cPrevData.length){const gains=cData.map(d=>{const p=cPrevData.find(x=>x.id===d.id);return{...d,change:(d.comp||0)-(p?p.comp||0:0)};}).sort((a,b)=>b.change-a.change).slice(0,10);
        el.innerHTML=gains.map((d,i)=>`<div class="focus-item"><span style="font-weight:700;color:var(--accent-primary);">#${i+1}</span> <strong>${escapeHtml(d.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span> <span style="color:${d.change>=0?'var(--color-success)':'var(--color-error)'};margin-left:auto;font-weight:600;">${d.change>=0?'+':''}${d.change.toFixed(2)}</span></div>`).join('');}
    else{const top10=[...cData].sort((a,b)=>(b.comp||0)-(a.comp||0)).slice(0,10);el.innerHTML=top10.map((d,i)=>`<div class="focus-item"><span style="font-weight:700;color:var(--accent-primary);">#${i+1}</span> <strong>${escapeHtml(d.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span> <span style="margin-left:auto;font-weight:600;">${cFmt(d.comp)}</span></div>`).join('');}
}

function cRenderAlertsList(){
    const el=document.getElementById('counselor-alert-list');if(!el)return;
    const alerted=cData.filter(d=>(d.comp||0)<cThresholds.comp||(d.gpa||0)<cThresholds.gpa||(d.moral||0)<cThresholds.moral).slice(0,20);
    if(alerted.length===0){el.innerHTML='<p style="text-align:center;color:var(--color-success);padding:16px;">🎉 所有学生表现良好！</p>';return;}
    el.innerHTML=alerted.map((d,i)=>{let rs=[];if((d.comp||0)<cThresholds.comp)rs.push('综测'+cFmt(d.comp,1));if((d.gpa||0)<cThresholds.gpa)rs.push('绩点'+cFmt(d.gpa));if((d.moral||0)<cThresholds.moral)rs.push('德育'+cFmt(d.moral,0));const level=cGetAlertLevel('comp',d.comp||0);return`<div class="focus-item" style="cursor:pointer;" onclick="cShowStudentDetail('${escQs(d.id)}')"><span class="focus-badge" style="background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${cAlertLevelLabel(level)}</span><strong>${escapeHtml(d.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span><span style="margin-left:auto;">${rs.join('，')}</span></div>`;}).join('');
}

function cFilterByLevel(level){switchCounselorTab('students');setTimeout(()=>{cData=cDataFull.filter(d=>cGetAlertLevel('comp',d.comp||0)===level);cRenderStudents();},200);}

// ==================== 2. GRADE COMPARE ====================
function cRenderGradeCompare(){
    if(!cDataFull.length){document.getElementById(cRenderTarget).innerHTML=`<div class="empty-state"><p style="font-size:48px;">🏫</p><p>请先导入数据</p><button class="btn btn-teal" onclick="cImportFile('current')">导入本学期</button></div>`;return;}
    // Group by grade
    const gradeMap={};cDataFull.forEach(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);const g=m?m[1]+'级':'未知';if(!gradeMap[g])gradeMap[g]=[];gradeMap[g].push(d);});
    const grades=Object.entries(gradeMap).sort((a,b)=>a[0].localeCompare(b[0]));

    let rows=grades.map(([g,sts])=>{const n=sts.length;const gpa=(sts.reduce((a,b)=>a+(b.gpa||0),0)/n).toFixed(2);const moral=(sts.reduce((a,b)=>a+(b.moral||0),0)/n).toFixed(0);const comp=(sts.reduce((a,b)=>a+(b.comp||0),0)/n).toFixed(2);const fails=sts.filter(d=>(d.comp||0)<cThresholds.comp).length;return{grade:g,count:n,gpa,moral,comp,fails,failRate:(fails/n*100).toFixed(1)};});

    // Also get prev data for comparison
    let prevRows={};
    if(cPrevDataFull.length){const pm={};cPrevDataFull.forEach(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);const g=m?m[1]+'级':'未知';if(!pm[g])pm[g]=[];pm[g].push(d);});
        Object.entries(pm).forEach(([g,sts])=>{prevRows[g]={comp:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2),count:sts.length};});
    }

    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">🏫 年级对比分析</h2>
        <div class="module-section"><h3>📊 各年级指标对比</h3><canvas id="chart-grade-bar"></canvas></div>
        <div class="module-section" style="margin-top:12px;"><h3>📋 年级数据表</h3>
            <table class="data-table striped-table" style="font-size:12px;"><thead><tr><th>年级</th><th>人数</th><th>平均绩点</th><th>平均德育</th><th>平均综测</th><th>挂科人数</th><th>挂科率</th>${cPrevDataFull.length?'<th>上学期综测</th>':''}</tr></thead><tbody>
            ${rows.map(r=>`<tr style="cursor:pointer;" onclick="cGradeDrillDown('${r.grade}')"><td><strong>${r.grade}</strong></td><td>${r.count}</td><td>${r.gpa}</td><td>${r.moral}</td><td>${r.comp}</td><td style="color:${r.fails>0?'var(--color-error)':''};">${r.fails}</td><td style="color:${parseFloat(r.failRate)>20?'var(--color-error)':parseFloat(r.failRate)>10?'#fdcb6e':'var(--color-success)'};">${r.failRate}%</td>${cPrevDataFull.length?`<td>${prevRows[r.grade]?prevRows[r.grade].comp:'—'}</td>`:''}</tr>`).join('')}
            </tbody></table></div>
        ${cRenderMultiSemesterTrend()}`;
    setTimeout(()=>{
        cRenderMultiTrendChart();
        const ctx=document.getElementById('chart-grade-bar')?.getContext('2d');if(!ctx||typeof Chart==='undefined')return;
        new Chart(ctx,{type:'bar',data:{labels:rows.map(r=>r.grade),datasets:[{label:'平均绩点',data:rows.map(r=>parseFloat(r.gpa)),backgroundColor:'#6c5ce7',borderRadius:4},{label:'平均综测',data:rows.map(r=>parseFloat(r.comp)),backgroundColor:'#00cec9',borderRadius:4}]},options:{responsive:true,plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+ctx.raw}}}}});
    },200);
}

function cGradeDrillDown(grade){
    switchCounselorTab('analysis');
    cCurrentAnalysisSubTab='class-analysis';
    setTimeout(()=>{document.getElementById('counselor-grade-sel')&&(document.getElementById('counselor-grade-sel').value=grade);cApplyFilter();},300);
}

// ==================== 3. CLASS ANALYSIS ====================
function cRenderClassAnalysis(){
    if(!cData.length){document.getElementById(cRenderTarget).innerHTML=`<div class="empty-state"><p style="font-size:48px;">📋</p><p>请先导入数据</p></div>`;return;}
    const classMap={};cData.forEach(d=>{const cls=d.class||'未知';if(!classMap[cls])classMap[cls]=[];classMap[cls].push(d);});
    const classes=Object.entries(classMap).map(([cls,sts])=>{const n=sts.length;const gpa=(sts.reduce((a,b)=>a+(b.gpa||0),0)/n).toFixed(2);const moral=(sts.reduce((a,b)=>a+(b.moral||0),0)/n).toFixed(0);const comp=(sts.reduce((a,b)=>a+(b.comp||0),0)/n).toFixed(2);const fails=sts.filter(d=>(d.comp||0)<cThresholds.comp).length;return{cls,count:n,gpa,moral,comp,fails,failRate:(fails/n*100).toFixed(1),students:sts};}).sort((a,b)=>b.comp-a.comp);

    // Prev comparison
    let prevMap={};
    if(cPrevData.length){cPrevData.forEach(d=>{const cls=d.class||'';if(!prevMap[cls])prevMap[cls]=[];prevMap[cls].push(d);});}

    // Get unique majors for filter
    const majors=[...new Set(classes.map(c=>{const m=String(c.cls).match(/^([^\d]+)/);return m?m[1]:'';}).filter(Boolean))].sort();

    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">📋 班级分析</h2>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:11px;color:var(--text-muted);">专业筛选:</span>
            <select id="ca-major-filter" class="select-input" style="width:120px;" onchange="cRenderClassAnalysis()"><option value="">全部专业</option>${majors.map(m=>`<option value="${m}">${m}</option>`).join('')}</select>
        </div>
        <div class="module-section"><h3>📊 班级综测排行</h3><canvas id="chart-class-bar"></canvas></div>
        <div class="module-section" style="margin-top:12px;"><h3>📋 班级详情</h3>
            <table class="data-table striped-table" style="font-size:12px;"><thead><tr><th>#</th><th>班级</th><th>人数</th><th>平均绩点</th><th>平均德育</th><th>平均综测</th><th>挂科人数</th><th>挂科率</th>${cPrevData.length?'<th>上学期</th><th>变化</th>':''}<th>操作</th></tr></thead><tbody>
            ${classes.filter(c=>{const mf=document.getElementById('ca-major-filter')?.value;return !mf||c.cls.startsWith(mf);}).map((c,i)=>{
                const prev=prevMap[c.cls]||[];const prevComp=prev.length?(prev.reduce((a,b)=>a+(b.comp||0),0)/prev.length).toFixed(2):'—';
                const ch=prev.length?(parseFloat(c.comp)-parseFloat(prevComp)).toFixed(2):'—';
                return`<tr><td>${i+1}</td><td><strong>${escapeHtml(c.cls)}</strong></td><td>${c.count}</td><td>${c.gpa}</td><td>${c.moral}</td><td style="font-weight:600;">${c.comp}</td><td style="color:${c.fails>0?'var(--color-error)':''};">${c.fails}</td><td style="color:${parseFloat(c.failRate)>20?'var(--color-error)':parseFloat(c.failRate)>10?'#fdcb6e':'var(--color-success)'};">${c.failRate}%</td>${cPrevData.length?`<td>${prevComp}</td><td style="color:${parseFloat(ch)>0?'var(--color-success)':parseFloat(ch)<0?'var(--color-error)':'var(--text-muted)'};">${parseFloat(ch)>0?'+':''}${ch}</td>`:''}<td><button class="btn btn-ghost btn-sm" onclick="cShowClassDetail('${escQs(c.cls)}')">详情</button></td></tr>`;}).join('')}
            </tbody></table></div>`;
    setTimeout(()=>{
        const ctx=document.getElementById('chart-class-bar')?.getContext('2d');if(!ctx||typeof Chart==='undefined')return;
        const filtered=classes.filter(c=>{const mf=document.getElementById('ca-major-filter')?.value;return !mf||c.cls.startsWith(mf);}).slice(0,15);
        new Chart(ctx,{type:'bar',data:{labels:filtered.map(c=>c.cls),datasets:[{label:'平均综测',data:filtered.map(c=>parseFloat(c.comp)),backgroundColor:filtered.map((_,i)=>i<3?'#fbbf24':i<5?'#94a3b8':'#6c5ce7'),borderRadius:4}]},options:{responsive:true,indexAxis:'y',plugins:{tooltip:{callbacks:{label:ctx=>'综测: '+ctx.raw}}}}});
    },200);
}

function cShowClassDetail(cls){
    const sts=cData.filter(d=>d.class===cls).sort((a,b)=>(b.comp||0)-(a.comp||0));
    const n=sts.length;const avg=sts.length?(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2):'—';
    const fails=sts.filter(d=>(d.comp||0)<60).length;
    if(typeof showModal!=='function')return;
    showModal(`📋 ${escapeHtml(cls)} — 班级详情`,
        `<div style="font-size:12px;line-height:2;">
            <p>人数: <strong>${n}</strong> | 平均综测: <strong>${avg}</strong> | 挂科: <strong style="color:${fails>0?'var(--color-error)':''};">${fails}</strong></p>
            <table class="data-table striped-table" style="font-size:11px;margin-top:8px;"><thead><tr><th>#</th><th>学号</th><th>姓名</th><th>绩点</th><th>德育</th><th>综测</th><th>状态</th></tr></thead><tbody>
            ${sts.map((d,i)=>{const level=cGetAlertLevel('comp',d.comp||0);return`<tr><td>${i+1}</td><td>${d.id}</td><td style="cursor:pointer;color:var(--accent-primary);" onclick="closeModal();cShowStudentDetail('${escQs(d.id)}')">${escapeHtml(d.name||'')}</td><td>${cFmt(d.gpa)}</td><td>${cFmt(d.moral,0)}</td><td>${cFmt(d.comp)}</td><td><span style="font-size:9px;padding:2px 6px;border-radius:10px;background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${cAlertLevelLabel(level)}</span></td></tr>`;}).join('')}
            </tbody></table>
            <button class="btn btn-teal btn-sm" style="margin-top:8px;" onclick="cExportClassDetail('${escQs(cls)}')">📥 导出班级数据</button>
        </div>`,`<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
}

async function cExportClassDetail(cls){
    const sts=cData.filter(d=>d.class===cls).sort((a,b)=>(b.comp||0)-(a.comp||0));
    const hd=['学号','姓名','班级','绩点','德育','素拓','综测'];
    const rows=sts.map(d=>[d.id||'',d.name||'',d.class||'',d.gpa||0,d.moral||0,d.quality||0,d.comp||0]);
    try{const r=await eel.export_preview_data(hd,rows,`班级详情_${cls}_${new Date().toISOString().slice(0,10)}.xlsx`)();if(r&&r.success){showToast('已导出','success');eel.open_file_explorer(r.output)();}}catch(e){showToast('导出失败','error');}
}

// ==================== 4. STUDENTS ====================
function cSortStudents(k){cSortCol===k?cSortDir=-cSortDir:(cSortCol=k,cSortDir=1);cRenderStudents();}
function cSortHdr(l,k){return`<span style="cursor:pointer;user-select:none;" onclick="cSortStudents('${k}')">${l}${cSortCol===k?(cSortDir>0?' ▴':' ▾'):''}</span>`;}

function cRenderStudents(){
    if(!cData.length){document.getElementById(cRenderTarget).innerHTML=`<div class="empty-state"><div style="font-size:64px;">👤</div><h3>暂无学生数据</h3><p style="margin-bottom:16px;">请先导入本学期综测文件</p><button class="btn btn-teal" onclick="cImportFile('current')">📗 导入</button></div>`;return;}
    const sc=document.getElementById('counselor-search')?.value?.trim().toLowerCase()||'';const cf=document.getElementById('counselor-class-filter')?.value||'';
    let data=cFilteredStudents();
    const classes=[...new Set(cData.map(d=>d.class||''))].sort();const showQuality=document.getElementById('counselor-show-quality')?.checked||false;

    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:12px;">👤 学生管理</h2>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
            <input id="counselor-search" class="input" style="width:200px;" placeholder="搜索学号/姓名..." oninput="cRenderStudents()" value="${escapeHtml(sc)}">
            ${cSearchHistory.length>0?`<div style="display:flex;gap:4px;font-size:10px;">${cSearchHistory.slice(0,5).map(s=>`<span class="grade-filter-chip" onclick="document.getElementById('counselor-search').value='${escJs(s)}';cRenderStudents();">${escapeHtml(s)}</span>`).join('')}</div>`:''}
            <select id="counselor-class-filter" class="select-input" style="width:130px;" onchange="cRenderStudents()"><option value="">全部班级</option>${classes.map(c=>`<option value="${escapeHtml(c)}" ${c===cf?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
            <select id="counselor-alert-filter" class="select-input" style="width:110px;" onchange="cFilterByAlertLevel()"><option value="">全部等级</option><option value="safe">🟢安全</option><option value="watch">🟡关注</option><option value="alert">🟠预警</option><option value="danger">🔴危险</option><option value="critical">⛔严重</option></select>
            <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="counselor-show-quality" onchange="cRenderStudents()" ${showQuality?'checked':''}> 素拓</label>
            <button class="btn btn-teal btn-sm" onclick="cExportView()">📥 导出</button>
            <button class="btn btn-ghost btn-sm" onclick="cBulkStar()">⭐ 批量关注</button>
            <button class="btn btn-ghost btn-sm" onclick="cBulkNotice()">📧 批量通知</button>
            <button class="btn btn-ghost btn-sm" onclick="cShowCompare()" ${cCompareList.length<2?'disabled':''}>🔄 对比(${cCompareList.length})</button>
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${cData.length}人 | 筛选${data.length}人</span></div>
        <div id="counselor-student-presets" style="margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap;"></div>
        <div style="overflow-x:auto;"><table class="data-table striped-table" style="font-size:11px;"><thead><tr>
            <th>☐</th><th>⭐</th><th>${cSortHdr('学号','id')}</th><th>${cSortHdr('姓名','name')}</th><th>${cSortHdr('班级','class')}</th><th>${cSortHdr('绩点','gpa')}</th><th>${cSortHdr('德育','moral')}</th>${showQuality?`<th>${cSortHdr('素拓','quality')}</th>`:''}<th>${cSortHdr('综测','comp')}</th>${cPrevData.length?'<th>上学期</th><th>变化</th>':''}<th>状态</th><th>操作</th>
        </tr></thead><tbody>${data.map(d=>{const p=cPrevData.length?cPrevData.find(x=>x.id===d.id):null;const ch=p?(d.comp||0)-(p.comp||0):0;const tags=Object.entries(cTags).filter(([k])=>k===d.id).map(([,v])=>v).join(' ');const level=cGetAlertLevel('comp',d.comp||0);const convoCount=(cConversations[d.id]||[]).length;
            return`<tr class="${(d.comp||0)<60?'row-danger':(d.comp||0)>85?'row-excellent':''}">
            <td onclick="cToggleCompare('${escQs(d.id)}')" style="cursor:pointer;">${cCompareList.includes(d.id)?'☑':'☐'}</td>
            <td onclick="cToggleStar('${escQs(d.id)}')" style="cursor:pointer;">${cStarred[d.id]?'⭐':'☆'}</td>
            <td>${escapeHtml(d.id||'')}</td><td style="cursor:pointer;color:var(--accent-primary);text-decoration:underline;" onclick="cShowStudentDetail('${escQs(d.id)}')">${escapeHtml(d.name||'')}${tags?` <span style="font-size:9px;color:var(--accent-secondary);">${escapeHtml(tags)}</span>`:''}${convoCount?` <span style="font-size:9px;">💬${convoCount}</span>`:''}</td>
            <td>${escapeHtml(d.class||'')}</td><td>${cFmt(d.gpa)}</td><td>${cFmt(d.moral,0)}</td>${showQuality?`<td>${cFmt(d.quality,1)}</td>`:''}<td style="font-weight:600;color:${cAlertLevelColor(level)};">${cFmt(d.comp)}</td>
            ${cPrevData.length?`<td>${p?cFmt(p.comp):'—'}</td><td style="color:${ch>0?'var(--color-success)':ch<0?'var(--color-error)':'var(--text-muted)'};">${ch>0?'+':''}${cFmt(ch)}</td>`:''}
            <td><span style="font-size:9px;padding:2px 6px;border-radius:10px;background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${cAlertLevelLabel(level)}</span></td>
            <td><button class="btn btn-ghost btn-sm" onclick="cShowStudentDetail('${escQs(d.id)}')">详情</button></td></tr>`;}).join('')}</tbody></table></div>`;
    cRenderPresets();
}

function cFilterByAlertLevel(){const lv=document.getElementById('counselor-alert-filter')?.value;if(!lv){cData=[...cDataFull];}else{cData=cDataFull.filter(d=>cGetAlertLevel('comp',d.comp||0)===lv);}cRenderStudents();}

function cToggleStar(sid){cStarred[sid]=!cStarred[sid];localStorage.setItem('counselor_starred',JSON.stringify(cStarred));cRenderStudents();}
function cBulkStar(){const d=cFilteredStudents();d.forEach(x=>cStarred[x.id]=true);localStorage.setItem('counselor_starred',JSON.stringify(cStarred));cRenderStudents();showToast(`已关注${d.length}人`,'success');}

async function cBulkNotice(){
    const d=cFilteredStudents();if(!d.length){showToast('没有匹配的学生','warning');return;}
    // Build class averages
    const classAvgs={};const cm={};cData.forEach(x=>{const cls=x.class||'';if(!cm[cls])cm[cls]=[];cm[cls].push(x);});
    for(const[cls,sts]of Object.entries(cm)){classAvgs[cls]={gpa:(sts.reduce((a,b)=>a+(b.gpa||0),0)/sts.length).toFixed(2),moral:(sts.reduce((a,b)=>a+(b.moral||0),0)/sts.length).toFixed(0),comp:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)};}
    try{
        const notices=await eel.batch_generate_notices(d.map(x=>({id:x.id,name:x.name,class:x.class,gpa:x.gpa||0,moral:x.moral||0,quality:x.quality||0,comp:x.comp||0,rank:'—',failed_courses:'无'})),cSemesters[cSemesters.length-1]||'本学期',classAvgs)();
        if(notices&&notices.length){let all=notices.map(n=>`${'='.repeat(40)}\n学生：${n.name} (${n.id})\n${'='.repeat(40)}\n${n.notice}\n\n`).join('');const blob=new Blob([all],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`家长通知_${new Date().toISOString().slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url);showToast(`已生成${notices.length}份通知`,'success');}
    }catch(e){showToast('生成失败: '+e,'error');}
}

async function cExportView(){
    // Use cData (respects global filters) - works from any page
    const hd=['学号','姓名','班级','绩点','德育','素拓','综测'];
    if(cPrevData.length){hd.push('上学期');hd.push('变化');}
    const rows=cData.map(x=>{const p=cPrevData.length?cPrevData.find(p=>p.id===x.id):null;const r=[x.id||'',x.name||'',x.class||'',x.gpa||0,x.moral||0,x.quality||0,x.comp||0];if(cPrevData.length){r.push(p?p.comp||0:0);r.push((x.comp||0)-(p?p.comp||0:0));}return r;});
    try{const ts=new Date().toISOString().slice(0,10);const r2=await eel.export_preview_data(hd,rows,`学生列表_${ts}.xlsx`)();if(r2&&r2.success){showToast(`已导出${rows.length}条`,'success');eel.open_file_explorer(r2.output)();}}catch(e){showToast('导出失败','error');}
}

async function cExportAllCurrent(){
    if(!cData.length){showToast('无数据可导出','warning');return;}
    await cExportView();
}
async function cExportCompareReport(){
    if(!cPrevData.length){showToast('请先导入上学期文件','warning');return;}
    const hd=['学号','姓名','班级','上学期综测','本学期综测','变化','上学期德育','本学期德育','本学期绩点'];
    const rows=cDataFull.map(d=>{const p=cPrevDataFull.find(x=>x.id===d.id);return[d.id||'',d.name||'',d.class||'',p?cFmt(p.comp):'—',cFmt(d.comp),p?cFmt((d.comp||0)-(p.comp||0)):'—',p?cFmt(p.moral,0):'—',cFmt(d.moral,0),cFmt(d.gpa)];});
    try{const ts=new Date().toISOString().slice(0,10);const r=await eel.export_preview_data(hd,rows,`学期对比报告_${ts}.xlsx`)();if(r&&r.success){showToast(`已导出${rows.length}条`,'success');eel.open_file_explorer(r.output)();}else{showToast('导出失败: '+(r?.error||'未知'),'error');}}catch(e){showToast('导出出错: '+e,'error');}
}

function cRenderPresets(){const el=document.getElementById('counselor-student-presets');if(!el)return;el.innerHTML=cPresets.map((p,i)=>`<span class="grade-filter-chip" onclick="cApplyPreset(${i})" title="${escapeHtml(p.label)}">${escapeHtml(p.label)}</span>`).join('')+`<span class="grade-filter-chip" style="cursor:pointer;border-style:dashed;" onclick="cSavePreset()">+ 保存</span>`;}
function cSavePreset(){const sc=document.getElementById('counselor-search')?.value?.trim()||'';const cf=document.getElementById('counselor-class-filter')?.value||'';const label=prompt('预设名称：',cf||'全部');if(!label)return;cPresets.push({label,search:sc,classFilter:cf});localStorage.setItem('counselor_presets',JSON.stringify(cPresets));cRenderStudents();}
function cApplyPreset(i){const p=cPresets[i];if(!p)return;document.getElementById('counselor-search').value=p.search||'';document.getElementById('counselor-class-filter').value=p.classFilter||'';cRenderStudents();}

// ==================== 5. COURSE ANALYSIS ====================
function cRenderCourseAnalysis(){
    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">📉 成绩分析</h2>
        <div class="module-section" style="border:2px dashed var(--accent-primary);background:var(--accent-primary-muted);">
            <h3>📂 导入原始成绩单</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">请导入Module A的<strong>原始成绩文件</strong>（包含每个学生各科成绩的 .xlsx 文件），而非综测汇总表。</p>
            <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
                <input id="ca-file" class="file-path" readonly placeholder="选择原始成绩文件(.xlsx)..." style="flex:1;min-width:250px;" value="${cGradeFilePath.split(/[\\/]/).pop()||''}">
                <button class="btn btn-teal" onclick="cPickCourseFile()">📂 选择文件</button>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:4px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:11px;color:var(--text-muted);">年级筛选:</span>
                <input id="ca-grade-filter" class="input" style="width:70px;font-size:12px;" placeholder="如24" value="${document.getElementById('counselor-grade-sel')?.value?.replace('级','')||''}">
                <span style="font-size:11px;color:var(--text-muted);">专业筛选:</span>
                <input id="ca-major-filter-input" class="input" style="width:110px;font-size:12px;" placeholder="如顿河交">
                <button class="btn btn-primary btn-sm" onclick="cRunCourseAnalysis()">🔍 开始分析</button>
                <span id="ca-status" style="font-size:11px;color:var(--text-muted);"></span>
            </div>
            <p style="font-size:9px;color:var(--text-muted);margin-top:4px;">💡 提示：选择原始成绩文件（如"专业成绩表-XX级.xls"），留空年级/专业则分析全部数据</p>
        </div>
        <div id="ca-loading" style="text-align:center;padding:40px;display:none;"><div style="font-size:32px;animation:pulse 1.5s infinite;">⏳</div><p style="color:var(--text-muted);">正在分析成绩数据...</p></div>
        <div id="ca-result"></div>`;
    if(cGradeFilePath){
        document.getElementById('ca-file').title=cGradeFilePath;
        document.getElementById('ca-status').textContent='已选择文件，点击"开始分析"';
    }
}

async function cPickCourseFile(){
    eel.select_file([['Excel文件','*.xls *.xlsx']],'选择原始成绩文件')(async p=>{
        if(!p)return;
        cGradeFilePath=p;localStorage.setItem('counselor_grade_file',p);
        document.getElementById('ca-file').value=p.split(/[\\/]/).pop();document.getElementById('ca-file').title=p;
        try{const info=await eel.smart_detect_file_info(p)();if(info.grade)document.getElementById('ca-grade-filter').value=info.grade;if(info.major)document.getElementById('ca-major-filter-input').value=info.major;document.getElementById('ca-status').textContent='检测: '+(info.semester||'')+(info.grade?' | '+info.grade+'级':'')+(info.major?' | '+info.major:'');}catch(e){}
    });
}

async function cRunCourseAnalysis(){
    const fp=document.getElementById('ca-file')?.value?.trim();const ftitle=document.getElementById('ca-file')?.title;
    const filePath=ftitle||(cGradeFilePath||fp);
    if(!filePath||(!fp&&!cGradeFilePath)){showToast('请先选择原始成绩文件','warning');return;}
    const grade=document.getElementById('ca-grade-filter')?.value?.trim()||'';
    const major=document.getElementById('ca-major-filter-input')?.value?.trim()||'';
    document.getElementById('ca-loading').style.display='block';
    document.getElementById('ca-result').innerHTML='';
    try{
        const r=await eel.analyze_semester_courses_api(filePath,grade,major)();
        cCourseAnalysis=r;cCourseStudentMap=r.student_course_map||{};document.getElementById('ca-loading').style.display='none';
        if(!r||!r.success){document.getElementById('ca-result').innerHTML=`<div class="module-section" style="border-left:3px solid var(--color-error);"><p style="color:var(--color-error);">${r?.error||'分析失败'}</p>${r?.traceback?`<pre style="font-size:9px;margin-top:8px;">${escapeHtml(r.traceback)}</pre>`:''}</div>`;return;}
        const s=r.summary;const ca=r.class_analysis;const cfr=r.course_fail_ranking;const fs=r.failing_students;
        document.getElementById('ca-result').innerHTML=`
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:12px;">
                <div class="counselor-card"><div class="card-value" style="color:#6c5ce7;">${s.total_students}</div><div class="card-label">学生总数</div></div>
                <div class="counselor-card"><div class="card-value" style="color:#00cec9;">${s.total_courses}</div><div class="card-label">课程数</div></div>
                <div class="counselor-card"><div class="card-value" style="color:#fdcb6e;">${s.overall_avg}</div><div class="card-label">平均分</div></div>
                <div class="counselor-card accent-warn"><div class="card-value" style="color:${s.overall_fail_rate>20?'#d63031':'#e17055'};">${s.overall_fail_rate}%</div><div class="card-label">学生挂科率</div></div>
                <div class="counselor-card"><div class="card-value" style="color:${s.course_level_fail_rate>15?'#d63031':'#e17055'};">${s.course_level_fail_rate}%</div><div class="card-label">课程次挂科率</div></div>
                <div class="counselor-card"><div class="card-value" style="color:#d63031;">${s.failing_students_count}</div><div class="card-label">挂科人数</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
                <div class="module-section"><h3>📊 成绩分布</h3><canvas id="chart-score-dist"></canvas></div>
                <div class="module-section"><h3>📋 班级对比</h3>
                    <table class="data-table striped-table" style="font-size:11px;"><thead><tr><th>#</th><th>班级</th><th>人数</th><th>均分</th><th>挂科率</th></tr></thead><tbody>
                    ${ca.map(c=>`<tr style="cursor:pointer;" onclick="cShowClassDetail('${escQs(c.class_name)}')"><td>${c.rank}</td><td>${escapeHtml(c.class_name)}</td><td>${c.students}</td><td>${c.avg_score}</td><td style="color:${c.fail_rate>20?'var(--color-error)':c.fail_rate>10?'#fdcb6e':'var(--color-success)'};">${c.fail_rate}%</td></tr>`).join('')}
                    </tbody></table></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
                <div class="module-section"><h3>⚠️ 课程挂科率排名</h3>
                    <table class="data-table striped-table" style="font-size:10px;"><thead><tr><th>#</th><th>课程</th><th>挂科率</th><th>挂科/总人数</th><th>均分</th></tr></thead><tbody>
                    ${cfr.slice(0,15).map((c,i)=>`<tr style="${c.fail_rate>30?'background:rgba(225,112,85,0.08)':''}"><td>${i+1}</td><td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.course_name)}">${escapeHtml(c.course_name)}</td><td style="font-weight:600;color:${c.fail_rate>30?'var(--color-error)':c.fail_rate>15?'#fdcb6e':'var(--color-success)'};">${c.fail_rate}%</td><td>${c.fail_count}/${c.total_students}</td><td>${c.avg_score}</td></tr>`).join('')}
                    </tbody></table></div>
                <div class="module-section"><h3>🚨 挂科学生 (${fs.length}人)</h3>
                    ${fs.length===0?'<p style="text-align:center;color:var(--color-success);padding:20px;">🎉 无挂科学生！</p>':
                    `<div style="max-height:300px;overflow-y:auto;">${fs.slice(0,30).map((s,i)=>`<div class="focus-item"><span class="focus-badge danger">${i+1}</span><strong>${escapeHtml(s.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(s.class||'')}</span><span style="margin-left:auto;font-size:10px;color:var(--color-error);">挂${s.fail_count}门: ${s.failed_courses.slice(0,3).map(c=>escapeHtml(c)).join('、')}${s.failed_courses.length>3?'...':''}</span></div>`).join('')}</div>`}
                </div>
            </div>
            ${cRenderHeatmap()}`;
        setTimeout(()=>{
            const ctx=document.getElementById('chart-score-dist')?.getContext('2d');
            if(ctx&&typeof Chart!=='undefined'&&r.score_distribution){
                new Chart(ctx,{type:'bar',data:{labels:r.score_distribution.labels,datasets:[{label:'人次',data:r.score_distribution.counts,backgroundColor:['#d63031','#e17055','#fdcb6e','#00cec9','#6c5ce7','#a29bfe','#00b894','#0984e3'],borderRadius:4}]},options:{responsive:true,plugins:{tooltip:{callbacks:{label:ctx=>ctx.raw+'人次'}}}}});
            }
        },200);
    }catch(e){document.getElementById('ca-loading').style.display='none';showToast('分析出错: '+e,'error');}
}

// ==================== 6. ALERTS ====================
function cRenderAlerts(){
    if(!cData.length){document.getElementById(cRenderTarget).innerHTML=`<div class="empty-state"><div style="font-size:64px;">⚠️</div><h3>暂无数据</h3><button class="btn btn-teal" onclick="cImportFile('current')">导入数据</button></div>`;return;}
    const starData=cData.filter(d=>cStarred[d.id]);
    const levelCounts={safe:0,watch:0,alert:0,danger:0,critical:0};
    cData.forEach(d=>{levelCounts[cGetAlertLevel('comp',d.comp||0)]++;});
    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">⚠️ 预警中心</h2>
        <div class="module-section"><h3>⚙️ 多级阈值</h3>
            ${['gpa','moral','comp'].map(m=>`<div style="margin-bottom:10px;"><strong style="font-size:12px;">${{gpa:'绩点',moral:'德育',comp:'综测'}[m]}</strong><div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">${['safe','watch','alert','danger'].map(lv=>`<span style="font-size:9px;color:${cAlertLevelColor(lv)};">${{safe:'安全≥',watch:'关注≥',alert:'预警≥',danger:'危险≥'}[lv]}</span><input id="alert-${m}-${lv}" class="input" type="number" style="width:60px;" value="${cThresholdsMulti[m][lv]}" step="${m==='gpa'?'0.1':'1'}">`).join('')}</div></div>`).join('')}
            <button class="btn btn-primary btn-sm" onclick="cSaveThresholdsMulti()">💾 保存</button></div>
        <div class="module-section"><h3>📊 预警分布</h3>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">${[['safe','安全','var(--color-success)'],['watch','关注','#fdcb6e'],['alert','预警','#e17055'],['danger','危险','#d63031'],['critical','严重','#b71c1c']].map(([lv,lb,cl])=>`<div style="text-align:center;padding:12px 14px;background:${cl}15;border-radius:var(--radius-md);border:1px solid ${cl}33;min-width:70px;cursor:pointer;" onclick="cFilterByLevel('${lv}')"><div style="font-size:22px;font-weight:700;color:${cl};">${levelCounts[lv]||0}</div><div style="font-size:10px;color:${cl};">${lb}</div></div>`).join('')}</div></div>
        <div class="module-section"><h3>⚠️ 预警详情</h3><div id="counselor-alert-full">${cRenderAlertFull()}</div></div>
        <div class="module-section"><h3>⭐ 关注列表 (${starData.length}人)</h3>
            ${starData.length===0?'<p style="color:var(--text-muted);">暂无，可在学生管理中点击⭐添加</p>':starData.map(d=>{const p=cPrevData.length?cPrevData.find(x=>x.id===d.id):null;const ch=p?(d.comp||0)-(p.comp||0):0;const level=cGetAlertLevel('comp',d.comp||0);return`<div class="focus-item"><span>⭐</span><strong>${escapeHtml(d.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span><span style="margin-left:8px;font-size:9px;padding:2px 6px;border-radius:10px;background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${cAlertLevelLabel(level)}</span><span style="margin-left:auto;">${cFmt(d.comp)}${p?' <span style="color:'+(ch>=0?'var(--color-success)':'var(--color-error)')+';">'+(ch>=0?'+':'')+cFmt(ch)+'</span>':''}</span><button class="btn btn-ghost btn-sm" onclick="cToggleStar('${escQs(d.id)}');cRenderAlerts();">取消</button></div>`;}).join('')}</div>
        <div class="module-section"><h3>🏷️ 标签管理</h3><div style="display:flex;gap:8px;margin-bottom:8px;"><input id="tag-sid" class="input" style="width:150px;" placeholder="学号"><input id="tag-name" class="input" style="width:110px;" placeholder="标签名"><button class="btn btn-teal btn-sm" onclick="cAddTag()">添加</button></div><div id="counselor-tag-list"></div></div>`;
    cRenderTagList();
}

function cRenderAlertFull(){const alerted=cData.filter(d=>(d.comp||0)<cThresholds.comp||(d.gpa||0)<cThresholds.gpa||(d.moral||0)<cThresholds.moral);if(alerted.length===0)return'<div style="text-align:center;padding:20px;"><p style="font-size:48px;">🎉</p><p style="color:var(--color-success);">全部学生在安全线以上！</p></div>';return alerted.map((d,i)=>{let rs=[];if((d.comp||0)<cThresholds.comp)rs.push('综测');if((d.gpa||0)<cThresholds.gpa)rs.push('绩点');if((d.moral||0)<cThresholds.moral)rs.push('德育');const level=cGetAlertLevel('comp',d.comp||0);return`<div class="focus-item" style="cursor:pointer;" onclick="cShowStudentDetail('${escQs(d.id)}')"><span class="focus-badge" style="background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${i+1}</span><strong>${escapeHtml(d.name||'')}</strong> <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span><span style="margin-left:auto;">${rs.join('、')}偏低 | 综测${cFmt(d.comp,1)}</span></div>`;}).join('');}

function cSaveThresholdsMulti(){['gpa','moral','comp'].forEach(m=>{['safe','watch','alert','danger'].forEach(lv=>{const el=document.getElementById(`alert-${m}-${lv}`);if(el)cThresholdsMulti[m][lv]=parseFloat(el.value)||cThresholdsMulti[m][lv];});});cThresholds.gpa=cThresholdsMulti.gpa.alert;cThresholds.moral=cThresholdsMulti.moral.alert;cThresholds.comp=cThresholdsMulti.comp.alert;localStorage.setItem('counselor_thresholds_multi',JSON.stringify(cThresholdsMulti));localStorage.setItem('counselor_thresholds',JSON.stringify(cThresholds));showToast('已保存','success');}
function cAddTag(){const sid=document.getElementById('tag-sid')?.value?.trim();const tag=document.getElementById('tag-name')?.value?.trim();if(!sid||!tag){showToast('请输入学号和标签','warning');return;}if(!cTags[sid])cTags[sid]=[];if(!cTags[sid].includes(tag))cTags[sid].push(tag);localStorage.setItem('counselor_tags',JSON.stringify(cTags));cRenderTagList();cRenderStudents();showToast('标签已添加','success');}
function cRemoveTag(sid,tag){if(cTags[sid]){cTags[sid]=cTags[sid].filter(t=>t!==tag);if(!cTags[sid].length)delete cTags[sid];}localStorage.setItem('counselor_tags',JSON.stringify(cTags));cRenderTagList();cRenderStudents();}
function cRenderTagList(){const el=document.getElementById('counselor-tag-list');if(!el)return;const entries=Object.entries(cTags);el.innerHTML=entries.length===0?'<p style="color:var(--text-muted);font-size:11px;">暂无标签</p>':entries.map(([sid,tags])=>{const d=cData.find(x=>x.id===sid);return`<div class="focus-item"><strong>${escapeHtml(d?d.name:sid)}</strong> (${escapeHtml(sid)}) ${tags.map(t=>`<span class="grade-filter-chip active" style="font-size:9px;">${escapeHtml(t)} <span onclick="cRemoveTag('${escQs(sid)}','${escQs(t)}')" style="cursor:pointer;">&times;</span></span>`).join(' ')}</div>`;}).join('');}

// ==================== 7. NOTICES ====================
let cNoticeOptions=JSON.parse(localStorage.getItem('counselor_notice_options')||'{"includeBasic":true,"includeGpa":true,"includeMoral":true,"includeQuality":true,"includeComp":true,"includeRank":true,"includeFailed":true,"includeCompare":true,"includeTrend":true,"includeComment":false,"commentText":""}');

function cSaveNoticeOptions(){localStorage.setItem('counselor_notice_options',JSON.stringify(cNoticeOptions));}

async function cPickNoticeGradeFile(){
    eel.select_file([['Excel文件','*.xls *.xlsx']],'选择学分绩点原始文件')(async p=>{
        if(!p)return;
        cGradeFilePath=p;localStorage.setItem('counselor_grade_file',p);
        document.getElementById('notice-grade-file').value=p.split(/[\\/]/).pop();
        document.getElementById('notice-grade-file').title=p;
        document.getElementById('notice-grade-status').textContent='已选择，可点击分析';
    });
}

async function cAnalyzeNoticeGrade(){
    if(!cGradeFilePath){showToast('请先选择学分绩点文件','warning');return;}
    const st=document.getElementById('notice-grade-status');
    st.textContent='分析中...';
    try{
        const r=await eel.analyze_semester_courses_api(cGradeFilePath,'','')();
        cCourseAnalysis=r;cCourseStudentMap=r.student_course_map||{};
        if(r&&r.success){
            st.innerHTML=`<span style="color:var(--color-success);">✅ ${r.summary.total_students}人 ${r.summary.total_courses}门课 挂科率${r.summary.overall_fail_rate}%</span>`;
            showToast('成绩分析完成','success');
        }else{
            st.innerHTML=`<span style="color:var(--color-error);">❌ ${r?.error||'失败'}</span>`;
        }
    }catch(e){
        st.innerHTML=`<span style="color:var(--color-error);">❌ ${e}</span>`;
    }
}

function cRenderNotices(){
    const curFile=cCurrentPath?cCurrentPath.split(/[\\/]/).pop():'';
    const prevFile=cPrevPath?cPrevPath.split(/[\\/]/).pop():'';
    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">📧 通知工具</h2>
        <div class="module-section" style="border:2px dashed var(--accent-primary);background:var(--accent-primary-muted);">
            <h3>📂 数据导入</h3>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">导入综测数据文件，支持本学期、上学期及历史学期</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:11px;color:var(--text-muted);">📗 本学期:</span>
                <input id="counselor-file-current" class="file-path" readonly style="width:130px;font-size:10px;" placeholder="本学期文件..." value="${escapeHtml(curFile)}">
                <button class="btn btn-teal btn-sm" style="padding:4px 8px;font-size:10px;" onclick="cImportFile('current')">选择</button>
                <span style="font-size:11px;color:var(--text-muted);">📕 上学期:</span>
                <input id="counselor-file-previous" class="file-path" readonly style="width:130px;font-size:10px;" placeholder="上学期文件..." value="${escapeHtml(prevFile)}">
                <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:10px;" onclick="cImportFile('previous')">选择</button>
                <button class="btn btn-ghost btn-sm" style="padding:4px 6px;font-size:9px;" onclick="cImportFile('extra')" title="添加历史学期">+ 历史</button>
                <span id="counselor-semester-indicator" style="font-size:9px;color:var(--accent-secondary);${cSemesters.length?'':'display:none;'}">${cSemesters.length?'📅 '+cSemesters.join(' | '):''}</span>
            </div>
            ${!cData.length?`<p style="text-align:center;padding:16px;color:var(--text-muted);">👆 请先导入数据文件，然后使用下方通知工具</p>`:''}
        </div>
        <div class="module-section" style="margin-top:12px;border:1px dashed var(--accent-secondary);background:var(--bg-tertiary);">
            <h3>📊 学分绩点导入</h3>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">导入原始成绩文件，用于挂科分析和通知中的各科成绩明细</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <input id="notice-grade-file" class="file-path" readonly style="flex:1;min-width:200px;font-size:11px;" placeholder="选择学分绩点原始文件(.xlsx)..." value="${cGradeFilePath?cGradeFilePath.split(/[\\\\/]/).pop():''}">
                <button class="btn btn-secondary btn-sm" onclick="cPickNoticeGradeFile()">📂 选择</button>
                <button class="btn btn-teal btn-sm" onclick="cAnalyzeNoticeGrade()">🔍 分析</button>
                <span id="notice-grade-status" style="font-size:10px;color:var(--text-muted);"></span>
            </div>
        </div>
        <div class="module-section" style="margin-top:12px;"><h3>📝 家长通知生成器</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>
                    <h4 style="font-size:13px;margin-bottom:8px;">1. 选择目标学生</h4>
                    <select id="notice-filter" class="select-input" style="width:100%;margin-bottom:8px;"><option value="all">全部学生</option><option value="comp60">综测<60</option><option value="moral60">德育≤60</option><option value="starred">已关注</option><option value="failing">挂科学生(课程)</option><option value="alert">预警等级学生</option></select>
                    <button class="btn btn-teal btn-sm" onclick="cPreviewNoticeCount()">👁 预览人数</button>
                    <span id="notice-count" style="font-size:11px;color:var(--text-muted);margin-left:8px;"></span>
                </div>
                <div>
                    <h4 style="font-size:13px;margin-bottom:8px;">2. 选择数据源</h4>
                    <select id="notice-semester" class="select-input" style="width:100%;"><option value="current">本学期</option>${cPrevData.length?'<option value="previous">上学期</option>':''}${cSemesters.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
                </div>
            </div>
            <h4 style="font-size:13px;margin:12px 0 8px;">3. 包含的信息（勾选需要的内容）</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;">
                ${[['includeBasic','学生基本信息'],['includeGpa','学分绩点'],['includeMoral','德育分'],['includeQuality','素拓分'],['includeComp','综测成绩'],['includeRank','班级排名'],['includeFailed','挂科科目详情（具体科目名+分数）'],['includeAllCourses','全部科目成绩表（需导入成绩单）'],['includeCompare','与班级均值对比'],['includeTrend','学期变化趋势'],['includeComment','辅导员自定义评语']].map(([key,label])=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="notice-${key}" ${cNoticeOptions[key]?'checked':''} onchange="cNoticeOptions['${key}']=this.checked;cSaveNoticeOptions();${key==='includeComment'?'document.getElementById(\'notice-comment-area\').style.display=this.checked?\'block\':\'none\';':''}"> ${label}</label>`).join('')}
            </div>
            <div id="notice-comment-area" style="margin-top:8px;display:${cNoticeOptions.includeComment?'block':'none'};"><textarea id="notice-comment" class="input" style="width:100%;height:60px;font-size:12px;" placeholder="自定义评语（可选）..." oninput="cNoticeOptions.commentText=this.value;cSaveNoticeOptions();">${escapeHtml(cNoticeOptions.commentText||'')}</textarea></div>
            <div style="margin-top:12px;display:flex;gap:8px;">
                <button class="btn btn-teal btn-sm" onclick="cGenerateNoticeV8()">📝 生成通知文本</button>
                <button class="btn btn-primary btn-sm" onclick="cExportNoticesV8()">📥 批量导出通知单</button>
                <button class="btn btn-ghost btn-sm" onclick="cPreviewOneNotice()">👁 预览示例</button>
            </div>
            <textarea id="notice-output" class="input" style="width:100%;height:120px;font-size:11px;margin-top:8px;" readonly placeholder="通知内容将显示在这里..."></textarea></div>
        <div class="module-section" style="margin-top:12px;"><h3>🤖 AI 学生分析</h3>
            <div style="display:flex;gap:8px;margin-bottom:8px;"><input id="tool-ai-sid" class="input" style="width:160px;" placeholder="学号"><select id="tool-ai-type" class="select-input" style="width:150px;"><option value="full">📋 综合分析</option><option value="strength">💪 突出优势</option><option value="weakness">🔍 存在问题</option><option value="advice">💡 提升建议</option><option value="radar">🎯 雷达分析</option></select><button class="btn btn-teal btn-sm" onclick="cAnalyzeStudent()">分析</button></div>
            <div id="tool-ai-result" style="font-size:12px;line-height:1.8;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);min-height:60px;color:var(--text-secondary);"></div></div>
        <div class="module-section" style="margin-top:12px;"><h3>📋 智能分层</h3>
            <div style="display:flex;gap:8px;margin-bottom:8px;"><select id="tool-group-metric" class="select-input" style="width:120px;"><option value="comp">按综测</option><option value="gpa">按绩点</option></select><button class="btn btn-teal btn-sm" onclick="cGenerateGroups()">分层</button></div><div id="tool-group-result"></div></div>
        <div class="module-section" style="margin-top:12px;"><h3>📊 深度分析报告</h3><button class="btn btn-teal btn-sm" onclick="cDeepAnalytics()">📈 生成报告</button><div id="tool-analytics-result" style="margin-top:12px;"></div></div>`;
}

function cPreviewNoticeCount(){const f=document.getElementById('notice-filter')?.value;let t=[];
    if(f==='comp60')t=cData.filter(d=>(d.comp||0)<60);
    else if(f==='moral60')t=cData.filter(d=>(d.moral||0)<=60);
    else if(f==='starred')t=cData.filter(d=>cStarred[d.id]);
    else if(f==='failing'){
        if(Object.keys(cCourseStudentMap).length>0)t=cData.filter(d=>cCourseStudentMap[d.id]&&cCourseStudentMap[d.id].fail_count>0);
        else t=cData.filter(d=>(d.comp||0)<60);
    }
    else if(f==='alert')t=cData.filter(d=>cGetAlertLevel('comp',d.comp||0)!=='safe');
    else t=cData;
    document.getElementById('notice-count').textContent=`目标: ${t.length}人`;}

function cGenerateNoticeV8(){
    cNoticeOptions.commentText=document.getElementById('notice-comment')?.value||'';cSaveNoticeOptions();
    const f=document.getElementById('notice-filter')?.value;let t=cData;
    if(f==='comp60')t=cData.filter(d=>(d.comp||0)<60);
    else if(f==='moral60')t=cData.filter(d=>(d.moral||0)<=60);
    else if(f==='starred')t=cData.filter(d=>cStarred[d.id]);
    else if(f==='failing'){
        // Use course-level data if available, otherwise fall back to comp<60
        if(Object.keys(cCourseStudentMap).length>0){
            t=cData.filter(d=>cCourseStudentMap[d.id]&&cCourseStudentMap[d.id].fail_count>0);
        }else{
            t=cData.filter(d=>(d.comp||0)<60);
        }
    }
    else if(f==='alert')t=cData.filter(d=>cGetAlertLevel('comp',d.comp||0)!=='safe');
    if(!t.length){showToast('没有匹配的学生','warning');return;}
    // Build class averages
    const cm={};cData.forEach(x=>{const cls=x.class||'';if(!cm[cls])cm[cls]=[];cm[cls].push(x);});
    const classAvgs={};for(const[cls,sts]of Object.entries(cm)){classAvgs[cls]={gpa:(sts.reduce((a,b)=>a+(b.gpa||0),0)/sts.length).toFixed(2),moral:(sts.reduce((a,b)=>a+(b.moral||0),0)/sts.length).toFixed(0),comp:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)};}
    // Generate notices
    let output='';
    t.slice(0,20).forEach((d,i)=>{const ca=classAvgs[d.class||'']||null;const ranked=[...cData.filter(x=>x.class===d.class)].sort((a,b)=>(b.comp||0)-(a.comp||0));const rank=ranked.findIndex(x=>x.id===d.id)+1;const p=cPrevData.length?cPrevData.find(x=>x.id===d.id):null;
        const parts=[];
        if(cNoticeOptions.includeBasic)parts.push(`【学生信息】${d.name||''}，学号${d.id||''}，${d.class||''}`);
        if(cNoticeOptions.includeGpa)parts.push(`学分绩点：${cFmt(d.gpa)}`);
        if(cNoticeOptions.includeMoral)parts.push(`德育分：${cFmt(d.moral,0)}`);
        if(cNoticeOptions.includeQuality)parts.push(`素拓分：${cFmt(d.quality,1)}`);
        if(cNoticeOptions.includeComp)parts.push(`综测成绩：${cFmt(d.comp)}`);
        if(cNoticeOptions.includeRank&&rank)parts.push(`班级排名：第${rank}名（共${ranked.length}人）`);
        if(cNoticeOptions.includeCompare&&ca)parts.push(`班级均值：绩点${ca.gpa} / 德育${ca.moral} / 综测${ca.comp}`);
        if(cNoticeOptions.includeTrend&&p)parts.push(`上学期综测：${cFmt(p.comp)}，变化：${((d.comp||0)-(p.comp||0)>=0?'+':'')+cFmt((d.comp||0)-(p.comp||0))}`);
        if(cNoticeOptions.includeFailed)parts.push('挂科情况：请参见成绩单明细');
        if(cNoticeOptions.includeComment&&cNoticeOptions.commentText)parts.push(`辅导员评语：${cNoticeOptions.commentText}`);
        output+=`${'='.repeat(45)}\n家长通知 — ${d.name||''}\n${'='.repeat(45)}\n您好！\n\n${parts.join('\n')}\n\n请家长关注学生学业发展，与学校共同努力。\n\n顿河学院团委秘书处\n\n`;
    });
    if(t.length>20)output+=`\n... 共${t.length}人，仅显示前20人预览`;
    document.getElementById('notice-output').value=output;
}

async function cExportNoticesV8(){
    cNoticeOptions.commentText=document.getElementById('notice-comment')?.value||'';cSaveNoticeOptions();
    const f=document.getElementById('notice-filter')?.value;let t=cData;
    if(f==='comp60')t=cData.filter(d=>(d.comp||0)<60);
    else if(f==='moral60')t=cData.filter(d=>(d.moral||0)<=60);
    else if(f==='starred')t=cData.filter(d=>cStarred[d.id]);
    else if(f==='failing'){
        // Use course-level data if available, otherwise fall back to comp<60
        if(Object.keys(cCourseStudentMap).length>0){
            t=cData.filter(d=>cCourseStudentMap[d.id]&&cCourseStudentMap[d.id].fail_count>0);
        }else{
            t=cData.filter(d=>(d.comp||0)<60);
        }
    }
    else if(f==='alert')t=cData.filter(d=>cGetAlertLevel('comp',d.comp||0)!=='safe');
    if(!t.length){showToast('没有匹配的学生','warning');return;}
    const cm={};cData.forEach(x=>{const cls=x.class||'';if(!cm[cls])cm[cls]=[];cm[cls].push(x);});
    const classAvgs={};for(const[cls,sts]of Object.entries(cm)){classAvgs[cls]={gpa:(sts.reduce((a,b)=>a+(b.gpa||0),0)/sts.length).toFixed(2),moral:(sts.reduce((a,b)=>a+(b.moral||0),0)/sts.length).toFixed(0),comp:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)};}
    try{
        const notices=await eel.batch_generate_notices(t.map(x=>({id:x.id,name:x.name,class:x.class,gpa:x.gpa||0,moral:x.moral||0,quality:x.quality||0,comp:x.comp||0,rank:'—',failed_courses:'见成绩单'})),cSemesters[cSemesters.length-1]||'本学期',classAvgs)();
        if(notices&&notices.length){
            let all='家长通知单\n'+'='.repeat(50)+'\n\n';
            notices.forEach(n=>{all+=`${'─'.repeat(40)}\n${n.name} (${n.id})\n${'─'.repeat(40)}\n${n.notice}\n\n`;});
            const blob=new Blob([all],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`家长通知_${new Date().toISOString().slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url);showToast(`已导出${notices.length}份通知`,'success');
        }
    }catch(e){showToast('导出失败: '+e,'error');}
}

function cPreviewOneNotice(){cGenerateNoticeV8();const txt=document.getElementById('notice-output')?.value;if(txt)showToast('已生成预览，请查看下方文本','info');}

async function cAnalyzeStudent(){
    const sid=document.getElementById('tool-ai-sid')?.value?.trim();if(!sid){showToast('请输入学号','warning');return;}
    const d=cData.find(x=>x.id===sid);if(!d){showToast('未找到该学生','error');return;}
    cSearchHistory.unshift(sid);if(cSearchHistory.length>20)cSearchHistory.length=20;localStorage.setItem('counselor_search_history',JSON.stringify(cSearchHistory));
    const p=cPrevData.length?cPrevData.find(x=>x.id===sid):null;const el=document.getElementById('tool-ai-result');
    const aType=document.getElementById('tool-ai-type')?.value||'full';const level=cGetAlertLevel('comp',d.comp||0);
    let prompt='';
    if(aType==='radar'){
        const clsSts=cData.filter(x=>x.class===d.class);const caGpa=clsSts.reduce((a,b)=>a+(b.gpa||0),0)/clsSts.length;const caMoral=clsSts.reduce((a,b)=>a+(b.moral||0),0)/clsSts.length;const caComp=clsSts.reduce((a,b)=>a+(b.comp||0),0)/clsSts.length;
        prompt=`你是辅导员助理。对该学生进行五维雷达分析：\n姓名：${d.name}，班级：${d.class}\n绩点：${cFmt(d.gpa)}（班均${caGpa.toFixed(2)}）\n德育：${cFmt(d.moral,0)}（班均${caMoral.toFixed(0)}）\n素拓：${cFmt(d.quality,1)}\n综测：${cFmt(d.comp)}（班均${caComp.toFixed(2)}）${p?`\n上学期综测：${cFmt(p.comp)}，变化：${((d.comp||0)-(p.comp||0)>=0?'+':'')+cFmt((d.comp||0)-(p.comp||0))}`:''}\n从1.学业能力 2.品德发展 3.综合素质 4.进步趋势 5.发展潜力 五维评分(1-10)并给出总评。`;
    }else{
        const tl={full:'综合分析报告（学习+品德+素质+趋势+风险，分点列出，含数据对比）',strength:'突出优势（2-3个最突出优势领域）',weakness:'问题诊断（2-3个最需改进的领域及建议）',advice:'提升建议（3条可操作的改进建议）'};
        prompt=`你是辅导员助理。请分析：\n姓名：${d.name}，班级：${d.class}，预警等级：${cAlertLevelLabel(level)}\n绩点：${cFmt(d.gpa)}，德育：${cFmt(d.moral,0)}，素拓：${cFmt(d.quality,1)}，综测：${cFmt(d.comp)}${p?`\n上学期：${cFmt(p.comp)}，变化：${((d.comp||0)-(p.comp||0)>=0?'+':'')+cFmt((d.comp||0)-(p.comp||0))}`:''}\n任务：${tl[aType]||tl.full}`;
    }
    el.innerHTML='<span style="color:var(--text-muted);">AI 分析中...</span>';
    try{const resp=await eel.ai_chat(prompt)();el.innerHTML=`<div style="white-space:pre-wrap;">${escapeHtml(resp)}</div>`;}catch(e){el.innerHTML='<span style="color:var(--color-error);">AI服务不可用</span>';}
}

function cGenerateGroups(){const metric=document.getElementById('tool-group-metric')?.value||'comp';const sorted=[...cData].sort((a,b)=>(b[metric]||0)-(a[metric]||0));const n=sorted.length;if(!n)return;const a=sorted.slice(0,Math.ceil(n*0.3));const b=sorted.slice(Math.ceil(n*0.3),Math.ceil(n*0.7));const c=sorted.slice(Math.ceil(n*0.7));const el=document.getElementById('tool-group-result');const label=metric==='comp'?'综测':'绩点';el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;"><div class="module-section" style="border-left:3px solid var(--color-success);"><h4>🟢 A档 (前30%)</h4><p style="font-size:11px;">${a.length}人</p><p style="font-size:10px;color:var(--text-muted);">${a.slice(0,5).map(x=>escapeHtml(x.name)).join('、')}${a.length>5?'等':''}</p></div><div class="module-section" style="border-left:3px solid var(--color-warning);"><h4>🟡 B档</h4><p style="font-size:11px;">${b.length}人</p></div><div class="module-section" style="border-left:3px solid var(--color-error);"><h4>🔴 C档 (后30%)</h4><p style="font-size:11px;">${c.length}人</p></div></div><button class="btn btn-teal btn-sm" onclick="cExportGroups('${metric}')">📥 导出分层Excel</button>`;}
async function cExportGroups(metric){const sorted=[...cData].sort((a,b)=>(b[metric]||0)-(a[metric]||0));const n=sorted.length;const groups={A:sorted.slice(0,Math.ceil(n*0.3)),B:sorted.slice(Math.ceil(n*0.3),Math.ceil(n*0.7)),C:sorted.slice(Math.ceil(n*0.7))};const rows=[];for(const[lv,sts]of Object.entries(groups)){sts.forEach(d=>rows.push([lv,d.id||'',d.name||'',d.class||'',d.gpa||0,d.moral||0,d.quality||0,d.comp||0]));}try{await eel.export_preview_data(['分层','学号','姓名','班级','绩点','德育','素拓','综测'],rows,`分层结果_${new Date().toISOString().slice(0,10)}.xlsx`)();showToast('已导出','success');}catch(e){showToast('导出失败','error');}}

// ==================== 8. BIG SCREEN ====================
let cBigscreenModules={count:true,gpaAvg:true,compAvg:true,moralAvg:true,improved:true,failCount:true,top5:true,classRank:true,gainers:true,courseFail:true,clock:true,distribution:false};

function cRenderBigscreen(){
    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">🎯 班会大屏</h2>
        <div class="module-section"><h3>选择显示模块</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;margin-bottom:12px;">
                ${[['count','👥 学生总数'],['gpaAvg','📊 平均绩点'],['compAvg','📈 平均综测'],['moralAvg','📋 平均德育'],['improved','🔼 进步人数'],['failCount','⚠️ 挂科人数'],['top5','🏆 个人TOP榜'],['classRank','🏫 班级排行'],['gainers','🚀 进步榜'],['courseFail','📉 课程挂科率'],['clock','🕐 实时时钟'],['distribution','📊 成绩分布图']].map(([key,label])=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${cBigscreenModules[key]?'checked':''} onchange="cBigscreenModules['${key}']=this.checked"> ${label}</label>`).join('')}
            </div>
            <div style="display:flex;gap:8px;"><button class="btn btn-teal" onclick="cOpenClassScreenV8()">🎯 打开全屏大屏</button></div></div>`;
}

function cOpenClassScreenV8(){
    if(!cData.length){showToast('请先导入数据','warning');return;}
    const grade=document.getElementById('counselor-grade-sel')?.value||'全部年级';
    const comps=cData.map(d=>d.comp||0).filter(v=>v>0);const gpas=cData.map(d=>d.gpa||0).filter(v=>v>0);const morals=cData.map(d=>d.moral||0).filter(v=>v>0);
    const a=v=>v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):'—';
    const improved=cPrevData.length?cData.filter(d=>{const p=cPrevData.find(x=>x.id===d.id);return p&&(d.comp||0)>(p.comp||0);}).length:0;
    const top5=[...cData].sort((a,b)=>(b.comp||0)-(a.comp||0)).slice(0,5);
    const gains=[...cData].map(d=>{const p=cPrevData.length?cPrevData.find(x=>x.id===d.id):null;return{...d,change:p?(d.comp||0)-(p.comp||0):0};}).sort((a,b)=>b.change-a.change).slice(0,10);
    const classMap={};cData.forEach(d=>{const cls=d.class||'未知';if(!classMap[cls])classMap[cls]=[];classMap[cls].push(d);});
    const classRank=Object.entries(classMap).map(([cls,sts])=>({cls,count:sts.length,avg:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)})).sort((a,b)=>b.avg-a.avg);

    const m=cBigscreenModules;

    const w=window.open('','_blank','width=1400,height=900');
    w.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>班会大屏 — ${grade}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#0a0f1e 0%,#141b2d 50%,#0d1117 100%);color:#e0e4f0;min-height:100vh;overflow-x:hidden}
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(108,92,231,0.03)1px,transparent 1px),linear-gradient(90deg,rgba(108,92,231,0.03)1px,transparent 1px);background-size:60px 60px;pointer-events:none}
.header{text-align:center;padding:30px 40px 10px;position:relative;z-index:1}
.header h1{font-size:40px;font-weight:800;background:linear-gradient(135deg,#a78bfa,#60a5fa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px}
.header .subtitle{font-size:14px;opacity:0.5;margin-top:6px}.header .clock{font-size:24px;font-weight:300;opacity:0.3;margin-top:8px}
.stats{display:grid;grid-template-columns:repeat(${[m.count,m.gpaAvg,m.compAvg,m.moralAvg,m.improved,m.failCount].filter(Boolean).length||6},1fr);gap:16px;padding:20px 40px;position:relative;z-index:1}
.stat-card{background:linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px 16px;text-align:center;animation:fadeIn 0.5s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.stat-card .num{font-size:40px;font-weight:800;line-height:1.2}.stat-card .lbl{font-size:12px;opacity:0.5;margin-top:8px}
.c1 .num{color:#a78bfa}.c2 .num{color:#60a5fa}.c3 .num{color:#34d399}.c4 .num{color:#fbbf24}.c5 .num{color:#f472b6}.c6 .num{color:#fb923c}
.section{padding:0 40px 20px;position:relative;z-index:1}
.section h2{font-size:18px;font-weight:700;margin-bottom:12px;color:rgba(255,255,255,0.7);border-left:3px solid #a78bfa;padding-left:12px}
.lists{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.list-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:12px;padding:16px}
.list-item{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px}
.list-item .rank{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:12px}
.rank-gold{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000}.rank-silver{background:linear-gradient(135deg,#94a3b8,#64748b);color:#fff}.rank-bronze{background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff}
.list-item .name{flex:1}.list-item .meta{font-size:10px;opacity:0.4;margin-left:8px}.list-item .score{font-weight:600;opacity:0.7;margin-left:12px}
.class-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.class-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:12px;padding:16px;text-align:center;animation:fadeIn 0.5s ease both}
.class-card .rank-num{font-size:32px;font-weight:800}.class-card .class-name{font-size:14px;margin:4px 0}.class-card .class-stat{font-size:11px;opacity:0.5}
.footer{text-align:center;padding:20px;opacity:0.2;font-size:11px;position:relative;z-index:1}
</style></head><body><div class="bg-grid"></div>
<div class="header"><h1>🏛️ 顿河学院学业数据大屏</h1><p class="subtitle">${grade} · ${new Date().toLocaleDateString('zh-CN')}</p>${m.clock?'<div class="clock" id="big-clock"></div>':''}</div>
<div class="stats">
    ${m.count?`<div class="stat-card c1"><div class="num">${cData.length}</div><div class="lbl">学生总数</div></div>`:''}
    ${m.gpaAvg?`<div class="stat-card c2"><div class="num">${a(gpas)}</div><div class="lbl">平均绩点</div></div>`:''}
    ${m.compAvg?`<div class="stat-card c3"><div class="num">${a(comps)}</div><div class="lbl">平均综测</div></div>`:''}
    ${m.moralAvg?`<div class="stat-card c4"><div class="num">${a(morals)}</div><div class="lbl">平均德育</div></div>`:''}
    ${m.improved?`<div class="stat-card c5"><div class="num">${improved}</div><div class="lbl">进步人数</div></div>`:''}
    ${m.failCount?`<div class="stat-card c6"><div class="num">${cData.filter(d=>(d.comp||0)<60).length}</div><div class="lbl">需关注</div></div>`:''}
</div>
${m.top5?`<div class="section"><h2>🏆 综合测评前五名</h2><div class="list-card">${top5.map((d,i)=>{const colors=['rank-gold','rank-silver','rank-bronze'];return`<div class="list-item"><span class="rank ${colors[i]||''}">${i+1}</span><span class="name">${d.name}</span><span class="meta">${d.class}·${d.id}</span><span class="score">综测 ${cFmt(d.comp)}</span></div>`;}).join('')}</div></div>`:''}
${m.classRank?`<div class="section"><h2>🏫 班级综测排行</h2><div class="class-grid">${classRank.slice(0,8).map((c,i)=>{const colors=['#fbbf24','#94a3b8','#fb923c'];return`<div class="class-card"><div class="rank-num" style="color:${colors[i]||'rgba(255,255,255,0.4)'};">#${i+1}</div><div class="class-name">${c.cls}</div><div class="class-stat">${c.count}人 · 均${c.avg}</div></div>`;}).join('')}</div></div>`:''}
${m.gainers?`<div class="section"><h2>🚀 进步榜 TOP10</h2><div class="list-card">${gains.map((d,i)=>{const colors=['rank-gold','rank-silver','rank-bronze'];return`<div class="list-item"><span class="rank ${colors[i]||''}">${i+1}</span><span class="name">${d.name}</span><span class="meta">${d.class}</span><span class="score" style="color:${d.change>=0?'#34d399':'#ef4444'};">${d.change>=0?'+':''}${d.change.toFixed(2)}</span></div>`;}).join('')}</div></div>`:''}
<div class="footer">学生综合测评系统 V8.0 · 陈雨昂 · 顿河学院团委秘书处</div>
${m.clock?`<script>function tick(){const e=document.getElementById('big-clock');if(e){e.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false})}}tick();setInterval(tick,1000);<\/script>`:''}
</body></html>`);w.document.close();}

// ==================== 9. SETTINGS ====================
function cRenderSettings(){
    document.getElementById(cRenderTarget).innerHTML=`
        <h2 style="margin-bottom:16px;">⚙️ 设置</h2>
        <div class="module-section"><h3>📅 多学期管理</h3><div id="counselor-extra-semesters" style="margin-bottom:8px;"></div><button class="btn btn-teal btn-sm" onclick="cImportFile('extra')">+ 添加历史学期</button></div>
        <div class="module-section"><h3>💾 数据备份</h3><button class="btn btn-teal btn-sm" onclick="cBackupData()">📥 导出备份</button></div>
        <div class="module-section"><h3>📥 数据恢复</h3><button class="btn btn-secondary btn-sm" onclick="cRestoreData()">📤 恢复备份</button></div>
        <div class="module-section"><h3>📈 导出工具</h3><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-teal btn-sm" onclick="cExportAllCurrent()">📋 导出当前数据(${cData.length}条)</button><button class="btn btn-ghost btn-sm" onclick="cExportCompareReport()">📥 导出学期对比报告</button></div></div>
        <div class="module-section"><h3>🔄 软件更新</h3>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">拿到新版exe后，在这里选择文件即可一键更新，无需卸载重装。</p>
            <button class="btn btn-teal btn-sm" onclick="checkForUpdates()">📂 选择更新文件</button>
            <span style="font-size:10px;color:var(--text-muted);margin-left:8px;">当前版本: v${typeof APP_VERSION!=='undefined'?APP_VERSION:'8.0'}</span></div>
        <div class="module-section"><h3>🌓 外观</h3><p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">当前：${document.documentElement.getAttribute('data-theme')==='light'?'浅色模式':'深色模式'}</p><button class="btn btn-secondary btn-sm" onclick="toggleThemeManual()">切换深浅色</button></div>
        <div class="module-section"><h3>ℹ️ 关于</h3><div style="font-size:12px;color:var(--text-secondary);line-height:2;"><p><strong>学生综合测评系统</strong> V8.0</p><p>开发者：陈雨昂</p><p>所属：顿河学院团委秘书处</p><p>辅导员工作台 — 全功能数据看板</p><hr style="border-color:var(--border-thin);margin:8px 0;"><p style="font-size:10px;color:var(--text-muted);">登录：${sessionStorage.getItem('eval_user')||'—'} · 角色：辅导员</p></div></div>`;
    cRenderExtraSemesterList();
}

function cRenderExtraSemesterList(){
    const el=document.getElementById('counselor-extra-semesters');if(!el)return;
    let html='';
    for(const [label,path] of Object.entries(cExtraSemesters)){html+=`<div style="display:flex;align-items:center;gap:8px;font-size:10px;padding:4px 0;"><span style="color:var(--accent-secondary);">📅 ${label}</span><span style="color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${path.split(/[\\/]/).pop()}</span>${cExtraData[label]?`<span style="color:var(--color-success);">✅ ${cExtraData[label].length}人</span>`:`<span style="color:var(--text-muted);">未加载</span>`}<button class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 6px;" onclick="cRemoveExtraSemester('${escJs(label)}')">✕</button></div>`;}
    if(!Object.keys(cExtraSemesters).length)html='<p style="font-size:10px;color:var(--text-muted);">未添加历史学期</p>';
    el.innerHTML=html;
}

function cRemoveExtraSemester(label){delete cExtraSemesters[label];delete cExtraData[label];delete cAllSemesters[label];cSemesters=cSemesters.filter(s=>s!==label);localStorage.setItem('counselor_extra_semesters',JSON.stringify(cExtraSemesters));localStorage.setItem('counselor_semesters',JSON.stringify(cSemesters));localStorage.setItem('counselor_all_semesters',JSON.stringify(cAllSemesters));updateSemesterUI();switchCounselorTab(cCurrentTab);}

function cBackupData(){const data={cStarred,cThresholds,cThresholdsMulti,cPresets,cTags,cConversations,cSemesters,cAllSemesters,cExtraSemesters,cCurrentPath,cPrevPath,time:Date.now()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`辅导员备份_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);showToast('备份已下载','success');}
function cRestoreData(){const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.cStarred){cStarred=data.cStarred;localStorage.setItem('counselor_starred',JSON.stringify(cStarred));}if(data.cThresholds){cThresholds=data.cThresholds;localStorage.setItem('counselor_thresholds',JSON.stringify(cThresholds));}if(data.cThresholdsMulti){cThresholdsMulti=data.cThresholdsMulti;localStorage.setItem('counselor_thresholds_multi',JSON.stringify(cThresholdsMulti));}if(data.cPresets){cPresets=data.cPresets;localStorage.setItem('counselor_presets',JSON.stringify(cPresets));}if(data.cTags){cTags=data.cTags;localStorage.setItem('counselor_tags',JSON.stringify(cTags));}if(data.cConversations){cConversations=data.cConversations;localStorage.setItem('counselor_conversations',JSON.stringify(cConversations));}if(data.cSemesters){cSemesters=data.cSemesters;localStorage.setItem('counselor_semesters',JSON.stringify(cSemesters));}if(data.cAllSemesters){cAllSemesters=data.cAllSemesters;localStorage.setItem('counselor_all_semesters',JSON.stringify(cAllSemesters));}if(data.cExtraSemesters){cExtraSemesters=data.cExtraSemesters;localStorage.setItem('counselor_extra_semesters',JSON.stringify(cExtraSemesters));}if(data.cCurrentPath){cCurrentPath=data.cCurrentPath;localStorage.setItem('counselor_current_path',cCurrentPath);}if(data.cPrevPath){cPrevPath=data.cPrevPath;localStorage.setItem('counselor_previous_path',cPrevPath);}showToast('恢复成功','success');switchCounselorTab(cCurrentTab);}catch(err){showToast('备份文件无效','error');}};input.click();}

// ==================== DEEP ANALYTICS ====================
async function cDeepAnalytics(){
    const el=document.getElementById('tool-analytics-result');el.innerHTML='<p style="color:var(--text-muted);">分析中...</p>';
    try{
        const dataJson=JSON.stringify(cData.map(d=>({id:d.id,name:d.name,class:d.class,gpa:d.gpa||0,moral:d.moral||0,quality:d.quality||0,comp:d.comp||0})));
        const r=await eel.get_deep_analytics(dataJson)();if(!r||!r.success){el.innerHTML=`<p style="color:var(--color-error);">${r?.error||'失败'}</p>`;return;}cLastDeepAnalytics=r;
        el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:8px;">
            <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><div style="font-size:18px;font-weight:700;color:#6c5ce7;">${r.summary.gpa_avg}</div><div style="font-size:9px;color:var(--text-muted);">绩点均值</div></div>
            <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><div style="font-size:18px;font-weight:700;color:#00cec9;">${r.summary.moral_avg}</div><div style="font-size:9px;color:var(--text-muted);">德育均值</div></div>
            <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><div style="font-size:18px;font-weight:700;color:#fdcb6e;">${r.summary.comp_avg}</div><div style="font-size:9px;color:var(--text-muted);">综测均值</div></div>
            <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><div style="font-size:18px;font-weight:700;color:#e17055;">${r.summary.gpa_std}</div><div style="font-size:9px;color:var(--text-muted);">绩点标准差</div></div>
            <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><div style="font-size:18px;font-weight:700;color:#d63031;">${r.summary.comp_std}</div><div style="font-size:9px;color:var(--text-muted);">综测标准差</div></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                <div><strong style="font-size:11px;">🏆 TOP5</strong>${r.top10.slice(0,5).map(d=>`<div style="font-size:10px;padding:2px 0;">${escapeHtml(d.name)} (${escapeHtml(d.class)}) — <strong>${(d.comp||0).toFixed(2)}</strong></div>`).join('')}</div>
                <div><strong style="font-size:11px;">⚠️ 末尾5</strong>${r.bottom10.slice(0,5).reverse().map(d=>`<div style="font-size:10px;padding:2px 0;">${escapeHtml(d.name)} (${escapeHtml(d.class)}) — <strong style="color:var(--color-error);">${(d.comp||0).toFixed(2)}</strong></div>`).join('')}</div></div>
            <div style="margin-top:12px;display:flex;gap:8px;"><button class="btn btn-teal btn-sm" onclick="cExportDeepAnalytics()">📥 导出Excel报告</button></div>`;
    }catch(e){el.innerHTML=`<p style="color:var(--color-error);">失败: ${e}</p>`;}
}

async function cExportDeepAnalytics(){
    if(!cLastDeepAnalytics){showToast('请先生成报告','warning');return;}
    const r=cLastDeepAnalytics;const hd=['指标','数值'];
    const rows=[['学生总数',r.summary.total],['绩点均值',r.summary.gpa_avg],['绩点标准差',r.summary.gpa_std],['德育均值',r.summary.moral_avg],['综测均值',r.summary.comp_avg],['综测标准差',r.summary.comp_std],['',''],['班级排名',''],...r.class_comparison.map(c=>[c.class,c.comp_avg+' (均)']),['',''],['年级排名',''],...r.grade_comparison.map(g=>[g.grade,g.comp_avg+' (均)']),['',''],['综测TOP10',''],...r.top10.map((d,i)=>[`${i+1}. ${d.name} (${d.class})`,(d.comp||0).toFixed(2)])];
    try{const ts=new Date().toISOString().slice(0,10);const r2=await eel.export_preview_data(hd,rows,`深度分析报告_${ts}.xlsx`)();if(r2&&r2.success){showToast('已导出','success');eel.open_file_explorer(r2.output)();}else{showToast('导出失败','error');}}catch(e){showToast('出错: '+e,'error');}
}

// ==================== STUDENT DETAIL ====================
function cShowStudentDetail(sid){
    if(!sid||!cData.length)return;const d=cData.find(x=>x.id===sid);if(!d){showToast('未找到: '+sid,'error');return;}
    const p=cPrevData.length?cPrevData.find(x=>x.id===sid):null;const ch=p?(d.comp||0)-(p.comp||0):0;
    const tags=cTags[sid]||[];const starred=cStarred[sid];const convos=cConversations[sid]||[];const level=cGetAlertLevel('comp',d.comp||0);
    if(typeof showModal!=='function'){alert(d.name+'\n绩点:'+cFmt(d.gpa)+' 德育:'+cFmt(d.moral,0)+' 综测:'+cFmt(d.comp));return;}
    showModal('👤 '+escapeHtml(d.name)+' — 学生档案',
        `<div style="line-height:2;font-size:13px;">
            <p><strong>学号：</strong>${escapeHtml(d.id)} | <strong>班级：</strong>${escapeHtml(d.class)}</p>
            <p><strong>状态：</strong><span style="padding:2px 8px;border-radius:10px;background:${cAlertLevelColor(level)}22;color:${cAlertLevelColor(level)};">${cAlertLevelLabel(level)}</span>${starred?' ⭐':''}${tags.length?' 🏷️ '+tags.join(' '):''}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;">
                <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><span style="font-size:20px;font-weight:700;color:#6c5ce7;">${cFmt(d.gpa)}</span><p style="font-size:10px;color:var(--text-muted);">绩点</p></div>
                <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><span style="font-size:20px;font-weight:700;color:#00cec9;">${cFmt(d.moral,0)}</span><p style="font-size:10px;color:var(--text-muted);">德育</p></div>
                <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><span style="font-size:20px;font-weight:700;color:#fdcb6e;">${cFmt(d.quality,1)}</span><p style="font-size:10px;color:var(--text-muted);">素拓</p></div>
                <div style="text-align:center;padding:8px;background:var(--bg-tertiary);border-radius:8px;"><span style="font-size:20px;font-weight:700;color:${cAlertLevelColor(level)};">${cFmt(d.comp)}</span><p style="font-size:10px;color:var(--text-muted);">综测</p></div></div>
            ${p?`<p><strong>上学期：</strong>${cFmt(p.comp)} <span style="color:${ch>=0?'var(--color-success)':'var(--color-error)'};">${ch>=0?'+':''}${cFmt(ch)}</span></p>`:''}
            <div style="margin:8px 0;border-top:var(--border-thin);padding-top:8px;"><strong style="font-size:12px;">💬 谈话记录 (${convos.length})</strong>
                <div style="max-height:150px;overflow-y:auto;margin-top:4px;">${convos.length===0?'<p style="font-size:10px;color:var(--text-muted);">暂无</p>':convos.map(c=>`<div style="font-size:10px;padding:4px 0;border-bottom:var(--border-thin);"><span style="color:var(--text-muted);">${c.date||''}</span> <strong>${escapeHtml(c.topic||'')}</strong><br>${escapeHtml((c.content||'').slice(0,60))}${(c.content||'').length>60?'...':''} ${c.followUp?`<span style="color:#fdcb6e;">📅${c.followUp}</span>`:''}</div>`).join('')}</div>
                <button class="btn btn-teal btn-sm" style="margin-top:4px;" onclick="cAddConversation('${escQs(sid)}')">+ 添加</button></div>
            <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
                <button class="btn btn-teal btn-sm" onclick="closeModal();switchCounselorTab('notices');setTimeout(()=>{document.getElementById('tool-ai-sid').value='${escQs(sid)}';},300);">🤖 AI分析</button>
                <button class="btn btn-ghost btn-sm" onclick="cToggleStar('${escQs(sid)}');closeModal();">${starred?'取消':'⭐ 关注'}</button>
                <button class="btn btn-ghost btn-sm" onclick="const t=prompt('标签：');if(t){if(!cTags['${escQs(sid)}'])cTags['${escQs(sid)}']=[];cTags['${escQs(sid)}'].push(t);localStorage.setItem('counselor_tags',JSON.stringify(cTags));closeModal();showToast('已添加','success');}">🏷️ 标签</button>
                <button class="btn btn-ghost btn-sm" onclick="cExportStudentReport('${escQs(sid)}');closeModal();">📋 导出报告</button></div></div>`,
        `<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
}

function cAddConversation(sid){
    const date=prompt('日期 (如 2026-06-06)：',new Date().toISOString().slice(0,10));if(!date)return;
    const topic=prompt('主题：','学业预警');if(!topic)return;
    const content=prompt('内容摘要：','');if(content===null)return;
    const followUp=prompt('跟进日期 (留空跳过)：','');
    if(!cConversations[sid])cConversations[sid]=[];
    cConversations[sid].unshift({date,topic,content,followUp,counselor:sessionStorage.getItem('eval_user')||'辅导员'});
    localStorage.setItem('counselor_conversations',JSON.stringify(cConversations));
    if(!cTags[sid])cTags[sid]=[];if(!cTags[sid].includes('已谈话'))cTags[sid].push('已谈话');
    localStorage.setItem('counselor_tags',JSON.stringify(cTags));
    showToast('已保存','success');closeModal();cShowStudentDetail(sid);
}

// ==================== B. COURSE-DATA NOTICES ====================
async function cGetStudentCourseData(sid){
    // First check full student map (populated after course analysis)
    if(cCourseStudentMap[sid])return cCourseStudentMap[sid];
    // Fallback: check failing_students array
    if(cCourseAnalysis&&cCourseAnalysis.success){
        const fs=cCourseAnalysis.failing_students||[];
        const found=fs.find(s=>s.id===sid);
        if(found)return found;
    }
    // Last resort: query backend directly
    if(cGradeFilePath){
        try{const r=await eel.get_student_course_scores(cGradeFilePath,sid)();if(r&&r.success)return r.student;}catch(e){}
    }
    return null;
}

// Override notice generator to include course data
const _cGenNoticeOrig=cGenerateNoticeV8;
cGenerateNoticeV8=async function(){
    cNoticeOptions.commentText=document.getElementById('notice-comment')?.value||'';cSaveNoticeOptions();
    const f=document.getElementById('notice-filter')?.value;let t=cData;
    if(f==='comp60')t=cData.filter(d=>(d.comp||0)<60);
    else if(f==='moral60')t=cData.filter(d=>(d.moral||0)<=60);
    else if(f==='starred')t=cData.filter(d=>cStarred[d.id]);
    else if(f==='failing'){
        // Use course-level data if available, otherwise fall back to comp<60
        if(Object.keys(cCourseStudentMap).length>0){
            t=cData.filter(d=>cCourseStudentMap[d.id]&&cCourseStudentMap[d.id].fail_count>0);
        }else{
            t=cData.filter(d=>(d.comp||0)<60);
        }
    }
    else if(f==='alert')t=cData.filter(d=>cGetAlertLevel('comp',d.comp||0)!=='safe');
    if(!t.length){showToast('没有匹配的学生','warning');return;}
    const cm={};cDataFull.forEach(x=>{const cls=x.class||'';if(!cm[cls])cm[cls]=[];cm[cls].push(x);});
    const classAvgs={};for(const[cls,sts]of Object.entries(cm)){classAvgs[cls]={gpa:(sts.reduce((a,b)=>a+(b.gpa||0),0)/sts.length).toFixed(2),moral:(sts.reduce((a,b)=>a+(b.moral||0),0)/sts.length).toFixed(0),comp:(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2)};}

    // Load course data in parallel (instant from cCourseStudentMap)
    let courseDataMap={};
    if(cNoticeOptions.includeFailed||cNoticeOptions.includeAllCourses){
        const targets=t.slice(0,20);
        const results=await Promise.all(targets.map(d=>cGetStudentCourseData(d.id)));
        targets.forEach((d,i)=>{if(results[i])courseDataMap[d.id]=results[i];});
    }

    let output='';
    t.slice(0,20).forEach((d,i)=>{const ca=classAvgs[d.class||'']||null;const ranked=[...cDataFull.filter(x=>x.class===d.class)].sort((a,b)=>(b.comp||0)-(a.comp||0));const rank=ranked.findIndex(x=>x.id===d.id)+1;const p=cPrevData.length?cPrevData.find(x=>x.id===d.id):null;
        const parts=[];
        if(cNoticeOptions.includeBasic)parts.push(`学生：${d.name||''}，学号${d.id||''}，${d.class||''}`);
        if(cNoticeOptions.includeGpa)parts.push(`学分绩点：${cFmt(d.gpa)}`);
        if(cNoticeOptions.includeMoral)parts.push(`德育分：${cFmt(d.moral,0)}`);
        if(cNoticeOptions.includeQuality)parts.push(`素拓分：${cFmt(d.quality,1)}`);
        if(cNoticeOptions.includeComp)parts.push(`综测成绩：${cFmt(d.comp)}`);
        if(cNoticeOptions.includeRank&&rank)parts.push(`班级排名：第${rank}名/共${ranked.length}人`);
        if(cNoticeOptions.includeCompare&&ca)parts.push(`班级均值：绩点${ca.gpa} / 德育${ca.moral} / 综测${ca.comp}`);
        if(cNoticeOptions.includeTrend&&p)parts.push(`上学期综测：${cFmt(p.comp)}，变化：${((d.comp||0)-(p.comp||0)>=0?'+':'')+cFmt((d.comp||0)-(p.comp||0))}`);
        // Course detail
        const cd=courseDataMap[d.id];
        if(cNoticeOptions.includeFailed&&cd&&cd.failed_courses&&cd.failed_courses.length>0){
            const failedDetails=cd.failed_courses.map(cn=>`${cn}(${cd.course_scores[cn]}分)`).join('、');
            parts.push(`⚠️ 挂科(${cd.fail_count}门)：${failedDetails}`);
        }else if(cNoticeOptions.includeFailed){parts.push('挂科情况：无');}
        if(cNoticeOptions.includeAllCourses&&cd&&cd.course_scores){
            const allCourses=Object.entries(cd.course_scores).map(([cn,sc])=>`${cn}:${sc}分`).join('，');
            parts.push(`各科成绩：${allCourses}`);
        }
        if(cNoticeOptions.includeComment&&cNoticeOptions.commentText)parts.push(`辅导员评语：${cNoticeOptions.commentText}`);
        output+=`${'='.repeat(45)}\n家长通知 — ${d.name||''}\n${'='.repeat(45)}\n您好！\n\n${parts.join('\n')}\n\n请家长关注学生学业，与学校共同努力。\n\n顿河学院团委秘书处\n\n`;
    });
    if(t.length>20)output+=`\n... 共${t.length}人，仅显示前20人预览`;
    document.getElementById('notice-output').value=output;
};

// ==================== C. STUDENT REPORT CARD ====================
async function cExportStudentReport(sid){
    const d=cData.find(x=>x.id===sid);if(!d){showToast('未找到学生','error');return;}
    const p=cPrevData.length?cPrevData.find(x=>x.id===sid):null;
    // Class averages
    const clsSts=cData.filter(x=>x.class===d.class);const n=clsSts.length;
    const classAvg=n?{gpa:(clsSts.reduce((a,b)=>a+(b.gpa||0),0)/n).toFixed(2),moral:(clsSts.reduce((a,b)=>a+(b.moral||0),0)/n).toFixed(0),comp:(clsSts.reduce((a,b)=>a+(b.comp||0),0)/n).toFixed(2)}:null;
    const ranked=clsSts.sort((a,b)=>(b.comp||0)-(a.comp||0));const rank=ranked.findIndex(x=>x.id===sid)+1;
    // Course data
    let courseData=null;
    if(cGradeFilePath||cCourseAnalysis){try{const r=await cGetStudentCourseData(sid);if(r)courseData=r;}catch(e){}}
    // Trend data
    let trendData=[];
    if(cPrevData.length)trendData.push({semester:'上学期',comp:cFmt(p?p.comp:null)});
    trendData.push({semester:'本学期',comp:cFmt(d.comp)});
    for(const [label,edata] of Object.entries(cExtraData)){const ed=(edata||[]).find(x=>x.id===sid);if(ed)trendData.push({semester:label,comp:cFmt(ed.comp)});}

    try{
        const path=await eel.get_student_report_card(
            {id:d.id,name:d.name,class:d.class,gpa:d.gpa,moral:d.moral,quality:d.quality,comp:d.comp,rank:rank},
            courseData,cSemesters[cSemesters.length-1]||'本学期',classAvg,trendData,''
        )();
        if(path&&!path.startsWith('ERROR')){eel.open_file_explorer(path)();showToast('个人报告已生成','success');}
        else{showToast('生成失败: '+path,'error');}
    }catch(e){showToast('导出出错: '+e,'error');}
}

// ==================== D. COURSE × CLASS HEATMAP ====================
function cRenderHeatmap(){
    if(!cCourseAnalysis||!cCourseAnalysis.success){showToast('请先运行成绩分析','warning');return;}
    const ca=cCourseAnalysis;const classes=ca.class_analysis.map(c=>c.class_name);
    const courses=ca.course_fail_ranking.slice(0,20).map(c=>c.course_name);
    const pcc=ca.per_class_course||{};
    // Build color scale
    function heatColor(avg){if(avg===undefined||avg===null)return'#1a1a2e';if(avg>=85)return'#00b894';if(avg>=75)return'#55efc4';if(avg>=65)return'#fdcb6e';if(avg>=55)return'#e17055';return'#d63031';}

    let html=`<div class="module-section" style="margin-top:16px;"><h3>🔥 课程×班级 成绩热力图</h3>
        <p style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">行=班级，列=课程（TOP20挂科率），颜色=平均分 🟢高 🔴低</p>
        <div style="overflow-x:auto;"><table class="data-table" style="font-size:9px;"><thead><tr><th>班级</th>${courses.map(cn=>`<th style="writing-mode:vertical-lr;min-width:28px;font-size:8px;max-width:60px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(cn)}">${escapeHtml(cn.length>12?cn.slice(0,10)+'...':cn)}</th>`).join('')}</tr></thead><tbody>`;
    for(const cls of classes){
        html+=`<tr><td style="font-weight:600;">${escapeHtml(cls)}</td>`;
        for(const cn of courses){
            const cd=(pcc[cls]||{})[cn];
            const avg=cd?cd.avg_score:undefined;
            html+=`<td style="background:${heatColor(avg)};text-align:center;padding:4px 6px;color:${avg&&avg<65?'#fff':'#1a1d26'};font-size:9px;" title="${escapeHtml(cn)} · ${cls}${cd?`\n均分:${avg} 挂科率:${cd.fail_rate}% 挂科:${cd.fail_count}/${cd.total}`:''}">${avg!==undefined?avg:'—'}</td>`;
        }
        html+=`</tr>`;
    }
    html+=`</tbody></table></div>
        <div style="display:flex;gap:8px;margin-top:8px;font-size:9px;align-items:center;">
            <span style="color:var(--text-muted);">色阶：</span>
            <span style="background:#00b894;color:#1a1d26;padding:2px 6px;border-radius:4px;">≥85 优秀</span>
            <span style="background:#55efc4;color:#1a1d26;padding:2px 6px;border-radius:4px;">75-84 良好</span>
            <span style="background:#fdcb6e;color:#1a1d26;padding:2px 6px;border-radius:4px;">65-74 中等</span>
            <span style="background:#e17055;color:#fff;padding:2px 6px;border-radius:4px;">55-64 及格</span>
            <span style="background:#d63031;color:#fff;padding:2px 6px;border-radius:4px;"><55 不及格</span>
        </div></div>`;
    return html;
}

// ==================== E. MULTI-SEMESTER TRENDS ====================
function cRenderMultiSemesterTrend(){
    const allData={'本学期':cData};if(cPrevData.length)allData['上学期']=cPrevData;
    for(const [label,edata] of Object.entries(cExtraData)){if(edata&&edata.length)allData[label]=edata;}
    const labels=Object.keys(allData);if(labels.length<2)return'<p style="color:var(--text-muted);text-align:center;padding:20px;">需要≥2个学期数据才能显示趋势</p>';

    // Aggregate by grade per semester
    const gradeMap={};
    labels.forEach(l=>{const sts=allData[l];sts.forEach(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);const g=m?m[1]+'级':'未知';if(!gradeMap[g])gradeMap[g]=[];if(!gradeMap[g].find(x=>x.label===l)){const gsts=sts.filter(x=>{const c=String(x.class||'');let mm=c.match(/(\d{2})\d{1,2}$/);if(!mm)mm=c.match(/(\d{2})级/);return(mm?mm[1]+'级':'未知')===g;});gradeMap[g].push({label:l,avg:(gsts.reduce((a,b)=>a+(b.comp||0),0)/gsts.length).toFixed(2)});}});});

    const grades=Object.keys(gradeMap).sort();
    let tableRows=grades.map(g=>{
        const pts=labels.map(l=>{const pt=gradeMap[g].find(x=>x.label===l);return pt?pt.avg:'—';});
        return`<tr><td><strong>${g}</strong></td>${pts.map(v=>`<td>${v}</td>`).join('')}</tr>`;
    }).join('');

    return`
        <div class="module-section" style="margin-top:16px;"><h3>📈 多学期趋势</h3><canvas id="chart-multi-trend"></canvas></div>
        <div class="module-section" style="margin-top:12px;"><h3>📋 学期数据表</h3>
            <table class="data-table striped-table" style="font-size:11px;"><thead><tr><th>年级</th>${labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
}

function cRenderMultiTrendChart(){
    const allData={'本学期':cData};if(cPrevData.length)allData['上学期']=cPrevData;
    for(const [label,edata] of Object.entries(cExtraData)){if(edata&&edata.length)allData[label]=edata;}
    const labels=Object.keys(allData);if(labels.length<2)return;
    const gradeMap={};
    labels.forEach(l=>{allData[l].forEach(d=>{const cls=String(d.class||'');let m=cls.match(/(\d{2})\d{1,2}$/);if(!m)m=cls.match(/(\d{2})级/);const g=m?m[1]+'级':'未知';if(!gradeMap[g])gradeMap[g]={};gradeMap[g][l]=(gradeMap[g][l]||[]).concat(d);});});
    const grades=Object.keys(gradeMap).sort();
    const datasets=grades.map((g,i)=>{const data=labels.map(l=>{const sts=gradeMap[g][l];return sts&&sts.length?(sts.reduce((a,b)=>a+(b.comp||0),0)/sts.length).toFixed(2):null;});return{label:g,data:data,borderColor:['#6c5ce7','#00cec9','#fdcb6e','#e17055','#0984e3','#00b894'][i%6],backgroundColor:'transparent',tension:0.3,fill:false};});

    const ctx=document.getElementById('chart-multi-trend')?.getContext('2d');
    if(ctx&&typeof Chart!=='undefined'){new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+ctx.raw}}}} });}
}

// ==================== F. STUDENT COMPARE ====================
let cCompareList=[];

function cToggleCompare(sid){
    const idx=cCompareList.indexOf(sid);
    if(idx>=0)cCompareList.splice(idx,1);else if(cCompareList.length<5)cCompareList.push(sid);
    else{showToast('最多选择5人','warning');return;}
    cRenderStudents();
}

function cShowCompare(){
    if(cCompareList.length<2){showToast('请至少选择2名学生（点击⭐旁的☐）','warning');return;}
    const selected=cCompareList.map(sid=>cData.find(x=>x.id===sid)).filter(Boolean);
    if(typeof showModal!=='function')return;

    const metrics=['gpa','moral','quality','comp'];const colors={gpa:'#6c5ce7',moral:'#00cec9',quality:'#fdcb6e',comp:'#e17055'};
    let html=`<div style="display:grid;grid-template-columns:repeat(${selected.length},1fr);gap:8px;margin-bottom:12px;">`;
    selected.forEach(d=>{
        const level=cGetAlertLevel('comp',d.comp||0);
        html+=`<div style="text-align:center;padding:12px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid ${cAlertLevelColor(level)};"><strong>${escapeHtml(d.name||'')}</strong><br><span style="font-size:10px;color:var(--text-muted);">${escapeHtml(d.class||'')}</span><br><span style="font-weight:700;color:${cAlertLevelColor(level)};">${cFmt(d.comp)}</span></div>`;
    });
    html+=`</div><div class="module-section" style="margin-top:8px;"><h4>📊 指标雷达对比</h4><canvas id="chart-compare-radar"></canvas></div>`;

    // Course comparison if available
    if(cCourseAnalysis&&cCourseAnalysis.success){
        html+=`<div class="module-section" style="margin-top:8px;"><h4>📉 挂科情况对比</h4>`;
        selected.forEach(d=>{
            const fs=(cCourseAnalysis.failing_students||[]).find(s=>s.id===d.id);
            html+=`<p style="font-size:11px;"><strong>${escapeHtml(d.name||'')}</strong>: ${fs?`挂${fs.fail_count}门 — ${fs.failed_courses.map(c=>escapeHtml(c)).join('、')}`:'<span style="color:var(--color-success);">无挂科 ✓</span>'}</p>`;
        });
        html+=`</div>`;
    }

    showModal('🔄 学生对比',html,`<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);

    setTimeout(()=>{
        const ctx=document.getElementById('chart-compare-radar')?.getContext('2d');
        if(ctx&&typeof Chart!=='undefined'){
            new Chart(ctx,{type:'bar',data:{labels:metrics,datasets:selected.map((d,i)=> ({label:d.name||d.id,data:metrics.map(m=>d[m]||0),backgroundColor:['#6c5ce7','#00cec9','#fdcb6e','#e17055','#0984e3'][i]}))},options:{responsive:true}});
        }
    },200);
}

function initCounselor(){}
