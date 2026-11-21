import logging

from fastapi import FastAPI

from app.errors import install_error_handlers
from app.routers import imports

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Student Results Portal")
install_error_handlers(app)
app.include_router(imports.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
