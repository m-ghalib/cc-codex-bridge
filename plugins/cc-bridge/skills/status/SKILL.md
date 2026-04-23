---
name: status
description: >
  Show sync status between Claude Code and Codex CLI configs. Reports what's
  synced, what's drifted, what's missing, and what features have no equivalent.
  USE WHEN user says "sync status", "what's drifted", "bridge status",
  "config drift", "are my configs in sync".
allowed-tools:
  - Bash
  - Read
---

# cc-bridge status

Check sync state between Claude Code and Codex CLI.

Run the status check:

```
uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/bridge.py status --target codex --project-root .
```

Interpret the report for the user:
- What's currently in sync
- What has drifted (CC config changed since last sync)
- What's missing (CC config with no Codex output yet)
- What features are unsupported on Codex
