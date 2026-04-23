import fs from "node:fs";
import path from "node:path";

export type EnvMap = Record<string, string>;

function loadEnv(filePath: string): EnvMap {
  if (!isFile(filePath)) return {};
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return {};
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isPlainObject(data)) return {};
  const env = (data as Record<string, unknown>).env;
  if (!isPlainObject(env)) return {};
  const out: EnvMap = {};
  for (const [k, v] of Object.entries(env)) {
    out[String(k)] = String(v);
  }
  return out;
}

export function readEnv(projectRoot: string): EnvMap {
  const claudeDir = path.join(projectRoot, ".claude");
  const project = loadEnv(path.join(claudeDir, "settings.json"));
  const local = loadEnv(path.join(claudeDir, "settings.local.json"));
  return { ...project, ...local };
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
