"""The sample pack's own files must give exactly the counts its README promises."""

from collections import Counter

from app.importer.parser import parse_csv
from app.importer.pipeline import process
from app.importer.validators import ErrorCode
from tests.helpers import FIXTURES, TODAY

MISSING = ErrorCode.MISSING_REQUIRED
FORMAT = ErrorCode.INVALID_FORMAT
RANGE = ErrorCode.OUT_OF_RANGE


def run(name: str):
    parsed = parse_csv((FIXTURES / name).read_bytes(), 10 * 1024 * 1024)
    return parsed, process(parsed, TODAY)


def test_small_file_counts_and_every_problem():
    _, result = run("students_small.csv")

    assert (result.rows_read, len(result.valid_rows), result.rejected) == (25, 16, 9)
    assert [(p.line, p.student_id, p.field, p.code) for p in result.problems] == [
        (4, "STU00003", "date_of_birth", RANGE),  # born 1970
        (5, "STU00004", "email", FORMAT),  # sana@example
        (6, "STU00005", "maths", RANGE),  # -5
        (9, "STU00007", "section", FORMAT),  # Z
        (10, "STU00008", "full_name", MISSING),
        (14, "STU00012", None, ErrorCode.WRONG_FIELD_COUNT),
        (15, "STU00013", "science", MISSING),
        (18, "STU00016", "grade_level", FORMAT),  # IX
        (21, "STU00005", "student_id", ErrorCode.DUPLICATE_ID),  # first STU00005 was invalid
    ]


def test_small_file_normalises_messy_but_valid_rows():
    _, result = run("students_small.csv")
    by_id = {r.data["student_id"]: r.data for r in result.valid_rows}

    assert by_id["STU00011"]["full_name"] == "Siddharth Bose"  # padded
    assert by_id["STU00011"]["section"] == "A"  # "  A "
    assert by_id["STU00014"]["email"] == "aditya.pawar82@example.edu"  # upper case
    assert by_id["STU00022"]["full_name"] == "Kabir Das"  # id was "stu00022"
    assert by_id["STU00024"]["full_name"] == "Patel, Sahil"  # quoted comma
    assert by_id["STU00018"]["full_name"] == "Müller Patel"


def test_sample_file_counts():
    parsed, result = run("students_sample.csv")

    assert (result.rows_read, len(result.valid_rows), result.rejected) == (5000, 4685, 315)
    assert parsed.extra_columns == ["parent_phone"]
    assert len({r.data["student_id"] for r in result.valid_rows}) == 4685


def test_sample_file_problem_breakdown():
    # Pins the current interpretation; if a rule changes, this shows exactly how.
    _, result = run("students_sample.csv")
    assert Counter(p.code for p in result.problems) == {
        FORMAT: 161,
        ErrorCode.DUPLICATE_ID: 60,
        RANGE: 59,
        MISSING: 53,
        ErrorCode.WRONG_FIELD_COUNT: 15,
    }
