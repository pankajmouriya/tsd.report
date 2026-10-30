import argparse
import json
import os
import re
from pathlib import Path

import httpx

from pipeline.cli import system_ssl_context
from pipeline.storage import write_json_atomic


class Pages:
    def __init__(self, client):
        self.client = client
        account, project = os.environ["CLOUDFLARE_ACCOUNT_ID"], os.environ["CLOUDFLARE_PROJECT_NAME"]
        if not re.fullmatch(r"[a-f0-9]{32}", account) or not re.fullmatch(
            r"[a-z0-9][a-z0-9-]{0,62}", project
        ):
            raise ValueError("Invalid Cloudflare project identity")
        self.path = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{project}"

    def request(self, method, suffix=""):
        headers = {"Authorization": f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}"}
        with self.client.stream(
            method, self.path + suffix, headers=headers, timeout=20, follow_redirects=False
        ) as response:
            response.raise_for_status()
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > 2_000_000:
                    raise ValueError("Cloudflare response exceeds limit")
            payload = json.loads(body)
            if not payload.get("success"):
                raise ValueError("Cloudflare operation did not succeed")
            return payload["result"]

    def current(self):
        deployment = self.request("GET").get("canonical_deployment")
        if not deployment or deployment.get("latest_stage", {}).get("status") != "success":
            raise ValueError("No successful production deployment available for recovery")
        return deployment

    def rollback(self, deployment):
        deployment_id = deployment["id"]
        if not re.fullmatch(r"[a-f0-9-]{32,36}", deployment_id):
            raise ValueError("Invalid rollback deployment identity")
        self.request("POST", f"/deployments/{deployment_id}/rollback")
        if self.current()["id"] != deployment_id:
            raise ValueError("Rollback did not restore the expected production deployment")


def rollback_if_ours(pages, snapshot, expected_sha):
    current = pages.current()
    if current["id"] == snapshot["id"]:
        return
    if current.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") != expected_sha:
        raise ValueError("Refusing to roll back a different production deployment")
    pages.rollback(snapshot)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["snapshot", "rollback"])
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--sha")
    args = parser.parse_args()
    with httpx.Client(verify=system_ssl_context()) as client:
        pages = Pages(client)
        if args.command == "snapshot":
            current = pages.current()
            write_json_atomic(args.snapshot, {"id": current["id"], "project": pages.path})
        else:
            if not args.sha or not re.fullmatch(r"[a-f0-9]{40}", args.sha):
                raise ValueError("Expected failed revision required for rollback")
            snapshot = json.loads(args.snapshot.read_text())
            if snapshot["project"] != pages.path:
                raise ValueError("Rollback snapshot belongs to another project")
            rollback_if_ours(pages, snapshot, args.sha)


if __name__ == "__main__":
    main()
