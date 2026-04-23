"""Tests for scripts.readers.agents."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from scripts.readers.agents import read_agents

FIXTURE_AGENT = (
    Path(__file__).resolve().parents[1]
    / "fixtures"
    / "claude_config"
    / ".claude"
    / "agents"
    / "reviewer.md"
)


def _agents_dir(root: Path) -> Path:
    path = root / ".claude" / "agents"
    path.mkdir(parents=True, exist_ok=True)
    return path


def test_parses_full_frontmatter(tmp_path: Path) -> None:
    shutil.copy(FIXTURE_AGENT, _agents_dir(tmp_path) / "reviewer.md")

    agents = read_agents(tmp_path)

    assert len(agents) == 1
    agent = agents[0]
    assert agent["name"] == "reviewer"

    fm = agent["frontmatter"]
    assert fm["name"] == "reviewer"
    assert fm["description"] == "Reviews code for quality issues and suggests improvements."
    assert fm["model"] == "opus"
    assert fm["effort"] == "high"
    assert fm["permissionMode"] == "acceptEdits"
    assert fm["tools"] == ["Read", "Grep", "Glob", "Bash"]
    assert fm["disallowedTools"] == ["Write"]
    assert fm["maxTurns"] == 10
    assert fm["memory"] == "project"
    assert fm["isolation"] == "worktree"
    assert fm["color"] == "blue"


def test_body_is_system_prompt(tmp_path: Path) -> None:
    shutil.copy(FIXTURE_AGENT, _agents_dir(tmp_path) / "reviewer.md")

    agents = read_agents(tmp_path)
    body = agents[0]["body"]

    assert body.startswith("You are a code reviewer.")
    assert "Logic errors and bugs" in body
    assert "specific line numbers" in body
    assert "---" not in body.splitlines()[0]


def test_minimal_frontmatter(tmp_path: Path) -> None:
    agent_file = _agents_dir(tmp_path) / "tiny.md"
    agent_file.write_text(
        "---\nname: tiny\ndescription: A tiny agent.\n---\nHello, I am tiny.\n",
        encoding="utf-8",
    )

    agents = read_agents(tmp_path)

    assert len(agents) == 1
    assert agents[0]["name"] == "tiny"
    assert agents[0]["frontmatter"] == {"name": "tiny", "description": "A tiny agent."}
    assert agents[0]["body"].strip() == "Hello, I am tiny."


def test_missing_agents_directory(tmp_path: Path) -> None:
    assert read_agents(tmp_path) == []


def test_name_falls_back_to_filename(tmp_path: Path) -> None:
    agent_file = _agents_dir(tmp_path) / "unnamed.md"
    agent_file.write_text(
        "---\ndescription: No name here.\n---\nbody text\n",
        encoding="utf-8",
    )

    agents = read_agents(tmp_path)

    assert len(agents) == 1
    assert agents[0]["name"] == "unnamed"
    assert agents[0]["frontmatter"] == {"description": "No name here."}
    assert agents[0]["body"].strip() == "body text"


def test_no_frontmatter(tmp_path: Path) -> None:
    agent_file = _agents_dir(tmp_path) / "plain.md"
    agent_file.write_text("Just a body, no frontmatter.\n", encoding="utf-8")

    agents = read_agents(tmp_path)

    assert len(agents) == 1
    assert agents[0]["name"] == "plain"
    assert agents[0]["frontmatter"] == {}
    assert agents[0]["body"] == "Just a body, no frontmatter.\n"


def test_empty_frontmatter(tmp_path: Path) -> None:
    agent_file = _agents_dir(tmp_path) / "blank.md"
    agent_file.write_text("---\n---\nbody only\n", encoding="utf-8")

    agents = read_agents(tmp_path)

    assert len(agents) == 1
    assert agents[0]["name"] == "blank"
    assert agents[0]["frontmatter"] == {}
    assert agents[0]["body"].strip() == "body only"


@pytest.mark.parametrize("count", [2, 3])
def test_multiple_agents_sorted(tmp_path: Path, count: int) -> None:
    agents_dir = _agents_dir(tmp_path)
    names = [f"agent_{i}" for i in range(count)]
    for name in reversed(names):
        (agents_dir / f"{name}.md").write_text(
            f"---\nname: {name}\n---\nbody of {name}\n",
            encoding="utf-8",
        )

    agents = read_agents(tmp_path)

    assert [a["name"] for a in agents] == names
