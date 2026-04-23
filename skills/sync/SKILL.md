---
name: sync
description: >
  Sync Claude Code configuration to Codex CLI. Translates skills, subagents,
  hooks, env vars, context files, and rules from Claude Code format to
  Codex-native format. USE WHEN user says "sync to codex", "bridge my config",
  "push config to codex", "sync config".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# cc-bridge sync

Bridge your Claude Code configuration to Codex CLI.

## What it syncs

| Source (Claude Code) | Target (Codex) |
|---|---|
| `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
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

After running, interpret the sync report for the user:
- Explain what was synced successfully
- Explain any gaps (features with no Codex equivalent)
- Suggest workarounds for dropped features
- If existing files would be overwritten, show the diff and ask for confirmation before proceeding
