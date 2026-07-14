# Don College A+C Glass UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic blue/Apple presentation layer with the approved Don College A+C academic identity, restrained liquid glass, clear dense-data surfaces, real college logo placement, and accessible nonlinear motion without changing business calculations.

**Architecture:** Keep the existing HTML and JavaScript workflows intact. Add one final-loaded `don-college-ui.css` brand layer for tokens, layouts, dense-workspace overrides, and motion; narrow `liquid-glass.css` to shell-only glass surfaces; make only targeted markup changes for logo placement and completion identity. Contract tests verify ordering, forbidden copy, material boundaries, motion fallback, and required selectors.

**Tech Stack:** HTML5, CSS custom properties, CSS transforms/keyframes/media queries, vanilla JavaScript, Python `unittest`, pywebview/PyInstaller desktop packaging.

---

### Task 1: Preserve the current UI and add failing brand contracts

**Files:**
- Create: `backups/before-ac-glass-ui-<timestamp>/web/`
- Create: `tests/test_school_ui_contract.py`

- [ ] **Step 1: Back up the existing visual layer**

Run from the repository root:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "backups/before-ac-glass-ui-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item web "$backup/web" -Recurse
Copy-Item build.spec "$backup/build.spec"
Write-Output $backup
```

Expected: a timestamped folder containing the complete current `web` directory and `build.spec`.

- [ ] **Step 2: Write the failing UI contract**

Create `tests/test_school_ui_contract.py`:

```python
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
BRAND = ROOT / "web/css/don-college-ui.css"
GLASS = ROOT / "web/css/liquid-glass.css"
COMPLETION = ROOT / "web/js/components/completion-celebration.js"


class SchoolUiContractTests(unittest.TestCase):
    def test_brand_layer_is_loaded_last(self):
        self.assertTrue(BRAND.exists())
        self.assertIn('href="css/don-college-ui.css"', INDEX)
        self.assertGreater(
            INDEX.index('href="css/don-college-ui.css"'),
            INDEX.index('href="css/liquid-glass.css"'),
        )

    def test_school_tokens_and_dense_surface_contract_exist(self):
        css = BRAND.read_text(encoding="utf-8")
        for token in (
            "--school-green-950: #17372f",
            "--school-green-700: #2f6f57",
            "--school-brick-700: #963b3d",
            "--school-ivory-50: #f4f0e7",
        ):
            self.assertIn(token, css.lower())
        self.assertIn(".gpa-student-review", css)
        self.assertIn(".import-studio", css)
        self.assertIn(".award-person-drawer", css)

    def test_glass_is_restrained_to_shells(self):
        css = GLASS.read_text(encoding="utf-8")
        self.assertIn(".school-glass", css)
        self.assertIn(".modal-card", css)
        self.assertNotIn(".gpa-student-course-list>div", css)
        self.assertNotIn(".award-metrics>div", css)
        self.assertNotIn("#content {", css)

    def test_logo_is_used_in_start_shell_and_completion(self):
        self.assertIn('class="splash-college-logo"', INDEX)
        self.assertIn('class="task-center-brand"', INDEX)
        completion = COMPLETION.read_text(encoding="utf-8")
        self.assertIn("college-mark-v2.png", completion)
        self.assertIn("celebration-logo", completion)

    def test_forbidden_relationship_copy_is_absent_from_runtime(self):
        runtime = "\n".join(
            p.read_text(encoding="utf-8", errors="ignore")
            for p in (ROOT / "web").rglob("*") if p.suffix in {".html", ".js", ".css"}
        )
        for phrase in ("中外合作办学", "国际合作办学", "俄罗斯学院", "双校园"):
            self.assertNotIn(phrase, runtime)

    def test_nonlinear_and_reduced_motion_contract(self):
        css = BRAND.read_text(encoding="utf-8")
        self.assertIn("cubic-bezier(.16, 1, .3, 1)", css)
        self.assertIn("cubic-bezier(.34, 1.56, .64, 1)", css)
        self.assertIn("prefers-reduced-motion: reduce", css)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the contract and verify it fails**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_school_ui_contract -v
```

Expected: failures because `don-college-ui.css`, the new markup classes, and the completion logo do not yet exist.

- [ ] **Step 4: Commit the contract**

```powershell
git add tests/test_school_ui_contract.py
git commit -m "test: define Don College UI contract"
```

### Task 2: Establish the brand token layer and restrained liquid glass

**Files:**
- Create: `web/css/don-college-ui.css`
- Modify: `web/css/liquid-glass.css`
- Modify: `web/index.html:8-14`
- Test: `tests/test_school_ui_contract.py`

- [ ] **Step 1: Load the brand layer after all existing style sheets**

Add after `liquid-glass.css` in `web/index.html`:

```html
<link rel="stylesheet" href="css/don-college-ui.css">
```

- [ ] **Step 2: Add the central light and dark tokens**

Start `web/css/don-college-ui.css` with:

```css
:root {
    --school-green-950: #17372f;
    --school-green-800: #245848;
    --school-green-700: #2f6f57;
    --school-green-100: #dce9e2;
    --school-brick-700: #963b3d;
    --school-brick-100: #f2e2df;
    --school-ivory-50: #f4f0e7;
    --school-ceramic-0: #fffdf8;
    --school-stone-200: #dcd5c9;
    --school-ink-900: #19231f;
    --school-ink-600: #68726e;
    --school-info: #6f9fa6;
    --school-warning: #bd741d;
    --school-error: #c44343;
    --school-success: #28795b;
    --motion-out: cubic-bezier(.16, 1, .3, 1);
    --motion-spring: cubic-bezier(.34, 1.56, .64, 1);
    --bg-root: var(--school-ivory-50);
    --bg-primary: var(--school-ceramic-0);
    --bg-secondary: var(--school-ceramic-0);
    --bg-tertiary: #eee9e0;
    --text-primary: var(--school-ink-900);
    --text-secondary: #47534f;
    --text-muted: var(--school-ink-600);
    --accent-primary: var(--school-green-700);
    --accent-primary-hover: var(--school-green-800);
    --accent-primary-muted: color-mix(in srgb, var(--school-green-700) 11%, transparent);
    --accent-secondary: var(--school-green-700);
    --border-color: var(--school-stone-200);
    --color-success: var(--school-success);
    --color-warning: var(--school-warning);
    --color-error: var(--school-error);
}

[data-theme="dark"] {
    --bg-root: #101b18;
    --bg-primary: #17231f;
    --bg-secondary: #1b2924;
    --bg-tertiary: #22332d;
    --text-primary: #f4efe5;
    --text-secondary: #ced8d2;
    --text-muted: #91a59c;
    --border-color: rgba(234, 240, 235, .13);
    --accent-primary: #69a98e;
    --accent-primary-hover: #83bda5;
    --accent-primary-muted: rgba(105, 169, 142, .16);
}
```

- [ ] **Step 3: Replace broad blue glass with scoped school glass**

Rewrite `web/css/liquid-glass.css` around this contract:

```css
:root {
    --school-glass-bg: rgba(255, 253, 248, .68);
    --school-glass-bg-strong: rgba(255, 253, 248, .82);
    --school-glass-border: rgba(255, 255, 255, .72);
    --school-glass-shadow: 0 18px 42px rgba(23, 55, 47, .10), inset 0 1px 0 rgba(255,255,255,.82);
}
[data-theme="dark"] {
    --school-glass-bg: rgba(27, 41, 36, .68);
    --school-glass-bg-strong: rgba(31, 48, 41, .82);
    --school-glass-border: rgba(255, 255, 255, .12);
    --school-glass-shadow: 0 20px 48px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.12);
}
.school-glass,
#header,
.counselor-header,
.modal-card,
.toast,
.major-scope-chip,
.quality-mode-switch,
.gpa-review-top,
.award-result-head {
    background: linear-gradient(145deg, var(--school-glass-bg-strong), var(--school-glass-bg));
    border: 1px solid var(--school-glass-border);
    box-shadow: var(--school-glass-shadow);
    backdrop-filter: blur(22px) saturate(1.24);
    -webkit-backdrop-filter: blur(22px) saturate(1.24);
}
.modal-overlay {
    background: rgba(23, 55, 47, .22);
    backdrop-filter: blur(16px) saturate(1.08);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .school-glass, #header, .counselor-header, .modal-card, .toast,
    .major-scope-chip, .quality-mode-switch, .gpa-review-top, .award-result-head {
        background: var(--bg-primary);
    }
}
```

Do not include `#content`, course cells, metric cells, mapping rows, result cells, or ordinary module cards in the glass selector list.

- [ ] **Step 4: Run the focused material tests**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_school_ui_contract.SchoolUiContractTests.test_brand_layer_is_loaded_last tests.test_school_ui_contract.SchoolUiContractTests.test_glass_is_restrained_to_shells -v
```

Expected: both tests pass.

- [ ] **Step 5: Commit the foundation**

```powershell
git add web/index.html web/css/don-college-ui.css web/css/liquid-glass.css tests/test_school_ui_contract.py
git commit -m "feat: add Don College brand and restrained glass"
```

### Task 3: Apply the logo and identity to entry and shell surfaces

**Files:**
- Modify: `web/index.html:16-230`
- Modify: `web/css/don-college-ui.css`
- Test: `tests/test_school_ui_contract.py`

- [ ] **Step 1: Replace the splash icon with the real college mark**

Replace the splash SVG in `web/index.html` with:

```html
<div class="splash-logo">
    <img src="college-mark-v2.png" alt="顿河学院 Logo" class="splash-college-logo">
</div>
```

- [ ] **Step 2: Add a branded task-center identity block**

At the start of `.task-center-header` add:

```html
<div class="task-center-brand">
    <img src="college-mark-v2.png" alt="顿河学院 Logo">
    <div><strong>顿河学院</strong><small>学生事务工作空间</small></div>
</div>
```

Keep the existing task-center title and action buttons after this block.

- [ ] **Step 3: Style entry surfaces and the dark-green sidebar**

Append scoped rules to `don-college-ui.css`:

```css
#role-selection-page, #welcome-page, #counselor-welcome-page, #module-select-page {
    background-color: var(--school-ivory-50);
    background-image:
        radial-gradient(circle at 78% 16%, rgba(47,111,87,.08), transparent 25%),
        linear-gradient(rgba(47,111,87,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(47,111,87,.035) 1px, transparent 1px);
    background-size: auto, 44px 44px, 44px 44px;
}
.splash-college-logo { width: 86px; height: 86px; object-fit: contain; filter: drop-shadow(0 10px 20px rgba(23,55,47,.18)); }
.task-center-brand { display:flex; align-items:center; gap:12px; min-width:190px; }
.task-center-brand img { width:52px; height:52px; object-fit:contain; }
.task-center-brand strong, .task-center-brand small { display:block; }
.task-center-brand strong { font-family:STSong,"Songti SC",serif; font-size:18px; }
.task-center-brand small { margin-top:3px; color:var(--text-muted); font-size:10px; }
#sidebar { background: var(--school-green-950); color:#f8f3e7; }
.nav-btn { color:#d9e5df; border-radius:999px; }
.nav-btn.active { background:var(--school-ceramic-0); color:var(--school-green-800); }
.sidebar-logo-img { filter:drop-shadow(0 5px 10px rgba(0,0,0,.24)); }
#header::after { content:""; position:absolute; left:0; bottom:-1px; width:140px; height:3px; background:var(--school-brick-700); }
```

- [ ] **Step 4: Run identity and copy tests**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_school_ui_contract.SchoolUiContractTests.test_logo_is_used_in_start_shell_and_completion tests.test_school_ui_contract.SchoolUiContractTests.test_forbidden_relationship_copy_is_absent_from_runtime -v
```

Expected: the forbidden-copy test passes; the completion test still fails until Task 5.

- [ ] **Step 5: Commit entry and shell identity**

```powershell
git add web/index.html web/css/don-college-ui.css
git commit -m "feat: brand app entry and navigation with college identity"
```

### Task 4: Restyle the workflow center and dense workspaces

**Files:**
- Modify: `web/css/don-college-ui.css`
- Verify markup generated by: `web/js/main.js`, `web/js/modules/gpa.js`, `web/js/modules/toolbox.js`, `web/js/components/import-studio.js`, `web/js/modules/counselor.js`
- Test: `tests/test_school_ui_contract.py`

- [ ] **Step 1: Style the task center with solid deep-green hero and warm cards**

Add:

```css
.task-center-shell { background:transparent; }
.task-hero-card, .award-hero {
    background:var(--school-green-950);
    color:#fff;
    border:1px solid rgba(255,255,255,.12);
    border-radius:30px;
    box-shadow:0 18px 42px rgba(23,55,47,.15);
}
.task-hero-card::after, .award-hero::after {
    content:""; position:absolute; width:220px; height:110px; right:-24px; bottom:-58px;
    border:1px solid rgba(255,255,255,.18); border-radius:50%; transform:rotate(-10deg);
}
.task-module-card, .module-section, .task-center-section {
    background:var(--school-ceramic-0);
    border:1px solid var(--school-stone-200);
    border-radius:16px;
    box-shadow:0 1px 2px rgba(23,55,47,.07);
}
.task-module-card.current { box-shadow:inset 0 3px var(--school-brick-700), 0 12px 28px rgba(23,55,47,.08); }
```

- [ ] **Step 2: Restore solid, high-contrast surfaces for GPA and import review**

Add:

```css
.gpa-review-body > aside,
.gpa-source-catalog,
.gpa-source-course,
.gpa-class-audit-card,
.gpa-student-group,
.gpa-student-review,
.gpa-course-pill,
.gpa-student-course-list > div,
.import-studio,
.import-sheet-card,
.import-tree-class,
.import-tree-student,
.import-field-row {
    background:var(--school-ceramic-0);
    border-color:var(--school-stone-200);
    backdrop-filter:none;
    -webkit-backdrop-filter:none;
}
.gpa-student-review.abnormal,
.gpa-source-course.danger,
.import-field-row.invalid {
    border-color:color-mix(in srgb, var(--school-warning) 55%, var(--school-stone-200));
    background:#fff7eb;
    box-shadow:inset 4px 0 var(--school-warning);
}
.gpa-student-review > summary > strong,
.gpa-course-pill em { color:var(--school-green-700); }
.import-studio-hero { background:var(--school-green-950); border-radius:24px; }
```

- [ ] **Step 3: Restyle award and counselor workspaces**

Add:

```css
.award-shell, .counselor-container { color:var(--text-primary); }
.award-person-drawer, .award-metrics > div, .award-file-card, .award-preset,
.counselor-main, .counselor-card, .notice-step-card, .notice-source-item {
    background:var(--school-ceramic-0);
    border-color:var(--school-stone-200);
}
.award-person-drawer { border-radius:16px; }
.award-person-drawer.ok { border-left-color:var(--school-success); }
.award-person-drawer.bad { border-left-color:var(--school-error); }
.award-seal { border-radius:50%; border-color:rgba(255,255,255,.55); }
.counselor-sidebar { background:var(--school-green-950); }
.counselor-sidebar-item { color:#d9e5df; border-radius:999px; }
.counselor-sidebar-item.active { background:var(--school-ceramic-0); color:var(--school-green-800); }
```

- [ ] **Step 4: Add narrow-window and scaling safeguards**

Add:

```css
@media (max-width: 1000px) {
    .task-center-header { align-items:flex-start; flex-wrap:wrap; }
    .task-center-brand { width:100%; }
    .gpa-review-body { grid-template-columns:1fr; }
    .award-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
}
@media (max-width: 680px) {
    .task-module-grid, .award-file-grid, .award-metrics { grid-template-columns:1fr; }
    .gpa-student-course-list { grid-template-columns:1fr; }
    .gpa-student-review > summary { align-items:flex-start; flex-wrap:wrap; }
}
```

- [ ] **Step 5: Run dense-surface contract tests**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_school_ui_contract.SchoolUiContractTests.test_school_tokens_and_dense_surface_contract_exist tests.test_school_ui_contract.SchoolUiContractTests.test_glass_is_restrained_to_shells -v
```

Expected: PASS.

- [ ] **Step 6: Commit dense workspace styling**

```powershell
git add web/css/don-college-ui.css
git commit -m "feat: unify Don College data workspaces"
```

### Task 5: Add nonlinear motion and logo-led completion

**Files:**
- Modify: `web/css/don-college-ui.css`
- Modify: `web/js/components/completion-celebration.js:15-23`
- Test: `tests/test_school_ui_contract.py`
- Test: `tests/test_completion_experience.py`

- [ ] **Step 1: Add nonlinear entrance, interaction, and drawer motion**

Add to `don-college-ui.css`:

```css
.task-hero-card, .award-hero { animation:schoolHeroIn 620ms var(--motion-out) both; }
.task-module-card, .module-card { animation:schoolCardIn 620ms var(--motion-out) both; }
.task-module-card:nth-child(2), .module-card:nth-child(2) { animation-delay:70ms; }
.task-module-card:nth-child(3), .module-card:nth-child(3) { animation-delay:140ms; }
.task-module-card:nth-child(4), .module-card:nth-child(4) { animation-delay:210ms; }
.btn, .nav-btn, .counselor-sidebar-item, .award-person-drawer > summary {
    transition:transform 360ms var(--motion-spring), box-shadow 280ms ease, background-color 220ms ease;
}
.btn:active:not(:disabled), .nav-btn:active { transform:scale(.95); }
.award-person-drawer[open] .award-person-body { animation:schoolDrawerIn 440ms var(--motion-out) both; }
@keyframes schoolHeroIn { from { opacity:0; transform:translateY(16px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes schoolCardIn { from { opacity:0; transform:translateY(14px) scale(.95); } to { opacity:1; transform:none; } }
@keyframes schoolDrawerIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }
}
```

- [ ] **Step 2: Add the real logo to completion markup**

In `completion-celebration.js`, use:

```javascript
el.innerHTML = `<div class="celebration-confetti">${pieces}</div>
  <div class="celebration-card">
    <span class="celebration-logo"><img src="college-mark-v2.png" alt="顿河学院 Logo"></span>
    <span class="celebration-seal">完成</span>
    <p>WORK COMPLETE</p>
    <h2>恭喜你，完成工作！</h2>
    <div>${names[module] || '本项任务'}已经妥善收尾，辛苦了。</div>
    <button onclick="CompletionCelebration.close()">收下这份成就感</button>
  </div>`;
```

Add `.celebration-logo` styling in `don-college-ui.css` as a 72px warm-white floating circle with a 62px contained image and a gentle four-second vertical drift; disable the drift in reduced-motion mode.

- [ ] **Step 3: Restyle the completion card as a fountain-ripple moment**

Add:

```css
.celebration-card { background:var(--school-ceramic-0); border-color:rgba(255,255,255,.78); }
.celebration-card::before { background:radial-gradient(circle at 50% 20%, rgba(47,111,87,.14), transparent 28%), radial-gradient(circle at 50% 100%, rgba(150,59,61,.10), transparent 35%); }
.celebration-seal { color:var(--school-brick-700); border-color:var(--school-brick-700); }
.celebration-card button { background:var(--school-green-700); }
.celebration-logo { display:grid; place-items:center; width:72px; height:72px; margin:0 auto 10px; border-radius:50%; background:#fff; box-shadow:0 12px 28px rgba(23,55,47,.16); animation:schoolLogoFloat 4s ease-in-out infinite; }
.celebration-logo img { width:62px; height:62px; object-fit:contain; }
@keyframes schoolLogoFloat { 50% { transform:translateY(-6px) rotate(2deg); } }
```

- [ ] **Step 4: Run completion and motion tests**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_school_ui_contract tests.test_completion_experience -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit motion and completion**

```powershell
git add web/css/don-college-ui.css web/js/components/completion-celebration.js tests/test_school_ui_contract.py
git commit -m "feat: add school motion and completion identity"
```

### Task 6: Run full regression and desktop visual QA

**Files:**
- Verify: `web/index.html`
- Verify: `web/css/don-college-ui.css`
- Verify: `web/css/liquid-glass.css`
- Verify: `web/js/components/completion-celebration.js`
- Output: `artifacts/don-college-ui-*.png`

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
venv38\Scripts\python.exe -m unittest discover -s tests -v
```

Expected: all tests pass with no new errors.

- [ ] **Step 2: Scan runtime files for forbidden copy and stale blue glass**

Run:

```powershell
rg -n "中外合作办学|国际合作办学|俄罗斯学院|双校园" web backend
rg -n "#0071e3|#2997ff|rgba\(0,113,227" web/css/liquid-glass.css web/css/don-college-ui.css
```

Expected: both commands return no matches.

- [ ] **Step 3: Launch the source desktop app and inspect real states**

Run:

```powershell
Start-Process -FilePath "venv38\Scripts\python.exe" -ArgumentList "main.py" -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

Verify in the real pywebview window:

- Logo is crisp on splash, role selection, task center, side rail, counselor header, and completion.
- Role selection and task center match the approved warm green/ivory system.
- GPA review shows 11-course and 13-course cases without clipping.
- Import Studio fills the window and exposes original invalid values and actions.
- Award person drawers show five or more metrics without overlap.
- Light and dark themes preserve semantic colors.
- At 125% and 150% display scaling, controls and long filenames remain reachable.
- The file chooser still opens from GPA, moral, quality, comprehensive, counselor, and award pages.

- [ ] **Step 4: Capture representative screenshots**

Save screenshots to:

```text
artifacts/don-college-ui-role.png
artifacts/don-college-ui-task-center.png
artifacts/don-college-ui-gpa-review.png
artifacts/don-college-ui-import-studio.png
artifacts/don-college-ui-award-review.png
artifacts/don-college-ui-dark.png
```

Expected: each screenshot shows the real desktop app, not a standalone mockup.

- [ ] **Step 5: Commit verification artifacts only if they are intended project evidence**

```powershell
git add artifacts/don-college-ui-*.png
git commit -m "test: capture Don College UI verification"
```

If screenshots are temporary QA evidence, leave them uncommitted and report their absolute paths.

### Task 7: Build and verify the formal desktop executable

**Files:**
- Verify: `build.spec`
- Output: `dist/顿河学院学生测评管理软件.exe`

- [ ] **Step 1: Build the desktop executable**

Run:

```powershell
venv38\Scripts\python.exe -m PyInstaller --noconfirm --clean build.spec
```

Expected: PyInstaller finishes successfully and writes the executable under `dist`.

- [ ] **Step 2: Confirm the packaged CSS and logo assets are included**

Run:

```powershell
Select-String -LiteralPath build.spec -Pattern "web"
Get-Item "dist\顿河学院学生测评管理软件.exe" | Select-Object FullName, Length, LastWriteTime
```

Expected: `build.spec` bundles the full `web` directory and the executable has a fresh timestamp.

- [ ] **Step 3: Launch the packaged app for a final smoke test**

Run:

```powershell
Start-Process -FilePath "dist\顿河学院学生测评管理软件.exe"
```

Expected: the packaged app opens with the new branded splash and retains native file dialogs.

- [ ] **Step 4: Record the final checksum**

Run:

```powershell
Get-FileHash -Algorithm SHA256 "dist\顿河学院学生测评管理软件.exe"
```

Expected: a SHA256 value suitable for handoff.

- [ ] **Step 5: Commit only source changes, not the binary unless repository policy requires it**

```powershell
git status --short
git add web/index.html web/css/don-college-ui.css web/css/liquid-glass.css web/js/components/completion-celebration.js tests/test_school_ui_contract.py
git commit -m "feat: complete Don College A+C UI refresh"
```

Skip this final commit if every source change was already committed in Tasks 2–5.
