import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { HookPlanError, parseHookPlan, validateAgainstInventory } from "../../src/hooks/plan.js";
import type { InventoryEntry } from "../../src/hooks/inventory.js";
import { makeTmpDir } from "../helpers.js";

function writePlan(tmp: string, payload: unknown): string {
  const p = path.join(tmp, "plan.json");
  fs.writeFileSync(p, JSON.stringify(payload), "utf-8");
  return p;
}

function fakeEntry(id: string, scope: "user" | "project" = "project"): InventoryEntry {
  return {
    id,
    scope,
    source: null,
    event: "PreToolUse",
    matcher: "Bash",
    handler: { type: "command", command: "x" },
    label: `Label ${id}`,
  };
}

describe("hooks/plan", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("parses a valid plan", () => {
    const planPath = writePlan(tmp, {
      source_scope: "project",
      selected_entry_ids: ["a1b2c3d4e5"],
      write_mode: "merge",
      enable_hooks: true,
      enable_scope: "project",
    });
    const plan = parseHookPlan(planPath);
    expect(plan.source_scope).toBe("project");
    expect(plan.selected_entry_ids).toEqual(["a1b2c3d4e5"]);
    expect(plan.write_mode).toBe("merge");
    expect(plan.enable_hooks).toBe(true);
    expect(plan.enable_scope).toBe("project");
  });

  test("rejects invalid source_scope", () => {
    const planPath = writePlan(tmp, {
      source_scope: "everywhere",
      selected_entry_ids: ["a"],
      write_mode: "merge",
      enable_hooks: false,
      enable_scope: null,
    });
    expect(() => parseHookPlan(planPath)).toThrow(HookPlanError);
  });

  test("rejects enable_hooks=true with enable_scope=null", () => {
    const planPath = writePlan(tmp, {
      source_scope: "project",
      selected_entry_ids: ["a"],
      write_mode: "merge",
      enable_hooks: true,
      enable_scope: null,
    });
    expect(() => parseHookPlan(planPath)).toThrow(HookPlanError);
  });

  test("rejects bad write_mode", () => {
    const planPath = writePlan(tmp, {
      source_scope: "project",
      selected_entry_ids: ["a"],
      write_mode: "patch",
      enable_hooks: false,
      enable_scope: null,
    });
    expect(() => parseHookPlan(planPath)).toThrow(HookPlanError);
  });

  test("rejects non-string selected_entry_ids", () => {
    const planPath = writePlan(tmp, {
      source_scope: "project",
      selected_entry_ids: [42],
      write_mode: "merge",
      enable_hooks: false,
      enable_scope: null,
    });
    expect(() => parseHookPlan(planPath)).toThrow(HookPlanError);
  });

  test("validateAgainstInventory returns selected entries when all known", () => {
    const inventory = [fakeEntry("aaaaaaaaaa"), fakeEntry("bbbbbbbbbb"), fakeEntry("cccccccccc", "user")];
    const plan = {
      source_scope: "project" as const,
      selected_entry_ids: ["aaaaaaaaaa"],
      write_mode: "merge" as const,
      enable_hooks: false,
      enable_scope: null,
    };
    const selected = validateAgainstInventory(plan, inventory);
    expect(selected.map((e) => e.id)).toEqual(["aaaaaaaaaa"]);
  });

  test("validateAgainstInventory rejects unknown IDs", () => {
    const inventory = [fakeEntry("aaaaaaaaaa")];
    const plan = {
      source_scope: "project" as const,
      selected_entry_ids: ["zzzzzzzzzz"],
      write_mode: "merge" as const,
      enable_hooks: false,
      enable_scope: null,
    };
    expect(() => validateAgainstInventory(plan, inventory)).toThrow(HookPlanError);
  });

  test("validateAgainstInventory ignores entries from other scopes", () => {
    const inventory = [fakeEntry("aaaaaaaaaa", "user")];
    const plan = {
      source_scope: "project" as const,
      selected_entry_ids: ["aaaaaaaaaa"],
      write_mode: "merge" as const,
      enable_hooks: false,
      enable_scope: null,
    };
    expect(() => validateAgainstInventory(plan, inventory)).toThrow(HookPlanError);
  });
});
