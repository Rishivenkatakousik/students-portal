"""Turn uploaded bytes into a header map and numbered records.

Problems that make the whole file unusable raise ``FileError`` (nothing gets
imported). Problems confined to one record are returned as ``Record.error`` so
the rest of the file still imports.

Line numbers are physical lines in the file, header = line 1, blank lines
counted. A record whose quoted value spans several lines is reported at the
line where it starts.
"""

import codecs
import csv
import io
from dataclasses import dataclass
from enum import StrEnum

from app.importer.validators import REQUIRED_COLUMNS


class FileErrorCode(StrEnum):
    EMPTY_FILE = "EMPTY_FILE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    NOT_UTF8 = "NOT_UTF8"
    MALFORMED_CSV = "MALFORMED_CSV"
    MISSING_COLUMNS = "MISSING_COLUMNS"
    DUPLICATE_COLUMNS = "DUPLICATE_COLUMNS"
    NO_DATA_ROWS = "NO_DATA_ROWS"


class FileError(Exception):
    def __init__(self, code: FileErrorCode, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Record:
    line: int
    fields: list[str]
    error: str | None = None  # set when the record itself could not be read


@dataclass(frozen=True)
class ParsedFile:
    columns: dict[str, int]  # required column name -> position in each row
    header_width: int
    extra_columns: list[str]
    records: list[Record]


# csv's default limit is 128 KB per field; uploads are capped well below this
# anyway, so a larger limit only matters for a pathological single field.
csv.field_size_limit(16 * 1024 * 1024)


def parse_csv(data: bytes, max_bytes: int) -> ParsedFile:
    if len(data) > max_bytes:
        raise FileError(
            FileErrorCode.FILE_TOO_LARGE,
            f"The file is larger than the {max_bytes // (1024 * 1024)} MB limit. "
            "Split it into smaller files and upload them one by one.",
        )
    text = _decode(data)
    if not text.strip():
        raise FileError(FileErrorCode.EMPTY_FILE, "The file is empty.")

    records = _read_records(text)
    header_index = next((i for i, r in enumerate(records) if _has_content(r.fields)), None)
    if header_index is None:
        raise FileError(FileErrorCode.EMPTY_FILE, "The file is empty.")
    header = records[header_index]
    if header.error:
        raise FileError(
            FileErrorCode.MALFORMED_CSV,
            f"The header row on line {header.line} could not be read: {header.error}",
        )

    columns, extra_columns = _map_header(header.fields)
    data_records = [r for r in records[header_index + 1 :] if r.error or _has_content(r.fields)]
    if not data_records:
        raise FileError(
            FileErrorCode.NO_DATA_ROWS,
            "The file has a header row but no student rows.",
        )
    return ParsedFile(
        columns=columns,
        header_width=len(header.fields),
        extra_columns=extra_columns,
        records=data_records,
    )


def _decode(data: bytes) -> str:
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        raise FileError(
            FileErrorCode.NOT_UTF8,
            "The file is saved as UTF-16 (Excel 'Unicode Text'). "
            "In Excel use File > Save As > 'CSV UTF-8 (Comma delimited)' and upload again.",
        )
    try:
        return data.decode("utf-8-sig")  # strips a UTF-8 byte order mark if present
    except UnicodeDecodeError as error:
        line = data[: error.start].count(b"\n") + 1
        raise FileError(
            FileErrorCode.NOT_UTF8,
            f"The file is not UTF-8 text (first problem on line {line}). "
            "If it is a spreadsheet, use File > Save As > 'CSV UTF-8 (Comma delimited)'.",
        ) from None


def _read_records(text: str) -> list[Record]:
    # newline="" lets csv see \r\n, \n and lone \r line endings itself, and keeps
    # newlines inside quoted values. strict=True makes an unclosed quote an error
    # instead of silently swallowing the rest of the file into one value.
    reader = csv.reader(io.StringIO(text, newline=""), strict=True, skipinitialspace=True)
    records: list[Record] = []
    last_line = 0
    while True:
        start = last_line + 1
        try:
            fields = next(reader)
        except StopIteration:
            break
        except csv.Error as error:
            if str(error) == "unexpected end of data":
                raise FileError(
                    FileErrorCode.MALFORMED_CSV,
                    f"Line {start} opens a quote (\") that is never closed, so the rest "
                    "of the file cannot be read. Fix that line and upload again.",
                ) from None
            records.append(Record(start, [], error=f"the row could not be read ({error})"))
        else:
            records.append(Record(start, fields))
        last_line = reader.line_num
    return records


def _has_content(fields: list[str]) -> bool:
    return any(field.strip() for field in fields)


def _map_header(header: list[str]) -> tuple[dict[str, int], list[str]]:
    names = [name.strip().lower() for name in header]

    duplicated = sorted({n for n in names if n in REQUIRED_COLUMNS and names.count(n) > 1})
    if duplicated:
        raise FileError(
            FileErrorCode.DUPLICATE_COLUMNS,
            f"These columns appear more than once: {', '.join(duplicated)}. "
            "Keep one of each and upload again.",
        )

    missing = [c for c in REQUIRED_COLUMNS if c not in names]
    if missing:
        raise FileError(FileErrorCode.MISSING_COLUMNS, _missing_columns_message(header, missing))

    columns = {name: names.index(name) for name in REQUIRED_COLUMNS}
    extra = [header[i].strip() for i, n in enumerate(names) if n not in REQUIRED_COLUMNS and n]
    return columns, extra


def _missing_columns_message(header: list[str], missing: list[str]) -> str:
    expected = ", ".join(REQUIRED_COLUMNS)
    if len(header) == 1:
        for separator, name in ((";", "semicolons"), ("\t", "tabs"), ("|", "vertical bars")):
            parts = {part.strip().lower() for part in header[0].split(separator)}
            if set(REQUIRED_COLUMNS) <= parts:
                return (
                    f"The columns are separated by {name} instead of commas. "
                    "Save the file as 'CSV (Comma delimited)' and upload again."
                )
    if len(missing) == len(REQUIRED_COLUMNS):
        return (
            "This doesn't look like a student results file: none of the required columns "
            f"were found in the first row. The first row must be a header with: {expected}."
        )
    return f"The header row is missing required columns: {', '.join(missing)}."
