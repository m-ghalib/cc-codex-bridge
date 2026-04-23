# cc-bridge

Claude Code plugin that bridges Claude Code configuration to Codex CLI.
Translates skills, subagents, hooks, env vars, context files, and rules
from Claude Code format to Codex-native format.

## Layout

    - `skills/` — plugin skills (cc-codex-sync, cc-codex-diff, cc-codex-status)
    - `src/` — TypeScript translation engine
        - `cli.ts` — orchestrator CLI (sync, diff, status)
        - `readers/` — reads Claude Code config files
        - `adapters/` — translates to target platform format
        - `mappings.ts` — declarative mapping tables
        - `refresh/refresh-cli-docs.ts` — upstream doc snapshotter
    - `dist/` — compiled Node 20 runtime artifacts (committed, consumed by skills)
    - `docs/` — platform snapshots and feature mapping
    - `tests/` — Bun test suite with fixture-based golden-file tests

## Runtime

    - Minimum runtime: Node 20 LTS
    - Local dev and tests use Bun

## Execution

Skills call the packaged runtime:
`node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js <command> --target codex --project-root .`

For local development from the plugin directory:
`bun run bridge sync --target codex --project-root /path/to/project`

Hook translation is interactive-only. Plain `sync` skips hooks and reports a
preflight-required warning; the `cc-codex-sync` skill drives the
`hooks-inventory` command, asks the user for scope/selection/write
mode/enablement, and then re-runs `sync --hook-plan <file>`.

## Testing

Run tests with `bun test` from `plugins/cc-bridge/`. Tests use per-test
temp dirs — never write into the source tree.

## Design spec

See `docs/specs/2026-04-22-cc-bridge-design.md` for the original product design,
and `docs/superpowers/specs/2026-04-23-cc-bridge-node20-migration-design.md`
for the Node 20 migration plan.
