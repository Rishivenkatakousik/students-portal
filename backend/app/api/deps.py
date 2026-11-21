"""FastAPI dependencies shared by routers."""

from datetime import date
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_session


def get_today() -> date:
    """Reference date for age checks; tests override it to pin a date."""
    return date.today()


SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]

# Capped so a huge number is a 422, not a database overflow (500).
PageNumber = Annotated[int, Query(ge=1, le=1_000_000)]
