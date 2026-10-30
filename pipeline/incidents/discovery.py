import copy
import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

from pipeline.incidents.parsers import parse_entries
from pipeline.incidents.sources import SourceSpec, fetch
from pipeline.storage import write_json_atomic

TERMS = re.compile(
    r"compromis|malicious|supply.chain|backdoor|vulnerab|security.release|certificate|credential|malware|exploit|incident|\bRCE\b",
    re.I,
)


def discover(
    sources: list[SourceSpec],
    previous: dict,
    run_dir: Path,
    *,
    client: httpx.Client,
    now: datetime | None = None,
):
    now = now or datetime.now(UTC)
    as_of = now.isoformat().replace("+00:00", "Z")
    state = copy.deepcopy(previous or {"schema_version": 1, "sources": {}, "leads": []})
    if (
        state.get("schema_version") != 1
        or not isinstance(state.get("leads"), list)
        or not isinstance(state.get("sources"), dict)
    ):
        raise ValueError("Invalid previous discovery state")
    leads = {lead["lead_id"]: lead for lead in state["leads"]}
    manifest = {"schema_version": 1, "generated_at": as_of, "sources": []}
    for source in sources:
        checkpoint = state["sources"].get(source.id, {})
        headers = {"user-agent": "The-Security-Diff/1.0 (+https://tsd.report)"}
        for key, header in (("etag", "if-none-match"), ("last-modified", "if-modified-since")):
            if checkpoint.get(key):
                headers[header] = checkpoint[key]
        try:
            body, response_headers, status = fetch(
                client, source.url, hosts={httpx.URL(source.url).host}, headers=headers
            )
            if status == 304:
                manifest["sources"].append({"id": source.id, "status": "unchanged"})
                continue
            raw_path = run_dir / "raw" / f"{source.id}.bin"
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_bytes(body)
            entries = parse_entries(source, body)
            if not entries:
                raise ValueError("Source contains no usable entries; previous checkpoint retained")
            count = 0
            for entry in sorted(
                entries, key=lambda item: item["updated_at"] or item["published_at"] or "", reverse=True
            ):
                if count >= 40:
                    break
                if source.format != "github-commits" and not TERMS.search(entry["title"]):
                    continue
                observed = entry["updated_at"] or entry["published_at"]
                if observed and datetime.fromisoformat(observed) < now - timedelta(days=30):
                    continue
                lead_id = hashlib.sha256(entry["url"].encode()).hexdigest()[:24]
                fingerprint = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
                old = leads.get(lead_id)
                if old and old["fingerprint"] == fingerprint:
                    continue
                leads[lead_id] = {
                    **entry,
                    "lead_id": lead_id,
                    "source_id": source.id,
                    "source_name": source.name,
                    "fingerprint": fingerprint,
                    "first_seen": old["first_seen"] if old else as_of,
                    "changed_at": as_of,
                }
                count += 1
            state["sources"][source.id] = {
                key: response_headers[key] for key in ("etag", "last-modified") if key in response_headers
            }
            manifest["sources"].append(
                {"id": source.id, "status": "ok", "entries": len(entries), "changed": count}
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            manifest["sources"].append(
                {
                    "id": source.id,
                    "status": "failed",
                    "error": type(error).__name__,
                    "http_status": error.response.status_code
                    if isinstance(error, httpx.HTTPStatusError)
                    else None,
                }
            )
    state["leads"] = sorted(leads.values(), key=lambda lead: lead.get("changed_at", ""), reverse=True)[:500]
    write_json_atomic(run_dir / "manifest.json", manifest)
    return state, manifest
