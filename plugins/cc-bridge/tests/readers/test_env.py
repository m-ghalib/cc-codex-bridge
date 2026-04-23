"""Tests for `scripts.readers.env.read_env`."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from scripts.readers.env import read_env

FIXTURE_ROOT = Path(__file__).parent.parent / "fixtures" / "claude_config"


def _copy_fixture(tmp_path: Path) -> Path:
    dest = tmp_path / "project"
    shutil.copytree(FIXTURE_ROOT, dest)
    return dest


def _write_settings(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_reads_project_env_from_fixture(tmp_path: Path) -> None:
    project = _copy_fixture(tmp_path)

    result = read_env(project)

    assert result == {
        "DEBUG": "1",
        "API_BASE_URL": "https://api.example.com",
        "LOG_LEVEL": "debug",
    }


def test_local_overrides_project_for_same_key(tmp_path: Path) -> None:
    project = tmp_path / "project"
    _write_settings(
        project / ".claude" / "settings.json",
        {"env": {"LOG_LEVEL": "debug", "DEBUG": "1"}},
    )
    _write_settings(
        project / ".claude" / "settings.local.json",
        {"env": {"LOG_LEVEL": "info"}},
    )

    result = read_env(project)

    assert result == {"LOG_LEVEL": "info", "DEBUG": "1"}


def test_merges_project_and_local_keys(tmp_path: Path) -> None:
    project = tmp_path / "project"
    _write_settings(
        project / ".claude" / "settings.json",
        {"env": {"SHARED": "project-value", "PROJECT_ONLY": "p"}},
    )
    _write_settings(
        project / ".claude" / "settings.local.json",
        {"env": {"SHARED": "local-value", "LOCAL_ONLY": "l"}},
    )

    result = read_env(project)

    assert result == {
        "SHARED": "local-value",
        "PROJECT_ONLY": "p",
        "LOCAL_ONLY": "l",
    }


def test_missing_settings_returns_empty(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()

    assert read_env(project) == {}


def test_settings_without_env_key_returns_empty(tmp_path: Path) -> None:
    project = tmp_path / "project"
    _write_settings(
        project / ".claude" / "settings.json",
        {"hooks": {"PreToolUse": []}},
    )

    assert read_env(project) == {}
