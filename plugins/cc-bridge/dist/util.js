import { parse as parseYaml } from "yaml";
const FENCE = "---";
export function splitFrontmatter(text) {
    if (!text.startsWith(FENCE)) {
        return [{}, text];
    }
    const lines = splitKeepNewlines(text);
    if (lines.length === 0 || stripNewline(lines[0]) !== FENCE) {
        return [{}, text];
    }
    for (let idx = 1; idx < lines.length; idx++) {
        if (stripNewline(lines[idx]) === FENCE) {
            const fmText = lines.slice(1, idx).join("");
            let body = lines.slice(idx + 1).join("");
            let parsed = null;
            if (fmText.trim().length > 0) {
                try {
                    parsed = parseYaml(fmText);
                }
                catch {
                    parsed = null;
                }
            }
            const fm = isPlainObject(parsed) ? parsed : {};
            if (body.startsWith("\n")) {
                body = body.slice(1);
            }
            return [fm, body];
        }
    }
    return [{}, text];
}
function stripNewline(line) {
    return line.replace(/\r?\n$/, "");
}
function splitKeepNewlines(text) {
    if (text.length === 0) {
        return [];
    }
    const out = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n") {
            out.push(text.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < text.length) {
        out.push(text.slice(start));
    }
    return out;
}
function isPlainObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype);
}
