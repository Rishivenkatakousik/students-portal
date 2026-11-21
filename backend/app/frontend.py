"""Serve the built React app (frontend/dist) from FastAPI.

One process and one origin in production: no CORS, no second server.
Any non-API path returns index.html so React Router can handle it, which
makes refreshing or sharing a link like /students/STU00001 work.
"""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.errors import AppError

logger = logging.getLogger(__name__)


def mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.is_file():
        logger.warning("No built frontend at %s; serving the API only", dist)
        return
    root = dist.resolve()

    # Vite puts fingerprinted JS/CSS in assets/, so they can be cached forever.
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        # Registered after the API routes, so it only sees paths they didn't match.
        if path == "api" or path.startswith("api/"):
            raise AppError(404, "NOT_FOUND", "There is no API endpoint at this address.")
        candidate = (root / path).resolve()
        # Real files at the top level (favicon.svg); never anything outside dist.
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        # index.html must not be cached, or browsers keep loading old asset names.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
