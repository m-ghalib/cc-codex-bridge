# cc-codex-bridge Node 20 Migration Design

Date: 2026-04-23
Status: Approved for planning
Branch: `codex/node20-migration`

## Summary

Migrate `cc-codex-bridge` from Python to Node while preserving full feature parity for the current Codex target. The repo remains a Claude plugin repo. The bridge runtime moves to TypeScript on Node 20 LTS. Local development, test, and build workflows standardize on Bun.

This is a runtime replacement, not a product redesign. Existing users should see the same commands, output files, report structure, and translation behavior after the migration.

## Current Scope

The current bridge translates Claude Code configuration into Codex-native assets across five domains:

- Skills
- Agents
- Hooks
- Environment variables
- Context files and scoped rules

The current runtime is a small Python package with:

- Reader modules for each source domain
- One Codex adapter
- One CLI orchestrator with `sync`, `diff`, and `status`
- A focused regression suite that already defines most parity expectations

## Goals

- Reimplement the bridge in TypeScript for Node 20 LTS
- Preserve the Claude plugin repo shape under `plugins/cc-codex-bridge`
- Preserve full feature parity for the existing Codex bridge contract
- Replace Python and `uv` development flows with Bun-based workflows
- Keep the bridge deterministic and file-backed, with no LLM in the translation path

## Non-Goals

- Add new bridge targets beyond Codex
- Redesign the product around npm-first distribution
- Introduce a Python fallback runtime
- Expand the bridge scope beyond the current five translation domains
- Change user-facing behavior unless required to match current documented and tested behavior

## Constraints

- Minimum runtime: Node 20 LTS
- Package manager and local task runner: Bun
- Repo shape stays plugin-first, not npm-first
- The migration branch must start from `origin/main`
- Existing generated Codex file paths and JSON report keys must remain stable

## Proposed Architecture

The Node rewrite keeps the current bridge shape and swaps the runtime.

### Module Layout

- `plugins/cc-codex-bridge/src/cli.ts`
  - Parses CLI arguments
  - Dispatches `sync`, `diff`, and `status`
  - Emits stable JSON reports
  - Owns exit codes
- `plugins/cc-codex-bridge/src/readers/*`
  - Reads Claude Code source surfaces for skills, agents, hooks, env, and context
- `plugins/cc-codex-bridge/src/adapters/codex.ts`
  - Translates parsed Claude inputs into Codex-native outputs
  - Preserves warnings, mappings, and output routing
- `plugins/cc-codex-bridge/src/core/*`
  - Shared helpers for diffs, file writes, copies, orphan scanning, and report classification
- `plugins/cc-codex-bridge/src/refresh/refresh-cli-docs.ts`
  - Reimplements the existing docs refresh behavior and host validation rules

### Package Shape

Keep these surfaces:

- `plugins/cc-codex-bridge/.claude-plugin/plugin.json`
- `plugins/cc-codex-bridge/skills/*`
- `plugins/cc-codex-bridge/docs/*`

Replace Python packaging with:

- `plugins/cc-codex-bridge/package.json`
- `plugins/cc-codex-bridge/tsconfig.json`
- `plugins/cc-codex-bridge/bun.lock`
- `plugins/cc-codex-bridge/dist/*` for built runtime artifacts

## Compatibility Contract

The Node bridge preserves the current public contract exactly.

### CLI Contract

Keep:

- `sync`
- `diff`
- `status`
- `--target codex`
- `--project-root`
- `--dry-run`
- `--include-user-hooks`

Successful commands continue to print structured JSON to stdout.

### Output Contract

Keep these output locations:

- `.codex/skills/<id>/SKILL.md`
- `.codex/agents/<name>.toml`
- `.codex/hooks.json`
- `.codex/env-bridge.toml`
- `AGENTS.md`
- `AGENTS.override.md`
- Nested scoped `AGENTS.md`

Keep report keys and semantics:

- `synced`
- `warnings`
- `gaps`
- `actions_required`
- `diffs`
- `in_sync`
- `drifted`
- `missing`
- `orphaned`

### Translation Semantics

Preserve current behavior for:

- Dropped skill and agent frontmatter fields
- Model, reasoning-effort, and permission mappings
- Tool-reference rewrites
- Unsupported placeholder stripping and warning markers
- Hook event and handler filtering
- Env TOML output shape
- Context and scoped-rule routing
- Orphan scanning exclusions for `.claude`, `.codex`, `.git`, and `.jj`

## Plugin And Operator Surface

The plugin remains the user-facing distribution shape. Skills keep their current purpose and names.

Update skill guidance from Python commands to Node commands:

- Development-oriented examples use `bun run`
- Packaged runtime examples use built Node entrypoints such as `node dist/cli.js`

The skill docs should continue to explain:

- What each command writes or reports
- Which gaps remain unsupported in Codex
- Which follow-up actions operators need to take, such as enabling Codex hooks

## Testing Strategy

The migration is test-led. Port the existing Python test fixtures and assertions into a Bun-powered TypeScript test suite before replacing the runtime.

The parity suite must cover:

- Sync output file creation
- Skill translation and warning behavior
- Agent translation and mapping behavior
- Hook translation, unsupported-event handling, and enablement warnings
- Env translation shape
- Context routing and nested `AGENTS.md` behavior
- Dry-run behavior
- Status detection for drift, missing outputs, and orphaned files
- User-home hook inclusion rules
- CLI JSON output
- Refresh-docs source scope and GitHub token host validation

New tests are allowed only when they lock down already-existing behavior or close a clear parity gap discovered during the port.

## Failure Handling

Preserve deterministic behavior:

- Successful runs emit JSON reports
- Unsupported Claude features remain warnings, not hard failures
- Missing extra files remain actionable warnings
- Invalid CLI usage and unrecoverable runtime errors return non-zero exit codes

The bridge should fail fast on true runtime errors and stay tolerant on unsupported feature mappings.

## Migration Plan

1. Create a clean branch from `origin/main`
2. Add TypeScript and Bun scaffolding under `plugins/cc-codex-bridge`
3. Port fixtures and regression tests first
4. Reimplement readers, the Codex adapter, and the CLI until the Bun suite reaches parity
5. Reimplement `refresh_cli_docs` behavior in Node
6. Update skill docs, README, and CI commands from Python plus `uv` to Node plus `bun`
7. Remove Python packaging, scripts, and dependencies once the Node runtime is the only active implementation
8. Verify plugin usage against the built artifact, not only source execution

## Risks And Mitigations

### Risk: silent behavior drift during translation rewrite

Mitigation:

- Port existing fixtures first
- Keep the parity suite green before removing Python files
- Compare generated outputs for representative fixtures during the transition

### Risk: packaging drift between local dev and plugin usage

Mitigation:

- Define one built runtime entrypoint for packaged execution
- Keep Bun as the dev and test runner only
- Validate the plugin flow against built `dist` output before declaring the migration complete

### Risk: scope creep into product redesign

Mitigation:

- Treat npm-first packaging, new targets, and contract changes as out of scope
- Reject refactors that do not serve Node parity directly

## Acceptance Criteria

The migration is complete when:

- The bridge runs on Node 20 LTS
- Bun is the standard local workflow
- The Claude plugin repo shape remains intact
- The Bun test suite covers the current bridge contract and passes
- The Node CLI reproduces the current Codex outputs and report structure for existing fixtures
- Python packaging and runtime code are removed from the active implementation path

