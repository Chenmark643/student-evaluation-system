"""Contracts for the unified, user-correctable spreadsheet import layer."""

import os
import tempfile
import unittest

import pandas as pd

from backend.import_studio import analyze_import_file
from backend.module_a_gpa import _identify_columns
from backend.module_d_comprehensive import _find_real_headers


class ImportStudioTests(unittest.TestCase):
    def test_real_idless_moral_summary_is_detected(self):
        path = r'C:\Users\cheny\Downloads\顿河信251德育分.xlsx'
        if not os.path.isfile(path):
            self.skipTest('user sample is not available')

        result = analyze_import_file(path, 'moral')
        total = next(sheet for sheet in result['sheets'] if sheet['name'] == '总分')

        self.assertTrue(result['success'])
        self.assertEqual(total['headers'][total['suggested_mapping']['name_col']], '姓名')
        self.assertEqual(total['headers'][total['suggested_mapping']['score_col']], '最终得分')
        self.assertEqual(total['valid_rows'], 23)
        self.assertTrue(total['recommended'])
        self.assertEqual(total['issues']['invalid_scores'], 0)
        self.assertEqual(total['issues']['out_of_range_scores'], 0)
        self.assertIsInstance(total['issue_details'], list)

    def test_existing_moral_prefers_total_add_and_deduct_columns(self):
        path = r'C:\Users\cheny\Downloads\顿河信251德育分.xlsx'
        if not os.path.isfile(path):
            self.skipTest('user sample is not available')
        result = analyze_import_file(path, 'moral_existing')
        total = next(sheet for sheet in result['sheets'] if sheet['name'] == '总分')
        mapping = total['suggested_mapping']
        self.assertEqual(total['headers'][mapping['deduction_col']], '总扣分')
        self.assertEqual(total['headers'][mapping['addition_col']], '总加分')
        self.assertEqual(total['headers'][mapping['score_col']], '最终得分')

    def test_gpa_mapping_overrides_changed_metadata_order(self):
        columns = ['班别', '学生姓名', '学生号', '门数', '高等数学', '大学英语'] + [f'汇总{i}' for i in range(8)]
        mapping = {'id_col': 2, 'name_col': 1, 'class_col': 0,
                   'course_count_col': 3, 'course_start_col': 4}

        identified = _identify_columns(columns, mapping)

        self.assertEqual(identified['student_id_col'], '学生号')
        self.assertEqual(identified['name_col'], '学生姓名')
        self.assertEqual(identified['class_col'], '班别')
        self.assertEqual(identified['course_cols'], ['高等数学', '大学英语'])

    def test_configured_header_row_is_respected(self):
        frame = pd.DataFrame([
            ['说明', None, None],
            ['班级', '姓名', '最终得分'],
            ['顿河信251', '测试学生', 90],
        ], columns=['标题', '空列1', '空列2'])

        _, headers, data_start = _find_real_headers(frame, {'header_row': 2})

        self.assertEqual(headers, ['班级', '姓名', '最终得分'])
        self.assertEqual(data_start, 2)


if __name__ == '__main__':
    unittest.main()
