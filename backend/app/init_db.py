"""Create missing tables on start-up (``python -m app.init_db``); existing ones are never altered.
The schema is fixed, so there is no migration tool."""

import logging

from sqlalchemy import Engine, text

from app.core.database import engine
from app.models import Base

logger = logging.getLogger(__name__)


def create_schema(target: Engine) -> None:
    with target.begin() as connection:
        # The trigram search indexes on students need this extension.
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        Base.metadata.create_all(connection)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    create_schema(engine)
    logger.info("Database schema is ready")
