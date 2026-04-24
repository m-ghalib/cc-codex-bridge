# Terminal Loop Onboarding GIF Design

## Purpose

Create a short looping GIF that shows the fastest path from installing
`cc-codex-bridge` to using a migrated Codex skill. The video should feel like a
real terminal workflow, not a narrated product tour.

## Audience

The target viewer is a Claude Code user who wants to know whether their existing
Claude setup can become usable in Codex with one bridge command. The video
should answer that through motion and command output.

## Core Promise

Install the plugin from inside Claude Code, run
`/cc-codex-bridge:cc-codex-sync`, open Codex, and the same migrated skill list
appears behind Codex's `$` trigger.

## Storyboard

1. Start on a single terminal pane already inside a Claude Code-style TUI.
2. Type `/` and show a made-up skill autocomplete list below the prompt.
3. Run the Claude Code plugin installation commands in order:

   ```text
   /plugin marketplace add m-ghalib/cc-codex-bridge
   /plugin install cc-codex-bridge@cc-codex-bridge
   ```

4. Run the plugin skill inside Claude:

   ```text
   /cc-codex-bridge:cc-codex-sync
   ```

5. Print only the minimal sync output:

   ```text
   ok skills synced
   ok agents synced
   ok AGENTS.md updated
   ```

6. Split the terminal into a second pane with Ghostty-style pane behavior.
7. In the second pane, launch a Codex-style TUI:

   ```bash
   codex
   ```

8. Wait for the Codex prompt to load.
9. Close the first pane.
10. Let the Codex pane become the full focus.
11. Type the Codex skill trigger:

   ```text
   $
   ```

12. Show the same skill autocomplete list below the Codex prompt and let the GIF restart.

## Visual Rules

- Use a terminal-first composition.
- Use Claude and Codex TUI stencils based on live PTY captures rather than
  generic CSS cards.
- Redact personal account details from captured or simulated TUI surfaces.
- Do not show product labels, generated-file panels, shortcut captions, or
  explanatory text.
- Do not show hook preflight in this first GIF.
- Do not show status, diff, or file-review output scenes.
- Keep pane operations visible as state changes only. Do not show keyboard
  shortcut text.
- Keep the final frame static enough that a GIF restart feels acceptable.

## Content Rules

- Treat `/cc-codex-bridge:cc-codex-sync` as the main product moment.
- Treat `/` in Claude and `$` in Codex as matching autocomplete trigger moments.
- Show the plugin skill command, not the underlying Node runtime command.
- Keep sync output to three lines:
  `skills synced`, `agents synced`, and `AGENTS.md updated`.

## Timing

The GIF should stay short enough to loop without fatigue. A target range of
10-15 seconds is appropriate:

- Claude install commands: 3-4 seconds
- Sync command and output: 3-4 seconds
- Pane split and Codex launch: 3-5 seconds
- `$` autocomplete hold: 2-3 seconds

## Acceptance Criteria

- The rendered GIF shows the approved sequence in order.
- The first frame starts inside Claude Code, not a shell prompt.
- The Claude frame resembles the Claude Code TUI: orange box, welcome card,
  prompt rail, effort indicator, and footer status.
- The Codex frame resembles the Codex TUI: top OpenAI Codex box, model/directory
  rows, tip area, boot/status row, prompt, and footer context.
- The first pane closes only after Codex has loaded in the second pane.
- The final visible state is `$` typed in Codex with the same skill autocomplete list visible.
- The GIF contains no labels, generated-file panels, hook preflight, status,
  diff, or file-review output scenes.
- The loop restart does not hide a missing end state.

## Verification

Before using the GIF externally:

- Typecheck the Remotion project.
- Render a still from the sync moment.
- Render a still from the Codex pane after the first pane closes.
- Render the GIF or MP4 source and inspect the full loop.
- Confirm the ignored render artifacts stay outside version control.
