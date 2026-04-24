import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_ROOT = path.join(HERE, "fixtures", "claude_config");

export function makeTmpDir(prefix = "cc-codex-bridge-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function copyTree(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcFull = path.join(src, entry.name);
    const dstFull = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcFull, dstFull);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcFull, dstFull);
    }
  }
}

export function copyFixtureProject(tmp: string, name = "project"): string {
  const dst = path.join(tmp, name);
  copyTree(FIXTURE_ROOT, dst);
  return dst;
}

export function writeSettings(dir: string, payload: unknown): void {
  const claudeDir = path.join(dir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, "settings.json"), JSON.stringify(payload), "utf-8");
}

export function writeFileSync(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

export function listFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  walk(root);
  out.sort();
  return out;
}
