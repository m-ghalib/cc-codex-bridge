import fs from "node:fs";
import path from "node:path";

import { stringify as yamlStringify } from "yaml";
import { stringify as tomlStringify } from "smol-toml";

import type { AgentRecord } from "../readers/agents.js";
import type { ContextTree } from "../readers/context.js";
import type { EnvMap } from "../readers/env.js";
import type { SkillRecord } from "../readers/skills.js";
import { TOOLS_MAP } from "../mappings.js";
import type { Frontmatter } from "../util.js";

export interface OutputFile {
  path: string;
  content: string;
  warnings: string[];
}

const SKILL_DROP_FIELDS = [
  "allowed-tools",
  "model",
  "effort",
  "context",
  "hooks",
  "paths",
  "shell",
] as const;

const AGENT_DROP_FIELDS = [
  "tools",
  "disallowedTools",
  "maxTurns",
  "hooks",
  "memory",
  "isolation",
  "color",
  "initialPrompt",
] as const;

const MODEL_MAP: Record<string, string> = {
  opus: "gpt-5.4",
  sonnet: "gpt-5.4",
  haiku: "gpt-5.4-mini",
};

const EFFORT_MAP: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "xhigh",
};

const PERMISSION_MAP: Record<string, string> = {
  default: "read-only",
  plan: "read-only",
  acceptEdits: "workspace-write",
  auto: "danger-full-access",
  dontAsk: "danger-full-access",
  bypassPermissions: "danger-full-access",
};

const ARGS_RE = /\$ARGUMENTS(?:\[\d+\])?/g;
const INLINE_EXEC_RE = /!`[^`]+`/g;

const ARGS_WARNING_MARKER =
  "<!-- ARGUMENTS placeholder not supported in Codex; substitute manually -->";
const EXEC_WARNING_MARKER =
  "<!-- Inline `!` exec block not supported in Codex; run command manually -->";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteToolRefs(text: string, tools: Record<string, string>): string {
  if (!text) return text;
  const names = Object.keys(tools).sort((a, b) => b.length - a.length);
  let out = text;
  for (const claudeName of names) {
    const codexName = tools[claudeName]!;
    const escaped = escapeRegExp(claudeName);
    out = out.replace(new RegExp("`" + escaped + "`", "g"), "`" + codexName + "`");
    out = out.replace(
      new RegExp(`\\bthe ${escaped} tool\\b`, "g"),
      `the ${codexName} tool`,
    );
    out = out.replace(new RegExp(`\\bUse ${escaped}\\b`, "g"), `Use ${codexName}`);
  }
  return out;
}

function stripSkillSyntax(body: string): { body: string; warnings: string[] } {
  const warnings: string[] = [];
  let out = body.replace(ARGS_RE, (match) => {
    warnings.push(`Stripped unsupported placeholder: ${match}`);
    return ARGS_WARNING_MARKER;
  });
  out = out.replace(INLINE_EXEC_RE, (match) => {
    warnings.push(`Stripped inline exec block: ${match}`);
    return EXEC_WARNING_MARKER;
  });
  return { body: out, warnings };
}

function composeDescription(description: string | null | undefined, whenToUse: string | null | undefined): string {
  const parts: string[] = [];
  for (const p of [description, whenToUse]) {
    if (typeof p === "string" && p.trim().length > 0) {
      parts.push(p.trim());
    }
  }
  return parts.join(" ");
}

function formatFrontmatter(fm: Record<string, unknown>): string {
  return yamlStringify(fm, { lineWidth: 0, defaultStringType: "PLAIN", defaultKeyType: "PLAIN" }).replace(/\s+$/, "");
}

function translateSkill(skill: SkillRecord, tools: Record<string, string>): OutputFile {
  const warnings: string[] = [];
  const fm: Frontmatter = skill.frontmatter ?? {};
  const skillId = skill.id;

  for (const field of SKILL_DROP_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fm, field)) {
      warnings.push(`Skill '${skillId}': dropped unsupported field '${field}'`);
    }
  }

  const newFm: Record<string, unknown> = { name: skill.name || skillId };
  const combined = composeDescription(skill.description, skill.when_to_use);
  if (combined) {
    newFm.description = combined;
  }

  const rewritten = rewriteToolRefs(skill.body ?? "", tools);
  const { body, warnings: stripWarnings } = stripSkillSyntax(rewritten);
  warnings.push(...stripWarnings);

  for (const extra of skill.extra_files ?? []) {
    warnings.push(`Skill '${skillId}': extra file to copy alongside SKILL.md: ${extra}`);
  }

  const content = `---\n${formatFrontmatter(newFm)}\n---\n\n${body}`;
  return {
    path: `.codex/skills/${skillId}/SKILL.md`,
    content,
    warnings,
  };
}

function translateAgent(agent: AgentRecord): OutputFile {
  const warnings: string[] = [];
  const fm = agent.frontmatter ?? {};
  const name = agent.name || (typeof fm.name === "string" ? fm.name : "agent");

  const doc: Record<string, unknown> = { name };
  if (fm.description !== undefined && fm.description !== null) {
    doc.description = String(fm.description);
  }

  if ("model" in fm) {
    const raw = fm.model as unknown;
    const mapped = typeof raw === "string" ? MODEL_MAP[raw] : undefined;
    if (mapped) {
      doc.model = mapped;
    } else {
      warnings.push(`Agent '${name}': unknown model '${String(raw)}'; dropped`);
    }
  }

  if ("effort" in fm) {
    const raw = fm.effort as unknown;
    const mapped = typeof raw === "string" ? EFFORT_MAP[raw] : undefined;
    if (mapped) {
      doc.model_reasoning_effort = mapped;
    } else {
      warnings.push(`Agent '${name}': unknown effort '${String(raw)}'; dropped`);
    }
  }

  if ("permissionMode" in fm) {
    const raw = fm.permissionMode as unknown;
    const mapped = typeof raw === "string" ? PERMISSION_MAP[raw] : undefined;
    if (mapped) {
      doc.sandbox_mode = mapped;
    } else {
      warnings.push(`Agent '${name}': unknown permissionMode '${String(raw)}'; dropped`);
    }
  }

  doc.developer_instructions = agent.body ?? "";

  for (const field of AGENT_DROP_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fm, field)) {
      warnings.push(`Agent '${name}': dropped unsupported field '${field}'`);
    }
  }

  const content = tomlStringify(doc);
  return {
    path: `.codex/agents/${name}.toml`,
    content: content.endsWith("\n") ? content : content + "\n",
    warnings,
  };
}

function tomlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function translateEnv(env: EnvMap): OutputFile {
  const lines = ["[shell_environment_policy]"];
  const keys = Object.keys(env).sort();
  for (const key of keys) {
    lines.push(`set.${key} = "${tomlEscape(env[key]!)}"`);
  }
  const content = lines.join("\n") + "\n";
  const warnings = [
    "Env bridge fragment written to .codex/env-bridge.toml; it must be merged into an active Codex config.toml before those env vars apply",
  ];
  return { path: ".codex/env-bridge.toml", content, warnings };
}

function globPathPrefix(globPath: string): string | null {
  const parts = globPath.split("/");
  const prefix: string[] = [];
  for (const part of parts) {
    if (/[*?[]/.test(part)) break;
    if (part) prefix.push(part);
  }
  if (prefix.length === 0) return null;
  return prefix.join("/");
}

function resolveScopePrefix(rawPath: string, projectRoot: string): string | null {
  const normalized = rawPath.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;

  const prefix = globPathPrefix(normalized);
  if (/[*?[]/.test(normalized)) {
    return prefix;
  }

  const candidate = path.join(projectRoot, normalized);
  if (fs.existsSync(candidate)) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        return normalized;
      }
      const relParent = path.relative(projectRoot, path.dirname(candidate));
      return relParent === "" ? null : relParent.split(path.sep).join("/");
    } catch {
      // fall through to prefix
    }
  }

  return prefix;
}

function translateContext(
  context: ContextTree,
  tools: Record<string, string>,
  projectRoot: string,
): OutputFile[] {
  const outputs: OutputFile[] = [];
  const rootParts: string[] = [];

  const main = context.main ?? "";
  if (main) {
    rootParts.push(rewriteToolRefs(main, tools).replace(/\s+$/, ""));
  }

  const scoped: Record<string, string[]> = {};
  for (const rule of context.rules ?? []) {
    const content = rewriteToolRefs(rule.content ?? "", tools).trim();
    if (!content) continue;
    const filename = rule.filename ?? "rule";
    const block = `<!-- Rule from ${filename} -->\n${content}`;

    const paths = rule.paths;
    if (!paths || (Array.isArray(paths) && paths.length === 0)) {
      rootParts.push(block);
      continue;
    }

    const pathList = Array.isArray(paths) ? paths : [paths];
    let placed = false;
    for (const raw of pathList) {
      const prefix = resolveScopePrefix(String(raw), projectRoot);
      if (prefix === null) continue;
      (scoped[prefix] ??= []).push(block);
      placed = true;
    }
    if (!placed) {
      rootParts.push(block);
    }
  }

  if (rootParts.length > 0) {
    outputs.push({
      path: "AGENTS.md",
      content: rootParts.join("\n\n") + "\n",
      warnings: [],
    });
  }

  const local = context.local;
  if (local) {
    outputs.push({
      path: "AGENTS.override.md",
      content: rewriteToolRefs(local, tools),
      warnings: [],
    });
  }

  for (const prefix of Object.keys(scoped).sort()) {
    outputs.push({
      path: `${prefix}/AGENTS.md`,
      content: scoped[prefix]!.join("\n\n") + "\n",
      warnings: [],
    });
  }

  return outputs;
}

export function translate(
  skills: SkillRecord[],
  agents: AgentRecord[],
  env: EnvMap,
  context: ContextTree,
  projectRoot: string,
): OutputFile[] {
  const tools = TOOLS_MAP as Record<string, string>;
  const outputs: OutputFile[] = [];

  for (const skill of skills) {
    outputs.push(translateSkill(skill, tools));
  }

  for (const agent of agents) {
    outputs.push(translateAgent(agent));
  }

  if (env && Object.keys(env).length > 0) {
    outputs.push(translateEnv(env));
  }

  outputs.push(...translateContext(context, tools, projectRoot));

  return outputs;
}
