import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { applyHookPlan, HOOKS_OUTPUT_PATH } from "../../src/hooks/apply.js";
import { buildInventory } from "../../src/hooks/inventory.js";
import { HookPlanError, type HookPlan } from "../../src/hooks/plan.js";
import { copyFixtureProject, makeTmpDir } from "../helpers.js";

function selectByEvent(inventory: ReturnType<typeof buildInventory>, event: string): string[] {
  return inventory.filter((e) => e.scope === "project" && e.event === event).map((e) => e.id);
}

function basePlan(overrides: Partial<HookPlan> = {}): HookPlan {
  return {
    source_scope: "project",
    selected_entry_ids: [],
    write_mode: "create",
    enable_hooks: false,
    enable_scope: null,
    ...overrides,
  };
}

describe("hooks/apply", () => {
  let tmp: string;
  let project: string;
  beforeEach(() => {
    tmp = makeTmpDir();
    project = copyFixtureProject(tmp);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("create mode writes selected entries only", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    const plan = basePlan({ selected_entry_ids: ids, write_mode: "create" });

    const outputs = applyHookPlan({ plan, inventory, projectRoot: project });
    expect(outputs.length).toBe(1);
    expect(outputs[0]!.path).toBe(HOOKS_OUTPUT_PATH);
    const data = JSON.parse(outputs[0]!.content) as { hooks: Record<string, unknown> };
    expect(Object.keys(data.hooks)).toEqual(["PreToolUse"]);
  });

  test("replace mode overwrites existing entries", () => {
    const hooksPath = path.join(project, HOOKS_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "old" }] }] } }),
    );

    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    const outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: ids, write_mode: "replace" }),
      inventory,
      projectRoot: project,
    });
    const data = JSON.parse(outputs[0]!.content) as { hooks: Record<string, unknown> };
    expect("PostToolUse" in data.hooks).toBe(false);
    expect("PreToolUse" in data.hooks).toBe(true);
  });

  test("merge mode keeps existing and adds new", () => {
    const hooksPath = path.join(project, HOOKS_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "old" }] }] } }),
    );

    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    const outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: ids, write_mode: "merge" }),
      inventory,
      projectRoot: project,
    });
    const data = JSON.parse(outputs[0]!.content) as {
      hooks: Record<string, Array<{ hooks: Array<{ command?: string }> }>>;
    };
    expect(Object.keys(data.hooks).sort()).toEqual(["PostToolUse", "PreToolUse"]);
    expect(data.hooks.PostToolUse![0]!.hooks[0]!.command).toBe("old");
  });

  test("merge does not duplicate identical entries", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    // first apply
    let outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: ids, write_mode: "merge" }),
      inventory,
      projectRoot: project,
    });
    fs.mkdirSync(path.join(project, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(project, HOOKS_OUTPUT_PATH), outputs[0]!.content);

    // second apply with same plan should produce identical content
    outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: ids, write_mode: "merge" }),
      inventory,
      projectRoot: project,
    });
    const data = JSON.parse(outputs[0]!.content) as {
      hooks: Record<string, Array<{ hooks: Array<{ command?: string }> }>>;
    };
    const entries = data.hooks.PreToolUse!;
    const total = entries.reduce((acc, e) => acc + e.hooks.length, 0);
    expect(total).toBe(1);
  });

  test("unsupported handler types still warn", () => {
    const inventory = buildInventory({ projectRoot: project });
    const stopIds = selectByEvent(inventory, "Stop"); // prompt handler — unsupported
    const outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: stopIds, write_mode: "create" }),
      inventory,
      projectRoot: project,
    });
    expect(outputs[0]!.warnings.some((w) => w.includes("not supported"))).toBe(true);
  });

  test("enable_hooks writes [features] codex_hooks = true to project config.toml", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    applyHookPlan({
      plan: basePlan({
        selected_entry_ids: ids,
        write_mode: "create",
        enable_hooks: true,
        enable_scope: "project",
      }),
      inventory,
      projectRoot: project,
    });
    const cfg = fs.readFileSync(path.join(project, ".codex", "config.toml"), "utf-8");
    expect(cfg).toContain("[features]");
    expect(cfg).toContain("codex_hooks = true");
  });

  test("merge mode refuses to run when existing hooks.json is malformed", () => {
    const hooksPath = path.join(project, HOOKS_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, "{not json", "utf-8");

    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    expect(() =>
      applyHookPlan({
        plan: basePlan({ selected_entry_ids: ids, write_mode: "merge" }),
        inventory,
        projectRoot: project,
      }),
    ).toThrow(HookPlanError);
    // file unchanged on disk
    expect(fs.readFileSync(hooksPath, "utf-8")).toBe("{not json");
  });

  test("create mode refuses to run when existing hooks.json is malformed", () => {
    const hooksPath = path.join(project, HOOKS_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, "[\"a\", \"b\"]", "utf-8"); // valid JSON, wrong shape

    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    expect(() =>
      applyHookPlan({
        plan: basePlan({ selected_entry_ids: ids, write_mode: "create" }),
        inventory,
        projectRoot: project,
      }),
    ).toThrow(HookPlanError);
  });

  test("replace mode tolerates malformed existing hooks.json", () => {
    const hooksPath = path.join(project, HOOKS_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, "{not json", "utf-8");

    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    const outputs = applyHookPlan({
      plan: basePlan({ selected_entry_ids: ids, write_mode: "replace" }),
      inventory,
      projectRoot: project,
    });
    const data = JSON.parse(outputs[0]!.content) as { hooks: Record<string, unknown> };
    expect("PreToolUse" in data.hooks).toBe(true);
  });

  test("enable_hooks dry-run does not write config.toml", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = selectByEvent(inventory, "PreToolUse");
    const outputs = applyHookPlan({
      plan: basePlan({
        selected_entry_ids: ids,
        write_mode: "create",
        enable_hooks: true,
        enable_scope: "project",
      }),
      inventory,
      projectRoot: project,
      dryRun: true,
    });
    expect(fs.existsSync(path.join(project, ".codex", "config.toml"))).toBe(false);
    expect(outputs[0]!.warnings.some((w) => w.toLowerCase().includes("dry run"))).toBe(true);
    expect(outputs[0]!.warnings.some((w) => w.toLowerCase().includes("skipped"))).toBe(false);
  });
});
