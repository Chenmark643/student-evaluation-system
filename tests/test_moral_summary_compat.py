"""Regression tests for semester moral-summary format changes."""

import unittest

import pandas as pd

from backend.module_d_comprehensive import (
    _extract_moral_data,
    _resolve_moral_student_ids,
)


class MoralSummaryCompatibilityTests(unittest.TestCase):
    def test_idless_final_score_summary_matches_gpa_roster(self):
        sheets = {
            '总分': pd.DataFrame([
                {'班级': '顿河信251', '姓名': '翟隆羽', '总扣分': 57, '总加分': 9, '最终得分': 67},
                {'班级': '顿河信251', '姓名': '凃嘉骏', '总扣分': 147, '总加分': 0, '最终得分': 0},
            ]),
            '纪检': pd.DataFrame([
                {'班级': '顿河信251', '姓名': '翟隆羽', '第1周扣分': 2, '总扣分': 54},
            ]),
        }
        extracted = _extract_moral_data(sheets)
        roster = {
            '251001': {'name': '翟隆羽', 'class': '顿河信251'},
            '251002': {'name': '凃嘉骏', 'class': '顿河信251'},
        }

        resolved = _resolve_moral_student_ids(extracted, roster)

        self.assertEqual(set(resolved), {'251001', '251002'})
        self.assertEqual(resolved['251001']['total'], 67.0)
        self.assertEqual(resolved['251002']['total'], 0.0)

    def test_duplicate_name_is_not_guessed(self):
        sheets = {'总分': pd.DataFrame([
            {'班级': '', '姓名': '张伟', '最终得分': 95},
        ])}
        extracted = _extract_moral_data(sheets)
        roster = {
            '1': {'name': '张伟', 'class': 'A'},
            '2': {'name': '张伟', 'class': 'B'},
        }
        self.assertEqual(_resolve_moral_student_ids(extracted, roster), {})

    def test_user_can_replace_or_exclude_anomalous_rows(self):
        sheets = {'总分': pd.DataFrame([
            {'班级': '顿河信251', '姓名': '甲', '最终得分': '异常'},
            {'班级': '顿河信251', '姓名': '乙', '最终得分': 999},
        ])}
        mapping = {'总分': {
            'enabled': True, 'name_col': 1, 'class_col': 0, 'score_col': 2,
            'row_actions': {'2': {'action': 'replace', 'value': 88},
                            '3': {'action': 'exclude'}},
        }}

        extracted = _extract_moral_data(sheets, mapping)

        self.assertEqual(len(extracted), 1)
        self.assertEqual(next(iter(extracted.values()))['total'], 88.0)


if __name__ == '__main__':
    unittest.main()
