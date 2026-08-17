(function () {
    const KEY = 'evaluation_task_completion_v1';
    const names = {gpa:'学分绩点', moral:'德育分', quality:'素质拓展分', comprehensive:'综合测评', annual:'学年排名'};
    function activeTaskId() { return localStorage.getItem('eval_active_measurement_task') || 'default'; }
    function all() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
    function state() { return all()[activeTaskId()] || {}; }
    function mark(module, detail) {
        const data = all();
        if (!data[activeTaskId()]) data[activeTaskId()] = {};
        data[activeTaskId()][module] = {done:true, at:Date.now(), detail:detail || ''};
        localStorage.setItem(KEY, JSON.stringify(data));
        celebrate(module);
    }
    function celebrate(module) {
        document.getElementById('completion-celebration')?.remove();
        const el = document.createElement('div');
        el.id = 'completion-celebration'; el.className = 'completion-celebration';
        const pieces = Array.from({length:36}, (_,i) => `<i style="--x:${(i*37)%100}vw;--d:${(i%9)*.05}s;--r:${(i*71)%360}deg;--c:${i%5}"></i>`).join('');
    el.innerHTML = `<div class="celebration-confetti">${pieces}</div><div class="celebration-card"><span class="celebration-logo"><img src="college-mark-v2.png" alt="顿河学院 Logo"></span><span class="celebration-seal">完成</span><p>WORK COMPLETE</p><h2>恭喜你，完成工作！</h2><div>${names[module] || '本项任务'}已经妥善收尾，辛苦了。</div><button onclick="CompletionCelebration.close()">收下这份成就感</button></div>`;
        document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    }
    function close() { const el=document.getElementById('completion-celebration'); if(!el)return; el.classList.remove('show'); setTimeout(()=>el.remove(),300); }
    window.CompletionCelebration = {state, mark, celebrate, close};
})();
