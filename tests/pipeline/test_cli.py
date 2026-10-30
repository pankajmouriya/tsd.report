import json
import ssl
from pathlib import Path

import pytest

from pipeline.cli import main, system_ssl_context

RECORDINGS = Path(__file__).parent / "recordings"


def test_live_client_uses_a_verifying_system_trust_context() -> None:
    context = system_ssl_context()
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_replay_cli_is_deterministic_and_writes_a_manifest(tmp_path: Path) -> None:
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    first_run = tmp_path / "run-first"
    second_run = tmp_path / "run-second"
    args = [
        "replay",
        "--date",
        "2026-10-02",
        "--generated-at",
        "2026-10-02T06:20:00Z",
        "--recordings",
        str(RECORDINGS),
    ]
    assert main([*args, "--output", str(first), "--run-dir", str(first_run)]) == 0
    assert main([*args, "--output", str(second), "--run-dir", str(second_run)]) == 0
    assert json.loads(first.read_text()) == json.loads(second.read_text())
    manifest = json.loads((first_run / "manifest.json").read_text())
    assert manifest["status"] == "candidate"
    assert manifest["selected_count"] == 2
    assert (first_run / "raw" / "cisa-kev.json").exists()
    assert (first_run / "enriched" / "candidate.json").exists()


@pytest.mark.parametrize("epss_date", ["2026-10-02", "2026-09-30"])
def test_replay_retains_unchanged_kev_evidence_and_preserves_output_on_failure(
    tmp_path: Path, epss_date: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    recordings = tmp_path / "recordings"
    recordings.mkdir()
    for name in ("cisa-kev.json", "epss.json", "nvd.json"):
        (recordings / name).write_bytes((RECORDINGS / name).read_bytes())
    catalog = json.loads((recordings / "cisa-kev.json").read_text())
    catalog["dateReleased"] = "2026-09-30T18:00:00Z"
    catalog["catalogVersion"] = "2026.09.30"
    for record in catalog["vulnerabilities"]:
        record["dateAdded"] = "2026-09-30"
    (recordings / "cisa-kev.json").write_text(json.dumps(catalog))
    epss = json.loads((recordings / "epss.json").read_text())
    for record in epss["data"]:
        record["date"] = epss_date
    (recordings / "epss.json").write_text(json.dumps(epss))
    output = tmp_path / "candidate.json"
    output.write_text('{"previous": "candidate"}\n')
    run_dir = tmp_path / "run"
    args = [
        "replay",
        "--date",
        "2026-10-02",
        "--generated-at",
        "2026-10-02T06:20:00Z",
        "--recordings",
        str(recordings),
        "--output",
        str(output),
        "--run-dir",
        str(run_dir),
    ]
    if epss_date == "2026-10-02":
        assert main(args) == 0
        candidate = json.loads(output.read_text())
        assert candidate["sources"][0]["data_date"] == "2026-09-30"
        assert len(candidate["entries"]) == 2
    else:

        def unexpected_enrichment(*_args):
            pytest.fail("Invalid required sources must fail before optional NVD requests")

        monkeypatch.setattr("pipeline.cli.NvdCollector.collect", unexpected_enrichment)
        with pytest.raises(ValueError, match="FIRST EPSS dataset is not current"):
            main(args)
        assert output.read_text() == '{"previous": "candidate"}\n'
        assert not (run_dir / "enriched" / "candidate.json").exists()
    assert json.loads((run_dir / "raw" / "cisa-kev.json").read_text()) == catalog
    assert json.loads((run_dir / "raw" / "epss.json").read_text()) == [epss]
