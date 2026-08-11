import unittest
import ctypes
from pathlib import Path
from unittest.mock import Mock, patch

import main


ROOT = Path(__file__).resolve().parents[1]


class KdocsLoginPageTests(unittest.TestCase):
    def test_cloud_workspace_is_wired_into_navigation(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        main = (ROOT / "web" / "js" / "main.js").read_text(encoding="utf-8")
        cloud = (ROOT / "web" / "js" / "modules" / "cloud.js").read_text(encoding="utf-8")

        self.assertIn('data-module="cloud"', html)
        self.assertIn('js/modules/cloud.js', html)
        self.assertIn('cloud: renderCloudWorkspace', main)
        self.assertIn('async function cloudLogin()', cloud)
        self.assertIn('async function cloudBind(', cloud)

    def test_cloud_sync_uses_background_progress_job(self):
        gpa = (ROOT / "web" / "js" / "modules" / "gpa.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "css" / "don-college-ui.css").read_text(encoding="utf-8")
        self.assertIn("kdocs_start_sync_workbook", gpa)
        self.assertIn("kdocs_get_sync_progress", gpa)
        self.assertIn("kdocs-progress-fill", gpa)
        self.assertIn(".kdocs-sync-progress", css)
        main = (ROOT / "web" / "js" / "main.js").read_text(encoding="utf-8")
        self.assertIn("modal-locked", main)

    def test_cloud_workspace_can_reorder_bound_workbooks(self):
        cloud = (ROOT / "web" / "js" / "modules" / "cloud.js").read_text(encoding="utf-8")
        shared = (ROOT / "web" / "js" / "components" / "cloud-sync.js").read_text(encoding="utf-8")
        bridge = (ROOT / "backend" / "bridge.py").read_text(encoding="utf-8")

        self.assertIn("整理顺序", cloud)
        self.assertIn("CloudSync.reorder", cloud)
        self.assertIn("confirmReorder", shared)
        self.assertIn("kdocs_start_reorder_workbook", shared)
        self.assertIn("def kdocs_start_reorder_workbook", bridge)

    def test_every_score_module_uses_shared_target_confirmation(self):
        shared = (ROOT / "web" / "js" / "components" / "cloud-sync.js").read_text(encoding="utf-8")
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn('js/components/cloud-sync.js', html)
        for label in ("更新当前云表", "使用已有表格链接", "新建一份云表"):
            self.assertIn(label, shared)
        for key in (
            "college-gpa-main-v1", "college-gpa-ranking-v1",
            "college-moral-main-v1", "college-quality-main-v1",
            "college-comprehensive-main-v1", "college-comprehensive-ranking-v1",
        ):
            self.assertIn(key, shared)

    def test_moral_quality_and_comprehensive_results_offer_cloud_sync(self):
        moral = (ROOT / "web" / "js" / "modules" / "moral.js").read_text(encoding="utf-8")
        quality = (ROOT / "web" / "js" / "modules" / "quality.js").read_text(encoding="utf-8")
        comprehensive = (ROOT / "web" / "js" / "modules" / "comprehensive.js").read_text(encoding="utf-8")
        self.assertIn("CloudSync.request('moral-main')", moral)
        self.assertIn("CloudSync.request('quality-main')", quality)
        self.assertIn("CloudSync.request('comprehensive-main')", comprehensive)
        self.assertIn("CloudSync.request('comprehensive-ranking')", comprehensive)

    def test_desktop_entry_point_has_single_instance_guard(self):
        source = (ROOT / "main.py").read_text(encoding="utf-8")
        self.assertIn("_acquire_single_instance", source)
        self.assertIn("CreateMutexW", source)

    def test_existing_hidden_window_is_restored_and_focused(self):
        user32 = Mock()
        user32.FindWindowW.return_value = 2468
        with patch.object(main.platform, "system", return_value="Windows"), \
                patch.object(ctypes.windll, "user32", user32):
            activated = main._activate_existing_window()

        self.assertTrue(activated)
        user32.FindWindowW.assert_called_once_with(None, main.APP_NAME)
        user32.ShowWindow.assert_called_once_with(2468, 9)
        user32.SetForegroundWindow.assert_called_once_with(2468)

    def test_packaged_build_bundles_kdocs_cli(self):
        spec = (ROOT / "build.spec").read_text(encoding="utf-8")
        sync = (ROOT / "backend" / "kdocs_sync.py").read_text(encoding="utf-8")
        self.assertIn("app_binaries", spec)
        self.assertIn("kdocs-cli.exe", spec)
        self.assertIn('getattr(sys, "_MEIPASS"', sync)

    def test_cloud_connector_auto_update_is_wired_from_startup_to_backend(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        main_js = (ROOT / "web" / "js" / "main.js").read_text(encoding="utf-8")
        counselor = (ROOT / "web" / "js" / "modules" / "counselor.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "css" / "don-college-ui.css").read_text(encoding="utf-8")
        bridge = (ROOT / "backend" / "bridge.py").read_text(encoding="utf-8")
        sync = (ROOT / "backend" / "kdocs_sync.py").read_text(encoding="utf-8")

        self.assertIn("setTimeout(() => autoCheckUpdates(), 3000)", main_js)
        self.assertIn("kdocs_cli_version_status", main_js)
        self.assertIn("kdocs_upgrade_cli", main_js)
        self.assertIn("稍后提醒", main_js)
        self.assertIn("manualCheckKdocsComponentUpdate()", counselor)
        self.assertIn('id="update-title"', html)
        self.assertIn(".kdocs-update-card", css)
        self.assertIn("def kdocs_cli_version_status", bridge)
        self.assertIn("def kdocs_upgrade_cli", bridge)
        self.assertIn('"upload-new-file"', sync)
        self.assertNotIn('"upload-file"', sync)


if __name__ == "__main__":
    unittest.main()
