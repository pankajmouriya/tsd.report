import json
from pathlib import Path

import httpx
import pytest

from pipeline.incidents.cloudflare import rollback_if_ours
from pipeline.incidents.contracts import make_publication
from pipeline.incidents.sources import fetch
from pipeline.incidents.verify_live import publication_destination, verify_page

ROOT = Path(__file__).parents[2]


def test_served_revision_and_homepage_presence_are_required():
    sha = "a" * 40
    good = f'<meta name="tsd-revision" content="{sha}"><a href="/article/incident">Read</a>'.encode()
    verify_page(good, sha, "/article/incident")
    with pytest.raises(ValueError):
        verify_page(good, "b" * 40)
    with pytest.raises(ValueError):
        verify_page(good, sha, "/article/missing")


def test_external_brief_verifies_its_original_link_and_stable_provenance(tmp_path):
    candidate = json.loads((ROOT / "tests/fixtures/incidents/candidate.json").read_text())
    candidate["schema_version"] = 2
    candidate["incident_id"] = "sample-brief"
    candidate["destination_source_id"] = candidate["sources"][0]["id"]
    candidate["editorial"].pop("sections")
    candidate.pop("fixture")
    candidate["sources"][0]["url"] = "https://nodejs.org/en/security"
    review = {
        "actor": "editor",
        "head_sha": "a" * 40,
        "pr_number": 1,
        "pr_url": "https://github.com/example/newspaper/pull/1",
        "reviewed_at": "2026-10-30T05:30:00Z",
        "review_id": 1,
    }
    record = make_publication(candidate, review, "2026-10-30T06:00:00Z")
    directory = tmp_path / "data/production/incidents/sample-brief"
    directory.mkdir(parents=True)
    (directory / "1.json").write_text(json.dumps(record))
    destination = publication_destination("sample-brief", tmp_path)
    assert destination == "https://nodejs.org/en/security"
    sha = "b" * 40
    home = f'<meta name="tsd-revision" content="{sha}"><a href="{destination}">Read</a>'.encode()
    verify_page(home, sha, destination)
    with pytest.raises(ValueError):
        verify_page(home, sha, "/article/sample-brief")
    with pytest.raises(ValueError):
        publication_destination("missing", tmp_path)


def test_published_legacy_incident_keeps_its_internal_destination(tmp_path):
    candidate = json.loads((ROOT / "tests/fixtures/incidents/candidate.json").read_text())
    candidate["incident_id"] = "sample-article"
    candidate["sources"][0]["url"] = "https://nodejs.org/en/security"
    candidate.pop("fixture")
    review = {
        "actor": "editor",
        "head_sha": "a" * 40,
        "pr_number": 1,
        "pr_url": "https://github.com/example/newspaper/pull/1",
        "reviewed_at": "2026-10-30T05:30:00Z",
        "review_id": 1,
    }
    record = make_publication(candidate, review, "2026-10-30T06:00:00Z")
    directory = tmp_path / "data/production/incidents/sample-article"
    directory.mkdir(parents=True)
    (directory / "1.json").write_text(json.dumps(record))
    assert publication_destination("sample-article", tmp_path) == "/article/sample-article"


def test_live_verification_can_follow_only_bounded_allowlisted_redirects():
    def handler(request):
        if str(request.url).endswith("/story"):
            return httpx.Response(308, headers={"location": "/story/"})
        return httpx.Response(200, content=b"page")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(ValueError):
        fetch(client, "https://example.com/story", hosts={"example.com"})
    assert fetch(client, "https://example.com/story", hosts={"example.com"}, redirects=2)[0] == b"page"
    foreign = httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(302, headers={"location": "https://attacker.example/"})
        )
    )
    with pytest.raises(ValueError):
        fetch(foreign, "https://example.com/story", hosts={"example.com"}, redirects=2)


def test_failed_publication_can_restore_only_its_own_previous_deployment():
    class Pages:
        def __init__(self, sha):
            self.sha, self.restored = sha, None

        def current(self):
            return {"id": "new", "deployment_trigger": {"metadata": {"commit_hash": self.sha}}}

        def rollback(self, deployment):
            self.restored = deployment

    snapshot = {"id": "prior"}
    ours = Pages("a" * 40)
    rollback_if_ours(ours, snapshot, "a" * 40)
    assert ours.restored == snapshot
    other = Pages("b" * 40)
    with pytest.raises(ValueError):
        rollback_if_ours(other, snapshot, "a" * 40)
    assert other.restored is None
