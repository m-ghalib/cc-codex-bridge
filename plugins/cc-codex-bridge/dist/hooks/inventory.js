import { buildLabel, disambiguateLabels } from "./labels.js";
import { entryId } from "./ids.js";
import { readHookSources } from "./sources.js";
export function buildInventory(opts) {
    const sources = readHookSources(opts.projectRoot, {
        userHome: opts.userHome ?? null,
        externalProjectPath: opts.externalProjectPath ?? null,
    });
    const draft = [];
    flatten(sources.user.hooks, "user", sources.user.path, draft);
    flatten(sources.project.hooks, "project", sources.project.path, draft);
    const baseLabels = draft.map((d) => buildLabel(d.scope, d.event, d.handler));
    const labels = disambiguateLabels(baseLabels);
    return draft.map((d, i) => ({ ...d, label: labels[i] }));
}
function flatten(hooks, scope, source, out) {
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
