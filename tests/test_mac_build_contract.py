"""Static contracts for the GitHub-hosted macOS build."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MacBuildContractTests(unittest.TestCase):
    def test_bundle_contains_current_desktop_and_moral_modules(self):
        spec = (ROOT / "build_mac.spec").read_text(encoding="utf-8")
        self.assertIn("webview.platforms.cocoa", spec)
        self.assertIn("backend.api", spec)
        self.assertIn("backend.moral_vnext", spec)
        self.assertIn("backend.moral_templates", spec)
        self.assertIn("moral-project-templates", spec)
        self.assertNotIn("backend.ai_assistant", spec)
        self.assertNotIn("('data', 'data')", spec)

    def test_workflow_builds_and_smoke_tests_apple_silicon_only(self):
        workflow = (ROOT / ".github/workflows/build-mac.yml").read_text(encoding="utf-8")
        self.assertIn("runs-on: macos-15", workflow)
        self.assertNotIn("macos-15-intel", workflow)
        self.assertIn('test "$(uname -m)" = "arm64"', workflow)
        self.assertIn("darwin-arm64.tar.gz", workflow)
        self.assertIn("shasum -a 256 -c -", workflow)
        self.assertIn("python -m pip install -r requirements.txt", workflow)
        self.assertIn("启动冒烟测试", workflow)
        self.assertIn("codesign --verify --deep --strict", workflow)
        self.assertIn("actions/upload-artifact@v4", workflow)

    def test_mac_bundle_contains_kdocs_cli(self):
        spec = (ROOT / "build_mac.spec").read_text(encoding="utf-8")
        self.assertIn("('vendor/kdocs-cli', '.')", spec)


if __name__ == "__main__":
    unittest.main()
