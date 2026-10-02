from datetime import date, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class KevRecord(StrictModel):
    cve: str = Field(pattern=r"^CVE-\d{4}-\d{4,}$")
    date_added: date
    due_date: date
    vendor_project: str = Field(min_length=1)
    product: str = Field(min_length=1)
    vulnerability_name: str = Field(min_length=1)
    required_action: str = Field(min_length=1)
    known_ransomware_campaign_use: Literal["Known", "Unknown"]
    notes: str | None


class EpssRecord(StrictModel):
    cve: str = Field(pattern=r"^CVE-\d{4}-\d{4,}$")
    probability: float = Field(ge=0, le=1)
    percentile: float = Field(ge=0, le=1)
    score_date: date


class RankedCandidate(StrictModel):
    rank: int = Field(ge=1, le=10)
    kev: KevRecord
    epss: EpssRecord


def _https_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("URL must be absolute HTTPS without credentials")
    return value


class SourceRun(StrictModel):
    id: Literal["cisa-kev", "first-epss", "nvd"]
    name: str = Field(min_length=1)
    url: str
    status: Literal["ok", "degraded"]
    retrieved_at: datetime
    data_date: date | None
    error: str | None

    _validate_url = field_validator("url")(_https_url)

    @model_validator(mode="after")
    def validate_status(self) -> "SourceRun":
        if self.status == "ok" and self.error is not None:
            raise ValueError("Successful sources cannot include an error")
        if self.status == "degraded" and self.error is None:
            raise ValueError("Degraded sources require an error")
        return self


class KevCatalog(StrictModel):
    records: list[KevRecord]
    source: SourceRun
    raw: dict


class EpssDataset(StrictModel):
    records: dict[str, EpssRecord]
    source: SourceRun
    raw: list[dict]


class CvssAssessment(StrictModel):
    source_id: Literal["nvd"] = "nvd"
    score: float = Field(ge=0, le=10)
    version: str = Field(min_length=1)
    vector: str = Field(min_length=1)
    issuer: str = Field(min_length=1)


class EvidenceReference(StrictModel):
    source_id: Literal["cisa-kev", "first-epss", "nvd", "vendor"]
    name: str = Field(min_length=1)
    url: str
    type: Literal["government", "vendor", "research", "community"]
    published_at: datetime | None
    retrieved_at: datetime

    _validate_url = field_validator("url")(_https_url)


class NvdEnrichment(StrictModel):
    cve: str = Field(pattern=r"^CVE-\d{4}-\d{4,}$")
    description: str | None
    cvss: CvssAssessment | None
    references: list[EvidenceReference]
    retrieved_at: datetime
    raw: dict


class WatchSelection(StrictModel):
    lookback_days: Literal[30] = 30
    epss_probability_min: Literal[0.5] = 0.5
    epss_percentile_min: Literal[0.95] = 0.95
    limit: Literal[10] = 10
    ranking_version: Literal["kev-epss-v1"] = "kev-epss-v1"
    window_start: date
    window_end: date


class WatchKevFacts(StrictModel):
    source_id: Literal["cisa-kev"] = "cisa-kev"
    date_added: date
    due_date: date
    vendor_project: str = Field(min_length=1)
    product: str = Field(min_length=1)
    vulnerability_name: str = Field(min_length=1)
    required_action: str = Field(min_length=1)
    known_ransomware_campaign_use: Literal["Known", "Unknown"]
    notes: str | None


class WatchEpssFacts(StrictModel):
    source_id: Literal["first-epss"] = "first-epss"
    probability: float = Field(ge=0.5, le=1)
    percentile: float = Field(ge=0.95, le=1)
    score_date: date


class WatchEntry(StrictModel):
    rank: int = Field(ge=1, le=10)
    cve: str = Field(pattern=r"^CVE-\d{4}-\d{4,}$")
    kev: WatchKevFacts
    epss: WatchEpssFacts
    cvss: CvssAssessment | None
    description: str | None
    references: list[EvidenceReference]


class SnapshotBase(StrictModel):
    schema_version: Literal[1] = 1
    date: date
    generated_at: datetime
    selection: WatchSelection
    sources: list[SourceRun]
    entries: list[WatchEntry] = Field(max_length=10)

    @model_validator(mode="after")
    def validate_snapshot(self) -> "SnapshotBase":
        if self.selection.window_end != self.date:
            raise ValueError("Selection window must end on the snapshot date")
        source_ids = [source.id for source in self.sources]
        if sorted(source_ids) != ["cisa-kev", "first-epss", "nvd"]:
            raise ValueError("Each configured source must appear exactly once")
        if len({entry.cve for entry in self.entries}) != len(self.entries):
            raise ValueError("Watch CVEs must be unique")
        if [entry.rank for entry in self.entries] != list(range(1, len(self.entries) + 1)):
            raise ValueError("Entry ranks must be contiguous and ordered")
        return self


class CandidateSnapshot(SnapshotBase):
    status: Literal["candidate"] = "candidate"


class PublishedSnapshot(SnapshotBase):
    status: Literal["published"] = "published"
    reviewed_by: str = Field(min_length=1)
    reviewed_at: datetime
    review_pr: str

    _validate_review_pr = field_validator("review_pr")(_https_url)
