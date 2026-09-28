export const TokKind = { Identifier: 0, Number: 1, String: 2, Symbol: 3, End: 4 } as const;
export type TokKind = (typeof TokKind)[keyof typeof TokKind];

export interface Token {
  character?: boolean;
  kind: TokKind;
  text: string;
  number: number;
  line: number;
}

export const makeToken = (kind: TokKind, text: string, number = 0.0, line = 1): Token => ({ kind, text, number, line });

export function isSymbol(t: Token, s: string): boolean {
  return t.kind === TokKind.Symbol && t.text === s;
}

export function isIdentifier(t: Token, s: string | null = null): boolean {
  return t.kind === TokKind.Identifier && (s === null || t.text === s);
}

const isWord = (kind: TokKind) => kind === TokKind.Identifier || kind === TokKind.Number || kind === TokKind.String;

export function sliceTokens(v: readonly Token[], begin: number, end: number): Token[] {
  if (begin > end || end > v.length) return [];

  return v.slice(begin, end);
}

export function tokensToExpression(tokens: readonly Token[]): string {
  let out = '';
  let previousKind: TokKind = TokKind.End;
  for (const token of tokens) {
    const text = token.kind === TokKind.String ? (token.character ? `'${token.text}'` : `"${token.text}"`) : token.text;
    if (out !== '' && isWord(token.kind) && isWord(previousKind)) out += ' ';
    out += text;
    previousKind = token.kind;
  }

  return out;
}

export function tokensToText(tokens: readonly Token[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; ++i) {
    const t = tokens[i];
    out += t.kind === TokKind.String ? `"${t.text}"` : t.text;
    if (i + 1 < tokens.length && isWord(t.kind) && isWord(tokens[i + 1].kind)) out += ' ';
  }

  return out;
}

const kOpeners: ReadonlySet<string> = new Set(['(', '[', '{']);
const kClosers: ReadonlySet<string> = new Set([')', ']', '}']);

// The one bracket-nesting walker. Calls `visit` for each token from `start` with the nesting depth
// around it: an opening bracket is seen at its outer depth and a closing one after it closed, so
// depth -1 marks a closer that closes something opened before `start`. Stops at the first token
// for which `visit` returns true and returns its index (tokens.length when none did).
export function scanTopLevel(
  tokens: readonly Token[],
  start: number,
  visit: (token: Token, index: number, depth: number) => boolean | void,
): number {
  let depth = 0;
  for (let i = start; i < tokens.length; ++i) {
    const token = tokens[i];
    const symbol = token.kind === TokKind.Symbol;
    if (symbol && kClosers.has(token.text)) --depth;
    if (visit(token, i, depth)) return i;
    if (symbol && kOpeners.has(token.text)) ++depth;
  }

  return tokens.length;
}

// The index of the bracket that closes tokens[open], or tokens.length when it is never closed.
export function balancedEnd(tokens: readonly Token[], open: number): number {
  return scanTopLevel(tokens, open + 1, (_token, _index, depth) => depth < 0);
}

export function splitTopLevel(tokens: readonly Token[], separator: string): Token[][] {
  const result: Token[][] = [];
  let start = 0;
  scanTopLevel(tokens, 0, (token, i, depth) => {
    if (depth !== 0 || token.text !== separator) return;
    result.push(sliceTokens(tokens, start, i));
    start = i + 1;
  });
  result.push(sliceTokens(tokens, start, tokens.length));

  return result;
}

// The comma-separated arguments of the call whose '(' is at `lparen`.
export function parseCallArguments(tokens: readonly Token[], lparen: number): Token[][] {
  if (lparen >= tokens.length || !isSymbol(tokens[lparen], '(')) return [];
  let start = lparen + 1;
  const args: Token[][] = [];
  scanTopLevel(tokens, lparen + 1, (token, i, depth) => {
    if (depth < 0 && isSymbol(token, ')')) {
      if (i > start) args.push(sliceTokens(tokens, start, i));
      else if (start !== lparen + 1) args.push([]);

      return true;
    }
    if (depth === 0 && isSymbol(token, ',')) {
      args.push(sliceTokens(tokens, start, i));
      start = i + 1;
    }
  });

  return args;
}

const kAssignmentOperators: readonly string[] = ['=', '+=', '-=', '*=', '/='];

export function findTopLevelAssignment(tokens: readonly Token[]): { index: number; op: string } | null {
  const index = scanTopLevel(tokens, 0, (token, _i, depth) => depth === 0 && kAssignmentOperators.includes(token.text));

  return index < tokens.length ? { index, op: tokens[index].text } : null;
}

// The ']' matching a '[' just before `begin`.
export function matchingBracketEnd(tokens: readonly Token[], begin: number): { end: number; closed: boolean } {
  const end = balancedEnd(tokens, begin - 1);

  return { end, closed: end < tokens.length };
}
