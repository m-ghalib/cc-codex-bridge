// Line-based unified diff, shaped like Python's difflib.unified_diff.
// The diff is shown to human readers and also sampled by a test that looks
// for the "+++ b/<path>" header — so the header format must match.

type Op = { kind: "eq" | "ins" | "del"; line: string; aIndex: number; bIndex: number };

function splitKeepNewlines(text: string): string[] {
  if (text.length === 0) return [];
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function diffOps(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "eq", line: a[i]!, aIndex: i, bIndex: j });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: "del", line: a[i]!, aIndex: i, bIndex: j });
      i++;
    } else {
      ops.push({ kind: "ins", line: b[j]!, aIndex: i, bIndex: j });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "del", line: a[i]!, aIndex: i, bIndex: j });
    i++;
  }
  while (j < m) {
    ops.push({ kind: "ins", line: b[j]!, aIndex: i, bIndex: j });
    j++;
  }
  return ops;
}

function ensureNewline(line: string): string {
  return line.endsWith("\n") ? line : line + "\n\\ No newline at end of file\n";
}

export function unifiedDiff(relPath: string, oldText: string, newText: string, context = 3): string {
  if (oldText === newText) return "";

  const a = splitKeepNewlines(oldText);
  const b = splitKeepNewlines(newText);
  const ops = diffOps(a, b);

  interface Hunk {
    aStart: number;
    aLen: number;
    bStart: number;
    bLen: number;
    lines: string[];
  }

  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let equalTail = 0;

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]!;
    if (op.kind !== "eq") {
      if (!current) {
        const preStart = Math.max(0, k - context);
        const first = ops[preStart]!;
        current = {
          aStart: first.aIndex,
          aLen: 0,
          bStart: first.bIndex,
          bLen: 0,
          lines: [],
        };
        for (let p = preStart; p < k; p++) {
          const pop = ops[p]!;
          current.lines.push(" " + pop.line);
          current.aLen += 1;
          current.bLen += 1;
        }
      }
      if (op.kind === "del") {
        current.lines.push("-" + op.line);
        current.aLen += 1;
      } else {
        current.lines.push("+" + op.line);
        current.bLen += 1;
      }
      equalTail = 0;
      continue;
    }

    if (!current) continue;

    if (equalTail < context) {
      current.lines.push(" " + op.line);
      current.aLen += 1;
      current.bLen += 1;
      equalTail += 1;
      continue;
    }

    let nextChange = -1;
    for (let p = k + 1; p < ops.length; p++) {
      if (ops[p]!.kind !== "eq") {
        nextChange = p;
        break;
      }
    }

    if (nextChange === -1 || nextChange - k > context) {
      hunks.push(current);
      current = null;
      equalTail = 0;
    } else {
      current.lines.push(" " + op.line);
      current.aLen += 1;
      current.bLen += 1;
    }
  }

  if (current) hunks.push(current);
  if (hunks.length === 0) return "";

  let out = `--- a/${relPath}\n+++ b/${relPath}\n`;
  for (const h of hunks) {
    const aStart1 = h.aLen === 0 ? h.aStart : h.aStart + 1;
    const bStart1 = h.bLen === 0 ? h.bStart : h.bStart + 1;
    out += `@@ -${aStart1},${h.aLen} +${bStart1},${h.bLen} @@\n`;
    for (const line of h.lines) out += ensureNewline(line);
  }
  return out;
}
