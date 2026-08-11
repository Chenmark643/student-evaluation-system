import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import app_update


class AppUpdateTests(unittest.TestCase):
    def test_powershell_paths_are_literal_and_keep_unicode(self):
        self.assertEqual(
            app_update._powershell_literal("C:\\顿河\\it's 100%\\app.exe"),
            "'C:\\顿河\\it''s 100%\\app.exe'",
        )

    def manifest(self, **updates):
        value = {
            "version": "99.1.0",
            "platform": "windows-x64",
            "url": "https://github.com/example/project/releases/download/v99.1.0/app.exe",
            "sha256": "a" * 64,
            "size": 6 * 1024 * 1024,
            "notes": "在线更新测试",
        }
        value.update(updates)
        return value

    def test_manifest_requires_https_and_sha256(self):
        with self.assertRaises(app_update.AppUpdateError):
            app_update._validated_manifest(self.manifest(url="http://example.com/app.exe"))
        with self.assertRaises(app_update.AppUpdateError):
            app_update._validated_manifest(self.manifest(sha256="not-a-hash"))

    def test_status_compares_release_version_semantically(self):
        with patch.object(app_update, "_STATUS_CACHE", None), \
                patch.object(app_update, "_fetch_manifest", return_value=self.manifest(version="99.1.0")):
            status = app_update.get_app_update_status(force=True)

        self.assertTrue(status["success"])
        self.assertTrue(status["update_available"])
        self.assertEqual(status["current_version"], app_update.APP_VERSION)
        self.assertEqual(status["latest_version"], "99.1.0")

    def test_download_verifies_size_digest_and_pe_header(self):
        payload = b"MZ" + (b"x" * (5 * 1024 * 1024))
        import hashlib

        manifest = self.manifest(
            size=len(payload),
            sha256=hashlib.sha256(payload).hexdigest(),
        )
        with tempfile.TemporaryDirectory() as tmp, \
                patch.object(app_update, "UPDATE_DIR", Path(tmp) / "updates"), \
                patch.object(app_update, "_fetch_manifest", return_value=manifest), \
                patch.object(app_update, "_open_url", return_value=io.BytesIO(payload)):
            result = app_update.download_app_update()

        self.assertTrue(result["success"])
        self.assertTrue(result["updated"])
        self.assertEqual(result["sha256"], manifest["sha256"])

    def test_download_rejects_digest_mismatch(self):
        payload = b"MZ" + (b"x" * (5 * 1024 * 1024))
        manifest = self.manifest(size=len(payload), sha256="0" * 64)
        with tempfile.TemporaryDirectory() as tmp, \
                patch.object(app_update, "UPDATE_DIR", Path(tmp) / "updates"), \
                patch.object(app_update, "_fetch_manifest", return_value=manifest), \
                patch.object(app_update, "_open_url", return_value=io.BytesIO(payload)):
            result = app_update.download_app_update()

        self.assertFalse(result["success"])
        self.assertIn("校验失败", result["error"])

    def test_local_update_inspection_accepts_current_single_file_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "new.exe"
            path.write_bytes(b"MZ" + (b"x" * (5 * 1024 * 1024)))
            result = app_update.inspect_windows_executable(str(path))

        self.assertTrue(result["valid"])
        self.assertEqual(len(result["sha256"]), 64)

    def test_replacement_stages_manual_file_and_writes_health_rollback_script(self):
        payload = b"MZ" + (b"x" * (5 * 1024 * 1024))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "下载"
            downloads.mkdir()
            source = downloads / "new.exe"
            sibling = downloads / "keep.txt"
            target = root / "installed.exe"
            source.write_bytes(payload)
            sibling.write_text("keep", encoding="utf-8")
            target.write_bytes(b"MZ-old")
            digest = app_update._sha256(source)
            with patch.object(app_update.sys, "frozen", True, create=True), \
                    patch.object(app_update.sys, "executable", str(target)), \
                    patch.object(app_update, "UPDATE_DIR", root / "updates"), \
                    patch.object(app_update.subprocess, "Popen") as popen, \
                    patch.object(app_update.threading, "Timer") as timer:
                result = app_update.launch_windows_replacement(str(source), digest)

            self.assertTrue(result["success"])
            popen.assert_called_once()
            timer.return_value.start.assert_called_once()
            script_path = next((root / "updates").glob("apply-update-*.ps1"))
            script = script_path.read_text(encoding="utf-8-sig")
            self.assertIn(".update-backup", script)
            self.assertIn("DONCOLLEGE_UPDATE_HEALTH_MARKER", script)
            self.assertIn("AddSeconds(60)", script)
            self.assertIn("did not report healthy startup", script)
            self.assertIn("Get-FileHash", script)
            self.assertIn(digest, script)
            self.assertNotIn(str(downloads), script)
            self.assertIn("$targetBackedUp = $true", script)
            self.assertTrue(sibling.exists())
            staged_sources = list((root / "updates").glob("manual-*/*.exe"))
            self.assertEqual(len(staged_sources), 1)

    def test_health_marker_must_be_direct_child_of_update_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "updates"
            unsafe = Path(tmp) / "outside" / "healthy.txt"
            with patch.object(app_update, "UPDATE_DIR", root), \
                    patch.dict(
                        app_update.os.environ,
                        {"DONCOLLEGE_UPDATE_HEALTH_MARKER": str(unsafe)},
                        clear=False,
                    ):
                result = app_update.mark_app_update_healthy()

            self.assertFalse(result)
            self.assertFalse(unsafe.exists())

    def test_replacement_never_launches_when_hash_is_wrong(self):
        payload = b"MZ" + (b"x" * (5 * 1024 * 1024))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "new.exe"
            target = root / "installed.exe"
            source.write_bytes(payload)
            target.write_bytes(b"MZ-old")
            with patch.object(app_update.sys, "frozen", True, create=True), \
                    patch.object(app_update.sys, "executable", str(target)), \
                    patch.object(app_update, "UPDATE_DIR", root / "updates"), \
                    patch.object(app_update.subprocess, "Popen") as popen:
                result = app_update.launch_windows_replacement(str(source), "0" * 64)

            self.assertFalse(result["success"])
            popen.assert_not_called()

    def test_bridge_blocks_install_while_cloud_sync_is_active(self):
        from backend import bridge

        bridge._APP_UPDATE_JOBS.clear()
        bridge._KDOCS_JOBS.clear()
        bridge._APP_UPDATE_INSTALLING = False
        bridge._APP_UPDATE_JOBS["update"] = {
            "done": True,
            "result": {
                "success": True,
                "local_path": "new.exe",
                "sha256": "a" * 64,
            },
        }
        bridge._KDOCS_JOBS["sync"] = {"done": False}
        with patch.object(bridge, "launch_windows_replacement_impl") as launch:
            result = bridge.app_update_install("update")

        self.assertFalse(result["success"])
        launch.assert_not_called()

    def test_manual_install_is_blocked_during_cloud_sync(self):
        from backend import bridge

        bridge._KDOCS_JOBS.clear()
        bridge._KDOCS_JOBS["sync"] = {"done": False}
        bridge._APP_UPDATE_INSTALLING = False
        with patch.object(bridge, "inspect_windows_executable_impl") as inspect, \
                patch.object(bridge, "launch_windows_replacement_impl") as launch:
            result = bridge.install_local_update("new.exe")

        self.assertFalse(result)
        inspect.assert_not_called()
        launch.assert_not_called()

    def test_duplicate_install_is_rejected_after_launch(self):
        from backend import bridge

        bridge._KDOCS_JOBS.clear()
        bridge._APP_UPDATE_INSTALLING = False
        inspected = {"valid": True, "path": "new.exe", "sha256": "a" * 64}
        with patch.object(bridge, "inspect_windows_executable_impl", return_value=inspected), \
                patch.object(
                    bridge,
                    "launch_windows_replacement_impl",
                    return_value={"success": True},
                ) as launch:
            first = bridge.install_local_update("new.exe")
            second = bridge.install_local_update("new.exe")

        self.assertTrue(first)
        self.assertFalse(second)
        launch.assert_called_once()
        bridge._APP_UPDATE_INSTALLING = False


class AppUpdateUiContractTests(unittest.TestCase):
    def test_online_update_is_connected_from_startup_to_release_workflow(self):
        root = Path(__file__).resolve().parents[1]
        main = (root / "web/js/main.js").read_text(encoding="utf-8")
        bridge = (root / "backend/bridge.py").read_text(encoding="utf-8")
        workflow = (root / ".github/workflows/build-windows.yml").read_text(encoding="utf-8")

        self.assertIn("checkOnlineApplicationUpdate(false)", main)
        self.assertIn("app_update_start_download", main)
        self.assertIn("app_update_install", main)
        self.assertIn("def app_update_status", bridge)
        self.assertIn("def app_update_start_download", bridge)
        self.assertIn("update-windows.json", workflow)
        self.assertIn("softprops/action-gh-release", workflow)
        self.assertIn("启动构建产物冒烟测试", workflow)
        self.assertIn("target_commitish: ${{ github.sha }}", workflow)


if __name__ == "__main__":
    unittest.main()
