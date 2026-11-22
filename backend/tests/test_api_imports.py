"""Import API against a real Postgres: counts, re-uploads, bad files, failures."""

import threading

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Import, Student
from app.repositories import students as students_repo
from app.services import imports as import_service
from tests.helpers import HEADER, TODAY, row


def upload(client, content: bytes, name: str = "students.csv"):
    return client.post("/api/imports", files={"file": (name, content, "text/csv")})


def csv_bytes(*lines: str) -> bytes:
    return ("\n".join([HEADER, *lines]) + "\n").encode()


def student_count(session) -> int:
    return session.scalar(select(func.count()).select_from(Student))


# --- counts and problems --------------------------------------------------------


def test_import_reports_counts_and_problems(client, db_session):
    content = csv_bytes(
        row(),
        row(student_id="STU00002", date_of_birth="1970-01-01"),
        row(student_id="STU00003", maths="-5"),
    )
    response = upload(client, content, "term2.csv")

    assert response.status_code == 201
    body = response.json()
    summary = body["summary"]
    assert summary["status"] == "completed"
    assert summary["filename"] == "term2.csv"
    assert (summary["rows_read"], summary["imported"], summary["rejected"]) == (3, 1, 2)
    assert (summary["new"], summary["updated"], summary["unchanged"]) == (1, 0, 0)
    assert body["problems"]["total"] == 2
    assert body["problems"]["items"][0] == {
        "line": 3,
        "student_id": "STU00002",
        "field": "date_of_birth",
        "code": "OUT_OF_RANGE",
        "message": '"1970-01-01" makes the student 56 years old; students must be 5 to 25',
        "raw_value": "1970-01-01",
    }
    assert student_count(db_session) == 1


def test_problems_are_paged_in_line_order(client):
    body = upload(client, csv_bytes(*(row(student_id=f"STU{i:05d}", maths="-5") for i in range(120)))).json()

    assert body["problems"]["total"] == 120
    assert len(body["problems"]["items"]) == 50

    import_id = body["summary"]["id"]
    last_page = client.get(f"/api/imports/{import_id}/problems", params={"page": 2, "page_size": 100}).json()
    assert (last_page["total"], len(last_page["items"])) == (120, 20)
    lines = [p["line"] for p in last_page["items"]]
    assert lines == sorted(lines)


# --- re-uploads ----------------------------------------------------------------


def test_uploading_the_same_file_again_changes_nothing(client, db_session):
    content = csv_bytes(row(), row(student_id="STU00002"))
    upload(client, content)
    first_update = db_session.scalar(select(Student.updated_at).where(Student.student_id == "STU00001"))

    second = upload(client, content).json()["summary"]

    assert (second["new"], second["updated"], second["unchanged"]) == (0, 0, 2)
    assert student_count(db_session) == 2
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


def test_nul_characters_are_rejected_and_stored_not_a_server_error(client, db_session):
    # Postgres can't store NUL; the bad value must still reach the problems table.
    response = upload(client, csv_bytes(row(), row(student_id="STU\x0002")))
    assert response.status_code == 201
    summary = response.json()["summary"]
    assert (summary["imported"], summary["rejected"]) == (1, 1)
    assert response.json()["problems"]["items"][0]["code"] == "INVALID_FORMAT"


def test_nul_in_the_file_name_is_dropped(client):
    # Built by hand: the test client would percent-encode the NUL, a browser or curl may not.
    body = (
        b'--b\r\nContent-Disposition: form-data; name="file"; filename="nul\x00.csv"\r\n'
        b"Content-Type: text/csv\r\n\r\n" + csv_bytes(row()) + b"\r\n--b--\r\n"
    )
    response = client.post("/api/imports", content=body, headers={"Content-Type": "multipart/form-data; boundary=b"})
    assert response.status_code == 201
    assert response.json()["summary"]["filename"] == "nul.csv"


@pytest.mark.parametrize(
    "path",
    ["/api/imports/99999999999999999999", "/api/imports/0/problems", "/api/imports?page=100000000000000000000"],
)
def test_out_of_range_numbers_are_422_not_500(client, path):
    response = client.get(path)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_upload_limit_is_published_for_the_browser(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 3)
    assert client.get("/api/imports/limits").json() == {"max_upload_mb": 3}


def test_unknown_import_is_404(client):
    response = client.get("/api/imports/999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "IMPORT_NOT_FOUND"
    assert client.get("/api/imports/999/problems").status_code == 404


# --- failures and concurrency --------------------------------------------------


def test_database_failure_mid_import_rolls_everything_back(client, db_session, monkeypatch):
    monkeypatch.setattr(students_repo, "BATCH_SIZE", 2)
    real_upsert = students_repo._upsert_batch
    calls = []

    def fail_on_second_batch(session, values):
        calls.append(1)
        if len(calls) == 2:
            raise OperationalError("UPSERT", {}, Exception("connection lost"))
        return real_upsert(session, values)

    monkeypatch.setattr(students_repo, "_upsert_batch", fail_on_second_batch)

    response = upload(client, csv_bytes(*[row(student_id=f"STU{i:05d}") for i in range(5)]))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "IMPORT_FAILED"
    assert "nothing was imported" in response.json()["error"]["message"]
    assert student_count(db_session) == 0  # first batch was rolled back too
    statuses = db_session.scalars(select(Import.status)).all()
    assert statuses == ["failed"]


def test_concurrent_imports_of_overlapping_students_do_not_deadlock(clean_database):
    # Same students in opposite order, saved at once: without sorted upserts Postgres
    # reports a deadlock (3,000 rows x 5 rounds makes the saves overlap reliably).
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
                import_service.run_import(session, filename="x.csv", data=content, today=TODAY, max_bytes=10 << 20)
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
