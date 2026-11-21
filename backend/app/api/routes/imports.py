from typing import Annotated

from fastapi import APIRouter, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import SessionDep, TodayDep
from app.errors import AppError
from app.importer.parser import FileError, FileErrorCode
from app.importer.report import problems_csv, report_filename
from app.importer.service import ImportFailed, run_import
from app.models import Import, ImportProblem
from app.schemas import ImportResult, ImportSummary, Page, ProblemOut

router = APIRouter(prefix="/api/imports", tags=["imports"])

FIRST_PAGE_SIZE = 50


@router.post("", status_code=201)
def create_import(file: UploadFile, session: SessionDep, today: TodayDep) -> ImportResult:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)  # one byte over is enough to know it's too big
    filename = (file.filename or "upload.csv")[:255]
    try:
        record = run_import(session, filename=filename, data=data, today=today, max_bytes=max_bytes)
    except FileError as error:
        status = 413 if error.code == FileErrorCode.FILE_TOO_LARGE else 400
        raise AppError(status, error.code, error.message) from error
    except ImportFailed as error:
        raise AppError(500, "IMPORT_FAILED", "The file was checked but could not be saved, so nothing was imported. Please try again.") from error
    return ImportResult(
        summary=ImportSummary.model_validate(record),
        problems=_problem_page(session, record.id, page=1, page_size=FIRST_PAGE_SIZE),
    )


@router.get("")
def list_imports(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[ImportSummary]:
    """Past imports, newest first (failed ones included, with their reason)."""
    total = session.scalar(select(func.count()).select_from(Import)) or 0
    records = session.scalars(
        select(Import).order_by(Import.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return Page(
        items=[ImportSummary.model_validate(r) for r in records], total=total, page=page, page_size=page_size
    )


@router.get("/{import_id}/problems.csv", response_class=Response)
def download_problems(import_id: int, session: SessionDep) -> Response:
    """Every problem of one import as a CSV the administrator can open in Excel."""
    record = _get_or_404(session, import_id)
    problems = session.scalars(
        select(ImportProblem)
        .where(ImportProblem.import_id == import_id)
        .order_by(ImportProblem.line, ImportProblem.id)
    )
    return Response(
        content=problems_csv(problems),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{report_filename(record.filename)}"'},
    )


@router.get("/{import_id}")
def get_import(import_id: int, session: SessionDep) -> ImportSummary:
    return ImportSummary.model_validate(_get_or_404(session, import_id))


@router.get("/{import_id}/problems")
def list_problems(
    import_id: int,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = FIRST_PAGE_SIZE,
) -> Page[ProblemOut]:
    _get_or_404(session, import_id)
    return _problem_page(session, import_id, page=page, page_size=page_size)


def _get_or_404(session: Session, import_id: int) -> Import:
    record = session.get(Import, import_id)
    if record is None:
        raise AppError(404, "IMPORT_NOT_FOUND", f"There is no import with ID {import_id}.")
    return record


def _problem_page(session: Session, import_id: int, *, page: int, page_size: int) -> Page[ProblemOut]:
    where = ImportProblem.import_id == import_id
    total = session.scalar(select(func.count()).select_from(ImportProblem).where(where)) or 0
    rows = session.scalars(
        select(ImportProblem)
        .where(where)
        .order_by(ImportProblem.line, ImportProblem.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return Page(
        items=[ProblemOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
