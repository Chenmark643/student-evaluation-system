"""UI contracts for both moral-score workspace routes."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MoralVNextUiTests(unittest.TestCase):
    def test_continuation_route_explains_in_place_total_export(self):
        source = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        self.assertIn("新增扣分插在“总扣分”前", source)
        self.assertIn("沿用原“最终得分”列并更新公式", source)

    def test_fresh_route_has_dynamic_items_and_configurable_bounds(self):
        source = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        for marker in ("moral-fresh-items", "moral-fresh-base", "moral-fresh-min", "moral-fresh-max", "run_moral_fresh"):
            self.assertIn(marker, source)
        self.assertIn("moralOpenBatchEntry", source)
        self.assertIn("eel.select_files", source)
        self.assertIn("major_filter:MajorScope.get()", source)
        self.assertIn("moralOpenFreshReview", source)
        self.assertIn("moralSetFreshIssueAction", source)
        self.assertIn("moralRemapFreshIssue", source)
        self.assertIn("suggested_student_key", source)
        self.assertIn("moralExcludeAllFreshIssues", source)
        self.assertIn("一键排除全部未匹配", source)

    def test_item_direction_can_be_changed_after_creation_in_both_routes(self):
        source = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        self.assertIn("function moralUpdateItemDirection", source)
        self.assertGreaterEqual(source.count("moralUpdateItemDirection("), 3)
        self.assertIn("moral-direction-editor", source)

    def test_continuation_review_is_major_scoped_and_has_bulk_resolutions(self):
        source = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        self.assertGreaterEqual(source.count("major_filter:MajorScope.get()"), 2)
        self.assertIn("function moralFillAllRawFromDisplay", source)
        self.assertIn("function moralExcludeAllVnextIssues", source)
        self.assertIn("一键用显示分补齐", source)
        self.assertIn("一键排除全部", source)
        self.assertIn("只审查当前所选专业", source)

    def test_simplified_workspace_uses_material_choices_presets_and_advanced_disclosure(self):
        source = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        for marker in (
            "我有部分德育表", "我还没有德育表", "我已有最终德育表",
            "function moralPresetMarkup", "function moralAddPresetItem",
            "moral-advanced-config", "让系统自动判断（推荐）", "moral-ready-summary",
        ):
            self.assertIn(marker, source)
        self.assertNotIn("data-moral-route=\"continue\"", source)

    def test_bridge_exposes_fresh_dynamic_engine(self):
        source = (ROOT / "backend" / "bridge.py").read_text(encoding="utf-8")
        self.assertIn("def run_moral_fresh", source)
        self.assertIn("def list_moral_students", source)

    def test_cloud_sync_collects_mixed_a_and_b_outputs_before_upload(self):
        moral = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        cloud = (ROOT / "web" / "js" / "components" / "cloud-sync.js").read_text(encoding="utf-8")
        bridge = (ROOT / "backend" / "bridge.py").read_text(encoding="utf-8")
        self.assertIn("moralCloudOutputs", moral)
        self.assertIn("moralRememberOutput", moral)
        self.assertIn("prepare_moral_cloud_bundle", cloud)
        self.assertIn("系统已把 A/B 结果整理成", cloud)
        self.assertIn("def prepare_moral_cloud_bundle", bridge)


if __name__ == "__main__":
    unittest.main()
