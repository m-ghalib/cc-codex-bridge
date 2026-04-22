---
name: diff
description: >
  Preview what cc-bridge sync would change without writing any files.
  Shows a dry-run diff of Claude Code config translated to Codex format.
  USE WHEN user says "show what would change", "dry run sync", "bridge diff",
  "preview sync".
allowed-tools:
  - Bash
  - Read
---

# cc-bridge diff

Preview sync changes without writing files.

Run the bridge in dry-run mode:

```
uv run python ${CLAUDE_SKILL_DIR}/../../../scripts/bridge.py sync --target codex --project-root . --dry-run
```

Present the unified diff output to the user. Explain what each change means and highlight any gaps or warnings.
