import fs from "node:fs";
import path from "node:path";

import { splitFrontmatter } from "../util.js";

const MAX_IMPORT_DEPTH = 5;
const IMPORT_RE = /^@([^\s]+)\s*$/;

export interface ContextRule {
  content: string;
  paths: string | string[] | null;
  filename: string;
}

export interface ContextTree {
  main: string;
  local: string | null;
  rules: ContextRule[];
}

function resolveImports(filePath: string, depth: number, seen: Set<string>): string {
  let resolved: string;
  try {
    resolved = fs.realpathSync(filePath);
  } catch {
    return "";
  }

  if (!isFile(filePath)) return "";

  if (seen.has(resolved)) {
    return fs.readFileSync(filePath, "utf-8");
  }

  const text = fs.readFileSync(filePath, "utf-8");
  if (depth >= MAX_IMPORT_DEPTH) {
    return text;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(resolved);
  const baseDir = path.dirname(filePath);

  const outLines: string[] = [];
  const lines = text.split(/(?<=\n)/); // keep newlines
  for (const line of lines) {
    const stripped = line.replace(/\r?\n$/, "");
    const match = IMPORT_RE.exec(stripped);
    if (!match) {
      outLines.push(line);
      continue;
    }

    const importPath = path.resolve(baseDir, match[1]!);
    if (!isFile(importPath)) {
      outLines.push(line);
      continue;
    }

    let inlined = resolveImports(importPath, depth + 1, nextSeen);
    if (line.endsWith("\n") && !inlined.endsWith("\n")) {
      inlined += "\n";
    }
    outLines.push(inlined);
  }

  return outLines.join("");
}

function readRule(rulePath: string): ContextRule {
  const text = fs.readFileSync(rulePath, "utf-8");
  const [frontmatter, body] = splitFrontmatter(text);
  const paths = frontmatter.paths;
  let normalizedPaths: string | string[] | null = null;
  if (typeof paths === "string") {
    normalizedPaths = paths;
  } else if (Array.isArray(paths)) {
    normalizedPaths = paths.map((p) => String(p));
  }
  return {
    content: body,
    paths: normalizedPaths,
    filename: path.basename(rulePath),
  };
}

export function readContext(projectRoot: string): ContextTree {
  const mainPath = path.join(projectRoot, "CLAUDE.md");
  const main = isFile(mainPath) ? resolveImports(mainPath, 0, new Set()) : "";

  const localPath = path.join(projectRoot, "CLAUDE.local.md");
  const local = isFile(localPath) ? fs.readFileSync(localPath, "utf-8") : null;

  const rulesDir = path.join(projectRoot, ".claude", "rules");
  const rules: ContextRule[] = [];
  if (isDirectory(rulesDir)) {
    const files = fs
      .readdirSync(rulesDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort();
    for (const filename of files) {
      rules.push(readRule(path.join(rulesDir, filename)));
    }
  }

  return { main, local, rules };
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
