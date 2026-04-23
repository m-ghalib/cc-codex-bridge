---
name: cc-codex-sync
description: >
  Translate and write Claude Code configuration as Codex CLI native files.
  Converts skills, subagents, hooks, env vars, context files, and rules
  from Claude Code format to Codex-native format and writes them to disk.
  USE WHEN user says "sync to codex", "bridge my config",
  "push config to codex", "sync config", "cc-codex-sync".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# cc-codex-sync

Translate and write Claude Code configuration as Codex CLI native files.

## What it syncs

| Source (Claude Code) | Target (Codex) |
|---|---|
| `.claude/skills/<name>/SKILL.md` | `.codex/skills/<name>/SKILL.md` |
| `.claude/agents/<name>.md` | `.codex/agents/<name>.toml` |
| `hooks` in settings.json | `.codex/hooks.json` |
| `env` in settings.json | `.codex/env-bridge.toml` |
| `CLAUDE.md` | `AGENTS.md` |
| `.claude/rules/*.md` | Nested `AGENTS.md` files |

## Usage

Run the bridge sync script:

```
uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/bridge.py sync --target codex --project-root .
```

To also include hooks from the user's global `~/.claude/settings.json`:

```
uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/bridge.py sync --target codex --project-root . --include-user-hooks
```

After running, interpret the sync report for the user:
- Explain what was synced successfully
- Explain any gaps (features with no Codex equivalent)
- Suggest workarounds for dropped features
- If existing files would be overwritten, show the diff and ask for confirmation before proceeding

## Hooks enablement

If hooks were synced, check if Codex hooks are enabled. Use `AskUserQuestion` to ask the user whether to enable hooks in the project `.codex/config.toml` or user `~/.codex/config.toml`. Then ensure `[features] codex_hooks = true` is present in the chosen file, preserving any existing keys.
