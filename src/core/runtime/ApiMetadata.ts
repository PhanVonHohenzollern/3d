import { kNativeApiSignatures } from './ApiMetadata.generated';
import type { RuntimeApiCall } from './RuntimeTypes';
import { isArray, isBool, isDouble, isInt, isPoint, isString, isVector, type RuntimeValue } from './RuntimeValue';
import { sdkCanonicalType, sdkTypeDefinition } from './SdkDefinitions';

export interface ApiParameterMetadata {
  name: string;
  type: string;
  defaultValue: string;
}

export interface ApiSignatureMetadata {
  name: string;
  returnType: string;
  sourceHeader: string;
  requiredParameterCount: number;
  parameters: ApiParameterMetadata[];
}

function compactType(s: string): string {
  for (const needle of ['const ', 'volatile ', 'struct ', 'class ']) s = s.split(needle).join('');
  s = s.replace(/[&*]/g, '');

  return s.replace(/[ \t\n\v\f\r]+/g, ' ').trim();
}

const containsWord = (s: string, word: string) => s.includes(word);

function typeCompatibilityScore(value: RuntimeValue, formalType: string): number {
  let t = compactType(formalType);
  const bracket = t.indexOf('[');
  const base = bracket < 0 ? t : t.slice(0, bracket);
  const alias = sdkTypeDefinition(base);
  if (alias)
    t = alias.baseType + (alias.arrayExtent ? `[${alias.arrayExtent}]` : '') + (bracket < 0 ? '' : t.slice(bracket));
  const formalArray = t.includes('[') || formalType.includes('*');

  if (isPoint(value))
    return !formalArray && (containsWord(t, 'FdPoint3d') || containsWord(t, 'AcGePoint3d')) ? 18 : -10;

  if (isVector(value))
    return !formalArray && (containsWord(t, 'FdVector3d') || containsWord(t, 'AcGeVector3d')) ? 18 : -10;

  if (isArray(value)) {
    if (!formalArray) return -6;
    const elem = sdkCanonicalType(value.elementType);
    if (elem !== '' && containsWord(t, elem)) return 16;

    return elem === '' ? 8 : -10;
  }

  if (isBool(value)) return containsWord(t, 'bool') || containsWord(t, 'Adesk::Boolean') ? 16 : 1;

  if (isInt(value)) {
    if (
      containsWord(t, 'int') ||
      containsWord(t, 'short') ||
      containsWord(t, 'long') ||
      containsWord(t, 'enum') ||
      containsWord(t, 'Type') ||
      containsWord(t, 'Mode') ||
      containsWord(t, 'mode') ||
      containsWord(t, 'line_type')
    )
      return 14;
    if (containsWord(t, 'double') || containsWord(t, 'float') || containsWord(t, 'ads_real')) return 7;

    return 0;
  }

  if (isDouble(value)) {
    if (containsWord(t, 'double') || containsWord(t, 'float') || containsWord(t, 'ads_real')) return 14;
    if (containsWord(t, 'int') || containsWord(t, 'short') || containsWord(t, 'long')) return 4;

    return 0;
  }

  if (isString(value)) {
    if (
      containsWord(t, 'CHAR') ||
      containsWord(t, 'char') ||
      containsWord(t, 'WCHAR') ||
      containsWord(t, 'CString') ||
      containsWord(t, 'string')
    )
      return 16;

    return 0;
  }

  return 0;
}

const NO_MATCH = Number.NEGATIVE_INFINITY;

function signatureScore(sig: ApiSignatureMetadata, call: RuntimeApiCall): number {
  if (sig.name !== call.name) return NO_MATCH;

  const argc = call.arguments.length;
  if (argc < sig.requiredParameterCount || argc > sig.parameters.length) return NO_MATCH;

  let score = 100;
  if (argc === sig.parameters.length) score += 30;
  else score += argc * 2;

  for (let i = 0; i < argc; ++i) score += typeCompatibilityScore(call.arguments[i], sig.parameters[i].type);

  score -= sig.parameters.length - argc;

  return score;
}

export function allNativeApiSignatures(): readonly ApiSignatureMetadata[] {
  return kNativeApiSignatures;
}

export function apiSignatureMetadataForCall(call: RuntimeApiCall): ApiSignatureMetadata | null {
  let best: ApiSignatureMetadata | null = null;
  let bestScore = NO_MATCH;
  for (const sig of kNativeApiSignatures) {
    const score = signatureScore(sig, call);
    if (score > bestScore) {
      bestScore = score;
      best = sig;
    }
  }

  return best;
}

export function apiParameterMetadataForCall(call: RuntimeApiCall): ApiParameterMetadata[] {
  return apiSignatureMetadataForCall(call)?.parameters ?? [];
}
