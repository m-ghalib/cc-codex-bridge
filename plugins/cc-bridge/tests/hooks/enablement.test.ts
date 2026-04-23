import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parse as parseToml } from "smol-toml";

import { ensureCodexHooksEnabled } from "../../src/hooks/enablement.js";
import { makeTmpDir } from "../helpers.js";

describe("hooks/enablement", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("creates project config.toml with [features] codex_hooks = true", () => {
    const result = ensureCodexHooksEnabled("project", tmp);
    expect(result.changed).toBe(true);
    expect(result.path).toBe(path.join(tmp, ".codex", "config.toml"));
    const text = fs.readFileSync(result.path, "utf-8");
    const data = parseToml(text) as { features: { codex_hooks: boolean } };
    expect(data.features.codex_hooks).toBe(true);
  });

  test("preserves unrelated keys in existing project config.toml", () => {
    const codexDir = path.join(tmp, ".codex");
    fs.mkdirSync(codexDir, { recursive: true });
    const existing = `model = "gpt-5.4"\n\n[shell_environment_policy]\nset.FOO = "bar"\n`;
    fs.writeFileSync(path.join(codexDir, "config.toml"), existing, "utf-8");

    const result = ensureCodexHooksEnabled("project", tmp);
    expect(result.changed).toBe(true);
    const data = parseToml(fs.readFileSync(result.path, "utf-8")) as Record<string, unknown>;
    expect((data.features as Record<string, unknown>).codex_hooks).toBe(true);
    expect(data.model).toBe("gpt-5.4");
    expect(((data.shell_environment_policy as Record<string, unknown>).set as Record<string, string>).FOO).toBe(
      "bar",
    );
  });

  test("idempotent on second call", () => {
    const first = ensureCodexHooksEnabled("project", tmp);
    expect(first.changed).toBe(true);
    const second = ensureCodexHooksEnabled("project", tmp);
    expect(second.changed).toBe(false);
    expect(second.path).toBe(first.path);
  });

  test("user scope writes to userHome/.codex/config.toml", () => {
    const home = path.join(tmp, "home");
    fs.mkdirSync(home, { recursive: true });
    const result = ensureCodexHooksEnabled("user", tmp, home);
    expect(result.path).toBe(path.join(home, ".codex", "config.toml"));
    expect(result.changed).toBe(true);
    const data = parseToml(fs.readFileSync(result.path, "utf-8")) as { features: { codex_hooks: boolean } };
    expect(data.features.codex_hooks).toBe(true);
  });

  test("creates .codex directory when missing", () => {
    const result = ensureCodexHooksEnabled("project", tmp);
    expect(fs.existsSync(path.join(tmp, ".codex"))).toBe(true);
    expect(fs.existsSync(result.path)).toBe(true);
  });
});
