from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from pipeline.models import EpssRecord, KevRecord, SourceRun


def test_kev_record_rejects_non_cve_identifier() -> None:
    with pytest.raises(ValidationError):
        KevRecord(
            cve="NOT-A-CVE",
            date_added=date(2026, 10, 1),
            due_date=date(2026, 10, 22),
            vendor_project="Vendor",
            product="Product",
            vulnerability_name="Vulnerability",
            required_action="Apply the vendor mitigation.",
            known_ransomware_campaign_use="Unknown",
            notes=None,
        )


def test_epss_record_requires_probability_and_percentile_ranges() -> None:
    with pytest.raises(ValidationError):
        EpssRecord(cve="CVE-2026-12345", probability=1.1, percentile=0.99, score_date=date(2026, 10, 2))


def test_models_reject_unknown_source_fields() -> None:
    with pytest.raises(ValidationError):
        EpssRecord(
            cve="CVE-2026-12345",
            probability=0.7,
            percentile=0.99,
            score_date=date(2026, 10, 2),
            publish=True,
        )


@pytest.mark.parametrize(
    ("status", "error"),
    [("ok", "unexpected error"), ("degraded", None)],
)
def test_source_status_and_error_must_agree(status: str, error: str | None) -> None:
    with pytest.raises(ValidationError):
        SourceRun(
            id="nvd",
            name="NVD",
            url="https://services.nvd.nist.gov/rest/json/cves/2.0",
            status=status,
            retrieved_at=datetime(2026, 10, 2, tzinfo=UTC),
            data_date=None,
            error=error,
        )
