from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.student_fields import MARK_FIELDS
from app.models.base import Base


def _mark_column() -> Mapped[Decimal]:
    # Unconstrained NUMERIC keeps marks exactly as given (85.125 stays 85.125).
    return mapped_column(Numeric)


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint("student_id = upper(student_id)", name="student_id_upper"),
        CheckConstraint("grade_level BETWEEN 1 AND 12", name="grade_level_range"),
        CheckConstraint("section IN ('A', 'B', 'C', 'D', 'E', 'F')", name="section_letter"),
        *(CheckConstraint(f"{m} BETWEEN 0 AND 100", name=f"{m}_range") for m in MARK_FIELDS),
        # Trigram indexes make "contains" search (ILIKE '%q%') fast on names and IDs.
        Index(
            "ix_students_full_name_trgm",
            "full_name",
            postgresql_using="gin",
            postgresql_ops={"full_name": "gin_trgm_ops"},
        ),
        Index(
            "ix_students_student_id_trgm",
            "student_id",
            postgresql_using="gin",
            postgresql_ops={"student_id": "gin_trgm_ops"},
        ),
        Index("ix_students_grade_level_section", "grade_level", "section"),
    )

    student_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254))
    date_of_birth: Mapped[date] = mapped_column(Date)
    grade_level: Mapped[int] = mapped_column(SmallInteger)
    section: Mapped[str] = mapped_column(String(1))
    maths: Mapped[Decimal] = _mark_column()
    science: Mapped[Decimal] = _mark_column()
    english: Mapped[Decimal] = _mark_column()
    social_studies: Mapped[Decimal] = _mark_column()
    second_language: Mapped[Decimal] = _mark_column()
    last_import_id: Mapped[int | None] = mapped_column(ForeignKey("imports.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
