import fs from "node:fs";
import path from "node:path";
import { HOOK_EVENTS_MAP, HOOK_HANDLER_TYPES_MAP } from "../mappings.js";
import { ensureCodexHooksEnabled } from "./enablement.js";
import { stableStringify } from "./ids.js";
import { HookPlanError, validateAgainstInventory, } from "./plan.js";
export const HOOKS_OUTPUT_PATH = ".codex/hooks.json";
export function applyHookPlan(opts) {
    const selected = validateAgainstInventory(opts.plan, opts.inventory);
    const warnings = [];
    const translated = [];
    for (const entry of selected) {
        const result = translateEntry(entry.event, entry.matcher, entry.handler);
        warnings.push(...result.warnings);
        if (result.handler) {
            translated.push({
                codexEvent: result.codexEvent,
                matcher: entry.matcher,
                handler: result.handler,
                warnings: result.warnings,
            });
        }
    }
    const hooksPath = path.join(opts.projectRoot, HOOKS_OUTPUT_PATH);
    // For merge and create we need to inspect any pre-existing file. If it
    // exists but is unreadable or not valid JSON, refuse rather than silently
    // overwriting the user's file.
    const existingNeeded = opts.plan.write_mode === "merge" || opts.plan.write_mode === "create";
    const existing = existingNeeded ? readExistingHooks(hooksPath) : null;
    let composed;
    switch (opts.plan.write_mode) {
        case "merge":
            composed = mergeHooks(existing, translated);
            break;
        case "replace":
            composed = composeFromTranslated(translated);
            break;
        case "create":
            if (existing && Object.keys(existing).length > 0) {
                warnings.push(`Hook plan write_mode "create": ${HOOKS_OUTPUT_PATH} already has entries; existing content will be replaced`);
            }
            composed = composeFromTranslated(translated);
            break;
    }
    if (opts.plan.enable_hooks && opts.plan.enable_scope) {
        if (opts.dryRun) {
            warnings.push(`Codex hooks enablement deferred (dry run): would set [features] codex_hooks = true in ${enablementHint(opts.plan.enable_scope, opts.projectRoot, opts.userHome)}`);
        }
        else {
            const result = ensureCodexHooksEnabled(opts.plan.enable_scope, opts.projectRoot, opts.userHome ?? null);
            warnings.push(formatEnablementWarning(result, opts.plan.enable_scope));
        }
    }
    const content = JSON.stringify({ hooks: composed }, null, 2) + "\n";
    return [{ path: HOOKS_OUTPUT_PATH, content, warnings }];
}
function translateEntry(event, _matcher, handler) {
    const warnings = [];
    const eventCfg = HOOK_EVENTS_MAP[event];
    const codexEvent = eventCfg && typeof eventCfg === "object" ? eventCfg.codex_event : null;
    if (!codexEvent) {
        warnings.push(`Hook event '${event}' has no Codex equivalent; skipped`);
        return { codexEvent: null, handler: null, warnings };
    }
    const htype = handler.type;
    const mappedType = typeof htype === "string" ? HOOK_HANDLER_TYPES_MAP[htype] : null;
    if (!mappedType) {
        warnings.push(`Hook event '${event}': handler type '${String(htype)}' not supported in Codex; skipped`);
        return { codexEvent, handler: null, warnings };
    }
    const newHandler = { type: mappedType };
    for (const [k, v] of Object.entries(handler)) {
        if (k === "type")
            continue;
        newHandler[k] = v;
    }
    return { codexEvent, handler: newHandler, warnings };
}
function readExistingHooks(hooksPath) {
    if (!fs.existsSync(hooksPath))
        return null;
    let raw;
    try {
        raw = fs.readFileSync(hooksPath, "utf-8");
    }
    catch (err) {
        throw new HookPlanError(`Existing ${HOOKS_OUTPUT_PATH} is unreadable: ${err.message}. ` +
            `Refusing to overwrite — resolve the file manually before re-running sync.`);
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch (err) {
        throw new HookPlanError(`Existing ${HOOKS_OUTPUT_PATH} is not valid JSON (${err.message}). ` +
            `Refusing to merge or recreate — fix the file manually or delete it before re-running sync.`);
    }
    if (!isPlainObject(data)) {
        throw new HookPlanError(`Existing ${HOOKS_OUTPUT_PATH} is not a JSON object. ` +
            `Refusing to merge or recreate — fix the file manually or delete it before re-running sync.`);
    }
    const hooks = data.hooks;
    if (!isPlainObject(hooks))
        return {};
    const out = {};
    for (const [event, entries] of Object.entries(hooks)) {
        if (!Array.isArray(entries))
            continue;
        const list = [];
        for (const entry of entries) {
            if (!isPlainObject(entry))
                continue;
            const matcher = typeof entry.matcher === "string"
                ? entry.matcher
                : "";
            const handlers = entry.hooks;
            if (!Array.isArray(handlers))
                continue;
            const filteredHandlers = [];
            for (const h of handlers) {
                if (isPlainObject(h))
                    filteredHandlers.push(h);
            }
            list.push({ matcher, hooks: filteredHandlers });
        }
        out[event] = list;
    }
    return out;
}
function composeFromTranslated(translated) {
    const out = {};
    for (const t of translated) {
        const list = (out[t.codexEvent] ??= []);
        let bucket = list.find((e) => e.matcher === t.matcher);
        if (!bucket) {
            bucket = { matcher: t.matcher, hooks: [] };
            list.push(bucket);
        }
        if (!bucket.hooks.some((h) => stableStringify(h) === stableStringify(t.handler))) {
            bucket.hooks.push(t.handler);
        }
    }
    return out;
}
function mergeHooks(existing, translated) {
    const out = {};
    if (existing) {
        for (const [event, entries] of Object.entries(existing)) {
            out[event] = entries.map((e) => ({ matcher: e.matcher, hooks: [...e.hooks] }));
        }
    }
    for (const t of translated) {
        const list = (out[t.codexEvent] ??= []);
        let bucket = list.find((e) => e.matcher === t.matcher);
        if (!bucket) {
            bucket = { matcher: t.matcher, hooks: [] };
            list.push(bucket);
        }
        if (!bucket.hooks.some((h) => stableStringify(h) === stableStringify(t.handler))) {
            bucket.hooks.push(t.handler);
        }
    }
    return out;
}
function enablementHint(scope, projectRoot, userHome) {
    if (scope === "project")
        return path.join(projectRoot, ".codex", "config.toml");
    const home = userHome ?? process.env.HOME ?? "~";
    return path.join(home, ".codex", "config.toml");
}
function formatEnablementWarning(result, scope) {
    if (result.changed) {
        return `Codex hooks enabled (${scope} scope): wrote [features] codex_hooks = true to ${result.path}`;
    }
    return `Codex hooks already enabled (${scope} scope) at ${result.path}`;
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
