import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readHooks } from "../../src/readers/hooks.js";
import { FIXTURE_ROOT, copyTree, makeTmpDir, writeSettings } from "../helpers.js";

describe("readHooks", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("reads project hooks from fixture", () => {
    copyTree(path.join(FIXTURE_ROOT, ".claude"), path.join(tmp, ".claude"));
    const hooks = readHooks(tmp);
    expect(new Set(Object.keys(hooks))).toEqual(
      new Set(["PreToolUse", "PostToolUse", "SessionStart", "SubagentStop", "Stop"]),
    );
    const pre = hooks.PreToolUse!;
    expect(pre.length).toBe(1);
    expect(pre[0]!.matcher).toBe("Bash(rm *)");
    const preHandler = pre[0]!.hooks[0]! as unknown as Record<string, unknown>;
    expect(preHandler.type).toBe("command");
    expect(String(preHandler.command).startsWith("echo 'Destructive")).toBe(true);
    expect(preHandler.timeout).toBe(10);
  });

  test("missing settings returns empty", () => {
    expect(readHooks(tmp)).toEqual({});
  });

  test("settings without hooks key returns empty", () => {
    writeSettings(tmp, { env: { FOO: "bar" } });
    expect(readHooks(tmp)).toEqual({});
  });

  test("malformed json returns empty", () => {
    const claudeDir = path.join(tmp, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, "settings.json"), "{not json", "utf-8");
    expect(readHooks(tmp)).toEqual({});
  });

  test("hook entry preserves all fields", () => {
    copyTree(path.join(FIXTURE_ROOT, ".claude"), path.join(tmp, ".claude"));
    const hooks = readHooks(tmp);
    const httpEntry = hooks.SubagentStop![0]!.hooks[0];
    expect(httpEntry).toEqual({
      type: "http",
      url: "https://hooks.example.com/subagent-done",
      timeout: 30,
    });
    const promptEntry = hooks.Stop![0]!.hooks[0];
    expect(promptEntry).toEqual({
      type: "prompt",
      prompt: "Summarize what was accomplished in this session.",
    });
    const postEntry = hooks.PostToolUse![0]!;
    expect(postEntry.matcher).toBe("Bash");
    expect(postEntry.hooks[0]).toEqual({ type: "command", command: "scripts/log-tool-use.sh" });
  });

  test("project-only signature reads only the project tree", () => {
    writeSettings(tmp, {
      hooks: { Stop: [{ matcher: "", hooks: [{ type: "prompt", prompt: "done" }] }] },
    });
    const hooks = readHooks(tmp);
    expect(Object.keys(hooks)).toEqual(["Stop"]);
  });
});
