"""Shared utilities for cc-bridge readers and adapters."""

from __future__ import annotations

from typing import Any

import yaml

_FENCE = "---"


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Split YAML frontmatter from markdown body.

    Expects the text to start with `---`, have YAML between fences, and a
    closing `---`. Returns (frontmatter_dict, body). If no valid frontmatter
    is present, returns ({}, full_text).
    """
    if not text.startswith(_FENCE):
        return {}, text

    lines = text.splitlines(keepends=True)
    if not lines or lines[0].rstrip("\r\n") != _FENCE:
        return {}, text

    for idx in range(1, len(lines)):
        if lines[idx].rstrip("\r\n") == _FENCE:
            fm_text = "".join(lines[1:idx])
            body = "".join(lines[idx + 1:])
            parsed = yaml.safe_load(fm_text) if fm_text.strip() else {}
            if not isinstance(parsed, dict):
                parsed = {}
            if body.startswith("\n"):
                body = body[1:]
            return parsed, body

    return {}, text
