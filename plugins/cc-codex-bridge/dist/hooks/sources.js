import fs from "node:fs";
import path from "node:path";
export function readHookSources(projectRoot, opts = {}) {
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
function loadHooks(settingsPath) {
    if (!isFile(settingsPath))
        return {};
    let raw;
    try {
        raw = fs.readFileSync(settingsPath, "utf-8");
    }
    catch {
        return {};
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
        return {};
    }
    if (!isPlainObject(data))
        return {};
    const hooks = data.hooks;
    if (!isPlainObject(hooks))
        return {};
    return hooks;
}
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
