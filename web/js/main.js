/**
 * Main application — v2.3
 * Welcome page → Module selection → Module workspace
 * Time-based greetings (中俄英), auto theme, motivational quotes
 * Memory function, grade/major filter, persistent branding
 * Developer: 陈雨昂 · 顿河学院团委秘书处
 */

const APP_VERSION = '8.0.0';
let currentModule = 'gpa';
let inWorkspace = false;

// Module state memory — preserves data when switching modules
const moduleMemory = {
    gpa: null, moral: null, quality: null, comprehensive: null
};

// ============================================================
// Splash Screen
// ============================================================
function initSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const status = splash.querySelector('.splash-status');
    if (!splash) return;

    const steps = ['正在初始化...', '加载引擎...', '准备界面...', '即将完成...'];
    let step = 0;
    const interval = setInterval(() => {
        if (step < steps.length) { status.textContent = steps[step]; step++; }
    }, 350);

    setTimeout(() => {
        clearInterval(interval);
        status.textContent = '就绪';
        setTimeout(() => {
            splash.classList.add('hidden');
            setTimeout(() => {
                showRoleSelection();
            }, 400);
        }, 250);
    }, 1600);
}

// ============================================================
// Welcome Page
// ============================================================
function updateGreeting() {
    const h = new Date().getHours();
    let zh = '', ru = '', en = '';

    if (h >= 5 && h < 8) {
        zh = '早上好！亲爱的同学！'; ru = 'Доброе утро! Дорогие одноклассники!'; en = 'Good morning! Dear classmates!';
    } else if (h >= 8 && h < 11) {
        zh = '上午好！亲爱的同学！'; ru = 'Доброе утро! Дорогие одноклассники!'; en = 'Good morning! Dear classmates!';
    } else if (h >= 11 && h < 14) {
        zh = '中午好！亲爱的同学！'; ru = 'Добрый день! Дорогие одноклассники!'; en = 'Good afternoon! Dear classmates!';
    } else if (h >= 14 && h < 17) {
        zh = '下午好！亲爱的同学！'; ru = 'Добрый день! Дорогие одноклассники!'; en = 'Good afternoon! Dear classmates!';
    } else if (h >= 17 && h < 19) {
        zh = '傍晚好！亲爱的同学！'; ru = 'Добрый вечер! Дорогие одноклассники!'; en = 'Good evening! Dear classmates!';
    } else if (h >= 19 && h < 23) {
        zh = '晚上好！亲爱的同学！'; ru = 'Добрый вечер! Дорогие одноклассники!'; en = 'Good evening! Dear classmates!';
    } else if (h >= 23 || h < 3) {
        zh = '夜深了，注意休息！'; ru = 'Спокойной ночи! Берегите себя!'; en = 'Late night! Take care!';
    } else {
        zh = '清晨好！新的一天！'; ru = 'Доброе утро! Новый день!'; en = 'Early morning! A new day!';
    }

    const el = document.getElementById('welcome-greeting');
    el.querySelector('.greeting-main').textContent = zh;
    el.querySelector('.greeting-sub').textContent = ru;
    el.querySelector('.greeting-eng').textContent = en;
}

function showRandomQuote() {
    const quotes = [
        { text: '学如逆水行舟，不进则退。', ru: 'Учиться — всё равно что плыть против течения: остановился — и тебя относит назад.', emoji: '📚✨' },
        { text: '千里之行，始于足下。', ru: 'Путь в тысячу ли начинается с первого шага.', emoji: '🚀💪' },
        { text: '天道酬勤，厚德载物。', ru: 'Небо вознаграждает усердных.', emoji: '🌟🎯' },
        { text: '知之为知之，不知为不知，是知也。', ru: 'Знать, что знаешь, и знать, чего не знаешь — вот истинное знание.', emoji: '🧠💡' },
        { text: '三人行，必有我师焉。', ru: 'Среди трёх идущих обязательно найдётся мой учитель.', emoji: '👨‍🏫📖' },
        { text: '不积跬步，无以至千里。', ru: 'Не сделав и маленького шага, не пройдёшь и тысячи ли.', emoji: '👣🗺️' },
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    const el = document.getElementById('welcome-quote');
    el.style.display = 'block';
    el.querySelector('.quote-text').innerHTML = `「${q.text}」<br><span style="font-size:13px;opacity:0.7;">${q.ru}</span>`;
    el.querySelector('.quote-emoji').textContent = q.emoji;
}

// ============================================================
// Time-based Auto Theme
// ============================================================
let themeAutoTimer = null;

function applyTheme(theme, persist = false) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    if (persist) localStorage.setItem('theme_override', next);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.innerHTML = next === 'light' ? '🌙' : '☀️';
        btn.title = next === 'light' ? '切换到深色模式' : '切换到浅色模式';
        btn.setAttribute('aria-label', btn.title);
    });
}

function detectThemeByTime() {
    const h = new Date().getHours();
    const shouldBeLight = (h >= 6 && h < 18);
    const saved = localStorage.getItem('theme_override');
    applyTheme(saved === 'light' || saved === 'dark' ? saved : (shouldBeLight ? 'light' : 'dark'));
    if (themeAutoTimer) clearTimeout(themeAutoTimer);
    if (!saved) themeAutoTimer = setTimeout(detectThemeByTime, 600000);
}

// ============================================================
// Module Selection → Workspace
// ============================================================
function startWorking() {
    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('welcome-quote').style.display = 'none';
    renderTaskCenter();
}

// ============================================================
// Evaluation Task Center — UI organization only; scoring logic is untouched.
// ============================================================
const TASK_STORAGE_KEY = 'eval_measurement_tasks_v1';
const ACTIVE_TASK_KEY = 'eval_active_measurement_task';

function getEvaluationTasks() {
    try {
        const tasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '[]');
        return Array.isArray(tasks) ? tasks : [];
    } catch (e) { return []; }
}

function saveEvaluationTasks(tasks) {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
}

function ensureEvaluationTask() {
    let tasks = getEvaluationTasks();
    if (!tasks.length) {
        const now = new Date();
        const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
        tasks = [{
            id: 'task-' + Date.now(),
            name: `${year}-${year + 1}学年综合测评`,
            semester: now.getMonth() >= 7 ? '第一学期' : '第二学期',
            grade: '全部年级',
            status: '进行中',
            createdAt: Date.now()
        }];
        saveEvaluationTasks(tasks);
    }
    if (!localStorage.getItem(ACTIVE_TASK_KEY)) localStorage.setItem(ACTIVE_TASK_KEY, tasks[0].id);
    return tasks;
}

function getTaskModuleState() {
    const completed = window.CompletionCelebration?.state?.() || {};
    return Object.fromEntries(['gpa','moral','quality','comprehensive'].map(key => [key, Boolean(completed[key]?.done)]));
}

function renderTaskCenter() {
    const container = document.getElementById('task-center-content');
    if (!container) return;
    const tasks = ensureEvaluationTask();
    const activeId = localStorage.getItem(ACTIVE_TASK_KEY);
    const active = tasks.find(t => t.id === activeId) || tasks[0];
    const state = getTaskModuleState();
    const modules = [
        ['gpa', '01', '学分绩点', '导入成绩并生成绩点结果'],
        ['moral', '02', '德育测评', '汇总出勤、卫生与评议数据'],
        ['quality', '03', '素质拓展', '录入加分项目并执行上限管控'],
        ['comprehensive', '04', '综合测评', '汇总三项结果并生成排名'],
        ['toolbox', '05', '荣誉资格核验台', '评奖评优申报资格辅助核验']
    ];
    const readyCount = Object.values(state).filter(Boolean).length;
    const progress = readyCount * 25;
    const history = getHistory().slice(0, 4);
    const safe = value => String(value || '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

    container.innerHTML = `
        <section class="task-hero-card">
            <div class="task-hero-main">
                <div class="task-status-row"><span class="task-live-dot"></span>${safe(active.status)}<span>·</span><span>${safe(active.grade)}</span></div>
                <h2>${safe(active.name)}</h2>
                <p>${safe(active.semester)} · 当前任务中的四个模块继续使用原有计算规则</p>
                <div class="task-progress"><span style="width:${progress}%"></span></div>
                <small>完成进度 ${progress}% · ${readyCount}/4 项工作已经完成</small>
            </div>
            <div class="task-progress-ring" style="--task-progress:${progress * 3.6}deg"><strong>${progress}%</strong><span>任务进度</span></div>
        </section>
        <section class="task-center-section">
            <div class="task-section-heading"><div><span>工作流程</span><h2>继续处理当前任务</h2></div><small>建议按顺序完成，综合测评仍可独立进入</small></div>
            <div class="task-module-grid">
                ${modules.map(([key, no, title, desc]) => `
                    <button class="task-module-card" onclick="enterModule('${key}')">
                        <span class="task-module-number">${no}</span>
                        <span class="task-module-copy"><strong>${title}</strong><small>${desc}</small></span>
                        <span class="task-module-state ${state[key] ? 'ready' : ''}">${key==='toolbox'?'进入审核':(state[key] ? '已完成' : '待开始')}</span>
                        <span class="task-module-arrow">↗</span>
                    </button>`).join('')}
            </div>
        </section>
        <div class="task-lower-grid">
            <section class="task-center-section task-activity-card">
                <div class="task-section-heading"><div><span>最近动态</span><h2>处理记录</h2></div></div>
                <div class="task-activity-list">
                    ${history.length ? history.map(item => `<div><span class="task-activity-icon">✓</span><p><strong>${safe(item.summary || item.module || '完成数据处理')}</strong><small>${item.time ? new Date(item.time).toLocaleString('zh-CN') : '最近'}</small></p></div>`).join('') : '<div class="task-empty-line"><span>暂无处理记录，从上方选择一个模块开始。</span></div>'}
                </div>
            </section>
            <section class="task-center-section task-check-card">
                <div class="task-section-heading"><div><span>发布前检查</span><h2>结果可信度</h2></div></div>
                <ul class="task-check-list">
                    <li><span>1</span>确认导入文件与目标年级一致</li>
                    <li><span>2</span>在预览中检查缺失、重复与错配</li>
                    <li><span>3</span>导出前复核任务名称和学期</li>
                </ul>
            </section>
        </div>`;
}

function openCreateEvaluationTask() {
    const now = new Date();
    showModal('新建测评任务', `
        <div class="task-create-form">
            <div class="form-group"><label>任务名称</label><input id="task-name-input" class="input" value="${now.getFullYear()}-${now.getFullYear() + 1}学年综合测评"></div>
            <div class="form-row"><div class="form-group"><label>学期</label><select id="task-semester-input" class="select-input"><option>第一学期</option><option>第二学期</option><option>学年</option></select></div><div class="form-group"><label>年级范围</label><input id="task-grade-input" class="input" placeholder="例如：2025级" value="全部年级"></div></div>
            <p class="task-create-note">新建任务只整理工作入口，不会修改任何计算公式。</p>
        </div>`, `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createEvaluationTask()">创建任务</button>`);
}

function createEvaluationTask() {
    const name = document.getElementById('task-name-input').value.trim();
    const semester = document.getElementById('task-semester-input').value;
    const grade = document.getElementById('task-grade-input').value.trim() || '全部年级';
    if (!name) { showToast('请输入任务名称', 'warning'); return; }
    const tasks = getEvaluationTasks();
    const task = { id: 'task-' + Date.now(), name, semester, grade, status: '进行中', createdAt: Date.now() };
    tasks.unshift(task);
    saveEvaluationTasks(tasks);
    localStorage.setItem(ACTIVE_TASK_KEY, task.id);
    closeModal();
    renderTaskCenter();
    showToast('测评任务已创建', 'success');
}

// ============================================================
// Counselor Welcome Page V7.0
// ============================================================
function showCounselorWelcome() {
    document.getElementById('role-selection-page').style.display = 'none';
    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('counselor-page').style.display = 'none';
    document.getElementById('counselor-welcome-page').style.display = 'flex';
    document.getElementById('module-select-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    inWorkspace = false;
    updateCounselorGreeting();
    showCounselorRandomQuote();
    detectThemeByTime();
}

function updateCounselorGreeting() {
    const h = new Date().getHours();
    let zh = '', ru = '', en = '';

    if (h >= 5 && h < 8) {
        zh = '早上好！尊敬的老师！'; ru = 'Доброе утро, уважаемый преподаватель!'; en = 'Good morning, dear teacher!';
    } else if (h >= 8 && h < 11) {
        zh = '上午好！尊敬的老师！'; ru = 'Доброе утро, уважаемый преподаватель!'; en = 'Good morning, dear teacher!';
    } else if (h >= 11 && h < 14) {
        zh = '中午好！尊敬的老师！'; ru = 'Добрый день, уважаемый преподаватель!'; en = 'Good afternoon, dear teacher!';
    } else if (h >= 14 && h < 17) {
        zh = '下午好！尊敬的老师！'; ru = 'Добрый день, уважаемый преподаватель!'; en = 'Good afternoon, dear teacher!';
    } else if (h >= 17 && h < 19) {
        zh = '傍晚好！尊敬的老师！'; ru = 'Добрый вечер, уважаемый преподаватель!'; en = 'Good evening, dear teacher!';
    } else if (h >= 19 && h < 23) {
        zh = '晚上好！尊敬的老师！'; ru = 'Добрый вечер, уважаемый преподаватель!'; en = 'Good evening, dear teacher!';
    } else if (h >= 23 || h < 3) {
        zh = '夜深了，您辛苦了！'; ru = 'Спокойной ночи! Берегите себя!'; en = 'Late night! Take care!';
    } else {
        zh = '清晨好！新的一天！'; ru = 'Доброе утро! Новый день!'; en = 'Early morning! A new day!';
    }

    const el = document.getElementById('counselor-welcome-greeting');
    if (el) {
        el.querySelector('.greeting-main').textContent = zh;
        el.querySelector('.greeting-sub').textContent = ru;
        el.querySelector('.greeting-eng').textContent = en;
    }
}

function showCounselorRandomQuote() {
    const quotes = [
        { text: '教育是一棵树摇动另一棵树，一朵云推动另一朵云。', ru: 'Образование — это когда одно дерево раскачивает другое.', emoji: '🌳✨' },
        { text: '师者，所以传道授业解惑也。', ru: 'Учитель передаёт истину, обучает делу и разрешает сомнения.', emoji: '📖💡' },
        { text: '十年树木，百年树人。', ru: 'Дерево растят десять лет, а человека — сто лет.', emoji: '🎓🌟' },
        { text: '教学相长，知行合一。', ru: 'Учить и учиться — единый процесс, знать и делать — одно.', emoji: '🔄🎯' },
        { text: '桃李不言，下自成蹊。', ru: 'Хороший учитель привлекает учеников без лишних слов.', emoji: '🌸👣' },
        { text: '因材施教，有教无类。', ru: 'Обучать каждого по его способностям, не делая различий.', emoji: '🎨📚' },
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    const el = document.getElementById('counselor-welcome-quote');
    if (el) {
        el.style.display = 'block';
        el.querySelector('.quote-text').innerHTML = `「${q.text}」<br><span style="font-size:13px;opacity:0.7;">${q.ru}</span>`;
        el.querySelector('.quote-emoji').textContent = q.emoji;
    }
}

function startCounselorWork() {
    document.getElementById('counselor-welcome-page').style.display = 'none';
    showCounselorDashboard();
}

function enterModule(moduleName) {
    // Save current module state before switching
    if (inWorkspace && currentModule !== moduleName) {
        saveModuleState(currentModule);
    }

    currentModule = moduleName;
    inWorkspace = true;

    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'none';
    document.getElementById('app').style.display = '';

    const titles = { gpa: '学分绩点计算', moral: '德育分计算', quality: '素质拓展分计算', comprehensive: '综合测评计算', toolbox:'荣誉资格核验台', cloud:'学院云协作' };
    document.getElementById('module-title').textContent = titles[moduleName] || moduleName;

    // Show persistent widgets in workspace
    showCornerWidgets();

    const renderers = { gpa: renderModuleGPA, moral: renderModuleMoral, quality: renderModuleQuality, comprehensive: renderModuleComprehensive, toolbox:renderModuleToolbox, cloud: renderCloudWorkspace };
    if (renderers[moduleName]) renderers[moduleName]();
    setTimeout(function() { if (window.refreshEmojis) refreshEmojis(); }, 200);

    document.querySelectorAll('.nav-btn[data-module]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.module === moduleName);
    });

    initBackground();
    initKeyboard();

    // Restore module state if available
    setTimeout(() => restoreModuleState(moduleName), 200);
}

function saveModuleState(moduleName) {
    // Persist ALL state to localStorage
    saveAllToMemory();
    // Also update in-memory cache for cross-module switching
    if (moduleName === 'moral') {
        moduleMemory._moralFileLists = JSON.parse(JSON.stringify(
            typeof moralFileLists !== 'undefined' ? moralFileLists : {}));
        moduleMemory._moralReviewScores = JSON.parse(JSON.stringify(
            typeof moralReviewScores !== 'undefined' ? moralReviewScores : {}));
        moduleMemory._moralManualScores = JSON.parse(JSON.stringify(
            typeof moralManualScores !== 'undefined' ? moralManualScores : {}));
        moduleMemory._moralColumnMappings = JSON.parse(JSON.stringify(
            typeof moralColumnMappings !== 'undefined' ? moralColumnMappings : {}));
        moduleMemory._moralRoster = typeof moralRoster !== 'undefined'
            ? JSON.parse(JSON.stringify(moralRoster)) : {};
        moduleMemory._moralWorkspaceMode = typeof moralWorkspaceMode !== 'undefined' ? moralWorkspaceMode : 'continue';
        moduleMemory._moralExistingSource = typeof moralExistingSource !== 'undefined'
            ? JSON.parse(JSON.stringify({path:moralExistingSource.path || '', mappings:moralExistingSource.mappings || {}, scope_classes:moralExistingSource.scope_classes || []})) : {path:'',mappings:{},scope_classes:[]};
        moduleMemory._moralVnextItems = typeof moralVnextItems !== 'undefined'
            ? JSON.parse(JSON.stringify(moralVnextItems.map(item => ({...item, sources:(item.sources||[]).map(source => ({...source}))})))) : [];
        moduleMemory._moralFreshItems = typeof moralFreshItems !== 'undefined'
            ? JSON.parse(JSON.stringify(moralFreshItems.map(item => ({...item, sources:(item.sources||[]).map(source => ({...source}))})))) : [];
        moduleMemory._moralCloudOutputs = typeof moralCloudOutputs !== 'undefined'
            ? JSON.parse(JSON.stringify(moralCloudOutputs)) : [];
    }
    if (moduleName === 'quality') {
        moduleMemory._qualityRoster = typeof qualityRoster !== 'undefined'
            ? JSON.parse(JSON.stringify(qualityRoster)) : {};
        moduleMemory._qualityData = typeof qualityData !== 'undefined'
            ? JSON.parse(JSON.stringify(qualityData)) : {};
        moduleMemory._qualityThresholds = typeof qualityThresholds !== 'undefined'
            ? JSON.parse(JSON.stringify(qualityThresholds)) : [];
    }
}

function restoreModuleState(moduleName) {
    // Restore file paths from persistent memory
    const fp = moduleMemory._filePaths || {};
    if (moduleName === 'moral') {
        if (fp.moralRosterPath) {
            const el = document.getElementById('moral-roster-file');
            if (el && !el.value) { el.value = fp.moralRosterPath; el.classList.add('has-file'); }
        }
        if (fp.moralOutputDir) {
            const el = document.getElementById('moral-output-dir');
            if (el && !el.value) { el.value = fp.moralOutputDir; el.classList.add('has-file'); }
        }
        if (fp.moralVnextOutputDir) {
            const el = document.getElementById('moral-vnext-output-dir');
            if (el && !el.value) { el.value = fp.moralVnextOutputDir; el.classList.add('has-file'); }
        }
        if (moduleMemory._moralWorkspaceMode && typeof moralWorkspaceMode !== 'undefined') {
            moralWorkspaceMode = moduleMemory._moralWorkspaceMode;
            if (typeof moralSetWorkspaceMode === 'function') moralSetWorkspaceMode(moralWorkspaceMode);
        }
        if (moduleMemory._moralExistingSource && typeof moralExistingSource !== 'undefined') {
            moralExistingSource = JSON.parse(JSON.stringify(moduleMemory._moralExistingSource));
            const name = document.getElementById('moral-existing-name');
            const meta = document.getElementById('moral-existing-meta');
            if (name && moralExistingSource.path) name.textContent = moralExistingSource.path.split(/[\\/]/).pop();
            if (meta && moralExistingSource.path) meta.textContent = '映射已恢复 · 可重新检查';
            name?.closest('.moral-source-well')?.classList.toggle('has-source', Boolean(moralExistingSource.path));
        }
        if (moduleMemory._moralVnextItems && typeof moralVnextItems !== 'undefined') {
            moralVnextItems = JSON.parse(JSON.stringify(moduleMemory._moralVnextItems));
            if (typeof moralRenderVnextItems === 'function') moralRenderVnextItems();
        }
        if (moduleMemory._moralFreshItems && typeof moralFreshItems !== 'undefined') {
            moralFreshItems = JSON.parse(JSON.stringify(moduleMemory._moralFreshItems));
            if (typeof moralRenderFreshItems === 'function') moralRenderFreshItems();
        }
        if (moduleMemory._moralCloudOutputs && typeof moralCloudOutputs !== 'undefined') {
            moralCloudOutputs = JSON.parse(JSON.stringify(moduleMemory._moralCloudOutputs));
            if (moralCloudOutputs.length && typeof moralLastOutput !== 'undefined') {
                moralLastOutput = moralCloudOutputs[moralCloudOutputs.length - 1];
            }
        }
        if (moduleMemory._moralVnextScoring) {
            const scoring = moduleMemory._moralVnextScoring;
            [['moral-vnext-base',scoring.base],['moral-vnext-min',scoring.min],['moral-vnext-max',scoring.max]].forEach(([id,value]) => {
                const input = document.getElementById(id);
                if (input && Number.isFinite(Number(value))) input.value = value;
            });
            const basis = document.querySelector(`input[name="moral-continuation-basis"][value="${scoring.basis === 'display' ? 'display' : 'raw'}"]`);
            if (basis) basis.checked = true;
            if (typeof moralUpdateBasisCards === 'function') moralUpdateBasisCards();
        }
        if (moduleMemory._moralFreshScoring) {
            const scoring = moduleMemory._moralFreshScoring;
            [['moral-fresh-base',scoring.base],['moral-fresh-min',scoring.min],['moral-fresh-max',scoring.max]].forEach(([id,value]) => {
                const input = document.getElementById(id);
                if (input && Number.isFinite(Number(value))) input.value = value;
            });
        }
        if (typeof moralRefreshReadySummary === 'function') {
            moralRefreshReadySummary('continue');
            moralRefreshReadySummary('fresh');
        }
        // Restore ALL_MORAL_HEADERS from persistent memory
        if (moduleMemory._ALL_MORAL_HEADERS && typeof ALL_MORAL_HEADERS !== 'undefined') {
            ALL_MORAL_HEADERS.length = 0;
            Array.prototype.push.apply(ALL_MORAL_HEADERS, moduleMemory._ALL_MORAL_HEADERS);
            if (typeof moralRenderColumnSelector === 'function') moralRenderColumnSelector();
            if (typeof moralRenderManualFields === 'function') moralRenderManualFields();
        }
        if (moduleMemory._moralSelectedColumns && typeof moralSelectedColumns !== 'undefined') {
            moralSelectedColumns = moduleMemory._moralSelectedColumns;
        }
        if (moduleMemory._moralExportGradeFilter && typeof moralExportGradeFilter !== 'undefined') {
            moralExportGradeFilter = moduleMemory._moralExportGradeFilter;
        }
        // Restore file lists and re-render each
        if (moduleMemory._moralFileLists && typeof moralFileLists !== 'undefined') {
            Object.assign(moralFileLists, moduleMemory._moralFileLists);
            for (const catId of Object.keys(moralFileLists)) {
                if (typeof moralRenderFileList === 'function') moralRenderFileList(catId);
            }
        }
        // Restore review scores and manual scores
        if (moduleMemory._moralReviewScores && typeof moralReviewScores !== 'undefined') {
            Object.assign(moralReviewScores, moduleMemory._moralReviewScores);
        }
        if (moduleMemory._moralManualScores && typeof moralManualScores !== 'undefined') {
            Object.assign(moralManualScores, moduleMemory._moralManualScores);
        }
        if (moduleMemory._moralColumnMappings && typeof moralColumnMappings !== 'undefined') {
            Object.assign(moralColumnMappings, moduleMemory._moralColumnMappings);
        }
        // Re-render manual list and column selector
        if (typeof moralRenderManualList === 'function') moralRenderManualList();
        if (typeof moralRenderColumnSelector === 'function') moralRenderColumnSelector();
        // Re-populate roster dropdowns if roster was imported
        if (moduleMemory._moralRoster && typeof moralRoster !== 'undefined') {
            Object.assign(moralRoster, moduleMemory._moralRoster);
            if (Object.keys(moralRoster).length > 0) {
                const sel = document.getElementById('moral-class-sel');
                if (sel && sel.options.length <= 1) {
                    const classes = new Set();
                    for (const info of Object.values(moralRoster)) classes.add(info.class);
                    [...classes].sort().forEach(cls => {
                        const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o);
                    });
                }
                const statusEl = document.getElementById('moral-roster-status');
                if (statusEl && Object.keys(moralRoster).length > 0) {
                    statusEl.textContent = `已导入 ${Object.keys(moralRoster).length} 名学生`;
                }
                const manualSection = document.getElementById('moral-manual-section');
                if (manualSection) manualSection.style.display = 'block';
            }
        }
    }
    if (moduleName === 'quality') {
        if (fp.qualityRosterPath) {
            const el = document.getElementById('quality-roster-file');
            if (el && !el.value) { el.value = fp.qualityRosterPath; el.classList.add('has-file'); }
        }
        if (fp.qualityOutputDir) {
            const el = document.getElementById('quality-output-dir');
            if (el && !el.value) { el.value = fp.qualityOutputDir; el.classList.add('has-file'); }
        }
        if (moduleMemory._qualityRoster && typeof qualityRoster !== 'undefined') {
            Object.assign(qualityRoster, moduleMemory._qualityRoster);
            // Re-populate class dropdown
            if (Object.keys(qualityRoster).length > 0) {
                const sel = document.getElementById('quality-class-sel');
                if (sel && sel.options.length <= 1) {
                    const classes = new Set();
                    for (const info of Object.values(qualityRoster)) classes.add(info.class);
                    [...classes].sort().forEach(cls => {
                        const o = document.createElement('option'); o.value = cls; o.textContent = cls; sel.appendChild(o);
                    });
                }
                const rosterStatus = document.getElementById('quality-roster-status');
                if (rosterStatus) rosterStatus.textContent =
                    `已导入 ${Object.keys(qualityRoster).length} 名学生`;
                const entrySection = document.getElementById('quality-entry-section');
                if (entrySection) entrySection.style.display = 'block';
            }
        }
        if (moduleMemory._qualityData && typeof qualityData !== 'undefined') {
            Object.assign(qualityData, moduleMemory._qualityData);
        }
        if (moduleMemory._qualityThresholds && typeof qualityThresholds !== 'undefined') {
            qualityThresholds = moduleMemory._qualityThresholds;
            if (typeof qualityRenderThresholds === 'function') qualityRenderThresholds();
        }
    }
}

function showCornerWidgets() {
    // Logo is in sidebar (handled by HTML/CSS) — no fixed overlay needed
    const cornerLogo = document.getElementById('corner-logo');
    if (cornerLogo) cornerLogo.style.display = 'none';

    // Put rotating quote inside module-container (scrolls with content)
    const container = document.getElementById('module-container');
    const existingQuote = document.getElementById('corner-quote');
    if (existingQuote && existingQuote.parentElement === container) return; // already added

    const quotes = [
        { zh: '学如逆水行舟，不进则退。', ru: 'Учиться — всё равно что плыть против течения.' },
        { zh: '千里之行，始于足下。', ru: 'Путь в тысячу ли начинается с первого шага.' },
        { zh: '天道酬勤，厚德载物。', ru: 'Небо вознаграждает усердных.' },
        { zh: '三人行，必有我师焉。', ru: 'Среди трёх идущих обязательно найдётся мой учитель.' },
        { zh: '不积跬步，无以至千里。', ru: 'Не сделав и маленького шага, не пройдёшь и тысячи ли.' },
        { zh: '博学之，审问之，慎思之，明辨之，笃行之。', ru: 'Широко учиться, тщательно исследовать, осторожно размышлять.' },
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];

    // Move quote widget into scrollable container
    if (existingQuote && container && existingQuote.parentElement !== container) {
        existingQuote.style.display = 'block';
        existingQuote.querySelector('.corner-quote-text').innerHTML = `「${q.zh}」<br>${q.ru}`;
        container.appendChild(existingQuote);
        // Rotate every 5 min
        if (!existingQuote._quoteInterval) {
            existingQuote._quoteInterval = setInterval(() => {
                const nq = quotes[Math.floor(Math.random() * quotes.length)];
                existingQuote.querySelector('.corner-quote-text').innerHTML = `「${nq.zh}」<br>${nq.ru}`;
            }, 300000);
        }
    }
}

function backToModuleSelect() {
    // Save state before leaving workspace
    if (inWorkspace) {
        saveModuleState(currentModule);
    }
    inWorkspace = false;
    document.getElementById('app').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'flex';
    document.getElementById('welcome-page').style.display = 'none';
    renderTaskCenter();
}

// ============================================================
// Navigation (in workspace)
// ============================================================
function switchModule(moduleName) {
    if (!inWorkspace) return;
    if (currentModule === moduleName) return;

    // Save state before switching
    saveModuleState(currentModule);

    currentModule = moduleName;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.module === moduleName);
    });
    const titles = { gpa: '学分绩点计算', moral: '德育分计算', quality: '素质拓展分计算', comprehensive: '综合测评计算', toolbox:'荣誉资格核验台', cloud:'学院云协作', settings: '系统设置' };
    document.getElementById('module-title').textContent = titles[moduleName] || moduleName;
    const renderers = { gpa: renderModuleGPA, moral: renderModuleMoral, quality: renderModuleQuality, comprehensive: renderModuleComprehensive, toolbox:renderModuleToolbox, cloud: renderCloudWorkspace, settings: renderSettings };
    const container = document.getElementById('module-container');
    if (renderers[moduleName]) {
        // Always re-render to get fresh DOM + event handlers, then restore data
        container.style.opacity = '0';
        setTimeout(() => {
            renderers[moduleName]();
            // Restore data state AFTER rendering (so DOM exists)
            restoreModuleState(moduleName);
            container.style.opacity = '1';
            initBackground();
        }, 120);
    }
}

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const m = btn.dataset.module;
            if (m) switchModule(m);
        });
    });
}

// ============================================================
// Settings
// ============================================================
function renderSettings() {
    const user = sessionStorage.getItem('eval_user') || '未选择';
    const role = sessionStorage.getItem('eval_role') === 'secretary' ? '秘书处' : '辅导员';
    document.getElementById('module-container').innerHTML = `
        <div class="module-section"><h2>关于</h2>
            <div style="color:var(--text-secondary);font-size:13px;line-height:1.8;">
                <p><strong>学生综合测评系统</strong> v${APP_VERSION}</p>
                <p>开发者: <strong>陈雨昂</strong></p>
                <p>所属: <strong>顿河学院团委秘书处</strong></p>
                <p>用于自动化计算学生学分绩点、德育分、素质拓展分和综合测评成绩。</p>
            </div></div>
        <div class="module-section"><h2>外观</h2>
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:13px;color:var(--text-secondary);">主题模式:</span>
                <button class="btn btn-secondary btn-sm" onclick="toggleThemeManual()" id="theme-toggle-btn">
                    ${document.documentElement.getAttribute('data-theme') === 'light' ? '🌙 深色模式' : '☀️ 浅色模式'}
                </button>
            </div></div>
        <div class="module-section"><h2>工具</h2>
            <button class="btn btn-secondary btn-sm" onclick="showStatsDashboard()">📊 数据分析</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="showCompare()">📈 学期对比</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="showHistory()">📜 历史</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="showOperationLog()">📝 日志</button>
        </div>
        <div class="module-section"><h2>导出与备份</h2>
            <button class="btn btn-secondary btn-sm" onclick="exportBackup()">💾 备份数据</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="importBackup()">📥 恢复数据</button>
        </div>
        <div class="module-section"><h3>🔄 软件更新</h3>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">拿到新版exe后，在这里选择文件即可一键更新，无需卸载重装。</p>
            <button class="btn btn-teal btn-sm" onclick="checkForUpdates()">📂 选择更新文件</button>
            <span style="font-size:10px;color:var(--text-muted);margin-left:8px;">当前版本: v${APP_VERSION}</span></div>
        <div class="module-section"><h2>帮助</h2>
            <button class="btn btn-ghost btn-sm" onclick="showChangelog()">📋 更新日志</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="showOnboarding()">👋 新手指引</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="printReport()">🖨️ 打印报告</button>
        </div>
        <div class="module-section"><h2>用户</h2>
            <div style="font-size:12px;color:var(--text-secondary);line-height:2;">
                <p>当前用户: <strong id="settings-current-user">—</strong></p>
                <p>角色: <strong id="settings-current-role">—</strong></p>
                <button class="btn btn-secondary btn-sm" onclick="doLogout()">切换身份</button>
            </div></div>`;
    // Update user info after render
    setTimeout(() => {
        const uEl = document.getElementById('settings-current-user');
        const rEl = document.getElementById('settings-current-role');
        if (uEl) uEl.textContent = user;
        if (rEl) rEl.textContent = role;
    }, 50);
}

// ============================================================
// Update / Changelog / Onboarding / Output Dialog
// ============================================================
function doLogout() {
    sessionStorage.removeItem('eval_logged_in');
    sessionStorage.removeItem('eval_user');
    sessionStorage.removeItem('eval_role');
    document.getElementById('app').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'none';
    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('counselor-page').style.display = 'none';
    document.getElementById('counselor-welcome-page').style.display = 'none';
    showRoleSelection();
    showToast('请选择身份', 'info');
}

// ============================================================
// V8.2: Local File Update System
// ============================================================
async function autoCheckUpdates() {
    // Silent - no network check needed for local app
    // Future: could check a network path if configured
}

async function checkForUpdates() {
    // Let user select the new exe file
    eel.select_file([['可执行文件', '*.exe']], '选择新版本的exe文件')(async (fp) => {
        if (!fp) return;
        // Verify it's a valid new exe
        try {
            const v = await eel.verify_new_exe(fp)();
            if (!v || !v.valid) {
                showToast('文件无效: ' + (v?.error || '未知错误'), 'error');
                return;
            }
            if (!confirm(`即将安装更新:\n\n文件: ${v.filename}\n大小: ${(v.size/1024/1024).toFixed(1)} MB\n\n应用将自动重启。确认继续？`)) return;

            showToast('正在准备更新...应用即将重启', 'success');
            setTimeout(async () => {
                await eel.install_local_update(fp)();
            }, 500);
        } catch (e) {
            showToast('更新失败: ' + e, 'error');
        }
    });
}
function showChangelog() {
    showModal('📋 更新日志 — 学生综合测评系统',
        `<div style="font-size:12px;line-height:2;max-height:55vh;overflow-y:auto;">
            <h4 style="color:var(--accent-primary);margin:8px 0;">v8.0.0 — 2026.06.07 🎉</h4>
            <p>📅 <strong>多学期追踪</strong>：支持导入多个历史学期，追踪长期趋势</p>
            <p>📉 <strong>单学期成绩分析</strong>：班级对比、挂科率排名、课程挂科率、成绩分布图</p>
            <p>📧 <strong>家长通知单</strong>：依据成绩数据一键批量生成规范通知</p>
            <p>💬 <strong>谈话记录管理</strong>：学生详情页添加谈话记录，支持日期+主题+内容+跟进</p>
            <p>⚠️ <strong>多级预警体系</strong>：安全→关注→预警→危险→严重 五级分层</p>
            <p>🏫 <strong>班级对比排行</strong>：总览页班级综测排行，大屏展示班级维度</p>
            <p>🔍 <strong>智能文件检测</strong>：自动识别文件名中的学期、年级、专业</p>
            <p>📊 <strong>深度数据看板</strong>：标准差分析、综测分布、年级对比</p>
            <p>🎨 <strong>UI全面升级</strong>：斑马纹表格、空状态设计、卡片入场动画、多级颜色标识</p>
            <hr style="border-color:var(--border-thin);margin:8px 0;">
            <h4 style="color:var(--accent-primary);margin:8px 0;">v6.1.0 — 2026.06.06</h4>
            <p>辅导员工作台：5标签(总览/学生/预警/工具/设置)、双文件导入、对比图表、进步榜、大屏展示</p>
            <p>🔐 多用户登录、结果预览编辑、持久记忆与快捷键</p>
            <hr style="border-color:var(--border-thin);margin:8px 0;">
            <p><strong>v2.3.0</strong> — 记忆功能、Logo常驻、名言轮播、分专业年级导出、德育增强</p>
            <p><strong>v2.2.0</strong> — 首页重设计、时间问候(中俄英)、自动主题切换</p>
            <p><strong>v2.0.0</strong> — 数据匹配重写与新手指引</p>
            <p><strong>v1.0.0</strong> — 首个正式版本 · 陈雨昂</p>
        </div>`, `<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
}
function showOnboarding() {
    const body = document.getElementById('onboarding-body');
    body.innerHTML = `<p>1. 在首页点击"开始工作"</p><p>2. 选择需要的功能模块</p><p>3. 按提示导入文件并处理</p><p>4. 导出结果表格</p>`;
    document.getElementById('onboarding-overlay').classList.remove('hidden');
}
function closeOnboarding() { document.getElementById('onboarding-overlay').classList.add('hidden'); }
function skipFutureOnboarding() { if (document.getElementById('onboarding-skip').checked) localStorage.setItem('onboarding_seen', '1'); }

function showOutputDialog(success, message, filePaths = []) {
    const overlay = document.getElementById('output-dialog-overlay');
    const title = document.getElementById('output-dialog-title');
    const body = document.getElementById('output-dialog-body');
    const footer = document.getElementById('output-dialog-footer');
    if (success) {
        title.innerHTML = '✅ 处理成功'; title.style.color = 'var(--color-success)';
        body.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;">${message}</p>`;
        let btns = `<button class="btn btn-ghost btn-sm" onclick="document.getElementById('output-dialog-overlay').classList.add('hidden')">关闭</button>`;
        for (const fp of filePaths) {
            btns += `<button class="btn btn-teal btn-sm" onclick="eel.open_file_explorer('${fp.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')()">📂 ${escapeHtml(fp.split(/[\\/]/).pop())}</button>`;
        }
        if (filePaths.length > 0) {
            const d = filePaths[0].substring(0, filePaths[0].lastIndexOf('\\'));
            btns += `<button class="btn btn-secondary btn-sm" onclick="eel.open_file_explorer('${d.replace(/\\/g,'\\\\')}')()">📁 文件夹</button>`;
        }
        footer.innerHTML = btns;
    } else {
        title.innerHTML = '❌ 处理失败'; title.style.color = 'var(--color-error)';
        body.innerHTML = `<p style="color:var(--color-error);font-size:13px;">${escapeHtml(message)}</p>`;
        footer.innerHTML = `<button class="btn btn-primary btn-sm" onclick="document.getElementById('output-dialog-overlay').classList.add('hidden')">关闭</button>`;
    }
    overlay.classList.remove('hidden');
}

function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ============================================================
// Background / Theme / Keyboard
// ============================================================
function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas || canvas._initialized) return;
    canvas._initialized = true;
    const ctx = canvas.getContext('2d');
    let particles = Array.from({length: 40}, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.5, sx: (Math.random() - 0.5) * 0.3, sy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.3 + 0.1,
    }));
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.x += p.sx; p.y += p.sy;
            if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(108,92,231,${p.o})`; ctx.fill();
        }
        requestAnimationFrame(animate);
    }
    animate();
}

function initThemeToggle() {
    const h = document.getElementById('header'); if (!h) return;
    const btn = document.createElement('button'); btn.className = 'theme-toggle';
    btn.title = '切换主题'; btn.innerHTML = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
    btn.onclick = () => {
        const cur = document.documentElement.getAttribute('data-theme');
        applyTheme(cur === 'light' ? 'dark' : 'light', true);
    };
    h.querySelector('.header-actions').insertBefore(btn, h.querySelector('.header-actions').firstChild);
}

function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const mods = ['gpa', 'moral', 'quality', 'comprehensive'];
            if (inWorkspace) switchModule(mods[parseInt(e.key) - 1]);
        }
    });
}

// ============================================================
// Persistent Memory — save/restore across app restarts
// ============================================================
const MEMORY_KEY = 'student_eval_memory_v2';

function saveAllToMemory() {
    const data = {
        _v: 2,
        _ts: Date.now(),
        // Moral module
        moralFileLists: safeGet(() => moralFileLists, {}),
        moralReviewScores: safeGet(() => moralReviewScores, {}),
        moralManualScores: safeGet(() => moralManualScores, {}),
        moralColumnMappings: safeGet(() => moralColumnMappings, {}),
        moralRoster: safeGet(() => moralRoster, {}),
        moralSelectedColumns: safeGet(() => moralSelectedColumns, null),
        ALL_MORAL_HEADERS: safeGet(() => ALL_MORAL_HEADERS, null),
        moralExportGradeFilter: safeGet(() => moralExportGradeFilter, 'all'),
        moralWorkspaceMode: safeGet(() => moralWorkspaceMode, 'continue'),
        moralExistingSource: safeGet(() => ({path:moralExistingSource.path || '', mappings:moralExistingSource.mappings || {}, scope_classes:moralExistingSource.scope_classes || []}), {path:'',mappings:{},scope_classes:[]}),
        moralVnextItems: safeGet(() => moralVnextItems.map(item => ({...item, sources:(item.sources||[]).map(source => ({...source}))})), []),
        moralFreshItems: safeGet(() => moralFreshItems.map(item => ({...item, sources:(item.sources||[]).map(source => ({...source}))})), []),
        moralCloudOutputs: safeGet(() => [...moralCloudOutputs], []),
        moralVnextScoring: {
            base: Number(document.getElementById('moral-vnext-base')?.value ?? 115),
            min: Number(document.getElementById('moral-vnext-min')?.value ?? 0),
            max: Number(document.getElementById('moral-vnext-max')?.value ?? 115),
            basis: document.querySelector('input[name="moral-continuation-basis"]:checked')?.value || 'raw',
        },
        moralFreshScoring: {
            base: Number(document.getElementById('moral-fresh-base')?.value ?? 80),
            min: Number(document.getElementById('moral-fresh-min')?.value ?? 0),
            max: Number(document.getElementById('moral-fresh-max')?.value ?? 115),
        },
        // Quality module
        qualityRoster: safeGet(() => qualityRoster, {}),
        qualityData: safeGet(() => qualityData, {}),
        qualityThresholds: safeGet(() => qualityThresholds, []),
        // Comprehensive module
        compColumnMappings: safeGet(() => compColumnMappings, {}),
        // UI state
        theme_override: localStorage.getItem('theme_override') || '',
        // File inputs (restore on enter)
        moralRosterPath: document.getElementById('moral-roster-file')?.value || '',
        moralOutputDir: document.getElementById('moral-output-dir')?.value || '',
        moralVnextOutputDir: document.getElementById('moral-vnext-output-dir')?.value || '',
        qualityRosterPath: document.getElementById('quality-roster-file')?.value || '',
        qualityOutputDir: document.getElementById('quality-output-dir')?.value || '',
        gpaOutputDir: safeGet(() => document.getElementById('gpa-output-dir')?.value, ''),
        compOutputDir: document.getElementById('comp-output-dir')?.value || '',
    };
    try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(data));
    } catch(e) {
        // localStorage full or unavailable
    }
}

function safeGet(fn, fallback) {
    try { const v = fn(); return v !== undefined ? v : fallback; }
    catch(e) { return fallback; }
}

function restoreAllFromMemory() {
    try {
        const raw = localStorage.getItem(MEMORY_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || data._v !== 2) return;

        // Restore to global moduleMemory (picked up when modules render)
        if (data.moralFileLists) moduleMemory._moralFileLists = data.moralFileLists;
        if (data.moralReviewScores) moduleMemory._moralReviewScores = data.moralReviewScores;
        if (data.moralManualScores) moduleMemory._moralManualScores = data.moralManualScores;
        if (data.moralColumnMappings) moduleMemory._moralColumnMappings = data.moralColumnMappings;
        if (data.moralRoster) moduleMemory._moralRoster = data.moralRoster;
        if (data.moralSelectedColumns) moduleMemory._moralSelectedColumns = data.moralSelectedColumns;
        if (data.ALL_MORAL_HEADERS) moduleMemory._ALL_MORAL_HEADERS = data.ALL_MORAL_HEADERS;
        if (data.moralExportGradeFilter) moduleMemory._moralExportGradeFilter = data.moralExportGradeFilter;
        if (data.moralWorkspaceMode) moduleMemory._moralWorkspaceMode = data.moralWorkspaceMode;
        if (data.moralExistingSource) moduleMemory._moralExistingSource = data.moralExistingSource;
        if (data.moralVnextItems) moduleMemory._moralVnextItems = data.moralVnextItems;
        if (data.moralVnextScoring) moduleMemory._moralVnextScoring = data.moralVnextScoring;
        if (data.moralFreshItems) moduleMemory._moralFreshItems = data.moralFreshItems;
        if (data.moralFreshScoring) moduleMemory._moralFreshScoring = data.moralFreshScoring;
        if (data.moralCloudOutputs) {
            moduleMemory._moralCloudOutputs = data.moralCloudOutputs;
            if (typeof moralCloudOutputs !== 'undefined') {
                moralCloudOutputs = JSON.parse(JSON.stringify(data.moralCloudOutputs));
                if (moralCloudOutputs.length && typeof moralLastOutput !== 'undefined') {
                    moralLastOutput = moralCloudOutputs[moralCloudOutputs.length - 1];
                }
            }
        }
        if (data.qualityRoster) moduleMemory._qualityRoster = data.qualityRoster;
        if (data.qualityData) moduleMemory._qualityData = data.qualityData;
        if (data.qualityThresholds) moduleMemory._qualityThresholds = data.qualityThresholds;
        if (data.compColumnMappings) moduleMemory._compColumnMappings = data.compColumnMappings;

        // Restore file paths on next module enter
        moduleMemory._filePaths = {
            gpaOutputDir: data.gpaOutputDir || '',
            moralRosterPath: data.moralRosterPath || '',
            moralOutputDir: data.moralOutputDir || '',
            moralVnextOutputDir: data.moralVnextOutputDir || '',
            qualityRosterPath: data.qualityRosterPath || '',
            qualityOutputDir: data.qualityOutputDir || '',
            compOutputDir: data.compOutputDir || '',
        };

        console.log('记忆恢复成功 ('
            + Math.round((Date.now() - data._ts) / 60000) + '分钟前保存)');
    } catch(e) {}
}

// Auto-save periodically
setInterval(saveAllToMemory, 30000);
// Save on page unload
window.addEventListener('beforeunload', saveAllToMemory);

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();
    initNavigation();
    detectThemeByTime();
    restoreAllFromMemory();
    document.getElementById('app-version').textContent = 'v' + APP_VERSION;
    console.log('学生综合测评系统 v' + APP_VERSION + ' — 陈雨昂 · 顿河学院团委秘书处');

    // Modal click-outside-to-close
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-locked') && !e.target.closest('.modal-card')) {
            e.target.classList.add('hidden');
        }
    });

    // Esc key closes all modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(ov => {
                if (!ov.classList.contains('modal-locked') && !ov.id.includes('preview') && !ov.id.includes('stats')) {
                    ov.classList.add('hidden');
                }
            });
            // Also close preview and stats overlays
            const previewEl = document.getElementById('preview-overlay');
            if (previewEl && !previewEl.classList.contains('hidden')) previewEl.classList.add('hidden');
            const statsEl = document.getElementById('stats-overlay');
            if (statsEl && !statsEl.classList.contains('hidden')) statsEl.classList.add('hidden');
            const compareEl = document.getElementById('compare-overlay');
            if (compareEl && !compareEl.classList.contains('hidden')) compareEl.classList.add('hidden');
        }
    });

    // Auto-check for updates (silent, only notify if available)
    setTimeout(() => autoCheckUpdates(), 3000);

    initKeyboardShortcuts();
});

// ============================================================
// Identity selection — local desktop app, no account verification required
// ============================================================
function showRoleSelection() {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('welcome-page').style.display = 'none';
    document.getElementById('counselor-welcome-page').style.display = 'none';
    document.getElementById('counselor-page').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('role-selection-page').style.display = 'flex';
    inWorkspace = false;
}

function selectRole(role) {
    if (role !== 'secretary' && role !== 'counselor') return;
    const roleName = role === 'secretary' ? '秘书处' : '辅导员';
    sessionStorage.setItem('eval_logged_in', '1');
    sessionStorage.setItem('eval_user', roleName);
    sessionStorage.setItem('eval_role', role);
    document.getElementById('role-selection-page').style.display = 'none';

    if (role === 'counselor') {
        showCounselorWelcome();
    } else {
        showWelcome();
    }
    showToast(`欢迎进入${roleName}端`, 'success');
}

// ============================================================
// V3.0: Recent Files + Welcome Quick Entry
// ============================================================
function getRecentFiles() {
    try { return JSON.parse(localStorage.getItem('eval_recent_files') || '[]'); }
    catch(e) { return []; }
}
function addRecentFile(type, path, label) {
    if (!path) return;
    let files = getRecentFiles();
    files = files.filter(f => f.path !== path);
    files.unshift({ type, path, label, time: Date.now() });
    if (files.length > 20) files = files.slice(0, 20);
    localStorage.setItem('eval_recent_files', JSON.stringify(files));
}

// ============================================================
// V3.0: History Panel
// ============================================================
function getHistory() {
    try { return JSON.parse(localStorage.getItem('eval_history') || '[]'); }
    catch(e) { return []; }
}
function addHistory(module, summary, files) {
    let h = getHistory();
    h.unshift({ module, summary, files, time: Date.now() });
    if (h.length > 50) h = h.slice(0, 50);
    localStorage.setItem('eval_history', JSON.stringify(h));
}
function showHistory() {
    const h = getHistory();
    let html = h.length === 0 ? '<p style="color:var(--text-muted);text-align:center;">暂无记录</p>' : '';
    for (const entry of h.slice(0, 20)) {
        const dt = new Date(entry.time);
        html += `<div style="padding:6px 0;border-bottom:var(--border-thin);font-size:11px;">
            <strong>${escapeHtml(entry.module)}</strong> ${escapeHtml(entry.summary)}
            <span style="color:var(--text-muted);float:right;">${dt.toLocaleString('zh-CN')}</span></div>`;
    }
    showModal('📜 历史记录', `<div style="max-height:50vh;overflow-y:auto;">${html}</div>
        ${h.length > 0 ? `<button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="clearHistory()">清空记录</button>` : ''}`,
        `<button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
}
function clearHistory() { localStorage.removeItem('eval_history'); closeModal(); showToast('已清空'); }

// ============================================================
// V3.0: Result Preview + Real-time Edit
// ============================================================
let previewData = null;      // {headers: [], rows: [[...]], outputPath: ''}
let previewUndoStack = [];
let previewFilePath = '';

function showPreview(data, outputPath) {
    previewData = { headers: [...data.headers], rows: data.rows.map(r => [...r]), outputPath };
    previewUndoStack = [];
    previewFilePath = outputPath;
    renderPreview();
    renderPreviewStats();
    document.getElementById('preview-overlay').classList.remove('hidden');
}

function renderPreview() {
    const body = document.getElementById('preview-body');
    if (!previewData) return;
    const { headers, rows } = previewData;
    let html = '<table class="data-table" style="font-size:11px;"><thead><tr>';
    html += '<th>#</th>';
    headers.forEach((h, i) => { html += `<th>${escapeHtml(h)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach((row, ri) => {
        html += '<tr>';
        html += `<td style="color:var(--text-muted);">${ri + 1}</td>`;
        row.forEach((cell, ci) => {
            html += `<td contenteditable="true" onblur="previewCellEdit(${ri},${ci},this.textContent)"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                     style="min-width:60px;">${escapeHtml(String(cell ?? ''))}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
}

function previewCellEdit(ri, ci, newVal) {
    if (!previewData) return;
    const oldVal = previewData.rows[ri][ci];
    previewUndoStack.push({ ri, ci, oldVal, newVal });
    previewData.rows[ri][ci] = isNaN(parseFloat(newVal)) ? newVal : parseFloat(newVal);
    renderPreviewStats();
}

function previewUndo() {
    if (previewUndoStack.length === 0) { showToast('没有可撤销的操作', 'info'); return; }
    const action = previewUndoStack.pop();
    previewData.rows[action.ri][action.ci] = action.oldVal;
    renderPreview();
    renderPreviewStats();
    showToast('已撤销', 'info');
}

function previewAddRow() {
    if (!previewData) return;
    const newRow = new Array(previewData.headers.length).fill('');
    previewData.rows.push(newRow);
    renderPreview();
}

function renderPreviewStats() {
    if (!previewData) return;
    const rows = previewData.rows;
    const statsEl = document.getElementById('preview-stats');
    let total = rows.length;
    let stats = `共 ${total} 行 | `;
    // Count anomalies: find numeric columns and flag outliers
    const numericCols = [];
    previewData.headers.forEach((h, i) => {
        if (h === '学号' || h === '姓名') return;
        let numCount = 0;
        rows.forEach(r => { if (!isNaN(parseFloat(r[i]))) numCount++; });
        if (numCount > total * 0.5) numericCols.push(i);
    });
    numericCols.forEach(ci => {
        const vals = rows.map(r => parseFloat(r[ci])).filter(v => !isNaN(v));
        if (vals.length === 0) return;
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        stats += `${escapeHtml(previewData.headers[ci])}: 均${avg.toFixed(1)} 高${max} 低${min} | `;
    });
    statsEl.textContent = stats;
}

async function previewExport() {
    if (!previewData) return;
    // Write edited data to a new Excel file
    try {
        const tmpPath = previewFilePath.replace('.xlsx', '_已编辑.xlsx');
        const result = await eel.export_preview_data(previewData.headers, previewData.rows, tmpPath)();
        if (result && result.success) {
            showToast('导出成功: ' + (result.output || tmpPath), 'success');
            previewFilePath = result.output || tmpPath;
        } else {
            showToast('导出失败: ' + (result?.error || '未知错误'), 'error');
        }
    } catch(e) {
        showToast('导出出错: ' + e, 'error');
    }
}

// ============================================================
// V3.0: Keyboard Shortcuts
// ============================================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Ctrl+K: toggle shortcuts panel
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const panel = document.getElementById('shortcuts-panel');
            if (panel) panel.classList.toggle('hidden');
        }
        // Ctrl+S: force save memory
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveAllToMemory();
            showToast('记忆已保存', 'success');
        }
        // F1: help
        if (e.key === 'F1') {
            e.preventDefault();
            showOnboarding();
        }
    });
}

// ============================================================
// V3.0: Welcome Quick Entry — recent files
// ============================================================
function showWelcome() {
    document.getElementById('welcome-page').style.display = 'flex';
    document.getElementById('role-selection-page').style.display = 'none';
    document.getElementById('counselor-page').style.display = 'none';
    document.getElementById('counselor-welcome-page').style.display = 'none';
    document.getElementById('module-select-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    inWorkspace = false;
    updateGreeting();
    showRandomQuote();
    detectThemeByTime();
    document.getElementById('college-logo').src = 'college-logo-v2.png';
    // Show quick stats
    const hist = getHistory();
    const statsEl = document.getElementById('welcome-stats');
    if (hist.length > 0 && statsEl) {
        statsEl.style.display = 'flex';
        document.getElementById('ws-total').textContent = hist.length;
        const modules = [...new Set(hist.slice(0,10).map(h=>h.module))].length;
        document.getElementById('ws-modules').textContent = modules;
        const lastFile = (hist[0]?.files?.[0] || '').split(/[\\/]/).pop() || '—';
        document.getElementById('ws-last').textContent = lastFile.length > 20 ? lastFile.slice(0,18)+'...' : lastFile;
    }
    // Hide quote if no data
    document.getElementById('welcome-quote').style.display = 'block';
}

function toggleThemeManual() {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'light' ? 'dark' : 'light', true);
    // Refresh settings page button if visible
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        btn.innerHTML = isLight ? '🌙 深色模式' : '☀️ 浅色模式';
    }
    // Update header toggle button too
    const hbtn = document.querySelector('.theme-toggle');
    if (hbtn) {
        hbtn.innerHTML = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀';
    }
}

// ============================================================
// V3.0 Phase 2: Stats Dashboard with Charts
// ============================================================
let chartInstances = {};

async function showStatsDashboard() {
    document.getElementById('stats-overlay').classList.remove('hidden');
    // Destroy existing charts
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    // Read history and build stats
    const history = getHistory();
    const moduleCounts = {};
    history.forEach(h => { moduleCounts[h.module] = (moduleCounts[h.module] || 0) + 1; });

    // Bar chart: module usage
    setTimeout(() => {
        const ctx1 = document.getElementById('chart-bar')?.getContext('2d');
        if (ctx1 && typeof Chart !== 'undefined') {
            chartInstances.bar = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: Object.keys(moduleCounts),
                    datasets: [{ label: '使用次数', data: Object.values(moduleCounts),
                        backgroundColor: ['#6c5ce7','#00cec9','#fdcb6e','#e17055'] }]
                },
                options: { responsive: true, plugins: { title: { display: true, text: '模块使用统计' } } }
            });
        }

        const ctx2 = document.getElementById('chart-pie')?.getContext('2d');
        if (ctx2 && typeof Chart !== 'undefined') {
            chartInstances.pie = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['成功', '失败'],
                    datasets: [{ data: [
                        history.filter(h => h.summary.includes('成功')).length || 1,
                        history.filter(h => !h.summary.includes('成功')).length || 0
                    ], backgroundColor: ['#00b894','#e17055'] }]
                },
                options: { responsive: true, plugins: { title: { display: true, text: '处理结果分布' } } }
            });
        }

        // Line chart: activity over time (last 7 days)
        const ctx3 = document.getElementById('chart-line')?.getContext('2d');
        if (ctx3 && typeof Chart !== 'undefined') {
            const days = [];
            const counts = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                days.push(`${d.getMonth()+1}/${d.getDate()}`);
                counts.push(history.filter(h => {
                    const hd = new Date(h.time);
                    return hd.toDateString() === d.toDateString();
                }).length);
            }
            chartInstances.line = new Chart(ctx3, {
                type: 'line',
                data: { labels: days, datasets: [{ label: '每日处理量', data: counts,
                    borderColor: '#6c5ce7', tension: 0.3, fill: false }] },
                options: { responsive: true, plugins: { title: { display: true, text: '近7天活动' } } }
            });
        }
    }, 200);
}

// ============================================================
// V3.0 Phase 2: System Notifications
// ============================================================
function sendNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'college-mark-v2.png' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(title, { body });
        });
    }
}

// Request notification permission on first interaction
document.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}, { once: true });

// ============================================================
// V3.0 Phase 2: Semester Comparison
// ============================================================
async function showCompare() {
    let html = '<div style="display:flex;gap:16px;">';
    html += `<div style="flex:1;"><h4>📂 上学期综测文件</h4>
        <input id="compare-file1" class="file-path" readonly placeholder="选择上学期综测.xlsx...">
        <button class="btn btn-secondary btn-sm" style="margin-top:4px;"
            onclick="pickFile('compare-file1','选择上学期文件',[['Excel文件','*.xlsx']])">浏览</button></div>`;
    html += `<div style="flex:1;"><h4>📂 本学期综测文件</h4>
        <input id="compare-file2" class="file-path" readonly placeholder="选择本学期综测.xlsx...">
        <button class="btn btn-secondary btn-sm" style="margin-top:4px;"
            onclick="pickFile('compare-file2','选择本学期文件',[['Excel文件','*.xlsx']])">浏览</button></div>`;
    html += '</div><div id="compare-result" style="margin-top:16px;"></div>';

    showModal('📈 学期对比', html,
        `<button class="btn btn-ghost btn-sm" onclick="closeModal()">关闭</button>
         <button class="btn btn-primary btn-sm" onclick="runCompare()">开始对比</button>`);
}

async function runCompare() {
    const f1 = document.getElementById('compare-file1')?.value?.trim();
    const f2 = document.getElementById('compare-file2')?.value?.trim();
    if (!f1 || !f2) { showToast('请选择两个文件', 'warning'); return; }

    try {
        const result = await eel.compare_semesters(f1, f2)();
        const el = document.getElementById('compare-result');
        if (result && result.success) {
            let html = '<table class="data-table" style="font-size:11px;"><thead><tr>';
            html += '<th>学号</th><th>姓名</th><th>上学期</th><th>本学期</th><th>变化</th><th>排名变化</th></tr></thead><tbody>';
            const data = result.data || [];
            data.forEach(r => {
                const change = (r.current || 0) - (r.previous || 0);
                const changeColor = change > 0 ? 'var(--color-success)' : change < 0 ? 'var(--color-error)' : '';
                const rankChange = (r.rank_prev || 0) - (r.rank_curr || 0);
                const rankColor = rankChange > 0 ? 'var(--color-success)' : rankChange < 0 ? 'var(--color-error)' : '';
                html += `<tr>
                    <td>${escapeHtml(String(r.id||''))}</td><td>${escapeHtml(String(r.name||''))}</td>
                    <td>${r.previous?.toFixed(2)||'—'}</td><td>${r.current?.toFixed(2)||'—'}</td>
                    <td style="color:${changeColor};">${change>0?'+':''}${change.toFixed(2)}</td>
                    <td style="color:${rankColor};">${rankChange>0?'↑':rankChange<0?'↓':'—'} ${Math.abs(rankChange)}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            el.innerHTML = html;
        } else {
            el.innerHTML = `<p style="color:var(--color-error);">${result?.error || '对比失败'}</p>`;
        }
    } catch(e) { showToast('对比出错: '+e, 'error'); }
}

// ============================================================
// V3.0 Phase 2: Operation Log
// ============================================================
function logOperation(module, action, detail) {
    let log = [];
    try { log = JSON.parse(localStorage.getItem('eval_oplog') || '[]'); } catch(e) {}
    log.unshift({ module, action, detail, time: Date.now(), user: sessionStorage.getItem('eval_user') || 'unknown' });
    if (log.length > 200) log = log.slice(0, 200);
    localStorage.setItem('eval_oplog', JSON.stringify(log));
}

function showOperationLog() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem('eval_oplog') || '[]'); } catch(e) {}
    let html = log.length === 0 ? '<p style="color:var(--text-muted);text-align:center;">暂无操作记录</p>' : '';
    for (const entry of log.slice(0, 30)) {
        const dt = new Date(entry.time);
        html += `<div style="padding:4px 0;border-bottom:var(--border-thin);font-size:11px;">
            <span style="color:var(--text-muted);">${dt.toLocaleString('zh-CN')}</span>
            [${escapeHtml(entry.user)}] <strong>${escapeHtml(entry.module)}</strong>
            ${escapeHtml(entry.action)} — ${escapeHtml(entry.detail)}</div>`;
    }
    showModal('📝 操作日志', `<div style="max-height:55vh;overflow-y:auto;font-size:11px;">${html}</div>`,
        `<button class="btn btn-ghost btn-sm" onclick="localStorage.removeItem('eval_oplog');closeModal();showToast('已清空');">清空日志</button>
         <button class="btn btn-primary btn-sm" onclick="closeModal()">关闭</button>`);
}

// ============================================================
// V3.0 Phase 3: Backup / Restore / Print / Theme
// ============================================================
function exportBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('eval_') || key === 'student_eval_memory_v2' || key === 'theme_override') {
            data[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `测评系统备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('备份文件已下载', 'success');
    logOperation('系统', '备份', '数据已导出');
}

function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            let count = 0;
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, value);
                count++;
            }
            showToast(`已恢复 ${count} 项数据，重启后生效`, 'success');
            logOperation('系统', '恢复', `恢复了${count}项数据`);
        } catch(err) {
            showToast('备份文件无效: ' + err, 'error');
        }
    };
    input.click();
}

function printReport() {
    // Find the most recent output file
    const history = getHistory();
    let lastFile = '';
    for (const h of history) {
        if (h.files && h.files.length > 0) {
            lastFile = h.files[0];
            break;
        }
    }
    if (lastFile) {
        eel.open_file_explorer(lastFile)();
        showToast('已打开最近输出的文件，可用Excel打印', 'info');
    } else {
        // Print current page
        const w = window.open('', '_blank', 'width=800,height=600');
        w.document.write('<html><head><title>学生综合测评报告</title>');
        w.document.write('<style>body{font-family:SimSun,sans-serif;padding:20px;}');
        w.document.write('h1{text-align:center;font-size:18px;}');
        w.document.write('table{width:100%;border-collapse:collapse;font-size:10pt;}');
        w.document.write('th,td{border:1px solid #000;padding:4px;text-align:center;}');
        w.document.write('th{font-weight:bold;}</style></head><body>');
        w.document.write('<h1>学生综合测评系统 — 报告</h1>');
        w.document.write('<p>生成时间: ' + new Date().toLocaleString('zh-CN') + '</p>');
        w.document.write('<p>开发者: 陈雨昂 · 顿河学院团委秘书处</p>');
        w.document.write('</body></html>');
        w.document.close();
        setTimeout(() => w.print(), 500);
    }
}

// ============================================================
// Grade/Major Filter Helper — shared across modules
// ============================================================
let _gradeFilterCallback = null;

function extractGradesFromClasses(classes) {
    const grades = new Set();
    for (const cls of classes) {
        const m = String(cls).match(/(\d{2})\d{1,2}$/);
        if (m) grades.add(m[1] + '级');
        else grades.add(cls);
    }
    return [...grades].sort();
}

function renderGradeFilter(containerId, classes, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container || !classes || classes.length <= 1) return;
    const grades = extractGradesFromClasses(classes);
    if (grades.length <= 1) return;

    _gradeFilterCallback = onFilterChange;

    let html = '<div class="grade-filter-row"><span style="font-size:11px;color:var(--text-muted);">导出范围:</span>';
    html += `<span class="grade-filter-chip active" data-grade="all" onclick="_gradeFilterCallback('all');this.parentElement.querySelectorAll('.grade-filter-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active');">全部</span>`;
    for (const g of grades) {
        html += `<span class="grade-filter-chip" data-grade="${g}" onclick="_gradeFilterCallback('${g}');this.parentElement.querySelectorAll('.grade-filter-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active');">${g}</span>`;
    }
    html += '</div>';
    container.innerHTML = html;
}
