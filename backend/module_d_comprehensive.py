"""
Module D: Comprehensive Evaluation (综合测评计算)

Combines GPA, Moral Education, and Quality Development scores with
weighted formulas to produce comprehensive evaluation and rankings.
"""

import os
import pandas as pd
import numpy as np

from backend.parsers.xls_reader import read_xlsx_sheets, read_values_sheet
from backend.utils.class_utils import group_by_program_grade, filter_students_by_program
from backend.utils.rank_calculator import calculate_ranking
from backend.utils.excel_writer import write_multi_sheet_xlsx, write_ranking_xlsx, write_values_sheet, unique_path
from backend.utils.progress_reporter import ProgressReporter
from config import (
    COMPREHENSIVE_FORMULA_WITH_SPORTS,
    COMPREHENSIVE_FORMULA_WITHOUT_SPORTS,
    MORAL_BASE_SCORE,
)


def process_comprehensive(
    gpa_path: str,
    moral_path: str,
    quality_path: str,
    output_dir: str,
    has_sports: bool = False,
    sports_programs: list = None,
    progress: ProgressReporter = None,
    column_mappings: dict = None,
    grade_filter: str = 'all',
    major_filter: str = '',
) -> dict:
    """Process comprehensive evaluation from three module outputs.

    Args:
        gpa_path: Path to Module A output (学分绩点.xlsx)
        moral_path: Path to Module B output (德育分.xlsx)
        quality_path: Path to Module C output (素拓.xlsx)
        output_dir: Output directory
        has_sports: Whether any programs have PE scores
        sports_programs: List of program-grade keys that have sports
        progress: ProgressReporter
        column_mappings: Dict of {filepath: {sheet: {id_col, name_col, class_col, score_col}}}
        grade_filter: 'all' or 'XX级' to filter output

    Returns:
        Dict with processing results
    """
    if progress is None:
        progress = ProgressReporter()
    if column_mappings is None:
        column_mappings = {}

    progress.update(10, '正在读取学分绩点数据...')
    # Try _values sheet first (reliable numeric values), fall back to formula parsing
    gpa_values = read_values_sheet(gpa_path)
    if gpa_values:
        gpa_students = _values_to_students(gpa_values, 'gpa')
    else:
        gpa_sheets = read_xlsx_sheets(gpa_path)
        gpa_mapping = column_mappings.get(gpa_path, {})
        gpa_students = _extract_gpa_data(gpa_sheets, gpa_mapping)

    progress.update(25, '正在读取德育分数据...')
    moral_values = read_values_sheet(moral_path)
    if moral_values:
        moral_students = _values_to_students(moral_values, 'moral')
    else:
        moral_sheets = read_xlsx_sheets(moral_path)
        moral_mapping = column_mappings.get(moral_path, {})
        moral_students = _extract_moral_data(moral_sheets, moral_mapping)
        moral_students = _resolve_moral_student_ids(moral_students, gpa_students)

    progress.update(40, '正在读取素拓分数数据...')
    quality_values = read_values_sheet(quality_path)
    if quality_values:
        quality_students = _values_to_students(quality_values, 'quality')
    else:
        quality_sheets = read_xlsx_sheets(quality_path)
        quality_mapping = column_mappings.get(quality_path, {})
        quality_students = _extract_quality_data(quality_sheets, quality_mapping)

    progress.update(55, '正在匹配学生数据...')

    # Merge data
    merged = {}
    for sid, gpa_data in gpa_students.items():
        merged[sid] = {
            '学号': sid,
            '姓名': gpa_data['name'],
            '班级': gpa_data['class'],
            '学分绩点': gpa_data['gpa'],
            '体育': gpa_data.get('sports', ''),
        }

    # Add moral education scores
    for sid, moral_data in moral_students.items():
        if sid in merged:
            merged[sid]['德育分'] = moral_data['total']
        else:
            merged[sid] = {
                '学号': sid,
                '姓名': moral_data['name'],
                '班级': moral_data['class'],
                '德育分': moral_data['total'],
            }

    # Add quality development scores
    for sid, q_data in quality_students.items():
        if sid in merged:
            merged[sid]['素拓分'] = q_data['total']
        else:
            merged[sid] = {
                '学号': sid,
                '姓名': q_data['name'],
                '班级': q_data['class'],
                '素拓分': q_data['total'],
            }

    progress.update(70, '正在计算综合测评分数...')

    # Calculate comprehensive scores
    if sports_programs is None:
        sports_programs = []

    for sid, student in merged.items():
        gpa = student.get('学分绩点', 0) or 0
        moral = student.get('德育分', 0) or 0
        quality = student.get('素拓分', 0) or 0
        sports = student.get('体育', None)

        # Determine formula
        cls = student.get('班级', '')
        program_grade = _get_program_grade(cls)

        if has_sports and sports is not None and sports != '' and \
           (not sports_programs or program_grade in sports_programs):
            formula = COMPREHENSIVE_FORMULA_WITH_SPORTS
            student['体育'] = float(sports) if sports else 0
            comp = (
                gpa * formula['gpa'] +
                moral * formula['moral'] +
                float(student['体育']) * formula['sports'] +
                quality * formula['quality']
            )
        else:
            formula = COMPREHENSIVE_FORMULA_WITHOUT_SPORTS
            comp = (
                gpa * formula['gpa'] +
                moral * formula['moral'] +
                quality * formula['quality']
            )

        student['综合测评'] = round(comp, 2)
        student['class_name'] = cls

    progress.update(85, '正在生成综测汇总表...')

    # Convert to list and filter by grade if needed
    student_list = list(merged.values())
    student_list = filter_students_by_program(student_list, major_filter)
    if not student_list:
        raise ValueError(f'当前专业“{major_filter}”在三个源文件中没有匹配学生，请检查专业名称和班级列映射')

    # Grade filter
    if grade_filter and grade_filter != 'all':
        import re
        filtered = []
        for s in student_list:
            cls = s.get('班级', s.get('class_name', ''))
            match = re.search(r'(\d{2})\d{1,2}$', str(cls))
            grade_key = f"{match.group(1)}级" if match else ''
            if grade_key == grade_filter:
                filtered.append(s)
        student_list = filtered

    class_groups = {}
    for s in student_list:
        cn = s.get('班级', '其他')
        if cn not in class_groups:
            class_groups[cn] = []
        class_groups[cn].append(s)

    # Sort within class
    for cn in class_groups:
        class_groups[cn].sort(key=lambda s: str(s.get('学号', '')))

    # Determine output columns
    output_columns = ['学号', '姓名', '学分绩点', '德育分', '素拓分']
    if has_sports:
        output_columns.insert(3, '体育')
    output_columns.append('综合测评')

    # Write output 1: Comprehensive evaluation table with Excel formulas
    os.makedirs(output_dir, exist_ok=True)
    output1_path = unique_path(os.path.join(output_dir, '综测.xlsx'))

    # Build output sheets with formulas and collect _values data
    output_sheets = {}
    values_data = []  # For hidden _values sheet
    for cn, students in class_groups.items():
        sheet_rows = []
        for ri, s in enumerate(students):
            row = ri + 3  # Row 1=title, Row 2=headers, Row 3+=data
            row_data = {k: s.get(k, '') for k in output_columns}
            # Build 综合测评 Excel formula PER STUDENT matching Python logic.
            # Students with sports use different weights AND a different formula
            # than students without, even when the 体育 column exists globally.
            student_sports = s.get('体育')
            student_has_sports = (
                has_sports
                and student_sports is not None
                and student_sports != ''
                and (not sports_programs or _get_program_grade(s.get('班级', '')) in sports_programs)
            )
            if student_has_sports:
                # Layout: A=学号 B=姓名 C=学分绩点 D=体育 E=德育分 F=素拓分 G=综合测评
                row_data['综合测评'] = (
                    f'=C{row}*{COMPREHENSIVE_FORMULA_WITH_SPORTS["gpa"]}'
                    f'+D{row}*{COMPREHENSIVE_FORMULA_WITH_SPORTS["sports"]}'
                    f'+E{row}*{COMPREHENSIVE_FORMULA_WITH_SPORTS["moral"]}'
                    f'+F{row}*{COMPREHENSIVE_FORMULA_WITH_SPORTS["quality"]}'
                )
            elif has_sports:
                # Global sports column exists but THIS student has no sports.
                # Skip D (体育) column, use non-sports weights with sports layout.
                row_data['综合测评'] = (
                    f'=C{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["gpa"]}'
                    f'+E{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["moral"]}'
                    f'+F{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["quality"]}'
                )
            else:
                # No sports column at all (global has_sports=False).
                # Layout: A=学号 B=姓名 C=学分绩点 D=德育分 E=素拓分 F=综合测评
                row_data['综合测评'] = (
                    f'=C{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["gpa"]}'
                    f'+D{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["moral"]}'
                    f'+E{row}*{COMPREHENSIVE_FORMULA_WITHOUT_SPORTS["quality"]}'
                )
            sheet_rows.append(row_data)
            # Store pre-computed value for _values sheet
            values_data.append({
                '学号': s.get('学号', ''),
                '姓名': s.get('姓名', ''),
                '班级': cn,
                '综合测评': s.get('综合测评', 0),
            })
        output_sheets[cn] = sheet_rows

    write_multi_sheet_xlsx(output1_path, output_sheets, title='综合测评表')

    # Post-process: add hidden _values sheet
    if values_data:
        import openpyxl
        wb = openpyxl.load_workbook(output1_path)
        write_values_sheet(wb, values_data, '综合测评')
        wb.save(output1_path)
        wb.close()

    progress.update(90, '正在计算综测排名...')

    # Ranking
    program_groups = group_by_program_grade(student_list)
    ranking_data = {}
    for pg_key, pg_students in program_groups.items():
        ranked = calculate_ranking(pg_students, '综合测评', desc=True)
        ranking_data[pg_key] = ranked

    # Write output 2: Ranking table
    output2_path = unique_path(os.path.join(output_dir, '综测排名百分比.xlsx'))
    ranking_sheets = {}
    for pg_key, pg_students in ranking_data.items():
        ranking_sheets[pg_key] = [
            {
                '学号': s.get('学号', ''),
                '姓名': s.get('姓名', ''),
                '综合测评': s.get('综合测评', 0),
                '专业排名': s.get('排名', 0),
                '百分比': s.get('百分比', 0),
            }
            for s in pg_students
        ]

    write_ranking_xlsx(
        output2_path,
        ranking_sheets,
        columns=['学号', '姓名', '综合测评', '专业排名', '百分比'],
    )

    progress.done('综合测评计算完成！')

    return {
        'success': True,
        'student_count': len(student_list),
        'class_count': len(class_groups),
        'program_count': len(ranking_data),
        'output1': output1_path,
        'output2': output2_path,
    }


def _values_to_students(values: dict, module_type: str) -> dict:
    """Convert _values sheet data to the student dict format expected by merge.

    Args:
        values: Dict from read_values_sheet() — {sid: {name, class, score}}
        module_type: 'gpa', 'moral', or 'quality' — determines the score key name

    Returns:
        Dict compatible with _extract_*_data output format
    """
    result = {}
    score_key_map = {'gpa': 'gpa', 'moral': 'total', 'quality': 'total'}
    score_key = score_key_map.get(module_type, 'total')

    for sid, info in values.items():
        result[sid] = {
            'name': info.get('name', ''),
            'class': info.get('class', ''),
            score_key: info.get('score', 0.0),
        }
    return result


def _clean_student_id(val) -> str:
    """Convert any student ID value to a clean integer string.
    Handles float (221352107.0 → 221352107) and string formats."""
    if val is None:
        return ''
    try:
        # Try as float first (handles both 221352107.0 and '221352107')
        f = float(val)
        if f == int(f) and f > 0:
            return str(int(f))
    except (ValueError, TypeError):
        pass
    s = str(val).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return s if s not in ('nan', 'None', '', '学号', '学分', '总学分') else ''


def _is_valid_student_id(val) -> bool:
    """Check if a value looks like a valid student ID."""
    sid = _clean_student_id(val)
    return len(sid) >= 6 and sid.isdigit()


def _find_real_headers(df, sheet_mapping: dict = None) -> tuple:
    """Find the real header row in a DataFrame that may have title/credit rows.

    First checks if df.columns themselves are valid headers (contain '学号'/'姓名').
    Then scans first 5 data rows for a row that looks like headers.
    Returns (header_row_idx, clean_headers_list, data_start_row).
    """
    sheet_mapping = sheet_mapping or {}
    configured_header = sheet_mapping.get('header_row')
    if isinstance(configured_header, int) and configured_header > 0:
        dataframe_row = configured_header - 1
        if dataframe_row < len(df):
            headers = [str(value).strip() if not pd.isna(value) else ''
                       for value in df.iloc[dataframe_row].tolist()]
            return dataframe_row, headers, dataframe_row + 1

    # Check if column names are already the real headers
    col_text = ' '.join([str(c).strip() for c in df.columns])
    if '学号' in col_text or '姓名' in col_text:
        return 0, [str(c).strip() for c in df.columns], 0  # row_idx=0 means use df.columns as-is

    # Scan data rows for header-like row
    for row_idx in range(min(5, len(df))):
        row_vals = [str(df.iloc[row_idx, i]).strip() if not pd.isna(df.iloc[row_idx, i]) else ''
                    for i in range(len(df.columns))]
        row_text = ' '.join(row_vals)
        if '学号' in row_text and ('姓名' in row_text or '名称' in row_text):
            return row_idx, row_vals, row_idx + 1
    # Fallback: use column names
    return 0, [str(c).strip() for c in df.columns], 0


def _extract_gpa_data(sheets: dict, mapping: dict = None) -> dict:
    """Extract GPA data from Module A output sheets.

    GPA format: Row 1=headers (学号,姓名,行政班级,...,学分绩点), Row 2=credit row,
    Row 3+=student data. Sports column found by header keyword '体育'.
    """
    if mapping is None:
        mapping = {}
    result = {}
    for sheet_name, df in sheets.items():
        if mapping.get(sheet_name, {}).get('enabled') is False:
            continue
        if not hasattr(df, 'columns') or not hasattr(df, 'iterrows'):
            continue
        if df.empty or len(df.columns) < 3:
            continue

        ncols = len(df.columns)

        # Find real header row (may be col names or row 1)
        _, real_headers, data_start = _find_real_headers(df, mapping.get(sheet_name, {}))

        # Detect columns from real headers
        id_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'id_col',
                                        ['学号', '学生号'], 0)
        name_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'name_col',
                                          ['姓名', '学生姓名'], 1)
        class_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'class_col',
                                           ['行政班级', '班级', '班别'], 2)
        score_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'score_col',
                                           ['学分绩点', '绩点', 'GPA', '平均学分绩点'], ncols - 1)
        sports_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'sports_col',
                                            ['体育', 'PE'], -1)
        if sports_col < 0:
            sports_col = None

        # Skip credit row (row right after header, usually contains float credits)
        credit_row_idx = data_start
        if credit_row_idx < len(df):
            first_row_val = df.iloc[credit_row_idx, id_col] if id_col < ncols else None
            # If first cell after header is NOT a valid student ID, it's likely a credit/header row
            if not _is_valid_student_id(first_row_val):
                data_start += 1

        for idx in range(data_start, len(df)):
            row = df.iloc[idx]
            action = _get_row_action(mapping, sheet_name, idx + 2)
            if action.get('action') == 'exclude':
                continue
            col0 = row.iloc[id_col] if id_col < ncols else None
            if not _is_valid_student_id(col0):
                continue
            sid = _clean_student_id(col0)

            name = ''
            if name_col < ncols:
                col1 = row.iloc[name_col]
                if not pd.isna(col1):
                    name = str(col1).strip()

            cls = str(sheet_name)
            # Only override if column value looks like a real class name (contains Chinese + digits)
            if class_col < ncols:
                col2 = row.iloc[class_col]
                if not pd.isna(col2):
                    col2_str = str(col2).strip()
                    has_cn = any('一' <= c <= '鿿' for c in col2_str)
                    has_digit = any(c.isdigit() for c in col2_str)
                    if has_cn and has_digit and col2_str:
                        cls = col2_str

            try:
                score_source = action.get('value') if action.get('action') == 'replace' else row.iloc[score_col]
                gpa = float(score_source) if not pd.isna(score_source) else 0.0
            except (ValueError, TypeError):
                gpa = 0.0

            sports = None
            if sports_col is not None:
                try:
                    sv = row.iloc[sports_col]
                    sports = float(sv) if not pd.isna(sv) else None
                except (ValueError, TypeError):
                    pass

            if sid:
                result[sid] = {
                    'name': name,
                    'class': cls,
                    'gpa': gpa,
                    'sports': sports,
                }
    return result


def _extract_moral_data(sheets: dict, mapping: dict = None) -> dict:
    """Extract moral education data from Module B output sheets.

    Moral format: Row 1=headers (学号,姓名,...,德育分), Row 2+=student data.
    """
    if mapping is None:
        mapping = {}
    result = {}
    for sheet_name, df in sheets.items():
        if mapping.get(sheet_name, {}).get('enabled') is False:
            continue
        if not hasattr(df, 'columns') or not hasattr(df, 'iterrows'):
            continue
        if df.empty or len(df.columns) < 3:
            continue

        ncols = len(df.columns)

        _, real_headers, data_start = _find_real_headers(df, mapping.get(sheet_name, {}))

        id_col = _find_header_idx(real_headers, ['学号', '学生号'])
        sheet_map = mapping.get(sheet_name, {})
        if sheet_map.get('id_col') is not None:
            id_col = sheet_map['id_col']
        name_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'name_col',
                                          ['姓名', '学生姓名'], 1)
        class_col = _find_header_idx(real_headers, ['行政班级', '班级', '班别'])
        if sheet_map.get('class_col') is not None:
            class_col = sheet_map['class_col']
        score_col = _find_header_idx(
            real_headers, ['最终得分', '最终分数', '德育分', '德育总分', '德育']
        )
        if sheet_map.get('score_col') is not None:
            score_col = sheet_map['score_col']
        # Detail tabs such as "纪检/教室/宿舍" end in "总扣分".  They are
        # inputs, not final moral scores, and must not be treated as score sheets.
        if score_col is None:
            continue

        for idx in range(data_start, len(df)):
            row = df.iloc[idx]
            action = _get_row_action(mapping, sheet_name, idx + 2)
            if action.get('action') == 'exclude':
                continue
            col0 = row.iloc[id_col] if id_col is not None and id_col < ncols else None
            sid = _clean_student_id(col0) if _is_valid_student_id(col0) else ''

            name = ''
            if name_col < ncols:
                col1 = row.iloc[name_col]
                if not pd.isna(col1):
                    name = str(col1).strip()

            cls = str(sheet_name)
            if class_col is not None and class_col < ncols:
                class_val = row.iloc[class_col]
                if not pd.isna(class_val) and str(class_val).strip():
                    cls = str(class_val).strip()

            # New semester summaries may intentionally omit student IDs.  Keep
            # a temporary class+name identity and resolve it against the GPA
            # roster before the three modules are merged.
            if not sid:
                if not name or not cls:
                    continue
                sid = _moral_name_key(cls, name)

            # Read the final moral score as a numeric value.
            try:
                score_val = action.get('value') if action.get('action') == 'replace' else (row.iloc[score_col] if score_col < ncols else None)
                if score_val is None or (isinstance(score_val, float) and pd.isna(score_val)):
                    total = MORAL_BASE_SCORE
                else:
                    total = float(score_val)
            except (ValueError, TypeError):
                total = MORAL_BASE_SCORE

            if sid:
                result[sid] = {
                    'name': name,
                    'class': cls,
                    'total': total,
                }
    return result


def _find_header_idx(headers: list, keywords: list):
    """Return a matching header index, preferring exact matches."""
    normalised = [str(header).strip() for header in headers]
    for keyword in keywords:
        for idx, header in enumerate(normalised):
            if header == keyword:
                return idx
    for keyword in keywords:
        for idx, header in enumerate(normalised):
            if keyword in header:
                return idx
    return None


def _normalise_identity(value) -> str:
    return ''.join(str(value or '').split()).casefold()


def _moral_name_key(class_name: str, name: str) -> str:
    return f"__moral_name__:{_normalise_identity(class_name)}|{_normalise_identity(name)}"


def _resolve_moral_student_ids(moral_students: dict, gpa_students: dict) -> dict:
    """Resolve ID-less moral rows against the GPA roster without guessing.

    Exact class+name matches are preferred. A name-only fallback is allowed
    only when that name occurs exactly once in the GPA roster.
    """
    by_class_name = {}
    by_name = {}
    for sid, info in gpa_students.items():
        name_key = _normalise_identity(info.get('name', ''))
        class_key = _normalise_identity(info.get('class', ''))
        if not name_key:
            continue
        by_class_name.setdefault((class_key, name_key), []).append(sid)
        by_name.setdefault(name_key, []).append(sid)

    resolved = {}
    for key, info in moral_students.items():
        if not str(key).startswith('__moral_name__:'):
            resolved[key] = info
            continue
        name_key = _normalise_identity(info.get('name', ''))
        class_key = _normalise_identity(info.get('class', ''))
        candidates = by_class_name.get((class_key, name_key), [])
        if len(candidates) != 1:
            candidates = by_name.get(name_key, [])
        if len(candidates) == 1:
            resolved[candidates[0]] = info
    return resolved


def _extract_quality_data(sheets: dict, mapping: dict = None) -> dict:
    """Extract quality development data from Module C output sheets.

    Module C format has a title row (e.g., "XX班拓展分加分统计") followed by
    header row (学号, 姓名, 加分项目, 等级, 加分, 拓展分). Student ID cells may
    be merged across multiple activity rows.
    Column mapping: {sheet: {id_col, name_col, score_col}}
    """
    if mapping is None:
        mapping = {}
    result = {}
    for sheet_name, df in sheets.items():
        if mapping.get(sheet_name, {}).get('enabled') is False:
            continue
        if not hasattr(df, 'columns') or not hasattr(df, 'iterrows'):
            continue
        if df.empty or len(df.columns) < 3:
            continue

        ncols = len(df.columns)

        # Find real header row (skip title row like "XX班拓展分加分统计")
        _, real_headers, data_start = _find_real_headers(df, mapping.get(sheet_name, {}))

        # Detect columns from real headers
        id_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'id_col',
                                        ['学号', '学生号'], 0)
        name_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'name_col',
                                          ['姓名', '学生姓名'], 1)
        score_col = _get_col_idx_from_list(real_headers, sheet_name, mapping, 'score_col',
                                           ['拓展分', '素拓分', '素质拓展分'], ncols - 1)

        student_totals = {}
        last_sid = ''
        last_name = ''
        for idx in range(data_start, len(df)):
            row = df.iloc[idx]
            action = _get_row_action(mapping, sheet_name, idx + 2)
            if action.get('action') == 'exclude':
                continue
            col0 = row.iloc[id_col] if id_col < ncols else None
            clean_id = _clean_student_id(col0)

            if clean_id:
                last_sid = clean_id
                if name_col < ncols:
                    col1 = row.iloc[name_col]
                    last_name = str(col1).strip() if not pd.isna(col1) else ''
            elif last_sid:
                clean_id = last_sid
            else:
                continue

            # Skip rows that are actually headers or calculations
            if str(clean_id) in ('合计', '总计', '学号', '姓名'):
                continue

            try:
                score_source = action.get('value') if action.get('action') == 'replace' else row.iloc[score_col]
                ext_score = float(score_source) if not pd.isna(score_source) else 0.0
            except (ValueError, TypeError):
                ext_score = 0.0

            if clean_id not in student_totals:
                student_totals[clean_id] = {'name': last_name, 'total': 0.0}
            student_totals[clean_id]['total'] = max(
                student_totals[clean_id]['total'], ext_score
            )
            student_totals[clean_id]['name'] = last_name or student_totals[clean_id]['name']

        for sid, data in student_totals.items():
            result[sid] = {
                'name': data['name'],
                'class': str(sheet_name),
                'total': data['total'],
            }
    return result


def _get_col_idx_from_list(headers: list, sheet_name: str, mapping: dict,
                           field: str, keywords: list, default: int) -> int:
    """Get column index from mapping or auto-detect from header list."""
    sheet_map = mapping.get(sheet_name, {})
    idx = sheet_map.get(field)
    if idx is not None and 0 <= idx < len(headers):
        return idx
    # Auto-detect from header keywords
    for i, h in enumerate(headers):
        for kw in keywords:
            if kw in str(h):
                return i
    return default


def _get_row_action(mapping: dict, sheet_name: str, excel_row: int) -> dict:
    sheet_mapping = mapping.get(sheet_name, {}) if isinstance(mapping, dict) else {}
    actions = sheet_mapping.get('row_actions', {}) if isinstance(sheet_mapping, dict) else {}
    action = actions.get(str(excel_row), actions.get(excel_row, {}))
    return action if isinstance(action, dict) else {}


def _get_program_grade(class_name: str) -> str:
    """Extract program-grade key from class name."""
    import re
    match = re.search(r'^(.+?)(\d{2})\d{1,2}$', str(class_name))
    if match:
        return f"{match.group(1)}{match.group(2)}"
    return str(class_name)
