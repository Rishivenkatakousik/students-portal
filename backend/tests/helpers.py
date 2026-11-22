"""Shared test data: pinned date and a CSV row builder."""

from datetime import date

from app.core.student_fields import REQUIRED_COLUMNS

# Ages depend on "today", so tests pin it.
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
