import httpx
import pytest

from pipeline.incidents.cloudflare import rollback_if_ours
from pipeline.incidents.sources import fetch
from pipeline.incidents.verify_live import verify_page


def test_served_revision_and_homepage_presence_are_required():
    sha = "a" * 40
    good = f'<meta name="tsd-revision" content="{sha}"><a href="/article/incident">Read</a>'.encode()
    verify_page(good, sha, "/article/incident")
    with pytest.raises(ValueError):
        verify_page(good, "b" * 40)
    with pytest.raises(ValueError):
        verify_page(good, sha, "/article/missing")


def test_live_verification_can_follow_only_bounded_allowlisted_redirects():
    def handler(request):
        if str(request.url).endswith("/story"):
            return httpx.Response(308, headers={"location": "/story/"})
        return httpx.Response(200, content=b"page")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(ValueError):
        fetch(client, "https://example.com/story", hosts={"example.com"})
    assert fetch(client, "https://example.com/story", hosts={"example.com"}, redirects=2)[0] == b"page"
    foreign = httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(302, headers={"location": "https://attacker.example/"})
        )
    )
    with pytest.raises(ValueError):
        fetch(foreign, "https://example.com/story", hosts={"example.com"}, redirects=2)


def test_failed_publication_can_restore_only_its_own_previous_deployment():
    class Pages:
        def __init__(self, sha):
            self.sha, self.restored = sha, None

        def current(self):
            return {"id": "new", "deployment_trigger": {"metadata": {"commit_hash": self.sha}}}

        def rollback(self, deployment):
            self.restored = deployment

    snapshot = {"id": "prior"}
    ours = Pages("a" * 40)
    rollback_if_ours(ours, snapshot, "a" * 40)
    assert ours.restored == snapshot
    other = Pages("b" * 40)
    with pytest.raises(ValueError):
        rollback_if_ours(other, snapshot, "a" * 40)
    assert other.restored is None
