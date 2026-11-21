"""Grading scheme: the one place that turns marks into a result.

- Total out of 500 (five subjects, each out of 100).
- Percentage = total / 5, rounded half-up to one decimal place.
- Grade from that *displayed* percentage, so a report never shows "80.0%"
  next to a B: A >= 80, B >= 65, C >= 50, D >= 40, F below 40.
- Pass = percentage >= 40 AND at least 33 in every subject. A student can
  have a D overall and still fail because of one subject.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.importer.validators import MARK_FIELDS

SUBJECT_LABELS = {
    "maths": "Maths",
    "science": "Science",
    "english": "English",
    "social_studies": "Social studies",
    "second_language": "Second language",
}
MAX_MARK = Decimal(100)
MAX_TOTAL = MAX_MARK * len(MARK_FIELDS)
PASS_PERCENTAGE = Decimal(40)
SUBJECT_PASS_MARK = Decimal(33)
GRADE_BANDS = ((Decimal(80), "A"), (Decimal(65), "B"), (Decimal(50), "C"), (Decimal(40), "D"), (Decimal(0), "F"))

_ONE_PLACE = Decimal("0.1")


@dataclass(frozen=True)
class Result:
    total: Decimal
    percentage: Decimal  # rounded to one decimal place
    grade: str
    passed: bool
    failed_subjects: list[str]  # subject keys below SUBJECT_PASS_MARK


def round_percentage(value: Decimal) -> Decimal:
    return value.quantize(_ONE_PLACE, rounding=ROUND_HALF_UP)


def grade_for(percentage: Decimal) -> str:
    return next(grade for minimum, grade in GRADE_BANDS if percentage >= minimum)


def summarise(marks: Mapping[str, Decimal]) -> Result:
    total = sum((marks[subject] for subject in MARK_FIELDS), Decimal(0))
    percentage = round_percentage(total * 100 / MAX_TOTAL)
    failed_subjects = [s for s in MARK_FIELDS if marks[s] < SUBJECT_PASS_MARK]
    return Result(
        total=total,
        percentage=percentage,
        grade=grade_for(percentage),
        passed=percentage >= PASS_PERCENTAGE and not failed_subjects,
        failed_subjects=failed_subjects,
    )
