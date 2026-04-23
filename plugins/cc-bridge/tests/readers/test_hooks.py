"""Tests for the hooks reader."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from scripts.readers.hooks import read_hooks


FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "claude_config"


def _write_settings(dir_path: Path, payload: dict) -> None:
    claude_dir = dir_path / ".claude"
    claude_dir.mkdir(parents=True, exist_ok=True)
    (claude_dir / "settings.json").write_text(json.dumps(payload), encoding="utf-8")


def test_reads_project_hooks_from_fixture(tmp_path: Path) -> None:
    shutil.copytree(FIXTURE / ".claude", tmp_path / ".claude")

    hooks = read_hooks(tmp_path)

    assert set(hooks) == {
        "PreToolUse",
        "PostToolUse",
        "SessionStart",
        "SubagentStop",
        "Stop",
    }
    pre = hooks["PreToolUse"]
    assert isinstance(pre, list) and len(pre) == 1
    assert pre[0]["matcher"] == "Bash(rm *)"
    assert pre[0]["hooks"][0]["type"] == "command"
    assert pre[0]["hooks"][0]["command"].startswith("echo 'Destructive")
    assert pre[0]["hooks"][0]["timeout"] == 10


def test_project_hooks_override_user_hooks_for_same_event(tmp_path: Path) -> None:
    project = tmp_path / "project"
    home = tmp_path / "home"
    project.mkdir()
    home.mkdir()

    _write_settings(
        project,
        {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Bash",
                        "hooks": [{"type": "command", "command": "project.sh"}],
                    }
                ]
            }
        },
    )
    _write_settings(
        home,
        {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Bash",
                        "hooks": [{"type": "command", "command": "user.sh"}],
                    }
                ]
            }
        },
    )

    hooks = read_hooks(project, user_home=home)

    assert len(hooks["PreToolUse"]) == 1
    assert hooks["PreToolUse"][0]["hooks"][0]["command"] == "project.sh"


def test_user_only_hooks_are_preserved(tmp_path: Path) -> None:
    project = tmp_path / "project"
    home = tmp_path / "home"
    project.mkdir()
    home.mkdir()

    _write_settings(
        project,
        {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Bash",
                        "hooks": [{"type": "command", "command": "project.sh"}],
                    }
                ]
            }
        },
    )
    _write_settings(
        home,
        {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "",
                        "hooks": [{"type": "command", "command": "user-init.sh"}],
                    }
                ]
            }
        },
    )

    hooks = read_hooks(project, user_home=home)

    assert set(hooks) == {"PreToolUse", "SessionStart"}
    assert hooks["SessionStart"][0]["hooks"][0]["command"] == "user-init.sh"
    assert hooks["PreToolUse"][0]["hooks"][0]["command"] == "project.sh"


def test_missing_settings_returns_empty_dict(tmp_path: Path) -> None:
    assert read_hooks(tmp_path) == {}
    assert read_hooks(tmp_path, user_home=tmp_path / "nope") == {}


def test_settings_without_hooks_key_returns_empty_dict(tmp_path: Path) -> None:
    _write_settings(tmp_path, {"env": {"FOO": "bar"}})
    assert read_hooks(tmp_path) == {}


def test_malformed_json_returns_empty_dict(tmp_path: Path) -> None:
    claude_dir = tmp_path / ".claude"
    claude_dir.mkdir()
    (claude_dir / "settings.json").write_text("{not json", encoding="utf-8")
    assert read_hooks(tmp_path) == {}


def test_hook_entry_preserves_all_fields(tmp_path: Path) -> None:
    shutil.copytree(FIXTURE / ".claude", tmp_path / ".claude")

    hooks = read_hooks(tmp_path)

    http_entry = hooks["SubagentStop"][0]["hooks"][0]
    assert http_entry == {
        "type": "http",
        "url": "https://hooks.example.com/subagent-done",
        "timeout": 30,
    }

    prompt_entry = hooks["Stop"][0]["hooks"][0]
    assert prompt_entry == {
        "type": "prompt",
        "prompt": "Summarize what was accomplished in this session.",
    }

    post_entry = hooks["PostToolUse"][0]
    assert post_entry["matcher"] == "Bash"
    assert post_entry["hooks"][0] == {
        "type": "command",
        "command": "scripts/log-tool-use.sh",
    }


def test_no_user_home_argument_reads_project_only(tmp_path: Path) -> None:
    _write_settings(
        tmp_path,
        {
            "hooks": {
                "Stop": [
                    {
                        "matcher": "",
                        "hooks": [{"type": "prompt", "prompt": "done"}],
                    }
                ]
            }
        },
    )

    hooks = read_hooks(tmp_path)
    assert list(hooks) == ["Stop"]
