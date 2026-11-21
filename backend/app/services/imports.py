"""Run one import (parse, validate, save) in a single transaction: a failure saves nothing."""

import logging
from datetime import UTC, date, datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Import
from app.repositories import imports as imports_repo
from app.repositories import students as students_repo
from app.services.csv_import.parser import FileError, parse_csv
from app.services.csv_import.pipeline import process

logger = logging.getLogger(__name__)


class ImportFailed(Exception):
    """The file was fine but saving it failed; nothing was imported."""

    def __init__(self, import_id: int):
        super().__init__(f"Import {import_id} failed while saving")
        self.import_id = import_id


def run_import(session: Session, *, filename: str, data: bytes, today: date, max_bytes: int) -> Import:
    """Import one file and return its summary record.
    Raises ``FileError`` (unusable file) or ``ImportFailed`` (save failed); both are recorded."""
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
        record.new, record.updated = students_repo.upsert_students(session, result.valid_rows, record.id)
        record.unchanged = record.imported - record.new - record.updated
        imports_repo.insert_problems(session, record.id, result.problems)
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
