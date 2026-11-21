"""File-level and header checks: problems that reject the whole file."""

import codecs

import pytest

from app.services.csv_import.parser import FileError, FileErrorCode, parse_csv
from tests.helpers import HEADER, row

LIMIT = 1024 * 1024


def parse(text: str, encoding: str = "utf-8"):
    return parse_csv(text.encode(encoding), LIMIT)


def file_error(data: bytes) -> FileError:
    with pytest.raises(FileError) as excinfo:
        parse_csv(data, LIMIT)
    return excinfo.value


# --- file / encoding ---------------------------------------------------------


@pytest.mark.parametrize(
    "data",
    [b"", codecs.BOM_UTF8, b"\n\n  \r\n", b",,,\n,,\n"],
    ids=["zero-bytes", "only-bom", "blank-lines", "only-commas"],
)
def test_empty_files_are_rejected(data):
    assert file_error(data).code == FileErrorCode.EMPTY_FILE


@pytest.mark.parametrize("text", [HEADER, HEADER + "\n", HEADER + "\n\n,,,,\n  \n"])
def test_header_without_student_rows_is_rejected(text):
    assert file_error(text.encode()).code == FileErrorCode.NO_DATA_ROWS


def test_file_over_the_size_limit_is_rejected():
    error = file_error(b"x" * (LIMIT + 1))
    assert error.code == FileErrorCode.FILE_TOO_LARGE
    assert "1 MB" in error.message


def test_latin1_file_is_rejected_with_line_number():
    data = f"{HEADER}\n{row()}\n{row(full_name='Müller Patel')}\n".encode("latin-1")
    error = file_error(data)
    assert error.code == FileErrorCode.NOT_UTF8
    assert "line 3" in error.message
    assert "CSV UTF-8" in error.message


@pytest.mark.parametrize("encoding", ["utf-16", "utf-16-le", "utf-16-be"])
def test_utf16_file_is_rejected(encoding):
    data = f"{HEADER}\n{row()}\n".encode(encoding)
    if encoding != "utf-16":  # the plain codec already writes a BOM
        data = (codecs.BOM_UTF16_LE if encoding.endswith("le") else codecs.BOM_UTF16_BE) + data
    assert file_error(data).code == FileErrorCode.NOT_UTF8


def test_binary_file_is_rejected():
    png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10"
    assert file_error(png).code == FileErrorCode.NOT_UTF8


def test_unclosed_quote_rejects_file_instead_of_swallowing_rows():
    text = f'{HEADER}\n{row()}\n{row(full_name='"Patel, Sahil')}\n{row(student_id="STU00003")}\n'
    error = file_error(text.encode())
    assert error.code == FileErrorCode.MALFORMED_CSV
    assert "Line 3" in error.message


def test_bom_and_crlf_are_handled():
    parsed = parse_csv(codecs.BOM_UTF8 + f"{HEADER}\r\n{row()}\r\n".encode(), LIMIT)
    assert parsed.columns["student_id"] == 0
    assert [r.fields[0] for r in parsed.records] == ["STU00001"]


def test_mixed_line_endings_keep_line_numbers_right():
    text = f"{HEADER}\r\n{row()}\n\r{row(student_id='STU00002')}\r{row(student_id='STU00003')}\r\n"
    parsed = parse(text)
    assert [(r.line, r.fields[0]) for r in parsed.records] == [
        (2, "STU00001"),
        (4, "STU00002"),
        (5, "STU00003"),
    ]


# --- header ------------------------------------------------------------------


def test_header_order_case_spaces_and_quotes_do_not_matter():
    columns = HEADER.split(",")
    shuffled = [f'" {c.upper()} "' if i % 2 else f"  {c.title()}" for i, c in enumerate(reversed(columns))]
    parsed = parse(",".join(shuffled) + "\n" + ",".join(f"v{i}" for i in range(len(columns))) + "\n")

    assert parsed.columns["second_language"] == 0
    assert parsed.columns["student_id"] == len(columns) - 1
    assert parsed.extra_columns == []


def test_extra_columns_are_ignored_and_listed():
    parsed = parse(f"{HEADER},parent_phone, Remarks ,\n{row()},+91 98,ok,\n")
    assert parsed.extra_columns == ["parent_phone", "Remarks"]  # empty trailing name dropped
    assert parsed.header_width == 14


def test_missing_columns_are_named():
    header = HEADER.replace("email,", "").replace(",section", "")
    error = file_error(f"{header}\n{row()}\n".encode())
    assert error.code == FileErrorCode.MISSING_COLUMNS
    assert "email, section" in error.message


@pytest.mark.parametrize("separator, name", [(";", "semicolons"), ("\t", "tabs"), ("|", "vertical bars")])
def test_other_separators_are_named(separator, name):
    error = file_error((HEADER.replace(",", separator) + "\n" + row().replace(",", separator)).encode())
    assert error.code == FileErrorCode.MISSING_COLUMNS
    assert f"separated by {name}" in error.message


def test_unrelated_file_is_called_out_not_blamed_on_separators():
    error = file_error(b"# Meeting notes | Monday\nAgenda: results, timetable\n")
    assert error.code == FileErrorCode.MISSING_COLUMNS
    assert error.message.startswith("This doesn't look like a student results file")
    assert "separated" not in error.message


def test_duplicate_column_is_rejected():
    error = file_error(f"{HEADER},Maths\n{row()},50\n".encode())
    assert error.code == FileErrorCode.DUPLICATE_COLUMNS
    assert "maths" in error.message


def test_doubled_quotes_inside_quoted_value_are_unescaped():
    parsed = parse(f'{HEADER}\n{row(full_name='"Say ""hi"""')}\n')
    assert parsed.records[0].fields[1] == 'Say "hi"'


def test_leading_blank_lines_before_header_are_skipped_but_counted():
    parsed = parse(f"\n\n{HEADER}\n{row()}\n")
    assert parsed.records[0].line == 4


def test_utf16_without_byte_order_mark_is_rejected():
    error = file_error(f"{HEADER}\r\n{row()}\r\n".encode("utf-16-le"))
    assert error.code == FileErrorCode.NOT_UTF8
    assert "UTF-16" in error.message


def test_unclosed_quote_closed_by_a_later_quote_rejects_file_instead_of_dropping_rows():
    # Line 3's quote is closed by line 6's quoted name, so lines 3-6 read as one
    # record; reporting it as one bad row would silently lose lines 4 and 5.
    lines = [
        row(),
        row(student_id="STU00002", full_name='"Patel'),
        row(student_id="STU00003"),
        row(student_id="STU00004"),
        row(student_id="STU00005", full_name='"Singh, Aarav"'),
        row(student_id="STU00006"),
    ]
    error = file_error(("\n".join([HEADER, *lines]) + "\n").encode())
    assert error.code == FileErrorCode.MALFORMED_CSV
    assert "lines 3 to 6" in error.message


def test_unclosed_quote_giving_the_wrong_field_count_rejects_file():
    # The stray quote closes cleanly at the end of line 5's email, so csv raises
    # nothing; the swallowed record just has the wrong number of fields.
    lines = [
        row(),
        row(student_id="STU00002", full_name='"Patel'),
        row(student_id="STU00003"),
        row(student_id="STU00004", email='rohan@example.edu"'),
        row(student_id="STU00005"),
    ]
    error = file_error(("\n".join([HEADER, *lines]) + "\n").encode())
    assert error.code == FileErrorCode.MALFORMED_CSV
    assert "lines 3 to 5" in error.message


@pytest.mark.parametrize(
    "data",
    [
        b'{"students": [{"id": "T10-001", "name": "Asha"}]}\n',
        f'{HEADER.replace("full_name", '"full_name"x')}\n{row()}\n'.encode(),
    ],
    ids=["json", "stray-quote-in-header"],
)
def test_unreadable_header_is_named_not_called_empty(data):
    error = file_error(data)
    assert error.code == FileErrorCode.MALFORMED_CSV
    assert error.message.startswith("Line 1 should be the header row")
