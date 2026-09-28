import {
  balancedEnd,
  isSymbol,
  parseCallArguments,
  sliceTokens,
  TokKind,
  type Token,
} from '@engine/runtime/helpers/tokens';

// One step of a value path such as `points[i].front().x`. `source` is the step as written; the
// expression evaluator appends it to a reference so a mutating method can find the stored value.
export type PathStep =
  | { kind: 'index'; tokens: Token[]; closed: boolean; source: Token[] }
  | { kind: 'member'; name: string; source: Token[] }
  | { kind: 'call'; name: string; args: Token[][]; closed: boolean; source: Token[] };

export interface PathSteps {
  steps: PathStep[];
  // The first token after the path.
  end: number;
  // Set when a step is malformed; `steps` holds the ones before it.
  error?: string;
}

const kPaths = new WeakMap<readonly Token[], Map<number, PathSteps>>();

// parsePathSteps, remembered per token array: loops resolve the same targets many times.
export function pathSteps(tokens: readonly Token[], start: number): PathSteps {
  let byStart = kPaths.get(tokens);
  if (!byStart) {
    byStart = new Map();
    kPaths.set(tokens, byStart);
  }
  let path = byStart.get(start);
  if (!path) {
    path = parsePathSteps(tokens, start);
    byStart.set(start, path);
  }

  return path;
}

// The one reader of path syntax, shared by expression reads, assignment targets and source
// tracing: `[index]`, `.member` and `.method(args)` steps from tokens[start] on.
export function parsePathSteps(tokens: readonly Token[], start: number): PathSteps {
  const steps: PathStep[] = [];
  let p = start;
  while (p < tokens.length) {
    if (isSymbol(tokens[p], '[')) {
      const close = balancedEnd(tokens, p);
      const closed = close < tokens.length;
      steps.push({
        kind: 'index',
        tokens: sliceTokens(tokens, p + 1, close),
        closed,
        source: sliceTokens(tokens, p, closed ? close + 1 : close),
      });
      p = closed ? close + 1 : close;
      continue;
    }
    if (isSymbol(tokens[p], '.')) {
      const name = tokens[p + 1];
      if (!name || name.kind !== TokKind.Identifier) return { steps, end: p, error: 'expected member name after .' };
      const open = tokens[p + 2];
      if (open && isSymbol(open, '(')) {
        const close = balancedEnd(tokens, p + 2);
        const closed = close < tokens.length;
        steps.push({
          kind: 'call',
          name: name.text,
          args: parseCallArguments(tokens, p + 2),
          closed,
          source: sliceTokens(tokens, p, closed ? close + 1 : close),
        });
        p = closed ? close + 1 : close;
        continue;
      }
      steps.push({ kind: 'member', name: name.text, source: sliceTokens(tokens, p, p + 2) });
      p += 2;
      continue;
    }
    break;
  }

  return { steps, end: p };
}
