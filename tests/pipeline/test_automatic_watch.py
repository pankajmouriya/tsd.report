import json
from pathlib import Path

import pytest

from pipeline.cli import main

CANDIDATE = Path(__file__).parents[1] / "fixtures/vulnerability-watch/candidate.json"
RUN = "https://github.com/pankajmouriya/tsd.report/actions/runs/12345"


def publish(tmp_path, candidate=None, run=RUN):
    source = tmp_path / "candidate.json"
    source.write_text(json.dumps(candidate or json.loads(CANDIDATE.read_text())))
    output = tmp_path / "published.json"
    main(
        [
            "publish-automatic",
            "--input",
            str(source),
            "--output",
            str(output),
            "--workflow-run",
            run,
            "--published-at",
            "2026-10-02T07:00:00Z",
        ]
    )
    return output


def test_automatic_publication_records_automation_without_a_human_review(tmp_path):
    output = publish(tmp_path)
    value = json.loads(output.read_text())
    assert value["schema_version"] == 2
    assert value["status"] == "published"
    assert value["publication"] == {
        "method": "automated",
        "workflow_run": RUN,
        "published_at": "2026-10-02T07:00:00Z",
    }
    assert not {"reviewed_by", "reviewed_at", "review_pr"} & value.keys()
    assert value["selection"] == json.loads(CANDIDATE.read_text())["selection"]
    assert value["entries"] == json.loads(CANDIDATE.read_text())["entries"]
    before = output.read_bytes()
    timestamp = output.stat().st_mtime_ns
    assert publish(tmp_path).read_bytes() == before
    assert output.stat().st_mtime_ns == timestamp


def test_automatic_publication_preserves_an_existing_dated_snapshot(tmp_path):
    output = publish(tmp_path)
    before = output.read_bytes()
    candidate = json.loads(CANDIDATE.read_text())
    candidate["generated_at"] = "2026-10-02T06:21:00Z"
    with pytest.raises(ValueError, match="immutable"):
        publish(tmp_path, candidate)
    assert output.read_bytes() == before


@pytest.mark.parametrize("change", ["fixture", "stale", "future", "failed-source", "foreign-run"])
def test_invalid_automatic_publication_never_writes(tmp_path, change):
    value = json.loads(CANDIDATE.read_text())
    run = RUN
    if change == "fixture":
        value["fixture"] = True
    if change == "stale":
        value["sources"][1]["data_date"] = "2026-09-29"
    if change == "future":
        value["generated_at"] = "2026-10-03T06:00:00Z"
    if change == "failed-source":
        value["sources"][0].update(status="degraded", error="Unavailable")
    if change == "foreign-run":
        run = "https://example.com/actions/runs/12345"
    with pytest.raises(ValueError):
        publish(tmp_path, value, run)
    assert not (tmp_path / "published.json").exists()


def test_collection_retrieval_can_follow_the_run_start(tmp_path):
    value = json.loads(CANDIDATE.read_text())
    for source in value["sources"]:
        source["retrieved_at"] = "2026-10-02T06:18:00Z"
    assert publish(tmp_path, value).exists()


def test_future_source_retrieval_is_rejected(tmp_path):
    value = json.loads(CANDIDATE.read_text())
    value["sources"][0]["retrieved_at"] = "2026-10-02T07:01:00Z"
    with pytest.raises(ValueError):
        publish(tmp_path, value)
    assert not (tmp_path / "published.json").exists()
