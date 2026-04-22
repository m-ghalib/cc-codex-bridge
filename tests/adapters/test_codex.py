"""Tests for `scripts.adapters.codex`."""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent
from typing import Any

import tomllib

import pytest

from scripts.adapters import codex as codex_adapter
from scripts.readers.agents import read_agents
from scripts.readers.context import read_context
from scripts.readers.env import read_env
from scripts.readers.hooks import read_hooks
from scripts.readers.skills import read_skills
from scripts.util import split_frontmatter

FIXTURE_ROOT = Path(__file__).parent.parent / "fixtures" / "claude_config"


def _find(outputs: list[dict[str, Any]], path: str) -> dict[str, Any]:
    for out in outputs:
        if out["path"] == path:
            return out
    raise AssertionError(f"No output at {path!r}. Got: {[o['path'] for o in outputs]}")


def _load_fixture_inputs() -> tuple[list, list, dict, dict, dict]:
    return (
        read_skills(FIXTURE_ROOT),
        read_agents(FIXTURE_ROOT),
        read_hooks(FIXTURE_ROOT),
        read_env(FIXTURE_ROOT),
        read_context(FIXTURE_ROOT),
    )


def _run(**overrides: Any) -> list[dict[str, Any]]:
    skills, agents, hooks, env, context = _load_fixture_inputs()
    params = {
        "skills": skills,
        "agents": agents,
        "hooks": hooks,
        "env": env,
        "context": context,
        "project_root": FIXTURE_ROOT,
    }
    params.update(overrides)
    return codex_adapter.translate(**params)


def test_skill_frontmatter_keeps_name_and_combines_description() -> None:
    outputs = _run()
    skill_out = _find(outputs, ".agents/skills/sample-skill/SKILL.md")

    fm, body = split_frontmatter(skill_out["content"])
    assert fm.get("name") == "sample-skill"
    description = fm.get("description", "")
    assert "sample skill for testing" in description
    assert "When the user asks for a sample operation." in description
    assert "allowed-tools" not in fm
    assert "model" not in fm
    assert "effort" not in fm
    assert "context" not in fm
    assert "paths" not in fm
    assert "shell" not in fm

    assert body.strip()


def test_skill_body_tool_refs_rewritten() -> None:
    outputs = _run()
    skill_out = _find(outputs, ".agents/skills/sample-skill/SKILL.md")
    _, body = split_frontmatter(skill_out["content"])

    assert "`apply_patch`" in body
    assert "`shell`" in body
    assert "`shell (cat)`" in body
    assert "`shell (curl)`" in body
    assert "`Edit`" not in body
    assert "`Bash`" not in body
    assert "`Read`" not in body
    assert "`WebFetch`" not in body


def test_skill_strips_arguments_placeholder() -> None:
    outputs = _run()
    skill_out = _find(outputs, ".agents/skills/sample-skill/SKILL.md")

    assert "$ARGUMENTS" not in skill_out["content"]
    assert any(
        "placeholder" in w and "$ARGUMENTS" in w for w in skill_out["warnings"]
    )


def test_skill_strips_inline_exec_block(tmp_path: Path) -> None:
    skill = {
        "id": "exec-skill",
        "name": "exec-skill",
        "description": "desc",
        "when_to_use": None,
        "frontmatter": {},
        "body": "Run this: !`ls -la` please.\n",
        "extra_files": [],
    }
    outputs = codex_adapter.translate(
        skills=[skill],
        agents=[],
        hooks={},
        env={},
        context={"main": "", "local": None, "rules": []},
        project_root=tmp_path,
    )
    skill_out = _find(outputs, ".agents/skills/exec-skill/SKILL.md")
    assert "!`ls -la`" not in skill_out["content"]
    assert any("exec block" in w for w in skill_out["warnings"])


def test_skill_warns_for_every_dropped_field() -> None:
    outputs = _run()
    skill_out = _find(outputs, ".agents/skills/sample-skill/SKILL.md")

    for dropped in ("allowed-tools", "model", "effort", "context", "paths", "shell"):
        assert any(dropped in w for w in skill_out["warnings"]), (
            f"missing warning for {dropped}: {skill_out['warnings']}"
        )


def test_agent_toml_output_has_expected_fields() -> None:
    outputs = _run()
    agent_out = _find(outputs, ".codex/agents/reviewer.toml")

    data = tomllib.loads(agent_out["content"])
    assert data["name"] == "reviewer"
    assert data["description"].startswith("Reviews code")
    assert data["model"] == "gpt-5.4"  # opus → gpt-5.4
    assert data["model_reasoning_effort"] == "high"
    assert data["sandbox_mode"] == "workspace-write"  # acceptEdits → workspace-write
    assert "logic errors" in data["developer_instructions"].lower()


def test_agent_warns_for_dropped_fields() -> None:
    outputs = _run()
    agent_out = _find(outputs, ".codex/agents/reviewer.toml")

    for dropped in (
        "tools",
        "disallowedTools",
        "maxTurns",
        "memory",
        "isolation",
        "color",
    ):
        assert any(dropped in w for w in agent_out["warnings"]), (
            f"missing warning for {dropped}: {agent_out['warnings']}"
        )


def test_agent_model_and_permission_mappings(tmp_path: Path) -> None:
    cases = [
        ({"model": "haiku"}, "model", "gpt-5.4-mini"),
        ({"model": "sonnet"}, "model", "gpt-5.4"),
        ({"effort": "max"}, "model_reasoning_effort", "xhigh"),
        ({"effort": "xhigh"}, "model_reasoning_effort", "xhigh"),
        ({"permissionMode": "default"}, "sandbox_mode", "read-only"),
        ({"permissionMode": "plan"}, "sandbox_mode", "read-only"),
        ({"permissionMode": "bypassPermissions"}, "sandbox_mode", "danger-full-access"),
        ({"permissionMode": "dontAsk"}, "sandbox_mode", "danger-full-access"),
    ]
    for fm, key, expected in cases:
        agent = {"name": "a", "frontmatter": {**fm}, "body": "prompt"}
        outputs = codex_adapter.translate(
            skills=[],
            agents=[agent],
            hooks={},
            env={},
            context={"main": "", "local": None, "rules": []},
            project_root=tmp_path,
        )
        data = tomllib.loads(_find(outputs, ".codex/agents/a.toml")["content"])
        assert data[key] == expected, f"input={fm} key={key}"


def test_hooks_translated_and_unsupported_warned() -> None:
    outputs = _run()
    hooks_out = _find(outputs, ".codex/hooks.json")
    data = json.loads(hooks_out["content"])

    assert "PreToolUse" in data["hooks"]
    assert "PostToolUse" in data["hooks"]
    assert "SessionStart" in data["hooks"]
    # Stop has a prompt handler only → no hooks survive after handler filter
    assert "Stop" not in data["hooks"]

    # SubagentStop is unsupported as an event
    assert any("SubagentStop" in w for w in hooks_out["warnings"])
    # Its http handler is also unsupported
    # Stop had a prompt handler — warn about it
    assert any("prompt" in w and "not supported" in w for w in hooks_out["warnings"])

    # Config.toml hint emitted
    assert any("codex_hooks" in w for w in hooks_out["warnings"])


def test_hooks_preserve_command_and_matcher() -> None:
    outputs = _run()
    hooks_out = _find(outputs, ".codex/hooks.json")
    data = json.loads(hooks_out["content"])

    pre = data["hooks"]["PreToolUse"][0]
    assert pre["matcher"] == "Bash(rm *)"
    assert pre["hooks"][0]["type"] == "command"
    assert "Destructive" in pre["hooks"][0]["command"]
    assert pre["hooks"][0]["timeout"] == 10


def test_env_translation_format() -> None:
    outputs = _run()
    env_out = _find(outputs, ".codex/env-bridge.toml")

    assert env_out["content"].startswith("[shell_environment_policy]\n")
    assert 'set.DEBUG = "1"' in env_out["content"]
    assert 'set.API_BASE_URL = "https://api.example.com"' in env_out["content"]
    assert 'set.LOG_LEVEL = "debug"' in env_out["content"]

    # Must parse as valid TOML
    parsed = tomllib.loads(env_out["content"])
    assert parsed["shell_environment_policy"]["set"]["DEBUG"] == "1"


def test_context_root_agents_md_rewrites_tool_refs() -> None:
    outputs = _run()
    root = _find(outputs, "AGENTS.md")

    assert "`apply_patch`" in root["content"]
    assert "`shell (curl)`" in root["content"]
    assert "`shell`" in root["content"]
    assert "`shell (cat)`" in root["content"]
    assert "`Edit`" not in root["content"]
    assert "`WebFetch`" not in root["content"]


def test_context_scoped_rules_placed_in_nested_agents_md() -> None:
    outputs = _run()
    scoped = _find(outputs, "tests/AGENTS.md")
    assert "pytest fixtures" in scoped["content"]
    assert "tmp_path" in scoped["content"]
    # Scoped rules should NOT end up in root AGENTS.md
    root = _find(outputs, "AGENTS.md")
    assert "pytest fixtures" not in root["content"]


def test_context_unscoped_rules_appended_to_root() -> None:
    outputs = _run()
    root = _find(outputs, "AGENTS.md")
    # general.md has no `paths` — should appear in root AGENTS.md
    assert "Prefer composition over inheritance" in root["content"]
    assert "Rule from general.md" in root["content"]


def test_context_local_override_emitted() -> None:
    outputs = _run()
    override = _find(outputs, "AGENTS.override.md")
    assert "Debug mode is enabled" in override["content"]


def test_warnings_populated_everywhere() -> None:
    outputs = _run()
    # skill + agent + hooks all have warnings
    skill_out = _find(outputs, ".agents/skills/sample-skill/SKILL.md")
    agent_out = _find(outputs, ".codex/agents/reviewer.toml")
    hooks_out = _find(outputs, ".codex/hooks.json")

    assert skill_out["warnings"]
    assert agent_out["warnings"]
    assert hooks_out["warnings"]


def test_empty_inputs_produce_no_outputs(tmp_path: Path) -> None:
    outputs = codex_adapter.translate(
        skills=[],
        agents=[],
        hooks={},
        env={},
        context={"main": "", "local": None, "rules": []},
        project_root=tmp_path,
    )
    assert outputs == []


def test_unscoped_rules_without_path_prefix(tmp_path: Path) -> None:
    """A rule with only-glob paths (e.g. `**`) falls back to root."""
    context = {
        "main": "",
        "local": None,
        "rules": [
            {"content": "rule body", "paths": ["**"], "filename": "wild.md"},
        ],
    }
    outputs = codex_adapter.translate(
        skills=[],
        agents=[],
        hooks={},
        env={},
        context=context,
        project_root=tmp_path,
    )
    root = _find(outputs, "AGENTS.md")
    assert "rule body" in root["content"]
