const CLOUD_OPERATOR_KEY = 'evaluation_cloud_operator_v1';
let cloudWorkspaceSnapshot = null;

function cloudOperatorName() {
    return (localStorage.getItem(CLOUD_OPERATOR_KEY) || '').trim();
}

function cloudEscape(value) {
    return String(value || '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function cloudFileName(path) {
    return String(path || '').split(/[\\/]/).pop() || '';
}

function cloudFormatTime(value) {
    if (!value) return '尚未同步';
    return String(value).replace('T', ' ').slice(0, 16);
}

function renderCloudWorkspace() {
    const major = MajorScope.get() || '';
    document.getElementById('module-container').innerHTML = `
        <div class="cloud-account-page cloud-hub">
            <header class="cloud-hub-head">
                <div class="cloud-hub-symbol">云</div>
                <div><span>学院共享工作区</span><h2>学院云表同步中心</h2><p>先看清本地文件和云端目标，再决定更新、绑定或新建。</p></div>
                <button class="btn btn-secondary" onclick="refreshCloudWorkspace()">刷新状态</button>
            </header>
            <div id="cloud-account-status" class="cloud-status-skeleton">正在检查账号和云表…</div>
            <section class="cloud-readiness" aria-label="同步准备情况">
                <article id="cloud-ready-account"><span>1</span><div><strong>连接账号</strong><small>正在检查</small></div></article>
                <article id="cloud-ready-owner"><span>2</span><div><strong>确认负责人</strong><small>${cloudEscape(cloudOperatorName() || '尚未填写')} · ${cloudEscape(major || '尚未选专业')}</small></div></article>
                <article id="cloud-ready-target"><span>3</span><div><strong>确认云表目标</strong><small>正在检查</small></div></article>
            </section>
            <section class="cloud-sync-center">
                <header><div><span class="cloud-section-kicker">同步中心</span><h3>本次生成结果与学院云表</h3></div><small>点击同步后仍会再次确认目标</small></header>
                <div id="cloud-sync-list" class="cloud-sync-list"><div class="cloud-list-loading">正在读取云端工作表…</div></div>
            </section>
            <details class="cloud-settings-panel">
                <summary><div><strong>连接与负责人设置</strong><small>登录、更换负责人或预先绑定共享链接</small></div><span>展开设置</span></summary>
                <div class="cloud-settings-body">
                    <div class="cloud-profile-grid">
                        <label>负责人姓名<input id="cloud-operator-name" class="input" value="${cloudEscape(cloudOperatorName())}" placeholder="例如：张老师"></label>
                        <div class="cloud-major-field"><span>负责专业</span><strong data-cloud-major>${cloudEscape(major || '尚未设置')}</strong><button class="btn btn-ghost btn-sm" onclick="MajorScope.open()">选择专业</button></div>
                        <button class="btn btn-primary" onclick="cloudSaveOperator()">保存本机信息</button>
                    </div>
                    <div id="cloud-binding-editor" class="cloud-binding-editor"></div>
                    <p class="cloud-profile-note">负责人姓名与专业只保存在本机，用于操作确认；WPS 登录负责云文档访问权限。</p>
                </div>
            </details>
            <aside class="cloud-merge-note"><strong>多台电脑会汇总到一张表吗？</strong><p>会。每类结果都要让所有负责人选择同一个已有链接。同步只合并本地文件里的可见工作表，其他专业和隐藏辅助表不会被误删。</p></aside>
        </div>`;
    refreshCloudWorkspace();
}

async function refreshCloudWorkspace() {
    const statusBox = document.getElementById('cloud-account-status');
    if (!statusBox) return;
    const major = MajorScope.get() || '';
    const specs = CloudSync.specs();
    statusBox.className = 'cloud-status-skeleton';
    statusBox.textContent = '正在检查账号和云表…';
    try {
        const [status, ...overviews] = await Promise.all([
            eel.kdocs_auth_status()(),
            ...specs.map(spec => eel.kdocs_get_sync_overview(spec.key, major)()),
        ]);
        const items = Object.fromEntries(specs.map((spec, index) => [spec.id, overviews[index]]));
        cloudWorkspaceSnapshot = { status, items, major };
        const connected = !!status?.authenticated;
        statusBox.className = `cloud-account-status ${connected ? 'is-connected' : 'is-disconnected'}`;
        statusBox.innerHTML = `<div><span class="cloud-status-dot"></span><div><strong>${connected ? '金山文档已连接' : '尚未连接金山文档'}</strong><p>${connected ? (status.access_verified ? '账号有效，已验证学院云表访问权限。' : '账号有效；选择同步目标时会继续校验权限。') : cloudEscape(status?.error || '登录后才能创建或更新学院共享表。')}</p></div></div><div class="cloud-account-actions">${connected ? '<button class="btn btn-ghost" onclick="cloudLogout()">退出账号</button>' : '<button class="btn btn-primary" onclick="cloudLogin()">登录金山文档</button>'}</div>`;
        cloudSetReady('cloud-ready-account', connected, connected ? '账号可用' : '需要登录');
        cloudSetReady('cloud-ready-owner', !!cloudOperatorName() && !!major, cloudOperatorName() && major ? `${cloudOperatorName()} · ${major}` : '请补全姓名和专业');
        const boundCount = specs.filter(spec => items[spec.id]?.bound).length;
        cloudSetReady('cloud-ready-target', boundCount === specs.length, boundCount === specs.length ? '6 类学院总表均已绑定' : `${boundCount}/${specs.length} 已绑定；同步时也可新建`);
        renderCloudSyncList(specs, items, connected);
        renderCloudBindingEditor(specs, items, connected);
    } catch (error) {
        statusBox.className = 'cloud-account-status is-disconnected';
        statusBox.innerHTML = `<div><span class="cloud-status-dot"></span><div><strong>状态读取失败</strong><p>${cloudEscape(error)}</p></div></div><button class="btn btn-primary" onclick="refreshCloudWorkspace()">重试</button>`;
    }
}

function cloudSetReady(id, ready, message) {
    const element = document.getElementById(id);
    if (!element) return;
    element.classList.toggle('is-ready', !!ready);
    const small = element.querySelector('small');
    if (small) small.textContent = message;
}

function renderCloudSyncList(specs, items, connected) {
    const target = document.getElementById('cloud-sync-list');
    if (!target) return;
    target.innerHTML = specs.map(spec => {
        const item = items[spec.id] || {};
        const output = spec.output() || '';
        const outputCount = spec.outputs ? spec.outputs().filter(Boolean).length : (output ? 1 : 0);
        const ready = connected && !!output && item.success !== false;
        let state = '等待准备';
        if (!connected) state = '需要登录';
        else if (item.success === false) state = item.needs_login ? '登录已失效' : '云表读取失败';
        else if (!output) state = '请先生成本地表';
        else if (!item.bound) state = '可新建或绑定';
        else state = '可以同步';
        const sheetText = item.bound && item.success !== false ? `云端 ${item.sheet_count || 0} 个工作表 · 当前专业 ${item.major_sheets?.length || 0} 个` : '尚未指定默认云表';
        const action = output ? `onclick="cloudPrepareSync('${spec.id}')"` : `onclick="switchModule('${spec.module}');showToast('请先生成${spec.shortLabel}','info')"`;
        return `<article id="cloud-sync-${spec.id}" class="cloud-sync-item ${ready ? 'is-ready' : ''}">
            <div class="cloud-sync-state"><span></span><small>${cloudEscape(state)}</small></div>
            <div class="cloud-sync-copy"><strong>${cloudEscape(spec.label)}</strong><p>${cloudEscape(output ? (outputCount > 1 ? `待汇总 ${outputCount} 份德育结果` : cloudFileName(output)) : '本次尚未生成文件')}</p><small>${cloudEscape(sheetText)} · ${cloudFormatTime(item.updated_at)}</small>${item.success === false ? `<em title="${cloudEscape(item.error)}">${cloudEscape(item.error || '无法读取云表')}</em>` : ''}</div>
            <div class="cloud-sync-actions">${item.bound && item.link_url ? `<button class="btn btn-ghost btn-sm" data-cloud-open-id="${spec.id}">打开当前云表</button><button data-cloud-reorder-id="${spec.id}" class="btn btn-secondary btn-sm" onclick="CloudSync.reorder('${spec.id}')">整理顺序</button>` : ''}<button data-cloud-sync-id="${spec.id}" class="btn ${ready ? 'btn-primary' : 'btn-secondary'} btn-sm" ${action}>${output ? '选择目标并同步' : '去生成'}</button></div>
        </article>`;
    }).join('');
    target.querySelectorAll('[data-cloud-open-id]').forEach(button => {
        button.addEventListener('click', () => {
            const item = items[button.dataset.cloudOpenId] || {};
            cloudOpen(item.link_url || '');
        });
    });
}

function renderCloudBindingEditor(specs, items, connected) {
    const target = document.getElementById('cloud-binding-editor');
    if (!target) return;
    target.innerHTML = specs.map(spec => {
        const item = items[spec.id] || {};
        return `<div class="cloud-bind-setting"><div><strong>${cloudEscape(spec.label)}</strong><small>${item.bound ? `当前：${cloudEscape(item.name || item.link_url)}` : '尚未绑定'}</small></div><div class="cloud-bind-row"><input id="cloud-bind-${spec.id}" class="input" placeholder="粘贴同事发来的 kdocs.cn 链接"><button class="btn btn-secondary btn-sm" ${connected ? '' : 'disabled'} onclick="cloudBind('${spec.id}','${spec.key}')">${item.bound ? '重新绑定' : '绑定链接'}</button></div></div>`;
    }).join('');
}

function cloudPrepareSync(id) {
    CloudSync.request(id);
}

async function cloudRunSync(id) {
    closeModal();
    await CloudSync.request(id);
}

function cloudSaveOperator() {
    const name = (document.getElementById('cloud-operator-name')?.value || '').trim();
    if (!name) { showToast('请填写负责人姓名', 'warning'); return; }
    if (!MajorScope.get()) { MajorScope.open(); showToast('还需要选择负责专业', 'warning'); return; }
    localStorage.setItem(CLOUD_OPERATOR_KEY, name);
    document.querySelectorAll('[data-cloud-major]').forEach(el => el.textContent = MajorScope.get());
    showToast(`已保存：${name} · ${MajorScope.get()}`, 'success');
    refreshCloudWorkspace();
}

async function cloudLogin() {
    showToast('请在浏览器中完成 WPS 授权', 'info');
    const result = await eel.kdocs_login()();
    if (!result?.success) { showToast(result?.error || '登录未完成', 'error'); return; }
    showToast('金山文档连接成功', 'success');
    await refreshCloudWorkspace();
}

async function cloudLogout() {
    if (!confirm('确定退出这台电脑上的金山文档账号吗？云表绑定信息会保留。')) return;
    const result = await eel.kdocs_logout()();
    if (!result?.success) { showToast(result?.error || '退出失败', 'error'); return; }
    showToast('已退出金山文档账号', 'success');
    await refreshCloudWorkspace();
}

async function cloudBind(id, key) {
    const link = (document.getElementById(`cloud-bind-${id}`)?.value || '').trim();
    if (!link) { showToast('请先粘贴学院共享链接', 'warning'); return; }
    const result = await eel.kdocs_bind_workbook(key, link)();
    if (!result?.success) { showToast(result?.error || '绑定失败', 'error'); return; }
    showToast('学院共享表绑定成功', 'success');
    await refreshCloudWorkspace();
}

async function cloudOpen(link) {
    if (!link) return;
    const result = await eel.open_web_link(link)();
    if (!result?.success) showToast(result?.error || '无法打开链接', 'error');
}
