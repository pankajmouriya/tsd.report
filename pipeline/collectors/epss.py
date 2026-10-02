from datetime import date

from pipeline.http import BoundedHttpClient
from pipeline.models import EpssDataset, EpssRecord, SourceRun

EPSS_URL = "https://api.first.org/data/v1/epss"


def _chunks(cves: list[str], max_chars: int) -> list[list[str]]:
    chunks: list[list[str]] = []
    current: list[str] = []
    current_length = 0
    for cve in cves:
        added = len(cve) + (1 if current else 0)
        if current and current_length + added > max_chars:
            chunks.append(current)
            current = []
            current_length = 0
            added = len(cve)
        if added > max_chars:
            raise ValueError(f"CVE identifier exceeds EPSS query limit: {cve}")
        current.append(cve)
        current_length += added
    if current:
        chunks.append(current)
    return chunks


class EpssCollector:
    def __init__(self, http: BoundedHttpClient) -> None:
        self.http = http

    def collect(self, cves: list[str]) -> EpssDataset:
        records: dict[str, EpssRecord] = {}
        raw: list[dict] = []
        retrieved_at = self.http.clock()
        for chunk in _chunks(sorted(set(cves)), self.http.max_query_chars):
            payload, retrieval = self.http.get_json(
                EPSS_URL,
                params={"cve": ",".join(chunk)},
                max_bytes=2_000_000,
            )
            retrieved_at = retrieval.retrieved_at
            if payload.get("status") != "OK" or not isinstance(payload.get("data"), list):
                raise ValueError("FIRST EPSS response is not successful")
            raw.append(payload)
            for item in payload["data"]:
                cve = item.get("cve")
                if cve in records:
                    raise ValueError(f"Duplicate EPSS CVE: {cve}")
                records[cve] = EpssRecord(
                    cve=cve,
                    probability=float(item.get("epss")),
                    percentile=float(item.get("percentile")),
                    score_date=date.fromisoformat(item.get("date")),
                )
        data_date = max((record.score_date for record in records.values()), default=None)
        return EpssDataset(
            records=records,
            source=SourceRun(
                id="first-epss",
                name="FIRST Exploit Prediction Scoring System",
                url=EPSS_URL,
                status="ok",
                retrieved_at=retrieved_at,
                data_date=data_date,
                error=None,
            ),
            raw=raw,
        )
