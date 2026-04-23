import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readEnv } from "../../src/readers/env.js";
import { copyFixtureProject, makeTmpDir, writeFileSync } from "../helpers.js";

describe("readEnv", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("reads project env from fixture", () => {
    const project = copyFixtureProject(tmp);
    expect(readEnv(project)).toEqual({
      DEBUG: "1",
      API_BASE_URL: "https://api.example.com",
      LOG_LEVEL: "debug",
    });
  });

  test("local overrides project for same key", () => {
    const project = path.join(tmp, "project");
    writeFileSync(
      path.join(project, ".claude", "settings.json"),
      JSON.stringify({ env: { LOG_LEVEL: "debug", DEBUG: "1" } }),
    );
    writeFileSync(
      path.join(project, ".claude", "settings.local.json"),
      JSON.stringify({ env: { LOG_LEVEL: "info" } }),
    );
    expect(readEnv(project)).toEqual({ LOG_LEVEL: "info", DEBUG: "1" });
  });

  test("merges project and local keys", () => {
    const project = path.join(tmp, "project");
    writeFileSync(
      path.join(project, ".claude", "settings.json"),
      JSON.stringify({ env: { SHARED: "project-value", PROJECT_ONLY: "p" } }),
    );
    writeFileSync(
      path.join(project, ".claude", "settings.local.json"),
      JSON.stringify({ env: { SHARED: "local-value", LOCAL_ONLY: "l" } }),
    );
    expect(readEnv(project)).toEqual({
      SHARED: "local-value",
      PROJECT_ONLY: "p",
      LOCAL_ONLY: "l",
    });
  });

  test("missing settings returns empty", () => {
    const project = path.join(tmp, "project");
    fs.mkdirSync(project);
    expect(readEnv(project)).toEqual({});
  });

  test("settings without env key returns empty", () => {
    const project = path.join(tmp, "project");
    writeFileSync(
      path.join(project, ".claude", "settings.json"),
      JSON.stringify({ hooks: { PreToolUse: [] } }),
    );
    expect(readEnv(project)).toEqual({});
  });
});
