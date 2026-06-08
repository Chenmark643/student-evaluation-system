"""
Tie-aware ranking calculator with percentage computation.
"""


def calculate_ranking(students: list, score_key: str, desc: bool = True) -> list:
    """Calculate ranking with tie handling and percentage.

    Students with the same score share the same rank.
    The next distinct score gets rank = (previous rank + tie count).

    Args:
        students: List of student dicts with score data
        score_key: Key in student dict to rank by
        desc: True = higher score = rank 1

    Returns:
        Same list with '排名' and '百分比' added to each student dict
    """
    if not students:
        return students

    # Sort by score
    sorted_students = sorted(
        students,
        key=lambda s: _safe_float(s.get(score_key, 0)),
        reverse=desc,
    )

    total = len(sorted_students)
    current_rank = 1
    i = 0

    while i < total:
        current_score = _safe_float(sorted_students[i].get(score_key, 0))

        # Find all students with the same score
        j = i
        while (j < total and
               _safe_float(sorted_students[j].get(score_key, 0)) == current_score):
            sorted_students[j]['排名'] = current_rank
            sorted_students[j]['百分比'] = round(current_rank / total, 6)
            j += 1

        # Next rank skips tied positions
        current_rank = j + 1
        i = j

    return sorted_students


def _safe_float(value) -> float:
    """Safely convert a value to float, returning 0.0 for non-numeric values."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0
