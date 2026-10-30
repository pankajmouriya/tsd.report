import json
import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

from pipeline.incidents.sources import SourceSpec, validate_url


def timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (ValueError, TypeError):
            return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC).isoformat().replace("+00:00", "Z")


def canonical_url(value, source):
    value = urljoin(source.url, value)
    validate_url(value, set(source.link_hosts))
    parsed = urlsplit(value)
    if not parsed.path.startswith(source.path_prefix):
        raise ValueError("Not a source article path")
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.startswith("utm_") and k not in {"fbclid", "gclid"}
    ]
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path, urlencode(query), ""))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.current, self.parts = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.current, self.parts = dict(attrs).get("href"), []

    def handle_data(self, value):
        if self.current:
            self.parts.append(value)

    def handle_endtag(self, tag):
        if tag == "a" and self.current:
            self.links.append((self.current, " ".join(self.parts)))
            self.current = None


def parse_entries(source: SourceSpec, body: bytes) -> list[dict]:
    raw = []
    if source.format == "github-commits":
        for item in json.loads(body):
            raw.append(
                (
                    item["html_url"],
                    item["commit"]["message"].splitlines()[0],
                    item["commit"]["committer"]["date"],
                    None,
                )
            )
    elif source.format == "html":
        parser = Links()
        parser.feed(body.decode("utf-8", errors="replace"))
        raw = [(url, title, None, None) for url, title in parser.links]
    else:
        if b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper():
            raise ValueError("Feed DTDs and entities are forbidden")
        try:
            root = ET.fromstring(body)
        except ET.ParseError as error:
            raise ValueError("Malformed feed") from error
        if root.tag.rsplit("}", 1)[-1] not in {"rss", "feed", "RDF"}:
            raise ValueError("Not an RSS/Atom feed")
        for item in root.iter():
            if item.tag.rsplit("}", 1)[-1] not in {"item", "entry"}:
                continue
            fields = {}
            links = []
            for child in item:
                key = child.tag.rsplit("}", 1)[-1]
                fields[key] = "".join(child.itertext())
                if key == "link" and child.attrib.get("rel", "alternate") == "alternate":
                    links.append(child.attrib.get("href") or child.text or "")
            raw.append(
                (
                    links[0] if links else fields.get("link", ""),
                    fields.get("title", ""),
                    fields.get("published") or fields.get("pubDate"),
                    fields.get("updated"),
                )
            )
    results = {}
    for url, title, published, updated in raw:
        try:
            url = canonical_url(url, source)
        except ValueError:
            continue
        title = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]*>", "", title))).strip()[:300]
        if not url or len(title) < 12:
            continue
        results[url] = {
            "url": url,
            "title": title,
            "published_at": timestamp(published),
            "updated_at": timestamp(updated),
        }
    return list(results.values())
