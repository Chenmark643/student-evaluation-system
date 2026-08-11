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
            for p in (ROOT / "web").rglob("*")
            if p.suffix in {".html", ".js", ".css"}
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
