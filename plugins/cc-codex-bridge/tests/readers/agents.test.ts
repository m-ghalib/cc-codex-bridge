import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readAgents } from "../../src/readers/agents.js";
import { FIXTURE_ROOT, makeTmpDir, writeFileSync } from "../helpers.js";

const FIXTURE_AGENT = path.join(FIXTURE_ROOT, ".claude", "agents", "reviewer.md");

function agentsDir(root: string): string {
  const p = path.join(root, ".claude", "agents");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

describe("readAgents", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("parses full frontmatter", () => {
    fs.copyFileSync(FIXTURE_AGENT, path.join(agentsDir(tmp), "reviewer.md"));
    const agents = readAgents(tmp);
    expect(agents).toHaveLength(1);
    const agent = agents[0]!;
    expect(agent.name).toBe("reviewer");
    const fm = agent.frontmatter;
    expect(fm.name).toBe("reviewer");
    expect(fm.description).toBe("Reviews code for quality issues and suggests improvements.");
    expect(fm.model).toBe("opus");
    expect(fm.effort).toBe("high");
    expect(fm.permissionMode).toBe("acceptEdits");
    expect(fm.tools).toEqual(["Read", "Grep", "Glob", "Bash"]);
    expect(fm.disallowedTools).toEqual(["Write"]);
    expect(fm.maxTurns).toBe(10);
    expect(fm.memory).toBe("project");
    expect(fm.isolation).toBe("worktree");
    expect(fm.color).toBe("blue");
  });

  test("body is system prompt", () => {
    fs.copyFileSync(FIXTURE_AGENT, path.join(agentsDir(tmp), "reviewer.md"));
    const body = readAgents(tmp)[0]!.body;
    expect(body.startsWith("You are a code reviewer.")).toBe(true);
    expect(body).toContain("Logic errors and bugs");
    expect(body).toContain("specific line numbers");
    expect(body.split("\n")[0]).not.toBe("---");
  });

  test("minimal frontmatter", () => {
    writeFileSync(
      path.join(agentsDir(tmp), "tiny.md"),
      "---\nname: tiny\ndescription: A tiny agent.\n---\nHello, I am tiny.\n",
    );
    const agents = readAgents(tmp);
    expect(agents).toHaveLength(1);
    expect(agents[0]!.name).toBe("tiny");
    expect(agents[0]!.frontmatter).toEqual({ name: "tiny", description: "A tiny agent." });
    expect(agents[0]!.body.trim()).toBe("Hello, I am tiny.");
  });

  test("missing agents directory yields empty list", () => {
    expect(readAgents(tmp)).toEqual([]);
  });

  test("name falls back to filename", () => {
    writeFileSync(
      path.join(agentsDir(tmp), "unnamed.md"),
      "---\ndescription: No name here.\n---\nbody text\n",
    );
    const agents = readAgents(tmp);
    expect(agents[0]!.name).toBe("unnamed");
    expect(agents[0]!.frontmatter).toEqual({ description: "No name here." });
    expect(agents[0]!.body.trim()).toBe("body text");
  });

  test("no frontmatter", () => {
    writeFileSync(path.join(agentsDir(tmp), "plain.md"), "Just a body, no frontmatter.\n");
    const agents = readAgents(tmp);
    expect(agents[0]!.name).toBe("plain");
    expect(agents[0]!.frontmatter).toEqual({});
    expect(agents[0]!.body).toBe("Just a body, no frontmatter.\n");
  });

  test("empty frontmatter", () => {
    writeFileSync(path.join(agentsDir(tmp), "blank.md"), "---\n---\nbody only\n");
    const agents = readAgents(tmp);
    expect(agents[0]!.name).toBe("blank");
    expect(agents[0]!.frontmatter).toEqual({});
    expect(agents[0]!.body.trim()).toBe("body only");
  });

  test.each([[2], [3]])("multiple agents sorted (%i)", (count) => {
    const dir = agentsDir(tmp);
    const names = Array.from({ length: count }, (_, i) => `agent_${i}`);
    for (const name of [...names].reverse()) {
      writeFileSync(path.join(dir, `${name}.md`), `---\nname: ${name}\n---\nbody of ${name}\n`);
    }
    const agents = readAgents(tmp);
    expect(agents.map((a) => a.name)).toEqual(names);
  });
});
