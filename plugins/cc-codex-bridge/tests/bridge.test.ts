import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parse as parseToml } from "smol-toml";

import { cmdHooksInventory, cmdStatus, cmdSync } from "../src/cli.js";
import { buildInventory } from "../src/hooks/inventory.js";
import { copyFixtureProject, listFiles, makeTmpDir } from "./helpers.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(HERE, "..", "src", "cli.ts");
const BUN_BIN = process.env.BUN_BIN ?? "bun";

function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(BUN_BIN, ["run", CLI_ENTRY, ...args], {
    encoding: "utf-8",
    env,
  });
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function writePlan(planPath: string, payload: unknown): void {
  fs.writeFileSync(planPath, JSON.stringify(payload), "utf-8");
}

describe("bridge sync/diff/status", () => {
  let tmp: string;
  let project: string;
  beforeEach(() => {
    tmp = makeTmpDir();
    project = copyFixtureProject(tmp);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("sync writes expected files (no hooks without plan)", () => {
    const report = cmdSync("codex", project, { dryRun: false });
    const expectedPaths = new Set([
      ".codex/skills/sample-skill/SKILL.md",
      ".codex/agents/reviewer.toml",
      ".codex/env-bridge.toml",
      "AGENTS.md",
      "AGENTS.override.md",
      "tests/AGENTS.md",
    ]);
    for (const rel of expectedPaths) {
      expect(fs.existsSync(path.join(project, rel))).toBe(true);
    }
    // hooks.json is NOT written without a plan
    expect(fs.existsSync(path.join(project, ".codex/hooks.json"))).toBe(false);
    const synced = new Set(report.synced.map((e) => e.path));
    for (const rel of expectedPaths) {
      expect(synced.has(rel)).toBe(true);
    }
  });

  test("sync skill content", () => {
    cmdSync("codex", project, { dryRun: false });
    const text = fs.readFileSync(path.join(project, ".codex/skills/sample-skill/SKILL.md"), "utf-8");
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain("name: sample-skill");
    const betweenFences = text.split("---", 3)[1]!;
    expect(betweenFences).not.toContain("allowed-tools");
    expect(text).not.toContain("$ARGUMENTS");
    expect(text).toContain("ARGUMENTS placeholder not supported");
  });

  test("sync agent content", () => {
    cmdSync("codex", project, { dryRun: false });
    const data = parseToml(
      fs.readFileSync(path.join(project, ".codex/agents/reviewer.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(data.name).toBe("reviewer");
    expect(data.model).toBe("gpt-5.4");
    expect(data.model_reasoning_effort).toBe("high");
    expect(data.sandbox_mode).toBe("workspace-write");
    expect("developer_instructions" in data).toBe(true);
  });

  test("sync env without plan still writes env-bridge.toml", () => {
    cmdSync("codex", project, { dryRun: false });
    const env = fs.readFileSync(path.join(project, ".codex/env-bridge.toml"), "utf-8");
    expect(env).toContain("[shell_environment_policy]");
    expect(env).toContain('set.DEBUG = "1"');
    expect(env).toContain('set.API_BASE_URL = "https://api.example.com"');
    expect(fs.existsSync(path.join(project, ".codex/hooks.json"))).toBe(false);
  });

  test("sync context routing", () => {
    cmdSync("codex", project, { dryRun: false });
    const rootAgents = fs.readFileSync(path.join(project, "AGENTS.md"), "utf-8");
    expect(rootAgents).toContain("Test Project");
    expect(rootAgents).toContain("Keep functions under 50 lines");
    const override = fs.readFileSync(path.join(project, "AGENTS.override.md"), "utf-8");
    expect(override).toContain("Debug mode is enabled");
    const scoped = fs.readFileSync(path.join(project, "tests/AGENTS.md"), "utf-8");
    expect(scoped).toContain("pytest fixtures");
    expect(scoped).toContain("tmp_path");
  });

  test("sync report structure surfaces preflight-required marker", () => {
    const report = cmdSync("codex", project, { dryRun: false });
    expect(new Set(Object.keys(report))).toEqual(new Set(["synced", "warnings", "gaps", "actions_required"]));
    expect(Array.isArray(report.synced)).toBe(true);
    expect(report.actions_required.some((w) => w.includes("hook preflight required"))).toBe(true);
    // env warning still present
    expect(report.actions_required.some((w) => w.includes("active Codex config.toml"))).toBe(true);
  });

  test("dry run writes nothing", () => {
    const before = listFiles(project);
    const report = cmdSync("codex", project, { dryRun: true });
    const after = listFiles(project);
    expect(after).toEqual(before);
    expect(report.synced.length).toBeGreaterThan(0);
  });

  test("status all in sync after sync (hooks ignored)", () => {
    cmdSync("codex", project, { dryRun: false });
    const status = cmdStatus("codex", project);
    expect(status.drifted).toEqual([]);
    expect(status.missing).toEqual([]);
    expect(status.orphaned).toEqual([]);
    expect(status.in_sync.length).toBeGreaterThan(0);
  });

  test("status detects missing before sync", () => {
    const status = cmdStatus("codex", project);
    expect(status.missing.length).toBeGreaterThan(0);
    expect(status.in_sync).toEqual([]);
  });

  test("status detects drift", () => {
    cmdSync("codex", project, { dryRun: false });
    fs.writeFileSync(path.join(project, "AGENTS.md"), "tampered\n", "utf-8");
    const status = cmdStatus("codex", project);
    expect(status.drifted).toContain("AGENTS.md");
  });

  test("status detects orphan", () => {
    cmdSync("codex", project, { dryRun: false });
    const orphan = path.join(project, ".codex/agents/stray.toml");
    fs.writeFileSync(orphan, 'name = "stray"\n', "utf-8");
    const status = cmdStatus("codex", project);
    expect(status.orphaned).toContain(".codex/agents/stray.toml");
  });

  test("status ignores .codex/hooks.json when no plan is given", () => {
    cmdSync("codex", project, { dryRun: false });
    fs.mkdirSync(path.join(project, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(project, ".codex/hooks.json"), '{"hooks": {}}\n', "utf-8");
    const status = cmdStatus("codex", project);
    expect(status.orphaned).not.toContain(".codex/hooks.json");
  });

  test("status detects nested AGENTS orphans but skips source dirs", () => {
    cmdSync("codex", project, { dryRun: false });
    fs.mkdirSync(path.join(project, "docs/guides"), { recursive: true });
    fs.writeFileSync(path.join(project, "docs/guides/AGENTS.md"), "stale\n", "utf-8");
    fs.writeFileSync(path.join(project, "docs/AGENTS.override.md"), "stale override\n", "utf-8");
    fs.writeFileSync(path.join(project, ".claude/AGENTS.md"), "source file\n", "utf-8");
    fs.mkdirSync(path.join(project, ".git"));
    fs.writeFileSync(path.join(project, ".git/AGENTS.md"), "git metadata\n", "utf-8");
    fs.mkdirSync(path.join(project, ".jj"));
    fs.writeFileSync(path.join(project, ".jj/AGENTS.override.md"), "jj metadata\n", "utf-8");

    const status = cmdStatus("codex", project);
    expect(status.orphaned).toContain("docs/guides/AGENTS.md");
    expect(status.orphaned).toContain("docs/AGENTS.override.md");
    expect(status.orphaned).not.toContain(".claude/AGENTS.md");
    expect(status.orphaned).not.toContain(".git/AGENTS.md");
    expect(status.orphaned).not.toContain(".jj/AGENTS.override.md");
  });

  test("sync with hook plan writes selected entries", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = inventory
      .filter((e) => e.scope === "project" && e.event === "PreToolUse")
      .map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    const planPath = path.join(tmp, "plan.json");
    writePlan(planPath, {
      source_scope: "project",
      selected_entry_ids: ids,
      write_mode: "create",
      enable_hooks: false,
      enable_scope: null,
    });

    cmdSync("codex", project, { dryRun: false, hookPlanPath: planPath });
    const hooks = JSON.parse(fs.readFileSync(path.join(project, ".codex/hooks.json"), "utf-8")) as {
      hooks: Record<string, Array<{ matcher: string; hooks: Array<{ command?: string }> }>>;
    };
    expect(Object.keys(hooks.hooks)).toEqual(["PreToolUse"]);
    expect(hooks.hooks.PreToolUse![0]!.matcher).toBe("Bash(rm *)");
  });

  test("sync with hook plan writes enablement to chosen config.toml", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = inventory
      .filter((e) => e.scope === "project" && e.event === "PreToolUse")
      .map((e) => e.id);
    const planPath = path.join(tmp, "plan.json");
    writePlan(planPath, {
      source_scope: "project",
      selected_entry_ids: ids,
      write_mode: "create",
      enable_hooks: true,
      enable_scope: "project",
    });
    cmdSync("codex", project, { dryRun: false, hookPlanPath: planPath });
    const cfg = fs.readFileSync(path.join(project, ".codex/config.toml"), "utf-8");
    expect(cfg).toContain("[features]");
    expect(cfg).toContain("codex_hooks = true");
  });

  test("hooks-inventory returns deterministic entries", () => {
    const a = cmdHooksInventory(project, {});
    const b = cmdHooksInventory(project, {});
    expect(a.entries.map((e) => e.id)).toEqual(b.entries.map((e) => e.id));
    expect(a.entries.length).toBeGreaterThan(0);
    for (const entry of a.entries) {
      expect(entry.id).toMatch(/^[0-9a-f]{10}$/);
      expect(typeof entry.label).toBe("string");
    }
  });

  test("CLI sync prints JSON without writing hooks.json", () => {
    const { code, stdout } = runCli(["sync", "--target", "codex", "--project-root", project]);
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as Record<string, unknown>;
    expect("synced" in report).toBe(true);
    expect("warnings" in report).toBe(true);
    expect(fs.existsSync(path.join(project, ".codex/hooks.json"))).toBe(false);
  });

  test("CLI hooks-inventory prints JSON with stable IDs", () => {
    const first = runCli(["hooks-inventory", "--target", "codex", "--project-root", project]);
    const second = runCli(["hooks-inventory", "--target", "codex", "--project-root", project]);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const a = JSON.parse(first.stdout) as { entries: Array<{ id: string }> };
    const b = JSON.parse(second.stdout) as { entries: Array<{ id: string }> };
    expect(a.entries.map((e) => e.id)).toEqual(b.entries.map((e) => e.id));
    expect(a.entries.length).toBeGreaterThan(0);
  });

  test("CLI rejects --include-user-hooks (flag removed)", () => {
    const { code, stderr } = runCli([
      "sync",
      "--target",
      "codex",
      "--project-root",
      project,
      "--include-user-hooks",
    ]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("Unknown argument");
  });

  test("CLI sync with --hook-plan writes selected hooks", () => {
    const inventory = buildInventory({ projectRoot: project });
    const ids = inventory
      .filter((e) => e.scope === "project" && e.event === "PreToolUse")
      .map((e) => e.id);
    const planPath = path.join(tmp, "plan.json");
    writePlan(planPath, {
      source_scope: "project",
      selected_entry_ids: ids,
      write_mode: "create",
      enable_hooks: false,
      enable_scope: null,
    });
    const { code } = runCli([
      "sync",
      "--target",
      "codex",
      "--project-root",
      project,
      "--hook-plan",
      planPath,
    ]);
    expect(code).toBe(0);
    const hooks = JSON.parse(fs.readFileSync(path.join(project, ".codex/hooks.json"), "utf-8")) as {
      hooks: Record<string, unknown>;
    };
    expect("PreToolUse" in hooks.hooks).toBe(true);
  });

  test("CLI diff does not write and excludes hook diffs", () => {
    const before = listFiles(project);
    const { code, stdout } = runCli(["diff", "--target", "codex", "--project-root", project]);
    expect(code).toBe(0);
    const after = listFiles(project);
    expect(after).toEqual(before);
    expect(stdout.includes("+++ b/AGENTS.md") || stdout.includes("AGENTS.md")).toBe(true);
    expect(stdout).not.toContain(".codex/hooks.json");
  });
});
