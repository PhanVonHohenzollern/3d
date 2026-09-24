import { trim } from '../../../utils/cpp';
import type { Statement } from '../interpreter/Statement';
import type { RuntimeApiCall } from '../RuntimeTypes';
import { isIdentifier, isSymbol, sliceTokens, splitTopLevel, TokKind, tokensToExpression, type Token } from './tokens';

const kParameterQualifiers: readonly string[] = [
  'const',
  'volatile',
  'signed',
  'unsigned',
  'struct',
  'class',
  'typename',
];

export function signatureParameterList(signature: readonly Token[]): Token[] | null {
  let lp = signature.length,
    rp = signature.length;
  let depth = 0;
  for (let i = 0; i < signature.length; ++i) {
    if (isSymbol(signature[i], '(')) {
      if (depth++ === 0) lp = i;
    } else if (isSymbol(signature[i], ')')) {
      if (--depth === 0) {
        rp = i;
        break;
      }
    }
  }
  if (lp >= rp || rp > signature.length) return null;

  return sliceTokens(signature, lp + 1, rp);
}

export function functionParameters(fn: Statement): Token[][] {
  const list = signatureParameterList(fn.signature);
  if (!list) return [];
  const result = splitTopLevel(list, ',');
  if (result.length === 1 && result[0].length === 0) return [];
  if (result.length === 1 && result[0].length === 1 && isIdentifier(result[0][0], 'void')) return [];

  return result;
}

export function parameterDefaultPos(param: readonly Token[]): number {
  let paren = 0,
    bracket = 0,
    brace = 0;
  for (let i = 0; i < param.length; ++i) {
    if (isSymbol(param[i], '(')) ++paren;
    else if (isSymbol(param[i], ')')) --paren;
    else if (isSymbol(param[i], '[')) ++bracket;
    else if (isSymbol(param[i], ']')) --bracket;
    else if (isSymbol(param[i], '{')) ++brace;
    else if (isSymbol(param[i], '}')) --brace;
    else if (paren === 0 && bracket === 0 && brace === 0 && isSymbol(param[i], '=')) return i;
  }

  return param.length;
}

export function parameterName(param: readonly Token[]): string {
  const end = parameterDefaultPos(param);
  for (let i = end; i > 0; --i) {
    const t = param[i - 1];
    if (t.kind !== TokKind.Identifier) continue;
    if (kParameterQualifiers.includes(t.text)) continue;
    if (i < end && isSymbol(param[i], '::')) continue;
    if (i >= 2 && isSymbol(param[i - 2], '::')) continue;

    return t.text;
  }

  return '';
}

export function parameterType(param: readonly Token[]): string {
  const name = parameterName(param);
  if (name === '') return '';
  const end = parameterDefaultPos(param);
  const typeTokens: Token[] = [];
  let removedName = false;
  for (let i = 0; i < end; ++i) {
    if (!removedName && param[i].kind === TokKind.Identifier && param[i].text === name) {
      removedName = true;
      continue;
    }
    typeTokens.push(param[i]);
  }

  return trim(tokensToExpression(typeTokens));
}

export function parameterDefaultExpression(param: readonly Token[]): Token[] {
  return sliceTokens(param, Math.min(parameterDefaultPos(param) + 1, param.length), param.length);
}

export function requiredParameterCount(fn: Statement): number {
  return functionParameters(fn).filter((param) => parameterDefaultPos(param) === param.length).length;
}

export function writableReferenceParameter(param: readonly Token[]): boolean {
  const end = parameterDefaultPos(param);
  let hasReference = false;
  let isConst = false;
  for (let i = 0; i < end; ++i) {
    if (['&', '*', '['].includes(param[i].text)) hasReference = true;
    if (isIdentifier(param[i], 'const')) isConst = true;
  }

  return hasReference && !isConst;
}

export function populateFormalParameterMetadata(call: RuntimeApiCall, fn: Statement): void {
  for (const param of functionParameters(fn)) {
    call.formalParameterNames.push(parameterName(param));
    call.formalParameterTypes.push(parameterType(param));
  }
}
