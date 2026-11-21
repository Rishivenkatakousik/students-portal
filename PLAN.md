# Student Results Portal — Implementation Plan

## Context
Es Magico full-stack intern take-home (`EsMagico - Fullstack Intern Assignment.pdf`). An admin uploads a messy CSV (~5,000 students); the portal imports valid rows, explains rejected rows in plain language, and lets the admin search students and open a per-student report. Rules live in `docs/assignment-rules.md` (the sample pack's README); sample files are in `backend/tests/fixtures/`. Expected results: `students_small.csv` → 25 read / 16 imported / 9 rejected; `students_sample.csv` → 5,000 / 4,685 / 315. Graders will also run an unseen messy file, so we build for the rules, not the sample.

Deliverables: frontend + backend + seed script, Dockerfile (+ compose), one-command tests, README (how to run), NOTES.md (one page: stack, decisions, gaps, next steps), clean commit history.

## Stack (agreed)
- **Backend:** FastAPI (Python 3.13), Pydantic v2
- **DB:** PostgreSQL 16 via **SQLAlchemy 2.0** (typed ORM models; Core `postgresql.insert().on_conflict_do_update()` for bulk upsert) + **Alembic**
- **CSV:** stdlib `csv` (`encoding="utf-8-sig"`, `newline=""`, `reader.line_num`) + hand-written validators — no pandas (it pads short rows with NaN, drops blank lines from numbering, coerces "09"/"" → loses raw values)
- **Frontend:** React + Vite + TypeScript, React Router, TanStack Query, **Tailwind CSS 4** (styling) and **axios** (HTTP, gives upload progress). Both pinned to exact, established versions: `tailwindcss`/`@tailwindcss/vite` 4.3.3, `axios` 1.20.0 — axios had a compromised npm release in March 2026 (1.14.1), so its dependency tree was checked before adopting it
- **Tests:** pytest; **Seed:** Faker (`en_IN`)
- **Run:** multi-stage Dockerfile (Node builds `frontend/dist` → Python image serves API + static) + `docker-compose.yml` (app + postgres). App on **http://localhost:8080**.

## Data traps confirmed in the sample (scanned read-only)
- BOM, CRLF, extra `parent_phone` column; 10 blank/all-empty rows; field counts 12 (4,985), 13 (8), 11 (7)
- Padded/lowercase values: `"  D "`, `e`, `stu00126`, `"  41 "` → valid after trim/normalise
- Unicode/punctuation names: `Bjørn`, `Anaïs`, `Zoë D'Souza`, `"Kaur, Reyansh"` → valid
- Marks: `-5`, `1e3`, `82/100`, `N/A`, `eighty`, `abc`, `""`, `" "` → rejected (note `float("1e3")` would wrongly parse — strict regex first)
- Grade: `-2`, `ten`, `IX`, `9th`; Section: `Z`, `""`
- DOB: `tomorrow`, `11-30-2010` (MM-DD), `14.03.2011`; plus out-of-range ages (e.g. 1970)
- Small file: `,,,,,,,,,,` (10 fields) must be **skipped** as all-empty, not WRONG_FIELD_COUNT; second `STU00005` is DUPLICATE_ID even though the first STU00005 was itself invalid

## Project layout
```
backend/app/
  main.py            app, routers, global exception handler, serves frontend/dist (SPA fallback)
  config.py          DATABASE_URL, MAX_UPLOAD_MB
  db.py              engine + session dependency
  models.py          Student, Import, ImportProblem
  schemas.py         Pydantic responses
  grading.py         total / percentage / grade / pass (single source of truth)
  importer/parser.py      bytes → header map + (line_no, fields) iterator; FileError
  importer/validators.py  one pure function per column → (value | RowError)
  importer/service.py     parse → validate → dedupe → bulk upsert in one transaction
  routers/imports.py, routers/students.py
backend/alembic/     initial migration (tables, indexes, pg_trgm)
backend/tests/       unit, parser, golden, api
frontend/src/pages/  ImportPage, StudentsPage, StudentReportPage, NotFound
backend/seed/generate.py   (inside backend/ so the Docker image includes it)
Dockerfile, docker-compose.yml, .dockerignore, .gitignore, README.md, NOTES.md
```

## Data model
- **students**: `student_id varchar(20) PK` (upper), `full_name varchar(100)`, `email varchar(254)` (lower), `date_of_birth date`, `grade_level smallint`, `section char(1)`, five marks `numeric` (unconstrained — `numeric(5,2)` would silently round `85.125`), `last_import_id FK`, `created_at`, `updated_at`. Indexes: trigram GIN on `full_name`, btree on `(grade_level, section)`.
- **imports**: id, filename, size, started_at, finished_at, status (`completed`/`failed`), file_error, rows_read, imported, new, updated, unchanged, rejected, extra_columns.
- **import_problems** (model `ImportProblem` — not `ImportError`, which would shadow Python's built-in exception): id, import_id FK (cascade), line, student_id (raw), field, code, message, raw_value.
- Total/percentage/grade are **computed** (Python in `grading.py`, mirrored SQL expression only for list sorting) — never stored.

## Import pipeline
**File level (reject whole file, nothing written, 400/413 with admin-friendly message):** empty file; > 10 MB; not UTF-8 (hint: Excel "CSV UTF-8"); header missing required columns (list them); duplicate column after normalising (`Maths` + `maths`); header only → "No student rows found". Header normalised by strip + lower; extra columns ignored and listed in the summary.

**Row order:** (1) blank line or every field empty → skip, not counted, line number still advances → (2) wrong field count → WRONG_FIELD_COUNT, whole row → (3) trim each field, run every column validator, collect **all** errors for the row → (4) ID seen earlier in this file (valid or not) → DUPLICATE_ID. Row is imported only if it has zero errors.

**Column rules** (regex first, then convert; `today` injected):
| Field | Check | Codes |
|---|---|---|
| student_id | `^[A-Za-z0-9-]{3,20}$` → upper | MISSING_REQUIRED, INVALID_FORMAT |
| full_name | NFC-normalise, collapse whitespace; 2–100 chars; Unicode letters (+ combining marks), spaces, `'` `’` `,` `.` `-`; at least one letter | MISSING_REQUIRED, INVALID_FORMAT (incl. length) |
| email | one `@`, non-empty local, dotted domain with TLD, no spaces → lower | MISSING_REQUIRED, INVALID_FORMAT |
| date_of_birth | `\d{4}-\d{2}-\d{2}` or `\d{2}/\d{2}/\d{4}` → `strptime` → age 5–25 inclusive vs `today` | MISSING_REQUIRED, INVALID_FORMAT, OUT_OF_RANGE |
| grade_level | `^-?\d+$` → 1–12 (`09` ok, `-2` OUT_OF_RANGE, `IX`/`9th` INVALID_FORMAT) | as above |
| section | `^[A-Fa-f]$` → upper; other single/multi chars INVALID_FORMAT | MISSING_REQUIRED, INVALID_FORMAT |
| marks ×5 | `^-?\d+(\.\d+)?$` → Decimal → 0–100 (`-5` OUT_OF_RANGE; `1e3`, `82/100`, `N/A` INVALID_FORMAT) | as above |

Messages are admin-readable: *"Maths: 105 is outside the allowed range 0 to 100 (OUT_OF_RANGE)"*.

**Persist:** valid rows bulk-upserted in batches of 1,000 inside **one transaction**: `INSERT … ON CONFLICT (student_id) DO UPDATE SET … WHERE <any column IS DISTINCT FROM excluded> RETURNING (xmax = 0) AS inserted` → counts new / updated; unchanged = imported − returned. Errors + import summary saved in the same transaction. On DB failure: rollback, import recorded as `failed`, admin told "Nothing was imported".

## Duplicates & re-uploads
- Same ID twice in one file: first row wins, later rows DUPLICATE_ID (README rule).
- Same student in a later file: update (latest upload wins); summary shows new / updated / unchanged.
- Same file again: idempotent → `0 new, 0 updated, N unchanged`. Not blocked by hash.
- Students absent from a new file are kept (partial class files must not wipe data).

## Large / slow imports
Synchronous in-request (5k rows ≪ 2 s); 10 MB cap; UI shows uploading state and disables the button. NOTES.md: background job + polling for ≫100k rows — not built.

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/imports` | multipart upload → summary + first 50 errors |
| GET | `/api/imports/{id}` | summary |
| GET | `/api/imports/{id}/problems?page=&page_size=` | paginated row problems (ordered by line) |
| GET | `/api/imports/{id}/problems.csv` | bonus: error report download |
| GET | `/api/students?q=&grade_level=&section=&page=&page_size=&sort=` | `{items,total,page,page_size}`; q = part of a name or ID (case-insensitive, spaces collapsed, `%`/`_` matched literally); sort `student_id`/`name`/`class`/`percentage` (± prefix), always tie-broken by student_id so pages never overlap; page_size ≤ 100 |
| GET | `/api/students/{student_id}` | report; case-insensitive; 404 JSON if unknown |
| GET | `/api/grading-scheme` | bands + pass rules, so the UI states the scheme without copying it |
| GET | `/api/health` | Docker healthcheck |
Every error uses one shape: `{"error": {"code", "message"}}` (`app/errors.py`) — file problems 400, too large 413, unknown import 404, bad request 422, save failure 500 `IMPORT_FAILED`, anything unexpected 500 `INTERNAL_ERROR` (logged, no stack trace sent). Server never crashes on bad input.

## Grading scheme (stated in UI + NOTES.md)
A ≥ 80 · B 65–79.99 · C 50–64.99 · D 40–49.99 · F < 40 (on overall %). **Pass** = overall ≥ 40 **and** every subject ≥ 33; report shows which subject(s) caused a fail. Percentage rounded half-up to 1 dp; **grade and the 40% rule use that displayed value**, so the UI never shows "80.0%" next to a B. Subject pass mark compares the exact mark. Total /500.

## Frontend
- **/import:** drag-drop or picker, file name + size, required-columns hint, "Upload and import". States: uploading, file-level error (what + how to fix), summary cards (read / imported [new, updated, unchanged] / rejected), paginated problem table (row, student ID, field, problem), download error CSV, "View students" link.
- **/students:** 300 ms debounced search, class + section filters, page size, pagination; state in URL query params. States: skeleton, empty DB ("Import a file"), no match ("Clear search"), error + Retry.
- **/students/:id:** details card, marks table with bars, overall card (%, grade, total, PASS/FAIL + reason), Back link, Print button + print CSS, "Student not found" state. Unknown routes → NotFound.

## Seed script
`python -m seed.generate --rows 5000 --error-rate 0.07 --seed 42 --out messy.csv [--upload http://localhost:8080]` — realistic en_IN students with age consistent with grade; injects every trap above (plus shuffled column order, BOM, CRLF, extra column, quoted commas, Unicode names); deterministic with `--seed`; prints expected counts; `--upload` goes through the real API.

## Tests (`docker compose run --rm app pytest`; validator/parser tests also run without DB)
1. Validators: parametrized `(raw → value | code)` tables per column, including boundaries (age exactly 5/25 with fixed today, 0/100, "09", "1e3", "-5", Unicode names).
2. Parser: BOM, CRLF/LF, quoted commas, blank lines counted, all-empty rows skipped (incl. short `,,,,`), short/long rows, shuffled/upper/padded headers, missing/duplicate columns, non-UTF-8, empty file.
3. Golden: small → 25/16/9 + exact (line, code) list; sample → 5000/4685/315; fixed `today` (date pinned in a fixture — expected counts verified as the first step).
4. API + DB (Postgres test DB from compose, truncated per test): upload → searchable; re-upload idempotent; changed marks → updated; bad file → 400 and no rows; unknown student → 404; pagination totals.
5. Seed round-trip: generator's expected counts == importer's counts.

## Docker
- **Dockerfile:** stage 1 `node:20-alpine` → `npm ci && npm run build`; stage 2 `python:3.13-slim` → install backend, copy `dist`, `CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080`.
- **docker-compose.yml:** `db` (postgres:16, healthcheck, named volume), `app` (build ., port 8080, `DATABASE_URL`, `depends_on: db: service_healthy`).
- README quick start: `docker compose up --build` → open http://localhost:8080; seed: `docker compose exec app python -m seed.generate --upload http://localhost:8080`; tests: `docker compose run --rm app pytest`.

## Trap catalogue & test matrix (for the unseen file)
Each line = one parametrized test case (`tests/test_validators.py`, `tests/test_parser.py`) and, where marked ⚙, a seed-generator mutation so generated files exercise it too. **Decision** marks a judgement call to record in NOTES.md.

**File / encoding**
- 0-byte file; file that is only a BOM; header only → file error ⚙
- Latin-1 / Windows-1252 bytes (`M\xfcller`) → file error "not UTF-8" (Decision: reject whole file, don't guess encoding)
- UTF-16 file (Excel "Unicode Text") → file error
- Binary / `.xlsx` renamed `.csv` → file error (sniff by decoding, never trust extension or MIME)
- > 10 MB → 413
- Semicolon- or tab-delimited → "missing columns" file error with hint about separators
- Unterminated quote (`"Patel, Sahil,...` never closed): Python's csv **silently** swallows the rest of the file into one value (verified). Use `strict=True` → "unexpected end of data" → file error with the line number; also raise `csv.field_size_limit`
- Broken quote inside one row (`"ab"c,...`) → strict mode errors on that row only; reader recovers → reject just that row (INVALID_FORMAT, whole row) and continue
- Space before a quoted value (`a, "b,c"`) → `skipinitialspace=True` reads 2 fields, not 3 (no effect on the sample files, verified)
- Mixed CRLF / LF / lone CR in one file ⚙

**Header**
- Shuffled order, UPPER case, padded `" maths "`, quoted header names ⚙
- Extra columns (`parent_phone`, `remarks`) ignored and listed ⚙
- Trailing comma in header → empty column name → ignored as extra
- Missing required column → file error naming it
- Duplicate column after normalising (`Maths`,`maths`) → file error

**Row structure**
- Blank line; whitespace-only line; `,,,,,,,,,,` with fewer/more commas; `"  ","",` → all skipped, line numbers still advance ⚙
- Short row / long row / trailing extra comma → WRONG_FIELD_COUNT ⚙
- Quoted comma `"Singh, Aarav"` keeps count correct ⚙
- Quoted field with embedded newline → row reported at its **starting** line; following line numbers stay correct
- Escaped quotes `"D""Souza"`

**student_id**
- `stu00022` → `STU00022`; padded `" STU1 "` → trimmed ⚙
- `ST` (2), 21 chars, `STU 001` (inner space), `STU_001`, `STÜ001` → INVALID_FORMAT (Decision: ASCII letters only)
- Empty → MISSING_REQUIRED
- `STU00005` then `stu00005` → DUPLICATE_ID (case-insensitive) ⚙
- Duplicate of an earlier **invalid** row → still DUPLICATE_ID ⚙
- Leading zeros preserved (`STU00001` ≠ `STU1`)

**full_name**
- `"  Siddharth   Bose "` → `Siddharth Bose`; tabs / non-breaking space (` `) collapsed ⚙
- `Bjørn`, `Anaïs`, `Zoë D'Souza`, `Kaur, Reyansh`, `O’Brien` (curly apostrophe) → valid ⚙
- `Mary-Jane`, `A. Kumar` → valid (Decision: allow `-` and `.`)
- 1 char, 101 chars → INVALID_FORMAT (Decision: length limits on text are a format rule; OUT_OF_RANGE is kept for numbers and ages); exactly 2 and 100 → valid
- `प्रिया शर्मा` (Devanagari vowel signs are combining marks, not letters) and decomposed `Zoë` → valid (Decision: allow combining marks, NFC-normalise)
- `R2D2`, emoji, `''`, `,,` (no letters) → INVALID_FORMAT

**email**
- Uppercase → lowercased; padded → trimmed ⚙
- `sana@example` (no TLD), `a@@b.com`, `a b@x.com`, `@x.com`, `a@`, `a@x..com`, `a@x.com.` → INVALID_FORMAT ⚙
- `first.last+tag@sub.example.co.in` → valid
- Same email on two different students → allowed (Decision: siblings may share a parent email; not a uniqueness rule in README)

**date_of_birth** (tests pin `today`)
- `2012-04-20`, `20/04/2012` → valid ⚙
- `31/02/2012`, `2013-02-29`, `00/01/2012`, `31/04/2012` → INVALID_FORMAT; `29/02/2012` (leap) → valid
- `11-30-2010`, `14.03.2011`, `2012/04/20`, `2012-4-5`, `20/4/2012`, `12/04/12`, `2012-04-20T00:00`, `41000` (Excel serial), `tomorrow` → INVALID_FORMAT (Decision: only the two exact formats) ⚙
- Age exactly 5 today → valid; one day short of 5 → OUT_OF_RANGE
- 25 years old (day before 26th birthday) → valid; 26th birthday today → OUT_OF_RANGE (Decision: "between 5 and 25" inclusive of whole years)
- Future date, 1970 → OUT_OF_RANGE ⚙

**grade_level**
- `9`, `09`, `" 9 "`, `012` → valid
- `0`, `13`, `-2` → OUT_OF_RANGE ⚙
- `IX`, `ten`, `9th`, `9.0`, `+9`, `９` (full-width) → INVALID_FORMAT ⚙ (Decision: `9.0` is not a whole-number string)

**section**
- `a`, `" f "` → upper ⚙
- `Z`, `G`, `AB`, `1` → INVALID_FORMAT; empty → MISSING_REQUIRED ⚙

**marks (×5)**
- `0`, `100`, `100.0`, `58.0`, `41.25`, `" 41 "` → valid ⚙
- `-5`, `-0.1`, `100.01`, `105` → OUT_OF_RANGE ⚙
- `1e3`, `82/100`, `85%`, `1,5`, `N/A`, `eighty`, `abc`, `NaN`, `inf`, `.5`, `5.`, `٨٥` (Arabic-Indic digits) → INVALID_FORMAT ⚙
- `""`, `" "` → MISSING_REQUIRED ⚙
- Multiple bad marks in one row → **all** reported, row counted once as rejected

**Import behaviour (API tests)**
- Upload small twice → second: 0 new / 0 updated / 16 unchanged
- Re-upload with one changed mark → 1 updated
- Upload whose ID differs only in case from an existing student → update, not new
- Bad file → 4xx, zero rows written, previous data intact, server still answers `/api/health`
- Two concurrent uploads touching the same students → both succeed. **Verified:** without sorting rows by student_id before the upsert, Postgres reports "deadlock detected" (3,000 rows in opposite order); sorting gives every import the same lock order
- DB error mid-import (simulated) → full rollback, import marked failed

## Build steps
Each step ends with a **Done when** check and a commit. Work on a new `main` branch. Don't start a step until the previous one's check passes.

### Step 0 — Repo setup
1. Work on `main` (repo was already on an unborn `main` branch).
2. Add `.gitignore`: `__pycache__/`, `.venv/`, `.pytest_cache/`, `node_modules/`, `frontend/dist/`, `.env`, `*.egg-info`, `.DS_Store`.
3. Move the sample CSVs to `backend/tests/fixtures/` (the golden tests need them). Move the assignment's `README.md` to `docs/assignment-rules.md` (the root README becomes ours).
4. **Do not commit the PDF** (marked confidential) — add it to `.gitignore`. Keep the repo private and share it only with the reviewers.
5. Commit `PLAN.md` + `.gitignore` + moved files.
- **Done when:** `git log` shows one clean commit; `git status` is clean except the ignored PDF.
- Commit: `chore: project setup and plan`

### Step 1 — Backend skeleton
1. `backend/pyproject.toml` with deps: `fastapi`, `uvicorn[standard]`, `python-multipart`, `sqlalchemy>=2`, `psycopg[binary]>=3`, `alembic`, `pydantic-settings`; dev: `pytest`, `httpx`, `faker`.
2. `cd backend && uv venv --python 3.13 .venv && uv pip install -e ".[dev]"` (or `python3.13 -m venv .venv && pip install -e ".[dev]"`).
3. `app/main.py` with `GET /api/health` → `{"status": "ok"}`; `app/config.py` (`DATABASE_URL`, `MAX_UPLOAD_MB=10`).
4. `tests/test_health.py` using FastAPI `TestClient`.
- **Done when:** `pytest` passes; `uvicorn app.main:app --port 8080` answers `/api/health`.
- Commit: `feat(backend): FastAPI skeleton with health check`

### Step 2 — Column validators (pure functions, no DB)
1. `importer/validators.py`: `RowError(field, code, message, raw_value)` dataclass and an `ErrorCode` enum with the five codes.
2. One function per column, each taking the trimmed raw string (and `today` for DOB) and returning the clean value or raising/returning a `RowError`: `validate_student_id`, `validate_full_name`, `validate_email`, `validate_date_of_birth`, `validate_grade_level`, `validate_section`, `validate_mark(field_name, raw)`.
3. Rule for every function: empty → MISSING_REQUIRED; strict regex → INVALID_FORMAT; then convert and range-check → OUT_OF_RANGE. Regexes use ASCII digits only (`[0-9]`, not `\d`, which matches `٨`).
4. Admin-readable messages, e.g. `Maths: 105 is outside the allowed range 0 to 100`.
5. `tests/test_validators.py`: parametrized tables covering every validator line in the **Trap catalogue** above.
- **Done when:** all validator cases pass.
- Commit: `feat(import): column validators with trap tests`

### Step 3 — CSV parser + row pipeline (still no DB)
1. `importer/parser.py`:
   - `read_file(data: bytes) -> ParsedFile` — reject empty / too big; decode `utf-8-sig` strictly (`UnicodeDecodeError` → `FileError`); `csv.reader(io.StringIO(text, newline=""))`.
   - Header: strip + lower each name; check required columns present and no duplicates → `FileError` listing problems; record extra columns; map column name → index.
   - Iterate rows tracking the **start line** of each record (line count before reading the record + 1, so multi-line quoted fields report correctly). `strict=True`, `skipinitialspace=True`; unclosed quote → `FileError`; other `csv.Error` → row-level error, keep going.
2. `importer/pipeline.py`: `process(parsed, today) -> ImportResult` applying the row order: skip all-empty → field count → validate all columns (collect every error) → duplicate check against a `seen_ids` set filled with **every** row's normalised ID (valid or not). Returns `rows_read`, `valid_rows` (list of dicts), `errors` (list of `RowError` with line + student_id).
3. `tests/test_parser.py`: every File / Header / Row-structure trap.
4. `tests/test_golden.py`: run the pipeline on both fixture files.
   - Find the `today` the expected numbers were computed for and pin it. **Result:** counts hold for every day from 2025-12-26 to at least 2028-03-01; pinned `2026-11-21` in `tests/helpers.py`.
   - **Verified against alternatives:** counting only *valid* rows as "seen" gives 17 / 4,687 and case-sensitive IDs give 4,707, so the data confirms "first row wins even if invalid" and case-insensitive IDs. Whether wrong-field-count rows mark their ID as seen is not decided by the data (both give the same counts) — chose yes; note in NOTES.md.
   - Assert small → 25 / 16 / 9 with the exact list of `(line, code)`; sample → 5,000 / 4,685 / 315.
   - If the counts don't match, investigate the difference row by row before changing any rule — the README is the source of truth.
- **Done when:** golden counts match exactly.
- Commit: `feat(import): CSV parser and row pipeline matching expected counts`

### Step 4 — Database: models + migration
1. `docker-compose.yml` with just the `db` service for now (postgres:16, host port **5433** bound to 127.0.0.1 — 5432 is often taken by another local Postgres; healthcheck, named volume).
2. `app/db.py`: engine from `DATABASE_URL`, `SessionLocal`, `get_session` dependency.
3. `app/models.py`: `Student`, `Import`, `ImportProblem` per the Data model section (`Mapped[...]` typed columns; marks `Numeric` unconstrained).
4. `alembic init`, set `target_metadata`, autogenerate the first migration, then hand-add `CREATE EXTENSION IF NOT EXISTS pg_trgm`. Trigram GIN indexes on `full_name` and `student_id`; CHECK constraints (marks 0–100, grade 1–12, section A–F, upper-case ID, import status) as a second line of defence.
- **Done when:** `docker compose up -d db && alembic upgrade head` creates all tables; `alembic downgrade base` cleanly drops them.
- Commit: `feat(db): models and initial migration`

### Step 5 — Import service + import API
1. `importer/service.py`: `run_import(session, filename, data, today) -> Import`:
   - Create the `Import` row; call parser + pipeline.
   - `FileError` → mark import `failed` with `file_error`, return it.
   - Upsert valid rows in batches of 1,000 with `postgresql.insert(Student).on_conflict_do_update(..., where=<any column IS DISTINCT FROM excluded>).returning(literal_column("xmax = 0"))` → count new / updated; unchanged = imported − returned.
   - Bulk-insert `ImportProblem` rows; fill summary counts; one transaction; any DB exception → rollback, record failed import in a fresh transaction.
2. `routers/imports.py`:
   - `POST /api/imports` — read upload with a size guard (stop reading past 10 MB → 413); return summary + first 50 problems; file errors → 400 with `{"error": {code, message}}` body.
   - `GET /api/imports/{id}`, `GET /api/imports/{id}/problems?page=&page_size=`.
3. `app/errors.py`: one error shape for every failure; unexpected errors → 500 with a generic message, traceback logged.
4. `tests/conftest.py`: test DB (`DATABASE_URL` pointing at a `results_test` database), run migrations once, truncate tables per test.
5. `tests/test_api_imports.py`: every **Import behaviour** trap (re-upload idempotent, changed mark → updated, case-only ID → update, bad file writes nothing, simulated DB failure rolls back).
- **Done when:** uploading both fixtures through the API returns the golden counts; second upload → 0 new / 0 updated / all unchanged.
- Commit: `feat(api): import endpoint with upsert and error storage`

### Step 6 — Grading + students API
1. `app/grading.py`: `summarise(marks) -> Result(total, percentage, grade, passed, failed_subjects)` using the stated scheme; one SQL expression for percentage used only for list sorting (same rounding; verified against the sample: sorted order matches displayed values for all 4,685). Shared `get_today` / session dependencies in `app/deps.py`.
2. `routers/students.py`:
   - `GET /api/students` — `q` (name ILIKE `%q%` OR id prefix, case-insensitive), `grade_level`, `section`, `page` ≥ 1, `page_size` 1–100 (default 25), `sort` from a whitelist (`student_id`, `name`, `percentage`, ±). Returns `{items, total, page, page_size}`, each item with percentage + grade.
   - `GET /api/students/{student_id}` — upper-case the ID; 404 `{code: "STUDENT_NOT_FOUND"}`.
3. Tests: `test_grading.py` (boundaries 39.99/40/64.99/65/80, subject 32.99 vs 33, pass/fail reasons); `test_api_students.py` (search by name/ID/case, filters, pagination totals, empty results, 404, page past the end returns empty list not error).
- **Done when:** tests pass; `/docs` shows all endpoints with response schemas.
- Commit: `feat(api): students list, report and grading`

### Step 7 — Frontend setup
1. `npm create vite@latest frontend -- --template react-ts` (React 19, Vite 8, TypeScript 7, oxlint); add `react-router` (v8 — `react-router-dom` is merged into it) and `@tanstack/react-query`. Turn on `"strict": true` (the template leaves it off).
2. Vite dev proxy `/api` → `http://localhost:8080`.
3. `src/api.ts`: axios instance (`baseURL: /api`) whose response interceptor turns every failure into an `ApiError` (reads `{"error": {code, message}}`; network/timeout/proxy 502–504 get plain messages); upload reports progress.
4. Layout: header "Results Portal" with Import / Students nav (active state); routes `/` → redirect `/students`, `/import`, `/students`, `/students/:id`, `*` → NotFound.
5. Tailwind CSS: theme tokens (colours, fonts, shimmer) in `src/index.css` `@theme`; repeated building blocks as class strings in `src/ui.ts`. **Rule learned:** never stack two utilities for the same property to override (e.g. `bg-white` + `bg-danger-soft`, `min-h-10` + `min-h-8`) — Tailwind resolves them by stylesheet order, not markup order; choose complete variants instead (`btnSecondarySmall`). Responsive to phone width (`max-sm:` tables become labelled cards).
- **Done when:** `npm run dev` shows the layout and nav between empty pages.
- Commit: `feat(frontend): app shell and routing`

### Step 8 — Import page
1. Drop zone + "Choose file" (accept `.csv`), show name + size, required-columns hint.
2. "Upload and import" (disabled while uploading) → `useMutation` POST.
3. States: idle, uploading (spinner + "Checking N KB…"), file error (red box: what's wrong + how to fix), network error with Retry, success.
4. Success: cards Rows read / Imported (new · updated · unchanged) / Rejected; extra columns note; problems table (Row, Student ID, Field, Problem) paginated via the problems endpoint; "View students" link; "No problems found 🎉" when zero errors.
- **Done when:** both fixtures show the golden numbers and readable problems in the browser; a `.png` renamed to `.csv` shows a friendly error.
- **Built notes:** client-side 10 MB check before upload; Retry offered only when retrying can help (network/server), not for a bad file; proxy 502/503/504 → "Couldn't reach the server"; problems table turns into labelled cards under 600px (`.table--stack`, reused by the students table).
- Commit: `feat(frontend): import page`

### Step 9 — Students page
1. Search box (300 ms debounce), class select (1–12), section select (A–F), page size select (10/25/50/100), pagination (Prev, numbered pages with ellipsis, Next), "Showing X to Y of Z".
2. All state in URL search params (`useSearchParams`); changing a filter resets to page 1.
3. Table: Student ID, Name (link), Class, Section, Percentage, Grade.
4. States: skeleton rows while loading (`keepPreviousData` to avoid flicker), empty DB ("No students yet — Import a CSV" link), no match ("No students match 'xyz'" + Clear search), error + Retry.
- **Done when:** with the sample imported, search "d'souza", filter class 9 section B, page through, browser back restores the previous view.
- **Built notes:** URL params `q`, `class`, `section`, `page`, `size` (invalid values fall back to defaults). URL updates are built from `window.location.search`, not the render's params: two quick filter changes otherwise overwrite each other (verified — React Router's functional `setSearchParams` doesn't queue either). Added a Result (Pass/Fail) column; no-match message names the active filters; "page N is empty" state for out-of-range pages.
- Commit: `feat(frontend): students list with search, filters and pagination`

### Step 10 — Student report page
1. Back link (keeps previous list filters via `location.state` or history back).
2. Details card: initials avatar, name, ID, class + section, email, DOB formatted (`14 March 2012`), age.
3. Overall card: percentage, grade, total /500, PASS/FAIL badge; if failed, which subject(s) and why.
4. Marks table with bars; subjects under 33 highlighted.
5. Print button (`window.print()`) + `@media print` CSS hiding nav/buttons.
6. States: loading skeleton, "Student not found" (404) with link back, other errors + Retry.
- **Done when:** a known student shows correct numbers (check one by hand); `/students/NOPE` shows not-found; print preview looks clean.
- **Built notes:** checked by hand — STU00014: 46+28+37+52+39 = 202 → 40.4%, D, FAIL (Science 28 < 33); API and SQL agree. Fail reasons listed ("Below 33 in Science", "Overall below 40%"). Grading scheme stated on the page from `/api/grading-scheme`. Page title = student name (names the PDF when printed). Back link returns to the list's exact URL. Server error ≠ not found: 404 shows "Student not found", other errors show Retry.
- Commit: `feat(frontend): student report page`

### Step 11 — Docker
1. `Dockerfile` (multi-stage): `node:20-alpine` builds `frontend/dist`; `python:3.13-slim` installs backend (non-root user), copies `dist` + `seed/`; `CMD` runs `alembic upgrade head` then `uvicorn` on 8080.
2. FastAPI serves `dist` static files with SPA fallback (any non-`/api` path → `index.html`, so refreshing `/students/STU00001` works).
3. `docker-compose.yml`: add `app` service (build `.`, port `8080:8080`, `DATABASE_URL`, `depends_on: db: condition: service_healthy`, healthcheck on `/api/health`).
4. `.dockerignore`: `node_modules`, `.venv`, `.git`, `*.pdf`, `dist`.
5. Test command: `docker compose run --rm app pytest` (creates the test DB if missing).
- **Done when:** `docker compose down -v && docker compose up --build` → http://localhost:8080 works end to end; tests pass inside the container.
- **Built notes:** `app/frontend.py` serves `frontend/dist` (SPA fallback to index.html with `Cache-Control: no-cache`; `/assets` static; unknown `/api/...` stays a JSON 404; path traversal blocked — checked with raw `..`/`%2e%2e` requests). `main.py` is a `create_app()` factory. Image: node:24-alpine build stage + python:3.13-slim, non-root `app` user, deps layer cached via a placeholder package + editable install, healthcheck on `/api/health`, migrations then `exec uvicorn`. Both ports bound to 127.0.0.1. Verified a first run on a throwaway compose project (`-p magicofresh`, own empty volume): migrations run, empty state → import 4,685 new → search → report → re-upload 4,685 unchanged. 266 tests pass inside the container.
- **Bugs found here:** (1) "View imported students" right after an import showed the cached "No students yet" — the import now invalidates cached student queries; (2) while a new search loaded, the count line paired the old total with "match" — now "Searching…"; (3) Alembic's log lines were missing (env.py skipped `fileConfig`) — restored with `disable_existing_loggers=False`.
- Commit: `build: Dockerfile and docker-compose`

### Step 12 — Seed script
1. `backend/seed/generate.py` (argparse): `--rows`, `--error-rate`, `--seed`, `--today`, `--out`, `--upload URL`.
2. Generate clean students with Faker `en_IN`: DOB consistent with grade (age ≈ grade + 5), realistic marks (normal distribution, clipped), sections A–F, unique IDs.
3. Apply mutations at `--error-rate`, picking from every ⚙ trap in the catalogue; track the expected outcome of each mutation (valid-after-normalising vs rejected). Add file-level noise: BOM, CRLF, shuffled columns, an extra column, blank and all-comma lines.
4. Print expected read / imported / rejected; with `--upload`, POST through the API and print the portal's answer next to it.
5. `tests/test_seed.py`: generate 500 rows with a fixed seed → pipeline counts equal the generator's expected counts.
- **Done when:** `docker compose exec app python -m seed.generate --rows 5000 --upload http://localhost:8080` shows matching expected vs actual counts.
- **Built notes:** 20 kinds of breakage + duplicate IDs, 11 kinds of harmless mess, file-level BOM/CRLF/shuffled + upper-case headers/extra column/blank and all-comma lines. Tests compare the exact set of rejected *lines* (not just totals) for several seeds; a 40-seed sweep also matched. Verified in Docker: 5,000 rows → expected 4,639 / 361 = portal; re-upload → 4,639 unchanged. **Bug found (in the generator):** it copied IDs from rows with a missing field for its duplicates; with shuffled columns that field can be the ID itself, so the importer rightly never saw it. Generator now only duplicates IDs from rows with the right number of fields.
- Commit: `feat(seed): messy data generator and loader`

### Step 13 — README + NOTES.md
1. `README.md`: what it is, quick start (`docker compose up --build`), open URL, load seed data, run tests, local dev without Docker, project layout, API table (link to `/docs`).
2. `NOTES.md` (one page): stack and why; grading scheme; validation decisions (every **Decision** in the trap catalogue); duplicates and re-upload policy; bad/large/slow file behaviour; data traps noticed; pinned `today` for golden tests; what's missing (auth, import history page, background jobs, delete/edit students, i18n, rate limiting); what I'd do next.
- **Done when:** someone who hasn't seen the project can follow the README from a fresh clone.
- **Built notes:** timings measured, not guessed (sample ≈0.7 s, 50,000 rows / 4.8 MB ≈6 s in Docker). NOTES.md trimmed from ~900 to ~670 words to fit the one-page brief. The README is checked from a fresh clone in step 14.
- Commit: `docs: README and NOTES`

### Step 14 — Final check
1. Fresh clone into a temp folder → `docker compose up --build` → run the whole **Verification** list below.
2. `docker compose run --rm app pytest` green.
3. Read through the diff once more for leftover debug code, TODOs and unused files; make sure the PDF isn't in git history.
- Commit any fixes: `fix: ...`

### Step 15 — Bonuses (only if time)
1. `GET /api/imports/{id}/problems.csv` + "Download error report" button.
2. Sort by clicking table headers.
3. Import history list on the Import page.

## Verification
- `pytest` green, including both golden counts.
- `docker compose up --build` from a clean clone → http://localhost:8080 loads.
- Upload `students_small.csv` → 25/16/9 with readable problems; upload `students_sample.csv` → 5,000/4,685/315; upload sample again → 0 new / 0 updated / 4,685 unchanged.
- Upload a non-CSV / non-UTF-8 / missing-column file → clear file-level error, app still up.
- Students page: search "d'souza", filter class 9 B, paginate; open a student; open `/students/NOPE` → not found.
- Run seed with `--upload` → counts printed match portal summary.
