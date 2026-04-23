import fs from "node:fs";
import path from "node:path";

import type { HooksMap } from "../readers/hooks.js";

export interface ReadHookSourcesOpts {
  userHome?: string | null;
  externalProjectPath?: string | null;
}

export interface HookSources {
  user: { path: string | null; hooks: HooksMap };
  project: { path: string | null; hooks: HooksMap };
}

export function readHookSources(projectRoot: string, opts: ReadHookSourcesOpts = {}): HookSources {
  const projectSettingsRoot = opts.externalProjectPath ?? projectRoot;
  const projectSettingsPath = path.join(projectSettingsRoot, ".claude", "settings.json");
  const userSettingsPath = opts.userHome
    ? path.join(opts.userHome, ".claude", "settings.json")
    : null;

  return {
    user: {
      path: userSettingsPath && isFile(userSettingsPath) ? userSettingsPath : null,
      hooks: userSettingsPath ? loadHooks(userSettingsPath) : {},
    },
    project: {
      path: isFile(projectSettingsPath) ? projectSettingsPath : null,
      hooks: loadHooks(projectSettingsPath),
    },
  };
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
