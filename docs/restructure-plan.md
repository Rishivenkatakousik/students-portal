# Restructure the Results Portal codebase (structure only, no behaviour change)

## Context
The app is feature-complete and clean, but it grew incrementally. The user wants a conventional, modular layout where every file has one job, database access and business logic are easy to find, and new features have an obvious home. API URLs and contracts, the DB schema, the UI and all behaviour stay exactly the same.

## Phase 1 findings (what exists today)

**Size:** backend app is about 1,400 lines, tests about 1,600 lines, frontend about 1,600 lines. **Not present:** auth or authorization, middleware, background tasks, external integrations and React contexts. I won't add any of them; no empty `security.py` or `contexts/`.

**How the frontend talks to the backend:** `src/api.ts` uses axios with `baseURL: '/api'` and maps every failure to `ApiError`. Vite proxies `/api` to :8080 in dev. In production FastAPI serves `frontend/dist` (`app/frontend.py`), so there is one origin and no CORS.

**Backend: where things live now, and the problems**
| Concern | Today | Problem |
|---|---|---|
| Config, DB session, errors, deps | `config.py`, `db.py`, `errors.py`, `deps.py`, flat in `app/` | No grouping; `deps.py` is HTTP wiring but sits beside domain code |
| SQL queries | Inside routers: `routers/imports.py` (list, count, problem pages, get-or-404) and `routers/students.py` (search, filters, sort, percentage SQL, LIKE escaping) | Routers mix HTTP, SQL and response assembly |
| Writes | `importer/service.py`: orchestration plus raw upsert/insert SQL | Transaction logic and SQL are tangled |
| Business rules | `grading.py` (pure), `importer/{parser,validators,pipeline,report}.py` (pure) | Fine, but scattered |
| Report assembly | `routers/students.py` (`get_student`, `_list_item`, `_marks`) | Business assembly inside the router |
| Shared field lists | `MARK_FIELDS` and `REQUIRED_COLUMNS` in `importer/validators.py` | `models.py`, `grading.py`, the students router and the seed script all import from the CSV validator, so the models layer depends on the importer (wrong direction) |
| Models / schemas | `models.py` (3 tables), `schemas.py` (all responses) | Single files mixing two domains (imports, students) |

**Frontend**
- `pages/ImportPage.tsx` (419 lines) holds 10 components. `pages/StudentsPage.tsx` (375) has URL-state logic plus 5 components. `pages/StudentReportPage.tsx` (259) has 4 components plus helpers.
- React Query calls and query keys are inline in pages. `ImportPage` invalidates the `'students'`, `'student'` and `'imports'` keys defined in other pages, a hidden coupling.
- The error alert markup (`alertError` + title + message + retry button) is copied 4 times.
- `format.ts` mixes formatters with domain constants (`FIELD_LABELS`, `REQUIRED_COLUMNS`). `ui.ts` and `index.css` are styles.

## Phase 2: proposed structure

### Backend: `backend/app/`
```
app/
  main.py                 create_app(): error handlers, routers, SPA; `app` instance (unchanged role)
  frontend.py             serves frontend/dist + SPA fallback (unchanged)
  core/                   app-wide foundations, no business rules
    config.py             ← app/config.py
    database.py           ← app/db.py (engine, SessionLocal, get_session)
    errors.py             ← app/errors.py (AppError + JSON error handlers)
    student_fields.py     NEW: MARK_FIELDS, REQUIRED_COLUMNS (moved out of validators.py)
  api/                    HTTP layer: parse request → call repo/service → shape response
    deps.py               ← app/deps.py (SessionDep, TodayDep, get_today)
    routes/
      health.py           GET /api/health (moved out of main.py)
      imports.py          ← routers/imports.py, SQL removed
      students.py         ← routers/students.py, SQL + assembly removed
      grading.py          GET /api/grading-scheme (moved out of students router)
  models/                 SQLAlchemy tables
    __init__.py           re-exports Base, Import, ImportProblem, Student, IMPORT_STATUSES (Alembic needs all tables registered)
    base.py               Base + naming convention
    imports.py            Import, ImportProblem (kept together: relationship pair)
    student.py            Student
  schemas/                Pydantic response shapes
    common.py             Page[T]
    imports.py            ImportSummary, ProblemOut, ImportResult
    students.py           StudentListItem, SubjectMark, StudentReport, GradeBand, GradingScheme
  repositories/           all SQL; never commits (caller owns the transaction)
    imports.py            get_import, list_imports, problem_page, all_problems, insert_problems
    students.py           get_student, search_students (+ sort map, percentage SQL, LIKE escape), upsert_students (+ BATCH_SIZE, _upsert_batch)
  services/               business logic
    grading.py            ← app/grading.py (pure)
    students.py           build_report, build_list_item, grading_scheme (← router assembly code)
    imports.py            run_import, ImportFailed, _record_failure (← importer/service.py, SQL moved to repositories; owns commit/rollback)
    csv_import/           pure CSV rules, no database
      parser.py           ← importer/parser.py
      validators.py       ← importer/validators.py (minus the two constants)
      pipeline.py         ← importer/pipeline.py
      report.py           ← importer/report.py
alembic/                  unchanged (env.py import paths updated)
seed/                     unchanged (one import updated)
tests/                    stay flat; imports and two monkeypatch targets updated
```

**Layer rules:**
- Routes handle HTTP only: params, status codes, mapping errors to `AppError`, response models.
- Services hold business rules and transaction control. Repositories hold SQL. `csv_import` is pure.
- Plain reads (list imports, problem pages) go route → repository directly. A pass-through service would add nothing.
- Dependencies point one way: `api → services → repositories → models → core`. `services/csv_import` and `services/grading` depend only on `core`.
- I'm keeping `__init__.py` files empty except `models/__init__.py`.

### Frontend: `frontend/src/`
Organized by layer. Shared pieces are at the top level, and components used by only one feature sit in a feature folder. With 4 pages, full `features/` modules would be more structure than the app needs.
```
src/
  main.tsx                 entry: QueryClient + RouterProvider (unchanged)
  router.tsx               routes (unchanged)
  api/
    client.ts              axios instance, ApiError, toApiError, cleanParams
    types.ts               response types (mirror backend/app/schemas/)
    index.ts               the `api` object; re-exports ApiError + types, so `from '../api'` still works
  hooks/
    useDebouncedValue.ts   ← hooks.ts
    queries.ts             NEW: queryKeys + useStudents, useStudent, useGradingScheme, useImports,
                           useImportProblems, useUploadImport (owns the post-import invalidation)
    useStudentListParams.ts NEW: readParams + update() URL state + list constants (← StudentsPage)
  components/
    Layout.tsx, Pagination.tsx   (moved as-is)
    ErrorAlert.tsx         NEW: the one shared error box (title, message, onRetry, retryLabel)
    imports/               FileDrop, UploadProgress, UploadError, ImportOutcome (+Stat),
                           ProblemsTable (+ProblemRow), RecentImports (+HistoryRow)
    students/              SearchBox, StudentsTable (+SortableHeader), SkeletonTable,
                           OverallCard (+failReasons), MarksTable, SchemeNote
  pages/                   ImportPage, StudentsPage, StudentReportPage, NotFoundPage (thin: compose + state)
  utils/
    format.ts              ← format.ts minus constants (+ formatMark, initials from report page)
  constants/
    fields.ts              FIELD_LABELS, REQUIRED_COLUMNS (← format.ts)
  styles/
    index.css              ← index.css
    ui.ts                  ← ui.ts
```

## File mapping (moves, splits, merges)

**Backend moves and renames**
- `config.py`, `errors.py` → `core/`
- `db.py` → `core/database.py`
- `deps.py` → `api/deps.py`
- `routers/*` → `api/routes/*`
- `grading.py` → `services/grading.py`
- `importer/{parser,validators,pipeline,report}.py` → `services/csv_import/`
- `importer/service.py` → `services/imports.py`
- Delete the then-empty `routers/` and `importer/` packages. No compatibility shims or duplicate modules.

**Backend splits**
- `models.py` → `models/{base,imports,student}.py`
- `schemas.py` → `schemas/{common,imports,students}.py`
- The router SQL → `repositories/*`
- The SQL in `importer/service.py` → `repositories/{students,imports}.py`
- `validators.py` constants → `core/student_fields.py`
- Health route out of `main.py`; grading-scheme route out of the students router

**Frontend moves**
- `components/{Layout,Pagination}.tsx` stay where they are.
- `hooks.ts` → `hooks/useDebouncedValue.ts`
- `ui.ts`, `index.css` → `styles/`

**Frontend splits**
- `api.ts` → `api/`
- `format.ts` → `utils/format.ts` + `constants/fields.ts`
- Each page's inner components go to `components/{imports,students}/`. Their query calls go to `hooks/queries.ts`. StudentsPage's URL-state logic goes to `hooks/useStudentListParams.ts`.

**Merges:** the 4 copied error boxes become `ErrorAlert`. Button text stays exactly as it is now: "Try again" on Import, "Retry" on Students and Report, via `retryLabel`.

**Moved code is moved verbatim.** The only edits are import paths, plus turning inline values into function parameters where a function crosses a file boundary.

**Docs and config**
- README: "Project layout" section and the `backend/app/schemas.py` mention.
- The `api.ts` header comment.
- `tests/*`, `seed/generate.py` and `alembic/env.py` import paths.
- No change needed in: Dockerfile and compose (`uvicorn app.main:app` and `alembic upgrade head` are unchanged), `pyproject.toml` (`include = ["app*"]` already covers subpackages), env vars, `vite.config.ts`, tsconfig.
- `PLAN.md` stays as the historical build plan; I'll add one line at the top saying the paths reflect the original layout.

## Risks and how they're handled
1. **Alembic must still see every table.** `alembic/env.py` imports `app.models`, whose `__init__` imports all model modules. Proof: `alembic check` reports no schema difference.
2. **The `Import` ↔ `ImportProblem` relationship** resolves by class name. Both stay in `models/imports.py`, and `Student`'s FK uses the table name, so nothing breaks.
3. **Tests patch module globals:** `service.BATCH_SIZE` and `service._upsert_batch` (rollback test). They move to `repositories/students.py`. `upsert_students` must keep looking those names up at call time, which it already does. The tests are retargeted to the new module, and the patched behaviour stays the same.
4. **`conftest.py` sets `DATABASE_URL` before importing the app.** The new `app.core.database` still reads settings at import time, so the order is preserved.
5. **Transaction ownership:** repositories only `execute`/`flush`. `run_import` keeps its single commit, rollback on `SQLAlchemyError`, and failure record. The concurrency and rollback tests cover this.
6. **Route order:** routers are included in the same order, and the SPA catch-all stays last. Moving `/api/health` and `/api/grading-scheme` into their own routers keeps the same paths, methods, tags and response models. Proof: the OpenAPI JSON diff is empty.
7. **Circular imports:** `repositories/students.py` uses `services.grading.MAX_TOTAL` for the sort SQL. `grading` imports only `core`, so there's no cycle. I'll check by importing every module fresh.
8. **Frontend `verbatimModuleSyntax`:** type re-exports in `api/index.ts` must use `export type`. The `oxlint` rule `react/only-export-components` means hooks and constants stay out of component files, which the plan already does.

## Execution order (each step leaves tests green)
1. Snapshot before: `openapi.json` and the route table into the scratchpad; record the pytest result.
2. Backend `core/`, `models/`, `schemas/` → update imports → pytest.
3. Backend `repositories/` + `services/` (including `csv_import`) → pytest.
4. Backend `api/` → pytest + OpenAPI diff.
5. Frontend `api/`, `utils`/`constants`/`styles`/`hooks` → typecheck.
6. Frontend component and page splits → lint, typecheck, build.
7. Docs.

No commits unless you ask.

## Verification
- `pytest` (298 tests, same count, all pass)
- Every `app.*` module imports cleanly, checked with a script that imports each one in turn
- `alembic check` reports no differences
- `/openapi.json` before and after are identical
- The route list is the same
- `uvicorn app.main:app` starts; `/api/health` responds normally; `/students/STU00001` returns the app's main page
- Frontend:
  - `npm run lint`, `npm run typecheck`, `npm run build`
  - `npm run dev` starts and the `/api` proxy works
- `docker compose up --build`: the container starts healthy (migrations run, the app serves)
- Browser pass over Import (upload `students_sample.csv`, expect 5,000 / 4,685 / 315; problem pages; CSV download; recent imports), Students (search, filters, sort, paging, back navigation) and Report (marks, pass/fail, 404 state), compared against the current UI
