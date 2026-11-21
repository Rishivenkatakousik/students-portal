"""Response shapes for the students and grading-scheme APIs."""

from datetime import date, datetime

from pydantic import BaseModel


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
