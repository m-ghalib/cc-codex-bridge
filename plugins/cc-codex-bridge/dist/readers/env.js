import fs from "node:fs";
import path from "node:path";
function loadEnv(filePath) {
    if (!isFile(filePath))
        return {};
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf-8");
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
    const env = data.env;
    if (!isPlainObject(env))
        return {};
    const out = {};
    for (const [k, v] of Object.entries(env)) {
        out[String(k)] = String(v);
    }
    return out;
}
export function readEnv(projectRoot) {
    const claudeDir = path.join(projectRoot, ".claude");
    const project = loadEnv(path.join(claudeDir, "settings.json"));
    const local = loadEnv(path.join(claudeDir, "settings.local.json"));
    return { ...project, ...local };
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
