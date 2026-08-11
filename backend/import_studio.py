"""Unified, user-correctable import analysis for changing spreadsheet formats."""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime

import pandas as pd

from config import DATA_DIR


TEMPLATE_FILE = os.path.join(DATA_DIR, "import_templates.json")

SCHEMAS = {
    "gpa_raw": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["学生所属班级", "行政班级", "班级", "班别", "class"],
        "course_count_col": ["课程门数", "课程数", "门数"],
        "course_start_col": ["课程", "成绩"],
        "course_end_col": ["学分绩点", "平均学分绩点", "绩点"],
    },
    "gpa": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["行政班级", "班级", "班别", "class"],
        "score_col": ["学分绩点", "平均学分绩点", "绩点", "gpa"],
        "sports_col": ["体育", "体育成绩", "pe"],
    },
    "moral": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["行政班级", "班级", "班别", "class"],
        "score_col": ["最终得分", "最终分数", "德育分", "德育总分", "德育"],
    },
    "moral_existing": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["行政班级", "班级", "班别", "class"],
        "raw_score_col": ["原始分", "未截断分", "限制前得分", "原始得分"],
        "score_col": ["最终得分", "最终分数", "德育分", "德育总分", "德育"],
        "deduction_col": ["总扣分", "扣分合计", "累计扣分"],
        "addition_col": ["总加分", "加分合计", "累计加分"],
    },
    "moral_item": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["行政班级", "班级", "班别", "class"],
        "score_col": ["分数", "得分", "加分", "扣分", "扣分情况", "加分情况", "合计"],
    },
    "quality": {
        "id_col": ["学号", "学生号", "student id", "id"],
        "name_col": ["姓名", "学生姓名", "name"],
        "class_col": ["行政班级", "班级", "班别", "class"],
        "score_col": ["素拓分", "素质拓展分", "拓展分", "最终得分", "总分"],
    },
}


def _text(value) -> str:
    return re.sub(r"\s+", "", str(value or "")).casefold()


def _read_sheets(filepath: str) -> dict[str, pd.DataFrame]:
    ext = os.path.splitext(filepath)[1].lower()
    engine = "xlrd" if ext == ".xls" else "openpyxl"
    xl = pd.ExcelFile(filepath, engine=engine)
    try:
        return {name: pd.read_excel(xl, sheet_name=name, header=None) for name in xl.sheet_names}
    finally:
        xl.close()


def _header_score(row: list, schema: dict) -> int:
    values = [_text(value) for value in row]
    score = 0
    for keywords in schema.values():
        if any(any(_text(keyword) in value for keyword in keywords) for value in values):
            score += 1
    return score


def _find_header(df: pd.DataFrame, schema: dict) -> tuple[int, list]:
    best_idx, best_score = 0, -1
    limit = min(15, len(df))
    for idx in range(limit):
        row = df.iloc[idx].tolist()
        score = _header_score(row, schema)
        if score > best_score:
            best_idx, best_score = idx, score
    headers = [str(v).strip() if not pd.isna(v) else "" for v in df.iloc[best_idx].tolist()]
    return best_idx, headers


def _suggest(headers: list, schema: dict) -> tuple[dict, dict]:
    mapping, confidence = {}, {}
    normalised = [_text(header) for header in headers]
    used = set()
    for field, keywords in schema.items():
        if field == "course_start_col":
            # A course name may itself contain the word "课程".  Fuzzy matching
            # would then skip every earlier subject (for example PE, computer
            # basics and English).  Raw GPA sheets always start courses directly
            # after their detected metadata columns.
            occupied = [mapping.get(k) for k in ("id_col", "name_col", "class_col", "course_count_col")]
            idx = max([i for i in occupied if isinstance(i, int)] + [2]) + 1
            mapping[field] = idx if idx < len(headers) else None
            confidence[field] = 1.0 if mapping[field] is not None else 0.0
            if mapping[field] is not None:
                used.add(mapping[field])
            continue
        if field == "course_end_col":
            # This is the first summary column, so the final course is immediately before it.
            summary = next((i for i, value in enumerate(normalised)
                            if any(_text(keyword) in value for keyword in keywords)), None)
            mapping[field] = summary - 1 if isinstance(summary, int) and summary > 0 else len(headers) - 1
            confidence[field] = 1.0 if summary is not None else 0.72
            if mapping[field] is not None:
                used.add(mapping[field])
            continue
        exact = [i for i, value in enumerate(normalised)
                 if value and any(value == _text(keyword) for keyword in keywords)]
        fuzzy = [i for i, value in enumerate(normalised)
                 if value and any(_text(keyword) in value for keyword in keywords)]
        candidates = exact or fuzzy
        idx = next((i for i in candidates if i not in used), None)
        mapping[field] = idx
        confidence[field] = 1.0 if exact and idx is not None else (0.72 if idx is not None else 0.0)
        if idx is not None:
            used.add(idx)
    return mapping, confidence


def _fingerprint(module_type: str, sheets: list) -> str:
    shape = {
        "module": module_type,
        "sheets": [{"name": _text(s["name"]), "headers": [_text(h) for h in s["headers"]]} for s in sheets],
    }
    raw = json.dumps(shape, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]


def _load_templates() -> list:
    try:
        with open(TEMPLATE_FILE, "r", encoding="utf-8") as stream:
            data = json.load(stream)
            return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def list_import_templates(module_type: str = "") -> list:
    templates = _load_templates()
    return [item for item in templates if not module_type or item.get("module_type") == module_type]


def save_import_template(name: str, module_type: str, fingerprint: str, mappings: dict) -> dict:
    templates = _load_templates()
    record = {
        "name": (name or "未命名导入模板").strip(),
        "module_type": module_type,
        "fingerprint": fingerprint,
        "mappings": mappings,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    templates = [item for item in templates
                 if not (item.get("module_type") == module_type and item.get("fingerprint") == fingerprint)]
    templates.append(record)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TEMPLATE_FILE, "w", encoding="utf-8") as stream:
        json.dump(templates, stream, ensure_ascii=False, indent=2)
    return record


def analyze_import_file(filepath: str, module_type: str) -> dict:
    if module_type not in SCHEMAS:
        return {"success": False, "error": f"未知导入类型：{module_type}"}
    if not os.path.isfile(filepath):
        return {"success": False, "error": "文件不存在"}
    try:
        raw_sheets = _read_sheets(filepath)
        schema = SCHEMAS[module_type]
        sheets = []
        for name, raw in raw_sheets.items():
            if raw.empty:
                continue
            header_row, headers = _find_header(raw, schema)
            mapping, confidence = _suggest(headers, schema)
            data = raw.iloc[header_row + 1:].copy()
            samples = []
            for row in data.head(6).values.tolist():
                samples.append(["" if pd.isna(v) else str(v) for v in row[:len(headers)]])
            identity_cols = [mapping.get("id_col"), mapping.get("name_col")]
            valid_rows = 0
            seen_identities = set()
            duplicate_rows = 0
            invalid_scores = 0
            out_of_range_scores = 0
            issue_details = []
            score_col = mapping.get("score_col")
            score_limits = {"gpa": (0, 100), "moral": (0, 115), "moral_existing": (0, 115), "quality": (0, 1000)}
            for raw_index, row in data.iterrows():
                excel_row = int(raw_index) + 1
                if any(i is not None and i < len(row) and not pd.isna(row.iloc[i]) and str(row.iloc[i]).strip()
                       for i in identity_cols):
                    valid_rows += 1
                    identity = tuple(_text(row.iloc[i]) if i is not None and i < len(row) else ""
                                     for i in (mapping.get("id_col"), mapping.get("class_col"), mapping.get("name_col")))
                    if identity in seen_identities:
                        duplicate_rows += 1
                        issue_details.append({"type": "duplicate", "excel_row": excel_row,
                                              "identity": " / ".join(v for v in identity if v),
                                              "value": "", "message": "学生标识重复"})
                    else:
                        seen_identities.add(identity)
                    if score_col is not None and score_col < len(row):
                        raw_score = row.iloc[score_col]
                        if pd.isna(raw_score) or str(raw_score).strip() == "":
                            invalid_scores += 1
                            issue_details.append({"type": "invalid_score", "excel_row": excel_row,
                                                  "identity": " / ".join(v for v in identity if v),
                                                  "value": "", "message": "最终分数为空"})
                        else:
                            try:
                                numeric_score = float(raw_score)
                                limits = score_limits.get(module_type)
                                if limits and not (limits[0] <= numeric_score <= limits[1]):
                                    out_of_range_scores += 1
                                    issue_details.append({"type": "out_of_range", "excel_row": excel_row,
                                                          "identity": " / ".join(v for v in identity if v),
                                                          "value": str(raw_score),
                                                          "message": f"分数超出 {limits[0]}–{limits[1]} 范围"})
                            except (TypeError, ValueError):
                                invalid_scores += 1
                                issue_details.append({"type": "invalid_score", "excel_row": excel_row,
                                                      "identity": " / ".join(v for v in identity if v),
                                                      "value": str(raw_score), "message": "最终分数不是数字"})
            required = ["name_col"] if module_type in ("moral", "moral_existing", "moral_item") else ["id_col", "name_col"]
            if module_type in ("gpa", "quality", "moral_item"):
                required.append("score_col")
            missing = [field for field in required if mapping.get(field) is None]
            avg_conf = sum(confidence.values()) / max(1, len(confidence))
            role_score = confidence.get("score_col", 0) + confidence.get("id_col", 0) + confidence.get("name_col", 0)
            sheets.append({
                "name": name,
                "header_row": header_row,
                "headers": headers,
                "sample_rows": samples,
                "suggested_mapping": mapping,
                "confidence": confidence,
                "confidence_score": round(avg_conf, 2),
                "valid_rows": valid_rows,
                "missing_fields": missing,
                "issues": {
                    "duplicates": duplicate_rows,
                    "invalid_scores": invalid_scores,
                    "out_of_range_scores": out_of_range_scores,
                },
                "issue_details": issue_details[:200],
                "recommended": not missing and role_score >= 1.7,
            })
        fingerprint = _fingerprint(module_type, sheets)
        template = next((item for item in _load_templates()
                         if item.get("module_type") == module_type and item.get("fingerprint") == fingerprint), None)
        if template:
            for sheet in sheets:
                saved = template.get("mappings", {}).get(sheet["name"])
                if saved:
                    sheet["suggested_mapping"].update(saved)
                    sheet["template_applied"] = template.get("name")
        recommended = [sheet["name"] for sheet in sheets if sheet["recommended"]]
        return {
            "success": True,
            "filepath": filepath,
            "module_type": module_type,
            "fingerprint": fingerprint,
            "sheets": sheets,
            "recommended_sheets": recommended,
            "template": template,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}
