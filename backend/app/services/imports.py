"""Run one import end to end: parse, validate, save.

Everything an import writes (summary, students, problems) is committed in one
transaction, so a failure part-way never leaves half a file in the database.
"""

import logging
from datetime import UTC, date, datetime
from itertools import batched

from sqlalchemy import func, insert, literal_column, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.importer.parser import FileError, parse_csv
from app.importer.pipeline import RowProblem, ValidRow, process
from app.importer.validators import REQUIRED_COLUMNS
from app.models import Import, ImportProblem, Student

logger = logging.getLogger(__name__)

# 1,000 rows x 13 columns stays far below Postgres' 65,535 parameter limit.
BATCH_SIZE = 1000


class ImportFailed(Exception):
    """The file was fine but saving it failed; nothing was imported."""

    def __init__(self, import_id: int):
        super().__init__(f"Import {import_id} failed while saving")
        self.import_id = import_id


def run_import(session: Session, *, filename: str, data: bytes, today: date, max_bytes: int) -> Import:
    """Import one uploaded file and return its summary record.

    Raises ``FileError`` if the file as a whole is unusable, and ``ImportFailed``
    if the database rejects the save. Both are recorded as failed imports.
    """
    try:
        parsed = parse_csv(data, max_bytes)
    except FileError as error:
        _record_failure(session, filename, len(data), error.code, error.message)
        raise

    result = process(parsed, today)
    record = Import(
        filename=filename,
        file_size=len(data),
        status="completed",
        rows_read=result.rows_read,
        imported=len(result.valid_rows),
        rejected=result.rejected,
        extra_columns=parsed.extra_columns,
    )
    try:
        session.add(record)
        session.flush()  # assigns record.id
        record.new, record.updated = _upsert_students(session, result.valid_rows, record.id)
        record.unchanged = record.imported - record.new - record.updated
        _insert_problems(session, record.id, result.problems)
        record.finished_at = datetime.now(UTC)
        session.commit()
    except SQLAlchemyError as error:
        session.rollback()
        logger.exception("Import of %r failed while saving", filename)
        failed = _record_failure(
            session,
            filename,
            len(data),
            "DATABASE_ERROR",
            "The file was checked but could not be saved, so nothing was imported. Please try again.",
        )
        raise ImportFailed(failed.id) from error
    return record


def _record_failure(session: Session, filename: str, size: int, code: str, message: str) -> Import:
    record = Import(
        filename=filename,
        file_size=size,
        status="failed",
        file_error_code=code,
        file_error=message,
        extra_columns=[],
        finished_at=datetime.now(UTC),
    )
    session.add(record)
    session.commit()
    return record


def _upsert_students(session: Session, rows: list[ValidRow], import_id: int) -> tuple[int, int]:
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


def _insert_problems(session: Session, import_id: int, problems: list[RowProblem]) -> None:
    if not problems:
        return
    session.execute(
        insert(ImportProblem),
        [
            {
                "import_id": import_id,
                "line": p.line,
                "student_id": p.student_id,
                "field": p.field,
                "code": p.code.value,
                "message": p.message,
                "raw_value": p.raw_value,
            }
            for p in problems
        ],
    )
