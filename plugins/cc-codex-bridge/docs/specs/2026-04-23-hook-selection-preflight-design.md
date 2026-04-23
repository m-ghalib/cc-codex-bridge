# cc-codex-bridge Hook Selection Preflight — Design Spec

**Date:** 2026-04-23
**Author:** m-ghalib
**Status:** Approved (historical — predates Node migration)

> **Status update (2026-04-23):** The bridge runtime has since migrated from
> Python to TypeScript on Node 20 LTS. See
> [`docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md`](../../../../docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md)
> for the migration design. The body below reflects the Python-era design intent
> at the time of writing; references to `bridge.py` and Python helpers now
> correspond to their TypeScript equivalents under `src/`.

## Goal

Keep hook translation user-controlled by moving hook decisions to a required
interactive preflight that runs before any sync writes.

## Problem

The current bridge surface treats user hooks as a boolean add-on:
`--include-user-hooks` reads `~/.claude/settings.json` and merges those hooks
into the sync input. That model is too coarse.

It fails on the cases the product now needs to support:

- project-scope hooks may come from the current project or an explicit external
  Claude project path
- user-scope hooks live in `~/.claude/`
- the user may want an inventory before choosing
- the selection unit is a hook entry inside an event, not the whole event
- the user must choose how selected hooks apply to existing Codex hooks
- hook translation must not proceed in headless or non-interactive mode

## Decisions

| Decision | Choice |
|---|---|
| Preflight timing | Hook decisions happen before any sync write |
| Source scopes | `user` from `~/.claude/`; optional `project` from current project or explicit path |
| Selection unit | Individual hook entries inside an event |
| Inventory UX | Short generated labels only; no metadata dump |
| External project source | Supported for project-scope hook discovery |
| Write behavior | Never implicit; ask before applying selected hooks |
| Non-interactive behavior | Refuse hook translation; do not guess |
| Architecture | Skill-led interaction backed by deterministic Python inventory/apply helpers |

## Recommended Approach

Keep `bridge.py` deterministic and move the conversation into the sync skill.

This splits responsibility cleanly:

- Python discovers source hooks, generates stable entry IDs, and applies an
  explicit hook plan
- the skill owns the user interaction: scope choice, inventory choice,
  individual selection, write mode, and hooks enablement
- README and skill docs state that hook-aware sync is interactive-only

This is the best fit for cc-codex-bridge. It preserves user control without turning
the Python bridge into an interactive wizard.

## User Experience Flow

### 1. Detect available hook sources

Before sync, the skill discovers hook sources:

- `user`: `~/.claude/settings.json`
- `project`: `.claude/settings.json` in the current project root, or an
  explicit project-source path supplied by the user

If neither source contains hook entries, the sync proceeds without hook
questions.

If one or more sources contain hook entries, the skill pauses and asks which
source scope to use for this run.

### 2. Choose selection mode

After scope selection, the skill asks how the user wants to proceed:

- show an inventory first
- select individual hook entries
- sync all hook entries from the chosen scope

### 3. Inventory and individual selection

The inventory is a picker, not a raw config dump.

Each entry gets:

- a stable machine ID for the bridge
- a short generated label for the user

The user only sees the label.

Label goals:

- easy to scan
- easy to distinguish
- no JSON or field table
- short enough for ADHD-friendly selection

Example label shapes:

- `User / Stop / Sycophancy Guard`
- `User / Before Bash / Event Journal`
- `Project / Before Bash / Project Hook`

### 4. Ask how to apply the selected hooks

Selected hooks are never written with an implicit policy.

Before writing, the skill asks how to apply the selection to the target Codex
hook set:

- merge into existing `.codex/hooks.json`
- replace the existing `.codex/hooks.json` content with the selected set

If no `.codex/hooks.json` exists yet, the skill still asks for explicit
confirmation to create it.

### 5. Ask about Codex hook enablement

If selected hooks will be written, the skill checks whether Codex hooks are
already enabled.

If not enabled, the skill asks where to enable them:

- project `.codex/config.toml`
- user `~/.codex/config.toml`

No automatic enablement without a user choice.

### 6. Then run sync/apply

Only after the preflight choices are complete does the skill write the selected
hook set and any chosen config enablement change.

## Python Surface Changes

### Replace the boolean user-hook model

The current `--include-user-hooks` flag is too blunt. Replace it with explicit
hook planning surfaces.

Required additions:

1. A deterministic inventory command or subroutine that returns discovered hook
   entries by source scope
2. Stable per-entry IDs so the skill can select exact hook entries
3. An apply path that accepts an explicit hook plan instead of a boolean
   "include user hooks" toggle

The bridge should not infer scope or write mode once the skill has collected
user choices.

### Proposed plan shape

The exact CLI flag names can be finalized during implementation, but the plan
passed from the skill to Python must include at least:

```json
{
  "source_scope": "user" | "project",
  "project_source_path": "/optional/path/for/project/scope",
  "selected_entry_ids": ["..."],
  "write_mode": "merge" | "replace" | "create",
  "enable_hooks": true | false,
  "enable_scope": "project" | "user" | null
}
```

This keeps the bridge deterministic and testable.

## Generated Labels

Labels are user-facing summaries, not metadata.

Generation rules:

- derive the source scope prefix from `user` or `project`
- turn event names into short phrases such as `Before Bash` or `On Stop`
- use the most identifiable part of the hook payload as the final segment
- prefer human-readable basenames or friendly names over raw commands
- fall back to numbered disambiguation when labels would collide

Payload naming rules:

- command hooks: executable basename or script stem
- URL hooks: host plus last path segment
- prompt hooks: short first phrase

## Non-Interactive Guard

Hook-aware sync must be interactive-only.

If the skill cannot ask questions, it must refuse hook translation instead of
guessing. This guard exists because docs alone do not preserve user control:
headless execution can otherwise skip decisions and still write `.codex`
changes.

README and skill docs should say this directly, but the runtime behavior must
also enforce it.

## Backward Compatibility

Plain sync without hooks can stay simple.

Expected behavior:

- if no hook entries are found, sync runs as it does today
- if hook entries are found and the run is interactive, the preflight starts
- if hook entries are found and the run is non-interactive, hook translation is
  refused with a clear message

## Out of Scope

- changing the underlying Claude-to-Codex hook event mapping
- adding a generic interactive wizard to `bridge.py`
- translating user-level non-hook settings from `~/.claude/settings.json`
- auto-resolving merge conflicts inside existing Codex hook files

## Test Plan

### Python tests

- inventory returns user and project scopes separately
- project scope can be sourced from an explicit external path
- entry IDs are stable
- label generation is deterministic and collision-safe
- apply path respects `merge`, `replace`, and `create`
- no hook write occurs without an explicit plan

### Skill or integration tests

- sync with project hooks asks before writing
- sync with user hooks asks before writing
- inventory flow can select individual entries inside one event
- existing `.codex/hooks.json` triggers an explicit merge-or-replace choice
- disabled Codex hooks trigger an explicit enablement choice
- non-interactive execution refuses hook translation

## Implementation Notes

- keep the hook inventory separate from the main sync report
- keep labels user-facing and IDs machine-facing
- do not couple source-scope choice to enablement-scope choice; they solve
  different problems
- keep non-hook sync deterministic and unchanged where possible
