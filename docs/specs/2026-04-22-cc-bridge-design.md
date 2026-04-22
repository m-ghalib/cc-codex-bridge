# cc-bridge: Claude Code to Codex CLI Configuration Bridge

**Date:** 2026-04-22
**Status:** Draft
**Repo:** `~/GitHub/cc-bridge` (new, fresh repo with selective copy from product-os)

## Overview

cc-bridge is a Claude Code plugin that reads Claude Code configuration (skills, subagents, hooks, env vars, context files, and rules) and translates it into Codex CLI-native configuration files. Claude Code is the source of truth; sync is unidirectional (Claude Code -> Codex). Gemini CLI support is deferred to v2.

The translation engine is fully deterministic: Python scripts handle all config reading, field mapping, frontmatter translation, and tool-reference rewriting via regex. The LLM's role is limited to the skill layer — interpreting sync reports, explaining feature gaps, and suggesting workarounds to the user.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sync direction | Claude Code -> Codex (unidirectional) | Simple mental model, no conflict resolution |
| Repo creation | Fresh repo, selective copy from product-os | Clean history, no confusing GitHub fork link |
| Name | `cc-bridge` | "Claude Code bridge" — concise, clear origin |
| v1 target | Codex CLI only | Narrower surface, prove the pipeline first |
| Architecture | Pure plugin (Approach A) | Self-contained, no install step, testable |
| Engine | Deterministic Python scripts; LLM only in skill UX layer | Fully testable, reproducible output |
| Gap handling | Emit with warning comment, report skipped items | Pragmatic — user sees what mapped and what didn't |
| Context files | Preserve structure where possible | Root AGENTS.md + nested files for scoped rules |
| Settings.json | Out of scope for v1 | Complex permission/sandbox model differences |
| Doc refresh | Carry over from product-os | Keeps platform knowledge current |

## v1 Sync Scope

| Config Type | Source (Claude Code) | Target (Codex) |
|---|---|---|
| Skills | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| Subagents | `.claude/agents/<name>.md` | `.codex/agents/<name>.toml` |
| Hooks | `hooks` in `.claude/settings.json` | `.codex/hooks.json` |
| Env vars | `env` in `.claude/settings.json` | `.codex/env-bridge.toml` fragment |
| Context files | `CLAUDE.md`, `CLAUDE.local.md` | `AGENTS.md`, `AGENTS.override.md` |
| Rules | `.claude/rules/*.md` | Nested `AGENTS.md` (scoped) or appended to root (unscoped) |

## Plugin Structure

```
cc-bridge/
├── .claude-plugin/
│   └── plugin.json                  # plugin manifest
├── skills/
│   └── cc-bridge/
│       ├── sync/SKILL.md            # main sync skill
│       ├── diff/SKILL.md            # dry-run preview
│       └── status/SKILL.md          # drift report
├── scripts/
│   ├── bridge.py                    # orchestrator CLI
│   ├── refresh_cli_docs.py          # platform doc refresher (carried from product-os)
│   ├── readers/
│   │   ├── skills.py                # reads .claude/skills/
│   │   ├── agents.py                # reads .claude/agents/
│   │   ├── hooks.py                 # reads hooks from settings.json
│   │   ├── env.py                   # reads env from settings.json
│   │   └── context.py               # reads CLAUDE.md, rules/, .local.md
│   ├── adapters/
│   │   └── codex.py                 # Codex-specific translation
│   └── mappings/
│       ├── hooks.yaml               # hook event name mapping
│       └── tools.yaml               # tool alias mapping
├── docs/
│   ├── platform-snapshots/          # carried from product-os
│   │   ├── claude_code/
│   │   └── codex/
│   └── specs/
│       └── platform-feature-mapping.md  # carried from product-os
├── tests/
│   ├── readers/
│   │   ├── test_skills.py
│   │   ├── test_agents.py
│   │   ├── test_hooks.py
│   │   ├── test_env.py
│   │   └── test_context.py
│   ├── adapters/
│   │   └── test_codex.py
│   ├── test_bridge.py               # E2E tests
│   └── fixtures/
│       ├── claude_config/           # realistic .claude/ tree
│       └── expected_codex/          # golden-file expected output
├── .github/
│   └── workflows/
│       └── cli-refresh.yml          # weekly platform doc refresh
├── CLAUDE.md
├── README.md
└── .gitignore
```

## Skills

### sync

**Trigger:** `/sync`, "sync to codex", "bridge my config", "push config to codex"

**Flow:**
1. Invoke `bridge.py sync --target codex --project-root .`
2. Script runs all readers, passes output to Codex adapter
3. Adapter returns list of `OutputFile(path, content, action)`
4. For new files: write directly
5. For existing files that would change: present diff, ask for confirmation via `AskUserQuestion`
6. Generate and display sync report
7. LLM interprets gaps and suggests workarounds where applicable

### diff

**Trigger:** `/bridge-diff`, "show what would change", "dry run sync"

**Flow:**
1. Invoke `bridge.py sync --target codex --project-root . --dry-run`
2. Display unified diff of all changes that would be made
3. No files written

### status

**Trigger:** `/bridge-status`, "sync status", "what's drifted"

**Flow:**
1. Invoke `bridge.py status --target codex --project-root .`
2. Compare current CC config against existing Codex config files
3. Report: synced, drifted, missing, unsupported
4. LLM explains drift and recommends next steps

## Reader Layer

Five readers, each a pure Python module returning structured dicts. All operate on a configurable project root. No side effects.

### readers/skills.py

Walks `.claude/skills/*/SKILL.md`. Returns list of `SkillAsset`:
```python
{
    "id": str,           # directory name
    "name": str,         # from frontmatter, or id
    "description": str,  # from frontmatter
    "when_to_use": str | None,
    "frontmatter": dict, # full YAML frontmatter
    "body": str,         # markdown body
    "extra_files": list[Path],  # scripts/, references/, etc.
}
```

### readers/agents.py

Walks `.claude/agents/*.md`. Returns list of `AgentAsset`:
```python
{
    "name": str,
    "frontmatter": dict,  # full YAML frontmatter
    "body": str,          # markdown body (system prompt)
}
```

### readers/hooks.py

Reads `hooks` from `.claude/settings.json` and `~/.claude/settings.json`, merging project over user. Returns `HookConfig`:
```python
{
    "<EventName>": [
        {
            "matcher": str,
            "hooks": [
                {"type": str, "command"|"url"|"prompt": str, ...}
            ]
        }
    ]
}
```

### readers/env.py

Reads `env` from `.claude/settings.json` and `.claude/settings.local.json`. Returns `dict[str, str]`.

### readers/context.py

Reads CLAUDE.md cascade. Returns `ContextTree`:
```python
{
    "main": str,           # root CLAUDE.md content (imports resolved)
    "local": str | None,   # CLAUDE.local.md content
    "rules": [
        {"content": str, "paths": str | None, "filename": str}
    ]
}
```

## Codex Adapter (Translation Layer)

### Skills Translation

| Claude Code Field | Codex Equivalent | Method |
|---|---|---|
| `name` | `name` | Direct |
| `description` + `when_to_use` | `description` | Concatenate |
| `allowed-tools` | — | Drop + warning |
| `model` | — | Drop + warning |
| `effort` | — | Drop + warning |
| `context: fork` | — | Drop + warning |
| `hooks` | — | Drop + warning |
| `paths` | — | Drop + warning |
| `shell` | — | Drop + warning |
| `$ARGUMENTS` | — | Drop + warning |
| `` !`command` `` | — | Drop + warning |
| Markdown body tool refs | Rewritten refs | LLM pass |
| Auxiliary files | Direct copy | File copy |

Tool alias mapping (loaded from `mappings/tools.yaml`, applied deterministically by the adapter via regex substitution):
- `WebFetch` / `web_fetch` -> `shell` (curl)
- `Edit` / `edit_file` -> `apply_patch`
- `Read` / `read_file` -> `shell` (cat)
- `Bash` / `run_command` -> `shell`
- `Write` -> `apply_patch`
- `Grep` -> `shell` (grep)
- `Glob` -> `shell` (find)

Output: `.agents/skills/<name>/SKILL.md` with Codex-native frontmatter.

**Tool reference rewriting is deterministic.** The Python adapter handles both frontmatter and body translation. For the markdown body, the adapter loads `mappings/tools.yaml` and performs regex-based substitution of tool references (e.g., backtick-wrapped tool names, "use the X tool" patterns). Claude Code-specific constructs like `$ARGUMENTS` placeholders and `` !`command` `` inline exec blocks are stripped and replaced with a warning comment. This keeps the entire sync pipeline deterministic and unit-testable — no LLM involvement in file generation. The LLM role is limited to the skill layer: interpreting the sync report, explaining gaps, and suggesting workarounds to the user.

### Subagents Translation

| Claude Code Field | Codex Equivalent | Method |
|---|---|---|
| `name` | `name` | Direct |
| `description` | `description` | Direct |
| Body (system prompt) | `developer_instructions` | Move from markdown body to TOML field |
| `model` | `model` | Map: opus/sonnet -> `gpt-5.4`, haiku -> `gpt-5.4-mini` |
| `effort` | `model_reasoning_effort` | Map: low/medium/high -> direct, xhigh -> xhigh, max -> xhigh |
| `permissionMode` | `sandbox_mode` | Map: default/plan -> `read-only`, acceptEdits -> `workspace-write`, auto/dontAsk/bypassPermissions -> `danger-full-access` |
| `tools` | — | Drop + warning |
| `disallowedTools` | — | Drop + warning |
| `maxTurns` | — | Drop + warning |
| `hooks` | — | Drop + warning |
| `memory` | — | Drop + warning |
| `isolation: worktree` | — | Drop + warning |
| `color` | `nickname_candidates` | LLM pass (optional themed nickname) |
| `initialPrompt` | — | Drop + warning |

Output: `.codex/agents/<name>.toml`

### Hooks Translation

| Claude Code Event | Codex Event | Notes |
|---|---|---|
| `PreToolUse` | `PreToolUse` | Codex: Bash-only interception |
| `PostToolUse` | `PostToolUse` | Codex: Bash-only |
| `SessionStart` | `SessionStart` | Codex matcher uses `source` field |
| `UserPromptSubmit` | `UserPromptSubmit` | Direct |
| `Stop` | `Stop` | Direct (Codex matcher unused) |
| All others | — | Skip + warning |

Handler type mapping:
- `command` -> `command` (direct)
- `http` -> skip + warning
- `prompt` -> skip + warning
- `agent` -> skip + warning

Output: `.codex/hooks.json`

Note: Codex requires `[features] codex_hooks = true` in config.toml. The sync report flags this as a manual action.

### Env Vars Translation

Direct `key: value` mapping. Output: `.codex/env-bridge.toml` fragment (not written to `~/.codex/config.toml` to avoid overwriting user content).

Format:
```toml
[shell_environment_policy]
set.FOO = "bar"
set.BAZ = "qux"
```

### Context Files Translation

| Source | Target | Method |
|---|---|---|
| `CLAUDE.md` | `AGENTS.md` | Deterministic tool ref rewriting via regex (same as skills) |
| `CLAUDE.local.md` | `AGENTS.override.md` | Same deterministic rewriting |
| `.claude/rules/*.md` (with `paths: "src/**"`) | `src/AGENTS.md` | Place in matching directory |
| `.claude/rules/*.md` (no paths) | Appended to root `AGENTS.md` | Concatenate with separator |
| `@import` references | Inlined | Resolved up to depth 5 |

## Orchestrator (`bridge.py`)

CLI entry point invoked by skills:

```
bridge.py sync   --target codex --project-root . [--dry-run]
bridge.py status --target codex --project-root .
bridge.py diff   --target codex --project-root .
```

### Sync Flow

1. Run all 5 readers against `--project-root`
2. Pass reader output to target adapter
3. Adapter returns `list[OutputFile]` where each has `path`, `content`, `action` (create/update/skip)
4. If `--dry-run`: print unified diff, exit
5. Write files
6. Generate sync report (JSON + human-readable)

### Status Flow

1. Run readers for current CC config
2. Read existing Codex config files
3. File-by-file comparison
4. Output structured report: synced, drifted, missing, gaps

### Sync Report Format

```
cc-bridge sync report
━━━━━━━━━━━━━━━━━━━━
Target: Codex CLI

Synced:
  skills/my-skill/SKILL.md -> .agents/skills/my-skill/SKILL.md
  agents/reviewer.md -> .codex/agents/reviewer.toml
  CLAUDE.md -> AGENTS.md
  env (3 vars) -> .codex/env-bridge.toml

Gaps (no Codex equivalent):
  hooks: PostToolUse http handler skipped (Codex: command only)
  hooks: SubagentStop event skipped (no equivalent)
  skills/my-skill: allowed-tools dropped
  agents/reviewer: isolation:worktree dropped

Action required:
  Enable codex_hooks: add [features] codex_hooks = true to config.toml
  Merge env fragment: review .codex/env-bridge.toml
```

### File Safety

- New files: written directly
- Existing files that would change: diff presented, confirmation required via skill's `AskUserQuestion`
- Env vars: always emit as fragment file, never overwrite config.toml directly

## Testing

```
tests/
├── readers/
│   ├── test_skills.py
│   ├── test_agents.py
│   ├── test_hooks.py
│   ├── test_env.py
│   └── test_context.py
├── adapters/
│   └── test_codex.py
├── test_bridge.py
└── fixtures/
    ├── claude_config/
    └── expected_codex/
```

All tests use `tmp_path`. No writes to source tree. The entire pipeline (readers + adapter + orchestrator) is deterministic — no LLM calls — so all output is golden-file testable. Tests compare adapter output byte-for-byte against expected fixtures.

Test runner: `pytest`. Executed via `uv run pytest`.

## Drift Detection

### Platform Doc Refresh (weekly)

Carried from product-os. `scripts/refresh_cli_docs.py` fetches upstream docs from Claude Code and Codex CLI official URLs. `.github/workflows/cli-refresh.yml` runs weekly (Mondays 13:00 UTC), opens a PR if content changed.

Scope: focused on config, hooks, skills, and agents documentation (not the full 21-URL crawl from product-os).

### Sync Drift

The `status` skill compares CC config against existing Codex output anytime. No cron needed — user-triggered.

## Assets from product-os

| Asset | Source | Notes |
|---|---|---|
| `docs/specs/platform-feature-mapping.md` | `docs/specs/2026-04-14-platform-feature-mapping.md` | Canonical capability matrix |
| `docs/platform-snapshots/` | `docs/platform-snapshots/` | Claude Code + Codex snapshots only (drop Gemini for v1) |
| `scripts/refresh_cli_docs.py` | `scripts/refresh_cli_docs.py` | May need URL pruning |
| `.github/workflows/cli-refresh.yml` | `.github/workflows/cli-refresh.yml` | Adapt for cc-bridge repo |

## Installation

v1: install via `file://` source from a local clone. Add to Claude Code settings:
```json
{
  "enabledPlugins": {
    "cc-bridge@file:///Users/<you>/GitHub/cc-bridge": true
  }
}
```

Future: publish to a marketplace for `cc-bridge@<marketplace>` install.

## Out of Scope (v1)

- Gemini CLI target (v2)
- settings.json translation (permissions, sandbox, model prefs)
- MCP server config sync
- Bidirectional sync
- Auto-sync hooks (trigger sync on CC settings change)
- Plugin marketplace publishing

## v2 Roadmap

1. Gemini CLI adapter (`adapters/gemini.py`)
2. Settings.json -> config.toml translation (permissions, sandbox)
3. MCP server config sync
4. Auto-sync via PostToolUse hook on settings changes
5. `agents/openai.yaml` generation for Codex skills (UI metadata)
