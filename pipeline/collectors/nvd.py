from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from pipeline.http import BoundedHttpClient
from pipeline.models import CvssAssessment, EvidenceReference, NvdEnrichment

NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


class NvdCollector:
    def __init__(self, http: BoundedHttpClient, api_key: str | None = None) -> None:
        self.http = http
        self.api_key = api_key

    def collect(self, cve: str) -> NvdEnrichment | None:
        headers = {"apiKey": self.api_key} if self.api_key else None
        payload, retrieval = self.http.get_json(
            NVD_URL,
            params={"cveId": cve},
            headers=headers,
            max_bytes=2_000_000,
        )
        vulnerabilities = payload.get("vulnerabilities")
        if not isinstance(vulnerabilities, list):
            raise ValueError("NVD response is missing vulnerabilities")
        matches = [
            item.get("cve")
            for item in vulnerabilities
            if isinstance(item, dict) and item.get("cve", {}).get("id") == cve
        ]
        if not matches:
            return None
        if len(matches) != 1:
            raise ValueError(f"NVD returned multiple records for {cve}")
        record = matches[0]
        return NvdEnrichment(
            cve=cve,
            description=self._description(record),
            cvss=self._cvss(record),
            references=self._references(record, retrieval.retrieved_at),
            retrieved_at=retrieval.retrieved_at,
            raw=payload,
        )

    @staticmethod
    def _description(record: dict[str, Any]) -> str | None:
        descriptions = record.get("descriptions", [])
        return next(
            (item.get("value") for item in descriptions if item.get("lang") == "en" and item.get("value")),
            None,
        )

    @staticmethod
    def _cvss(record: dict[str, Any]) -> CvssAssessment | None:
        metrics = record.get("metrics", {})
        for key in ("cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            values = metrics.get(key, [])
            if not values:
                continue
            ordered = sorted(
                values, key=lambda value: (value.get("type") != "Primary", value.get("source", ""))
            )
            chosen = ordered[0]
            data = chosen.get("cvssData", {})
            return CvssAssessment(
                score=data.get("baseScore"),
                version=data.get("version"),
                vector=data.get("vectorString"),
                issuer=chosen.get("source"),
            )
        return None

    @staticmethod
    def _references(record: dict[str, Any], retrieved_at: datetime) -> list[EvidenceReference]:
        references: list[EvidenceReference] = []
        seen: set[str] = set()
        for item in record.get("references", []):
            url = item.get("url", "")
            parsed = urlsplit(url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or url in seen
            ):
                continue
            seen.add(url)
            tags = item.get("tags", [])
            is_vendor = "Vendor Advisory" in tags
            references.append(
                EvidenceReference(
                    source_id="vendor" if is_vendor else "nvd",
                    name="Vendor advisory" if is_vendor else "NVD reference",
                    url=url,
                    type="vendor" if is_vendor else "community",
                    published_at=None,
                    retrieved_at=retrieved_at,
                )
            )
        return references
