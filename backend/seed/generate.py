"""Generate a realistic, deliberately messy student CSV, and optionally load it.

    python -m seed.generate --rows 5000 --upload http://localhost:8080

Each row knows whether it should be accepted, so expected counts are printed (and checked
against the portal with --upload). IDs are GEN00001..., so real students are never overwritten.
"""

import argparse
import csv
import io
import random
import re
import sys
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from faker import Faker

from app.core.student_fields import MARK_FIELDS, REQUIRED_COLUMNS

SECTIONS = "ABCDEF"
DEFAULT_ID_PREFIX = "GEN"
EXTRA_COLUMN = "parent_phone"
UNICODE_NAMES = ["Zoë", "Bjørn", "Anaïs", "Søren", "Renée", "José", "Chloé"]
APOSTROPHE_SURNAMES = ["D'Souza", "O'Brien", "D'Costa", "D'Mello"]


@dataclass
class Row:
    values: dict[str, str]
    rejected_by: str | None = None  # name of the breaking mutation, if any
    shape: str = "normal"  # "short" / "long": wrong number of fields
    extra: dict[str, str] = field(default_factory=dict)


@dataclass
class Generated:
    text: str
    expected_read: int
    expected_imported: int
    expected_rejected: int
    rejected_lines: list[int]
    mutations: dict[str, int]  # breaking mutation name -> how many rows


# --- clean students ------------------------------------------------------------


def _email_local(first: str, last: str, rng: random.Random) -> str:
    ascii_name = unicodedata.normalize("NFKD", f"{first}.{last}").encode("ascii", "ignore").decode()
    local = re.sub(r"[^a-z0-9.]", "", ascii_name.lower()).strip(".") or "student"
    return f"{re.sub(r'\.{2,}', '.', local)}{rng.randint(10, 99)}"


def _birth_date(grade: int, today: date, rng: random.Random) -> date:
    # Age grade+5 (class 1 is about six years old), well inside the 5-25 rule.
    age = grade + 5
    latest = date(today.year - age, today.month, min(today.day, 28)) - timedelta(days=15)
    return latest - timedelta(days=rng.randint(0, 330))


def _mark(ability: float, rng: random.Random) -> str:
    value = min(100.0, max(0.0, rng.gauss(ability, 12)))
    return f"{value:.1f}" if rng.random() < 0.3 else str(round(value))


def clean_student(index: int, fake: Faker, rng: random.Random, today: date, id_prefix: str) -> Row:
    first, last = fake.first_name(), fake.last_name()
    grade = rng.randint(1, 12)
    ability = rng.gauss(62, 14)
    values = {
        "student_id": f"{id_prefix}{index:05d}",
        "full_name": f"{first} {last}",
        "email": f"{_email_local(first, last, rng)}@example.edu",
        "date_of_birth": _birth_date(grade, today, rng).isoformat(),
        "grade_level": str(grade),
        "section": rng.choice(SECTIONS),
        **{subject: _mark(ability, rng) for subject in MARK_FIELDS},
    }
    return Row(values, extra={EXTRA_COLUMN: f"+91 9{rng.randint(100000000, 999999999)}"})


# --- harmless mess (row must still import) --------------------------------------


def _pad(row: Row, rng: random.Random) -> None:
    key = rng.choice([k for k in REQUIRED_COLUMNS if k != "full_name"])
    row.values[key] = f"  {row.values[key]} "


def _dmy_date(row: Row, rng: random.Random) -> None:
    year, month, day = row.values["date_of_birth"].split("-")
    row.values["date_of_birth"] = f"{day}/{month}/{year}"


def _quoted_comma_name(row: Row, rng: random.Random) -> None:
    first, _, last = row.values["full_name"].partition(" ")
    row.values["full_name"] = f"{last}, {first}"


HARMLESS: list[Callable[[Row, random.Random], None]] = [
    _pad,
    _dmy_date,
    _quoted_comma_name,
    lambda r, g: r.values.update(student_id=r.values["student_id"].lower()),
    lambda r, g: r.values.update(section=r.values["section"].lower()),
    lambda r, g: r.values.update(email=r.values["email"].upper()),
    lambda r, g: r.values.update(grade_level=r.values["grade_level"].zfill(2)),
    lambda r, g: r.values.update(maths=f"{float(r.values['maths']):.1f}"),
    lambda r, g: r.values.update(full_name=r.values["full_name"].replace(" ", "   ", 1)),
    lambda r, g: r.values.update(full_name=f"{g.choice(UNICODE_NAMES)} {r.values['full_name'].split()[-1]}"),
    lambda r, g: r.values.update(full_name=f"{r.values['full_name'].split()[0]} {g.choice(APOSTROPHE_SURNAMES)}"),
]


# --- breaking mess (row must be rejected) ---------------------------------------


def _set(column: str, *choices: str) -> Callable[[Row, random.Random, date], None]:
    def mutate(row: Row, rng: random.Random, today: date) -> None:
        row.values[column] = rng.choice(choices)

    return mutate


def _future_birth(row: Row, rng: random.Random, today: date) -> None:
    row.values["date_of_birth"] = (today + timedelta(days=rng.randint(1, 400))).isoformat()


def _bad_mark(*choices: str) -> Callable[[Row, random.Random, date], None]:
    def mutate(row: Row, rng: random.Random, today: date) -> None:
        row.values[rng.choice(MARK_FIELDS)] = rng.choice(choices)

    return mutate


BREAKING: dict[str, Callable[[Row, random.Random, date], None]] = {
    "bad email": _set("email", "sana@example", "not-an-email", "a@@example.edu", "riya @example.edu", "@example.edu"),
    "missing email": _set("email", "", "  "),
    "missing name": _set("full_name", "", " "),
    "name with digits": _set("full_name", "R2D2 Rao", "Rohan 2 Kaur", "Test123"),
    "impossible date": _set("date_of_birth", "31/02/2012", "2013-02-29", "31/04/2011", "2012-13-04"),
    "wrong date format": _set("date_of_birth", "11-30-2010", "14.03.2011", "2012/04/20", "tomorrow", "41000"),
    "too old": _set("date_of_birth", "1970-01-01", "1990-06-15", "15/08/1985"),
    "born in the future": _future_birth,
    "grade not a number": _set("grade_level", "IX", "ten", "9th", "9.0"),
    "grade out of range": _set("grade_level", "0", "13", "-2"),
    "bad section": _set("section", "Z", "G", "AB", "1"),
    "missing section": _set("section", ""),
    "mark out of range": _bad_mark("-5", "105", "100.5", "-0.5"),
    "mark not a number": _bad_mark("eighty", "N/A", "abc", "1e3", "82/100", "85%"),
    "missing mark": _bad_mark("", " "),
    "bad student id": _set("student_id", "ST", "STU 001X", "STU_00X", "A" * 21),
    "missing student id": _set("student_id", ""),
    "too few fields": lambda row, rng, today: setattr(row, "shape", "short"),
    "too many fields": lambda row, rng, today: setattr(row, "shape", "long"),
}


def _duplicate(row: Row, earlier: list[Row], rng: random.Random, id_prefix: str) -> bool:
    """Reuse an earlier row's ID (sometimes lower-cased); False if none fits.
    Wrong-field-count rows don't qualify: the importer can't tell which value is their ID."""
    candidates = [
        r
        for r in earlier
        if r.shape == "normal" and re.fullmatch(rf"\s*{re.escape(id_prefix)}\d{{5}}\s*", r.values["student_id"], re.I)
    ]
    if not candidates:
        return False
    original = rng.choice(candidates).values["student_id"].strip()
    row.values["student_id"] = original.lower() if rng.random() < 0.5 else original
    return True


# --- assembling the file --------------------------------------------------------


def generate(
    rows: int, error_rate: float, seed: int, today: date, id_prefix: str = DEFAULT_ID_PREFIX
) -> Generated:
    rng = random.Random(seed)
    fake = Faker("en_IN")
    fake.seed_instance(seed)

    students: list[Row] = []
    mutations: dict[str, int] = {}
    for i in range(1, rows + 1):
        row = clean_student(i, fake, rng, today, id_prefix)
        if rng.random() < 0.15:
            rng.choice(HARMLESS)(row, rng)
        if rng.random() < error_rate:
            if rng.random() < 0.12 and _duplicate(row, students, rng, id_prefix):
                row.rejected_by = "duplicate id"
            else:
                row.rejected_by = rng.choice(list(BREAKING))
                BREAKING[row.rejected_by](row, rng, today)
            mutations[row.rejected_by] = mutations.get(row.rejected_by, 0) + 1
        students.append(row)

    # File-level mess: shuffled columns, an extra column, Windows line endings.
    columns = [*REQUIRED_COLUMNS, EXTRA_COLUMN]
    rng.shuffle(columns)
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow([c.upper() if rng.random() < 0.2 else c for c in columns])
    line = 1
    rejected_lines: list[int] = []
    for row in students:
        # Blank lines are skipped by the importer but still count for line numbers.
        while rng.random() < 0.003:
            out.write(rng.choice(["\r\n", "," * (len(columns) - 1) + "\r\n", " \r\n"]))
            line += 1
        fields = [row.values.get(c, row.extra.get(c, "")) for c in columns]
        if row.shape == "short":
            fields = fields[:-1]
        elif row.shape == "long":
            fields = [*fields, "extra"]
        writer.writerow(fields)
        line += 1
        if row.rejected_by:
            rejected_lines.append(line)

    rejected = len(rejected_lines)
    return Generated(
        text="﻿" + out.getvalue(),  # byte order mark, as Excel writes it
        expected_read=rows,
        expected_imported=rows - rejected,
        expected_rejected=rejected,
        rejected_lines=rejected_lines,
        mutations=dict(sorted(mutations.items(), key=lambda kv: -kv[1])),
    )


def upload(base_url: str, filename: str, content: bytes) -> dict:
    import httpx2  # only needed for --upload

    response = httpx2.post(
        f"{base_url.rstrip('/')}/api/imports",
        files={"file": (filename, content, "text/csv")},
        timeout=300,
    )
    body = response.json()
    if response.status_code != 201:
        raise SystemExit(f"Upload failed ({response.status_code}): {body.get('error', body)}")
    return body["summary"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--rows", type=int, default=5000, help="student rows to generate (default 5000)")
    parser.add_argument("--error-rate", type=float, default=0.07, help="share of rows to break (default 0.07)")
    parser.add_argument("--seed", type=int, default=42, help="random seed; same seed, same file (default 42)")
    parser.add_argument("--today", type=date.fromisoformat, default=date.today(), help="date ages are based on")
    parser.add_argument("--out", type=Path, default=Path("students_generated.csv"), help="where to write the CSV")
    parser.add_argument("--upload", metavar="URL", help="also import it, e.g. http://localhost:8080")
    parser.add_argument(
        "--id-prefix",
        default=DEFAULT_ID_PREFIX,
        help=f"student IDs are this plus a 5-digit number (default {DEFAULT_ID_PREFIX})",
    )
    args = parser.parse_args(argv)
    if args.rows < 1 or not 0 <= args.error_rate <= 1:
        parser.error("--rows must be at least 1 and --error-rate between 0 and 1")
    if not re.fullmatch(r"[A-Za-z0-9-]{1,15}", args.id_prefix):
        parser.error("--id-prefix must be 1 to 15 letters, digits or hyphens")

    result = generate(args.rows, args.error_rate, args.seed, args.today, args.id_prefix)
    content = result.text.encode("utf-8")
    args.out.write_bytes(content)
    print(f"Wrote {args.out} ({len(content) / 1024:.0f} KB)")
    print("Broken rows by kind: " + ", ".join(f"{name} {n}" for name, n in result.mutations.items()))
    expected = (result.expected_read, result.expected_imported, result.expected_rejected)
    print(f"Expected:  read {expected[0]:,}  imported {expected[1]:,}  rejected {expected[2]:,}")

    if args.upload:
        summary = upload(args.upload, args.out.name, content)
        actual = (summary["rows_read"], summary["imported"], summary["rejected"])
        print(
            f"Portal:    read {actual[0]:,}  imported {actual[1]:,}  rejected {actual[2]:,}"
            f"  ({summary['new']:,} new, {summary['updated']:,} updated, {summary['unchanged']:,} unchanged)"
        )
        if actual != expected:
            print("MISMATCH: the portal's counts differ from what the generator expected.", file=sys.stderr)
            return 1
        print("Match.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
