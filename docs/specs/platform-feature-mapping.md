# Platform Feature Mapping — 2026-04-14

> Canonical 1:1 comparison of Claude Code, Gemini CLI, and OpenAI Codex CLI across 5 feature areas.
> Every claim is footnoted to an official source URL.

## Platform Versions

| Platform | Version | Release Date | Source |
|---|---|---|---|
| Claude Code | v2.1.108 [^cc-ver] | 2026-04-14 [^cc-ver] | https://github.com/anthropics/claude-code/releases [^cc-ver] |
| Gemini CLI | v0.38.0 [^g-ver] | 2026-04-14 [^g-ver] | https://github.com/google-gemini/gemini-cli/releases [^g-ver] |
| OpenAI Codex CLI | 0.120.0 (`rust-v0.120.0`) [^cx-ver] | 2026-04-11 [^cx-ver] | https://github.com/openai/codex/releases [^cx-ver] |

---

## 1. Skills / Extensions

All three platforms expose a "Skill" concept rooted in the [Agent Skills open standard](https://agentskills.io): a directory containing a `SKILL.md` with YAML frontmatter and supporting files. Claude Code treats skills as the unified component primitive (commands are a subset). Gemini CLI distinguishes **extensions** (installable multi-component packages with a `gemini-extension.json` manifest bundling MCP servers, commands, hooks, sub-agents, and skills) from **Agent Skills** (standalone `SKILL.md` packages). Codex exposes skills as a first-class feature separate from `AGENTS.md` context.

### 1.1 Skill File Structure

| Field / Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Skill manifest file | `SKILL.md` [^cc-skills] | `SKILL.md` [^g-skills] | `SKILL.md` [^cx-skills] |
| Extension / package manifest | **not supported** (skills are the unit) [^cc-skills] | `gemini-extension.json` (multi-component) [^g-ext] | **not supported** (skills are the unit; no bundling manifest) [^cx-skills] |
| Project skill directory | `.claude/skills/<name>/` [^cc-skills] | `.gemini/skills/<name>/` or `.agents/skills/<name>/` [^g-skills] | `./.agents/skills/<name>/` (also `../.agents/skills/`, `$REPO_ROOT/.agents/skills/`) [^cx-skills] |
| User skill directory | `~/.claude/skills/<name>/` [^cc-skills] | `~/.gemini/skills/<name>/` or `~/.agents/skills/<name>/` [^g-skills] | `$HOME/.agents/skills/<name>/` [^cx-skills] |
| Enterprise / system skills | `.claude/skills/` inside managed settings directory [^cc-skills] | **not supported** [^g-skills] | `/etc/codex/skills/` (admin) + bundled system skills [^cx-skills] |
| Plugin / extension-bundled skills | `<plugin>/skills/<name>/` [^cc-skills] | `skills/<name>/` inside installed extension [^g-ext] | **not supported** [^cx-skills] |
| Priority on name collision | enterprise > personal > project; plugin skills namespaced [^cc-skills] | `.agents/skills/` wins over `.gemini/skills/` at same tier; no override across tiers [^g-skills] | conflicts by name leave both selectable in picker [^cx-skills] |
| Supporting files conventions | `scripts/`, `examples/`, `reference.md`, any files [^cc-skills] | `scripts/`, `references/`, `assets/` [^g-skills] | `scripts/`, `references/`, `assets/`, `agents/openai.yaml` [^cx-skills] |
| Live change detection | yes — watches skill dirs within session [^cc-skills] | session start scans metadata; `/memory reload` re-scans [^g-skills] | **not documented** [^cx-skills] |

### 1.2 Skill Frontmatter Fields

| Field                         | Claude Code                                                                          | Gemini CLI                                                                       | Codex CLI                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                        | optional (defaults to dir name); lowercase/digits/hyphens; max 64 chars [^cc-skills] | required; must match directory name [^g-skills]                                  | required [^cx-skills]                                                                                                                  |
| `description`                 | recommended; combined + truncated at 1,536 chars [^cc-skills]                        | required; describes when to deploy [^g-skills]                                   | required; drives implicit invocation [^cx-skills]                                                                                      |
| `when_to_use`                 | optional; appended to description [^cc-skills]                                       | **not supported** (merged into `description`) [^g-skills]                        | **not supported** (merged into `description`) [^cx-skills]                                                                             |
| Argument hint                 | `argument-hint` (autocomplete) [^cc-skills]                                          | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| Disable auto-invocation       | `disable-model-invocation: true` [^cc-skills]                                        | **not supported** at frontmatter level (user consent per activation) [^g-skills] | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` [^cx-skills]                                                          |
| Hide from user menu           | `user-invocable: false` [^cc-skills]                                                 | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| Pre-approve tools             | `allowed-tools` [^cc-skills]                                                         | **not supported** at skill level [^g-skills]                                     | **not supported** at skill level [^cx-skills]                                                                                          |
| Model override                | `model` [^cc-skills]                                                                 | **not supported** at skill level [^g-skills]                                     | **not supported** at skill level [^cx-skills]                                                                                          |
| Effort level                  | `effort` (`low`/`medium`/`high`/`max`) [^cc-skills]                                  | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| Run in forked subagent        | `context: fork` + `agent: <type>` [^cc-skills]                                       | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| Lifecycle hooks               | `hooks` field [^cc-skills]                                                           | **not supported** at skill level [^g-skills]                                     | **not supported** [^cx-skills]                                                                                                         |
| Path-scoped activation        | `paths` (globs) [^cc-skills]                                                         | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| Shell flavor                  | `shell` (`bash`/`powershell`) [^cc-skills]                                           | **not supported** [^g-skills]                                                    | **not supported** [^cx-skills]                                                                                                         |
| UI metadata                   | **not supported** (no icons/colors on skills) [^cc-skills]                           | **not supported** [^g-skills]                                                    | `agents/openai.yaml` → `interface.{display_name, short_description, icon_small, icon_large, brand_color, default_prompt}` [^cx-skills] |
| Tool dependencies declaration | **not supported** at skill level [^cc-skills]                                        | **not supported** at skill level [^g-skills]                                     | `agents/openai.yaml` → `dependencies.tools[]` (e.g. MCP) [^cx-skills]                                                                  |

### 1.3 Skill Invocation

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Manual invocation syntax | `/skill-name [args]` [^cc-skills] | on-match + consent; skills not directly slash-invokable [^g-skills] | `/skills` picker or `$<skill-name>` in prompt [^cx-skills] |
| Automatic invocation by model | yes (description match) [^cc-skills] | yes — `activate_skill` tool call after description match + user consent [^g-skills] | yes — implicit when `policy.allow_implicit_invocation` is true and description matches [^cx-skills] |
| Argument substitution | `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N` [^cc-skills] | **not supported** [^g-skills] | **not supported** (skill body is static instructions) [^cx-skills] |
| User consent at invocation | managed via permission rules / `Skill` tool flag [^cc-skills] | yes — explicit consent prompt on each activation [^g-skills] | governed by `approval_policy` / `skill_approval` [^cx-skills] |
| Inline shell exec in skill body | `` !`<command>` `` and fenced `` ```! `` blocks [^cc-skills] | **not supported** [^g-skills] | **not supported** [^cx-skills] |
| Built-in / bundled skills | `/simplify`, `/batch`, `/debug`, `/loop`, `/claude-api`, others [^cc-skills] | **not supported** (skills not bundled as built-ins; extensions are the bundling unit) [^g-skills] | `$skill-creator`, `$skill-installer` + bundled system skills [^cx-skills] |
| Programmatic enable / disable | settings: `permissions.allow/deny` with `Skill(name)` patterns [^cc-perms] | `/agents enable|disable` is for agents, not skills; skills disabled via removal [^g-skills] | `~/.codex/config.toml` → `[[skills.config]] path = "..." enabled = false` [^cx-skills] |

### 1.4 Extension Manifest (Gemini-only)

| Field | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Manifest file | **not supported** [^cc-skills] | `gemini-extension.json` — required fields: `name`, `version`, `description` [^g-ext] | **not supported** [^cx-skills] |
| Install command | **not supported** (plugins are the analog) | `gemini extensions install <github-url>` [^g-ext] | **not supported** |
| Scaffold | **not supported** | `gemini extensions new <name> <template>` [^g-ext] | **not supported** |
| Variable substitution | **not supported** in skills | `${extensionPath}`, `${workspacePath}`, `${/}` [^g-ext] | **not supported** |
| Sensitive settings | **not supported** | `settings[].sensitive: true` → keychain via `gemini extensions config` [^g-ext] | **not supported** |

---

## 2. Cascading Context Files

All three platforms support hierarchical markdown context files that are concatenated into the model's context. They differ on the canonical filename, inheritance, and override semantics.

### 2.1 Scoping Levels

| Level | Claude Code (`CLAUDE.md`) | Gemini CLI (`GEMINI.md`) | Codex CLI (`AGENTS.md`) |
|---|---|---|---|
| Managed / admin (enterprise) | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux: `/etc/claude-code/CLAUDE.md`; Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` [^cc-mem] | **not supported** [^g-md] | **not supported** at this level (admin is `/etc/codex/skills/` only) [^cx-agents] |
| Global / user | `~/.claude/CLAUDE.md` [^cc-mem] | `~/.gemini/GEMINI.md` [^g-md] | `~/.codex/AGENTS.md` (or `AGENTS.override.md`) [^cx-agents] |
| Project root | `./CLAUDE.md` or `./.claude/CLAUDE.md` [^cc-mem] | `GEMINI.md` at workspace root [^g-md] | `<git-repo-root>/AGENTS.md` (or `AGENTS.override.md`) [^cx-agents] |
| Subdirectory (nested) | `CLAUDE.md` in any subdirectory (loaded on demand when Claude reads files there) [^cc-mem] | `GEMINI.md` discovered JIT when tools access a file/dir; scanned up to trusted root [^g-md] | `AGENTS.md` or `AGENTS.override.md` in any directory between git root and cwd [^cx-agents] |
| Local / gitignored | `./CLAUDE.local.md` [^cc-mem] | **not supported** [^g-md] | **not supported** [^cx-agents] |
| Modular rules files | `.claude/rules/*.md` with optional `paths:` frontmatter; user-level `~/.claude/rules/` [^cc-mem] | **not supported** (use `@file.md` imports) [^g-md] | **not supported** (use fallback filenames) [^cx-agents] |
| Auto-written memory | `~/.claude/projects/<project>/memory/MEMORY.md` + topic files [^cc-mem] | `## Gemini Added Memories` section in `~/.gemini/GEMINI.md` (via `save_memory`) [^g-mem-tool] | **not supported** (no built-in auto-memory) [^cx-agents] |
| Alternate filenames | `AGENTS.md` supported only via `@AGENTS.md` import in `CLAUDE.md` [^cc-mem] | configurable via `context.fileName: ["AGENTS.md", "CONTEXT.md", "GEMINI.md"]` [^g-config] | `project_doc_fallback_filenames` in `config.toml` (e.g. `["TEAM_GUIDE.md", ".agents.md"]`) [^cx-agents] |
| Override-variant file | **not supported** | **not supported** | `AGENTS.override.md` — preferred over sibling `AGENTS.md` at same level [^cx-agents] |

### 2.2 Load Order and Inheritance

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Load order | managed → ancestors (outer → inner) → project → user; nested loaded on-demand [^cc-mem] | global → workspace (+ ancestors) → JIT on file access [^g-md] | global → repo root → each intermediate dir toward cwd [^cx-agents] |
| Combination method | concatenation (all files appended, later wins for duplicates) [^cc-mem] | concatenation; later scans **add** context [^g-md] | concatenation with blank-line separators; later files effectively override [^cx-agents] |
| Precedence on conflict | deeper / project rules win; managed cannot be overridden [^cc-mem] | later-loaded file adds context (no hard override) [^g-md] | files deeper in tree override earlier; direct prompt instructions outrank any `AGENTS.md` [^cx-agents] |
| Size cap | no documented cap; guidance: keep under 200 lines per file [^cc-mem] | no size cap; `discoveryMaxDirs` (default 200) caps traversal [^g-config] | `project_doc_max_bytes` default **32 KiB**; discovery halts at cap [^cx-agents] |
| Empty-file behavior | loaded (no-op) [^cc-mem] | loaded (no-op) [^g-md] | skipped [^cx-agents] |
| Import syntax | `@path/to/file` (relative to importing file); max recursion depth 5; HTML comments stripped [^cc-mem] | `@file.md` (relative or absolute paths) [^g-md] | **not supported** (use fallback filenames) [^cx-agents] |
| Compaction / reload behavior | project-root file re-injected after `/compact`; nested reload lazily [^cc-mem] | `/memory reload` force-rescans; footer shows count [^g-md] | **not documented** [^cx-agents] |
| Exclusion mechanism | `claudeMdExcludes` (glob array) at any non-managed settings layer [^cc-mem] | **not supported** [^g-md] | **not supported** [^cx-agents] |
| Additional directories | `--add-dir` grants file access; by default skips CLAUDE.md unless `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` [^cc-perms] | `context.includeDirectories` in settings [^g-config] | `CODEX_HOME` env var relocates the global scope [^cx-agents] |
| Feature flag for cascade | always on [^cc-mem] | always on [^g-md] | `[features] child_agents_md = true` adds nested-override guidance to user-instructions [^cx-agents] |
| Management commands | `/memory`, debug via `InstructionsLoaded` hook [^cc-mem] | `/memory show`, `/memory reload`, `/memory add <text>` [^g-md] | **not documented** [^cx-agents] |
| Delivery channel | user message (post system prompt); use `--append-system-prompt` for system-level enforcement [^cc-mem] | prepended to every prompt [^g-md] | injected into developer instructions [^cx-agents] |

---

## 3. Hooks

All three platforms support hooks — user-defined commands executed at lifecycle points that receive JSON on stdin and return JSON on stdout plus exit-code-based control flow. Claude Code has the broadest event surface; Gemini has the richest per-event I/O (including synthetic LLM-response injection); Codex's hook feature is feature-flagged and currently limited to `Bash`-only tool interception.

### 3.1 Support Status

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Hooks supported | yes [^cc-hooks] | yes (core feature) [^g-hooks] | yes (experimental, feature-flagged) [^cx-hooks] |
| Feature flag required | **not required** [^cc-hooks] | **not required** [^g-hooks] | `[features] codex_hooks = true` in `~/.codex/config.toml` [^cx-hooks] |
| Windows supported | yes [^cc-hooks] | yes [^g-hooks] | **not supported** — temporarily disabled as of 2026-04 [^cx-hooks] |
| Handler types | `command`, `http`, `prompt`, `agent` [^cc-hooks] | `command` only [^g-hooks] | `command` only [^cx-hooks] |
| Concurrent vs sequential | per-hook `async` flag [^cc-hooks] | per-matcher `sequential: true|false` (default parallel) [^g-hooks] | all matching hooks run **concurrently** [^cx-hooks] |
| Deduplication | identical command hooks run once (dedup by command string); HTTP by URL [^cc-hooks] | **not documented** [^g-hooks] | **not documented** [^cx-hooks] |
| Default timeout | command 600s, prompt 30s, agent 60s [^cc-hooks] | `60000` ms (60s) [^g-hooks] | 600s [^cx-hooks] |

### 3.2 Event Types

| Event concept                 | Claude Code                                                                                   | Gemini CLI                                                                                 | Codex CLI                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Session start                 | `SessionStart` (matchers: `startup`, `resume`, `clear`, `compact`) [^cc-hooks]                | `SessionStart` (sources: `startup`, `resume`, `clear`) [^g-hooks]                          | `SessionStart` (matchers: `startup`, `resume`) [^cx-hooks] |
| Session end                   | `SessionEnd` [^cc-hooks]                                                                      | `SessionEnd` (reasons: `exit`, `clear`, `logout`, `prompt_input_exit`, `other`) [^g-hooks] | **not supported** [^cx-hooks]                              |
| User prompt submitted         | `UserPromptSubmit` [^cc-hooks]                                                                | **not supported** (closest: `BeforeAgent`) [^g-hooks]                                      | `UserPromptSubmit` [^cx-hooks]                             |
| Before agent turn             | **not supported** (`UserPromptSubmit` is closest) [^cc-hooks]                                 | `BeforeAgent` [^g-hooks]                                                                   | **not supported** [^cx-hooks]                              |
| After agent turn              | `Stop` (fires when Claude finishes responding) [^cc-hooks]                                    | `AfterAgent` [^g-hooks]                                                                    | `Stop` (block = continue) [^cx-hooks]                      |
| Before LLM request            | **not supported** [^cc-hooks]                                                                 | `BeforeModel` [^g-hooks]                                                                   | **not supported** [^cx-hooks]                              |
| After LLM response            | **not supported** [^cc-hooks]                                                                 | `AfterModel` (fires per streamed chunk) [^g-hooks]                                         | **not supported** [^cx-hooks]                              |
| Tool-selection gate           | **not supported** (use `PreToolUse`) [^cc-hooks]                                              | `BeforeToolSelection` (whitelist only) [^g-hooks]                                          | **not supported** [^cx-hooks]                              |
| Before tool use               | `PreToolUse` (all tools incl. MCP) [^cc-hooks]                                                | `BeforeTool` (regex on tool name) [^g-hooks]                                               | `PreToolUse` — **Bash only** currently (WIP) [^cx-hooks]   |
| After tool use (success)      | `PostToolUse` [^cc-hooks]                                                                     | `AfterTool` [^g-hooks]                                                                     | `PostToolUse` — **Bash only** currently [^cx-hooks]        |
| After tool failure            | `PostToolUseFailure` [^cc-hooks]                                                              | **not supported** (merged into `AfterTool`) [^g-hooks]                                     | **not supported** [^cx-hooks]                              |
| Permission request            | `PermissionRequest` [^cc-hooks]                                                               | `Notification` with `notification_type: "ToolPermission"` [^g-hooks]                       | **not supported** [^cx-hooks]                              |
| Permission denied (auto-mode) | `PermissionDenied` [^cc-hooks]                                                                | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Stop failure                  | `StopFailure` (rate_limit, auth, billing, etc.) [^cc-hooks]                                   | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Notification                  | `Notification` (permission_prompt, idle_prompt, auth_success, elicitation_dialog) [^cc-hooks] | `Notification` (observability only) [^g-hooks]                                             | **not supported** [^cx-hooks]                              |
| Compaction before             | `PreCompact` (matchers: `manual`, `auto`) [^cc-hooks]                                         | `PreCompress` (triggers: `auto`, `manual`) [^g-hooks]                                      | **not supported** [^cx-hooks]                              |
| Compaction after              | `PostCompact` [^cc-hooks]                                                                     | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Subagent start / stop         | `SubagentStart`, `SubagentStop` [^cc-hooks]                                                   | **not supported** (no subagent lifecycle hooks documented) [^g-hooks]                      | **not supported** [^cx-hooks]                              |
| Instructions loaded           | `InstructionsLoaded` (for CLAUDE.md / rules debugging) [^cc-hooks]                            | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Config change                 | `ConfigChange` (blocking) [^cc-hooks]                                                         | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Cwd / file watch              | `CwdChanged`, `FileChanged` [^cc-hooks]                                                       | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Worktree create / remove      | `WorktreeCreate`, `WorktreeRemove` [^cc-hooks]                                                | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| Task lifecycle                | `TaskCreated`, `TaskCompleted`, `TeammateIdle` [^cc-hooks]                                    | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |
| MCP elicitation               | `Elicitation`, `ElicitationResult` [^cc-hooks]                                                | **not supported** [^g-hooks]                                                               | **not supported** [^cx-hooks]                              |

### 3.3 Hook I/O and Control Flow

| Field | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Transport | stdio (JSON) + HTTP + prompt + agent [^cc-hooks] | stdio (JSON) [^g-hooks] | stdio (JSON) [^cx-hooks] |
| Common input fields | `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `agent_id`, `agent_type` [^cc-hooks] | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `timestamp` [^g-hooks] | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model` (+ `turn_id` on turn events) [^cx-hooks] |
| Exit code 0 | success; stdout JSON parsed [^cc-hooks] | success; stdout JSON controls behavior [^g-hooks] | success; stdout JSON (plaintext allowed for some events) [^cx-hooks] |
| Exit code 2 | **blocking error** (non-standard) — stderr fed to Claude [^cc-hooks] | system block — stderr becomes rejection reason; turn continues [^g-hooks] | blocks action; stderr becomes reason [^cx-hooks] |
| Exit code 1 / other | **non-blocking** — shows error notice, proceeds [^cc-hooks] | non-fatal warning — CLI continues [^g-hooks] | non-fatal warning [^cx-hooks] |
| JSON decision field values | `block`, `allow`, `deny`, `ask`, `defer` [^cc-hooks] | `allow`, `deny`, `block` [^g-hooks] | `block` (legacy form) [^cx-hooks] |
| Prefer JSON or exit code | choose one, not both [^cc-hooks] | stdout **must** be JSON (except stderr logs) [^g-hooks] | both supported; JSON required for `Stop` on exit 0 [^cx-hooks] |
| Multiple-hook decision precedence | `deny` > `defer` > `ask` > `allow` [^cc-hooks] | whitelists **union** on `BeforeToolSelection`; first deny wins elsewhere [^g-hooks] | `continue: false` on Stop takes precedence [^cx-hooks] |
| Override tool inputs | `hookSpecificOutput.updatedInput` [^cc-hooks] | `hookSpecificOutput.tool_input` (overrides args) [^g-hooks] | **not supported** [^cx-hooks] |
| Inject additional context | `hookSpecificOutput.additionalContext` [^cc-hooks] | `additionalContext` [^g-hooks] | `hookSpecificOutput.additionalContext` (on supported events) [^cx-hooks] |
| Reroute to another tool | **not supported** [^cc-hooks] | `AfterTool.tailToolCallRequest` [^g-hooks] | **not supported** [^cx-hooks] |
| Synthetic LLM response | **not supported** [^cc-hooks] | `BeforeModel.llm_response` (skips LLM entirely) [^g-hooks] | **not supported** [^cx-hooks] |
| Output cap | 10,000 characters (excess saved to file) [^cc-hooks] | **not documented** [^g-hooks] | **not documented** [^cx-hooks] |
| Matcher syntax | literal tool names / regex / glob depending on event [^cc-hooks] | regex on tool name (tool events); exact string (lifecycle) [^g-hooks] | regex on tool name / source [^cx-hooks] |

### 3.4 Hook Configuration Locations

| Location | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| User settings | `~/.claude/settings.json` [^cc-hooks] | `~/.gemini/settings.json` [^g-hooks] | `~/.codex/hooks.json` [^cx-hooks] |
| Project settings | `.claude/settings.json` + `.claude/settings.local.json` [^cc-hooks] | `.gemini/settings.json` [^g-hooks] | `<repo>/.codex/hooks.json` [^cx-hooks] |
| Managed / system | managed settings JSON on platform-specific paths [^cc-settings] | **not supported** [^g-hooks] | **not supported** [^cx-hooks] |
| Plugin / extension | plugin `hooks/hooks.json` [^cc-hooks] | extension `hooks/hooks.json` [^g-ext] | **not supported** [^cx-hooks] |
| Component-scoped | skill / subagent frontmatter `hooks:` field [^cc-hooks] | **not supported** [^g-hooks] | **not supported** [^cx-hooks] |
| Managed-only controls | `allowManagedHooksOnly`, `allowedHttpHookUrls`, `httpHookAllowedEnvVars` [^cc-settings] | **not supported** [^g-hooks] | **not supported** [^cx-hooks] |
| Global disable | `"disableAllHooks": true` [^cc-hooks] | `hooksConfig.enabled: false` [^g-hooks] | remove `codex_hooks` from features [^cx-hooks] |
| Fingerprinting | **not supported** [^cc-hooks] | yes — hook name/command change re-triggers trust warning [^g-hooks] | **not documented** [^cx-hooks] |

---

## 4. Subagents

All three platforms support subagents as a first-class feature. Claude Code has the widest field surface and supports worktree isolation + agent teams. Gemini uniquely supports **remote subagents** via the A2A protocol. Codex uses TOML files and gates multi-agent orchestration behind a feature flag.

### 4.1 Support Status

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Subagents supported | yes [^cc-agents] | yes (marked experimental) [^g-agents] | yes (feature-flagged: `[features] multi_agent = true`) [^cx-agents-sub] |
| Local subagents | yes (always) [^cc-agents] | yes (`kind: local`, default) [^g-agents] | yes [^cx-agents-sub] |
| Remote subagents (A2A) | **not supported** [^cc-agents] | yes (`kind: remote` via `agent_card_url` / `agent_card_json`) [^g-remote] | **not supported** [^cx-agents-sub] |
| Subagent can spawn subagents | **not supported** (nested subagents disallowed) [^cc-agents] | **not documented** [^g-agents] | yes (capped by `[agents] max_depth = 2` default) [^cx-agents-sub] |

### 4.2 Definition Format

| Field | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| File format | markdown + YAML frontmatter [^cc-agents] | markdown + YAML frontmatter [^g-agents] | **TOML** (one file per agent) [^cx-agents-sub] |
| Project agent directory | `.claude/agents/<name>.md` [^cc-agents] | `.gemini/agents/<name>.md` [^g-agents] | `.codex/agents/<name>.toml` [^cx-agents-sub] |
| User agent directory | `~/.claude/agents/<name>.md` [^cc-agents] | `~/.gemini/agents/<name>.md` [^g-agents] | `~/.codex/agents/<name>.toml` [^cx-agents-sub] |
| Managed / org-wide | `.claude/agents/` in managed settings dir [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Plugin / extension | plugin `agents/` (no `hooks`/`mcpServers`/`permissionMode`) [^cc-agents] | extension `agents/*.md` [^g-ext] | **not supported** [^cx-agents-sub] |
| CLI-defined (session-only) | `claude --agents '<json>'` (same fields as frontmatter) [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Required fields | `name`, `description` [^cc-agents] | `name`, `description` [^g-agents] | `name`, `description`, `developer_instructions` [^cx-agents-sub] |
| System prompt source | markdown body [^cc-agents] | markdown body [^g-agents] | `developer_instructions` TOML field [^cx-agents-sub] |
| Tool allowlist | `tools` field; `disallowedTools` denylist [^cc-agents] | `tools` (wildcards `*`, `mcp_*`, `mcp_servername_*`); inherits if omitted [^g-agents] | **not supported** at field level (sandbox-scoped) [^cx-agents-sub] |
| Model override | `model` (`sonnet`/`opus`/`haiku`/full ID/`inherit`) [^cc-agents] | `model` (inherits session default) [^g-agents] | `model` (e.g. `gpt-5.4`, `gpt-5.4-mini`) [^cx-agents-sub] |
| Reasoning / effort | `effort` (`low`/`medium`/`high`/`max`) [^cc-agents] | **not supported** (uses `temperature`) [^g-agents] | `model_reasoning_effort` (`low`/`medium`/`high`) [^cx-agents-sub] |
| Temperature | **not supported** (managed by model) [^cc-agents] | `temperature` (default `1`) [^g-agents] | **not supported** [^cx-agents-sub] |
| Turn / time limits | `maxTurns` [^cc-agents] | `max_turns` (default 30), `timeout_mins` (default 10) [^g-agents] | **not supported** [^cx-agents-sub] |
| Permission mode | `permissionMode` (`default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`) [^cc-agents] | **not supported** [^g-agents] | `sandbox_mode` (`read-only`/`workspace-write`/`danger-full-access`) [^cx-agents-sub] |
| Preloaded skills | `skills:` (full content injected at startup) [^cc-agents] | **not supported** [^g-agents] | `skills.config` (per-subagent enable/disable) [^cx-agents-sub] |
| MCP scoping | `mcpServers` (inline defs or session refs) [^cc-agents] | `mcpServers` [^g-agents] | `mcp_servers` (subset of parent's) [^cx-agents-sub] |
| Lifecycle hooks | `hooks` field [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Memory scope | `memory` (`user`/`project`/`local`) [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Background execution | `background: true` [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Worktree isolation | `isolation: worktree` (auto-cleanup if no changes) [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Display / UI | `color` (8 options) [^cc-agents] | **not supported** [^g-agents] | `nickname_candidates` (display names) [^cx-agents-sub] |
| First-turn prompt | `initialPrompt` (when running as `--agent`) [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Remote auth config | **not supported** | `auth` (multiple types) — remote only [^g-remote] | **not supported** |

### 4.3 Spawning and Invocation

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Main-thread spawning tool | `Agent` (alias `Task`) [^cc-agents] | `@agent-name <task>` syntax [^g-agents] | `spawn_agent` + `send_input`/`send_message`/`wait_agent`/`resume_agent`/`close_agent`/`list_agents`/`followup_task` [^cx-agents-sub] |
| Natural-language invocation | yes — Claude decides based on description [^cc-agents] | yes — automatic delegation based on description [^g-agents] | **not supported** — user must explicitly request parallel work [^cx-agents-sub] |
| Explicit invocation syntax | `@"agent-name (agent)"` typeahead [^cc-agents] | `@agent-name <task>` [^g-agents] | `/agent` slash command to switch threads [^cx-agents-sub] |
| Session-wide invocation | `claude --agent <name>` or `agent: <name>` in settings [^cc-agents] | **not supported** [^g-agents] | **not supported** [^cx-agents-sub] |
| Batch / CSV orchestration | **not supported** | **not supported** | `agent_jobs` (`create_spawn_agents_on_csv_tool`) [^cx-agents-sub] |
| Concurrency cap | **not documented** | **not documented** | `[agents] max_threads` (default 4) [^cx-agents-sub] |
| Depth cap | 1 (subagents cannot nest) [^cc-agents] | **not documented** [^g-agents] | `[agents] max_depth` (default 2) [^cx-agents-sub] |
| Management commands | `--disallowedTools "Agent(<name>)"` [^cc-agents] | `/agents list`, `/agents reload`, `/agents enable|disable <name>` [^g-agents] | `/agent` to list/switch [^cx-agents-sub] |
| Foreground vs background | foreground (blocks) / background (press Ctrl+B; concurrent) [^cc-agents] | **not documented** (async by delegation) [^g-agents] | concurrent by design [^cx-agents-sub] |
| Inter-agent messaging | `SendMessage` tool (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) [^cc-agents] | **not supported** (subagent-to-subagent) [^g-agents] | `send_input`, `send_message` tools [^cx-agents-sub] |
| Resume stopped subagent | `SendMessage` with `to: <agent_id>` [^cc-agents] | **not documented** [^g-agents] | `resume_agent` [^cx-agents-sub] |

### 4.4 Built-in Subagents

| Platform | Built-ins |
|---|---|
| Claude Code | `Explore`, `Plan`, `general-purpose`, `statusline-setup`, `Claude Code Guide` [^cc-agents] |
| Gemini CLI | `codebase_investigator`, `cli_help`, `generalist`, `browser_agent` [^g-agents] |
| Codex CLI | **not documented** (no named built-in subagents) [^cx-agents-sub] |

### 4.5 Context Model

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| System prompt source | frontmatter / CLI JSON prompt (not Claude Code system prompt) [^cc-agents] | markdown body [^g-agents] | `developer_instructions` TOML field [^cx-agents-sub] |
| Skill inheritance | **none** — must list explicitly in `skills:` [^cc-agents] | **not documented** [^g-agents] | inherits from parent; override via `skills.config` [^cx-agents-sub] |
| Permission inheritance | parent `bypassPermissions` / `auto` overrides child [^cc-agents] | **not documented** [^g-agents] | inherits sandbox from parent if omitted [^cx-agents-sub] |
| Transcript location | `~/.claude/projects/{project}/{sessionId}/subagents/agent-{id}.jsonl` [^cc-agents] | **not documented** [^g-agents] | **not documented** [^cx-agents-sub] |
| Auto-compaction | yes (~95% capacity; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`) [^cc-agents] | **not documented** [^g-agents] | **not documented** [^cx-agents-sub] |

---

## 5. Tool Availability

### 5.1 Core Tool Names

| Abstract function | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Read a file | `Read` [^cc-tools] | `read_file` [^g-tools] | `shell` (e.g. `cat`) — no first-class `read_file` model tool [^cx-tools] |
| Edit a file (targeted) | `Edit` [^cc-tools] | `replace` [^g-tools] | `apply_patch` [^cx-tools] |
| Write / overwrite a file | `Write` [^cc-tools] | `write_file` [^g-tools] | `apply_patch` [^cx-tools] |
| Run a shell command | `Bash` (also `PowerShell` on Windows, opt-in) [^cc-tools] | `run_shell_command` [^g-tools] | `shell` (also `shell_command`, `exec_command` with PTY, `write_stdin` for stdin) [^cx-tools] |
| Fetch a URL | `WebFetch` [^cc-tools] | `web_fetch` [^g-tools] | **not supported** (no first-class `web_fetch`; use `shell` + curl or MCP) [^cx-tools] |
| Search web | `WebSearch` [^cc-tools] | `google_web_search` [^g-tools] | built-in `web_search` (cached by default; `--search` for live) [^cx-tools] |
| File-name glob | `Glob` [^cc-tools] | `glob` [^g-tools] | **not supported** (use `shell` + `rg`/`find`) [^cx-tools] |
| Content search (regex) | `Grep` (ripgrep-based) [^cc-tools] | `grep_search` [^g-tools] | **not supported** (use `shell` + `rg`) [^cx-tools] |
| List directory | **not supported** (use `Glob`/`Bash`) [^cc-tools] | `list_directory` [^g-tools] | `list_dir` [^cx-tools] |
| Read many files at once | **not supported** (use multiple `Read`) [^cc-tools] | `read_many_files` (also `@` in prompts) [^g-tools] | **not supported** [^cx-tools] |
| Spawn a subagent | `Agent` (alias `Task`) [^cc-tools] | `@agent` syntax (no dedicated tool) [^g-tools] | `spawn_agent` (+ `send_input`, `send_message`, `wait_agent`, `list_agents`, `resume_agent`, `close_agent`, `followup_task`) [^cx-tools] |
| Ask user a question | `AskUserQuestion` [^cc-tools] | `ask_user` (up to 4 questions) [^g-tools] | `request_user_input` [^cx-tools] |
| Execute a skill | `Skill` [^cc-tools] | `activate_skill` [^g-tools] | invoked via `$<skill>` / `/skills`; no standalone tool [^cx-tools] |
| Plan mode entry | `EnterPlanMode` [^cc-tools] | `enter_plan_mode` [^g-tools] | **not supported** (uses `/plan` slash command) [^cx-tools] |
| Plan mode exit | `ExitPlanMode` [^cc-tools] | `exit_plan_mode` [^g-tools] | **not supported** [^cx-tools] |
| In-session todo list | `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate` (interactive); `TodoWrite` (headless/SDK) [^cc-tools] | `write_todos` [^g-tools] | `update_plan` [^cx-tools] |
| Save memory / fact | **not supported** as a tool (auto-memory via system) [^cc-tools] | `save_memory` → `## Gemini Added Memories` [^g-tools] | **not supported** [^cx-tools] |
| Background watch / monitor | `Monitor` [^cc-tools] | `run_shell_command` with `is_background: true` [^g-tools] | `exec_command` with `yield_time_ms` / ongoing sessions [^cx-tools] |
| Edit notebooks | `NotebookEdit` [^cc-tools] | **not supported** [^g-tools] | **not supported** [^cx-tools] |
| Language server / LSP | `LSP` (inactive until plugin installed) [^cc-tools] | **not supported** [^g-tools] | **not supported** [^cx-tools] |
| Worktree lifecycle | `EnterWorktree`, `ExitWorktree` [^cc-tools] | **not supported** [^g-tools] | **not supported** [^cx-tools] |
| View an image | **not supported** as tool (inline in `Read`) [^cc-tools] | **not supported** (`read_file` handles images) [^g-tools] | `view_image` [^cx-tools] |
| JS REPL | **not supported** [^cc-tools] | **not supported** [^g-tools] | `js_repl`, `js_repl_reset` [^cx-tools] |
| MCP resource read | `ListMcpResourcesTool`, `ReadMcpResourceTool` [^cc-tools] | **not supported** as standalone tool (MCP tools namespaced) [^g-tools] | `list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource` [^cx-tools] |
| Cron / scheduling | `CronCreate`, `CronDelete`, `CronList` [^cc-tools] | **not supported** [^g-tools] | **not supported** [^cx-tools] |
| Tool discovery | `ToolSearch` (deferred-tool loading) [^cc-tools] | `get_internal_docs` [^g-tools] | `ToolSearchHandler`, `ToolSuggestHandler` (internal dynamic discovery) [^cx-tools] |
| Request elevated permissions | **not supported** as tool (settings-managed) [^cc-tools] | **not supported** [^g-tools] | `request_permissions` [^cx-tools] |
| Agent team management | `TeamCreate`, `TeamDelete`, `SendMessage` (feature-flagged) [^cc-tools] | **not supported** [^g-tools] | **not supported** [^cx-tools] |
| MCP tool naming convention | `mcp__<server>__<tool>` [^cc-tools] | MCP server-namespaced (e.g. `mcp_<server>_<tool>` pattern for allowlists) [^g-tools] | namespaced via `ToolNamespace` (server name) [^cx-tools] |

### 5.2 Tool Permissions / Restrictions

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Permission rule grammar | `Bash(cmd)`, `Read(./.env)`, `WebFetch`, `Skill(name *)`, `Agent(x, y)` [^cc-perms] | `run_shell_command(git)` etc. in `tools.allowed`; `tools.exclude`, `tools.core` [^g-config] | Starlark `prefix_rule()` definitions in `~/.codex/rules/*.rules` [^cx-sandbox] |
| Per-tool user-confirmation required by default | `Bash`, `Edit`, `Write`, `NotebookEdit`, `Monitor`, `PowerShell`, `Skill`, `ExitPlanMode`, `WebFetch`, `WebSearch` [^cc-tools] | `run_shell_command`, `write_file`, `replace`, `web_fetch`, `exit_plan_mode` [^g-tools] | governed by `approval_policy` + sandbox [^cx-sandbox] |
| Allowlist / denylist precedence | deny > ask > allow; merge across layers; managed can lock via `allowManagedPermissionRulesOnly` [^cc-perms] | exclude wins over allowed [^g-config] | most-restrictive `decision` wins (`forbidden` > `prompt` > `allow`) [^cx-sandbox] |
| Subagent tool scoping | `tools` / `disallowedTools` in frontmatter [^cc-agents] | `tools` in frontmatter (wildcards) [^g-agents] | **not supported** (sandbox-scoped instead) [^cx-agents-sub] |
| Extension-level tool exclusion | plugin-level (managed via settings) [^cc-perms] | `excludeTools` array in `gemini-extension.json` [^g-ext] | **not supported** [^cx-sandbox] |
| Managed MCP server controls | `allowedMcpServers`, `deniedMcpServers`, `allowManagedMcpServersOnly` [^cc-settings] | **not supported** [^g-config] | **not supported** [^cx-sandbox] |

### 5.3 Sandbox / Security Model

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Sandbox type | permission rules + optional `sandbox.enabled` in managed settings [^cc-settings] | per-tool confirmation prompts; no OS sandbox documented [^g-config] | OS sandbox: macOS Seatbelt (`sandbox-exec`), Linux `bwrap` + `seccomp` (or Landlock), native Windows sandbox [^cx-sandbox] |
| Sandbox modes | permission modes: `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` [^cc-agents] | **not supported** [^g-config] | `read-only`, `workspace-write` (default), `danger-full-access` [^cx-sandbox] |
| Approval policy | permission modes + tool-specific rules [^cc-perms] | per-tool confirmation [^g-tools] | `untrusted`, `on-request`, `never`, `Granular(...)` [^cx-sandbox] |
| Network access | allowed by default (tool-specific rules for domains) [^cc-perms] | allowed by default [^g-config] | **off by default** in `workspace-write`; requires `request_permissions` [^cx-sandbox] |
| Protected directories | `.git`, `.claude`, `.vscode`, `.idea`, `.husky` prompt even in `bypassPermissions` [^cc-agents] | **not documented** [^g-config] | `.git/`, `.agents/`, `.codex/` always read-only [^cx-sandbox] |
| Sandbox env markers | **not documented** [^cc-tools] | **not documented** [^g-tools] | `CODEX_SANDBOX=seatbelt`, `CODEX_SANDBOX_NETWORK_DISABLED=1` [^cx-sandbox] |
| Web search safety | live [^cc-tools] | live via `google_web_search` [^g-tools] | **cached** (OpenAI-maintained index) by default to reduce prompt-injection exposure [^cx-sandbox] |
| Bypass flag | `bypassPermissions` mode [^cc-agents] | **not documented** [^g-config] | `--dangerously-bypass-approvals-and-sandbox` / `--yolo` [^cx-sandbox] |
| Rule validator | `InstructionsLoaded` hook for debug [^cc-hooks] | **not supported** [^g-config] | `codex execpolicy check --rules <path> -- <cmd>` [^cx-sandbox] |
| Command splitting | single command string (hook can parse) [^cc-tools] | single command string [^g-tools] | splits linear chains (`&&`, `||`, `;`, `|`) into subcommands evaluated independently; opaque on redirection/substitution [^cx-sandbox] |

### 5.4 Tool Calling Convention

| Behavior | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Invocation protocol | Anthropic tool-use API (JSON parameters) [^cc-tools] | Gemini function calling (JSON) [^g-tools] | OpenAI Responses API function tools (JSON) [^cx-tools] |
| Parallel tool calls | supported (batched in a single response) [^cc-tools] | supported (model-decided) [^g-tools] | supported when spec sets `supports_parallel_tool_calls = true` [^cx-tools] |
| Output schema | tool result message (text or structured) [^cc-tools] | tool result message [^g-tools] | some tools declare `output_schema` (e.g. `exec_command`, `view_image`) [^cx-tools] |
| Tool-name case sensitivity | case-sensitive exact strings [^cc-tools] | case-sensitive exact strings [^g-tools] | case-sensitive; namespaced via `ToolNamespace` [^cx-tools] |
| Deferred / on-demand tool loading | `ToolSearch` + `select:<name>` [^cc-tools] | **not supported** [^g-tools] | `DynamicToolHandler` / `ToolSearchHandler` (internal) [^cx-tools] |

---

## Footnotes

[^cc-ver]: Claude Code release notes — https://github.com/anthropics/claude-code/releases
[^g-ver]: Gemini CLI releases — https://github.com/google-gemini/gemini-cli/releases
[^cx-ver]: Codex releases (`rust-v0.120.0`) — https://github.com/openai/codex/releases

[^cc-skills]: Claude Code Skills — https://code.claude.com/docs/en/skills
[^cc-perms]: Claude Code permissions (`Skill(...)`, `Agent(...)` rules) — https://code.claude.com/docs/en/permissions
[^cc-mem]: Claude Code memory and cascading CLAUDE.md — https://code.claude.com/docs/en/memory
[^cc-hooks]: Claude Code hooks reference — https://code.claude.com/docs/en/hooks
[^cc-agents]: Claude Code subagents — https://code.claude.com/docs/en/sub-agents
[^cc-tools]: Claude Code tools reference — https://code.claude.com/docs/en/tools-reference
[^cc-settings]: Claude Code settings (managed controls) — https://code.claude.com/docs/en/settings

[^g-skills]: Gemini CLI Skills — https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md (and `creating-skills.md`)
[^g-ext]: Gemini CLI Extensions manifest and layout — https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md (and `writing-extensions.md`, `index.md`)
[^g-md]: Gemini CLI GEMINI.md hierarchy — https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md
[^g-config]: Gemini CLI configuration schema — https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md
[^g-mem-tool]: Gemini CLI `save_memory` tool — https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/memory.md
[^g-hooks]: Gemini CLI hooks reference — https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md (and `index.md`, `writing-hooks.md`)
[^g-agents]: Gemini CLI local subagents — https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md
[^g-remote]: Gemini CLI remote subagents (A2A) — https://github.com/google-gemini/gemini-cli/blob/main/docs/core/remote-agents.md
[^g-tools]: Gemini CLI tools reference — https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md (and `docs/tools/*.md`)

[^cx-skills]: Codex Skills spec — https://developers.openai.com/codex/skills
[^cx-agents]: Codex AGENTS.md guide — https://developers.openai.com/codex/guides/agents-md (and embedded prompt `codex-rs/core/hierarchical_agents_message.md`)
[^cx-hooks]: Codex hooks spec — https://developers.openai.com/codex/hooks (schemas: `codex-rs/hooks/schema/generated/*.schema.json`)
[^cx-agents-sub]: Codex subagents — https://developers.openai.com/codex/concepts/subagents (and `/codex/subagents`, `/codex/config-reference`)
[^cx-tools]: Codex tool specs — https://github.com/openai/codex/blob/main/codex-rs/tools/src/lib.rs (and per-module files: `local_tool.rs`, `apply_patch_tool.rs`, `plan_tool.rs`, `view_image.rs`, `agent_tool.rs`, `request_user_input_tool.rs`, `utility_tool.rs`, `js_repl_tool.rs`, `mcp_resource_tool.rs`)
[^cx-sandbox]: Codex sandboxing and rules — https://developers.openai.com/codex/concepts/sandboxing (and `/codex/agent-approvals-security`, `/codex/rules`, `/codex/config-reference`)
