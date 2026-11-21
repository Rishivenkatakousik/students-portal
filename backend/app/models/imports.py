from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

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
