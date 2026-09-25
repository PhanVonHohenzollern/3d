import { trim } from '../../../utils/cpp';
import type { Statement } from '../interpreter/Statement';
import type { RuntimeApiCall, RuntimeExecutionOptions } from '../RuntimeTypes';
import { sdkCanonicalType } from '../SdkDefinitions';
import { runtimeTypeName, type RuntimeValue } from '../RuntimeValue';
import { parseRuntimeType } from './typeNames';
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

export function parameterSignatureType(param: readonly Token[]): string {
  const tokens = param.slice(0, parameterDefaultPos(param));
  const parsed = parseRuntimeType(tokens, 0);
  const arrayIndex = tokens.findIndex((token) => token.text === '[');
  const nameIndex = parsed
    ? tokens.findIndex(
        (token, index) =>
          index >= parsed.end &&
          (arrayIndex < 0 || index < arrayIndex) &&
          token.kind === TokKind.Identifier &&
          !kParameterQualifiers.includes(token.text),
      )
    : -1;
  if (nameIndex >= 0) tokens.splice(nameIndex, 1);
  let type = tokens.map((token) => sdkCanonicalType(token.text)).join(' ');
  // Top-level cv qualifiers and parameter names/defaults do not define an overload.
  const indirection = type.search(/[&*[]/);
  const base = indirection < 0 ? type : type.slice(0, indirection);
  const qualifiers = ['const', 'volatile'].filter((qualifier) => base.split(/\s+/).includes(qualifier));
  type = base.replace(/\b(const|volatile)\b/g, '').trim() + (indirection < 0 ? '' : type.slice(indirection));
  if (indirection >= 0) type = qualifiers.join(' ') + ' ' + type;
  if (!type.includes('&'))
    type = type.replace(/\b(const|volatile)\s*$/g, '').replace(/\*\s*(?:const\s*|volatile\s*)+$/g, '*');

  type = type
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([&*[\]()])\s*/g, '$1');

  return type.includes('&') ? type : type.replace(/\[[^\]]*\]/, '*');
}

export function functionSignature(fn: Statement): string {
  return `${fn.functionName}(${functionParameters(fn).map(parameterSignatureType).join(', ')})`;
}

export function functionScope(
  fn: Statement,
  overloads: readonly Statement[],
  options?: RuntimeExecutionOptions,
): string {
  return (
    options?.functionScopes?.get(functionSignature(fn)) ??
    (overloads.length > 1 ? functionSignature(fn) : fn.functionName)
  );
}

export function functionArgumentRanks(fn: Statement, args: readonly RuntimeValue[]): number[] | null {
  const params = functionParameters(fn);
  if (args.length < requiredParameterCount(fn) || args.length > params.length) return null;
  const ranks = args.map((value, index) => {
    const expected = parameterSignatureType(params[index])
      .replace(/\b(const|volatile)\b/g, '')
      .replace(/&/g, '')
      .trim();
    const actual = runtimeTypeName(value);
    if (actual === 'unknown' || actual === expected) return 0;
    if (actual === 'string' && expected === 'char*') return 0;
    if (actual.includes('[')) return actual.replace(/\[[^\]]*\]/g, '*') === expected ? 0 : Infinity;
    const numeric = ['bool', 'int', 'short', 'long', 'float', 'double'];
    if (numeric.includes(actual) && numeric.includes(expected)) {
      if (actual === 'bool' && expected === 'int') return 1;

      return 2;
    }

    return Infinity;
  });

  return ranks.every(Number.isFinite) ? ranks : null;
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
