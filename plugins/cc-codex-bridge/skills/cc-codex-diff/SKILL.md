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

Run the bridge in diff mode:

```
node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js diff --target codex --project-root .
```

Present the unified diff output to the user. Explain what each change means and highlight any gaps or warnings.

Hooks are not covered by `cc-codex-diff`. Hook drift and hook diffs are only
reconciled via the `cc-codex-sync` preflight, which prompts the user before
writing any `.codex/hooks.json` content.
