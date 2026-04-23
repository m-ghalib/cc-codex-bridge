#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { translate } from "./adapters/codex.js";
import { readAgents } from "./readers/agents.js";
import { readContext } from "./readers/context.js";
import { readEnv } from "./readers/env.js";
import { readHooks } from "./readers/hooks.js";
import { readSkills } from "./readers/skills.js";
import { unifiedDiff } from "./core/diff.js";
import { applyHookPlan, HOOKS_OUTPUT_PATH } from "./hooks/apply.js";
import { buildInventory } from "./hooks/inventory.js";
import { HookPlanError, parseHookPlan } from "./hooks/plan.js";
const SUPPORTED_TARGETS = new Set(["codex"]);
const PREFLIGHT_REQUIRED_MARKER = "hook preflight required";
export const PREFLIGHT_REQUIRED_WARNING = `Hook entries detected on disk; ${PREFLIGHT_REQUIRED_MARKER}: run cc-codex-sync preflight to translate them`;
const GAP_MARKERS = ["skipped", "no Codex equivalent"];
const ACTION_MARKERS = [
    "Enable Codex hooks",
    "extra file to copy",
    "substitute manually",
    "run command manually",
    "merged into an active Codex config.toml",
    PREFLIGHT_REQUIRED_MARKER,
];
const ORPHAN_SCAN_SKIP_DIRS = new Set([".claude", ".codex", ".git", ".jj"]);
function runReaders(projectRoot) {
    return {
        skills: readSkills(projectRoot),
        agents: readAgents(projectRoot),
        hooks: readHooks(projectRoot),
        env: readEnv(projectRoot),
        context: readContext(projectRoot),
    };
}
function runTranslate(target, inputs, projectRoot) {
    if (target !== "codex") {
        throw new Error(`Unsupported target: '${target}'`);
    }
    return translate(inputs.skills, inputs.agents, inputs.env, inputs.context, projectRoot);
}
function classifyWarnings(warnings) {
    const gaps = warnings.filter((w) => GAP_MARKERS.some((m) => w.includes(m)));
    const actions = warnings.filter((w) => ACTION_MARKERS.some((m) => w.includes(m)));
    return { gaps, actions };
}
function collectExtraFileCopies(skills, projectRoot) {
    const copies = [];
    const skillsRoot = path.join(projectRoot, ".claude", "skills");
    for (const skill of skills) {
        const srcDir = path.join(skillsRoot, skill.id);
        for (const extra of skill.extra_files ?? []) {
            copies.push({
                src: path.join(srcDir, extra),
                dst: path.join(".codex/skills", skill.id, extra),
            });
        }
    }
    return copies;
}
function readOrNull(p) {
    try {
        const stat = fs.statSync(p);
        if (!stat.isFile())
            return null;
        return fs.readFileSync(p, "utf-8");
    }
    catch {
        return null;
    }
}
function writeOutput(projectRoot, relPath, content) {
    const dst = path.join(projectRoot, relPath);
    const action = fs.existsSync(dst) ? "updated" : "created";
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content, "utf-8");
    return action;
}
function copyExtra(projectRoot, src, relDst) {
    const dst = path.join(projectRoot, relDst);
    const action = fs.existsSync(dst) ? "updated" : "created";
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return action;
}
function scanOrphanCandidates(projectRoot) {
    const candidates = new Set();
    const codexDir = path.join(projectRoot, ".codex");
    if (isDirectory(codexDir)) {
        walkFiles(codexDir, (abs) => {
            candidates.add(toPosix(path.relative(projectRoot, abs)));
        });
    }
    walkForAgents(projectRoot, projectRoot, candidates);
    return Array.from(candidates).sort();
}
function walkFiles(dir, onFile) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
            onFile(full);
        }
        else if (entry.isDirectory()) {
            walkFiles(full, onFile);
        }
    }
}
function walkForAgents(dir, root, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ORPHAN_SCAN_SKIP_DIRS.has(entry.name))
                continue;
            walkForAgents(full, root, out);
        }
        else if (entry.isFile()) {
            if (entry.name === "AGENTS.md" || entry.name === "AGENTS.override.md") {
                const rel = path.relative(root, full);
                out.add(toPosix(rel));
            }
        }
    }
}
function prepare(target, projectRoot) {
    const inputs = runReaders(projectRoot);
    const outputs = runTranslate(target, inputs, projectRoot);
    const extras = collectExtraFileCopies(inputs.skills, projectRoot);
    const warnings = [];
    for (const out of outputs)
        warnings.push(...(out.warnings ?? []));
    return { outputs, extras, warnings };
}
export function cmdSync(target, projectRoot, opts = { dryRun: false }) {
    const { outputs, extras, warnings } = prepare(target, projectRoot);
    const synced = [];
    const hookOutputs = [];
    const effectiveWarnings = [...warnings];
    if (opts.hookPlanPath) {
        const plan = parseHookPlan(opts.hookPlanPath);
        const inventory = buildInventory({
            projectRoot,
            userHome: opts.userHome ?? null,
            externalProjectPath: plan.project_source_path ?? opts.externalProjectPath ?? null,
        });
        const planOutputs = applyHookPlan({
            plan,
            inventory,
            projectRoot,
            userHome: opts.userHome ?? null,
            dryRun: opts.dryRun,
        });
        hookOutputs.push(...planOutputs);
        for (const out of planOutputs)
            effectiveWarnings.push(...(out.warnings ?? []));
    }
    else {
        const projectHookCount = countHookHandlers(readHooks(projectRoot));
        if (projectHookCount > 0) {
            effectiveWarnings.push(PREFLIGHT_REQUIRED_WARNING);
        }
    }
    const allOutputs = [...outputs, ...hookOutputs];
    for (const out of allOutputs) {
        const rel = out.path;
        const dst = path.join(projectRoot, rel);
        const newContent = out.content;
        const existing = readOrNull(dst);
        if (opts.dryRun) {
            const action = existing !== null ? "updated" : "created";
            if (existing === newContent)
                continue;
            synced.push({ path: rel, action });
            continue;
        }
        if (existing === newContent) {
            synced.push({ path: rel, action: "unchanged" });
            continue;
        }
        const action = writeOutput(projectRoot, rel, newContent);
        synced.push({ path: rel, action });
    }
    for (const { src, dst: relDst } of extras) {
        if (!isFile(src)) {
            effectiveWarnings.push(`Skill extra file missing on disk: ${src}`);
            continue;
        }
        const rel = toPosix(relDst);
        if (opts.dryRun) {
            const dst = path.join(projectRoot, relDst);
            const action = fs.existsSync(dst) ? "updated" : "created";
            synced.push({ path: rel, action });
            continue;
        }
        const action = copyExtra(projectRoot, src, relDst);
        synced.push({ path: rel, action });
    }
    const { gaps, actions } = classifyWarnings(effectiveWarnings);
    return {
        synced,
        warnings: effectiveWarnings,
        gaps,
        actions_required: actions,
    };
}
export function cmdDiff(target, projectRoot) {
    const { outputs, extras, warnings } = prepare(target, projectRoot);
    const diffs = [];
    for (const out of outputs) {
        if (out.path === HOOKS_OUTPUT_PATH)
            continue;
        const rel = out.path;
        const dst = path.join(projectRoot, rel);
        const existing = readOrNull(dst) ?? "";
        const next = out.content;
        if (existing === next)
            continue;
        diffs.push({ path: rel, diff: unifiedDiff(rel, existing, next) });
    }
    for (const { src, dst: relDst } of extras) {
        if (!isFile(src))
            continue;
        const dst = path.join(projectRoot, relDst);
        const rel = toPosix(relDst);
        if (isFile(dst)) {
            let existing;
            try {
                existing = fs.readFileSync(dst, "utf-8");
            }
            catch {
                existing = "";
            }
            let next;
            try {
                next = fs.readFileSync(src, "utf-8");
            }
            catch {
                continue;
            }
            if (existing === next)
                continue;
            diffs.push({ path: rel, diff: unifiedDiff(rel, existing, next) });
        }
        else {
            diffs.push({ path: rel, diff: `(new file from ${src})\n` });
        }
    }
    const { gaps, actions } = classifyWarnings(warnings);
    return { diffs, warnings, gaps, actions_required: actions };
}
export function cmdStatus(target, projectRoot) {
    const { outputs, extras } = prepare(target, projectRoot);
    const inSync = [];
    const drifted = [];
    const missing = [];
    const expected = new Set();
    for (const out of outputs) {
        if (out.path === HOOKS_OUTPUT_PATH)
            continue;
        const rel = out.path;
        expected.add(rel);
        const dst = path.join(projectRoot, rel);
        if (!isFile(dst)) {
            missing.push(rel);
            continue;
        }
        const existing = readOrNull(dst) ?? "";
        if (existing === out.content) {
            inSync.push(rel);
        }
        else {
            drifted.push(rel);
        }
    }
    for (const { src, dst: relDst } of extras) {
        const rel = toPosix(relDst);
        expected.add(rel);
        const dst = path.join(projectRoot, relDst);
        if (!isFile(dst)) {
            if (isFile(src))
                missing.push(rel);
            continue;
        }
        if (!isFile(src))
            continue;
        let existing;
        let next;
        try {
            existing = fs.readFileSync(dst, "utf-8");
            next = fs.readFileSync(src, "utf-8");
        }
        catch {
            drifted.push(rel);
            continue;
        }
        if (existing === next)
            inSync.push(rel);
        else
            drifted.push(rel);
    }
    const existingFiles = scanOrphanCandidates(projectRoot);
    const orphaned = existingFiles.filter((p) => !expected.has(p) && p !== HOOKS_OUTPUT_PATH && p !== ".codex/config.toml");
    return {
        in_sync: [...inSync].sort(),
        drifted: [...drifted].sort(),
        missing: [...missing].sort(),
        orphaned: [...orphaned].sort(),
    };
}
export function cmdHooksInventory(projectRoot, opts = {}) {
    const entries = buildInventory({
        projectRoot,
        userHome: opts.userHome ?? null,
        externalProjectPath: opts.externalProjectPath ?? null,
    });
    return {
        entries: entries.map((e) => ({
            id: e.id,
            scope: e.scope,
            source: e.source,
            event: e.event,
            matcher: e.matcher,
            handler: e.handler,
            label: e.label,
        })),
    };
}
function countHookHandlers(hooks) {
    let n = 0;
    for (const entries of Object.values(hooks)) {
        for (const entry of entries) {
            n += entry.hooks.length;
        }
    }
    return n;
}
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
function toPosix(p) {
    return p.split(path.sep).join("/");
}
class UsageError extends Error {
    exitCode;
    constructor(message, exitCode = 2) {
        super(message);
        this.exitCode = exitCode;
    }
}
function parseArgs(argv) {
    if (argv.length === 0) {
        throw new UsageError(usage(), 2);
    }
    const command = argv[0];
    if (command !== "sync" &&
        command !== "diff" &&
        command !== "status" &&
        command !== "hooks-inventory") {
        throw new UsageError(`Unknown command: ${String(command)}\n${usage()}`);
    }
    let target = null;
    let projectRoot = null;
    let hookPlanPath = null;
    let externalProjectPath = null;
    let dryRun = false;
    for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--target") {
            target = argv[++i] ?? null;
        }
        else if (arg.startsWith("--target=")) {
            target = arg.slice("--target=".length);
        }
        else if (arg === "--project-root") {
            projectRoot = argv[++i] ?? null;
        }
        else if (arg.startsWith("--project-root=")) {
            projectRoot = arg.slice("--project-root=".length);
        }
        else if (arg === "--hook-plan") {
            if (command !== "sync") {
                throw new UsageError(`--hook-plan only valid for 'sync'`);
            }
            hookPlanPath = argv[++i] ?? null;
        }
        else if (arg.startsWith("--hook-plan=")) {
            if (command !== "sync") {
                throw new UsageError(`--hook-plan only valid for 'sync'`);
            }
            hookPlanPath = arg.slice("--hook-plan=".length);
        }
        else if (arg === "--project-source") {
            if (command !== "sync" && command !== "hooks-inventory") {
                throw new UsageError(`--project-source only valid for 'sync' and 'hooks-inventory'`);
            }
            externalProjectPath = argv[++i] ?? null;
        }
        else if (arg.startsWith("--project-source=")) {
            if (command !== "sync" && command !== "hooks-inventory") {
                throw new UsageError(`--project-source only valid for 'sync' and 'hooks-inventory'`);
            }
            externalProjectPath = arg.slice("--project-source=".length);
        }
        else if (arg === "--dry-run") {
            if (command !== "sync") {
                throw new UsageError(`--dry-run only valid for 'sync'`);
            }
            dryRun = true;
        }
        else if (arg === "-h" || arg === "--help") {
            throw new UsageError(usage(), 0);
        }
        else {
            throw new UsageError(`Unknown argument: ${arg}`);
        }
    }
    if (!target)
        throw new UsageError("--target is required");
    if (!SUPPORTED_TARGETS.has(target)) {
        throw new UsageError(`Unsupported target '${target}'. Choices: ${Array.from(SUPPORTED_TARGETS).join(", ")}`);
    }
    if (!projectRoot)
        throw new UsageError("--project-root is required");
    return { command, target, projectRoot, hookPlanPath, externalProjectPath, dryRun };
}
function usage() {
    return [
        "usage: cc-codex-bridge <command> --target codex --project-root PATH [options]",
        "",
        "commands:",
        "  sync             Translate and write Codex-native files",
        "  diff             Show unified diff of proposed changes",
        "  status           Compare current Codex config against sources",
        "  hooks-inventory  List Claude Code hook entries with stable IDs and labels",
        "",
        "options:",
        "  --target codex             Target platform (required).",
        "  --project-root PATH        Absolute or relative project root (required).",
        "  --hook-plan PATH           sync: apply hooks per a hook plan JSON file.",
        "  --project-source PATH      sync/hooks-inventory: external project path for project-scope hooks.",
        "  --dry-run                  sync: report without writing.",
        "",
        "Hook translation is interactive-only via the cc-codex-sync skill.",
        "Without a --hook-plan, sync skips hooks and emits a preflight-required warning.",
        "",
    ].join("\n");
}
export function main(argv) {
    let parsed;
    try {
        parsed = parseArgs(argv);
    }
    catch (err) {
        if (err instanceof UsageError) {
            const stream = err.exitCode === 0 ? process.stdout : process.stderr;
            stream.write(err.message + (err.message.endsWith("\n") ? "" : "\n"));
            return err.exitCode;
        }
        throw err;
    }
    const projectRoot = path.resolve(parsed.projectRoot);
    const userHome = os.homedir();
    try {
        if (parsed.command === "sync") {
            const report = cmdSync(parsed.target, projectRoot, {
                dryRun: parsed.dryRun,
                hookPlanPath: parsed.hookPlanPath,
                userHome,
                externalProjectPath: parsed.externalProjectPath,
            });
            process.stdout.write(JSON.stringify(report, null, 2) + "\n");
            return 0;
        }
        if (parsed.command === "diff") {
            const report = cmdDiff(parsed.target, projectRoot);
            for (const entry of report.diffs) {
                process.stdout.write(entry.diff);
                if (!entry.diff.endsWith("\n"))
                    process.stdout.write("\n");
            }
            const summary = {
                warnings: report.warnings,
                gaps: report.gaps,
                actions_required: report.actions_required,
                changed_paths: report.diffs.map((d) => d.path),
            };
            process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
            return 0;
        }
        if (parsed.command === "hooks-inventory") {
            const report = cmdHooksInventory(projectRoot, {
                userHome,
                externalProjectPath: parsed.externalProjectPath,
            });
            process.stdout.write(JSON.stringify(report, null, 2) + "\n");
            return 0;
        }
        // status
        const report = cmdStatus(parsed.target, projectRoot);
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        return 0;
    }
    catch (err) {
        if (err instanceof HookPlanError) {
            process.stderr.write(`hook plan error: ${err.message}\n`);
            return 3;
        }
        throw err;
    }
}
function invokedDirectly() {
    const invoked = process.argv[1];
    if (!invoked)
        return false;
    try {
        return new URL(import.meta.url).pathname === path.resolve(invoked);
    }
    catch {
        return false;
    }
}
if (invokedDirectly()) {
    process.exit(main(process.argv.slice(2)));
}
