import type { HookHandler, HooksMap } from "../readers/hooks.js";
import { buildLabel, disambiguateLabels, type HookScope } from "./labels.js";
import { entryId } from "./ids.js";
import { readHookSources, type ReadHookSourcesOpts } from "./sources.js";

export interface InventoryEntry {
  id: string;
  scope: HookScope;
  source: string | null;
  event: string;
  matcher: string;
  handler: HookHandler;
  label: string;
}

export interface BuildInventoryOpts extends ReadHookSourcesOpts {
  projectRoot: string;
}

export function buildInventory(opts: BuildInventoryOpts): InventoryEntry[] {
  const sources = readHookSources(opts.projectRoot, {
    userHome: opts.userHome ?? null,
    externalProjectPath: opts.externalProjectPath ?? null,
  });

  const draft: Array<Omit<InventoryEntry, "label">> = [];
  flatten(sources.user.hooks, "user", sources.user.path, draft);
  flatten(sources.project.hooks, "project", sources.project.path, draft);

  const baseLabels = draft.map((d) => buildLabel(d.scope, d.event, d.handler));
  const labels = disambiguateLabels(baseLabels);

  return draft.map((d, i) => ({ ...d, label: labels[i]! }));
}

function flatten(
  hooks: HooksMap,
  scope: HookScope,
  source: string | null,
  out: Array<Omit<InventoryEntry, "label">>,
): void {
  for (const event of Object.keys(hooks).sort()) {
    const entries = hooks[event] ?? [];
    for (const entry of entries) {
      const matcher = entry.matcher ?? "";
      for (const handler of entry.hooks ?? []) {
        out.push({
          id: entryId(scope, event, matcher, handler),
          scope,
          source,
          event,
          matcher,
          handler,
        });
      }
    }
  }
}
