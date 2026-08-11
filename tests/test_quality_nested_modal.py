import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODAL_JS = (ROOT / "web" / "js" / "components" / "modal.js").read_text(encoding="utf-8")
BRAND_CSS = (ROOT / "web" / "css" / "don-college-ui.css").read_text(encoding="utf-8")
QUALITY_JS = (ROOT / "web" / "js" / "modules" / "quality.js").read_text(encoding="utf-8")


class QualityNestedModalTests(unittest.TestCase):
    def test_modal_is_raised_when_material_viewer_is_open(self):
        self.assertIn("material-viewer-overlay", MODAL_JS)
        self.assertIn("modal-over-material-viewer", MODAL_JS)
        self.assertIn("classList.remove('modal-over-material-viewer')", MODAL_JS)
        self.assertIn("qualityImportRefreshAfterThreshold", MODAL_JS)
        self.assertIn("#modal-overlay.modal-over-material-viewer", BRAND_CSS)
        self.assertRegex(
            BRAND_CSS,
            r"#modal-overlay\.modal-over-material-viewer\s*\{[^}]*z-index:\s*1[1-9]\d{3}",
        )

    def test_closing_threshold_editor_refreshes_open_student(self):
        self.assertIn(
            "closeModal();qualityImportRefreshAfterThreshold()",
            QUALITY_JS,
        )
        self.assertIn("qualityImportRenderThresholdMini()", QUALITY_JS)
        self.assertIn("qualityImportRenderViewerScores()", QUALITY_JS)


if __name__ == "__main__":
    unittest.main()
