import fs from "node:fs";
import path from "node:path";
export function readHooks(projectRoot) {
    return loadHooks(path.join(projectRoot, ".claude", "settings.json"));
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
