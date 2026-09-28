import type { ApiParameterMetadata, ApiSignatureMetadata } from '@engine/runtime/ApiMetadata.types';
import { stod, stoll } from '@engine/runtime/cpp/cpp';
import { kNativeApiSignatures } from '@engine/runtime/ApiMetadata.generated';
import { additionalApiSignatures } from '@engine/runtime/ApiMetadata.additional';
import type { RuntimeApiCall } from '@engine/runtime/RuntimeTypes';
import {
  isArray,
  isBool,
  isDouble,
  isInt,
  isPoint,
  isString,
  isVector,
  runtimeDeepCopy,
  runtimeDefaultValueForType,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { sdkCanonicalType, sdkTypeDefinition } from '@engine/runtime/SdkDefinitions';

export type { ApiParameterMetadata, ApiSignatureMetadata } from '@engine/runtime/ApiMetadata.types';

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

type CallShape = Pick<RuntimeApiCall, 'name' | 'arguments'>;

function signatureScore(sig: ApiSignatureMetadata, call: CallShape): number {
  const argc = call.arguments.length;
  if (argc < sig.requiredParameterCount || argc > sig.parameters.length) return NO_MATCH;

  let score = 100;
  if (argc === sig.parameters.length) score += 30;
  else score += argc * 2;

  for (let i = 0; i < argc; ++i) score += typeCompatibilityScore(call.arguments[i], sig.parameters[i].type);

  score -= sig.parameters.length - argc;

  return score;
}

const kAllSignatures: readonly ApiSignatureMetadata[] = Object.freeze([
  ...kNativeApiSignatures,
  ...additionalApiSignatures,
]);

const kSignaturesByName = new Map<string, ApiSignatureMetadata[]>();
for (const sig of kAllSignatures) {
  const list = kSignaturesByName.get(sig.name);
  if (list) list.push(sig);
  else kSignaturesByName.set(sig.name, [sig]);
}

export function allNativeApiSignatures(): readonly ApiSignatureMetadata[] {
  return kAllSignatures;
}

// The best-scoring SDK overload for these arguments; the first one wins a tie. The runtime calls
// this once per recorded call and stores the answer in `call.signature`.
export function resolveApiSignature(call: CallShape): ApiSignatureMetadata | null {
  let best: ApiSignatureMetadata | null = null;
  let bestScore = NO_MATCH;
  for (const sig of kSignaturesByName.get(call.name) ?? []) {
    const score = signatureScore(sig, call);
    if (score > bestScore) {
      bestScore = score;
      best = sig;
    }
  }

  return best;
}

export function apiParameterMetadataForCall(call: RuntimeApiCall): ApiParameterMetadata[] {
  return call.signature?.parameters ?? [];
}

function parseNumericDefault(type: string, text: string): RuntimeValue {
  try {
    if (type.includes('int') || type.includes('short') || type.includes('long')) {
      const integer = stoll(text);
      if (integer.used === text.length) return integer.value;
    }
    const real = stod(text);

    return real.used === text.length ? real.value : undefined;
  } catch {
    return undefined;
  }
}

function parseDefaultValue(parameter: ApiParameterMetadata): RuntimeValue {
  const text = parameter.defaultValue;
  if (text === '') return runtimeDefaultValueForType(parameter.type);
  if (text === 'true') return true;
  if (text === 'false') return false;

  return parseNumericDefault(parameter.type, text) ?? runtimeDefaultValueForType(parameter.type);
}

// Copies of the call's arguments followed by the C++ default values of the parameters it left out.
export function effectiveApiArguments(call: RuntimeApiCall): RuntimeValue[] {
  const args = call.arguments.map(runtimeDeepCopy);
  const parameters = call.signature?.parameters ?? [];
  for (let i = args.length; i < parameters.length; ++i) args.push(parseDefaultValue(parameters[i]));

  return args;
}
