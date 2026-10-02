import json
from datetime import date, datetime, timedelta
from pathlib import Path

from jsonschema import Draft202012Validator

from pipeline.collectors.cisa_kev import CISA_KEV_PAGE
from pipeline.collectors.epss import EPSS_URL
from pipeline.collectors.nvd import NVD_URL
from pipeline.models import (
    CandidateSnapshot,
    EpssDataset,
    EvidenceReference,
    KevCatalog,
    NvdEnrichment,
    PublishedSnapshot,
    SourceRun,
    WatchEntry,
    WatchEpssFacts,
    WatchKevFacts,
    WatchSelection,
)
from pipeline.ranking import rank_entries, select_recent_kev
from pipeline.storage import write_json_atomic


def validate_interchange(payload: dict, schema_path: Path) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(payload)


def _references(
    cve: str,
    score_date: date,
    cisa_retrieved_at: datetime,
    epss_retrieved_at: datetime,
    nvd: NvdEnrichment | None,
) -> list[EvidenceReference]:
    references = [
        EvidenceReference(
            source_id="cisa-kev",
            name="CISA KEV catalog",
            url=CISA_KEV_PAGE,
            type="government",
            published_at=None,
            retrieved_at=cisa_retrieved_at,
        ),
        EvidenceReference(
            source_id="first-epss",
            name="FIRST EPSS score",
            url=f"{EPSS_URL}?cve={cve}&date={score_date.isoformat()}",
            type="research",
            published_at=None,
            retrieved_at=epss_retrieved_at,
        ),
    ]
    if nvd is not None:
        references.append(
            EvidenceReference(
                source_id="nvd",
                name="NVD record",
                url=f"https://nvd.nist.gov/vuln/detail/{cve}",
                type="government",
                published_at=None,
                retrieved_at=nvd.retrieved_at,
            )
        )
        references.extend(nvd.references)
    by_url: dict[str, EvidenceReference] = {}
    for reference in references:
        by_url.setdefault(reference.url, reference)
    return list(by_url.values())


def compose_candidate(
    *,
    watch_date: date,
    generated_at: datetime,
    catalog: KevCatalog,
    epss: EpssDataset,
    nvd_by_cve: dict[str, NvdEnrichment | None],
    nvd_errors: dict[str, str],
) -> CandidateSnapshot:
    if catalog.source.data_date is None or not 0 <= (watch_date - catalog.source.data_date).days <= 1:
        raise ValueError("CISA KEV catalog is not current for the watch date")
    recent = select_recent_kev(catalog.records, watch_date=watch_date, lookback_days=30)
    if recent and (epss.source.data_date is None or not 0 <= (watch_date - epss.source.data_date).days <= 1):
        raise ValueError("FIRST EPSS dataset is not current for the watch date")
    ranked = rank_entries(
        recent,
        epss.records,
        probability_min=0.5,
        percentile_min=0.95,
        limit=10,
    )
    entries: list[WatchEntry] = []
    for candidate in ranked:
        nvd = nvd_by_cve.get(candidate.kev.cve)
        entries.append(
            WatchEntry(
                rank=candidate.rank,
                cve=candidate.kev.cve,
                kev=WatchKevFacts(**candidate.kev.model_dump(exclude={"cve"})),
                epss=WatchEpssFacts(**candidate.epss.model_dump(exclude={"cve"})),
                cvss=nvd.cvss if nvd else None,
                description=nvd.description if nvd else None,
                references=_references(
                    candidate.kev.cve,
                    candidate.epss.score_date,
                    catalog.source.retrieved_at,
                    epss.source.retrieved_at,
                    nvd,
                ),
            )
        )
    failed_count = sum(1 for entry in entries if entry.cve in nvd_errors or nvd_by_cve.get(entry.cve) is None)
    nvd_retrieved_at = max(
        (item.retrieved_at for item in nvd_by_cve.values() if item is not None),
        default=generated_at,
    )
    nvd_source = SourceRun(
        id="nvd",
        name="NIST National Vulnerability Database",
        url=NVD_URL,
        status="degraded" if failed_count else "ok",
        retrieved_at=nvd_retrieved_at,
        data_date=None,
        error=f"NVD enrichment unavailable for {failed_count} of {len(entries)} selected CVEs"
        if failed_count
        else None,
    )
    return CandidateSnapshot(
        date=watch_date,
        generated_at=generated_at,
        selection=WatchSelection(
            window_start=watch_date - timedelta(days=29),
            window_end=watch_date,
        ),
        sources=[catalog.source, epss.source, nvd_source],
        entries=entries,
    )


def promote_candidate(
    candidate: CandidateSnapshot,
    *,
    reviewed_by: str,
    reviewed_at: datetime,
    review_pr: str,
    output: Path,
) -> PublishedSnapshot:
    payload = candidate.model_dump(exclude={"status"})
    published = PublishedSnapshot(
        **payload,
        reviewed_by=reviewed_by,
        reviewed_at=reviewed_at,
        review_pr=review_pr,
    )
    if output.exists():
        existing = PublishedSnapshot.model_validate_json(output.read_text(encoding="utf-8"))
        if existing == published:
            return existing
        raise ValueError(f"Published snapshot is immutable: {output}")
    write_json_atomic(output, published.model_dump(mode="json"))
    return published
