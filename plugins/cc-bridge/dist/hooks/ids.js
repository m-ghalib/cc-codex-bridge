import crypto from "node:crypto";
export function entryId(scope, event, matcher, handler) {
    const normalized = normalize(handler);
    const payload = `${scope}|${event}|${matcher}|${stableStringify(normalized)}`;
    return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 10);
}
export function stableStringify(value) {
    if (value === null)
        return "null";
    if (typeof value === "number" || typeof value === "boolean")
        return JSON.stringify(value);
    if (typeof value === "string")
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
    }
    if (typeof value === "object") {
        const obj = value;
        const keys = Object.keys(obj)
            .filter((k) => obj[k] !== undefined)
            .sort();
        return ("{" +
            keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
            "}");
    }
    return JSON.stringify(value ?? null);
}
function normalize(value) {
    if (value === null || value === undefined)
        return null;
    if (Array.isArray(value)) {
        return value.map((v) => normalize(v));
    }
    if (typeof value === "object") {
        const obj = value;
        const out = {};
        for (const key of Object.keys(obj).sort()) {
            const v = obj[key];
            if (v === undefined)
                continue;
            out[key] = normalize(v);
        }
        return out;
    }
    return value;
}
