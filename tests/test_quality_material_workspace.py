import unittest
import re
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / 'web' / 'index.html').read_text(encoding='utf-8')


class QualityMaterialWorkspaceTests(unittest.TestCase):
    def test_workspace_assets_and_structure_are_loaded(self):
        self.assertIn('css/quality-material-workspace.css', INDEX)
        self.assertIn('js/components/quality-material-drawer.js', INDEX)
        for token in ('quality-student-rail', 'quality-material-stage', 'quality-score-drawer',
                      'quality-preset-search', 'quality-cap-preview'):
            self.assertIn(token, INDEX + self._drawer())

    def test_responsive_drawer_never_squeezes_form(self):
        css = (ROOT / 'web' / 'css' / 'quality-material-workspace.css').read_text(encoding='utf-8')
        self.assertIn('@media (max-width: 880px)', css)
        self.assertIn('position: fixed', css)
        self.assertIn('minmax(0, 1fr)', css)

    def test_drawer_supports_search_drafts_templates_and_adjustments(self):
        js = self._drawer()
        for token in ('filterPresets', 'saveDraft', 'restoreDraft', 'saveAsUserTemplate',
                      'contribution_policy', 'contributionFactor', 'duplicateWarning',
                      'renderSelectedRule'):
            self.assertIn(token, js)
        self.assertNotIn('与专业或俄语相关', js)

    def test_quality_module_wires_real_material_state_to_drawer(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        for token in ('QualityMaterialDrawer.mount', 'QualityMaterialDrawer.setStudent',
                      'QualityMaterialDrawer.setFiles'):
            self.assertIn(token, js)

    def test_confirm_add_does_not_append_to_shared_activity_array_twice(self):
        js = self._drawer()
        match = re.search(r'function confirmAdd\(\).*?(?=\n\s*function renderExisting)', js, re.S)
        self.assertIsNotNone(match)
        body = match.group(0)
        self.assertIn('state.options.onAdd', body)
        self.assertNotIn('state.activities.push', body)

    def test_all_thresholds_remain_visible_and_manageable(self):
        js = self._drawer()
        self.assertIn('quality-threshold-summary', js)
        self.assertIn('renderThresholdSummary', js)
        self.assertIn('state.thresholds.map', js)
        self.assertIn('qualityImportShowThresholds()', js)
        setter = re.search(r'function setThresholds\(rows\).*?\}', js, re.S)
        self.assertIsNotNone(setter)
        self.assertIn('renderThresholdSummary', setter.group(0))

    def test_threshold_editor_refreshes_the_new_drawer_not_legacy_markup(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        match = re.search(r'function qualityImportRefreshAfterThreshold\(\).*?(?=\n\s*(?:async )?function)', js, re.S)
        self.assertIsNotNone(match)
        body = match.group(0)
        self.assertIn('QualityMaterialDrawer.setThresholds', body)
        self.assertIn('qualityBatchRenderCapHint', body)
        self.assertNotIn('qualityImportRenderViewerScores', body)

    def test_frontend_fallback_keeps_the_six_current_caps(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        self.assertIn('QUALITY_FALLBACK_THRESHOLDS', js)
        for name in ('比赛志愿服务每学期上限', '学院活动参与每学期上限', '寒暑假社会实践上限',
                     '技能培训与证书上限', '学生干部任职取最高', '新生班主任助理取最高'):
            self.assertIn(name, js)
        self.assertNotIn("name:'社会实践类上限'", js)

    def test_batch_scoring_loads_shared_catalog_categories_and_cap_summary(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        init = re.search(
            r'async function qualityBatchInitUI\(\).*?(?=\n\s*function qualityBatchRenderStudentList)',
            js, re.S,
        )
        self.assertIsNotNone(init)
        for token in ('load_activity_mappings_json', 'get_quality_categories',
                      'get_official_quality_presets', 'qb-rule-datalist', 'qb-cat',
                      'qualityBatchRenderCapHint', 'Object.values(mappings',
                      'qualityThresholds.forEach', 'qualityBatchRuleByLabel'):
            self.assertIn(token, init.group(0))
        self.assertIn('id="qb-cap-hint"', js)

    def test_batch_scoring_shows_matching_sum_and_max_item_caps(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        renderer = re.search(
            r'function qualityBatchRenderCapHint\(\).*?(?=\n\s*function qualityBatchRenderStudentList)',
            js, re.S,
        )
        self.assertIsNotNone(renderer)
        body = renderer.group(0)
        for token in ("thCats.includes(category)", "th.mode === 'max_item'",
                      '同组出现多项时只计最高单项', '累计封顶'):
            self.assertIn(token, body)

        activity_handler = re.search(
            r'async function qualityBatchOnRuleInput\(\).*?(?=\n\s*async function qualityBatchOnCat)',
            js, re.S,
        )
        category_handler = re.search(
            r'async function qualityBatchOnCat\(\).*?(?=\n\s*function qualityBatchGatherInput)',
            js, re.S,
        )
        self.assertIn('qualityBatchRenderCapHint', activity_handler.group(0))
        self.assertIn('qualityBatchRenderCapHint', category_handler.group(0))

    def test_file_recognition_precedes_batch_and_syncs_reliable_matches(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        self.assertLess(js.index('id="quality-file-recognition-section"'), js.index('id="quality-batch-section"'))
        for token in ('recognize_quality_bonus_file', 'qualityRecognitionAnalyze',
                      'qualityRecognitionSyncTargets', 'qualityRecognitionEditMatch',
                      'qualityRecognitionManagedTargets', 'qualityRecognitionSearchRoster',
                      'qualityRecognitionUseCandidate', '最相似候选',
                      '输入姓名、班级或学号'):
            self.assertIn(token, js)

    def test_batch_preview_shows_cap_group_and_effective_increment(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        for token in ('qualityBatchCapUsage', '所在上限组', '有效计入',
                      'qualityBatchScoreForSid', 'qb-score-mode'):
            self.assertIn(token, js)

    def test_duplicate_reminder_distinguishes_exact_and_possible_matches(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        for token in ('qualityFindDuplicate', "level: exact.length ? 'exact'",
                      "possible.length ? 'possible'", 'quality-auto-duplicate-hint',
                      '发现确定重复项', '发现疑似重复项'):
            self.assertIn(token, js)

        drawer = self._drawer()
        for token in ('duplicateCheck', "duplicate.level!=='none'",
                      'qualityAskDuplicateResolution', "decision==='replace'"):
            self.assertIn(token, drawer)

    @unittest.skipUnless(shutil.which('node'), 'Node.js is required for the JavaScript similarity contract')
    def test_fuzzy_duplicate_name_matching_catches_containment_and_chinese_phrases(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        start = js.index('function qualityNormalizeDuplicateText')
        end = js.index('function qualityDuplicateRelationText')
        snippet = js[start:end]
        cases = [
            ['俄语俱乐部表演', '俄语俱乐部'],
            ['俄语俱乐部演出', '俄语俱乐部表演'],
            ['大学生志愿服务', '俄语俱乐部'],
            ['比赛', '比赛表演'],
        ]
        script = snippet + f"\nprocess.stdout.write(JSON.stringify({json.dumps(cases, ensure_ascii=False)}.map(([a,b])=>qualityAreProjectNamesSimilar(a,b))));"
        result = subprocess.run(['node', '-e', script], check=True, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual([True, True, False, False], json.loads(result.stdout))
        self.assertIn('qualityAreProjectNamesSimilar(item.activity', js)
        self.assertIn('window.qualityAreProjectNamesSimilar', self._drawer())

    def test_batch_duplicate_preview_requires_a_keep_or_delete_decision(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        preview = re.search(
            r'function qualityBatchRefreshPreview\(.*?(?=\n\s*async function qualityBatchExecute)',
            js, re.S,
        )
        execute = re.search(
            r'async function qualityBatchExecute\(\).*?(?=\n\s*function qualityBatchDeselectDups)',
            js, re.S,
        )
        self.assertIsNotNone(preview)
        self.assertIsNotNone(execute)
        for token in ('possibleCount', '确定重复，执行前选择', '疑似重复，执行前选择',
                      'quality-preview-duplicate-possible'):
            self.assertIn(token, preview.group(0))
        for token in ('duplicateRows', 'qualityAskDuplicateResolution',
                      "duplicateDecision === 'replace'", "duplicate.level !== 'none'"):
            self.assertIn(token, execute.group(0))

    def test_duplicate_decision_allows_keep_replace_or_cancel_incoming(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        decision = re.search(
            r'function qualityAskDuplicateResolution\(.*?(?=\n\s*function qualityAutoDuplicateCheck)',
            js, re.S,
        )
        self.assertIsNotNone(decision)
        for token in ('全部保留', '删除旧项，保留本次', '取消本次，保留旧项',
                      "qualityResolveDuplicateDecision('keep_all')",
                      "qualityResolveDuplicateDecision('replace')",
                      "qualityResolveDuplicateDecision('keep_existing')"):
            self.assertIn(token, decision.group(0))

    def test_duplicate_states_have_visible_workspace_styles(self):
        css = (ROOT / 'web' / 'css' / 'quality-material-workspace.css').read_text(encoding='utf-8')
        for token in ('.quality-duplicate-hint', '.quality-duplicate-warning.exact',
                      '.quality-preview-duplicate-possible', '.quality-preview-duplicate-exact',
                      '.quality-duplicate-decision', '.quality-duplicate-compare-row'):
            self.assertIn(token, css)

    def test_quick_entry_keeps_project_name_separate_from_rule_template(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        for token in ('quality-project-datalist', 'quality-rule-datalist',
                      'qualityOnRuleInput', 'qualityAutoRenderCapHint',
                      'qualityAutoSelectedRule'):
            self.assertIn(token, js)
        self.assertNotIn('id="quality-datalist"', js)

    def test_saved_shadow_duplicates_from_the_broken_drawer_are_repaired(self):
        js = (ROOT / 'web' / 'js' / 'modules' / 'quality.js').read_text(encoding='utf-8')
        self.assertIn('qualityRepairDrawerDuplicatePairs', js)
        restore = re.search(r'async function _qualityImportRestoreData\(\).*?(?=\n\n)', js, re.S)
        self.assertIsNotNone(restore)
        self.assertIn('qualityRepairDrawerDuplicatePairs', restore.group(0))
        self.assertIn('base_score', js)

    @staticmethod
    def _drawer():
        path = ROOT / 'web' / 'js' / 'components' / 'quality-material-drawer.js'
        return path.read_text(encoding='utf-8') if path.exists() else ''


if __name__ == '__main__':
    unittest.main()
