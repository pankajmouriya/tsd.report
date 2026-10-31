from datetime import UTC, datetime

import httpx

from pipeline.incidents.cli import queue_text
from pipeline.incidents.discovery import discover, parse_entries
from pipeline.incidents.sources import SourceSpec

NOW = datetime(2026, 10, 30, tzinfo=UTC)
SOURCE = {
    "id": "example",
    "name": "Example research",
    "url": "https://example.com/feed.xml",
    "format": "feed",
    "link_hosts": ["example.com"],
}
RSS = (
    b"<rss><channel><item><title>Malicious release investigated</title>"
    b"<link>https://example.com/blog/release?utm_source=rss</link>"
    b"<pubDate>Thu, 29 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>"
)


def test_feed_parsing_preserves_unknown_dates_and_rejects_cross_host_links():
    source = SourceSpec.model_validate(SOURCE)
    assert parse_entries(source, RSS)[0]["published_at"] == "2026-10-29T12:00:00Z"
    atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Security incident</title><link href="https://example.com/blog/alert"/></entry></feed>'
    assert parse_entries(source, atom)[0]["published_at"] is None
    assert parse_entries(source, atom.replace(b"example.com", b"attacker.example")) == []


def test_discovery_is_idempotent_and_conditional_failure_preserves_state(tmp_path):
    responses = [
        httpx.Response(200, content=RSS, headers={"etag": '"one"'}),
        httpx.Response(304),
        httpx.Response(503),
    ]
    requests = []

    def handler(request):
        requests.append(request)
        return responses.pop(0)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    state, manifest = discover([SourceSpec.model_validate(SOURCE)], {}, tmp_path, client=client, now=NOW)
    assert len(state["leads"]) == 1
    assert manifest["sources"][0]["status"] == "ok"
    assert "utm_source" not in state["leads"][0]["url"]
    unchanged, _ = discover([SourceSpec.model_validate(SOURCE)], state, tmp_path, client=client, now=NOW)
    assert unchanged == state
    assert requests[1].headers["if-none-match"] == '"one"'
    failed, manifest = discover([SourceSpec.model_validate(SOURCE)], state, tmp_path, client=client, now=NOW)
    assert failed == state
    assert manifest["sources"][0]["status"] == "failed"


def test_invalid_feed_cannot_erase_previous_leads(tmp_path):
    client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b"<broken")))
    previous = {"schema_version": 1, "sources": {}, "leads": [{"lead_id": "retained"}]}
    state, manifest = discover(
        [SourceSpec.model_validate(SOURCE)], previous, tmp_path, client=client, now=NOW
    )
    assert state == previous
    assert manifest["sources"][0]["status"] == "failed"


def test_commit_streams_are_summarized_separately_from_article_leads():
    state = {
        "leads": [
            {
                "lead_id": "batch-1",
                "source_id": "github-advisories",
                "source_name": "GitHub Advisory Database changes",
                "title": "Publish Advisories",
                "url": "https://github.com/github/advisory-database/commit/one",
                "published_at": "2026-10-31T06:00:00Z",
            },
            {
                "lead_id": "batch-2",
                "source_id": "github-advisories",
                "source_name": "GitHub Advisory Database changes",
                "title": "Publish Advisories",
                "url": "https://github.com/github/advisory-database/commit/two",
                "published_at": "2026-10-31T05:00:00Z",
            },
            {
                "lead_id": "malware-commit",
                "source_id": "openssf-malicious",
                "source_name": "OpenSSF Malicious Packages changes",
                "title": "Ingest OSV - GHSA Malware",
                "url": "https://github.com/ossf/malicious-packages/commit/three",
                "published_at": "2026-10-31T04:00:00Z",
            },
            {
                "lead_id": "report",
                "source_id": "microsoft-security",
                "source_name": "Microsoft Security",
                "title": "Malicious extension investigation",
                "url": "https://www.microsoft.com/en-us/security/blog/report",
                "published_at": "2026-10-31T03:00:00Z",
            },
        ]
    }
    queue = queue_text(state, {"sources": []}, {"groups": {}, "dismissed": []})
    report_section, signal_section = queue.split("## Structured advisory signals")
    assert "Malicious extension investigation" in report_section
    assert "Publish Advisories" not in report_section
    assert "Ingest OSV - GHSA Malware" not in report_section
    assert "2 retained commit signals" in signal_section
    assert "1 retained commit signal" in signal_section
    assert "not confirmed incidents" in signal_section
    assert queue.count("https://github.com/github/advisory-database/commit/") == 1


def test_commit_signal_volume_cannot_evict_article_leads(tmp_path):
    report = {"lead_id": "report", "source_id": "microsoft-security", "changed_at": "2026-10-29T00:00:00Z"}
    commits = [
        {
            "lead_id": f"commit-{index}",
            "source_id": "github-advisories",
            "changed_at": "2026-10-31T00:00:00Z",
        }
        for index in range(500)
    ]
    previous = {"schema_version": 1, "sources": {}, "leads": [*commits, report]}
    client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(304)))
    state, _ = discover([SourceSpec.model_validate(SOURCE)], previous, tmp_path, client=client, now=NOW)
    assert any(lead["lead_id"] == "report" for lead in state["leads"])
    assert len(state["leads"]) <= 500
    assert sum(lead["source_id"] == "github-advisories" for lead in state["leads"]) <= 100


def test_high_volume_advisory_stream_preserves_other_structured_source(tmp_path):
    advisory_commits = [
        {
            "lead_id": f"advisory-{index}",
            "source_id": "github-advisories",
            "changed_at": "2026-10-31T00:00:00Z",
        }
        for index in range(150)
    ]
    malware_commit = {
        "lead_id": "malware",
        "source_id": "openssf-malicious",
        "changed_at": "2026-10-30T00:00:00Z",
    }
    previous = {"schema_version": 1, "sources": {}, "leads": [*advisory_commits, malware_commit]}
    client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(304)))
    state, _ = discover([SourceSpec.model_validate(SOURCE)], previous, tmp_path, client=client, now=NOW)
    assert any(lead["lead_id"] == "malware" for lead in state["leads"])
