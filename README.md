# cc-bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](plugins/cc-bridge/package.json)
[![Tests](https://img.shields.io/badge/tests-bun-green.svg)](plugins/cc-bridge/tests/)

## Installation

```bash
claude plugins marketplace add m-ghalib/cc-bridge
claude plugins install cc-bridge@cc-bridge
```

## Prerequisites

- Claude Code installed and authenticated. The install commands above assume the `claude` CLI already works.
- Node 20 LTS or newer on `PATH`. The shipped skills invoke the packaged runtime as `node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js ...`.
- A target project that already contains Claude Code config to translate. `cc-bridge` does not bootstrap a new `.claude/` tree or `CLAUDE.md`; it translates existing source files.
- Codex CLI installed if you want to use the generated `.codex/...` output locally.

Supported source surfaces:

- `CLAUDE.md`
- `CLAUDE.local.md`
- `.claude/skills/*/SKILL.md`
- `.claude/agents/*.md`
- `.claude/rules/*.md`
- `.claude/settings.json`
- `.claude/settings.local.json`

## What it does

cc-bridge is a Claude Code plugin plus a deterministic Node bridge for syncing
Claude Code configuration into Codex CLI-native files. v1 targets Codex only.
It covers skills, agents, hooks, env vars, context files, and rules. No LLM
sits in the translation loop.

The bridge logic lives under `plugins/cc-bridge/`. The repo root contains
plugin marketplace metadata plus GitHub automation for tests, review, and doc
refresh.

## Architecture

```mermaid
flowchart LR
    CC[Claude Code config] --> SR[Skills Reader]
    CC --> AR[Agents Reader]
    CC --> HR[Hooks Reader]
    CC --> ER[Env Reader]
    CC --> CR[Context Reader]
    SR --> AD[Codex Adapter]
    AR --> AD
    HR --> AD
    ER --> AD
    CR --> AD
    AD --> OUT[Codex-native files]
```

## What gets translated

| Config Type   | Claude Code Source               | Codex Output                     |
|---------------|----------------------------------|----------------------------------|
| Skills        | `.claude/skills/*/SKILL.md`      | `.codex/skills/*/SKILL.md`       |
| Agents        | `.claude/agents/*.md`            | `.codex/agents/*.toml`           |
| Hooks         | `settings.json` → `hooks`        | `.codex/hooks.json`              |
| Env vars      | `settings.json` → `env`          | `.codex/env-bridge.toml`         |
| Context files | `CLAUDE.md`, `CLAUDE.local.md`   | `AGENTS.md`, `AGENTS.override.md`|
| Rules         | `.claude/rules/*.md`             | `AGENTS.md` (scoped → nested)    |

## Repo layout

- `plugins/cc-bridge/` — TypeScript package, plugin manifest, skills, tests, and docs
- `plugins/cc-bridge/src/cli.ts` — entrypoint for `sync`, `diff`, and `status`
- `plugins/cc-bridge/dist/` — compiled Node 20 runtime used by installed skills
- `plugins/cc-bridge/docs/specs/` — bridge design docs and feature mapping
- `plugins/cc-bridge/docs/platform-snapshots/` — refreshed upstream Claude Code and Codex docs
- `.github/workflows/` — PR checks, Claude automation, CodeQL, and doc refresh

## Usage

The plugin exposes three skills:

- `cc-codex-sync` — translate and write Codex output files
- `cc-codex-diff` — preview the unified diff without writing files
- `cc-codex-status` — report drift, missing outputs, and orphaned Codex files

Equivalent commands from `plugins/cc-bridge/` once installed:

```bash
node dist/cli.js sync --target codex --project-root /path/to/project
node dist/cli.js diff --target codex --project-root /path/to/project
node dist/cli.js status --target codex --project-root /path/to/project
node dist/cli.js hooks-inventory --target codex --project-root /path/to/project
```

Hook translation is interactive-only. The bridge no longer accepts a coarse
`--include-user-hooks` flag — instead, run the `cc-codex-sync` skill which
walks you through scope, per-entry selection, write mode, and Codex hook
enablement before any `.codex/hooks.json` write happens.

## Activation Notes

- Plain `sync` skips hook translation and emits a `hook preflight required`
  warning when Claude Code hook entries are present. Use `cc-codex-sync` to
  translate them.
- The preflight writes `.codex/hooks.json` and (on request) sets
  `[features] codex_hooks = true` in the chosen `config.toml`.
- Env vars are written to `.codex/env-bridge.toml` and do not apply until that
  fragment is merged into an active Codex `config.toml`.

## Gap handling

Features without a Codex equivalent produce warnings, not errors. Sync keeps
going and reports what was skipped plus any manual follow-up. See
[`plugins/cc-bridge/docs/specs/platform-feature-mapping.md`](plugins/cc-bridge/docs/specs/platform-feature-mapping.md)
for the comparison matrix.

## Development

Install dev dependencies and run the test suite from the plugin directory:

```bash
cd plugins/cc-bridge
bun install
bun test
```

Build the dist bundle consumed by installed skills:

```bash
cd plugins/cc-bridge
bun run build
```

Refresh the upstream doc snapshots with:

```bash
cd plugins/cc-bridge
bun run refresh-cli-docs
```

If you want the GitHub review/orchestrator workflows in this repo to run, set
these repository secrets first:

- `CLAUDE_CODE_OAUTH_TOKEN`
- `CLAUDE_BOT_PAT`

Core docs:

- [`plugins/cc-bridge/docs/specs/2026-04-22-cc-bridge-design.md`](plugins/cc-bridge/docs/specs/2026-04-22-cc-bridge-design.md)
- [`plugins/cc-bridge/docs/specs/platform-feature-mapping.md`](plugins/cc-bridge/docs/specs/platform-feature-mapping.md)
- [`docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md`](docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md)

## License

MIT. See [LICENSE](LICENSE).
