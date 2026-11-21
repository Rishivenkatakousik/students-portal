import logging
from pathlib import Path

from fastapi import FastAPI

from app.config import settings
from app.errors import install_error_handlers
from app.frontend import mount_frontend
from app.routers import imports, students

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(frontend_dist: Path | None = None) -> FastAPI:
    app = FastAPI(title="Student Results Portal")
    install_error_handlers(app)
    app.include_router(imports.router)
    app.include_router(students.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Last, so API routes always win over the frontend's catch-all.
    mount_frontend(app, frontend_dist or settings.frontend_dist)
    return app


app = create_app()
