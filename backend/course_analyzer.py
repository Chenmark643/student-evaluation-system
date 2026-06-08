"""
单学期成绩分析模块 — Course-level Analysis V2
分析指定专业/年级的班级对比、挂科率、课程挂科排名等
处理多sheet的.xlsx文件（每sheet=一个班级）
"""
import os
import re
from collections import defaultdict
import pandas as pd
import numpy as np


def analyze_semester_courses(file_path: str, grade_filter: str = None,
                              major_filter: str = None) -> dict:
    try:
        if not file_path or not os.path.exists(file_path):
            return {'success': False, 'error': '文件不存在'}

        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.xls':
            # Legacy .xls — use raw reader (single sheet typically)
            from backend.parsers.xls_reader import read_raw_xls
            df = read_raw_xls(file_path)
            students = _extract_students_from_df(df, grade_filter, major_filter)
        else:
            # .xlsx — process each sheet independently
            students = _extract_students_from_xlsx(file_path, grade_filter, major_filter)

        if not students:
            return {'success': False, 'error': '未提取到学生数据，请确认文件格式'}

        # ============== Summary ==============
        total_students = len(students)
        total_scores = sum(s['avg_score'] for s in students)
        overall_avg = round(total_scores / total_students, 2) if total_students else 0
        total_failing_students = sum(1 for s in students if s['fail_count'] > 0)
        overall_fail_rate = round(total_failing_students / total_students * 100, 1) if total_students else 0

        total_course_enrollments = sum(s['total_courses'] for s in students)
        total_failed_courses = sum(s['fail_count'] for s in students)
        course_fail_rate = round(total_failed_courses / total_course_enrollments * 100, 1) if total_course_enrollments else 0

        # Collect all unique course names
        all_course_names = set()
        for s in students:
            all_course_names.update(s['course_scores'].keys())
        all_course_names = sorted(all_course_names)

        # ============== Class Analysis ==============
        class_groups = defaultdict(list)
        for s in students:
            cls = s['class'] or '未知班级'
            class_groups[cls].append(s)

        class_analysis = []
        for cls, sts in class_groups.items():
            n = len(sts)
            avg = round(sum(s['avg_score'] for s in sts) / n, 2)
            fail_count = sum(1 for s in sts if s['fail_count'] > 0)
            fail_rate = round(fail_count / n * 100, 1) if n else 0
            class_analysis.append({
                'class_name': cls, 'students': n, 'avg_score': avg,
                'fail_rate': fail_rate, 'fail_count': fail_count,
            })

        class_analysis.sort(key=lambda x: x['avg_score'], reverse=True)
        for i, c in enumerate(class_analysis):
            c['rank'] = i + 1

        class_fail_ranking = sorted(class_analysis, key=lambda x: x['fail_rate'], reverse=True)

        # ============== Course Analysis ==============
        course_data = defaultdict(lambda: {'scores': [], 'fails': 0, 'total': 0})
        for s in students:
            for cn, score in s['course_scores'].items():
                course_data[cn]['scores'].append(score)
                course_data[cn]['total'] += 1
                if score < 60:
                    course_data[cn]['fails'] += 1

        course_analysis = []
        for cn, cd in course_data.items():
            avg = round(sum(cd['scores']) / len(cd['scores']), 2) if cd['scores'] else 0
            fail_rate = round(cd['fails'] / cd['total'] * 100, 1) if cd['total'] else 0
            course_analysis.append({
                'course_name': cn, 'avg_score': avg, 'fail_rate': fail_rate,
                'fail_count': cd['fails'], 'total_students': cd['total'],
                'max_score': max(cd['scores']) if cd['scores'] else 0,
                'min_score': min(cd['scores']) if cd['scores'] else 0,
            })

        course_fail_ranking = sorted(course_analysis, key=lambda x: x['fail_rate'], reverse=True)

        # ============== Failing Students ==============
        failing_students = sorted(
            [s for s in students if s['fail_count'] > 0],
            key=lambda x: x['fail_count'], reverse=True
        )

        # ============== Score Distribution ==============
        scores_all = []
        for s in students:
            scores_all.extend(s['course_scores'].values())
        bins = [0, 30, 40, 50, 60, 70, 80, 90, 100]
        bin_labels = [f'{bins[i]}-{bins[i+1]}' for i in range(len(bins)-1)]
        counts = [sum(1 for sc in scores_all if bins[i] <= sc < bins[i+1]) for i in range(len(bins)-1)]

        # ============== Per-Class Course Analysis ==============
        per_class_course = {}
        for cls, sts in class_groups.items():
            cc_data = defaultdict(lambda: {'scores': [], 'fails': 0, 'total': 0})
            for s in sts:
                for cn, score in s['course_scores'].items():
                    cc_data[cn]['scores'].append(score)
                    cc_data[cn]['total'] += 1
                    if score < 60:
                        cc_data[cn]['fails'] += 1
            per_class_course[cls] = {}
            for cn, cd in cc_data.items():
                avg = round(sum(cd['scores']) / len(cd['scores']), 2) if cd['scores'] else 0
                fr = round(cd['fails'] / cd['total'] * 100, 1) if cd['total'] else 0
                per_class_course[cls][cn] = {
                    'avg_score': avg, 'fail_rate': fr,
                    'fail_count': cd['fails'], 'total': cd['total']
                }

        return {
            'success': True,
            'summary': {
                'total_students': total_students,
                'total_courses': len(all_course_names),
                'course_names': all_course_names,
                'overall_avg': overall_avg,
                'overall_fail_rate': overall_fail_rate,
                'failing_students_count': total_failing_students,
                'total_failed_course_instances': total_failed_courses,
                'course_level_fail_rate': course_fail_rate,
            },
            'class_analysis': class_analysis,
            'class_fail_ranking': class_fail_ranking,
            'course_analysis': course_analysis,
            'course_fail_ranking': course_fail_ranking,
            'failing_students': failing_students[:50],
            'student_course_map': {s['id']: {'name': s['name'], 'class': s['class'], 'course_scores': s['course_scores'], 'failed_courses': s['failed_courses'], 'fail_count': s['fail_count'], 'avg_score': s['avg_score']} for s in students},
            'score_distribution': {'labels': bin_labels, 'counts': counts},
            'per_class_course': per_class_course,
        }
    except Exception as e:
        import traceback
        return {'success': False, 'error': str(e), 'traceback': traceback.format_exc()}


def _extract_students_from_xlsx(file_path: str, grade_filter: str = None,
                                 major_filter: str = None) -> list:
    """Process multi-sheet .xlsx — each sheet = one class."""
    xl = pd.ExcelFile(file_path, engine='openpyxl')
    all_students = []

    for sheet_name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name)
        if df.empty or len(df.columns) < 3:
            continue

        students = _extract_students_from_df(df, grade_filter, major_filter, sheet_name)
        all_students.extend(students)

    xl.close()
    return all_students


def _extract_students_from_df(df: pd.DataFrame, grade_filter: str = None,
                               major_filter: str = None,
                               default_class: str = '') -> list:
    """Extract student records from a single DataFrame."""
    if df.empty:
        return []

    headers = [str(c).strip() for c in df.columns]

    # Detect columns by keyword
    id_col = None
    name_col = None
    class_col = None

    for i, h in enumerate(headers):
        hl = h.lower().replace(' ', '').replace('_', '')
        if id_col is None and ('学号' in hl or (hl == 'id')):
            id_col = i
        elif name_col is None and ('姓名' in hl or '名字' in hl or hl == 'name'):
            name_col = i
        elif class_col is None and ('班级' in hl or '行政班' in hl or '专业' in hl or hl == 'class'):
            class_col = i

    if id_col is None:
        # Try to find by data pattern: first column with all-numeric long strings
        for i in range(min(3, len(headers))):
            sample = df.iloc[:5, i].dropna()
            if len(sample) > 0:
                numeric_ids = sum(1 for v in sample if isinstance(v, (int, float)) or (isinstance(v, str) and v.strip().isdigit() and len(v.strip()) >= 6))
                if numeric_ids >= len(sample) * 0.6:
                    id_col = i
                    break
    if id_col is None:
        id_col = 0

    if name_col is None:
        name_col = 1 if len(headers) > 1 else 0
    if class_col is None:
        class_col = 2 if len(headers) > 2 else -1

    # Identify course columns
    skip_keywords = ['学号', '姓名', '名字', '班级', '行政班', '专业', '课程门数',
                     '平均', '总分', '总成绩', '学分绩点', 'gpa', '平均分',
                     '合计', '总计', '排名', '平均学分', '备注', '说明', '序号',
                     '学院', 'no.', 'num', 'count']
    course_cols = []
    course_names = []
    for i, h in enumerate(headers):
        if i in (id_col, name_col, class_col):
            continue
        hl = h.lower().replace(' ', '').replace('_', '')
        if any(kw in hl for kw in skip_keywords):
            continue
        if h.lower().startswith('unnamed'):
            continue
        if not h or h.strip() == '':
            continue
        course_cols.append(i)
        course_names.append(h)

    if not course_cols:
        # Broader fallback: use all columns after ID/name/class
        skip_idx = {id_col, name_col}
        if class_col >= 0:
            skip_idx.add(class_col)
        for i in range(len(headers)):
            if i not in skip_idx and i not in course_cols:
                h = headers[i]
                hl = h.lower().replace(' ', '')
                if any(kw in hl for kw in skip_keywords):
                    continue
                if h.lower().startswith('unnamed'):
                    continue
                course_cols.append(i)
                course_names.append(h)

    # Score mapping for text grades
    grade_map = {'优': 95, '优秀': 95, '良': 85, '良好': 85,
                 '中': 75, '中等': 75, '及格': 65, '合格': 65,
                 '通过': 65, '不及格': 50, '不合格': 50}

    students = []
    for idx, row in df.iterrows():
        # Get student ID
        sid_val = row.iloc[id_col] if id_col < len(row) else ''
        if pd.isna(sid_val):
            continue
        sid = str(int(sid_val)) if isinstance(sid_val, (int, float)) and sid_val == int(sid_val) else str(sid_val).strip()

        # Skip non-student rows
        if not sid:
            continue
        if len(sid) < 6:
            # Check if it's the credit row or a summary row
            if any(kw in sid for kw in ['学分', '学号', '合计', '总计', '平均', '人']):
                continue
            # Might be a valid short ID — let it through if numeric
            if not sid.isdigit():
                continue

        # Get name
        name = ''
        if name_col is not None and name_col < len(row):
            name_val = row.iloc[name_col]
            if not pd.isna(name_val):
                name = str(int(name_val)) if isinstance(name_val, float) and name_val == int(name_val) else str(name_val).strip()

        # Get class
        cls = default_class or ''
        if class_col is not None and class_col >= 0 and class_col < len(row):
            cls_val = row.iloc[class_col]
            if not pd.isna(cls_val):
                cls = str(int(cls_val)) if isinstance(cls_val, float) and cls_val == int(cls_val) else str(cls_val).strip()

        # Apply filters
        if grade_filter:
            grade_from_class = ''
            m = re.match(r'.*?(\d{2})\d{1,2}$', cls)
            if m:
                grade_from_class = m.group(1)
            if not grade_from_class and len(sid) >= 4:
                grade_from_class = sid[2:4]
            if not grade_from_class:
                m2 = re.search(r'(\d{2})级', cls)
                if m2:
                    grade_from_class = m2.group(1)
            if grade_from_class != grade_filter:
                continue

        if major_filter:
            if major_filter not in cls and major_filter not in str(sid):
                continue

        # Extract course scores
        course_scores = {}
        failed_courses = []
        for ci, cn in zip(course_cols, course_names):
            if ci >= len(row):
                continue
            try:
                val = row.iloc[ci]
                if pd.isna(val):
                    continue
                if isinstance(val, (int, float)):
                    score = float(val)
                else:
                    txt = str(val).strip()
                    if txt in grade_map:
                        score = float(grade_map[txt])
                    else:
                        try:
                            score = float(txt)
                        except (ValueError, TypeError):
                            continue
                course_scores[cn] = score
                if score < 60:
                    failed_courses.append(cn)
            except (ValueError, TypeError):
                continue

        if not course_scores:
            continue

        scores = list(course_scores.values())
        avg_score = sum(scores) / len(scores) if scores else 0

        students.append({
            'id': sid,
            'name': name,
            'class': cls,
            'course_scores': course_scores,
            'failed_courses': failed_courses,
            'fail_count': len(failed_courses),
            'avg_score': round(avg_score, 2),
            'total_courses': len(scores),
        })

    return students


def analyze_multi_semester(file_paths: dict) -> dict:
    """Analyze multiple semesters for trend tracking."""
    all_data = {}
    for sem, fp in file_paths.items():
        if fp and os.path.exists(fp):
            result = analyze_semester_courses(fp)
            if result.get('success'):
                all_data[sem] = result

    if not all_data:
        return {'success': False, 'error': '没有有效数据'}

    return {
        'success': True,
        'semesters': list(all_data.keys()),
        'summaries': {sem: data['summary'] for sem, data in all_data.items()},
        'class_rankings': {sem: data['class_analysis'] for sem, data in all_data.items()},
    }
