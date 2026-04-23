"""Read Claude Code agent definitions from `.claude/agents/*.md`."""

from __future__ import annotations

from pathlib import Path

from scripts.util import split_frontmatter


def read_agents(project_root: Path) -> list[dict]:
    agents_dir = project_root / ".claude" / "agents"
    if not agents_dir.is_dir():
        return []

    agents: list[dict] = []
    for path in sorted(agents_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        frontmatter, body = split_frontmatter(text)
        name = frontmatter.get("name") or path.stem
        agents.append(
            {
                "name": name,
                "frontmatter": frontmatter,
                "body": body,
            }
        )
    return agents
