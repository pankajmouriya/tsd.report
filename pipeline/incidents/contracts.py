import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker, ValidationError

ROOT = Path(__file__).parents[2]


def content_hash(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


def _validate_shape(payload: dict, definition: str) -> None:
    schema = json.loads((ROOT / "schemas/incident.schema.json").read_text())
    try:
        Draft202012Validator(schema[definition], format_checker=FormatChecker()).validate(payload)
    except ValidationError as error:
        raise ValueError(f"Invalid incident {definition}: schema rule {error.validator}") from error


def validate_candidate(payload: dict) -> dict:
    _validate_shape(payload, "candidate")

    def check_text(value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("Text must not be blank; use null for unknown values")
        if isinstance(value, dict):
            for item in value.values():
                check_text(item)
        elif isinstance(value, list):
            for item in value:
                check_text(item)

    check_text(payload)
    sources, facts, editorial = payload["sources"], payload["facts"], payload["editorial"]
    synthetic = payload["incident_id"].startswith(("synthetic-", "fixture-", "example-"))
    for source in sources:
        url = urlsplit(source["url"])
        if (
            url.scheme != "https"
            or not url.hostname
            or url.username
            or url.password
            or url.port
            or any(ord(c) < 33 or c in "<>\x7f" for c in source["url"])
        ):
            raise ValueError("Use credential-free HTTPS URLs on the default port")
        synthetic = (
            synthetic
            or url.hostname in {"example.com", "example.net", "example.org"}
            or url.hostname.endswith((".example", ".invalid", ".test"))
        )
    if synthetic and not payload.get("fixture"):
        raise ValueError("Synthetic evidence requires a fixture marker")
    source_ids = {source["id"] for source in sources}
    fact_ids = {fact["id"] for fact in facts}
    if len(source_ids) != len(sources) or len(fact_ids) != len(facts):
        raise ValueError("Duplicate evidence identity")
    if not any(source["type"] != "community" for source in sources):
        raise ValueError("Primary or original research evidence required")
    if any(set(fact["source_ids"]) - source_ids for fact in facts):
        raise ValueError("Unknown source reference")
    cited = editorial["claim_ids"] + [
        ref for section in editorial["sections"] for ref in section["claim_ids"]
    ]
    if set(cited) - fact_ids:
        raise ValueError("Unknown claim reference")
    if payload["revision"] == 1:
        if payload["supersedes"] is not None or payload["correction_note"] is not None:
            raise ValueError("Invalid correction chain")
    elif not payload["supersedes"] or not payload["correction_note"]:
        raise ValueError("Invalid correction chain")
    if any(
        datetime.fromisoformat(source["retrieved_at"]) > datetime.fromisoformat(payload["evidence_as_of"])
        for source in sources
    ):
        raise ValueError("Evidence as-of precedes retrieval")
    prose = "\n".join(
        [editorial[key] for key in ("title", "summary", "why_it_matters", "action")]
        + editorial["affected_technologies"]
        + [text for section in editorial["sections"] for text in [section["heading"], *section["paragraphs"]]]
    )
    if re.search(r"</?[a-z!]|javascript:|https?://|!\[", prose, re.I):
        raise ValueError("Editorial copy must be inert text with source-id citations")

    def tokens(value):
        return {
            re.sub(r"^[vV](?=\d)", "", token)
            for token in re.findall(
                r"CVE-\d{4}-\d{4,}|GHSA-[a-z0-9-]+|\b[vV]?\d+\.\d+(?:\.\d+)*(?:[-+][a-zA-Z0-9.-]+)?\b", value
            )
        }

    evidence = tokens("\n".join(fact["statement"] for fact in facts))
    for token in tokens(prose):
        if token not in evidence:
            raise ValueError(f"Unsupported identifier or version: {token}")
    return payload


def validate_publication(payload: dict) -> dict:
    _validate_shape(payload, "publication")
    candidate = validate_candidate(payload["candidate"])
    if candidate.get("fixture"):
        raise ValueError("Cannot publish fixture content")
    if content_hash(candidate) != payload["content_sha256"]:
        raise ValueError("Published content hash mismatch")
    if datetime.fromisoformat(payload["review"]["reviewed_at"]) > datetime.fromisoformat(
        payload["published_at"]
    ):
        raise ValueError("Publication precedes review")
    return payload


def make_publication(candidate: dict, review: dict, published_at: str) -> dict:
    validate_candidate(candidate)
    if candidate.get("fixture"):
        raise ValueError("Cannot publish fixture content")
    return validate_publication(
        {
            "schema_version": 1,
            "status": "published",
            "candidate": candidate,
            "content_sha256": content_hash(candidate),
            "review": review,
            "published_at": published_at,
        }
    )
