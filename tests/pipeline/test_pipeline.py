import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from pipeline.compose import compose_candidate, promote_candidate, validate_interchange
from pipeline.models import (
    CvssAssessment,
    EpssDataset,
    EpssRecord,
    EvidenceReference,
    KevCatalog,
    KevRecord,
    NvdEnrichment,
    SourceRun,
)
from pipeline.storage import write_json_atomic

NOW = datetime(2026, 10, 2, 6, 20, tzinfo=UTC)
ROOT = Path(__file__).parents[2]


def source(source_id: str, name: str, url: str, data_date: date | None = date(2026, 10, 2)) -> SourceRun:
    return SourceRun(
        id=source_id,
        name=name,
        url=url,
        status="ok",
        retrieved_at=NOW,
        data_date=data_date,
        error=None,
    )


def inputs() -> tuple[KevCatalog, EpssDataset, dict[str, NvdEnrichment | None]]:
    cve = "CVE-2026-12345"
    kev = KevRecord(
        cve=cve,
        date_added=date(2026, 10, 1),
        due_date=date(2026, 10, 22),
        vendor_project="Example Vendor",
        product="Example Product",
        vulnerability_name="Example Product Vulnerability",
        required_action="Apply mitigations per vendor instructions.",
        known_ransomware_campaign_use="Unknown",
        notes=None,
    )
    catalog = KevCatalog(
        records=[kev],
        source=source(
            "cisa-kev",
            "CISA Known Exploited Vulnerabilities Catalog",
            "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        ),
        raw={"vulnerabilities": []},
    )
    epss = EpssDataset(
        records={cve: EpssRecord(cve=cve, probability=0.75, percentile=0.98, score_date=date(2026, 10, 2))},
        source=source("first-epss", "FIRST EPSS", "https://api.first.org/data/v1/epss"),
        raw=[],
    )
    nvd = NvdEnrichment(
        cve=cve,
        description="An attacker may execute code on affected systems.",
        cvss=CvssAssessment(
            score=9.8,
            version="3.1",
            vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            issuer="nvd@nist.gov",
        ),
        references=[
            EvidenceReference(
                source_id="vendor",
                name="Vendor advisory",
                url="https://vendor.example/advisory/12345",
                type="vendor",
                published_at=datetime(2026, 9, 29, 12, tzinfo=UTC),
                retrieved_at=NOW,
            )
        ],
        retrieved_at=NOW,
        raw={"vulnerabilities": []},
    )
    return catalog, epss, {cve: nvd}


def test_compose_candidate_matches_interchange_contract_and_records_provenance() -> None:
    catalog, epss, nvd = inputs()
    snapshot = compose_candidate(
        watch_date=date(2026, 10, 2),
        generated_at=NOW,
        catalog=catalog,
        epss=epss,
        nvd_by_cve=nvd,
        nvd_errors={},
    )
    payload = snapshot.model_dump(mode="json")
    validate_interchange(payload, ROOT / "schemas/vulnerability-watch.schema.json")
    assert payload["status"] == "candidate"
    assert payload["selection"]["window_start"] == "2026-09-03"
    assert payload["entries"][0]["rank"] == 1
    assert payload["entries"][0]["kev"]["source_id"] == "cisa-kev"
    assert payload["entries"][0]["epss"]["source_id"] == "first-epss"
    assert {reference["source_id"] for reference in payload["entries"][0]["references"]} == {
        "cisa-kev",
        "first-epss",
        "nvd",
        "vendor",
    }


def test_compose_candidate_allows_zero_qualifiers_after_successful_sources() -> None:
    catalog, epss, _nvd = inputs()
    epss.records["CVE-2026-12345"] = EpssRecord(
        cve="CVE-2026-12345", probability=0.49, percentile=0.99, score_date=date(2026, 10, 2)
    )
    snapshot = compose_candidate(
        watch_date=date(2026, 10, 2),
        generated_at=NOW,
        catalog=catalog,
        epss=epss,
        nvd_by_cve={},
        nvd_errors={},
    )
    assert snapshot.entries == []


def test_compose_candidate_does_not_require_epss_data_when_recent_kev_pool_is_empty() -> None:
    catalog, epss, _nvd = inputs()
    catalog.records[0] = catalog.records[0].model_copy(update={"date_added": date(2026, 8, 1)})
    epss.records = {}
    epss.source = epss.source.model_copy(update={"data_date": None})
    snapshot = compose_candidate(
        watch_date=date(2026, 10, 2),
        generated_at=NOW,
        catalog=catalog,
        epss=epss,
        nvd_by_cve={},
        nvd_errors={},
    )
    assert snapshot.entries == []


def test_compose_candidate_marks_nvd_degraded_without_changing_kev_or_epss() -> None:
    catalog, epss, _nvd = inputs()
    snapshot = compose_candidate(
        watch_date=date(2026, 10, 2),
        generated_at=NOW,
        catalog=catalog,
        epss=epss,
        nvd_by_cve={"CVE-2026-12345": None},
        nvd_errors={"CVE-2026-12345": "request failed"},
    )
    assert snapshot.entries[0].description is None
    assert snapshot.entries[0].cvss is None
    nvd_source = next(item for item in snapshot.sources if item.id == "nvd")
    assert nvd_source.status == "degraded"
    assert nvd_source.error == "NVD enrichment unavailable for 1 of 1 selected CVEs"


def test_compose_candidate_rejects_stale_cisa_or_epss_sources() -> None:
    catalog, epss, nvd = inputs()
    catalog.source = catalog.source.model_copy(update={"data_date": date(2026, 9, 30)})
    with pytest.raises(ValueError, match="CISA KEV catalog is not current"):
        compose_candidate(
            watch_date=date(2026, 10, 2),
            generated_at=NOW,
            catalog=catalog,
            epss=epss,
            nvd_by_cve=nvd,
            nvd_errors={},
        )

    catalog, epss, nvd = inputs()
    epss.source = epss.source.model_copy(update={"data_date": date(2026, 9, 30)})
    with pytest.raises(ValueError, match="FIRST EPSS dataset is not current"):
        compose_candidate(
            watch_date=date(2026, 10, 2),
            generated_at=NOW,
            catalog=catalog,
            epss=epss,
            nvd_by_cve=nvd,
            nvd_errors={},
        )


def test_atomic_write_preserves_complete_json(tmp_path: Path) -> None:
    target = tmp_path / "nested" / "snapshot.json"
    write_json_atomic(target, {"value": "first"})
    write_json_atomic(target, {"value": "second"})
    assert json.loads(target.read_text()) == {"value": "second"}
    assert list(target.parent.glob(".*.tmp")) == []


def test_promotion_records_review_and_refuses_conflicting_published_snapshot(tmp_path: Path) -> None:
    catalog, epss, nvd = inputs()
    candidate = compose_candidate(
        watch_date=date(2026, 10, 2),
        generated_at=NOW,
        catalog=catalog,
        epss=epss,
        nvd_by_cve=nvd,
        nvd_errors={},
    )
    target = tmp_path / "2026-10-02.json"
    published = promote_candidate(
        candidate,
        reviewed_by="pankajmouriya",
        reviewed_at=datetime(2026, 10, 2, 7, tzinfo=UTC),
        review_pr="https://github.com/pankajmouriya/tsd.report/pull/42",
        output=target,
    )
    assert published.status == "published"
    assert published.reviewed_by == "pankajmouriya"
    assert (
        promote_candidate(
            candidate,
            reviewed_by="pankajmouriya",
            reviewed_at=datetime(2026, 10, 2, 7, tzinfo=UTC),
            review_pr="https://github.com/pankajmouriya/tsd.report/pull/42",
            output=target,
        )
        == published
    )

    changed = candidate.model_copy(update={"generated_at": datetime(2026, 10, 2, 8, tzinfo=UTC)})
    with pytest.raises(ValueError, match="immutable"):
        promote_candidate(
            changed,
            reviewed_by="pankajmouriya",
            reviewed_at=datetime(2026, 10, 2, 8, tzinfo=UTC),
            review_pr="https://github.com/pankajmouriya/tsd.report/pull/42",
            output=target,
        )
