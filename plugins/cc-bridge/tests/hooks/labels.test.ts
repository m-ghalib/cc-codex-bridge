import { describe, expect, test } from "bun:test";

import { buildLabel, disambiguateLabels, EVENT_DISPLAY, summarizeHandler } from "../../src/hooks/labels.js";

describe("hooks/labels", () => {
  test("event display map covers known events", () => {
    expect(EVENT_DISPLAY.PreToolUse).toBe("Before Tool");
    expect(EVENT_DISPLAY.PostToolUse).toBe("After Tool");
    expect(EVENT_DISPLAY.SessionStart).toBe("On Session Start");
    expect(EVENT_DISPLAY.UserPromptSubmit).toBe("On Prompt");
    expect(EVENT_DISPLAY.Stop).toBe("On Stop");
    expect(EVENT_DISPLAY.SubagentStop).toBe("On Subagent Stop");
  });

  test("summarize command picks executable basename", () => {
    expect(summarizeHandler({ type: "command", command: "scripts/log-tool-use.sh" })).toBe("log-tool-use");
    expect(summarizeHandler({ type: "command", command: "/usr/bin/env python tools/run.py" })).toBe("env");
    expect(summarizeHandler({ type: "command", command: "destructive-guard" })).toBe("destructive-guard");
  });

  test("summarize url uses host plus last segment", () => {
    expect(summarizeHandler({ type: "http", url: "https://hooks.example.com/subagent-done" })).toBe(
      "hooks.example.com/subagent-done",
    );
    expect(summarizeHandler({ type: "http", url: "https://hooks.example.com" })).toBe("hooks.example.com");
  });

  test("summarize prompt picks short first phrase", () => {
    expect(summarizeHandler({ type: "prompt", prompt: "Summarize what was accomplished. Focus on decisions." })).toBe(
      "Summarize what was accomplished",
    );
  });

  test("buildLabel composes scope / event / handler", () => {
    expect(
      buildLabel("project", "PreToolUse", { type: "command", command: "scripts/destructive-guard.sh" }),
    ).toBe("Project / Before Tool / destructive-guard");
  });

  test("disambiguateLabels suffixes collisions", () => {
    const out = disambiguateLabels(["A", "B", "A", "A", "B"]);
    expect(out).toEqual(["A (1)", "B (1)", "A (2)", "A (3)", "B (2)"]);
  });
});
