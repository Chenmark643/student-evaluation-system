"""Regression checks for the pywebview desktop bootstrap and bridge."""

from pathlib import Path
import unittest
from unittest.mock import Mock


ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "main.py").read_text(encoding="utf-8")
INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
SHIM = (ROOT / "web/js/pywebview-shim.js").read_text(encoding="utf-8")
SPEC = (ROOT / "build.spec").read_text(encoding="utf-8")
CONFIG = (ROOT / "config.py").read_text(encoding="utf-8")


class DesktopContractTests(unittest.TestCase):
    def test_app_uses_pywebview_not_a_system_browser(self):
        self.assertIn("webview.create_window", MAIN)
        self.assertIn("webview.start", MAIN)
        self.assertNotIn("eel.start", MAIN)
        self.assertNotIn("chrome.exe", MAIN)

    def test_frontend_loads_bridge_before_application_scripts(self):
        self.assertIn('src="js/pywebview-shim.js"', INDEX)
        self.assertNotIn('src="/eel.js"', INDEX)
        self.assertLess(INDEX.index("pywebview-shim.js"), INDEX.index("file-picker.js"))
        self.assertIn("pywebviewready", SHIM)

    def test_packaging_contains_pywebview_runtime(self):
        self.assertIn("webview.platforms.winforms", SPEC)
        self.assertNotIn("chrome.exe", SPEC)

    def test_app_uses_the_native_webview_for_each_desktop_platform(self):
        self.assertIn("get_webview2_version", MAIN)
        self.assertIn("请重新运行安装程序", MAIN)
        self.assertIn('"edgechromium" if platform.system() == "Windows"', MAIN)
        self.assertIn('"cocoa" if platform.system() == "Darwin"', MAIN)
        self.assertIn('platform.system() == "Windows" and not webview2_version', MAIN)
        self.assertLess(
            MAIN.index("get_webview2_version()"),
            MAIN.index("webview.create_window"),
        )

    def test_private_runtime_data_is_not_bundled(self):
        self.assertNotIn("('data', 'data')", SPEC)
        self.assertIn("LOCALAPPDATA", CONFIG)

    def test_file_dialog_is_owned_by_desktop_window(self):
        from backend.api import DesktopApi

        window = Mock()
        window.create_file_dialog.return_value = (r"C:\\资料\\成绩.xlsx",)
        api = DesktopApi()
        api.attach_window(window)

        selected = api.select_file([["Excel文件", "*.xls *.xlsx"]], "选择成绩")

        self.assertEqual(selected, r"C:\\资料\\成绩.xlsx")
        window.create_file_dialog.assert_called_once()
        self.assertEqual(
            window.create_file_dialog.call_args.kwargs["file_types"],
            ("Excel文件 (*.xls;*.xlsx)",),
        )

    def test_cancelled_dialog_has_stable_return_types(self):
        from backend.api import DesktopApi

        window = Mock()
        window.create_file_dialog.return_value = None
        api = DesktopApi()
        api.attach_window(window)

        self.assertEqual(api.select_file(), "")
        self.assertEqual(api.select_files(), [])
        self.assertEqual(api.select_directory(), "")


if __name__ == "__main__":
    unittest.main()
