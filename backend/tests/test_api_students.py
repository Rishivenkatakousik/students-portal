"""Students list and report API against a real Postgres."""

import pytest

from tests.helpers import FIXTURES, HEADER, row


def load(client, *lines: str) -> None:
    content = ("\n".join([HEADER, *lines]) + "\n").encode()
    response = client.post("/api/imports", files={"file": ("s.csv", content, "text/csv")})
    assert response.status_code == 201, response.text
    assert response.json()["summary"]["rejected"] == 0


@pytest.fixture
def school(client):
    load(
        client,
        row(student_id="STU00001", full_name="Rohan Kaur", grade_level="9", section="D"),
        row(student_id="STU00002", full_name="Zoë D'Souza", grade_level="9", section="B",
            maths="90", science="85", english="88", social_studies="92", second_language="95"),
        row(student_id="STU00003", full_name="Ishaan Menon", grade_level="6", section="B",
            maths="20", science="60", english="60", social_studies="60", second_language="60"),
        row(student_id="ABC-7", full_name='"Kaur, Simran"', grade_level="9", section="B"),
    )  # fmt: skip
    return client


def ids(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [s["student_id"] for s in response.json()["items"]]


# --- list ----------------------------------------------------------------------


def test_list_is_sorted_by_id_and_paginated(school):
    body = school.get("/api/students").json()
    assert body["total"] == 4
    assert (body["page"], body["page_size"]) == (1, 25)
    assert [s["student_id"] for s in body["items"]] == ["ABC-7", "STU00001", "STU00002", "STU00003"]
    assert body["items"][1] == {
        "student_id": "STU00001",
        "full_name": "Rohan Kaur",
        "grade_level": 9,
        "section": "D",
        "percentage": 42.1,  # 43 + 34 + 42 + 51.7 + 40 = 210.7
        "grade": "D",
        "passed": True,
    }


@pytest.mark.parametrize(
    "q, expected",
    [
        ("rohan", ["STU00001"]),
        ("KAUR", ["ABC-7", "STU00001"]),  # case-insensitive, matches "Kaur, Simran" too
        ("  rohan   kaur ", ["STU00001"]),  # extra spaces ignored
        ("d'souza", ["STU00002"]),
        ("0000", ["STU00001", "STU00002", "STU00003"]),  # part of an ID
        ("abc-7", ["ABC-7"]),
        ("%", []),  # SQL wildcards match literally
        ("_", []),
        ("nobody", []),
        ("", ["ABC-7", "STU00001", "STU00002", "STU00003"]),
    ],
)
def test_search_by_name_or_id(school, q, expected):
    assert ids(school.get("/api/students", params={"q": q})) == expected


def test_filter_by_class_and_section(school):
    assert ids(school.get("/api/students", params={"grade_level": 9})) == ["ABC-7", "STU00001", "STU00002"]
    assert ids(school.get("/api/students", params={"grade_level": 9, "section": "b"})) == ["ABC-7", "STU00002"]
    assert ids(school.get("/api/students", params={"q": "kaur", "section": "D"})) == ["STU00001"]


@pytest.mark.parametrize(
    "sort, expected",
    [
        ("-student_id", ["STU00003", "STU00002", "STU00001", "ABC-7"]),
        ("name", ["STU00003", "ABC-7", "STU00001", "STU00002"]),
        ("-percentage", ["STU00002", "STU00003", "ABC-7", "STU00001"]),  # tie broken by ID
        ("class", ["STU00003", "ABC-7", "STU00002", "STU00001"]),
    ],
)
def test_sorting(school, sort, expected):
    assert ids(school.get("/api/students", params={"sort": sort})) == expected


def test_failed_subject_shows_in_list(school):
    items = {s["student_id"]: s for s in school.get("/api/students").json()["items"]}
    assert items["STU00003"]["grade"] == "C"  # 52%
    assert items["STU00003"]["passed"] is False  # maths 20


def test_page_past_the_end_is_empty_not_an_error(school):
    body = school.get("/api/students", params={"page": 5, "page_size": 2}).json()
    assert (body["items"], body["total"]) == ([], 4)


def test_empty_database(client):
    assert client.get("/api/students").json() == {"items": [], "total": 0, "page": 1, "page_size": 25}


@pytest.mark.parametrize(
    "params",
    [{"grade_level": 13}, {"grade_level": "nine"}, {"section": "Z"}, {"page": 0}, {"page": 10**20}, {"page_size": 101}, {"sort": "email"}],
)
def test_invalid_query_parameters_are_explained(client, params):
    response = client.get("/api/students", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_paging_through_the_sample_by_percentage_is_complete_and_ordered(client):
    # Real data has many students with the same percentage; every one must
    # appear exactly once, and SQL's sort must agree with the displayed value.
    client.post("/api/imports", files={"file": ("s.csv", (FIXTURES / "students_sample.csv").read_bytes())})
    seen, percentages, page = [], [], 1
    while True:
        items = client.get("/api/students", params={"sort": "-percentage", "page": page, "page_size": 100}).json()["items"]
        if not items:
            break
        seen += [s["student_id"] for s in items]
        percentages += [s["percentage"] for s in items]
        page += 1

    assert len(seen) == len(set(seen)) == 4685
    assert percentages == sorted(percentages, reverse=True)


# --- report --------------------------------------------------------------------


def test_report_has_details_marks_and_result(school):
    body = school.get("/api/students/STU00003").json()

    assert body["full_name"] == "Ishaan Menon"
    assert (body["grade_level"], body["section"]) == (6, "B")
    assert body["date_of_birth"] == "2012-04-20"
    assert body["age"] == 14  # on the pinned test date, 2026-11-21
    assert body["marks"][0] == {"subject": "maths", "label": "Maths", "mark": 20.0, "passed": False}
    assert [m["label"] for m in body["marks"]] == ["Maths", "Science", "English", "Social studies", "Second language"]
    assert (body["total"], body["max_total"], body["percentage"], body["grade"]) == (260.0, 500, 52.0, "C")
    assert body["passed"] is False
    assert body["failed_subjects"] == ["Maths"]


def test_report_id_is_case_insensitive(school):
    assert school.get("/api/students/stu00002").json()["student_id"] == "STU00002"


def test_unknown_student_is_404_with_a_message(school):
    response = school.get("/api/students/NOPE123")
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "STUDENT_NOT_FOUND",
        "message": 'There is no student with ID "NOPE123".',
    }


def test_unknown_student_message_does_not_echo_a_huge_id(client):
    message = client.get("/api/students/" + "A" * 5000).json()["error"]["message"]
    assert len(message) < 100


def test_grading_scheme_is_published(client):
    body = client.get("/api/grading-scheme").json()
    assert [(b["grade"], b["min_percentage"]) for b in body["bands"]] == [
        ("A", 80.0), ("B", 65.0), ("C", 50.0), ("D", 40.0), ("F", 0.0)
    ]  # fmt: skip
    assert (body["pass_percentage"], body["subject_pass_mark"], body["max_total"]) == (40.0, 33.0, 500)
