"""E2E tests for scripts.bridge."""

from __future__ import annotations

import shutil
import tomllib
from pathlib import Path

import pytest

from scripts import bridge

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "claude_config"


@pytest.fixture()
def project_root(tmp_path: Path) -> Path:
    dst = tmp_path / "project"
    shutil.copytree(FIXTURE_ROOT, dst)
    return dst


def _find(entries: list[dict[str, str]], path: str) -> dict[str, str]:
    for entry in entries:
        if entry["path"] == path:
            return entry
    raise AssertionError(
        f"No entry for {path!r}. Got: {[e['path'] for e in entries]}"
    )


def test_sync_writes_expected_files(project_root: Path) -> None:
    report = bridge.cmd_sync("codex", project_root, dry_run=False)

    expected_paths = {
        ".agents/skills/sample-skill/SKILL.md",
        ".codex/agents/reviewer.toml",
        ".codex/hooks.json",
        ".codex/env-bridge.toml",
        "AGENTS.md",
        "AGENTS.override.md",
        "tests/AGENTS.md",
    }
    for rel in expected_paths:
        assert (project_root / rel).is_file(), f"missing {rel}"

    synced_paths = {e["path"] for e in report["synced"]}
    assert expected_paths.issubset(synced_paths)

    for entry in report["synced"]:
        if entry["path"] in expected_paths:
            assert entry["action"] == "created"


def test_sync_skill_content(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)

    skill_text = (project_root / ".agents/skills/sample-skill/SKILL.md").read_text()
    assert skill_text.startswith("---\n")
    assert "name: sample-skill" in skill_text
    assert "allowed-tools" not in skill_text.split("---", 2)[1]
    assert "$ARGUMENTS" not in skill_text
    assert "ARGUMENTS placeholder not supported" in skill_text


def test_sync_agent_content(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)

    agent_path = project_root / ".codex/agents/reviewer.toml"
    data = tomllib.loads(agent_path.read_text())
    assert data["name"] == "reviewer"
    assert data["model"] == "gpt-5.4"
    assert data["model_reasoning_effort"] == "high"
    assert data["sandbox_mode"] == "workspace-write"
    assert "developer_instructions" in data


def test_sync_hooks_and_env(project_root: Path) -> None:
    import json

    bridge.cmd_sync("codex", project_root, dry_run=False)

    hooks = json.loads((project_root / ".codex/hooks.json").read_text())
    assert "hooks" in hooks
    # Stop event maps through handler_types; SubagentStop has no Codex event → skipped.
    # At minimum, PreToolUse maps to some Codex event.
    assert len(hooks["hooks"]) >= 1

    env_text = (project_root / ".codex/env-bridge.toml").read_text()
    assert "[shell_environment_policy]" in env_text
    assert 'set.DEBUG = "1"' in env_text
    assert 'set.API_BASE_URL = "https://api.example.com"' in env_text


def test_sync_context_routing(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)

    root_agents = (project_root / "AGENTS.md").read_text()
    assert "Test Project" in root_agents
    assert "Keep functions under 50 lines" in root_agents

    override = (project_root / "AGENTS.override.md").read_text()
    assert "Debug mode is enabled" in override

    scoped = (project_root / "tests/AGENTS.md").read_text()
    assert "pytest fixtures" in scoped
    assert "tmp_path" in scoped


def test_sync_report_structure(project_root: Path) -> None:
    report = bridge.cmd_sync("codex", project_root, dry_run=False)
    assert set(report.keys()) == {"synced", "warnings", "gaps", "actions_required"}
    assert isinstance(report["synced"], list)
    assert all(isinstance(e, dict) and "path" in e and "action" in e for e in report["synced"])
    assert isinstance(report["warnings"], list)
    assert isinstance(report["gaps"], list)
    assert isinstance(report["actions_required"], list)

    # SubagentStop has no Codex mapping → should show up in gaps.
    assert any("SubagentStop" in w or "skipped" in w.lower() for w in report["gaps"])
    # Codex hooks enable instruction → actions_required.
    assert any("codex_hooks" in w or "Enable Codex hooks" in w for w in report["actions_required"])


def test_dry_run_writes_nothing(project_root: Path) -> None:
    # Snapshot what exists before.
    before = sorted(p for p in project_root.rglob("*") if p.is_file())
    report = bridge.cmd_sync("codex", project_root, dry_run=True)
    after = sorted(p for p in project_root.rglob("*") if p.is_file())
    assert before == after
    # Dry run still reports what would change.
    assert len(report["synced"]) > 0


def test_status_all_in_sync_after_sync(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)
    status = bridge.cmd_status("codex", project_root)

    assert status["drifted"] == []
    assert status["missing"] == []
    assert status["orphaned"] == []
    assert len(status["in_sync"]) > 0


def test_status_detects_missing_before_sync(project_root: Path) -> None:
    status = bridge.cmd_status("codex", project_root)
    assert len(status["missing"]) > 0
    assert status["in_sync"] == []


def test_status_detects_drift(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)
    (project_root / "AGENTS.md").write_text("tampered\n", encoding="utf-8")

    status = bridge.cmd_status("codex", project_root)
    assert "AGENTS.md" in status["drifted"]


def test_status_detects_orphan(project_root: Path) -> None:
    bridge.cmd_sync("codex", project_root, dry_run=False)
    orphan = project_root / ".codex/agents/stray.toml"
    orphan.write_text('name = "stray"\n', encoding="utf-8")

    status = bridge.cmd_status("codex", project_root)
    assert ".codex/agents/stray.toml" in status["orphaned"]


def test_cli_sync_prints_json(project_root: Path, capsys: pytest.CaptureFixture[str]) -> None:
    import json

    rc = bridge.main(
        ["sync", "--target", "codex", "--project-root", str(project_root)]
    )
    assert rc == 0
    captured = capsys.readouterr()
    report = json.loads(captured.out)
    assert "synced" in report
    assert "warnings" in report


def test_cli_diff_no_writes(project_root: Path, capsys: pytest.CaptureFixture[str]) -> None:
    before = sorted(p for p in project_root.rglob("*") if p.is_file())
    rc = bridge.main(
        ["diff", "--target", "codex", "--project-root", str(project_root)]
    )
    assert rc == 0
    after = sorted(p for p in project_root.rglob("*") if p.is_file())
    assert before == after
    out = capsys.readouterr().out
    # Should contain a unified diff header for new files.
    assert "+++ b/AGENTS.md" in out or "AGENTS.md" in out
