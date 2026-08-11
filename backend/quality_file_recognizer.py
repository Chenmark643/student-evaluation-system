"""Roster-guided recognition for heterogeneous quality-bonus spreadsheets."""
from __future__ import annotations

import os
import re
from collections import defaultdict
from difflib import SequenceMatcher
from typing import Iterable


NAME_HEADERS = {'姓名', '学生姓名', '学员姓名', '名字', '成员', '人员', '志愿者', '实践团队', '团队成员'}
CLASS_HEADERS = {'班级', '行政班', '专业班级', '班别', '所在班级'}
SID_HEADERS = {'学号', '学生号', '学籍号', '学生学号'}
SCORE_HEADERS = {'素拓加分', '素拓分', '加分', '加分分值', '分值', '分数', '合计加分', '素拓成绩'}
SUMMARY_WORDS = {'合计', '总计', '小计', '备注', '说明'}
CLASS_PATTERN = re.compile(r'^(?:顿河)?(?:交|土|信|国电|[\u4e00-\u9fff]{1,8})\d{3,4}(?:班)?$')
NUMBER_PATTERN = re.compile(r'[-+]?\d+(?:\.\d+)?')


def _text(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _normal(value) -> str:
    return re.sub(r'[\s\-—_·・（）()]+', '', _text(value)).lower()


def _normal_class(value) -> str:
    return re.sub(r'班$', '', _normal(value))


def _normal_sid(value) -> str:
    text = _text(value)
    if text.endswith('.0') and text[:-2].isdigit():
        text = text[:-2]
    return re.sub(r'\s+', '', text)


def _classify_header(value) -> str:
    text = _normal(value)
    if not text:
        return ''
    if text in {_normal(item) for item in NAME_HEADERS} or '姓名' in text:
        return 'name'
    if text in {_normal(item) for item in CLASS_HEADERS} or '班级' in text:
        return 'class'
    if text in {_normal(item) for item in SID_HEADERS} or text.endswith('学号'):
        return 'sid'
    if text in {_normal(item) for item in SCORE_HEADERS} or '素拓加分' in text or text == '合计加分':
        return 'score'
    return ''


def _read_workbook(path: str) -> list[tuple[str, list[list]]]:
    extension = os.path.splitext(path)[1].lower()
    if extension == '.xlsx':
        import openpyxl

        workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
        try:
            return [
                (sheet.title, [list(row) for row in sheet.iter_rows(values_only=True)])
                for sheet in workbook.worksheets
            ]
        finally:
            workbook.close()
    if extension == '.xls':
        import xlrd

        workbook = xlrd.open_workbook(path, encoding_override='gbk')
        return [
            (sheet.name, [[sheet.cell_value(row, col) for col in range(sheet.ncols)]
                          for row in range(sheet.nrows)])
            for sheet in workbook.sheets()
        ]
    raise ValueError('仅支持 .xlsx 和 .xls 名单文件')


def _find_header(rows: list[list]) -> int:
    best_index, best_score = 0, -1
    for index, row in enumerate(rows[:20]):
        kinds = [_classify_header(cell) for cell in row]
        score = sum(3 if kind in {'name', 'class', 'sid'} else 2 if kind == 'score' else 0
                    for kind in kinds)
        if score > best_score:
            best_index, best_score = index, score
    return best_index


def _roster_records(roster: dict) -> list[dict]:
    records = []
    for key, raw in (roster or {}).items():
        if not isinstance(raw, dict):
            continue
        sid = _normal_sid(key or raw.get('id') or raw.get('学号'))
        name = _text(raw.get('name') or raw.get('姓名'))
        class_name = _text(raw.get('class') or raw.get('班级'))
        if not name:
            continue
        records.append({
            'sid': sid, 'name': name, 'class': class_name,
            'normal_name': _normal(name), 'normal_class': _normal_class(class_name),
        })
    return records


def _column_map(rows: list[list], header_index: int, roster: list[dict]) -> dict[str, int | None]:
    header = rows[header_index] if rows else []
    result: dict[str, int | None] = {'name': None, 'class': None, 'sid': None, 'score': None}
    for index, value in enumerate(header):
        kind = _classify_header(value)
        if kind and result[kind] is None:
            result[kind] = index

    roster_ids = {item['sid'] for item in roster if item['sid']}
    roster_classes = {item['normal_class'] for item in roster if item['normal_class']}
    roster_names = [item['normal_name'] for item in roster if item['normal_name']]
    data_rows = rows[header_index + 1:header_index + 81]
    width = max([len(header), *[len(row) for row in data_rows]], default=0)
    profiles = []
    for col in range(width):
        values = [_text(row[col]) for row in data_rows if col < len(row) and _text(row[col])]
        profiles.append({
            'sid': sum(_normal_sid(value) in roster_ids for value in values),
            'class': sum(_normal_class(value) in roster_classes or bool(CLASS_PATTERN.match(_normal_class(value))) for value in values),
            'name': sum(any(name == _normal(value) or name in _normal(value) for name in roster_names) for value in values),
        })
    for kind in ('sid', 'class', 'name'):
        if result[kind] is None and profiles:
            best = max(range(len(profiles)), key=lambda col: profiles[col][kind])
            if profiles[best][kind] > 0 and best not in {value for value in result.values() if value is not None}:
                result[kind] = best
    return result


def _cell(row: list, index: int | None) -> str:
    return _text(row[index]) if index is not None and index < len(row) else ''


def _parse_score(value) -> float | None:
    text = _text(value).replace(',', '')
    match = NUMBER_PATTERN.search(text)
    if not match:
        return None
    try:
        score = float(match.group())
        return score if score >= 0 else None
    except ValueError:
        return None


def _identity_similarity(raw_sid: str, raw_name: str, raw_class: str,
                         record: dict) -> dict[str, float]:
    """Score a roster candidate without treating class or student ID as a hard filter."""
    sid = _normal_sid(raw_sid)
    name = _normal(raw_name)
    class_name = _normal_class(raw_class)
    parts = {
        'name': SequenceMatcher(None, name, record['normal_name']).ratio() if name else 0.0,
        'sid': SequenceMatcher(None, sid, record['sid']).ratio() if sid and record['sid'] else 0.0,
        'class': SequenceMatcher(None, class_name, record['normal_class']).ratio()
        if class_name and record['normal_class'] else 0.0,
    }
    weights = {'name': .68, 'sid': .22, 'class': .10}
    available = [key for key, raw in (
        ('name', name), ('sid', sid), ('class', class_name)
    ) if raw]
    total_weight = sum(weights[key] for key in available)
    overall = (
        sum(parts[key] * weights[key] for key in available) / total_weight
        if total_weight else 0.0
    )
    return {'overall': overall, **parts}


def _candidate_payload(record: dict, similarity: dict[str, float] | float | None = None) -> dict:
    payload = {'sid': record['sid'], 'name': record['name'], 'class': record['class']}
    if isinstance(similarity, dict):
        payload.update({
            'similarity': round(similarity['overall'], 3),
            'confidence': round(similarity['overall'], 3),
            'name_similarity': round(similarity['name'], 3),
            'sid_similarity': round(similarity['sid'], 3),
            'class_similarity': round(similarity['class'], 3),
        })
    elif similarity is not None:
        payload['similarity'] = round(similarity, 3)
        payload['confidence'] = round(similarity, 3)
    return payload


def _rank_candidates(raw_sid: str, raw_name: str, raw_class: str,
                     roster: list[dict], limit: int = 5) -> list[dict]:
    scored = [(_identity_similarity(raw_sid, raw_name, raw_class, item), item)
              for item in roster]
    scored.sort(key=lambda pair: (
        pair[0]['overall'], pair[0]['name'], pair[0]['sid'], pair[0]['class'],
        pair[1]['name'], pair[1]['sid'],
    ), reverse=True)
    return [_candidate_payload(item, scores) for scores, item in scored[:limit]]


def _match_identity(raw_sid: str, raw_name: str, raw_class: str, roster: list[dict]) -> dict:
    by_id = {item['sid']: item for item in roster if item['sid']}
    by_class_name = {(item['normal_class'], item['normal_name']): item for item in roster}
    by_name: dict[str, list[dict]] = defaultdict(list)
    for item in roster:
        by_name[item['normal_name']].append(item)

    sid = _normal_sid(raw_sid)
    name = _normal(raw_name)
    class_name = _normal_class(raw_class)
    contained = [item for item in roster if item['normal_name'] and item['normal_name'] in name]
    if sid and sid in by_id:
        match = by_id[sid]
        name_conflict = bool(name and match['normal_name'] != name and match['normal_name'] not in name)
        class_conflict = bool(class_name and match['normal_class'] != class_name)
        if name_conflict or class_conflict:
            return {
                'status': 'review', 'confidence': 'low', 'selected': False,
                'reason': '学号匹配，但文件中的姓名或班级不一致',
                'match': match,
                'candidates': _rank_candidates(raw_sid, raw_name, raw_class, roster),
            }
        return {'status': 'matched', 'confidence': 'high', 'selected': True,
                'reason': '学号完全匹配', 'match': match, 'candidates': []}

    if name and class_name and (class_name, name) in by_class_name:
        match = by_class_name[(class_name, name)]
        return {'status': 'matched', 'confidence': 'high', 'selected': True,
                'reason': '班级与姓名完全匹配', 'match': match, 'candidates': []}

    if name in by_name and len(by_name[name]) == 1:
        match = by_name[name][0]
        if not class_name or match['normal_class'] == class_name:
            return {'status': 'matched', 'confidence': 'medium', 'selected': True,
                    'reason': '姓名在花名册中唯一', 'match': match, 'candidates': []}

    if len(contained) == 1:
        match = contained[0]
        class_in_cell = bool(match['normal_class'] and match['normal_class'] in name)
        if not class_name or match['normal_class'] == class_name or class_in_cell:
            return {'status': 'matched', 'confidence': 'medium', 'selected': True,
                    'reason': '结合花名册拆分了姓名附加内容或班级姓名连写',
                    'match': match, 'candidates': []}

    suggestions = _rank_candidates(raw_sid, raw_name, raw_class, roster)
    if suggestions and suggestions[0]['similarity'] >= .45:
        return {'status': 'review', 'confidence': 'low', 'selected': False,
                'reason': '信息未完全匹配，已按姓名、学号和班级综合排序候选人', 'match': None,
                'candidates': suggestions}
    return {'status': 'unmatched', 'confidence': 'none', 'selected': False,
            'reason': '未能可靠匹配，已列出相似度最高的候选人',
            'match': None, 'candidates': suggestions}


def _iter_people_rows(rows: list[list], header_index: int, columns: dict[str, int | None],
                      roster: list[dict]) -> Iterable[tuple[int, dict]]:
    for row_number, row in enumerate(rows[header_index + 1:], start=header_index + 2):
        raw_name = _cell(row, columns['name'])
        raw_class = _cell(row, columns['class'])
        raw_sid = _cell(row, columns['sid'])
        if not raw_name and not raw_sid:
            continue
        if _normal(raw_name) in {_normal(word) for word in SUMMARY_WORDS}:
            continue
        score = _parse_score(_cell(row, columns['score'])) if columns['score'] is not None else None
        outcome = _match_identity(raw_sid, raw_name, raw_class, roster)
        match = outcome.pop('match')
        yield row_number, {
            'raw_class': raw_class, 'raw_name': raw_name, 'raw_student_id': raw_sid,
            'file_score': score,
            'matched_sid': match['sid'] if match else '',
            'matched_name': match['name'] if match else '',
            'matched_class': match['class'] if match else '',
            **outcome,
        }


def recognize_quality_bonus_file(path: str, roster: dict) -> dict:
    """Recognize students in one heterogeneous Excel list using the roster as authority."""
    if not path or not os.path.isfile(path):
        return {'success': False, 'error': '识别文件不存在'}
    records = _roster_records(roster)
    if not records:
        return {'success': False, 'error': '请先导入学生花名册'}
    try:
        sheets = _read_workbook(path)
    except Exception as exc:
        return {'success': False, 'error': f'读取识别文件失败：{exc}'}

    result_rows = []
    scanned = 0
    for sheet_name, rows in sheets:
        if not any(any(_text(cell) for cell in row) for row in rows):
            continue
        scanned += 1
        header_index = _find_header(rows)
        columns = _column_map(rows, header_index, records)
        if columns['name'] is None and columns['sid'] is None:
            continue
        for row_number, row in _iter_people_rows(rows, header_index, columns, records):
            row['source_id'] = f'{sheet_name}:{row_number}'
            row['sheet'] = sheet_name
            row['row'] = row_number
            result_rows.append(row)

    groups: dict[str, list[int]] = defaultdict(list)
    for index, row in enumerate(result_rows):
        if row['matched_sid'] and row['status'] == 'matched':
            groups[row['matched_sid']].append(index)
    confidence_rank = {'high': 2, 'medium': 1, 'low': 0, 'none': -1}
    for indexes in groups.values():
        if len(indexes) < 2:
            continue
        keep = max(indexes, key=lambda index: (confidence_rank[result_rows[index]['confidence']], -index))
        for index in indexes:
            if index == keep:
                continue
            result_rows[index].update({
                'status': 'duplicate', 'selected': False, 'confidence': 'none',
                'reason': f'与 {result_rows[keep]["source_id"]} 为同一学生，已自动去重',
            })

    counts = {key: sum(row['status'] == key for row in result_rows)
              for key in ('matched', 'review', 'unmatched', 'duplicate')}
    counts['selected'] = sum(bool(row['selected'] and row['matched_sid']) for row in result_rows)
    counts['total'] = len(result_rows)
    return {
        'success': True, 'filename': os.path.basename(path), 'path': path,
        'sheets_scanned': scanned, 'rows': result_rows, 'summary': counts,
    }
