import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parse as parseToml } from "smol-toml";

import { translate, type OutputFile } from "../../src/adapters/codex.js";
import { readAgents } from "../../src/readers/agents.js";
import { readContext, type ContextTree } from "../../src/readers/context.js";
import { readEnv } from "../../src/readers/env.js";
import { readSkills, type SkillRecord } from "../../src/readers/skills.js";
import { splitFrontmatter } from "../../src/util.js";
import { FIXTURE_ROOT, makeTmpDir } from "../helpers.js";

function findOutput(outputs: OutputFile[], target: string): OutputFile {
  const match = outputs.find((o) => o.path === target);
  if (!match) {
    throw new Error(`No output at ${target}. Got: ${outputs.map((o) => o.path).join(", ")}`);
  }
  return match;
}

function runFixture(): OutputFile[] {
  const skills = readSkills(FIXTURE_ROOT);
  const agents = readAgents(FIXTURE_ROOT);
  const env = readEnv(FIXTURE_ROOT);
  const context = readContext(FIXTURE_ROOT);
  return translate(skills, agents, env, context, FIXTURE_ROOT);
}

function emptyContext(): ContextTree {
  return { main: "", local: null, rules: [] };
}

describe("Codex adapter", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("skill frontmatter keeps name and combines description", () => {
    const outputs = runFixture();
    const skillOut = findOutput(outputs, ".codex/skills/sample-skill/SKILL.md");
    const [fm, body] = splitFrontmatter(skillOut.content);
    expect(fm.name).toBe("sample-skill");
    const description = String(fm.description ?? "");
    expect(description).toContain("sample skill for testing");
    expect(description).toContain("When the user asks for a sample operation.");
    expect("allowed-tools" in fm).toBe(false);
    expect("model" in fm).toBe(false);
    expect("effort" in fm).toBe(false);
    expect("context" in fm).toBe(false);
    expect("paths" in fm).toBe(false);
    expect("shell" in fm).toBe(false);
    expect(body.trim().length).toBeGreaterThan(0);
  });

  test("skill body tool refs are rewritten", () => {
    const outputs = runFixture();
    const skillOut = findOutput(outputs, ".codex/skills/sample-skill/SKILL.md");
    const [, body] = splitFrontmatter(skillOut.content);
    expect(body).toContain("`apply_patch`");
    expect(body).toContain("`shell`");
    expect(body).toContain("`shell (cat)`");
    expect(body).toContain("`shell (curl)`");
    expect(body).not.toContain("`Edit`");
    expect(body).not.toContain("`Bash`");
    expect(body).not.toContain("`Read`");
    expect(body).not.toContain("`WebFetch`");
  });

  test("skill strips $ARGUMENTS placeholder", () => {
    const outputs = runFixture();
    const skillOut = findOutput(outputs, ".codex/skills/sample-skill/SKILL.md");
    expect(skillOut.content).not.toContain("$ARGUMENTS");
    expect(skillOut.warnings.some((w) => w.includes("placeholder") && w.includes("$ARGUMENTS"))).toBe(true);
  });

  test("skill strips inline exec block", () => {
    const skill: SkillRecord = {
      id: "exec-skill",
      name: "exec-skill",
      description: "desc",
      when_to_use: null,
      frontmatter: {},
      body: "Run this: !`ls -la` please.\n",
      extra_files: [],
    };
    const outputs = translate([skill], [], {}, emptyContext(), tmp);
    const out = findOutput(outputs, ".codex/skills/exec-skill/SKILL.md");
    expect(out.content).not.toContain("!`ls -la`");
    expect(out.warnings.some((w) => w.includes("exec block"))).toBe(true);
  });

  test("skill warns for every dropped field", () => {
    const outputs = runFixture();
    const skillOut = findOutput(outputs, ".codex/skills/sample-skill/SKILL.md");
    for (const dropped of ["allowed-tools", "model", "effort", "context", "paths", "shell"]) {
      expect(skillOut.warnings.some((w) => w.includes(dropped))).toBe(true);
    }
  });

  test("agent TOML output has expected fields", () => {
    const outputs = runFixture();
    const out = findOutput(outputs, ".codex/agents/reviewer.toml");
    const data = parseToml(out.content) as Record<string, unknown>;
    expect(data.name).toBe("reviewer");
    expect(String(data.description ?? "").startsWith("Reviews code")).toBe(true);
    expect(data.model).toBe("gpt-5.4");
    expect(data.model_reasoning_effort).toBe("high");
    expect(data.sandbox_mode).toBe("workspace-write");
    expect(String(data.developer_instructions ?? "").toLowerCase()).toContain("logic errors");
  });

  test("agent warns for dropped fields", () => {
    const outputs = runFixture();
    const out = findOutput(outputs, ".codex/agents/reviewer.toml");
    for (const dropped of ["tools", "disallowedTools", "maxTurns", "memory", "isolation", "color"]) {
      expect(out.warnings.some((w) => w.includes(dropped))).toBe(true);
    }
  });

  test("agent model/effort/permission mappings", () => {
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ model: "haiku" }, "model", "gpt-5.4-mini"],
      [{ model: "sonnet" }, "model", "gpt-5.4"],
      [{ effort: "max" }, "model_reasoning_effort", "xhigh"],
      [{ effort: "xhigh" }, "model_reasoning_effort", "xhigh"],
      [{ permissionMode: "default" }, "sandbox_mode", "read-only"],
      [{ permissionMode: "plan" }, "sandbox_mode", "read-only"],
      [{ permissionMode: "bypassPermissions" }, "sandbox_mode", "danger-full-access"],
      [{ permissionMode: "dontAsk" }, "sandbox_mode", "danger-full-access"],
    ];
    for (const [fm, key, expected] of cases) {
      const agent = { name: "a", frontmatter: fm, body: "prompt" };
      const outputs = translate([], [agent], {}, emptyContext(), tmp);
      const data = parseToml(findOutput(outputs, ".codex/agents/a.toml").content) as Record<string, unknown>;
      expect(data[key]).toBe(expected);
    }
  });

  test("translate omits .codex/hooks.json (hook plan owns it)", () => {
    const outputs = runFixture();
    expect(outputs.find((o) => o.path === ".codex/hooks.json")).toBeUndefined();
  });

  test("env translation format", () => {
    const outputs = runFixture();
    const out = findOutput(outputs, ".codex/env-bridge.toml");
    expect(out.content.startsWith("[shell_environment_policy]\n")).toBe(true);
    expect(out.content).toContain('set.DEBUG = "1"');
    expect(out.content).toContain('set.API_BASE_URL = "https://api.example.com"');
    expect(out.content).toContain('set.LOG_LEVEL = "debug"');
    const parsed = parseToml(out.content) as { shell_environment_policy: { set: Record<string, string> } };
    expect(parsed.shell_environment_policy.set.DEBUG).toBe("1");
    expect(out.warnings.some((w) => w.includes("active Codex config.toml"))).toBe(true);
  });

  test("context root AGENTS.md rewrites tool refs", () => {
    const outputs = runFixture();
    const root = findOutput(outputs, "AGENTS.md");
    expect(root.content).toContain("`apply_patch`");
    expect(root.content).toContain("`shell (curl)`");
    expect(root.content).toContain("`shell`");
    expect(root.content).toContain("`shell (cat)`");
    expect(root.content).not.toContain("`Edit`");
    expect(root.content).not.toContain("`WebFetch`");
  });

  test("context scoped rules placed in nested AGENTS.md", () => {
    const outputs = runFixture();
    const scoped = findOutput(outputs, "tests/AGENTS.md");
    expect(scoped.content).toContain("pytest fixtures");
    expect(scoped.content).toContain("tmp_path");
    const root = findOutput(outputs, "AGENTS.md");
    expect(root.content).not.toContain("pytest fixtures");
  });

  test("context file paths route to containing directory", () => {
    fs.writeFileSync(path.join(tmp, "README.md"), "# Root\n", "utf-8");
    const srcDir = path.join(tmp, "src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, "app.py"), "print('ok')\n", "utf-8");

    const outputs = translate(
      [],
      [],
      {},
      {
        main: "",
        local: null,
        rules: [
          { content: "Root file rule", paths: ["README.md"], filename: "readme.md" },
          { content: "Nested file rule", paths: ["src/app.py"], filename: "src-rule.md" },
        ],
      },
      tmp,
    );

    const root = findOutput(outputs, "AGENTS.md");
    const nested = findOutput(outputs, "src/AGENTS.md");
    expect(root.content).toContain("Root file rule");
    expect(nested.content).toContain("Nested file rule");
    expect(outputs.every((o) => o.path !== "README.md/AGENTS.md" && o.path !== "src/app.py/AGENTS.md")).toBe(true);
  });

  test("context unscoped rules appended to root", () => {
    const outputs = runFixture();
    const root = findOutput(outputs, "AGENTS.md");
    expect(root.content).toContain("Prefer composition over inheritance");
    expect(root.content).toContain("Rule from general.md");
  });

  test("context local override emitted", () => {
    const outputs = runFixture();
    const override = findOutput(outputs, "AGENTS.override.md");
    expect(override.content).toContain("Debug mode is enabled");
  });

  test("warnings populated across skill/agent", () => {
    const outputs = runFixture();
    const skill = findOutput(outputs, ".codex/skills/sample-skill/SKILL.md");
    const agent = findOutput(outputs, ".codex/agents/reviewer.toml");
    expect(skill.warnings.length).toBeGreaterThan(0);
    expect(agent.warnings.length).toBeGreaterThan(0);
  });

  test("empty inputs produce no outputs", () => {
    const outputs = translate([], [], {}, emptyContext(), tmp);
    expect(outputs).toEqual([]);
  });

  test("only-glob paths fall back to root", () => {
    const outputs = translate(
      [],
      [],
      {},
      {
        main: "",
        local: null,
        rules: [{ content: "rule body", paths: ["**"], filename: "wild.md" }],
      },
      tmp,
    );
    const root = findOutput(outputs, "AGENTS.md");
    expect(root.content).toContain("rule body");
  });
});
