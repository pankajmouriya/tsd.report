import argparse
import json
import time
from html.parser import HTMLParser
from pathlib import Path

import httpx

from pipeline.cli import system_ssl_context
from pipeline.incidents.contracts import validate_publication
from pipeline.incidents.sources import fetch

ROOT = Path(__file__).parents[2]


class PageEvidence(HTMLParser):
    def __init__(self):
        super().__init__()
        self.revision, self.links = None, set()

    def handle_starttag(self, tag, attributes):
        values = dict(attributes)
        if tag == "meta" and values.get("name") == "tsd-revision":
            self.revision = values.get("content")
        if tag == "a":
            self.links.add(values.get("href"))


def verify_page(body, sha, article=None):
    page = PageEvidence()
    page.feed(body.decode("utf-8"))
    if page.revision != sha:
        raise ValueError("Served page does not have the expected deployment revision")
    if article and article not in page.links and article + "/" not in page.links:
        raise ValueError("The expected incident destination is absent")


def publication_destination(incident, root=ROOT):
    directory = root / "data/production/incidents" / incident
    records = [validate_publication(json.loads(path.read_text())) for path in directory.glob("*.json")]
    if not records or any(record["candidate"]["incident_id"] != incident for record in records):
        raise ValueError("No matching published incident record")
    candidate = max(records, key=lambda record: record["candidate"]["revision"])["candidate"]
    if candidate["schema_version"] == 2:
        return next(
            source["url"]
            for source in candidate["sources"]
            if source["id"] == candidate["destination_source_id"]
        )
    return f"/article/{incident}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--incident", required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args()
    import re

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.incident) or not re.fullmatch(
        r"[a-f0-9]{40}", args.sha
    ):
        raise ValueError("Invalid publication identity")
    article = f"/article/{args.incident}"
    destination = publication_destination(args.incident)
    with httpx.Client(verify=system_ssl_context()) as client:
        for attempt in range(12):
            try:
                for path in ("/", article):
                    body, _, _ = fetch(client, f"https://tsd.report{path}", hosts={"tsd.report"}, redirects=2)
                    expected = destination if path == "/" or destination.startswith("https://") else None
                    verify_page(body, args.sha, expected)
                print(f"Verified public article and homepage at {args.sha}")
                return
            except (httpx.HTTPError, ValueError):
                if attempt == 11:
                    raise
                time.sleep(5)


if __name__ == "__main__":
    main()
