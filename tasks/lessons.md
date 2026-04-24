# Lessons

## 2026-04-23

- New feature branches in `cc-codex-bridge` must start from `origin/main`, not from the current local branch or any dirty checkout state.
- When updating repo docs, keep installation guidance near the top of `README.md` so the first-use path is visible without scrolling.
- For onboarding videos, show skill discovery with trigger autocomplete first: `/` in Claude Code and `$` in Codex, using the same skill names across both panes.
- Keep production-facing onboarding media under `media/`, not `experiments/`, once it is intended for the README or a PR.
- For README media, script the exact tracked artifact path and render settings so source and published assets cannot drift.
- For cc-codex-bridge hook UX, do not collapse scope into a boolean flag. Model user scope from `~/.claude/` and project scope from the current repo or an explicit project path, then force the selection flow before any hook write.
- When answering README prerequisite questions, sweep runtime commands, source-file assumptions, activation steps, and workflow secrets together instead of stopping at the first missing dependency.

## 2026-04-24

- In `README.md`, explain source surfaces once as a translation map. Do not pair a raw supported-files list with a second mapping table.
