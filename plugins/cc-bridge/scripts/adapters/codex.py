"""Codex adapter: translate Claude Code config records to Codex-native assets.

Produces a list of OutputFile dicts of the form::

    {"path": str, "content": str, "warnings": list[str]}

Covers five domains: skills, subagents, hooks, env vars, and context files.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import tomli_w
import yaml

_MAPPINGS_DIR = Path(__file__).parent.parent / "mappings"

_SKILL_DROP_FIELDS = (
    "allowed-tools",
    "model",
    "effort",
    "context",
    "hooks",
    "paths",
    "shell",
)
_AGENT_DROP_FIELDS = (
    "tools",
    "disallowedTools",
    "maxTurns",
    "hooks",
    "memory",
    "isolation",
    "color",
    "initialPrompt",
)

_MODEL_MAP = {"opus": "gpt-5.4", "sonnet": "gpt-5.4", "haiku": "gpt-5.4-mini"}
_EFFORT_MAP = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "xhigh": "xhigh",
    "max": "xhigh",
}
_PERMISSION_MAP = {
    "default": "read-only",
    "plan": "read-only",
    "acceptEdits": "workspace-write",
    "auto": "danger-full-access",
    "dontAsk": "danger-full-access",
    "bypassPermissions": "danger-full-access",
}

_ARGS_RE = re.compile(r"\$ARGUMENTS(?:\[\d+\])?")
_INLINE_EXEC_RE = re.compile(r"!`[^`]+`")

_ARGS_WARNING_MARKER = (
    "<!-- ARGUMENTS placeholder not supported in Codex; substitute manually -->"
)
_EXEC_WARNING_MARKER = (
    "<!-- Inline `!` exec block not supported in Codex; run command manually -->"
)


def _load_yaml(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _load_tools_mapping() -> dict[str, str]:
    data = _load_yaml(_MAPPINGS_DIR / "tools.yaml") or {}
    return dict(data.get("tools") or {})


def _load_hooks_mapping() -> dict[str, Any]:
    return _load_yaml(_MAPPINGS_DIR / "hooks.yaml") or {}


def _rewrite_tool_refs(text: str, tools: dict[str, str]) -> str:
    """Rewrite Claude Code tool references to Codex equivalents."""
    if not text:
        return text
    for claude_name in sorted(tools, key=len, reverse=True):
        codex_name = tools[claude_name]
        text = re.sub(
            rf"`{re.escape(claude_name)}`",
            f"`{codex_name}`",
            text,
        )
        text = re.sub(
            rf"\bthe {re.escape(claude_name)} tool\b",
            f"the {codex_name} tool",
            text,
        )
        text = re.sub(
            rf"\bUse {re.escape(claude_name)}\b",
            f"Use {codex_name}",
            text,
        )
    return text


def _strip_skill_syntax(body: str) -> tuple[str, list[str]]:
    warnings: list[str] = []

    def args_repl(match: re.Match[str]) -> str:
        warnings.append(f"Stripped unsupported placeholder: {match.group(0)}")
        return _ARGS_WARNING_MARKER

    def exec_repl(match: re.Match[str]) -> str:
        warnings.append(f"Stripped inline exec block: {match.group(0)}")
        return _EXEC_WARNING_MARKER

    body = _ARGS_RE.sub(args_repl, body)
    body = _INLINE_EXEC_RE.sub(exec_repl, body)
    return body, warnings


def _compose_description(description: str | None, when_to_use: str | None) -> str:
    parts = [p.strip() for p in (description, when_to_use) if p and p.strip()]
    return " ".join(parts)


def _format_frontmatter(fm: dict[str, Any]) -> str:
    return yaml.safe_dump(fm, sort_keys=False, default_flow_style=False).rstrip()


def _translate_skill(skill: dict[str, Any], tools: dict[str, str]) -> dict[str, Any]:
    warnings: list[str] = []
    fm = skill.get("frontmatter") or {}
    skill_id = skill["id"]

    for field in _SKILL_DROP_FIELDS:
        if field in fm:
            warnings.append(
                f"Skill '{skill_id}': dropped unsupported field '{field}'"
            )

    new_fm: dict[str, Any] = {"name": skill.get("name") or skill_id}
    combined = _compose_description(skill.get("description"), skill.get("when_to_use"))
    if combined:
        new_fm["description"] = combined

    body = _rewrite_tool_refs(skill.get("body") or "", tools)
    body, strip_warnings = _strip_skill_syntax(body)
    warnings.extend(strip_warnings)

    for extra in skill.get("extra_files") or []:
        warnings.append(
            f"Skill '{skill_id}': extra file to copy alongside SKILL.md: {extra}"
        )

    content = f"---\n{_format_frontmatter(new_fm)}\n---\n\n{body}"
    return {
        "path": f".agents/skills/{skill_id}/SKILL.md",
        "content": content,
        "warnings": warnings,
    }


def _translate_agent(agent: dict[str, Any]) -> dict[str, Any]:
    warnings: list[str] = []
    fm = agent.get("frontmatter") or {}
    name = agent.get("name") or fm.get("name") or "agent"

    doc: dict[str, Any] = {"name": name}
    if "description" in fm and fm["description"] is not None:
        doc["description"] = str(fm["description"])

    if "model" in fm:
        raw = fm["model"]
        mapped = _MODEL_MAP.get(raw)
        if mapped:
            doc["model"] = mapped
        else:
            warnings.append(
                f"Agent '{name}': unknown model '{raw}'; dropped"
            )

    if "effort" in fm:
        raw = fm["effort"]
        mapped = _EFFORT_MAP.get(raw)
        if mapped:
            doc["model_reasoning_effort"] = mapped
        else:
            warnings.append(
                f"Agent '{name}': unknown effort '{raw}'; dropped"
            )

    if "permissionMode" in fm:
        raw = fm["permissionMode"]
        mapped = _PERMISSION_MAP.get(raw)
        if mapped:
            doc["sandbox_mode"] = mapped
        else:
            warnings.append(
                f"Agent '{name}': unknown permissionMode '{raw}'; dropped"
            )

    doc["developer_instructions"] = agent.get("body") or ""

    for field in _AGENT_DROP_FIELDS:
        if field in fm:
            warnings.append(
                f"Agent '{name}': dropped unsupported field '{field}'"
            )

    content = tomli_w.dumps(doc)
    return {
        "path": f".codex/agents/{name}.toml",
        "content": content,
        "warnings": warnings,
    }


def _translate_hooks(hooks: dict[str, Any]) -> dict[str, Any]:
    warnings: list[str] = []
    mapping = _load_hooks_mapping()
    events_map: dict[str, Any] = mapping.get("events") or {}
    handler_map: dict[str, Any] = mapping.get("handler_types") or {}

    out_hooks: dict[str, list[dict[str, Any]]] = {}
    for event_name, entries in hooks.items():
        event_cfg = events_map.get(event_name)
        codex_event: str | None = None
        if isinstance(event_cfg, dict):
            codex_event = event_cfg.get("codex_event")
        if not codex_event:
            warnings.append(
                f"Hook event '{event_name}' has no Codex equivalent; skipped"
            )
            continue

        new_entries: list[dict[str, Any]] = []
        for entry in entries or []:
            new_handlers: list[dict[str, Any]] = []
            for handler in entry.get("hooks") or []:
                htype = handler.get("type")
                mapped_type = handler_map.get(htype)
                if not mapped_type:
                    warnings.append(
                        f"Hook event '{event_name}': handler type "
                        f"'{htype}' not supported in Codex; skipped"
                    )
                    continue
                new_handler = {"type": mapped_type}
                for k, v in handler.items():
                    if k != "type":
                        new_handler[k] = v
                new_handlers.append(new_handler)
            if new_handlers:
                new_entries.append(
                    {
                        "matcher": entry.get("matcher", ""),
                        "hooks": new_handlers,
                    }
                )
        if new_entries:
            out_hooks[codex_event] = new_entries

    warnings.append(
        "Enable Codex hooks in ~/.codex/config.toml: "
        "[features]\\ncodex_hooks = true"
    )

    content = json.dumps({"hooks": out_hooks}, indent=2) + "\n"
    return {"path": ".codex/hooks.json", "content": content, "warnings": warnings}


def _toml_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _translate_env(env: dict[str, str]) -> dict[str, Any]:
    lines = ["[shell_environment_policy]"]
    for key in sorted(env):
        lines.append(f'set.{key} = "{_toml_escape(env[key])}"')
    content = "\n".join(lines) + "\n"
    warnings = [
        "Env bridge fragment written to .codex/env-bridge.toml; it must be "
        "merged into an active Codex config.toml before those env vars apply"
    ]
    return {"path": ".codex/env-bridge.toml", "content": content, "warnings": warnings}


def _glob_path_prefix(glob_path: str) -> str | None:
    parts = glob_path.split("/")
    prefix: list[str] = []
    for part in parts:
        if any(ch in part for ch in "*?["):
            break
        if part:
            prefix.append(part)
    if not prefix:
        return None
    return "/".join(prefix)


def _resolve_scope_prefix(raw_path: str, project_root: Path) -> str | None:
    normalized = raw_path.strip().strip("/")
    if not normalized:
        return None

    prefix = _glob_path_prefix(normalized)
    if any(ch in normalized for ch in "*?["):
        return prefix

    candidate = project_root / normalized
    if candidate.exists():
        if candidate.is_dir():
            return normalized
        rel_parent = candidate.relative_to(project_root).parent
        return None if rel_parent == Path(".") else rel_parent.as_posix()

    return prefix


def _translate_context(
    context: dict[str, Any], tools: dict[str, str], project_root: Path
) -> list[dict[str, Any]]:
    outputs: list[dict[str, Any]] = []
    warnings: list[str] = []

    root_parts: list[str] = []
    main = context.get("main") or ""
    if main:
        root_parts.append(_rewrite_tool_refs(main, tools).rstrip())

    scoped: dict[str, list[str]] = {}
    for rule in context.get("rules") or []:
        content = _rewrite_tool_refs(rule.get("content") or "", tools).strip()
        if not content:
            continue
        paths = rule.get("paths")
        filename = rule.get("filename", "rule")
        block = f"<!-- Rule from {filename} -->\n{content}"

        if not paths:
            root_parts.append(block)
            continue

        path_list = paths if isinstance(paths, list) else [paths]
        placed = False
        for raw in path_list:
            prefix = _resolve_scope_prefix(str(raw), project_root)
            if prefix is None:
                continue
            scoped.setdefault(prefix, []).append(block)
            placed = True
        if not placed:
            root_parts.append(block)

    if root_parts:
        outputs.append(
            {
                "path": "AGENTS.md",
                "content": "\n\n".join(root_parts) + "\n",
                "warnings": warnings,
            }
        )

    local = context.get("local")
    if local:
        outputs.append(
            {
                "path": "AGENTS.override.md",
                "content": _rewrite_tool_refs(local, tools),
                "warnings": [],
            }
        )

    for prefix, blocks in sorted(scoped.items()):
        outputs.append(
            {
                "path": f"{prefix}/AGENTS.md",
                "content": "\n\n".join(blocks) + "\n",
                "warnings": [],
            }
        )

    return outputs


def translate(
    skills: list[dict[str, Any]],
    agents: list[dict[str, Any]],
    hooks: dict[str, Any],
    env: dict[str, str],
    context: dict[str, Any],
    project_root: Path,
) -> list[dict[str, Any]]:
    """Translate Claude Code config records into Codex-native output files."""
    tools = _load_tools_mapping()
    outputs: list[dict[str, Any]] = []

    for skill in skills:
        outputs.append(_translate_skill(skill, tools))

    for agent in agents:
        outputs.append(_translate_agent(agent))

    if hooks:
        outputs.append(_translate_hooks(hooks))

    if env:
        outputs.append(_translate_env(env))

    outputs.extend(_translate_context(context, tools, project_root))

    return outputs
