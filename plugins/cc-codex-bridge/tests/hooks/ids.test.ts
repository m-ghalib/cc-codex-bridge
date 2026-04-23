import { describe, expect, test } from "bun:test";

import { entryId, stableStringify } from "../../src/hooks/ids.js";

describe("hooks/ids", () => {
  test("ID is stable across calls with same inputs", () => {
    const handler = { type: "command", command: "echo hi", timeout: 10 };
    const a = entryId("project", "PreToolUse", "Bash", handler);
    const b = entryId("project", "PreToolUse", "Bash", handler);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{10}$/);
  });

  test("ID is sensitive to scope", () => {
    const handler = { type: "command", command: "echo hi" };
    const u = entryId("user", "PreToolUse", "Bash", handler);
    const p = entryId("project", "PreToolUse", "Bash", handler);
    expect(u).not.toBe(p);
  });

  test("ID is sensitive to event and matcher", () => {
    const handler = { type: "command", command: "echo hi" };
    const a = entryId("project", "PreToolUse", "Bash", handler);
    const b = entryId("project", "PostToolUse", "Bash", handler);
    const c = entryId("project", "PreToolUse", "Bash(rm *)", handler);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  test("ID is independent of handler key order", () => {
    const a = entryId("project", "PreToolUse", "Bash", { type: "command", command: "ls", timeout: 5 });
    const b = entryId("project", "PreToolUse", "Bash", { timeout: 5, command: "ls", type: "command" } as Record<string, unknown> as { type: string });
    expect(a).toBe(b);
  });

  test("stableStringify drops undefined and sorts keys", () => {
    const a = stableStringify({ b: 1, a: 2, c: undefined });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});
