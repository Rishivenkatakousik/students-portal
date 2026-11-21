"""Database tables.

Validation happens in ``app.importer``; the CHECK constraints here are a second
line of defence so a bug there can never store, say, a mark of 105.
Total, percentage and grade are not stored: they are always computed from the
marks (see ``app.grading``), so they can never disagree with them.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.importer.validators import MARK_FIELDS


class Base(DeclarativeBase):
    # Predictable constraint names, so migrations can refer to them.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


IMPORT_STATUSES = ("completed", "failed")


class Import(Base):
    """One upload of one file, with its outcome."""

    __tablename__ = "imports"
    __table_args__ = (CheckConstraint(f"status IN {IMPORT_STATUSES}", name="status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int]
    status: Mapped[str] = mapped_column(String(20))
    file_error_code: Mapped[str | None] = mapped_column(String(40))
    file_error: Mapped[str | None] = mapped_column(Text)
    rows_read: Mapped[int] = mapped_column(default=0)
    imported: Mapped[int] = mapped_column(default=0)
    new: Mapped[int] = mapped_column(default=0)
    updated: Mapped[int] = mapped_column(default=0)
    unchanged: Mapped[int] = mapped_column(default=0)
    rejected: Mapped[int] = mapped_column(default=0)
    extra_columns: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    problems: Mapped[list["ImportProblem"]] = relationship(
        back_populates="import_", cascade="all, delete-orphan", passive_deletes=True
    )


class ImportProblem(Base):
    """One problem with one row (or one cell) of an import."""

    __tablename__ = "import_problems"
    __table_args__ = (Index("ix_import_problems_import_id_line", "import_id", "line"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    import_id: Mapped[int] = mapped_column(ForeignKey("imports.id", ondelete="CASCADE"))
    line: Mapped[int]
    student_id: Mapped[str] = mapped_column(Text)  # as written in the file
    field: Mapped[str | None] = mapped_column(String(40))  # None = whole row
    code: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(Text)
    raw_value: Mapped[str | None] = mapped_column(Text)

    import_: Mapped[Import] = relationship(back_populates="problems")


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
