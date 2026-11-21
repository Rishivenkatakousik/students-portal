from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import SessionDep, TodayDep
from app.core.errors import AppError
from app.repositories import students as students_repo
from app.repositories.students import SortKey
from app.schemas.common import Page
from app.schemas.students import StudentListItem, StudentReport
from app.services.students import build_list_item, build_report

router = APIRouter(prefix="/api", tags=["students"])


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
    students, total = students_repo.search_students(
        session, q=q, grade_level=grade_level, section=section, sort=sort, page=page, page_size=page_size
    )
    return Page(items=[build_list_item(s) for s in students], total=total, page=page, page_size=page_size)


@router.get("/students/{student_id}")
def get_student(student_id: str, session: SessionDep, today: TodayDep) -> StudentReport:
    student = students_repo.get_student(session, student_id.strip().upper())
    if student is None:
        raise AppError(404, "STUDENT_NOT_FOUND", f'There is no student with ID "{student_id}".')
    return build_report(student, today)
