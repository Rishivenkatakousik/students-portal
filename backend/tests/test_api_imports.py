"""Import API against a real Postgres: counts, re-uploads, bad files, failures."""

import threading

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.db import SessionLocal
from app.importer import service
from app.models import Import, Student
from tests.helpers import FIXTURES, HEADER, TODAY, row


def upload(client, content: bytes, name: str = "students.csv"):
    return client.post("/api/imports", files={"file": (name, content, "text/csv")})


def csv_bytes(*lines: str) -> bytes:
    return ("\n".join([HEADER, *lines]) + "\n").encode()


def student_count(session) -> int:
    return session.scalar(select(func.count()).select_from(Student))


# --- the sample pack ---------------------------------------------------------


def test_small_file_import(client, db_session):
    response = upload(client, (FIXTURES / "students_small.csv").read_bytes(), "students_small.csv")

    assert response.status_code == 201
    body = response.json()
    summary = body["summary"]
    assert summary["status"] == "completed"
    assert summary["filename"] == "students_small.csv"
    assert (summary["rows_read"], summary["imported"], summary["rejected"]) == (25, 16, 9)
    assert (summary["new"], summary["updated"], summary["unchanged"]) == (16, 0, 0)
    assert body["problems"]["total"] == 9
    assert body["problems"]["items"][0] == {
        "line": 4,
        "student_id": "STU00003",
        "field": "date_of_birth",
        "code": "OUT_OF_RANGE",
        "message": "1970-01-01 makes the student 56 years old; students must be 5 to 25",
        "raw_value": "1970-01-01",
    }
    assert student_count(db_session) == 16


def test_sample_file_import_and_problem_pages(client):
    body = upload(client, (FIXTURES / "students_sample.csv").read_bytes()).json()
    summary = body["summary"]

    assert (summary["rows_read"], summary["imported"], summary["rejected"]) == (5000, 4685, 315)
    assert summary["new"] == 4685
    assert summary["extra_columns"] == ["parent_phone"]
    # 315 rejected rows carry 348 problems (some rows have several) -- the
    # same "showing first 50 of 348" the assignment's sketch shows.
    assert body["problems"]["total"] == 348
    assert len(body["problems"]["items"]) == 50

    last_page = client.get(f"/api/imports/{summary['id']}/problems", params={"page": 4, "page_size": 100}).json()
    assert (last_page["total"], len(last_page["items"])) == (348, 48)
    lines = [p["line"] for p in last_page["items"]]
    assert lines == sorted(lines)


# --- re-uploads ----------------------------------------------------------------


def test_uploading_the_same_file_again_changes_nothing(client, db_session):
    content = (FIXTURES / "students_small.csv").read_bytes()
    upload(client, content)
    first_update = db_session.scalar(select(Student.updated_at).where(Student.student_id == "STU00001"))

    second = upload(client, content).json()["summary"]

    assert (second["new"], second["updated"], second["unchanged"]) == (0, 0, 16)
    assert student_count(db_session) == 16
    db_session.expire_all()
    assert db_session.scalar(select(Student.updated_at).where(Student.student_id == "STU00001")) == first_update


def test_changed_marks_are_updated(client, db_session):
    first = upload(client, csv_bytes(row(), row(student_id="STU00002"))).json()["summary"]
    second = upload(client, csv_bytes(row(maths="99.5"), row(student_id="STU00002"))).json()["summary"]

    assert (second["new"], second["updated"], second["unchanged"]) == (0, 1, 1)
    student = db_session.get(Student, "STU00001")
    assert str(student.maths) == "99.5"
    assert student.last_import_id == second["id"]
    assert db_session.get(Student, "STU00002").last_import_id == first["id"]


def test_id_differing_only_in_case_updates_the_same_student(client, db_session):
    upload(client, csv_bytes(row()))
    summary = upload(client, csv_bytes(row(student_id="stu00001", full_name="Rohan K Kaur"))).json()["summary"]

    assert (summary["new"], summary["updated"]) == (0, 1)
    assert student_count(db_session) == 1
    assert db_session.get(Student, "STU00001").full_name == "Rohan K Kaur"


def test_same_number_written_differently_is_unchanged(client):
    upload(client, csv_bytes(row(maths="58")))
    summary = upload(client, csv_bytes(row(maths="58.00"))).json()["summary"]
    assert (summary["updated"], summary["unchanged"]) == (0, 1)


def test_students_missing_from_a_later_file_are_kept(client, db_session):
    upload(client, csv_bytes(row(), row(student_id="STU00002")))
    upload(client, csv_bytes(row(student_id="STU00003")))
    assert student_count(db_session) == 3


# --- bad files and requests ----------------------------------------------------


def test_bad_file_is_rejected_and_existing_data_is_untouched(client, db_session):
    upload(client, csv_bytes(row()))

    response = upload(client, b"name,marks\nRohan,50\n", "wrong.csv")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "MISSING_COLUMNS"
    assert "student_id" in response.json()["error"]["message"]
    assert student_count(db_session) == 1
    failed = db_session.scalars(select(Import).where(Import.status == "failed")).one()
    assert (failed.filename, failed.file_error_code) == ("wrong.csv", "MISSING_COLUMNS")
    assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize(
    "content, code",
    [
        (b"", "EMPTY_FILE"),
        ("student_id\nMüller\n".encode("latin-1"), "NOT_UTF8"),
        (b"\x89PNG\r\n\x1a\n\x00\x00", "NOT_UTF8"),
        (HEADER.encode(), "NO_DATA_ROWS"),
    ],
)
def test_unusable_files_get_a_clear_error(client, content, code):
    response = upload(client, content)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


def test_file_over_the_limit_is_rejected(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    response = upload(client, csv_bytes(*[row(student_id=f"S{i:05d}") for i in range(20_000)]))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_request_without_a_file_is_explained(client):
    response = client.post("/api/imports")
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "No file was uploaded. Choose a CSV file and try again."


def test_unknown_import_is_404(client):
    response = client.get("/api/imports/999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "IMPORT_NOT_FOUND"
    assert client.get("/api/imports/999/problems").status_code == 404


# --- failures and concurrency --------------------------------------------------


def test_database_failure_mid_import_rolls_everything_back(client, db_session, monkeypatch):
    monkeypatch.setattr(service, "BATCH_SIZE", 2)
    real_upsert = service._upsert_batch
    calls = []

    def fail_on_second_batch(session, values):
        calls.append(1)
        if len(calls) == 2:
            raise OperationalError("UPSERT", {}, Exception("connection lost"))
        return real_upsert(session, values)

    monkeypatch.setattr(service, "_upsert_batch", fail_on_second_batch)

    response = upload(client, csv_bytes(*[row(student_id=f"STU{i:05d}") for i in range(5)]))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "IMPORT_FAILED"
    assert "nothing was imported" in response.json()["error"]["message"]
    assert student_count(db_session) == 0  # first batch was rolled back too
    statuses = db_session.scalars(select(Import.status)).all()
    assert statuses == ["failed"]


def test_concurrent_imports_of_overlapping_students_do_not_deadlock(clean_database):
    # Two files with the same students in opposite order, saved at the same
    # time. Without sorting rows before the upsert, Postgres reports "deadlock
    # detected" here; 3,000 rows x 5 rounds is enough for the two saves to
    # overlap every time (smaller files finish before the other one starts).
    ids = [f"STU{i:05d}" for i in range(3000)]
    files = [
        csv_bytes(*[row(student_id=i, maths="10") for i in ids]),
        csv_bytes(*[row(student_id=i, maths="20") for i in reversed(ids)]),
    ]
    errors: list[Exception] = []
    barrier = threading.Barrier(len(files))

    def run(content: bytes) -> None:
        try:
            with SessionLocal() as session:
                barrier.wait()
                service.run_import(session, filename="x.csv", data=content, today=TODAY, max_bytes=10 << 20)
        except Exception as error:  # noqa: BLE001 -- collected and asserted below
            errors.append(error)

    for _ in range(5):
        threads = [threading.Thread(target=run, args=(f,)) for f in files]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

    assert errors == []
    with SessionLocal() as session:
        assert student_count(session) == 3000
        assert set(session.scalars(select(Import.status))) == {"completed"}
