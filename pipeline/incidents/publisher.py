import re
from datetime import UTC, datetime

from pipeline.incidents.contracts import (
    content_hash,
    make_publication,
    validate_candidate,
    validate_publication,
)
from pipeline.incidents.github import GitHub

CHECK_NAME = "incident-candidate"
EDITOR = "pankajmouriya"


def candidate_path(candidate):
    return f"data/candidates/incidents/{candidate['incident_id']}.json"


def publication_path(candidate):
    return f"data/production/incidents/{candidate['incident_id']}/{candidate['revision']}.json"


def validate_pr_scope(pr, files, candidate, repository):
    validate_candidate(candidate)
    head = pr["head"]
    branch = f"automation/incident-{candidate['incident_id']}-r{candidate['revision']}"
    if (
        head["repo"]["full_name"] != repository
        or head["ref"] != branch
        or pr["base"]["ref"] != "main"
        or pr["user"]["login"] != "github-actions[bot]"
    ):
        raise ValueError("PR is not an eligible same-repository bot incident PR")
    expected = candidate_path(candidate)
    if (
        pr["changed_files"] != 1
        or len(files) != 1
        or files[0]["filename"] != expected
        or files[0]["status"] not in {"added", "modified"}
    ):
        raise ValueError("Incident PR must change only its candidate JSON")
    return expected


def eligible_review(pr, reviews, editor=EDITOR):
    latest = {}
    for review in sorted(reviews, key=lambda review: review["id"]):
        if review["state"] != "PENDING":
            latest[review["user"]["login"].lower()] = review
    approved = latest.get(editor.lower())
    if any(review["state"] == "CHANGES_REQUESTED" for review in latest.values()):
        raise ValueError("An active review requests changes")
    if approved and approved["state"] == "APPROVED" and approved["commit_id"] == pr["head"]["sha"]:
        if pr.get("merged_at") and approved["submitted_at"] > pr["merged_at"]:
            raise ValueError("Approval must precede merge")
        return approved
    if (
        pr.get("merged")
        and (pr.get("merged_by") or {}).get("login", "").lower() == editor.lower()
        and re.fullmatch(r"[a-f0-9]{40}", pr.get("merge_commit_sha") or "")
        and pr.get("merged_at")
    ):
        return {
            "id": None,
            "approval_kind": "merge",
            "merge_sha": pr["merge_commit_sha"],
            "user": pr["merged_by"],
            "submitted_at": pr["merged_at"],
        }
    raise ValueError("Waiting for the editor's approval of the current head")


def approval_record(approved, head, number, repository):
    common = {
        "actor": approved["user"]["login"],
        "head_sha": head,
        "pr_number": number,
        "pr_url": f"https://github.com/{repository}/pull/{number}",
    }
    if approved.get("approval_kind") == "merge":
        return {
            **common,
            "approval_kind": "merge",
            "merged_at": approved["submitted_at"],
            "merge_sha": approved["merge_sha"],
        }
    return {
        **common,
        "approval_kind": "review",
        "reviewed_at": approved["submitted_at"],
        "review_id": approved["id"],
    }


def load_pr(github: GitHub, number: int):
    pr = github.api(f"pulls/{number}")
    if not re.fullmatch(r"[a-f0-9]{40}", pr["head"]["sha"]):
        raise ValueError("Invalid PR head")
    files = github.pages(f"pulls/{number}/files")
    if len(files) != 1 or not re.fullmatch(
        r"data/candidates/incidents/[a-z0-9-]+\.json", files[0]["filename"]
    ):
        raise ValueError("PR does not contain one incident candidate")
    github.regular_file(files[0]["filename"], pr["head"]["sha"])
    candidate = github.file(files[0]["filename"], pr["head"]["sha"])
    if candidate is None:
        raise ValueError("Candidate file missing at reviewed head")
    validate_pr_scope(pr, files, candidate, github.repository)
    return pr, candidate


def require_real_candidate(candidate):
    if candidate.get("fixture") or candidate["incident_id"].startswith(
        ("synthetic-", "fixture-", "example-")
    ):
        raise ValueError("Cannot publish fixture or synthetic content")


def check_succeeded(github, head, digest):
    checks = github.api(f"commits/{head}/check-runs?check_name={CHECK_NAME}&filter=latest&per_page=100")[
        "check_runs"
    ]
    return any(
        check["name"] == CHECK_NAME
        and check["head_sha"] == head
        and check["status"] == "completed"
        and check["conclusion"] == "success"
        and check.get("external_id") == digest
        and check.get("app", {}).get("slug") == "github-actions"
        for check in checks
    )


def publish(github: GitHub, number: int):
    pr, candidate = load_pr(github, number)
    require_real_candidate(candidate)
    approved = eligible_review(pr, github.pages(f"pulls/{number}/reviews"))
    digest = content_hash(candidate)
    if not check_succeeded(github, pr["head"]["sha"], digest):
        return {"status": "waiting-for-checks"}
    if not pr.get("merged"):
        if pr["state"] != "open" or pr.get("draft"):
            raise ValueError("PR is not open for publication")
        # Recheck review state immediately before the expected-head merge.
        fresh = github.api(f"pulls/{number}")
        if fresh["head"]["sha"] != pr["head"]["sha"]:
            raise ValueError("PR head changed during publication")
        eligible_review(fresh, github.pages(f"pulls/{number}/reviews"))
        result = github.api(
            f"pulls/{number}/merge", "PUT", {"sha": pr["head"]["sha"], "merge_method": "squash"}
        )
        if not result.get("merged"):
            raise ValueError("Expected-head merge was refused")
    main = github.api("git/ref/heads/main")["object"]["sha"]
    path = publication_path(candidate)
    existing = github.file(path, main)
    if existing:
        validate_publication(existing)
        if existing["content_sha256"] != digest or existing["review"] != approval_record(
            approved, pr["head"]["sha"], number, github.repository
        ):
            raise ValueError("Published incident revision is immutable")
        commit = main
    else:
        stored = github.file(candidate_path(candidate), main)
        if stored is None or content_hash(stored) != digest:
            raise ValueError("Merged candidate no longer matches the reviewed content")
        if candidate["revision"] > 1:
            previous_path = (
                f"data/production/incidents/{candidate['incident_id']}/{candidate['revision'] - 1}.json"
            )
            previous = github.file(previous_path, main)
            if not previous or validate_publication(previous)["content_sha256"] != candidate["supersedes"]:
                raise ValueError("Correction does not supersede the immutable previous revision")
        review = approval_record(approved, pr["head"]["sha"], number, github.repository)
        record = make_publication(candidate, review, datetime.now(UTC).isoformat().replace("+00:00", "Z"))
        commit = github.publication_commit(main, candidate_path(candidate), path, record)
    github.dispatch("incident-deploy.yml", {"publication_sha": commit, "pr_number": str(number)})
    return {"status": "deployment-queued", "sha": commit, "article": f"/article/{candidate['incident_id']}"}
