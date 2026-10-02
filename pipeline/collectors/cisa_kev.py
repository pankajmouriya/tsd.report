from datetime import date, datetime
from typing import Any

from pipeline.http import BoundedHttpClient
from pipeline.models import KevCatalog, KevRecord, SourceRun

CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
CISA_KEV_PAGE = "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"


class CisaKevCollector:
    def __init__(self, http: BoundedHttpClient) -> None:
        self.http = http

    def collect(self) -> KevCatalog:
        payload, retrieval = self.http.get_json(CISA_KEV_URL, max_bytes=8_000_000)
        items = payload.get("vulnerabilities")
        if not isinstance(items, list) or payload.get("count") != len(items):
            raise ValueError("CISA KEV count does not match vulnerabilities")
        records = [self._record(item) for item in items]
        released = payload.get("dateReleased")
        data_date = datetime.fromisoformat(str(released).replace("Z", "+00:00")).date() if released else None
        return KevCatalog(
            records=records,
            source=SourceRun(
                id="cisa-kev",
                name="CISA Known Exploited Vulnerabilities Catalog",
                url=CISA_KEV_PAGE,
                status="ok",
                retrieved_at=retrieval.retrieved_at,
                data_date=data_date,
                error=None,
            ),
            raw=payload,
        )

    @staticmethod
    def _record(item: Any) -> KevRecord:
        if not isinstance(item, dict):
            raise ValueError("CISA KEV vulnerability must be an object")
        notes = str(item.get("notes", "")).strip() or None
        return KevRecord(
            cve=item.get("cveID"),
            date_added=date.fromisoformat(item.get("dateAdded")),
            due_date=date.fromisoformat(item.get("dueDate")),
            vendor_project=item.get("vendorProject"),
            product=item.get("product"),
            vulnerability_name=item.get("vulnerabilityName"),
            required_action=item.get("requiredAction"),
            known_ransomware_campaign_use=item.get("knownRansomwareCampaignUse"),
            notes=notes,
        )
