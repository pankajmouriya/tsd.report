import argparse
import json
import os
import ssl
import time
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import truststore

from pipeline.collectors.cisa_kev import CISA_KEV_URL, CisaKevCollector
from pipeline.collectors.epss import EPSS_URL, EpssCollector
from pipeline.collectors.nvd import NVD_URL, NvdCollector
from pipeline.compose import compose_candidate, promote_candidate, validate_interchange
from pipeline.http import BoundedHttpClient
from pipeline.models import CandidateSnapshot
from pipeline.ranking import rank_entries, select_recent_kev
from pipeline.storage import write_json_atomic

ROOT = Path(__file__).parents[1]
ALLOWED_HOSTS = {"www.cisa.gov", "api.first.org", "services.nvd.nist.gov"}


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include a timezone")
    return parsed.astimezone(UTC)


def _recording_http(recordings: Path, generated_at: datetime) -> BoundedHttpClient:
    cisa = json.loads((recordings / "cisa-kev.json").read_text(encoding="utf-8"))
    epss = json.loads((recordings / "epss.json").read_text(encoding="utf-8"))
    nvd = json.loads((recordings / "nvd.json").read_text(encoding="utf-8"))

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url).startswith(CISA_KEV_URL):
            payload = cisa
        elif str(request.url).startswith(EPSS_URL):
            requested = set(request.url.params.get("cve", "").split(","))
            data = [item for item in epss["data"] if item["cve"] in requested]
            payload = {**epss, "total": len(data), "data": data}
        elif str(request.url).startswith(NVD_URL):
            payload = nvd
        else:
            return httpx.Response(404, request=request)
        return httpx.Response(200, json=payload, request=request)

    return BoundedHttpClient(
        httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False),
        allowed_hosts=ALLOWED_HOSTS,
        clock=lambda: generated_at,
        sleeper=lambda _seconds: None,
        retries=0,
    )


def system_ssl_context() -> ssl.SSLContext:
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def _live_http() -> BoundedHttpClient:
    return BoundedHttpClient(
        httpx.Client(follow_redirects=False, verify=system_ssl_context()),
        allowed_hosts=ALLOWED_HOSTS,
        retries=2,
    )


def _collect(
    *,
    watch_date: date,
    generated_at: datetime,
    output: Path,
    run_dir: Path,
    http: BoundedHttpClient,
    nvd_api_key: str | None,
    live_rate_limit: bool,
) -> int:
    catalog = CisaKevCollector(http).collect()
    recent = select_recent_kev(catalog.records, watch_date=watch_date, lookback_days=30)
    epss = EpssCollector(http).collect([record.cve for record in recent])
    ranked = rank_entries(
        recent,
        epss.records,
        probability_min=0.5,
        percentile_min=0.95,
        limit=10,
    )
    nvd_collector = NvdCollector(http, api_key=nvd_api_key)
    nvd_by_cve = {}
    nvd_errors: dict[str, str] = {}
    for index, candidate in enumerate(ranked):
        if live_rate_limit and not nvd_api_key and index:
            time.sleep(6.5)
        try:
            enrichment = nvd_collector.collect(candidate.kev.cve)
            nvd_by_cve[candidate.kev.cve] = enrichment
            if enrichment is None:
                nvd_errors[candidate.kev.cve] = "No matching NVD record"
        except Exception as error:  # one optional enrichment must not erase CISA/FIRST facts
            nvd_by_cve[candidate.kev.cve] = None
            nvd_errors[candidate.kev.cve] = type(error).__name__
    snapshot = compose_candidate(
        watch_date=watch_date,
        generated_at=generated_at,
        catalog=catalog,
        epss=epss,
        nvd_by_cve=nvd_by_cve,
        nvd_errors=nvd_errors,
    )
    payload = snapshot.model_dump(mode="json")
    validate_interchange(payload, ROOT / "schemas/vulnerability-watch.schema.json")

    write_json_atomic(run_dir / "raw" / "cisa-kev.json", catalog.raw)
    write_json_atomic(run_dir / "raw" / "epss.json", epss.raw)
    for cve, enrichment in nvd_by_cve.items():
        if enrichment is not None:
            write_json_atomic(run_dir / "raw" / "nvd" / f"{cve}.json", enrichment.raw)
    write_json_atomic(
        run_dir / "normalized" / "recent-kev.json",
        [record.model_dump(mode="json") for record in recent],
    )
    write_json_atomic(run_dir / "enriched" / "candidate.json", payload)
    write_json_atomic(
        run_dir / "manifest.json",
        {
            "schema_version": 1,
            "date": watch_date.isoformat(),
            "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
            "status": "candidate",
            "recent_kev_count": len(recent),
            "selected_count": len(snapshot.entries),
            "selected_cves": [entry.cve for entry in snapshot.entries],
            "nvd_errors": nvd_errors,
            "sources": [source.model_dump(mode="json") for source in snapshot.sources],
        },
    )
    write_json_atomic(output, payload)
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tsd-vulnerability-watch")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("collect", "replay"):
        command = commands.add_parser(name)
        command.add_argument("--date", required=True)
        command.add_argument("--generated-at")
        command.add_argument("--output", type=Path, required=True)
        command.add_argument("--run-dir", type=Path, required=True)
        if name == "replay":
            command.add_argument("--recordings", type=Path, required=True)
    promote = commands.add_parser("promote")
    promote.add_argument("--input", type=Path, required=True)
    promote.add_argument("--output", type=Path, required=True)
    promote.add_argument("--reviewed-by", required=True)
    promote.add_argument("--reviewed-at", required=True)
    promote.add_argument("--review-pr", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "promote":
        candidate = CandidateSnapshot.model_validate_json(args.input.read_text(encoding="utf-8"))
        published = promote_candidate(
            candidate,
            reviewed_by=args.reviewed_by,
            reviewed_at=_parse_datetime(args.reviewed_at),
            review_pr=args.review_pr,
            output=args.output,
        )
        validate_interchange(
            published.model_dump(mode="json"), ROOT / "schemas/vulnerability-watch.schema.json"
        )
        return 0

    watch_date = date.fromisoformat(args.date)
    generated_at = _parse_datetime(args.generated_at) if args.generated_at else datetime.now(UTC)
    http = _recording_http(args.recordings, generated_at) if args.command == "replay" else _live_http()
    return _collect(
        watch_date=watch_date,
        generated_at=generated_at,
        output=args.output,
        run_dir=args.run_dir,
        http=http,
        nvd_api_key=os.environ.get("NVD_API_KEY"),
        live_rate_limit=args.command == "collect",
    )


if __name__ == "__main__":
    raise SystemExit(main())
