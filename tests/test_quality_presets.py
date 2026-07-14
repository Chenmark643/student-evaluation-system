import unittest


class QualityPresetTests(unittest.TestCase):
    def test_official_catalog_contains_representative_rules(self):
        from backend.quality_presets import build_official_presets

        rows = {row['id']: row for row in build_official_presets()}
        expected = {
            'art-national-first': 6.0,
            'art-school-encouragement': 0.2,
            'sport-national-record': 10.0,
            'contest-a-national-first': 14.0,
            'contest-b-college-encouragement': 0.2,
            'paper-natural-top': 15.0,
            'patent-invention': 10.0,
            'volunteer-competition': 0.3,
            'college-activity-participation': 0.2,
        }
        for preset_id, score in expected.items():
            self.assertIn(preset_id, rows)
            self.assertEqual(rows[preset_id]['score'], score)

    def test_explicit_caps_are_complete_without_broad_social_cap(self):
        from backend.quality_presets import OFFICIAL_THRESHOLDS

        rules = {row['name']: row for row in OFFICIAL_THRESHOLDS}
        self.assertEqual(rules['比赛志愿服务每学期上限']['max'], 2.0)
        self.assertEqual(rules['学院活动参与每学期上限']['max'], 1.0)
        self.assertEqual(rules['寒暑假社会实践上限']['max'], 2.0)
        self.assertEqual(rules['技能培训与证书上限']['max'], 3.0)
        self.assertEqual(rules['学生干部任职取最高']['mode'], 'max_item')
        self.assertIn('班委测评', rules['学生干部任职取最高']['categories'])
        self.assertIn('组织测评', rules['学生干部任职取最高']['categories'])
        self.assertEqual(rules['新生班主任助理取最高']['max'], 2.0)
        self.assertFalse(any(row['categories'] == ['社会实践类'] for row in OFFICIAL_THRESHOLDS))

    def test_national_volunteer_honor_is_not_cut_to_three(self):
        from backend.module_c_quality import calculate_quality_scores

        result = calculate_quality_scores({'1': [{
            'activity': '国家级志愿荣誉',
            'category': '社会实践荣誉类',
            'score': 3.5,
        }]})
        self.assertEqual(result['1']['total'], 3.5)

    def test_legacy_factory_rows_are_replaced_but_user_edits_win(self):
        from backend.quality_presets import merge_official_with_user

        legacy = {'英语四级': {
            'category': 'A类', 'default_grade': '国家级',
            'default_score': 5, 'last_used': '',
        }}
        self.assertNotIn('英语四级', merge_official_with_user(legacy))
        edited = {'英语四级': {**legacy['英语四级'], 'default_score': 2.25}}
        self.assertEqual(merge_official_with_user(edited)['英语四级']['default_score'], 2.25)

    def test_user_mapping_overrides_same_named_official_item(self):
        from backend.quality_presets import merge_official_with_user

        merged = merge_official_with_user({'比赛志愿服务': {
            'category': '自定义', 'default_grade': '每次', 'default_score': 0.4,
        }})
        self.assertEqual(merged['比赛志愿服务']['default_score'], 0.4)

    def test_adjustable_score_and_range_warning(self):
        from backend.quality_presets import calculate_activity_score, validate_manual_score

        self.assertEqual(
            calculate_activity_score(0.3, count=3, contribution=0.9, related=True),
            {'base_total': 0.9, 'contribution_total': 0.81, 'final': 1.62},
        )
        warning = validate_manual_score(2.5, score_range=(1, 2))
        self.assertTrue(warning['allowed'])
        self.assertTrue(warning['outside_official_range'])


if __name__ == '__main__':
    unittest.main()
