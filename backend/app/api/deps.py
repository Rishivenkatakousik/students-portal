"""FastAPI dependencies shared by routers."""

from datetime import date
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session


def get_today() -> date:
    """Reference date for age checks; tests override it to pin a date."""
    return date.today()


SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
