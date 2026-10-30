import copy
import json
from pathlib import Path

import pytest

from pipeline.incidents.contracts import content_hash, make_publication, validate_candidate

ROOT = Path(__file__).parents[2]


def candidate():
    return json.loads((ROOT / "tests/fixtures/incidents/candidate.json").read_text())


def test_known_synthetic_packet_cannot_lose_its_fixture_marker():
    value = candidate()
    del value["fixture"]
    with pytest.raises(ValueError, match="fixture"):
        validate_candidate(value)


def test_synthetic_candidate_is_valid_but_cannot_be_published():
    value = candidate()
    assert validate_candidate(value)["occurred_at"] is None
    with pytest.raises(ValueError, match="fixture"):
        make_publication(value, {}, "2026-10-30T06:00:00Z")


@pytest.mark.parametrize("field", ["reviewed_by", "reviewed_at", "vulnerabilities", "newsletter"])
def test_drafter_cannot_set_publisher_fields(field):
    value = candidate()
    value[field] = "forged"
    with pytest.raises(ValueError):
        validate_candidate(value)


@pytest.mark.parametrize("mutation", ["claim", "source", "version", "markup", "correction"])
def test_invalid_claims_links_versions_markup_and_corrections_are_rejected(mutation):
    value = candidate()
    if mutation == "claim":
        value["editorial"]["sections"][0]["claim_ids"] = ["invented"]
    elif mutation == "source":
        value["sources"][0]["url"] = "javascript:alert(1)"
    elif mutation == "version":
        value["editorial"]["action"] = "Upgrade to 9.99.7 now."
    elif mutation == "markup":
        value["editorial"]["action"] = "<script>steal()</script>"
    else:
        value["revision"] = 2
    with pytest.raises(ValueError):
        validate_candidate(value)


def test_hash_is_stable_and_changes_when_editorial_copy_changes():
    value = candidate()
    assert content_hash(value) == content_hash(dict(reversed(list(value.items()))))
    changed = copy.deepcopy(value)
    changed["editorial"]["title"] += " updated"
    assert content_hash(changed) != content_hash(value)


def test_version_substrings_and_v_prefixes_do_not_bypass_evidence_checks():
    value = candidate()
    value["facts"][0]["statement"] += " Version 19.99.78 is mentioned."
    value["editorial"]["action"] = "Upgrade to v9.99.7."
    with pytest.raises(ValueError):
        validate_candidate(value)
