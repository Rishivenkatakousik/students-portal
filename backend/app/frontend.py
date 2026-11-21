"""Serve the built React app (frontend/dist) from FastAPI.

One process and one origin in production: no CORS, no second server.
Any non-API path returns index.html so React Router can handle it, which
makes refreshing or sharing a link like /students/STU00001 work.

The build is looked up on each request, not once at startup, so running
`npm run build` while the backend is already running just works.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.errors import AppError


def mount_frontend(app: FastAPI, dist: Path) -> None:
    root = dist.resolve()
    index = root / "index.html"

    # Vite puts fingerprinted JS/CSS in assets/, so they can be cached forever.
    # check_dir=False: the folder may only appear after the server starts.
    app.mount("/assets", StaticFiles(directory=root / "assets", check_dir=False), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        # Registered after the API routes, so it only sees paths they didn't match.
        if path == "api" or path.startswith("api/"):
            raise AppError(404, "NOT_FOUND", "There is no API endpoint at this address.")
        if not index.is_file():
            raise AppError(
                404,
                "FRONTEND_NOT_BUILT",
                "The web app hasn't been built. Run `npm run build` in frontend/ "
                "(or use `npm run dev` on port 5173). The API is available under /api.",
            )
        candidate = (root / path).resolve()
        # Real files at the top level (favicon.svg); never anything outside dist.
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        # index.html must not be cached, or browsers keep loading old asset names.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
