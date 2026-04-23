import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readSkills } from "../../src/readers/skills.js";
import { FIXTURE_ROOT, makeTmpDir, writeFileSync } from "../helpers.js";

function dedent(s: string): string {
  const lines = s.replace(/^\n/, "").split("\n");
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => /^\s*/.exec(l)![0]!.length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

describe("readSkills", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("full frontmatter is parsed", () => {
    writeFileSync(
      path.join(tmp, ".claude/skills/full-skill/SKILL.md"),
      dedent(`
        ---
        name: full-skill
        description: A skill with complete frontmatter.
        when_to_use: When the user asks for the full treatment.
        allowed-tools:
          - Bash
          - Read
        model: sonnet
        effort: high
        ---

        # Full Skill

        Body content here.
      `),
    );

    const skills = readSkills(tmp);
    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.id).toBe("full-skill");
    expect(skill.name).toBe("full-skill");
    expect(skill.description).toBe("A skill with complete frontmatter.");
    expect(skill.when_to_use).toBe("When the user asks for the full treatment.");
    expect(skill.frontmatter["allowed-tools"]).toEqual(["Bash", "Read"]);
    expect(skill.frontmatter.model).toBe("sonnet");
    expect(skill.frontmatter.effort).toBe("high");
    expect(skill.body).toContain("# Full Skill");
    expect(skill.body).toContain("Body content here.");
    expect(skill.extra_files).toEqual([]);
  });

  test("minimal frontmatter", () => {
    writeFileSync(
      path.join(tmp, ".claude/skills/min-skill/SKILL.md"),
      dedent(`
        ---
        name: min-skill
        ---

        Just a body.
      `),
    );
    const skills = readSkills(tmp);
    const skill = skills[0]!;
    expect(skill.name).toBe("min-skill");
    expect(skill.description).toBe("");
    expect(skill.when_to_use).toBeNull();
    expect(skill.frontmatter).toEqual({ name: "min-skill" });
    expect(skill.body).toContain("Just a body.");
  });

  test("skill directory without SKILL.md is skipped", () => {
    writeFileSync(
      path.join(tmp, ".claude/skills/valid/SKILL.md"),
      "---\nname: valid\n---\n\nbody\n",
    );
    const orphan = path.join(tmp, ".claude/skills/orphan");
    fs.mkdirSync(orphan, { recursive: true });
    writeFileSync(path.join(orphan, "README.md"), "no skill here");
    const skills = readSkills(tmp);
    expect(skills.map((s) => s.id)).toEqual(["valid"]);
  });

  test("collects auxiliary files recursively", () => {
    const base = path.join(tmp, ".claude/skills/aux-skill");
    writeFileSync(path.join(base, "SKILL.md"), "---\nname: aux-skill\n---\n\nbody\n");
    writeFileSync(path.join(base, "scripts/run.sh"), "#!/bin/sh\necho hi\n");
    writeFileSync(path.join(base, "scripts/helpers/util.py"), "x = 1\n");
    writeFileSync(path.join(base, "references/notes.md"), "# notes\n");
    writeFileSync(path.join(base, "reference.md"), "top-level reference\n");

    const skills = readSkills(tmp);
    expect(skills).toHaveLength(1);
    const extras = new Set(skills[0]!.extra_files);
    expect(extras).toEqual(
      new Set(["reference.md", "references/notes.md", "scripts/run.sh", "scripts/helpers/util.py"]),
    );
  });

  test("returns empty when skills dir missing", () => {
    expect(readSkills(tmp)).toEqual([]);
    fs.mkdirSync(path.join(tmp, ".claude"));
    expect(readSkills(tmp)).toEqual([]);
  });

  test("name falls back to directory name", () => {
    writeFileSync(
      path.join(tmp, ".claude/skills/dir-named-skill/SKILL.md"),
      dedent(`
        ---
        description: No name field here.
        ---

        body
      `),
    );
    const skills = readSkills(tmp);
    expect(skills[0]!.id).toBe("dir-named-skill");
    expect(skills[0]!.name).toBe("dir-named-skill");
    expect(skills[0]!.description).toBe("No name field here.");
  });

  test("empty frontmatter block", () => {
    writeFileSync(
      path.join(tmp, ".claude/skills/empty-fm/SKILL.md"),
      dedent(`
        ---
        ---

        Just body, no fields.
      `),
    );
    const skills = readSkills(tmp);
    const skill = skills[0]!;
    expect(skill.frontmatter).toEqual({});
    expect(skill.name).toBe("empty-fm");
    expect(skill.description).toBe("");
    expect(skill.when_to_use).toBeNull();
    expect(skill.body).toContain("Just body, no fields.");
  });

  test("fixture sample-skill parses cleanly", () => {
    const skills = readSkills(FIXTURE_ROOT);
    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.id).toBe("sample-skill");
    expect(skill.name).toBe("sample-skill");
    expect(skill.frontmatter["allowed-tools"]).toEqual(["Bash", "Read", "Edit"]);
    expect(skill.frontmatter.model).toBe("sonnet");
    expect(skill.when_to_use).toBe("When the user asks for a sample operation.");
    expect(skill.body).toContain("# Sample Skill");
  });
});
