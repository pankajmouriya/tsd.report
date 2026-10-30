import copy
import json
from pathlib import Path

import pytest

from pipeline.incidents.contracts import content_hash
from pipeline.incidents.publisher import (
    candidate_path,
    eligible_review,
    publication_path,
    publish,
    validate_pr_scope,
)

ROOT = Path(__file__).parents[2]
SHA = "a" * 40
REPO = "example/newspaper"


def packet():
    value = json.loads((ROOT / "tests/fixtures/incidents/candidate.json").read_text())
    return value


def pull():
    return {
        "number": 7,
        "state": "open",
        "user": {"login": "github-actions[bot]"},
        "base": {"ref": "main"},
        "head": {
            "sha": SHA,
            "ref": "automation/incident-synthetic-release-alert-r1",
            "repo": {"full_name": REPO},
        },
        "changed_files": 1,
    }


def reviews():
    return [
        {
            "id": 1,
            "user": {"login": "editor"},
            "state": "APPROVED",
            "commit_id": SHA,
            "submitted_at": "2026-10-30T06:00:00Z",
        }
    ]


def test_scope_accepts_only_one_expected_content_file():
    candidate = packet()
    files = [{"filename": "data/candidates/incidents/synthetic-release-alert.json", "status": "added"}]
    assert validate_pr_scope(pull(), files, candidate, REPO) == files[0]["filename"]
    for changed in [
        [*files, {"filename": ".github/workflows/evil.yml", "status": "added"}],
        [{"filename": files[0]["filename"], "status": "renamed"}],
    ]:
        with pytest.raises(ValueError):
            validate_pr_scope(pull(), changed, candidate, REPO)


@pytest.mark.parametrize("change", ["fork", "author", "branch", "base", "head"])
def test_wrong_pr_identity_or_changed_head_is_rejected(change):
    pr = pull()
    if change == "fork":
        pr["head"]["repo"]["full_name"] = "attacker/newspaper"
    elif change == "author":
        pr["user"]["login"] = "attacker"
    elif change == "branch":
        pr["head"]["ref"] = "main"
    elif change == "base":
        pr["base"]["ref"] = "other"
    else:
        pr["head"]["sha"] = "b" * 40
    if change == "head":
        with pytest.raises(ValueError):
            eligible_review(pr, reviews(), "editor")
    else:
        with pytest.raises(ValueError):
            validate_pr_scope(
                pr,
                [{"filename": "data/candidates/incidents/synthetic-release-alert.json", "status": "added"}],
                packet(),
                REPO,
            )


def test_latest_editor_review_and_blocking_reviews_are_enforced():
    assert eligible_review(pull(), reviews(), "editor")["id"] == 1
    with pytest.raises(ValueError):
        eligible_review(pull(), reviews(), "other")
    revoked = copy.deepcopy(reviews()[0])
    revoked.update(id=2, state="DISMISSED")
    with pytest.raises(ValueError):
        eligible_review(pull(), [*reviews(), revoked], "editor")
    blocking = copy.deepcopy(reviews()[0])
    blocking.update(id=3, state="CHANGES_REQUESTED", user={"login": "collaborator"})
    with pytest.raises(ValueError):
        eligible_review(pull(), [*reviews(), blocking], "editor")


def test_hash_changes_even_for_an_added_editorial_sentence():
    candidate = packet()
    changed = copy.deepcopy(candidate)
    changed["editorial"]["sections"][0]["paragraphs"].append("Another statement.")
    assert content_hash(candidate) != content_hash(changed)


class FakeGitHub:
    repository = REPO

    def __init__(self):
        self.candidate = packet()
        del self.candidate["fixture"]
        self.candidate["incident_id"] = "reported-release"
        self.candidate["sources"][0]["url"] = "https://nodejs.org/en/security"
        self.pr = pull()
        self.pr["head"]["ref"] = "automation/incident-reported-release-r1"
        self.pr.update(merged=False, draft=False)
        self.review = reviews()[0]
        self.review["user"]["login"] = "pankajmouriya"
        self.records, self.commits, self.dispatches = {}, 0, []
        self.check_ok, self.race, self.revoke = True, False, False
        self.main = "c" * 40
        self.review_reads = 0

    def regular_file(self, path, head):
        return None

    def pages(self, path):
        if path.endswith("/files"):
            return [{"filename": candidate_path(self.candidate), "status": "added"}]
        self.review_reads += 1
        review = copy.deepcopy(self.review)
        if self.revoke and self.review_reads > 1:
            review["state"] = "DISMISSED"
        return [review]

    def api(self, path, method="GET", data=None):
        if path == "pulls/7":
            return copy.deepcopy(self.pr)
        if "/check-runs?" in path:
            return {
                "check_runs": [
                    {
                        "name": "incident-candidate",
                        "head_sha": SHA,
                        "status": "completed",
                        "conclusion": "success" if self.check_ok else "failure",
                        "external_id": content_hash(self.candidate),
                        "app": {"slug": "github-actions"},
                    }
                ]
            }
        if path == "pulls/7/merge":
            if self.race:
                raise ValueError("Expected-head merge refused")
            assert data["sha"] == SHA
            self.pr.update(merged=True, merged_at="2026-10-30T06:10:00Z")
            return {"merged": True}
        if path == "git/ref/heads/main":
            return {"object": {"sha": self.main}}
        raise AssertionError(path)

    def file(self, path, ref):
        if path == candidate_path(self.candidate):
            return copy.deepcopy(self.candidate)
        return self.records.get(path)

    def publication_commit(self, parent, old, new, record):
        assert parent == self.main
        self.records[new] = record
        self.commits += 1
        self.main = "d" * 40
        return self.main

    def dispatch(self, workflow, inputs):
        self.dispatches.append((workflow, inputs))


def test_publisher_preserves_reviewed_copy_and_retries_without_rewriting_it():
    github = FakeGitHub()
    approved_copy = copy.deepcopy(github.candidate)
    assert publish(github, 7)["status"] == "deployment-queued"
    record = github.records[publication_path(github.candidate)]
    assert record["candidate"] == approved_copy
    assert record["review"]["actor"] == "pankajmouriya"
    assert record["review"]["head_sha"] == SHA
    assert publish(github, 7)["status"] == "deployment-queued"
    assert github.commits == 1
    assert len(github.dispatches) == 2


@pytest.mark.parametrize("failure", ["checks", "race", "revoke"])
def test_failed_checks_races_and_revoked_approval_cannot_publish(failure):
    github = FakeGitHub()
    if failure == "checks":
        github.check_ok = False
    elif failure == "race":
        github.race = True
    else:
        github.revoke = True
    if failure == "checks":
        assert publish(github, 7)["status"] == "waiting-for-checks"
    else:
        with pytest.raises(ValueError):
            publish(github, 7)
    assert not github.pr["merged"]
    assert not github.records
    assert not github.dispatches
