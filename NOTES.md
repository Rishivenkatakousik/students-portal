# Notes

## Stack and why

- **FastAPI (Python 3.13) with the standard `csv` module.** The import rules are the core of the task, and the standard library gets them right: exact line numbers, strict quoting, exact decimals. Not pandas: it pads short rows (hiding wrong field counts), renumbers lines around blanks, and converts `"09"` or `""` before they can be reported.
- **PostgreSQL, SQLAlchemy 2.** Tables are created from the models on start-up; no migration tool, since the schema is fixed. `INSERT … ON CONFLICT` makes re-uploads an upsert that counts new / updated / unchanged. CHECK constraints back up the validation; trigram indexes make search fast. Dependencies are pinned in `backend/requirements.lock`.
- **React, TypeScript, Vite, TanStack Query, shadcn/ui.** FastAPI serves the built app: one container, one origin, no CORS.

## What counts as a valid row

**A row is imported when it has the header's number of fields, every required column passes its rule, and its ID has not appeared on an earlier line of the file.** Otherwise the whole row is rejected and the administrator sees every problem in it: line, column, value, plain reason and code, on screen and as a CSV.

- **Duplicates:** the first row with an ID wins *even if it was invalid*, and IDs ignore case.
- **Strict formats:** dates only `YYYY-MM-DD` or `DD/MM/YYYY` with two-digit day and month; ASCII digits, no `+` sign or exponent (`+50`, `+9`, `1e3`, `82/100`, `N/A` rejected; `09` fine; class `9.0` rejected). Section `Z` is INVALID_FORMAT: not a section letter at all, rather than a number out of range.
- **Names:** any Unicode letters including combining marks (Hindi vowel signs), plus `' ’ , . -`. **Emails:** ASCII with a dotted domain.
- **Age 5–25** in whole years on the server's date (UTC in Docker); tests pin the date.
- **Broken quotes reject one row.** An unclosed quote would make csv run the following lines together until some later quote, silently losing them; instead that one line is rejected (its ID still shown) and reading restarts on the next line. A value legitimately spanning lines, with the right field count, is kept.
- **Blank and all-empty rows are skipped**, whatever their comma count. Line numbers count every line; a value spanning lines is reported at its first line. A stray NUL character invalidates only its cell.

## Bad files, re-uploads, large files

- **Whole-file errors** (nothing imported, each with a plain fix): empty, over 10 MB, not UTF-8 (including UTF-16), unreadable header, missing or duplicate columns, wrong separator, or a header but no student rows.
- **Re-uploads:** a student in a later file is updated, identical data is unchanged (the same file twice: `0 new, 0 updated`, every row unchanged). The last file uploaded wins, even an older export. Students missing from a file are kept.
- **Each import is one transaction:** a failure imports nothing and is recorded. Rows are saved in ID order; without that, simultaneous uploads deadlocked in testing.
- **Error report CSV:** uploaded cells starting with `= + - @` are made inert (CSV injection).
- **10 MB limit** (`MAX_UPLOAD_MB`), enforced by the server and published to the browser so it can refuse a file before sending it. Imports run in the request: 5,000 rows take ~0.6 s, a full 10 MB file (~140,000 rows) ~19 s, with upload progress shown.

## Grading scheme

Percentage = total / 500, one decimal. The grade uses the shown value, so "80.0%" is never a B: **A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 40, F below.** **Pass = 40% overall and at least 33 in every subject**; the report names failing subjects.

## How I know the import works

A test per data trap and per hostile file (stray quotes, NUL, UTF-16, JSON); a seed generator that knows which rows it broke matches the importer line by line. Screens were checked by hand in Chrome, not scripted.

## Missing, and next

- **Missing:** sign-in, editing or deleting students, browsing a past import's problems in the UI (its CSV downloads), accent-insensitive search, frontend tests, CI.
- **Next:** sign-in; Playwright and CI; background imports for bigger files; a request-size limit before the body is read.
- **Trade-offs:** the image (~380 MB) includes pytest and Faker so tests and seeding run in it; page-number pagination suits thousands of students, not millions.
