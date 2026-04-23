"""Reader for Claude Code skills (`.claude/skills/<name>/SKILL.md`)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from scripts.util import split_frontmatter


def _collect_extra_files(skill_dir: Path) -> list[Path]:
    """Collect auxiliary files in the skill directory (excluding SKILL.md).

    Returns paths relative to `skill_dir`. Directories are walked recursively;
    only files are returned.
    """
    extras: list[Path] = []
    for entry in sorted(skill_dir.iterdir()):
        if entry.name == "SKILL.md":
            continue
        if entry.is_file():
            extras.append(entry.relative_to(skill_dir))
        elif entry.is_dir():
            for sub in sorted(entry.rglob("*")):
                if sub.is_file():
                    extras.append(sub.relative_to(skill_dir))
    return extras


def read_skills(project_root: Path) -> list[dict[str, Any]]:
    """Walk `<project_root>/.claude/skills/*/SKILL.md` and return skill records.

    Each record is a dict with keys: id, name, description, when_to_use,
    frontmatter, body, extra_files.

    Skill directories that lack a SKILL.md are skipped gracefully. If
    `.claude/skills/` does not exist, an empty list is returned.
    """
    skills_root = project_root / ".claude" / "skills"
    if not skills_root.is_dir():
        return []

    records: list[dict[str, Any]] = []
    for skill_dir in sorted(p for p in skills_root.iterdir() if p.is_dir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue

        text = skill_md.read_text(encoding="utf-8")
        frontmatter, body = split_frontmatter(text)

        skill_id = skill_dir.name
        name = frontmatter.get("name") or skill_id
        description = frontmatter.get("description") or ""
        when_to_use = frontmatter.get("when_to_use")

        records.append(
            {
                "id": skill_id,
                "name": name,
                "description": description,
                "when_to_use": when_to_use,
                "frontmatter": frontmatter,
                "body": body,
                "extra_files": _collect_extra_files(skill_dir),
            }
        )

    return records
