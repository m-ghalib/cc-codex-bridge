#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export interface DocSource {
  id: string;
  pinned_version: string;
  doc_urls: readonly string[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
// When compiled: dist/refresh-cli-docs.js -> repo root is two levels up from `dist/`.
// When run via bun: src/refresh/refresh-cli-docs.ts -> repo root is two levels up from `src/refresh/`.
export const REPO_ROOT_DEFAULT = path.resolve(HERE, "..", "..");
export const SNAPSHOT_ROOT_DEFAULT = path.join(REPO_ROOT_DEFAULT, "docs", "platform-snapshots");

export const USER_AGENT = "cc-bridge-refresh-cli-docs (+https://github.com/m-ghalib/cc-bridge)";
export const TIMEOUT_MS = 30_000;

export const SOURCE_REGISTRY: readonly DocSource[] = [
  {
    id: "claude_code",
    pinned_version: "2.1.108",
    doc_urls: [
      "https://registry.npmjs.org/@anthropic-ai/claude-code/latest",
      "https://docs.claude.com/en/docs/claude-code/skills.md",
      "https://docs.claude.com/en/docs/claude-code/hooks.md",
      "https://docs.claude.com/en/docs/claude-code/settings.md",
      "https://docs.claude.com/en/docs/claude-code/sub-agents.md",
      "https://docs.claude.com/en/docs/claude-code/slash-commands.md",
    ],
  },
  {
    id: "codex",
    pinned_version: "0.120.0",
    doc_urls: [
      "https://developers.openai.com/codex/skills",
      "https://developers.openai.com/codex/guides/agents-md",
      "https://developers.openai.com/codex/hooks",
      "https://developers.openai.com/codex/config-reference",
      "https://developers.openai.com/codex/concepts/sandboxing",
    ],
  },
];

export function iterSources(): readonly DocSource[] {
  return SOURCE_REGISTRY;
}

export function slugFor(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return sanitize(url) + ".txt";
  }
  const pathname = parsed.pathname.replace(/^\/+|\/+$/g, "") || "index";
  const raw = `${parsed.hostname}_${pathname}`;
  const slug = sanitize(raw);
  return hasSuffix(slug) ? slug : slug + ".txt";
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

// Python's pathlib.Path.suffix: everything after the last '.' in the final
// path component, empty if the component has no '.' or starts with '.'.
function hasSuffix(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;
  return dot < base.length - 1;
}

export function shouldAttachGithubToken(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === "api.github.com";
}

export async function fetchUrl(url: string): Promise<Uint8Array> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "*/*" };
  const token = process.env.GITHUB_TOKEN;
  if (token && shouldAttachGithubToken(url)) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} for ${url}`);
    }
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timeout);
  }
}

export function writeSnapshot(dest: string, body: Uint8Array): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, body);
}

interface Task {
  sourceId: string;
  url: string;
  dest: string;
}

function buildTasks(sources: readonly DocSource[], snapshotRoot: string): Task[] {
  const tasks: Task[] = [];
  for (const source of sources) {
    process.stdout.write(`[${source.id}] pinned=${source.pinned_version}\n`);
    const outDir = path.join(snapshotRoot, source.id);
    fs.mkdirSync(outDir, { recursive: true });
    for (const url of source.doc_urls) {
      tasks.push({ sourceId: source.id, url, dest: path.join(outDir, slugFor(url)) });
    }
  }
  return tasks;
}

export interface RefreshOptions {
  sources?: readonly DocSource[];
  snapshotRoot?: string;
  repoRoot?: string;
  fetcher?: (url: string) => Promise<Uint8Array>;
}

export async function refreshSources(opts: RefreshOptions = {}): Promise<number> {
  const sources = opts.sources ?? iterSources();
  const snapshotRoot = opts.snapshotRoot ?? SNAPSHOT_ROOT_DEFAULT;
  const repoRoot = opts.repoRoot ?? REPO_ROOT_DEFAULT;
  const fetcher = opts.fetcher ?? fetchUrl;

  const tasks = buildTasks(sources, snapshotRoot);
  if (tasks.length === 0) {
    process.stderr.write("[warn] no doc sources configured\n");
    return 0;
  }

  const maxWorkers = Math.min(8, tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;
      const task = tasks[index]!;
      try {
        const body = await fetcher(task.url);
        writeSnapshot(task.dest, body);
        process.stdout.write(`  wrote ${path.relative(repoRoot, task.dest)} (${body.length} bytes)\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`  [${task.sourceId}] [warn] ${task.url}: ${msg}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  return 0;
}

export async function main(): Promise<number> {
  return refreshSources();
}

function invokedDirectly(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return new URL(import.meta.url).pathname === path.resolve(invoked);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().then((code) => process.exit(code));
}
