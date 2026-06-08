"""
Regex-based parser for extracting course name and credit value from
Chinese-language course header cells in raw grade tables.
"""

import re

# Pattern: course_name, followed by category info, then 学分X.X
CREDIT_PATTERN = re.compile(r'学分(\d+\.?\d*)')

# Pattern to detect PE/sports courses
PE_PATTERN = re.compile(r'体育|運動')

# Pattern to extract course name — everything before the first Chinese comma
# Uses greedy match to include parenthesized parts like （精读）（外）（3）
COURSE_NAME_PATTERN = re.compile(r'^(.+?)，')


def parse_course_header(header_text: str) -> dict:
    """Parse a course header cell to extract metadata.

    Example input:
      "内燃机课程（双语）（外）（3），专业必修课，学分2.5，学时90，2025-2026-1"

    Returns:
      {
        'course_name': '内燃机课程（双语）（外）（3）',
        'credit': 2.5,
        'is_pe': False,
        'raw': '内燃机课程（双语）（外）（3），专业必修课，学分2.5...'
      }
    """
    if not header_text or not isinstance(header_text, str):
        return {
            'course_name': '',
            'credit': 0.0,
            'is_pe': False,
            'raw': str(header_text) if header_text else '',
        }

    text = header_text.strip()

    # Extract credit value
    credit = 0.0
    credit_match = CREDIT_PATTERN.search(text)
    if credit_match:
        credit = float(credit_match.group(1))

    # Check if PE course
    is_pe = bool(PE_PATTERN.search(text))

    # Extract clean course name — everything before the first Chinese comma
    name_match = COURSE_NAME_PATTERN.search(text)
    if name_match:
        course_name = name_match.group(1).strip()
    else:
        # Fallback: no comma — take first 40 chars and strip trailing punctuation
        course_name = text[:40].rstrip('，、。；')
        # Remove credit/学时 suffix if present
        course_name = re.sub(r'[，,]?\s*学分\d+\.?\d*.*$', '', course_name)
        course_name = course_name.strip()

    return {
        'course_name': course_name,
        'credit': credit,
        'is_pe': is_pe,
        'raw': text,
    }


def parse_all_course_headers(headers: list) -> list:
    """Parse a list of course header strings.

    Args:
        headers: List of header text strings

    Returns:
        List of parsed course info dicts
    """
    results = []
    for h in headers:
        parsed = parse_course_header(str(h) if h else '')
        if parsed['course_name']:  # Only include headers with a course name
            results.append(parsed)
    return results
