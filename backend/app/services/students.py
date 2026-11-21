"""Turn stored students into what the API shows: list rows, reports and the grading scheme."""

from datetime import date
from decimal import Decimal

from app.core.student_fields import MARK_FIELDS
from app.models import Student
from app.schemas.students import GradeBand, GradingScheme, StudentListItem, StudentReport, SubjectMark
from app.services import grading
from app.services.csv_import.validators import age_on


def _marks(student: Student) -> dict[str, Decimal]:
    return {subject: getattr(student, subject) for subject in MARK_FIELDS}


def build_list_item(student: Student) -> StudentListItem:
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


def build_report(student: Student, today: date) -> StudentReport:
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


def grading_scheme() -> GradingScheme:
    return GradingScheme(
        bands=[GradeBand(grade=g, min_percentage=float(m)) for m, g in grading.GRADE_BANDS],
        pass_percentage=float(grading.PASS_PERCENTAGE),
        subject_pass_mark=float(grading.SUBJECT_PASS_MARK),
        max_total=int(grading.MAX_TOTAL),
    )
