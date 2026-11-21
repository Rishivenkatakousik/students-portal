from decimal import Decimal

import pytest

from app.grading import grade_for, summarise
from app.importer.validators import MARK_FIELDS


def marks(*values) -> dict[str, Decimal]:
    return dict(zip(MARK_FIELDS, (Decimal(str(v)) for v in values), strict=True))


def spread(total: str) -> dict[str, Decimal]:
    """Five equal marks adding up to ``total``."""
    return marks(*[Decimal(total) / 5] * 5)


@pytest.mark.parametrize(
    "total, percentage, grade",
    [
        ("500", "100.0", "A"),
        ("400", "80.0", "A"),
        ("399.75", "80.0", "A"),  # 79.95 rounds to 80.0: shown as 80.0%, so graded A
        ("399.7", "79.9", "B"),
        ("325", "65.0", "B"),
        ("324.5", "64.9", "C"),
        ("250", "50.0", "C"),
        ("249.5", "49.9", "D"),
        ("200", "40.0", "D"),
        ("199.5", "39.9", "F"),
        ("0", "0.0", "F"),
    ],
)
def test_percentage_and_grade_boundaries(total, percentage, grade):
    result = summarise(spread(total))
    assert result.total == Decimal(total)
    assert result.percentage == Decimal(percentage)
    assert result.grade == grade


def test_total_keeps_exact_decimals():
    assert summarise(marks("85.125", 50, 50, 50, 50)).total == Decimal("285.125")


def test_pass_needs_40_percent_and_33_in_every_subject():
    assert summarise(marks(40, 40, 40, 40, 40)).passed  # exactly 40%
    assert summarise(marks(33, 33, 33, 50.5, 50.5)).passed  # subjects exactly 33

    result = summarise(marks(100, 100, 100, 100, "32.99"))
    assert result.grade == "A"
    assert not result.passed  # high overall, but one subject below 33
    assert result.failed_subjects == ["second_language"]


def test_below_40_percent_fails_even_with_every_subject_passed():
    result = summarise(marks(39.9, 39.9, 39.9, 39.9, 39.9))  # 39.9%
    assert result.failed_subjects == []
    assert not result.passed


def test_grade_for_uses_band_minimums():
    assert [grade_for(Decimal(p)) for p in ("80", "79.9", "65", "50", "40", "39.9")] == list("ABBCDF")
