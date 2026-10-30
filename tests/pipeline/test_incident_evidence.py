import pytest

from pipeline.incidents.evidence import source_text, verify_fact_quotes


def test_source_text_is_data_and_script_markup_never_executes():
    assert (
        source_text(b"<html><script>do_not_run()</script><p>A reported release was removed.</p></html>")
        == "A reported release was removed."
    )


def test_fact_statements_must_be_exact_attributed_source_excerpts():
    candidate = {
        "facts": [{"id": "claim", "statement": "The release was removed.", "source_ids": ["maintainer"]}]
    }
    verify_fact_quotes(
        candidate, {"maintainer": "Investigation: The release was removed. Scope remains unknown."}
    )
    candidate["facts"][0]["statement"] = "All versions are fixed."
    with pytest.raises(ValueError, match="not supported"):
        verify_fact_quotes(candidate, {"maintainer": "The release was removed."})
