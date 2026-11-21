"""API response shapes."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


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


class StudentListItem(BaseModel):
    student_id: str
    full_name: str
    grade_level: int
    section: str
    percentage: float
    grade: str
    passed: bool


class SubjectMark(BaseModel):
    subject: str
    label: str
    mark: float
    passed: bool  # at or above the subject pass mark


class StudentReport(BaseModel):
    student_id: str
    full_name: str
    email: str
    date_of_birth: date
    age: int
    grade_level: int
    section: str
    marks: list[SubjectMark]
    total: float
    max_total: int
    percentage: float
    grade: str
    passed: bool
    failed_subjects: list[str]  # labels of subjects below the pass mark
    updated_at: datetime


class GradeBand(BaseModel):
    grade: str
    min_percentage: float


class GradingScheme(BaseModel):
    bands: list[GradeBand]
    pass_percentage: float
    subject_pass_mark: float
    max_total: int
