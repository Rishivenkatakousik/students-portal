"""SQL for imports and their problems. Never commits: the caller owns the transaction."""

from collections.abc import Sequence

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.models import Import, ImportProblem
from app.services.csv_import.pipeline import RowProblem


def get_import(session: Session, import_id: int) -> Import | None:
    return session.get(Import, import_id)


def list_imports(session: Session, *, page: int, page_size: int) -> tuple[Sequence[Import], int]:
    """One page of imports, newest first, and the total number of imports."""
    total = session.scalar(select(func.count()).select_from(Import)) or 0
    records = session.scalars(
        select(Import).order_by(Import.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return records, total


def problem_page(
    session: Session, import_id: int, *, page: int, page_size: int
) -> tuple[Sequence[ImportProblem], int]:
    """One page of an import's problems in line order, and the total number of problems."""
    where = ImportProblem.import_id == import_id
    total = session.scalar(select(func.count()).select_from(ImportProblem).where(where)) or 0
    rows = session.scalars(
        select(ImportProblem)
        .where(where)
        .order_by(ImportProblem.line, ImportProblem.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return rows, total


def all_problems(session: Session, import_id: int) -> Sequence[ImportProblem]:
    return session.scalars(
        select(ImportProblem)
        .where(ImportProblem.import_id == import_id)
        .order_by(ImportProblem.line, ImportProblem.id)
    ).all()


def insert_problems(session: Session, import_id: int, problems: list[RowProblem]) -> None:
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
