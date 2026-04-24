import type {CSSProperties} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {
  autocompleteTiming,
  claudeAutocomplete,
  claudeCommands,
  codexLines,
  skillSuggestions,
  syncOutput,
  timing,
  type OutputLine,
  type TypedLine,
} from './script';

type PaneVariant = 'wide' | 'compact';

const colors = {
  canvas: '#101412',
  terminal: '#060708',
  terminal2: '#090b0d',
  chrome: '#222427',
  border: '#303337',
  divider: '#25282c',
  text: '#e5e8e5',
  muted: '#8b938e',
  faint: '#5f6762',
  green: '#55d58a',
  blue: '#9db8ff',
  orange: '#dd7442',
  orangeMuted: '#b86139',
  red: '#de6a5d',
  gold: '#d0a348',
};

const mono =
  '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace';

const clamp = (
  frame: number,
  input: [number, number],
  output: [number, number],
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const typedText = (text: string, localFrame: number, typeFrames: number) => {
  const progress = clamp(localFrame, [0, typeFrames], [0, 1]);
  return text.slice(0, Math.floor(text.length * progress));
};

const isTyping = (line: TypedLine, frame: number) =>
  frame >= line.startFrame && frame < line.startFrame + line.typeFrames;

const commandSubmitFrame = (line: TypedLine) =>
  line.startFrame + line.typeFrames + 8;

const isSubmitted = (line: TypedLine, frame: number) =>
  frame >= commandSubmitFrame(line);

const claudeWideRows = [
  '╭─── Claude Code v2.1.119 ───────────────────────────────────────────────╮',
  '│                                                    │ Tips for getting   │',
  '│                  Welcome back                     │ started            │',
  '│                                                    │ Run /init to create│',
  '│                     ▐▛███▜▌                       │ a CLAUDE.md file   │',
  '│                    ▝▜█████▛▘                      │ ────────────────── │',
  '│                      ▘▘ ▝▝                        │ Recent activity    │',
  '│   Opus 4.6 (1M context) with high reasoning       │ No recent activity │',
  '│   Claude Max                                      │                    │',
  '│               ~/GitHub/cc-codex-bridge            │                    │',
  '╰────────────────────────────────────────────────────────────────────────╯',
];

const claudeCompactRows = [
  '╭── Claude Code v2.1.119 ───────────────╮',
  '│              Welcome back             │',
  '│                ▐▛███▜▌                │',
  '│               ▝▜█████▛▘               │',
  '│                ▘▘ ▝▝                  │',
  '│ Tips: Run /init to create CLAUDE.md   │',
  '│ Recent activity: none                 │',
  '╰───────────────────────────────────────╯',
];

const codexWideRows = [
  '╭─────────────────────────────────────────────╮',
  '│ >_ OpenAI Codex (v0.124.0)                  │',
  '│                                             │',
  '│ model:     gpt-5.5 xhigh   /model to change │',
  '│ directory: ~/GitHub/cc-codex-bridge         │',
  '╰─────────────────────────────────────────────╯',
];

const codexCompactRows = [
  '╭──────────────────────────────╮',
  '│ >_ OpenAI Codex (v0.124.0)   │',
  '│ model: gpt-5.5 xhigh /model │',
  '│ dir: ~/GitHub/cc-codex-bridge│',
  '╰──────────────────────────────╯',
];

const boxChars = new Set(['╭', '╮', '╰', '╯', '─', '│']);
const blockChars = new Set(['▐', '▛', '█', '▜', '▌', '▝', '▘']);

export const OnboardingVideo = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={styles.canvas}>
      <div style={styles.backdrop} />
      <div style={styles.window}>
        <WindowChrome />
        <PaneLayout frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

const WindowChrome = () => (
  <div style={styles.chrome}>
    <div style={styles.dots}>
      <span style={{...styles.dot, backgroundColor: colors.red}} />
      <span style={{...styles.dot, backgroundColor: colors.gold}} />
      <span style={{...styles.dot, backgroundColor: colors.green}} />
    </div>
    <div style={styles.title}>cc-codex-bridge</div>
  </div>
);

const PaneLayout = ({frame}: {frame: number}) => {
  const splitProgress = clamp(frame, [timing.splitStart, timing.splitEnd], [0, 1]);
  const closeProgress = clamp(
    frame,
    [timing.closeFirstPaneStart, timing.closeFirstPaneEnd],
    [0, 1],
  );
  const splitWidth = interpolate(splitProgress, [0, 1], [100, 50]);
  const firstWidth = interpolate(closeProgress, [0, 1], [splitWidth, 0]);
  const secondWidth = 100 - firstWidth;
  const secondOpacity = clamp(frame, [timing.splitStart + 3, timing.splitEnd], [0, 1]);
  const firstOpacity = clamp(frame, [timing.closeFirstPaneStart, timing.closeFirstPaneEnd], [1, 0]);
  const showDivider = frame >= timing.splitStart && frame < timing.closeFirstPaneEnd;
  const firstVariant: PaneVariant = firstWidth < 68 ? 'compact' : 'wide';
  const secondVariant: PaneVariant = secondWidth < 68 ? 'compact' : 'wide';

  return (
    <div style={styles.panes}>
      {firstWidth > 1 ? (
        <div style={{...styles.pane, width: `${firstWidth}%`, opacity: firstOpacity}}>
          <FirstPane frame={frame} variant={firstVariant} />
        </div>
      ) : null}
      {showDivider ? <div style={styles.divider} /> : null}
      <div
        style={{
          ...styles.pane,
          opacity: secondOpacity,
          width: `${secondWidth}%`,
        }}
      >
        <CodexPane frame={frame} variant={secondVariant} />
      </div>
    </div>
  );
};

const FirstPane = ({frame, variant}: {frame: number; variant: PaneVariant}) => (
  <ClaudePane frame={frame} variant={variant} />
);

const ClaudePane = ({frame, variant}: {frame: number; variant: PaneVariant}) => {
  const syncCommand = claudeCommands[2];
  const showAutocomplete =
    frame >= claudeAutocomplete.startFrame && frame < autocompleteTiming.claudeEnd;
  const activeCommand = claudeCommands.find(
    (line) => frame >= line.startFrame && frame < commandSubmitFrame(line),
  );
  const inputLine = showAutocomplete ? claudeAutocomplete : activeCommand;
  const syncSubmitted = isSubmitted(syncCommand, frame);
  const transcriptOpacity = clamp(
    frame,
    [claudeCommands[0].startFrame + claudeCommands[0].typeFrames, 148],
    [0, 1],
  );
  const rows = variant === 'compact' ? claudeCompactRows : claudeWideRows;

  return (
    <div style={styles.tuiPane}>
      <TuiRows
        accentColor={colors.orange}
        rows={rows}
        textColor="#f0d7cb"
        variant={variant}
      />
      <div style={styles.claudeSpacer} />
      <div style={styles.claudeEffort}>● high · /effort</div>
      <Rule />
      <div style={styles.claudeInput}>
        <span style={styles.claudePromptMark}>❯</span>
        {inputLine ? <TypedCommandText frame={frame} line={inputLine} /> : null}
      </div>
      {showAutocomplete ? <SkillAutocomplete trigger="/" variant={variant} /> : null}
      <Rule />
      <div style={{...styles.claudeTranscript, opacity: transcriptOpacity}}>
        <ClaudeCommandHistory frame={frame} />
        {syncSubmitted ? (
          <div style={styles.syncBlock}>
            <div style={styles.agentLine}>⏺ Running cc-codex-sync</div>
            <div style={styles.syncLines}>
              {syncOutput.map((line) => (
                <OutputTerminalLine frame={frame} key={line.text} line={line} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div style={styles.claudeFooter}>
        ◉ 98% │ cc-codex-bridge │ *11 │ opus[1m] │ xhigh │ default
      </div>
    </div>
  );
};

const ClaudeCommandHistory = ({frame}: {frame: number}) => (
  <div style={styles.commandHistory}>
    {claudeCommands.map((line, index) =>
      isSubmitted(line, frame) ? (
        <div key={line.text}>
          <div style={styles.historyLine}>
            <span style={styles.historyPrompt}>❯</span>
            <span style={styles.historyCommand}>{line.text}</span>
          </div>
          {index < 2 && frame >= commandSubmitFrame(line) + 10 ? (
            <div style={styles.historyOutput}>
              <span style={styles.ok}>✓</span>
              <span>{index === 0 ? 'marketplace added' : 'plugin installed'}</span>
            </div>
          ) : null}
        </div>
      ) : null,
    )}
  </div>
);

const CodexPane = ({frame, variant}: {frame: number; variant: PaneVariant}) => {
  const launchLine = codexLines[0];
  const skillLine = codexLines[1];
  const readyOpacity = clamp(frame, [timing.codexReady, timing.codexReady + 16], [0, 1]);
  const shellOpacity = clamp(frame, [timing.codexReady - 10, timing.codexReady], [1, 0]);
  const rows = variant === 'compact' ? codexCompactRows : codexWideRows;
  const showSkill = frame >= skillLine.startFrame;

  return (
    <div style={styles.codexStack}>
      <div style={{...styles.stackLayer, opacity: shellOpacity}}>
        <CodexLaunchShell frame={frame} line={launchLine} />
      </div>
      <div
        style={{
          ...styles.stackLayer,
          opacity: readyOpacity,
          transform: `translateY(${clamp(frame, [timing.codexReady, timing.codexReady + 16], [10, 0])}px)`,
        }}
      >
        <div style={styles.codexPane}>
          <TuiRows
            accentColor="#a9b1ad"
            rows={rows}
            textColor="#d9dfdc"
            variant={variant}
          />
          <div style={{...styles.codexTip, ...tipTextStyle(variant)}}>
            <div>
              <span style={styles.tipLabel}>Tip:</span> GPT-5.5 is now available in Codex.
            </div>
            <div>It can reason through large codebases and keep going until the work is done.</div>
          </div>
          <div style={styles.codexBoot}>
            <span style={styles.bullet}>•</span>
            <span style={styles.bootText}>Starting MCP servers (3/3): codex_apps, computer-use, context7</span>
          </div>
          <div style={styles.codexInput}>
            <span style={styles.codexPromptMark}>›</span>
            {showSkill ? (
              <TypedCommandText cursorColor={colors.green} frame={frame} line={skillLine} />
            ) : (
              <span style={styles.placeholder}>Explain this codebase</span>
            )}
          </div>
          {showSkill ? <SkillAutocomplete trigger="$" variant={variant} /> : null}
          <div style={styles.codexFooter}>
            gpt-5.5 xhigh · ~/GitHub/cc-codex-bridge · Context 100% left
          </div>
        </div>
      </div>
    </div>
  );
};

const CodexLaunchShell = ({frame, line}: {frame: number; line: TypedLine}) => (
  <div style={styles.shellPane}>
    <div style={styles.shellLines}>
      <TypedTerminalLine frame={frame} line={line} />
    </div>
  </div>
);

const SkillAutocomplete = ({
  trigger,
  variant,
}: {
  trigger: '/' | '$';
  variant: PaneVariant;
}) => (
  <div style={{...styles.autocompletePanel, ...autocompletePanelStyle(variant)}}>
    {skillSuggestions.map((skill, index) => (
      <div
        key={skill.name}
        style={{
          ...styles.autocompleteRow,
          ...(index === 0 ? styles.autocompleteRowActive : {}),
        }}
      >
        <span style={styles.autocompleteCommand}>
          {trigger}
          {skill.name}
        </span>
        <span style={styles.autocompleteDescription}>{skill.description}</span>
      </div>
    ))}
  </div>
);

const TuiRows = ({
  rows,
  variant,
  accentColor,
  textColor,
}: {
  rows: string[];
  variant: PaneVariant;
  accentColor: string;
  textColor: string;
}) => (
  <div style={{...styles.tuiRows, ...gridTextStyle(variant)}}>
    {rows.map((row, rowIndex) => (
      <div key={`${row}-${rowIndex}`} style={styles.tuiRow}>
        {[...row].map((char, charIndex) => {
          const accent = boxChars.has(char) || blockChars.has(char);
          return (
            <span
              key={`${rowIndex}-${charIndex}`}
              style={{color: accent ? accentColor : textColor}}
            >
              {char}
            </span>
          );
        })}
      </div>
    ))}
  </div>
);

const TypedCommandText = ({
  line,
  frame,
  cursorColor = colors.text,
}: {
  line: TypedLine;
  frame: number;
  cursorColor?: string;
}) => {
  const localFrame = frame - line.startFrame;
  const visible = frame >= line.startFrame;
  const text = typedText(line.text, localFrame, line.typeFrames);
  const showCursor = isTyping(line, frame);

  if (!visible) {
    return <span />;
  }

  return (
    <>
      <span style={styles.command}>{text}</span>
      {showCursor ? <span style={{...styles.cursor, backgroundColor: cursorColor}} /> : null}
    </>
  );
};

const TypedTerminalLine = ({
  line,
  frame,
  cursorColor = colors.text,
}: {
  line: TypedLine;
  frame: number;
  cursorColor?: string;
}) => {
  const visible = frame >= line.startFrame;
  const opacity = clamp(frame, [line.startFrame, line.startFrame + 8], [0, 1]);

  if (!visible) {
    return <div style={styles.line} />;
  }

  return (
    <div style={{...styles.line, opacity}}>
      <span style={styles.prompt}>{line.prompt}</span>
      <TypedCommandText cursorColor={cursorColor} frame={frame} line={line} />
    </div>
  );
};

const OutputTerminalLine = ({line, frame}: {line: OutputLine; frame: number}) => {
  const visible = frame >= line.startFrame;
  const opacity = clamp(frame, [line.startFrame, line.startFrame + 10], [0, 1]);
  const y = clamp(frame, [line.startFrame, line.startFrame + 10], [8, 0]);

  if (!visible) {
    return <div style={styles.line} />;
  }

  return (
    <div
      style={{
        ...styles.outputLine,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <span style={styles.ok}>✓</span>
      <span>{line.text.replace(/^ok /, '')}</span>
    </div>
  );
};

const Rule = () => <div style={styles.rule} />;

const gridTextStyle = (variant: PaneVariant): CSSProperties => ({
  fontSize: variant === 'compact' ? 9 : 14,
  lineHeight: variant === 'compact' ? '13px' : '19px',
});

const tipTextStyle = (variant: PaneVariant): CSSProperties => ({
  fontSize: variant === 'compact' ? 10 : 14,
  lineHeight: variant === 'compact' ? '15px' : '21px',
});

const autocompletePanelStyle = (variant: PaneVariant): CSSProperties => ({
  fontSize: variant === 'compact' ? 10 : 13,
  lineHeight: variant === 'compact' ? '17px' : '20px',
});

const styles: Record<string, CSSProperties> = {
  canvas: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    color: colors.text,
    display: 'flex',
    fontFamily: mono,
    justifyContent: 'center',
    letterSpacing: 0,
    overflow: 'hidden',
  },
  backdrop: {
    background:
      'radial-gradient(circle at 18% 16%, rgba(85,213,138,0.18), transparent 30%), radial-gradient(circle at 82% 84%, rgba(221,116,66,0.16), transparent 34%), linear-gradient(140deg, #101412, #1b1f1c 54%, #0d1110)',
    inset: 0,
    position: 'absolute',
  },
  window: {
    backgroundColor: colors.terminal,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    boxShadow: '0 34px 90px rgba(0,0,0,0.46)',
    display: 'flex',
    flexDirection: 'column',
    height: 530,
    overflow: 'hidden',
    position: 'relative',
    width: 1120,
  },
  chrome: {
    alignItems: 'center',
    backgroundColor: colors.chrome,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    height: 36,
    padding: '0 14px',
    position: 'relative',
  },
  dots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  panes: {
    backgroundColor: colors.terminal,
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pane: {
    backgroundColor: colors.terminal,
    height: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  divider: {
    backgroundColor: colors.divider,
    flex: '0 0 1px',
  },
  stackLayer: {
    inset: 0,
    position: 'absolute',
    transformOrigin: '50% 50%',
  },
  shellPane: {
    backgroundColor: colors.terminal,
    boxSizing: 'border-box',
    height: '100%',
    overflow: 'hidden',
    padding: '38px 34px',
  },
  shellLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  line: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 20,
    height: 28,
    letterSpacing: 0,
    lineHeight: '28px',
    whiteSpace: 'pre',
  },
  prompt: {
    color: colors.green,
    flex: '0 0 auto',
    fontWeight: 800,
    marginRight: 12,
  },
  command: {
    color: colors.text,
    overflow: 'hidden',
    textOverflow: 'clip',
  },
  autocompletePanel: {
    backgroundColor: colors.terminal2,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    boxShadow: '0 16px 34px rgba(0,0,0,0.32)',
    boxSizing: 'border-box',
    marginBottom: 8,
    marginLeft: 32,
    marginRight: 6,
    overflow: 'hidden',
  },
  autocompleteRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 18,
    height: 27,
    minWidth: 0,
    padding: '0 12px',
    whiteSpace: 'pre',
  },
  autocompleteRowActive: {
    backgroundColor: 'rgba(221,116,66,0.16)',
  },
  autocompleteCommand: {
    color: colors.text,
    flex: '0 0 136px',
    fontWeight: 800,
    overflow: 'hidden',
    textOverflow: 'clip',
  },
  autocompleteDescription: {
    color: colors.muted,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'clip',
  },
  cursor: {
    display: 'inline-block',
    height: 22,
    marginLeft: 4,
    transform: 'translateY(3px)',
    width: 10,
  },
  tuiPane: {
    backgroundColor: colors.terminal,
    boxSizing: 'border-box',
    color: colors.text,
    height: '100%',
    overflow: 'hidden',
    padding: '16px 18px 12px',
    position: 'relative',
  },
  tuiRows: {
    fontFamily: mono,
    letterSpacing: 0,
    overflow: 'hidden',
  },
  tuiRow: {
    height: '1em',
    whiteSpace: 'pre',
  },
  claudeSpacer: {
    height: 0,
  },
  claudeEffort: {
    color: colors.text,
    fontSize: 13,
    height: 22,
    paddingLeft: 2,
    textAlign: 'right',
  },
  rule: {
    backgroundColor: colors.border,
    height: 1,
    width: '100%',
  },
  claudeInput: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 18,
    height: 44,
    whiteSpace: 'pre',
  },
  claudePromptMark: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 800,
    marginRight: 10,
  },
  claudeTranscript: {
    color: colors.text,
    fontSize: 13,
    height: 176,
    overflow: 'hidden',
    paddingTop: 8,
  },
  commandHistory: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  historyLine: {
    alignItems: 'center',
    display: 'flex',
    height: 18,
    lineHeight: '18px',
    minWidth: 0,
    whiteSpace: 'pre',
  },
  historyPrompt: {
    color: colors.orange,
    flex: '0 0 auto',
    fontWeight: 900,
    marginRight: 8,
  },
  historyCommand: {
    color: colors.text,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'clip',
  },
  historyOutput: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    height: 17,
    lineHeight: '17px',
    marginLeft: 18,
    whiteSpace: 'pre',
  },
  syncBlock: {
    marginTop: 2,
  },
  agentLine: {
    color: colors.muted,
    height: 19,
  },
  syncLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginTop: 4,
  },
  outputLine: {
    alignItems: 'center',
    color: colors.text,
    display: 'flex',
    fontSize: 14,
    height: 17,
    lineHeight: '17px',
    whiteSpace: 'pre',
  },
  ok: {
    color: colors.green,
    fontWeight: 800,
    marginRight: 9,
  },
  claudeFooter: {
    bottom: 12,
    color: colors.muted,
    fontSize: 12,
    left: 18,
    overflow: 'hidden',
    position: 'absolute',
    right: 18,
    textOverflow: 'clip',
    whiteSpace: 'pre',
  },
  codexStack: {
    backgroundColor: colors.terminal,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  codexPane: {
    backgroundColor: colors.terminal,
    boxSizing: 'border-box',
    height: '100%',
    overflow: 'hidden',
    padding: '22px 28px 14px',
    position: 'relative',
  },
  codexTip: {
    color: colors.text,
    marginTop: 18,
    maxWidth: 760,
  },
  tipLabel: {
    color: colors.text,
    fontWeight: 800,
  },
  codexBoot: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: 13,
    gap: 8,
    marginTop: 34,
    minWidth: 0,
  },
  bullet: {
    color: colors.text,
    fontSize: 16,
  },
  bootText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'clip',
    whiteSpace: 'nowrap',
  },
  codexInput: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 18,
    height: 42,
    marginTop: 18,
    whiteSpace: 'pre',
  },
  codexPromptMark: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 900,
    marginRight: 10,
  },
  placeholder: {
    color: colors.faint,
    fontStyle: 'italic',
  },
  codexFooter: {
    bottom: 14,
    color: colors.muted,
    fontSize: 13,
    left: 28,
    overflow: 'hidden',
    position: 'absolute',
    right: 28,
    textOverflow: 'clip',
    whiteSpace: 'pre',
  },
};
