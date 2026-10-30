import os
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).parents[2]


def workflow(name: str) -> tuple[dict, str]:
    text = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
    return yaml.load(text, Loader=yaml.BaseLoader), text


def action_uses_are_pinned(document: dict) -> None:
    for job in document["jobs"].values():
        for step in job.get("steps", []):
            action = step.get("uses")
            if action:
                assert "@" in action
                assert len(action.rsplit("@", 1)[1].split()[0]) == 40


def test_candidate_workflow_is_scheduled_review_only_and_least_privilege() -> None:
    document, text = workflow("vulnerability-watch.yml")
    assert document["on"]["schedule"] == [{"cron": "17 6 * * *"}]
    assert "workflow_dispatch" in document["on"]
    assert document["permissions"] == {"contents": "write", "pull-requests": "write"}
    assert "concurrency" in document
    assert "uv sync --locked" in text
    assert "pipeline.cli collect" in text
    assert "automation/vulnerability-watch-" in text
    assert "gh pr create" in text
    assert "--draft" in text  # A candidate-only PR cannot be merged before label promotion.
    assert "data/candidates/vulnerability-watch" in text
    assert "data/production/vulnerability-watch" not in text
    assert "git push --force" not in text
    preserve_candidate = text.index('cp "$candidate" "$temporary_candidate"')
    clear_worktree_candidate = text.index('rm -- "$candidate"')
    switch_existing_branch = text.index('git switch --create "$branch" --track "origin/$branch"')
    assert preserve_candidate < clear_worktree_candidate < switch_existing_branch
    action_uses_are_pinned(document)


def test_promotion_workflow_uses_a_trusted_label_gate_without_executing_candidate_code() -> None:
    document, text = workflow("promote-vulnerability-watch.yml")
    assert document["on"] == {"pull_request_target": {"types": ["labeled"]}}
    assert document["permissions"] == {"contents": "write", "pull-requests": "read"}
    assert "publish-vulnerability-watch" in text
    assert "github.event.pull_request.head.repo.full_name == github.repository" in text
    assert "startsWith(github.event.pull_request.head.ref, 'automation/vulnerability-watch-')" in text
    assert "collaborators/$ACTOR/permission" in text
    assert "write|maintain|admin" in text
    assert "path: trusted" in text
    assert "path: candidate" in text
    assert "uv run --directory trusted --locked python -m pipeline.cli promote" in text
    assert "working-directory: candidate" not in text
    assert "git push --force" not in text
    action_uses_are_pinned(document)


def test_pull_request_validation_runs_locked_pipeline_checks() -> None:
    document, text = workflow("validate.yml")
    assert "ready_for_review" in document["on"]["pull_request"]["types"]
    assert "Require a promoted Watch snapshot before review-ready validation" in text
    assert "npm run validate:production" in text
    assert "actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97" in text
    assert "astral-sh/setup-uv@c771a70e6277c0a99b617c7a806ffedaca235ff9" in text
    assert "uv sync --locked" in text
    assert "npm run test:pipeline" in text
    assert "npm run lint:pipeline" in text
    action_uses_are_pinned(document)


def test_ready_watch_pr_requires_a_promoted_snapshot(tmp_path: Path) -> None:
    document, _ = workflow("validate.yml")
    step = next(
        step
        for step in document["jobs"]["quality"]["steps"]
        if step.get("name") == "Require a promoted Watch snapshot before review-ready validation"
    )
    assert "!github.event.pull_request.draft" in step["if"]
    watch_date = "2026-10-30"
    candidate = tmp_path / f"data/candidates/vulnerability-watch/{watch_date}.json"
    published = tmp_path / f"data/production/vulnerability-watch/{watch_date}.json"
    candidate.parent.mkdir(parents=True)
    candidate.write_text("{}")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    npm = bin_dir / "npm"
    npm.write_text("#!/bin/sh\nexit 0\n")
    npm.chmod(0o755)
    env = {
        **os.environ,
        "WATCH_BRANCH": f"automation/vulnerability-watch-{watch_date}",
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
    }

    def run_gate() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", step["run"]],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    assert "Apply publish-vulnerability-watch" in run_gate().stdout
    candidate.unlink()
    assert "Apply publish-vulnerability-watch" in run_gate().stdout
    published.parent.mkdir(parents=True)
    published.write_text("{}")
    assert run_gate().returncode == 0
