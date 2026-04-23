import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readContext } from "../../src/readers/context.js";
import { copyFixtureProject, makeTmpDir, writeFileSync } from "../helpers.js";

describe("readContext", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("reads main CLAUDE.md", () => {
    const project = copyFixtureProject(tmp);
    const ctx = readContext(project);
    expect(ctx.main).toContain("Test Project");
    expect(ctx.main).toContain("uv run pytest");
  });

  test("reads CLAUDE.local.md", () => {
    const project = copyFixtureProject(tmp);
    const ctx = readContext(project);
    expect(ctx.local).not.toBeNull();
    expect(ctx.local!).toContain("Debug mode is enabled");
    expect(ctx.local!).toContain("API key is in .env file");
  });

  test("rule with paths frontmatter", () => {
    const project = copyFixtureProject(tmp);
    const ctx = readContext(project);
    const byName = new Map(ctx.rules.map((r) => [r.filename, r]));
    const testing = byName.get("testing.md")!;
    expect(testing.paths).not.toBeNull();
    if (Array.isArray(testing.paths)) {
      expect(testing.paths).toContain("tests/**");
    } else {
      expect(testing.paths).toBe("tests/**");
    }
    expect(testing.content).toContain("pytest fixtures");
    expect(testing.content.trimStart().startsWith("---")).toBe(false);
  });

  test("rule without paths frontmatter", () => {
    const project = copyFixtureProject(tmp);
    const ctx = readContext(project);
    const general = ctx.rules.find((r) => r.filename === "general.md")!;
    expect(general.paths).toBeNull();
    expect(general.content).toContain("composition over inheritance");
  });

  test("resolves single import", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "# Root\n\nBefore.\n@imports/details.md\nAfter.\n");
    writeFileSync(path.join(tmp, "imports", "details.md"), "Inlined detail content.\n");
    const ctx = readContext(tmp);
    expect(ctx.main).toContain("Before.");
    expect(ctx.main).toContain("Inlined detail content.");
    expect(ctx.main).toContain("After.");
    expect(ctx.main).not.toContain("@imports/details.md");
  });

  test("nested imports resolved", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "@a.md\n");
    writeFileSync(path.join(tmp, "a.md"), "level-a\n@b.md\n");
    writeFileSync(path.join(tmp, "b.md"), "level-b\n");
    const ctx = readContext(tmp);
    expect(ctx.main).toContain("level-a");
    expect(ctx.main).toContain("level-b");
    expect(ctx.main).not.toContain("@a.md");
    expect(ctx.main).not.toContain("@b.md");
  });

  test("max import depth", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "@d1.md\n");
    for (let i = 1; i <= 5; i++) {
      writeFileSync(path.join(tmp, `d${i}.md`), `line-${i}\n@d${i + 1}.md\n`);
    }
    writeFileSync(path.join(tmp, "d6.md"), "line-6\n");
    const ctx = readContext(tmp);
    for (let i = 1; i <= 5; i++) expect(ctx.main).toContain(`line-${i}`);
    expect(ctx.main).not.toContain("line-6");
    expect(ctx.main).toContain("@d6.md");
  });

  test("circular imports do not loop", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "@a.md\n");
    writeFileSync(path.join(tmp, "a.md"), "a-content\n@b.md\n");
    writeFileSync(path.join(tmp, "b.md"), "b-content\n@a.md\n");
    const ctx = readContext(tmp);
    expect(ctx.main).toContain("a-content");
    expect(ctx.main).toContain("b-content");
  });

  test("missing CLAUDE.md returns empty main", () => {
    const ctx = readContext(tmp);
    expect(ctx.main).toBe("");
    expect(ctx.local).toBeNull();
    expect(ctx.rules).toEqual([]);
  });

  test("missing rules directory returns empty list", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "hello\n");
    const ctx = readContext(tmp);
    expect(ctx.main).toBe("hello\n");
    expect(ctx.rules).toEqual([]);
  });

  test("missing local file returns null", () => {
    writeFileSync(path.join(tmp, "CLAUDE.md"), "hello\n");
    expect(readContext(tmp).local).toBeNull();
  });

  test("rule without any frontmatter", () => {
    const rulesDir = path.join(tmp, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "plain.md"), "just a plain rule.\n", "utf-8");
    const ctx = readContext(tmp);
    expect(ctx.rules).toHaveLength(1);
    const rule = ctx.rules[0]!;
    expect(rule.paths).toBeNull();
    expect(rule.filename).toBe("plain.md");
    expect(rule.content).toBe("just a plain rule.\n");
  });
});
