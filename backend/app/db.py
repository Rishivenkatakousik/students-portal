from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# pool_pre_ping replaces connections the database has dropped (e.g. after a
# Postgres restart) instead of failing the next request.
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    with SessionLocal() as session:
        yield session
