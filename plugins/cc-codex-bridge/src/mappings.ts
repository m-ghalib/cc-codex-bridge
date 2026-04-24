// Translation tables consumed by the Codex adapter.
// Keep the shape identical to the legacy YAML files so docs and tests stay aligned.

export const TOOLS_MAP: Readonly<Record<string, string>> = {
  WebFetch: "shell (curl)",
  web_fetch: "shell (curl)",
  Edit: "apply_patch",
  edit_file: "apply_patch",
  Read: "shell (cat)",
  read_file: "shell (cat)",
  Write: "apply_patch",
  Bash: "shell",
  run_command: "shell",
  Grep: "shell (grep)",
  Glob: "shell (find)",
  Agent: "spawn_agent",
  AskUserQuestion: "shell (read -p)",
  TodoWrite: "shell (echo)",
  TaskCreate: "shell (echo)",
  TaskUpdate: "shell (echo)",
  NotebookEdit: "shell",
  Monitor: "shell",
  LSP: "shell",
  EnterPlanMode: "shell (echo)",
  ExitPlanMode: "shell (echo)",
};

export interface HookEventMapping {
  codex_event: string | null;
  notes?: string;
}

export const HOOK_EVENTS_MAP: Readonly<Record<string, HookEventMapping | null>> = {
  PreToolUse: {
    codex_event: "PreToolUse",
    notes: "Codex only intercepts Bash tool; matcher translated accordingly",
  },
  PostToolUse: {
    codex_event: "PostToolUse",
    notes: "Codex only intercepts Bash tool",
  },
  SessionStart: {
    codex_event: "SessionStart",
    notes: "Codex matcher uses 'source' field (startup|resume)",
  },
  UserPromptSubmit: {
    codex_event: "UserPromptSubmit",
    notes: "Direct mapping",
  },
  Stop: {
    codex_event: "Stop",
    notes: "Codex matcher not currently used",
  },
  SessionEnd: null,
  SubagentStart: null,
  SubagentStop: null,
  PreCompact: null,
  PostCompact: null,
  PermissionRequest: null,
  PermissionDenied: null,
  Notification: null,
  TaskCreated: null,
  TaskCompleted: null,
  StopFailure: null,
  TeammateIdle: null,
  InstructionsLoaded: null,
  ConfigChange: null,
  CwdChanged: null,
  FileChanged: null,
  WorktreeCreate: null,
  WorktreeRemove: null,
  PostToolUseFailure: null,
  Elicitation: null,
  ElicitationResult: null,
};

export const HOOK_HANDLER_TYPES_MAP: Readonly<Record<string, string | null>> = {
  command: "command",
  http: null,
  prompt: null,
  agent: null,
};
