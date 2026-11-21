"""One JSON error shape for every failure: {"error": {"code": ..., "message": ...}}.

The frontend can show ``message`` for any error without special cases, and an
unexpected exception never leaks a stack trace or takes the server down.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


def _validation_message(exc: RequestValidationError) -> str:
    first = exc.errors()[0]
    location = [str(part) for part in first.get("loc", ())[1:]]
    if location == ["file"] and first.get("type") == "missing":
        return "No file was uploaded. Choose a CSV file and try again."
    return f"{'.'.join(location) or 'request'}: {first.get('msg', 'is not valid')}"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
        return _error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error(422, "INVALID_REQUEST", _validation_message(exc))

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.")
