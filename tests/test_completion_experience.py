import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CompletionExperienceTests(unittest.TestCase):
    def test_ai_assistant_is_not_loaded_or_exposed(self):
        index = (ROOT / 'web/index.html').read_text(encoding='utf-8')
        bridge = (ROOT / 'backend/bridge.py').read_text(encoding='utf-8')
        self.assertNotIn('components/ai-panel.js', index)
        self.assertNotIn('def ai_chat(', bridge)
        self.assertNotIn('def ai_has_key(', bridge)
        self.assertFalse((ROOT / 'backend/ai_assistant.py').exists())

    def test_every_primary_module_marks_real_completion(self):
        expected = {
            'gpa.js': "CompletionCelebration.mark('gpa'",
            'moral.js': "CompletionCelebration.mark('moral'",
            'quality.js': "CompletionCelebration.mark('quality'",
            'comprehensive.js': "CompletionCelebration.mark('comprehensive'",
        }
        for filename, marker in expected.items():
            source = (ROOT / 'web/js/modules' / filename).read_text(encoding='utf-8')
            self.assertIn(marker, source)

    def test_finished_moral_sheet_is_validated_and_counted(self):
        source = (ROOT / 'web/js/modules/moral.js').read_text(encoding='utf-8')
        self.assertIn("analyze_import_file(path, 'moral')", source)
        self.assertIn("localStorage.setItem('moral_finished_file_v1'", source)
        self.assertIn("CompletionCelebration.mark('moral', path)", source)

    def test_reduced_motion_is_supported(self):
        css = (ROOT / 'web/css/components.css').read_text(encoding='utf-8')
        self.assertIn('prefers-reduced-motion:reduce', css)


if __name__ == '__main__':
    unittest.main()
