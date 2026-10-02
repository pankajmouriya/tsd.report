from datetime import date, timedelta

from pipeline.models import EpssRecord, KevRecord, RankedCandidate


def select_recent_kev(
    records: list[KevRecord],
    *,
    watch_date: date,
    lookback_days: int,
) -> list[KevRecord]:
    if lookback_days < 1:
        raise ValueError("lookback_days must be positive")
    cves: set[str] = set()
    for record in records:
        if record.cve in cves:
            raise ValueError(f"Duplicate KEV CVE: {record.cve}")
        cves.add(record.cve)
    window_start = watch_date - timedelta(days=lookback_days - 1)
    return [record for record in records if window_start <= record.date_added <= watch_date]


def rank_entries(
    kev_records: list[KevRecord],
    epss_by_cve: dict[str, EpssRecord],
    *,
    probability_min: float,
    percentile_min: float,
    limit: int,
) -> list[RankedCandidate]:
    if not 1 <= limit <= 10:
        raise ValueError("limit must be between 1 and 10")
    eligible = [
        (record, score)
        for record in kev_records
        if (score := epss_by_cve.get(record.cve)) is not None
        and score.probability >= probability_min
        and score.percentile >= percentile_min
    ]
    eligible.sort(
        key=lambda pair: (
            -pair[1].probability,
            -pair[1].percentile,
            -pair[0].date_added.toordinal(),
            pair[0].cve,
        )
    )
    return [
        RankedCandidate(rank=index, kev=record, epss=score)
        for index, (record, score) in enumerate(eligible[:limit], start=1)
    ]
