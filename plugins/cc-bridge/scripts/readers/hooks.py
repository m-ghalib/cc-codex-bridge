"""Reader for Claude Code hooks configuration.

Reads the ``hooks`` key from Claude Code ``settings.json`` files at both the
project and user scopes and merges them. Project-scope events override
user-scope events with the same event name; user-only events are kept.
"""

from __future__ import annotations

import json
from pathlib import Path


def _load_hooks(settings_path: Path) -> dict:
    """Return the ``hooks`` dict from a settings.json, or {} if unavailable."""
    if not settings_path.is_file():
        return {}
    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict):
        return {}
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return {}
    return hooks


def read_hooks(project_root: Path, user_home: Path | None = None) -> dict:
    """Read and merge Claude Code hooks from project and user settings.

    Project events take precedence over user events with the same event name.
    Events only present in user settings are preserved.
    """
    project_hooks = _load_hooks(Path(project_root) / ".claude" / "settings.json")
    user_hooks: dict = {}
    if user_home is not None:
        user_hooks = _load_hooks(Path(user_home) / ".claude" / "settings.json")

    merged: dict = {}
    merged.update(user_hooks)
    merged.update(project_hooks)
    return merged
