# cc-bridge

Claude Code plugin that bridges Claude Code configuration to Codex CLI.
Translates skills, subagents, hooks, env vars, context files, and rules
from Claude Code format to Codex-native format.

## Layout

    - `skills/` — plugin skills (sync, diff, status)
    - `scripts/` — deterministic Python translation engine
        - `bridge.py` — orchestrator CLI
        - `readers/` — reads Claude Code config files
        - `adapters/` — translates to target platform format
        - `mappings/` — declarative YAML mapping tables
    - `docs/` — platform snapshots and feature mapping
    - `tests/` — pytest suite with fixture-based golden-file tests

## Execution

Always use `uv run` to execute Python scripts from the plugin directory (`plugins/cc-bridge/`).
Example: `uv run python scripts/bridge.py sync --target codex`

## Testing

Run tests with `uv run pytest` from `plugins/cc-bridge/`. All tests use `tmp_path` — never write into the source tree.

## Design spec

See `docs/specs/2026-04-22-cc-bridge-design.md` for the full design document.
