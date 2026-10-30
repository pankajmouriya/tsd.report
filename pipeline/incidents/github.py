import base64
import json
import re
import subprocess
from urllib.parse import quote


class GitHubError(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"GitHub request failed (HTTP {status or 'unknown'})")


def decode_packet(data: bytes) -> dict:
    if len(data) > 250_000:
        raise ValueError("Incident packet exceeds size limit")

    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    return json.loads(data, object_pairs_hook=unique_keys)


class GitHub:
    def __init__(self, repository: str):
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
            raise ValueError("Invalid GitHub repository")
        self.repository = repository

    def api(self, path: str, method="GET", data=None):
        args = ["gh", "api", f"repos/{self.repository}/{path}", "--method", method]
        if data is not None:
            args += ["--input", "-"]
        result = subprocess.run(
            args,
            input=json.dumps(data) if data is not None else None,
            text=True,
            capture_output=True,
            check=False,
            timeout=60,
        )
        if result.returncode:
            status = re.search(r"HTTP (\d{3})", result.stderr)
            raise GitHubError(int(status[1]) if status else None)
        return json.loads(result.stdout) if result.stdout.strip() else None

    def pages(self, path):
        results = []
        for page in range(1, 21):
            items = self.api(f"{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
            if not isinstance(items, list):
                raise ValueError("Unexpected paginated GitHub response")
            results.extend(items)
            if len(items) < 100:
                return results
        raise ValueError("GitHub pagination limit exceeded")

    def file(self, path, ref):
        try:
            result = self.api(f"contents/{path}?ref={quote(ref, safe='')}")
        except GitHubError as error:
            if error.status == 404:
                return None
            raise
        if (
            result.get("type") != "file"
            or result.get("encoding") != "base64"
            or result.get("size", 0) > 250_000
        ):
            raise ValueError("Expected a bounded regular JSON file")
        return decode_packet(base64.b64decode(result["content"]))

    def dispatch(self, workflow, inputs):
        return self.api(f"actions/workflows/{workflow}/dispatches", "POST", {"ref": "main", "inputs": inputs})

    def regular_file(self, path, ref):
        tree = self.api(f"git/trees/{ref}?recursive=1")
        entries = [entry for entry in tree["tree"] if entry["path"] == path]
        if (
            tree.get("truncated")
            or len(entries) != 1
            or entries[0].get("mode") != "100644"
            or entries[0].get("type") != "blob"
        ):
            raise ValueError("Candidate must be a regular non-executable file")

    def publication_commit(self, parent, candidate_path, record_path, record):
        commit = self.api(f"git/commits/{parent}")
        blob = self.api(
            "git/blobs",
            "POST",
            {"content": json.dumps(record, ensure_ascii=False, indent=2) + "\n", "encoding": "utf-8"},
        )
        tree = self.api(
            "git/trees",
            "POST",
            {
                "base_tree": commit["tree"]["sha"],
                "tree": [
                    {"path": record_path, "mode": "100644", "type": "blob", "sha": blob["sha"]},
                    {"path": candidate_path, "mode": "100644", "type": "blob", "sha": None},
                ],
            },
        )
        publication = self.api(
            "git/commits",
            "POST",
            {
                "message": f"content: publish incident {record['candidate']['incident_id']}",
                "tree": tree["sha"],
                "parents": [parent],
            },
        )
        # A concurrent update is not an ancestor of this single-parent commit.
        # GitHub's non-force update therefore fails rather than losing that work.
        self.api("git/refs/heads/main", "PATCH", {"sha": publication["sha"], "force": False})
        return publication["sha"]
