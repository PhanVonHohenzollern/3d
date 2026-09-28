import {
  findTopLevelAssignment,
  isIdentifier,
  isSymbol,
  parseCallArguments,
  sliceTokens,
  splitTopLevel,
  TokKind,
  tokensToExpression,
  tokensToText,
  type Token,
} from '@engine/runtime/helpers/tokens';
import { isKnownSdkTypedef, parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { mutatingMethodDot } from '@engine/runtime/helpers/mutatingMethods';
import { isBaseClassCall } from '@engine/runtime/intrinsics';

// What a simple statement (one ending in ';') is, decided once per statement: loops run the same
// statements many times, and every part below is the same token array each time, so the parsed
// expressions for it are reused too.
export type SimpleStatement =
  | { kind: 'empty' }
  | { kind: 'list'; parts: Token[][] }
  | { kind: 'return'; value: Token[] | null }
  | { kind: 'break' }
  | { kind: 'continue' }
  | { kind: 'ignored' }
  | { kind: 'unsupportedTypedef' }
  | { kind: 'declaration' }
  | { kind: 'untypedDeclaration'; name: string; expression: string }
  | { kind: 'increment'; op: string; target: Token[] }
  | { kind: 'assignment' }
  | { kind: 'other' };

const kStatements = new WeakMap<readonly Token[], SimpleStatement>();

// `functions` are the program's function names: `double f(double);` is a prototype, not a variable.
export function simpleStatement(tokens: readonly Token[], functions: ReadonlyMap<string, unknown>): SimpleStatement {
  let statement = kStatements.get(tokens);
  if (!statement) {
    statement = classify(tokens, functions);
    kStatements.set(tokens, statement);
  }

  return statement;
}

function classify(tokens: readonly Token[], functions: ReadonlyMap<string, unknown>): SimpleStatement {
  if (tokens.length === 0) return { kind: 'empty' };
  const parts = splitTopLevel(tokens, ',');
  if (parts.length > 1 && !parseRuntimeType(tokens, 0)) return { kind: 'list', parts };
  if (isIdentifier(tokens[0], 'return')) return { kind: 'return', value: tokens.length > 1 ? tokens.slice(1) : null };
  if (isIdentifier(tokens[0], 'break')) return { kind: 'break' };
  if (isIdentifier(tokens[0], 'continue')) return { kind: 'continue' };
  if (isIdentifier(tokens[0], 'delete')) return { kind: 'ignored' };
  if (isIdentifier(tokens[0], 'typedef'))
    return isKnownSdkTypedef(tokens) ? { kind: 'ignored' } : { kind: 'unsupportedTypedef' };
  const declaredType = parseRuntimeType(tokens, 0);
  const namePosition = declaredType?.end ?? -1;
  if (
    namePosition >= 0 &&
    functions.has(tokens[namePosition]?.text) &&
    tokens[namePosition + 1]?.text === '(' &&
    tokens.at(-1)?.text === ')'
  ) {
    const parameters = splitTopLevel(tokens.slice(namePosition + 2, -1), ',');
    if (parameters.every((p) => !p.length || p[0].text === 'void' || parseRuntimeType(p, 0)))
      return { kind: 'ignored' };
  }
  if (declaredType) return { kind: 'declaration' };
  if (tokens.length >= 2 && tokens[0].kind === TokKind.Identifier && tokens[1].kind === TokKind.Identifier)
    return { kind: 'untypedDeclaration', name: tokens[1].text, expression: tokensToExpression(tokens) };
  const increment = incrementParts(tokens);
  if (increment) return { kind: 'increment', ...increment };
  if (assignmentParts(tokens)) return { kind: 'assignment' };

  return { kind: 'other' };
}

function incrementParts(tokens: readonly Token[]): { op: string; target: Token[] } | null {
  if (tokens.length < 2) return null;
  const last = tokens[tokens.length - 1].text;
  const prefix = tokens[0].text === '++' || tokens[0].text === '--';
  const postfix = last === '++' || last === '--';
  if (!prefix && !postfix) return null;

  return {
    op: prefix ? tokens[0].text : last,
    target: prefix ? sliceTokens(tokens, 1, tokens.length) : sliceTokens(tokens, 0, tokens.length - 1),
  };
}

export interface AssignmentParts {
  op: string;
  target: Token[];
  value: Token[];
}

const kAssignments = new WeakMap<readonly Token[], AssignmentParts | null>();

// `target op value` for the top-level assignment in `tokens` (a = b = c splits at the first '=').
export function assignmentParts(tokens: readonly Token[]): AssignmentParts | null {
  let parts = kAssignments.get(tokens);
  if (parts === undefined) {
    const assignment = findTopLevelAssignment(tokens);
    parts = assignment && {
      op: assignment.op,
      target: sliceTokens(tokens, 0, assignment.index),
      value: sliceTokens(tokens, assignment.index + 1, tokens.length),
    };
    kAssignments.set(tokens, parts);
  }

  return parts;
}

export interface MethodCallParts {
  method: string;
  receiver: Token[];
  argGroups: Token[][];
}

const kMethodCalls = new WeakMap<readonly Token[], MethodCallParts | null>();

// `receiver.method(args)` as a statement.
export function methodCallParts(tokens: readonly Token[]): MethodCallParts | null {
  let parts = kMethodCalls.get(tokens);
  if (parts === undefined) {
    const dot = mutatingMethodDot(tokens);
    parts =
      dot === -1
        ? null
        : {
            method: tokens[dot + 1].text,
            receiver: sliceTokens(tokens, 0, dot),
            argGroups: parseCallArguments(tokens, dot + 2),
          };
    kMethodCalls.set(tokens, parts);
  }

  return parts;
}

export interface FreeCallParts {
  name: string;
  // The call without a BlockCreator3d:: qualifier.
  tokens: Token[];
  argGroups: Token[][];
  baseCall: boolean;
}

const kFreeCalls = new WeakMap<readonly Token[], FreeCallParts | null>();

// `name(args)` or `BlockCreator3d::name(args)` as a statement.
export function freeCallParts(tokens: readonly Token[]): FreeCallParts | null {
  let parts = kFreeCalls.get(tokens);
  if (parts === undefined) {
    parts = null;
    const lparen = tokens.findIndex((token) => token.text === '(');
    if (lparen >= 1) {
      const baseCall = isBaseClassCall(tokensToText(tokens.slice(0, lparen)));
      const call = baseCall ? tokens.slice(lparen - 1) : [...tokens];
      if (call.length >= 2 && call[0].kind === TokKind.Identifier && isSymbol(call[1], '('))
        parts = { name: call[0].text, tokens: call, argGroups: parseCallArguments(call, 1), baseCall };
    }
    kFreeCalls.set(tokens, parts);
  }

  return parts;
}
