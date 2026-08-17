"""Visual and packaging contracts for the branded installer."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = (ROOT / "installer/installer.py").read_text(encoding="utf-8")
SPEC = (ROOT / "installer/build_installer.spec").read_text(encoding="utf-8")
APP_SPEC = (ROOT / "build.spec").read_text(encoding="utf-8")
INNO_SETUP = (ROOT / "installer/setup.iss").read_text(encoding="utf-8")
BUILD_BATCH = (ROOT / "installer/编译安装包.bat").read_text(encoding="utf-8")


class InstallerBrandContractTests(unittest.TestCase):
    def test_current_version_has_full_and_lite_webview2_installer_variants(self):
        installer = (ROOT / "installer" / "installer.py").read_text(encoding="utf-8")
        full = (ROOT / "installer" / "build_installer_full.spec").read_text(encoding="utf-8")
        lite = (ROOT / "installer" / "build_installer_lite.spec").read_text(encoding="utf-8")
        self.assertIn("VERSION = '14.1.0'", installer)
        self.assertIn("MicrosoftEdgeWebView2RuntimeInstallerX64.exe", full)
        self.assertNotIn("MicrosoftEdgeWebView2RuntimeInstallerX64.exe", lite)
        self.assertIn("os.path.join(PROJECT_ROOT, 'dist')", full)
        self.assertIn("os.path.join(PROJECT_ROOT, 'dist')", lite)
        self.assertIn("Full-WebView2", full)
        self.assertIn("Lite-NoWebView2", lite)

    def test_installer_header_is_dpi_aware_and_uses_native_size_logo(self):
        installer = (ROOT / "installer" / "installer.py").read_text(encoding="utf-8")
        native_logo = ROOT / "installer" / "assets" / "installer-logo-header-native.png"
        self.assertTrue(native_logo.is_file())
        self.assertIn("SetProcessDpiAwarenessContext", installer)
        self.assertIn("installer-logo-header-native.png", installer)
        self.assertIn("installer-logo-header-native.png", SPEC)
        self.assertNotIn("brand_logo.subsample", installer)

    def test_installer_uses_branded_art_and_hd_icon(self):
        self.assertIn("installer-campus-preview.png", INSTALLER)
        self.assertIn("installer-logo-header-native.png", INSTALLER)
        self.assertIn("installer-icon-hd.ico", INSTALLER)
        self.assertTrue((ROOT / "installer/assets/installer-campus-preview.png").is_file())
        self.assertTrue((ROOT / "installer/assets/installer-icon-hd.ico").stat().st_size > 50_000)

    def test_browser_is_not_a_desktop_app_requirement(self):
        location_section = INSTALLER[INSTALLER.index("def _show_location"):INSTALLER.index("def _show_detect")]
        detect_section = INSTALLER[INSTALLER.index("def _show_detect"):INSTALLER.index("def _add_check_row")]
        self.assertNotIn("find_browser()", location_section)
        self.assertNotIn("find_browser()", detect_section)

    def test_installer_does_not_bundle_private_runtime_data(self):
        self.assertNotIn("'data'), 'app_data'", SPEC)

    def test_installer_repairs_webview2_offline_and_blocks_when_missing(self):
        for token in (
            "get_webview2_version", "_bundled_webview2_path",
            "MicrosoftEdgeWebView2RuntimeInstallerX64.exe",
            "'/silent', '/install'", "WebView2 渲染运行库",
        ):
            self.assertIn(token, INSTALLER)
        confirm_section = INSTALLER[
            INSTALLER.index("def _show_confirm"):INSTALLER.index("def _show_install")
        ]
        self.assertNotIn("('浏览器',", confirm_section)

    def test_installer_bundle_contains_full_signed_runtime_contract(self):
        runtime = ROOT / "installer/MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
        if not runtime.is_file():
            self.skipTest("offline WebView2 runtime is downloaded locally and is not stored in Git")
        self.assertTrue(runtime.is_file())
        self.assertGreater(runtime.stat().st_size, 100 * 1024 * 1024)
        self.assertIn("MicrosoftEdgeWebView2RuntimeInstallerX64.exe", SPEC)
        self.assertIn("webview2_runtime", SPEC)

    def test_reinstall_preserves_user_data_and_restricts_install_folder(self):
        self.assertNotIn("shutil.rmtree(os.path.join(dest, 'data')", INSTALLER)
        self.assertIn("os.path.basename(dest).casefold() != APP_NAME.casefold()", INSTALLER)

    def test_embedded_python_executable_filename_is_ascii(self):
        """Python 3.8 one-file bootloader cannot initialize under a CJK exe name."""
        safe_name = "DonCollege-Student-Evaluation.exe"
        self.assertIn("name='DonCollege-Student-Evaluation'", APP_SPEC)
        self.assertIn(f"APP_EXE = '{safe_name}'", INSTALLER)
        self.assertIn(f'#define MyAppExeName "{safe_name}"', INNO_SETUP)
        self.assertIn(f"dist\\{safe_name}", BUILD_BATCH)


if __name__ == "__main__":
    unittest.main()
