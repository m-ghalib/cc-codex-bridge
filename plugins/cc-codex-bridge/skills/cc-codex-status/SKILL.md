---
name: cc-codex-status
description: >
  Report drift between Claude Code config and its Codex CLI translation.
  Shows what's in sync, what's drifted, what's missing, and what Codex
  output files are orphaned. USE WHEN user says "codex sync status",
  "what's drifted", "codex config drift", "are my configs in sync",
  "cc-codex-status".
allowed-tools:
  - Bash
  - Read
---

# cc-codex-status

Report drift between Claude Code config and its Codex CLI translation.

Run the status check:

```
node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js status --target codex --project-root .
```

Interpret the report for the user:
- What's currently in sync
- What has drifted (CC config changed since last sync)
- What's missing (CC config with no Codex output yet)
- What features are unsupported on Codex

Hooks are not tracked by `cc-codex-status`. Use the `cc-codex-sync` preflight
to inventory and reconcile `.codex/hooks.json`.
