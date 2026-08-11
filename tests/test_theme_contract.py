"""Regression checks for the explicit light/dark theme contract."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = (ROOT / "web/js/main.js").read_text(encoding="utf-8")
APPLE_CSS = (ROOT / "web/css/apple-ui.css").read_text(encoding="utf-8")


class ThemeContractTests(unittest.TestCase):
    def test_theme_state_is_always_explicit(self):
        self.assertIn("setAttribute('data-theme', next)", MAIN_JS)
        self.assertNotIn("removeAttribute('data-theme')", MAIN_JS)
        self.assertIn("cur === 'light' ? 'dark' : 'light'", MAIN_JS)

    def test_both_apple_theme_surfaces_exist(self):
        self.assertIn("color-scheme: light", APPLE_CSS)
        self.assertIn('[data-theme="dark"]', APPLE_CSS)
        self.assertIn("color-scheme: dark", APPLE_CSS)
        self.assertIn("--bg-root: #0b0b0d", APPLE_CSS)

    def test_manual_preference_is_persisted(self):
        self.assertIn("localStorage.setItem('theme_override', next)", MAIN_JS)
        self.assertIn("saved === 'light' || saved === 'dark'", MAIN_JS)


if __name__ == "__main__":
    unittest.main()
