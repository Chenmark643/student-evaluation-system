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


def normalize_program_name(value: str) -> str:
    """Normalize a user-entered program name for tolerant comparisons."""
    return re.sub(r'[\s_\-—（）()]+', '', str(value or '')).casefold()


def class_matches_program(class_name: str, program: str) -> bool:
    """Return whether a class belongs to the selected program.

    The parsed program is preferred, while a normalized prefix/substring fallback
    keeps custom and future class naming schemes usable.
    """
    wanted = normalize_program_name(program)
    if not wanted:
        return True
    raw = normalize_program_name(class_name)
    parsed = normalize_program_name(parse_class_name(class_name).get('program', ''))
    return parsed == wanted or raw.startswith(wanted) or wanted in parsed


def filter_students_by_program(students: list, program: str) -> list:
    """Filter student dictionaries using their common class-name fields."""
    if not normalize_program_name(program):
        return list(students)
    result = []
    for student in students:
        class_name = student.get('class_name', student.get('班级',
                     student.get('学生行政班级', student.get('行政班级', ''))))
        if class_matches_program(class_name, program):
            result.append(student)
    return result


def filter_students_by_exact_program(students: list, program: str) -> list:
    """Filter students by the exact parsed program name.

    This is intended for export boundaries where tolerant substring matching
    could accidentally include a neighbouring program with a similar name.
    """
    wanted = normalize_program_name(program)
    if not wanted:
        return list(students)
    result = []
    for student in students:
        class_name = student.get('class_name', student.get('班级',
                     student.get('学生行政班级', student.get('行政班级', ''))))
        parsed = normalize_program_name(parse_class_name(class_name).get('program', ''))
        if parsed == wanted:
            result.append(student)
    return result
