"""
Class name parsing and program grouping utilities.
"""

import re
from config import CLASS_NAME_PATTERN


def parse_class_name(class_name: str) -> dict:
    """Parse class name into program, grade, class number.

    Example: '顿河交241' -> {program: '顿河交', grade: 24, class_num: 1,
                              program_grade_key: '顿河交24'}

    Args:
        class_name: Raw class name string

    Returns:
        Dict with program, grade, class_num, program_grade_key
    """
    class_name = str(class_name).strip()

    match = re.search(CLASS_NAME_PATTERN, class_name)
    if match:
        program = match.group('program')
        grade = int(match.group('grade'))
        class_num = int(match.group('class_num'))
        return {
            'program': program,
            'grade': grade,
            'class_num': class_num,
            'program_grade_key': f'{program}{grade}',
        }

    # Fallback: try to find 2-digit+number pattern
    fallback = re.search(r'(\d{2})(\d{1,2})$', class_name)
    if fallback:
        prefix = class_name[:fallback.start()]
        grade = int(fallback.group(1))
        class_num = int(fallback.group(2))
        return {
            'program': prefix,
            'grade': grade,
            'class_num': class_num,
            'program_grade_key': f'{prefix}{grade}',
        }

    # Last resort: use as-is
    return {
        'program': class_name,
        'grade': 0,
        'class_num': 0,
        'program_grade_key': class_name,
    }


def group_by_program_grade(students: list) -> dict:
    """Group students by program-grade key for ranking.

    Args:
        students: List of student dicts, each must have 'class_name' key

    Returns:
        Dict of {program_grade_key: [students]}
    """
    groups = {}
    for student in students:
        class_name = student.get('class_name', student.get('行政班级', ''))
        parsed = parse_class_name(class_name)
        key = parsed['program_grade_key']
        if key not in groups:
            groups[key] = []
        groups[key].append(student)
    return groups


def extract_grade_from_class(class_name: str) -> int:
    """Extract the grade level (入学年份后两位) from class name.

    Example: '物流241' -> 24, '顿河交221' -> 22

    Args:
        class_name: Class name string

    Returns:
        Grade number (22-25 typically)
    """
    parsed = parse_class_name(class_name)
    return parsed['grade']
