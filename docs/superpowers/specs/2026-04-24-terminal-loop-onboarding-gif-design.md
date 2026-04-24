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

Install the plugin, run `cc-codex-sync`, open Codex, and the migrated
`${skill}` is available.

## Storyboard

1. Start on a single terminal pane.
2. Show a quick install pre-roll:

   ```bash
   claude plugins marketplace add m-ghalib/cc-codex-bridge
   claude plugins install cc-codex-bridge@cc-codex-bridge
   ```

3. Run the plugin skill:

   ```bash
   cc-codex-sync
   ```

4. Print only the minimal sync output:

   ```text
   ok skills synced
   ok agents synced
   ok AGENTS.md updated
   ```

5. Split the terminal into a second pane with Ghostty-style pane behavior.
6. In the second pane, launch Codex:

   ```bash
   codex
   ```

7. Wait for the Codex prompt to load.
8. Close the first pane.
9. Let the Codex pane become the full focus.
10. Type the literal placeholder:

    ```text
    ${skill}
    ```

11. Hold briefly on `${skill}` and let the GIF restart.

## Visual Rules

- Use a terminal-first composition.
- Do not show product labels, generated-file panels, shortcut captions, or
  explanatory text.
- Do not show hook preflight in this first GIF.
- Do not show status, diff, or file review commands.
- Keep pane operations visible as state changes only. Do not show keyboard
  shortcut text.
- Keep the final frame static enough that a GIF restart feels acceptable.

## Content Rules

- Treat `cc-codex-sync` as the main product moment.
- Treat `${skill}` as a template placeholder, not an example skill name.
- Show the plugin skill command, not the underlying Node runtime command.
- Keep sync output to three lines:
  `skills synced`, `agents synced`, and `AGENTS.md updated`.

## Timing

The GIF should stay short enough to loop without fatigue. A target range of
10-15 seconds is appropriate:

- Install pre-roll: 2-3 seconds
- Sync command and output: 3-4 seconds
- Pane split and Codex launch: 3-5 seconds
- `${skill}` typing and hold: 2-3 seconds

## Acceptance Criteria

- The rendered GIF shows the approved sequence in order.
- The first pane closes only after Codex has loaded in the second pane.
- The final visible state is `${skill}` typed in Codex.
- The GIF contains no labels, generated-file panels, hook preflight, status,
  diff, or review scenes.
- The loop restart does not hide a missing end state.

## Verification

Before using the GIF externally:

- Typecheck the Remotion project.
- Render a still from the sync moment.
- Render a still from the Codex pane after the first pane closes.
- Render the GIF or MP4 source and inspect the full loop.
- Confirm the ignored render artifacts stay outside version control.
