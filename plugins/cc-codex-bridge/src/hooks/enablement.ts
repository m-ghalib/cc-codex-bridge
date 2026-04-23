import fs from "node:fs";
import path from "node:path";

import { parse as parseToml, stringify as tomlStringify } from "smol-toml";

import type { EnableScope } from "./plan.js";

export interface EnablementResult {
  path: string;
  changed: boolean;
}

export function ensureCodexHooksEnabled(scope: EnableScope, projectRoot: string, userHome?: string | null): EnablementResult {
  const targetPath = configPath(scope, projectRoot, userHome);

  let data: Record<string, unknown> = {};
  if (fs.existsSync(targetPath)) {
    const raw = fs.readFileSync(targetPath, "utf-8");
    try {
      const parsed = parseToml(raw);
      if (isPlainObject(parsed)) data = parsed as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Codex config at ${targetPath} is not valid TOML: ${(err as Error).message}`);
    }
  }

  const features = isPlainObject(data.features) ? (data.features as Record<string, unknown>) : {};
  const already = features.codex_hooks === true;
  if (already) {
    return { path: targetPath, changed: false };
  }

  features.codex_hooks = true;
  data.features = features;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const serialized = tomlStringify(data);
  fs.writeFileSync(targetPath, serialized.endsWith("\n") ? serialized : serialized + "\n", "utf-8");
  return { path: targetPath, changed: true };
}

function configPath(scope: EnableScope, projectRoot: string, userHome?: string | null): string {
  if (scope === "project") return path.join(projectRoot, ".codex", "config.toml");
  const home = userHome ?? process.env.HOME ?? "";
  if (!home) {
    throw new Error("ensureCodexHooksEnabled: user scope requires HOME or userHome");
  }
  return path.join(home, ".codex", "config.toml");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
