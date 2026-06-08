"""
Multi-strategy student identity matching across different data sources.
"""

from difflib import SequenceMatcher


class StudentMatcher:
    """Multi-strategy student identity matching across data sources.

    Strategies (in priority order):
    1. Exact student ID match
    2. Exact name + class match
    3. Fuzzy name match within the same class
    """

    def __init__(self, fuzzy_threshold: float = 0.85):
        self.fuzzy_threshold = fuzzy_threshold
        self.by_id = {}          # student_id -> record
        self.by_class_name = {}  # (class, normalized_name) -> record
        self.warnings = []

    @staticmethod
    def normalize_name(name: str) -> str:
        """Normalize a name for comparison: strip whitespace, lowercase."""
        if not name:
            return ''
        return ''.join(str(name).split()).lower()

    def add_student(self, student_id=None, name=None, class_name=None, **fields):
        """Register a student from any data source.

        Args:
            student_id: Student ID (学号)
            name: Student name
            class_name: Class identifier
            **fields: Additional data fields

        Returns:
            The registered record dict
        """
        sid = str(student_id).strip() if student_id else None
        record = {
            'id': sid,
            'name': str(name).strip() if name else '',
            'class': str(class_name).strip() if class_name else '',
            **fields,
        }

        # Index by ID (most reliable key)
        if sid:
            if sid in self.by_id:
                self.warnings.append(
                    f"Duplicate student ID: {sid} ({record['name']} vs "
                    f"{self.by_id[sid]['name']}) — keeping first occurrence"
                )
            else:
                self.by_id[sid] = record

        # Index by class + name
        if name and class_name:
            key = (str(class_name).strip(), self.normalize_name(name))
            if key not in self.by_class_name:
                self.by_class_name[key] = record

        return record

    def find_match(self, student_id=None, name=None, class_name=None):
        """Find a matching student record using the best available strategy.

        Args:
            student_id: Student ID if available
            name: Student name
            class_name: Class identifier

        Returns:
            Matching record dict, or None if no match found
        """
        # Strategy 1: Exact ID match
        if student_id:
            sid = str(student_id).strip()
            if sid in self.by_id:
                return self.by_id[sid]

        # Strategy 2: Exact name + class match
        if name and class_name:
            key = (str(class_name).strip(), self.normalize_name(name))
            if key in self.by_class_name:
                return self.by_class_name[key]

            # Strategy 3: Fuzzy name match within same class
            norm_name = self.normalize_name(name)
            best_score = 0.0
            best_match = None

            for (cls, normed_name), record in self.by_class_name.items():
                if cls == str(class_name).strip():
                    score = SequenceMatcher(None, norm_name, normed_name).ratio()
                    if score > best_score and score >= self.fuzzy_threshold:
                        best_score = score
                        best_match = record

            if best_match:
                self.warnings.append(
                    f"Fuzzy match: '{name}' -> '{best_match['name']}' "
                    f"in class {class_name} (confidence: {best_score:.2f})"
                )
                return best_match

        return None

    def get_all_students(self) -> list:
        """Get all unique student records."""
        seen = set()
        result = []
        for record in list(self.by_id.values()) + list(self.by_class_name.values()):
            key = (record.get('id'), record.get('name'), record.get('class'))
            if key not in seen:
                seen.add(key)
                result.append(record)
        return result
