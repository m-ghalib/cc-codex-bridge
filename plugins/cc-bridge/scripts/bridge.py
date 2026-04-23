"""cc-bridge orchestrator CLI.

Subcommands:
    sync    run readers + adapter, write Codex-native files
    diff    preview changes as unified diffs (no writes)
    status  compare current Codex config against what readers+adapter would produce

Usage:
    uv run python scripts/bridge.py sync --target codex --project-root .
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

from scripts.adapters import codex as codex_adapter
from scripts.readers.agents import read_agents
from scripts.readers.context import read_context
from scripts.readers.env import read_env
from scripts.readers.hooks import read_hooks
from scripts.readers.skills import read_skills

_SUPPORTED_TARGETS = {"codex"}

_GAP_MARKERS = ("skipped", "no Codex equivalent")
_ACTION_MARKERS = (
    "Enable Codex hooks",
    "extra file to copy",
    "substitute manually",
    "run command manually",
    "merged into an active Codex config.toml",
)
_ORPHAN_SCAN_SKIP_DIRS = {".claude", ".codex", ".git", ".jj"}


def _run_readers(project_root: Path, user_home: Path | None = None) -> dict[str, Any]:
    return {
        "skills": read_skills(project_root),
        "agents": read_agents(project_root),
        "hooks": read_hooks(project_root, user_home=user_home),
        "env": read_env(project_root),
        "context": read_context(project_root),
    }


def _run_translate(
    target: str, inputs: dict[str, Any], project_root: Path
) -> list[dict[str, Any]]:
    if target != "codex":
        raise ValueError(f"Unsupported target: {target!r}")
    return codex_adapter.translate(
        inputs["skills"],
        inputs["agents"],
        inputs["hooks"],
        inputs["env"],
        inputs["context"],
        project_root,
    )


def _classify_warnings(warnings: list[str]) -> tuple[list[str], list[str]]:
    gaps = [w for w in warnings if any(m in w for m in _GAP_MARKERS)]
    actions = [w for w in warnings if any(m in w for m in _ACTION_MARKERS)]
    return gaps, actions


def _collect_extra_file_copies(
    skills: list[dict[str, Any]], project_root: Path
) -> list[tuple[Path, Path]]:
    """Return (src, dst) pairs for skill extra files.

    src is an absolute source path under `.claude/skills/<id>/`. dst is a
    target-relative path under `.agents/skills/<id>/`.
    """
    copies: list[tuple[Path, Path]] = []
    skills_root = project_root / ".claude" / "skills"
    for skill in skills:
        skill_id = skill["id"]
        src_dir = skills_root / skill_id
        for extra in skill.get("extra_files") or []:
            rel = Path(extra)
            src = src_dir / rel
            dst = Path(".codex/skills") / skill_id / rel
            copies.append((src, dst))
    return copies


def _write_output(project_root: Path, rel_path: str, content: str) -> str:
    """Write content to project_root/rel_path. Returns 'created' or 'updated'."""
    dst = project_root / rel_path
    action = "updated" if dst.exists() else "created"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(content, encoding="utf-8")
    return action


def _copy_extra(project_root: Path, src: Path, rel_dst: Path) -> str:
    dst = project_root / rel_dst
    action = "updated" if dst.exists() else "created"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return action


def _read_or_none(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def _unified_diff(path: str, old: str, new: str) -> str:
    diff = difflib.unified_diff(
        old.splitlines(keepends=True),
        new.splitlines(keepends=True),
        fromfile=f"a/{path}",
        tofile=f"b/{path}",
    )
    return "".join(diff)


def _scan_orphan_candidates(project_root: Path) -> list[str]:
    """Scan known Codex output locations for existing files."""
    candidates: set[str] = set()

    codex_dir = project_root / ".codex"
    if codex_dir.is_dir():
        for p in sorted(codex_dir.rglob("*")):
            if p.is_file():
                candidates.add(str(p.relative_to(project_root)))

    for root, dirnames, filenames in os.walk(project_root):
        dirnames[:] = sorted(d for d in dirnames if d not in _ORPHAN_SCAN_SKIP_DIRS)
        rel_root = Path(root).relative_to(project_root)
        for filename in filenames:
            if filename not in {"AGENTS.md", "AGENTS.override.md"}:
                continue
            rel_path = rel_root / filename if rel_root != Path(".") else Path(filename)
            candidates.add(rel_path.as_posix())

    return sorted(candidates)


def _prepare(
    target: str, project_root: Path, user_home: Path | None = None
) -> tuple[list[dict[str, Any]], list[tuple[Path, Path]], list[str]]:
    inputs = _run_readers(project_root, user_home=user_home)
    outputs = _run_translate(target, inputs, project_root)
    extras = _collect_extra_file_copies(inputs["skills"], project_root)
    warnings: list[str] = []
    for out in outputs:
        warnings.extend(out.get("warnings") or [])
    return outputs, extras, warnings


def cmd_sync(
    target: str,
    project_root: Path,
    dry_run: bool,
    user_home: Path | None = None,
) -> dict[str, Any]:
    outputs, extras, warnings = _prepare(target, project_root, user_home=user_home)
    synced: list[dict[str, str]] = []

    for out in outputs:
        rel = out["path"]
        dst = project_root / rel
        new_content = out["content"]
        existing = _read_or_none(dst)

        if dry_run:
            action = "updated" if existing is not None else "created"
            if existing == new_content:
                continue
            synced.append({"path": rel, "action": action})
            continue

        if existing == new_content:
            synced.append({"path": rel, "action": "unchanged"})
            continue
        action = _write_output(project_root, rel, new_content)
        synced.append({"path": rel, "action": action})

    for src, rel_dst in extras:
        if not src.is_file():
            warnings.append(f"Skill extra file missing on disk: {src}")
            continue
        rel = str(rel_dst)
        if dry_run:
            dst = project_root / rel_dst
            action = "updated" if dst.exists() else "created"
            synced.append({"path": rel, "action": action})
            continue
        action = _copy_extra(project_root, src, rel_dst)
        synced.append({"path": rel, "action": action})

    gaps, actions_required = _classify_warnings(warnings)
    return {
        "synced": synced,
        "warnings": warnings,
        "gaps": gaps,
        "actions_required": actions_required,
    }


def cmd_diff(
    target: str, project_root: Path, user_home: Path | None = None
) -> dict[str, Any]:
    outputs, extras, warnings = _prepare(target, project_root, user_home=user_home)
    diffs: list[dict[str, str]] = []

    for out in outputs:
        rel = out["path"]
        dst = project_root / rel
        existing = _read_or_none(dst) or ""
        new = out["content"]
        if existing == new:
            continue
        diffs.append({"path": rel, "diff": _unified_diff(rel, existing, new)})

    for src, rel_dst in extras:
        if not src.is_file():
            continue
        dst = project_root / rel_dst
        if dst.is_file():
            try:
                existing = dst.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                existing = ""
            try:
                new = src.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if existing == new:
                continue
            diffs.append(
                {"path": str(rel_dst), "diff": _unified_diff(str(rel_dst), existing, new)}
            )
        else:
            diffs.append(
                {"path": str(rel_dst), "diff": f"(new file from {src})\n"}
            )

    gaps, actions_required = _classify_warnings(warnings)
    return {
        "diffs": diffs,
        "warnings": warnings,
        "gaps": gaps,
        "actions_required": actions_required,
    }


def cmd_status(
    target: str, project_root: Path, user_home: Path | None = None
) -> dict[str, Any]:
    outputs, extras, _warnings = _prepare(target, project_root, user_home=user_home)
    in_sync: list[str] = []
    drifted: list[str] = []
    missing: list[str] = []

    expected_paths: set[str] = set()

    for out in outputs:
        rel = out["path"]
        expected_paths.add(rel)
        dst = project_root / rel
        if not dst.is_file():
            missing.append(rel)
            continue
        existing = _read_or_none(dst) or ""
        if existing == out["content"]:
            in_sync.append(rel)
        else:
            drifted.append(rel)

    for src, rel_dst in extras:
        rel = str(rel_dst)
        expected_paths.add(rel)
        dst = project_root / rel_dst
        if not dst.is_file():
            if src.is_file():
                missing.append(rel)
            continue
        if not src.is_file():
            continue
        try:
            existing = dst.read_text(encoding="utf-8")
            new = src.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            drifted.append(rel)
            continue
        if existing == new:
            in_sync.append(rel)
        else:
            drifted.append(rel)

    existing_files = _scan_orphan_candidates(project_root)
    orphaned = [p for p in existing_files if p not in expected_paths]

    return {
        "in_sync": sorted(in_sync),
        "drifted": sorted(drifted),
        "missing": sorted(missing),
        "orphaned": sorted(orphaned),
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bridge",
        description="cc-bridge orchestrator (Claude Code → Codex)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    for name, help_text in (
        ("sync", "Translate and write Codex-native files"),
        ("diff", "Show unified diff of proposed changes"),
        ("status", "Compare current Codex config against sources"),
    ):
        sp = sub.add_parser(name, help=help_text)
        sp.add_argument("--target", required=True, choices=sorted(_SUPPORTED_TARGETS))
        sp.add_argument("--project-root", required=True, type=Path)
        sp.add_argument(
            "--include-user-hooks",
            action="store_true",
            default=False,
            help="Include hooks from ~/.claude/settings.json (off by default)",
        )
        if name == "sync":
            sp.add_argument("--dry-run", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    project_root = args.project_root.resolve()
    user_home = Path.home() if args.include_user_hooks else None

    if args.command == "sync":
        report = cmd_sync(
            args.target,
            project_root,
            dry_run=args.dry_run,
            user_home=user_home,
        )
        print(json.dumps(report, indent=2))
        return 0
    if args.command == "diff":
        report = cmd_diff(args.target, project_root, user_home=user_home)
        for entry in report["diffs"]:
            sys.stdout.write(entry["diff"])
            if not entry["diff"].endswith("\n"):
                sys.stdout.write("\n")
        print(
            json.dumps(
                {
                    "warnings": report["warnings"],
                    "gaps": report["gaps"],
                    "actions_required": report["actions_required"],
                    "changed_paths": [d["path"] for d in report["diffs"]],
                },
                indent=2,
            )
        )
        return 0
    if args.command == "status":
        report = cmd_status(args.target, project_root, user_home=user_home)
        print(json.dumps(report, indent=2))
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
