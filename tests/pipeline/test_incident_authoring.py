import copy
import hashlib
import json
from pathlib import Path

import pytest

from pipeline.incidents.cli import main

ROOT = Path(__file__).parents[2]


def test_assembly_keeps_source_provenance_and_rejects_model_fact_changes(tmp_path):
    candidate = json.loads((ROOT / "tests/fixtures/incidents/candidate.json").read_text())
    editorial = candidate.pop("editorial")
    raw = ("<p>" + candidate["facts"][0]["statement"] + "</p><p>" + "Context. " * 300 + "</p>").encode()
    captures = tmp_path / "captures"
    captures.mkdir()
    (captures / "source-0.txt").write_bytes(raw)
    (captures / "sources.json").write_text(
        json.dumps(
            [
                {
                    "url": candidate["sources"][0]["url"],
                    "retrieved_at": candidate["sources"][0]["retrieved_at"],
                    "sha256": hashlib.sha256(raw).hexdigest(),
                }
            ]
        )
    )
    evidence_path, copy_path, output = (
        tmp_path / "evidence.json",
        tmp_path / "copy.json",
        tmp_path / "candidate.json",
    )
    evidence_path.write_text(json.dumps(candidate))
    copy_path.write_text(json.dumps(editorial))
    args = [
        "assemble",
        "--evidence",
        str(evidence_path),
        "--editorial",
        str(copy_path),
        "--captures",
        str(captures),
        "--output",
        str(output),
    ]
    assert main(args) == 0
    published_copy = json.loads(output.read_text())
    assert published_copy["facts"] == candidate["facts"]
    assert published_copy["sources"] == candidate["sources"]
    original = output.read_bytes()
    forged = copy.deepcopy(editorial)
    forged["reviewed_by"] = "forged"
    copy_path.write_text(json.dumps(forged))
    with pytest.raises(ValueError):
        main(args)
    assert output.read_bytes() == original
    copy_path.write_text(json.dumps(editorial))
    (captures / "source-0.txt").write_bytes(b"tampered capture")
    with pytest.raises(ValueError, match="hash mismatch"):
        main(args)
    assert output.read_bytes() == original
