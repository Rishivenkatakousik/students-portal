"""The seed generator and the importer must agree on every row.

The generator knows which rows it broke; the importer decides independently.
Matching counts *and* the exact set of rejected lines means neither side is
quietly wrong.
"""

import pytest

from app.services.csv_import.parser import parse_csv
from app.services.csv_import.pipeline import process
from seed.generate import BREAKING, generate, main
from tests.helpers import TODAY


@pytest.mark.parametrize("seed", [1, 7, 42, 2026])
def test_importer_rejects_exactly_the_rows_the_generator_broke(seed):
    generated = generate(rows=2000, error_rate=0.2, seed=seed, today=TODAY)

    parsed = parse_csv(generated.text.encode("utf-8"), 10 * 1024 * 1024)
    result = process(parsed, TODAY)

    assert (result.rows_read, len(result.valid_rows), result.rejected) == (
        generated.expected_read,
        generated.expected_imported,
        generated.expected_rejected,
    )
    assert sorted({p.line for p in result.problems}) == generated.rejected_lines
    assert [c.lower() for c in parsed.extra_columns] == ["parent_phone"]


def test_every_kind_of_breakage_is_generated():
    generated = generate(rows=3000, error_rate=0.5, seed=3, today=TODAY)
    assert set(generated.mutations) == {*BREAKING, "duplicate id"}


def test_harmless_mess_is_present_and_still_imports():
    generated = generate(rows=2000, error_rate=0.0, seed=5, today=TODAY)
    text = generated.text

    assert text.startswith("﻿") and "\r\n" in text
    assert '", ' in text or ', ' in text  # quoted "Last, First" names
    assert "stu0" in text  # lower-case IDs
    assert generated.expected_rejected == 0
    result = process(parse_csv(text.encode(), 10 * 1024 * 1024), TODAY)
    assert result.problems == []


def test_same_seed_gives_the_same_file():
    first = generate(rows=300, error_rate=0.1, seed=11, today=TODAY)
    again = generate(rows=300, error_rate=0.1, seed=11, today=TODAY)
    other = generate(rows=300, error_rate=0.1, seed=12, today=TODAY)
    assert first.text == again.text
    assert first.text != other.text


def test_command_line_writes_the_file(tmp_path, capsys):
    out = tmp_path / "messy.csv"
    assert main(["--rows", "120", "--seed", "9", "--today", TODAY.isoformat(), "--out", str(out)]) == 0
    assert out.read_bytes().startswith(b"\xef\xbb\xbf")
    assert "Expected:  read 120" in capsys.readouterr().out


def test_generated_file_through_the_api(client):
    generated = generate(rows=800, error_rate=0.1, seed=21, today=TODAY)

    response = client.post(
        "/api/imports", files={"file": ("seed.csv", generated.text.encode("utf-8"), "text/csv")}
    )

    summary = response.json()["summary"]
    assert (summary["rows_read"], summary["imported"], summary["rejected"]) == (
        generated.expected_read,
        generated.expected_imported,
        generated.expected_rejected,
    )
    assert summary["new"] == generated.expected_imported
