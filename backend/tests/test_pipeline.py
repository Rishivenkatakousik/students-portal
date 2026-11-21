"""Row-level behaviour: skipping, field counts, line numbers, duplicates."""

from app.services.csv_import.parser import parse_csv
from app.services.csv_import.pipeline import PipelineResult, process
from app.services.csv_import.validators import ErrorCode
from tests.helpers import HEADER, TODAY, row


def run(*lines: str, header: str = HEADER) -> PipelineResult:
    text = "\n".join([header, *lines]) + "\n"
    return process(parse_csv(text.encode(), 1024 * 1024), TODAY)


def problems(result: PipelineResult) -> list[tuple]:
    return [(p.line, p.field, p.code) for p in result.problems]


def imported_ids(result: PipelineResult) -> list[str]:
    return [r.data["student_id"] for r in result.valid_rows]


def test_blank_and_all_empty_rows_are_skipped_but_count_as_lines():
    result = run(
        row(),
        "",
        "   ",
        ",,,,,,,,,,",  # right number of fields, all empty
        ",,,",  # wrong number of fields, but all empty: still skipped
        '"","  ",,,,,,,,,',
        row(student_id="STU00002", maths="-5"),
    )
    assert result.rows_read == 2
    assert problems(result) == [(8, "maths", ErrorCode.OUT_OF_RANGE)]


def test_wrong_field_count_rejects_whole_row():
    result = run(
        row(second_language="40,99"),  # one extra
        row(student_id="STU00002").rsplit(",", 1)[0],  # one short
        row(student_id="STU00003") + ",",  # trailing comma
        row(student_id="STU00004"),
    )
    assert problems(result) == [
        (2, None, ErrorCode.WRONG_FIELD_COUNT),
        (3, None, ErrorCode.WRONG_FIELD_COUNT),
        (4, None, ErrorCode.WRONG_FIELD_COUNT),
    ]
    assert result.problems[0].message == "Expected 11 fields, found 12"
    assert result.problems[0].student_id == "STU00001"
    assert imported_ids(result) == ["STU00004"]


def test_quoted_values_with_commas_and_spaces():
    result = run(
        row(full_name='"Singh, Aarav"'),
        row(student_id="STU00002", full_name=' "Patel, Sahil"'),  # space before quote
    )
    assert result.problems == []
    assert [r.data["full_name"] for r in result.valid_rows] == ["Singh, Aarav", "Patel, Sahil"]


def test_multiline_quoted_value_is_reported_at_its_first_line():
    result = run(
        row(full_name='"Rohan\nKaur"'),  # lines 2-3; newline collapsed to a space
        row(student_id="STU00002", full_name='"Isha\n\nRao"', maths="105"),  # lines 4-6
        row(student_id="STU00003", maths="-1"),  # line 7
    )
    assert result.valid_rows[0].data["full_name"] == "Rohan Kaur"
    assert problems(result) == [
        (4, "maths", ErrorCode.OUT_OF_RANGE),
        (7, "maths", ErrorCode.OUT_OF_RANGE),
    ]


def test_broken_quote_rejects_only_that_row():
    result = run(row(), '"STU00002"x,' + row().split(",", 1)[1], row(student_id="STU00003"))
    assert problems(result) == [(3, None, ErrorCode.INVALID_FORMAT)]
    assert imported_ids(result) == ["STU00001", "STU00003"]


def test_all_problems_in_a_row_are_reported_but_row_counted_once():
    result = run(row(email="bad", maths="-5", section="Z"))
    assert result.rejected == 1
    assert len(result.problems) == 3


def test_duplicate_ids_are_case_insensitive_and_first_row_wins():
    result = run(row(), row(student_id="stu00001", full_name="Someone Else"))
    assert imported_ids(result) == ["STU00001"]
    assert problems(result) == [(3, "student_id", ErrorCode.DUPLICATE_ID)]
    assert "line 2" in result.problems[0].message


def test_duplicate_of_a_rejected_row_is_still_a_duplicate():
    result = run(row(maths="-5"), row())
    assert imported_ids(result) == []
    assert problems(result) == [
        (2, "maths", ErrorCode.OUT_OF_RANGE),
        (3, "student_id", ErrorCode.DUPLICATE_ID),
    ]


def test_duplicate_of_a_wrong_field_count_row_is_still_a_duplicate():
    result = run(row() + ",extra", row())
    assert imported_ids(result) == []
    assert problems(result)[1] == (3, "student_id", ErrorCode.DUPLICATE_ID)


def test_duplicate_with_other_problems_reports_everything():
    result = run(row(), row(email="bad"))
    assert problems(result) == [
        (3, "email", ErrorCode.INVALID_FORMAT),
        (3, "student_id", ErrorCode.DUPLICATE_ID),
    ]


def test_rows_without_an_id_are_not_duplicates_of_each_other():
    result = run(row(student_id=""), row(student_id=""))
    assert problems(result) == [
        (2, "student_id", ErrorCode.MISSING_REQUIRED),
        (3, "student_id", ErrorCode.MISSING_REQUIRED),
    ]


def test_extra_columns_do_not_affect_validation():
    result = run(row() + ",+91 98765 43210", header=HEADER + ",parent_phone")
    assert result.problems == []
    assert "parent_phone" not in result.valid_rows[0].data


def test_nul_character_rejects_only_its_cell():
    result = run(row(), row(student_id="STU00002", full_name="Ro\x00han Kaur"), row(student_id="STU00003"))
    assert problems(result) == [(3, "full_name", ErrorCode.INVALID_FORMAT)]
    assert imported_ids(result) == ["STU00001", "STU00003"]
