import time
import unittest
from unittest.mock import patch

from backend import bridge


class KdocsProgressJobTests(unittest.TestCase):
    def test_background_job_exposes_progress_and_result(self):
        def fake_sync(_path, _key, progress_callback=None, force_create=False):
            self.assertFalse(force_create)
            progress_callback(18, "正在读取云表", "读取班级列表")
            time.sleep(0.03)
            progress_callback(64, "正在更新班级", "顿河土252", current_sheet="顿河土252", sheet_index=7, sheet_total=8)
            time.sleep(0.03)
            return {"success": True, "link_url": "https://www.kdocs.cn/l/test"}

        with patch.object(bridge, "kdocs_sync_workbook_impl", side_effect=fake_sync):
            started = bridge.kdocs_start_sync_workbook("C:/result.xlsx", "college-gpa-main-v1")
            self.assertTrue(started["success"])
            seen = []
            for _ in range(100):
                status = bridge.kdocs_get_sync_progress(started["job_id"])
                seen.append(status.get("percent"))
                if status.get("done"):
                    break
                time.sleep(0.005)

        self.assertTrue(status["done"])
        self.assertEqual(status["percent"], 100)
        self.assertEqual(status["result"]["link_url"], "https://www.kdocs.cn/l/test")
        self.assertIn(18, seen)
        self.assertIn(64, seen)

    def test_background_job_forwards_force_create(self):
        def fake_sync(_path, _key, progress_callback=None, force_create=False):
            return {"success": True, "created": force_create}

        with patch.object(bridge, "kdocs_sync_workbook_impl", side_effect=fake_sync):
            started = bridge.kdocs_start_sync_workbook("C:/result.xlsx", "moral", True)
            for _ in range(100):
                status = bridge.kdocs_get_sync_progress(started["job_id"])
                if status.get("done"):
                    break
                time.sleep(0.005)

        self.assertTrue(status["result"]["created"])


if __name__ == "__main__":
    unittest.main()
