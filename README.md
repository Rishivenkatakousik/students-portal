# Student Results Portal

A small web portal for a school administrator. Upload a messy CSV of student
results (about 5,000 rows); valid rows are imported, every problem row is
explained in plain language, and any student can be found and their report
opened.

- **Import** – upload a CSV, see rows read / imported / rejected and a table of
  row problems ("Maths: 105 is outside the allowed range 0 to 100").
- **Students** – search by name or ID, filter by class and section, page
  through thousands of students.
- **Student report** – details, marks per subject, total, percentage, grade and
  pass/fail (with the reason), printable.

Decisions, assumptions and what's missing are in [NOTES.md](NOTES.md).

## Quick start

Needs [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
docker compose up --build
```

Open **http://localhost:8080**. The first build takes a few minutes; later
starts take seconds. Postgres starts too, and the database schema is created
automatically.

Try it with the sample file: on **Import**, upload
`backend/tests/fixtures/students_sample.csv`. Expected result: **5,000 rows
read, 4,685 imported, 315 rejected** (348 problems listed).

Stop with `Ctrl+C` or `docker compose down`. Add `-v` (`docker compose down -v`)
to also delete the database and start empty.

## Load generated test data

A seed script generates realistic, deliberately messy data, prints the counts
the portal should report, uploads the file through the real import API and
checks the portal agrees:

```bash
docker compose exec app python -m seed.generate --rows 5000 --upload http://localhost:8080
```

```
Expected:  read 5,000  imported 4,639  rejected 361
Portal:    read 5,000  imported 4,639  rejected 361  (4,639 new, 0 updated, 0 unchanged)
Match.
```

Options: `--rows`, `--error-rate` (share of rows broken, default 0.07),
`--seed` (same seed, same file), `--out`, `--today`. See `--help`.

## Run the tests

One command (starts Postgres if needed, uses a separate `results_test` database):

```bash
docker compose run --rm app pytest
```

275 tests: every column rule and trap, file-level problems (encodings, quotes,
headers, line endings), the exact counts for both sample files, the import API
against Postgres (re-uploads, rollback on failure, concurrent uploads), the
students and report API, grading boundaries, and a round trip where the seed
generator and the importer must agree on every rejected line.

## Local development (without Docker for the app)

```bash
docker compose up -d db                     # Postgres on localhost:5433

cd backend
python3.13 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8080
.venv/bin/pytest                            # in another terminal

cd ../frontend
npm ci
npm run dev                                 # http://localhost:5173, /api goes to :8080
```

`npm run build` writes `frontend/dist`; the backend serves it at
http://localhost:8080 when it exists.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://results:results@localhost:5433/results` | Postgres connection |
| `MAX_UPLOAD_MB` | `10` | Largest accepted upload |
| `FRONTEND_DIST` | `../frontend/dist` | Built React app to serve |
| `TEST_DATABASE_URL` | app URL with database `results_test` | Database the tests use (emptied per test) |

Ports: the app is on **8080**, Postgres on **5433** (not 5432, so it never
clashes with a Postgres you already run). Both listen on localhost only.

### Docker without Compose

The image needs a Postgres it can reach:

```bash
docker build -t results-portal .
docker run -p 8080:8080 -e DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/DB results-portal
```

## API

Interactive docs at **http://localhost:8080/docs**. Every error has the same
shape: `{"error": {"code": "...", "message": "..."}}`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/imports` | Upload a CSV (multipart field `file`); returns the summary and the first 50 problems |
| `GET` | `/api/imports/{id}` | Summary of one import |
| `GET` | `/api/imports/{id}/problems?page=&page_size=` | Row problems, ordered by line |
| `GET` | `/api/students?q=&grade_level=&section=&page=&page_size=&sort=` | Search, filter and page through students |
| `GET` | `/api/students/{student_id}` | One student's report (ID is case-insensitive) |
| `GET` | `/api/grading-scheme` | Grade bands and pass rules |
| `GET` | `/api/health` | Health check |

## Project layout

```
backend/
  app/
    importer/     parser.py (file → rows), validators.py (one rule per column),
                  pipeline.py (row order, duplicates), service.py (save in one transaction)
    routers/      imports.py, students.py
    grading.py    total, percentage, grade, pass/fail
    models.py     SQLAlchemy tables; alembic/ holds the migrations
    frontend.py   serves the built React app
  seed/           messy data generator and loader
  tests/          pytest suite; fixtures/ holds the sample CSVs
frontend/
  src/pages/      ImportPage, StudentsPage, StudentReportPage
  src/api.ts      typed API client (axios)
  src/ui.ts       shared Tailwind class lists
Dockerfile, docker-compose.yml
PLAN.md           build plan and trap catalogue
docs/assignment-rules.md   the column and file rules from the sample pack
```
