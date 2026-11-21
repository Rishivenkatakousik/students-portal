from fastapi import APIRouter

from app.schemas.students import GradingScheme
from app.services import students

# Tagged "students" as before, so the API docs are unchanged.
router = APIRouter(prefix="/api", tags=["students"])


@router.get("/grading-scheme")
def grading_scheme() -> GradingScheme:
    """The scheme the reports use, so the UI can state it without copying it."""
    return students.grading_scheme()
