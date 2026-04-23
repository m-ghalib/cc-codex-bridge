"""Read the `env` key from Claude Code `.claude/settings*.json` files."""

from __future__ import annotations

import json
from pathlib import Path


def _load_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    env = data.get("env") if isinstance(data, dict) else None
    if not isinstance(env, dict):
        return {}
    return {str(k): str(v) for k, v in env.items()}


def read_env(project_root: Path) -> dict[str, str]:
    claude_dir = project_root / ".claude"
    project = _load_env(claude_dir / "settings.json")
    local = _load_env(claude_dir / "settings.local.json")
    return {**project, **local}
