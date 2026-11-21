"""Error report download and import history."""

import csv
import io

import pytest

from app.importer.report import report_filename, spreadsheet_safe
from tests.helpers import FIXTURES, HEADER, row


def upload(client, content: bytes, name: str = "students.csv"):
    return client.post("/api/imports", files={"file": (name, content, "text/csv")})


def read_report(response) -> list[list[str]]:
    text = response.content.decode("utf-8")
    assert text.startswith("﻿")  # Excel needs the BOM to read UTF-8
    return list(csv.reader(io.StringIO(text.lstrip("﻿"))))


# --- formula injection guard ----------------------------------------------------


@pytest.mark.parametrize(
    "value, expected",
    [
        ("=HYPERLINK(\"http://x\",\"click\")", "'=HYPERLINK(\"http://x\",\"click\")"),
        ("+cmd", "'+cmd"),
        ("@SUM(A1)", "'@SUM(A1)"),
        ("-x", "'-x"),
        ("-5 is outside the allowed range 0 to 100", "'-5 is outside the allowed range 0 to 100"),
        ("\tTAB", "'\tTAB"),
        ("-5", "-5"),  # plain numbers stay readable
        ("+12.5", "+12.5"),
        ("STU00001", "STU00001"),
        ('"sana@example" is not a valid email address', '"sana@example" is not a valid email address'),
        ("", ""),
    ],
)
def test_cells_that_would_run_as_formulas_are_neutralised(value, expected):
    assert spreadsheet_safe(value) == expected


@pytest.mark.parametrize(
    "uploaded, expected",
    [
        ("students_sample.csv", "students_sample-problems.csv"),
        ('evil"; filename=x.exe', "evil_filename_x-problems.csv"),
        ("Term 2 results (final).csv", "Term_2_results_final-problems.csv"),
        ("", "import-problems.csv"),
        ("...", "import-problems.csv"),
    ],
)
def test_report_filename_is_safe_for_the_download_header(uploaded, expected):
    assert report_filename(uploaded) == expected


# --- download -------------------------------------------------------------------


def test_report_lists_every_problem_in_line_order(client):
    import_id = upload(client, (FIXTURES / "students_small.csv").read_bytes(), "students_small.csv").json()[
        "summary"
    ]["id"]

    response = client.get(f"/api/imports/{import_id}/problems.csv")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="students_small-problems.csv"'
    rows = read_report(response)
    assert rows[0] == ["row", "student_id", "column", "problem", "code", "value"]
    assert len(rows) == 1 + 9
    assert rows[1] == [
        "4",
        "STU00003",
        "date_of_birth",
        "1970-01-01 makes the student 56 years old; students must be 5 to 25",
        "OUT_OF_RANGE",
        "1970-01-01",
    ]
    assert [r[0] for r in rows[1:]] == ["4", "5", "6", "9", "10", "14", "15", "18", "21"]
    assert rows[6][2] == "(whole row)"  # wrong field count


def test_report_neutralises_formulas_from_the_uploaded_file(client):
    content = ("\n".join([HEADER, row(full_name="=HYPERLINK(1)", maths="-5")]) + "\n").encode()
    import_id = upload(client, content).json()["summary"]["id"]

    rows = read_report(client.get(f"/api/imports/{import_id}/problems.csv"))

    values = {r[2]: r for r in rows[1:]}
    assert values["full_name"][5] == "'=HYPERLINK(1)"
    assert values["maths"][3] == "'-5 is outside the allowed range 0 to 100"
    assert values["maths"][5] == "-5"


def test_report_for_an_import_without_problems_has_only_the_header(client):
    import_id = upload(client, ("\n".join([HEADER, row()]) + "\n").encode()).json()["summary"]["id"]
    assert read_report(client.get(f"/api/imports/{import_id}/problems.csv")) == [
        ["row", "student_id", "column", "problem", "code", "value"]
    ]


def test_report_for_unknown_import_is_404(client):
    response = client.get("/api/imports/999/problems.csv")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "IMPORT_NOT_FOUND"


# --- history --------------------------------------------------------------------


def test_imports_are_listed_newest_first_including_failures(client):
    upload(client, (FIXTURES / "students_small.csv").read_bytes(), "first.csv")
    upload(client, b"name,marks\n", "broken.csv")
    upload(client, ("\n".join([HEADER, row()]) + "\n").encode(), "third.csv")

    body = client.get("/api/imports").json()

    assert body["total"] == 3
    assert [(i["filename"], i["status"]) for i in body["items"]] == [
        ("third.csv", "completed"),
        ("broken.csv", "failed"),
        ("first.csv", "completed"),
    ]
    assert body["items"][1]["file_error_code"] == "MISSING_COLUMNS"
    assert body["items"][2]["rejected"] == 9


def test_import_history_pages(client):
    for i in range(3):
        upload(client, ("\n".join([HEADER, row(student_id=f"STU{i:05d}")]) + "\n").encode(), f"f{i}.csv")
    page = client.get("/api/imports", params={"page": 2, "page_size": 2}).json()
    assert (page["total"], [i["filename"] for i in page["items"]]) == (3, ["f0.csv"])
    assert client.get("/api/imports", params={"page_size": 51}).status_code == 422
