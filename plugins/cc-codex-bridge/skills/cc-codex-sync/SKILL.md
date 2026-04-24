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
| `hooks` in settings.json | `.codex/hooks.json` (interactive preflight only) |
| `env` in settings.json | `.codex/env-bridge.toml` |
| `CLAUDE.md` | `AGENTS.md` |
| `.claude/rules/*.md` | Nested `AGENTS.md` files |

## Hook translation is interactive-only

Hook entries are never translated by a plain sync. The bridge runtime requires
an explicit hook plan written from this skill's preflight. Without a plan,
sync skips the hook surface and emits a warning. There is no headless hook
sync — that is by design (see
`docs/specs/2026-04-23-hook-selection-preflight-design.md`).

## Execution

1. Run the inventory first:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js hooks-inventory --target codex --project-root .
   ```

   The output is JSON: `{"entries": [{"id", "scope", "event", "matcher", "handler", "label"}, ...]}`.

2. **If `entries` is empty**, run sync directly with no plan:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js sync --target codex --project-root .
   ```

   Then jump to step 11.

3. **If `entries` is non-empty**, run the hook preflight.

   Use `AskUserQuestion` to pick the **source scope**:
   - `user` (entries from `~/.claude/settings.json`)
   - `project` (entries from this project's `.claude/settings.json`)
   - `external project` (entries from another project on disk; ask for the path)

   If the user picks `external project`, capture the path and re-run inventory:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js hooks-inventory --target codex --project-root . --project-source <path>
   ```

   Filter the inventory to entries matching the chosen scope.

4. Use `AskUserQuestion` to pick **selection mode**:
   - `inventory` — show the labels and stop (return inventory only)
   - `pick individual entries`
   - `sync all entries from the chosen scope`

5. **For individual picking**: use multi-select `AskUserQuestion` over the
   labels and translate the chosen labels back to their `id` values.

6. Use `AskUserQuestion` to pick the **write mode**:
   - `merge` — keep existing `.codex/hooks.json` entries and add the selected ones
   - `replace` — overwrite `.codex/hooks.json` with only the selected entries
   - `create` — create `.codex/hooks.json` from the selected entries (warns if it already exists)

7. Check whether Codex hooks are already enabled. Inspect the candidate
   `config.toml` files (`<project>/.codex/config.toml`, `~/.codex/config.toml`)
   for `[features]` → `codex_hooks = true`. If neither has it, use
   `AskUserQuestion` to pick **enablement scope**:
   - `project` — write `[features] codex_hooks = true` into `<project>/.codex/config.toml`
   - `user` — write the same into `~/.codex/config.toml`
   - `skip` — leave enablement off (selected hooks will not fire until enabled)

8. Compose the plan JSON and write it to a temp file:

   ```json
   {
     "source_scope": "user" | "project",
     "project_source_path": "/abs/path",
     "selected_entry_ids": ["..."],
     "write_mode": "merge" | "replace" | "create",
     "enable_hooks": true | false,
     "enable_scope": "project" | "user" | null
   }
   ```

   Path: `$TMPDIR/cc-codex-bridge-hook-plan-<timestamp>.json` (or `/tmp/...`).
   Omit `project_source_path` unless the user picked an external project.
   `enable_hooks: true` requires `enable_scope` to be `project` or `user`.

9. **Preview first**: run sync with `--dry-run` against the plan. This writes
   nothing but reports every path that would be created or updated, plus all
   warnings:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js sync --target codex --project-root . --hook-plan <plan-path> --dry-run
   ```

   Show the user the list of `synced` paths (with `created` / `updated`
   markers), the `warnings`, and call out anything in `actions_required`.

   If the dry-run errors out (for example the existing `.codex/hooks.json` is
   malformed), surface the error and stop — do not attempt the mutating sync.

10. Use `AskUserQuestion` to confirm: `Apply these changes?` with options
    `Apply` and `Cancel`. Only proceed if the user picks `Apply`.

11. Run the mutating sync with the same plan:

    ```
    node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js sync --target codex --project-root . --hook-plan <plan-path>
    ```

12. Delete the plan temp file.

13. Interpret the sync report:
    - Explain what was synced.
    - Surface any `gaps` (Codex has no equivalent for that feature).
    - Surface any `actions_required` (manual follow-ups).
