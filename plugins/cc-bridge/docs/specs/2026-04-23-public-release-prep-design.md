# cc-bridge Public Release Prep — Design Spec

**Date:** 2026-04-23
**Author:** m-ghalib
**Status:** Approved (historical — predates Node migration)

> **Status update (2026-04-23):** The bridge runtime has since migrated from
> Python to TypeScript on Node 20 LTS. See
> [`docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md`](../../../../docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md)
> for the migration design. The body below reflects the Python-era design intent
> at the time of writing; references to Python badges, `uv run pytest`,
> `pyproject.toml`, and `scripts/*.py` paths are now superseded by their Node/Bun
> equivalents.

## Goal

Prepare cc-bridge for public sharing (GitHub, HN, LinkedIn) by adding the
missing developer-facing files and fixing stale references. No feature work.

## Audience

Claude Code power users who also use Codex CLI. Assumes familiarity with both
tools. Minimal hand-holding.

## Deliverables

### 1. README.md (new file, ~80-100 lines)

Structure, top to bottom:

| Section | Content | Lines |
|---|---|---|
| Title + badges | `# cc-bridge` with MIT license badge, Python >=3.13, tests passing | 3 |
| What it does | 2-3 sentences: deterministic translation, no LLM, 6 config types | 3 |
| Architecture | Mermaid flowchart: Claude Code config → 5 Readers → Codex Adapter → Output | 15 |
| What gets translated | 3-column table: Config Type / Claude Code Source / Codex Output (6 rows) | 12 |
| Installation | `claude plugin add` pointing to GitHub repo | 4 |
| Usage | 3 code blocks for sync, diff, status skills | 15 |
| Gap handling | Unsupported features produce warnings. Link to platform-feature-mapping.md | 4 |
| Development | `uv run pytest` to run tests. Link to design spec | 4 |
| License | MIT — link to LICENSE | 2 |

Tone: terse, scannable. No tutorial prose. Power users scan tables and diagrams.

### 2. LICENSE (new file)

MIT license. Copyright line: `Copyright (c) 2026 m-ghalib`

### 3. plugin.json enrichment (modify existing)

Add fields to `.claude-plugin/plugin.json`:

```json
{
  "author": "m-ghalib",
  "license": "MIT",
  "homepage": "https://github.com/m-ghalib/cc-bridge",
  "repository": "https://github.com/m-ghalib/cc-bridge",
  "keywords": ["codex", "bridge", "config", "translation", "sync"]
}
```

### 4. Fix stale GitHub URL

**File:** `scripts/refresh_cli_docs.py` line 27
**Change:** `github.com/mominabrarghalib/cc-bridge` → `github.com/m-ghalib/cc-bridge`

### 5. Fix stale directory paths in design spec

**File:** `docs/specs/2026-04-22-cc-bridge-design.md` lines 46-49
**Change:** Update plugin structure diagram to the current skill directories:
`skills/cc-codex-sync/SKILL.md`, `skills/cc-codex-diff/SKILL.md`, and
`skills/cc-codex-status/SKILL.md`.

## Out of scope

- CONTRIBUTING.md
- CHANGELOG.md
- New features or config translations
- Blog post or announcement copy
- pyproject.toml metadata enrichment (already has name/version/description)

## Mermaid diagram for README

```mermaid
graph LR
    A[Claude Code Config] --> B[Readers]
    B --> B1[skills]
    B --> B2[agents]
    B --> B3[hooks]
    B --> B4[env]
    B --> B5[context]
    B1 & B2 & B3 & B4 & B5 --> C[Codex Adapter]
    C --> D[Codex-native Files]
```

## Translation table for README

| Config Type | Claude Code Source | Codex Output |
|---|---|---|
| Skills | `.claude/skills/*/SKILL.md` | `.codex/skills/*/SKILL.md` |
| Agents | `.claude/agents/*.md` | `.codex/agents/*.toml` |
| Hooks | `settings.json` → `hooks` | `.codex/hooks.json` |
| Env vars | `settings.json` → `env` | `.codex/env-bridge.toml` |
| Context files | `CLAUDE.md`, rules | `AGENTS.md`, nested `AGENTS.md` |
| Rules | `.claude/rules/*.md` | `AGENTS.md` or nested `AGENTS.md` (scoped) |
