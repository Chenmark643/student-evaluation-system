import unittest
import re
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
                      'relatedMultiplier', 'contributionFactor', 'duplicateWarning'):
            self.assertIn(token, js)

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
                      'qb-datalist', 'qb-cat', 'qualityBatchRenderCapHint',
                      'Object.values(mappings', 'qualityThresholds.forEach'):
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
                      '本组多项只取最高', '本组累计最高'):
            self.assertIn(token, body)

        activity_handler = re.search(
            r'async function qualityBatchOnActivityInput\(\).*?(?=\n\s*async function qualityBatchOnCat)',
            js, re.S,
        )
        category_handler = re.search(
            r'async function qualityBatchOnCat\(\).*?(?=\n\s*function qualityBatchGatherInput)',
            js, re.S,
        )
        self.assertIn('qualityBatchRenderCapHint', activity_handler.group(0))
        self.assertIn('qualityBatchRenderCapHint', category_handler.group(0))

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
