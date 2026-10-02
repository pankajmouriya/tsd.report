import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

import httpx


class SourceHttpError(RuntimeError):
    pass


@dataclass(frozen=True)
class Retrieval:
    url: str
    retrieved_at: datetime
    byte_count: int


class BoundedHttpClient:
    def __init__(
        self,
        client: httpx.Client,
        *,
        allowed_hosts: set[str],
        clock: Callable[[], datetime] | None = None,
        sleeper: Callable[[float], None] | None = None,
        retries: int = 2,
        max_query_chars: int = 2000,
    ) -> None:
        self.client = client
        self.allowed_hosts = frozenset(allowed_hosts)
        self.clock = clock or (lambda: datetime.now(UTC))
        self.sleeper = sleeper or time.sleep
        self.retries = retries
        self.max_query_chars = max_query_chars

    def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        max_bytes: int,
        headers: dict[str, str] | None = None,
    ) -> tuple[dict[str, Any], Retrieval]:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
            raise SourceHttpError(f"Source URL is not allowed: {url}")
        request_headers = {
            "accept": "application/json",
            "user-agent": "The-Security-Diff-Vulnerability-Watch/1.0 (+https://tsd.report)",
            **(headers or {}),
        }
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with self.client.stream(
                    "GET",
                    url,
                    params=params,
                    headers=request_headers,
                    timeout=httpx.Timeout(15.0, connect=10.0),
                ) as response:
                    if 300 <= response.status_code < 400:
                        raise SourceHttpError(f"Source redirect rejected for {url}")
                    if response.status_code == 429 or response.status_code >= 500:
                        raise httpx.HTTPStatusError(
                            "Transient source response", request=response.request, response=response
                        )
                    response.raise_for_status()
                    declared_size = response.headers.get("content-length")
                    if declared_size is not None and int(declared_size) > max_bytes:
                        raise SourceHttpError(f"Source response exceeded {max_bytes} bytes")
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > max_bytes:
                            raise SourceHttpError(f"Source response exceeded {max_bytes} bytes")
                    payload = json.loads(content)
                    if not isinstance(payload, dict):
                        raise SourceHttpError("Source response must be a JSON object")
                    return payload, Retrieval(
                        url=str(response.request.url),
                        retrieved_at=self.clock(),
                        byte_count=len(content),
                    )
            except SourceHttpError:
                raise
            except (httpx.HTTPError, json.JSONDecodeError) as error:
                last_error = error
                if attempt == self.retries:
                    break
                self.sleeper(float(2**attempt))
        raise SourceHttpError(f"Source request failed for {url}") from last_error
