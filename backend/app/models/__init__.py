"""Database tables. CHECK constraints back up the importer's validation; totals and grades
are computed from the marks, never stored. Every model is imported so Base sees it."""

from app.models.base import Base
from app.models.imports import IMPORT_STATUSES, Import, ImportProblem
from app.models.student import Student

__all__ = ["IMPORT_STATUSES", "Base", "Import", "ImportProblem", "Student"]
