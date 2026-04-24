import path from "node:path";
export const EVENT_DISPLAY = {
    PreToolUse: "Before Tool",
    PostToolUse: "After Tool",
    SessionStart: "On Session Start",
    SessionEnd: "On Session End",
    UserPromptSubmit: "On Prompt",
    Stop: "On Stop",
    SubagentStop: "On Subagent Stop",
    SubagentStart: "On Subagent Start",
    PreCompact: "Before Compact",
    PostCompact: "After Compact",
    Notification: "On Notification",
};
const SCOPE_DISPLAY = {
    user: "User",
    project: "Project",
};
export function summarizeHandler(handler) {
    const type = String(handler.type ?? "").toLowerCase();
    if (type === "command") {
        const command = typeof handler.command === "string" ? handler.command : "";
        return commandSummary(command) || "command";
    }
    if (type === "http") {
        const url = typeof handler.url === "string" ? handler.url : "";
        return urlSummary(url) || "http";
    }
    if (type === "prompt") {
        const prompt = typeof handler.prompt === "string" ? handler.prompt : "";
        return promptSummary(prompt) || "prompt";
    }
    if (type === "agent") {
        const agentName = typeof handler.agent === "string" ? handler.agent : "";
        return agentName || "agent";
    }
    return type || "handler";
}
function commandSummary(command) {
    const trimmed = command.trim();
    if (!trimmed)
        return "";
    const firstTokenRaw = trimmed.split(/\s+/)[0] ?? "";
    const firstToken = firstTokenRaw.replace(/^["']+|["']+$/g, "");
    if (!firstToken)
        return trimmed.slice(0, 32);
    const base = path.basename(firstToken);
    const stem = base.replace(/\.(sh|py|rb|ts|js|mjs|cjs)$/i, "");
    return stem || base || firstToken;
}
function urlSummary(url) {
    try {
        const u = new URL(url);
        const host = u.hostname || "";
        const segments = u.pathname.split("/").filter((p) => p.length > 0);
        const last = segments[segments.length - 1] ?? "";
        return last ? `${host}/${last}` : host;
    }
    catch {
        const m = url.match(/^[a-z]+:\/\/([^/]+)(\/[^?#]*)?/i);
        if (m) {
            const host = m[1] ?? "";
            const tail = (m[2] ?? "").split("/").filter(Boolean).pop() ?? "";
            return tail ? `${host}/${tail}` : host;
        }
        return url.slice(0, 32);
    }
}
function promptSummary(prompt) {
    const cleaned = prompt.trim().replace(/\s+/g, " ");
    if (!cleaned)
        return "";
    const firstSentence = cleaned.split(/[.?!]/)[0] ?? cleaned;
    const phrase = firstSentence.trim();
    if (phrase.length === 0)
        return cleaned.slice(0, 48);
    if (phrase.length <= 48)
        return phrase;
    return phrase.slice(0, 48).trimEnd() + "…";
}
export function buildLabel(scope, event, handler) {
    const scopeText = SCOPE_DISPLAY[scope];
    const eventText = EVENT_DISPLAY[event] ?? event;
    const handlerText = summarizeHandler(handler);
    return `${scopeText} / ${eventText} / ${handlerText}`;
}
export function disambiguateLabels(labels) {
    const counts = new Map();
    for (const label of labels)
        counts.set(label, (counts.get(label) ?? 0) + 1);
    const seen = new Map();
    const out = [];
    for (const label of labels) {
        const total = counts.get(label) ?? 1;
        if (total === 1) {
            out.push(label);
            continue;
        }
        const next = (seen.get(label) ?? 0) + 1;
        seen.set(label, next);
        out.push(`${label} (${next})`);
    }
    return out;
}
