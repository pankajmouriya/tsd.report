import hashlib
import re
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path

from pipeline.incidents.sources import fetch
from pipeline.storage import write_json_atomic


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.hidden = [], 0

    def handle_starttag(self, tag, attributes):
        if tag in {"script", "style", "noscript", "head"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "head"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def normalized(value):
    return re.sub(r"\s+", " ", value).strip()


def source_text(body: bytes) -> str:
    parser = Text()
    parser.feed(body.decode("utf-8", errors="replace"))
    return normalized(" ".join(parser.parts))


def verify_fact_quotes(candidate, by_source):
    totals = {}
    for fact in candidate["facts"]:
        quote = normalized(fact["statement"])
        for source_id in fact["source_ids"]:
            source = by_source.get(source_id, "")
            if len(quote) < 16 or quote not in normalized(source):
                raise ValueError(f"Fact {fact['id']} is not supported by its attributed source excerpt")
            totals[source_id] = totals.get(source_id, 0) + len(quote.split())
            if totals[source_id] > min(100, max(25, int(len(source.split()) * 0.35))):
                raise ValueError("Evidence excerpts must remain short; summarize rather than mirror sources")
    # Matching words does not establish causal or semantic truth. The editor must
    # still review attribution, uncertainty and all prose against these excerpts.


def capture(candidate, run_dir: Path, client, hosts):
    records, texts = [], {}
    for index, source in enumerate(candidate["sources"]):
        body, _, _ = fetch(client, source["url"], hosts=hosts)
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / f"source-{index}.txt").write_bytes(body)
        texts[source["id"]] = source_text(body)
        records.append(
            {
                "id": source["id"],
                "url": source["url"],
                "retrieved_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "sha256": hashlib.sha256(body).hexdigest(),
                "file": f"source-{index}.txt",
            }
        )
    write_json_atomic(run_dir / "sources.json", records)
    verify_fact_quotes(candidate, texts)
    return records
