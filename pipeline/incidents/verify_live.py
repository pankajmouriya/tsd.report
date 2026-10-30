import argparse
import time
from html.parser import HTMLParser

import httpx

from pipeline.cli import system_ssl_context
from pipeline.incidents.sources import fetch


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
        raise ValueError("The incident is absent from the homepage")


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
    with httpx.Client(verify=system_ssl_context()) as client:
        for attempt in range(12):
            try:
                for path in ("/", article):
                    body, _, _ = fetch(client, f"https://tsd.report{path}", hosts={"tsd.report"}, redirects=2)
                    verify_page(body, args.sha, article if path == "/" else None)
                print(f"Verified public article and homepage at {args.sha}")
                return
            except (httpx.HTTPError, ValueError):
                if attempt == 11:
                    raise
                time.sleep(5)


if __name__ == "__main__":
    main()
