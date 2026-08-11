import tempfile
import unittest
from pathlib import Path

import openpyxl

from backend.module_c_quality import export_quality_merged


class QualityExportCapTests(unittest.TestCase):
    def _export(self, activities, thresholds):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        output = Path(temp_dir.name) / 'quality.xlsx'
        export_quality_merged(
            {'20250001': {'name': '测试同学', 'class': '信工251'}},
            {'20250001': activities},
            str(output),
            thresholds,
        )
        workbook = openpyxl.load_workbook(output, data_only=False)
        self.addCleanup(workbook.close)
        return workbook['信工251']

    def test_sum_cap_merges_all_categories_and_writes_one_effective_score(self):
        sheet = self._export(
            [
                {'activity': '项目甲', 'category': '类别甲', 'grade': '院级', 'score': 2.0},
                {'activity': '项目乙', 'category': '类别乙', 'grade': '校级', 'score': 2.0},
            ],
            [{'name': '共同上限', 'max': 3.0, 'categories': ['类别甲', '类别乙'], 'mode': 'sum'}],
        )

        self.assertIn('E3:E4', {str(cell_range) for cell_range in sheet.merged_cells.ranges})
        self.assertEqual(sheet['E3'].value, 3.0)
        self.assertIsNone(sheet['E4'].value)
        self.assertIn('F3:F4', {str(cell_range) for cell_range in sheet.merged_cells.ranges})
        self.assertEqual(sheet['F3'].value, 3.0)

    def test_sum_cap_group_is_merged_even_when_raw_score_is_below_ceiling(self):
        sheet = self._export(
            [
                {'activity': '志愿服务一', 'category': '比赛志愿服务类', 'grade': '每次', 'score': 0.3},
                {'activity': '志愿服务二', 'category': '比赛志愿服务类', 'grade': '每次', 'score': 0.3},
            ],
            [{'name': '比赛志愿服务上限', 'max': 2.0,
              'categories': ['比赛志愿服务类'], 'mode': 'sum'}],
        )

        self.assertIn('E3:E4', {str(cell_range) for cell_range in sheet.merged_cells.ranges})
        self.assertAlmostEqual(sheet['E3'].value, 0.6)
        self.assertEqual(sheet['F3'].value, 0.6)
        self.assertNotIsInstance(sheet['F3'].value, str)

    def test_committee_and_organization_assessments_take_highest_item(self):
        sheet = self._export(
            [
                {'activity': '班委测评', 'category': '学生工作类', 'grade': '优秀', 'score': 2.0},
                {'activity': '组织测评', 'category': '组织测评', 'grade': '优秀', 'score': 3.0},
                {'activity': '其他项目', 'category': '其他类别', 'grade': '校级', 'score': 0.5},
            ],
            [{'name': '班委、组织测评取最高', 'max': 3.0,
              'categories': ['学生工作类', '组织测评'], 'mode': 'max_item'}],
        )

        self.assertIn('E3:E4', {str(cell_range) for cell_range in sheet.merged_cells.ranges})
        self.assertEqual(sheet['E3'].value, 3.0)
        self.assertEqual(sheet['E5'].value, 0.5)
        self.assertIn('F3:F5', {str(cell_range) for cell_range in sheet.merged_cells.ranges})
        self.assertEqual(sheet['F3'].value, 3.5)


if __name__ == '__main__':
    unittest.main()
