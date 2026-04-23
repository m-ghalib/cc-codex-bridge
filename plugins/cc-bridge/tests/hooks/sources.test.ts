import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readHookSources } from "../../src/hooks/sources.js";
import { makeTmpDir, writeSettings } from "../helpers.js";

describe("hooks/sources", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("returns user and project hooks separately", () => {
    const project = path.join(tmp, "project");
    const home = path.join(tmp, "home");
    fs.mkdirSync(project);
    fs.mkdirSync(home);
    writeSettings(project, {
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "p.sh" }] }] },
    });
    writeSettings(home, {
      hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: "u.sh" }] }] },
    });
    const sources = readHookSources(project, { userHome: home });
    expect(Object.keys(sources.project.hooks)).toEqual(["PreToolUse"]);
    expect(Object.keys(sources.user.hooks)).toEqual(["SessionStart"]);
    expect(sources.project.path).toBe(path.join(project, ".claude", "settings.json"));
    expect(sources.user.path).toBe(path.join(home, ".claude", "settings.json"));
  });

  test("external project path is honoured", () => {
    const projectA = path.join(tmp, "a");
    const projectB = path.join(tmp, "b");
    fs.mkdirSync(projectA);
    fs.mkdirSync(projectB);
    writeSettings(projectA, {
      hooks: { Stop: [{ matcher: "", hooks: [{ type: "command", command: "a.sh" }] }] },
    });
    writeSettings(projectB, {
      hooks: { Stop: [{ matcher: "", hooks: [{ type: "command", command: "b.sh" }] }] },
    });
    const sources = readHookSources(projectA, { externalProjectPath: projectB });
    const handlers = sources.project.hooks.Stop![0]!.hooks;
    expect((handlers[0] as unknown as { command: string }).command).toBe("b.sh");
  });

  test("missing sources yield empty maps and null paths", () => {
    const project = path.join(tmp, "empty");
    fs.mkdirSync(project);
    const sources = readHookSources(project, { userHome: path.join(tmp, "no-home") });
    expect(sources.user.hooks).toEqual({});
    expect(sources.user.path).toBeNull();
    expect(sources.project.hooks).toEqual({});
    expect(sources.project.path).toBeNull();
  });
});
