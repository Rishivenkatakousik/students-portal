# Notes

## Stack and why

- **FastAPI (Python 3.13) with the standard `csv` module.** The import rules are the core of the task, and the standard library gets the hard parts right: strict dates, CSV quoting, exact decimals. Not pandas: it pads short rows with NaN (hiding wrong field counts), renumbers lines around blanks, and converts `"09"` or `""` before they can be reported.
- **PostgreSQL, SQLAlchemy 2, Alembic.** `INSERT … ON CONFLICT` turns re-uploads into an upsert that reports new / updated / unchanged. CHECK constraints back up the validation; trigram indexes make search fast.
- **React, TypeScript, Vite, TanStack Query, Tailwind, axios.** FastAPI serves the built app: one container, one origin, no CORS.

## Decisions on the rules

- **Duplicates:** the first row with an ID wins *even if it was invalid*, and IDs ignore case (`stu00533` repeats `STU00533`). The sample confirms both: the other readings give 4,687 and 4,707 imported, not 4,685.
- **Every problem in a row is reported**, but the row counts once. Messages quote the value and say what's allowed.
- **Strict formats:** dates only `YYYY-MM-DD` or `DD/MM/YYYY`; marks must look like numbers (`1e3`, `82/100`, `N/A` rejected, though `float()` accepts `1e3`); grades are whole numbers (`09` yes, `9.0` and `IX` no); ASCII digits only.
- **Names** allow any Unicode letters including combining marks (Hindi vowel signs aren't `isalpha`), plus `' ’ , . -`. **Emails** must be ASCII with a dotted domain.
- **Age 5–25** in whole years on the server's date. The sample's counts hold for any date from 26 Dec 2025 to at least March 2028; tests pin the date.
- **Whole-file errors** with a plain fix: empty, over 10 MB, not UTF-8, missing or duplicate columns, wrong separator, or **a quote never closed**, which Python's csv would otherwise silently use to swallow every later row. A broken quote inside one row rejects only that row.
- **Blank and all-empty rows are skipped** even with the wrong comma count (the small file's `,,,,,,,,,,`). Line numbers count every line; a multi-line value is reported at its first line.

## Re-uploads, failures, large files

- A student in a later file is **updated**; identical data is **unchanged**, so the same file twice gives `0 new, 0 updated, 4,685 unchanged`. Students missing from a file are kept.
- **Each import is one transaction:** a failure part-way imports nothing and is recorded. Rows are saved in ID order; without that, two simultaneous uploads deadlocked in testing.
- **10 MB limit**, checked in the browser and the server. Imports run in the request: 5,000 rows take about 0.7 s, 50,000 about 6 s. The UI shows upload progress.

## Grading scheme

Percentage = total / 500, one decimal place. The grade uses the shown value, so "80.0%" is never a B: **A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 40, F below.** **Pass = 40% overall and at least 33 in every subject**; the report names any failing subject. The UI reads the scheme from the API.

## How I know the import works

Exact counts for both sample files, plus every small-file problem by line and code. The 348 problems in 315 rows match the brief's sketch ("first 50 of 348"). There's a test for every trap in PLAN.md, and deliberately breaking rules confirmed the tests catch it. A seed generator that knows which rows it broke matches the importer line by line across many seeds. The screens were checked in a headless browser (empty, error, phone, print); those scripts aren't committed.

## Missing, and next

- **Missing:** sign-in, downloading errors as CSV, a past-imports page (the API stores them), editing or deleting students, accent-insensitive search ("Zoe" misses "Zoë"), committed frontend tests, CI.
- **Next:** admin sign-in; error-report download; Playwright tests and CI; background imports with progress for much larger files; `unaccent` search.
- **Trade-offs:** the image (~380 MB) includes pytest and Faker so tests and seeding run in it; ages use the server's date (UTC in Docker); page-number pagination suits thousands of students, not millions.
