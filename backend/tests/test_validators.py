"""Column validator tests: one case per trap in PLAN.md's trap catalogue."""

from datetime import date
from decimal import Decimal

import pytest

from app.core.student_fields import REQUIRED_COLUMNS
from app.services.csv_import.validators import (
    ErrorCode,
    FieldError,
    validate_date_of_birth,
    validate_email,
    validate_fields,
    validate_full_name,
    validate_grade_level,
    validate_mark,
    validate_section,
    validate_student_id,
)

TODAY = date(2025, 6, 15)  # fixed so age checks never drift

MISSING = ErrorCode.MISSING_REQUIRED
FORMAT = ErrorCode.INVALID_FORMAT
RANGE = ErrorCode.OUT_OF_RANGE


def error_code(validate, raw, *args) -> ErrorCode:
    with pytest.raises(FieldError) as excinfo:
        validate(raw, *args)
    return excinfo.value.code


# --- student_id --------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("STU00001", "STU00001"),
        ("stu00022", "STU00022"),
        (" STU1 ", "STU1"),
        ("ABC", "ABC"),  # exactly 3
        ("A" * 20, "A" * 20),  # exactly 20
        ("stu-2024-01", "STU-2024-01"),
        ("00042", "00042"),  # leading zeros kept
    ],
)
def test_student_id_valid(raw, expected):
    assert validate_student_id(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        ("   ", MISSING),
        ("ST", FORMAT),
        ("A" * 21, FORMAT),
        ("STU 001", FORMAT),
        ("STU_001", FORMAT),
        ("STÜ001", FORMAT),  # ASCII letters only
        ("STU001​", FORMAT),  # zero-width space
    ],
)
def test_student_id_invalid(raw, code):
    assert error_code(validate_student_id, raw) == code


# --- full_name ---------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Rohan Kaur", "Rohan Kaur"),
        ("   Siddharth   Bose ", "Siddharth Bose"),
        ("Siddharth\tBose", "Siddharth Bose"),
        ("Siddharth Bose", "Siddharth Bose"),  # non-breaking space
        ("Bjørn Nair", "Bjørn Nair"),
        ("Anaïs Fernandes", "Anaïs Fernandes"),
        ("Zoë D'Souza", "Zoë D'Souza"),  # decomposed ë normalised
        ("Kaur, Reyansh", "Kaur, Reyansh"),
        ("O’Brien Shah", "O’Brien Shah"),  # curly apostrophe
        ("Mary-Jane Rao", "Mary-Jane Rao"),
        ("A. Kumar", "A. Kumar"),
        ("प्रिया शर्मा", "प्रिया शर्मा"),  # Devanagari with combining vowel signs
        ("Li", "Li"),  # exactly 2
        ("A" * 100, "A" * 100),  # exactly 100
    ],
)
def test_full_name_valid(raw, expected):
    assert validate_full_name(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        ("  ", MISSING),
        ("A", FORMAT),
        ("A" * 101, FORMAT),
        ("R2D2 Rao", FORMAT),
        ("Rohan 😀", FORMAT),
        ("''", FORMAT),  # punctuation only
        (",,", FORMAT),
        ("Rohan@Kaur", FORMAT),
    ],
)
def test_full_name_invalid(raw, code):
    assert error_code(validate_full_name, raw) == code


# --- email -------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("rohan.kaur85@example.edu", "rohan.kaur85@example.edu"),
        ("ADITYA.PAWAR82@EXAMPLE.EDU", "aditya.pawar82@example.edu"),
        ("  kabir.das97@example.edu ", "kabir.das97@example.edu"),
        ("first.last+tag@sub.example.co.in", "first.last+tag@sub.example.co.in"),
        ("o'brien@example.com", "o'brien@example.com"),
    ],
)
def test_email_valid(raw, expected):
    assert validate_email(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        ("sana@example", FORMAT),  # no TLD
        ("a@@b.com", FORMAT),
        ("a b@x.com", FORMAT),
        ("@x.com", FORMAT),
        ("a@", FORMAT),
        ("a@x..com", FORMAT),
        ("a@x.com.", FORMAT),
        (".a@x.com", FORMAT),
        ("a..b@x.com", FORMAT),
        ("a@-x.com", FORMAT),
        ("a@x.c", FORMAT),  # 1-letter TLD
        ("rohan.example.edu", FORMAT),
        ("ü@example.com", FORMAT),  # ASCII only
        ("a" * 65 + "@x.com", FORMAT),
    ],
)
def test_email_invalid(raw, code):
    assert error_code(validate_email, raw) == code


# --- date_of_birth (TODAY = 2025-06-15) ---------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("2012-04-20", date(2012, 4, 20)),
        ("20/04/2012", date(2012, 4, 20)),
        (" 2012-04-20 ", date(2012, 4, 20)),
        ("29/02/2012", date(2012, 2, 29)),  # leap year
        ("01/02/2012", date(2012, 2, 1)),  # DD/MM, not MM/DD
        ("2020-06-15", date(2020, 6, 15)),  # turns 5 today
        ("2000-06-16", date(2000, 6, 16)),  # 24, turns 25 tomorrow
        ("2000-06-15", date(2000, 6, 15)),  # turns 25 today
        ("1999-06-16", date(1999, 6, 16)),  # 25, turns 26 tomorrow
    ],
)
def test_date_of_birth_valid(raw, expected):
    assert validate_date_of_birth(raw, TODAY) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        ("31/02/2012", FORMAT),  # not a real date
        ("2013-02-29", FORMAT),  # not a leap year
        ("31/04/2012", FORMAT),
        ("00/01/2012", FORMAT),
        ("2012-13-01", FORMAT),
        ("11-30-2010", FORMAT),  # MM-DD-YYYY
        ("14.03.2011", FORMAT),
        ("2012/04/20", FORMAT),
        ("2012-4-5", FORMAT),
        ("20/4/2012", FORMAT),
        ("12/04/12", FORMAT),  # 2-digit year
        ("2012-04-20T00:00", FORMAT),
        ("41000", FORMAT),  # Excel serial number
        ("tomorrow", FORMAT),
        ("٢٠١٢-٠٤-٢٠", FORMAT),  # Arabic-Indic digits
        ("2020-06-16", RANGE),  # 4, turns 5 tomorrow
        ("1999-06-15", RANGE),  # turns 26 today
        ("1970-01-01", RANGE),
        ("2025-06-16", RANGE),  # tomorrow
        ("2030-01-01", RANGE),  # future
    ],
)
def test_date_of_birth_invalid(raw, code):
    assert error_code(validate_date_of_birth, raw, TODAY) == code


def test_feb_29_birthday_counts_from_march_1_in_non_leap_years():
    born = "2020-02-29"
    assert error_code(validate_date_of_birth, born, date(2025, 2, 28)) == RANGE  # still 4
    assert validate_date_of_birth(born, date(2025, 3, 1)) == date(2020, 2, 29)  # now 5


# --- grade_level -------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [("9", 9), ("09", 9), (" 9 ", 9), ("1", 1), ("12", 12), ("012", 12)],
)
def test_grade_level_valid(raw, expected):
    assert validate_grade_level(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        ("0", RANGE),
        ("13", RANGE),
        ("-2", RANGE),
        ("IX", FORMAT),
        ("ten", FORMAT),
        ("9th", FORMAT),
        ("9.0", FORMAT),  # must be a whole-number string
        ("+9", FORMAT),
        ("９", FORMAT),  # full-width digit
        ("٩", FORMAT),  # Arabic-Indic digit
    ],
)
def test_grade_level_invalid(raw, code):
    assert error_code(validate_grade_level, raw) == code


# --- section -----------------------------------------------------------------


@pytest.mark.parametrize("raw, expected", [("A", "A"), ("a", "A"), ("  f ", "F"), ("e", "E")])
def test_section_valid(raw, expected):
    assert validate_section(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [("", MISSING), (" ", MISSING), ("Z", FORMAT), ("G", FORMAT), ("AB", FORMAT), ("1", FORMAT)],
)
def test_section_invalid(raw, code):
    assert error_code(validate_section, raw) == code


# --- marks -------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("0", Decimal("0")),
        ("100", Decimal("100")),
        ("100.0", Decimal("100.0")),
        ("58.0", Decimal("58.0")),
        ("41.25", Decimal("41.25")),
        ("  41 ", Decimal("41")),
        ("85.125", Decimal("85.125")),  # no rounding
        ("-0", Decimal("0")),
    ],
)
def test_mark_valid(raw, expected):
    assert validate_mark(raw) == expected


@pytest.mark.parametrize(
    "raw, code",
    [
        ("", MISSING),
        (" ", MISSING),
        ("-5", RANGE),
        ("-0.1", RANGE),
        ("100.01", RANGE),
        ("105", RANGE),
        ("1e3", FORMAT),
        ("82/100", FORMAT),
        ("85%", FORMAT),
        ("1,5", FORMAT),
        ("N/A", FORMAT),
        ("eighty", FORMAT),
        ("abc", FORMAT),
        ("NaN", FORMAT),
        ("inf", FORMAT),
        (".5", FORMAT),
        ("5.", FORMAT),
        ("٨٥", FORMAT),  # Arabic-Indic digits
    ],
)
def test_mark_invalid(raw, code):
    assert error_code(validate_mark, raw) == code


# --- messages ----------------------------------------------------------------


def test_messages_are_readable_and_include_the_value():
    with pytest.raises(FieldError) as excinfo:
        validate_mark("105")
    assert excinfo.value.message == "105 is outside the allowed range 0 to 100"

    with pytest.raises(FieldError) as excinfo:
        validate_email("sana@example")
    assert excinfo.value.message == '"sana@example" is not a valid email address'


def test_long_values_are_shortened_in_messages():
    with pytest.raises(FieldError) as excinfo:
        validate_mark("x" * 500)
    assert len(excinfo.value.message) < 80


# --- whole row ---------------------------------------------------------------

VALID_ROW = {
    "student_id": "stu00001",
    "full_name": " Rohan  Kaur ",
    "email": "Rohan.Kaur@Example.edu",
    "date_of_birth": "20/04/2012",
    "grade_level": "09",
    "section": "d",
    "maths": "43",
    "science": "34.5",
    "english": "42",
    "social_studies": "51.7",
    "second_language": "40",
}


def test_validate_fields_cleans_a_valid_row():
    clean, issues = validate_fields(VALID_ROW, TODAY)

    assert issues == []
    assert clean == {
        "student_id": "STU00001",
        "full_name": "Rohan Kaur",
        "email": "rohan.kaur@example.edu",
        "date_of_birth": date(2012, 4, 20),
        "grade_level": 9,
        "section": "D",
        "maths": Decimal("43"),
        "science": Decimal("34.5"),
        "english": Decimal("42"),
        "social_studies": Decimal("51.7"),
        "second_language": Decimal("40"),
    }
    assert set(clean) == set(REQUIRED_COLUMNS)


def test_validate_fields_reports_every_problem_in_a_row():
    row = VALID_ROW | {"email": "sana@example", "maths": "-5", "science": "", "section": "Z"}

    _, issues = validate_fields(row, TODAY)

    assert [(i.field, i.code) for i in issues] == [
        ("email", FORMAT),
        ("section", FORMAT),
        ("maths", RANGE),
        ("science", MISSING),
    ]
    assert issues[0].raw_value == "sana@example"
