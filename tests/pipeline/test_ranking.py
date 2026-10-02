from datetime import date, timedelta

import pytest

from pipeline.models import EpssRecord, KevRecord
from pipeline.ranking import rank_entries, select_recent_kev


def kev(cve: str, added: date) -> KevRecord:
    return KevRecord(
        cve=cve,
        date_added=added,
        due_date=added + timedelta(days=21),
        vendor_project="Vendor",
        product="Product",
        vulnerability_name=f"{cve} vulnerability",
        required_action="Apply the vendor mitigation.",
        known_ransomware_campaign_use="Unknown",
        notes=None,
    )


def epss(cve: str, probability: float, percentile: float) -> EpssRecord:
    return EpssRecord(
        cve=cve,
        probability=probability,
        percentile=percentile,
        score_date=date(2026, 10, 2),
    )


def test_recent_kev_window_is_thirty_inclusive_calendar_days() -> None:
    watch_date = date(2026, 10, 2)
    records = [
        kev("CVE-2026-10001", date(2026, 9, 3)),
        kev("CVE-2026-10002", date(2026, 10, 2)),
        kev("CVE-2026-10003", date(2026, 9, 2)),
        kev("CVE-2026-10004", date(2026, 10, 3)),
    ]
    selected = select_recent_kev(records, watch_date=watch_date, lookback_days=30)
    assert [record.cve for record in selected] == ["CVE-2026-10001", "CVE-2026-10002"]


def test_recent_kev_rejects_duplicate_cves() -> None:
    record = kev("CVE-2026-10001", date(2026, 10, 1))
    with pytest.raises(ValueError, match="Duplicate KEV CVE"):
        select_recent_kev([record, record], watch_date=date(2026, 10, 2), lookback_days=30)


def test_ranking_accepts_threshold_equality_and_excludes_missing_or_lower_scores() -> None:
    records = [kev(f"CVE-2026-{value}", date(2026, 10, 1)) for value in range(10001, 10005)]
    scores = {
        records[0].cve: epss(records[0].cve, 0.5, 0.95),
        records[1].cve: epss(records[1].cve, 0.499, 0.99),
        records[2].cve: epss(records[2].cve, 0.8, 0.949),
    }
    ranked = rank_entries(
        records,
        scores,
        probability_min=0.5,
        percentile_min=0.95,
        limit=10,
    )
    assert [entry.kev.cve for entry in ranked] == ["CVE-2026-10001"]
    assert ranked[0].rank == 1


def test_ranking_is_deterministic_and_limited_to_ten() -> None:
    records = [kev(f"CVE-2026-{10020 - index}", date(2026, 9, 20 + (index % 3))) for index in range(12)]
    scores = {record.cve: epss(record.cve, 0.9, 0.99) for record in records}
    ranked = rank_entries(records, scores, probability_min=0.5, percentile_min=0.95, limit=10)
    assert len(ranked) == 10
    assert [entry.rank for entry in ranked] == list(range(1, 11))
    assert [(entry.kev.date_added, entry.kev.cve) for entry in ranked] == sorted(
        [(entry.kev.date_added, entry.kev.cve) for entry in ranked],
        key=lambda value: (-value[0].toordinal(), value[1]),
    )
