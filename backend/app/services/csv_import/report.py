"""The downloadable error report: one CSV row per problem, ready for Excel."""

import csv
import io
import re
from collections.abc import Iterable
from pathlib import PurePath

from app.models import ImportProblem

HEADER = ["row", "student_id", "column", "problem", "code", "value"]

_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
_PLAIN_NUMBER = re.compile(r"[+-]?[0-9]+(\.[0-9]+)?")


def spreadsheet_safe(value: str) -> str:
    """Prefix an apostrophe so a cell like =HYPERLINK(...) can't run in Excel (CSV injection).
    Plain numbers such as -5 are left as they are."""
    if value.startswith(_FORMULA_START) and not _PLAIN_NUMBER.fullmatch(value):
        return "'" + value
    return value


def problems_csv(problems: Iterable[ImportProblem]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(HEADER)
    for p in problems:
        writer.writerow(
            [
                p.line,
                spreadsheet_safe(p.student_id),
                p.field or "(whole row)",
                spreadsheet_safe(p.message),
                p.code,
                spreadsheet_safe(p.raw_value or ""),
            ]
        )
    # The byte order mark makes Excel read UTF-8 names like "Zoë" correctly.
    return "﻿" + out.getvalue()


def report_filename(uploaded_name: str) -> str:
    """students_sample.csv -> students_sample-problems.csv (safe for a header)."""
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", PurePath(uploaded_name).stem).strip("._") or "import"
    return f"{stem[:80]}-problems.csv"
