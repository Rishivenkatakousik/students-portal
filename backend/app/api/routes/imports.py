from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import PageNumber, SessionDep, TodayDep
from app.core.config import settings
from app.core.errors import AppError
from app.models import Import
from app.repositories import imports as imports_repo
from app.schemas.common import Page
from app.schemas.imports import ImportLimits, ImportResult, ImportSummary, ProblemOut
from app.services.csv_import.parser import FileError, FileErrorCode
from app.services.csv_import.report import problems_csv, report_filename
from app.services.imports import ImportFailed, run_import

router = APIRouter(prefix="/api/imports", tags=["imports"])

FIRST_PAGE_SIZE = 50

# imports.id is a 32-bit integer; anything larger is a 422, not a 500.
ImportId = Annotated[int, Path(ge=1, le=2_147_483_647)]


@router.post("", status_code=201)
def create_import(file: UploadFile, session: SessionDep, today: TodayDep) -> ImportResult:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)  # one byte over is enough to know it's too big
    # Postgres cannot store NUL, so a NUL in the name would make even the failure unrecordable.
    filename = (file.filename or "").replace("\x00", "")[:255] or "upload.csv"
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
    page: PageNumber = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[ImportSummary]:
    """Past imports, newest first (failed ones included, with their reason)."""
    records, total = imports_repo.list_imports(session, page=page, page_size=page_size)
    return Page(
        items=[ImportSummary.model_validate(r) for r in records], total=total, page=page, page_size=page_size
    )


@router.get("/limits")
def import_limits() -> ImportLimits:
    """The upload limit, so the browser can refuse a too-large file before sending it."""
    return ImportLimits(max_upload_mb=settings.max_upload_mb)


@router.get("/{import_id}/problems.csv", response_class=Response)
def download_problems(import_id: ImportId, session: SessionDep) -> Response:
    """Every problem of one import as a CSV the administrator can open in Excel."""
    record = _get_or_404(session, import_id)
    problems = imports_repo.all_problems(session, import_id)
    return Response(
        content=problems_csv(problems),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{report_filename(record.filename)}"'},
    )


@router.get("/{import_id}")
def get_import(import_id: ImportId, session: SessionDep) -> ImportSummary:
    return ImportSummary.model_validate(_get_or_404(session, import_id))


@router.get("/{import_id}/problems")
def list_problems(
    import_id: ImportId,
    session: SessionDep,
    page: PageNumber = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = FIRST_PAGE_SIZE,
) -> Page[ProblemOut]:
    _get_or_404(session, import_id)
    return _problem_page(session, import_id, page=page, page_size=page_size)


def _get_or_404(session: Session, import_id: int) -> Import:
    record = imports_repo.get_import(session, import_id)
    if record is None:
        raise AppError(404, "IMPORT_NOT_FOUND", f"There is no import with ID {import_id}.")
    return record


def _problem_page(session: Session, import_id: int, *, page: int, page_size: int) -> Page[ProblemOut]:
    rows, total = imports_repo.problem_page(session, import_id, page=page, page_size=page_size)
    return Page(
        items=[ProblemOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
