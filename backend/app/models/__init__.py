"""Database tables.

Validation happens in ``app.services.csv_import``; the CHECK constraints here are
a second line of defence so a bug there can never store, say, a mark of 105.
Total, percentage and grade are not stored: they are always computed from the
marks (see ``app.services.grading``), so they can never disagree with them.

Every model is imported here so ``Base.metadata`` (used by ``app.init_db``) sees all tables.
"""

from app.models.base import Base
from app.models.imports import IMPORT_STATUSES, Import, ImportProblem
from app.models.student import Student

__all__ = ["IMPORT_STATUSES", "Base", "Import", "ImportProblem", "Student"]
