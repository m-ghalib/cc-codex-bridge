"""Read Claude Code context files: CLAUDE.md, CLAUDE.local.md, and .claude/rules/*.md."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from scripts.util import split_frontmatter

_MAX_IMPORT_DEPTH = 5
_IMPORT_RE = re.compile(r"^@([^\s]+)\s*$")


def _resolve_imports(
    file_path: Path,
    depth: int,
    seen: set[Path],
) -> str:
    """Read `file_path` and inline any `@path/to/file` imports.

    Paths in imports are relative to the file that contains them. Recursion is
    capped at `_MAX_IMPORT_DEPTH`; beyond that, import lines are left as-is.
    Circular imports (a file importing itself transitively) are also left
    as-is on the second visit.
    """
    try:
        resolved = file_path.resolve()
    except OSError:
        return ""

    if not file_path.is_file():
        return ""

    if resolved in seen:
        return file_path.read_text(encoding="utf-8")

    text = file_path.read_text(encoding="utf-8")
    if depth >= _MAX_IMPORT_DEPTH:
        return text

    next_seen = seen | {resolved}
    base_dir = file_path.parent

    out_lines: list[str] = []
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        match = _IMPORT_RE.match(stripped)
        if not match:
            out_lines.append(line)
            continue

        import_path = (base_dir / match.group(1)).resolve()
        if not import_path.is_file():
            out_lines.append(line)
            continue

        inlined = _resolve_imports(import_path, depth + 1, next_seen)
        # Preserve trailing newline semantics of the original import line.
        if line.endswith("\n") and not inlined.endswith("\n"):
            inlined += "\n"
        out_lines.append(inlined)

    return "".join(out_lines)


def _read_rule(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    frontmatter, body = split_frontmatter(text)
    paths = frontmatter.get("paths")
    return {
        "content": body,
        "paths": paths,
        "filename": path.name,
    }


def read_context(project_root: Path) -> dict[str, Any]:
    """Build the ContextTree for `project_root`.

    Returns a dict with keys:
        main:  str  — CLAUDE.md content with @imports resolved (empty if missing)
        local: str | None — CLAUDE.local.md content, or None if missing
        rules: list of {content, paths, filename} for .claude/rules/*.md

    @import lines (format: `@path/to/file` on their own line) in CLAUDE.md are
    replaced by the referenced file's content, recursively, up to depth 5.
    """
    main_path = project_root / "CLAUDE.md"
    if main_path.is_file():
        main = _resolve_imports(main_path, depth=0, seen=set())
    else:
        main = ""

    local_path = project_root / "CLAUDE.local.md"
    local = local_path.read_text(encoding="utf-8") if local_path.is_file() else None

    rules_dir = project_root / ".claude" / "rules"
    rules: list[dict[str, Any]] = []
    if rules_dir.is_dir():
        for rule_path in sorted(rules_dir.glob("*.md")):
            rules.append(_read_rule(rule_path))

    return {"main": main, "local": local, "rules": rules}
