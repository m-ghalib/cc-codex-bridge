import fs from "node:fs";
import path from "node:path";

export type HookHandler = { type: string; [key: string]: unknown };
export type HookEntry = { matcher: string; hooks: HookHandler[] };
export type HooksMap = Record<string, HookEntry[]>;

export function readHooks(projectRoot: string): HooksMap {
  return loadHooks(path.join(projectRoot, ".claude", "settings.json"));
}

function loadHooks(settingsPath: string): HooksMap {
  if (!isFile(settingsPath)) return {};
  let raw: string;
  try {
    raw = fs.readFileSync(settingsPath, "utf-8");
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
  const hooks = (data as Record<string, unknown>).hooks;
  if (!isPlainObject(hooks)) return {};
  return hooks as HooksMap;
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
