# Student Results Portal: one image with the API and the built React app.
#   docker compose up --build    (recommended: also starts Postgres)

# --- Stage 1: build the React app ---------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /frontend
# Dependencies first, so editing source code doesn't reinstall them.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python runtime -------------------------------------------------
FROM python:3.13-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FRONTEND_DIST=/app/frontend/dist

RUN useradd --create-home --uid 1000 app
WORKDIR /app/backend

# Install the exact versions in requirements.lock, so every build gets the same
# dependencies. Then install the package itself (no new dependencies) against a
# placeholder, so this layer is reused until pyproject.toml or the lock changes.
# The editable install points at /app/backend/app, where the real code is
# copied next. Dev extras are included so the tests and the seed script can run
# inside the container.
COPY backend/pyproject.toml backend/requirements.lock ./
RUN mkdir app && touch app/__init__.py \
    && pip install -r requirements.lock \
    && pip install --no-deps -e ".[dev]" \
    && chown app:app /app/backend

COPY --chown=app:app backend/ ./
COPY --from=frontend /frontend/dist /app/frontend/dist

USER app
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=2)"

# Create any missing tables (a no-op once they exist), then serve. exec makes
# uvicorn PID 1 so it gets Docker's stop signal and shuts down cleanly.
CMD ["sh", "-c", "python -m app.init_db && exec uvicorn app.main:app --host 0.0.0.0 --port 8080"]
