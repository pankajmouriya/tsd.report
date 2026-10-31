import argparse
import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import httpx

from pipeline.cli import system_ssl_context
from pipeline.incidents.contracts import content_hash, validate_candidate, validate_publication
from pipeline.incidents.discovery import STRUCTURED_SIGNAL_SOURCES, discover
from pipeline.incidents.evidence import capture, source_text, verify_fact_quotes
from pipeline.incidents.github import GitHub, decode_packet
from pipeline.incidents.publisher import (
    CHECK_NAME,
    approval_record,
    candidate_path,
    load_pr,
    publish,
    require_real_candidate,
)
from pipeline.incidents.sources import fetch, load_registry
from pipeline.storage import write_json_atomic

ROOT = Path(__file__).parents[2]


def packet(path):
    return validate_candidate(decode_packet(path.read_bytes()))


def markdown_text(value):
    return re.sub(r"([\\`*_{}\[\]()<>#@!|])", r"\\\1", value.replace("\n", " "))


def queue_text(state, manifest, overrides):
    groups = overrides.get("groups", {})
    dismissed = set(overrides.get("dismissed", []))
    seen, lines = (
        set(),
        [
            "# Incident leads",
            "",
            "Unreviewed discovery leads; no article is approved by this queue.",
            "",
            "## Source articles to triage",
            "",
            "These links may include research, product news, explainers or older posts updated recently. "
            "A source date is not a verified incident date.",
            "",
        ],
    )
    for lead in state["leads"]:
        if lead.get("source_id") in STRUCTURED_SIGNAL_SOURCES:
            continue
        group = groups.get(lead["url"], lead["lead_id"])
        if group in dismissed or group in seen:
            continue
        seen.add(group)
        lines.append(
            f"- [{markdown_text(lead['title'])}](<{lead['url']}>) — "
            f"{markdown_text(lead['source_name'])}; source date: "
            f"{lead['published_at'] or 'Unknown'}; lead `{lead['lead_id']}`"
        )
        if len(seen) >= 40:
            break
    if not seen:
        lines.append("No source articles currently in the queue.")
    signals = {}
    for lead in state["leads"]:
        if lead.get("source_id") not in STRUCTURED_SIGNAL_SOURCES:
            continue
        group = groups.get(lead["url"], lead["lead_id"])
        if group in dismissed:
            continue
        source = signals.setdefault(lead["source_id"], {"latest": lead, "count": 0})
        source["count"] += 1
    if signals:
        lines += [
            "",
            "## Structured advisory signals",
            "",
            "These repository commits are discovery signals, not confirmed incidents. "
            "Inspect individual advisory records and original references before drafting.",
            "",
        ]
        for source in signals.values():
            latest, count = source["latest"], source["count"]
            lines.append(
                f"- [{markdown_text(latest['source_name'])}](<{latest['url']}>) — "
                f"{count} retained commit signal{'s' if count != 1 else ''}; "
                f"latest source date: {latest['published_at'] or 'Unknown'}"
            )
    lines += ["", "## Coverage", ""]
    lines += [f"- {source['id']}: {source['status']}" for source in manifest["sources"]]
    lines += [
        "",
        "Ask Codex to investigate a lead, read its original evidence, and prepare a summary PR. "
        "Discovery is not confirmation.",
    ]
    return "\n".join(lines) + "\n"


def check(github, number, head, conclusion):
    pr, candidate = load_pr(github, number)
    if head != pr["head"]["sha"]:
        raise ValueError("Candidate changed during validation")
    digest = content_hash(candidate)
    project = os.environ.get("PREVIEW_PROJECT", "")
    preview_url = None
    if (
        conclusion == "success"
        and os.environ.get("TSD_PREVIEW_ENABLED") == "true"
        and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}", project)
    ):
        actual_url = os.environ.get("INCIDENT_PREVIEW_URL", "")
        if re.fullmatch(rf"https://[a-z0-9]+\.{re.escape(project)}\.pages\.dev/?", actual_url):
            preview_url = actual_url
    details = {"details_url": preview_url} if preview_url else {}
    github.api(
        "check-runs",
        "POST",
        {
            "name": CHECK_NAME,
            **details,
            "head_sha": head,
            "external_id": digest,
            "status": "completed",
            "conclusion": conclusion,
            "output": {
                "title": f"Incident candidate: {conclusion}",
                "summary": (f"[Read the candidate preview]({preview_url})\n\n" if preview_url else "")
                + f"Candidate SHA-256: `{digest}`. "
                f"Validation and preview apply only to head `{head}`.",
            },
        },
    )


def propose(github, branch):
    matched = re.fullmatch(r"automation/incident-([a-z0-9-]+)-r([1-9][0-9]*)", branch)
    if not matched:
        raise ValueError("Invalid incident branch")
    head = github.api(f"git/ref/heads/{branch}")["object"]["sha"]
    github.regular_file(f"data/candidates/incidents/{matched[1]}.json", head)
    candidate = github.file(f"data/candidates/incidents/{matched[1]}.json", head)
    validate_candidate(candidate)
    if candidate["schema_version"] == 1 and candidate["revision"] == 1:
        raise ValueError("New incidents require a short external brief with an original source")
    require_real_candidate(candidate)
    if candidate["incident_id"] != matched[1] or candidate["revision"] != int(matched[2]):
        raise ValueError("Candidate identity does not match branch")
    comparison = github.api(f"compare/main...{head}")
    files = comparison.get("files", [])
    if (
        len(files) != 1
        or files[0]["filename"] != candidate_path(candidate)
        or files[0]["status"] not in {"added", "modified"}
    ):
        raise ValueError("Proposal branch must change only the incident candidate")
    existing = github.api(f"pulls?state=open&head={github.repository.split('/')[0]}:{branch}")
    if existing:
        pr = existing[0]
    else:
        copy = candidate["editorial"]
        destination_id = candidate.get("destination_source_id")
        destination = next(
            (source for source in candidate["sources"] if source["id"] == destination_id),
            None,
        )
        reader_destination = (
            ["## Reader destination", f"[{markdown_text(destination['name'])}](<{destination['url']}>)"]
            if destination
            else []
        )
        body = "\n\n".join(
            [
                "## Summary",
                markdown_text(copy["summary"]),
                "## Why it matters",
                markdown_text(copy["why_it_matters"]),
                "## Supported action",
                markdown_text(copy["action"]),
                *reader_destination,
                "## Evidence",
                *[
                    f"- [{markdown_text(source['name'])}](<{source['url']}>)"
                    for source in candidate["sources"]
                ],
                "The candidate check links to the actual head-bound preview "
                "and retains its evidence packet. "
                "Approve only after reading both. New editorial changes require fresh approval. "
                "Website review does not authorize newsletter delivery.",
            ]
        )
        pr = github.api(
            "pulls",
            "POST",
            {
                "head": branch,
                "base": "main",
                "title": f"Incident: {candidate['editorial']['title']}",
                "body": body,
            },
        )
    if pr["user"]["login"] != "github-actions[bot]":
        raise ValueError("Use the trusted propose workflow to create a bot-authored PR")
    github.dispatch("incident-validate.yml", {"pr_number": str(pr["number"])})
    return {"pr_number": pr["number"], "url": pr["html_url"]}


def main(argv=None):
    parser = argparse.ArgumentParser(prog="tsd-incidents")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate")
    validate.add_argument("--input", type=Path, required=True)
    assemble = commands.add_parser("assemble")
    assemble.add_argument("--evidence", type=Path, required=True)
    assemble.add_argument("--editorial", type=Path, required=True)
    assemble.add_argument("--output", type=Path, required=True)
    assemble.add_argument("--captures", type=Path, required=True)
    verify_evidence = commands.add_parser("verify-evidence")
    verify_evidence.add_argument("--input", type=Path, required=True)
    verify_evidence.add_argument("--run-dir", type=Path, required=True)
    collect = commands.add_parser("discover")
    collect.add_argument("--state", type=Path, required=True)
    collect.add_argument("--run-dir", type=Path, required=True)
    collect.add_argument("--queue-issue", type=int)
    collect.add_argument("--update-queue", action="store_true")
    evidence = commands.add_parser("evidence")
    evidence.add_argument("--url", action="append", required=True)
    evidence.add_argument("--run-dir", type=Path, required=True)
    for name in ("propose", "load-pr", "check", "publish", "verify-deployment"):
        command = commands.add_parser(name)
        command.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY"))
        if name == "propose":
            command.add_argument("--branch", required=True)
        else:
            command.add_argument("--pr", type=int, required=True)
        if name == "load-pr":
            command.add_argument("--output", type=Path, required=True)
        if name == "check":
            command.add_argument("--head", required=True)
            command.add_argument("--conclusion", choices=["success", "failure"], required=True)
        if name == "verify-deployment":
            command.add_argument("--sha", required=True)
    args = parser.parse_args(argv)
    if args.command == "validate":
        candidate = packet(args.input)
        print(content_hash(candidate))
    elif args.command == "assemble":
        evidence = decode_packet(args.evidence.read_bytes())
        if "editorial" in evidence:
            raise ValueError("Evidence packet must not contain editorial output")
        candidate = {**evidence, "editorial": decode_packet(args.editorial.read_bytes())}
        validate_candidate(candidate)
        captured = json.loads((args.captures / "sources.json").read_text())
        texts = {}
        for source in candidate["sources"]:
            record = next((record for record in captured if record["url"] == source["url"]), None)
            if not record or record["retrieved_at"] != source["retrieved_at"]:
                raise ValueError("Evidence provenance does not match the source capture")
            index = captured.index(record)
            raw = (args.captures / f"source-{index}.txt").read_bytes()
            import hashlib

            if hashlib.sha256(raw).hexdigest() != record["sha256"]:
                raise ValueError("Captured source hash mismatch")
            texts[source["id"]] = source_text(raw)
        verify_fact_quotes(candidate, texts)
        write_json_atomic(args.output, candidate)
    elif args.command == "verify-evidence":
        _, hosts = load_registry(ROOT / "config/incident-sources.json")
        with httpx.Client(verify=system_ssl_context(), follow_redirects=False) as client:
            capture(packet(args.input), args.run_dir, client, hosts)
    elif args.command in {"discover", "evidence"}:
        sources, hosts = load_registry(ROOT / "config/incident-sources.json")
        with httpx.Client(verify=system_ssl_context(), follow_redirects=False) as client:
            if args.command == "evidence":
                retained = []
                urls = list(dict.fromkeys(args.url))
                if len(urls) > 20:
                    raise ValueError("At most twenty sources may be captured at once")
                for index, url in enumerate(urls):
                    body, _, _ = fetch(client, url, hosts=hosts)
                    args.run_dir.mkdir(parents=True, exist_ok=True)
                    (args.run_dir / f"source-{index}.txt").write_bytes(body)
                    import hashlib

                    retained.append(
                        {
                            "url": url,
                            "retrieved_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                            "sha256": hashlib.sha256(body).hexdigest(),
                        }
                    )
                write_json_atomic(args.run_dir / "sources.json", retained)
            else:
                previous = json.loads(args.state.read_text()) if args.state.exists() else {}
                state, manifest = discover(sources, previous, args.run_dir, client=client)
                if all(source["status"] == "failed" for source in manifest["sources"]):
                    raise ValueError("All discovery sources failed; state and queue preserved")
                write_json_atomic(args.state, state)
                overrides = json.loads((ROOT / "config/incident-overrides.json").read_text())
                queue = queue_text(state, manifest, overrides)
                (args.run_dir / "queue.md").write_text(queue)
                if args.queue_issue or args.update_queue:
                    github = GitHub(os.environ["GITHUB_REPOSITORY"])
                    number = args.queue_issue
                    if not number:
                        issues = github.api("issues?state=open&creator=github-actions%5Bbot%5D&per_page=100")
                        matches = [
                            issue
                            for issue in issues
                            if issue["title"] == "TSD incident leads" and "pull_request" not in issue
                        ]
                        if len(matches) > 1 or len(issues) >= 100:
                            raise ValueError("Ambiguous lead queue; supply --queue-issue")
                        if matches:
                            number = matches[0]["number"]
                        else:
                            number = github.api(
                                "issues", "POST", {"title": "TSD incident leads", "body": queue}
                            )["number"]
                    github.api(f"issues/{number}", "PATCH", {"body": queue})
    else:
        github = GitHub(args.repository)
        if args.command == "propose":
            print(json.dumps(propose(github, args.branch)))
        elif args.command == "load-pr":
            pr, candidate = load_pr(github, args.pr)
            require_real_candidate(candidate)
            write_json_atomic(args.output, candidate)
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                    output.write(f"head={pr['head']['sha']}\nincident={candidate['incident_id']}\n")
        elif args.command == "check":
            check(github, args.pr, args.head, args.conclusion)
            if args.conclusion == "success":
                github.dispatch("incident-publish.yml", {"pr_number": str(args.pr)})
        elif args.command == "publish":
            try:
                result = publish(github, args.pr)
            except ValueError as error:
                if str(error).startswith("Waiting for the editor"):
                    result = {"status": "waiting-for-review"}
                else:
                    raise
            print(json.dumps(result))
        elif args.command == "verify-deployment":
            if not re.fullmatch(r"[a-f0-9]{40}", args.sha):
                raise ValueError("Invalid deployment SHA")
            result = subprocess.run(
                ["git", "merge-base", "--is-ancestor", args.sha, "origin/main"], check=False
            )
            if result.returncode:
                raise ValueError("Deployment revision is not on main")
            pr = github.api(f"pulls/{args.pr}")
            if not pr.get("merged"):
                raise ValueError("Incident PR is not merged")
            _, candidate = load_pr(github, args.pr)
            path = f"data/production/incidents/{candidate['incident_id']}/{candidate['revision']}.json"
            publication = github.file(path, args.sha)
            validate_publication(publication)
            from pipeline.incidents.publisher import eligible_review

            approved = eligible_review(pr, github.pages(f"pulls/{args.pr}/reviews"))
            if publication["review"] != approval_record(
                approved, pr["head"]["sha"], args.pr, github.repository
            ):
                raise ValueError("Deployment publication does not match the editor's GitHub action")
            if (
                publication["content_sha256"] != content_hash(candidate)
                or publication["review"]["head_sha"] != pr["head"]["sha"]
            ):
                raise ValueError("Deployment publication does not match reviewed PR")
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                    output.write(f"incident={candidate['incident_id']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
