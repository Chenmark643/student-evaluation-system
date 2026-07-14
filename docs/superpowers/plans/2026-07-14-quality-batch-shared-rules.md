# Quality Batch Shared Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make batch quality scoring load and use the same activity catalog, categories, grades, scores, and cap rules as individual scoring.

**Architecture:** Keep `qualityThresholds` and the existing backend catalog/category APIs as the only sources of truth. Extend the batch initializer and field-change handlers inside `quality.js`, then render a rule summary beside the batch form; keep preview and export on the existing shared threshold calculators.

**Tech Stack:** JavaScript, Eel bridge APIs, Python `unittest` source-contract tests, PyInstaller.

---

## File Structure

- Modify `web/js/modules/quality.js`: load shared options into the batch form, synchronize preset fields, and render the matching cap rule.
- Modify `tests/test_quality_material_workspace.py`: assert shared batch initialization and rule-summary behavior.
- Reuse `tests/test_quality_export_caps.py`: verify the exported workbook still merges capped groups and applies `max_item`.

### Task 1: Reproduce Missing Shared Batch Options

**Files:**
- Modify: `tests/test_quality_material_workspace.py`
- Test: `tests/test_quality_material_workspace.py`

- [ ] **Step 1: Write the failing source-contract test**

Add a test that extracts `qualityBatchInitUI` and requires it to load the same catalog and categories used by individual scoring:

```python
def test_batch_scoring_loads_shared_catalog_categories_and_cap_summary(self):
    js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
    init = re.search(
        r'async function qualityBatchInitUI\(\).*?(?=\n\s*function qualityBatchRenderStudentList)',
        js, re.S,
    )
    self.assertIsNotNone(init)
    for token in ('load_activity_mappings_json', 'get_quality_categories',
                  'qb-datalist', 'qb-cat', 'qualityBatchRenderCapHint'):
        self.assertIn(token, init.group(0))
    self.assertIn('id="qb-cap-hint"', js)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace.QualityMaterialWorkspaceTests.test_batch_scoring_loads_shared_catalog_categories_and_cap_summary -v
```

Expected: FAIL because `qualityBatchInitUI` is synchronous and only initializes the class filter.

- [ ] **Step 3: Commit the failing test only after confirming the failure reason**

```powershell
git add -- tests/test_quality_material_workspace.py
git commit -m "test: cover shared options in quality batch scoring"
```

### Task 2: Load Shared Catalog and Categories

**Files:**
- Modify: `web/js/modules/quality.js:147-160`
- Modify: `web/js/modules/quality.js:1029-1040`
- Test: `tests/test_quality_material_workspace.py`

- [ ] **Step 1: Add a cap-summary target below the batch fields**

Insert this element after the batch form row:

```html
<div id="qb-cap-hint" class="quality-batch-cap-hint">选择项目或类别后显示适用上限</div>
```

- [ ] **Step 2: Make the initializer populate all shared controls**

Change the initializer to `async function qualityBatchInitUI()` and load both existing APIs:

```javascript
async function qualityBatchInitUI() {
    const classSel = document.getElementById('qb-class-filter');
    if (classSel) {
        classSel.innerHTML = '<option value="">全部班级</option>';
        qualityClassOrder.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            option.selected = cls === qualityBatchClassFilter;
            classSel.appendChild(option);
        });
    }
    try {
        const [categories, mappings] = await Promise.all([
            eel.get_quality_categories()(),
            eel.load_activity_mappings_json()(),
        ]);
        const categorySel = document.getElementById('qb-cat');
        const datalist = document.getElementById('qb-datalist');
        if (categorySel) {
            const current = categorySel.value;
            categorySel.innerHTML = '<option value="">-- 类别 --</option>';
            (categories || []).forEach(category => categorySel.add(new Option(category, category)));
            if ([...categorySel.options].some(option => option.value === current)) categorySel.value = current;
        }
        if (datalist) {
            datalist.innerHTML = '';
            Object.keys(mappings || {}).forEach(name => datalist.appendChild(new Option('', name)));
        }
    } catch (error) {
        console.error('批量加分选项加载失败', error);
    }
    qualityBatchRenderCapHint();
}
```

- [ ] **Step 3: Await initialization at both import-mode entry points**

Replace each bare call with:

```javascript
await qualityBatchInitUI();
qualityBatchRenderStudentList();
```

Where the call is inside a non-async deferred callback, call `qualityBatchInitUI().then(qualityBatchRenderStudentList)`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace -v
```

Expected: all quality material workspace tests pass.

- [ ] **Step 5: Commit shared option loading**

```powershell
git add -- web/js/modules/quality.js tests/test_quality_material_workspace.py
git commit -m "fix: load shared options in quality batch scoring"
```

### Task 3: Synchronize Fields and Show the Matching Cap

**Files:**
- Modify: `web/js/modules/quality.js:1136-1178`
- Modify: `tests/test_quality_material_workspace.py`

- [ ] **Step 1: Extend the failing test with field and cap-rule requirements**

Require these tokens in the batch handlers:

```python
self.assertIn('qualityBatchRenderCapHint', js)
self.assertIn("thCats.includes(category)", js)
self.assertIn("th.mode === 'max_item'", js)
self.assertIn('本组多项只取最高', js)
self.assertIn('本组累计最高', js)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the same focused unittest command. Expected: FAIL because no cap renderer exists.

- [ ] **Step 3: Implement the cap renderer**

Add:

```javascript
function qualityBatchRenderCapHint() {
    const target = document.getElementById('qb-cap-hint');
    const category = document.getElementById('qb-cat')?.value || '';
    if (!target) return;
    if (!category) {
        target.textContent = '选择项目或类别后显示适用上限';
        return;
    }
    const rules = qualityThresholds.filter(th => {
        const thCats = th.categories || [];
        return thCats.includes(category);
    });
    if (!rules.length) {
        target.textContent = `“${category}”暂无上限规则`;
        return;
    }
    target.innerHTML = rules.map(th => th.mode === 'max_item'
        ? `🏆 ${escapeHtml(th.name)}：本组多项只取最高，最高 ${th.max} 分`
        : `Σ ${escapeHtml(th.name)}：本组累计最高 ${th.max} 分`).join('<br>');
}
```

- [ ] **Step 4: Trigger the renderer from all relevant field changes**

Call `qualityBatchRenderCapHint()` after the activity preset populates fields, after category/grade options load, and after threshold editing refreshes the material drawer.

- [ ] **Step 5: Run quality and export regression tests**

Run:

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace tests.test_quality_export_caps tests.test_quality_presets tests.test_quality_nested_modal -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit field synchronization and cap hint**

```powershell
git add -- web/js/modules/quality.js tests/test_quality_material_workspace.py
git commit -m "feat: show shared caps in quality batch scoring"
```

### Task 4: Package and Verify the Desktop App

**Files:**
- Build output: `dist/顿河学院学生测评管理软件.exe`

- [ ] **Step 1: Run the relevant regression suite**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace tests.test_quality_export_caps tests.test_quality_presets tests.test_quality_nested_modal tests.test_desktop_contract -v
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 2: Stop only the current packaged app process**

Resolve the exact EXE path and stop processes whose `Path` equals it.

- [ ] **Step 3: Rebuild the main EXE**

```powershell
.\venv38\Scripts\pyinstaller.exe --clean --noconfirm build.spec
```

Expected: exit code 0 and a fresh `dist/顿河学院学生测评管理软件.exe`.

- [ ] **Step 4: Launch and verify the packaged app**

Start the rebuilt EXE, confirm its main window title is `顿河学院学生测评管理软件`, and record its SHA-256 hash.

