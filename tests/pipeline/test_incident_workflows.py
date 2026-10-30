from pathlib import Path

import yaml

ROOT = Path(__file__).parents[2]


def test_incident_workflows_use_trusted_code_pinned_actions_and_no_branch_execution():
    for name in ("monitor", "propose", "validate", "publish", "deploy"):
        path = ROOT / f".github/workflows/incident-{name}.yml"
        document = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        for job in document["jobs"].values():
            for step in job["steps"]:
                if "uses" in step:
                    assert len(step["uses"].rsplit("@", 1)[1]) == 40
                if "run" in step:
                    assert "${{ inputs." not in step["run"]
                    assert "${{ github.event." not in step["run"]
        if name in ("propose", "validate", "publish"):
            checkout = [
                step
                for job in document["jobs"].values()
                for step in job["steps"]
                if step.get("uses", "").startswith("actions/checkout@")
            ]
            assert all(step["with"]["ref"] == "main" for step in checkout)
            assert "BUTTONDOWN_API_KEY" not in path.read_text()


def test_monitor_and_publisher_activation_are_explicit_and_preview_is_real():
    monitor = (ROOT / ".github/workflows/incident-monitor.yml").read_text()
    publisher = (ROOT / ".github/workflows/incident-publish.yml").read_text()
    preview = (ROOT / ".github/workflows/incident-validate.yml").read_text()
    assert "TSD_INCIDENT_MONITOR_ENABLED" in monitor
    assert "TSD_INCIDENT_PUBLISH_ENABLED" in publisher
    assert "pull_request_target:" in publisher and "types: [closed]" in publisher
    assert "TSD_INCIDENT_PREVIEW:" in preview and "CONTENT_MODE: production" in preview
    assert "build:fixture" not in preview
    assert "load-pr" in preview and "check --pr" in preview


def test_production_uploads_share_serialization_and_reject_superseded_builds():
    for filename in ("validate.yml", "incident-deploy.yml"):
        text = (ROOT / ".github/workflows" / filename).read_text()
        assert "group: production-site-upload" in text
        assert "git ls-remote origin refs/heads/main" in text
    deployment = (ROOT / ".github/workflows/incident-deploy.yml").read_text()
    assert "verify-deployment" in deployment and "verify_live" in deployment
    assert "newsletter:send" not in deployment
