import pytest

from pipeline.incidents.cli import check


@pytest.mark.parametrize(
    "url,accepted",
    [("https://abcd1234.tsd-report.pages.dev/", True), ("https://attacker.example/", False), ("", False)],
)
def test_check_links_only_to_the_actual_immutable_pages_deployment(monkeypatch, url, accepted):
    class GitHub:
        def api(self, path, method, data):
            self.data = data

    monkeypatch.setattr(
        "pipeline.incidents.cli.load_pr", lambda *_: ({"head": {"sha": "a" * 40}}, {"test": "packet"})
    )
    monkeypatch.setenv("PREVIEW_PROJECT", "tsd-report")
    monkeypatch.setenv("TSD_PREVIEW_ENABLED", "true")
    monkeypatch.setenv("INCIDENT_PREVIEW_URL", url)
    github = GitHub()
    check(github, 23, "a" * 40, "success")
    assert ("details_url" in github.data) == accepted
    if accepted:
        assert url in github.data["output"]["summary"]
