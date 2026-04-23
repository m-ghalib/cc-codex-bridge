import fs from "node:fs";
import path from "node:path";

import { splitFrontmatter, type Frontmatter } from "../util.js";

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  when_to_use: string | null;
  frontmatter: Frontmatter;
  body: string;
  extra_files: string[];
}

function collectExtraFiles(skillDir: string): string[] {
  const extras: string[] = [];
  const entries = fs.readdirSync(skillDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === "SKILL.md") continue;
    const full = path.join(skillDir, entry.name);
    if (entry.isFile()) {
      extras.push(entry.name);
    } else if (entry.isDirectory()) {
      walk(full, skillDir, extras);
    }
  }
  return extras;
}

function walk(dir: string, root: string, out: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile()) {
      out.push(path.relative(root, full).split(path.sep).join("/"));
    } else if (entry.isDirectory()) {
      walk(full, root, out);
    }
  }
}

export function readSkills(projectRoot: string): SkillRecord[] {
  const skillsRoot = path.join(projectRoot, ".claude", "skills");
  if (!isDirectory(skillsRoot)) {
    return [];
  }

  const records: SkillRecord[] = [];
  const skillDirs = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const name of skillDirs) {
    const skillDir = path.join(skillsRoot, name);
    const skillMd = path.join(skillDir, "SKILL.md");
    if (!isFile(skillMd)) continue;

    const text = fs.readFileSync(skillMd, "utf-8");
    const [frontmatter, body] = splitFrontmatter(text);

    const nameField = typeof frontmatter.name === "string" && frontmatter.name.length > 0
      ? frontmatter.name
      : name;
    const description = typeof frontmatter.description === "string" ? frontmatter.description : "";
    const whenToUse = typeof frontmatter.when_to_use === "string" ? frontmatter.when_to_use : null;

    records.push({
      id: name,
      name: nameField,
      description,
      when_to_use: whenToUse,
      frontmatter,
      body,
      extra_files: collectExtraFiles(skillDir),
    });
  }

  return records;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
