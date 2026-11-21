"""Decide, row by row, what gets imported and what gets reported.

Order for each record (blank and all-empty rows were already dropped by the parser):

1. record could not be read            -> INVALID_FORMAT for the whole row
2. wrong number of fields              -> WRONG_FIELD_COUNT for the whole row
3. validate every column               -> all problems collected
4. student ID already seen in the file -> DUPLICATE_ID

"Seen" includes earlier rows that were rejected: the README says the *first*
row with an ID is the original, whether or not that row was valid.
"""

from dataclasses import dataclass, field
from datetime import date

from app.importer.parser import ParsedFile
from app.importer.validators import ErrorCode, validate_fields


@dataclass(frozen=True)
class RowProblem:
    line: int
    student_id: str  # as written in the file, trimmed; "" if unknown
    field: str | None  # None = the whole row
    code: ErrorCode
    message: str
    raw_value: str | None = None


@dataclass(frozen=True)
class ValidRow:
    line: int
    data: dict


@dataclass
class PipelineResult:
    rows_read: int = 0
    valid_rows: list[ValidRow] = field(default_factory=list)
    problems: list[RowProblem] = field(default_factory=list)
    rejected: int = 0


def process(parsed: ParsedFile, today: date) -> PipelineResult:
    result = PipelineResult()
    seen_ids: dict[str, int] = {}  # normalised ID -> line of its first appearance
    id_index = parsed.columns["student_id"]

    for record in parsed.records:
        result.rows_read += 1
        raw_id = record.fields[id_index].strip() if id_index < len(record.fields) else ""

        if record.error:
            problems = [_whole_row(record.line, raw_id, ErrorCode.INVALID_FORMAT, record.error.capitalize())]
        elif len(record.fields) != parsed.header_width:
            problems = [
                _whole_row(
                    record.line,
                    raw_id,
                    ErrorCode.WRONG_FIELD_COUNT,
                    f"Expected {parsed.header_width} fields, found {len(record.fields)}",
                )
            ]
        else:
            raw = {name: record.fields[i] for name, i in parsed.columns.items()}
            clean, issues = validate_fields(raw, today)
            problems = [
                RowProblem(record.line, raw_id, i.field, i.code, i.message, i.raw_value) for i in issues
            ]
            key = raw_id.upper()
            if key in seen_ids:
                problems.append(
                    RowProblem(
                        record.line,
                        raw_id,
                        "student_id",
                        ErrorCode.DUPLICATE_ID,
                        f"Duplicate of the student ID on line {seen_ids[key]}; only the first row is used",
                        raw_id,
                    )
                )
            if not problems:
                result.valid_rows.append(ValidRow(record.line, clean))

        if raw_id:
            seen_ids.setdefault(raw_id.upper(), record.line)
        if problems:
            result.rejected += 1
            result.problems.extend(problems)

    return result


def _whole_row(line: int, raw_id: str, code: ErrorCode, message: str) -> RowProblem:
    return RowProblem(line, raw_id, None, code, message)
