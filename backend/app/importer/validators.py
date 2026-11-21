"""Per-column validation for student CSV rows.

Every validator takes the raw cell text and either returns the cleaned value or
raises ``FieldError``. The order of checks is always the same:

1. empty after trimming        -> MISSING_REQUIRED
2. strict pattern check        -> INVALID_FORMAT
3. convert, then range check   -> OUT_OF_RANGE

Patterns are checked *before* converting because Python's converters are too
forgiving for this data: ``float("1e3")`` is 1000, ``float("nan")`` is NaN and
``int("٣")`` is 3. All digit patterns use ``[0-9]`` (ASCII only), never ``\\d``.
"""

import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum


class ErrorCode(StrEnum):
    MISSING_REQUIRED = "MISSING_REQUIRED"
    INVALID_FORMAT = "INVALID_FORMAT"
    OUT_OF_RANGE = "OUT_OF_RANGE"
    DUPLICATE_ID = "DUPLICATE_ID"
    WRONG_FIELD_COUNT = "WRONG_FIELD_COUNT"


class FieldError(Exception):
    def __init__(self, code: ErrorCode, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class FieldIssue:
    """One problem with one cell, ready to show to an administrator."""

    field: str
    code: ErrorCode
    message: str
    raw_value: str


MARK_FIELDS = ("maths", "science", "english", "social_studies", "second_language")

REQUIRED_COLUMNS = (
    "student_id",
    "full_name",
    "email",
    "date_of_birth",
    "grade_level",
    "section",
    *MARK_FIELDS,
)

MIN_AGE, MAX_AGE = 5, 25
MIN_GRADE, MAX_GRADE = 1, 12
MIN_MARK, MAX_MARK = Decimal(0), Decimal(100)

_STUDENT_ID = re.compile(r"[A-Za-z0-9-]+")
_ISO_DATE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})")
_DMY_DATE = re.compile(r"([0-9]{2})/([0-9]{2})/([0-9]{4})")
_INTEGER = re.compile(r"-?[0-9]+")
_DECIMAL = re.compile(r"-?[0-9]+(?:\.[0-9]+)?")
_SECTION = re.compile(r"[A-Fa-f]")

# Practical email check: ASCII local part without leading, trailing or doubled
# dots; a domain of dot-separated labels that ends in a 2+ letter TLD.
_EMAIL_LOCAL_ATOM = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
_EMAIL_LABEL = r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?"
_EMAIL = re.compile(
    rf"{_EMAIL_LOCAL_ATOM}(?:\.{_EMAIL_LOCAL_ATOM})*@(?:{_EMAIL_LABEL}\.)+[A-Za-z]{{2,}}"
)

# Punctuation allowed in names besides letters and spaces. Includes the curly
# apostrophe that spreadsheets often substitute for a straight one.
_NAME_PUNCTUATION = frozenset("'’,.-")


def _show(raw: str, limit: int = 40) -> str:
    """Quote a raw value for an error message, shortening very long ones."""
    shown = raw if len(raw) <= limit else raw[: limit - 1] + "…"
    return f'"{shown}"'


def _require(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise FieldError(ErrorCode.MISSING_REQUIRED, "Required value is missing")
    return value


def validate_student_id(raw: str) -> str:
    value = _require(raw)
    if not (3 <= len(value) <= 20) or not _STUDENT_ID.fullmatch(value):
        raise FieldError(
            ErrorCode.INVALID_FORMAT,
            f"{_show(value)} is not a valid student ID: use 3 to 20 letters, digits or hyphens",
        )
    return value.upper()


def validate_full_name(raw: str) -> str:
    # NFC so "Zoë" typed as e + combining diaeresis counts as one character.
    value = " ".join(unicodedata.normalize("NFC", _require(raw)).split())
    if not (2 <= len(value) <= 100):
        raise FieldError(
            ErrorCode.INVALID_FORMAT,
            f"Name must be 2 to 100 characters long (it has {len(value)})",
        )
    has_letter = False
    for ch in value:
        category = unicodedata.category(ch)
        if category.startswith("L"):
            has_letter = True
        # Combining marks (M*) are part of letters in many scripts,
        # e.g. Devanagari vowel signs in "प्रिया".
        elif not (category.startswith("M") or ch == " " or ch in _NAME_PUNCTUATION):
            raise FieldError(
                ErrorCode.INVALID_FORMAT,
                f"{_show(value)} contains characters not allowed in a name "
                "(only letters, spaces, apostrophes, commas, full stops and hyphens)",
            )
    if not has_letter:
        raise FieldError(ErrorCode.INVALID_FORMAT, f"{_show(value)} does not contain any letters")
    return value


def validate_email(raw: str) -> str:
    value = _require(raw)
    local, _, _ = value.partition("@")
    if len(value) > 254 or len(local) > 64 or not _EMAIL.fullmatch(value):
        raise FieldError(ErrorCode.INVALID_FORMAT, f"{_show(value)} is not a valid email address")
    return value.lower()


def age_on(born: date, today: date) -> int:
    """Age in whole years on ``today`` (birthday not yet reached -> one less)."""
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def validate_date_of_birth(raw: str, today: date) -> date:
    value = _require(raw)
    if match := _ISO_DATE.fullmatch(value):
        year, month, day = match.groups()
    elif match := _DMY_DATE.fullmatch(value):
        day, month, year = match.groups()
    else:
        raise FieldError(
            ErrorCode.INVALID_FORMAT,
            f"{_show(value)} is not a date in YYYY-MM-DD or DD/MM/YYYY format",
        )
    try:
        born = date(int(year), int(month), int(day))
    except ValueError:
        raise FieldError(ErrorCode.INVALID_FORMAT, f"{_show(value)} is not a real date") from None

    if born > today:
        raise FieldError(ErrorCode.OUT_OF_RANGE, f"{value} is in the future")
    age = age_on(born, today)
    if not (MIN_AGE <= age <= MAX_AGE):
        raise FieldError(
            ErrorCode.OUT_OF_RANGE,
            f"{value} makes the student {age} years old; students must be {MIN_AGE} to {MAX_AGE}",
        )
    return born


def validate_grade_level(raw: str) -> int:
    value = _require(raw)
    if not _INTEGER.fullmatch(value):
        raise FieldError(
            ErrorCode.INVALID_FORMAT,
            f"{_show(value)} is not a whole number (use {MIN_GRADE} to {MAX_GRADE})",
        )
    grade = int(value)
    if not (MIN_GRADE <= grade <= MAX_GRADE):
        raise FieldError(
            ErrorCode.OUT_OF_RANGE,
            f"{value} is outside the allowed range {MIN_GRADE} to {MAX_GRADE}",
        )
    return grade


def validate_section(raw: str) -> str:
    value = _require(raw)
    if not _SECTION.fullmatch(value):
        raise FieldError(
            ErrorCode.INVALID_FORMAT,
            f"{_show(value)} is not a valid section: use one letter from A to F",
        )
    return value.upper()


def validate_mark(raw: str) -> Decimal:
    value = _require(raw)
    if not _DECIMAL.fullmatch(value):
        raise FieldError(ErrorCode.INVALID_FORMAT, f"{_show(value)} is not a number")
    mark = Decimal(value)
    if not (MIN_MARK <= mark <= MAX_MARK):
        raise FieldError(
            ErrorCode.OUT_OF_RANGE,
            f"{value} is outside the allowed range {MIN_MARK} to {MAX_MARK}",
        )
    return mark + 0  # "+ 0" turns "-0" into plain 0


def validate_fields(raw: Mapping[str, str], today: date) -> tuple[dict, list[FieldIssue]]:
    """Validate every required column of one row.

    Returns the cleaned values and *all* problems found, so the administrator
    can fix a row in one go instead of discovering errors one at a time.
    ``raw`` must contain every name in ``REQUIRED_COLUMNS``.
    """
    validators = {
        "student_id": validate_student_id,
        "full_name": validate_full_name,
        "email": validate_email,
        "date_of_birth": lambda value: validate_date_of_birth(value, today),
        "grade_level": validate_grade_level,
        "section": validate_section,
        **{field: validate_mark for field in MARK_FIELDS},
    }
    clean: dict = {}
    issues: list[FieldIssue] = []
    for field, validate in validators.items():
        try:
            clean[field] = validate(raw[field])
        except FieldError as error:
            issues.append(FieldIssue(field, error.code, error.message, raw[field]))
    return clean, issues
