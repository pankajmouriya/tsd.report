from datetime import UTC, datetime

import httpx

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
