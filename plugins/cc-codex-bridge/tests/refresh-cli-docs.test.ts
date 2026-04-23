import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  iterSources,
  refreshSources,
  shouldAttachGithubToken,
  slugFor,
} from "../src/refresh/refresh-cli-docs.js";
import { makeTmpDir } from "./helpers.js";

describe("refresh-cli-docs", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("source registry matches v1 bridge scope", () => {
    const sources = iterSources();
    expect(sources.map((s) => s.id)).toEqual(["claude_code", "codex"]);
    expect(sources.every((s) => s.doc_urls.length > 0)).toBe(true);
    for (const source of sources) {
      for (const url of source.doc_urls) {
        expect(url.startsWith("https://")).toBe(true);
      }
    }
    expect(sources.some((s) => s.id === "gemini")).toBe(false);
  });

  test("refresh writes only under platform-snapshots", async () => {
    const repoRoot = path.join(tmp, "repo");
    const snapshotRoot = path.join(repoRoot, "docs", "platform-snapshots");
    fs.mkdirSync(snapshotRoot, { recursive: true });

    const encoder = new TextEncoder();
    const fakeFetcher = async (url: string) => encoder.encode(`snapshot:${url}`);

    const rc = await refreshSources({
      snapshotRoot,
      repoRoot,
      fetcher: fakeFetcher,
    });
    expect(rc).toBe(0);

    const written: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) written.push(full);
      }
    }
    walk(repoRoot);
    written.sort();

    const expectedCount = iterSources().reduce((acc, s) => acc + s.doc_urls.length, 0);
    expect(written.length).toBe(expectedCount);
    expect(written.length).toBeGreaterThan(0);
    for (const p of written) {
      expect(p.startsWith(snapshotRoot)).toBe(true);
    }

    const sample = path.join(snapshotRoot, "codex", slugFor("https://developers.openai.com/codex/skills"));
    expect(fs.readFileSync(sample, "utf-8")).toBe("snapshot:https://developers.openai.com/codex/skills");
  });

  test.each([
    ["https://api.github.com/repos/m-ghalib/cc-codex-bridge", true],
    ["http://api.github.com/repos/m-ghalib/cc-codex-bridge", false],
    ["https://api.github.com.evil.example/repos/m-ghalib/cc-codex-bridge", false],
    ["https://evil.example/api.github.com", false],
    ["https://api.github.com@evil.example/repos/m-ghalib/cc-codex-bridge", false],
    ["not-a-url", false],
  ] as const)("should attach GitHub token only for exact https api host: %s", (url, expected) => {
    expect(shouldAttachGithubToken(url)).toBe(expected);
  });
});
