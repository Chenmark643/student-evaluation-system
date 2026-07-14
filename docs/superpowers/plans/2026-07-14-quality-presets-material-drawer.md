# 素拓预置规则库与材料加分抽屉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将《素拓加分细则》完整转为可搜索、可调整、可迁移的官方预置规则库，并把材料审核页替换为已确认的“专注预览 + 加分抽屉”工作区。

**Architecture:** 后端新增独立的 `quality_presets.py`，只负责官方目录、明确上限、旧出厂数据识别和单项分值计算；现有 `module_c_quality.py` 继续负责用户映射、总分计算与导出。前端新增独立的 `QualityMaterialDrawer` 组件管理项目搜索、草稿、自定义模板、系数和上限预览，`quality.js` 只负责把现有材料树与该组件连接起来。

**Tech Stack:** Python 3.8、unittest、JavaScript、HTML/CSS、pywebview、PyInstaller

**Implementation review decisions:** Tests use `unittest.TestCase` methods so the project runner discovers them. `load_user_activity_mappings()` reads the persisted user layer, while `load_activity_mappings()` returns the merged official + user view; every write path saves only the user layer. Official threshold constants stay in `backend/quality_presets.py`, and `module_c_quality._build_default_thresholds()` deep-copies them directly so `config.py` does not import backend modules. Execution stays in the current working tree because the approved UI and prior formal-app work are still uncommitted there; create a scoped backup before edits and leave installer/game files untouched.

---

## 文件职责

- 新建 `backend/quality_presets.py`：官方项目生成、官方上限、旧示例迁移、单项计分。
- 修改 `config.py`：加入细分上限类别，移除错误的社会实践总上限。
- 修改 `backend/module_c_quality.py`：按“官方底层 + 用户覆盖层”合并项目，公开预置目录。
- 修改 `backend/bridge.py`：向前端提供官方目录与单项计分预览接口。
- 新建 `web/js/components/quality-material-drawer.js`：抽屉状态、搜索、表单、草稿和上限预览。
- 新建 `web/css/quality-material-workspace.css`：详细稿 B 的三段式布局与响应式行为。
- 修改 `web/index.html`：加载新资源并调整材料查看器结构。
- 修改 `web/js/modules/quality.js`：将现有材料数据接入新抽屉。
- 新建 `tests/test_quality_presets.py`：细则数值、上限、迁移和计分测试。
- 新建 `tests/test_quality_material_workspace.py`：前端结构、响应式、层级与交互契约测试。

### Task 1: 建立官方项目目录

**Files:**
- Create: `backend/quality_presets.py`
- Create: `tests/test_quality_presets.py`

- [ ] **Step 1: 写目录失败测试**

```python
from backend.quality_presets import build_official_presets

def test_official_catalog_contains_rule_samples():
    rows = {row["id"]: row for row in build_official_presets()}
    assert rows["art-national-first"]["score"] == 6
    assert rows["art-school-encouragement"]["score"] == 0.2
    assert rows["sport-national-record"]["score"] == 10
    assert rows["contest-a-national-first"]["score"] == 14
    assert rows["contest-b-college-encouragement"]["score"] == 0.2
    assert rows["paper-natural-top"]["score"] == 15
    assert rows["patent-invention"]["score"] == 10
    assert rows["volunteer-competition"]["score"] == 0.3
    assert rows["college-activity-participation"]["score"] == 0.2
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: FAIL，提示 `backend.quality_presets` 不存在。

- [ ] **Step 3: 实现表格生成器与固定项目**

在 `backend/quality_presets.py` 定义以下精确数据并用笛卡尔组合生成项目：

```python
ART_SCORES = {
    "全国": {"一等奖": 6, "二等奖": 4, "三等奖": 3, "优秀（鼓励）奖": 2},
    "省级": {"一等奖": 5, "二等奖": 3, "三等奖": 2, "优秀（鼓励）奖": 1},
    "市级": {"一等奖": 4, "二等奖": 2.5, "三等奖": 2, "优秀（鼓励）奖": 1},
    "校级": {"一等奖": 2, "二等奖": 1, "三等奖": 0.5, "优秀（鼓励）奖": 0.2},
}
SPORT_SCORES = {
    "全国": [10, 8, 7, 6, 5, 4.5, 4, 3.5, 3],
    "省级": [8, 6, 5, 4, 3.5, 3, 2.8, 2.5, 2],
    "市级": [6, 4, 3, 2, 1.8, 1.6, 1.4, 1.2, 1],
    "校级": [4, 3, 2, 1.5, 1, 0.8, 0.6, 0.5, 0.3],
}
CONTEST_SCORES = {
    "A": {"国家级": [17, 14, 12, 10], "省级": [9, 8, 7, 6], "校级": [None, 5.5, 5, 4.5]},
    "B": {"国家级": [9, 8.5, 7.5, 6.5], "省部级": [6.5, 6, 5.5, 5], "校级": [None, 3.5, 3, 2.5], "学院": [None, 1, 0.8, 0.5]},
    "C": {"国家级": [4, 3.5, 3, 2.5], "省部级": [2.5, 2, 1.5, 1], "校级": [None, 1, 0.8, 0.5]},
    "D": {"国家级": [2.5, 2, 1.8, 1.5], "省部级": [1.5, 1.2, 1, 0.8], "校级": [None, 0.8, 0.6, 0.4]},
}
AWARDS = ["特等奖", "一等奖", "二等奖", "三等奖"]
```

每条记录统一由以下工厂产生，不把搜索逻辑散落在数据定义中：

```python
def preset(pid, name, category, grade, score, *, tags=(), note="", cap_group=None, score_range=None):
    return {
        "id": pid, "name": name, "category": category, "grade": grade,
        "score": float(score), "tags": list(tags), "rule_note": note,
        "cap_group": cap_group, "score_range": list(score_range) if score_range else None,
        "source": "official",
    }
```

固定项目必须包含论文全部等级、非学术文章、三类专利与软著、表演训练/演出、创业活动、国际会议、学生干部、社团、宿舍长、班主任助理、荣誉称号、社会实践考核与荣誉、志愿服务、活动参与、寒暑假实践和技能证书。B 类赛事名称放入对应项目的 `tags`，不复制出不同分值的重复记录。

- [ ] **Step 4: 运行目录测试确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add backend/quality_presets.py tests/test_quality_presets.py
git commit -m "feat: add official quality bonus catalog"
```

### Task 2: 修正并覆盖全部明确上限

**Files:**
- Modify: `config.py`
- Modify: `backend/quality_presets.py`
- Modify: `backend/module_c_quality.py`
- Test: `tests/test_quality_presets.py`

- [ ] **Step 1: 写上限失败测试**

```python
from backend.quality_presets import OFFICIAL_THRESHOLDS
from backend.module_c_quality import calculate_quality_scores

def test_explicit_caps_are_complete_and_no_social_total_cap_exists():
    rules = {r["name"]: r for r in OFFICIAL_THRESHOLDS}
    assert rules["比赛志愿服务每学期上限"]["max"] == 2
    assert rules["学院活动参与每学期上限"]["max"] == 1
    assert rules["寒暑假社会实践上限"]["max"] == 2
    assert rules["技能培训与证书上限"]["max"] == 3
    assert rules["学生干部任职取最高"]["mode"] == "max_item"
    assert rules["新生班主任助理取最高"]["max"] == 2
    assert not any(r["categories"] == ["社会实践类"] for r in OFFICIAL_THRESHOLDS)

def test_national_volunteer_honor_is_not_cut_to_three():
    result = calculate_quality_scores({"1": [{"activity": "国家级志愿荣誉", "category": "社会实践荣誉类", "score": 3.5}]})
    assert result["1"]["final_score"] == 3.5
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: FAIL，当前仍存在笼统社会实践上限且缺少细分类别。

- [ ] **Step 3: 实现明确上限**

`OFFICIAL_THRESHOLDS` 固定为：

```python
OFFICIAL_THRESHOLDS = [
    {"name": "比赛志愿服务每学期上限", "max": 2.0, "categories": ["比赛志愿服务类"], "mode": "sum"},
    {"name": "学院活动参与每学期上限", "max": 1.0, "categories": ["学院活动参与类"], "mode": "sum"},
    {"name": "寒暑假社会实践上限", "max": 2.0, "categories": ["寒暑假实践类"], "mode": "sum"},
    {"name": "技能培训与证书上限", "max": 3.0, "categories": ["技能证书类"], "mode": "sum"},
    {"name": "学生干部任职取最高", "max": 3.0, "categories": ["学生工作类"], "mode": "max_item"},
    {"name": "新生班主任助理取最高", "max": 2.0, "categories": ["班主任助理类"], "mode": "max_item"},
]
```

`config.py` 的 `QUALITY_CATEGORIES` 加入上述细分类别，`DEFAULT_THRESHOLDS` 只从 `OFFICIAL_THRESHOLDS` 映射生成，删除 `社会实践类`、`社会实践`、`志愿类` 的笼统 3 分封顶。旧类别仍保留在等级表中用于读取历史数据，但不再产生错误默认阈值。

- [ ] **Step 4: 运行上限测试确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets tests.test_completion_experience -v`  
Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add config.py backend/quality_presets.py backend/module_c_quality.py tests/test_quality_presets.py
git commit -m "fix: encode complete quality bonus caps"
```

### Task 3: 合并官方目录、迁移旧示例并保留用户覆盖

**Files:**
- Modify: `backend/quality_presets.py`
- Modify: `backend/module_c_quality.py`
- Modify: `backend/bridge.py`
- Test: `tests/test_quality_presets.py`

- [ ] **Step 1: 写迁移与覆盖失败测试**

```python
def test_legacy_factory_examples_are_replaced_but_user_edits_win(tmp_path):
    old = {"英语四级": {"category": "A类", "default_grade": "国家级", "default_score": 5, "last_used": ""}}
    merged = merge_official_with_user(old)
    assert merged["英语四级"]["default_score"] != 5
    edited = {"英语四级": {**old["英语四级"], "default_score": 2.25}}
    assert merge_official_with_user(edited)["英语四级"]["default_score"] == 2.25

def test_user_mapping_overrides_same_named_official_item():
    merged = merge_official_with_user({"比赛志愿服务": {"category": "自定义", "default_grade": "每次", "default_score": 0.4}})
    assert merged["比赛志愿服务"]["default_score"] == 0.4
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: FAIL，合并函数尚不存在。

- [ ] **Step 3: 实现可重复迁移**

`quality_presets.py` 保存旧出厂记录的完整签名，只在四个字段全部一致时替换：

```python
LEGACY_FACTORY_MAPPINGS = {
    "英语四级": ("A类", "国家级", 5.0),
    "英语六级": ("A类", "国家级", 8.0),
    "计算机二级": ("A类", "国家级", 5.0),
    "志愿服务": ("志愿类", "时长", 2.0),
    "学生会工作": ("组织测评", "良好", 5.0),
}
```

`merge_official_with_user(user)` 先按名称建立官方映射，再遍历用户映射；匹配旧签名的记录跳过，其余记录覆盖官方值。新增 `load_user_activity_mappings()` 只读取持久化用户层，`load_activity_mappings()` 返回合并结果；所有新增、修改、删除路径必须先调用前者，并让 `save_activity_mappings()` 始终只保存用户层，避免把几百条官方记录重复写进用户文件。

`bridge.py` 新增：

```python
def get_official_quality_presets() -> list:
    return build_official_presets()
```

- [ ] **Step 4: 运行迁移与现有素拓测试确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets tests.test_completion_experience tests.test_toolbox_contract -v`  
Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add backend/quality_presets.py backend/module_c_quality.py backend/bridge.py tests/test_quality_presets.py
git commit -m "feat: merge quality presets without overwriting users"
```

### Task 4: 实现次数、贡献和专业/俄语倍数预览

**Files:**
- Modify: `backend/quality_presets.py`
- Modify: `backend/bridge.py`
- Test: `tests/test_quality_presets.py`

- [ ] **Step 1: 写单项计分失败测试**

```python
def test_activity_score_supports_count_contribution_and_related_multiplier():
    score = calculate_activity_score(0.3, count=3, contribution=0.9, related=True)
    assert score == {"base_total": 0.9, "contribution_total": 0.81, "final": 1.62}

def test_score_range_warns_but_does_not_block_manual_value():
    result = validate_manual_score(2.5, score_range=(1, 2))
    assert result["allowed"] is True
    assert result["outside_official_range"] is True
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: FAIL，计分预览函数不存在。

- [ ] **Step 3: 实现纯函数与桥接接口**

```python
def calculate_activity_score(base_score, count=1, contribution=1.0, related=False):
    base_total = round(float(base_score) * max(1, int(count)), 4)
    contribution_total = round(base_total * float(contribution), 4)
    return {"base_total": base_total, "contribution_total": contribution_total,
            "final": round(contribution_total * (2 if related else 1), 4)}

def validate_manual_score(value, score_range=None):
    outside = bool(score_range) and not (float(score_range[0]) <= float(value) <= float(score_range[1]))
    return {"allowed": True, "outside_official_range": outside}
```

`bridge.py` 暴露同名预览接口，前端添加时把最终分写入现有 `score` 字段，并把 `base_score`、`count`、`contribution`、`related_multiplier`、`official_preset_id` 作为附加元数据保存。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_presets -v`  
Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add backend/quality_presets.py backend/bridge.py tests/test_quality_presets.py
git commit -m "feat: calculate adjustable quality bonus entries"
```

### Task 5: 建立材料抽屉组件和 UI 契约

**Files:**
- Create: `web/js/components/quality-material-drawer.js`
- Create: `web/css/quality-material-workspace.css`
- Create: `tests/test_quality_material_workspace.py`
- Modify: `web/index.html`

- [ ] **Step 1: 写前端契约失败测试**

```python
def test_material_workspace_assets_are_loaded():
    assert 'css/quality-material-workspace.css' in INDEX
    assert 'js/components/quality-material-drawer.js' in INDEX

def test_confirmed_focus_drawer_structure_exists():
    for token in ('quality-student-rail', 'quality-material-stage', 'quality-score-drawer',
                  'quality-preset-search', 'quality-cap-preview'):
        assert token in INDEX + DRAWER_JS

def test_responsive_drawer_never_squeezes_form():
    assert '@media (max-width: 880px)' in WORKSPACE_CSS
    assert 'position: fixed' in WORKSPACE_CSS
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace -v`  
Expected: FAIL，新资源与结构不存在。

- [ ] **Step 3: 加载组件资源并建立命名空间**

在 `index.html` 中将新 CSS 放在 `don-college-ui.css` 之前，将新 JS 放在 `quality.js` 之前。组件只导出一个全局对象：

```javascript
window.QualityMaterialDrawer = {
  mount(options), setStudent(student, activities), setFiles(files),
  open(), close(), getDraft(), clearDraft(), renderCapPreview()
};
```

`mount` 接受 `{root, onAdd, onStudentChange, onFileChange, onMarkDone}`，不直接调用 eel，避免 UI 与后端耦合。

- [ ] **Step 4: 实现已确认的三段式布局**

CSS 使用：宽屏 `260px minmax(0,1fr) 390px`；中屏姓名栏 `76px`；小于 880px 时抽屉 `position: fixed` 覆盖预览。抽屉和材料查看器的二级规则弹窗沿用 `modal-over-material-viewer`，规则弹窗保持 `z-index:12000`。

- [ ] **Step 5: 运行 UI 契约确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace tests.test_quality_nested_modal tests.test_school_ui_contract -v`  
Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add web/index.html web/js/components/quality-material-drawer.js web/css/quality-material-workspace.css tests/test_quality_material_workspace.py
git commit -m "feat: add focused quality material drawer workspace"
```

### Task 6: 接入真实材料、搜索、草稿和自定义模板

**Files:**
- Modify: `web/js/components/quality-material-drawer.js`
- Modify: `web/js/modules/quality.js`
- Modify: `web/js/components/modal.js`
- Test: `tests/test_quality_material_workspace.py`

- [ ] **Step 1: 写交互失败测试**

```python
def test_drawer_supports_search_drafts_and_custom_templates():
    for token in ('filterPresets', 'saveDraft', 'restoreDraft', 'saveAsUserTemplate',
                  'relatedMultiplier', 'contributionFactor', 'duplicateWarning'):
        assert token in DRAWER_JS

def test_quality_module_wires_real_material_state_to_drawer():
    for token in ('QualityMaterialDrawer.mount', 'QualityMaterialDrawer.setStudent',
                  'QualityMaterialDrawer.setFiles'):
        assert token in QUALITY_JS
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace -v`  
Expected: FAIL，交互函数尚未实现。

- [ ] **Step 3: 实现搜索与表单状态**

搜索同时匹配 `name/category/grade/tags`；官方项可复制为用户模板但不可原地删除。草稿按学生 key 存在内存映射 `draftsByStudent`，切换学生时保存当前表单，返回时恢复。个人模板存入现有用户映射接口，并加入“优先显示”布尔字段。

- [ ] **Step 4: 接入次数、贡献、倍数、上限和重复提示**

抽屉在每次表单变化时显示：

```text
基础分 × 次数 × 贡献系数 × 专业/俄语倍数 = 原始分
本组已计入 + 本次原始分 → 封顶后有效分
```

同一学生已有活动名称与当前项目名称标准化后相同，或使用相同 `official_preset_id` 时显示 `duplicateWarning`；默认建议保留最高项，但用户确认后可以继续添加。

- [ ] **Step 5: 用现有真实材料流程连接组件**

`qualityImportOpenViewer()` 不再拼接拥挤的评分 HTML，而是将 `studentData`、`studentFiles`、现有活动和上限交给组件。`onAdd` 最终仍写入 `qualityData[sid]` 并调用现有保存、进度和渲染逻辑，避免改动导出格式。

- [ ] **Step 6: 运行交互和素拓回归测试确认 GREEN**

Run: `venv38\Scripts\python.exe -m unittest tests.test_quality_material_workspace tests.test_quality_nested_modal tests.test_completion_experience -v`  
Expected: PASS。

- [ ] **Step 7: 提交**

```powershell
git add web/js/components/quality-material-drawer.js web/js/modules/quality.js web/js/components/modal.js tests/test_quality_material_workspace.py
git commit -m "feat: connect presets and custom scoring to materials"
```

### Task 7: 全量验证、真实窗口 QA 与正式打包

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: 运行正式应用相关测试**

Run:

```powershell
venv38\Scripts\python.exe -m unittest tests.test_quality_presets tests.test_quality_material_workspace tests.test_quality_nested_modal tests.test_school_ui_contract tests.test_completion_experience tests.test_desktop_contract tests.test_gpa_variable_courses tests.test_import_studio tests.test_major_scope tests.test_moral_summary_compat tests.test_theme_contract tests.test_toolbox_contract -v
```

Expected: 全部 PASS。

- [ ] **Step 2: 真实窗口检查三种宽度**

启动 `main.py`，依次检查 1400×900、1100×700 和窄窗口：姓名栏能收合、材料保持主要面积、抽屉在窄屏覆盖显示、上限弹窗高于材料查看器、所有按钮与输入完整可见。

- [ ] **Step 3: 使用一组规则样例人工验算**

验证：比赛志愿服务 7 次得到原始 2.1、有效 2；学院活动 6 次得到原始 1.2、有效 1；国家级志愿荣誉仍为 3.5；干部优秀 3 与良好 2 只取 3，班主任助理优秀 2 可再叠加；0.3×3×90%×2 得 1.62。

- [ ] **Step 4: 重建正式 EXE**

Run: `venv38\Scripts\python.exe -m PyInstaller --noconfirm --clean build.spec`  
Expected: exit 0，生成 `dist\顿河学院学生测评管理软件.exe`。

- [ ] **Step 5: 启动成品并生成校验值**

启动新 EXE，确认窗口出现且材料审核工作区可进入；运行 `Get-FileHash 'dist\顿河学院学生测评管理软件.exe' -Algorithm SHA256` 并记录结果。

- [ ] **Step 6: 提交最终验证修正（如有）**

如验证暴露并修复了本功能范围内的问题，只精确暂存实际改动过的以下文件：`backend/quality_presets.py`、`backend/module_c_quality.py`、`backend/bridge.py`、`config.py`、`web/index.html`、`web/js/components/quality-material-drawer.js`、`web/js/modules/quality.js`、`web/js/components/modal.js`、`web/css/quality-material-workspace.css`、`tests/test_quality_presets.py`、`tests/test_quality_material_workspace.py`；没有额外修复则不创建空提交。
