import json
import ssl
from pathlib import Path

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
