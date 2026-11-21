"""Shared test data: fixture paths, pinned date, and a CSV row builder."""

from datetime import date
from pathlib import Path

from app.core.student_fields import REQUIRED_COLUMNS

FIXTURES = Path(__file__).parent / "fixtures"

# Ages are checked against "today", so tests pin it. The sample pack's expected
# counts (16/9 and 4,685/315) hold for every day from 2025-12-26 to at least
# 2028-03-01; this date sits inside that window.
TODAY = date(2026, 11, 21)

HEADER = ",".join(REQUIRED_COLUMNS)
VALID_VALUES = [
    "STU00001", "Rohan Kaur", "rohan@example.edu", "2012-04-20", "9", "D",
    "43", "34", "42", "51.7", "40",
]  # fmt: skip


def row(**overrides: str) -> str:
    """A valid CSV line, with chosen columns replaced (values are written as-is)."""
    values = dict(zip(REQUIRED_COLUMNS, VALID_VALUES, strict=True)) | overrides
    return ",".join(values[c] for c in REQUIRED_COLUMNS)
