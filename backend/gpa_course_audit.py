"""Course-level audit for variable curricula, retakes and transfer students."""
from __future__ import annotations

import os
import re
import pandas as pd

from backend.parsers.course_header_parser import parse_course_header
from config import SCORE_MAPPING

STAT_KEYWORDS = ('学分绩点', '平均学分', '平均分', '总分', '总学分', '获得学分',
                 '所得学分', '排名', '不及格门数', '课程门数')


def _clean(value):
    return '' if pd.isna(value) else str(value).strip()


def _numeric_score(value):
    if pd.isna(value) or str(value).strip() == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return SCORE_MAPPING.get(str(value).strip())


def analyze_gpa_course_structure(filepath: str, sheet_mapping: dict | None = None) -> dict:
    if not os.path.isfile(filepath):
        return {'success': False, 'error': '文件不存在'}
    mapping = sheet_mapping or {}
    sheet_name = mapping.get('sheet_name')
    header_row = int(mapping.get('header_row', 0) or 0)
    engine = 'xlrd' if os.path.splitext(filepath)[1].lower() == '.xls' else 'openpyxl'
    raw = pd.read_excel(filepath, sheet_name=sheet_name or 0, header=None, engine=engine)
    if raw.empty or header_row >= len(raw):
        return {'success': False, 'error': '工作表为空或表头行无效'}

    headers = [_clean(v) for v in raw.iloc[header_row].tolist()]
    row_after_header = raw.iloc[header_row + 1].tolist() if header_row + 1 < len(raw) else []
    start = mapping.get('course_start_col', 4)
    start = int(start) if isinstance(start, (int, float)) else 4
    mapped_end = mapping.get('course_end_col')
    end = min(len(headers), int(mapped_end) + 1) if isinstance(mapped_end, (int, float)) else len(headers)
    if not isinstance(mapped_end, (int, float)):
        for idx in range(start, len(headers)):
            text = headers[idx].replace(' ', '')
            if text and any(key in text for key in STAT_KEYWORDS):
                end = idx
                break

    credit_row_labels = [_clean(v).replace(' ', '') for v in row_after_header[:max(start, 4)]]
    has_credit_row = any(('学分' in label) or label in ('比重', '权重') for label in credit_row_labels)
    if not has_credit_row and row_after_header:
        # Some exports provide an unlabeled numeric credit row. Identity cells are
        # empty and most candidate course cells contain plausible credit values.
        identity_empty = all(not _clean(row_after_header[i]) for i in range(min(start, len(row_after_header))))
        plausible = []
        for value in row_after_header[start:end]:
            try:
                number = float(value)
                plausible.append(0 < number <= 10)
            except (TypeError, ValueError):
                pass
        has_credit_row = identity_empty and len(plausible) >= 2 and sum(plausible) >= max(2, len(plausible) // 2)
    credits = row_after_header if has_credit_row else []
    data = raw.iloc[header_row + (2 if has_credit_row else 1):].copy()
    courses, idx = [], start
    while idx < end:
        name = headers[idx]
        if not name:
            idx += 1
            continue
        compact_name = name.replace(' ', '')
        if any(key in compact_name for key in STAT_KEYWORDS):
            idx += 1
            continue
        parsed = parse_course_header(name)
        credit = parsed.get('credit', 0) or 0
        credit_source = '课程表头' if credit else '待人工确认'
        if idx < len(credits):
            try:
                if not pd.isna(credits[idx]) and 0 < float(credits[idx]) <= 10:
                    credit = float(credits[idx])
                    credit_source = '学分行'
            except (TypeError, ValueError):
                pass
        value_col = None
        if idx + 1 < end and not headers[idx + 1]:
            primary_text = any(_clean(v) in SCORE_MAPPING for v in data.iloc[:, idx].head(40))
            companion_numeric = any(_numeric_score(v) is not None for v in data.iloc[:, idx + 1].head(40))
            if primary_text and companion_numeric:
                value_col = idx + 1
        enrolled = 0
        for _, row in data.iterrows():
            primary = row.iloc[idx] if idx < len(row) else None
            companion = row.iloc[value_col] if value_col is not None and value_col < len(row) else None
            if _numeric_score(companion) is not None or _numeric_score(primary) is not None:
                enrolled += 1
        courses.append({
            'name': parsed.get('course_name') or name,
            'score_col': idx,
            'value_col': value_col,
            'credit': credit,
            'credit_source': credit_source,
            'is_pe': bool(parsed.get('is_pe')),
            'enabled': True,
            'enrolled_count': enrolled,
            'total_students': 0,
        })
        idx += 2 if value_col is not None else 1

    # Repeated course names are treated as retakes. Default to the right-most
    # (latest) occurrence while keeping older attempts visible for manual review.
    by_name = {}
    for course in courses:
        by_name.setdefault(re.sub(r'\s+', '', course['name']), []).append(course)
    for same_name in by_name.values():
        if len(same_name) > 1:
            for old in same_name[:-1]:
                old['enabled'] = False
                old['retake'] = True
                old['retake_policy'] = 'latest'
            same_name[-1]['retake'] = True
            same_name[-1]['retake_policy'] = 'latest'

    id_col = int(mapping.get('id_col', 0) or 0)
    name_col = int(mapping.get('name_col', 1) or 1)
    mapped_class_col = mapping.get('class_col')
    class_col = int(mapped_class_col) if isinstance(mapped_class_col, (int, float)) else None
    count_col = mapping.get('course_count_col', 3)
    count_col = int(count_col) if isinstance(count_col, (int, float)) else None
    students = []
    for excel_idx, row in data.iterrows():
        sid = _clean(row.iloc[id_col]) if id_col < len(row) else ''
        name = _clean(row.iloc[name_col]) if name_col < len(row) else ''
        if not sid and not name:
            continue
        actual = 0
        course_names = []
        course_details = []
        total_credits = 0.0
        for course in courses:
            if not course.get('enabled', True):
                continue
            primary = row.iloc[course['score_col']] if course['score_col'] < len(row) else None
            companion = row.iloc[course['value_col']] if course['value_col'] is not None and course['value_col'] < len(row) else None
            score = _numeric_score(companion)
            if score is None:
                score = _numeric_score(primary)
            if score is not None:
                actual += 1
                course_names.append(course['name'])
                credit = float(course.get('credit') or 0)
                total_credits += credit
                course_details.append({'name': course['name'], 'credit': credit,
                                       'score': score, 'is_pe': course.get('is_pe', False),
                                       'retake': course.get('retake', False),
                                       'score_col': course.get('score_col'), 'enabled': True})
        declared = None
        if count_col is not None and count_col < len(row):
            try: declared = int(float(row.iloc[count_col]))
            except (TypeError, ValueError): pass
        students.append({
            'id': sid, 'name': name,
            'class_name': (_clean(row.iloc[class_col]) if class_col is not None and class_col < len(row) else '') or (sheet_name or ''),
            'declared_count': declared, 'detected_count': actual,
            'difference': actual - declared if declared is not None else None,
            'courses': course_names, 'course_details': course_details,
            'total_credits': round(total_credits, 2), 'excel_row': int(excel_idx) + 1,
        })
    for course in courses:
        course['total_students'] = len(students)
    typical = 0
    typical_declared = 0
    if students:
        counts = pd.Series([s['detected_count'] for s in students]).value_counts()
        typical = int(counts.index[0]) if not counts.empty else 0
        declared_counts = pd.Series([s['declared_count'] for s in students if s['declared_count'] is not None]).value_counts()
        typical_declared = int(declared_counts.index[0]) if not declared_counts.empty else 0
    for student in students:
        student['deviation_from_typical'] = student['detected_count'] - typical
    class_map = {}
    for student in students:
        class_name = student['class_name'] or (sheet_name or '未识别班级')
        class_map.setdefault(class_name, []).append(student)
    classes = []
    for class_name, class_students in sorted(class_map.items()):
        signatures = {}
        for student in class_students:
            signature = '|'.join(sorted(f"{c['name']}::{c['credit']}" for c in student['course_details']))
            signatures[signature] = signatures.get(signature, 0) + 1
            student['course_signature'] = signature
        typical_signature = max(signatures, key=signatures.get) if signatures else ''
        typical_student = next((s for s in class_students if s['course_signature'] == typical_signature), None)
        typical_courses = {c['name'] for c in (typical_student or {}).get('course_details', [])}
        groups = {}
        abnormal_count = 0
        for student in class_students:
            flags = []
            student_courses = {c['name'] for c in student['course_details']}
            student['extra_courses'] = sorted(student_courses - typical_courses)
            student['missing_courses'] = sorted(typical_courses - student_courses)
            if student['difference'] not in (None, 0): flags.append('原表门数与识别门数不一致')
            if student['course_signature'] != typical_signature: flags.append('课程组合与班级多数不同')
            sid_grade = student['id'][:2] if re.match(r'^\d{2}', student['id']) else ''
            class_grade = re.search(r'(\d{2})\d$', class_name)
            student['possible_transfer'] = bool(sid_grade and class_grade and sid_grade != class_grade.group(1))
            if student['possible_transfer']: flags.append('学号年级与当前班级不同，可能为转专业/留级')
            if any(c.get('retake') for c in student['course_details']): flags.append('存在重修课程')
            if any(not (0 < c.get('credit', 0) <= 4) for c in student['course_details']): flags.append('存在待确认或异常学分')
            student['flags'] = flags
            student['is_abnormal'] = bool(flags)
            abnormal_count += int(bool(flags))
            groups.setdefault(student['course_signature'], []).append(student)
        group_rows = []
        for signature, grouped_students in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
            group_rows.append({'signature': signature, 'is_typical': signature == typical_signature,
                               'students': grouped_students,
                               'courses': grouped_students[0]['course_details'] if grouped_students else []})
        classes.append({'name': class_name, 'student_count': len(class_students),
                        'abnormal_count': abnormal_count, 'typical_count': signatures.get(typical_signature, 0),
                        'typical_courses': sorted(typical_courses), 'groups': group_rows})
    return {'success': True, 'sheet_name': sheet_name or '第一个工作表',
            'header_row': header_row, 'headers': headers, 'course_start_col': start,
            'course_end_col': max(start, end - 1), 'courses': courses, 'students': students,
            'classes': classes, 'typical_course_count': typical_declared or typical,
            'detected_typical_course_count': typical,
            'typical_declared_count': typical_declared, 'student_count': len(students)}
