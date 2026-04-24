export const fps = 30;
export const durationInFrames = 450;
export const dimensions = {
  width: 1280,
  height: 720,
};

export type TypedLine = {
  text: string;
  startFrame: number;
  typeFrames: number;
  prompt: string;
};

export type OutputLine = {
  text: string;
  startFrame: number;
};

export type SkillSuggestion = {
  name: string;
  description: string;
};

export const skillSuggestions: SkillSuggestion[] = [
  {name: 'review', description: 'Inspect changes with product taste'},
  {name: 'shipcheck', description: 'Check release readiness'},
  {name: 'refactor-map', description: 'Plan a focused cleanup'},
  {name: 'handoff', description: 'Write the next-agent brief'},
];

export const claudeAutocomplete: TypedLine = {
  prompt: '>',
  text: '/',
  startFrame: -8,
  typeFrames: 1,
};

export const autocompleteTiming = {
  claudeEnd: 44,
};

export const claudeCommands: TypedLine[] = [
  {
    prompt: '>',
    text: '/plugin marketplace add m-ghalib/cc-codex-bridge',
    startFrame: 48,
    typeFrames: 38,
  },
  {
    prompt: '>',
    text: '/plugin install cc-codex-bridge@cc-codex-bridge',
    startFrame: 106,
    typeFrames: 36,
  },
  {
    prompt: '>',
    text: 'cc-codex-sync',
    startFrame: 166,
    typeFrames: 20,
  },
];

export const syncOutput: OutputLine[] = [
  {text: 'ok skills synced', startFrame: 218},
  {text: 'ok agents synced', startFrame: 236},
  {text: 'ok AGENTS.md updated', startFrame: 254},
];

export const codexLines: TypedLine[] = [
  {
    prompt: '>',
    text: 'codex',
    startFrame: 314,
    typeFrames: 16,
  },
  {
    prompt: '>',
    text: '$',
    startFrame: 400,
    typeFrames: 1,
  },
];

export const timing = {
  splitStart: 296,
  splitEnd: 314,
  codexLaunchStart: 314,
  codexReady: 356,
  closeFirstPaneStart: 358,
  closeFirstPaneEnd: 382,
  skillHoldStart: 420,
};
