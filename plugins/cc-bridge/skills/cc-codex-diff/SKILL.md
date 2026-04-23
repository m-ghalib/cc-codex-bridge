---
name: cc-codex-diff
description: >
  Dry-run preview of Claude Code to Codex config translation.
  Shows unified diffs of what cc-codex-sync would write without touching
  any files. USE WHEN user says "show what would change", "dry run sync",
  "codex diff", "preview codex sync", "cc-codex-diff".
allowed-tools:
  - Bash
  - Read
---

# cc-codex-diff

Dry-run preview of what cc-codex-sync would write, without touching any files.

Run the bridge in dry-run mode:

```
uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/bridge.py sync --target codex --project-root . --dry-run
```

Present the unified diff output to the user. Explain what each change means and highlight any gaps or warnings.
