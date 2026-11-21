"""SQL for students: lookup, search and the bulk upsert. Never commits: the caller owns the transaction."""

from collections.abc import Sequence
from itertools import batched
from typing import Literal

from sqlalchemy import ColumnElement, func, literal_column, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.student_fields import MARK_FIELDS, REQUIRED_COLUMNS
from app.models import Student
from app.services import grading
from app.services.csv_import.pipeline import ValidRow

# 1,000 rows x 13 columns stays far below Postgres' 65,535 parameter limit.
BATCH_SIZE = 1000

SortKey = Literal[
    "student_id", "-student_id", "name", "-name", "class", "-class", "percentage", "-percentage"
]  # fmt: skip

# Same rounding as grading.round_percentage (Postgres rounds numeric half away
# from zero, which equals half-up for non-negative marks). Used only to sort;
# the numbers shown always come from grading.summarise.
_PERCENTAGE_SQL = func.round(
    sum((getattr(Student, m) for m in MARK_FIELDS), start=0) * 100 / grading.MAX_TOTAL, 1
)
_SORT_COLUMNS: dict[str, list[ColumnElement]] = {
    "student_id": [Student.student_id],
    "name": [func.lower(Student.full_name)],
    "class": [Student.grade_level, Student.section],
    "percentage": [_PERCENTAGE_SQL],
}


def _escape_like(text: str) -> str:
    """Make %, _ and \\ in user input match literally in LIKE patterns."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_student(session: Session, student_id: str) -> Student | None:
    return session.get(Student, student_id)


def search_students(
    session: Session,
    *,
    q: str | None,
    grade_level: int | None,
    section: str | None,
    sort: SortKey,
    page: int,
    page_size: int,
) -> tuple[Sequence[Student], int]:
    """One page of matching students in the requested order, and the total number of matches."""
    filters: list[ColumnElement[bool]] = []
    # Names are stored with single spaces, so search the same way.
    terms = " ".join((q or "").split())
    if terms:
        pattern = f"%{_escape_like(terms)}%"
        filters.append(
            or_(Student.full_name.ilike(pattern, escape="\\"), Student.student_id.ilike(pattern, escape="\\"))
        )
    if grade_level is not None:
        filters.append(Student.grade_level == grade_level)
    if section is not None:
        filters.append(Student.section == section.upper())

    descending = sort.startswith("-")
    order = [c.desc() if descending else c.asc() for c in _SORT_COLUMNS[sort.lstrip("-")]]
    # student_id last: a unique tiebreaker keeps pages stable, so no student
    # shows up on two pages or on none when many share a percentage.
    if sort.lstrip("-") != "student_id":
        order.append(Student.student_id.asc())

    total = session.scalar(select(func.count()).select_from(Student).where(*filters)) or 0
    students = session.scalars(
        select(Student).where(*filters).order_by(*order).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return students, total


def upsert_students(session: Session, rows: list[ValidRow], import_id: int) -> tuple[int, int]:
    """Insert new students, update changed ones, leave identical ones alone.

    Returns (new, updated). Rows are written in student_id order so that two
    imports running at once lock rows in the same order and cannot deadlock.
    """
    new = updated = 0
    ordered = sorted(rows, key=lambda r: r.data["student_id"])
    for batch in batched(ordered, BATCH_SIZE, strict=False):  # last batch may be shorter
        for inserted in _upsert_batch(session, [r.data | {"last_import_id": import_id} for r in batch]):
            if inserted:
                new += 1
            else:
                updated += 1
    return new, updated


def _upsert_batch(session: Session, values: list[dict]) -> list[bool]:
    stmt = pg_insert(Student).values(values)
    data_columns = [c for c in REQUIRED_COLUMNS if c != "student_id"]
    stmt = stmt.on_conflict_do_update(
        index_elements=[Student.student_id],
        set_={c: stmt.excluded[c] for c in [*data_columns, "last_import_id"]} | {"updated_at": func.now()},
        # Only touch rows whose data actually changed; identical rows return
        # nothing, which is how "unchanged" is counted.
        where=or_(*(getattr(Student, c).is_distinct_from(stmt.excluded[c]) for c in data_columns)),
    )
    # xmax = 0 only for a freshly inserted row version: True = new, False = updated.
    stmt = stmt.returning(literal_column("xmax = 0"))
    return list(session.execute(stmt).scalars())
