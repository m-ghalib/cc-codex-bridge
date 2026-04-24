# cc-codex-bridge onboarding GIF

This durable Remotion media project renders a terminal-first looping GIF for the
fastest cc-codex-bridge onboarding path:

```text
Claude Code TUI -> / autocomplete -> /plugin marketplace add -> /plugin install -> cc-codex-sync -> split pane -> Codex TUI -> close first pane -> $ autocomplete
```

It does not affect the bridge runtime or plugin package.

## Concept

The GIF shows one real-feeling terminal workflow:

1. Start inside a Claude Code-style TUI by entering `/` and showing a made-up skill autocomplete list.
2. Add and install the Claude Code plugin with `/plugin` commands.
3. Run `cc-codex-sync` inside Claude.
4. Show the minimal sync result:
   `skills synced`, `agents synced`, and `AGENTS.md updated`.
5. Split the terminal into a second pane.
6. Launch a Codex-style TUI in the second pane.
7. Close the first pane after Codex loads.
8. Type `$` in Codex and show the same skill autocomplete list before the loop restarts.

The composition intentionally omits labels, generated-file panels, hook
preflight, status, diff, and file-review output scenes.

## TUI fidelity

The terminal panes use text-grid stencils derived from live PTY captures of the
installed `claude` and `codex` CLIs. The render stays deterministic instead of
embedding live screenshots, so personal account details are redacted and the GIF
does not drift when model names, versions, or tips change.

For a future fully captured version, use a fixed-size PTY recording and feed the
ANSI output into a terminal renderer before animating the typed command overlays.
The practical capture path is:

```bash
script -q /tmp/claude-tui.log claude
script -q /tmp/codex-tui.log codex
```

Then convert the ANSI screen state with an xterm-compatible renderer. Direct
screen captures are useful for reference stills, but they should be masked or
redacted before being used in product media.

## Commands

Install dependencies:

```bash
bun install
```

Preview in Remotion Studio:

```bash
bun run preview
```

Typecheck:

```bash
bun run check
```

Render verification stills:

```bash
bun run still:claude
bun run still:sync
bun run still:split
bun run still:codex
```

Render review video:

```bash
bun run render
```

Render looping GIF:

```bash
bun run render:gif
```
