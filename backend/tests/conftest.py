"""Database fixtures for API tests.

Tests use their own database (``results_test`` next to the app database) so
they never touch real data. It is created and migrated on first use and
emptied before each test. Unit tests that don't ask for ``client`` or
``db_session`` never connect to Postgres.
"""

import os

from sqlalchemy.engine import make_url

_app_url = make_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://results:results@localhost:5433/results"))
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    # render_as_string: str(url) would mask the password as "***".
    _app_url.set(database="results_test").render_as_string(hide_password=False),
)
# Must happen before any app module reads settings.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.deps import get_today  # noqa: E402
from tests.helpers import TODAY  # noqa: E402

BACKEND_DIR = Path(__file__).parent.parent


def _create_test_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database})
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    except OperationalError as error:
        # Fails only the tests that need the database; unit tests still run.
        pytest.fail(
            f"Cannot reach the test database at {url.render_as_string(hide_password=True)}.\n"
            "Start Postgres first: docker compose up -d db\n"
            f"({error.orig})",
            pytrace=False,
        )
    finally:
        admin.dispose()


@pytest.fixture(scope="session")
def migrated_database() -> None:
    _create_test_database()
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


@pytest.fixture
def clean_database(migrated_database) -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE students, import_problems, imports RESTART IDENTITY CASCADE"))


@pytest.fixture
def db_session(clean_database) -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client(clean_database) -> Iterator[TestClient]:
    app.dependency_overrides[get_today] = lambda: TODAY
    # raise_server_exceptions=False: see the real 500 response the browser would get.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()
