# Terminal Loop Onboarding GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current multi-panel onboarding video with a short terminal-first loop that starts inside the Claude Code TUI with `/` autocomplete, shows `/plugin` marketplace install commands before `/cc-codex-bridge:cc-codex-sync`, performs a Ghostty-style pane handoff into a Codex TUI, and holds on `$` autocomplete in the Codex prompt.

**Architecture:** Keep the durable media project in `media/onboarding-video`. Store the storyboard and timings in `src/script.ts`; render the terminal animation in `src/OnboardingVideo.tsx`; keep `src/Root.tsx` as the Remotion composition boundary. The implementation is a designed terminal simulation using TUI stencils derived from live PTY captures, not an embedded live shell capture.

**Tech Stack:** Remotion 4, React 18, TypeScript, Bun scripts.

---

## File Structure

- Modify `media/onboarding-video/src/script.ts`
  - Replace the five-scene product-tour data with terminal-loop constants:
    Claude TUI commands, shared skill suggestions, output lines, frame timings, and dimensions.
- Modify `media/onboarding-video/src/Root.tsx`
  - Change duration to a short GIF loop, around 450 frames at 30 FPS.
- Replace `media/onboarding-video/src/OnboardingVideo.tsx`
  - Render a single terminal window with animated pane states.
  - Simulate typing and output reveal from the script constants.
  - Hide all labels, generated-file panels, and product-tour UI.
- Modify `media/onboarding-video/package.json`
  - Keep MP4 render for review.
  - Add GIF render script targeting `docs/assets/cc-codex-bridge-onboarding.gif`.
  - Keep an ignored local GIF review script under `out/`.
  - Point poster scripts at useful verification frames.
- Modify `media/onboarding-video/README.md`
  - Update concept, commands, and verification notes to match the terminal loop.

## Task 1: Replace Storyboard Data

**Files:**
- Modify: `media/onboarding-video/src/script.ts`

- [ ] **Step 1: Replace scene data with terminal-loop constants**

Use this shape:

```ts
export const fps = 30;
export const durationInFrames = 450;
export const dimensions = {width: 1280, height: 720};

export type TypedLine = {
  text: string;
  startFrame: number;
  typeFrames: number;
  prompt?: string;
};

export const skillSuggestions = [
  {name: 'review', description: 'Inspect changes with product taste'},
  {name: 'shipcheck', description: 'Check release readiness'},
  {name: 'refactor-map', description: 'Plan a focused cleanup'},
  {name: 'handoff', description: 'Write the next-agent brief'},
];

export const claudeAutocomplete = {
  prompt: '>',
  text: '/',
  startFrame: -8,
  typeFrames: 1,
};

export const claudeCommands: TypedLine[] = [
  {
    prompt: '>',
    text: '/plugin marketplace add m-ghalib/cc-codex-bridge',
    startFrame: 48,
    typeFrames: 38,
  },
  {
    prompt: '>',
    text: '/plugin install cc-codex-bridge@cc-codex-bridge',
    startFrame: 106,
    typeFrames: 36,
  },
  {
    prompt: '>',
    text: '/cc-codex-bridge:cc-codex-sync',
    startFrame: 166,
    typeFrames: 28,
  },
];

export const syncOutput = [
  {text: 'ok skills synced', startFrame: 218},
  {text: 'ok agents synced', startFrame: 236},
  {text: 'ok AGENTS.md updated', startFrame: 254},
];

export const codexLines: TypedLine[] = [
  {prompt: '>', text: 'codex', startFrame: 314, typeFrames: 16},
  {prompt: '>', text: '$', startFrame: 400, typeFrames: 1},
];

export const timing = {
  splitStart: 296,
  splitEnd: 314,
  codexLaunchStart: 314,
  codexReady: 356,
  closeFirstPaneStart: 358,
  closeFirstPaneEnd: 382,
  skillHoldStart: 420,
};
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
cd media/onboarding-video
bun run check
```

Expected: TypeScript may fail until Task 2 updates imports.

## Task 2: Build the Terminal Loop Composition

**Files:**
- Replace: `media/onboarding-video/src/OnboardingVideo.tsx`

- [ ] **Step 1: Replace product-tour component with terminal loop renderer**

Implement these units in the file:

```ts
const typedText = (text: string, localFrame: number, typeFrames: number) => {
  const progress = interpolate(localFrame, [0, typeFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return text.slice(0, Math.floor(text.length * progress));
};
```

Render flow:

- `OnboardingVideo` reads `useCurrentFrame`.
- `TerminalWindow` renders one window with Ghostty-like chrome.
- `PaneLayout` computes first-pane width:
  - full width before `timing.splitStart`
  - split at 50/50 after `timing.splitStart`
  - first pane shrinks to zero from `closeFirstPaneStart` to `closeFirstPaneEnd`
- `ClaudePane` shows `/` autocomplete, the `/plugin` install commands, and `/cc-codex-bridge:cc-codex-sync`.
- `CodexPane` shows `codex`, a short loading state, then `$` autocomplete with the same skill list.

- [ ] **Step 2: Enforce visual exclusions**

Verify the new file contains none of these strings:

```bash
rg -n "Generated surfaces|Step 1|Step 2|Step 3|Step 4|Step 5|hook|status|diff" media/onboarding-video/src/OnboardingVideo.tsx media/onboarding-video/src/script.ts
```

Expected: no matches, except `sync` is allowed.

## Task 3: Update Composition Metadata and Scripts

**Files:**
- Modify: `media/onboarding-video/src/Root.tsx`
- Modify: `media/onboarding-video/package.json`

- [ ] **Step 1: Wire dimensions and duration**

Update `Root.tsx` to import `dimensions`, `durationInFrames`, and `fps` from `script.ts`, then pass them to the composition.

- [ ] **Step 2: Add render scripts**

Use these scripts:

```json
{
  "preview": "remotion studio src/index.ts",
  "render": "remotion render src/index.ts CcCodexBridgeOnboarding out/cc-codex-bridge-onboarding.mp4",
  "render:gif": "remotion render src/index.ts CcCodexBridgeOnboarding ../../docs/assets/cc-codex-bridge-onboarding.gif --codec=gif --scale=0.75 --every-nth-frame=2",
  "render:gif:review": "remotion render src/index.ts CcCodexBridgeOnboarding out/cc-codex-bridge-onboarding.gif --codec=gif --scale=0.75 --every-nth-frame=2",
  "poster": "remotion still src/index.ts CcCodexBridgeOnboarding out/poster.png --frame=430",
  "still:claude": "remotion still src/index.ts CcCodexBridgeOnboarding out/frame-claude.png --frame=18",
  "still:sync": "remotion still src/index.ts CcCodexBridgeOnboarding out/frame-sync.png --frame=286",
  "still:split": "remotion still src/index.ts CcCodexBridgeOnboarding out/frame-split.png --frame=334",
  "still:codex": "remotion still src/index.ts CcCodexBridgeOnboarding out/frame-codex.png --frame=430",
  "check": "tsc --noEmit"
}
```

## Task 4: Update Experiment README

**Files:**
- Modify: `media/onboarding-video/README.md`

- [ ] **Step 1: Rewrite concept and commands**

Document that this is now a terminal-loop GIF media project with this flow:

```text
Claude Code TUI -> / autocomplete -> /plugin marketplace add -> /plugin install -> /cc-codex-bridge:cc-codex-sync -> split pane -> codex -> close first pane -> $ autocomplete
```

Include commands:

```bash
bun install
bun run preview
bun run check
bun run still:sync
bun run still:codex
bun run render
bun run render:gif
```

## Task 5: Verify Render Output

**Files:**
- Generated only under ignored `media/onboarding-video/out/`

- [ ] **Step 1: Typecheck**

Run:

```bash
cd media/onboarding-video
bun run check
```

Expected: PASS.

## Review Refinement: TUI Fidelity

**Files:**
- Modify: `media/onboarding-video/src/OnboardingVideo.tsx`
- Modify: `media/onboarding-video/README.md`
- Modify: `docs/superpowers/specs/2026-04-24-terminal-loop-onboarding-gif-design.md`

- [x] Capture current installed `claude` and `codex` startup TUI geometry through
  a PTY.
- [x] Replace generic CSS cards with text-grid TUI stencils.
- [x] Render separate Claude, sync, split, and Codex verification stills.
- [x] Document the future exact-capture path and redaction caveat.

- [ ] **Step 2: Render still frames**

Run:

```bash
bun run still:claude
bun run still:sync
bun run still:split
bun run still:codex
```

Expected:

- `out/frame-sync.png` shows the terminal after the three sync output lines.
- `out/frame-codex.png` shows only the Codex pane with `$` typed and the autocomplete list visible.

- [ ] **Step 3: Render MP4 and GIF**

Run:

```bash
bun run render
bun run render:gif
```

Expected:

- `out/cc-codex-bridge-onboarding.mp4` renders successfully.
- `docs/assets/cc-codex-bridge-onboarding.gif` renders successfully.

- [ ] **Step 4: Inspect repo state**

Run:

```bash
git status --short --branch
```

Expected: source, README, package, lockfile, spec, and plan changes are tracked; `out/` and `node_modules/` remain ignored.
