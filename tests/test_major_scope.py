import unittest

from backend.utils.class_utils import (
    class_matches_program,
    filter_students_by_program,
    normalize_program_name,
    parse_class_name,
)


class MajorScopeTests(unittest.TestCase):
    def test_standard_class_name_program_detection(self):
        self.assertEqual(parse_class_name('顿河信251')['program'], '顿河信')
        self.assertTrue(class_matches_program('顿河信251', '顿河信'))
        self.assertFalse(class_matches_program('顿河土251', '顿河信'))

    def test_custom_program_names_are_tolerant(self):
        self.assertTrue(class_matches_program('人工智能（国际）261', '人工智能国际'))
        self.assertTrue(class_matches_program('新能源-工程251', '新能源工程'))
        self.assertEqual(normalize_program_name(' 新能源-工程 '), '新能源工程')

    def test_mixed_program_students_are_isolated(self):
        students = [
            {'学号': '1', '班级': '顿河信251'},
            {'学号': '2', 'class_name': '顿河土251'},
            {'学号': '3', '学生行政班级': '顿河信252'},
        ]
        result = filter_students_by_program(students, '顿河信')
        self.assertEqual([row['学号'] for row in result], ['1', '3'])

    def test_empty_program_keeps_backward_compatibility(self):
        students = [{'学号': '1', '班级': '任意班'}]
        self.assertEqual(filter_students_by_program(students, ''), students)


if __name__ == '__main__':
    unittest.main()
