"""Response shapes for the imports API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Page


class ImportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    file_size: int
    status: str
    file_error_code: str | None
    file_error: str | None
    rows_read: int
    imported: int
    new: int
    updated: int
    unchanged: int
    rejected: int
    extra_columns: list[str]
    started_at: datetime
    finished_at: datetime | None


class ProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line: int
    student_id: str
    field: str | None
    code: str
    message: str
    raw_value: str | None


class ImportResult(BaseModel):
    summary: ImportSummary
    problems: Page[ProblemOut]  # first page; more via /api/imports/{id}/problems
