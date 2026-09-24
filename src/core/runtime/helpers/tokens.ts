export const TokKind = { Identifier: 0, Number: 1, String: 2, Symbol: 3, End: 4 } as const;
export type TokKind = (typeof TokKind)[keyof typeof TokKind];

export interface Token {
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
    const text = token.kind === TokKind.String ? `"${token.text}"` : token.text;
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

export function splitTopLevel(tokens: readonly Token[], separator: string): Token[][] {
  const result: Token[][] = [];
  let start = 0;
  let paren = 0,
    bracket = 0,
    brace = 0;
  for (let i = 0; i < tokens.length; ++i) {
    const t = tokens[i];
    if (isSymbol(t, '(')) ++paren;
    else if (isSymbol(t, ')')) --paren;
    else if (isSymbol(t, '[')) ++bracket;
    else if (isSymbol(t, ']')) --bracket;
    else if (isSymbol(t, '{')) ++brace;
    else if (isSymbol(t, '}')) --brace;
    else if (paren === 0 && bracket === 0 && brace === 0 && t.text === separator) {
      result.push(sliceTokens(tokens, start, i));
      start = i + 1;
    }
  }
  result.push(sliceTokens(tokens, start, tokens.length));

  return result;
}

export function parseCallArguments(tokens: readonly Token[], lparen: number): Token[][] {
  if (lparen >= tokens.length || !isSymbol(tokens[lparen], '(')) return [];
  let start = lparen + 1;
  let paren = 0,
    bracket = 0,
    brace = 0;
  const args: Token[][] = [];
  for (let i = lparen + 1; i < tokens.length; ++i) {
    const t = tokens[i];
    if (isSymbol(t, '(')) ++paren;
    else if (isSymbol(t, ')')) {
      if (paren === 0 && bracket === 0 && brace === 0) {
        if (i > start) args.push(sliceTokens(tokens, start, i));
        else if (start !== lparen + 1) args.push([]);

        return args;
      }
      --paren;
    } else if (isSymbol(t, '[')) ++bracket;
    else if (isSymbol(t, ']')) --bracket;
    else if (isSymbol(t, '{')) ++brace;
    else if (isSymbol(t, '}')) --brace;
    else if (isSymbol(t, ',') && paren === 0 && bracket === 0 && brace === 0) {
      args.push(sliceTokens(tokens, start, i));
      start = i + 1;
    }
  }

  return args;
}

const kAssignmentOperators: readonly string[] = ['=', '+=', '-=', '*=', '/='];

export function findTopLevelAssignment(tokens: readonly Token[]): { index: number; op: string } | null {
  let paren = 0,
    bracket = 0,
    brace = 0;
  for (let i = 0; i < tokens.length; ++i) {
    const t = tokens[i];
    if (isSymbol(t, '(')) ++paren;
    else if (isSymbol(t, ')')) --paren;
    else if (isSymbol(t, '[')) ++bracket;
    else if (isSymbol(t, ']')) --bracket;
    else if (isSymbol(t, '{')) ++brace;
    else if (isSymbol(t, '}')) --brace;
    else if (paren === 0 && bracket === 0 && brace === 0 && kAssignmentOperators.includes(t.text))
      return { index: i, op: t.text };
  }

  return null;
}

export function matchingBracketEnd(tokens: readonly Token[], begin: number): { end: number; closed: boolean } {
  let p = begin;
  let depth = 1;
  while (p < tokens.length && depth > 0) {
    if (isSymbol(tokens[p], '[')) ++depth;
    else if (isSymbol(tokens[p], ']')) --depth;
    if (depth === 0) break;
    ++p;
  }

  return { end: p, closed: depth === 0 };
}
