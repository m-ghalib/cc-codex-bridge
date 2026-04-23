import fs from "node:fs";
import path from "node:path";
import { splitFrontmatter } from "../util.js";
export function readAgents(projectRoot) {
    const agentsDir = path.join(projectRoot, ".claude", "agents");
    if (!isDirectory(agentsDir)) {
        return [];
    }
    const files = fs
        .readdirSync(agentsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
        .sort();
    const agents = [];
    for (const filename of files) {
        const full = path.join(agentsDir, filename);
        const text = fs.readFileSync(full, "utf-8");
        const [frontmatter, body] = splitFrontmatter(text);
        const stem = filename.slice(0, -".md".length);
        const name = typeof frontmatter.name === "string" && frontmatter.name.length > 0
            ? frontmatter.name
            : stem;
        agents.push({ name, frontmatter, body });
    }
    return agents;
}
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
