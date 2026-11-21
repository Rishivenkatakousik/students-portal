from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import ColumnElement, func, or_, select

from app import grading
from app.deps import SessionDep, TodayDep
from app.errors import AppError
from app.importer.validators import MARK_FIELDS, age_on
from app.models import Student
from app.schemas import GradeBand, GradingScheme, Page, StudentListItem, StudentReport, SubjectMark

router = APIRouter(prefix="/api", tags=["students"])

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


@router.get("/students")
def list_students(
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=100, description="Part of a name or student ID")] = None,
    grade_level: Annotated[int | None, Query(ge=1, le=12)] = None,
    section: Annotated[str | None, Query(pattern="^[A-Fa-f]$")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    sort: SortKey = "student_id",
) -> Page[StudentListItem]:
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
    )
    return Page(items=[_list_item(s) for s in students], total=total, page=page, page_size=page_size)


@router.get("/students/{student_id}")
def get_student(student_id: str, session: SessionDep, today: TodayDep) -> StudentReport:
    student = session.get(Student, student_id.strip().upper())
    if student is None:
        raise AppError(404, "STUDENT_NOT_FOUND", f'There is no student with ID "{student_id}".')
    result = grading.summarise(_marks(student))
    return StudentReport(
        student_id=student.student_id,
        full_name=student.full_name,
        email=student.email,
        date_of_birth=student.date_of_birth,
        age=age_on(student.date_of_birth, today),
        grade_level=student.grade_level,
        section=student.section,
        marks=[
            SubjectMark(
                subject=subject,
                label=grading.SUBJECT_LABELS[subject],
                mark=float(mark),
                passed=mark >= grading.SUBJECT_PASS_MARK,
            )
            for subject, mark in _marks(student).items()
        ],
        total=float(result.total),
        max_total=int(grading.MAX_TOTAL),
        percentage=float(result.percentage),
        grade=result.grade,
        passed=result.passed,
        failed_subjects=[grading.SUBJECT_LABELS[s] for s in result.failed_subjects],
        updated_at=student.updated_at,
    )


@router.get("/grading-scheme")
def grading_scheme() -> GradingScheme:
    """The scheme the reports use, so the UI can state it without copying it."""
    return GradingScheme(
        bands=[GradeBand(grade=g, min_percentage=float(m)) for m, g in grading.GRADE_BANDS],
        pass_percentage=float(grading.PASS_PERCENTAGE),
        subject_pass_mark=float(grading.SUBJECT_PASS_MARK),
        max_total=int(grading.MAX_TOTAL),
    )


def _marks(student: Student) -> dict:
    return {subject: getattr(student, subject) for subject in MARK_FIELDS}


def _list_item(student: Student) -> StudentListItem:
    result = grading.summarise(_marks(student))
    return StudentListItem(
        student_id=student.student_id,
        full_name=student.full_name,
        grade_level=student.grade_level,
        section=student.section,
        percentage=float(result.percentage),
        grade=result.grade,
        passed=result.passed,
    )
