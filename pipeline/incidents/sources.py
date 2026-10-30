import ipaddress
import json
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_BYTES = 2_500_000


class SourceSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1)
    url: str
    format: Literal["feed", "html", "github-commits"]
    link_hosts: list[str] = Field(min_length=1)
    path_prefix: str = "/"

    @field_validator("url")
    @classmethod
    def public_https(cls, value):
        validate_url(value)
        return value


def validate_url(url: str, hosts: set[str] | None = None) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port:
        raise ValueError("Only credential-free HTTPS on the default port is allowed")
    hostname = parsed.hostname.lower()
    if hostname == "localhost" or "." not in hostname or any(c in url for c in "\r\n<>\\"):
        raise ValueError("Invalid public source destination")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValueError("IP source destinations are forbidden")
    if hosts is not None and hostname not in hosts:
        raise ValueError("Source destination is not allowlisted")
    return url


def load_registry(path: Path) -> tuple[list[SourceSpec], set[str]]:
    registry = json.loads(path.read_text())
    if registry.get("schema_version") != 1:
        raise ValueError("Unsupported source registry")
    sources = [SourceSpec.model_validate(source) for source in registry["sources"]]
    if len({source.id for source in sources}) != len(sources):
        raise ValueError("Duplicate source id")
    return sources, set(registry["article_hosts"])


def fetch(
    client: httpx.Client, url: str, *, hosts: set[str], headers: dict | None = None, redirects: int = 0
):
    validate_url(url, hosts)
    with client.stream(
        "GET", url, headers=headers, follow_redirects=False, timeout=httpx.Timeout(20, connect=10)
    ) as response:
        if response.status_code == 304:
            return b"", dict(response.headers), 304
        if 300 <= response.status_code < 400:
            if redirects > 0 and response.headers.get("location"):
                from urllib.parse import urljoin

                return fetch(
                    client,
                    urljoin(url, response.headers["location"]),
                    hosts=hosts,
                    headers=headers,
                    redirects=redirects - 1,
                )
            raise ValueError("Source redirect rejected")
        response.raise_for_status()
        if int(response.headers.get("content-length", "0")) > MAX_BYTES:
            raise ValueError("Source response is too large")
        body = bytearray()
        for chunk in response.iter_bytes():
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("Source response is too large")
        return bytes(body), dict(response.headers), response.status_code
