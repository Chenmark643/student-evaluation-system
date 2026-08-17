from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
BRAND = ROOT / "web/css/don-college-ui.css"
GLASS = ROOT / "web/css/liquid-glass.css"
COMPLETION = ROOT / "web/js/components/completion-celebration.js"
MAIN = ROOT / "web/js/main.js"
COMPREHENSIVE = ROOT / "web/js/modules/comprehensive.js"
ANNUAL_CSS = ROOT / "web/css/annual.css"
ANNUAL = ROOT / "web/js/modules/annual.js"


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

    def test_workspace_navigation_includes_annual_renderer(self):
        main = MAIN.read_text(encoding="utf-8")
        switch_module = main.split("function switchModule(moduleName)", 1)[1].split("function initNavigation()", 1)[0]
        self.assertIn("annual:'学年排名汇总'", switch_module)
        self.assertIn("annual:renderModuleAnnual", switch_module)

    def test_comprehensive_ledger_ui_preserves_processing_contract(self):
        runtime = COMPREHENSIVE.read_text(encoding="utf-8")
        css = ANNUAL_CSS.read_text(encoding="utf-8")
        for marker in (
            'class="comp-workspace"', 'class="comp-file-grid"',
            "_compFileMapped('comp-gpa'", "_compFileMapped('comp-moral'", "_compFileMapped('comp-quality'",
            'id="${id}-file"', 'id="comp-output-dir"', 'name="comp-sports-mode"',
            'aria-label="${label}文件路径"',
            "eel.run_module_d", "CloudSync.request('comprehensive-main')",
            "CloudSync.request('comprehensive-ranking')",
            "function openComprehensiveOutput(kind)",
            "openComprehensiveOutput('main')", "openComprehensiveOutput('ranking')",
        ):
            self.assertIn(marker, runtime)
        for selector in (".comp-hero", ".comp-file-card", ".comp-sports-options", ".comp-actionbar"):
            self.assertIn(selector, css)

    def test_annual_year_is_editable_and_must_be_consecutive(self):
        annual = ANNUAL.read_text(encoding="utf-8")
        self.assertIn('学年（可修改）', annual)
        self.assertIn('id="annual-year"', annual)
        self.assertIn("Number(yearMatch[2]) !== Number(yearMatch[1]) + 1", annual)


if __name__ == "__main__":
    unittest.main()
