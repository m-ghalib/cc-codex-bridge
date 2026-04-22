"""Tests for `scripts.readers.skills`."""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

import pytest

from scripts.readers.skills import read_skills


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(text).lstrip("\n"), encoding="utf-8")


def test_full_frontmatter(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".claude" / "skills" / "full-skill"
    _write(
        skill_dir / "SKILL.md",
        """
        ---
        name: full-skill
        description: A skill with complete frontmatter.
        when_to_use: When the user asks for the full treatment.
        allowed-tools:
          - Bash
          - Read
        model: sonnet
        effort: high
        ---

        # Full Skill

        Body content here.
        """,
    )

    skills = read_skills(tmp_path)

    assert len(skills) == 1
    skill = skills[0]
    assert skill["id"] == "full-skill"
    assert skill["name"] == "full-skill"
    assert skill["description"] == "A skill with complete frontmatter."
    assert skill["when_to_use"] == "When the user asks for the full treatment."
    assert skill["frontmatter"]["allowed-tools"] == ["Bash", "Read"]
    assert skill["frontmatter"]["model"] == "sonnet"
    assert skill["frontmatter"]["effort"] == "high"
    assert "# Full Skill" in skill["body"]
    assert "Body content here." in skill["body"]
    assert skill["extra_files"] == []


def test_minimal_frontmatter(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".claude" / "skills" / "min-skill"
    _write(
        skill_dir / "SKILL.md",
        """
        ---
        name: min-skill
        ---

        Just a body.
        """,
    )

    skills = read_skills(tmp_path)

    assert len(skills) == 1
    skill = skills[0]
    assert skill["name"] == "min-skill"
    assert skill["description"] == ""
    assert skill["when_to_use"] is None
    assert skill["frontmatter"] == {"name": "min-skill"}
    assert "Just a body." in skill["body"]


def test_skill_directory_without_skill_md_is_skipped(tmp_path: Path) -> None:
    # One valid skill, one directory with no SKILL.md.
    valid = tmp_path / ".claude" / "skills" / "valid"
    _write(valid / "SKILL.md", "---\nname: valid\n---\n\nbody\n")

    orphan = tmp_path / ".claude" / "skills" / "orphan"
    orphan.mkdir(parents=True)
    (orphan / "README.md").write_text("no skill here", encoding="utf-8")

    skills = read_skills(tmp_path)

    ids = {s["id"] for s in skills}
    assert ids == {"valid"}


def test_collects_auxiliary_files(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".claude" / "skills" / "aux-skill"
    _write(
        skill_dir / "SKILL.md",
        """
        ---
        name: aux-skill
        ---

        body
        """,
    )
    _write(skill_dir / "scripts" / "run.sh", "#!/bin/sh\necho hi\n")
    _write(skill_dir / "scripts" / "helpers" / "util.py", "x = 1\n")
    _write(skill_dir / "references" / "notes.md", "# notes\n")
    _write(skill_dir / "reference.md", "top-level reference\n")

    skills = read_skills(tmp_path)

    assert len(skills) == 1
    extras = {str(p) for p in skills[0]["extra_files"]}
    assert extras == {
        "reference.md",
        "references/notes.md",
        "scripts/run.sh",
        "scripts/helpers/util.py",
    }


def test_returns_empty_when_skills_dir_missing(tmp_path: Path) -> None:
    assert read_skills(tmp_path) == []

    # .claude exists but .claude/skills does not.
    (tmp_path / ".claude").mkdir()
    assert read_skills(tmp_path) == []


def test_name_falls_back_to_directory_name(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".claude" / "skills" / "dir-named-skill"
    _write(
        skill_dir / "SKILL.md",
        """
        ---
        description: No name field here.
        ---

        body
        """,
    )

    skills = read_skills(tmp_path)

    assert len(skills) == 1
    assert skills[0]["id"] == "dir-named-skill"
    assert skills[0]["name"] == "dir-named-skill"
    assert skills[0]["description"] == "No name field here."


def test_empty_frontmatter_block(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".claude" / "skills" / "empty-fm"
    _write(
        skill_dir / "SKILL.md",
        """
        ---
        ---

        Just body, no fields.
        """,
    )

    skills = read_skills(tmp_path)

    assert len(skills) == 1
    skill = skills[0]
    assert skill["frontmatter"] == {}
    assert skill["name"] == "empty-fm"
    assert skill["description"] == ""
    assert skill["when_to_use"] is None
    assert "Just body, no fields." in skill["body"]


def test_existing_fixture_sample_skill() -> None:
    """The pre-built fixture skill should parse cleanly."""
    fixture_root = (
        Path(__file__).parent.parent / "fixtures" / "claude_config"
    )
    skills = read_skills(fixture_root)

    assert len(skills) == 1
    skill = skills[0]
    assert skill["id"] == "sample-skill"
    assert skill["name"] == "sample-skill"
    assert skill["frontmatter"]["allowed-tools"] == ["Bash", "Read", "Edit"]
    assert skill["frontmatter"]["model"] == "sonnet"
    assert skill["when_to_use"] == "When the user asks for a sample operation."
    assert "# Sample Skill" in skill["body"]
