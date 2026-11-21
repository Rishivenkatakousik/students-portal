from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> repository root -> frontend/dist (local development).
_DEFAULT_FRONTEND_DIST = Path(__file__).resolve().parents[3] / "frontend" / "dist"


class Settings(BaseSettings):
    """App settings, read from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://results:results@localhost:5433/results"
    max_upload_mb: int = 10
    frontend_dist: Path = _DEFAULT_FRONTEND_DIST  # FRONTEND_DIST in Docker


settings = Settings()
