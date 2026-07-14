import unittest
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

    @staticmethod
    def _drawer():
        path = ROOT / 'web' / 'js' / 'components' / 'quality-material-drawer.js'
        return path.read_text(encoding='utf-8') if path.exists() else ''


if __name__ == '__main__':
    unittest.main()
