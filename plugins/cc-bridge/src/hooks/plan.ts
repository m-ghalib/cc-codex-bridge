import fs from "node:fs";

import type { InventoryEntry } from "./inventory.js";

export type WriteMode = "merge" | "replace" | "create";
export type SourceScope = "user" | "project";
export type EnableScope = "project" | "user";

export interface HookPlan {
  source_scope: SourceScope;
  project_source_path?: string;
  selected_entry_ids: string[];
  write_mode: WriteMode;
  enable_hooks: boolean;
  enable_scope: EnableScope | null;
}

export class HookPlanError extends Error {}

export function parseHookPlan(planPath: string): HookPlan {
  let raw: string;
  try {
    raw = fs.readFileSync(planPath, "utf-8");
  } catch (err) {
    throw new HookPlanError(`hook plan not readable at ${planPath}: ${(err as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new HookPlanError(`hook plan is not valid JSON: ${(err as Error).message}`);
  }
  return validateShape(data, planPath);
}

function validateShape(data: unknown, source: string): HookPlan {
  if (!isPlainObject(data)) {
    throw new HookPlanError(`hook plan ${source} must be a JSON object`);
  }
  const obj = data as Record<string, unknown>;

  const sourceScope = obj.source_scope;
  if (sourceScope !== "user" && sourceScope !== "project") {
    throw new HookPlanError(`hook plan source_scope must be "user" or "project"`);
  }

  let projectSourcePath: string | undefined;
  if (obj.project_source_path !== undefined && obj.project_source_path !== null) {
    if (typeof obj.project_source_path !== "string" || obj.project_source_path.length === 0) {
      throw new HookPlanError(`hook plan project_source_path must be a non-empty string when present`);
    }
    projectSourcePath = obj.project_source_path;
  }

  const ids = obj.selected_entry_ids;
  if (!Array.isArray(ids) || !ids.every((v) => typeof v === "string" && v.length > 0)) {
    throw new HookPlanError(`hook plan selected_entry_ids must be a non-empty list of strings`);
  }

  const writeMode = obj.write_mode;
  if (writeMode !== "merge" && writeMode !== "replace" && writeMode !== "create") {
    throw new HookPlanError(`hook plan write_mode must be "merge", "replace", or "create"`);
  }

  const enableHooks = obj.enable_hooks;
  if (typeof enableHooks !== "boolean") {
    throw new HookPlanError(`hook plan enable_hooks must be boolean`);
  }

  let enableScope: EnableScope | null = null;
  if (obj.enable_scope === undefined || obj.enable_scope === null) {
    enableScope = null;
  } else if (obj.enable_scope === "project" || obj.enable_scope === "user") {
    enableScope = obj.enable_scope;
  } else {
    throw new HookPlanError(`hook plan enable_scope must be "project", "user", or null`);
  }

  if (enableHooks && enableScope === null) {
    throw new HookPlanError(`hook plan: enable_hooks=true requires enable_scope to be "project" or "user"`);
  }

  const plan: HookPlan = {
    source_scope: sourceScope,
    selected_entry_ids: ids as string[],
    write_mode: writeMode,
    enable_hooks: enableHooks,
    enable_scope: enableScope,
  };
  if (projectSourcePath !== undefined) plan.project_source_path = projectSourcePath;
  return plan;
}

export function validateAgainstInventory(plan: HookPlan, inventory: InventoryEntry[]): InventoryEntry[] {
  const byId = new Map<string, InventoryEntry>();
  for (const entry of inventory) {
    if (entry.scope === plan.source_scope) byId.set(entry.id, entry);
  }
  const selected: InventoryEntry[] = [];
  const missing: string[] = [];
  for (const id of plan.selected_entry_ids) {
    const match = byId.get(id);
    if (!match) {
      missing.push(id);
    } else {
      selected.push(match);
    }
  }
  if (missing.length > 0) {
    throw new HookPlanError(
      `hook plan references unknown entry IDs in scope "${plan.source_scope}": ${missing.join(", ")}. ` +
        `Re-run cc-bridge hooks-inventory to regenerate IDs.`,
    );
  }
  return selected;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
