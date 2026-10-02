import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from pipeline.collectors.cisa_kev import CISA_KEV_URL, CisaKevCollector
from pipeline.collectors.epss import EPSS_URL, EpssCollector
from pipeline.collectors.nvd import NVD_URL, NvdCollector
from pipeline.http import BoundedHttpClient, SourceHttpError

RECORDINGS = Path(__file__).parent / "recordings"
NOW = datetime(2026, 10, 2, 6, 20, tzinfo=UTC)


def recorded(name: str) -> dict:
    return json.loads((RECORDINGS / name).read_text())


def client(handler, *, retries: int = 0, max_query_chars: int = 2000) -> BoundedHttpClient:
    return BoundedHttpClient(
        httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False),
        allowed_hosts={"www.cisa.gov", "api.first.org", "services.nvd.nist.gov"},
        clock=lambda: NOW,
        sleeper=lambda _seconds: None,
        retries=retries,
        max_query_chars=max_query_chars,
    )


def test_cisa_collector_parses_authoritative_fields_and_catalog_date() -> None:
    http = client(lambda request: httpx.Response(200, json=recorded("cisa-kev.json"), request=request))
    catalog = CisaKevCollector(http).collect()
    assert catalog.source.id == "cisa-kev"
    assert catalog.source.data_date.isoformat() == "2026-10-02"
    assert [record.cve for record in catalog.records] == ["CVE-2026-12345", "CVE-2026-12346"]
    assert catalog.records[1].known_ransomware_campaign_use == "Known"


def test_cisa_collector_rejects_malformed_or_count_mismatched_catalogs() -> None:
    payload = recorded("cisa-kev.json")
    payload["count"] = 20
    http = client(lambda request: httpx.Response(200, json=payload, request=request))
    with pytest.raises(ValueError, match="count"):
        CisaKevCollector(http).collect()


def test_epss_collector_batches_queries_and_preserves_score_dates() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        requested = request.url.params["cve"].split(",")
        data = [row for row in recorded("epss.json")["data"] if row["cve"] in requested]
        return httpx.Response(
            200, json={**recorded("epss.json"), "total": len(data), "data": data}, request=request
        )

    dataset = EpssCollector(client(handler, max_query_chars=14)).collect(["CVE-2026-12345", "CVE-2026-12346"])
    assert len(requests) == 2
    assert dataset.records["CVE-2026-12345"].probability == 0.75
    assert dataset.records["CVE-2026-12346"].score_date.isoformat() == "2026-10-02"


def test_epss_collector_rejects_duplicate_records() -> None:
    payload = recorded("epss.json")
    payload["data"] = [payload["data"][0], payload["data"][0]]
    http = client(lambda request: httpx.Response(200, json=payload, request=request))
    with pytest.raises(ValueError, match="Duplicate EPSS CVE"):
        EpssCollector(http).collect(["CVE-2026-12345"])


def test_nvd_collector_selects_english_description_primary_cvss_and_https_references() -> None:
    http = client(lambda request: httpx.Response(200, json=recorded("nvd.json"), request=request))
    result = NvdCollector(http).collect("CVE-2026-12345")
    assert result is not None
    assert result.description.startswith("An attacker")
    assert result.cvss is not None and result.cvss.score == 9.8
    assert result.cvss.issuer == "nvd@nist.gov"
    assert [str(reference.url) for reference in result.references] == [
        "https://vendor.example/advisory/12345"
    ]
    assert result.references[0].published_at is None


def test_nvd_collector_returns_none_when_nvd_has_no_matching_record() -> None:
    payload = {**recorded("nvd.json"), "totalResults": 0, "vulnerabilities": []}
    http = client(lambda request: httpx.Response(200, json=payload, request=request))
    assert NvdCollector(http).collect("CVE-2026-12345") is None


def test_http_client_retries_transient_failures_without_following_redirects() -> None:
    attempts = 0

    def transient(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503 if attempts == 1 else 200, json={"ok": True}, request=request)

    payload, retrieval = client(transient, retries=1).get_json(CISA_KEV_URL, max_bytes=100)
    assert payload == {"ok": True}
    assert attempts == 2
    assert retrieval.retrieved_at == NOW

    redirecting = client(lambda request: httpx.Response(302, headers={"location": EPSS_URL}, request=request))
    with pytest.raises(SourceHttpError, match="redirect"):
        redirecting.get_json(CISA_KEV_URL, max_bytes=100)


def test_http_client_rejects_unapproved_hosts_and_oversized_responses() -> None:
    http = client(lambda request: httpx.Response(200, content=b'{"large":"payload"}', request=request))
    with pytest.raises(SourceHttpError, match="not allowed"):
        http.get_json("https://example.com/data.json", max_bytes=100)
    with pytest.raises(SourceHttpError, match="exceeded"):
        http.get_json(NVD_URL, params={"cveId": "CVE-2026-12345"}, max_bytes=5)
